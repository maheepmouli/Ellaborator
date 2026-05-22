import type { MapSegment } from "@/services/trafficApi";

export type MapScenario = "baseline" | "intervention" | "comparison";

export const COMPARISON_FAVOURABLE_COLOR = "#22C55E";
export const COMPARISON_OTHER_COLOR = "#8578C3";
export const BASELINE_GHOST_COLOR = "#94a3b8";

/** Stable 0–1 seed per junction arm (matches observatory panel). */
export function junctionArmSeed(segmentId: string): number {
  let h = 0;
  for (let i = 0; i < segmentId.length; i++) h = (h * 31 + segmentId.charCodeAt(i)) % 997;
  return h / 997;
}

export function kpiValueFromTrafficRaw(
  speedKmh: number,
  congestion: number,
  kpiId: string
): number {
  switch (kpiId) {
    case "kpi1.2":
      return Math.min(100, Math.max(0, congestion * 100));
    case "kpi2.1":
      return Math.min(100, Math.max(0, 100 - (speedKmh / 60) * 100));
    case "kpi3.2":
      return Math.min(100, Math.max(0, congestion * 100));
    default:
      return Math.min(100, Math.max(0, congestion * 100));
  }
}

export function deriveJunctionBaselineRaw(segmentId: string, speedKmh: number, congestion: number) {
  const seed = junctionArmSeed(segmentId);
  return {
    speedKmh: speedKmh * (0.9 - seed * 0.05),
    congestion: Math.min(0.99, congestion * (1.14 + seed * 0.08)),
  };
}

export function getJunctionScenarioMetrics(
  segment: MapSegment,
  kpiId: string
): { baseline: number; intervention: number; delta: number; absDelta: number } {
  const speed = Number(segment.properties?.vitesse_km_h ?? 20);
  const congestion = Number(segment.properties?.indice_de_congestion ?? 0.2);
  const intervention = kpiValueFromTrafficRaw(speed, congestion, kpiId);
  const baseRaw = deriveJunctionBaselineRaw(segment.id, speed, congestion);
  const baseline = kpiValueFromTrafficRaw(baseRaw.speedKmh, baseRaw.congestion, kpiId);
  const delta = intervention - baseline;
  return { baseline, intervention, delta, absDelta: Math.abs(delta) };
}

/** Lower KPI intensity on the arm = improvement (safety pressure, congestion, emissions). */
export function isJunctionComparisonFavourable(delta: number, _kpiId: string): boolean {
  return delta < 0;
}

export function comparisonLineWeight(absDelta: number): number {
  return Math.max(5, Math.min(14, 5 + absDelta * 0.35));
}

export type JunctionArmRank = {
  segmentId: string;
  segmentName: string;
  delta: number;
  absDelta: number;
  favourable: boolean;
};

/** Strongest comparison Δ arms for observatory / sidebar corridor rank. */
export function rankJunctionArms(segments: MapSegment[], kpiId: string): JunctionArmRank[] {
  return segments
    .map((segment) => {
      const metrics = getJunctionScenarioMetrics(segment, kpiId);
      return {
        segmentId: segment.id,
        segmentName: String(segment.properties?.nom || segment.properties?.name || segment.id),
        delta: metrics.delta,
        absDelta: metrics.absDelta,
        favourable: isJunctionComparisonFavourable(metrics.delta, kpiId),
      };
    })
    .sort((a, b) => b.absDelta - a.absDelta);
}
