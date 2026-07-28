import { areAllTravelModesSelected } from "@/lib/travelModeMapLink";
import type { LocalCityPoint } from "@/services/localCityData";

/** AMAT peak-hour mode totals (Copenhagen-compatible shape + explicit PT from buses). */
export type MilanModeTotals = {
  bike: number;
  pedestrian: number;
  motorised: number;
  ptw: number;
  pt: number;
  total: number;
};

export type MilanModeBreakdownPair = {
  pre: MilanModeTotals;
  post: MilanModeTotals;
};

export function emptyMilanModeTotals(): MilanModeTotals {
  return { bike: 0, pedestrian: 0, motorised: 0, ptw: 0, pt: 0, total: 0 };
}

export function pct(part: number, total: number): number {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.max(0, Math.min(100, (part / total) * 100));
}

export function sumMilanModeTotals(a: MilanModeTotals, b: MilanModeTotals): MilanModeTotals {
  return {
    bike: a.bike + b.bike,
    pedestrian: a.pedestrian + b.pedestrian,
    motorised: a.motorised + b.motorised,
    ptw: a.ptw + b.ptw,
    pt: a.pt + b.pt,
    total: a.total + b.total,
  };
}

export function finalizeMilanModeTotals(t: MilanModeTotals): MilanModeTotals {
  const parts = t.bike + t.pedestrian + t.motorised + t.ptw + t.pt;
  // Prefer reconstructed sum so inconsistent stored totals cannot push share > 100%.
  return { ...t, total: Math.max(parts > 0 ? parts : t.total, 1) };
}

export function sumByMilanModeSelection(
  agg: MilanModeTotals,
  selectedModeTypes: string[]
): number {
  const strictModeFilterActive =
    selectedModeTypes.length > 0 && !areAllTravelModesSelected(selectedModeTypes);
  if (!strictModeFilterActive) return agg.bike + agg.pedestrian;

  let selected = 0;
  if (selectedModeTypes.includes("Cycle")) selected += agg.bike;
  if (selectedModeTypes.includes("Pedestrian")) selected += agg.pedestrian;
  if (selectedModeTypes.includes("Private Car")) selected += agg.motorised;
  if (selectedModeTypes.includes("Public Transport")) selected += agg.pt;
  if (selectedModeTypes.includes("PTW")) selected += agg.ptw;
  return selected;
}

export function milanModeSharePct(agg: MilanModeTotals, selectedModeTypes: string[]): number {
  const finalized = finalizeMilanModeTotals(agg);
  const selected = sumByMilanModeSelection(finalized, selectedModeTypes);
  return pct(selected, finalized.total);
}

export function toMilanElaboratorBreakdown(
  pre: MilanModeTotals,
  post: MilanModeTotals
): {
  breakdownBaseline: Record<string, number>;
  breakdownIntervention: Record<string, number>;
} {
  const preF = finalizeMilanModeTotals(pre);
  const postF = finalizeMilanModeTotals(post);
  return {
    breakdownBaseline: {
      Pedestrian: pct(preF.pedestrian, preF.total),
      Cycle: pct(preF.bike, preF.total),
      "Public Transport": pct(preF.pt, preF.total),
      "Private Car": pct(preF.motorised, preF.total),
      PTW: pct(preF.ptw, preF.total),
    },
    breakdownIntervention: {
      Pedestrian: pct(postF.pedestrian, postF.total),
      Cycle: pct(postF.bike, postF.total),
      "Public Transport": pct(postF.pt, postF.total),
      "Private Car": pct(postF.motorised, postF.total),
      PTW: pct(postF.ptw, postF.total),
    },
  };
}

export function milanPointModeBreakdown(
  properties: Record<string, unknown> | undefined
): MilanModeBreakdownPair | null {
  const mb = properties?.modeBreakdown as MilanModeBreakdownPair | undefined;
  if (!mb?.pre || !mb?.post) return null;
  return mb;
}

export function milanPointShareForScenario(
  properties: Record<string, unknown> | undefined,
  scenario: "baseline" | "intervention" | "comparison",
  selectedModeTypes: string[]
): number {
  const mb = milanPointModeBreakdown(properties);
  if (!mb) return Number(properties?.interventionValue ?? properties?.value ?? 0);
  if (scenario === "baseline") return milanModeSharePct(mb.pre, selectedModeTypes);
  if (scenario === "comparison") {
    return (
      milanModeSharePct(mb.post, selectedModeTypes) -
      milanModeSharePct(mb.pre, selectedModeTypes)
    );
  }
  return milanModeSharePct(mb.post, selectedModeTypes);
}

export function buildMilanKpi12MapPoints(
  points: LocalCityPoint[],
  scenario: "baseline" | "intervention" | "comparison",
  selectedModeTypes: string[],
  filterRange: [number, number]
): LocalCityPoint[] {
  const strictModeFilterActive =
    selectedModeTypes.length > 0 && !areAllTravelModesSelected(selectedModeTypes);

  return points
    .filter((point) => {
      if (!strictModeFilterActive) return true;
      const mb = milanPointModeBreakdown(point.properties);
      if (!mb) return true;
      return (
        sumByMilanModeSelection(mb.pre, selectedModeTypes) > 0 ||
        sumByMilanModeSelection(mb.post, selectedModeTypes) > 0
      );
    })
    .map((point) => {
      const baselineValue = milanPointShareForScenario(point.properties, "baseline", selectedModeTypes);
      const interventionValue = milanPointShareForScenario(
        point.properties,
        "intervention",
        selectedModeTypes
      );
      const comparisonValue = milanPointShareForScenario(
        point.properties,
        "comparison",
        selectedModeTypes
      );
      const renderValue =
        scenario === "baseline"
          ? baselineValue
          : scenario === "comparison"
            ? comparisonValue
            : interventionValue;
      return {
        ...point,
        value: renderValue,
        properties: {
          ...point.properties,
          baselineValue,
          interventionValue,
          comparisonValue,
        },
      };
    })
    .filter((point) => point.value >= filterRange[0] && point.value <= filterRange[1]);
}
