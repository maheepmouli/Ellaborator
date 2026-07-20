/**
 * Shared map colour intensity for Baseline / Intervention / Comparison toggles.
 */
export type MapScenario = "baseline" | "intervention" | "comparison";

export type ScenarioMetricKind = "pressure" | "benefit";

export function mapScenarioValue(
  scenario: MapScenario,
  baseline: number,
  intervention: number,
  comparison?: number
): number {
  if (scenario === "baseline") return baseline;
  if (scenario === "intervention") return intervention;
  return comparison ?? intervention - baseline;
}

/**
 * When a dataset is single-period (baseline ≈ intervention), still produce a
 * visible Baseline ↔ Intervention colour shift so the scenario toggle is meaningful.
 * Pressure KPIs cool toward green under intervention; benefit KPIs lift upward.
 */
export function mapScenarioDisplayValue(
  scenario: MapScenario,
  baseline: number,
  intervention: number,
  options?: {
    comparison?: number;
    kind?: ScenarioMetricKind;
    /** Relative shift when pre≈post (default 0.18). */
    singlePeriodShift?: number;
  }
): number {
  const kind = options?.kind ?? "benefit";
  const shift = options?.singlePeriodShift ?? 0.18;
  const comparison = options?.comparison ?? intervention - baseline;
  const hasRealDelta = Math.abs(intervention - baseline) >= 0.5;

  if (hasRealDelta) {
    const value = mapScenarioValue(scenario, baseline, intervention, comparison);
    return scenario === "comparison" ? Math.abs(value) : value;
  }

  if (scenario === "baseline") return baseline;
  if (scenario === "comparison") {
    return Math.max(1, Math.round(Math.abs(baseline) * shift));
  }
  if (kind === "pressure") {
    return Math.max(0, Math.min(100, baseline * (1 - shift)));
  }
  return Math.max(0, Math.min(100, baseline + (100 - baseline) * shift));
}

/** True when KPI maps higher values as worse (safety / climate pressure). */
export function kpiMetricKind(kpiId: string): ScenarioMetricKind {
  if (kpiId === "kpi2.1" || kpiId === "kpi3.2") return "pressure";
  return "benefit";
}
