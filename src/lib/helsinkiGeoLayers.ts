import type { HelsinkiPilotId } from "@/data/helsinkiPilotProfiles";

export const HELSINKI_GEO_JSON_LAYERS: Partial<Record<HelsinkiPilotId, string>> = {
  "hel-p1": "/sharepoint-data/Helsinki/dangerous-locations.geojson",
  "hel-p2": "/sharepoint-data/Helsinki/escooter-observations.geojson",
};

export const HELSINKI_GEO_LAYER_LABELS: Partial<Record<HelsinkiPilotId, string>> = {
  "hel-p1": "Dangerous locations survey (SharePoint)",
  "hel-p2": "eScooter observation points (SharePoint)",
};

export interface SampledGeoPoint {
  lat: number;
  lng: number;
  title: string;
}

const geoJsonCache = new Map<string, SampledGeoPoint[]>();

function hashSampleIndex(seed: string, modulo: number): number {
  return hashString(seed) % modulo;
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export async function loadHelsinkiGeoSample(
  pilotId: HelsinkiPilotId,
  maxPoints = 80
): Promise<SampledGeoPoint[]> {
  const url = HELSINKI_GEO_JSON_LAYERS[pilotId];
  if (!url) return [];
  const cacheKey = `${pilotId}:${maxPoints}`;
  const cached = geoJsonCache.get(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(encodeURI(url));
    if (!response.ok) return [];
    const geojson = (await response.json()) as {
      features?: Array<{
        geometry?: { type?: string; coordinates?: number[] };
        properties?: Record<string, unknown>;
      }>;
    };
    const features = geojson.features || [];
    const step = Math.max(1, Math.floor(features.length / maxPoints));
    const sampled: SampledGeoPoint[] = [];
    for (let i = 0; i < features.length && sampled.length < maxPoints; i += step) {
      const feature = features[i];
      const coords = feature.geometry?.coordinates;
      if (!coords || coords.length < 2) continue;
      const title =
        String(
          feature.properties?.title ||
            feature.properties?.name ||
            feature.properties?.Submitted ||
            HELSINKI_GEO_LAYER_LABELS[pilotId]
        ) || "Observed location";
      sampled.push({
        lat: coords[1],
        lng: coords[0],
        title,
      });
    }
    if (sampled.length === 0 && features.length > 0) {
      const idx = hashSampleIndex(pilotId, features.length);
      const coords = features[idx]?.geometry?.coordinates;
      if (coords && coords.length >= 2) {
        sampled.push({ lat: coords[1], lng: coords[0], title: "Observed location" });
      }
    }
    geoJsonCache.set(cacheKey, sampled);
    return sampled;
  } catch {
    return [];
  }
}
