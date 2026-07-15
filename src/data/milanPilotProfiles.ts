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
    title: "CDM3 — Decision Support System (DSS)",
    interventionSummary:
      "Digital tool supporting planning and prioritisation of accessibility improvements in public spaces along West Axis and Olympic Routes — OSM barrier mapping, DSS evaluation, and replicable dissemination.",
    objectives: [
      "Map architectural barriers and mobility infrastructure using OpenStreetMap (Activity 1).",
      "Integrate mapped data in a DSS tool for accessibility prioritisation (Activity 2).",
      "Evaluate pre/post intervention accessibility along Olympic Routes and West Axis (Activity 4).",
      "Increase walking and cycling mode share while achieving ≥3-star corridor safety ratings.",
    ],
    expectedImpacts: [
      "Improved accessibility for vulnerable users through barrier remediation.",
      "Higher active-mode share and safer corridor star ratings post-intervention.",
      "Replicable DSS methodology for other Milan districts and partner cities.",
    ],
    geometryType: "line",
    dataAvailability:
      "DSS walk_graph.shp (bundled geojson) + illustrative CDM3 corridor mock aligned to six WP activities.",
    methodologyNotes:
      "Speed shapefiles are unavailable for mil-p3 — use walk graph underlay with explicit illustrative mock labels until observed CDM3 evaluation workbooks are camera-linked.",
    observatoryType: "street-segment",
  },
};
