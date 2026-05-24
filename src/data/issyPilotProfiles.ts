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
      "Interactive pavement markings for cyclist visibility — the monitored intervention corridor shows observed traficissy segment context; KPI 1.2 mode share uses zone-to-zone OD CSV in city view.",
    legendSubtitle: "Pilot 1 — luminous markings",
    schoolRadiusM: 450,
  },
  "issy-p2": {
    id: "issy-p2",
    analyticalIdentity: "Mobility observatory",
    defaultKpi: "kpi1.2",
    primaryRenderer: "issy-junction-arms",
    heroCopy:
      "Mobility observatory at the study junction — OD flow arcs in city view; the monitored intervention corridor shows observed segment traffic, not per-street mode-share measurement.",
    legendSubtitle: "Pilot 2 — mobility observatory (flagship)",
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
