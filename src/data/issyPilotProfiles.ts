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
    primaryRenderer: "issy-zone-flows",
    heroCopy:
      "In December 2024, a light-emitting pavement marking system was installed in Issy-les-Moulineaux to enhance safety on shared-mobility lanes. LED panels in the pavement activate when cyclists approach and the traffic light is green.",
    legendSubtitle: "Pilot 1 — luminous markings (flagship)",
    schoolRadiusM: 450,
  },
  "issy-p2": {
    id: "issy-p2",
    analyticalIdentity: "Mobility observatory",
    defaultKpi: "kpi1.2",
    primaryRenderer: "issy-zone-flows",
    heroCopy:
      "The Mobility Observatory gives Issy-les-Moulineaux a living picture of how people move — cars, logistics, cycling, and modal split — so the city can act faster on safety, carbon, and inclusiveness.",
    legendSubtitle: "Pilot 2 — mobility observatory",
  },
  "issy-p3": {
    id: "issy-p3",
    analyticalIdentity: "GecoAir & climate context",
    defaultKpi: "kpi3.2",
    primaryRenderer: "issy-climate-city",
    heroCopy:
      "This intervention tests the GecoAir app so residents can see and reduce their air-pollution footprint, feeding awareness and climate indicators back into the city’s mobility observatory.",
    legendSubtitle: "Pilot 3 — GecoAir app (city climate)",
  },
};

export function getIssyPilotProfile(pilotId: string | null | undefined): IssyPilotProfile | null {
  if (!pilotId || !(pilotId in ISSY_PILOT_PROFILES)) return null;
  return ISSY_PILOT_PROFILES[pilotId as IssyPilotId];
}

/** City-wide OD zone mode-share map (ISSY1 CSV) — Pilot 2 observatory + Pilot 3 same lens. */
export function isIssyCityWideModeSharePilot(pilotId: string | null | undefined): boolean {
  return pilotId === "issy-p2" || pilotId === "issy-p3";
}
