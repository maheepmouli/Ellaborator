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
  return (part / total) * 100;
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
  const total = t.bike + t.pedestrian + t.motorised + t.ptw + t.pt;
  return { ...t, total: Math.max(total, 1) };
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
  const selected = sumByMilanModeSelection(agg, selectedModeTypes);
  return pct(selected, agg.total);
}

export function toMilanElaboratorBreakdown(
  pre: MilanModeTotals,
  post: MilanModeTotals
): {
  breakdownBaseline: Record<string, number>;
  breakdownIntervention: Record<string, number>;
} {
  return {
    breakdownBaseline: {
      Pedestrian: pct(pre.pedestrian, pre.total),
      Cycle: pct(pre.bike, pre.total),
      "Public Transport": pct(pre.pt, pre.total),
      "Private Car": pct(pre.motorised, pre.total),
      PTW: pct(pre.ptw, pre.total),
    },
    breakdownIntervention: {
      Pedestrian: pct(post.pedestrian, post.total),
      Cycle: pct(post.bike, post.total),
      "Public Transport": pct(post.pt, post.total),
      "Private Car": pct(post.motorised, post.total),
      PTW: pct(post.ptw, post.total),
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
