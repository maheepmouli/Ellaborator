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
