import type { TrikalaPilotId } from "@/lib/trikalaMapConfig";

export type TrikalaLocationKind =
  | "smart_crossing_site"
  | "traffic_signal"
  | "air_quality_sensor"
  | "bike_station"
  | "park_and_ride"
  | "parking_station"
  | "bike_lane_sensor";

export interface TrikalaLocation {
  id: string;
  kind: TrikalaLocationKind;
  name: string;
  lat: number;
  lng: number;
  geometryType: "point" | "polygon";
  ring?: [number, number][];
  folderPath: string[];
  pilotId: TrikalaPilotId;
  linkedKpis: string[];
  segmentId?: string;
  matchTokens: string[];
  mapVisible?: boolean;
  capacity?: number;
}

export interface TrikalaSensorJoin {
  sensorId: number;
  locationId: string | null;
  label: string | null;
  joinMethod?: string;
}

export interface TrikalaLocationsBundle {
  generatedAt: string;
  locationCount: number;
  locations: TrikalaLocation[];
  sensorJoins: TrikalaSensorJoin[];
}

const BUNDLE_URL = "/data/trikala/locations.json";

let bundleCache: TrikalaLocationsBundle | null = null;

export async function loadTrikalaLocationsBundle(): Promise<TrikalaLocationsBundle> {
  if (bundleCache) return bundleCache;
  try {
    const res = await fetch(BUNDLE_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    bundleCache = (await res.json()) as TrikalaLocationsBundle;
    return bundleCache;
  } catch {
    bundleCache = { generatedAt: "", locationCount: 0, locations: [], sensorJoins: [] };
    return bundleCache;
  }
}

export function filterTrikalaLocationsByKpi(
  locations: TrikalaLocation[],
  kpiId: string
): TrikalaLocation[] {
  return locations.filter(
    (loc) => loc.mapVisible !== false && loc.linkedKpis.includes(kpiId)
  );
}

export function filterTrikalaLocationsByPilot(
  locations: TrikalaLocation[],
  pilotId: string | null | undefined
): TrikalaLocation[] {
  if (!pilotId?.startsWith("tri-")) return locations;
  return locations.filter((loc) => loc.pilotId === pilotId);
}

export function findTrikalaLocationById(
  locations: TrikalaLocation[],
  id: string | null | undefined
): TrikalaLocation | undefined {
  if (!id) return undefined;
  return locations.find((l) => l.id === id);
}

export function resolveSensorRegistryPosition(
  sensorId: number,
  sensorJoins: TrikalaSensorJoin[],
  locations: TrikalaLocation[]
): { lat: number; lng: number } | null {
  const join = sensorJoins.find((j) => j.sensorId === sensorId);
  if (!join?.locationId) return null;
  const loc = findTrikalaLocationById(locations, join.locationId);
  if (!loc) return null;
  return { lat: loc.lat, lng: loc.lng };
}

export function matchRegistryByLabel(
  locations: TrikalaLocation[],
  label: string,
  kind?: TrikalaLocationKind
): TrikalaLocation | undefined {
  const tokens = label
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
  if (!tokens.length) return undefined;
  const pool = kind ? locations.filter((l) => l.kind === kind) : locations;
  return pool.find((loc) => tokens.some((t) => loc.matchTokens.includes(t)));
}

export function getSmartCrossingSite(
  locations: TrikalaLocation[]
): TrikalaLocation | undefined {
  return locations.find((l) => l.kind === "smart_crossing_site");
}
