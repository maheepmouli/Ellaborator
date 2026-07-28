import type { LocalCityPoint } from "@/services/localCityData";
import {
  emptyModeTotals,
  pct,
  safetyKpiFromTotals,
  toElaboratorModeShareBreakdown,
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
      return "Parking bays";
    case "kpi3.2":
      return "Intensity";
    case "kpi4.1":
      return "Satisfaction";
    case "kpi4.2":
      return "Parking bays";
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
  const breakdownBaseline: Record<string, number> = {};
  const breakdownIntervention: Record<string, number> = {};

  points.forEach((point) => {
    const baseline = Number(point.properties?.baselineValue);
    const intervention = Number(point.properties?.interventionValue ?? point.value);
    if (!Number.isFinite(baseline) || !Number.isFinite(intervention)) return;
    baselineSum += baseline;
    interventionSum += intervention;
    count += 1;

    const distBefore = point.properties?.surveyDistributionBefore as
      | Array<{ score: number; label: string; pct: number }>
      | undefined;
    const distAfter = point.properties?.surveyDistributionAfter as
      | Array<{ score: number; label: string; pct: number }>
      | undefined;
    if (distAfter?.length) {
      distAfter.forEach((b) => {
        const key = b.label || String(b.score);
        breakdownIntervention[key] = Number(b.pct) || 0;
      });
      (distBefore ?? []).forEach((b) => {
        const key = b.label || String(b.score);
        breakdownBaseline[key] = Number(b.pct) || 0;
      });
      return;
    }

    const label = String(
      point.properties?.facilityCategory ??
        point.properties?.category ??
        point.properties?.streetName ??
        "Facility"
    );
    breakdownBaseline[label] = (breakdownBaseline[label] ?? 0) + baseline;
    breakdownIntervention[label] = (breakdownIntervention[label] ?? 0) + intervention;
  });
  if (!count) return null;
  return {
    baselineMain: baselineSum / count,
    interventionMain: interventionSum / count,
    change: (interventionSum - baselineSum) / count,
    breakdownBaseline:
      Object.keys(breakdownBaseline).length > 0
        ? breakdownBaseline
        : aggregateCategoryBreakdown(points, (p) => Number(p.properties?.baselineValue ?? 0)),
    breakdownIntervention:
      Object.keys(breakdownIntervention).length > 0
        ? breakdownIntervention
        : aggregateCategoryBreakdown(points, (p) =>
            Number(p.properties?.interventionValue ?? p.value ?? 0)
          ),
    hasSelectedRecords: true,
  };
}

/** Bay inventory KPIs — headline = total bays, chart = type totals (not per-segment mean). */
function aggregateBayInventoryKpi(points: LocalCityPoint[]): CopenhagenObservedKpiSlice | null {
  let baselineSum = 0;
  let interventionSum = 0;
  let count = 0;
  const breakdownBaseline: Record<string, number> = {};
  const breakdownIntervention: Record<string, number> = {};

  points.forEach((point) => {
    const baseline = Number(point.properties?.baselineValue);
    const intervention = Number(point.properties?.interventionValue ?? point.value);
    if (!Number.isFinite(baseline) || !Number.isFinite(intervention)) return;
    if (intervention <= 0 && baseline <= 0) return;
    baselineSum += baseline;
    interventionSum += intervention;
    count += 1;
    const label = String(
      point.properties?.facilityCategory ??
        point.properties?.category ??
        point.properties?.streetName ??
        "Facility"
    );
    breakdownBaseline[label] = (breakdownBaseline[label] ?? 0) + baseline;
    breakdownIntervention[label] = (breakdownIntervention[label] ?? 0) + intervention;
  });
  if (!count) return null;
  return {
    baselineMain: baselineSum,
    interventionMain: interventionSum,
    change: interventionSum - baselineSum,
    breakdownBaseline,
    breakdownIntervention,
    hasSelectedRecords: true,
  };
}

function modePartsTotal(b: {
  bike?: number;
  pedestrian?: number;
  motorised?: number;
  ptw?: number;
  total?: number;
}): number {
  const parts =
    Number(b?.bike ?? 0) +
    Number(b?.pedestrian ?? 0) +
    Number(b?.motorised ?? 0) +
    Number(b?.ptw ?? 0);
  const reported = Number(b?.total ?? 0);
  // Prefer reconstructed sum so inconsistent stored totals cannot push share > 100%.
  return parts > 0 ? parts : reported;
}

function sustainableSharePct(
  b: {
    bike?: number;
    pedestrian?: number;
    motorised?: number;
    ptw?: number;
    total?: number;
  },
  selectedModeTypes: string[]
): number {
  const denom = modePartsTotal(b);
  if (denom <= 0) return 0;
  const share = (sumByModeSelection(b, selectedModeTypes) / denom) * 100;
  return Math.max(0, Math.min(100, share));
}

/** KPI 1.2 headline must use OTC directional counts only — not Telraam/% proxy rows. */
function isOtcDirectionalPoint(point: LocalCityPoint): boolean {
  const kind = String(point.properties?.datasetKind ?? "");
  if (kind && kind !== "otc") return false;
  return Boolean(point.properties?.modeBreakdown);
}

export function aggregateCopenhagenObservedKpi(
  points: LocalCityPoint[],
  kpiId: string,
  selectedModeTypes: string[]
): CopenhagenObservedKpiSlice | null {
  if (!points.length) return null;

  if (kpiId === "kpi3.1") {
    // Sticky #31: bay-type chart from parking inventory only (exclude tube corridors).
    const parking = points.filter((p) => p.properties?.datasetKind === "parking");
    return aggregateBayInventoryKpi(parking.length ? parking : points);
  }

  if (kpiId === "kpi4.2") {
    // WGS84 bay segments tagged accessibility — category before/after from I100275.
    const accessibility = points.filter(
      (p) =>
        p.properties?.datasetKind === "accessibility" &&
        String(p.properties?.category ?? "") !== "Pilot summary"
    );
    return aggregateBayInventoryKpi(accessibility.length ? accessibility : points);
  }

  if (kpiId === "kpi4.1") {
    const surveys = points.filter((p) => p.properties?.datasetKind === "survey");
    return aggregateScalarKpi(surveys.length ? surveys : points);
  }

  const modePoints =
    kpiId === "kpi1.2" ? points.filter(isOtcDirectionalPoint) : points;
  if (kpiId === "kpi1.2" && !modePoints.length) {
    return null;
  }

  const pre: CopenhagenModeTotals = emptyModeTotals();
  const post: CopenhagenModeTotals = emptyModeTotals();

  modePoints.forEach((point) => {
    const modeBreakdown = point.properties?.modeBreakdown as
      | {
          pre: { bike: number; pedestrian: number; motorised: number; ptw: number; total: number };
          post: { bike: number; pedestrian: number; motorised: number; ptw: number; total: number };
        }
      | undefined;
    if (!modeBreakdown) return;
    pre.bike += Number(modeBreakdown.pre.bike ?? 0);
    post.bike += Number(modeBreakdown.post.bike ?? 0);
    pre.pedestrian += Number(modeBreakdown.pre.pedestrian ?? 0);
    post.pedestrian += Number(modeBreakdown.post.pedestrian ?? 0);
    pre.motorised += Number(modeBreakdown.pre.motorised ?? 0);
    post.motorised += Number(modeBreakdown.post.motorised ?? 0);
    pre.ptw += Number(modeBreakdown.pre.ptw ?? 0);
    post.ptw += Number(modeBreakdown.post.ptw ?? 0);
  });
  pre.total = pre.bike + pre.pedestrian + pre.motorised + pre.ptw;
  post.total = post.bike + post.pedestrian + post.motorised + post.ptw;

  if (pre.total <= 0 && post.total <= 0) {
    return aggregateScalarKpi(points);
  }

  const { breakdownBaseline, breakdownIntervention } = toElaboratorModeShareBreakdown(pre, post);

  if (kpiId === "kpi1.2") {
    const baselineMain = sustainableSharePct(pre, selectedModeTypes);
    const interventionMain = sustainableSharePct(post, selectedModeTypes);
    return {
      baselineMain,
      interventionMain,
      change: interventionMain - baselineMain,
      breakdownBaseline,
      breakdownIntervention,
      hasSelectedRecords: pre.total > 0 || post.total > 0,
    };
  }

  if (kpiId === "kpi2.1") {
    const baselineMain = safetyKpiFromTotals(pre);
    const interventionMain = safetyKpiFromTotals(post);
    // Mode-share before/after (+ derived speed from motor mix) — not the old radar axes.
    const motorSharePre = pct(pre.motorised + pre.ptw, Math.max(1, pre.total));
    const motorSharePost = pct(post.motorised + post.ptw, Math.max(1, post.total));
    const speedBefore = Math.max(12, 32 - motorSharePre * 0.12);
    const speedAfter = Math.max(12, 32 - motorSharePost * 0.12);
    return {
      baselineMain,
      interventionMain,
      change: interventionMain - baselineMain,
      breakdownBaseline: {
        ...breakdownBaseline,
        "Avg speed (km/h)": speedBefore,
      },
      breakdownIntervention: {
        ...breakdownIntervention,
        "Avg speed (km/h)": speedAfter,
      },
      hasSelectedRecords: true,
    };
  }

  return aggregateScalarKpi(points);
}
