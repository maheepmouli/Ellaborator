import type { KPIValue } from "@/data/kpiDefinitions";

/** Headline metric before the coded change (card uses intervention as stored mainValue). */
export function computeBaselineMainValue(kpiValue: KPIValue): number {
  return Math.max(0, Number(kpiValue.mainValue) - kpiValue.change);
}

/** Derive mode-share style baseline breakdown from intervention snapshot + headline change. */
export function computeBaselineBreakdown(
  breakdown: Record<string, number> | undefined,
  change: number
): Record<string, number> | undefined {
  if (!breakdown) return undefined;
  const baselineBreakdown: Record<string, number> = {};
  const sustainableModes = ["Pedestrian", "Cycle", "Public Transport"];
  const nonSustainableModes = ["Private Car", "PTW"];

  Object.keys(breakdown).forEach((mode) => {
    const interventionValue = breakdown[mode];
    if (sustainableModes.includes(mode)) {
      const totalSustainable = sustainableModes.reduce((sum, m) => sum + (breakdown[m] || 0), 0);
      if (totalSustainable > 0) {
        const proportion = interventionValue / totalSustainable;
        const baselineSustainableTotal = Math.max(0, totalSustainable - change);
        baselineBreakdown[mode] = Math.max(0, baselineSustainableTotal * proportion);
      } else {
        baselineBreakdown[mode] = 0;
      }
    } else if (nonSustainableModes.includes(mode)) {
      const totalNonSustainable = nonSustainableModes.reduce((sum, m) => sum + (breakdown[m] || 0), 0);
      if (totalNonSustainable > 0) {
        const proportion = interventionValue / totalNonSustainable;
        const baselineNonSustainableTotal = totalNonSustainable + change;
        baselineBreakdown[mode] = Math.max(0, baselineNonSustainableTotal * proportion);
      } else {
        baselineBreakdown[mode] = interventionValue;
      }
    } else {
      baselineBreakdown[mode] = interventionValue;
    }
  });

  return baselineBreakdown;
}

export function baselineKpiSlice(kpiValue: KPIValue): KPIValue {
  return {
    ...kpiValue,
    mainValue: computeBaselineMainValue(kpiValue),
    breakdown: computeBaselineBreakdown(kpiValue.breakdown, kpiValue.change),
  };
}

export function interventionKpiSlice(kpiValue: KPIValue): KPIValue {
  return {
    ...kpiValue,
    mainValue: Number(kpiValue.mainValue),
    breakdown: kpiValue.breakdown,
  };
}
