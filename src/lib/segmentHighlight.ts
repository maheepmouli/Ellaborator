/**
 * Segment line colours — shared by HeroMap and map legend (SEGMENT_PRESSURE / CLIMATE items).
 */

export type SegmentMetricKind = "safety" | "climate";

export interface SegmentHighlightStyle {
  band: string;
  color: string;
  weight: number;
  opacity: number;
}

export function segmentMetricKindForKpi(kpiId: string): SegmentMetricKind {
  return kpiId === "kpi3.2" ? "climate" : "safety";
}

export function getQuantile(values: number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

export function getSegmentHighlight(
  value: number,
  lowThreshold: number,
  highThreshold: number,
  metric: SegmentMetricKind = "safety"
): SegmentHighlightStyle {
  if (metric === "climate") {
    if (value >= highThreshold) {
      return { band: "Higher pressure", color: "#F97316", weight: 6.2, opacity: 0.92 };
    }
    if (value <= lowThreshold) {
      return { band: "Lower pressure", color: "#22C55E", weight: 5.6, opacity: 0.88 };
    }
    return { band: "Medium", color: "#FBBF24", weight: 4.2, opacity: 0.55 };
  }
  if (value >= highThreshold) {
    return { band: "High", color: "#F97316", weight: 6.4, opacity: 0.95 };
  }
  if (value <= lowThreshold) {
    return { band: "Low", color: "#22C55E", weight: 5.8, opacity: 0.9 };
  }
  return { band: "Mid", color: "#7B8AB8", weight: 3.2, opacity: 0.35 };
}

/** Junction study: keep all four arms readable on the map. */
export function applyJunctionHighlightVisibility(style: SegmentHighlightStyle): SegmentHighlightStyle {
  return {
    ...style,
    weight: Math.max(style.weight, 5.5),
    opacity: Math.max(style.opacity, 0.88),
  };
}

export function markerRadiusForJunctionValue(value: number, low: number, high: number): number {
  if (high <= low) return 11;
  const t = Math.min(1, Math.max(0, (value - low) / (high - low)));
  return 9 + t * 9;
}
