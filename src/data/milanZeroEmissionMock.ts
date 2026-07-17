import type { MilanPilotId } from "@/data/milanPilotProfiles";
import { MILAN_PILOT_ANCHORS } from "@/lib/milanMapConfig";
import { milanSourcePilotIds } from "@/lib/milanPilotScope";
import type { LocalCityPoint } from "@/services/localCityData";
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
    baselineUnits: 1,
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
    baselineUnits: 1,
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
    baselineUnits: 2,
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
    baselineUnits: 1,
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

export function milanZeroEmissionFacilityCount(scopePilotId: string): number {
  const sources = milanSourcePilotIds(scopePilotId);
  return MILAN_ZERO_EMISSION_FACILITIES.filter((f) => sources.includes(f.pilotId)).length;
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
