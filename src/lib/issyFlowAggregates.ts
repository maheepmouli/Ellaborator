import type { KPIValue } from "@/data/kpiDefinitions";
import type { IssyFlowFeature } from "@/services/issyFlowData";
import { mapIssyVehicleCategoryToElaboratorMode } from "@/lib/travelModeMapLink";
import type { JunctionStudyView } from "@/lib/issyJunctionAnalytics";

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
  return Math.max(0, Math.min(100, Math.round(sust * 10) / 10));
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

export interface IssyZoneModeSharePoint {
  zone: number;
  label: string;
  lat: number;
  lon: number;
  baselineSustainablePct: number;
  interventionSustainablePct: number;
  deltaPp: number;
  baselineVolume: number;
  interventionVolume: number;
  breakdownBaseline: Record<string, number>;
  breakdownIntervention: Record<string, number>;
}

/**
 * City-scale KPI 1.2 points for Issy Pilot 2 — sustainable mode share % at each OD zone centroid.
 * Volumes attributed when the zone is origin or destination (zone activity).
 */
export function buildIssyZoneSustainableModeSharePoints(
  features: IssyFlowFeature[] | undefined,
  centroids: Array<{ zone: number; lat: number; lon: number; label: string }>
): IssyZoneModeSharePoint[] {
  if (!features?.length || !centroids.length) return [];

  return centroids
    .map((centroid) => {
      const touching = features.filter(
        (f) => f.fromZone === centroid.zone || f.toZone === centroid.zone
      );
      if (!touching.length) return null;

      const baselineVolumes = aggregateIssyVolumesByElaboratorMode(touching, "baseline");
      const interventionVolumes = aggregateIssyVolumesByElaboratorMode(touching, "intervention");
      const breakdownBaseline = volumesToPercentBreakdown(baselineVolumes);
      const breakdownIntervention = volumesToPercentBreakdown(interventionVolumes);
      const baselineSustainablePct = sustainableShareFromBreakdown(breakdownBaseline);
      const interventionSustainablePct = sustainableShareFromBreakdown(breakdownIntervention);
      const baselineVolume = ELABORATOR_MODE_SHARE_MODES.reduce((s, m) => s + baselineVolumes[m], 0);
      const interventionVolume = ELABORATOR_MODE_SHARE_MODES.reduce(
        (s, m) => s + interventionVolumes[m],
        0
      );
      if (baselineVolume <= 0 && interventionVolume <= 0) return null;

      return {
        zone: centroid.zone,
        label: centroid.label,
        lat: centroid.lat,
        lon: centroid.lon,
        baselineSustainablePct,
        interventionSustainablePct,
        deltaPp: Math.round((interventionSustainablePct - baselineSustainablePct) * 10) / 10,
        baselineVolume,
        interventionVolume,
        breakdownBaseline,
        breakdownIntervention,
      } satisfies IssyZoneModeSharePoint;
    })
    .filter((row): row is IssyZoneModeSharePoint => row != null);
}

export function issyZoneSustainablePctColor(pct: number): string {
  if (pct >= 50) return "#22c55e";
  if (pct >= 40) return "#84cc16";
  if (pct >= 30) return "#f59e0b";
  return "#ef4444";
}

export function parseIssyZoneSegmentId(segmentId: string | null | undefined): number | null {
  if (!segmentId) return null;
  const match = /^issy-zone-(\d+)$/.exec(segmentId);
  if (!match) return null;
  const zone = Number(match[1]);
  return Number.isFinite(zone) ? zone : null;
}

export function issyZoneSegmentId(zone: number): string {
  return `issy-zone-${zone}`;
}

/** Compass bearing from origin → destination (0 = north, clockwise). */
function bearingBetween(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number }
): number {
  const φ1 = (from.lat * Math.PI) / 180;
  const φ2 = (to.lat * Math.PI) / 180;
  const Δλ = ((to.lon - from.lon) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * City-layout compass slots for Issy OD zones (matches centroid map: NW/NE/Core/S/SW/SE).
 * Used so schematic arms fan out on the rose instead of clustering when the
 * origin sits on the city edge (true geodesic bearings all point inward).
 */
const ISSY_ZONE_LAYOUT_BEARING: Record<number, number> = {
  1: 315, // NW
  2: 45, // NE
  3: 0, // Core — treat as “north of diagram centre” when absolute slot needed
  4: 180, // South
  5: 225, // SW
  6: 135, // SE
};

/** Prefer layout slot; for Core use inward geodesic so it reads “toward centre”. */
function issyZoneSchematicBearing(
  originZone: number,
  destZone: number,
  origin: { lat: number; lon: number },
  dest: { lat: number; lon: number }
): number {
  if (destZone === 3) return bearingBetween(origin, dest);
  const slot = ISSY_ZONE_LAYOUT_BEARING[destZone];
  if (typeof slot === "number") return slot;
  return bearingBetween(origin, dest);
}

/**
 * Top OD destinations from a zone — schematic arms that select other zones.
 * OBSERVED volumes from ISSY1 OD CSV; sustainable % is DERIVED from mode mix on those links.
 */
export function buildIssyZoneOdLinks(
  originZone: number,
  features: IssyFlowFeature[] | undefined,
  centroids: Array<{ zone: number; lat: number; lon: number; label: string }>,
  maxArms = 3
): NonNullable<JunctionStudyView["odLinks"]> {
  if (!features?.length || !centroids.length) return [];
  const origin = centroids.find((c) => c.zone === originZone);
  if (!origin) return [];

  const byDest = new Map<number, { baseline: number; intervention: number }>();
  for (const f of features) {
    let other: number | null = null;
    if (f.fromZone === originZone && f.toZone !== originZone) other = f.toZone;
    else if (f.toZone === originZone && f.fromZone !== originZone) other = f.fromZone;
    if (other == null) continue;
    const prev = byDest.get(other) ?? { baseline: 0, intervention: 0 };
    prev.baseline += f.baselineValue;
    prev.intervention += f.interventionValue;
    byDest.set(other, prev);
  }

  const ranked = [...byDest.entries()]
    .map(([toZone, vols]) => ({ toZone, ...vols, activity: vols.baseline + vols.intervention }))
    .filter((r) => r.activity > 0)
    .sort((a, b) => b.activity - a.activity)
    .slice(0, maxArms);

  const zonePoints = buildIssyZoneSustainableModeSharePoints(features, centroids);
  const pctByZone = new Map(zonePoints.map((z) => [z.zone, z] as const));

  return ranked.flatMap((row) => {
    const dest = centroids.find((c) => c.zone === row.toZone);
    const stats = pctByZone.get(row.toZone);
    if (!dest || !stats) return [];
    const bearingDeg = issyZoneSchematicBearing(originZone, row.toZone, origin, dest);
    return [
      {
        id: issyZoneSegmentId(row.toZone),
        // Keep zone label only — no extra “north/west” suffix (that was fighting the layout).
        direction: dest.label,
        bearingDeg,
        baselinePct: stats.baselineSustainablePct,
        interventionPct: stats.interventionSustainablePct,
      },
    ];
  });
}

/** Observatory panel view for a city-scale OD zone (Issy Pilot 2 KPI 1.2). */
export function buildIssyZoneModeShareStudyView(
  zone: IssyZoneModeSharePoint,
  options: {
    pilotLabel?: string;
    pilotId?: string | null;
    scenario?: "baseline" | "intervention" | "comparison";
    features?: IssyFlowFeature[];
    centroids?: Array<{ zone: number; lat: number; lon: number; label: string }>;
  } = {}
): JunctionStudyView {
  const scenario = options.scenario ?? "intervention";
  const kpiValue =
    scenario === "baseline" ? zone.baselineSustainablePct : zone.interventionSustainablePct;
  const bandColor = issyZoneSustainablePctColor(kpiValue);
  const odLinks =
    options.features && options.centroids
      ? buildIssyZoneOdLinks(zone.zone, options.features, options.centroids)
      : undefined;

  const toPeriod = (
    label: string,
    period: string,
    breakdown: Record<string, number>,
    volume: number,
    sustainablePct: number
  ) => ({
    label,
    period,
    modeShare: {
      Pedestrian: breakdown.Pedestrian ?? 0,
      Cycle: breakdown.Cycle ?? 0,
      "Public Transport": breakdown["Public Transport"] ?? 0,
      Car: breakdown["Private Car"] ?? breakdown.Car ?? 0,
      PTW: breakdown.PTW ?? 0,
    },
    dailyCycleCount: Math.round(volume * ((breakdown.Cycle ?? 0) / 100)),
    peakCongestion: Math.max(0, Math.min(1, 1 - sustainablePct / 100)),
    avgSpeedKmh: 0,
    co2ProxyKgDay: 0,
    trendCycle: [
      Math.round(sustainablePct * 0.9),
      Math.round(sustainablePct * 0.95),
      Math.round(sustainablePct),
    ],
    trendCar: [
      Math.round((100 - sustainablePct) * 0.95),
      Math.round(100 - sustainablePct),
      Math.round((100 - sustainablePct) * 1.02),
    ],
  });

  return {
    id: issyZoneSegmentId(zone.zone),
    segmentApiId: issyZoneSegmentId(zone.zone),
    name: zone.label,
    shortName: `Zone ${zone.zone}`,
    armLabel: zone.label,
    armId: "west",
    armColor: bandColor,
    bandColor,
    kpiBand: kpiValue >= 50 ? "high" : kpiValue >= 30 ? "medium" : "low",
    kpiValue: Math.round(kpiValue * 10) / 10,
    selectedKpi: "kpi1.2",
    kpiLabel: "Sustainable mobility share",
    pilot: options.pilotLabel ?? "Issy-les-Moulineaux",
    interventionType: "Mobility Observatory (city scale)",
    coordinates: [zone.lat, zone.lon],
    monitoringPeriod: "Nov 2024 baseline · Nov 2025 post",
    sensors: 1,
    approachesCovered: odLinks?.length ?? 6,
    totalApproaches: 6,
    dataConfidence: 82,
    baseline: toPeriod(
      "Baseline OD",
      "Nov 2024",
      zone.breakdownBaseline,
      zone.baselineVolume,
      zone.baselineSustainablePct
    ),
    intervention: toPeriod(
      "Post OD",
      "Nov 2025",
      zone.breakdownIntervention,
      zone.interventionVolume,
      zone.interventionSustainablePct
    ),
    timeline: [
      { date: "Nov 2024", event: "ISSY1 OD baseline extract", status: "done" },
      { date: "Nov 2025", event: "ISSY1 OD post-intervention extract", status: "done" },
    ],
    dataSource: "observed",
    dataClass: "observed",
    sourceLabel: "ISSY1 zone OD CSV · sustainable mobility %",
    streetNS: zone.label,
    streetEW: "Issy city OD zones",
    odLinks,
  };
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
