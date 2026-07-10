#!/usr/bin/env node
/**
 * Build Issy catalogue snapshot from extracted SharePoint mirror.
 * Run: npm run extract-sharepoint && npm run build-issy-catalogue
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SP = path.join(ROOT, "public", "sharepoint-data", "Issy-20260625T113904Z-3-001", "Issy");
const OUT = path.join(ROOT, "public", "data", "issy");

const XLSX_INVENTORY = [
  {
    id: "issy-wintics-baseline-xlsx",
    file: "1. BASELINE DATA from Issy/baseline_evaluation_data_light_emitting_marking_solution.xlsx",
    title: "Wintics baseline — light-emitting markings",
    pilotIds: ["issy-p1"],
    linkedKpis: ["kpi1.2", "kpi2.1"],
    parserStatus: "integrated",
    geometry: "point",
    notes: "Site camera at living-lab junction; baseline only — no post Wintics workbook in drop.",
  },
  {
    id: "issy-classeur-emissions-xlsx",
    file: "1. BASELINE DATA from Issy/Classeur.xlsx",
    title: "ASIF emissions workbook (Classeur)",
    pilotIds: ["issy-p1", "issy-p3"],
    linkedKpis: ["kpi3.2"],
    parserStatus: "integrated",
    geometry: "segment",
    notes: "Modelled CO₂ from traffic flows and fleet emission factors (~1,911 g baseline for 50 m corridor).",
  },
  {
    id: "issy-data-requirements-xlsx",
    file: "Pre-intervention evaluation - data requirements.xlsx",
    title: "Pre-intervention data requirements matrix",
    pilotIds: ["issy-p1", "issy-p2", "issy-p3"],
    linkedKpis: ["kpi1.2", "kpi2.1", "kpi3.1", "kpi3.2"],
    parserStatus: "ready",
    geometry: "none",
    notes: "KPI readiness by intervention — Wintics completed, GecoAir in progress, iRAP not started.",
  },
  {
    id: "issy-metadata-records-xlsx",
    file: "ELABORATOR_Issy-Le-Molineaux_Metadata_Records.xlsx",
    title: "ELABORATOR metadata records template",
    pilotIds: ["issy-p1", "issy-p2", "issy-p3"],
    linkedKpis: [],
    parserStatus: "planned",
    geometry: "none",
    notes: "FAIR metadata template — partially filled for Traffic data 2025.",
  },
];

function sheetNamesFor(fileRel) {
  const full = path.join(SP, fileRel);
  try {
    const wb = XLSX.readFile(full);
    return wb.SheetNames;
  } catch {
    return [];
  }
}

function parseRequirementsMatrix() {
  const full = path.join(SP, "Pre-intervention evaluation - data requirements.xlsx");
  try {
    const wb = XLSX.readFile(full);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
      header: 1,
      defval: "",
    });
    const matrix = [];
    let currentTheme = "";
    let currentKpi = "";
    for (let i = 2; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.every((c) => !String(c ?? "").trim())) continue;
      if (row[0]) currentTheme = String(row[0]).trim();
      if (row[1]) currentKpi = String(row[1]).trim();
      let dataRequired = String(row[2] ?? "").trim();
      if (!dataRequired || dataRequired === "NA") {
        if (!currentKpi || !/\d+\.\d+/.test(currentKpi)) continue;
        dataRequired = currentKpi.replace(/^\d+(?:\.\d+)*\.\s*/i, "").trim() || currentKpi;
      }
      matrix.push({
        theme: currentTheme,
        kpi: currentKpi,
        dataRequired,
        pilot1Data: String(row[3] ?? "").trim() || null,
        pilot1Status: String(row[4] ?? "").trim() || null,
        pilot2Data: String(row[5] ?? "").trim() || null,
        pilot2Status: String(row[6] ?? "").trim() || null,
        pilot3Data: String(row[7] ?? "").trim() || null,
        pilot3Status: String(row[8] ?? "").trim() || null,
      });
    }
    return matrix;
  } catch {
    return [];
  }
}

const STATIC_FILES = [
  {
    id: "issy-flow-baseline-csv",
    file: "1. BASELINE DATA from Issy/ISSY1 - detailed traffic data/ISSY1_baseline_traffic_data_november_2024.csv",
    title: "ISSY1 zone OD — baseline (Nov 2024)",
    format: "csv",
    integrationStatus: "integrated",
    pilotIds: ["issy-p1", "issy-p2", "issy-p3"],
    linkedKpis: ["kpi1.2"],
    sheets: [],
    notes: "3,118 hourly OD rows; bundled at /data/issy/.",
  },
  {
    id: "issy-flow-post-csv",
    file: "2. POST IMPLEMENTATION DATA from Issy/ISSY1 - detailed traffic_data/ISSY1_post_intervention_traffic_data_november_2025.csv",
    title: "ISSY1 zone OD — post (Nov 2025)",
    format: "csv",
    integrationStatus: "integrated",
    pilotIds: ["issy-p1", "issy-p2", "issy-p3"],
    linkedKpis: ["kpi1.2"],
    sheets: [],
    notes: "2,944 hourly OD rows; paired with baseline for comparison.",
  },
  {
    id: "issy-flowell-synthesis-pdf",
    file: "1. BASELINE DATA from Issy/FLOWELL ISSY - T0-T1 SYNTHESIS .pdf",
    title: "FLOWELL Issy T0–T1 synthesis report",
    format: "pdf",
    integrationStatus: "catalogued",
    pilotIds: ["issy-p1"],
    linkedKpis: ["kpi1.2"],
    sheets: [],
    notes: "Partner synthesis PDF — narrative and stakeholder context.",
  },
  {
    id: "issy-evaluation-plan-docx",
    file: "ISSY Intervention Evaluation Plan_DRAFT (1).docx",
    title: "Intervention evaluation plan (draft)",
    format: "docx",
    integrationStatus: "catalogued",
    pilotIds: ["issy-p1", "issy-p2", "issy-p3"],
    linkedKpis: [],
    sheets: [],
    notes: "Evaluation methodology draft from Issy partners.",
  },
  {
    id: "issy-baseline-readme-docx",
    file: "1. BASELINE DATA from Issy/ISSY1 - detailed traffic data/readme.docx",
    title: "ISSY1 baseline OD readme",
    format: "docx",
    integrationStatus: "catalogued",
    pilotIds: ["issy-p1", "issy-p2", "issy-p3"],
    linkedKpis: ["kpi1.2"],
    sheets: [],
    notes: "Zone and CSV field definitions for baseline traffic data.",
  },
  {
    id: "issy-post-readme-docx",
    file: "2. POST IMPLEMENTATION DATA from Issy/ISSY1 - detailed traffic_data/readme.docx",
    title: "ISSY1 post-intervention OD readme",
    format: "docx",
    integrationStatus: "catalogued",
    pilotIds: ["issy-p1", "issy-p2", "issy-p3"],
    linkedKpis: ["kpi1.2"],
    sheets: [],
    notes: "Zone and CSV field definitions for post-intervention traffic data.",
  },
  {
    id: "issy-cycling-infra-api",
    file: "(live API — not in SharePoint zip)",
    title: "KPI 3.1 — Cycling / zero-emission facilities API",
    format: "api",
    integrationStatus: "integrated",
    pilotIds: ["issy-p2"],
    linkedKpis: ["kpi3.1"],
    sheets: [],
    notes:
      "Observed facility counts and map geometry from Issy cycling infrastructure REST API. No ZEM inventory file in the June 2026 zip — requirements xlsx marks KPI 3.1 as NA for all pilots.",
    publicPath: null,
  },
];

async function main() {
  await fs.mkdir(OUT, { recursive: true });

  const xlsxFiles = XLSX_INVENTORY.map((item) => ({
    ...item,
    format: "xlsx",
    integrationStatus: item.parserStatus === "ready" ? "catalogued" : "extracted",
    sheets: sheetNamesFor(item.file),
    publicPath: `/sharepoint-data/Issy-20260625T113904Z-3-001/Issy/${item.file.replace(/\\/g, "/")}`,
  }));

  const staticWithPaths = STATIC_FILES.map((item) => ({
    ...item,
    publicPath:
      item.publicPath === null
        ? null
        : `/sharepoint-data/Issy-20260625T113904Z-3-001/Issy/${item.file.replace(/\\/g, "/")}`,
  }));

  const snapshot = {
    generatedAt: new Date().toISOString(),
    sourceDrop: "Issy (Paris) Lighthouse-20260625T113904Z-3-001.zip",
    zipFileCount: 21,
    extractedFileCount: xlsxFiles.length + staticWithPaths.length + 6,
    dataReadinessMatrix: parseRequirementsMatrix(),
    files: [...staticWithPaths, ...xlsxFiles],
    kpi31ZeroEmission: {
      sharePointFile: false,
      requirementsStatus: "NA for all pilots (Pilot 1, 2, 3) in pre-intervention matrix",
      runtimeSource: "issy-cycling-infra-api",
      runtimeSourceLabel: "City cycling infrastructure REST API (live)",
      primaryPilot: "issy-p2",
      notes:
        "KPI 3.1 is supported in the app via the facilities API, not via a SharePoint workbook. No EV-charging or ZEM facility inventory was delivered in the June 2026 drop.",
    },
    gaps: [
      "KPI 3.1 (zero-emission facilities): no SharePoint file — live cycling infrastructure API only; partners marked all pilots NA in requirements xlsx.",
      "Post-intervention Wintics evaluation workbook (Pilot 1 T1) not in June 2026 drop.",
      "GecoAir app export feeds not yet delivered (requirements: in progress).",
      "iRAP / CycleRAP safety scores not started per requirements matrix.",
      "Official zone polygon GIS — map uses layout-approximated centroids.",
      "Large intervention videos (~630 MB) require --include-issy-media extract flag.",
    ],
  };

  const outPath = path.join(OUT, "catalogue-snapshot.json");
  await fs.writeFile(outPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  console.log(`Wrote ${outPath}`);
  console.log(`  files: ${snapshot.files.length}`);
  console.log(`  readiness rows: ${snapshot.dataReadinessMatrix.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
