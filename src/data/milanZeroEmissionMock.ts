import type { MilanPilotId } from "@/data/milanPilotProfiles";
import { MILAN_PILOT_ANCHORS } from "@/lib/milanMapConfig";
import { milanSourcePilotIds } from "@/lib/milanPilotScope";
import type { LocalCityPoint } from "@/services/localCityData";
import type { MilanSegmentRecord } from "@/services/milanSegmentData";
import type { ScenarioType } from "@/types/normalized-city-data";

export const MILAN_ZEM_MOCK_DISCLAIMER =
  "Illustrative zero-emission facility inventory for Milan pilots — bike parking, EV charging, mobility hubs, and pedestrian-priority zones aligned to KPI 3.1. Not a certified AMAT asset audit.";

interface MilanZeroEmissionFacility {
  id: string;
  pilotId: "mil-p1" | "mil-p2";
  label: string;
  streetName: string;
  facilityCategory: string;
  latOffset: number;
  lonOffset: number;
  baselineUnits: number;
  interventionUnits: number;
}

const P1 = MILAN_PILOT_ANCHORS["mil-p1"];
const P2 = MILAN_PILOT_ANCHORS["mil-p2"];

/** Pilot-scoped facility rows — mil-p3 unions mil-p1 + mil-p2 via milanSourcePilotIds. */
const MILAN_ZERO_EMISSION_FACILITIES: MilanZeroEmissionFacility[] = [
  {
    id: "p1-missori-cycle-hub",
    pilotId: "mil-p1",
    label: "Missori cycle parking hub",
    streetName: "Piazza Missori · Olympic route",
    facilityCategory: "cycle parking",
    latOffset: 0.0018,
    lonOffset: 0.0006,
    baselineUnits: 14,
    interventionUnits: 22,
  },
  {
    id: "p1-porta-romana-ev",
    pilotId: "mil-p1",
    label: "Corso di Porta Romana EV charging",
    streetName: "Corso di Porta Romana",
    facilityCategory: "charging",
    latOffset: -0.0012,
    lonOffset: 0.0028,
    baselineUnits: 4,
    interventionUnits: 10,
  },
  {
    id: "p1-olympic-mobility-hub",
    pilotId: "mil-p1",
    label: "Olympic corridor mobility hub",
    streetName: "Corso di Porta Romana · Olympic lane",
    facilityCategory: "shared mobility",
    latOffset: 0.0026,
    lonOffset: -0.0014,
    baselineUnits: 0,
    interventionUnits: 2,
  },
  {
    id: "p1-lodi-ped-zone",
    pilotId: "mil-p1",
    label: "Corso Lodi pedestrian priority",
    streetName: "Corso Lodi",
    facilityCategory: "pedestrian",
    latOffset: -0.0024,
    lonOffset: -0.0008,
    baselineUnits: 2,
    interventionUnits: 4,
  },
  {
    id: "p1-missori-bike-rack",
    pilotId: "mil-p1",
    label: "Missori on-street bike racks",
    streetName: "Via Mazzini",
    facilityCategory: "cycle parking",
    latOffset: 0.0009,
    lonOffset: 0.0032,
    baselineUnits: 8,
    interventionUnits: 14,
  },
  {
    id: "p1-universal-design-rest",
    pilotId: "mil-p1",
    label: "Universal-design rest node",
    streetName: "Via Santa Sofia · Olympic route",
    facilityCategory: "pedestrian",
    latOffset: 0.0034,
    lonOffset: 0.0011,
    baselineUnits: 0,
    interventionUnits: 3,
  },
  {
    id: "p2-stadium-cycle-park",
    pilotId: "mil-p2",
    label: "Stadium cycle parking",
    streetName: "Piazzale Angelo Bertolli",
    facilityCategory: "cycle parking",
    latOffset: -0.0016,
    lonOffset: 0.0012,
    baselineUnits: 26,
    interventionUnits: 38,
  },
  {
    id: "p2-sansiro-mobility-hub",
    pilotId: "mil-p2",
    label: "San Siro mobility hub",
    streetName: "Via Piccolomini · stadium corridor",
    facilityCategory: "shared mobility",
    latOffset: 0.0022,
    lonOffset: -0.0026,
    baselineUnits: 0,
    interventionUnits: 4,
  },
  {
    id: "p2-piccolomini-ev",
    pilotId: "mil-p2",
    label: "Via Piccolomini EV charging",
    streetName: "Via Piccolomini",
    facilityCategory: "charging",
    latOffset: 0.0004,
    lonOffset: 0.0024,
    baselineUnits: 6,
    interventionUnits: 12,
  },
  {
    id: "p2-protected-cycle",
    pilotId: "mil-p2",
    label: "Protected cycle track connector",
    streetName: "Viale dei Tigli",
    facilityCategory: "cycle parking",
    latOffset: -0.0028,
    lonOffset: -0.0018,
    baselineUnits: 10,
    interventionUnits: 18,
  },
  {
    id: "p2-fan-zone-ped",
    pilotId: "mil-p2",
    label: "Fan-zone pedestrian plaza",
    streetName: "Piazzale Lotto",
    facilityCategory: "pedestrian",
    latOffset: 0.0031,
    lonOffset: 0.0005,
    baselineUnits: 0,
    interventionUnits: 2,
  },
  {
    id: "p2-deh-park-ride",
    pilotId: "mil-p2",
    label: "DEH Park & Ride bike station",
    streetName: "Parking DEH · stadium access",
    facilityCategory: "parking",
    latOffset: -0.0006,
    lonOffset: -0.0031,
    baselineUnits: 12,
    interventionUnits: 20,
  },
];

function anchorForPilot(pilotId: MilanPilotId) {
  if (pilotId === "mil-p2") return P2;
  return P1;
}

function scenarioValue(
  facility: MilanZeroEmissionFacility,
  scenario: ScenarioType
): number {
  if (scenario === "baseline") return facility.baselineUnits;
  if (scenario === "comparison") return facility.interventionUnits - facility.baselineUnits;
  return facility.interventionUnits;
}

function segmentLengthMeters(coords: [number, number][]): number {
  let length = 0;
  for (let i = 1; i < coords.length; i += 1) {
    const [lat1, lon1] = coords[i - 1]!;
    const [lat2, lon2] = coords[i]!;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    length += 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(a)));
  }
  return length;
}

function pointAlongSegment(
  coords: [number, number][],
  t: number
): { lat: number; lon: number } | null {
  if (coords.length < 2) return null;
  const clamped = Math.max(0, Math.min(1, t));
  const total = segmentLengthMeters(coords);
  if (total <= 0) {
    const mid = coords[Math.floor(coords.length / 2)]!;
    return { lat: mid[0], lon: mid[1] };
  }
  let remaining = total * clamped;
  for (let i = 1; i < coords.length; i += 1) {
    const a = coords[i - 1]!;
    const b = coords[i]!;
    const step = segmentLengthMeters([a, b]);
    if (remaining <= step || i === coords.length - 1) {
      const u = step > 0 ? remaining / step : 0;
      return {
        lat: a[0] + (b[0] - a[0]) * u,
        lon: a[1] + (b[1] - a[1]) * u,
      };
    }
    remaining -= step;
  }
  const last = coords[coords.length - 1]!;
  return { lat: last[0], lon: last[1] };
}

/**
 * Pick spatially spread sample points along the intervention network so mock
 * facilities sit on Maggio / network.shp corridors instead of clustering at the pilot anchor.
 * Sticky #07 / #18: same placement for Pilot 1 and Pilot 2.
 */
export function sampleInterventionNetworkSites(
  records: MilanSegmentRecord[],
  count: number
): Array<{ lat: number; lon: number; streetName: string; segmentId: string }> {
  if (!records.length || count <= 0) return [];

  const usable = records.filter((r) => (r.coordinates?.length ?? 0) >= 2);
  if (!usable.length) return [];

  // Candidate midpoints — prefer longer links so badges sit on readable corridors.
  const candidates = usable
    .map((segment) => {
      const length = segmentLengthMeters(segment.coordinates);
      const mid = pointAlongSegment(segment.coordinates, 0.5) ?? {
        lat: segment.coordinates[0]![0],
        lon: segment.coordinates[0]![1],
      };
      return {
        lat: mid.lat,
        lon: mid.lon,
        streetName: String(segment.properties?.streetName ?? "Intervention corridor"),
        segmentId: segment.id,
        length,
      };
    })
    .sort((a, b) => b.length - a.length);

  // Keep a diverse pool (longest ~40% of network) then farthest-point sample.
  const poolSize = Math.min(candidates.length, Math.max(count * 12, 48));
  const pool = candidates.slice(0, poolSize);
  if (pool.length <= count) {
    return pool.map(({ lat, lon, streetName, segmentId }) => ({
      lat,
      lon,
      streetName,
      segmentId,
    }));
  }

  const picked: typeof pool = [pool[0]!];
  while (picked.length < count) {
    let best = pool[0]!;
    let bestScore = -1;
    for (const candidate of pool) {
      if (picked.some((p) => p.segmentId === candidate.segmentId)) continue;
      // Min squared distance to already picked sites (degrees² — fine for local Milan extent).
      let minDist = Number.POSITIVE_INFINITY;
      for (const existing of picked) {
        const dLat = candidate.lat - existing.lat;
        const dLon = candidate.lon - existing.lon;
        const d2 = dLat * dLat + dLon * dLon;
        if (d2 < minDist) minDist = d2;
      }
      // Slight preference for longer corridors when distances are similar.
      const score = minDist + Math.min(0.00002, candidate.length / 5e8);
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
    picked.push(best);
  }

  // Nudge each site along its segment so badges don't sit exactly on shared vertices.
  return picked.map((site, index) => {
    const segment = usable.find((r) => r.id === site.segmentId) ?? usable[index % usable.length]!;
    const t = 0.22 + (0.56 * (index + 1)) / (count + 1);
    const point = pointAlongSegment(segment.coordinates, t) ?? {
      lat: site.lat,
      lon: site.lon,
    };
    return {
      lat: point.lat,
      lon: point.lon,
      streetName: String(segment.properties?.streetName ?? site.streetName),
      segmentId: segment.id,
    };
  });
}

/**
 * Remap mock facility coordinates onto intervention network samples when Maggio/network geometry is loaded.
 */
export function placeMilanZeroEmissionAlongNetwork(
  points: LocalCityPoint[],
  networkSegments: MilanSegmentRecord[] | undefined | null
): LocalCityPoint[] {
  if (!points.length || !networkSegments?.length) return points;
  const sites = sampleInterventionNetworkSites(networkSegments, points.length);
  if (!sites.length) return points;

  return points.map((point, index) => {
    const site = sites[index % sites.length]!;
    const streetFromNetwork = site.streetName;
    return {
      ...point,
      lat: site.lat,
      lon: site.lon,
      properties: {
        ...point.properties,
        networkSegmentId: site.segmentId,
        streetName:
          streetFromNetwork && streetFromNetwork !== "Intervention corridor"
            ? streetFromNetwork
            : point.properties?.streetName,
        locationMethod: "intervention_network_sample",
        spatialNote: `${MILAN_ZEM_MOCK_DISCLAIMER} Placed along AMAT network.shp corridor samples.`,
      },
    };
  });
}

export function milanZeroEmissionFacilityCount(scopePilotId: string): number {
  const sources = milanSourcePilotIds(scopePilotId);
  return MILAN_ZERO_EMISSION_FACILITIES.filter((f) => sources.includes(f.pilotId)).length;
}

/** Site counts for KPI 3.1 headline — matches visible map points, not summed deployment units. */
export function aggregateMilanFacilitySiteKpi(
  points: LocalCityPoint[],
  scenario: ScenarioType = "intervention"
): {
  baselineMain: number;
  interventionMain: number;
  change: number;
  breakdownBaseline: Record<string, number>;
  breakdownIntervention: Record<string, number>;
} {
  const facilities = points.filter((p) => p.properties?.datasetKind === "parking");
  const categoryOf = (p: LocalCityPoint) => {
    const raw = String(p.properties?.facilityCategory ?? p.properties?.category ?? "Facility");
    return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  };
  const countByCategory = (rows: LocalCityPoint[]) => {
    const byType = new Map<string, number>();
    for (const p of rows) {
      const t = categoryOf(p);
      byType.set(t, (byType.get(t) || 0) + 1);
    }
    return Object.fromEntries(byType.entries());
  };
  const baselineRows = facilities.filter((p) => Number(p.properties?.baselineValue ?? 0) > 0);
  const interventionRows = facilities.filter(
    (p) => Number(p.properties?.interventionValue ?? 0) > 0
  );
  // Scenario-visible rows drive the left-panel bar chart (mock plot).
  const visible =
    scenario === "baseline"
      ? baselineRows
      : scenario === "comparison"
        ? facilities
        : interventionRows;
  return {
    baselineMain: baselineRows.length,
    interventionMain: interventionRows.length,
    change: interventionRows.length - baselineRows.length,
    breakdownBaseline: countByCategory(baselineRows),
    breakdownIntervention: countByCategory(
      scenario === "baseline" ? baselineRows : visible.length ? visible : interventionRows
    ),
  };
}

/** Hide intervention-only facility sites in baseline scenario (and vice versa when units are zero). */
export function filterMilanFacilityPointsForScenario(
  points: LocalCityPoint[],
  scenario: ScenarioType = "intervention"
): LocalCityPoint[] {
  return points.filter((point) => {
    if (point.properties?.datasetKind !== "parking") return true;
    const baseline = Number(point.properties?.baselineValue ?? 0);
    const intervention = Number(point.properties?.interventionValue ?? point.value ?? 0);
    if (scenario === "baseline") return baseline > 0;
    if (scenario === "intervention") return intervention > 0;
    return baseline > 0 || intervention > 0;
  });
}

export function milanZeroEmissionToLocalPoints(
  scopePilotId: string,
  scenario: ScenarioType = "intervention"
): LocalCityPoint[] {
  const sources = milanSourcePilotIds(scopePilotId);
  return MILAN_ZERO_EMISSION_FACILITIES.filter((f) => sources.includes(f.pilotId)).map(
    (facility) => {
      const anchor = anchorForPilot(facility.pilotId);
      const lat = anchor.lat + facility.latOffset;
      const lon = anchor.lon + facility.lonOffset;
      const baselineValue = facility.baselineUnits;
      const interventionValue = facility.interventionUnits;
      const comparisonValue = interventionValue - baselineValue;
      const value = scenarioValue(facility, scenario);

      return {
        lat,
        lon,
        value,
        id: `milan-zem-${facility.id}`,
        properties: {
          id: facility.id,
          datasetKind: "parking",
          facilityCategory: facility.facilityCategory,
          category: facility.facilityCategory,
          pilotId: facility.pilotId,
          interventionId: facility.pilotId,
          segmentId: `mil-zem-${facility.id}`,
          siteKey: facility.id,
          junctionLabel: facility.label,
          streetName: facility.streetName,
          baselineValue,
          interventionValue,
          comparisonValue,
          dataOrigin: "mock",
          parserStatus: "illustrative",
          type: "mock",
          source: "Milan zero-emission facility mock (KPI 3.1)",
          method: "Illustrative deployment inventory per pilot corridor",
          spatialNote: MILAN_ZEM_MOCK_DISCLAIMER,
          temporalCoverage: "illustrative baseline vs post-intervention",
          spatialQuality: "matched",
          geometryLinkage: "matched",
          locationMethod: "pilot_corridor_placement",
        },
      };
    }
  );
}
