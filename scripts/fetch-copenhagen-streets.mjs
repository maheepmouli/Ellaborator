#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const OUTPUT_FILE = path.resolve("public/data/copenhagen/streets.geojson");
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const CLIP_RADIUS_M = 220;
const QUERY_RADIUS_M = 450;

const CAMERAS = [
  {
    cameraId: "norreport",
    siteName: "Norregade/Norre Voldgade",
    lat: 55.682312,
    lon: 12.570922,
    streets: ["Nørregade", "Norregade"],
  },
  {
    cameraId: "vandkunsten",
    siteName: "Vandkunsten/Radhuusstraede",
    lat: 55.677575,
    lon: 12.579961,
    streets: ["Vandkunsten", "Rådhusstræde", "Radhuusstraede"],
  },
  {
    cameraId: "gammeltorv",
    siteName: "Gammeltorv/Vestergade",
    lat: 55.678437,
    lon: 12.572236,
    streets: ["Gammeltorv", "Vestergade"],
  },
  {
    cameraId: "stormgade",
    siteName: "Frederiksholmskanal/Stormgade",
    lat: 55.675535,
    lon: 12.575545,
    streets: ["Frederiksholms Kanal", "Frederiksholmskanal", "Stormgade"],
  },
];

function haversineMeters(aLat, aLon, bLat, bLon) {
  const R = 6371000;
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function nearestPointIndex(camera, geometry) {
  let bestIdx = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  geometry.forEach((p, i) => {
    const d = haversineMeters(camera.lat, camera.lon, p.lat, p.lon);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  });
  return bestIdx;
}

function clipAroundCamera(camera, geometry, clipRadiusM) {
  if (!Array.isArray(geometry) || geometry.length < 2) return null;
  const inside = geometry.map(
    (p) => haversineMeters(camera.lat, camera.lon, p.lat, p.lon) <= clipRadiusM
  );
  const kept = [];
  for (let i = 0; i < geometry.length; i += 1) {
    if (inside[i]) kept.push(geometry[i]);
  }
  if (kept.length >= 2) return kept;

  const centerIdx = nearestPointIndex(camera, geometry);
  const start = Math.max(0, centerIdx - 1);
  const end = Math.min(geometry.length - 1, centerIdx + 1);
  const fallback = geometry.slice(start, end + 1);
  return fallback.length >= 2 ? fallback : null;
}

function escRegExp(v) {
  return v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildOverpassQuery() {
  const chunks = CAMERAS.map((camera) => {
    const regex = camera.streets.map(escRegExp).join("|");
    return `way["name"~"${regex}"](around:${QUERY_RADIUS_M},${camera.lat},${camera.lon});`;
  }).join("\n");
  return `[out:json][timeout:60];
(
${chunks}
);
out geom tags;`;
}

async function fetchWays() {
  const query = buildOverpassQuery();
  const res = await fetch(OVERPASS_URL, {
    method: "GET",
    headers: {
      accept: "application/json",
      "user-agent": "ELLABORATOR-copenhagen-streets-script/1.0",
    },
    body: undefined,
  });
  if (!res.ok) {
    const url = `${OVERPASS_URL}?data=${encodeURIComponent(query)}`;
    const retry = await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json",
        "user-agent": "ELLABORATOR-copenhagen-streets-script/1.0",
      },
    });
    if (!retry.ok) {
      throw new Error(`Overpass request failed: ${retry.status} ${retry.statusText}`);
    }
    const data = await retry.json();
    return Array.isArray(data.elements) ? data.elements : [];
  }
  const data = await res.json();
  return Array.isArray(data.elements) ? data.elements : [];
}

function pickCameraForWay(way) {
  const geometry = way.geometry || [];
  if (!geometry.length) return null;
  let best = null;
  for (const camera of CAMERAS) {
    const streetMatch = camera.streets.some(
      (name) => String(way.tags?.name || "").toLowerCase() === name.toLowerCase()
    );
    if (!streetMatch) continue;
    const idx = nearestPointIndex(camera, geometry);
    const pt = geometry[idx];
    const dist = haversineMeters(camera.lat, camera.lon, pt.lat, pt.lon);
    if (!best || dist < best.dist) best = { camera, dist };
  }
  return best?.camera || null;
}

async function main() {
  const elements = await fetchWays();
  const ways = elements.filter((e) => e.type === "way" && Array.isArray(e.geometry));
  const features = [];

  for (const way of ways) {
    const camera = pickCameraForWay(way);
    if (!camera) continue;
    const clipped = clipAroundCamera(camera, way.geometry, CLIP_RADIUS_M);
    if (!clipped) continue;
    features.push({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: clipped.map((p) => [p.lon, p.lat]),
      },
      properties: {
        source: "OSM Overpass",
        osmId: way.id,
        street: String(way.tags?.name || "Unknown street"),
        cameraId: camera.cameraId,
        siteName: camera.siteName,
      },
    });
  }

  const byKey = new Map();
  features.forEach((f) => {
    const key = `${f.properties.cameraId}:${f.properties.street}`;
    if (!byKey.has(key)) byKey.set(key, f);
  });
  const deduped = Array.from(byKey.values());

  const geojson = {
    type: "FeatureCollection",
    features: deduped,
    metadata: {
      generatedAt: new Date().toISOString(),
      source: OVERPASS_URL,
      clipRadiusMeters: CLIP_RADIUS_M,
      queryRadiusMeters: QUERY_RADIUS_M,
      cameraCount: CAMERAS.length,
    },
  };

  await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await fs.writeFile(OUTPUT_FILE, `${JSON.stringify(geojson, null, 2)}\n`, "utf8");
  console.log(`Wrote ${deduped.length} street features to ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
