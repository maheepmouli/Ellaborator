import type { CityPilotProfile } from "@/data/cityPilotProfiles";

export type MilanPilotId = "mil-p1" | "mil-p2" | "mil-p3";

export const MILAN_PILOT_PROFILES: Record<MilanPilotId, CityPilotProfile> = {
  "mil-p1": {
    id: "mil-p1",
    city: "Milan",
    title: "Universal Design in Olympic Routes",
    interventionSummary:
      "Universal-design adaptation along Olympic routes with partial segment-level evidence.",
    objectives: [
      "Improve universal accessibility and safety along Olympic routes.",
      "Track segment-level safety and mobility effects where data exists.",
    ],
    expectedImpacts: [
      "Lower pressure on priority intervention segments.",
      "Improved route accessibility context for vulnerable users.",
    ],
    geometryType: "line",
    dataAvailability: "Partial dataset; post-intervention data missing.",
    methodologyNotes:
      "Use observed segment geometry where available and keep missing post-intervention evidence explicit.",
    observatoryType: "street-segment",
  },
  "mil-p2": {
    id: "mil-p2",
    city: "Milan",
    title: "Tactical Intervention at Stadium",
    interventionSummary:
      "Tactical intervention around the stadium with partial segment observability.",
    objectives: [
      "Improve mobility conditions around the stadium intervention footprint.",
      "Reduce speed-related exposure on intervention segments.",
    ],
    expectedImpacts: [
      "Reduced speed pressure along intervention streets.",
      "Clearer intervention monitoring around stadium-adjacent links.",
    ],
    geometryType: "line",
    dataAvailability: "Partial dataset; baseline package missing.",
    methodologyNotes:
      "Maintain segment-level trust metadata and expose missing baseline links explicitly.",
    observatoryType: "street-segment",
  },
  "mil-p3": {
    id: "mil-p3",
    city: "Milan",
    title: "Decision Support System",
    interventionSummary:
      "Decision-support mobility layer integrating segment evidence for operational planning.",
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
