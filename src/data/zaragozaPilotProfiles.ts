import type { CityPilotProfile } from "@/data/cityPilotProfiles";

export type ZaragozaPilotId = "zar-p1" | "zar-p2" | "zar-p3" | "zar-p4";

export const ZARAGOZA_PILOT_PROFILES: Record<ZaragozaPilotId, CityPilotProfile> = {
  "zar-p1": {
    id: "zar-p1",
    city: "Zaragoza",
    title: "AYZG1 Tactical urbanism around schools",
    interventionSummary:
      "Tactical urbanism intervention around schools at Calle Asin y Palacios / Condes de Aragon.",
    objectives: [
      "Improve active mobility and safety near school corridors.",
      "Track intervention-level KPI performance with explicit readiness messaging.",
    ],
    expectedImpacts: [
      "Improved school-area safety and active mobility context.",
      "Clear next-data requirements per KPI and pilot.",
    ],
    geometryType: "polygon",
    dataAvailability: "Initial pilot indicators available; further spatial detail continues in phased ingestion.",
    methodologyNotes:
      "Use intervention-area representation with explicit notices for pending geometry-linked datasets.",
    observatoryType: "area",
  },
  "zar-p2": {
    id: "zar-p2",
    city: "Zaragoza",
    title: "AYZG2 Pedestrian areas around La Romareda",
    interventionSummary:
      "Pedestrian-priority intervention around La Romareda; final coordinate refinement scheduled for Phase B.",
    objectives: [
      "Improve pedestrian access and safety in the La Romareda intervention area.",
      "Track walking-focused KPI changes with phased geometry enrichment.",
    ],
    expectedImpacts: [
      "Improved pedestrian-priority conditions around intervention links.",
      "Progressive KPI readiness as Phase B geometry is finalized.",
    ],
    geometryType: "polygon",
    dataAvailability: "Pilot indicators available; final WGS84 coordinates pending Phase B.",
    methodologyNotes:
      "Use area-level representation until Phase B bbox-derived coordinates are finalized.",
    observatoryType: "area",
  },
  "zar-p3": {
    id: "zar-p3",
    city: "Zaragoza",
    title: "AYZG3 Traffic management — Miguel Servet Hospital",
    interventionSummary:
      "Traffic-management intervention near Miguel Servet Hospital; final coordinate refinement scheduled for Phase B.",
    objectives: [
      "Improve operational safety around hospital access routes.",
      "Track safety and accessibility indicators under traffic-management measures.",
    ],
    expectedImpacts: [
      "Reduced operational conflicts in hospital-adjacent circulation.",
      "Clearer KPI monitoring once Phase B geometry is linked.",
    ],
    geometryType: "polygon",
    dataAvailability: "Pilot indicators available; final WGS84 coordinates pending Phase B.",
    methodologyNotes:
      "Use area-level representation until Phase B bbox-derived coordinates are finalized.",
    observatoryType: "area",
  },
  "zar-p4": {
    id: "zar-p4",
    city: "Zaragoza",
    title: "AYZG4 Safe shared bike/VMP parking",
    interventionSummary:
      "Shared bike/VMP parking safety intervention; final coordinate refinement scheduled for Phase B.",
    objectives: [
      "Improve parking safety and reduce obstruction from shared bikes/VMPs.",
      "Track access and satisfaction indicators for shared micromobility parking.",
    ],
    expectedImpacts: [
      "Safer shared micromobility parking behavior.",
      "Clear KPI progression once Phase B geometry is linked.",
    ],
    geometryType: "polygon",
    dataAvailability: "Pilot indicators available; final WGS84 coordinates pending Phase B.",
    methodologyNotes:
      "Use area-level representation until Phase B bbox-derived coordinates are finalized.",
    observatoryType: "area",
  },
};
