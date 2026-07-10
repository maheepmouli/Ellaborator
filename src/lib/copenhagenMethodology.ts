import type { TrafficDirection, CopenhagenEvaluationRules } from "@/data/copenhagenLocationRegistry";
import {
  getMethodologyConstraint,
  getOtcEvaluationRulesForWorkbook,
  type MethodologyConstraint,
} from "@/data/copenhagenLocationRegistry";

export interface CphModeAgg {
  flow: string;
  total: number;
  bike: number;
  pedestrian: number;
  motorized: number;
  ptw: number;
}

export function inferTrafficDirectionFromFlow(flow: string): TrafficDirection | null {
  const f = flow.toLowerCase();
  if (f.includes("towards stormgade") || f.includes("mod stormgade")) {
    return "towards_stormgade";
  }
  if (f.includes("towards vandkunsten") || f.includes("mod vandkunsten")) {
    return "towards_vandkunsten";
  }
  if (f.includes("towards str") || f.includes("mod str")) {
    return "towards_strøget";
  }
  if (f.includes("towards norreport") || f.includes("mod nørreport")) {
    return "towards_norreport";
  }
  if (f.includes("north") || f.includes("nord")) return "north";
  if (f.includes("south") || f.includes("syd")) return "south";
  if (f.includes("east") || f.includes("øst") || f.includes("ost")) return "east";
  if (f.includes("west") || f.includes("vest")) return "west";
  return null;
}

function isPedestrianClassification(classification: string): boolean {
  return classification.toLowerCase().includes("pedestrian");
}

function isBicycleClassification(classification: string): boolean {
  const cls = classification.toLowerCase();
  return cls.includes("bicycl") || cls.includes("cargo_bike");
}

export function shouldExcludeCphClassification(
  rule: MethodologyConstraint,
  direction: TrafficDirection | null,
  classification: string
): boolean {
  const isPed = isPedestrianClassification(classification);
  const isBike = isBicycleClassification(classification);

  if (rule.excludePedestrians && isPed) return true;
  if (rule.excludeBicycles && isBike) return true;

  if (rule.directionalExclusions?.length && direction) {
    const block = rule.directionalExclusions.find((entry) => entry.direction === direction);
    if (block) {
      if (isPed && block.modes.includes("pedestrian")) return true;
      if (isBike && block.modes.includes("bicycle")) return true;
    }
  }

  return false;
}

/** Zero excluded modes and recompute total after row-level filtering. */
export function applyMethodologyToAgg(
  agg: CphModeAgg,
  rule: MethodologyConstraint
): CphModeAgg {
  const direction = inferTrafficDirectionFromFlow(agg.flow);
  let { bike, pedestrian, motorized, ptw, total } = agg;

  if (rule.excludePedestrians) {
    total -= pedestrian;
    pedestrian = 0;
  }
  if (rule.excludeBicycles) {
    total -= bike;
    bike = 0;
  }

  if (rule.directionalExclusions?.length && direction) {
    const block = rule.directionalExclusions.find((entry) => entry.direction === direction);
    if (block) {
      if (block.modes.includes("pedestrian")) {
        total -= pedestrian;
        pedestrian = 0;
      }
      if (block.modes.includes("bicycle")) {
        total -= bike;
        bike = 0;
      }
    }
  }

  return {
    ...agg,
    bike,
    pedestrian,
    motorized,
    ptw,
    total: Math.max(0, total),
  };
}

export function getMethodologyConstraintForWorkbook(
  workbookKey: string | null
): MethodologyConstraint | undefined {
  if (!workbookKey) return undefined;
  return getMethodologyConstraint(workbookKey);
}

export function parseCphOccurrenceDate(row: Record<string, unknown>): Date | null {
  const raw =
    row["start occurrence date"] ??
    row["start occurrence time"] ??
    row["start time"] ??
    row["end occurrence date"];
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw;
  const text = String(raw ?? "").trim();
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Partner evaluation windows exclude Fridays (Maria Risom weekday sample). */
export function shouldExcludeCphRowByEvaluationRules(
  row: Record<string, unknown>,
  rules?: CopenhagenEvaluationRules
): boolean {
  if (!rules?.excludeFridays) return false;
  const date = parseCphOccurrenceDate(row);
  if (!date) return false;
  return date.getDay() === 5;
}

export const CPH_REFERENCE_WEEKDAYS = 5;

export interface CphNormalizationMeta {
  normalizationMethod: "weekday-equivalent-scaling";
  referenceWeekdays: number;
  weekdaysObservedPre: number;
  weekdaysObservedPost: number;
  preScaleFactor: number;
  postScaleFactor: number;
}

function parseCount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(",", ".").trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/** Sum 15-min OTC rows by flow (raw totals). */
export function aggregateCphRowsByFlow(
  rows: Record<string, unknown>[],
  workbookKey: string | null
): Map<string, CphModeAgg> {
  const rule = getMethodologyConstraintForWorkbook(workbookKey);
  const evaluationRules = workbookKey
    ? getOtcEvaluationRulesForWorkbook(workbookKey)
    : undefined;

  const byFlow = new Map<string, CphModeAgg>();
  rows.forEach((row) => {
    if (shouldExcludeCphRowByEvaluationRules(row, evaluationRules)) return;
    const cls = String(row.classification || "").toLowerCase();
    const flow = String(row.flow || "").trim();
    if (!flow) return;
    if (
      rule &&
      shouldExcludeCphClassification(rule, inferTrafficDirectionFromFlow(flow), cls)
    ) {
      return;
    }
    const count = parseCount(row.count);
    if (!count) return;
    const agg =
      byFlow.get(flow) ?? {
        flow,
        total: 0,
        bike: 0,
        pedestrian: 0,
        motorized: 0,
        ptw: 0,
      };
    agg.total += count;
    if (cls.includes("bicycl") || cls.includes("cargo_bike")) agg.bike += count;
    else if (cls.includes("pedestrian")) agg.pedestrian += count;
    else if (cls.includes("motorcycl") || cls.includes("scooter")) agg.ptw += count;
    else if (
      cls.includes("car") ||
      cls.includes("bus") ||
      cls.includes("truck") ||
      cls.includes("van") ||
      cls.includes("train")
    ) {
      agg.motorized += count;
    }
    byFlow.set(flow, agg);
  });
  return byFlow;
}

export function countDistinctCphObservationDays(
  rows: Record<string, unknown>[],
  workbookKey: string | null
): number {
  const evaluationRules = workbookKey
    ? getOtcEvaluationRulesForWorkbook(workbookKey)
    : undefined;
  const dates = new Set<string>();
  for (const row of rows) {
    if (shouldExcludeCphRowByEvaluationRules(row, evaluationRules)) continue;
    const date = parseCphOccurrenceDate(row);
    if (!date) continue;
    dates.add(date.toISOString().slice(0, 10));
  }
  return Math.max(1, dates.size);
}

export function scaleCphModeAgg(agg: CphModeAgg, factor: number): CphModeAgg {
  if (factor === 1) return { ...agg };
  return {
    ...agg,
    bike: agg.bike * factor,
    pedestrian: agg.pedestrian * factor,
    motorized: agg.motorized * factor,
    ptw: agg.ptw * factor,
    total: agg.total * factor,
  };
}

export function normalizeCphPrePost(
  preRows: Record<string, unknown>[],
  postRows: Record<string, unknown>[],
  workbookKey: string | null,
  referenceWeekdays = CPH_REFERENCE_WEEKDAYS
): {
  preRaw: Map<string, CphModeAgg>;
  postRaw: Map<string, CphModeAgg>;
  preNormalized: Map<string, CphModeAgg>;
  postNormalized: Map<string, CphModeAgg>;
  meta: CphNormalizationMeta;
} {
  const preRaw = aggregateCphRowsByFlow(preRows, workbookKey);
  const postRaw = aggregateCphRowsByFlow(postRows, workbookKey);
  const weekdaysObservedPre = countDistinctCphObservationDays(preRows, workbookKey);
  const weekdaysObservedPost = countDistinctCphObservationDays(postRows, workbookKey);
  const preScaleFactor = referenceWeekdays / weekdaysObservedPre;
  const postScaleFactor = referenceWeekdays / weekdaysObservedPost;

  const preNormalized = new Map<string, CphModeAgg>();
  const postNormalized = new Map<string, CphModeAgg>();
  const flows = new Set([...preRaw.keys(), ...postRaw.keys()]);
  for (const flow of flows) {
    const pre = preRaw.get(flow) ?? {
      flow,
      total: 0,
      bike: 0,
      pedestrian: 0,
      motorized: 0,
      ptw: 0,
    };
    const post = postRaw.get(flow) ?? {
      flow,
      total: 0,
      bike: 0,
      pedestrian: 0,
      motorized: 0,
      ptw: 0,
    };
    preNormalized.set(flow, scaleCphModeAgg(pre, preScaleFactor));
    postNormalized.set(flow, scaleCphModeAgg(post, postScaleFactor));
  }

  return {
    preRaw,
    postRaw,
    preNormalized,
    postNormalized,
    meta: {
      normalizationMethod: "weekday-equivalent-scaling",
      referenceWeekdays,
      weekdaysObservedPre,
      weekdaysObservedPost,
      preScaleFactor,
      postScaleFactor,
    },
  };
}
