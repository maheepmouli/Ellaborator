#!/usr/bin/env node
/**
 * Extract Milan SharePoint assets and build committed JSON bundles:
 * - public/data/milan/mode-share-counts.json (KPI 1.2 AMAT counts)
 * - public/data/milan/pilot-corridors.geojson (intervention corridors)
 */
import fs from "node:fs/promises";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as shapefile from "shapefile";
import XLSX from "xlsx";
import proj4 from "proj4";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DROP_DIR = path.join(ROOT, "public", "Sharepoint_Datasets_06_2026");
const MIL_ZIP_CANDIDATES = [
  path.join(ROOT, "data-ingest", "milan", "Milano-20260709T084301Z-2-001.zip"),
  path.join(DROP_DIR, "Milano-20260709T084301Z-2-001.zip"),
];
const OUT_SHAREPOINT = path.join(ROOT, "public", "sharepoint-data", "Milan");
const MODE_SHARE_OUT = path.join(ROOT, "public", "data", "milan", "mode-share-counts.json");
const CORRIDORS_OUT = path.join(ROOT, "public", "data", "milan", "pilot-corridors.geojson");
const WALK_GRAPH_OUT = path.join(ROOT, "public", "data", "milan", "walk-graph.geojson");
const SURVEY_OUT = path.join(ROOT, "public", "data", "milan", "survey-insights.json");
const ACCESSIBILITY_OUT = path.join(ROOT, "public", "data", "milan", "accessibility-points.json");

const ACCESSIBILITY_LAYERS = [
  {
    pilotId: "mil-p1",
    phase: "baseline",
    relative: "Eval data Ex ante/8. Data - accessibility features/Pilot 1_AMAT/baseline/routing_all_torta_150_geom",
  },
  {
    pilotId: "mil-p1",
    phase: "evaluation",
    relative: "Eval data Ex ante/8. Data - accessibility features/Pilot 1_AMAT/evaluation/routing_all_elaborator_torta_150_geom",
  },
  {
    pilotId: "mil-p2",
    phase: "baseline",
    relative: "Eval data Ex ante/8. Data - accessibility features/Pilot 2_AMAT/baseline/routing_OVEST_torta_150_geom",
  },
];

const ACCESSIBILITY_MAP_MAX_PER_PILOT = 320;

proj4.defs(
  "EPSG:3003",
  "+proj=tmerc +lat_0=0 +lon_0=9 +k=0.9996 +x_0=1500000 +y_0=0 +ellps=intl +towgs84=-104.1,-49.1,-9.9,0.416,0.41,0.35,-5.71 +units=m +no_defs"
);
proj4.defs("EPSG:25832", "+proj=utm +zone=32 +ellps=GRS80 +units=m +no_defs");

const MILAN_MEMBER_PREFIXES = [
  "Milano/Eval data Ex ante/2. Plans to expand/",
  "Milano/Eval data Ex ante/3. Road user counts/",
  "Milano/Eval data Ex ante/4. Speed measurements/",
  "Milano/Eval data Ex ante/6. CO2 and noise emissions/",
  "Milano/Eval data Ex ante/7. Survey results",
  "Milano/Eval data Ex ante/8. Data - accessibility features/",
  "Milano/Eval data Ex ante/9. Intervention",
  "Milano/Eval data Ex ante/10. Intervention",
  "Milano/Evaluation Data Ex Post/",
  "Milano/1. Shape file/",
  "Milano/DSS pedestrian tool graph/",
];

function listZipMembers(zipPath) {
  const output = execSync(`tar -tf "${zipPath}"`, { encoding: "utf8", maxBuffer: 80 * 1024 * 1024 });
  return output.split(/\r?\n/).filter(Boolean);
}

function resolveMilZip() {
  for (const candidate of MIL_ZIP_CANDIDATES) {
    try {
      statSync(candidate);
      return candidate;
    } catch {
      // try next
    }
  }
  return null;
}

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

async function readGeoJsonIfExists(filePath) {
  const parsed = await readJsonIfExists(filePath);
  if (parsed?.type === "FeatureCollection" && Array.isArray(parsed.features)) return parsed;
  return null;
}

function shouldExtractMember(member) {
  if (!member.startsWith("Milano/") || member.endsWith("/")) return false;
  return MILAN_MEMBER_PREFIXES.some((prefix) => member.startsWith(prefix) || member === prefix);
}

async function extractMilanFromZip() {
  const MIL_ZIP = resolveMilZip();
  if (!MIL_ZIP) {
    console.warn("WARN  Milano zip missing — skipping SharePoint extract");
    return { extracted: 0, skipped: true };
  }

  const members = listZipMembers(MIL_ZIP).filter(shouldExtractMember);
  const tempDir = path.join(OUT_SHAREPOINT, ".extract-tmp");
  await fs.mkdir(tempDir, { recursive: true });

  let extracted = 0;
  for (const member of members) {
    const quoted = member.includes(" ") ? `"${member}"` : member;
    try {
      execSync(`tar -xf "${MIL_ZIP}" -C "${tempDir}" ${quoted}`, { stdio: "pipe", maxBuffer: 80 * 1024 * 1024 });
      const src = path.join(tempDir, member);
      const dest = path.join(OUT_SHAREPOINT, member.replace(/^Milano\//, ""));
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.copyFile(src, dest);
      extracted += 1;
    } catch (err) {
      console.warn(`WARN  failed ${member}:`, err instanceof Error ? err.message : err);
    }
  }
  await fs.rm(tempDir, { recursive: true, force: true });
  console.log(`OK  milan-sharepoint-extract (${extracted} files)`);
  return { extracted, skipped: false };
}

function normalizeKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function toNumber(value) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function utmToWgs84(x, y) {
  const [lng, lat] = proj4("EPSG:3003", "WGS84", [x, y]);
  return { lat, lng };
}

async function readShapefileFeatures(shpPath, dbfPath) {
  const source = await shapefile.open(shpPath, dbfPath);
  const features = [];
  while (true) {
    const result = await source.read();
    if (result.done) break;
    features.push(result.value);
  }
  return features;
}

async function loadCameraIndex() {
  const candidates = [
    path.join(OUT_SHAREPOINT, "Eval data Ex ante/3. Road user counts/evaluation_cameras.shp"),
    path.join(OUT_SHAREPOINT, "3. Road user counts/evaluation_cameras.shp"),
  ];
  for (const shpPath of candidates) {
    const dbfPath = shpPath.replace(/\.shp$/i, ".dbf");
    try {
      await fs.access(shpPath);
      const features = await readShapefileFeatures(shpPath, dbfPath);
      const index = new Map();
      for (const feature of features) {
        const props = feature.properties || {};
        const localita = String(props.localita || "");
        const ambito = String(props.Ambito || props.ambito || "");
        const pilotId = ambito.toLowerCase().includes("pilot 1") ? "mil-p1" : "mil-p2";
        const coords = feature.geometry?.coordinates;
        if (!coords || coords.length < 2) continue;
        const { lat, lng } = utmToWgs84(coords[0], coords[1]);
        const keys = [normalizeKey(localita), normalizeKey(localita.split(" - ").join("_"))];
        for (const key of keys) {
          if (key) index.set(key, { lat, lng, localita, pilotId, cameraId: props.id });
        }
      }
      return index;
    } catch {
      // try next candidate
    }
  }
  return new Map();
}

function parsePeakCountsFromWorkbook(filePath) {
  const workbook = XLSX.readFile(filePath);
  const summarySheet =
    workbook.SheetNames.find((name) => /summary/i.test(name) && !/contents/i.test(name)) ||
    workbook.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[summarySheet], {
    header: 1,
    defval: "",
    raw: false,
  });
  const studyName = String(rows[0]?.[1] || path.basename(filePath, path.extname(filePath))).trim();
  const parsed = parseApproachFlowsFromRows(rows);
  return {
    studyName,
    peakWindow: parsed.peakWindow,
    flows: parsed.flows,
    bikeTotal: parsed.siteTotals.bike,
    bikesOnRoad: parsed.siteTotals.bikesOnRoad,
    bikesOnCrosswalk: parsed.siteTotals.bikesOnCrosswalk,
    pedestrians: parsed.siteTotals.pedestrian,
    motorTotal: parsed.siteTotals.motorised,
    ptwTotal: parsed.siteTotals.ptw,
    ptTotal: parsed.siteTotals.pt,
    bikeShare: parsed.siteTotals.total > 0 ? (parsed.siteTotals.bike / parsed.siteTotals.total) * 100 : 0,
    allModes: parsed.siteTotals.total,
  };
}

const MILAN_APPROACH_SPECS = [
  { flowId: "sb", flowLabel: "Southbound", cols: [2, 3, 4, 5], abbrev: "SB" },
  { flowId: "nb", flowLabel: "Northbound", cols: [6, 7, 8, 9], abbrev: "NB" },
  { flowId: "eb", flowLabel: "Eastbound", cols: [10, 11, 12, 13], abbrev: "EB" },
];

function sumApproachCols(row, cols) {
  return cols.reduce((sum, idx) => sum + toNumber(row[idx]), 0);
}

function classifyAmatVehicle(label) {
  const l = String(label || "").toLowerCase().trim();
  if (!l || l === "%" || l === "total" || l === "phf") return null;
  if (l.includes("motorcycle")) return "ptw";
  if (l.includes("bus")) return "pt";
  if (l.includes("bicycle") && l.includes("road")) return "bikeRoad";
  if (l.includes("car") || l.includes("goods") || l.includes("truck")) return "motorised";
  return null;
}

function emptyFlowTotals() {
  return { bike: 0, bikesOnRoad: 0, bikesOnCrosswalk: 0, pedestrian: 0, motorised: 0, ptw: 0, pt: 0, total: 0 };
}

function finalizeFlowTotals(t) {
  const bike = t.bikesOnRoad + t.bikesOnCrosswalk;
  const total = bike + t.pedestrian + t.motorised + t.ptw + t.pt;
  return { ...t, bike, total: Math.max(total, 1) };
}

function parseApproachFlowsFromRows(rows) {
  const flowMap = new Map(MILAN_APPROACH_SPECS.map((spec) => [spec.flowId, emptyFlowTotals()]));
  const siteTotals = emptyFlowTotals();
  let peakWindow = "8:30-9:30";
  let inPeak1 = false;
  let afterPeakHour = false;
  let capturedPeak1Motorcycles = false;

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i] || [];
    const rowText = row.slice(0, 20).map((c) => String(c || "")).join(" ");
    const label = String(row[1] || row[0] || "").trim();

    if (/Peak\s*1/i.test(rowText)) {
      inPeak1 = true;
      afterPeakHour = false;
      capturedPeak1Motorcycles = false;
      continue;
    }
    if (/Peak\s*2/i.test(rowText)) {
      inPeak1 = false;
      afterPeakHour = false;
      continue;
    }
    if (!inPeak1) continue;

    if (/(\d{1,2}:\d{2}\s*AM\s*-\s*\d{1,2}:\d{2}\s*AM)/i.test(rowText)) {
      afterPeakHour = true;
      const windowMatch = rowText.match(
        /(\d{1,2}:\d{2}\s*AM)\s*-\s*(\d{1,2}:\d{2}\s*AM)/i
      );
      if (windowMatch) {
        peakWindow = `${windowMatch[1]}-${windowMatch[2]}`.replace(/\s/g, "");
      }
    }
    if (/(\d{1,2}:\d{2}\s*(?:AM|PM)\s*-\s*\d{1,2}:\d{2}\s*(?:AM|PM))/i.test(rowText)) {
      afterPeakHour = true;
      const windowMatch = rowText.match(
        /(\d{1,2}:\d{2}\s*(?:AM|PM))\s*-\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i
      );
      if (windowMatch) {
        peakWindow = `${windowMatch[1]}-${windowMatch[2]}`.replace(/\s/g, "");
      }
    }
    if (inPeak1 && !afterPeakHour && /^Cars$/i.test(label)) {
      afterPeakHour = true;
    }

    for (const spec of MILAN_APPROACH_SPECS) {
      const abbrev = String(row[15] || "").trim().toUpperCase();
      const abbrevAliases = spec.flowId === "nb" ? ["NB", "WB"] : [spec.abbrev];
      if (abbrevAliases.includes(abbrev)) {
        const flow = flowMap.get(spec.flowId);
        flow.bikesOnCrosswalk += toNumber(row[16]);
        flow.pedestrian += toNumber(row[17]);
      }
    }

    const vehicleKind = classifyAmatVehicle(label);
    if (!vehicleKind) continue;

    const useRow =
      afterPeakHour || (vehicleKind === "ptw" && !capturedPeak1Motorcycles && label === "Motorcycles");
    if (!useRow) continue;
    if (vehicleKind === "ptw") capturedPeak1Motorcycles = true;

    for (const spec of MILAN_APPROACH_SPECS) {
      const count = sumApproachCols(row, spec.cols);
      if (count <= 0) continue;
      const flow = flowMap.get(spec.flowId);
      if (vehicleKind === "bikeRoad") flow.bikesOnRoad += count;
      else if (vehicleKind === "motorised") flow.motorised += count;
      else if (vehicleKind === "ptw") flow.ptw += count;
      else if (vehicleKind === "pt") flow.pt += count;
    }
  }

  const flows = MILAN_APPROACH_SPECS.map((spec) => {
    const raw = flowMap.get(spec.flowId);
    const totals = finalizeFlowTotals(raw);
    siteTotals.bikesOnRoad += totals.bikesOnRoad;
    siteTotals.bikesOnCrosswalk += totals.bikesOnCrosswalk;
    siteTotals.pedestrian += totals.pedestrian;
    siteTotals.motorised += totals.motorised;
    siteTotals.ptw += totals.ptw;
    siteTotals.pt += totals.pt;
    return {
      flowId: spec.flowId,
      flowLabel: spec.flowLabel,
      bike: totals.bike,
      bikesOnRoad: totals.bikesOnRoad,
      bikesOnCrosswalk: totals.bikesOnCrosswalk,
      pedestrians: totals.pedestrian,
      motorised: totals.motorised,
      ptw: totals.ptw,
      pt: totals.pt,
      total: totals.total,
    };
  }).filter((flow) => flow.total > 1);

  const siteFinal = finalizeFlowTotals(siteTotals);
  if (!flows.length && siteFinal.total > 1) {
    flows.push({
      flowId: "site",
      flowLabel: "Site total",
      bike: siteFinal.bike,
      bikesOnRoad: siteFinal.bikesOnRoad,
      bikesOnCrosswalk: siteFinal.bikesOnCrosswalk,
      pedestrians: siteFinal.pedestrian,
      motorised: siteFinal.motorised,
      ptw: siteFinal.ptw,
      pt: siteFinal.pt,
      total: siteFinal.total,
    });
  }

  return { peakWindow, flows, siteTotals: siteFinal };
}

function walkXlsxFiles(dir) {
  const results = [];
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (/\.xlsx?$/i.test(entry.name)) results.push(full);
    }
  }
  return results;
}

function normalizePathSlashes(filePath) {
  return String(filePath || "").toLowerCase().replace(/\\/g, "/");
}

function inferPilotFromPath(filePath) {
  const lower = normalizePathSlashes(filePath);
  if (lower.includes("pilot 1") || lower.includes("olimpic")) return "mil-p1";
  if (lower.includes("pilot 2") || lower.includes("west axis")) return "mil-p2";
  return null;
}

function inferPhaseFromPath(filePath) {
  const lower = normalizePathSlashes(filePath);
  if (lower.includes("/evaluation/")) return "evaluation";
  if (lower.includes("/baseline/")) return "baseline";
  return "unknown";
}

function siteKeyFromPath(filePath) {
  const base = path.basename(filePath).replace(/\.xlsx?$/i, "");
  const stem = base.split("_").slice(0, -2).join("_") || base.split("_")[0];
  return normalizeKey(stem);
}

async function buildModeShareCounts(cameraIndex) {
  const countRoots = [
    path.join(OUT_SHAREPOINT, "Eval data Ex ante/3. Road user counts"),
    path.join(OUT_SHAREPOINT, "3. Road user counts"),
  ];
  const files = [];
  for (const root of countRoots) {
    try {
      await fs.access(root);
      files.push(...walkXlsxFiles(root));
    } catch {
      // missing
    }
  }
  if (!files.length) {
    console.warn("WARN  no Milan count workbooks — keeping existing mode-share JSON if any");
    return null;
  }

  const bySitePhase = new Map();
  for (const file of files) {
    const pilotId = inferPilotFromPath(file);
    const phase = inferPhaseFromPath(file);
    if (!pilotId || phase === "unknown") continue;
    const siteKey = siteKeyFromPath(file);
    const parsed = parsePeakCountsFromWorkbook(file);
    const camera =
      cameraIndex.get(siteKey) ||
      cameraIndex.get(normalizeKey(parsed.studyName)) ||
      [...cameraIndex.entries()].find(([k]) => siteKey.includes(k) || k.includes(siteKey))?.[1];

    const record = {
      id: `mil-count-${siteKey}-${phase}`,
      siteKey,
      studyName: parsed.studyName,
      pilotId,
      phase,
      lat: camera?.lat ?? null,
      lng: camera?.lng ?? null,
      cameraLocalita: camera?.localita ?? null,
      peakWindow: parsed.peakWindow,
      bikeTotal: parsed.bikeTotal,
      bikesOnRoad: parsed.bikesOnRoad,
      bikesOnCrosswalk: parsed.bikesOnCrosswalk,
      pedestrians: parsed.pedestrians,
      motorTotal: parsed.motorTotal,
      ptwTotal: parsed.ptwTotal ?? 0,
      ptTotal: parsed.ptTotal ?? 0,
      allModes: parsed.allModes,
      bikeSharePct: Number(parsed.bikeShare.toFixed(2)),
      flows: parsed.flows,
      sourceFile: path.relative(ROOT, file).replace(/\\/g, "/"),
      locationMethod: camera ? "camera_shapefile" : "pilot_inference",
      spatialQuality: camera ? "matched" : "inferred",
    };
    const dedupeKey = `${siteKey}:${phase}`;
    const existing = bySitePhase.get(dedupeKey);
    if (!existing || file.length > existing.sourceFile.length) {
      bySitePhase.set(dedupeKey, record);
    }
  }

  const sites = [...bySitePhase.values()].filter((r) => r.bikeTotal > 0 || r.motorTotal > 0);
  const flowCount = sites.reduce((sum, site) => sum + (site.flows?.length ?? 0), 0);
  const payload = {
    generatedAt: new Date().toISOString(),
    source:
      "Milano SharePoint — AMAT road user count workbooks (Peak 1 hour peak 8:30–9:30, per-approach flows)",
    siteCount: sites.length,
    flowCount,
    sites,
  };
  await fs.mkdir(path.dirname(MODE_SHARE_OUT), { recursive: true });
  await fs.writeFile(MODE_SHARE_OUT, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`OK  milan-mode-share-counts (${sites.length} site-phase rows, ${flowCount} approach flows)`);
  return payload;
}

async function buildPilotCorridors() {
  const pilots = [
    { pilotId: "mil-p1", shp: path.join(OUT_SHAREPOINT, "1. Shape file/Pilot 1_AMAT/pilot01.shp") },
    { pilotId: "mil-p2", shp: path.join(OUT_SHAREPOINT, "1. Shape file/Pilot 2_AMAT/pilot02.shp") },
  ];
  const features = [];
  for (const pilot of pilots) {
    const dbf = pilot.shp.replace(/\.shp$/i, ".dbf");
    try {
      await fs.access(pilot.shp);
      const rows = await readShapefileFeatures(pilot.shp, dbf);
      for (const feature of rows) {
        const geom = feature.geometry;
        if (!geom?.coordinates?.length) continue;
        const coords =
          geom.type === "LineString"
            ? geom.coordinates.map(([x, y]) => {
                const { lat, lng } = utmToWgs84(x, y);
                return [lng, lat];
              })
            : [];
        if (coords.length < 2) continue;
        features.push({
          type: "Feature",
          properties: {
            pilotId: pilot.pilotId,
            label: String(feature.properties?.itinerario || feature.properties?.cod_itine || pilot.pilotId),
            source: "AMAT pilot corridor shapefile",
          },
          geometry: { type: "LineString", coordinates: coords },
        });
      }
    } catch {
      // shapefile missing
    }
  }
  const geojson = { type: "FeatureCollection", features };
  if (!features.length) {
    const existing = await readGeoJsonIfExists(CORRIDORS_OUT);
    if (existing?.features?.length) {
      console.log(
        `WARN  no Milan corridor shapefiles — keeping existing pilot-corridors.geojson (${existing.features.length} features).`
      );
      return existing;
    }
  }
  await fs.mkdir(path.dirname(CORRIDORS_OUT), { recursive: true });
  await fs.writeFile(CORRIDORS_OUT, `${JSON.stringify(geojson, null, 2)}\n`, "utf8");
  console.log(`OK  milan-pilot-corridors (${features.length} LineString features)`);
  return geojson;
}

async function buildWalkGraphGeojson() {
  const shpCandidates = [
    path.join(OUT_SHAREPOINT, "DSS pedestrian tool graph/walk_graph.shp"),
    path.join(OUT_SHAREPOINT, "Eval data Ex ante/DSS pedestrian tool graph/walk_graph.shp"),
  ];
  const MILAN_P3_CENTER = { lat: 45.468, lng: 9.215 };
  const CLIP_DEG = 0.06;
  const MAX_FEATURES = 2500;
  const features = [];
  for (const shpPath of shpCandidates) {
    const dbf = shpPath.replace(/\.shp$/i, ".dbf");
    try {
      await fs.access(shpPath);
      const rows = await readShapefileFeatures(shpPath, dbf);
      for (const feature of rows) {
        const geom = feature.geometry;
        if (!geom?.coordinates?.length) continue;
        const toWgs = ([x, y]) => {
          const [lng, lat] = proj4("EPSG:25832", "WGS84", [x, y]);
          return [lng, lat];
        };
        const coords =
          geom.type === "LineString"
            ? geom.coordinates.map(([x, y]) => toWgs([x, y]))
            : geom.type === "MultiLineString"
              ? geom.coordinates[0]?.map(([x, y]) => toWgs([x, y])) ?? []
              : [];
        if (coords.length < 2) continue;
        const mid = coords[Math.floor(coords.length / 2)];
        const midLat = mid[1];
        const midLng = mid[0];
        if (
          Math.abs(midLat - MILAN_P3_CENTER.lat) > CLIP_DEG ||
          Math.abs(midLng - MILAN_P3_CENTER.lng) > CLIP_DEG
        ) {
          continue;
        }
        features.push({
          type: "Feature",
          properties: {
            pilotId: "mil-p3",
            label: String(feature.properties?.name || feature.properties?.id || "DSS walk link"),
            source: "DSS pedestrian walk_graph shapefile (pilot-3 clip)",
          },
          geometry: { type: "LineString", coordinates: coords },
        });
        if (features.length >= MAX_FEATURES) break;
      }
      if (features.length) break;
    } catch {
      // try next path
    }
  }
  const geojson = { type: "FeatureCollection", features };
  if (!features.length) {
    const existing = await readGeoJsonIfExists(WALK_GRAPH_OUT);
    if (existing?.features?.length) {
      console.log(
        `WARN  no Milan walk_graph shapefile — keeping existing walk-graph.geojson (${existing.features.length} features).`
      );
      return existing;
    }
  }
  await fs.mkdir(path.dirname(WALK_GRAPH_OUT), { recursive: true });
  await fs.writeFile(WALK_GRAPH_OUT, `${JSON.stringify(geojson, null, 2)}\n`, "utf8");
  console.log(`OK  milan-walk-graph (${features.length} LineString features)`);
  return geojson;
}

function parseSatisfactionFromWorkbook(filePath) {
  const workbook = XLSX.readFile(filePath);
  const rows = [];
  for (const sheetName of workbook.SheetNames) {
    const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      header: 1,
      defval: "",
      raw: false,
    });
    for (const row of matrix) {
      const label = String(row[0] || row[1] || "").trim();
      const lower = label.toLowerCase();
      if (!lower) continue;
      if (
        lower.includes("satisf") ||
        lower.includes("rather satisfied") ||
        lower.includes("user satisfaction")
      ) {
        const pct = toNumber(row[1]) || toNumber(row[2]) || toNumber(row[3]);
        if (pct > 0 && pct <= 100) {
          rows.push({ label, satisfactionPct: pct, sheet: sheetName });
        }
      }
    }
  }
  return rows;
}

async function buildSurveyInsights() {
  const surveyRoots = [
    path.join(OUT_SHAREPOINT, "Eval data Ex ante/7. Survey results - Satisfaction LL"),
    path.join(OUT_SHAREPOINT, "7. Survey results - Satisfaction LL"),
  ];
  const files = [];
  for (const root of surveyRoots) {
    try {
      await fs.access(root);
      files.push(...walkXlsxFiles(root));
    } catch {
      // missing
    }
  }

  const pilots = [];
  let aggregateSatisfaction = null;
  for (const file of files) {
    const pilotId = inferPilotFromPath(file);
    const parsed = parseSatisfactionFromWorkbook(file);
    const satisfied = parsed.find((r) => r.satisfactionPct >= 50);
    if (satisfied) {
      pilots.push({
        pilotId: pilotId || "city-wide",
        satisfactionPct: satisfied.satisfactionPct,
        label: satisfied.label,
        sourceFile: path.relative(ROOT, file).replace(/\\/g, "/"),
        responseBasis: "workbook aggregate",
      });
      if (!aggregateSatisfaction) aggregateSatisfaction = satisfied.satisfactionPct;
    }
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    source: "Milano SharePoint — folder 7 Survey results (Satisfaction LL)",
    workbookCount: files.length,
    pilots,
    aggregateSatisfactionPct: aggregateSatisfaction,
    status: files.length ? (pilots.length ? "parsed" : "empty_workbooks") : "folder_empty",
    note:
      files.length === 0
        ? "Survey folder present in zip but contains no xlsx files yet — KPI 4.1 uses observatory fallback until partner upload."
        : pilots.length === 0
          ? "Survey workbooks found but no satisfaction percentage rows detected."
          : undefined,
  };
  if (!files.length) {
    const existing = await readJsonIfExists(SURVEY_OUT);
    if (existing && (existing.pilots?.length || existing.workbookCount > 0)) {
      console.log("WARN  no Milan survey workbooks — keeping existing survey-insights.json.");
      return existing;
    }
  }
  await fs.mkdir(path.dirname(SURVEY_OUT), { recursive: true });
  await fs.writeFile(SURVEY_OUT, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(
    `OK  milan-survey-insights (${files.length} workbooks, ${pilots.length} pilot aggregates)`
  );
  return payload;
}

function classifyAccessibility(props) {
  const equal = toNumber(props.perc_1);
  const slight = toNumber(props.perc_1_2);
  const heavy = toNumber(props.perc_2plus);
  const unreachable = toNumber(props.perc_null);
  // Unreachable routes (perc_null) are treated as the worst accessibility class.
  if (unreachable >= 50 || unreachable > equal + slight + heavy) return "Heavily penalised";
  if (heavy >= equal && heavy >= slight && heavy > 0) return "Heavily penalised";
  if (slight > equal) return "Slightly penalised";
  return "Equal access";
}

function pointCentroid(geometry) {
  if (!geometry) return null;
  if (geometry.type === "Point" && Array.isArray(geometry.coordinates)) {
    return { x: geometry.coordinates[0], y: geometry.coordinates[1] };
  }
  if (geometry.type === "MultiPoint" && Array.isArray(geometry.coordinates?.[0])) {
    return { x: geometry.coordinates[0][0], y: geometry.coordinates[0][1] };
  }
  return null;
}

async function resolveAccessibilityStem(relativeStem) {
  const candidates = [
    path.join(OUT_SHAREPOINT, relativeStem),
    path.join(ROOT, ".tmp-milan-a11y", "Milano", relativeStem),
  ];
  for (const stem of candidates) {
    try {
      await fs.access(`${stem}.shp`);
      await fs.access(`${stem}.dbf`);
      return stem;
    } catch {
      // try next
    }
  }
  return null;
}

async function loadAccessibilityLayerFeatures(layer) {
  const stem = await resolveAccessibilityStem(layer.relative);
  if (!stem) return [];
  const features = await readShapefileFeatures(`${stem}.shp`, `${stem}.dbf`);
  return features
    .map((feature) => {
      const xy = pointCentroid(feature.geometry);
      if (!xy) return null;
      const { lat, lng } = utmToWgs84(xy.x, xy.y);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      const props = feature.properties || {};
      return {
        orig: String(props.orig ?? ""),
        lat,
        lng,
        nTot: toNumber(props.n_tot),
        percEqual: toNumber(props.perc_1),
        percSlight: toNumber(props.perc_1_2),
        percHeavy: toNumber(props.perc_2plus),
        percNull: toNumber(props.perc_null),
        category: classifyAccessibility(props),
      };
    })
    .filter(Boolean);
}

function downsampleAccessibilityPoints(points, maxPoints) {
  if (points.length <= maxPoints) return points;
  const byCategory = {
    "Heavily penalised": [],
    "Slightly penalised": [],
    "Equal access": [],
  };
  points.forEach((point) => {
    const key = byCategory[point.category] ? point.category : "Equal access";
    byCategory[key].push(point);
  });
  Object.values(byCategory).forEach((list) =>
    list.sort((a, b) => a.interventionValue - b.interventionValue)
  );

  const quotas = {
    "Heavily penalised": Math.round(maxPoints * 0.45),
    "Slightly penalised": Math.round(maxPoints * 0.25),
    "Equal access": Math.round(maxPoints * 0.3),
  };
  const picked = [];
  const grid = new Map();
  const pushUnique = (point) => {
    const key = `${point.lat.toFixed(4)},${point.lng.toFixed(4)}`;
    if (grid.has(key)) return false;
    grid.set(key, true);
    picked.push(point);
    return true;
  };

  for (const [category, quota] of Object.entries(quotas)) {
    const list = byCategory[category] || [];
    let taken = 0;
    for (const point of list) {
      if (taken >= quota || picked.length >= maxPoints) break;
      if (pushUnique(point)) taken += 1;
    }
  }
  if (picked.length < maxPoints) {
    const rest = points
      .filter((p) => !picked.includes(p))
      .sort((a, b) => a.interventionValue - b.interventionValue);
    for (const point of rest) {
      if (picked.length >= maxPoints) break;
      pushUnique(point);
    }
  }
  return picked;
}

function parseCirceCategorySummary(workbookPath) {
  try {
    const workbook = XLSX.readFile(workbookPath);
    const sheet = workbook.Sheets["4. KPI 4.2 (WP7 format)"];
    if (!sheet) return [];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true });
    const summary = [];
    let currentPilot = null;
    const toPct = (value) => {
      const n = toNumber(value);
      if (!Number.isFinite(n)) return null;
      return n <= 1 ? n * 100 : n;
    };
    for (const row of rows) {
      const intervention = String(row[0] || "");
      if (/cdm1|pilot 1|olympic/i.test(intervention)) currentPilot = "mil-p1";
      if (/cdm2|pilot 2|west/i.test(intervention)) currentPilot = "mil-p2";
      const category = String(row[1] || "").trim();
      if (!currentPilot || !category || /accessibility category/i.test(category)) continue;
      const postRaw = row[5];
      const hasPost = postRaw !== "" && !/not available|n\/a/i.test(String(postRaw || ""));
      summary.push({
        pilotId: currentPilot,
        category,
        baselinePct: toPct(row[3]),
        postPct: hasPost ? toPct(postRaw) : null,
        baselineN: toNumber(row[2]),
        postN: hasPost ? toNumber(row[4]) : null,
      });
    }
    return summary;
  } catch {
    return [];
  }
}

async function buildAccessibilityPoints() {
  const byPilotPhase = new Map();
  for (const layer of ACCESSIBILITY_LAYERS) {
    const features = await loadAccessibilityLayerFeatures(layer);
    byPilotPhase.set(`${layer.pilotId}:${layer.phase}`, features);
    console.log(`  a11y layer ${layer.pilotId}/${layer.phase}: ${features.length} points`);
  }

  const circeCandidates = [
    path.join(
      OUT_SHAREPOINT,
      "Eval data Ex ante/8. Data - accessibility features/Milan_Accessibility_Features_DSS_Analysis_CIRCE.xlsx"
    ),
    path.join(
      ROOT,
      ".tmp-milan-a11y/Milano/Eval data Ex ante/8. Data - accessibility features/Milan_Accessibility_Features_DSS_Analysis_CIRCE.xlsx"
    ),
  ];
  let circePath = null;
  for (const candidate of circeCandidates) {
    try {
      await fs.access(candidate);
      circePath = candidate;
      break;
    } catch {
      // next
    }
  }
  const categorySummary = circePath ? parseCirceCategorySummary(circePath) : [];

  const points = [];
  for (const pilotId of ["mil-p1", "mil-p2"]) {
    const baseline = byPilotPhase.get(`${pilotId}:baseline`) || [];
    const evaluation = byPilotPhase.get(`${pilotId}:evaluation`) || [];
    const evalByOrig = new Map(evaluation.map((row) => [row.orig, row]));

    const joined = baseline.map((base) => {
      const post = evalByOrig.get(base.orig);
      const baselineValue = base.percEqual;
      const interventionValue = post ? post.percEqual : base.percEqual;
      const category = post ? post.category : base.category;
      return {
        id: `mil-a11y-${pilotId}-${base.orig || normalizeKey(`${base.lat},${base.lng}`)}`,
        orig: base.orig,
        pilotId,
        lat: base.lat,
        lng: base.lng,
        category,
        baselineCategory: base.category,
        evaluationCategory: post?.category ?? null,
        baselineValue,
        interventionValue,
        comparisonValue: interventionValue - baselineValue,
        nTot: post?.nTot ?? base.nTot,
        percEqualBaseline: base.percEqual,
        percSlightBaseline: base.percSlight,
        percHeavyBaseline: base.percHeavy,
        percEqualPost: post?.percEqual ?? null,
        percSlightPost: post?.percSlight ?? null,
        percHeavyPost: post?.percHeavy ?? null,
        temporalCoverage: post ? "before-after" : "baseline-only",
        spatialQuality: "matched",
        mapPriority: category === "Heavily penalised" ? 3 : category === "Slightly penalised" ? 2 : 1,
      };
    });

    const sampled = downsampleAccessibilityPoints(joined, ACCESSIBILITY_MAP_MAX_PER_PILOT);
    points.push(...sampled);
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    source:
      "Milano SharePoint — 8. Data - accessibility features (DSS routing torta 150 m + CIRCE workbook)",
    pointCount: points.length,
    rawPointCounts: {
      "mil-p1-baseline": (byPilotPhase.get("mil-p1:baseline") || []).length,
      "mil-p1-evaluation": (byPilotPhase.get("mil-p1:evaluation") || []).length,
      "mil-p2-baseline": (byPilotPhase.get("mil-p2:baseline") || []).length,
    },
    mapSampleMaxPerPilot: ACCESSIBILITY_MAP_MAX_PER_PILOT,
    categorySummary,
    points,
    note: "Map uses a stratified sample of civic-address DSS points (EPSG:3003 → WGS84). Score = % equal-access routes (perc_1).",
  };

  if (!points.length) {
    const existing = await readJsonIfExists(ACCESSIBILITY_OUT);
    if (existing?.points?.length) {
      console.log("WARN  no accessibility shapefiles — keeping existing accessibility-points.json.");
      return existing;
    }
  }

  await fs.mkdir(path.dirname(ACCESSIBILITY_OUT), { recursive: true });
  await fs.writeFile(ACCESSIBILITY_OUT, `${JSON.stringify(payload)}\n`, "utf8");
  console.log(
    `OK  milan-accessibility-points (${points.length} map points, ${categorySummary.length} CIRCE categories)`
  );
  return payload;
}

async function main() {
  if (process.env.MILAN_BUILD_ACCESSIBILITY_ONLY === "1") {
    await buildAccessibilityPoints();
    return;
  }
  await extractMilanFromZip();
  const cameraIndex = await loadCameraIndex();
  await buildModeShareCounts(cameraIndex);
  await buildPilotCorridors();
  await buildWalkGraphGeojson();
  await buildSurveyInsights();
  await buildAccessibilityPoints();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
