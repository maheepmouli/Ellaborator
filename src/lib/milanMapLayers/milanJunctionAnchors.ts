import { haversineMeters } from "@/lib/issyPilot2Junction";
import { MILAN_PILOT_ANCHORS } from "@/lib/milanMapConfig";
import type { LocalCityPoint } from "@/services/localCityData";
import type { MilanSegmentRecord } from "@/services/milanSegmentData";
import {
  milanHubSegmentId,
  milanSiteHubFromFlows,
  milanSiteKeyFromPoint,
} from "./milanFlowGeometry";

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
/** Keep AMAT→junction links on the intervention corridor — not distant Marghera cameras. */
export const MILAN_JUNCTION_SNAP_METERS = 750;

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

  // Only keep AMAT sites that snapped onto a real KPI 2.1 network junction.
  // Do NOT fall back to raw camera GPS — that paints detached Marghera/Molinazzo clusters.
  let selected = [...chosenByJunction.values()]
    .filter((row) => row.distanceM <= maxSnapMeters)
    .sort((a, b) => b.junction.score - a.junction.score);

  if (selected.length < minJunctions) {
    // Prefer highest-scoring corridor junctions even if fewer AMAT links matched.
    const usedJunctionIds = new Set(selected.map((row) => row.junction.id));
    const extra = [...chosenByJunction.values()]
      .filter((row) => !usedJunctionIds.has(row.junction.id))
      .sort((a, b) => b.junction.score - a.junction.score);
    for (const row of extra) {
      if (selected.length >= minJunctions) break;
      selected.push(row);
    }
  }

  selected = selected.slice(0, maxJunctions);

  if (!selected.length) {
    // Safety network often sits kilometres from AMAT cameras (e.g. mil-p1 Repubblica
    // vs Porta Romana). Keep camera hubs so mode-share still shows every matched site.
    return countPoints.filter(
      (point) => Number.isFinite(point.lat) && Number.isFinite(point.lon)
    );
  }

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
              : `AMAT count site ${bucket.studyName}`,
        },
      });
    });
  });

  return anchored.length ? anchored : points;
}

const METERS_PER_DEG_LAT = 111_320;

/**
 * Fan out co-located AMAT camera hubs (e.g. Porta Romana stack) so each site
 * keeps its own ripple instead of reading as a single blob at city zoom.
 */
export function spreadOverlappingMilanHubPoints(
  points: LocalCityPoint[],
  options?: { clusterMeters?: number; ringMeters?: number }
): LocalCityPoint[] {
  const clusterMeters = options?.clusterMeters ?? 400;
  const ringMeters = options?.ringMeters ?? 140;
  const countPoints = points.filter((p) => p.properties?.datasetKind === "amat-count");
  if (countPoints.length < 2) return points;

  type HubGroup = {
    hubId: string;
    flows: LocalCityPoint[];
    lat: number;
    lon: number;
  };

  const byHub = new Map<string, LocalCityPoint[]>();
  countPoints.forEach((point) => {
    const hubId = milanHubSegmentId(point.properties as Record<string, unknown>);
    const list = byHub.get(hubId) ?? [];
    list.push(point);
    byHub.set(hubId, list);
  });

  const hubs: HubGroup[] = [...byHub.entries()].map(([hubId, flows]) => {
    const hub = milanSiteHubFromFlows(flows);
    return { hubId, flows, lat: hub.lat, lon: hub.lon };
  });

  const clusters: HubGroup[][] = [];
  hubs.forEach((hub) => {
    const cluster = clusters.find((group) =>
      group.some(
        (member) => haversineMeters(member.lat, member.lon, hub.lat, hub.lon) < clusterMeters
      )
    );
    if (cluster) cluster.push(hub);
    else clusters.push([hub]);
  });

  const offsets = new Map<string, { lat: number; lon: number }>();
  clusters.forEach((cluster) => {
    if (cluster.length === 1) {
      offsets.set(cluster[0].hubId, { lat: cluster[0].lat, lon: cluster[0].lon });
      return;
    }
    const meanLat = cluster.reduce((sum, hub) => sum + hub.lat, 0) / cluster.length;
    const meanLon = cluster.reduce((sum, hub) => sum + hub.lon, 0) / cluster.length;
    const cosLat = Math.cos((meanLat * Math.PI) / 180);
    const dLat = ringMeters / METERS_PER_DEG_LAT;
    const dLon = ringMeters / (METERS_PER_DEG_LAT * Math.max(cosLat, 0.2));
    cluster.forEach((hub, index) => {
      const angle = (2 * Math.PI * index) / cluster.length - Math.PI / 2;
      offsets.set(hub.hubId, {
        lat: meanLat + Math.cos(angle) * dLat,
        lon: meanLon + Math.sin(angle) * dLon,
      });
    });
  });

  return points.map((point) => {
    if (point.properties?.datasetKind !== "amat-count") return point;
    const hubId = milanHubSegmentId(point.properties as Record<string, unknown>);
    const offset = offsets.get(hubId);
    if (!offset) return point;
    if (offset.lat === point.lat && offset.lon === point.lon) return point;
    return {
      ...point,
      lat: offset.lat,
      lon: offset.lon,
      properties: {
        ...point.properties,
        presentationLat: offset.lat,
        presentationLon: offset.lon,
        spatialNote: point.properties?.spatialNote
          ? `${point.properties.spatialNote} · hub offset for visibility`
          : "Hub offset so co-located AMAT cameras stay distinct",
      },
    };
  });
}

function seededUnit(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return (hash % 1000) / 1000;
}

function hasValidHubCoords(point: LocalCityPoint): boolean {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lon) &&
    Math.abs(point.lat) > 0.1 &&
    Math.abs(point.lon) > 0.1
  );
}

/**
 * Always keep every AMAT count site as its own ripple hub (mil-p1: 7, mil-p2: 8).
 * Fills missing camera GPS, then fans co-located sites so ripples stay distinct.
 * Does not snap/drop to the KPI 2.1 network — that was hiding cameras.
 */
export function prepareMilanModeShareDisplayPoints(
  points: LocalCityPoint[],
  pilotId?: string | null
): LocalCityPoint[] {
  const countPoints = points.filter((p) => p.properties?.datasetKind === "amat-count");
  if (!countPoints.length) return points;

  const bySite = new Map<string, LocalCityPoint[]>();
  countPoints.forEach((point) => {
    const siteKey = milanSiteKeyFromPoint(point.properties);
    const list = bySite.get(siteKey) ?? [];
    list.push(point);
    bySite.set(siteKey, list);
  });

  const matchedHubs = [...bySite.entries()]
    .map(([siteKey, flows]) => {
      const withCoords = flows.filter(hasValidHubCoords);
      if (!withCoords.length) return null;
      const hub = milanSiteHubFromFlows(withCoords);
      return { siteKey, ...hub };
    })
    .filter((row): row is { siteKey: string; lat: number; lon: number } => row != null);

  const pilotAnchor =
    pilotId && pilotId in MILAN_PILOT_ANCHORS
      ? MILAN_PILOT_ANCHORS[pilotId as keyof typeof MILAN_PILOT_ANCHORS]
      : MILAN_PILOT_ANCHORS["mil-p1"];

  const meanLat =
    matchedHubs.length > 0
      ? matchedHubs.reduce((sum, hub) => sum + hub.lat, 0) / matchedHubs.length
      : pilotAnchor.lat;
  const meanLon =
    matchedHubs.length > 0
      ? matchedHubs.reduce((sum, hub) => sum + hub.lon, 0) / matchedHubs.length
      : pilotAnchor.lon;

  const filled: LocalCityPoint[] = [];
  bySite.forEach((flows, siteKey) => {
    const seed = seededUnit(`milan-hub-fill-${pilotId ?? "x"}-${siteKey}`);
    const angle = seed * Math.PI * 2;
    const radiusDeg = 0.0018 + seed * 0.0008;
    const fallbackLat = meanLat + Math.cos(angle) * radiusDeg;
    const fallbackLon = meanLon + Math.sin(angle) * radiusDeg * 1.15;

    flows.forEach((flow, flowIndex) => {
      const valid = hasValidHubCoords(flow);
      const lat = valid ? flow.lat : fallbackLat;
      const lon = valid ? flow.lon : fallbackLon;
      filled.push({
        ...flow,
        lat,
        lon,
        properties: {
          ...flow.properties,
          siteKey,
          junctionId: undefined,
          junctionLabel: undefined,
          locationMethod: valid
            ? flow.properties?.locationMethod
            : "pilot_site_inference",
          spatialNote: valid
            ? flow.properties?.spatialNote
            : `AMAT site ${siteKey} — camera GPS missing; placed near pilot count cluster for map visibility`,
          // Keep each flow slightly offset only for radar fan; hub uses site average.
          ...(valid
            ? {}
            : {
                presentationLat: lat,
                presentationLon: lon,
                inferredMapPlacement: true,
              }),
          flowIndex,
        },
      });
    });
  });

  return spreadOverlappingMilanHubPoints(filled, {
    clusterMeters: 450,
    ringMeters: 150,
  });
}
