import type { KPIValue } from "@/data/kpiDefinitions";
import type { IssyFlowFeature } from "@/services/issyFlowData";
import { mapIssyVehicleCategoryToElaboratorMode } from "@/lib/travelModeMapLink";

export type IssyScenarioSlice = "baseline" | "intervention" | "comparison";

export const ELABORATOR_MODE_SHARE_MODES = [
  "Pedestrian",
  "Cycle",
  "Public Transport",
  "Private Car",
  "PTW",
] as const;

const SUSTAINABLE_MODES = new Set(["Pedestrian", "Cycle", "Public Transport"]);
/** Sum OD flow volumes by mobility category for Issy CSV-derived features (same units as avg_traffic aggregates). */
export function aggregateIssyFlowVolumesByCategory(features: IssyFlowFeature[]): Map<string, { baseline: number; intervention: number }> {
  const map = new Map<string, { baseline: number; intervention: number }>();
  for (const f of features) {
    const prev = map.get(f.vehicleCategory) ?? { baseline: 0, intervention: 0 };
    prev.baseline += f.baselineValue;
    prev.intervention += f.interventionValue;
    map.set(f.vehicleCategory, prev);
  }
  return map;
}

export function categorySharesForScenario(
  aggregates: Map<string, { baseline: number; intervention: number }>,
  scenario: IssyScenarioSlice
): { category: string; value: number; pct: number }[] {
  let total = 0;
  const rows: { category: string; value: number }[] = [];
  aggregates.forEach((v, category) => {
    const value =
      scenario === "baseline"
        ? v.baseline
        : scenario === "intervention"
          ? v.intervention
          : Math.max(0, v.intervention - v.baseline);
    rows.push({ category, value });
    total += value;
  });
  if (total <= 0) return [];
  return rows
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value)
    .map((r) => ({
      category: r.category,
      value: r.value,
      pct: (100 * r.value) / total,
    }));
}

/** Compact line for KPI panel: top categories with % (zone-OD aggregate, not census modal share). */
export function formatIssyFlowTotalsLine(
  features: IssyFlowFeature[] | undefined,
  scenario: Exclude<IssyScenarioSlice, "comparison">,
  maxCategories: number = 4
): string | null {
  if (!features?.length) return null;
  const shares = categorySharesForScenario(aggregateIssyFlowVolumesByCategory(features), scenario);
  if (!shares.length) return null;
  const head = shares.slice(0, maxCategories).map((s) => `${humanizeIssyCategory(s.category)} ${s.pct.toFixed(0)}%`);
  const suffix = shares.length > maxCategories ? ` · +${shares.length - maxCategories} more` : "";
  const scope = scenario === "baseline" ? "baseline OD mix" : "post OD mix";
  return `From zone flows (${scope}): ${head.join(", ")}${suffix}.`;
}

/** Signed net change per mobility category (post − baseline), largest |Δ| first. */
/** Top N zone-to-zone OD pairs by |Δ| volume (comparison scenario sidebar). */
export function formatIssyFlowTopOdDeltaPairs(
  features: IssyFlowFeature[] | undefined,
  maxPairs: number = 5
): string | null {
  if (!features?.length) return null;
  const byOd = new Map<string, number>();
  for (const f of features) {
    const key = `Z${f.fromZone}→Z${f.toZone}`;
    byOd.set(key, (byOd.get(key) || 0) + f.change);
  }
  const ranked = [...byOd.entries()]
    .filter(([, v]) => Math.abs(v) > 1e-6)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, maxPairs);
  if (!ranked.length) return null;
  return `Top Δ OD corridors: ${ranked.map(([k, v]) => `${k} ${v >= 0 ? "+" : ""}${v.toFixed(0)}`).join(" · ")}.`;
}

export function formatIssyFlowComparisonLine(features: IssyFlowFeature[] | undefined, maxCategories: number = 4): string | null {
  if (!features?.length) return null;
  const net = new Map<string, number>();
  for (const f of features) {
    net.set(f.vehicleCategory, (net.get(f.vehicleCategory) || 0) + f.change);
  }
  const rows = [...net.entries()]
    .filter(([, v]) => Math.abs(v) > 1e-6)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, maxCategories);
  if (!rows.length) return null;
  const parts = rows.map(([c, v]) => `${humanizeIssyCategory(c)} ${v >= 0 ? "+" : ""}${v.toFixed(1)}`);
  return `Zone-flow net change (post − baseline, CSV units): ${parts.join(", ")}.`;
}

/** Sum zone-OD volumes into ELABORATOR mode-share buckets (matches map filter mapping). */
export function aggregateIssyVolumesByElaboratorMode(
  features: IssyFlowFeature[],
  scenario: Exclude<IssyScenarioSlice, "comparison">
): Record<(typeof ELABORATOR_MODE_SHARE_MODES)[number], number> {
  const volumes = Object.fromEntries(
    ELABORATOR_MODE_SHARE_MODES.map((m) => [m, 0])
  ) as Record<(typeof ELABORATOR_MODE_SHARE_MODES)[number], number>;

  const byCategory = aggregateIssyFlowVolumesByCategory(features);
  byCategory.forEach((v, category) => {
    const mode = mapIssyVehicleCategoryToElaboratorMode(category);
    const amount = scenario === "baseline" ? v.baseline : v.intervention;
    volumes[mode] += amount;
  });
  return volumes;
}

function volumesToPercentBreakdown(
  volumes: Record<(typeof ELABORATOR_MODE_SHARE_MODES)[number], number>
): Record<string, number> {
  const total = ELABORATOR_MODE_SHARE_MODES.reduce((sum, m) => sum + volumes[m], 0);
  if (total <= 0) return {};
  const breakdown: Record<string, number> = {};
  ELABORATOR_MODE_SHARE_MODES.forEach((mode) => {
    const pct = (100 * volumes[mode]) / total;
    if (pct > 0) breakdown[mode] = Math.round(pct * 10) / 10;
  });
  return breakdown;
}

function sustainableShareFromBreakdown(breakdown: Record<string, number>): number {
  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
  if (total <= 0) return 0;
  const sust = Object.entries(breakdown).reduce(
    (sum, [mode, pct]) => (SUSTAINABLE_MODES.has(mode) ? sum + pct : sum),
    0
  );
  return Math.round(sust * 10) / 10;
}

/** KPI 1.2 card + chart values from Issy zone-flow CSV (observed OD volumes, not mock CITY_DATA). */
export function buildIssyModeShareKpiSlices(
  features: IssyFlowFeature[] | undefined
): { baseline: KPIValue; intervention: KPIValue } | null {
  if (!features?.length) return null;

  const baselineBreakdown = volumesToPercentBreakdown(
    aggregateIssyVolumesByElaboratorMode(features, "baseline")
  );
  const interventionBreakdown = volumesToPercentBreakdown(
    aggregateIssyVolumesByElaboratorMode(features, "intervention")
  );
  if (Object.keys(interventionBreakdown).length === 0) return null;

  const baselineMain = sustainableShareFromBreakdown(baselineBreakdown);
  const interventionMain = sustainableShareFromBreakdown(interventionBreakdown);
  const change = Math.round((interventionMain - baselineMain) * 10) / 10;

  const baseline: KPIValue = {
    mainValue: baselineMain,
    unit: "%",
    change: 0,
    status: "before",
    breakdown: baselineBreakdown,
  };
  const intervention: KPIValue = {
    mainValue: interventionMain,
    unit: "%",
    change,
    status: "after",
    breakdown: interventionBreakdown,
  };
  return { baseline, intervention };
}

export function humanizeIssyCategory(cat: string): string {
  const c = cat.toLowerCase();
  const map: Record<string, string> = {
    bicycle: "Bicycle",
    person: "Pedestrian",
    bus: "Bus",
    car: "Car",
    motorcycle: "Motorcycle",
    truck: "Truck",
    van: "Van",
    trottinette: "Scooter",
  };
  return map[c] || cat.replace(/_/g, " ");
}
