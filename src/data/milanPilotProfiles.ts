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
    dataAvailability: "AMAT speed, counts, and accessibility workbooks extracted from Milano SharePoint zip.",
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
    dataAvailability: "AMAT speed, counts, and RETE environment layers; baseline/evaluation count workbooks in SharePoint mirror.",
    methodologyNotes:
      "Maintain segment-level trust metadata and expose missing baseline links explicitly.",
    observatoryType: "street-segment",
  },
  "mil-p3": {
    id: "mil-p3",
    city: "Milan",
    title: "Combined Olympic Routes & Stadium Corridor",
    interventionSummary:
      "Pilot 3 unions the observed datasets from Pilot 1 (Olympic routes) and Pilot 2 (stadium corridor) without synthetic CDM3 mock layers.",
    objectives: [
      "Compare mode share, safety, and accessibility across both Milan intervention areas in one map view.",
      "Keep segment-level evidence from AMAT speed/count shapefiles and DSS accessibility workbooks.",
    ],
    expectedImpacts: [
      "Broader corridor coverage for KPI 1.2, 2.1, 3.2, and 4.2 observatory panels.",
      "Single pilot scope for cross-corridor synthesis while preserving per-pilot provenance on each point.",
    ],
    geometryType: "line",
    dataAvailability:
      "Merged mil-p1 + mil-p2 AMAT speed, counts, RETE environmental proxy, and accessibility DSS rows.",
    methodologyNotes:
      "Load and clip segments from both pilot buffers; local points filter on source pilotId (mil-p1 or mil-p2).",
    observatoryType: "street-segment",
  },
};
