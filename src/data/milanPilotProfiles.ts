import type { CityPilotProfile } from "@/data/cityPilotProfiles";

export type MilanPilotId = "mil-p1" | "mil-p2" | "mil-p3";

export const MILAN_PILOT_PROFILES: Record<MilanPilotId, CityPilotProfile> = {
  "mil-p1": {
    id: "mil-p1",
    city: "Milan",
    title: "Universal Design in Olympic Routes",
    interventionSummary:
      "Enhance road and public space design using Universal Design principles in Downtown Olympic Routes, with a focus on accessibility and safety for vulnerable groups, especially people with visual impairments.",
    objectives: [
      "Apply Universal Design along Olympic routes.",
      "Improve accessibility and safety for people with visual impairments.",
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
      "Temporary intervention around the stadium area to enhance accessibility, pedestrian and cyclist safety, and sustainable mobility — demonstrating redevelopment potential.",
    objectives: [
      "Improve accessibility and safety for pedestrians and cyclists.",
      "Promote sustainable mobility through tactical street design.",
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
    title: "Architectural Barriers Assessment",
    interventionSummary:
      "Advanced system for assessing architectural barriers in public spaces, with a focus on improving accessibility for people with disabilities.",
    objectives: [
      "Assess architectural barriers across public space.",
      "Support accessibility planning for people with disabilities.",
      "Track expansion readiness and user satisfaction for the DSS intervention.",
    ],
    expectedImpacts: [
      "KPI 1.1 — plans to expand interventions beyond the living lab.",
      "KPI 4.1 — user satisfaction for interventions.",
      "KPI 4.2 — accessibility DSS using combined Pilot 1 + Pilot 2 civic-address inventory.",
    ],
    geometryType: "line",
    dataAvailability:
      "Milan Intervention Evaluation Plan · CDM3: expansion readiness (1.1), satisfaction survey (4.1), accessibility DSS (4.2 = Pilot 1 ∪ Pilot 2).",
    methodologyNotes:
      "CDM3 Decision Support System scope — KPI 4.2 map combines CDM1 + CDM2 DSS civic-address points. KPIs 1.2 / 2.1 / 3.1 / 3.2 remain CDM1–CDM2 per the evaluation plan matrix.",
    observatoryType: "street-segment",
  },
};
