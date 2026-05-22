import { resolveSpatialSystem } from "@/lib/spatialLayerRegistry";

/**
 * Issy observatory — which spatial system each KPI uses.
 * Traffic segments are only for road-network KPIs (safety + optional env context).
 */

/** Live traficissy polylines — road-network KPIs only. */
export const ISSY_SEGMENT_KPIS = ["kpi2.1"] as const;

export type IssySpatialSystem = "flows" | "segments" | "facility-points" | "climate-hex" | "sentiment-field" | "accessibility";

export type IssyKpiId =
  | "kpi1.2"
  | "kpi2.1"
  | "kpi3.1"
  | "kpi3.2"
  | "kpi4.1"
  | "kpi4.2";

export function isIssyCity(cityName: string): boolean {
  return cityName.toLowerCase().includes("issy");
}

export function shouldRenderIssyTrafficSegments(cityName: string, kpiId: string): boolean {
  return isIssyCity(cityName) && (ISSY_SEGMENT_KPIS as readonly string[]).includes(kpiId);
}

/** Primary spatial lens per KPI (city + junction study). Delegates to spatialLayerRegistry. */
export function resolveIssySpatialSystem(
  kpiId: string,
  options?: { junctionStudy?: boolean }
): IssySpatialSystem {
  return resolveSpatialSystem("Issy-les-Moulineaux", kpiId, {
    junctionStudy: options?.junctionStudy,
  }) as IssySpatialSystem;
}

/** Mode-share flow / movement node colours (Issy KPI 1.2). */
export const ISSY_MODE_COLORS = {
  pedestrian: "#6EE7B7",
  cycle: "#22D3EE",
  pt: "#60A5FA",
  car: "#A78BFA",
  ptw: "#C084FC",
  other: "#96C2EF",
} as const;

export function issyModeColor(mode: string): string {
  const lower = mode.toLowerCase();
  if (lower.includes("bicycle") || lower.includes("cycl") || lower.includes("bike")) return ISSY_MODE_COLORS.cycle;
  if (lower.includes("pedestrian") || lower.includes("person")) return ISSY_MODE_COLORS.pedestrian;
  if (lower.includes("car")) return ISSY_MODE_COLORS.car;
  if (lower.includes("bus") || lower.includes("transit")) return ISSY_MODE_COLORS.pt;
  if (lower.includes("motor") || lower.includes("ptw")) return ISSY_MODE_COLORS.ptw;
  return ISSY_MODE_COLORS.other;
}

/** Environmental pressure hex cell colour. */
export function climateHexColor(intensity: number): string {
  if (intensity >= 75) return "#E02020";
  if (intensity >= 55) return "#F97316";
  if (intensity >= 35) return "#FBBF24";
  return "#6EE7B7";
}

/** Satisfaction soft field (KPI 4.1). */
export function satisfactionFieldColor(score: number): string {
  if (score >= 70) return "#6EE7B7";
  if (score >= 45) return "#A78BFA";
  return "#FB923C";
}

/** Safety segment ramp (KPI 2.1) — cyan → yellow → orange. */
export const SAFETY_SEGMENT_RAMP: { label: string; color: string }[] = [
  { label: "Lower pressure", color: "#22D3EE" },
  { label: "Moderate", color: "#FBBF24" },
  { label: "High pressure", color: "#F97316" },
];
