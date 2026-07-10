import { getIssyPilotProfile } from "@/data/issyPilotProfiles";
import { isNearIssyJunction, ISSY_P2_JUNCTION } from "@/lib/issyPilot2Junction";
import type { CyclingInfrastructureRecord } from "@/types/cycling-infrastructure";

/** `null` = city-wide (no spatial clip). */
export function getIssyFacilityClipRadiusM(pilotId: string | null | undefined): number | null {
  if (pilotId === "issy-p2") return null;
  const profile = getIssyPilotProfile(pilotId);
  if (pilotId === "issy-p1" && profile?.schoolRadiusM) return profile.schoolRadiusM;
  if (pilotId === "issy-p3") return ISSY_P2_JUNCTION.radiusMeters;
  return ISSY_P2_JUNCTION.radiusMeters;
}

export function issyFacilityClipLabel(radiusM: number | null): string {
  if (radiusM === null) return "city-wide (no clip)";
  if (radiusM >= 400) return `${radiusM} m school-corridor clip`;
  return `${radiusM} m junction clip`;
}

export function lineLatLngs(record: CyclingInfrastructureRecord): [number, number][] {
  const coords = record.geo_shape?.geometry?.coordinates;
  if (!coords?.length) return [];
  return coords.map(([lon, lat]) => [lat, lon] as [number, number]);
}

/** True when centroid or any line vertex lies inside the clip (or clip disabled). */
export function isCyclingInfraRecordInClip(
  record: CyclingInfrastructureRecord,
  radiusM: number | null
): boolean {
  if (radiusM === null) return true;
  const pt = record.geo_point_2d;
  if (pt && isNearIssyJunction(pt.lat, pt.lon, radiusM)) return true;
  for (const [lat, lon] of lineLatLngs(record)) {
    if (isNearIssyJunction(lat, lon, radiusM)) return true;
  }
  return false;
}

export function isRenderableCyclingInfra(record: CyclingInfrastructureRecord): boolean {
  if (record.type_amgt_cycl === "Aucun aménagement") return false;
  const hasPoint = !!record.geo_point_2d;
  const hasLine = lineLatLngs(record).length >= 2;
  return hasPoint || hasLine;
}

export interface IssyFacilityMapSlice {
  results: CyclingInfrastructureRecord[];
  total_count: number;
  apiTotal: number;
  clipRadiusM: number | null;
  clipLabel: string;
}

export function filterCyclingInfrastructureForIssy(
  data: { results?: CyclingInfrastructureRecord[]; total_count?: number } | undefined,
  pilotId: string | null | undefined,
  junctionStudy: boolean
): IssyFacilityMapSlice {
  const apiTotal = data?.results?.length ?? 0;
  const clipRadiusM = junctionStudy ? getIssyFacilityClipRadiusM(pilotId) : null;
  if (!data?.results?.length) {
    return {
      results: [],
      total_count: 0,
      apiTotal,
      clipRadiusM,
      clipLabel: issyFacilityClipLabel(clipRadiusM),
    };
  }
  const results = data.results.filter(
    (row) => isRenderableCyclingInfra(row) && isCyclingInfraRecordInClip(row, clipRadiusM)
  );
  return {
    results,
    total_count: results.length,
    apiTotal,
    clipRadiusM,
    clipLabel: issyFacilityClipLabel(clipRadiusM),
  };
}

export function countIssyFacilityRenderables(records: CyclingInfrastructureRecord[]): {
  lines: number;
  points: number;
} {
  let lines = 0;
  let points = 0;
  const drawnLineIds = new Set<string>();
  for (const row of records) {
    const latLngs = lineLatLngs(row);
    if (latLngs.length >= 2 && !drawnLineIds.has(row.id_circapaisee)) {
      drawnLineIds.add(row.id_circapaisee);
      lines += 1;
    }
    if (row.geo_point_2d) points += 1;
  }
  return { lines, points };
}

export function isParkingStyleFacility(record: CyclingInfrastructureRecord): boolean {
  const blob = `${record.type_amgt_cycl} ${record.localisation}`.toLowerCase();
  return (
    blob.includes("parking") ||
    blob.includes("stationnement") ||
    blob.includes("hub") ||
    blob.includes("arceau")
  );
}
