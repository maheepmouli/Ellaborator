#!/usr/bin/env node
/**
 * Build Trikala location registry from partner Google My Maps KML (KMZ → doc.kml).
 * Run: npm run build-trikala-locations
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const KML_DIR = path.join(ROOT, "scripts", "data", "trikala-partner-map");
const KML_PATH = path.join(KML_DIR, "doc.kml");
const KMZ_PATH = path.join(KML_DIR, "map.kmz");
const OUT = path.join(ROOT, "public", "data", "trikala");
const ENV_XLSX = path.join(ROOT, "public", "sharepoint-data", "Trikala", "smart_citizen_kit_environmental_metrics.xlsx");

const KPI_BY_KIND = {
  smart_crossing_site: ["kpi2.1", "kpi4.2"],
  traffic_signal: ["kpi2.1", "kpi4.2"],
  air_quality_sensor: ["kpi3.2"],
  bike_station: ["kpi1.2", "kpi3.1", "kpi4.1"],
  park_and_ride: ["kpi1.2", "kpi3.1", "kpi4.1"],
  parking_station: ["kpi3.1", "kpi1.2"],
  bike_lane_sensor: ["kpi2.1", "kpi4.2"],
};

const SEGMENT_BY_KIND = {
  smart_crossing_site: "tri-p1-smart-crossing",
  traffic_signal: "tri-p1-smart-crossing",
  air_quality_sensor: "tri-p1-environmental-sensor",
  bike_station: "tri-p3-bike-lane",
  park_and_ride: "tri-p2-park-ride",
  parking_station: "tri-p2-park-ride",
  bike_lane_sensor: "tri-p3-bike-lane",
};

const PILOT_BY_KIND = {
  smart_crossing_site: "tri-p1",
  traffic_signal: "tri-p1",
  air_quality_sensor: "tri-p1",
  park_and_ride: "tri-p2",
  parking_station: "tri-p2",
  bike_station: "tri-p3",
  bike_lane_sensor: "tri-p3",
};

/** Workbook / partner label aliases → preferred location id (built after slugify). */
const LABEL_ALIAS_RULES = [
  { test: (n) => n === "LAIKI" || /\bLAIKI\b/.test(n), locationId: "tri-loc-laiki" },
  {
    test: (n) => n.includes("MILITARY SCHOOL") || n === "MILITARY",
    locationId: "tri-loc-military-school",
  },
  { test: (n) => n === "TZAMI" || /\bTZAMI\b/.test(n), locationId: "tri-loc-tzami" },
  {
    test: (n) => n.includes("TRAFFIC LIGHTS") || n.includes("TRAFFIC LIGHT"),
    locationId: "tri-loc-traffic-lights",
  },
  {
    test: (n) => n.includes("MILITARY") && n.includes("TSITSANI"),
    locationId: "tri-loc-vasili-tsitsani-str-military-school",
  },
];

function normalizeLabel(label) {
  return stripCdata(label)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .trim();
}

function resolveLocationByAlias(label, locations) {
  const norm = normalizeLabel(label);
  if (!norm) return null;
  for (const rule of LABEL_ALIAS_RULES) {
    if (!rule.test(norm)) continue;
    const hit = locations.find((l) => l.id === rule.locationId);
    if (hit) return hit.id;
  }
  return null;
}

function stripCdata(value) {
  return String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .trim();
}

function slugify(value) {
  return stripCdata(value)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function matchTokens(name) {
  return stripCdata(name)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
}

function classifyKind(name, folder) {
  const n = stripCdata(name).toUpperCase();
  const f = stripCdata(folder).toLowerCase();
  if (/\bTRAFFIC LIGHTS\b|\bTZAMI\b/.test(n)) return "traffic_signal";
  if (f.includes("park") && f.includes("ride")) return "park_and_ride";
  if (f.includes("smart crossing")) return "smart_crossing_site";
  if (f.includes("air quality")) return "air_quality_sensor";
  if (f.includes("parking stations")) return "parking_station";
  if (f.includes("bike stations")) return "bike_station";
  if (f.includes("bike lanes sensors")) return "bike_lane_sensor";
  return "context_point";
}

function parseKmlPlacemarks(xml) {
  const tagRe = /<\/?([A-Za-z0-9]+)[^>]*>/g;
  const folderStack = [];
  const results = [];
  let i = 0;
  let currentPlacemark = null;
  let inPoint = false;
  let inPolygon = false;

  while (i < xml.length) {
    tagRe.lastIndex = i;
    const m = tagRe.exec(xml);
    if (!m) break;
    const [raw, tag] = m;
    const isClose = raw.startsWith("</");

    if (tag === "Folder") {
      if (!isClose) folderStack.push(null);
      else folderStack.pop();
    } else if (tag === "name" && !isClose && folderStack.length && folderStack[folderStack.length - 1] === null) {
      const end = xml.indexOf("</name>", m.index);
      folderStack[folderStack.length - 1] = xml.slice(m.index + raw.length, end).trim();
    } else if (tag === "Placemark" && !isClose) {
      currentPlacemark = {
        name: "",
        folderPath: [],
        coordsRaw: "",
        geometryType: "point",
      };
    } else if (tag === "Placemark" && isClose && currentPlacemark) {
      currentPlacemark.folderPath = folderStack.filter(Boolean).map(stripCdata);
      results.push(currentPlacemark);
      currentPlacemark = null;
    } else if (currentPlacemark && tag === "name" && !isClose) {
      const end = xml.indexOf("</name>", m.index);
      currentPlacemark.name = xml.slice(m.index + raw.length, end).trim();
    } else if (currentPlacemark && tag === "Point" && !isClose) {
      inPoint = true;
      currentPlacemark.geometryType = "point";
    } else if (currentPlacemark && tag === "Polygon" && !isClose) {
      inPolygon = true;
      currentPlacemark.geometryType = "polygon";
    } else if (currentPlacemark && tag === "coordinates" && !isClose && (inPoint || inPolygon)) {
      const end = xml.indexOf("</coordinates>", m.index);
      currentPlacemark.coordsRaw = xml.slice(m.index + raw.length, end).trim();
      inPoint = false;
      inPolygon = false;
    }

    i = m.index + raw.length;
  }

  return results.map((p) => {
    const pairs = p.coordsRaw
      .split(/\s+/)
      .filter(Boolean)
      .map((s) => s.split(",").map(Number))
      .filter((a) => a.length >= 2 && Number.isFinite(a[0]) && Number.isFinite(a[1]));
    let lat;
    let lng;
    let ring;
    if (p.geometryType === "point" && pairs[0]) {
      [lng, lat] = pairs[0];
    } else if (pairs.length) {
      lat = pairs.reduce((a, c) => a + c[1], 0) / pairs.length;
      lng = pairs.reduce((a, c) => a + c[0], 0) / pairs.length;
      ring = pairs.map(([lo, la]) => [la, lo]);
    }
    return { ...p, name: stripCdata(p.name), lat, lng, ring };
  });
}

async function ensureKml() {
  try {
    await fs.access(KML_PATH);
    return;
  } catch {
    // fall through
  }
  try {
    const kmz = await fs.readFile(KMZ_PATH);
    if (kmz[0] === 0x50 && kmz[1] === 0x4b) {
      const { execSync } = await import("node:child_process");
      const zipPath = path.join(KML_DIR, "map.zip");
      await fs.writeFile(zipPath, kmz);
      execSync(
        `powershell -NoProfile -Command "Expand-Archive -Path '${zipPath.replace(/'/g, "''")}' -DestinationPath '${KML_DIR.replace(/'/g, "''")}' -Force"`,
        { stdio: "inherit" }
      );
    }
  } catch (err) {
    console.warn("Could not extract KMZ:", err.message);
  }
}

function loadEnvironmentalRows() {
  try {
    const wb = XLSX.readFile(ENV_XLSX);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet, { defval: "" });
  } catch {
    return [];
  }
}

function joinSensorsToLocations(locations, envRows) {
  const air = locations.filter((l) => l.kind === "air_quality_sensor");
  const joins = [];
  for (const row of envRows) {
    const sensorId = Number.parseFloat(String(row.Sensor));
    if (!Number.isFinite(sensorId)) continue;
    const label = String(row.Location ?? row.location ?? row.Site ?? row.Coordinates ?? "").trim();
    let locationId = null;
    let joinMethod = null;

    if (label) {
      locationId = resolveLocationByAlias(label, locations);
      if (locationId) joinMethod = "alias";
    }

    if (!locationId && label) {
      const tokens = matchTokens(label);
      const hit = air.find((loc) => {
        const locTokens = loc.matchTokens || [];
        return tokens.some((t) => locTokens.includes(t));
      });
      if (hit) {
        locationId = hit.id;
        joinMethod = "token-overlap";
      }
    }

    joins.push({
      sensorId,
      locationId,
      label: label || null,
      joinMethod: locationId ? joinMethod : null,
    });
  }
  const unjoinedOutdoor = envRows.filter((r) => /outdoor/i.test(String(r["In/outdoor"])));
  const airSorted = [...air].sort((a, b) => a.name.localeCompare(b.name));
  let airAssignIndex = 0;
  unjoinedOutdoor.forEach((row) => {
    const sensorId = Number.parseFloat(String(row.Sensor));
    const existing = joins.find((j) => j.sensorId === sensorId);
    if (existing?.locationId) return;
    const coordLabel = String(row.Coordinates ?? "").trim();
    if (!existing?.locationId && coordLabel) {
      const aliasId = resolveLocationByAlias(coordLabel, locations);
      if (aliasId) {
        const entry = existing ?? { sensorId, locationId: null, label: coordLabel, joinMethod: null };
        entry.locationId = aliasId;
        entry.joinMethod = "alias";
        entry.label = coordLabel;
        if (!existing) joins.push(entry);
        return;
      }
    }
    const fallback = airSorted[airAssignIndex];
    if (!fallback) return;
    airAssignIndex += 1;
    if (existing) {
      existing.locationId = fallback.id;
      existing.joinMethod = "outdoor-index-fallback";
      existing.label = existing.label || fallback.name;
    } else {
      joins.push({
        sensorId,
        locationId: fallback.id,
        label: fallback.name,
        joinMethod: "outdoor-index-fallback",
      });
    }
  });
  return joins;
}

async function main() {
  await ensureKml();
  const kml = await fs.readFile(KML_PATH, "utf8");
  const placemarks = parseKmlPlacemarks(kml);

  const locations = placemarks
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
    .map((p, index) => {
      const parentFolder = p.folderPath[p.folderPath.length - 1] || "ELABORATOR";
      const kind = classifyKind(p.name, parentFolder);
      if (kind === "context_point") return null;
      const id = `tri-loc-${slugify(p.name) || index}`;
      return {
        id,
        kind,
        name: p.name,
        lat: p.lat,
        lng: p.lng,
        geometryType: p.geometryType,
        ring: p.ring ?? undefined,
        folderPath: p.folderPath,
        pilotId: PILOT_BY_KIND[kind],
        linkedKpis: KPI_BY_KIND[kind] ?? [],
        segmentId: SEGMENT_BY_KIND[kind],
        matchTokens: matchTokens(p.name),
        mapVisible: true,
      };
    })
    .filter(Boolean);

  const envRows = loadEnvironmentalRows();
  const sensorJoins = joinSensorsToLocations(locations, envRows);

  let bikeLaneSensorJoins = [];
  try {
    const metricsPath = path.join(OUT, "bike-lane-sensor-metrics.json");
    const metrics = JSON.parse(await fs.readFile(metricsPath, "utf8"));
    bikeLaneSensorJoins = (metrics.sensors ?? []).map((s) => ({
      deviceId: s.deviceId,
      locationId: s.locationId,
      label: s.label,
      joinMethod: s.joinMethod,
      busyPct: s.busyPct,
      availabilityPct: s.availabilityPct,
      observationCount: s.observationCount,
      periodStart: s.periodStart,
      periodEnd: s.periodEnd,
    }));
  } catch {
    // metrics bundle built separately via build-trikala-bike-lane-sensors
  }

  const geojson = {
    type: "FeatureCollection",
    features: locations.map((loc) => ({
      type: "Feature",
      properties: {
        id: loc.id,
        kind: loc.kind,
        name: loc.name,
        linkedKpis: loc.linkedKpis,
        segmentId: loc.segmentId,
      },
      geometry:
        loc.geometryType === "polygon" && loc.ring?.length
          ? { type: "Polygon", coordinates: [loc.ring.map(([la, lo]) => [lo, la])] }
          : { type: "Point", coordinates: [loc.lng, loc.lat] },
    })),
  };

  await fs.mkdir(OUT, { recursive: true });
  const bundle = {
    generatedAt: new Date().toISOString(),
    sourceKml: "scripts/data/trikala-partner-map/doc.kml",
    locationCount: locations.length,
    sensorJoinCount: sensorJoins.filter((j) => j.locationId).length,
    pilotAnchors: {
      "tri-p1": { lat: 39.5540151, lng: 21.7759437, label: "Smart crossing — Military School" },
      "tri-p2": {
        lat: locations.filter((l) => l.pilotId === "tri-p2").reduce((a, l) => a + l.lat, 0) /
          Math.max(1, locations.filter((l) => l.pilotId === "tri-p2").length),
        lng: locations.filter((l) => l.pilotId === "tri-p2").reduce((a, l) => a + l.lng, 0) /
          Math.max(1, locations.filter((l) => l.pilotId === "tri-p2").length),
        label: "Park & Ride stations",
      },
      "tri-p3": {
        lat: locations.filter((l) => l.pilotId === "tri-p3").reduce((a, l) => a + l.lat, 0) /
          Math.max(1, locations.filter((l) => l.pilotId === "tri-p3").length),
        lng: locations.filter((l) => l.pilotId === "tri-p3").reduce((a, l) => a + l.lng, 0) /
          Math.max(1, locations.filter((l) => l.pilotId === "tri-p3").length),
        label: "Redesigned bike lanes",
      },
    },
    locations,
    sensorJoins,
    bikeLaneSensorJoins,
  };
  await fs.writeFile(path.join(OUT, "locations.json"), `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(OUT, "locations.geojson"), `${JSON.stringify(geojson, null, 2)}\n`, "utf8");
  console.log(`Wrote ${locations.length} locations + ${sensorJoins.length} sensor joins → public/data/trikala/`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
