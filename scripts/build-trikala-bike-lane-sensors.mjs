#!/usr/bin/env node
/**
 * Aggregate Trikala bike-lane LoRa sensor workbooks into a bundled metrics snapshot.
 * Run: npm run build-trikala-bike-lane-sensors
 */
import fs from "node:fs/promises";
import path from "node:path";
import { readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIRROR_DIR = path.join(ROOT, "public", "sharepoint-data", "Trikala", "bike-lane-sensors");
const TMP_ZIP_DIR = path.join(ROOT, ".tmp-bike-lane-inspect", "BIKE LANE SENSORS DATA");
const ZIP_PATH = path.join(
  ROOT,
  "public",
  "Sharepoint_Datasets_06_2026",
  "BIKE LANE SENSORS DATA-20260713T091909Z-2-001.zip"
);
const LOCATIONS_PATH = path.join(ROOT, "public", "data", "trikala", "locations.json");
const OUT_PATH = path.join(ROOT, "public", "data", "trikala", "bike-lane-sensor-metrics.json");

function stripDiacritics(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim();
}

function normalizeLabel(value) {
  return stripDiacritics(value).toUpperCase().replace(/\s+/g, " ").trim();
}

function matchTokens(name) {
  return normalizeLabel(name)
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
}

function parseFilename(name) {
  const base = name.replace(/\.xlsx$/i, "");
  const match = base.match(/^([A-F0-9]{8})\s+(.+)$/i);
  if (!match) return null;
  return { deviceId: match[1].toUpperCase(), label: match[2].trim() };
}

function resolveSensorDir() {
  if (existsSync(MIRROR_DIR)) {
    const files = readdirSync(MIRROR_DIR).filter((f) => f.toLowerCase().endsWith(".xlsx"));
    if (files.length) return MIRROR_DIR;
  }
  if (existsSync(TMP_ZIP_DIR)) {
    const files = readdirSync(TMP_ZIP_DIR).filter((f) => f.toLowerCase().endsWith(".xlsx"));
    if (files.length) return TMP_ZIP_DIR;
  }
  return null;
}

function parseWorkbookMetrics(filePath) {
  const wb = XLSX.readFile(filePath);
  const rows = [];
  for (const sheetName of wb.SheetNames) {
    const sheetRows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: "" });
    rows.push(...sheetRows);
  }
  let busy = 0;
  let free = 0;
  let unknown = 0;
  const timestamps = [];
  let tempSum = 0;
  let tempCount = 0;
  let battSum = 0;
  let battCount = 0;

  rows.forEach((row) => {
    const status = String(row["Parking status"] ?? "").trim().toUpperCase();
    if (status === "BUSY") busy += 1;
    else if (status === "FREE") free += 1;
    else unknown += 1;

    const received = String(row["Received at"] ?? "").trim();
    if (received) timestamps.push(received);

    const temp = Number.parseFloat(String(row["Temp. [°C]"] ?? "").replace(",", "."));
    if (Number.isFinite(temp)) {
      tempSum += temp;
      tempCount += 1;
    }
    const batt = Number.parseFloat(String(row["Batt. [mV]"] ?? "").replace(",", "."));
    if (Number.isFinite(batt)) {
      battSum += batt;
      battCount += 1;
    }
  });

  const known = busy + free;
  const busyPct = known > 0 ? Math.round((busy / known) * 100) : null;
  const availabilityPct = busyPct != null ? 100 - busyPct : null;
  timestamps.sort();
  return {
    observationCount: rows.length,
    busyCount: busy,
    freeCount: free,
    unknownStatusCount: unknown,
    busyPct,
    availabilityPct,
    periodStart: timestamps[0] ?? null,
    periodEnd: timestamps[timestamps.length - 1] ?? null,
    avgTempC: tempCount > 0 ? Math.round((tempSum / tempCount) * 10) / 10 : null,
    avgBattMv: battCount > 0 ? Math.round(battSum / battCount) : null,
    sheetCount: wb.SheetNames.length,
    sheetNames: wb.SheetNames,
  };
}

function joinToLocation(label, locations) {
  const norm = normalizeLabel(label);
  const pool = locations.filter((l) => l.kind === "bike_lane_sensor");
  const exact = pool.find((l) => normalizeLabel(l.name) === norm);
  if (exact) return { locationId: exact.id, joinMethod: "exact-name" };

  const tokens = matchTokens(label);
  if (!tokens.length) return { locationId: null, joinMethod: null };

  const hits = pool.filter((loc) => tokens.every((t) => loc.matchTokens?.includes(t)));
  if (hits.length === 1) return { locationId: hits[0].id, joinMethod: "token-overlap" };
  if (hits.length > 1) {
    const best = [...hits].sort(
      (a, b) => Math.abs(a.name.length - label.length) - Math.abs(b.name.length - label.length)
    )[0];
    return { locationId: best.id, joinMethod: "token-overlap-ambiguous" };
  }
  return { locationId: null, joinMethod: null };
}

async function main() {
  const sensorDir = resolveSensorDir();
  if (!sensorDir) {
    console.warn("No bike-lane sensor workbooks found — writing empty metrics bundle.");
    await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
    await fs.writeFile(
      OUT_PATH,
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          sourceDir: null,
          sourceZip: existsSync(ZIP_PATH) ? "BIKE LANE SENSORS DATA-20260713T091909Z-2-001.zip" : null,
          sensorCount: 0,
          joinedCount: 0,
          sensors: [],
          fleet: { busyPct: null, availabilityPct: null, observationCount: 0 },
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    return;
  }

  let locations = [];
  try {
    const bundle = JSON.parse(await fs.readFile(LOCATIONS_PATH, "utf8"));
    locations = bundle.locations ?? [];
  } catch {
    console.warn("locations.json not found — joins will be empty.");
  }

  const files = readdirSync(sensorDir).filter((f) => f.toLowerCase().endsWith(".xlsx"));
  const sensors = [];
  for (const file of files.sort()) {
    const parsed = parseFilename(file);
    if (!parsed) {
      console.warn(`Skipping unparseable filename: ${file}`);
      continue;
    }
    const metrics = parseWorkbookMetrics(path.join(sensorDir, file));
    const join = joinToLocation(parsed.label, locations);
    sensors.push({
      deviceId: parsed.deviceId,
      label: parsed.label,
      sourceFile: `Trikala/bike-lane-sensors/${file}`,
      locationId: join.locationId,
      joinMethod: join.joinMethod,
      ...metrics,
    });
  }

  const joined = sensors.filter((s) => s.locationId);
  const fleetBusy =
    sensors.length > 0
      ? Math.round(
          sensors.reduce((sum, s) => sum + (s.busyPct ?? 0), 0) /
            sensors.filter((s) => s.busyPct != null).length
        )
      : null;

  const payload = {
    generatedAt: new Date().toISOString(),
    sourceDir: path.relative(ROOT, sensorDir).replace(/\\/g, "/"),
    sourceZip: "BIKE LANE SENSORS DATA-20260713T091909Z-2-001.zip",
    sensorCount: sensors.length,
    joinedCount: joined.length,
    sensors,
    fleet: {
      busyPct: Number.isFinite(fleetBusy) ? fleetBusy : null,
      availabilityPct: fleetBusy != null ? 100 - fleetBusy : null,
      observationCount: sensors.reduce((sum, s) => sum + s.observationCount, 0),
      linkedLocationCount: joined.length,
    },
  };

  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
  await fs.writeFile(OUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(
    `Wrote ${sensors.length} bike-lane sensors (${joined.length} joined to registry) → public/data/trikala/bike-lane-sensor-metrics.json`
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
