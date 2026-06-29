import type { CityPilotProfile } from "@/data/cityPilotProfiles";

export type TrikalaPilotId = "tri-p1";

export const TRIKALA_PILOT_PROFILES: Record<TrikalaPilotId, CityPilotProfile> = {
  "tri-p1": {
    id: "tri-p1",
    city: "Trikala",
    title: "Smart mobility area intervention",
    interventionSummary:
      "Area observatory for intervention-first exploration with explicit monitoring readiness signals.",
    objectives: [
      "Align Trikala pilot UX with Issy framework.",
      "Expose required datasets for KPI-level support.",
    ],
    expectedImpacts: [
      "Improved intervention-level navigation and trust.",
      "Reduced ambiguity around missing baseline/post records.",
    ],
    geometryType: "polygon",
    dataAvailability: "Pilot-level KPI values available; geometry-linked observed datasets pending.",
    methodologyNotes:
      "Render intervention area context first and provide explicit missing-data guidance by KPI.",
    observatoryType: "area",
  },
};
