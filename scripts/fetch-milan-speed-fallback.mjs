#!/usr/bin/env node
/**
 * Build bundled Milan KPI 2.1 speed segments from AMAT network.shp + Maggio/Ottobre DBF.
 * Used when SharePoint shapefiles are not hosted on the deploy (gitignored).
 *
 * Sticky #05 / #17: full intervention road network with observed speeds — not OSM stubs.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as shapefile from "shapefile";
import proj4 from "proj4";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_FILE = path.join(ROOT, "public", "data", "milan", "speed-segments.json");
const MILAN_ROOT = path.join(ROOT, "public", "sharepoint-data", "Milan");

proj4.defs(
  "EPSG:3003",
  "+proj=tmerc +lat_0=0 +lon_0=9 +k=0.9996 +x_0=1500000 +y_0=0 +ellps=intl +towgs84=-104.1,-49.1,-9.9,0.416,0.41,0.35,-5.71 +units=m +no_defs"
);

const PILOTS = [
  {
    pilotId: "mil-p1",
    label: "Pilot 1 speed",
    dirs: [
      path.join(
        MILAN_ROOT,
        "Eval data Ex ante",
        "4. Speed measurements",
        "Pilot 1_Olimpic itineraries_AMAT",
        "jobs_7882016_results_Itinerari_Olimpici_Maggio2025.shapefile"
      ),
      path.join(
        MILAN_ROOT,
        "4. Speed measurements",
        "Pilot 1_Olimpic itineraries_AMAT",
        "jobs_7882016_results_Itinerari_Olimpici_Maggio2025.shapefile"
      ),
    ],
    metricDbf: "Maggio 2025_0_8_00-9_00_0.dbf",
  },
  {
    pilotId: "mil-p2",
    label: "Pilot 2 speed",
    dirs: [
      path.join(
        MILAN_ROOT,
        "Eval data Ex ante",
        "4. Speed measurements",
        "Pilot 2_west axis_AMAT",
        "jobs_7735361_results_Asse_Ovest.shapefile"
      ),
      path.join(
        MILAN_ROOT,
        "4. Speed measurements",
        "Pilot 2_west axis_AMAT",
        "jobs_7735361_results_Asse_Ovest.shapefile"
      ),
    ],
    metricDbf: "Ottobre_2024_0_8_00-9_00_0.dbf",
  },
];

function toNumber(value) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function normalize(values) {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 50);
  return values.map((v) => ((v - min) / (max - min)) * 100);
}

function isProjectedCoord(x, y) {
  return Math.abs(x) > 180 || Math.abs(y) > 90;
}

function reprojectLineToLeaflet(coords) {
  return coords.map(([x, y]) => {
    if (isProjectedCoord(x, y)) {
      const [lng, lat] = proj4("EPSG:3003", "WGS84", [x, y]);
      return [round6(lat), round6(lng)];
    }
    return [round6(y), round6(x)];
  });
}

function round6(n) {
  return Math.round(n * 1e6) / 1e6;
}

/** Keep endpoints + every Nth vertex to shrink the JSON without losing corridor shape. */
function simplifyLine(coords, stride = 2) {
  if (coords.length <= 3) return coords;
  const out = [coords[0]];
  for (let i = stride; i < coords.length - 1; i += stride) {
    out.push(coords[i]);
  }
  out.push(coords[coords.length - 1]);
  return out;
}

function metricFieldMap(row) {
  const keys = Object.keys(row);
  const idKey = keys.find((k) => /_Id$/i.test(k));
  const avgKey = keys.find((k) => /_AvgSp$/i.test(k));
  const p85Key = keys.find((k) => /_P85sp$/i.test(k));
  const hitsKey = keys.find((k) => /_Hits$/i.test(k));
  return { idKey, avgKey, p85Key, hitsKey };
}

async function resolvePilotDir(pilot) {
  for (const dir of pilot.dirs) {
    try {
      await fs.access(path.join(dir, "network.shp"));
      await fs.access(path.join(dir, "network.dbf"));
      await fs.access(path.join(dir, pilot.metricDbf));
      return dir;
    } catch {
      // try next
    }
  }
  return null;
}

async function readMetricRows(dbfPath) {
  const source = await shapefile.openDbf(dbfPath);
  const rows = [];
  let fields = null;
  while (true) {
    const result = await source.read();
    if (result.done) break;
    const row = result.value || {};
    if (!fields) fields = metricFieldMap(row);
    rows.push(row);
  }
  return { rows, fields };
}

async function buildPilotDataset(pilot) {
  const dir = await resolvePilotDir(pilot);
  if (!dir) {
    throw new Error(`Missing network.shp / metric DBF for ${pilot.pilotId}`);
  }

  const { rows: metricRows, fields } = await readMetricRows(path.join(dir, pilot.metricDbf));
  if (!fields?.idKey || !fields.avgKey || !fields.p85Key) {
    throw new Error(`Unexpected metric columns in ${pilot.metricDbf}`);
  }

  const speedById = new Map();
  metricRows.forEach((row) => {
    const id = Math.round(toNumber(row[fields.idKey]));
    if (id > 0) speedById.set(id, row);
  });

  const source = await shapefile.open(path.join(dir, "network.shp"), path.join(dir, "network.dbf"));
  const draft = [];
  let invalidGeometries = 0;
  let missingMetricJoins = 0;

  while (true) {
    const result = await source.read();
    if (result.done) break;
    const feature = result.value;
    const geom = feature?.geometry;
    if (!geom?.coordinates || geom.type !== "LineString") {
      invalidGeometries += 1;
      continue;
    }
    const props = feature.properties || {};
    const segmentId = Math.round(toNumber(props.Id));
    if (segmentId <= 0) continue;

    const leafletCoords = simplifyLine(reprojectLineToLeaflet(geom.coordinates));
    if (leafletCoords.length < 2) {
      invalidGeometries += 1;
      continue;
    }

    const metric = speedById.get(segmentId);
    if (!metric) {
      missingMetricJoins += 1;
      draft.push({
        id: `speed-08:00-09:00-${segmentId}`,
        coordinates: leafletCoords,
        value: 0,
        rawValue: null,
        properties: {
          sourceLabel: pilot.label,
          timeWindow: "08:00-09:00",
          metricType: "speed",
          segmentId,
          streetName: props.StreetName ?? props.NOME_VIA ?? null,
          speedLimit: toNumber(props.SpeedLimit),
          hasMetric: false,
        },
      });
      continue;
    }

    const avgSpeed = toNumber(metric[fields.avgKey]);
    const p85Speed = toNumber(metric[fields.p85Key]);
    const hits = toNumber(metric[fields.hitsKey]);
    const rawValue = Math.max(0, p85Speed * 0.7 + avgSpeed * 0.3);
    draft.push({
      id: `speed-08:00-09:00-${segmentId}`,
      coordinates: leafletCoords,
      value: rawValue,
      rawValue,
      properties: {
        sourceLabel: pilot.label,
        timeWindow: "08:00-09:00",
        metricType: "speed",
        segmentId,
        streetName: props.StreetName ?? props.NOME_VIA ?? null,
        speedLimit: toNumber(props.SpeedLimit),
        avgSpeed,
        p85Speed,
        hits,
        hasMetric: true,
        rawMetricValue: rawValue,
      },
    });
  }

  const measured = draft.filter((r) => r.rawValue != null);
  const normalized = normalize(measured.map((r) => r.rawValue));
  let measuredIndex = 0;
  const records = draft.map((record) => {
    const { rawValue: _raw, ...rest } = record;
    if (record.properties.hasMetric === false) return rest;
    const value = normalized[measuredIndex] ?? 50;
    measuredIndex += 1;
    return { ...rest, value };
  });

  const avgMetricValue =
    measured.length > 0
      ? measured.reduce((sum, r) => sum + r.rawValue, 0) / measured.length
      : 0;

  return {
    records,
    stats: {
      parsedSegments: records.length,
      invalidGeometries,
      missingMetricJoins,
      avgMetricValue,
      cameraJoinRatePct: 0,
      pilotScoped: true,
    },
    dataConfidence: "real",
    renderMode: "segment",
    statusMessage: `${pilot.label} — AMAT network.shp + ${pilot.metricDbf} (${measured.length} measured / ${records.length} links).`,
  };
}

async function main() {
  const output = {
    generatedAt: new Date().toISOString(),
    source: "AMAT network.shp + Maggio/Ottobre 08:00–09:00 speed DBF (SharePoint mirror)",
    pilots: {},
  };

  for (const pilot of PILOTS) {
    const dataset = await buildPilotDataset(pilot);
    output.pilots[pilot.pilotId] = dataset;
    console.log(
      `${pilot.pilotId}: ${dataset.stats.parsedSegments} segments (${dataset.stats.missingMetricJoins} without Maggio join)`
    );
  }

  await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await fs.writeFile(OUTPUT_FILE, `${JSON.stringify(output)}\n`, "utf8");
  const sizeMb = ((await fs.stat(OUTPUT_FILE)).size / (1024 * 1024)).toFixed(2);
  console.log(`Wrote ${OUTPUT_FILE} (${sizeMb} MB)`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
