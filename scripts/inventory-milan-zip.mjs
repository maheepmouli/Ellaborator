#!/usr/bin/env node
/**
 * Inventory Milano SharePoint zip: folder tree, Excel sheets, shapefile geometry,
 * pilot/phase/KPI inference, and KPI × pilot readiness matrix.
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";
import * as shapefile from "shapefile";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ZIP = path.join(ROOT, "public/Sharepoint_Datasets_06_2026/Milano-20260709T084301Z-2-001.zip");
const TMP = path.join(ROOT, "public/sharepoint-data/.inventory-tmp/milan");
const OUT_JSON = path.join(ROOT, "docs/MILAN_DATA_INVENTORY.json");
const OUT_MD = path.join(ROOT, "docs/MILAN_DATA_INVENTORY.md");

const KPI_FOLDER_MAP = [
  { pattern: /\/2\.\s*Plans to expand/i, kpi: "kpi1.1", label: "Plans to expand" },
  { pattern: /\/3\.\s*Road user counts/i, kpi: "kpi1.2", label: "Road user counts" },
  { pattern: /\/4\.\s*Speed measurements/i, kpi: "kpi2.1", label: "Speed measurements" },
  { pattern: /\/6\.\s*CO2 and noise/i, kpi: "kpi3.2", label: "CO2 and noise emissions" },
  { pattern: /\/7\.\s*Survey results/i, kpi: "kpi4.1", label: "Survey results" },
  { pattern: /\/8\.\s*Data - accessibility/i, kpi: "kpi4.2", label: "Accessibility features" },
  { pattern: /\/9\.\s*Intervention/i, kpi: "kpi3.1", label: "Intervention data (9)" },
  { pattern: /\/10\.\s*Intervention/i, kpi: "kpi3.1", label: "Intervention data (10)" },
  { pattern: /1\.\s*Shape file/i, kpi: "corridor", label: "Pilot corridor shapefiles" },
  { pattern: /DSS pedestrian tool graph/i, kpi: "kpi4.2", label: "DSS walk graph" },
  { pattern: /Evaluation Data Ex/i, kpi: "evaluation", label: "Evaluation (ex post)" },
];

function listZipMembers() {
  const output = execSync(`tar -tf "${ZIP}"`, { encoding: "utf8", maxBuffer: 120 * 1024 * 1024 });
  return output.split(/\r?\n/).filter(Boolean);
}

function inferPilot(member) {
  const lower = member.toLowerCase();
  if (lower.includes("pilot 1") || lower.includes("olimpic") || lower.includes("olympic") || lower.includes("cdm1"))
    return "mil-p1";
  if (lower.includes("pilot 2") || lower.includes("west axis") || lower.includes("tactical") || lower.includes("cdm2"))
    return "mil-p2";
  if (lower.includes("pilot 3") || lower.includes("dss") || lower.includes("cdm3") || lower.includes("walk_graph"))
    return "mil-p3";
  return "city-wide";
}

function inferPhase(member) {
  const lower = member.toLowerCase();
  if (lower.includes("/evaluation/") || lower.includes("evaluation data ex") || lower.includes("/ex post/"))
    return "evaluation";
  if (lower.includes("/baseline/") || lower.includes("ex ante")) return "baseline";
  return "unknown";
}

function inferKpi(member) {
  for (const entry of KPI_FOLDER_MAP) {
    if (entry.pattern.test(member)) return entry.kpi;
  }
  if (/\.shp$/i.test(member) && /network/i.test(member)) return "kpi2.1";
  if (/\.shp$/i.test(member) && /rete|co2|noise/i.test(member)) return "kpi3.2";
  if (/\.xlsx$/i.test(member) && /accessibility/i.test(member)) return "kpi4.2";
  if (/\.xlsx$/i.test(member) && /survey/i.test(member)) return "kpi4.1";
  if (/\.xlsx$/i.test(member) && /count/i.test(member)) return "kpi1.2";
  return null;
}

function inferGeometryType(member) {
  if (/\.shp$/i.test(member)) return "shapefile";
  if (/\.xlsx?$/i.test(member)) return "none";
  if (/\.(pdf|docx?)$/i.test(member)) return "none";
  if (/\.(csv|json)$/i.test(member)) return "none";
  return null;
}

function folderSummary(members) {
  const top = new Map();
  for (const m of members) {
    const parts = m.replace(/^Milano\//, "").split("/");
    const key = parts.slice(0, 2).join("/") || parts[0] || m;
    top.set(key, (top.get(key) || 0) + 1);
  }
  return [...top.entries()].sort((a, b) => b[1] - a[1]);
}

function extractMember(member) {
  fs.mkdirSync(TMP, { recursive: true });
  const quoted = member.includes(" ") ? `"${member}"` : member;
  execSync(`tar -xf "${ZIP}" -C "${TMP}" ${quoted}`, { stdio: "pipe", maxBuffer: 120 * 1024 * 1024 });
  return path.join(TMP, member);
}

function inspectXlsx(filePath) {
  const wb = XLSX.readFile(filePath, { cellDates: true });
  const sheets = {};
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "", raw: false });
    const headerRow = rows.find((r) => r.some((c) => String(c || "").trim()));
    sheets[name] = {
      rowCount: rows.length,
      previewHeaders: (headerRow || []).slice(0, 12).map((c) => String(c || "")),
    };
  }
  return { sheetNames: wb.SheetNames, sheets };
}

async function inspectShapefile(shpPath) {
  const dbfPath = shpPath.replace(/\.shp$/i, ".dbf");
  const source = await shapefile.open(shpPath, dbfPath);
  const geometryTypes = new Set();
  let featureCount = 0;
  let sampleProps = {};
  while (featureCount < 5000) {
    const result = await source.read();
    if (result.done) break;
    const geom = result.value?.geometry;
    if (geom?.type) geometryTypes.add(geom.type);
    if (featureCount === 0 && result.value?.properties) {
      sampleProps = Object.keys(result.value.properties).slice(0, 12);
    }
    featureCount += 1;
  }
  return {
    featureCount,
    geometryTypes: [...geometryTypes],
    propertyKeys: sampleProps,
    crs: "EPSG:3003 (Monte Mario / Italy zone 1 — inferred from AMAT pipeline)",
  };
}

function buildFileCatalog(members) {
  return members.map((member) => {
    const shortPath = member.replace(/^Milano\//, "");
    const ext = path.extname(member).toLowerCase();
    return {
      path: shortPath,
      extension: ext || "(dir)",
      pilotId: inferPilot(member),
      phase: inferPhase(member),
      linkedKpi: inferKpi(member),
      geometryHint: inferGeometryType(member),
      sizeCategory: ext === ".xlsx" ? "workbook" : ext === ".shp" ? "shapefile" : ext || "folder",
    };
  });
}

function buildKpiPilotMatrix(catalog, shapefileDetails, xlsxDetails) {
  const pilots = ["mil-p1", "mil-p2", "mil-p3", "city-wide"];
  const kpis = ["kpi1.1", "kpi1.2", "kpi2.1", "kpi3.1", "kpi3.2", "kpi4.1", "kpi4.2"];
  const matrix = [];

  for (const kpi of kpis) {
    for (const pilot of pilots) {
      const files = catalog.filter((f) => {
        if (f.linkedKpi !== kpi && !(kpi === "kpi3.1" && f.linkedKpi === "kpi3.1")) return false;
        if (pilot === "city-wide") return f.pilotId === "city-wide";
        return f.pilotId === pilot || f.pilotId === "city-wide";
      });
      if (!files.length && pilot !== "city-wide") {
        const cityWide = catalog.filter((f) => f.linkedKpi === kpi && f.pilotId === "city-wide");
        if (!cityWide.length) continue;
      }
      if (!files.length) continue;

      const phases = [...new Set(files.map((f) => f.phase))];
      const geocodes = files
        .filter((f) => f.geometryHint === "shapefile")
        .map((f) => {
          const detail = shapefileDetails.find((s) => s.path === f.path);
          return detail?.geometryTypes?.join("/") || "LineString/Point";
        });
      const uniqueGeo = [...new Set(geocodes)];
      const geoQuality =
        uniqueGeo.length > 0
          ? "exact (EPSG:3003 shapefile)"
          : files.some((f) => f.extension === ".xlsx" && /camera|count/i.test(f.path))
            ? "matched (camera shapefile join)"
            : files.some((f) => f.extension === ".xlsx")
              ? "none (aggregate workbook)"
              : "none (document)";

      matrix.push({
        kpi,
        pilotId: pilot,
        fileCount: files.length,
        phases,
        geocoding: geoQuality,
        geometryTypes: uniqueGeo.length ? uniqueGeo : ["none"],
        sampleFiles: files.slice(0, 5).map((f) => f.path),
        websiteReadiness: getWebsiteReadiness(kpi, pilot, files, phases),
      });
    }
  }
  return matrix;
}

function getWebsiteReadiness(kpi, pilot, files, phases) {
  const hasBaseline = phases.includes("baseline");
  const hasEval = phases.includes("evaluation");
  const parserMap = {
    "kpi1.1": "not_wired",
    "kpi1.2": "parser_ready_map_mock",
    "kpi2.1": pilot === "mil-p3" ? "unavailable" : "parser_ready_proxy_fallback",
    "kpi3.1": "not_wired",
    "kpi3.2": pilot === "mil-p3" ? "partial" : "parser_ready",
    "kpi4.1": "planned_mock",
    "kpi4.2": pilot === "mil-p3" ? "partial" : "parser_partial",
  };
  let status = parserMap[kpi] || "unknown";
  if (kpi === "kpi1.2" && hasBaseline && !hasEval) status += "_baseline_only";
  if (kpi === "kpi1.2" && hasBaseline && hasEval) status = "parser_ready_before_after";
  return status;
}

function renderBundledJsonSummary() {
  const lines = ["## Bundled JSON outputs (website-ready)", ""];
  try {
    const modeShare = JSON.parse(fs.readFileSync(path.join(ROOT, "public/data/milan/mode-share-counts.json"), "utf8"));
    lines.push(`### mode-share-counts.json (${modeShare.siteCount} site-phase rows)`, "");
    lines.push("| Site | Pilot | Phase | Geocode | Bike share % |");
    lines.push("|---|---|---|---|---:|");
    for (const site of modeShare.sites || []) {
      lines.push(
        `| ${site.studyName} | ${site.pilotId} | ${site.phase} | ${site.spatialQuality} (${site.locationMethod}) | ${site.bikeSharePct} |`
      );
    }
    lines.push("");
  } catch {
    lines.push("_mode-share-counts.json not generated yet._", "");
  }
  try {
    const survey = JSON.parse(fs.readFileSync(path.join(ROOT, "public/data/milan/survey-insights.json"), "utf8"));
    lines.push(`### survey-insights.json — status: ${survey.status}`, "");
    if (survey.note) lines.push(survey.note, "");
  } catch {
    lines.push("_survey-insights.json not generated yet._", "");
  }
  try {
    const walk = JSON.parse(fs.readFileSync(path.join(ROOT, "public/data/milan/walk-graph.geojson"), "utf8"));
    lines.push(`### walk-graph.geojson — ${walk.features?.length ?? 0} LineString features (mil-p3 DSS clip)`, "");
  } catch {
    lines.push("_walk-graph.geojson not generated yet._", "");
  }
  return lines.join("\n");
}

function renderMarkdown(report) {
  const lines = [
    "# Milan SharePoint Data Inventory",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `Source zip: \`${report.zip}\``,
    "",
    "## Totals",
    "",
    "| Metric | Count |",
    "|---|---:|",
    ...Object.entries(report.totals).map(([k, v]) => `| ${k} | ${v} |`),
    "",
    "## Top-level folders",
    "",
    "| Folder | Files |",
    "|---|---:|",
    ...report.folderSummary.map(({ folder, count }) => `| ${folder} | ${count} |`),
    "",
    "## Geocoding assets",
    "",
    "| Asset | Geometry | Features | CRS |",
    "|---|---|---:|---|",
    ...report.shapefileDetails.map(
      (s) =>
        `| ${s.path} | ${s.geometryTypes?.join(", ") || "n/a"} | ${s.featureCount ?? "n/a"} | ${s.crs || "EPSG:3003"} |`
    ),
    "",
    "## KPI × Pilot matrix",
    "",
    "| KPI | Pilot | Files | Phases | Geocoding | Website readiness |",
    "|---|---|---:|---|---|---|",
    ...report.kpiPilotMatrix.map(
      (r) =>
        `| ${r.kpi} | ${r.pilotId} | ${r.fileCount} | ${r.phases.join(", ")} | ${r.geocoding} | ${r.websiteReadiness} |`
    ),
    "",
    "## Excel workbooks (sheet names)",
    "",
  ];

  for (const x of report.xlsxDetails.slice(0, 40)) {
    lines.push(`### ${x.path}`);
    lines.push("");
    for (const name of x.sheetNames || []) {
      const sheet = x.sheets?.[name];
      lines.push(`- **${name}** — ${sheet?.rowCount ?? "?"} rows`);
    }
    lines.push("");
  }

  if (report.xlsxDetails.length > 40) {
    lines.push(`_…and ${report.xlsxDetails.length - 40} more workbooks (see JSON)._`);
    lines.push("");
  }

  lines.push("## All xlsx paths");
  lines.push("");
  for (const p of report.allXlsxPaths) lines.push(`- ${p}`);

  lines.push("");
  lines.push(renderBundledJsonSummary());

  return `${lines.join("\n")}\n`;
}

async function main() {
  if (!fs.existsSync(ZIP)) {
    console.error(`ZIP not found: ${ZIP}`);
    process.exit(1);
  }

  const members = listZipMembers();
  const catalog = buildFileCatalog(members);
  const xlsxMembers = members.filter((m) => /\.xlsx?$/i.test(m));
  const shpMembers = members.filter((m) => /\.shp$/i.test(m));

  const xlsxDetails = [];
  for (const member of xlsxMembers) {
    try {
      const local = extractMember(member);
      xlsxDetails.push({
        path: member.replace(/^Milano\//, ""),
        pilotId: inferPilot(member),
        phase: inferPhase(member),
        linkedKpi: inferKpi(member),
        ...inspectXlsx(local),
      });
    } catch (err) {
      xlsxDetails.push({
        path: member.replace(/^Milano\//, ""),
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const shapefileDetails = [];
  for (const member of shpMembers) {
    try {
      const local = extractMember(member);
      const detail = await inspectShapefile(local);
      shapefileDetails.push({
        path: member.replace(/^Milano\//, ""),
        pilotId: inferPilot(member),
        phase: inferPhase(member),
        linkedKpi: inferKpi(member),
        ...detail,
      });
    } catch (err) {
      shapefileDetails.push({
        path: member.replace(/^Milano\//, ""),
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const kpiPilotMatrix = buildKpiPilotMatrix(catalog, shapefileDetails, xlsxDetails);

  const report = {
    generatedAt: new Date().toISOString(),
    zip: "Milano-20260709T084301Z-2-001.zip",
    totals: {
      allFiles: members.length,
      xlsx: xlsxMembers.length,
      shapefiles: shpMembers.length,
      pdfs: members.filter((m) => /\.pdf$/i.test(m)).length,
      docx: members.filter((m) => /\.docx?$/i.test(m)).length,
    },
    folderSummary: folderSummary(members).map(([folder, count]) => ({ folder, count })),
    fileCatalog: catalog,
    shapefileDetails,
    xlsxDetails,
    kpiPilotMatrix,
    allXlsxPaths: xlsxMembers.map((m) => m.replace(/^Milano\//, "")),
  };

  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.writeFileSync(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(OUT_MD, renderMarkdown(report), "utf8");
  console.log(`Wrote ${OUT_JSON}`);
  console.log(`Wrote ${OUT_MD}`);
  console.log(
    `Files: ${report.totals.allFiles} | xlsx: ${report.totals.xlsx} | shp: ${report.totals.shapefiles} | matrix rows: ${kpiPilotMatrix.length}`
  );

  try {
    fs.rmSync(TMP, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
