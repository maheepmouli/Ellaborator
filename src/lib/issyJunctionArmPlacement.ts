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

/** Destination [lat, lon] from a start point at bearing (deg) and distance (m). */
function destinationPoint(
  lat: number,
  lon: number,
  bearingDeg: number,
  distanceM: number
): [number, number] {
  const R = 6371000;
  const br = (bearingDeg * Math.PI) / 180;
  const φ1 = (lat * Math.PI) / 180;
  const λ1 = (lon * Math.PI) / 180;
  const δ = distanceM / R;
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(br));
  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(br) * Math.sin(δ) * Math.cos(φ1),
      Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2)
    );
  return [(φ2 * 180) / Math.PI, (λ2 * 180) / Math.PI];
}

/**
 * Land-side sidewalk pads at Pont d'Issy × Quai — never on the Seine bridge
 * (west arm) and offset off the carriageway centreline.
 * Bearings aim inland / plaza corners the user annotated on the map.
 */
const ACCESSIBILITY_SIDEWALK: Record<
  IssyJunctionArmId,
  { bearingDeg: number; baseM: number; lateralBearingDeg: number; lateralM: number }
> = {
  // West traficissy arm runs onto Pont d'Issy over water — place on land abutment / Quai corner.
  west: { bearingDeg: 48, baseM: 18, lateralBearingDeg: 138, lateralM: 9 },
  east: { bearingDeg: 78, baseM: 24, lateralBearingDeg: 168, lateralM: 8 },
  south: { bearingDeg: 165, baseM: 22, lateralBearingDeg: 75, lateralM: 9 },
  north: { bearingDeg: 12, baseM: 20, lateralBearingDeg: 102, lateralM: 8 },
};

/**
 * Mock accessibility pin on sidewalk / plaza near the land junction — not in water,
 * not on street centreline.
 */
export function placeAccessibilityPointOnJunctionArm(
  armId: IssyJunctionArmId,
  slotIndex = 0
): [number, number] {
  const pad = ACCESSIBILITY_SIDEWALK[armId] ?? ACCESSIBILITY_SIDEWALK.east;
  const { lat, lon } = ISSY_P2_JUNCTION;
  // Stagger every slot (including west/east duplicates) so pins do not stack.
  const alongM = pad.baseM + slotIndex * 8;
  const lateralM = pad.lateralM + (slotIndex % 2) * 4;
  const along = destinationPoint(lat, lon, pad.bearingDeg, alongM);
  return destinationPoint(along[0], along[1], pad.lateralBearingDeg, lateralM);
}

export function placeFieldPointForArmSegment(
  segmentId: string,
  distanceFromJunctionM: number
): [number, number] {
  const arm = ISSY_JUNCTION_ARMS.find((a) => a.segmentId === segmentId);
  if (!arm) return [ISSY_P2_JUNCTION.lat, ISSY_P2_JUNCTION.lon];
  return placeFieldPointOnJunctionArm(arm.id, distanceFromJunctionM);
}
