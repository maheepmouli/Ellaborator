#!/usr/bin/env node
/**
 * Bundle Milan KPI 3.2 RETE environment segments for production.
 * SharePoint shapefiles are gitignored; Vercel SPA rewrite returns HTML 200 for
 * missing /sharepoint-data paths, so the browser never sees real RETE data.
 *
 * Output: public/data/milan/environment-segments.json (per window × mil-p1/mil-p2).
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as shapefile from "shapefile";
import proj4 from "proj4";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_FILE = path.join(ROOT, "public", "data", "milan", "environment-segments.json");
const MILAN_ROOT = path.join(ROOT, "public", "sharepoint-data", "Milan");
const MAP_RETE_CAP = 2000;

proj4.defs(
  "EPSG:3003",
  "+proj=tmerc +lat_0=0 +lon_0=9 +k=0.9996 +x_0=1500000 +y_0=0 +ellps=intl +towgs84=-104.1,-49.1,-9.9,0.416,0.41,0.35,-5.71 +units=m +no_defs"
);

const PILOT_ANCHORS = {
  "mil-p1": { lat: 45.461, lon: 9.168, radiusDeg: 0.055 },
  "mil-p2": { lat: 45.47, lon: 9.142, radiusDeg: 0.05 },
};

const WINDOWS = [
  {
    id: "08-09",
    label: "08-09 AMAT",
    dirs: [
      path.join(MILAN_ROOT, "Eval data Ex ante", "6. CO2 and noise emissions", "traffic_08-09_AMAT"),
      path.join(MILAN_ROOT, "6. CO2 and noise emissions", "traffic_08-09_AMAT"),
    ],
    shp: "RETE_H08_archi.shp",
    dbf: "RETE_H08_archi.dbf",
  },
  {
    id: "18-19",
    label: "18-19 AMAT",
    dirs: [
      path.join(MILAN_ROOT, "Eval data Ex ante", "6. CO2 and noise emissions", "traffic_18-19_AMAT"),
      path.join(MILAN_ROOT, "6. CO2 and noise emissions", "traffic_18-19_AMAT"),
    ],
    shp: "RETE_H18_archi.shp",
    dbf: "RETE_H18_archi.dbf",
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

function round6(n) {
  return Math.round(n * 1e6) / 1e6;
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

function simplifyLine(coords, stride = 3) {
  if (coords.length <= 3) return coords;
  const out = [coords[0]];
  for (let i = stride; i < coords.length - 1; i += stride) out.push(coords[i]);
  out.push(coords[coords.length - 1]);
  return out;
}

function midpoint(coords) {
  if (!coords?.length) return null;
  return coords[Math.floor(coords.length / 2)];
}

function nearPilot(coords, pilotId) {
  const mid = midpoint(coords);
  if (!mid) return false;
  const anchor = PILOT_ANCHORS[pilotId];
  const r2 = anchor.radiusDeg * anchor.radiusDeg;
  const dLat = mid[0] - anchor.lat;
  const dLon = mid[1] - anchor.lon;
  return dLat * dLat + dLon * dLon <= r2;
}

async function resolveWindowDir(windowDef) {
  for (const dir of windowDef.dirs) {
    try {
      await fs.access(path.join(dir, windowDef.shp));
      await fs.access(path.join(dir, windowDef.dbf));
      return dir;
    } catch {
      /* try next */
    }
  }
  return null;
}

async function parseWindow(windowDef) {
  const dir = await resolveWindowDir(windowDef);
  if (!dir) {
    throw new Error(`Missing RETE shapefile for ${windowDef.id}`);
  }

  const source = await shapefile.open(path.join(dir, windowDef.shp), path.join(dir, windowDef.dbf));
  const draft = [];
  let reteOrdinal = 0;
  let invalidGeometries = 0;

  while (true) {
    const result = await source.read();
    if (result.done) break;
    const feature = result.value;
    const geom = feature?.geometry;
    if (!geom?.coordinates || (geom.type !== "LineString" && geom.type !== "MultiLineString")) {
      invalidGeometries += 1;
      continue;
    }

    const parts =
      geom.type === "LineString"
        ? [reprojectLineToLeaflet(geom.coordinates)]
        : geom.coordinates.map((part) => reprojectLineToLeaflet(part));

    const props = feature.properties || {};
    let segmentId = Math.round(toNumber(props.Id ?? props.ID));
    if (segmentId <= 0 && (props.A != null || props["A-B"] != null)) {
      reteOrdinal += 1;
      segmentId = reteOrdinal;
    }
    if (segmentId <= 0) continue;

    const auto = toNumber(props.V_AUTO ?? props.vAuto);
    const moto = toNumber(props.V_MOTO ?? props.vMoto);
    const light = toNumber(props.V_LEGGERI ?? props.vLeggeri);
    const medium = toNumber(props.V_MEDI ?? props.vMedi);
    const heavy = toNumber(props.V_PESANTI ?? props.vPesanti);
    const weightedTraffic = auto * 1 + moto * 0.8 + light * 1.4 + medium * 2.2 + heavy * 3.2;
    if (weightedTraffic <= 0) continue;

    for (let partIndex = 0; partIndex < parts.length; partIndex += 1) {
      const leafletCoords = simplifyLine(parts[partIndex]);
      if (leafletCoords.length < 2) {
        invalidGeometries += 1;
        continue;
      }
      const baseId = `co2-${windowDef.id}-${segmentId}`;
      draft.push({
        id: parts.length > 1 ? `${baseId}-L${partIndex}` : baseId,
        coordinates: leafletCoords,
        rawValue: weightedTraffic,
        properties: {
          sourceLabel: windowDef.label,
          timeWindow: windowDef.id,
          metricType: "co2",
          segmentId,
          streetName: props.StreetName ?? props.NOME_VIA ?? props.NOME_COMUN,
          reteFrom: props.A != null ? toNumber(props.A) : undefined,
          reteTo: props.B != null ? toNumber(props.B) : undefined,
          reteLink: props["A-B"] != null ? String(props["A-B"]) : undefined,
          vAuto: auto,
          vMoto: moto,
          vLeggeri: light,
          vMedi: medium,
          vPesanti: heavy,
          hasMetric: true,
        },
      });
    }
  }

  const rawList = draft.map((r) => r.rawValue);
  const normalized = normalize(rawList);
  const records = draft.map((row, index) => ({
    id: row.id,
    coordinates: row.coordinates,
    value: normalized[index] ?? 50,
    properties: {
      ...row.properties,
      rawMetricValue: row.rawValue,
    },
  }));

  return { records, invalidGeometries, label: windowDef.label };
}

function scopePilot(records, pilotId) {
  const filtered = records.filter((record) => nearPilot(record.coordinates, pilotId));
  const capped =
    filtered.length > MAP_RETE_CAP
      ? [...filtered].sort((a, b) => Number(b.value ?? 0) - Number(a.value ?? 0)).slice(0, MAP_RETE_CAP)
      : filtered;
  const avg =
    capped.length > 0 ? capped.reduce((sum, r) => sum + Number(r.value ?? 0), 0) / capped.length : 0;
  return {
    records: capped,
    stats: {
      parsedSegments: capped.length,
      invalidGeometries: 0,
      missingMetricJoins: 0,
      avgMetricValue: avg,
      pilotScoped: true,
    },
    dataConfidence: "proxy",
    renderMode: "segment",
    statusMessage: `Bundled RETE segments for ${pilotId} (~${capped.length}${
      filtered.length > capped.length ? ` of ${filtered.length}` : ""
    } links). Environmental proxy from traffic composition.`,
  };
}

async function main() {
  const windows = {};
  for (const windowDef of WINDOWS) {
    console.log(`Parsing RETE ${windowDef.id}…`);
    const parsed = await parseWindow(windowDef);
    windows[windowDef.id] = {
      "mil-p1": scopePilot(parsed.records, "mil-p1"),
      "mil-p2": scopePilot(parsed.records, "mil-p2"),
    };
    console.log(
      `  ${windowDef.id}: city=${parsed.records.length} → p1=${windows[windowDef.id]["mil-p1"].records.length} p2=${windows[windowDef.id]["mil-p2"].records.length}`
    );
  }

  const bundle = {
    generatedAt: new Date().toISOString(),
    source: "Milan RETE_H08/H18 archi shapefiles (SharePoint mirror → bundled deploy fallback)",
    windows,
  };

  await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(bundle));
  const sizeMb = ((await fs.stat(OUTPUT_FILE)).size / (1024 * 1024)).toFixed(2);
  console.log(`Wrote ${OUTPUT_FILE} (${sizeMb} MB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
