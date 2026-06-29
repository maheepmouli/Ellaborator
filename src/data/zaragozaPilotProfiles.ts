import type { CityPilotProfile } from "@/data/cityPilotProfiles";

export type ZaragozaPilotId = "zar-p1";

export const ZARAGOZA_PILOT_PROFILES: Record<ZaragozaPilotId, CityPilotProfile> = {
  "zar-p1": {
    id: "zar-p1",
    city: "Zaragoza",
    title: "Active mobility corridor upgrade",
    interventionSummary:
      "Area-level intervention observatory with transparent readiness and data-gap messaging.",
    objectives: [
      "Improve active mobility performance in intervention area.",
      "Standardize KPI readiness and trust presentation.",
    ],
    expectedImpacts: [
      "Consistent intervention-first exploration experience.",
      "Clear next-data requirements per KPI and pilot.",
    ],
    geometryType: "polygon",
    dataAvailability: "Aggregate indicators available; spatial monitoring data pending.",
    methodologyNotes:
      "Use intervention-area representation with explicit notices for missing geometry-linked datasets.",
    observatoryType: "area",
  },
};
