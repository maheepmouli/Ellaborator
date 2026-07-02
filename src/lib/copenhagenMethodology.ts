import type { TrafficDirection, CopenhagenEvaluationRules } from "@/data/copenhagenLocationRegistry";
import {
  getMethodologyConstraint,
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
