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
    analyticalIdentity: "Safe school corridor",
    defaultKpi: "kpi2.1",
    primaryRenderer: "issy-junction-arms",
    heroCopy:
      "School-adjacent safety pressure on the four monitored approach arms — segment intensity, not city-wide OD.",
    legendSubtitle: "Pilot 1 — corridor safety lens",
    schoolRadiusM: 450,
  },
  "issy-p2": {
    id: "issy-p2",
    analyticalIdentity: "Mobility observatory",
    defaultKpi: "kpi1.2",
    primaryRenderer: "issy-junction-arms",
    heroCopy:
      "Junction observatory at Stalingrad — live traficissy arms, scenario baseline/intervention/comparison, zone flows in city view.",
    legendSubtitle: "Pilot 2 — mobility observatory (flagship)",
  },
  "issy-p3": {
    id: "issy-p3",
    analyticalIdentity: "Environmental sensing",
    defaultKpi: "kpi3.2",
    primaryRenderer: "issy-climate-hex",
    heroCopy:
      "Climate hex field and emissions narrative around the junction — use the year control for intensity.",
    legendSubtitle: "Pilot 3 — environmental sensing",
  },
};

export function getIssyPilotProfile(pilotId: string | null | undefined): IssyPilotProfile | null {
  if (!pilotId || !(pilotId in ISSY_PILOT_PROFILES)) return null;
  return ISSY_PILOT_PROFILES[pilotId as IssyPilotId];
}
