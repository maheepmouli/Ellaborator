import type { CityPilotProfile } from "@/data/cityPilotProfiles";
import {
  COPENHAGEN_PILOT_REGISTRY,
  type CopenhagenPilotId,
} from "@/data/copenhagenPilotRegistry";

export type { CopenhagenPilotId } from "@/data/copenhagenLocationRegistry";

export const COPENHAGEN_PILOT_PROFILES: Record<CopenhagenPilotId, CityPilotProfile> = {
  "cph-p1": {
    id: "cph-p1",
    city: "Copenhagen",
    title: COPENHAGEN_PILOT_REGISTRY["cph-p1"].title,
    interventionSummary: COPENHAGEN_PILOT_REGISTRY["cph-p1"].intervention.summary,
    objectives: [
      COPENHAGEN_PILOT_REGISTRY["cph-p1"].objective.primary,
      ...COPENHAGEN_PILOT_REGISTRY["cph-p1"].objective.secondary,
    ],
    expectedImpacts: [
      "Discourage car use; improve walkability and bikeability",
      "Possible increase in car traffic around the Medieval City",
      "Freed-up public space in the streets",
      "Reduced near encounters between cars and VRUs",
      "Reduced car use",
      "Changes in modal shift",
      "Lower air pollution",
      "Lower car traffic locally",
    ],
    geometryType: "point",
    dataAvailability:
      "OpenTrafficCam directional counts at monitored camera corridors (primary source for KPI 1.2).",
    methodologyNotes:
      "Ready when OpenTrafficCam directional rows are loaded for the selected pilot scope.",
    observatoryType: "camera",
  },
  "cph-p2": {
    id: "cph-p2",
    city: "Copenhagen",
    title: COPENHAGEN_PILOT_REGISTRY["cph-p2"].title,
    interventionSummary: COPENHAGEN_PILOT_REGISTRY["cph-p2"].intervention.summary,
    objectives: [
      COPENHAGEN_PILOT_REGISTRY["cph-p2"].objective.primary,
      ...COPENHAGEN_PILOT_REGISTRY["cph-p2"].objective.secondary,
    ],
    expectedImpacts: COPENHAGEN_PILOT_REGISTRY["cph-p2"].evaluation.methods,
    geometryType: "point",
    dataAvailability:
      "Infrastructure deployment metrics primary; OTC at Vandkunsten provides supporting corridor context.",
    methodologyNotes: COPENHAGEN_PILOT_REGISTRY["cph-p2"].evaluation.caveats.join(" "),
    observatoryType: "camera",
  },
  "cph-p3": {
    id: "cph-p3",
    city: "Copenhagen",
    title: COPENHAGEN_PILOT_REGISTRY["cph-p3"].title,
    interventionSummary: COPENHAGEN_PILOT_REGISTRY["cph-p3"].intervention.summary,
    objectives: [
      COPENHAGEN_PILOT_REGISTRY["cph-p3"].objective.primary,
      ...COPENHAGEN_PILOT_REGISTRY["cph-p3"].objective.secondary,
    ],
    expectedImpacts: COPENHAGEN_PILOT_REGISTRY["cph-p3"].evaluation.methods,
    geometryType: "point",
    dataAvailability:
      "Safety evaluation via near encounters, iRAP, speed, and OTC directional trajectories.",
    methodologyNotes: COPENHAGEN_PILOT_REGISTRY["cph-p3"].evaluation.caveats.join(" "),
    observatoryType: "camera",
  },
};
