import type { JunctionConfig } from "@/data/junctionConfigs";
import type { JunctionPeriodView, JunctionStudyView } from "@/lib/issyJunctionAnalytics";
import { buildMockJunctionStudyView } from "@/lib/junctionMockAnalytics";
import { getKpiDefinition } from "@/config/kpiDefinitions";
import { getCityPilotProfile } from "@/data/cityPilotProfiles";
import { getPilotById } from "@/data/pilotDefinitions";
import {
  getSegmentHighlight,
  segmentMetricKindForKpi,
} from "@/lib/segmentHighlight";
import type { MapScenario } from "@/context/MapIntelligenceContext";
import type { LocalCityPoint } from "@/services/localCityData";
import type { MilanSegmentDataset, MilanSegmentRecord } from "@/services/milanSegmentData";
import { MILAN_PILOT_ANCHORS } from "@/lib/milanMapConfig";
import type { MilanPilotId } from "@/data/milanPilotProfiles";
import { milanHubSegmentId } from "@/lib/milanMapLayers/milanFlowGeometry";

import {
  milanModeSharePct,
  toMilanElaboratorBreakdown,
  type MilanModeTotals,
} from "@/lib/milanModeBreakdown";

type ModeAgg = MilanModeTotals;

type ModeBreakdown = {
  pre: ModeAgg;
  post: ModeAgg;
};

export type MilanObservatoryOptions = {
  selectionId?: string | null;
  segmentName?: string | null;
  speed?: number | null;
  congestion?: number | null;
  segmentProperties?: Record<string, unknown>;
  speedDataset?: MilanSegmentDataset | null;
  envDataset?: MilanSegmentDataset | null;
  pilotLabel?: string;
};

function pct(part: number, total: number): number {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return 0;
  return (part / total) * 100;
}

function aggregateModeBreakdown(points: LocalCityPoint[]): ModeBreakdown | null {
  const pre: ModeAgg = { bike: 0, pedestrian: 0, motorised: 0, ptw: 0, pt: 0, total: 0 };
  const post: ModeAgg = { bike: 0, pedestrian: 0, motorised: 0, ptw: 0, pt: 0, total: 0 };
  let hits = 0;

  for (const point of points) {
    const mb = point.properties?.modeBreakdown as ModeBreakdown | undefined;
    if (!mb) continue;
    pre.bike += mb.pre.bike;
    pre.pedestrian += mb.pre.pedestrian;
    pre.motorised += mb.pre.motorised;
    pre.ptw += mb.pre.ptw;
    pre.pt += mb.pre.pt ?? 0;
    pre.total += mb.pre.total;
    post.bike += mb.post.bike;
    post.pedestrian += mb.post.pedestrian;
    post.motorised += mb.post.motorised;
    post.ptw += mb.post.ptw;
    post.pt += mb.post.pt ?? 0;
    post.total += mb.post.total;
    hits += 1;
  }

  if (!hits) return null;
  return { pre, post };
}

function periodFromAgg(
  agg: ModeAgg,
  label: string,
  periodLabel: string,
  peerAgg?: ModeAgg
): JunctionPeriodView {
  const motorShare = pct(agg.motorised + agg.ptw, agg.total);
  const trendBase = agg.bike || 1;
  return {
    label,
    period: periodLabel,
    modeShare: {
      Pedestrian: pct(agg.pedestrian, agg.total),
      Cycle: pct(agg.bike, agg.total),
      "Public Transport": pct(agg.pt ?? 0, agg.total),
      "Private Car": pct(agg.motorised, agg.total),
      PTW: pct(agg.ptw, agg.total),
    },
    dailyCycleCount: Math.round(agg.bike),
    peakCongestion: Math.min(1, motorShare / 100),
    avgSpeedKmh: Math.max(12, 42 - motorShare * 0.22),
    co2ProxyKgDay: Math.round(agg.motorised * 1.6 + agg.ptw * 0.9),
    trendCycle: [trendBase, trendBase * 1.04, trendBase * 1.08],
    trendCar: [agg.motorised, agg.motorised * 0.98, agg.motorised * 0.95],
    peerModeShare: peerAgg
      ? {
          Pedestrian: pct(peerAgg.pedestrian, peerAgg.total),
          Cycle: pct(peerAgg.bike, peerAgg.total),
          "Private Car": pct(peerAgg.motorised, peerAgg.total),
        }
      : undefined,
  };
}

function sustainableSharePct(agg: ModeAgg): number {
  if (agg.total <= 0) return 0;
  return pct(agg.bike + agg.pedestrian, agg.total);
}

function findMilanSegment(
  dataset: MilanSegmentDataset | null | undefined,
  selectionId?: string | null
): MilanSegmentRecord | undefined {
  if (!dataset?.records?.length) return undefined;
  if (!selectionId) return dataset.records[0];
  return (
    dataset.records.find((r) => r.id === selectionId) ??
    dataset.records.find((r) => String(r.properties?.segmentId ?? "") === selectionId)
  );
}

function envTrafficWeight(props: Record<string, unknown>): number {
  return (
    Number(props.vAuto ?? 0) +
    Number(props.vMoto ?? 0) * 0.8 +
    Number(props.vLeggeri ?? 0) * 1.4 +
    Number(props.vMedi ?? 0) * 2.2 +
    Number(props.vPesanti ?? 0) * 3.2
  );
}

export function filterMilanObservatoryPoints(
  points: LocalCityPoint[],
  selectionId: string
): LocalCityPoint[] {
  if (!selectionId) return points;
  const normalizedSelection = selectionId.replace(/^milan-site-/, "");
  return points.filter((p) => {
    const props = (p.properties ?? {}) as Record<string, unknown>;
    const sid = String(props.segmentId ?? props.siteId ?? p.id ?? "");
    const siteKey = String(props.siteKey ?? "");
    const junctionId = String(props.junctionId ?? "");
    const rid = String(props.id ?? p.id);
    const hubId = milanHubSegmentId(props);
    return (
      hubId === selectionId ||
      sid === selectionId ||
      rid === selectionId ||
      junctionId === selectionId ||
      siteKey === normalizedSelection ||
      siteKey === selectionId ||
      sid.startsWith(`${normalizedSelection}-`) ||
      sid.startsWith(`${selectionId}-`) ||
      (junctionId.length > 0 && selectionId.startsWith(`${junctionId}-`))
    );
  });
}

export function aggregateMilanObservedKpi(
  points: LocalCityPoint[],
  kpiId: string,
  selectedModeTypes: string[] = ["Pedestrian", "Cycle", "Public Transport", "Private Car", "PTW"]
): {
  baselineMain: number;
  interventionMain: number;
  change: number;
  breakdownBaseline?: Record<string, number>;
  breakdownIntervention?: Record<string, number>;
} | null {
  if (kpiId === "kpi1.2") {
    const mb = aggregateModeBreakdown(points.filter((p) => p.properties?.datasetKind === "amat-count"));
    if (!mb) return null;
    const breakdown = toMilanElaboratorBreakdown(mb.pre, mb.post);
    return {
      baselineMain: milanModeSharePct(mb.pre, selectedModeTypes),
      interventionMain: milanModeSharePct(mb.post, selectedModeTypes),
      change:
        milanModeSharePct(mb.post, selectedModeTypes) -
        milanModeSharePct(mb.pre, selectedModeTypes),
      breakdownBaseline: breakdown.breakdownBaseline,
      breakdownIntervention: breakdown.breakdownIntervention,
    };
  }

  if (kpiId === "kpi4.2") {
    const a11y = points.filter((p) => p.properties?.datasetKind === "accessibility");
    if (!a11y.length) return null;
    const baselineMain =
      a11y.reduce((s, p) => s + Number(p.properties?.baselineValue ?? 0), 0) / a11y.length;
    const interventionMain =
      a11y.reduce((s, p) => s + Number(p.properties?.interventionValue ?? p.value ?? 0), 0) /
      a11y.length;
    return {
      baselineMain,
      interventionMain,
      change: interventionMain - baselineMain,
    };
  }

  return null;
}

export function milanAccessibilityStatCards(points: LocalCityPoint[]): {
  label: string;
  value: string;
  color?: string;
  note?: string;
}[] | null {
  const a11y = points.filter((p) => p.properties?.datasetKind === "accessibility");
  if (!a11y.length) return null;
  const isIllustrative = a11y.some(
    (p) => p.properties?.parserStatus === "illustrative" || p.properties?.dataOrigin === "mock"
  );
  const avgPost =
    a11y.reduce((s, p) => s + Number(p.properties?.interventionValue ?? p.value), 0) / a11y.length;
  const avgBaseline =
    a11y.reduce((s, p) => s + Number(p.properties?.baselineValue ?? 0), 0) / a11y.length;
  const delta = avgPost - avgBaseline;
  const hubCount = new Set(
    a11y.map((p) => String(p.properties?.junctionId ?? p.properties?.siteKey ?? p.id))
  ).size;
  return [
    {
      label: "Equal access (post)",
      value: `${avgPost.toFixed(1)}%`,
      color: "#63ccff",
      note: isIllustrative
        ? `${hubCount} illustrative junction hub${hubCount === 1 ? "" : "s"}`
        : "Milan DSS accessibility workbook",
    },
    {
      label: "Baseline",
      value: `${avgBaseline.toFixed(1)}%`,
      note: isIllustrative
        ? "Mode-share network anchors"
        : `${a11y.length} category row${a11y.length === 1 ? "" : "s"}`,
    },
    {
      label: "Change",
      value: `${delta >= 0 ? "+" : ""}${delta.toFixed(1)} pp`,
      note: isIllustrative ? "Illustrative · pilot-scoped" : "Derived · pilot-scoped",
    },
  ];
}

export function milanClimateStatCards(points: LocalCityPoint[]): {
  label: string;
  value: string;
  color?: string;
  note?: string;
}[] | null {
  const emissions = points.filter((p) => p.properties?.datasetKind === "emissions");
  if (!emissions.length) return null;
  const isIllustrative = emissions.some(
    (p) => p.properties?.parserStatus === "illustrative" || p.properties?.dataOrigin === "mock"
  );
  const avgPost =
    emissions.reduce((s, p) => s + Number(p.properties?.interventionValue ?? p.value), 0) /
    emissions.length;
  const avgBaseline =
    emissions.reduce((s, p) => s + Number(p.properties?.baselineValue ?? 0), 0) / emissions.length;
  const delta = avgPost - avgBaseline;
  const hubCount = new Set(
    emissions.map((p) => String(p.properties?.junctionId ?? p.properties?.siteKey ?? p.id))
  ).size;
  return [
    {
      label: "Env. pressure (post)",
      value: `${avgPost.toFixed(1)}`,
      color: "#f59e0b",
      note: isIllustrative
        ? `${hubCount} illustrative junction hub${hubCount === 1 ? "" : "s"}`
        : "RETE environmental proxy",
    },
    {
      label: "Baseline",
      value: `${avgBaseline.toFixed(1)}`,
      note: isIllustrative ? "Mode-share network anchors" : "Segment-level derived",
    },
    {
      label: "Change",
      value: `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}`,
      note: isIllustrative ? "Illustrative · pilot-scoped" : "Derived · pilot-scoped",
    },
  ];
}

export function milanCountStatCards(points: LocalCityPoint[]): {
  label: string;
  value: string;
  color?: string;
  note?: string;
}[] | null {
  const counts = points.filter((p) => p.properties?.datasetKind === "amat-count");
  if (!counts.length) return null;

  const avgPost =
    counts.reduce((s, p) => s + Number(p.properties?.interventionValue ?? p.value), 0) / counts.length;
  const avgBaseline =
    counts.reduce((s, p) => s + Number(p.properties?.baselineValue ?? 0), 0) / counts.length;
  const matched = counts.filter((p) => p.properties?.spatialQuality === "matched").length;
  const totalBikes = counts.reduce((s, p) => {
    const post = p.properties?.modeBreakdown as { post?: { bike?: number } } | undefined;
    return s + Number(post?.post?.bike ?? 0);
  }, 0);

  return [
    {
      label: "Bike mode share (post)",
      value: `${avgPost.toFixed(1)}%`,
      color: "#22c55e",
      note: `${counts.length} AMAT count sites`,
    },
    {
      label: "Baseline share",
      value: `${avgBaseline.toFixed(1)}%`,
      note: "Peak 8:30–9:30 TMV summaries",
    },
    {
      label: "Camera linkage",
      value: `${matched}/${counts.length}`,
      note: `Σ bikes (post): ${Math.round(totalBikes)}`,
    },
  ];
}

export function milanSpeedStatCards(stats?: { parsedSegments: number; avgMetricValue: number; invalidGeometries?: number; missingMetricJoins?: number; cameraJoinRatePct?: number } | null): {
  label: string;
  value: string;
  color?: string;
  note?: string;
}[] | null {
  if (!stats || stats.parsedSegments <= 0) return null;
  return [
    {
      label: "Parsed segments",
      value: `${stats.parsedSegments}`,
      color: "#96c2ef",
      note: "AMAT speed shapefile network",
    },
    {
      label: "Avg speed metric",
      value: `${stats.avgMetricValue.toFixed(1)} km/h`,
      note: stats.cameraJoinRatePct != null
        ? `Camera join ${stats.cameraJoinRatePct}%`
        : "Segment-level intensity",
    },
    {
      label: "Geometry quality",
      value: stats.invalidGeometries ? `${stats.invalidGeometries} skipped` : "Valid",
      note: stats.missingMetricJoins
        ? `${stats.missingMetricJoins} missing metric joins`
        : "Observed segment layer",
    },
  ];
}

export function buildMilanObservatoryView(
  config: JunctionConfig,
  pilotId: string,
  selectedKpi: string,
  scenario: MapScenario,
  points: LocalCityPoint[],
  options: MilanObservatoryOptions = {}
): JunctionStudyView {
  const base = buildMockJunctionStudyView(config, selectedKpi, scenario);
  const pilot = getPilotById("Milan", pilotId);
  const profile = getCityPilotProfile(pilotId);
  const kpiDef = getKpiDefinition(selectedKpi);
  const metric = segmentMetricKindForKpi(selectedKpi);

  const selectionId = options.selectionId ?? null;
  const scopedPoints = selectionId
    ? filterMilanObservatoryPoints(points, selectionId)
    : points;
  const activePoints = scopedPoints.length ? scopedPoints : points;

  const countPoints = activePoints.filter((p) => p.properties?.datasetKind === "amat-count");
  const a11yPoints = activePoints.filter((p) => p.properties?.datasetKind === "accessibility");
  const modeAgg = aggregateModeBreakdown(countPoints);

  const speedDataset = options.speedDataset;
  const envDataset = options.envDataset;
  const speedSegment =
    selectedKpi === "kpi2.1" ? findMilanSegment(speedDataset, selectionId) : undefined;
  const envSegment =
    selectedKpi === "kpi3.2" ? findMilanSegment(envDataset, selectionId) : undefined;

  let baselineValue = base.baseline.avgSpeedKmh;
  let interventionValue = base.kpiValue;
  let baselinePeriod = base.baseline;
  let interventionPeriod = base.intervention;
  let dataClass: JunctionStudyView["dataClass"] = "mock";
  let sourceLabel = profile?.dataAvailability || "Milan SharePoint extract";
  let monitoringPeriod = base.monitoringPeriod;
  let segmentApiId = config.segmentApiId;
  let displayName = options.segmentName || profile?.title || config.name;

  if (selectedKpi === "kpi1.2" && modeAgg) {
    const isIllustrative = countPoints.some(
      (p) =>
        p.properties?.parserStatus === "illustrative" || p.properties?.dataOrigin === "mock"
    );
    baselineValue = sustainableSharePct(modeAgg.pre);
    interventionValue = sustainableSharePct(modeAgg.post);
    baselinePeriod = periodFromAgg(
      modeAgg.pre,
      "Baseline",
      isIllustrative ? "Illustrative pre-intervention proxy" : "AMAT pre-intervention counts",
      modeAgg.post
    );
    interventionPeriod = periodFromAgg(
      modeAgg.post,
      "Post-intervention",
      isIllustrative ? "Illustrative post-intervention proxy" : "AMAT evaluation counts",
      modeAgg.pre
    );
    dataClass = isIllustrative ? "mock" : "observed";
    sourceLabel = isIllustrative
      ? "Illustrative junction mode-share · KPI 2.1 safety network anchors"
      : "AMAT road user count workbooks · Milano SharePoint";
    const hubCount = new Set(
      countPoints.map((p) => String(p.properties?.junctionId ?? p.properties?.siteKey ?? p.id))
    ).size;
    const hasEvaluation =
      !isIllustrative &&
      countPoints.some((p) => p.properties?.temporalCoverage !== "baseline-only");
    monitoringPeriod = isIllustrative
      ? `${hubCount} illustrative junction hub${hubCount === 1 ? "" : "s"} · Copenhagen-style demo`
      : hasEvaluation
        ? `${countPoints.length} count site${countPoints.length === 1 ? "" : "s"} · peak TMV`
        : `${countPoints.length} baseline-only AMAT count site${countPoints.length === 1 ? "" : "s"} · evaluation pending`;
    segmentApiId = String(
      countPoints[0]?.properties?.junctionId ??
        countPoints[0]?.properties?.segmentId ??
        countPoints[0]?.id ??
        segmentApiId
    );
    if (!options.segmentName) {
      const junctionLabel = String(countPoints[0]?.properties?.junctionLabel ?? "").trim();
      const siteName = String(countPoints[0]?.properties?.streetName ?? "").trim();
      displayName =
        junctionLabel ||
        siteName.split(" · ")[0] ||
        `${hubCount} junction hub${hubCount === 1 ? "" : "s"}`;
    }
  } else if (selectedKpi === "kpi4.2" && a11yPoints.length) {
    const isIllustrative = a11yPoints.some(
      (p) => p.properties?.parserStatus === "illustrative" || p.properties?.dataOrigin === "mock"
    );
    baselineValue =
      a11yPoints.reduce((s, p) => s + Number(p.properties?.baselineValue ?? 0), 0) / a11yPoints.length;
    interventionValue =
      a11yPoints.reduce((s, p) => s + Number(p.properties?.interventionValue ?? p.value ?? 0), 0) /
      a11yPoints.length;
    dataClass = isIllustrative ? "mock" : "observed";
    sourceLabel = isIllustrative
      ? "Illustrative junction accessibility · KPI 2.1 network anchors"
      : "Milan DSS accessibility workbook · SharePoint";
    const hubCount = new Set(
      a11yPoints.map((p) => String(p.properties?.junctionId ?? p.properties?.siteKey ?? p.id))
    ).size;
    monitoringPeriod = isIllustrative
      ? `${hubCount} illustrative junction hub${hubCount === 1 ? "" : "s"} · equal-access proxy`
      : `${a11yPoints.length} accessibility categor${a11yPoints.length === 1 ? "y" : "ies"}`;
    segmentApiId = String(
      a11yPoints[0]?.properties?.junctionId ??
        a11yPoints[0]?.properties?.segmentId ??
        segmentApiId
    );
    baselinePeriod = {
      ...base.baseline,
      modeShare: { Pedestrian: baselineValue },
      avgSpeedKmh: baselineValue,
    };
    interventionPeriod = {
      ...base.intervention,
      modeShare: { Pedestrian: interventionValue },
      avgSpeedKmh: interventionValue,
    };
    if (!options.segmentName) {
      const junctionLabel = String(a11yPoints[0]?.properties?.junctionLabel ?? "").trim();
      const streetName = String(a11yPoints[0]?.properties?.streetName ?? "").trim();
      const civic = String(
        a11yPoints[0]?.properties?.civicAddress ?? a11yPoints[0]?.properties?.siteKey ?? ""
      ).trim();
      const category = String(
        a11yPoints[0]?.properties?.facilityCategory ?? a11yPoints[0]?.properties?.category ?? ""
      ).trim();
      displayName =
        junctionLabel ||
        streetName ||
        (civic && category ? `Civic ${civic} · ${category}` : category) ||
        "Accessibility features";
    }
  } else if (selectedKpi === "kpi3.1") {
    const facilityPoints = activePoints.filter((p) => p.properties?.datasetKind === "parking");
    if (facilityPoints.length) {
      const isIllustrative = facilityPoints.some(
        (p) => p.properties?.parserStatus === "illustrative" || p.properties?.dataOrigin === "mock"
      );
      baselineValue = facilityPoints.reduce(
        (s, p) => s + Number(p.properties?.baselineValue ?? 0),
        0
      );
      interventionValue = facilityPoints.reduce(
        (s, p) => s + Number(p.properties?.interventionValue ?? p.value ?? 0),
        0
      );
      dataClass = isIllustrative ? "mock" : "observed";
      sourceLabel = isIllustrative
        ? "Illustrative zero-emission facility inventory (KPI 3.1)"
        : "Milan zero-emission facility deployment inventory";
      monitoringPeriod = `${facilityPoints.length} facility site${facilityPoints.length === 1 ? "" : "s"} · deployment units`;
      segmentApiId = String(
        facilityPoints[0]?.properties?.segmentId ??
          facilityPoints[0]?.properties?.siteKey ??
          segmentApiId
      );
      baselinePeriod = { ...base.baseline, dailyCycleCount: baselineValue };
      interventionPeriod = {
        ...base.intervention,
        dailyCycleCount: interventionValue,
      };
      if (!options.segmentName) {
        const junctionLabel = String(facilityPoints[0]?.properties?.junctionLabel ?? "").trim();
        const streetName = String(facilityPoints[0]?.properties?.streetName ?? "").trim();
        const category = String(
          facilityPoints[0]?.properties?.facilityCategory ??
            facilityPoints[0]?.properties?.category ??
            ""
        ).trim();
        displayName =
          junctionLabel || streetName || category || `${facilityPoints.length} zero-emission sites`;
      }
    }
  } else if (selectedKpi === "kpi3.2") {
    const emissionsPoints = activePoints.filter((p) => p.properties?.datasetKind === "emissions");
    const isIllustrative =
      emissionsPoints.length > 0 &&
      emissionsPoints.some(
        (p) => p.properties?.parserStatus === "illustrative" || p.properties?.dataOrigin === "mock"
      );
    if (isIllustrative) {
      baselineValue =
        emissionsPoints.reduce((s, p) => s + Number(p.properties?.baselineValue ?? 0), 0) /
        emissionsPoints.length;
      interventionValue =
        emissionsPoints.reduce(
          (s, p) => s + Number(p.properties?.interventionValue ?? p.value ?? 0),
          0
        ) / emissionsPoints.length;
      dataClass = "mock";
      sourceLabel = "Illustrative junction climate proxy · KPI 2.1 network anchors";
      const hubCount = new Set(
        emissionsPoints.map((p) => String(p.properties?.junctionId ?? p.properties?.siteKey ?? p.id))
      ).size;
      monitoringPeriod = `${hubCount} illustrative junction hub${hubCount === 1 ? "" : "s"} · climate proxy`;
      segmentApiId = String(
        emissionsPoints[0]?.properties?.junctionId ??
          emissionsPoints[0]?.properties?.segmentId ??
          segmentApiId
      );
      baselinePeriod = { ...base.baseline, co2ProxyKgDay: baselineValue * 10 };
      interventionPeriod = {
        ...base.intervention,
        co2ProxyKgDay: interventionValue * 10,
        peakCongestion: Math.min(1, interventionValue / 100),
      };
      if (!options.segmentName) {
        const junctionLabel = String(emissionsPoints[0]?.properties?.junctionLabel ?? "").trim();
        displayName = junctionLabel || `${hubCount} junction hub${hubCount === 1 ? "" : "s"}`;
      }
    } else if (envDataset && envDataset.records.length > 0) {
      const props = envSegment?.properties ?? options.segmentProperties ?? {};
      const weight = envSegment ? envTrafficWeight(props) : envDataset.stats.avgMetricValue;
      interventionValue = weight > 0 ? weight / 10 : envDataset.stats.avgMetricValue;
      baselineValue = interventionValue * 1.17;
      dataClass = "derived";
      sourceLabel = `${String(props.sourceLabel ?? "Milan RETE network")} · environmental proxy`;
      monitoringPeriod = `${envDataset.stats.parsedSegments} RETE segment${envDataset.stats.parsedSegments === 1 ? "" : "s"}`;
      segmentApiId = envSegment?.id ?? segmentApiId;
      displayName = options.segmentName || String(props.streetName ?? props.NOME_VIA ?? envSegment?.id ?? displayName);
      baselinePeriod = { ...base.baseline, co2ProxyKgDay: baselineValue * 10 };
      interventionPeriod = {
        ...base.intervention,
        co2ProxyKgDay: interventionValue * 10,
        peakCongestion: options.congestion ?? Math.min(1, (envSegment?.value ?? 40) / 100),
      };
    }
  } else if (selectedKpi === "kpi4.1") {
    const surveyPoints = activePoints.filter((p) => p.properties?.datasetKind === "survey");
    if (surveyPoints.length) {
      interventionValue =
        surveyPoints.reduce(
          (s, p) => s + Number(p.properties?.interventionValue ?? p.value ?? 0),
          0
        ) / surveyPoints.length;
      baselineValue =
        surveyPoints.reduce((s, p) => s + Number(p.properties?.baselineValue ?? 0), 0) /
        surveyPoints.length;
      dataClass = "observed";
      sourceLabel = "Milan satisfaction survey · SharePoint folder 7";
      monitoringPeriod = `${surveyPoints.length} pilot aggregate${surveyPoints.length === 1 ? "" : "s"} · no map coordinates`;
      segmentApiId = String(surveyPoints[0]?.id ?? segmentApiId);
      displayName = String(surveyPoints[0]?.properties?.category ?? "User satisfaction");
      baselinePeriod = { ...base.baseline, modeShare: { Pedestrian: baselineValue } };
      interventionPeriod = { ...base.intervention, modeShare: { Pedestrian: interventionValue } };
    }
  } else if (selectedKpi === "kpi2.1" && speedDataset && speedDataset.records.length > 0) {
    const props = speedSegment?.properties ?? options.segmentProperties ?? {};
    const avgSpeed = Number(
      options.speed ?? props.avgSpeed ?? speedSegment?.properties?.avgSpeed ?? speedDataset.stats.avgMetricValue
    );
    interventionValue = avgSpeed > 0 ? avgSpeed : speedDataset.stats.avgMetricValue;
    baselineValue = interventionValue * 1.08;
    dataClass = speedDataset.dataConfidence === "proxy" ? "derived" : "observed";
    sourceLabel = `${String(props.sourceLabel ?? "AMAT speed shapefile")} · ${pilotId.toUpperCase()}`;
    monitoringPeriod = `${speedDataset.stats.parsedSegments} speed segment${speedDataset.stats.parsedSegments === 1 ? "" : "s"}`;
    segmentApiId = speedSegment?.id ?? segmentApiId;
    displayName = options.segmentName || String(props.streetName ?? speedSegment?.id ?? displayName);
    baselinePeriod = { ...base.baseline, avgSpeedKmh: baselineValue };
    interventionPeriod = {
      ...base.intervention,
      avgSpeedKmh: interventionValue,
      peakCongestion: Math.min(1, (speedSegment?.value ?? 50) / 100),
    };
  } else if (activePoints.length > 0) {
    dataClass = "derived";
    interventionValue =
      activePoints.reduce((s, p) => s + p.value, 0) / Math.max(activePoints.length, 1);
    baselineValue = interventionValue * 0.92;
    sourceLabel = String(activePoints[0]?.properties?.source ?? sourceLabel);
    monitoringPeriod = `${activePoints.length} linked point${activePoints.length === 1 ? "" : "s"}`;
  }

  const scenarioValue =
    scenario === "baseline"
      ? baselineValue
      : scenario === "comparison"
        ? interventionValue - baselineValue
        : interventionValue;
  const highlight = getSegmentHighlight(scenarioValue, baselineValue, interventionValue, metric);

  const anchor = MILAN_PILOT_ANCHORS[pilotId as MilanPilotId];
  const lat =
    speedSegment?.coordinates?.[0]?.[0] ??
    envSegment?.coordinates?.[0]?.[0] ??
    activePoints[0]?.lat ??
    anchor?.lat ??
    base.coordinates[0];
  const lon =
    speedSegment?.coordinates?.[0]?.[1] ??
    envSegment?.coordinates?.[0]?.[1] ??
    activePoints[0]?.lon ??
    anchor?.lon ??
    base.coordinates[1];

  return {
    ...base,
    id: config.id,
    segmentApiId,
    name: displayName,
    shortName: displayName.length > 28 ? `${displayName.slice(0, 25)}…` : displayName,
    kpiValue: Math.round(scenarioValue * 10) / 10,
    kpiBand: highlight.band,
    armColor: highlight.color,
    bandColor: highlight.color,
    kpiLabel: kpiDef?.name ?? selectedKpi,
    pilot: options.pilotLabel ?? (pilot ? `Milan — ${pilot.name}` : base.pilot),
    interventionType: profile?.interventionSummary || base.interventionType,
    coordinates: [lat, lon],
    monitoringPeriod,
    dataConfidence: dataClass === "mock" ? base.dataConfidence : 0.84,
    baseline: baselinePeriod,
    intervention: interventionPeriod,
    dataSource: dataClass === "mock" ? "mock" : "observed",
    dataClass,
    sourceLabel,
    streetNS: config.streetNS,
    streetEW: config.streetEW,
  };
}
