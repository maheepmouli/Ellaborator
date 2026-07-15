import type { TrafficSegment } from "@/types/traffic";

/** Cardinal arms at the Issy study intersection (3 monitored traficissy segment IDs). */
export type IssyJunctionArmId = "west" | "east" | "north" | "south";

export interface IssyJunctionArmConfig {
  id: IssyJunctionArmId;
  segmentId: string;
  /** Field / map label (user diagram). */
  mapLabel: string;
  /** API segment name. */
  apiLabel: string;
  armLabel: string;
  color: string;
}

/**
 * Issy study intersection — Pont d'Issy × Quai du Président Roosevelt × Rue Rouget.
 * Three monitored arms from traficissy (north Quai arm excluded from the map).
 */
export const ISSY_P2_JUNCTION = {
  lat: 48.829725,
  lon: 2.261046,
  name: "Pont d'Issy × Quai du Président Roosevelt",
  shortName: "Pont d'Issy camera site",
  radiusMeters: 220,
} as const;

/** Clockwise from west: Pont / Rouget / Quai south (mapped to nearest API arms). */
export const ISSY_JUNCTION_ARMS: IssyJunctionArmConfig[] = [
  {
    id: "west",
    segmentId: "#ILM_92130_6148",
    mapLabel: "Pont d'Issy (west)",
    apiLabel: "Bd Frères Voisins vers Vanves",
    armLabel: "West arm",
    color: "#f43f5e",
  },
  {
    id: "east",
    segmentId: "#ILM_92130_4534",
    mapLabel: "Rue Rouget de Lisle (east)",
    apiLabel: "Bd Frères Voisins vers Boulogne",
    armLabel: "East arm",
    color: "#10b981",
  },
  {
    id: "south",
    segmentId: "#ILM_92130_5968",
    mapLabel: "Quai du Président Roosevelt (south)",
    apiLabel: "Quai d'Issy vers Clamart",
    armLabel: "South arm",
    color: "#f59e0b",
  },
];

export const ISSY_JUNCTION_SEGMENT_IDS = ISSY_JUNCTION_ARMS.map((a) => a.segmentId);

export function getIssyJunctionArm(segmentId: string | undefined): IssyJunctionArmConfig | undefined {
  return ISSY_JUNCTION_ARMS.find((a) => a.segmentId === segmentId);
}

export function getIssyJunctionArmColor(segmentId: string): string {
  return getIssyJunctionArm(segmentId)?.color ?? "#f59e0b";
}

export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function distanceToJunctionMeters(segment: {
  geo_point_2d?: { lat: number; lon: number };
  geo_shape?: { geometry?: { coordinates?: [number, number][] } };
}): number {
  const { lat, lon } = ISSY_P2_JUNCTION;
  let best = Infinity;
  const pt = segment.geo_point_2d;
  if (pt) {
    best = haversineMeters(lat, lon, pt.lat, pt.lon);
  }
  const coords = segment.geo_shape?.geometry?.coordinates ?? [];
  for (const [coordLon, coordLat] of coords) {
    best = Math.min(best, haversineMeters(lat, lon, coordLat, coordLon));
  }
  return best;
}

export function isIssyJunctionSegment(
  segment: { id?: string }
): boolean {
  return !!segment.id && ISSY_JUNCTION_SEGMENT_IDS.includes(segment.id);
}

export function dedupeTrafficBySegmentId(segments: TrafficSegment[]): TrafficSegment[] {
  const byId = new Map<string, TrafficSegment>();
  for (const row of segments) {
    const prev = byId.get(row.id);
    if (!prev) {
      byId.set(row.id, row);
      continue;
    }
    const prevTs = Date.parse(prev.date_et_heure_de_comptage_utc);
    const nextTs = Date.parse(row.date_et_heure_de_comptage_utc);
    if (nextTs >= prevTs) byId.set(row.id, row);
  }
  return [...byId.values()];
}

export function filterTrafficToJunction(segments: TrafficSegment[]): TrafficSegment[] {
  return dedupeTrafficBySegmentId(segments).filter(isIssyJunctionSegment);
}

export function filterMapSegmentsNearJunction<T extends { id?: string; coordinates?: [number, number][] }>(
  segments: T[]
): T[] {
  const allowed = new Set(ISSY_JUNCTION_SEGMENT_IDS);
  return segments.filter((seg) => seg.id && allowed.has(seg.id));
}

export function isNearIssyJunction(lat: number, lon: number, radiusM: number = ISSY_P2_JUNCTION.radiusMeters): boolean {
  return haversineMeters(ISSY_P2_JUNCTION.lat, ISSY_P2_JUNCTION.lon, lat, lon) <= radiusM;
}

/**
 * Pilot-aware junction clip for point layers.
 * - issy-p2: bypass clip (city-wide cycling hubs)
 * - issy-p1: widen to 450 m school-corridor context
 * - default / issy-p3: standard 220 m junction study radius
 */
export function getIssyJunctionClipRadiusM(pilotId: string | null | undefined): number | null {
  if (pilotId === "issy-p2") return null;
  if (pilotId === "issy-p1") return 450;
  return ISSY_P2_JUNCTION.radiusMeters;
}

export function issyJunctionClipLabel(radiusM: number | null): string {
  if (radiusM === null) return "city-wide (no clip)";
  if (radiusM >= 400) return `${radiusM} m school-corridor clip`;
  return `${radiusM} m junction clip`;
}

const ISSY_STUDY_PILOT_IDS = new Set(["issy-p1", "issy-p2", "issy-p3"]);

export function isIssyStudyPilot(pilotId: string | null | undefined): boolean {
  return !!pilotId && ISSY_STUDY_PILOT_IDS.has(pilotId);
}

/** Centre of the monitored intersection (anchor dot + study halo). */
export function junctionMarkerLatLng(
  _segments?: { coordinates?: [number, number][] }[]
): [number, number] {
  return [ISSY_P2_JUNCTION.lat, ISSY_P2_JUNCTION.lon];
}
