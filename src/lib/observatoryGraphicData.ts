import { CITY_DATA } from "@/data/kpiDefinitions";
import { getCityPilotProfile } from "@/data/cityPilotProfiles";
import { getKpiDefinition } from "@/config/kpiDefinitions";
import type { MapScenario } from "@/context/MapIntelligenceContext";
import { areAllTravelModesSelected } from "@/lib/travelModeMapLink";
import {
  classifyDataOrigin,
  performanceDeltaFromPoints,
  type ObservatoryDataClass,
} from "@/lib/observatoryCityContent";
import type { JunctionStudyView } from "@/lib/issyJunctionAnalytics";
import { ISSY_JUNCTION_ARMS, ISSY_P2_JUNCTION } from "@/lib/issyPilot2Junction";
import { resolveObservatoryGraphic, resolveObservatoryType } from "@/lib/observatoryGraphicsRegistry";
import type {
  CameraDirectionRow,
  LikertRow,
  ModeShareRow,
  ObservatoryGraphicPayload,
  ObservatoryGraphicSpec,
  ObservatoryGraphicZone,
  TrendPoint,
} from "@/lib/observatoryGraphicTypes";
import type { LocalCityPoint } from "@/services/localCityData";
import { normalizeConfidencePct } from "@/lib/observatoryCityContent";
import {
  filterCopenhagenObservatoryPoints,
  isCopenhagenTelraamSelection,
  resolveCopenhagenWorkbookFocus,
  scopeCopenhagenPointsToWorkbookDirections,
} from "@/lib/copenhagenObservatoryView";
import {
  getTelraamOutcomeForLocation,
  inferOtcWorkbookKey,
} from "@/data/copenhagenLocationRegistry";
import {
  getCopenhagenLocationFromSelection,
} from "@/lib/copenhagenMapSelection";
import {
  getCopenhagenSentimentMock,
  copenhagenSentimentKpiHeadline,
} from "@/data/copenhagenSentimentMock";
import {
  getCopenhagenAccessibilityMock,
  copenhagenAccessibilityKpiHeadline,
  copenhagenAccessibilityStatCards,
} from "@/data/copenhagenAccessibilityMock";
import {
  getIssyAccessibilityMock,
  issyAccessibilityKpiHeadline,
  issyAccessibilityStatCards,
} from "@/data/issyAccessibilityMock";
import { workbookHubBearing, knownDirectionalFlowKeys, normalizeOtcFlowKey } from "@/lib/copenhagenMapLayers/copenhagenFlowGeometry";
import {
  modeShareFromTrikalaInsights,
  modeShareFromTrikalaSurveyRecords,
} from "@/lib/trikalaModeShare";
import {
  modeShareFromTrikalaPilot2Aggregate,
  modeShareFromTrikalaPilot2Location,
  resolveTrikalaPilot2HubId,
} from "@/lib/trikalaMapLayers/trikalaPilot2ModeShare";
import type { TrikalaSegmentInsight } from "@/services/trikalaSurveyParser";
import type { TrikalaLocation, TrikalaSensorJoin } from "@/data/trikalaLocationRegistry";
import {
  filterTrikalaObservatoryPoints,
  findTrikalaLocationBySelection,
  resolveTrikalaInsightSegmentFromSelection,
} from "@/lib/trikalaObservatoryView";
import {
  filterHelsinkiObservatoryPoints,
  helsinkiClimateAttitudeLikert,
  helsinkiClimateAttitudeModeShare,
  helsinkiClimateStatCards,
  helsinkiEvidenceStatCards,
  helsinkiExpansionModeShare,
  helsinkiExpansionPlanStatCards,
  helsinkiKallioMockModeShare,
  helsinkiHazardCategoryLikert,
  helsinkiHazardCategoryModeShare,
  helsinkiConflictTravelModeShare,
  helsinkiHazardDirectionRows,
  helsinkiObservatoryMarkers,
  helsinkiTelraamStatCards,
  helsinkiTelraamTrend,
  helsinkiUxSatisfactionLikert,
  helsinkiUxSatisfactionModeShare,
  helsinkiUxSafetyPerceptionModeShare,
} from "@/lib/helsinkiObservatoryView";
import {
  filterZaragozaObservatoryPoints,
  zaragozaAccessibilityModeShare,
  zaragozaAccessibilityStatCards,
  zaragozaAqIntensityDiagram,
  zaragozaClimateModeShare,
  zaragozaCountStatCards,
  zaragozaEmissionDirections,
  zaragozaEnvStatCards,
  zaragozaExpansionModeShare,
  zaragozaExpansionPlanStatCards,
  zaragozaHazardModeShare,
  zaragozaLikertFromPoints,
  zaragozaModeShareRows,
  zaragozaSafetySpeedCards,
  zaragozaSurveyDistribution,
} from "@/lib/zaragozaObservatoryView";
import {
  filterMilanObservatoryPoints,
  milanAccessibilityStatCards,
  milanClimateStatCards,
  milanCountStatCards,
  milanExpansionModeShare,
  milanExpansionPlanStatCards,
  milanSelectedSegmentSpeedCards,
  milanSpeedStatCards,
  milanAmatPointsForHub,
  milanFlowBearingDeg,
} from "@/lib/milanObservatoryView";
import { milanSatisfactionStatCards } from "@/services/milanSurveyParser";
import type { MilanSegmentRecord, MilanSegmentStats } from "@/services/milanSegmentData";
import { modeShareRowsFromMilanPoints } from "@/lib/milanModeBreakdown";
import { filterMilanFacilityPointsForScenario } from "@/data/milanZeroEmissionMock";

type ModeBreakdown = {
  pre: { bike: number; pedestrian: number; motorised: number; ptw: number; total: number };
  post: { bike: number; pedestrian: number; motorised: number; ptw: number; total: number };
};

function pct(part: number, total: number): number {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.max(0, Math.min(100, (part / total) * 100));
}

function selectedCount(b: ModeBreakdown["post"], modes: string[]): number {
  const hasAny = modes.length > 0 && !areAllTravelModesSelected(modes);
  if (!hasAny) return b.bike + b.pedestrian;
  let total = 0;
  if (modes.includes("Cycle")) total += b.bike;
  if (modes.includes("Pedestrian")) total += b.pedestrian;
  if (modes.includes("Private Car") || modes.includes("Public Transport")) total += b.motorised;
  if (modes.includes("PTW")) total += b.ptw;
  return total;
}

function modeShareFromModeBreakdownPoints(points: LocalCityPoint[], otcOnly = false): ModeShareRow[] {
  const pre = { bike: 0, pedestrian: 0, motorised: 0, ptw: 0, total: 0 };
  const post = { bike: 0, pedestrian: 0, motorised: 0, ptw: 0, total: 0 };
  for (const point of points) {
    const kind = String(point.properties?.datasetKind ?? "");
    if (otcOnly && kind && kind !== "otc") continue;
    const mb = point.properties?.modeBreakdown as ModeBreakdown | undefined;
    if (!mb) continue;
    pre.bike += Number(mb.pre.bike ?? 0);
    pre.pedestrian += Number(mb.pre.pedestrian ?? 0);
    pre.motorised += Number(mb.pre.motorised ?? 0);
    pre.ptw += Number(mb.pre.ptw ?? 0);
    post.bike += Number(mb.post.bike ?? 0);
    post.pedestrian += Number(mb.post.pedestrian ?? 0);
    post.motorised += Number(mb.post.motorised ?? 0);
    post.ptw += Number(mb.post.ptw ?? 0);
  }
  pre.total = pre.bike + pre.pedestrian + pre.motorised + pre.ptw;
  post.total = post.bike + post.pedestrian + post.motorised + post.ptw;
  if (pre.total <= 0 && post.total <= 0) return [];
  return [
    { mode: "Pedestrian", before: pct(pre.pedestrian, pre.total), after: pct(post.pedestrian, post.total) },
    { mode: "Cycle", before: pct(pre.bike, pre.total), after: pct(post.bike, post.total) },
    { mode: "Public Transport", before: pct(pre.motorised * 0.35, pre.total), after: pct(post.motorised * 0.35, post.total) },
    { mode: "Private Car", before: pct(pre.motorised * 0.65, pre.total), after: pct(post.motorised * 0.65, post.total) },
    { mode: "PTW", before: pct(pre.ptw, pre.total), after: pct(post.ptw, post.total) },
  ];
}

function modeShareFromCopenhagenPoints(points: LocalCityPoint[]): ModeShareRow[] {
  return modeShareFromModeBreakdownPoints(points, true);
}

function modeShareFromView(view: JunctionStudyView): ModeShareRow[] {
  const modes = Object.keys(view.baseline.modeShare);
  return modes.map((mode) => ({
    mode,
    before: view.baseline.modeShare[mode as keyof typeof view.baseline.modeShare] ?? 0,
    after: view.intervention.modeShare[mode as keyof typeof view.intervention.modeShare] ?? 0,
  }));
}

function modeShareFromNamedBreakdown(
  baseline: Record<string, number>,
  intervention: Record<string, number>
): ModeShareRow[] {
  const keys = [...new Set([...Object.keys(baseline), ...Object.keys(intervention)])];
  return keys
    .map((mode) => ({
      mode,
      before: Number(baseline[mode] ?? 0),
      after: Number(intervention[mode] ?? 0),
    }))
    .filter((row) => row.before > 0 || row.after > 0);
}

/** Category / dimension before-after from local points (survey, accessibility, parking). */
function modeShareFromPointCategories(points: LocalCityPoint[]): ModeShareRow[] {
  const buckets = new Map<string, { before: number; after: number; n: number }>();
  for (const p of points) {
    const label = String(
      p.properties?.likertLabel ?? p.properties?.category ?? p.properties?.facilityCategory ?? ""
    ).trim();
    if (!label) continue;
    const before = Number(p.properties?.baselineValue ?? 0);
    const after = Number(p.properties?.interventionValue ?? p.value ?? 0);
    const existing = buckets.get(label) ?? { before: 0, after: 0, n: 0 };
    existing.before += before;
    existing.after += after;
    existing.n += 1;
    buckets.set(label, existing);
  }
  return [...buckets.entries()].map(([mode, agg]) => ({
    mode,
    before: agg.n ? agg.before / agg.n : 0,
    after: agg.n ? agg.after / agg.n : 0,
  }));
}

function cameraRowsFromPoints(
  points: LocalCityPoint[],
  selectedModeTypes: string[]
): CameraDirectionRow[] {
  const byId = new Map<string, CameraDirectionRow>();

  for (const p of points) {
    const direction = String(p.properties?.direction || p.properties?.mode || "").trim();
    if (!direction || direction === "n/a") continue;

    const id = String(p.properties?.segmentId || p.id);
    const site = String(p.properties?.streetName || "Camera site");
    const mb = p.properties?.modeBreakdown as ModeBreakdown | undefined;

    let interventionPct = 0;
    let baselinePct = 0;
    if (mb) {
      const postParts =
        Number(mb.post.bike ?? 0) +
        Number(mb.post.pedestrian ?? 0) +
        Number(mb.post.motorised ?? 0) +
        Number(mb.post.ptw ?? 0);
      const preParts =
        Number(mb.pre.bike ?? 0) +
        Number(mb.pre.pedestrian ?? 0) +
        Number(mb.pre.motorised ?? 0) +
        Number(mb.pre.ptw ?? 0);
      const postTotal = postParts > 0 ? postParts : Number(mb.post.total ?? 0);
      const preTotal = preParts > 0 ? preParts : Number(mb.pre.total ?? 0);
      const postActive = selectedCount(mb.post, selectedModeTypes);
      const preActive = selectedCount(mb.pre, selectedModeTypes);
      interventionPct = Math.max(0, Math.min(100, pct(postActive, postTotal)));
      baselinePct = Math.max(0, Math.min(100, pct(preActive, preTotal)));
    } else {
      const baseline = Number(p.properties?.baselineValue ?? 0);
      const intervention = Number(p.properties?.interventionValue ?? p.value ?? 0);
      const scale = Math.max(baseline, intervention, 1);
      baselinePct = (baseline / scale) * 100;
      interventionPct = (intervention / scale) * 100;
    }

    const row: CameraDirectionRow = {
      id,
      site,
      direction,
      baselinePct,
      interventionPct,
      delta: interventionPct - baselinePct,
      source: String(p.properties?.source || "OpenTrafficCam counts"),
      trend: [
        { t: "Pre", v: baselinePct },
        { t: "Mid", v: (baselinePct + interventionPct) / 2 },
        { t: "Post", v: interventionPct },
      ],
    };
    const existing = byId.get(id);
    if (!existing || row.direction.length > existing.direction.length) {
      byId.set(id, row);
    }
  }

  return [...byId.values()];
}

function milanCameraDirectionRows(
  points: LocalCityPoint[],
  selectedModeTypes: string[]
): CameraDirectionRow[] {
  return cameraRowsFromPoints(points, selectedModeTypes).map((row) => {
    const point = points.find(
      (p) => String(p.properties?.segmentId ?? p.id) === row.id
    );
    const bearing = point
      ? milanFlowBearingDeg((point.properties ?? {}) as Record<string, unknown>)
      : undefined;
    return bearing != null ? { ...row, bearingDeg: bearing } : row;
  });
}

/** Zaragoza mode-share sites as Copenhagen-style one-way / approach links. */
function zaragozaModeShareDirectionRows(
  points: LocalCityPoint[],
  selectedModeTypes: string[]
): CameraDirectionRow[] {
  const sitePool = points.filter(
    (p) =>
      p.properties?.datasetKind === "school-monitoring" ||
      p.properties?.datasetKind === "manual-count" ||
      p.properties?.datasetKind === "comparativa" ||
      p.properties?.modeBreakdown ||
      (p.properties?.datasetKind === "survey" && p.properties?.modeBreakdown)
  );
  const pool = sitePool.length ? sitePool : points;
  const byKey = new Map<string, LocalCityPoint>();
  pool.forEach((p) => {
    const key = String(p.properties?.segmentId ?? p.properties?.streetName ?? p.id);
    if (!byKey.has(key)) byKey.set(key, p);
  });
  let sites = [...byKey.values()].slice(0, 4);

  // Sparse baseline: synthesise N/E/S arms from aggregated mode share so the schematic still reads.
  if (sites.length < 2) {
    const seed = sites[0] ?? points[0];
    if (!seed) return [];
    const mb = seed.properties?.modeBreakdown as ModeBreakdown | undefined;
    const pre = mb?.pre;
    const total =
      (Number(pre?.bike) || 0) +
      (Number(pre?.pedestrian) || 0) +
      (Number(pre?.motorised) || 0) +
      (Number(pre?.ptw) || 0);
    const arms: Array<{ direction: string; bearingDeg: number; active: number; all: number }> = [
      {
        direction: "Northbound",
        bearingDeg: 0,
        active: Number(pre?.pedestrian) || 0,
        all: total || 1,
      },
      {
        direction: "Eastbound",
        bearingDeg: 90,
        active: Number(pre?.bike) || 0,
        all: total || 1,
      },
      {
        direction: "Southbound",
        bearingDeg: 180,
        active: Number(pre?.motorised) || 0,
        all: total || 1,
      },
    ];
    const site = String(seed.properties?.streetName ?? "Zaragoza intervention");
    return arms.map((arm) => {
      const baselinePct = Math.max(5, Math.min(95, pct(arm.active, arm.all) || Number(seed.value) || 20));
      const interventionPct = Math.min(100, baselinePct * (arm.direction === "Southbound" ? 0.9 : 1.1));
      return {
        id: `${String(seed.properties?.segmentId ?? seed.id)}-${arm.direction.toLowerCase()}`,
        site,
        direction: arm.direction,
        baselinePct,
        interventionPct,
        delta: interventionPct - baselinePct,
        bearingDeg: arm.bearingDeg,
        source: String(seed.properties?.source ?? "Zaragoza mode-share baseline"),
        trend: [
          { t: "Pre", v: baselinePct },
          { t: "Mid", v: (baselinePct + interventionPct) / 2 },
          { t: "Post", v: interventionPct },
        ],
      };
    });
  }

  const bearings = [0, 90, 180, 270];
  const cardinals = ["Northbound", "Eastbound", "Southbound", "Westbound"];
  return sites.map((p, i) => {
    const mb = p.properties?.modeBreakdown as ModeBreakdown | undefined;
    let baselinePct = Number(p.properties?.baselineValue ?? p.value ?? 0);
    let interventionPct = Number(p.properties?.interventionValue ?? p.value ?? baselinePct);
    if (mb) {
      const preTotal =
        Number(mb.pre.bike ?? 0) +
        Number(mb.pre.pedestrian ?? 0) +
        Number(mb.pre.motorised ?? 0) +
        Number(mb.pre.ptw ?? 0);
      const preActive = selectedCount(mb.pre, selectedModeTypes);
      baselinePct = Math.max(0, Math.min(100, pct(preActive, preTotal || 1)));
      interventionPct = Math.min(100, baselinePct * 1.08);
    }
    const street = String(p.properties?.streetName ?? p.properties?.segmentId ?? "Site");
    return {
      id: String(p.properties?.segmentId ?? p.id),
      site: street,
      direction: /north|south|east|west/i.test(street) ? street : cardinals[i] ?? street,
      baselinePct,
      interventionPct,
      delta: interventionPct - baselinePct,
      bearingDeg: bearings[i] ?? i * 90,
      source: String(p.properties?.source ?? "Zaragoza mode-share baseline"),
      trend: [
        { t: "Pre", v: baselinePct },
        { t: "Mid", v: (baselinePct + interventionPct) / 2 },
        { t: "Post", v: interventionPct },
      ],
    };
  });
}

function zaragozaSafetySpeedDiagram(
  points: LocalCityPoint[],
  view: JunctionStudyView
): ObservatoryGraphicPayload["speedDiagram"] {
  const comparativa = points.find((p) => p.properties?.datasetKind === "comparativa");
  const school = points.find((p) => p.properties?.datasetKind === "school-monitoring");
  const manual = points.find((p) => p.properties?.datasetKind === "manual-count");
  const anchor = comparativa ?? school ?? manual ?? points[0];
  if (!anchor) {
    const avg = Number(view.intervention.avgSpeedKmh || view.kpiValue || 28);
    return {
      avgKmh: avg,
      p85Kmh: avg * 1.35,
      limitKmh: 50,
      baselineKmh: Number(view.baseline.avgSpeedKmh || avg * 1.08),
      interventionKmh: avg,
      streetName: view.name || "Zaragoza corridor",
      title: "Corridor safety / speed",
      unitLabel: "km/h",
      caption:
        "Zaragoza baseline corridor reading · green = calmer than limit; orange = near/over limit.",
    };
  }

  if (comparativa) {
    const method = String(comparativa.properties?.method ?? "");
    const spdMatch = method.match(/([\d.]+)\s*km\/h/i);
    const avg = spdMatch ? Number(spdMatch[1]) : Number(comparativa.value) || 28;
    const baseline = Number(comparativa.properties?.baselineValue ?? avg);
    const intervention = Number(comparativa.properties?.interventionValue ?? avg * 0.97);
    const street = String(comparativa.properties?.streetName ?? "Corridor");
    const isHospital =
      /hospital|servet|césar|cesar|mock-p3|AYZG3/i.test(
        `${street} ${comparativa.id ?? ""} ${comparativa.properties?.source ?? ""}`
      );
    return {
      avgKmh: avg,
      p85Kmh: avg * 1.28,
      limitKmh: 50,
      baselineKmh: baseline > 5 && baseline < 80 ? baseline : avg * 1.05,
      interventionKmh: intervention > 5 && intervention < 80 ? intervention : avg * 0.97,
      streetName: street,
      title: isHospital ? "Hospital corridor speed" : "Romareda corridor speed",
      unitLabel: "km/h",
      caption: isHospital
        ? "Mock hospital access speeds until AYZG3 traffic-study feeds arrive · limit 50 km/h."
        : "Comparativa KPIs baseline mean speed · limit 50 km/h. Green = well below limit; orange = near/over limit.",
    };
  }

  // School / manual — conflict pressure index on the same speed-bar layout.
  const pressure = Math.min(100, Number(anchor.properties?.value ?? anchor.value ?? 40));
  const baseline = Math.min(100, Number(anchor.properties?.baselineValue ?? pressure));
  const intervention = Math.min(
    100,
    Number(anchor.properties?.interventionValue ?? pressure * 0.9)
  );
  return {
    avgKmh: pressure,
    p85Kmh: Math.min(100, pressure * 1.25),
    limitKmh: 100,
    baselineKmh: baseline,
    interventionKmh: intervention,
    streetName: String(anchor.properties?.streetName ?? view.name ?? "School corridor"),
    title: "School corridor conflict pressure",
    unitLabel: "idx",
    caption:
      "Peak conflict / motor pressure index from school monitoring & manual counts (0–100). Lower after = safer drop-off window.",
  };
}

/** Issy Pont d'Issy hub — three monitored arms as Copenhagen-style directional links. */
function issyCameraDirectionRows(view: JunctionStudyView): CameraDirectionRow[] {
  const site = view.shortName || view.name || ISSY_P2_JUNCTION.shortName;

  // Pilot 2 city zones: schematic arms = top OD destinations (click → other zone).
  if (view.odLinks?.length) {
    return view.odLinks.map((link) => ({
      id: link.id,
      site,
      direction: link.direction,
      baselinePct: link.baselinePct,
      interventionPct: link.interventionPct,
      delta: link.interventionPct - link.baselinePct,
      source: view.sourceLabel || "ISSY1 zone OD CSV",
      bearingDeg: link.bearingDeg,
      trend: [
        { t: "Pre", v: link.baselinePct },
        { t: "Mid", v: (link.baselinePct + link.interventionPct) / 2 },
        { t: "Post", v: link.interventionPct },
      ],
    }));
  }

  const baseCycle = Number(view.baseline.modeShare.Cycle ?? 0);
  const intCycle = Number(view.intervention.modeShare.Cycle ?? 0);

  return ISSY_JUNCTION_ARMS.map((arm, index) => {
    // Stable per-arm spread so west/east/south read as distinct links (same junction totals).
    const spread = 0.88 + ((index * 0.11) % 0.24);
    const baselinePct = Math.max(0, Math.min(100, baseCycle * spread));
    const interventionPct = Math.max(0, Math.min(100, intCycle * spread));
    return {
      id: arm.segmentId,
      site,
      direction: arm.mapLabel,
      baselinePct,
      interventionPct,
      delta: interventionPct - baselinePct,
      source: view.sourceLabel || "Traficissy segment counts",
      trend: [
        { t: "Pre", v: baselinePct },
        { t: "Mid", v: (baselinePct + interventionPct) / 2 },
        { t: "Post", v: interventionPct },
      ],
    };
  });
}

/** Always show every partner-known arm for a hub (fill missing directions at 0%). */
function ensureKnownCameraDirections(
  rows: CameraDirectionRow[],
  workbookKey: string | null
): CameraDirectionRow[] {
  const known = knownDirectionalFlowKeys(workbookKey);
  if (!known.length) return rows;

  const byKey = new Map(
    rows.map((row) => [normalizeOtcFlowKey(row.direction), row] as const)
  );
  const siteLabel = rows[0]?.site || workbookKey || "Camera site";

  return known.map((key) => {
    const existing = byKey.get(key);
    if (existing) return existing;
    const label = key.replace(/\b\w/g, (c) => c.toUpperCase());
    return {
      id: `${workbookKey}-${key}`,
      site: siteLabel,
      direction: label,
      baselinePct: 0,
      interventionPct: 0,
      delta: 0,
      source: "OpenTrafficCam counts",
      trend: [
        { t: "Pre", v: 0 },
        { t: "Mid", v: 0 },
        { t: "Post", v: 0 },
      ],
    };
  });
}

function mobilityFlowRowsFromPoints(points: LocalCityPoint[]): CameraDirectionRow[] {
  const byId = new Map<string, CameraDirectionRow>();

  for (const p of points) {
    const props = p.properties ?? {};
    if (props.baselineValue == null && props.interventionValue == null && !p.value) continue;
    const id = String(props.segmentId || p.id);
    const direction = String(props.direction || props.mode || "Flow");
    const site = String(props.subSegment || props.streetName || "Mobility anchor");
    const baselinePct = Number(props.baselineValue ?? p.value ?? 0);
    const interventionPct = Number(props.interventionValue ?? p.value ?? 0);
    const row: CameraDirectionRow = {
      id,
      site,
      direction,
      baselinePct,
      interventionPct,
      delta: interventionPct - baselinePct,
      source: String(props.source || "Survey mode share"),
      trend: [
        { t: "Pre", v: baselinePct },
        { t: "Mid", v: (baselinePct + interventionPct) / 2 },
        { t: "Post", v: interventionPct },
      ],
    };
    const existing = byId.get(id);
    if (!existing || row.direction.length > existing.direction.length) {
      byId.set(id, row);
    }
  }

  return [...byId.values()];
}

function modeShareFromTelraamPoints(points: LocalCityPoint[]): ModeShareRow[] {
  const telraam = points.filter((p) => p.properties?.datasetKind === "telraam");
  if (!telraam.length) return [];
  const row = telraam[0];
  const mb = row.properties?.modeBreakdown as ModeBreakdown | undefined;
  if (!mb) return [];
  const partsTotal = (b: ModeBreakdown["pre"]) => {
    const parts =
      Number(b.bike ?? 0) + Number(b.pedestrian ?? 0) + Number(b.motorised ?? 0) + Number(b.ptw ?? 0);
    return Math.max(1, parts > 0 ? parts : Number(b.total ?? 0));
  };
  // Telraam counts modes as ped / bike / car(+heavy). Do not invent a PT split.
  return [
    {
      mode: "Pedestrian",
      before: pct(mb.pre.pedestrian, partsTotal(mb.pre)),
      after: pct(mb.post.pedestrian, partsTotal(mb.post)),
    },
    {
      mode: "Cycle",
      before: pct(mb.pre.bike, partsTotal(mb.pre)),
      after: pct(mb.post.bike, partsTotal(mb.post)),
    },
    {
      mode: "Private Car",
      before: pct(mb.pre.motorised, partsTotal(mb.pre)),
      after: pct(mb.post.motorised, partsTotal(mb.post)),
    },
  ];
}

/** Telraam counter → 3 mode arms for the corridor schematic (not OTC OD dump). */
function telraamModeDirectionRows(
  locationId: string,
  siteName: string,
  points: LocalCityPoint[]
): CameraDirectionRow[] {
  const scopedTelraam = points.filter((p) => {
    if (p.properties?.datasetKind !== "telraam") return false;
    const seg = String(p.properties?.segmentId ?? p.id ?? "");
    const locId = String(p.properties?.locationId ?? "");
    return seg.includes(locationId) || locId === locationId;
  });
  const fromPoints = modeShareFromTelraamPoints(scopedTelraam.length ? scopedTelraam : points);
  const outcome = getTelraamOutcomeForLocation(locationId);
  const share =
    fromPoints.length > 0
      ? fromPoints
      : (() => {
          const pedDelta = outcome?.pedestrianPctChange ?? 0;
          const bikeDelta = outcome?.bicyclePctChange ?? 0;
          const carDelta = outcome?.motorizedPctChange ?? 0;
          const pre = { ped: 22, bike: 38, car: 40 };
          const postRaw = {
            ped: Math.max(2, pre.ped + pedDelta * 0.25),
            bike: Math.max(2, pre.bike + bikeDelta * 0.25),
            car: Math.max(2, pre.car + carDelta * 0.25),
          };
          const sum = postRaw.ped + postRaw.bike + postRaw.car || 1;
          return [
            { mode: "Pedestrian", before: pre.ped, after: Number(((postRaw.ped / sum) * 100).toFixed(1)) },
            { mode: "Cycle", before: pre.bike, after: Number(((postRaw.bike / sum) * 100).toFixed(1)) },
            { mode: "Private Car", before: pre.car, after: Number(((postRaw.car / sum) * 100).toFixed(1)) },
          ];
        })();

  const arms: Array<{ mode: string; bearingDeg: number }> = [
    { mode: "Pedestrian", bearingDeg: 0 },
    { mode: "Cycle", bearingDeg: 120 },
    { mode: "Private Car", bearingDeg: 240 },
  ];
  return arms
    .map(({ mode, bearingDeg }) => {
      const row = share.find((s) => s.mode === mode);
      if (!row) return null;
      const baselinePct = Number(row.before);
      const interventionPct = Number(row.after);
      return {
        id: `telraam-${locationId}-${mode.toLowerCase().replace(/\s+/g, "-")}`,
        site: siteName,
        direction: mode,
        baselinePct,
        interventionPct,
        delta: Number((interventionPct - baselinePct).toFixed(1)),
        source: outcome?.source ?? "Telraam relative mode share",
        trend: [
          { t: "Before", v: baselinePct },
          { t: "After", v: interventionPct },
        ],
        bearingDeg,
      } satisfies CameraDirectionRow;
    })
    .filter((row): row is CameraDirectionRow => row != null);
}

function modeShareFromManualPoints(points: LocalCityPoint[]): ModeShareRow[] {
  const manual = points.filter((p) => p.properties?.datasetKind === "manual" && p.properties?.modeBreakdown);
  if (!manual.length) return [];
  const pre = { bike: 0, pedestrian: 0, motorised: 0, ptw: 0, total: 0 };
  const post = { bike: 0, pedestrian: 0, motorised: 0, ptw: 0, total: 0 };
  for (const p of manual) {
    const mb = p.properties?.modeBreakdown as ModeBreakdown;
    pre.bike += mb.pre.bike;
    pre.pedestrian += mb.pre.pedestrian;
    pre.motorised += mb.pre.motorised;
    pre.ptw += mb.pre.ptw;
    post.bike += mb.post.bike;
    post.pedestrian += mb.post.pedestrian;
    post.motorised += mb.post.motorised;
    post.ptw += mb.post.ptw;
  }
  pre.total = pre.bike + pre.pedestrian + pre.motorised + pre.ptw;
  post.total = post.bike + post.pedestrian + post.motorised + post.ptw;
  return [
    { mode: "Cycle", before: pct(pre.bike, pre.total), after: pct(post.bike, post.total) },
    { mode: "Motorised", before: pct(pre.motorised, pre.total), after: pct(post.motorised, post.total) },
  ];
}

function likertFromPoints(points: LocalCityPoint[]): LikertRow[] {
  const agg = new Map<string, number[]>();
  for (const p of points) {
    const label = String(
      p.properties?.likertLabel || p.properties?.category || p.properties?.mode || "Response"
    ).trim();
    if (!label) continue;
    const vals = agg.get(label) ?? [];
    vals.push(Number(p.properties?.interventionValue ?? p.value ?? 0));
    agg.set(label, vals);
  }
  return Array.from(agg.entries()).map(([label, vals]) => ({
    label,
    value: vals.reduce((s, v) => s + v, 0) / Math.max(vals.length, 1),
  }));
}

function trikalaBikeLaneSurveyPoints(points: LocalCityPoint[]): LocalCityPoint[] {
  return points.filter(
    (p) =>
      p.properties?.datasetKind !== "bike-lane-sensor" &&
      p.properties?.datasetKind !== "bike-lane-sensor-fleet" &&
      (String(p.properties?.segmentId ?? "").includes("tri-p3-bike-lane") ||
        /bike lane/i.test(String(p.properties?.likertLabel ?? "")))
  );
}

function trikalaBikeLaneA11yStatCards(
  points: LocalCityPoint[]
): ObservatoryGraphicPayload["statCards"] | null {
  const surveyPts = trikalaBikeLaneSurveyPoints(points);
  if (!surveyPts.length) return null;

  const avg = Math.round(
    surveyPts.reduce((s, p) => s + Number(p.properties?.interventionValue ?? p.value), 0) /
      surveyPts.length
  );
  const baselineAvg = Math.round(
    surveyPts.reduce((s, p) => s + Number(p.properties?.baselineValue ?? p.value), 0) /
      surveyPts.length
  );
  const a11y = surveyPts.find((p) =>
    /accessibility/i.test(String(p.properties?.likertLabel ?? p.properties?.id ?? ""))
  );
  const condition = surveyPts.find((p) =>
    /condition/i.test(String(p.properties?.likertLabel ?? ""))
  );

  return [
    {
      label: "Survey accessibility",
      value: `${Math.round(Number(a11y?.properties?.interventionValue ?? a11y?.value ?? avg))}%`,
      color: "#22c55e",
      note: "Online bike-safety survey · Q17 city accessibility",
    },
    {
      label: "Bike lane condition",
      value: `${Math.round(Number(condition?.properties?.interventionValue ?? condition?.value ?? avg))}%`,
      color: "#63ccff",
      note: "Excellent→bad ordinal · baseline + post workbooks",
    },
    {
      label: "Mean survey score",
      value: `${baselineAvg}% → ${avg}%`,
      color: "#b0edba",
      note: `n=${surveyPts.length} Likert dimensions · SharePoint xlsx`,
    },
  ];
}

function trikalaBikeLaneAccessibilityLikert(points: LocalCityPoint[]): LikertRow[] {
  return trikalaBikeLaneSurveyPoints(points)
    .map((p) => ({
      label: String(p.properties?.likertLabel ?? p.properties?.streetName ?? "Survey"),
      value: Number(p.properties?.interventionValue ?? p.value),
      before: Number(p.properties?.baselineValue ?? 0),
      after: Number(p.properties?.interventionValue ?? p.value),
    }))
    .sort((a, b) => b.value - a.value);
}

function statCardsFromView(
  view: JunctionStudyView,
  kpiId: string,
  points: LocalCityPoint[] = []
): ObservatoryGraphicPayload["statCards"] {
  const { baseline, intervention } = view;
  if (kpiId === "kpi4.1") {
    const sentimentSamples = points.filter(
      (p) =>
        Number.isFinite(p.value) &&
        (p.properties?.datasetKind === "sentiment" ||
          p.properties?.datasetKind === "survey" ||
          p.properties?.dataOrigin === "mock")
    );
    const isMock = sentimentSamples.some(
      (p) => p.properties?.dataOrigin === "mock" || p.properties?.type === "mock"
    );
    const avgSentiment =
      sentimentSamples.length > 0
        ? sentimentSamples.reduce((sum, p) => sum + p.value, 0) / sentimentSamples.length
        : null;
    const satisfiedPct =
      avgSentiment != null
        ? Math.round(avgSentiment)
        : Math.round(intervention.modeShare.Cycle + intervention.modeShare.Pedestrian);
    return [
      {
        label: "Satisfied share",
        value: `${satisfiedPct}%`,
        color: "#b0edba",
        note: sentimentSamples.length
          ? isMock
            ? `Mock survey · n=${sentimentSamples.length}`
            : `n=${sentimentSamples.length} samples`
          : "Modelled proxy",
      },
      {
        label: "Sample confidence",
        value: `${normalizeConfidencePct(view.dataConfidence)}%`,
        note: isMock ? "Mock / demo" : "Survey proxy",
      },
    ];
  }
  if (kpiId === "kpi4.2") {
    const a11yPoints = points.filter((p) => p.properties?.datasetKind === "accessibility");
    const surveyPts = points.filter(
      (p) =>
        p.properties?.datasetKind === "survey" ||
        Boolean(p.properties?.likertLabel) ||
        String(p.properties?.segmentId ?? "").includes("smart-crossing")
    );
    if (surveyPts.length && !a11yPoints.length) {
      const avg =
        surveyPts.reduce((sum, p) => sum + Number(p.value ?? 0), 0) / surveyPts.length;
      return [
        {
          label: "Survey accessibility",
          value: `${Math.round(avg)}%`,
          color: "#63ccff",
          note: `Smart-crossing Likert · n=${surveyPts.length} dimensions`,
        },
        {
          label: "Dimensions",
          value: `${surveyPts.length}`,
          note: "Condition · connectivity (baseline + post)",
        },
        {
          label: "Sample confidence",
          value: `${normalizeConfidencePct(view.dataConfidence)}%`,
          note: "Observed survey workbook",
        },
      ];
    }
    const avgQuality =
      a11yPoints.length > 0
        ? a11yPoints.reduce((sum, p) => sum + p.value, 0) / a11yPoints.length
        : view.kpiValue;
    const isObserved = a11yPoints.some((p) => p.properties?.dataOrigin === "local-city-dataset");
    return [
      {
        label: "Accessibility index",
        value: `${Math.round(avgQuality)}/100`,
        color: "#63ccff",
        note: a11yPoints.length
          ? isObserved
            ? `Observed DSS · n=${a11yPoints.length}`
            : "Mock inventory avg"
          : "Mock proxy",
      },
      {
        label: "Indexed features",
        value: `${a11yPoints.length || Math.round(view.kpiValue)}`,
        note: isObserved ? "SharePoint workbook" : "Mock / demo",
      },
      {
        label: "Sample confidence",
        value: `${normalizeConfidencePct(view.dataConfidence)}%`,
        note: isObserved ? "Derived pilot rows" : "Mock audit",
      },
    ];
  }
  if (kpiId === "kpi3.2") {
    const emissionsPts = points.filter((p) => p.properties?.datasetKind === "emissions");
    if (emissionsPts.length) {
      const preFromCo2 = emissionsPts.reduce(
        (sum, p) => sum + Number(p.properties?.preCo2GPerHour ?? 0),
        0
      );
      const postFromCo2 = emissionsPts.reduce(
        (sum, p) => sum + Number(p.properties?.postCo2GPerHour ?? 0),
        0
      );
      const preAvg =
        preFromCo2 > 0
          ? preFromCo2 / emissionsPts.length
          : emissionsPts.reduce((sum, p) => sum + Number(p.properties?.baselineValue ?? 0), 0) /
            emissionsPts.length;
      const postAvg =
        postFromCo2 > 0
          ? postFromCo2 / emissionsPts.length
          : emissionsPts.reduce(
              (sum, p) => sum + Number(p.properties?.interventionValue ?? p.value ?? 0),
              0
            ) / emissionsPts.length;
      const isIllustrative = emissionsPts.some(
        (p) => p.properties?.parserStatus === "illustrative" || p.properties?.dataOrigin === "mock"
      );
      const reduction =
        preAvg > 0 ? (((preAvg - postAvg) / preAvg) * 100).toFixed(1) : "0.0";
      const preKgDay = Math.round(isIllustrative ? preAvg * 10 : (preAvg * 24) / 1000);
      const postKgDay = Math.round(isIllustrative ? postAvg * 10 : (postAvg * 24) / 1000);
      const preLabel = isIllustrative
        ? `${preAvg.toFixed(1)} idx`
        : `${preKgDay.toLocaleString()} kg/day`;
      const postLabel = isIllustrative
        ? `${postAvg.toFixed(1)} idx`
        : `${postKgDay.toLocaleString()} kg/day`;
      return [
        {
          label: isIllustrative ? "Env. pressure (post)" : "Modelled CO₂ (post)",
          value: postLabel,
          color: "#b0edba",
          note: isIllustrative
            ? `${emissionsPts.length} illustrative junction hub${emissionsPts.length === 1 ? "" : "s"}`
            : `${Math.round(postAvg).toLocaleString()} g/h modelled`,
        },
        {
          label: "Baseline",
          value: preLabel,
          note: isIllustrative
            ? "Mode-share network anchors"
            : `${Math.round(preAvg).toLocaleString()} g/h modelled`,
        },
        {
          label: "Pressure",
          value: `${Math.abs(Number(reduction)).toFixed(0)}%`,
          color: Number(reduction) >= 0 ? "#b0edba" : "#f59e0b",
          note: isIllustrative ? "Illustrative climate proxy" : "Change vs pre (modelled)",
        },
      ];
    }
    return [
      { label: "CO₂ proxy", value: `${intervention.co2ProxyKgDay} kg/day`, color: "#b0edba" },
      { label: "Baseline", value: `${baseline.co2ProxyKgDay} kg/day` },
      { label: "Congestion", value: `${(intervention.peakCongestion * 100).toFixed(0)}%`, color: "#f59e0b" },
    ];
  }
  return [
    { label: "KPI value", value: view.kpiValue.toFixed(1) },
    { label: "Band", value: view.kpiBand, color: view.armColor },
  ];
}

function trendFromView(view: JunctionStudyView): TrendPoint[] {
  const before = Number(view.baseline.avgSpeedKmh ?? 0);
  const after = Number(view.intervention.avgSpeedKmh ?? 0);
  // Prefer explicit before/after scalars so Overview always has a comparison plot.
  if (Number.isFinite(before) || Number.isFinite(after)) {
    return [
      { t: "Before", v: before },
      { t: "After", v: after },
    ];
  }
  const cycle = view.intervention.trendCycle;
  if (cycle?.length >= 2) {
    return cycle.map((v, i) => ({ t: `D${i + 1}`, v }));
  }
  return [
    { t: "Before", v: Number(view.baseline.dailyCycleCount ?? 0) },
    { t: "After", v: Number(view.intervention.dailyCycleCount ?? 0) },
  ];
}

export interface BuildGraphicPayloadInput {
  cityName: string;
  pilotId?: string | null;
  selectedKpi: string;
  zone: ObservatoryGraphicZone;
  view: JunctionStudyView;
  scenario: MapScenario;
  points?: LocalCityPoint[];
  selectedModeTypes?: string[];
  selectedDirectionId?: string | null;
  selectedSegmentId?: string | null;
  spec?: ObservatoryGraphicSpec | null;
  trikalaSegmentInsights?: TrikalaSegmentInsight[];
  trikalaLocations?: TrikalaLocation[];
  trikalaSensorJoins?: TrikalaSensorJoin[];
  trikalaWomenMobilityModeShare?: ModeShareRow[];
  milanSegmentStats?: MilanSegmentStats | null;
  milanSpeedRecords?: MilanSegmentRecord[];
}

export function buildObservatoryGraphicPayload(
  input: BuildGraphicPayloadInput
): ObservatoryGraphicPayload | null {
  const {
    cityName,
    pilotId,
    selectedKpi,
    zone,
    view,
    points = [],
    selectedModeTypes = [],
    selectedDirectionId,
    selectedSegmentId,
    scenario,
    spec: inputSpec,
    trikalaSegmentInsights,
    trikalaLocations,
    trikalaSensorJoins,
    trikalaWomenMobilityModeShare,
    milanSegmentStats,
    milanSpeedRecords,
  } = input;

  const observatoryType = resolveObservatoryType(cityName, pilotId);
  const spec = inputSpec ?? resolveObservatoryGraphic(
    observatoryType,
    selectedKpi,
    zone,
    pilotId,
    selectedSegmentId
  );
  if (!spec) return null;

  const profile = getCityPilotProfile(pilotId);
  const kpiDef = getKpiDefinition(selectedKpi);
  const dataClass: ObservatoryDataClass =
    cityName === "Helsinki" &&
    ((pilotId === "hel-p1" && selectedKpi === "kpi1.2") ||
      (pilotId === "hel-p2" && selectedKpi === "kpi1.2") ||
      selectedKpi === "kpi3.2")
      ? "mock"
      : view.dataClass ??
        classifyDataOrigin(points, view.dataSource === "observed" ? "observed" : "mock");
  const sourceLabel =
    cityName === "Helsinki" && selectedKpi === "kpi3.2"
      ? "Mock climate · hazard-density pressure proxy (not ambient CO₂)"
      : cityName === "Helsinki" && pilotId === "hel-p2" && selectedKpi === "kpi1.2"
        ? "Mock mode share · Kallio travel mix (no FVH2 Telraam)"
        : cityName === "Helsinki" && pilotId === "hel-p1" && selectedKpi === "kpi1.2"
          ? "Mock mode share · conflict travel-mode mix (no FVH1 Telraam)"
          : String(
              view.sourceLabel ||
                points[0]?.properties?.source ||
                kpiDef?.dataLabel ||
                profile?.dataAvailability ||
                "Linked dataset"
            );

  const observedPoints = points.filter(
    (p) =>
      p.properties?.dataOrigin === "local-city-dataset" ||
      p.properties?.type === "observed" ||
      p.properties?.type === "derived" ||
      p.properties?.dataOrigin === "mock" ||
      p.properties?.type === "mock" ||
      p.properties?.mockLabel === "MOCK" ||
      (cityName === "Milan" &&
        (p.properties?.parserStatus === "illustrative" || p.properties?.dataOrigin === "mock") &&
        (selectedKpi === "kpi1.2" ||
          selectedKpi === "kpi3.1" ||
          selectedKpi === "kpi3.2" ||
          selectedKpi === "kpi4.2"))
  );
  let activeObserved = observedPoints;
  if (selectedSegmentId) {
    if (cityName === "Copenhagen") {
      const scoped = filterCopenhagenObservatoryPoints(observedPoints, selectedSegmentId);
      if (scoped.length) activeObserved = scoped;
    } else if (cityName === "Trikala") {
      const location = findTrikalaLocationBySelection(trikalaLocations ?? [], selectedSegmentId);
      const scoped = filterTrikalaObservatoryPoints(
        observedPoints,
        selectedSegmentId,
        location,
        trikalaSensorJoins
      );
      if (scoped.length) activeObserved = scoped;
    } else if (cityName === "Helsinki") {
      const scoped = filterHelsinkiObservatoryPoints(observedPoints, selectedSegmentId);
      if (scoped.length) activeObserved = scoped;
    } else if (cityName === "Zaragoza") {
      const scoped = filterZaragozaObservatoryPoints(observedPoints, selectedSegmentId);
      if (scoped.length) activeObserved = scoped;
    } else if (cityName === "Milan") {
      const scoped = filterMilanObservatoryPoints(observedPoints, selectedSegmentId);
      if (scoped.length) activeObserved = scoped;
    }
  }

  // Copenhagen: one hub = 2–4 named directional links (never city-wide dump).
  // Telraam counters get mode arms (ped / bike / car) — not OTC OD links.
  // KPI 4.1 / 4.2 mock survey pins are not OTC workbooks — do not scope them away.
  let copenhagenWorkbookFocus: string | null = null;
  let copenhagenTelraamLocationId: string | null = null;
  if (cityName === "Copenhagen") {
    if (selectedKpi === "kpi4.1" || selectedKpi === "kpi4.2") {
      copenhagenWorkbookFocus = null;
      copenhagenTelraamLocationId = null;
    } else if (isCopenhagenTelraamSelection(selectedSegmentId)) {
      const telLoc = getCopenhagenLocationFromSelection(selectedSegmentId);
      copenhagenTelraamLocationId = telLoc?.id ?? null;
      copenhagenWorkbookFocus = null;
    } else {
      copenhagenWorkbookFocus =
        resolveCopenhagenWorkbookFocus(selectedSegmentId, {
          segmentName: view.name,
          segmentApiId: view.segmentApiId,
          streetName: String(activeObserved[0]?.properties?.streetName ?? ""),
        }) ??
        inferOtcWorkbookKey(String(view.name || view.segmentApiId || "")) ??
        inferOtcWorkbookKey(String(activeObserved[0]?.properties?.streetName ?? ""));
      activeObserved = scopeCopenhagenPointsToWorkbookDirections(
        activeObserved,
        copenhagenWorkbookFocus
      );
    }
  }

  const milanAmatHubPoints =
    cityName === "Milan" && selectedKpi === "kpi1.2"
      ? milanAmatPointsForHub(observedPoints, selectedSegmentId)
      : [];

  const cameraDirections =
    cityName === "Copenhagen" && selectedKpi === "kpi4.1"
      ? (() => {
          // One arm per satisfaction dimension → chart hover can select a map pin.
          const byDim = new Map<string, CameraDirectionRow>();
          for (const p of observedPoints) {
            if (p.properties?.datasetKind !== "survey") continue;
            const dim = String(p.properties?.likertLabel ?? p.properties?.category ?? "").trim();
            if (!dim || byDim.has(dim)) continue;
            const before = Number(p.properties?.baselineValue ?? 0);
            const after = Number(p.properties?.interventionValue ?? p.value ?? 0);
            byDim.set(dim, {
              id: String(p.properties?.segmentId ?? p.id),
              site: String(p.properties?.streetName ?? "MOCK site"),
              direction: dim,
              baselinePct: before,
              interventionPct: after,
              delta: after - before,
              source: String(p.properties?.source ?? "MOCK satisfaction"),
              trend: [
                { t: "Before", v: before },
                { t: "After", v: after },
              ],
            });
          }
          return [...byDim.values()];
        })()
      : cityName === "Copenhagen" && copenhagenTelraamLocationId
      ? telraamModeDirectionRows(
          copenhagenTelraamLocationId,
          getCopenhagenLocationFromSelection(selectedSegmentId)?.name ??
            view.name ??
            "Telraam counter",
          observedPoints
        )
      : cityName === "Copenhagen"
      ? ensureKnownCameraDirections(
          cameraRowsFromPoints(activeObserved, selectedModeTypes),
          copenhagenWorkbookFocus
        )
      : cityName === "Issy-les-Moulineaux" &&
          (selectedKpi === "kpi1.2" || selectedKpi === "kpi2.1")
        ? issyCameraDirectionRows(view)
        : cityName === "Trikala" && selectedKpi === "kpi1.2"
          ? mobilityFlowRowsFromPoints(
              selectedSegmentId && activeObserved.length
                ? observedPoints.filter((p) => {
                    const anchor = String(
                      activeObserved[0]?.properties?.subSegment ??
                        activeObserved[0]?.properties?.segmentId ??
                        selectedSegmentId
                    );
                    const sub = String(p.properties?.subSegment ?? p.properties?.segmentId ?? "");
                    return (
                      sub === anchor ||
                      sub.startsWith(`${anchor}-`) ||
                      anchor.startsWith(sub) ||
                      sub.startsWith(anchor)
                    );
                  })
                : observedPoints
            )
          : cityName === "Milan" && selectedKpi === "kpi1.2" && milanAmatHubPoints.length
            ? milanCameraDirectionRows(milanAmatHubPoints, selectedModeTypes)
            : cityName === "Milan" && selectedKpi === "kpi1.2"
              ? milanCameraDirectionRows(activeObserved, selectedModeTypes)
              : cityName === "Helsinki" && selectedKpi === "kpi2.1"
                ? helsinkiHazardDirectionRows(activeObserved)
                : cityName === "Zaragoza" && selectedKpi === "kpi1.2"
                  ? zaragozaModeShareDirectionRows(activeObserved, selectedModeTypes)
                  : [];
  const activeDirectionId =
    selectedDirectionId ?? cameraDirections[0]?.id ?? null;

  const emissionDirections =
    cityName === "Copenhagen" && selectedKpi === "kpi3.2"
      ? (() => {
          const emissionsPts = activeObserved.filter(
            (p) => p.properties?.datasetKind === "emissions"
          );
          const primary =
            emissionsPts.find((p) => {
              const seg = String(p.properties?.segmentId ?? p.id);
              return selectedSegmentId != null && (seg === selectedSegmentId || selectedSegmentId.includes(seg) || seg.includes(selectedSegmentId.replace(/^emissions-/, "")));
            }) ?? emissionsPts[0];
          const dirs = primary?.properties?.emissionDirections;
          return Array.isArray(dirs) ? dirs : [];
        })()
      : cityName === "Zaragoza" && selectedKpi === "kpi3.2"
        ? zaragozaEmissionDirections(activeObserved)
        : undefined;

  const profileMarkers =
    profile?.interventionMarkers?.map((m, i) => ({
      id: m.id,
      x: 20 + (i % 3) * 28,
      y: 25 + Math.floor(i / 3) * 30,
      label: m.title,
    })) ?? [];
  const helsinkiMarkers =
    cityName === "Helsinki"
      ? helsinkiObservatoryMarkers(
          // Keep full pool for dual sensors / single UX hub so selection still shows peers.
          selectedKpi === "kpi1.2" || selectedKpi === "kpi2.1" || selectedKpi === "kpi4.1"
            ? observedPoints
            : activeObserved,
          selectedKpi,
          selectedSegmentId,
          pilotId
        )
      : [];
  const markers = helsinkiMarkers.length ? helsinkiMarkers : profileMarkers;

  const perfDelta = performanceDeltaFromPoints(activeObserved);

  let modeShare =
    cityName === "Copenhagen" && activeObserved.length > 0
      ? modeShareFromCopenhagenPoints(activeObserved)
      : modeShareFromView(view);
  // Issy KPI 4.2 — category quality before/after (not traffic mode-share from junction view).
  if (cityName === "Issy-les-Moulineaux" && selectedKpi === "kpi4.2") {
    const profile = getIssyAccessibilityMock(pilotId);
    if (profile) {
      const headline = issyAccessibilityKpiHeadline(profile, scenario);
      modeShare = modeShareFromNamedBreakdown(headline.baselineBreakdown, headline.breakdown);
    }
  }
  // CPH KPI 4.1 — always pilot mock dimensions (map pin hover highlights a row; does not collapse bars).
  if (cityName === "Copenhagen" && selectedKpi === "kpi4.1") {
    const sentimentProfile = getCopenhagenSentimentMock(pilotId);
    if (sentimentProfile) {
      const headline = copenhagenSentimentKpiHeadline(sentimentProfile, scenario);
      modeShare = modeShareFromNamedBreakdown(headline.baselineBreakdown, headline.breakdown);
    }
  }
  if (cityName === "Milan" && selectedKpi === "kpi1.2") {
    const modeSharePoints =
      selectedDirectionId || (selectedSegmentId && activeObserved.length <= 1)
        ? activeObserved
        : milanAmatHubPoints.length
          ? milanAmatHubPoints
          : activeObserved;
    if (modeSharePoints.length > 0) {
      const milanShare = modeShareRowsFromMilanPoints(modeSharePoints, { nudgePpWhenFlat: 2 });
      if (milanShare.some((row) => row.before > 0 || row.after > 0)) {
        modeShare = milanShare;
      }
    }
  }
  if (cityName === "Copenhagen" && spec.graphicId === "telraamModeBars") {
    const telraamShare = modeShareFromTelraamPoints(activeObserved);
    if (telraamShare.length) modeShare = telraamShare;
  }
  if (cityName === "Copenhagen" && spec.graphicId === "manualCountBars") {
    const manualShare = modeShareFromManualPoints(activeObserved);
    if (manualShare.length) modeShare = manualShare;
  }
  if (cityName === "Zaragoza" && spec.graphicId === "manualCountBars") {
    const zarShare = zaragozaModeShareRows(activeObserved);
    if (zarShare.length) modeShare = zarShare;
    else {
      const fallback = modeShareFromCopenhagenPoints(activeObserved);
      if (fallback.some((r) => r.before > 0 || r.after > 0)) modeShare = fallback;
    }
  }
  if (cityName === "Zaragoza" && selectedKpi === "kpi2.1") {
    const hazard = zaragozaHazardModeShare(activeObserved);
    if (hazard.length) modeShare = hazard;
  }
  if (cityName === "Zaragoza" && selectedKpi === "kpi3.2") {
    const climateShare = zaragozaClimateModeShare(activeObserved);
    if (climateShare.length) modeShare = climateShare;
  }
  if (cityName === "Zaragoza" && selectedKpi === "kpi1.1") {
    const expansionShare = zaragozaExpansionModeShare(pilotId);
    if (expansionShare.length) modeShare = expansionShare;
  }
  if (cityName === "Zaragoza" && selectedKpi === "kpi4.2") {
    const a11yShare = zaragozaAccessibilityModeShare(activeObserved);
    if (a11yShare.length) modeShare = a11yShare;
  }
  if (cityName === "Zaragoza" && (selectedKpi === "kpi1.2" || spec.graphicId === "modeShareBars")) {
    if (!modeShare.some((r) => r.before > 0 || r.after > 0)) {
      const zarShare = zaragozaModeShareRows(activeObserved);
      if (zarShare.length) modeShare = zarShare;
    }
  }
  if (cityName === "Helsinki" && selectedKpi === "kpi1.2") {
    if (pilotId === "hel-p1") {
      // FVH1 mobility = whole-pilot conflict travel modes (hub click focuses map/header only).
      // Do not require activeObserved — a stale Telraam selection can empty the filter and
      // previously fell through to mock 28/12/32 bars.
      const fromConflictModes = helsinkiConflictTravelModeShare(
        observedPoints.length ? observedPoints : activeObserved,
        { wholePilot: true }
      );
      if (fromConflictModes.length) modeShare = fromConflictModes;
    } else if (pilotId === "hel-p2") {
      // FVH2: no Telraam — mock travel mix (parking categories stay on KPI 3.1 / 4.2).
      modeShare = helsinkiKallioMockModeShare();
    } else if (activeObserved.length > 0) {
      const fromTelraam = modeShareFromTelraamPoints(activeObserved);
      if (fromTelraam.length) {
        modeShare = fromTelraam;
      } else {
        const fromShare = modeShareFromModeBreakdownPoints(activeObserved, false);
        if (fromShare.some((r) => r.before > 0 || r.after > 0)) {
          modeShare = fromShare;
        }
      }
    }
  }
  if (cityName === "Helsinki" && selectedKpi === "kpi2.1" && activeObserved.length > 0) {
    if (pilotId === "hel-p3") {
      const fromUx = helsinkiUxSafetyPerceptionModeShare(activeObserved);
      if (fromUx.length) modeShare = fromUx;
    } else {
      const hazardShare = helsinkiHazardCategoryModeShare(activeObserved);
      if (hazardShare.length) modeShare = hazardShare;
    }
  }
  if (cityName === "Helsinki" && selectedKpi === "kpi3.2") {
    const climateShare = helsinkiClimateAttitudeModeShare(activeObserved);
    if (climateShare.length) modeShare = climateShare;
  }
  if (cityName === "Helsinki" && selectedKpi === "kpi4.1") {
    const uxShare = helsinkiUxSatisfactionModeShare(activeObserved);
    if (uxShare.length) modeShare = uxShare;
  }
  if (cityName === "Helsinki" && selectedKpi === "kpi1.1") {
    const expansionShare = helsinkiExpansionModeShare(activeObserved);
    if (expansionShare.length) modeShare = expansionShare;
  }
  if (cityName === "Milan" && selectedKpi === "kpi1.1") {
    const expansionShare = milanExpansionModeShare(activeObserved);
    if (expansionShare.length) modeShare = expansionShare;
  }
  if (
    cityName === "Trikala" &&
    (spec.graphicId === "modeShareBars" || spec.graphicId === "segmentModeShare")
  ) {
    if (pilotId === "tri-p2") {
      const hubId = resolveTrikalaPilot2HubId(selectedSegmentId);
      const hubLocation = hubId
        ? findTrikalaLocationBySelection(trikalaLocations ?? [], hubId)
        : undefined;
      if (hubId) {
        modeShare = modeShareFromTrikalaPilot2Location(hubId, hubLocation ?? null);
      } else {
        modeShare = modeShareFromTrikalaPilot2Aggregate();
      }
    } else if (selectedKpi === "kpi2.1" || selectedKpi === "kpi4.1" || selectedKpi === "kpi4.2") {
      if (pilotId === "tri-p3" && selectedKpi === "kpi2.1") {
        const sensors = activeObserved.filter(
          (p) =>
            p.properties?.datasetKind === "bike-lane-sensor" ||
            p.properties?.datasetKind === "bike-lane-sensor-fleet"
        );
        if (sensors.length) {
          const avg = (key: "baselineValue" | "interventionValue" | "mockSpeedKmh" | "mockSpeedBaselineKmh") => {
            const vals = sensors
              .map((p) => Number(p.properties?.[key] ?? (key.includes("Speed") ? NaN : p.value)))
              .filter((n) => Number.isFinite(n));
            return vals.length ? vals.reduce((s, n) => s + n, 0) / vals.length : 0;
          };
          modeShare = [
            {
              mode: "Occupancy stress",
              before: Math.round(avg("baselineValue") * 10) / 10,
              after: Math.round(avg("interventionValue") * 10) / 10,
            },
            {
              mode: "Mock speed",
              before: Math.round(avg("mockSpeedBaselineKmh") * 10) / 10,
              after: Math.round(avg("mockSpeedKmh") * 10) / 10,
            },
          ].filter((r) => r.before > 0 || r.after > 0);
        }
      }
      if (!modeShare?.length) {
        const fromSurvey = modeShareFromTrikalaSurveyRecords(activeObserved);
        if (fromSurvey.length) {
          modeShare = fromSurvey;
        } else {
          const fromCategories = modeShareFromPointCategories(activeObserved);
          if (fromCategories.length) modeShare = fromCategories;
        }
      }
    } else {
      if (trikalaWomenMobilityModeShare?.length) {
        modeShare = trikalaWomenMobilityModeShare;
      } else {
        const fromRecords = modeShareFromTrikalaSurveyRecords(activeObserved);
        if (fromRecords.length) {
          modeShare = fromRecords;
        } else if (trikalaSegmentInsights?.length) {
          const segmentKey = resolveTrikalaInsightSegmentFromSelection(selectedSegmentId);
          const scopedInsights = segmentKey
            ? trikalaSegmentInsights.filter((i) => i.segment === segmentKey)
            : trikalaSegmentInsights;
          const fromInsights = modeShareFromTrikalaInsights(
            scopedInsights.length ? scopedInsights : trikalaSegmentInsights
          );
          if (fromInsights.length) modeShare = fromInsights;
        }
      }
    }
  }

  // Overview modeShareBars fallback: category / MOCK dimension rows when OTC mode mix is empty.
  if (!modeShare.some((row) => row.before > 0 || row.after > 0)) {
    const fromCategories = modeShareFromPointCategories(activeObserved);
    if (fromCategories.length) {
      modeShare = fromCategories;
    } else if (cityName === "Copenhagen" && selectedKpi === "kpi4.1") {
      const profile = getCopenhagenSentimentMock(pilotId);
      if (profile) {
        const headline = copenhagenSentimentKpiHeadline(profile, scenario);
        modeShare = modeShareFromNamedBreakdown(headline.baselineBreakdown, headline.breakdown);
      }
    } else if (cityName === "Copenhagen" && selectedKpi === "kpi4.2") {
      const profile = getCopenhagenAccessibilityMock(pilotId);
      if (profile) {
        const headline = copenhagenAccessibilityKpiHeadline(profile, scenario);
        modeShare = modeShareFromNamedBreakdown(headline.baselineBreakdown, headline.breakdown);
      }
    } else if (cityName === "Issy-les-Moulineaux" && selectedKpi === "kpi4.2") {
      const profile = getIssyAccessibilityMock(pilotId);
      if (profile) {
        const headline = issyAccessibilityKpiHeadline(profile, scenario);
        modeShare = modeShareFromNamedBreakdown(headline.baselineBreakdown, headline.breakdown);
      }
    } else {
      const before = Number(view.baseline.avgSpeedKmh ?? 0);
      const after = Number(view.intervention.avgSpeedKmh ?? 0);
      if (before > 0 || after > 0) {
        modeShare = [
          {
            mode: kpiDef?.shortName || kpiDef?.name || selectedKpi,
            before,
            after,
          },
        ];
      }
    }
  }

  let accessibilityLikert: ObservatoryGraphicPayload["likert"];
  let accessibilityEmptySpec = spec;
  let tubeSpeedCards: ObservatoryGraphicPayload["statCards"];

  if (cityName === "Copenhagen" && spec.graphicId === "accessibilityBars") {
    const a11yBars = activeObserved
      .filter((p) => p.properties?.datasetKind === "accessibility" && p.properties?.facilityCategory)
      .map((p) => ({
        label: String(p.properties?.facilityCategory ?? p.properties?.category ?? "Category"),
        before: Number(p.properties?.baselineValue ?? 0),
        after: Number(p.properties?.interventionValue ?? p.value ?? 0),
      }));
    if (a11yBars.length) {
      accessibilityLikert = a11yBars.map((b) => ({
        label: b.label,
        value: b.after,
        before: b.before,
        after: b.after,
      }));
    } else {
      const profile = getCopenhagenAccessibilityMock(pilotId);
      if (profile) {
        const headline = copenhagenAccessibilityKpiHeadline(profile, scenario);
        accessibilityLikert = Object.keys(headline.breakdown).map((label) => ({
          label,
          value: Number(headline.breakdown[label] ?? 0),
          before: Number(headline.baselineBreakdown[label] ?? 0),
          after: Number(headline.breakdown[label] ?? 0),
        }));
      } else if (pilotId === "cph-p1" || pilotId === "cph-p3") {
        accessibilityEmptySpec = {
          ...spec,
          emptyState:
            "Accessibility audit data pending for this pilot. Linked observed datasets: " +
            (pilotId === "cph-p1"
              ? "OpenTrafficCam, Telraam, manual counts, Platomo flow cameras, acceptability survey."
              : "iRAP counts, OTC flows, safety perception survey."),
        };
      }
    }
  }

  if (
    cityName === "Milan" &&
    (spec.graphicId === "accessibilityBars" || spec.graphicId === "dssBars")
  ) {
    const byCategory = new Map<
      string,
      { before: number[]; after: number[] }
    >();
    for (const p of activeObserved) {
      if (p.properties?.datasetKind !== "accessibility") continue;
      const label = String(
        p.properties?.facilityCategory ??
          p.properties?.category ??
          "Accessibility"
      );
      const bucket = byCategory.get(label) ?? { before: [], after: [] };
      bucket.before.push(Number(p.properties?.baselineValue ?? 0));
      bucket.after.push(Number(p.properties?.interventionValue ?? p.value ?? 0));
      byCategory.set(label, bucket);
    }
    const a11yBars = Array.from(byCategory.entries()).map(([label, vals]) => ({
      label,
      before: vals.before.reduce((s, v) => s + v, 0) / Math.max(vals.before.length, 1),
      after: vals.after.reduce((s, v) => s + v, 0) / Math.max(vals.after.length, 1),
    }));
    if (a11yBars.length) {
      accessibilityLikert = a11yBars.slice(0, 12).map((b) => ({
        label: b.label,
        value: b.after,
        before: b.before,
        after: b.after,
      }));
    }
  }

  if (
    cityName === "Trikala" &&
    pilotId === "tri-p3" &&
    selectedKpi === "kpi4.2" &&
    (spec.graphicId === "accessibilityBars" ||
      spec.graphicId === "likertRadar" ||
      spec.graphicId === "accessLikert" ||
      spec.graphicId === "surveyLikert")
  ) {
    const triA11yLikert = trikalaBikeLaneAccessibilityLikert(activeObserved);
    if (triA11yLikert.length) {
      accessibilityLikert = triA11yLikert;
    }
  }

  if (
    cityName === "Trikala" &&
    pilotId === "tri-p1" &&
    selectedKpi === "kpi4.2" &&
    (spec.graphicId === "accessibilityBars" ||
      spec.graphicId === "dssBars" ||
      spec.graphicId === "likertRadar" ||
      spec.graphicId === "accessLikert")
  ) {
    const fromSurvey = likertFromPoints(activeObserved);
    if (fromSurvey.length) {
      accessibilityLikert = fromSurvey;
    }
  }

  if (cityName === "Copenhagen" && spec.graphicId === "flowPressure" && pilotId === "cph-p3") {
    const tubeCards = activeObserved
      .filter((p) => p.properties?.datasetKind === "tube")
      .map((p) => ({
        label: String(p.properties?.streetName ?? "Corridor"),
        value: `${Number(p.properties?.comparisonValue ?? 0).toFixed(1)} km/h`,
        note: "Tube count avg speed (Apr 2024)",
        color: "#96c2ef",
      }));
    if (tubeCards.length) tubeSpeedCards = tubeCards;
  }

  const helsinkiHazardLikert =
    cityName === "Helsinki" && selectedKpi === "kpi2.1"
      ? helsinkiHazardCategoryLikert(activeObserved)
      : [];
  const helsinkiClimateLikert =
    cityName === "Helsinki" && selectedKpi === "kpi3.2"
      ? helsinkiClimateAttitudeLikert(activeObserved)
      : [];
  const helsinkiUxLikert =
    cityName === "Helsinki" && selectedKpi === "kpi4.1"
      ? helsinkiUxSatisfactionLikert(activeObserved)
      : [];

  const isHelsinkiKallioAccessibility =
    cityName === "Helsinki" && pilotId === "hel-p2" && selectedKpi === "kpi4.2";
  const isHelsinkiEscooterObsFocus =
    isHelsinkiKallioAccessibility && !!selectedSegmentId?.startsWith("hel-escooter-obs");

  const helsinkiPointDetailCards =
    isHelsinkiEscooterObsFocus && view.coordinates?.length === 2
      ? [
          {
            label: "Parking category",
            value: String(view.name || "Observation"),
            color: "#38bdf8",
            note: "Clicked field observation",
          },
          {
            label: "Coordinates",
            value: `${view.coordinates[0].toFixed(5)}, ${view.coordinates[1].toFixed(5)}`,
            color: "#96c2ef",
            note: "GPS from e-scooter observation GPKG",
          },
          {
            label: "Intervention",
            value: "Kallio · FVH2",
            color: "#f97316",
            note: "Category mix for the whole study is in the left panel",
          },
        ]
      : isHelsinkiKallioAccessibility
        ? [
            {
              label: "Field observations",
              value: String(
                activeObserved.reduce(
                  (sum, p) => sum + (Number(p.properties?.observationCount) || 0),
                  0
                ) || "509"
              ),
              color: "#38bdf8",
              note: "Click a map point for category + coordinates",
            },
            {
              label: "Parking categories",
              value: String(
                activeObserved.filter((p) => p.properties?.datasetKind === "escooter-parking")
                  .length || 5
              ),
              color: "#f97316",
              note: "Intervention-wide mix shown in the left insight panel",
            },
          ]
        : null;

  const facilityLikert =
    isHelsinkiKallioAccessibility && spec.graphicId === "accessibilityBars"
      ? []
      : helsinkiUxLikert.length &&
    (spec.graphicId === "likertRadar" ||
      spec.graphicId === "modeShareBars" ||
      spec.graphicId === "accessibilityBars" ||
      spec.graphicId === "sentimentGauge")
      ? helsinkiUxLikert
      : helsinkiClimateLikert.length &&
    (spec.graphicId === "climateComparison" ||
      spec.graphicId === "modeShareBars" ||
      spec.graphicId === "sentimentGauge" ||
      spec.graphicId === "likertRadar")
      ? helsinkiClimateLikert
      : helsinkiHazardLikert.length &&
    (spec.graphicId === "safetyDensity" ||
      spec.graphicId === "facilityInventory" ||
      spec.graphicId === "junctionPressure" ||
      spec.graphicId === "flowPressure" ||
      spec.graphicId === "likertRadar" ||
      spec.graphicId === "modeShareBars")
      ? helsinkiHazardLikert
      : spec.graphicId === "facilityInventory"
        ? (() => {
            if (cityName === "Trikala" && pilotId === "tri-p2" && selectedKpi === "kpi3.1") {
              const hubs = (trikalaLocations ?? []).filter((l) => l.kind === "park_and_ride");
              if (hubs.length) {
                return hubs.map((h) => ({ label: h.name, value: 1 }));
              }
              return [
                { label: "SMY", value: 1 },
                { label: "DEH", value: 1 },
                { label: "GiSeMi", value: 1 },
              ];
            }
            const parkingOf = (pts: typeof activeObserved) =>
              pts.filter(
                (pt) =>
                  pt.properties?.datasetKind === "parking" ||
                  pt.properties?.datasetKind === "escooter-parking"
              );
            // Segment focus is often a camera hub — fall back to pilot-wide parking inventory.
            const scoped = parkingOf(activeObserved);
            const pilotWide = parkingOf(observedPoints);
            const pool =
              cityName === "Milan" && selectedKpi === "kpi3.1"
                ? filterMilanFacilityPointsForScenario(
                    scoped.length ? scoped : pilotWide,
                    scenario
                  )
                : scoped.length > 0
                  ? scoped
                  : cityName === "Copenhagen"
                    ? parkingOf(observedPoints)
                    : scoped;
            const byType = new Map<string, number>();
            for (const p of pool) {
              const raw = String(
                p.properties?.facilityCategory || p.properties?.category || "Parking"
              );
              const t = raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
              const count =
                cityName === "Milan" && selectedKpi === "kpi3.1"
                  ? 1
                  : Number(p.properties?.observationCount ?? p.value ?? 0);
              byType.set(t, (byType.get(t) || 0) + (Number.isFinite(count) ? count : 0));
            }
            // Guaranteed mock category bars for Milan KPI 3.1 when points are still loading.
            if (
              cityName === "Milan" &&
              selectedKpi === "kpi3.1" &&
              ![...byType.values()].some((v) => v > 0)
            ) {
              return [
                { label: "Cycle Parking", value: 2 },
                { label: "Charging", value: 1 },
                { label: "Shared Mobility", value: 1 },
                { label: "Pedestrian", value: 1 },
                { label: "Parking", value: 1 },
              ];
            }
            return [...byType.entries()]
              .map(([label, value]) => ({ label, value }))
              .filter((row) => row.value > 0)
              .sort((a, b) => b.value - a.value);
          })()
        : spec.graphicId === "accessibilityBars" && accessibilityLikert?.length
          ? accessibilityLikert
          : (spec.graphicId === "dssBars" || spec.graphicId === "accessLikert") &&
              accessibilityLikert?.length
            ? accessibilityLikert
            : cityName === "Trikala" &&
                pilotId === "tri-p1" &&
                selectedKpi === "kpi4.2" &&
                (spec.graphicId === "accessibilityBars" ||
                  spec.graphicId === "likertRadar" ||
                  spec.graphicId === "dssBars" ||
                  spec.graphicId === "accessLikert")
              ? accessibilityLikert?.length
                ? accessibilityLikert
                : likertFromPoints(activeObserved)
              : cityName === "Trikala" &&
                pilotId === "tri-p3" &&
                selectedKpi === "kpi4.2" &&
                spec.graphicId === "accessibilityBars"
              ? trikalaBikeLaneAccessibilityLikert(activeObserved)
              : cityName === "Copenhagen" &&
                  (spec.graphicId === "likertRadar" || spec.graphicId === "surveyLikert")
                ? activeObserved
                    .filter((p) => p.properties?.datasetKind === "survey")
                    .map((p) => ({
                      label: String(p.properties?.likertLabel || p.properties?.category || "Response"),
                      value: Number(p.properties?.interventionValue ?? p.value),
                    }))
                : likertFromPoints(activeObserved);

  const helsinkiTrend = cityName === "Helsinki" ? helsinkiTelraamTrend(activeObserved) : [];

  const trikalaA11yCards =
    cityName === "Trikala" && pilotId === "tri-p3" && selectedKpi === "kpi4.2"
      ? trikalaBikeLaneA11yStatCards(activeObserved)
      : null;

  const helsinkiCards =
    cityName === "Helsinki"
      ? (() => {
          const isViikkiUxKpi =
            selectedKpi === "kpi4.1" ||
            (selectedKpi === "kpi4.2" && pilotId !== "hel-p2") ||
            (selectedKpi === "kpi2.1" && pilotId === "hel-p3");
          const evidence = helsinkiEvidenceStatCards(activeObserved) ?? [];
          const scopedEvidence = isViikkiUxKpi
            ? evidence.filter((card) => /UX|Viikki/i.test(card.label) && !/e-Scooter|Kallio|Dangerous|conflict/i.test(card.label))
            : evidence;
          const merged = [
            ...(selectedKpi === "kpi1.1" ? helsinkiExpansionPlanStatCards() : []),
            ...(selectedKpi === "kpi3.2" ? helsinkiClimateStatCards(activeObserved) ?? [] : []),
            ...(!isViikkiUxKpi && selectedKpi !== "kpi3.2"
              ? helsinkiTelraamStatCards(activeObserved) ?? []
              : []),
            ...(selectedKpi !== "kpi3.2" ? scopedEvidence : []),
          ];
          return merged.length ? merged : null;
        })()
      : null;
  const zaragozaCards =
    cityName === "Zaragoza"
      ? selectedKpi === "kpi1.1"
        ? zaragozaExpansionPlanStatCards(pilotId)
        : selectedKpi === "kpi4.2"
          ? zaragozaAccessibilityStatCards(activeObserved, scenario) ??
            zaragozaCountStatCards(activeObserved)
          : selectedKpi === "kpi2.1" &&
              (spec.graphicId === "speedProfile" || spec.graphicId === "streetSegmentSchematic")
            ? zaragozaSafetySpeedCards(activeObserved, view.name || view.shortName) ??
              zaragozaCountStatCards(activeObserved)
            : selectedKpi === "kpi3.2"
              ? zaragozaEnvStatCards(activeObserved) ?? zaragozaCountStatCards(activeObserved)
              : zaragozaCountStatCards(activeObserved)
      : null;
  const issyA11yCards =
    cityName === "Issy-les-Moulineaux" && selectedKpi === "kpi4.2"
      ? (() => {
          const profile = getIssyAccessibilityMock(pilotId);
          return profile ? issyAccessibilityStatCards(profile, scenario) : null;
        })()
      : null;
  const copenhagenA11yCards =
    cityName === "Copenhagen" && selectedKpi === "kpi4.2"
      ? (() => {
          const profile = getCopenhagenAccessibilityMock(pilotId);
          return profile ? copenhagenAccessibilityStatCards(profile, scenario) : null;
        })()
      : null;
  const milanA11yCards =
    cityName === "Milan" && selectedKpi === "kpi4.2"
      ? milanAccessibilityStatCards(activeObserved)
      : null;
  const milanSatisfactionCards =
    cityName === "Milan" && selectedKpi === "kpi4.1"
      ? milanSatisfactionStatCards(activeObserved)
      : null;
  const milanExpansionCards =
    cityName === "Milan" && selectedKpi === "kpi1.1" ? milanExpansionPlanStatCards() : null;
  const milanClimateCards =
    cityName === "Milan" && selectedKpi === "kpi3.2"
      ? milanClimateStatCards(activeObserved)
      : null;
  const milanCountCards =
    cityName === "Milan" && selectedKpi === "kpi1.2"
      ? milanCountStatCards(activeObserved)
      : null;
  const milanSelectedSpeedRecord =
    cityName === "Milan" && selectedKpi === "kpi2.1" && selectedSegmentId && milanSpeedRecords?.length
      ? milanSpeedRecords.find(
          (record) =>
            record.id === selectedSegmentId ||
            String(record.properties?.segmentId ?? "") === selectedSegmentId
        )
      : undefined;
  const milanSegmentSpeedCards =
    cityName === "Milan" && selectedKpi === "kpi2.1"
      ? milanSelectedSegmentSpeedCards(milanSelectedSpeedRecord)
      : null;
  const milanSpeedCards =
    cityName === "Milan" && selectedKpi === "kpi2.1" && spec.graphicId === "speedProfile"
      ? milanSegmentSpeedCards ?? milanSpeedStatCards(milanSegmentStats)
      : null;

  const surveyStatCards =
    helsinkiPointDetailCards ??
    (cityName === "Copenhagen" && spec.graphicId === "sentimentGauge"
      ? (() => {
          const surveyPt = activeObserved.find((p) => p.properties?.datasetKind === "survey");
          if (!surveyPt) return statCardsFromView(view, selectedKpi);
          return [
            {
              label: String(surveyPt.properties?.likertLabel || "Acceptability"),
              value: `${Number(surveyPt.properties?.interventionValue ?? surveyPt.value).toFixed(1)}%`,
              color: "#b0edba",
            },
            {
              label: "Baseline",
              value: `${Number(surveyPt.properties?.baselineValue ?? 0).toFixed(1)}%`,
            },
          ];
        })()
      : trikalaA11yCards ??
        issyA11yCards ??
        copenhagenA11yCards ??
        milanSatisfactionCards ??
        milanExpansionCards ??
        milanClimateCards ??
        milanA11yCards ??
        milanCountCards ??
        milanSpeedCards ??
        helsinkiCards ??
        zaragozaCards ??
        tubeSpeedCards ??
        statCardsFromView(view, selectedKpi, activeObserved));

  const effectiveSourceLabel = trikalaA11yCards
    ? "Bike-lane LoRa sensor time-series · partner My Maps registry"
    : cityName === "Trikala" &&
        (selectedKpi === "kpi2.1" || selectedKpi === "kpi4.1" || selectedKpi === "kpi4.2") &&
        activeObserved.some(
          (p) =>
            p.properties?.datasetKind === "survey" || Boolean(p.properties?.likertLabel)
        )
      ? String(
          activeObserved.find((p) => p.properties?.likertLabel)?.properties?.source ??
            "Smart crossing on-line survey · SharePoint"
        )
    : milanExpansionCards
      ? "Milan Intervention Evaluation Plan · CDM3 expansion readiness (KPI 1.1)"
    : milanSatisfactionCards
      ? activeObserved.some(
          (p) =>
            p.properties?.dataOrigin === "mock" ||
            p.properties?.mockLabel === "MOCK" ||
            p.properties?.type === "mock"
        )
        ? "MOCK CDM3 Activity 5 satisfaction · SharePoint folder 7 empty"
        : "Milan satisfaction survey · SharePoint folder 7"
    : milanClimateCards
      ? activeObserved.some(
          (p) => p.properties?.parserStatus === "illustrative" || p.properties?.dataOrigin === "mock"
        )
        ? "Illustrative junction climate proxy · KPI 2.1 network anchors"
        : "Milan RETE environmental proxy · SharePoint"
    : milanA11yCards
      ? activeObserved.some(
          (p) => p.properties?.parserStatus === "illustrative" || p.properties?.dataOrigin === "mock"
        )
        ? "Illustrative junction accessibility · KPI 2.1 network anchors"
        : "Milan DSS accessibility workbook · SharePoint"
      : issyA11yCards
        ? "Issy mock accessibility inventory · Pont d'Issy corridor"
      : milanCountCards
        ? "Milan AMAT road user counts · SharePoint"
        : milanSpeedCards
          ? "Milan AMAT speed shapefile · SharePoint"
          : helsinkiCards
            ? selectedKpi === "kpi1.1"
              ? "Helsinki Evaluation Plan · expansion readiness (KPI 1.1)"
              : selectedKpi === "kpi4.1" || selectedKpi === "kpi4.2"
                ? selectedKpi === "kpi4.2" &&
                  activeObserved.some((p) => p.properties?.datasetKind === "escooter-parking")
                  ? "Helsinki Kallio eScooter parking observations · SharePoint"
                  : "Helsinki Viikki UX survey (on-site, n=50) · SharePoint"
                : selectedKpi === "kpi3.1"
                  ? "Helsinki Kallio eScooter parking observation study · SharePoint"
                  : selectedKpi === "kpi3.2"
                    ? "Helsinki citywide safety-attitude survey · SharePoint"
                    : selectedKpi === "kpi2.1"
                      ? activeObserved.some((p) => p.properties?.datasetKind === "ux-survey")
                        ? "Helsinki Viikki UX safety survey (on-site, n=50) · SharePoint"
                        : "Helsinki dangerous-locations / conflicts · SharePoint"
                      : selectedKpi === "kpi1.2" && pilotId === "hel-p1"
                        ? "Helsinki conflict survey travel modes (citywide, n=3,202) · FVH1 SharePoint GPKG"
                        : selectedKpi === "kpi1.2" && pilotId === "hel-p2"
                          ? "Mock mode share · Kallio travel mix (no FVH2 Telraam)"
                          : "Helsinki Telraam + Viikki lighthouse package · SharePoint"
            : zaragozaCards
              ? "Zaragoza SharePoint baseline · school mon / surveys / counts / AQ"
              : cityName === "Trikala" && pilotId === "tri-p4" && selectedKpi === "kpi1.2"
                ? "MOCK mode share — Pilot 4 SMARTA2 / survey proxy"
                : cityName === "Trikala" && pilotId === "tri-p4" && selectedKpi === "kpi3.2"
                  ? "MOCK climate — Pilot 4 Smart Citizen Kit fleet proxy"
                  : cityName === "Trikala" && pilotId === "tri-p4" && selectedKpi === "kpi4.1"
                    ? "SMARTA2 user satisfaction survey (Pilot 4 · observed)"
                : cityName === "Trikala" && pilotId === "tri-p2" && selectedKpi === "kpi1.2"
                ? "MOCK mode share — P+R bike uptake (partner occupancy survey pending)"
                : cityName === "Trikala" && pilotId === "tri-p2" && selectedKpi === "kpi3.1"
                  ? "Installed P+R hubs · Partner My Maps (SMY · DEH · GiSeMi)"
                  : cityName === "Trikala" && pilotId === "tri-p2" && selectedKpi === "kpi4.1"
                    ? "MOCK satisfaction — no P+R user survey linked"
                    : sourceLabel;
  const effectiveDataClass: ObservatoryDataClass =
    dataClass === "mock"
      ? "mock"
      : selectedKpi === "kpi2.1"
        ? "mock"
      : cityName === "Trikala" && pilotId === "tri-p4"
        ? selectedKpi === "kpi4.1"
          ? "observed"
          : "mock"
      : milanExpansionCards
      ? "derived"
      : cityName === "Trikala" &&
          pilotId === "tri-p2" &&
          (selectedKpi === "kpi1.2" || selectedKpi === "kpi4.1")
        ? "mock"
      : trikalaA11yCards ||
          issyA11yCards ||
          milanSatisfactionCards ||
          milanClimateCards ||
          milanA11yCards ||
          milanCountCards ||
          milanSpeedCards ||
          helsinkiCards ||
          zaragozaCards
      ? activeObserved.some(
          (p) => p.properties?.parserStatus === "illustrative" || p.properties?.dataOrigin === "mock"
        ) || Boolean(issyA11yCards)
        ? "mock"
        : "observed"
      : cityName === "Trikala" &&
          activeObserved.some(
            (p) =>
              p.properties?.datasetKind === "survey" ||
              Boolean(p.properties?.likertLabel)
          )
        ? "observed"
      : cityName === "Copenhagen" &&
          (selectedKpi === "kpi4.1" || selectedKpi === "kpi4.2") &&
          activeObserved.some(
            (p) =>
              p.properties?.dataOrigin === "mock" ||
              p.properties?.mockLabel === "MOCK" ||
              p.properties?.type === "mock"
          )
        ? "mock"
        : cityName === "Milan" &&
            selectedKpi === "kpi4.1" &&
            activeObserved.some(
              (p) =>
                p.properties?.dataOrigin === "mock" ||
                p.properties?.mockLabel === "MOCK" ||
                p.properties?.type === "mock"
            )
          ? "mock"
        : dataClass;

  const surveyDistribution =
    (cityName === "Copenhagen" || cityName === "Milan" || cityName === "Zaragoza") &&
    (selectedKpi === "kpi4.1" || selectedKpi === "kpi4.2") &&
    (spec.graphicId === "surveyPie" ||
      spec.graphicId === "surveyLikert" ||
      spec.graphicId === "sentimentGauge" ||
      spec.graphicId === "likertRadar" ||
      spec.graphicId === "accessibilityBars" ||
      spec.graphicId === "accessLikert")
      ? (() => {
          if (cityName === "Zaragoza") {
            return zaragozaSurveyDistribution(activeObserved, selectedKpi);
          }
          const surveyPt =
            activeObserved.find((p) => p.properties?.datasetKind === "survey") ||
            observedPoints.find((p) => p.properties?.datasetKind === "survey");
          const beforeRaw = surveyPt?.properties?.surveyDistributionBefore as
            | Array<{ score: number; label: string; pct: number }>
            | undefined;
          const afterRaw = surveyPt?.properties?.surveyDistributionAfter as
            | Array<{ score: number; label: string; pct: number }>
            | undefined;
          if (!beforeRaw?.length && !afterRaw?.length) return undefined;
          const mapBins = (bins: Array<{ score: number; label: string; pct: number }> | undefined) =>
            (bins ?? []).map((b) => ({
              label: b.label || String(b.score),
              value: Number(b.pct) || 0,
              score: Number(b.score) || undefined,
            }));
          return { before: mapBins(beforeRaw), after: mapBins(afterRaw) };
        })()
      : undefined;

  const copenhagenSurveySource =
    cityName === "Copenhagen" && selectedKpi === "kpi4.1"
      ? (() => {
          const surveyPt =
            activeObserved.find((p) => p.properties?.datasetKind === "survey") ||
            observedPoints.find((p) => p.properties?.datasetKind === "survey");
          const isMock =
            surveyPt?.properties?.dataOrigin === "mock" ||
            surveyPt?.properties?.mockLabel === "MOCK" ||
            surveyPt?.properties?.type === "mock";
          const note = String(surveyPt?.properties?.locationNote ?? surveyPt?.properties?.spatialNote ?? "");
          const src = String(
            surveyPt?.properties?.source ?? (isMock ? "MOCK satisfaction" : "Acceptability survey")
          );
          const base = note ? `${src} · ${note}` : src;
          return isMock && !base.toUpperCase().includes("MOCK") ? `MOCK · ${base}` : base;
        })()
      : cityName === "Copenhagen" && selectedKpi === "kpi4.2"
        ? (() => {
            const a11yPt =
              activeObserved.find((p) => p.properties?.datasetKind === "accessibility") ||
              observedPoints.find((p) => p.properties?.datasetKind === "accessibility");
            const isMock =
              a11yPt?.properties?.dataOrigin === "mock" ||
              a11yPt?.properties?.mockLabel === "MOCK" ||
              a11yPt?.properties?.type === "mock";
            const src = String(
              a11yPt?.properties?.source ?? (isMock ? "MOCK accessibility" : "Accessibility")
            );
            return isMock && !src.toUpperCase().includes("MOCK") ? `MOCK · ${src}` : src;
          })()
      : null;

  const copenhagenMockHeadline =
    cityName === "Copenhagen" && selectedKpi === "kpi4.1"
      ? (() => {
          const profile = getCopenhagenSentimentMock(pilotId);
          return profile ? copenhagenSentimentKpiHeadline(profile, scenario) : null;
        })()
      : cityName === "Copenhagen" && selectedKpi === "kpi4.2"
        ? (() => {
            const profile = getCopenhagenAccessibilityMock(pilotId);
            return profile ? copenhagenAccessibilityKpiHeadline(profile, scenario) : null;
          })()
        : null;

  // Map pin / segment hover → highlight matching satisfaction dimension on Overview bars.
  const highlightedMode =
    cityName === "Copenhagen" && selectedKpi === "kpi4.1" && selectedSegmentId
      ? (() => {
          const focus =
            observedPoints.find(
              (p) => String(p.properties?.segmentId ?? p.id) === selectedSegmentId
            ) ??
            activeObserved.find(
              (p) => String(p.properties?.segmentId ?? p.id) === selectedSegmentId
            );
          const label = String(
            focus?.properties?.likertLabel ?? focus?.properties?.category ?? ""
          ).trim();
          return label || null;
        })()
      : null;

  const milanSatisfactionTrend =
    cityName === "Milan" && selectedKpi === "kpi4.1"
      ? (() => {
          const surveys = activeObserved.filter((p) => p.properties?.datasetKind === "survey");
          if (!surveys.length) return null;
          const before =
            surveys.reduce((s, p) => s + Number(p.properties?.baselineValue ?? 0), 0) /
            surveys.length;
          const after =
            surveys.reduce(
              (s, p) => s + Number(p.properties?.interventionValue ?? p.value ?? 0),
              0
            ) / surveys.length;
          // Guarantee a visible ~+2pp improvement when baseline-only / flat mock.
          const nudgedAfter = after <= before + 0.05 ? before + 2 : after;
          return {
            before: Math.round(before * 10) / 10,
            after: Math.round(nudgedAfter * 10) / 10,
          };
        })()
      : null;

  const payload: ObservatoryGraphicPayload = {
    spec: accessibilityEmptySpec !== spec ? accessibilityEmptySpec : spec,
    zone,
    kpiId: selectedKpi,
    observatoryType,
    dataClass: effectiveDataClass,
    sourceLabel: copenhagenSurveySource || effectiveSourceLabel,
    kpiValue: copenhagenMockHeadline?.mainValue ?? milanSatisfactionTrend?.after ?? view.kpiValue,
    modeShare,
    trend: copenhagenMockHeadline
      ? [
          { t: "Before", v: copenhagenMockHeadline.baselineMain },
          { t: "After", v: copenhagenMockHeadline.mainValue },
        ]
      : milanSatisfactionTrend
        ? [
            { t: "Before", v: milanSatisfactionTrend.before },
            { t: "After", v: milanSatisfactionTrend.after },
          ]
      : helsinkiTrend.length
        ? helsinkiTrend
        : trendFromView(view),
    cameraDirections,
    activeDirectionId,
    emissionDirections,
    likert: (() => {
      if (cityName === "Zaragoza" && selectedKpi === "kpi4.1") {
        const zarLikert = zaragozaLikertFromPoints(activeObserved);
        if (zarLikert.length) return zarLikert;
      }
      // KPI 4.2: never feed band likert — accessibility uses feature count cards / icons.
      if (cityName === "Zaragoza" && selectedKpi === "kpi4.2") {
        return [];
      }
      // Trikala Pilot 3 road safety — occupancy / mock-speed rows for SafetyPressureChart.
      if (
        cityName === "Trikala" &&
        pilotId === "tri-p3" &&
        selectedKpi === "kpi2.1" &&
        (spec.graphicId === "speedProfile" ||
          spec.graphicId === "prePostTrend" ||
          spec.graphicId === "safetyDensity")
      ) {
        const fromMode = modeShare
          .filter((r) => r.after > 0 || r.before > 0)
          .map((r) => ({
            label: r.mode,
            value: scenario === "baseline" ? r.before : r.after,
          }));
        if (fromMode.length) return fromMode;
      }
      if (surveyDistribution?.after?.length) {
        return surveyDistribution.after.map((s) => ({ label: s.label, value: s.value }));
      }
      return facilityLikert;
    })(),
    surveyDistribution,
    statCards: surveyStatCards,
    markers,
    segmentGradient:
      cityName === "Milan" && (selectedKpi === "kpi2.1" || selectedKpi === "kpi4.2")
        ? undefined
        : view.intervention.peakCongestion,
    amatSegmentSpeed:
      (cityName === "Milan" && selectedKpi === "kpi2.1" && Boolean(milanSpeedCards?.length)) ||
      (cityName === "Zaragoza" &&
        selectedKpi === "kpi2.1" &&
        (spec.graphicId === "speedProfile" || spec.graphicId === "streetSegmentSchematic")),
    speedDiagram:
      cityName === "Milan" && selectedKpi === "kpi2.1"
        ? (() => {
            const props = milanSelectedSpeedRecord?.properties ?? {};
            const avg = Number(
              props.avgSpeed ?? view.intervention.avgSpeedKmh ?? view.kpiValue ?? 0
            );
            const p85 = Number(props.p85Speed ?? 0);
            const limit = Number(props.speedLimit ?? 0);
            const intervention = Number(view.intervention.avgSpeedKmh ?? avg);
            const baseline = Number(view.baseline.avgSpeedKmh ?? intervention * 1.08);
            if (!(avg > 0 || intervention > 0)) return undefined;
            return {
              avgKmh: avg > 0 ? avg : intervention,
              p85Kmh: p85 > 0 ? p85 : undefined,
              limitKmh: limit > 0 ? limit : undefined,
              baselineKmh: baseline,
              interventionKmh: intervention,
              streetName: String(
                props.streetName ?? view.name ?? view.shortName ?? "Monitored street segment"
              ),
            };
          })()
        : cityName === "Zaragoza" && selectedKpi === "kpi2.1"
          ? zaragozaSafetySpeedDiagram(activeObserved, view)
          : cityName === "Zaragoza" && selectedKpi === "kpi3.2"
            ? zaragozaAqIntensityDiagram(activeObserved, view.name || view.shortName) ?? undefined
            : undefined,
    streetNS:
      cityName === "Helsinki"
        ? pilotId === "hel-p2" && selectedKpi === "kpi4.2"
          ? "Kallio summer streets"
          : selectedKpi === "kpi1.1" || selectedKpi === "kpi4.1" || selectedKpi === "kpi4.2"
          ? "Viikki crossing arms"
          : selectedKpi === "kpi3.2"
            ? "Safety-climate survey arms"
            : selectedKpi === "kpi2.1" || selectedKpi === "kpi1.2"
              ? "Near-miss survey arms"
              : view.streetNS
        : cityName === "Issy-les-Moulineaux"
          ? view.streetNS || "Pont d'Issy"
          : cityName === "Milan"
            ? view.streetNS
            : view.streetNS,
    streetEW:
      cityName === "Helsinki"
        ? pilotId === "hel-p2" && selectedKpi === "kpi4.2"
          ? "e-scooter parking observations"
          : selectedKpi === "kpi1.1" || selectedKpi === "kpi4.1" || selectedKpi === "kpi4.2"
          ? "Koetilantie · Raide-Jokeri"
          : selectedKpi === "kpi3.2"
            ? "FVH1 climate pressure corridor"
            : selectedKpi === "kpi2.1" || selectedKpi === "kpi1.2"
              ? "FVH1 hazard corridor"
              : view.streetEW
        : cityName === "Issy-les-Moulineaux"
          ? view.streetEW || "Quai Roosevelt · Rouget de Lisle"
          : cityName === "Milan"
            ? view.streetEW
            : view.streetEW,
    highlightArmId: view.armId,
    highlightedMode,
    cameraBearingDeg:
      cityName === "Milan" && selectedKpi === "kpi1.2"
        ? 0
        : cityName === "Copenhagen" && copenhagenWorkbookFocus
        ? workbookHubBearing(copenhagenWorkbookFocus)
        : cityName === "Issy-les-Moulineaux" && view.odLinks?.length
          ? view.odLinks.reduce((s, l) => s + l.bearingDeg, 0) / view.odLinks.length
          : cityName === "Issy-les-Moulineaux"
            ? 270
            : undefined,
    pilotTitle:
      cityName === "Milan" && selectedKpi === "kpi1.2"
        ? view.name || view.shortName || "AMAT camera hub · approach flows"
        : cityName === "Milan" && selectedKpi === "kpi1.1"
        ? "CDM3 DSS expansion readiness"
        : cityName === "Helsinki" && selectedKpi === "kpi1.1"
        ? "Viikki warning-system expansion readiness"
        : cityName === "Helsinki" && (selectedKpi === "kpi4.1" || selectedKpi === "kpi4.2")
          ? pilotId === "hel-p2" && selectedKpi === "kpi4.2"
            ? "Kallio e-scooter parking observations"
            : "Viikki UX crossing survey (site)"
          : cityName === "Helsinki" && selectedKpi === "kpi3.2"
            ? "Safety-climate attitude & mobility pressure"
            : cityName === "Helsinki" && selectedKpi === "kpi2.1"
              ? pilotId === "hel-p3"
                ? "Viikki UX safety survey (site)"
                : "Near-miss & dangerous-location junction"
              : cityName === "Helsinki" && selectedKpi === "kpi1.2"
              ? pilotId === "hel-p3"
                ? "Viikki dual-sensor junction"
                : pilotId === "hel-p2"
                  ? "Kallio mode-share hubs (mock)"
                  : "Mode-share hubs (mock)"
              : cityName === "Copenhagen" && selectedKpi === "kpi3.2"
                ? view.name
                  ? `${view.name} · sensor emissions`
                  : "Sensor emissions (aggregated)"
                : cityName === "Copenhagen" && copenhagenTelraamLocationId
                  ? "Telraam counter · mode arms"
                : cityName === "Copenhagen"
                ? view.name ||
                  (copenhagenWorkbookFocus
                    ? `${copenhagenWorkbookFocus.replace(/_/g, " ")} camera hub`
                    : "Camera hub · directional links")
                : cityName === "Issy-les-Moulineaux"
                  ? view.name || ISSY_P2_JUNCTION.name
                  : profile?.title,
  };

  if (perfDelta != null && zone === "beforeAfter") {
    payload.statCards = [
      ...(payload.statCards ?? []),
      {
        label: "Mean comparison delta",
        value: `${perfDelta > 0 ? "+" : ""}${perfDelta.toFixed(1)}`,
        note: "Linked points",
        color: perfDelta >= 0 ? "#b0edba" : "#f43f5e",
      },
    ];
  }

  if (activeObserved.length === 0 && effectiveDataClass === "mock" && spec.emptyState) {
    payload.spec = { ...spec, emptyState: spec.emptyState };
  }

  return payload;
}

export function getCityCenter(cityName: string): { lat: number; lon: number } | null {
  const row = CITY_DATA.find((c) => c.city === cityName);
  return row ? { lat: row.lat, lon: row.lon } : null;
}
