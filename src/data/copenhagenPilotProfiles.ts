import type { CityPilotProfile } from "@/data/cityPilotProfiles";

export type CopenhagenPilotId = "cph-p1" | "cph-p2" | "cph-p3";

export const COPENHAGEN_PILOT_PROFILES: Record<CopenhagenPilotId, CityPilotProfile> = {
  "cph-p1": {
    id: "cph-p1",
    city: "Copenhagen",
    title: "Relocation of car parking in streets",
    interventionSummary:
      "Directional OpenTrafficCam sites monitor intervention effects along parking reallocation corridors.",
    objectives: [
      "Prioritize active mobility through street space reallocation.",
      "Track directional observed mobility counts at intervention cameras.",
    ],
    expectedImpacts: [
      "Higher active mode activity in intervention corridors.",
      "Lower motorized pressure in monitored directions.",
    ],
    geometryType: "point",
    dataAvailability: "Observed directional camera counts (pre/post) available.",
    methodologyNotes:
      "KPI1.2 support is based on observed directional counts at camera level, not full city-wide modal share.",
    observatoryType: "camera",
  },
  "cph-p2": {
    id: "cph-p2",
    city: "Copenhagen",
    title: "Enhanced bicycle parking",
    interventionSummary:
      "Intervention observatory focused on bike parking influence around monitored camera directions.",
    objectives: [
      "Increase bicycle parking usage near intervention points.",
      "Track directional behavior shifts in nearby corridors.",
    ],
    expectedImpacts: [
      "Higher observed cycling counts in intervention directions.",
      "Improved local accessibility around parking nodes.",
    ],
    geometryType: "point",
    dataAvailability: "Observed directional counts available; infrastructure linkage partial.",
    methodologyNotes:
      "Use camera-direction observations and linked corridor context; report missing post fields explicitly.",
    observatoryType: "camera",
  },
  "cph-p3": {
    id: "cph-p3",
    city: "Copenhagen",
    title: "Traffic flow and near encounter",
    interventionSummary:
      "Camera-based intervention monitoring for directional flow pressure and conflict context.",
    objectives: [
      "Improve understanding of directional flow pressure.",
      "Support safer corridor design decisions.",
    ],
    expectedImpacts: [
      "More transparent pilot-level directional diagnostics.",
      "Faster evidence loop for intervention refinement.",
    ],
    geometryType: "point",
    dataAvailability: "Observed directional counts available for KPI1.2 support.",
    methodologyNotes:
      "KPI support is directional and location-bound to monitored camera approaches.",
    observatoryType: "camera",
  },
};
