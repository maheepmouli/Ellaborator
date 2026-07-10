#!/usr/bin/env node
/**
 * Parse Issy Wintics baseline + Classeur ASIF workbooks into committed JSON snapshots.
 * Run: npm run extract-sharepoint && npm run build-issy-workbooks
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SP = path.join(ROOT, "public", "sharepoint-data", "Issy-20260625T113904Z-3-001", "Issy");
const OUT = path.join(ROOT, "public", "data", "issy");

const MODE_KEYS = [
  "motorcycles",
  "buses",
  "trucks",
  "pedestrians",
  "scooters",
  "cyclists",
  "cars",
  "lcv",
];

function parseNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(",", ".").trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function rowToModeRecord(row, startCol) {
  const record = {};
  MODE_KEYS.forEach((key, i) => {
    const v = parseNumber(row[startCol + i]);
    if (v != null) record[key] = v;
  });
  return record;
}

function parseWinticsWorkbook(filePath) {
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  const timeBandLabels = {
    "8:00-11:59": "morning",
    "12:00-16:59": "afternoon",
    "17:00-20:59": "evening",
    "21:00-7:59": "night",
  };

  const timeBands = [];
  let periodNote = null;

  for (let i = 2; i < rows.length; i++) {
    const row = rows[i];
    const label = String(row[0] ?? "").trim();
    if (!label) continue;
    if (label === "Overall") {
      continue;
    }
    if (timeBandLabels[label]) {
      timeBands.push({
        id: timeBandLabels[label],
        label,
        meanSpeedKmh: parseNumber(row[1]),
        p85SpeedKmh: parseNumber(row[2]),
        trafficFlowPerHour: rowToModeRecord(row, 3),
        modalSharePct: rowToModeRecord(row, 11),
      });
      continue;
    }
    const periodMatch = String(row[1] ?? "").match(/(\d{4}\/\d{2}\/\d{2})\s*-\s*(\d{4}\/\d{2}\/\d{2})/);
    if (periodMatch) {
      periodNote = `${periodMatch[1]} – ${periodMatch[2]}`;
    }
  }

  const overallRow = rows.find((r) => String(r[0] ?? "").trim() === "Overall");
  if (!overallRow) {
    throw new Error("Wintics workbook: missing Overall row");
  }

  return {
    sourceFile:
      "1. BASELINE DATA from Issy/baseline_evaluation_data_light_emitting_marking_solution.xlsx",
    datasetId: "issy-wintics-baseline-xlsx",
    locationLabel: "Living-lab site · Wintics camera (Pont d'Issy)",
    period: periodNote ?? "2024-11-01 – 2024-11-30",
    notes: [
      "Point measurement at the luminous-markings pilot site — not zone OD CSV.",
      "Operating speeds sourced from Issy open-data portal upstream of the living lab.",
    ],
    overall: {
      meanSpeedKmh: parseNumber(overallRow[1]),
      p85SpeedKmh: parseNumber(overallRow[2]),
      trafficFlowPerHour: rowToModeRecord(overallRow, 3),
      modalSharePct: rowToModeRecord(overallRow, 11),
    },
    timeBands,
  };
}

function parseClasseurWorkbook(filePath) {
  const wb = XLSX.readFile(filePath);
  const asif = wb.Sheets.ASIF;
  if (!asif) throw new Error("Classeur workbook: missing ASIF sheet");

  const rows = XLSX.utils.sheet_to_json(asif, { header: 1, defval: "" });
  const trafficRow = rows.find((r) => String(r[1] ?? "").trim() === "Traffic") ?? rows[2];
  const factorRow = rows.find((r) => String(r[1] ?? "").includes("Emission factor")) ?? rows[3];
  const emissionsRow = rows.find((r) => String(r[1] ?? "").trim() === "Emissions") ?? rows[4];
  const totalRow =
    rows.find((r) => String(r[1] ?? "").includes("Total baseline CO2")) ?? rows[6];

  const corridorLengthKm = parseNumber(trafficRow[10]) ?? 0.05;

  const fleetMix = {};
  for (const sheetName of ["Bus", "Cars", "Cyclists"]) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const sheetRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    const mix = {};
    sheetRows.forEach((row) => {
      const key = String(row[0] ?? "").trim();
      if (!key || key === "Technology") return;
      const value = parseNumber(row[1]);
      if (value != null) mix[key] = value;
    });
    fleetMix[sheetName.toLowerCase()] = mix;
  }

  return {
    sourceFile: "1. BASELINE DATA from Issy/Classeur.xlsx",
    datasetId: "issy-classeur-emissions-xlsx",
    modelLabel: "ASIF corridor emissions model",
    corridorLengthKm,
    corridorLengthM: corridorLengthKm * 1000,
    trafficFlowPerHour: rowToModeRecord(trafficRow, 1),
    emissionFactorsGCo2PerVkm: rowToModeRecord(factorRow, 1),
    emissionsGCo2PerHour: rowToModeRecord(emissionsRow, 1),
    totalBaselineCo2G: parseNumber(totalRow[1]) ?? 0,
    fleetMix,
    notes: [
      "Modelled CO₂ from traffic flows and Île-de-France fleet emission factors — not measured emissions.",
      `Baseline total ~${Math.round(parseNumber(totalRow[1]) ?? 0)} g CO₂/h for ${corridorLengthKm * 1000} m corridor.`,
    ],
  };
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const generatedAt = new Date().toISOString();

  const winticsPath = path.join(
    SP,
    "1. BASELINE DATA from Issy/baseline_evaluation_data_light_emitting_marking_solution.xlsx"
  );
  const classeurPath = path.join(SP, "1. BASELINE DATA from Issy/Classeur.xlsx");

  const wintics = { generatedAt, ...parseWinticsWorkbook(winticsPath) };
  const classeur = { generatedAt, ...parseClasseurWorkbook(classeurPath) };

  await fs.writeFile(
    path.join(OUT, "wintics-baseline-snapshot.json"),
    `${JSON.stringify(wintics, null, 2)}\n`,
    "utf8"
  );
  await fs.writeFile(
    path.join(OUT, "classeur-emissions-snapshot.json"),
    `${JSON.stringify(classeur, null, 2)}\n`,
    "utf8"
  );

  console.log("Wrote wintics-baseline-snapshot.json");
  console.log(`  cyclists modal share: ${wintics.overall.modalSharePct.cyclists}%`);
  console.log("Wrote classeur-emissions-snapshot.json");
  console.log(`  total baseline CO₂: ${classeur.totalBaselineCo2G} g/h`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
