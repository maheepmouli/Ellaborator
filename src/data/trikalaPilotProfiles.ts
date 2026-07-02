import type { CityPilotProfile } from "@/data/cityPilotProfiles";

export type TrikalaPilotId = "tri-p1";

export const TRIKALA_PILOT_PROFILES: Record<TrikalaPilotId, CityPilotProfile> = {
  "tri-p1": {
    id: "tri-p1",
    city: "Trikala",
    title: "Smart mobility corridor & cycling safety",
    interventionSummary:
      "Three ELABORATOR interventions — smart crossing (Military School corridor), redesigned bike lanes, and the SMARTA mobility app — monitored through baseline and post-intervention survey waves (n≈117 women, n≈310 bike baseline, n≈143 smart crossing baseline).",
    objectives: [
      "Measure perceived safety and accessibility before and after smart-crossing deployment.",
      "Track bike-lane safety, encroachment factors, and night-cycling perceptions across redesign.",
      "Capture SMARTA app satisfaction and mobility-needs alignment post-intervention.",
      "Surface caregiver, village, and harassment segment insights for equity-focused reporting.",
    ],
    expectedImpacts: [
      "Improved crossing safety and cyclist visibility at the smart-crossing corridor.",
      "Reduced lane encroachment and higher night-cycling confidence after bike-lane redesign.",
      "Higher digital mobility satisfaction via SMARTA app adoption.",
      "Evidence-backed narratives for stakeholder review in the Observatory methodology tab.",
    ],
    geometryType: "polygon",
    dataAvailability:
      "Six SharePoint survey workbooks parsed (baseline + post); survey aggregates at pilot anchor until partner delivers intervention geometry.",
    methodologyNotes:
      "Real baseline vs post Likert deltas from paired survey workbooks — no synthetic offsets. Segment insights (caregiver, village, urban) and evidence panel narratives computed from live parser output.",
    observatoryType: "area",
  },
};
