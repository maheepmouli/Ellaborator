import type { MilanPilotId } from "@/data/milanPilotProfiles";
import { MILAN_PILOT_CORRIDORS_JSON, MILAN_WALK_GRAPH_JSON } from "@/lib/milanDataPaths";

export interface MilanCorridorFeature {
  pilotId: MilanPilotId;
  label: string;
  coordinates: [number, number][];
}

const corridorCache = new Map<string, MilanCorridorFeature[]>();
const walkGraphCache = new Map<string, MilanCorridorFeature[]>();

async function loadGeojsonLineFeatures(
  url: string,
  cacheKey: string,
  cache: Map<string, MilanCorridorFeature[]>,
  defaultPilot: MilanPilotId,
  pilotId?: MilanPilotId | null
): Promise<MilanCorridorFeature[]> {
  const key = `${cacheKey}:${pilotId || "all"}`;
  const cached = cache.get(key);
  if (cached) return cached;

  try {
    const response = await fetch(encodeURI(url));
    if (!response.ok) return [];
    const geojson = (await response.json()) as {
      features?: Array<{
        properties?: { pilotId?: MilanPilotId; label?: string };
        geometry?: { type?: string; coordinates?: [number, number][] };
      }>;
    };
    const features = (geojson.features || [])
      .map((feature) => {
        const coords = feature.geometry?.coordinates;
        if (!coords || coords.length < 2) return null;
        const featurePilot = feature.properties?.pilotId;
        if (pilotId && featurePilot && featurePilot !== pilotId) return null;
        return {
          pilotId: (featurePilot || defaultPilot) as MilanPilotId,
          label: String(feature.properties?.label || featurePilot || "Milan layer"),
          coordinates: coords.map(([lng, lat]) => [lat, lng] as [number, number]),
        };
      })
      .filter((feature): feature is MilanCorridorFeature => feature !== null);

    cache.set(key, features);
    return features;
  } catch {
    return [];
  }
}

export async function loadMilanPilotCorridors(
  pilotId?: MilanPilotId | null
): Promise<MilanCorridorFeature[]> {
  return loadGeojsonLineFeatures(
    MILAN_PILOT_CORRIDORS_JSON,
    "corridors",
    corridorCache,
    "mil-p2",
    pilotId
  );
}

export async function loadMilanWalkGraph(
  pilotId: MilanPilotId = "mil-p3"
): Promise<MilanCorridorFeature[]> {
  return loadGeojsonLineFeatures(MILAN_WALK_GRAPH_JSON, "walk-graph", walkGraphCache, pilotId, pilotId);
}
