import type { IssyJunctionArmId } from "@/lib/issyPilot2Junction";
import { ISSY_JUNCTION_ARMS, ISSY_P2_JUNCTION, haversineMeters } from "@/lib/issyPilot2Junction";
import { pointAtDistanceAlongPolyline } from "@/lib/junctionArmRendering";

/**
 * Short carriageway stubs at Pont d'Issy — snapped to street centreline near the hub
 * (not the long traficissy corridor polyline, which drifts onto sidewalk / riverbank).
 * Coordinates are [lat, lon], outward from the junction along each monitored arm.
 */
const ISSY_JUNCTION_ARM_LINES: Partial<Record<IssyJunctionArmId, [number, number][]>> = {
  // Pont d'Issy bridge / Bd Frères Voisins — westbound carriageway
  west: [
    [48.829725, 2.261046],
    [48.82952, 2.26035],
    [48.82928, 2.25955],
    [48.82895, 2.25855],
    [48.82855, 2.25745],
  ],
  // Rue Rouget de Lisle — eastbound carriageway
  east: [
    [48.829725, 2.261046],
    [48.82995, 2.26185],
    [48.83022, 2.26275],
    [48.83055, 2.26385],
    [48.83095, 2.26505],
  ],
  // Quai du Président Roosevelt — southbound carriageway (stay on Quai, not riverbank)
  south: [
    [48.829725, 2.261046],
    [48.82935, 2.26112],
    [48.82885, 2.26108],
    [48.82825, 2.26085],
    [48.82755, 2.26045],
  ],
};

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

function samePoint(a: [number, number], b: [number, number]): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

function closestPointOnPolyline(
  coordinates: [number, number][],
  lat: number,
  lon: number
): { point: [number, number]; index: number } {
  let bestDist = Infinity;
  let bestPoint: [number, number] = coordinates[0] ?? [lat, lon];
  let bestIndex = 0;

  for (let i = 1; i < coordinates.length; i++) {
    const a = coordinates[i - 1];
    const b = coordinates[i];
    const dy = b[0] - a[0];
    const dx = b[1] - a[1];
    const len2 = dx * dx + dy * dy;
    const t =
      len2 > 0 ? Math.max(0, Math.min(1, ((lon - a[1]) * dx + (lat - a[0]) * dy) / len2)) : 0;
    const projected: [number, number] = [a[0] + dy * t, a[1] + dx * t];
    const d = haversineMeters(lat, lon, projected[0], projected[1]);
    if (d < bestDist) {
      bestDist = d;
      bestPoint = projected;
      bestIndex = i - 1;
    }
  }

  return { point: bestPoint, index: bestIndex };
}

function outwardChainFromPivot(
  coordinates: [number, number][],
  outbound: IssyJunctionArmId,
  pivot: { point: [number, number]; index: number }
): [number, number][] {
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  const towardStart =
    endpointScore(first[0], first[1], outbound) >= endpointScore(last[0], last[1], outbound);

  const chain: [number, number][] = [pivot.point];
  if (towardStart) {
    for (let i = pivot.index; i >= 0; i--) {
      const c = coordinates[i];
      if (!samePoint(chain[chain.length - 1], c)) chain.push(c);
    }
  } else {
    for (let i = pivot.index + 1; i < coordinates.length; i++) {
      const c = coordinates[i];
      if (!samePoint(chain[chain.length - 1], c)) chain.push(c);
    }
  }

  if (chain.length < 2) {
    chain.push(towardStart ? first : last);
  }
  return chain;
}

/**
 * Place a mock field asset on the carriageway — samples along the traficissy arm
 * polyline away from the junction hub (avoids hub-and-bearing drops in the Seine).
 */
export function placeFieldPointOnJunctionArm(
  armId: IssyJunctionArmId,
  distanceFromJunctionM: number
): [number, number] {
  const coords = ISSY_JUNCTION_ARM_LINES[armId];
  if (!coords?.length) {
    return [ISSY_P2_JUNCTION.lat, ISSY_P2_JUNCTION.lon];
  }

  const { lat, lon } = ISSY_P2_JUNCTION;
  const pivot = closestPointOnPolyline(coords, lat, lon);
  const outward = outwardChainFromPivot(coords, armId, pivot);
  return pointAtDistanceAlongPolyline(outward, Math.max(28, distanceFromJunctionM));
}

export function placeFieldPointForArmSegment(
  segmentId: string,
  distanceFromJunctionM: number
): [number, number] {
  const arm = ISSY_JUNCTION_ARMS.find((a) => a.segmentId === segmentId);
  if (!arm) return [ISSY_P2_JUNCTION.lat, ISSY_P2_JUNCTION.lon];
  return placeFieldPointOnJunctionArm(arm.id, distanceFromJunctionM);
}
