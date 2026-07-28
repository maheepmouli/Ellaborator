import { resolveSpatialSystem } from "@/lib/spatialLayerRegistry";

/**
 * Issy observatory — which spatial system each KPI uses.
 * Traffic segments are only for road-network KPIs (safety + optional env context).
 */

/** Live traficissy polylines — not used for KPI 1.2 / 2.1 (hub ripples like Copenhagen). */
export const ISSY_SEGMENT_KPIS = [] as const;

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

/** Environmental pressure colour — continuous ramp so small intensity deltas still read. */
export function climateHexColor(intensity: number): string {
  const t = Math.max(0, Math.min(100, intensity)) / 100;
  // green (low pressure) → yellow → orange → red (high)
  const stops: Array<{ at: number; r: number; g: number; b: number }> = [
    { at: 0, r: 110, g: 231, b: 183 }, // #6EE7B7
    { at: 0.35, r: 251, g: 191, b: 36 }, // #FBBF24
    { at: 0.55, r: 249, g: 115, b: 22 }, // #F97316
    { at: 0.75, r: 224, g: 32, b: 32 }, // #E02020
    { at: 1, r: 153, g: 27, b: 27 }, // #991B1B
  ];
  let i = 0;
  while (i < stops.length - 1 && t > stops[i + 1]!.at) i += 1;
  const a = stops[i]!;
  const b = stops[Math.min(i + 1, stops.length - 1)]!;
  const span = Math.max(1e-6, b.at - a.at);
  const u = (t - a.at) / span;
  const r = Math.round(a.r + (b.r - a.r) * u);
  const g = Math.round(a.g + (b.g - a.g) * u);
  const bl = Math.round(a.b + (b.b - a.b) * u);
  return `rgb(${r},${g},${bl})`;
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
