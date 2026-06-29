import type { CityPilotProfile } from "@/data/cityPilotProfiles";

export type MilanPilotId = "mil-p1" | "mil-p2" | "mil-p3";

export const MILAN_PILOT_PROFILES: Record<MilanPilotId, CityPilotProfile> = {
  "mil-p1": {
    id: "mil-p1",
    city: "Milan",
    title: "Neighbourhood low-traffic zone",
    interventionSummary:
      "Street-segment intervention observatory for low-traffic neighborhood safety and flow pressure.",
    objectives: [
      "Reduce vehicle dominance in neighborhood streets.",
      "Improve safety and active mobility conditions.",
    ],
    expectedImpacts: [
      "Lower segment-level speed and pressure near intervention streets.",
      "Improved mode balance in intervention area.",
    ],
    geometryType: "line",
    dataAvailability: "Observed segment data active; joins partially dependent on IDs.",
    methodologyNotes:
      "Use observed segment geometry where available; missing joins are reported in QA metadata.",
    observatoryType: "street-segment",
  },
  "mil-p2": {
    id: "mil-p2",
    city: "Milan",
    title: "Protected cycling corridor",
    interventionSummary:
      "Street-segment observatory around protected cycling corridor implementation.",
    objectives: [
      "Increase cycling safety and uptake.",
      "Reduce speed-related exposure on intervention segments.",
    ],
    expectedImpacts: [
      "Higher cycling activity around protected segments.",
      "Reduced speed pressure along intervention streets.",
    ],
    geometryType: "line",
    dataAvailability: "Observed speed and environment segment datasets active.",
    methodologyNotes:
      "Maintain segment-level trust metadata and expose missing data joins explicitly.",
    observatoryType: "street-segment",
  },
  "mil-p3": {
    id: "mil-p3",
    city: "Milan",
    title: "Transit-priority reallocation",
    interventionSummary:
      "Street-segment intervention observatory for transit-priority lane and signal changes.",
    objectives: [
      "Improve transit reliability.",
      "Reduce emissions pressure from corridor delay.",
    ],
    expectedImpacts: [
      "Lower congestion in intervention segments.",
      "More stable before/after transport performance.",
    ],
    geometryType: "line",
    dataAvailability: "Segment datasets active; some indicator layers are partial.",
    methodologyNotes:
      "Use observed segment layers first, with explicit missing-data notices for partial KPI support.",
    observatoryType: "street-segment",
  },
};
