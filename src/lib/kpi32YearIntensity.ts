import type { KPIValue } from "@/data/kpiDefinitions";

/**
 * Residual emission intensity (% of baseline) from the KPI 3.2 chart time series for a given year label.
 */
export function getKpi32TimeSeriesIntensity(
  kpiValue: KPIValue | undefined,
  selectedYearLabel: string | null | undefined
): number | null {
  if (!selectedYearLabel?.trim() || !kpiValue?.timeSeries?.length) return null;
  const y = Number.parseInt(selectedYearLabel, 10);
  if (!Number.isFinite(y)) return null;
  const row = kpiValue.timeSeries.find((t) => t.year === y);
  if (row === undefined) return null;
  return Math.max(0, Math.min(120, Number(row.value)));
}

/**
 * Intensity passed into `generateEmissionZones` when no year is selected (legacy: mainValue = reduction %).
 */
export function defaultKpi32PolygonIntensity(kpiValue: KPIValue | undefined): number {
  const main = typeof kpiValue?.mainValue === "number" ? kpiValue.mainValue : Number(kpiValue?.mainValue) || 0;
  return Math.max(0, Math.min(100, 100 - main));
}

/** Intensity for emission polygons: chart year if set, else headline-based default. */
export function resolveKpi32PolygonBaseIntensity(
  kpiValue: KPIValue | undefined,
  selectedYearLabel: string | null | undefined
): number {
  const fromYear = getKpi32TimeSeriesIntensity(kpiValue, selectedYearLabel);
  if (fromYear !== null) return Math.max(0, Math.min(100, fromYear));
  return defaultKpi32PolygonIntensity(kpiValue);
}
