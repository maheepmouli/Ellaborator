import type { TrafficSegment } from "@/types/traffic";
import { getTrafficKpiValue } from "@/services/trafficApi";
import {
  getIssyJunctionArm,
  ISSY_JUNCTION_ARMS,
  ISSY_P2_JUNCTION,
  type IssyJunctionArmId,
} from "@/lib/issyPilot2Junction";
import {
  getQuantile,
  getSegmentHighlight,
  segmentMetricKindForKpi,
} from "@/lib/segmentHighlight";
import { getKpiDefinition } from "@/config/kpiDefinitions";
import {
  deriveJunctionBaselineRaw,
  getJunctionScenarioMetrics,
  type MapScenario,
} from "@/lib/junctionScenarioValues";

export interface JunctionPeriodView {
  label: string;
  period: string;
  modeShare: Record<string, number>;
  dailyCycleCount: number;
  peakCongestion: number;
  avgSpeedKmh: number;
  co2ProxyKgDay: number;
  trendCycle: number[];
  trendCar: number[];
}

export interface JunctionStudyView {
  id: string;
  segmentApiId: string;
  name: string;
  shortName: string;
  armLabel: string;
  armId: IssyJunctionArmId;
  armColor: string;
  /** Line colour from KPI legend band (matches map). */
  bandColor: string;
  kpiBand: string;
  kpiValue: number;
  selectedKpi: string;
  kpiLabel: string;
  pilot: string;
  interventionType: string;
  coordinates: [number, number];
  monitoringPeriod: string;
  sensors: number;
  approachesCovered: number;
  totalApproaches: number;
  dataConfidence: number;
  baseline: JunctionPeriodView;
  intervention: JunctionPeriodView;
  timeline: { date: string; event: string; status: "done" | "upcoming" }[];
  observedAt?: string;
  distanceMetres?: number;
}

function armFromSegment(segment: TrafficSegment): (typeof ISSY_JUNCTION_ARMS)[number] | undefined {
  return getIssyJunctionArm(segment.id);
}

/** Deterministic variation per arm (stable UI, anchored on API). */
function armSeed(armId: string): number {
  let h = 0;
  for (let i = 0; i < armId.length; i++) h = (h * 31 + armId.charCodeAt(i)) % 997;
  return h / 997;
}

function deriveModeShare(speedKmh: number, congestion: number, seed: number) {
  const cycle = Math.round(6 + (speedKmh / 40) * 12 + seed * 6);
  const car = Math.round(52 - congestion * 22 - seed * 8);
  const pt = Math.round(18 + seed * 5);
  const ped = Math.round(14 + (1 - congestion) * 8);
  const ptw = Math.max(2, 100 - cycle - car - pt - ped);
  return {
    Pedestrian: Math.max(5, ped),
    Cycle: Math.max(4, cycle),
    "Public Transport": Math.max(8, pt),
    Car: Math.max(20, car),
    PTW: Math.max(2, ptw),
  };
}

function buildTrend(base: number, drift: number, n = 9): number[] {
  return Array.from({ length: n }, (_, i) => Math.round(base * (0.92 + (i / n) * 0.1) + drift * (i - 4)));
}

/**
 * Builds panel view from latest traficissy row for one junction arm.
 * Baseline = scaled snapshot (~12% worse congestion, ~8% lower speed).
 */
export function buildJunctionStudyView(
  segment: TrafficSegment,
  allSegments: TrafficSegment[],
  pilotLabel = "Issy-les-Moulineaux",
  selectedKpi = "kpi2.1",
  kpi32IntensityScale = 1,
  scenario: MapScenario = "intervention"
): JunctionStudyView {
  const arm = armFromSegment(segment);
  const seed = armSeed(segment.id);
  const speed = segment.vitesse_km_h ?? 20;
  const congestion = segment.indice_de_congestion ?? 0.2;
  const distance = segment.distance_metres ?? 200;
  const metric = segmentMetricKindForKpi(selectedKpi);

  const scenarioMetrics = getJunctionScenarioMetrics(
    {
      id: segment.id,
      coordinates: segment.coordinates,
      value: 0,
      properties: {
        vitesse_km_h: speed,
        indice_de_congestion: congestion,
        nom: segment.segment,
      },
    },
    selectedKpi
  );

  const kpiValues = allSegments.map(
    (s) => getTrafficKpiValue(s, selectedKpi) * kpi32IntensityScale
  );
  const low = getQuantile(kpiValues, 0.15);
  const high = getQuantile(kpiValues, 0.85);
  const scenarioKpiRaw =
    scenario === "baseline" ? scenarioMetrics.baseline : scenarioMetrics.intervention;
  const kpiValue = scenarioKpiRaw * kpi32IntensityScale;
  const highlight = getSegmentHighlight(kpiValue, low, high, metric);
  const kpiDef = getKpiDefinition(selectedKpi);
  const interventionCong = congestion;
  const baselineRaw = deriveJunctionBaselineRaw(segment.id, speed, congestion);
  const baselineCong = baselineRaw.congestion;
  const interventionSpeed = speed;
  const baselineSpeed = baselineRaw.speedKmh;

  const interventionCycles = Math.round(280 + (speed / 30) * 420 * (1 - congestion * 0.35));
  const baselineCycles = Math.round(interventionCycles * (0.58 + seed * 0.12));

  const interventionCo2 = Math.round(900 + distance * 0.8 + congestion * 400);
  const baselineCo2 = Math.round(interventionCo2 * (1.12 + seed * 0.06));

  const interventionModes = deriveModeShare(interventionSpeed, interventionCong, seed);
  const baselineModes = deriveModeShare(baselineSpeed, baselineCong, seed * 0.7);

  const confidence = Math.round(72 + (1 - congestion) * 18 + seed * 8);

  return {
    id: `issy-arm-${arm?.id ?? segment.id}`,
    segmentApiId: segment.id,
    name: arm?.mapLabel ?? segment.segment,
    shortName: ISSY_P2_JUNCTION.shortName,
    armLabel: arm?.armLabel ?? segment.segment,
    armId: arm?.id ?? "quai-paris",
    armColor: highlight.color,
    bandColor: highlight.color,
    kpiBand: highlight.band,
    kpiValue: Math.round(kpiValue * 10) / 10,
    selectedKpi,
    kpiLabel: kpiDef?.name ?? selectedKpi,
    pilot: pilotLabel,
    interventionType: "Cycle Lane Continuity",
    coordinates: [ISSY_P2_JUNCTION.lat, ISSY_P2_JUNCTION.lon],
    monitoringPeriod: "Jun 2024 — ongoing",
    sensors: 1,
    approachesCovered: 1,
    totalApproaches: 4,
    dataConfidence: Math.min(95, confidence),
    observedAt: segment.date_et_heure_de_comptage_utc,
    distanceMetres: distance,
    baseline: {
      label: "Baseline (derived)",
      period: "Jun – Aug 2024",
      modeShare: baselineModes,
      dailyCycleCount: baselineCycles,
      peakCongestion: baselineCong,
      avgSpeedKmh: baselineSpeed,
      co2ProxyKgDay: baselineCo2,
      trendCycle: buildTrend(baselineCycles, -12),
      trendCar: buildTrend(baselineCo2 / 3, 40),
    },
    intervention: {
      label: "Latest observation",
      period: "Live API snapshot",
      modeShare: interventionModes,
      dailyCycleCount: interventionCycles,
      peakCongestion: interventionCong,
      avgSpeedKmh: interventionSpeed,
      co2ProxyKgDay: interventionCo2,
      trendCycle: buildTrend(interventionCycles, 8),
      trendCar: buildTrend(interventionCo2 / 3, -20),
    },
    timeline: [
      { date: "Jun 2024", event: "Baseline monitoring begins", status: "done" },
      { date: "Sep 2024", event: "Cycle infrastructure deployed", status: "done" },
      { date: "Nov 2024", event: "Post-intervention monitoring begins", status: "done" },
      { date: "Q2 2025", event: "Full impact evaluation report", status: "upcoming" },
    ],
  };
}

export function buildJunctionStudyViews(
  segments: TrafficSegment[],
  pilotLabel?: string,
  selectedKpi?: string,
  kpi32IntensityScale?: number,
  scenario: MapScenario = "intervention"
): JunctionStudyView[] {
  const arms = segments.filter((s) => getIssyJunctionArm(s.id));
  return arms.map((s) =>
    buildJunctionStudyView(s, arms, pilotLabel, selectedKpi, kpi32IntensityScale, scenario)
  );
}

export function pickDefaultSegment(segments: TrafficSegment[]): TrafficSegment | null {
  if (!segments.length) return null;
  const order = ISSY_JUNCTION_ARMS.map((a) => a.segmentId);
  for (const id of order) {
    const hit = segments.find((s) => s.id === id);
    if (hit) return hit;
  }
  return segments[0];
}
