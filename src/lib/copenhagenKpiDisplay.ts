import type { LocalCityPoint } from "@/services/localCityData";
import {
  emptyModeTotals,
  safetyKpiFromTotals,
  toElaboratorModeShareBreakdown,
  toSafetyRadarBreakdown,
  type CopenhagenModeTotals,
} from "@/lib/copenhagenModeBreakdown";
import { areAllTravelModesSelected } from "@/lib/travelModeMapLink";

export type CopenhagenObservedKpiSlice = {
  baselineMain: number;
  interventionMain: number;
  change: number;
  breakdownBaseline: Record<string, number>;
  breakdownIntervention: Record<string, number>;
  hasSelectedRecords: boolean;
};

export function resolveCopenhagenKpiDisplayUnit(kpiId: string): string {
  switch (kpiId) {
    case "kpi1.2":
      return "%";
    case "kpi2.1":
      return "Safety index";
    case "kpi3.1":
      return "Active Facilities";
    case "kpi3.2":
      return "Intensity";
    case "kpi4.1":
      return "Satisfaction";
    case "kpi4.2":
      return "Access Score";
    default:
      return "units";
  }
}

function sumByModeSelection(
  b: { bike?: number; pedestrian?: number; motorised?: number; ptw?: number; total?: number } | undefined,
  selectedModeTypes: string[]
): number {
  const bike = Number(b?.bike ?? 0);
  const pedestrian = Number(b?.pedestrian ?? 0);
  const motorised = Number(b?.motorised ?? 0);
  const ptw = Number(b?.ptw ?? 0);
  const strictModeFilterActive =
    selectedModeTypes.length > 0 && !areAllTravelModesSelected(selectedModeTypes);
  if (!strictModeFilterActive) return bike + pedestrian;
  let selected = 0;
  if (selectedModeTypes.includes("Cycle")) selected += bike;
  if (selectedModeTypes.includes("Pedestrian")) selected += pedestrian;
  if (selectedModeTypes.includes("Private Car") || selectedModeTypes.includes("Public Transport")) {
    selected += motorised;
  }
  if (selectedModeTypes.includes("PTW")) selected += ptw;
  return selected;
}

function aggregateCategoryBreakdown(
  points: LocalCityPoint[],
  pickValue: (point: LocalCityPoint) => number
): Record<string, number> {
  const breakdown: Record<string, number> = {};
  points.forEach((point) => {
    const label = String(
      point.properties?.facilityCategory ??
        point.properties?.category ??
        point.properties?.streetName ??
        "Facility"
    );
    breakdown[label] = (breakdown[label] ?? 0) + pickValue(point);
  });
  return breakdown;
}

function aggregateScalarKpi(points: LocalCityPoint[]): CopenhagenObservedKpiSlice | null {
  let baselineSum = 0;
  let interventionSum = 0;
  let count = 0;
  points.forEach((point) => {
    const baseline = Number(point.properties?.baselineValue);
    const intervention = Number(point.properties?.interventionValue ?? point.value);
    if (!Number.isFinite(baseline) || !Number.isFinite(intervention)) return;
    baselineSum += baseline;
    interventionSum += intervention;
    count += 1;
  });
  if (!count) return null;
  return {
    baselineMain: baselineSum / count,
    interventionMain: interventionSum / count,
    change: (interventionSum - baselineSum) / count,
    breakdownBaseline: aggregateCategoryBreakdown(points, (p) =>
      Number(p.properties?.baselineValue ?? 0)
    ),
    breakdownIntervention: aggregateCategoryBreakdown(points, (p) =>
      Number(p.properties?.interventionValue ?? p.value ?? 0)
    ),
    hasSelectedRecords: true,
  };
}

export function aggregateCopenhagenObservedKpi(
  points: LocalCityPoint[],
  kpiId: string,
  selectedModeTypes: string[]
): CopenhagenObservedKpiSlice | null {
  if (!points.length) return null;

  if (kpiId === "kpi3.1" || kpiId === "kpi4.2" || kpiId === "kpi4.1") {
    return aggregateScalarKpi(points);
  }

  const pre: CopenhagenModeTotals = emptyModeTotals();
  const post: CopenhagenModeTotals = emptyModeTotals();
  let preSelected = 0;
  let postSelected = 0;

  points.forEach((point) => {
    const modeBreakdown = point.properties?.modeBreakdown as
      | {
          pre: { bike: number; pedestrian: number; motorised: number; ptw: number; total: number };
          post: { bike: number; pedestrian: number; motorised: number; ptw: number; total: number };
        }
      | undefined;
    if (!modeBreakdown) return;
    preSelected += sumByModeSelection(modeBreakdown.pre, selectedModeTypes);
    postSelected += sumByModeSelection(modeBreakdown.post, selectedModeTypes);
    pre.bike += Number(modeBreakdown.pre.bike ?? 0);
    post.bike += Number(modeBreakdown.post.bike ?? 0);
    pre.pedestrian += Number(modeBreakdown.pre.pedestrian ?? 0);
    post.pedestrian += Number(modeBreakdown.post.pedestrian ?? 0);
    pre.motorised += Number(modeBreakdown.pre.motorised ?? 0);
    post.motorised += Number(modeBreakdown.post.motorised ?? 0);
    pre.ptw += Number(modeBreakdown.pre.ptw ?? 0);
    post.ptw += Number(modeBreakdown.post.ptw ?? 0);
    pre.total += Number(modeBreakdown.pre.total ?? 0);
    post.total += Number(modeBreakdown.post.total ?? 0);
  });

  if (pre.total <= 0 && post.total <= 0) {
    return aggregateScalarKpi(points);
  }

  const { breakdownBaseline, breakdownIntervention } = toElaboratorModeShareBreakdown(pre, post);

  if (kpiId === "kpi1.2") {
    const baselineMain = pre.total > 0 ? (preSelected / pre.total) * 100 : 0;
    const interventionMain = post.total > 0 ? (postSelected / post.total) * 100 : 0;
    return {
      baselineMain,
      interventionMain,
      change: interventionMain - baselineMain,
      breakdownBaseline,
      breakdownIntervention,
      hasSelectedRecords: postSelected > 0 || preSelected > 0,
    };
  }

  if (kpiId === "kpi2.1") {
    const baselineMain = safetyKpiFromTotals(pre);
    const interventionMain = safetyKpiFromTotals(post);
    return {
      baselineMain,
      interventionMain,
      change: interventionMain - baselineMain,
      breakdownBaseline: toSafetyRadarBreakdown(pre),
      breakdownIntervention: toSafetyRadarBreakdown(post),
      hasSelectedRecords: true,
    };
  }

  return aggregateScalarKpi(points);
}
