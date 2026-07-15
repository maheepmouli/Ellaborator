import { haversineMeters } from "@/lib/issyPilot2Junction";
import type { LocalCityPoint } from "@/services/localCityData";
import type { MilanSegmentRecord } from "@/services/milanSegmentData";
import { milanSiteHubFromFlows, milanSiteKeyFromPoint } from "./milanFlowGeometry";

export type MilanJunctionAnchor = {
  id: string;
  lat: number;
  lon: number;
  label: string;
  degree: number;
  score: number;
  streetNames: string[];
};

const JUNCTION_COORD_PRECISION = 4;
const JUNCTION_MERGE_METERS = 85;
export const MILAN_MODE_SHARE_JUNCTION_LIMIT = 8;
export const MILAN_MODE_SHARE_JUNCTION_MIN = 6;
export const MILAN_JUNCTION_SNAP_METERS = 1600;

function coordKey(lat: number, lon: number): string {
  return `${lat.toFixed(JUNCTION_COORD_PRECISION)},${lon.toFixed(JUNCTION_COORD_PRECISION)}`;
}

/**
 * Pick the busiest junction nodes from the KPI 2.1 speed segment graph
 * (shared endpoints = intersection candidates).
 */
export function selectMajorJunctionsFromSpeedSegments(
  records: MilanSegmentRecord[],
  limit = MILAN_MODE_SHARE_JUNCTION_LIMIT
): MilanJunctionAnchor[] {
  const nodeMap = new Map<
    string,
    {
      lat: number;
      lon: number;
      degree: number;
      hits: number;
      pressure: number;
      streets: Set<string>;
    }
  >();

  records.forEach((segment) => {
    const coords = segment.coordinates;
    if (!coords || coords.length < 2) return;
    const hits = Math.max(1, Number(segment.properties?.hits ?? 1));
    const pressure = Number(segment.value ?? 50);
    const street = String(segment.properties?.streetName ?? "").trim();
    const endpoints: [number, number][] = [coords[0], coords[coords.length - 1]];

    endpoints.forEach(([lat, lon]) => {
      const key = coordKey(lat, lon);
      const node =
        nodeMap.get(key) ?? {
          lat,
          lon,
          degree: 0,
          hits: 0,
          pressure: 0,
          streets: new Set<string>(),
        };
      node.degree += 1;
      node.hits += hits;
      node.pressure += pressure;
      if (street) node.streets.add(street);
      nodeMap.set(key, node);
    });
  });

  const candidates = [...nodeMap.values()]
    .filter((node) => node.degree >= 2)
    .map((node) => ({
      ...node,
      score: node.degree * 3 + Math.log10(node.hits + 1) * 2.5 + node.pressure / 45,
    }))
    .sort((a, b) => b.score - a.score);

  const merged: Array<{
    lat: number;
    lon: number;
    degree: number;
    hits: number;
    pressure: number;
    score: number;
    streets: Set<string>;
  }> = [];

  for (const candidate of candidates) {
    const existing = merged.find(
      (node) => haversineMeters(node.lat, node.lon, candidate.lat, candidate.lon) < JUNCTION_MERGE_METERS
    );
    if (existing) {
      existing.degree += candidate.degree;
      existing.hits += candidate.hits;
      existing.pressure += candidate.pressure;
      existing.score = Math.max(existing.score, candidate.score);
      candidate.streets.forEach((street) => existing.streets.add(street));
      continue;
    }
    merged.push({
      lat: candidate.lat,
      lon: candidate.lon,
      degree: candidate.degree,
      hits: candidate.hits,
      pressure: candidate.pressure,
      score: candidate.score,
      streets: new Set(candidate.streets),
    });
  }

  merged.sort((a, b) => b.score - a.score);

  return merged.slice(0, limit).map((node, index) => {
    const streets = [...node.streets].filter(Boolean).slice(0, 2);
    const label = streets.length ? streets.join(" · ") : `Major junction ${index + 1}`;
    return {
      id: `mil-junction-${index + 1}`,
      lat: node.lat,
      lon: node.lon,
      label,
      degree: node.degree,
      score: node.score,
      streetNames: streets,
    };
  });
}

type SiteBucket = {
  siteKey: string;
  flows: LocalCityPoint[];
  hubLat: number;
  hubLon: number;
  studyName: string;
  totalVolume: number;
};

function siteBucketFromFlows(siteKey: string, flows: LocalCityPoint[]): SiteBucket {
  const hub = milanSiteHubFromFlows(flows);
  const studyName = String(flows[0]?.properties?.streetName ?? siteKey).split(" · ")[0];
  const totalVolume = flows.reduce((sum, flow) => {
    const mb = flow.properties?.modeBreakdown as
      | { pre?: { total?: number }; post?: { total?: number } }
      | undefined;
    return sum + Number(mb?.post?.total ?? mb?.pre?.total ?? 0);
  }, 0);
  return {
    siteKey,
    flows,
    hubLat: hub.lat,
    hubLon: hub.lon,
    studyName,
    totalVolume,
  };
}

/**
 * Snap AMAT count sites onto safety-network junctions (max 8) and re-project
 * flow points to the junction hub for radar rendering.
 */
export function anchorModeSharePointsToJunctions(
  points: LocalCityPoint[],
  junctions: MilanJunctionAnchor[],
  options?: {
    maxJunctions?: number;
    maxSnapMeters?: number;
    minJunctions?: number;
  }
): LocalCityPoint[] {
  const maxJunctions = options?.maxJunctions ?? MILAN_MODE_SHARE_JUNCTION_LIMIT;
  const maxSnapMeters = options?.maxSnapMeters ?? MILAN_JUNCTION_SNAP_METERS;
  const minJunctions = options?.minJunctions ?? MILAN_MODE_SHARE_JUNCTION_MIN;

  const countPoints = points.filter((p) => p.properties?.datasetKind === "amat-count");
  if (!countPoints.length) return points;

  const bySite = new Map<string, LocalCityPoint[]>();
  countPoints.forEach((point) => {
    const siteKey = milanSiteKeyFromPoint(point.properties);
    const list = bySite.get(siteKey) ?? [];
    list.push(point);
    bySite.set(siteKey, list);
  });

  const siteBuckets = [...bySite.entries()].map(([siteKey, flows]) =>
    siteBucketFromFlows(siteKey, flows)
  );

  if (!junctions.length) {
    return points.slice(0, maxJunctions * 4);
  }

  type JunctionAssignment = {
    junction: MilanJunctionAnchor;
    bucket: SiteBucket;
    distanceM: number;
  };

  const assignments: JunctionAssignment[] = [];

  siteBuckets.forEach((bucket) => {
    let bestJunction: MilanJunctionAnchor | null = null;
    let bestDistance = Infinity;
    junctions.forEach((junction) => {
      const distance = haversineMeters(bucket.hubLat, bucket.hubLon, junction.lat, junction.lon);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestJunction = junction;
      }
    });
    if (bestJunction && bestDistance <= maxSnapMeters) {
      assignments.push({ junction: bestJunction, bucket, distanceM: bestDistance });
    }
  });

  assignments.sort((a, b) => a.distanceM - b.distanceM);

  const chosenByJunction = new Map<string, JunctionAssignment>();
  assignments.forEach((assignment) => {
    if (!chosenByJunction.has(assignment.junction.id)) {
      chosenByJunction.set(assignment.junction.id, assignment);
    }
  });

  let selected = [...chosenByJunction.values()].sort(
    (a, b) => b.junction.score - a.junction.score
  );

  if (selected.length < minJunctions) {
    const usedSites = new Set(selected.map((row) => row.bucket.siteKey));
    const fallbackSites = siteBuckets
      .filter((bucket) => !usedSites.has(bucket.siteKey))
      .sort((a, b) => b.totalVolume - a.totalVolume);

    for (const bucket of fallbackSites) {
      if (selected.length >= minJunctions) break;
      selected.push({
        junction: {
          id: `mil-site-${bucket.siteKey}`,
          lat: bucket.hubLat,
          lon: bucket.hubLon,
          label: bucket.studyName,
          degree: 0,
          score: bucket.totalVolume,
          streetNames: [bucket.studyName],
        },
        bucket,
        distanceM: 0,
      });
    }
  }

  selected = selected.slice(0, maxJunctions);

  const anchored: LocalCityPoint[] = [];
  selected.forEach(({ junction, bucket, distanceM }) => {
    bucket.flows.forEach((flow) => {
      const direction = String(flow.properties?.direction ?? flow.properties?.mode ?? "");
      anchored.push({
        ...flow,
        lat: junction.lat,
        lon: junction.lon,
        properties: {
          ...flow.properties,
          junctionId: junction.id,
          junctionLabel: junction.label,
          siteKey: bucket.siteKey,
          streetName: direction ? `${junction.label} · ${direction}` : junction.label,
          spatialNote:
            distanceM > 0
              ? `AMAT count (${bucket.studyName}) linked ${Math.round(distanceM)} m to KPI 2.1 junction`
              : `AMAT count site ${bucket.studyName} — no nearby safety-network junction match`,
        },
      });
    });
  });

  return anchored.length ? anchored : points;
}
