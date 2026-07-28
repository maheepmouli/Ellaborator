import type { CityPilotProfile } from "@/data/cityPilotProfiles";
import type { IssyPilotId } from "@/data/issyPilotProfiles";
import { ISSY_PILOT_PROFILES } from "@/data/issyPilotProfiles";

export const ISSY_CITY_PILOT_PROFILES: Record<IssyPilotId, CityPilotProfile> = {
  "issy-p1": {
    id: "issy-p1",
    city: "Issy-les-Moulineaux",
    title: ISSY_PILOT_PROFILES["issy-p1"].analyticalIdentity,
    interventionSummary: ISSY_PILOT_PROFILES["issy-p1"].heroCopy,
    objectives: [
      "Improve cyclist visibility at the Pont d'Issy junction.",
      "Reduce conflicts through interactive pavement signals.",
    ],
    expectedImpacts: [
      "Higher cycling visibility and comfort at the monitored junction",
      "Fewer cyclist–vehicle conflicts on illuminated approaches",
      "Clearer before/after mode-share evidence for decision-making",
      "Safer crossing behaviour for active modes",
    ],
    geometryType: "line",
    dataAvailability:
      "Observed OD CSV for KPI 1.2 (panels); map shows camera hub only — no street-segment mode share.",
    methodologyNotes: ISSY_PILOT_PROFILES["issy-p1"].legendSubtitle,
    observatoryType: "corridor",
  },
  "issy-p2": {
    id: "issy-p2",
    city: "Issy-les-Moulineaux",
    title: ISSY_PILOT_PROFILES["issy-p2"].analyticalIdentity,
    interventionSummary: ISSY_PILOT_PROFILES["issy-p2"].heroCopy,
    objectives: [
      "Monitor modal split and multi-flow indicators city-wide.",
      "Support data-driven safety and climate decisions.",
    ],
    expectedImpacts: [
      "Better visibility of mode share and flow patterns",
      "Faster detection of safety and congestion pressure",
      "Stronger evidence base for mobility policy choices",
    ],
    geometryType: "mixed",
    dataAvailability:
      "Observed ISSY1 OD CSV at city scale for KPI 1.2 — map shows sustainable mobility % at six zone centroids.",
    methodologyNotes: ISSY_PILOT_PROFILES["issy-p2"].legendSubtitle,
    observatoryType: "corridor",
  },
  "issy-p3": {
    id: "issy-p3",
    city: "Issy-les-Moulineaux",
    title: ISSY_PILOT_PROFILES["issy-p3"].analyticalIdentity,
    interventionSummary: ISSY_PILOT_PROFILES["issy-p3"].heroCopy,
    objectives: [
      "Raise air-pollution awareness through the GecoAir app.",
      "Link citizen engagement to mobility observatory indicators.",
    ],
    expectedImpacts: [
      "Higher citizen awareness of air-pollution exposure",
      "Derived environmental pressure context around the junction",
      "Stronger link between engagement data and mobility KPIs",
    ],
    geometryType: "polygon",
    dataAvailability:
      "GecoAir engagement plus derived environmental pressure — not measured CO₂ unless emissions data is linked.",
    methodologyNotes: ISSY_PILOT_PROFILES["issy-p3"].legendSubtitle,
    observatoryType: "area",
  },
};
