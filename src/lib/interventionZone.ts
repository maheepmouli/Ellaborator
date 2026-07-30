import { getCopenhagenPilotZoneAnchor } from "@/data/copenhagenCameraSites";
import { getPilotById } from "@/data/pilotDefinitions";
import {
  filterMilanSegmentsNearPilot,
  MILAN_PILOT_BUFFERS,
  type MilanSegmentRecord,
} from "@/services/milanSegmentData";
import type { LocalCityPoint } from "@/services/localCityData";
import {
  isInMilanPilotScope,
  milanPointMatchesPilotScope,
  milanSourcePilotIds,
} from "@/lib/milanPilotScope";

export { filterMilanSegmentsNearPilot, MILAN_PILOT_BUFFERS };

export type PilotZoneAnchor = {
  lat: number;
  lon: number;
  radiusDeg: number;
};

const PILOT_ZONE_RADIUS_DEG: Record<string, number> = {
  "mil-p1": MILAN_PILOT_BUFFERS["mil-p1"].radiusDeg,
  "mil-p2": MILAN_PILOT_BUFFERS["mil-p2"].radiusDeg,
  "mil-p3": MILAN_PILOT_BUFFERS["mil-p3"].radiusDeg,
};

function defaultRadiusForPilot(pilotId: string): number {
  if (PILOT_ZONE_RADIUS_DEG[pilotId]) return PILOT_ZONE_RADIUS_DEG[pilotId];
  if (pilotId.startsWith("cph-")) return 0.012;
  if (pilotId === "hel-p2") return 0.022;
  if (pilotId.startsWith("hel-")) return 0.015;
  if (pilotId.startsWith("zar-")) return 0.018;
  if (pilotId === "tri-p2") return 0.022;
  if (pilotId === "tri-p3") return 0.02;
  if (pilotId.startsWith("tri-")) return 0.012;
  if (pilotId.startsWith("issy-")) return 0.008;
  return 0.014;
}

export function getPilotZoneAnchor(
  city: string,
  pilotId: string | null | undefined
): PilotZoneAnchor | null {
  if (!pilotId) return null;
  if (pilotId.startsWith("cph-")) {
    return getCopenhagenPilotZoneAnchor(pilotId);
  }
  const milan = MILAN_PILOT_BUFFERS[pilotId as keyof typeof MILAN_PILOT_BUFFERS];
  if (milan) {
    return { lat: milan.lat, lon: milan.lon, radiusDeg: milan.radiusDeg };
  }
  const pilot = getPilotById(city, pilotId);
  if (pilot?.lat != null && pilot?.lng != null) {
    return {
      lat: pilot.lat,
      lon: pilot.lng,
      radiusDeg: defaultRadiusForPilot(pilotId),
    };
  }
  return null;
}

export function isInPilotZone(
  lat: number,
  lon: number,
  city: string,
  pilotId: string | null | undefined
): boolean {
  const anchor = getPilotZoneAnchor(city, pilotId);
  if (!anchor) return true;
  const dLat = lat - anchor.lat;
  const dLon = lon - anchor.lon;
  const r2 = anchor.radiusDeg * anchor.radiusDeg;
  return dLat * dLat + dLon * dLon <= r2;
}

export function filterPointsInPilotZone(
  points: LocalCityPoint[],
  city: string,
  pilotId: string | null | undefined
): LocalCityPoint[] {
  if (!pilotId) return points;
  // FVH1 is citywide survey evidence — hub clusters span Helsinki; do not clip to the overview pin.
  if (pilotId === "hel-p1") {
    return points.filter((p) => {
      const iid = String(p.properties?.interventionId ?? "");
      const kind = String(p.properties?.datasetKind ?? "");
      return (
        iid === "hel-p1" ||
        kind === "dangerous-location" ||
        kind === "conflict" ||
        kind === "safety-attitude-survey"
      );
    });
  }
  return points.filter((p) => isInPilotZone(p.lat, p.lon, city, pilotId));
}

/** Milan AMAT count / DSS rows carry pilotId — mil-p3 unions Pilot 1 + Pilot 2 rows. */
export function filterMilanLocalPoints(
  points: LocalCityPoint[],
  pilotId: string | null | undefined
): LocalCityPoint[] {
  if (!pilotId) return points;
  const sources = milanSourcePilotIds(pilotId);
  const byPilot = points.filter((p) => milanPointMatchesPilotScope(p.properties, pilotId));
  if (byPilot.length) return byPilot;
  if (sources.length > 1) {
    return points.filter((p) => isInMilanPilotScope(p.lat, p.lon, pilotId));
  }
  return filterPointsInPilotZone(points, "Milan", pilotId);
}

export function filterMilanSegmentsForPilot(
  records: MilanSegmentRecord[],
  pilotId: "mil-p1" | "mil-p2" | "mil-p3" | null | undefined
): MilanSegmentRecord[] {
  if (!pilotId) return records;
  return filterMilanSegmentsNearPilot(records, pilotId);
}

export function pickDefaultSegmentId(
  segmentIds: string[],
  preferredId?: string | null
): string | null {
  if (preferredId && segmentIds.includes(preferredId)) return preferredId;
  return segmentIds[0] ?? null;
}
