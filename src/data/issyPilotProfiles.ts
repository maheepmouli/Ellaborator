import type { SpatialRendererId } from "@/lib/spatialLayerRegistry";

export type IssyPilotId = "issy-p1" | "issy-p2" | "issy-p3";

export interface IssyPilotProfile {
  id: IssyPilotId;
  analyticalIdentity: string;
  defaultKpi: string;
  primaryRenderer: SpatialRendererId;
  heroCopy: string;
  legendSubtitle: string;
  /** Optional school-corridor radius (metres) for p1 facility filtering */
  schoolRadiusM?: number;
}

export const ISSY_PILOT_PROFILES: Record<IssyPilotId, IssyPilotProfile> = {
  "issy-p1": {
    id: "issy-p1",
    analyticalIdentity: "Luminous bicycle markings",
    defaultKpi: "kpi2.1",
    primaryRenderer: "issy-junction-arms",
    heroCopy:
      "Wintics camera corridor at Pont d'Issy (ISSY1) — zone-to-zone OD CSV powers KPI 1.2 in city view; traficissy segment context frames the monitored intervention corridor.",
    legendSubtitle: "Pilot 1 — luminous markings (flagship)",
    schoolRadiusM: 450,
  },
  "issy-p2": {
    id: "issy-p2",
    analyticalIdentity: "Mobility observatory",
    defaultKpi: "kpi1.2",
    primaryRenderer: "issy-junction-arms",
    heroCopy:
      "Mobility observatory platform — city-wide monitoring canvas with traficissy segment traffic context; KPI 1.2 aggregates at city scope when OD feeds are linked.",
    legendSubtitle: "Pilot 2 — mobility observatory",
  },
  "issy-p3": {
    id: "issy-p3",
    analyticalIdentity: "GecoAir & climate context",
    defaultKpi: "kpi3.2",
    primaryRenderer: "issy-climate-hex",
    heroCopy:
      "GecoAir citizen engagement and derived environmental pressure around the junction — not measured CO₂ unless emissions data is linked.",
    legendSubtitle: "Pilot 3 — GecoAir app",
  },
};

export function getIssyPilotProfile(pilotId: string | null | undefined): IssyPilotProfile | null {
  if (!pilotId || !(pilotId in ISSY_PILOT_PROFILES)) return null;
  return ISSY_PILOT_PROFILES[pilotId as IssyPilotId];
}
