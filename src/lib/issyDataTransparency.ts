import type { IssyPilotId } from "@/data/issyPilotProfiles";

/** Shown wherever Issy zone_in / zone_out CSV drives KPI 1.2. */
export const ISSY_OD_CSV_DISCLAIMER =
  "Zone-to-zone values are derived from origin/destination flow data and should not be interpreted as direct measurements for each street segment.";

/** Junction arms at study zoom — visual + traficissy context only. */
export const ISSY_JUNCTION_ARM_VISUAL_DISCLAIMER =
  "Approach arms show visualized movement direction and observed traficissy segment context (speed, congestion). They are not zone-to-zone OD measurements.";

export const ISSY_JUNCTION_KPI12_ARM_NOTE =
  "No direct segment-level mode-share dataset on this arm. Modal split for KPI 1.2 comes from observed OD flow CSV at city / pilot level. Arm lines use observed traficissy segment data as traffic context only.";

export type IssyDataSourceKind = "traficissy-segment" | "od-csv" | "bike-api" | "infra-api" | "derived-proxy" | "mock";

export function segmentHasDirectKpiDataset(kpiId: string): boolean {
  return kpiId === "kpi2.1" || kpiId === "kpi3.2";
}

export function kpiPrimaryIssySource(kpiId: string): IssyDataSourceKind {
  switch (kpiId) {
    case "kpi1.2":
      return "od-csv";
    case "kpi2.1":
      return "traficissy-segment";
    case "kpi3.1":
      return "infra-api";
    case "kpi3.2":
      return "derived-proxy";
    case "kpi4.1":
      return "mock";
    case "kpi4.2":
      return "derived-proxy";
    default:
      return "derived-proxy";
  }
}

export function dataSourceTrustLabel(kind: IssyDataSourceKind): string {
  switch (kind) {
    case "traficissy-segment":
      return "Observed segment data";
    case "od-csv":
      return "Observed OD flow data";
    case "bike-api":
      return "Observed counter data";
    case "infra-api":
      return "Observed infrastructure data";
    case "derived-proxy":
      return "Derived proxy";
    case "mock":
      return "Mock / demo";
  }
}

export interface IssyPilotInterventionCopy {
  title: string;
  summary: string;
  schematicCaption: string;
}

export function getIssyPilotInterventionCopy(pilotId: string | null | undefined): IssyPilotInterventionCopy {
  const id = pilotId as IssyPilotId | undefined;
  switch (id) {
    case "issy-p1":
      return {
        title: "Luminous and interactive road markings for bicycles",
        summary:
          "In December 2024, a light-emitting marking system was installed in Issy-les-Moulineaux to improve safety on shared mobility lanes. LED panels in the pavement activate when cyclists approach and when the traffic light is green, alerting drivers with illuminated signals.",
        schematicCaption: "Visualized movement direction / derived representation — not measured per street segment.",
      };
    case "issy-p3":
      return {
        title: "GecoAir app",
        summary:
          "This intervention tests the GecoAir app, which helps citizens understand and reduce air pollution. Data from the app supports the mobility observatory and helps Issy-les-Moulineaux track climate-related mobility impacts.",
        schematicCaption: "Visualized movement direction / derived representation — environmental context at junction scale.",
      };
    case "issy-p2":
    default:
      return {
        title: "Mobility observatory",
        summary:
          "The Mobility Observatory supports the city of Issy-les-Moulineaux with a dynamic mobility decision-making tool. It integrates car flow, logistics flow, cycling flow, and modal split indicators to support safety, carbon footprint, and inclusiveness decisions.",
        schematicCaption: "Visualized movement direction / derived representation — traficissy segment context on approach arms.",
      };
  }
}

/** Popup / tooltip labels for junction arms (traficissy). */
export function junctionArmMetricTitle(kpiId: string): string {
  if (kpiId === "kpi1.2") return "Traffic context (observed segment)";
  if (kpiId === "kpi2.1") return "Safety pressure (derived proxy)";
  if (kpiId === "kpi3.2") return "Environmental pressure (derived proxy)";
  return "Segment indicator";
}

export function junctionArmValueCaption(kpiId: string): string {
  if (kpiId === "kpi1.2") {
    return "Derived flow estimate from traficissy speed/congestion — not OD mode share on this arm.";
  }
  if (kpiId === "kpi2.1") {
    return "Derived proxy: 100 − (speed / 60 km/h reference) × 100. Not an official safety rating.";
  }
  if (kpiId === "kpi3.2") {
    return "Derived environmental pressure from congestion index — not measured CO₂.";
  }
  return "Derived from observed segment API fields.";
}
