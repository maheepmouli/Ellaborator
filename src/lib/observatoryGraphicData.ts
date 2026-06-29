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

type ModeBreakdown = {
  pre: { bike: number; pedestrian: number; motorised: number; ptw: number; total: number };
  post: { bike: number; pedestrian: number; motorised: number; ptw: number; total: number };
};

function pct(part: number, total: number): number {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return 0;
  return (part / total) * 100;
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

function modeShareFromCopenhagenPoints(points: LocalCityPoint[]): ModeShareRow[] {
  const pre = { bike: 0, pedestrian: 0, motorised: 0, ptw: 0, total: 0 };
  const post = { bike: 0, pedestrian: 0, motorised: 0, ptw: 0, total: 0 };
  for (const point of points) {
    const mb = point.properties?.modeBreakdown as ModeBreakdown | undefined;
    if (!mb) continue;
    pre.bike += mb.pre.bike;
    pre.pedestrian += mb.pre.pedestrian;
    pre.motorised += mb.pre.motorised;
    pre.ptw += mb.pre.ptw;
    pre.total += mb.pre.total;
    post.bike += mb.post.bike;
    post.pedestrian += mb.post.pedestrian;
    post.motorised += mb.post.motorised;
    post.ptw += mb.post.ptw;
    post.total += mb.post.total;
  }
  return [
    { mode: "Cycle", before: pct(pre.bike, pre.total), after: pct(post.bike, post.total) },
    { mode: "Pedestrian", before: pct(pre.pedestrian, pre.total), after: pct(post.pedestrian, post.total) },
    { mode: "Private Car", before: pct(pre.motorised, pre.total), after: pct(post.motorised, post.total) },
    { mode: "PTW", before: pct(pre.ptw, pre.total), after: pct(post.ptw, post.total) },
  ];
}

function modeShareFromView(view: JunctionStudyView): ModeShareRow[] {
  const modes = Object.keys(view.baseline.modeShare);
  return modes.map((mode) => ({
    mode,
    before: view.baseline.modeShare[mode as keyof typeof view.baseline.modeShare] ?? 0,
    after: view.intervention.modeShare[mode as keyof typeof view.intervention.modeShare] ?? 0,
  }));
}

function cameraRowsFromPoints(
  points: LocalCityPoint[],
  selectedModeTypes: string[]
): CameraDirectionRow[] {
  return points
    .map((p) => {
      const mb = p.properties?.modeBreakdown as ModeBreakdown | undefined;
      if (!mb) return null;
      const id = String(p.properties?.segmentId || p.id);
      const direction = String(p.properties?.direction || p.properties?.mode || "Direction");
      const site = String(p.properties?.streetName || "Camera site");
      const postActive = selectedCount(mb.post, selectedModeTypes);
      const preActive = selectedCount(mb.pre, selectedModeTypes);
      const interventionPct = pct(postActive, mb.post.total);
      const baselinePct = pct(preActive, mb.pre.total);
      return {
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
    })
    .filter((row): row is CameraDirectionRow => Boolean(row));
}

function likertFromPoints(points: LocalCityPoint[]): LikertRow[] {
  const agg = new Map<string, number[]>();
  for (const p of points) {
    const label = String(p.properties?.category || p.properties?.mode || "Response");
    const vals = agg.get(label) ?? [];
    vals.push(p.value);
    agg.set(label, vals);
  }
  return Array.from(agg.entries()).map(([label, vals]) => ({
    label,
    value: vals.reduce((s, v) => s + v, 0) / vals.length,
  }));
}

function statCardsFromView(view: JunctionStudyView, kpiId: string): ObservatoryGraphicPayload["statCards"] {
  const { baseline, intervention } = view;
  if (kpiId === "kpi4.1") {
    return [
      { label: "Satisfied share", value: `${Math.round(intervention.modeShare.Cycle + intervention.modeShare.Pedestrian)}%`, color: "#b0edba" },
      { label: "Sample confidence", value: `${Math.round(view.dataConfidence * 100)}%`, note: "Survey proxy" },
    ];
  }
  if (kpiId === "kpi4.2") {
    return [
      { label: "Accessibility score", value: view.kpiValue.toFixed(1), color: "#63ccff" },
      { label: "Coverage", value: `${view.approachesCovered}/${view.totalApproaches}`, note: "Feature reach" },
    ];
  }
  if (kpiId === "kpi3.2") {
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
  const cycle = view.intervention.trendCycle;
  if (!cycle?.length) {
    return [
      { t: "Baseline", v: view.baseline.avgSpeedKmh },
      { t: "Intervention", v: view.intervention.avgSpeedKmh },
    ];
  }
  return cycle.map((v, i) => ({ t: `D${i + 1}`, v }));
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
  spec?: ObservatoryGraphicSpec | null;
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
    spec: inputSpec,
  } = input;

  const observatoryType = resolveObservatoryType(cityName, pilotId);
  const spec = inputSpec ?? resolveObservatoryGraphic(observatoryType, selectedKpi, zone, pilotId);
  if (!spec) return null;

  const profile = getCityPilotProfile(pilotId);
  const kpiDef = getKpiDefinition(selectedKpi);
  const dataClass: ObservatoryDataClass =
    view.dataClass ??
  classifyDataOrigin(points, view.dataSource === "observed" ? "observed" : "mock");
  const sourceLabel =
    String(view.sourceLabel || points[0]?.properties?.source || kpiDef?.dataLabel || profile?.dataAvailability || "Linked dataset");

  const observedPoints = points.filter(
    (p) =>
      p.properties?.dataOrigin === "local-city-dataset" ||
      p.properties?.type === "observed" ||
      p.properties?.type === "derived"
  );

  const cameraDirections = cityName === "Copenhagen" ? cameraRowsFromPoints(observedPoints, selectedModeTypes) : [];
  const activeDirectionId =
    selectedDirectionId ?? cameraDirections[0]?.id ?? null;

  const markers =
    profile?.interventionMarkers?.map((m, i) => ({
      id: m.id,
      x: 20 + (i % 3) * 28,
      y: 25 + Math.floor(i / 3) * 30,
      label: m.title,
    })) ?? [];

  const perfDelta = performanceDeltaFromPoints(observedPoints);
  const payload: ObservatoryGraphicPayload = {
    spec,
    zone,
    kpiId: selectedKpi,
    observatoryType,
    dataClass,
    sourceLabel,
    kpiValue: view.kpiValue,
    modeShare:
      cityName === "Copenhagen" && observedPoints.length > 0
        ? modeShareFromCopenhagenPoints(observedPoints)
        : modeShareFromView(view),
    trend: trendFromView(view),
    cameraDirections,
    activeDirectionId,
    likert: likertFromPoints(observedPoints),
    statCards: statCardsFromView(view, selectedKpi),
    markers,
    segmentGradient: view.intervention.peakCongestion,
    streetNS: view.streetNS,
    streetEW: view.streetEW,
    highlightArmId: view.armId,
    pilotTitle: profile?.title,
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

  if (observedPoints.length === 0 && dataClass === "mock" && spec.emptyState) {
    payload.spec = { ...spec, emptyState: spec.emptyState };
  }

  return payload;
}

export function getCityCenter(cityName: string): { lat: number; lon: number } | null {
  const row = CITY_DATA.find((c) => c.city === cityName);
  return row ? { lat: row.lat, lon: row.lon } : null;
}
