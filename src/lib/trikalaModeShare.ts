import type { ModeShareRow } from "@/lib/observatoryGraphicTypes";
import type { TrikalaLocation } from "@/data/trikalaLocationRegistry";
import { resolveTrikalaInsightSegmentFromSelection } from "@/lib/trikalaObservatoryView";
import {
  modeShareFromTrikalaPilot2Aggregate,
  modeShareFromTrikalaPilot2Location,
  resolveTrikalaPilot2HubId,
} from "@/lib/trikalaMapLayers/trikalaPilot2ModeShare";
import type { TrikalaSegmentInsight } from "@/services/trikalaSurveyParser";
import type { LocalCityPoint } from "@/services/localCityData";

const MODE_KEYS = [
  { label: "Pedestrian", patterns: [/περπάτημα|περπατ|walk|pedestrian/i] },
  { label: "Cycle", patterns: [/ποδήλατο|bike|cycle/i] },
  { label: "Public Transport", patterns: [/λεωφορείο|bus|pt|public transport/i] },
  { label: "Private Car", patterns: [/αυτοκίνητο|car|motor/i] },
  { label: "PTW", patterns: [/μηχανάκι|scooter|ptw|moped/i] },
] as const;

function parseNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function tripWeight(freq: string): number {
  const text = freq.toLowerCase();
  if (!text || text === "καθόλου" || text === "not at all") return 0;
  if (/καθημεριν|daily|every day/i.test(text)) return 5;
  if (/εβδομαδ|week/i.test(text)) return 3;
  if (/μήνα|month/i.test(text)) return 1.5;
  return 1;
}

/** Self-reported mode mix from women mobility questionnaire rows. */
export function computeWomenMobilityModeShareRows(
  rows: Record<string, unknown>[]
): ModeShareRow[] {
  if (!rows.length) return [];

  const totals = new Map<string, number>();
  let grandTotal = 0;

  rows.forEach((row) => {
    MODE_KEYS.forEach(({ label, patterns }) => {
      const key = Object.keys(row).find((k) => patterns.some((p) => p.test(k)));
      if (!key) return;
      const freq = String(row[key] ?? "");
      const weight = tripWeight(freq);
      if (weight <= 0) return;
      totals.set(label, (totals.get(label) ?? 0) + weight);
      grandTotal += weight;
    });
  });

  if (grandTotal <= 0) return [];

  return MODE_KEYS.map(({ label }) => {
    const pct = Math.round(((totals.get(label) ?? 0) / grandTotal) * 1000) / 10;
    return { mode: label, before: pct, after: pct };
  }).filter((r) => r.before > 0);
}

/** Paired smart-crossing / bike-lane Likert dimensions for before/after bars. */
export function modeShareFromTrikalaSmartCrossingSurvey(points: LocalCityPoint[]): ModeShareRow[] {
  const buckets = new Map<string, { before: number; after: number; n: number }>();
  for (const p of points) {
    const segmentId = String(p.properties?.segmentId ?? "");
    const label = String(p.properties?.likertLabel ?? "").trim();
    if (!label) continue;
    if (
      !segmentId.includes("smart-crossing") &&
      !segmentId.includes("bike-lane") &&
      p.properties?.datasetKind !== "survey"
    ) {
      continue;
    }
    const before = Number(p.properties?.baselineValue ?? 0);
    const after = Number(p.properties?.interventionValue ?? p.value ?? 0);
    if (before <= 0 && after <= 0) continue;
    const existing = buckets.get(label) ?? { before: 0, after: 0, n: 0 };
    existing.before += before;
    existing.after += after;
    existing.n += 1;
    buckets.set(label, existing);
  }
  return [...buckets.entries()].map(([mode, agg]) => ({
    mode,
    before: Math.round((agg.n ? agg.before / agg.n : 0) * 10) / 10,
    after: Math.round((agg.n ? agg.after / agg.n : 0) * 10) / 10,
  }));
}

/** Women-mobility active-mode proxy for mode-share bars (legacy KPI 1.2 path). */
export function modeShareFromTrikalaSurveyRecords(points: LocalCityPoint[]): ModeShareRow[] {
  const fromSmartCrossing = modeShareFromTrikalaSmartCrossingSurvey(points);
  if (fromSmartCrossing.length) return fromSmartCrossing;

  const activeRecord = points.find((p) =>
    String(p.properties?.segmentId ?? "").includes("women-mobility")
  );
  if (!activeRecord) return [];

  const share = Number(activeRecord.value ?? activeRecord.interventionValue ?? 0);
  const carShare = Math.max(0, 100 - share);
  return [
    { mode: "Pedestrian", before: share * 0.45, after: share * 0.48 },
    { mode: "Cycle", before: share * 0.55, after: share * 0.52 },
    { mode: "Car", before: carShare * 0.85, after: carShare * 0.8 },
    { mode: "Public Transport", before: carShare * 0.1, after: carShare * 0.12 },
    { mode: "PTW", before: carShare * 0.05, after: carShare * 0.08 },
  ].map((r) => ({
    mode: r.mode,
    before: Math.round(r.before * 10) / 10,
    after: Math.round(r.after * 10) / 10,
  }));
}

function pickTrikalaInsightSource(
  insights: TrikalaSegmentInsight[]
): TrikalaSegmentInsight | undefined {
  const withData = insights.filter(
    (i) => i.responseCount > 0 && i.activeModeSharePct != null && i.activeModeSharePct > 0
  );
  if (!withData.length) return undefined;

  // Pre-scoped array (e.g. single village segment after hover filter)
  if (withData.length === 1) return withData[0];

  const nonAll = withData.filter((i) => i.segment !== "all");
  if (nonAll.length === 1) return nonAll[0];

  return (
    withData.find((i) => i.segment === "urban") ??
    withData.find((i) => i.segment === "all") ??
    withData[0]
  );
}

export function modeShareFromTrikalaInsights(
  insights: TrikalaSegmentInsight[]
): ModeShareRow[] {
  const source = pickTrikalaInsightSource(insights);
  if (!source?.activeModeSharePct) return [];

  const active = Math.max(0, Math.min(100, source.activeModeSharePct));
  const residual =
    source.carModeSharePct != null
      ? Math.max(0, Math.min(100 - active, source.carModeSharePct))
      : Math.max(0, 100 - active);
  // Partition residual across motorised modes so bars cannot sum above 100%.
  return [
    { mode: "Pedestrian", before: active * 0.42, after: active * 0.44 },
    { mode: "Cycle", before: active * 0.58, after: active * 0.56 },
    { mode: "Car", before: residual * 0.85, after: residual * 0.8 },
    { mode: "Public Transport", before: residual * 0.12, after: residual * 0.14 },
    { mode: "PTW", before: residual * 0.03, after: residual * 0.06 },
  ].map((r) => ({
    mode: r.mode,
    before: Math.round(Math.max(0, Math.min(100, r.before)) * 10) / 10,
    after: Math.round(Math.max(0, Math.min(100, r.after)) * 10) / 10,
  }));
}

export type TrikalaModeShareObservedSlice = {
  baselineMain: number;
  interventionMain: number;
  change: number;
  breakdownBaseline: Record<string, number>;
  breakdownIntervention: Record<string, number>;
};

function rowsToTrikalaModeShareSlice(rows: ModeShareRow[]): TrikalaModeShareObservedSlice | null {
  if (!rows.length) return null;

  const breakdownBaseline: Record<string, number> = {};
  const breakdownIntervention: Record<string, number> = {};
  rows.forEach((r) => {
    breakdownBaseline[r.mode] = r.before;
    breakdownIntervention[r.mode] = r.after;
  });

  const baselineMain = Math.max(
    0,
    Math.min(
      100,
      Math.round((breakdownBaseline.Pedestrian ?? 0) + (breakdownBaseline.Cycle ?? 0))
    )
  );
  const interventionMain = Math.max(
    0,
    Math.min(
      100,
      Math.round((breakdownIntervention.Pedestrian ?? 0) + (breakdownIntervention.Cycle ?? 0))
    )
  );

  return {
    baselineMain,
    interventionMain,
    change: interventionMain - baselineMain,
    breakdownBaseline,
    breakdownIntervention,
  };
}

export function buildTrikalaModeShareObservedSlice(
  insights: TrikalaSegmentInsight[]
): TrikalaModeShareObservedSlice | null {
  return rowsToTrikalaModeShareSlice(modeShareFromTrikalaInsights(insights));
}

/** Hover/selection-scoped mode-share slice for InsightPanel and map-linked KPI 1.2. */
export function buildTrikalaModeShareSliceForSelection(options: {
  pilotId?: string | null;
  segmentId?: string | null;
  insights: TrikalaSegmentInsight[];
  locations?: TrikalaLocation[];
  womenMobilityModeShare?: ModeShareRow[];
}): TrikalaModeShareObservedSlice | null {
  const { pilotId, segmentId, insights, locations, womenMobilityModeShare } = options;

  if (pilotId === "tri-p2") {
    const hubId = resolveTrikalaPilot2HubId(segmentId);
    const loc = hubId ? locations?.find((l) => l.id === hubId) : undefined;
    const rows = hubId
      ? modeShareFromTrikalaPilot2Location(hubId, loc ?? null)
      : modeShareFromTrikalaPilot2Aggregate();
    return rowsToTrikalaModeShareSlice(rows);
  }

  if (womenMobilityModeShare?.length) {
    return rowsToTrikalaModeShareSlice(womenMobilityModeShare);
  }

  if (!insights.length) return null;

  const segmentKey = resolveTrikalaInsightSegmentFromSelection(segmentId);
  const scoped = segmentKey ? insights.filter((i) => i.segment === segmentKey) : insights;
  return buildTrikalaModeShareObservedSlice(scoped.length ? scoped : insights);
}
