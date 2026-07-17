import { destination, point } from "@turf/turf";
import { inferOtcWorkbookKey } from "@/data/copenhagenLocationRegistry";

/** Compass bearing degrees (0 = north, 90 = east) for OTC flow labels. */
const FLOW_BEARING_OVERRIDES: Record<string, Record<string, number>> = {
  norreport: {
    "norregade north": 355,
    "norregade south": 175,
  },
  vandkunsten: {
    "radhuusstraede north --> radhuusstraede south": 168,
    "radhuusstraede south --> radhuusstraede north": 348,
  },
  gammeltorv: {
    "gammeltorv north": 15,
    "gammeltorv south": 195,
    "vestergade east": 78,
    "vestergade west": 258,
  },
  stormgade: {
    "frederiksholmskanal south": 210,
    "frederiksholmskanal north": 30,
    "stormgade east": 95,
    "stormgade west": 275,
  },
  hojbro: {
    "hojbro north": 10,
    "hojbro south": 190,
  },
};

function normalizeFlowKey(flow: string): string {
  return flow
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeOtcFlowKey(flow: string): string {
  return normalizeFlowKey(flow);
}

/** Partner-realistic directional labels known for each OTC workbook site (usually 2–4). */
export function knownDirectionalFlowKeys(workbookKey: string | null | undefined): string[] {
  if (!workbookKey) return [];
  return Object.keys(FLOW_BEARING_OVERRIDES[workbookKey] ?? {});
}

export function isKnownDirectionalFlow(
  workbookKey: string | null | undefined,
  flowLabel: string
): boolean {
  const keys = knownDirectionalFlowKeys(workbookKey);
  if (!keys.length) return false;
  return keys.includes(normalizeFlowKey(flowLabel));
}

export function resolveFlowBearing(
  streetName: string,
  flowLabel: string,
  flowIndex = 0,
  flowCount = 1
): number {
  const workbookKey = inferOtcWorkbookKey(streetName);
  const flowKey = normalizeFlowKey(flowLabel);
  if (workbookKey && FLOW_BEARING_OVERRIDES[workbookKey]?.[flowKey] != null) {
    return FLOW_BEARING_OVERRIDES[workbookKey][flowKey];
  }

  const f = flowKey;
  if (f.includes("-->")) {
    const parts = f.split("-->").map((p) => p.trim());
    const from = parts[0] ?? "";
    const to = parts[1] ?? "";
    if (from.includes("north") && to.includes("south")) return 180;
    if (from.includes("south") && to.includes("north")) return 0;
    if (from.includes("east") && to.includes("west")) return 270;
    if (from.includes("west") && to.includes("east")) return 90;
  }
  if (f.includes("north") || f.includes("nord")) return 0;
  if (f.includes("east") || f.includes("ost")) return 90;
  if (f.includes("south") || f.includes("syd")) return 180;
  if (f.includes("west") || f.includes("vest")) return 270;
  return (360 / Math.max(flowCount, 1)) * flowIndex;
}

export function flowArmLengthMeters(comparisonMagnitude: number, isSelected: boolean): number {
  const base = isSelected ? 88 : 72;
  const boost = Math.min(28, comparisonMagnitude * 1.4);
  return base + boost;
}

export function destinationLatLng(
  lat: number,
  lon: number,
  bearingDeg: number,
  distanceMeters: number
): [number, number] {
  const dest = destination(point([lon, lat]), distanceMeters / 1000, bearingDeg, {
    units: "kilometers",
  });
  const [lng, latOut] = dest.geometry.coordinates;
  return [latOut, lng];
}

/** Build FOV wedge polygon coordinates (lat, lng). */
export function buildFovWedgePolygon(
  lat: number,
  lon: number,
  bearingDeg: number,
  options?: { radiusM?: number; sweepDeg?: number; steps?: number }
): [number, number][] {
  const radiusM = options?.radiusM ?? 68;
  const sweepDeg = options?.sweepDeg ?? 52;
  const steps = options?.steps ?? 14;
  const start = bearingDeg - sweepDeg / 2;
  const step = sweepDeg / steps;
  const ring: [number, number][] = [[lat, lon]];
  for (let i = 0; i <= steps; i += 1) {
    ring.push(destinationLatLng(lat, lon, start + step * i, radiusM));
  }
  ring.push([lat, lon]);
  return ring;
}

export function hubForWorkbook(
  workbookKey: string,
  cameras: Array<{ lat: number; lon: number; otcWorkbookKey?: string }>,
  fallback: { lat: number; lon: number }
): { lat: number; lon: number } {
  const linked = cameras.filter((c) => c.otcWorkbookKey === workbookKey);
  if (linked.length === 1) return { lat: linked[0].lat, lon: linked[0].lon };
  if (linked.length > 1) {
    const lat = linked.reduce((s, c) => s + c.lat, 0) / linked.length;
    const lon = linked.reduce((s, c) => s + c.lon, 0) / linked.length;
    return { lat, lon };
  }
  return fallback;
}

/** Inbound (slot 0) vs outbound (slot 1) — corridor, pulse, and radar colours. */
export const CPH_INBOUND_COLOR = "#ef4444";
export const CPH_OUTBOUND_COLOR = "#38bdf8";
export const CPH_DIRECTION_PAIR_COLORS = [CPH_INBOUND_COLOR, CPH_OUTBOUND_COLOR] as const;

/** Slot 0 = inbound/primary (N/E); slot 1 = outbound/return (S/W). */
export function directionPairSlot(flowLabel: string, flowIndex = 0): 0 | 1 {
  const f = normalizeFlowKey(flowLabel);
  if (f.includes("-->")) {
    const parts = f.split("-->").map((p) => p.trim());
    const to = parts[1] ?? "";
    if (to.includes("south") || to.includes("west") || to.includes("syd") || to.includes("vest")) {
      return 1;
    }
    if (to.includes("north") || to.includes("east") || to.includes("nord") || to.includes("ost")) {
      return 0;
    }
  }
  if (f.includes("south") || f.includes("west") || f.includes("syd") || f.includes("vest")) {
    return 1;
  }
  if (f.includes("north") || f.includes("east") || f.includes("nord") || f.includes("ost")) {
    return 0;
  }
  return (flowIndex % 2) as 0 | 1;
}

/**
 * Quadratic Bezier sampled into a polyline that bends along the street bearing,
 * with a small lateral offset so paired directions on the same street stay visible.
 */
export function buildStreetAlignedBezierPath(
  hubLat: number,
  hubLon: number,
  bearingDeg: number,
  armLenM: number,
  pairSlot: 0 | 1,
  steps = 16
): [number, number][] {
  const lateralM = pairSlot === 0 ? -6 : 6;
  const end = destinationLatLng(hubLat, hubLon, bearingDeg, armLenM);
  const endShift = destinationLatLng(end[0], end[1], bearingDeg + 90, lateralM * 0.55);

  const ctrlDist = armLenM * 0.5;
  const ctrlBase = destinationLatLng(hubLat, hubLon, bearingDeg, ctrlDist);
  const curveLean = pairSlot === 0 ? -14 : 14;
  const ctrlCurved = destinationLatLng(ctrlBase[0], ctrlBase[1], bearingDeg + curveLean, 12);
  const ctrl = destinationLatLng(ctrlCurved[0], ctrlCurved[1], bearingDeg + 90, lateralM * 1.15);

  const p0: [number, number] = [hubLat, hubLon];
  const p1 = ctrl;
  const p2 = endShift;

  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const u = 1 - t;
    pts.push([
      u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
      u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
    ]);
  }
  return pts;
}
