import { kpiTimeSeriesPeriodKey, type KPIValue } from "@/data/kpiDefinitions";

function clampIntensity(value: number): number {
  return Math.max(0, Math.min(120, value));
}

/**
 * Residual emission intensity (% of baseline) from the KPI 3.2 chart time series
 * for a selected period key (label or year string).
 */
export function getKpi32TimeSeriesIntensity(
  kpiValue: KPIValue | undefined,
  selectedYearLabel: string | null | undefined
): number | null {
  if (!selectedYearLabel?.trim() || !kpiValue?.timeSeries?.length) return null;
  const key = selectedYearLabel.trim();
  const byPeriod = kpiValue.timeSeries.find((t) => kpiTimeSeriesPeriodKey(t) === key);
  if (byPeriod !== undefined) return clampIntensity(Number(byPeriod.value));

  const y = Number.parseInt(key, 10);
  if (Number.isFinite(y)) {
    const row = kpiValue.timeSeries.find((t) => t.year === y);
    if (row !== undefined) return clampIntensity(Number(row.value));
  }
  return null;
}

/** Earliest time-series intensity — city baseline residual pressure (typically ~100). */
export function getKpi32BaselineIntensity(kpiValue: KPIValue | undefined): number | null {
  if (!kpiValue?.timeSeries?.length) return null;
  const sorted = [...kpiValue.timeSeries].sort((a, b) => a.year - b.year);
  const row = sorted[0];
  if (row === undefined) return null;
  return clampIntensity(Number(row.value));
}

/**
 * Intensity passed into `generateEmissionZones` when no year is selected (legacy: mainValue = reduction %).
 */
export function defaultKpi32PolygonIntensity(kpiValue: KPIValue | undefined): number {
  const main = typeof kpiValue?.mainValue === "number" ? kpiValue.mainValue : Number(kpiValue?.mainValue) || 0;
  return Math.max(0, Math.min(100, 100 - main));
}

/** Intensity for emission polygons: chart period if set, else headline-based default. */
export function resolveKpi32PolygonBaseIntensity(
  kpiValue: KPIValue | undefined,
  selectedYearLabel: string | null | undefined
): number {
  const fromYear = getKpi32TimeSeriesIntensity(kpiValue, selectedYearLabel);
  if (fromYear !== null) return Math.max(0, Math.min(100, fromYear));
  return defaultKpi32PolygonIntensity(kpiValue);
}

/**
 * Baseline vs intervention residual intensities for KPI 3.2 map colouring.
 * Baseline = earliest series period (or 100); intervention = selected period / headline.
 */
export function resolveKpi32ScenarioIntensities(
  kpiValue: KPIValue | undefined,
  selectedYearLabel: string | null | undefined
): { baseline: number; intervention: number } {
  const seriesBaseline = getKpi32BaselineIntensity(kpiValue);
  const yearOrDefault = resolveKpi32PolygonBaseIntensity(kpiValue, selectedYearLabel);
  const baseline = Math.max(0, Math.min(100, seriesBaseline ?? 100));
  const intervention = Math.max(0, Math.min(100, yearOrDefault));
  return { baseline, intervention };
}
