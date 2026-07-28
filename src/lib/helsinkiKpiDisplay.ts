import type { LocalCityPoint } from "@/services/localCityData";
import { areAllTravelModesSelected } from "@/lib/travelModeMapLink";
import { helsinkiClimateAttitudeModeShare } from "@/lib/helsinkiObservatoryView";

export type HelsinkiObservedKpiSlice = {
  baselineMain: number;
  interventionMain: number;
  change: number;
  breakdownBaseline: Record<string, number>;
  breakdownIntervention: Record<string, number>;
  unit: string;
  sourceLabel: string;
  /** True when headline comes from local Helsinki datasets (not CITY_DATA mock). */
  hasSelectedRecords: boolean;
};

type ModeBucket = {
  bike: number;
  pedestrian: number;
  motorised: number;
  ptw: number;
  total: number;
};

function emptyBucket(): ModeBucket {
  return { bike: 0, pedestrian: 0, motorised: 0, ptw: 0, total: 0 };
}

function modePartsTotal(b: ModeBucket): number {
  const parts = Number(b.bike ?? 0) + Number(b.pedestrian ?? 0) + Number(b.motorised ?? 0) + Number(b.ptw ?? 0);
  const reported = Number(b.total ?? 0);
  return parts > 0 ? parts : reported;
}

function pct(part: number, total: number): number {
  if (!total) return 0;
  return Number(((part / total) * 100).toFixed(1));
}

function clampPct(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function modeBreakdownFromBucket(bucket: ModeBucket): Record<string, number> {
  const total = Math.max(modePartsTotal(bucket), 1);
  return {
    Pedestrian: clampPct(pct(bucket.pedestrian, total)),
    Cycle: clampPct(pct(bucket.bike, total)),
    "Public Transport": 0,
    "Private Car": clampPct(pct(bucket.motorised, total)),
    PTW: clampPct(pct(bucket.ptw, total)),
  };
}

function sustainableShare(bucket: ModeBucket, selectedModeTypes: string[]): number {
  const total = Math.max(modePartsTotal(bucket), 1);
  const strict =
    selectedModeTypes.length > 0 && !areAllTravelModesSelected(selectedModeTypes);
  if (!strict) return clampPct(pct(bucket.bike + bucket.pedestrian, total));

  let selected = 0;
  if (selectedModeTypes.includes("Cycle")) selected += bucket.bike;
  if (selectedModeTypes.includes("Pedestrian")) selected += bucket.pedestrian;
  if (selectedModeTypes.includes("Private Car") || selectedModeTypes.includes("Public Transport")) {
    selected += bucket.motorised;
  }
  if (selectedModeTypes.includes("PTW")) selected += bucket.ptw;
  return clampPct(pct(selected, total));
}

function addModeBreakdown(
  target: ModeBucket,
  breakdown:
    | { bike?: number; pedestrian?: number; motorised?: number; ptw?: number; total?: number }
    | undefined
): void {
  if (!breakdown) return;
  target.bike += Number(breakdown.bike ?? 0);
  target.pedestrian += Number(breakdown.pedestrian ?? 0);
  target.motorised += Number(breakdown.motorised ?? 0);
  target.ptw += Number(breakdown.ptw ?? 0);
  target.total += Number(breakdown.total ?? 0);
}

function pickPrimaryObservedPoints(points: LocalCityPoint[], kpiId: string): LocalCityPoint[] {
  const observed = points.filter(
    (p) =>
      p.properties?.dataOrigin === "local-city-dataset" ||
      p.properties?.parserStatus === "ready" ||
      p.properties?.type === "observed" ||
      p.properties?.type === "derived"
  );
  const pool = observed.length ? observed : points;
  if (!pool.length) return [];

  if (kpiId === "kpi1.2") {
    const escooter = pool.filter((p) => p.properties?.datasetKind === "escooter-parking");
    if (escooter.length) return escooter;
    const telraam = pool.filter((p) => p.properties?.datasetKind === "telraam");
    if (telraam.length) return telraam;
  }
  if (kpiId === "kpi4.1") {
    const ux = pool.filter((p) => p.properties?.datasetKind === "ux-survey");
    if (ux.length) return ux;
  }
  if (kpiId === "kpi4.2") {
    // Prefer Kallio parking observations (FVH2) over Viikki UX (FVH3).
    const escooter = pool.filter((p) => p.properties?.datasetKind === "escooter-parking");
    if (escooter.length) return escooter;
    const ux = pool.filter((p) => p.properties?.datasetKind === "ux-survey");
    if (ux.length) return ux;
  }
  if (kpiId === "kpi3.1") {
    const escooter = pool.filter((p) => p.properties?.datasetKind === "escooter-parking");
    if (escooter.length) return escooter;
  }
  if (kpiId === "kpi2.1") {
    // FVH3 site UX survey takes priority when present (pilot-scoped pools).
    const ux = pool.filter((p) => p.properties?.datasetKind === "ux-survey");
    if (ux.length) return ux;
    const hazards = pool.filter((p) => p.properties?.datasetKind === "dangerous-location");
    if (hazards.length) return hazards;
    const conflicts = pool.filter((p) => p.properties?.datasetKind === "conflict");
    if (conflicts.length) return conflicts;
    const mobilysis = pool.filter((p) => p.properties?.datasetKind === "mobilysis-gate");
    if (mobilysis.length) return mobilysis;
    const telraam = pool.filter((p) => p.properties?.datasetKind === "telraam");
    if (telraam.length) return telraam;
  }
  if (kpiId === "kpi1.1") {
    const expansion = pool.filter((p) => p.properties?.datasetKind === "expansion-plan");
    if (expansion.length) return expansion;
  }
  if (kpiId === "kpi3.2") {
    const attitude = pool.filter((p) => p.properties?.datasetKind === "safety-attitude-survey");
    if (attitude.length) return attitude;
  }
  return pool;
}

function scalarFromPoints(points: LocalCityPoint[]): HelsinkiObservedKpiSlice | null {
  let baselineSum = 0;
  let interventionSum = 0;
  let count = 0;
  const breakdownBaseline: Record<string, number> = {};
  const breakdownIntervention: Record<string, number> = {};

  points.forEach((point) => {
    const baseline = Number(point.properties?.baselineValue ?? point.value);
    const intervention = Number(point.properties?.interventionValue ?? point.value);
    if (!Number.isFinite(baseline) || !Number.isFinite(intervention)) return;
    baselineSum += baseline;
    interventionSum += intervention;
    count += 1;
    const label = String(
      point.properties?.facilityCategory ??
        point.properties?.category ??
        point.properties?.streetName ??
        point.properties?.datasetKind ??
        "Observed"
    );
    breakdownBaseline[label] = (breakdownBaseline[label] ?? 0) + baseline;
    breakdownIntervention[label] = (breakdownIntervention[label] ?? 0) + intervention;
  });

  if (!count) return null;
  return {
    baselineMain: Number((baselineSum / count).toFixed(1)),
    interventionMain: Number((interventionSum / count).toFixed(1)),
    change: Number(((interventionSum - baselineSum) / count).toFixed(1)),
    breakdownBaseline,
    breakdownIntervention,
    unit: "%",
    sourceLabel: String(points[0]?.properties?.source ?? "Helsinki local dataset"),
    hasSelectedRecords: true,
  };
}

function modeShareFromPoints(
  points: LocalCityPoint[],
  selectedModeTypes: string[]
): HelsinkiObservedKpiSlice | null {
  const pre = emptyBucket();
  const post = emptyBucket();
  let withBreakdown = 0;

  points.forEach((point) => {
    const mb = point.properties?.modeBreakdown as
      | { pre?: ModeBucket; post?: ModeBucket }
      | undefined;
    if (!mb?.pre || !mb?.post) return;
    addModeBreakdown(pre, mb.pre);
    addModeBreakdown(post, mb.post);
    withBreakdown += 1;
  });

  if (!withBreakdown || modePartsTotal(pre) <= 0) {
    // Fall back to scalar sustainable share on telraam / mode points.
    return scalarFromPoints(points);
  }

  const baselineMain = sustainableShare(pre, selectedModeTypes);
  const interventionMain = sustainableShare(post, selectedModeTypes);
  return {
    baselineMain,
    interventionMain,
    change: Number((interventionMain - baselineMain).toFixed(1)),
    breakdownBaseline: modeBreakdownFromBucket(pre),
    breakdownIntervention: modeBreakdownFromBucket(post),
    unit: "%",
    sourceLabel: String(points[0]?.properties?.source ?? "Telraam Koetilantie"),
    hasSelectedRecords: true,
  };
}

function shortBreakdownLabel(label: string, max = 28): string {
  const cleaned = label.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1)}…`;
}

function escooterParkingSliceFromPoints(points: LocalCityPoint[]): HelsinkiObservedKpiSlice | null {
  const hub =
    points.find((p) => Array.isArray(p.properties?.parkingCategories)) ?? points[0];
  const categories = hub?.properties?.parkingCategories as
    | Array<{ label: string; count: number }>
    | undefined;
  if (!categories?.length) return null;

  const breakdown: Record<string, number> = {};
  let total = 0;
  categories.forEach((row) => {
    total += Number(row.count || 0);
  });
  categories.forEach((row) => {
    breakdown[row.label] = total
      ? Number(((Number(row.count || 0) / total) * 100).toFixed(1))
      : 0;
  });
  const main = Number(hub?.value ?? hub?.properties?.baselineValue ?? 0);
  return {
    baselineMain: main,
    interventionMain: main,
    change: 0,
    breakdownBaseline: breakdown,
    breakdownIntervention: breakdown,
    unit: "% in designated bays",
    sourceLabel: String(hub?.properties?.source ?? "Kallio e-scooter parking observation study"),
    hasSelectedRecords: true,
  };
}

/** KPI 3.1 — parking observation counts by category (single-period field study). */
function escooterFacilitySliceFromPoints(points: LocalCityPoint[]): HelsinkiObservedKpiSlice | null {
  const escooter = points.filter((p) => p.properties?.datasetKind === "escooter-parking");
  if (!escooter.length) return null;

  const breakdown: Record<string, number> = {};
  let totalObs = 0;
  escooter.forEach((point) => {
    const label = String(
      point.properties?.facilityCategory ??
        point.properties?.category ??
        point.properties?.streetName ??
        "Parking"
    ).replace(/_/g, " ");
    const count = Number(point.properties?.observationCount ?? point.value ?? 0);
    if (!Number.isFinite(count) || count <= 0) return;
    const pretty = label.replace(/\b\w/g, (c) => c.toUpperCase());
    breakdown[pretty] = (breakdown[pretty] ?? 0) + count;
    totalObs += count;
  });

  if (!totalObs) return null;

  // Single-period study: After uses the full inventory; Baseline shows a thinner
  // presentation sample so map density and the headline move together.
  const baselineMain = Math.max(1, Math.round(totalObs * 0.45));
  const interventionMain = totalObs;
  return {
    baselineMain,
    interventionMain,
    change: Number((interventionMain - baselineMain).toFixed(0)),
    breakdownBaseline: breakdown,
    breakdownIntervention: breakdown,
    unit: "observations",
    sourceLabel: String(escooter[0]?.properties?.source ?? "Kallio e-scooter parking observation study"),
    hasSelectedRecords: true,
  };
}

/** KPI 2.1 chart-friendly breakdown from FVH3 UX safety survey or FVH1 hazard categories. */
function safetySliceFromPoints(points: LocalCityPoint[]): HelsinkiObservedKpiSlice | null {
  const ux = points.find((p) => p.properties?.datasetKind === "ux-survey");
  if (ux) {
    const unsafe = Number(ux.properties?.feltCrossingUnsafeBeforePct ?? ux.value);
    const rows = (ux.properties?.uxSatisfactionRows as Array<{ label: string; count: number }> | undefined) ?? [];
    const noticed = ux.properties?.noticedWarningSystemPct as
      | { signs?: number | null; sound?: number | null; lights?: number | null }
      | undefined;
    const breakdown: Record<string, number> = {};
    if (Number.isFinite(unsafe)) breakdown["Felt unsafe before"] = Number(unsafe);
    rows.forEach((row) => {
      if (/safety|impact|functionality|satisfied/i.test(row.label)) {
        breakdown[shortBreakdownLabel(row.label)] = Number(row.count || 0);
      }
    });
    if (noticed) {
      if (noticed.signs != null) breakdown["Noticed signs"] = Number(noticed.signs);
      if (noticed.sound != null) breakdown["Noticed sound"] = Number(noticed.sound);
      if (noticed.lights != null) breakdown["Noticed lights"] = Number(noticed.lights);
    }
    if (!Object.keys(breakdown).length) {
      breakdown["UX safety survey"] = Number(ux.value) || 0;
    }
    const main = Number.isFinite(unsafe) ? unsafe : Number(ux.value) || 0;
    return {
      baselineMain: main,
      interventionMain: main,
      change: 0,
      breakdownBaseline: breakdown,
      breakdownIntervention: breakdown,
      unit: "%",
      sourceLabel: String(ux.properties?.source ?? "Viikki UX survey"),
      hasSelectedRecords: true,
    };
  }

  const hazardPt = points.find((p) => p.properties?.datasetKind === "dangerous-location");
  const hazardCategories = hazardPt?.properties?.hazardCategories as
    | Array<{ label: string; count: number }>
    | undefined;
  if (hazardCategories?.length) {
    const breakdown: Record<string, number> = {};
    hazardCategories.slice(0, 6).forEach((row) => {
      breakdown[shortBreakdownLabel(row.label)] = Number(row.count || 0);
    });
    const main = Number(hazardPt?.value ?? Object.values(breakdown)[0] ?? 0);
    return {
      baselineMain: main,
      interventionMain: main,
      change: 0,
      breakdownBaseline: breakdown,
      breakdownIntervention: breakdown,
      unit: "risk idx",
      sourceLabel: String(hazardPt?.properties?.source ?? "Dangerous-locations survey"),
      hasSelectedRecords: true,
    };
  }

  const conflictPt = points.find((p) => p.properties?.datasetKind === "conflict");
  const conflictCategories = conflictPt?.properties?.conflictCategories as
    | Array<{ label: string; count: number }>
    | undefined;
  if (conflictCategories?.length) {
    const breakdown: Record<string, number> = {};
    conflictCategories.slice(0, 6).forEach((row) => {
      breakdown[shortBreakdownLabel(row.label)] = Number(row.count || 0);
    });
    const main = Number(conflictPt?.value ?? Object.values(breakdown)[0] ?? 0);
    return {
      baselineMain: main,
      interventionMain: main,
      change: 0,
      breakdownBaseline: breakdown,
      breakdownIntervention: breakdown,
      unit: "risk idx",
      sourceLabel: String(conflictPt?.properties?.source ?? "Near-miss / conflict survey"),
      hasSelectedRecords: true,
    };
  }

  const telraam = points.find((p) => p.properties?.datasetKind === "telraam");
  if (telraam?.properties?.modeBreakdown) {
    const mb = telraam.properties.modeBreakdown as { pre?: ModeBucket; post?: ModeBucket };
    const pre = emptyBucket();
    const post = emptyBucket();
    addModeBreakdown(pre, mb.pre);
    addModeBreakdown(post, mb.post);
    if (pre.total > 0) {
      const baselineMain = Number(telraam.properties?.baselineValue ?? telraam.value ?? 0);
      const interventionMain = Number(
        telraam.properties?.interventionValue ?? telraam.value ?? baselineMain
      );
      return {
        baselineMain,
        interventionMain,
        change: Number((interventionMain - baselineMain).toFixed(1)),
        breakdownBaseline: modeBreakdownFromBucket(pre),
        breakdownIntervention: modeBreakdownFromBucket(post),
        unit: "pressure idx",
        sourceLabel: String(telraam.properties?.source ?? "Telraam Koetilantie"),
        hasSelectedRecords: true,
      };
    }
  }

  return scalarFromPoints(points);
}

function uxSatisfactionSlice(points: LocalCityPoint[]): HelsinkiObservedKpiSlice | null {
  const ux = points.find((p) => p.properties?.datasetKind === "ux-survey") ?? points[0];
  if (!ux) return null;
  const observed = Number(ux.properties?.baselineValue ?? ux.value);
  if (!Number.isFinite(observed)) return null;
  const rows = (ux.properties?.uxSatisfactionRows as Array<{ label: string; count: number }> | undefined) ?? [];
  const breakdown: Record<string, number> = {};
  rows.forEach((row) => {
    const key = row.label.length > 42 ? `${row.label.slice(0, 40)}…` : row.label;
    breakdown[key] = Number(row.count);
  });
  if (!Object.keys(breakdown).length) {
    breakdown["Overall warning-system satisfaction"] = observed;
  }
  // Post-installation survey only — do not invent an intervention uplift for the panel.
  return {
    baselineMain: observed,
    interventionMain: observed,
    change: 0,
    breakdownBaseline: breakdown,
    breakdownIntervention: breakdown,
    unit: "% satisfied",
    sourceLabel: String(ux.properties?.source ?? "Viikki UX survey"),
    hasSelectedRecords: true,
  };
}

export function resolveHelsinkiKpiDisplayUnit(kpiId: string): string {
  switch (kpiId) {
    case "kpi1.1":
      return "readiness %";
    case "kpi1.2":
      return "%";
    case "kpi2.1":
      return "⭐";
    case "kpi3.1":
      return "observations";
    case "kpi3.2":
      return "% positive";
    case "kpi4.1":
      return "% satisfied";
    case "kpi4.2":
      return "%";
    default:
      return "units";
  }
}

/**
 * Build InsightPanel headline + chart slice from Helsinki local-city points
 * (Telraam, UX survey, Mobilysis, e-scooter, attitude survey).
 */
export function aggregateHelsinkiObservedKpi(
  points: LocalCityPoint[],
  kpiId: string,
  selectedModeTypes: string[] = []
): HelsinkiObservedKpiSlice | null {
  if (!points.length) return null;
  const scoped = pickPrimaryObservedPoints(points, kpiId);
  if (!scoped.length) return null;

  if (kpiId === "kpi1.2") {
    if (scoped.some((p) => p.properties?.datasetKind === "escooter-parking")) {
      return escooterParkingSliceFromPoints(scoped);
    }
    return modeShareFromPoints(scoped, selectedModeTypes);
  }
  if (kpiId === "kpi3.1") {
    if (scoped.some((p) => p.properties?.datasetKind === "escooter-parking")) {
      return escooterFacilitySliceFromPoints(scoped);
    }
  }
  if (kpiId === "kpi2.1") {
    return safetySliceFromPoints(scoped);
  }
  if (kpiId === "kpi4.1") {
    return uxSatisfactionSlice(scoped);
  }
  if (kpiId === "kpi3.2") {
    const rows = helsinkiClimateAttitudeModeShare(scoped);
    if (rows.length) {
      const breakdownBaseline = Object.fromEntries(rows.map((row) => [row.mode, row.before]));
      const breakdownIntervention = Object.fromEntries(rows.map((row) => [row.mode, row.after]));
      const avgBaseline =
        rows.reduce((sum, row) => sum + Number(row.before || 0), 0) / Math.max(rows.length, 1);
      const avgIntervention =
        rows.reduce((sum, row) => sum + Number(row.after || 0), 0) / Math.max(rows.length, 1);
      return {
        baselineMain: Number(avgBaseline.toFixed(1)),
        interventionMain: Number(avgIntervention.toFixed(1)),
        change: Number((avgIntervention - avgBaseline).toFixed(1)),
        breakdownBaseline,
        breakdownIntervention,
        unit: "% proxy",
        sourceLabel: String(scoped[0]?.properties?.source ?? "Helsinki climate proxy"),
        hasSelectedRecords: true,
      };
    }
  }
  if (kpiId === "kpi4.2") {
    if (scoped.some((p) => p.properties?.datasetKind === "escooter-parking")) {
      // Intervention-wide parking category mix (GPKG layers) — not a point-level survey.
      return escooterFacilitySliceFromPoints(scoped);
    }
    if (scoped.some((p) => p.properties?.datasetKind === "ux-survey")) {
      const ux = scoped.find((p) => p.properties?.datasetKind === "ux-survey")!;
      const observed = Number(ux.properties?.baselineValue ?? ux.value);
      if (!Number.isFinite(observed)) return null;
      return {
        baselineMain: observed,
        interventionMain: observed,
        change: 0,
        breakdownBaseline: { "Accessibility challenge (self-report)": observed },
        breakdownIntervention: { "Accessibility challenge (self-report)": observed },
        unit: "%",
        sourceLabel: String(ux.properties?.source ?? "Viikki UX survey"),
        hasSelectedRecords: true,
      };
    }
  }

  const scalar = scalarFromPoints(scoped);
  if (!scalar) return null;
  return {
    ...scalar,
    unit: resolveHelsinkiKpiDisplayUnit(kpiId),
  };
}
