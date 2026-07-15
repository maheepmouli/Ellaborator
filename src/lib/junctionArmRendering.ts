import type { IssyJunctionArmId } from "@/lib/issyPilot2Junction";
import { haversineMeters, ISSY_P2_JUNCTION } from "@/lib/issyPilot2Junction";

export type JunctionArmVisualization = "colored-polyline" | "sampled-markers" | "arm-anchor";

/** Junction study: only KPI 2.1 uses trimmed traffic segment lines. */
export function resolveJunctionArmVisualization(kpiId: string): JunctionArmVisualization | null {
  if (kpiId === "kpi2.1") return "colored-polyline";
  return null;
}

function endpointScore(lat: number, lon: number, outbound: IssyJunctionArmId): number {
  switch (outbound) {
    case "west":
      return -lon;
    case "east":
      return lon;
    case "north":
      return lat;
    case "south":
      return -lat;
    default:
      return 0;
  }
}

/**
 * Keeps only the approach leg from the junction toward the arm's outbound direction
 * (so opposite API directions do not fully overlap on one polyline).
 */
export function trimSegmentApproachFromJunction(
  coordinates: [number, number][],
  outbound: IssyJunctionArmId,
  maxLengthM = 130
): [number, number][] {
  if (coordinates.length < 2) return coordinates;

  const { lat: jLat, lon: jLon } = ISSY_P2_JUNCTION;
  let pivotIdx = 0;
  let pivotDist = Infinity;
  for (let i = 0; i < coordinates.length; i++) {
    const d = haversineMeters(jLat, jLon, coordinates[i][0], coordinates[i][1]);
    if (d < pivotDist) {
      pivotDist = d;
      pivotIdx = i;
    }
  }

  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  const towardStart =
    endpointScore(first[0], first[1], outbound) >= endpointScore(last[0], last[1], outbound);

  const chain: [number, number][] = towardStart
    ? coordinates.slice(0, pivotIdx + 1).reverse()
    : coordinates.slice(pivotIdx);

  if (chain.length < 2) return coordinates;

  const trimmed: [number, number][] = [chain[0]];
  let acc = 0;
  for (let i = 1; i < chain.length; i++) {
    acc += haversineMeters(chain[i - 1][0], chain[i - 1][1], chain[i][0], chain[i][1]);
    trimmed.push(chain[i]);
    if (acc >= maxLengthM) break;
  }
  return trimmed.length >= 2 ? trimmed : chain;
}

/** Evenly spaced [lat, lon] samples along a polyline (includes endpoints). */
export function samplePointsAlongPolyline(
  coordinates: [number, number][],
  count: number
): [number, number][] {
  if (coordinates.length === 0) return [];
  if (coordinates.length === 1 || count <= 1) return [coordinates[0]];

  const segLens: number[] = [];
  let total = 0;
  for (let i = 1; i < coordinates.length; i++) {
    const len = haversineMeters(
      coordinates[i - 1][0],
      coordinates[i - 1][1],
      coordinates[i][0],
      coordinates[i][1]
    );
    segLens.push(len);
    total += len;
  }
  if (total <= 0) return [coordinates[0], coordinates[coordinates.length - 1]];

  const targets = Array.from({ length: count }, (_, i) => (total * i) / (count - 1));
  const samples: [number, number][] = [];
  let segIdx = 0;
  let segStart = 0;

  for (const target of targets) {
    while (segIdx < segLens.length && segStart + segLens[segIdx] < target) {
      segStart += segLens[segIdx];
      segIdx++;
    }
    if (segIdx >= segLens.length) {
      samples.push(coordinates[coordinates.length - 1]);
      continue;
    }
    const a = coordinates[segIdx];
    const b = coordinates[segIdx + 1];
    const segLen = segLens[segIdx] || 1;
    const t = Math.min(1, Math.max(0, (target - segStart) / segLen));
    samples.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return samples;
}

export function outerApproachPoint(
  coordinates: [number, number][],
  outbound: IssyJunctionArmId
): [number, number] {
  if (coordinates.length === 0) return [ISSY_P2_JUNCTION.lat, ISSY_P2_JUNCTION.lon];
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  return endpointScore(first[0], first[1], outbound) >= endpointScore(last[0], last[1], outbound)
    ? first
    : last;
}

/** Walk `distanceM` along a polyline starting at coordinates[0]. */
export function pointAtDistanceAlongPolyline(
  coordinates: [number, number][],
  distanceM: number
): [number, number] {
  if (coordinates.length === 0) return [ISSY_P2_JUNCTION.lat, ISSY_P2_JUNCTION.lon];
  if (coordinates.length === 1 || distanceM <= 0) return coordinates[0];

  let remaining = distanceM;
  for (let i = 1; i < coordinates.length; i++) {
    const a = coordinates[i - 1];
    const b = coordinates[i];
    const segLen = haversineMeters(a[0], a[1], b[0], b[1]);
    if (remaining <= segLen) {
      const t = segLen > 0 ? remaining / segLen : 0;
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }
    remaining -= segLen;
  }
  return coordinates[coordinates.length - 1];
}
