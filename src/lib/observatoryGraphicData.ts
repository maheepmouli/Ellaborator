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
import { filterCopenhagenObservatoryPoints } from "@/lib/copenhagenObservatoryView";

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
    { mode: "Pedestrian", before: pct(pre.pedestrian, pre.total), after: pct(post.pedestrian, post.total) },
    { mode: "Cycle", before: pct(pre.bike, pre.total), after: pct(post.bike, post.total) },
    { mode: "Public Transport", before: pct(pre.motorised * 0.35, pre.total), after: pct(post.motorised * 0.35, post.total) },
    { mode: "Private Car", before: pct(pre.motorised * 0.65, pre.total), after: pct(post.motorised * 0.65, post.total) },
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
  const byId = new Map<string, CameraDirectionRow>();

  for (const p of points) {
    const mb = p.properties?.modeBreakdown as ModeBreakdown | undefined;
    if (!mb) continue;
    const id = String(p.properties?.segmentId || p.id);
    const direction = String(p.properties?.direction || p.properties?.mode || "Direction");
    const site = String(p.properties?.streetName || "Camera site");
    const postActive = selectedCount(mb.post, selectedModeTypes);
    const preActive = selectedCount(mb.pre, selectedModeTypes);
    const interventionPct = pct(postActive, mb.post.total);
    const baselinePct = pct(preActive, mb.pre.total);
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
    // Same segmentId can appear when xlsx + fallback overlap or duplicate flow rows — keep richest row.
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
  const total = (n: number) => Math.max(1, n);
  return [
    { mode: "Pedestrian", before: pct(mb.pre.pedestrian, total(mb.pre.total)), after: pct(mb.post.pedestrian, total(mb.post.total)) },
    { mode: "Cycle", before: pct(mb.pre.bike, total(mb.pre.total)), after: pct(mb.post.bike, total(mb.post.total)) },
    { mode: "Private Car", before: pct(mb.pre.motorised * 0.65, total(mb.pre.total)), after: pct(mb.post.motorised * 0.65, total(mb.post.total)) },
    { mode: "Public Transport", before: pct(mb.pre.motorised * 0.35, total(mb.pre.total)), after: pct(mb.post.motorised * 0.35, total(mb.post.total)) },
  ];
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
    pre.total += mb.pre.total;
    post.bike += mb.post.bike;
    post.pedestrian += mb.post.pedestrian;
    post.motorised += mb.post.motorised;
    post.ptw += mb.post.ptw;
    post.total += mb.post.total;
  }
  return [
    { mode: "Cycle", before: pct(pre.bike, pre.total), after: pct(post.bike, post.total) },
    { mode: "Motorised", before: pct(pre.motorised, pre.total), after: pct(post.motorised, post.total) },
  ];
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
  selectedSegmentId?: string | null;
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
    selectedSegmentId,
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
  const scopedObserved =
    cityName === "Copenhagen" && selectedSegmentId
      ? filterCopenhagenObservatoryPoints(observedPoints, selectedSegmentId)
      : observedPoints;
  const activeObserved = scopedObserved.length ? scopedObserved : observedPoints;

  const cameraDirections =
    cityName === "Copenhagen" ? cameraRowsFromPoints(activeObserved, selectedModeTypes) : [];
  const activeDirectionId =
    selectedDirectionId ?? cameraDirections[0]?.id ?? null;

  const markers =
    profile?.interventionMarkers?.map((m, i) => ({
      id: m.id,
      x: 20 + (i % 3) * 28,
      y: 25 + Math.floor(i / 3) * 30,
      label: m.title,
    })) ?? [];

  const perfDelta = performanceDeltaFromPoints(activeObserved);

  let modeShare =
    cityName === "Copenhagen" && activeObserved.length > 0
      ? modeShareFromCopenhagenPoints(activeObserved)
      : modeShareFromView(view);
  if (cityName === "Copenhagen" && spec.graphicId === "telraamModeBars") {
    const telraamShare = modeShareFromTelraamPoints(activeObserved);
    if (telraamShare.length) modeShare = telraamShare;
  }
  if (cityName === "Copenhagen" && spec.graphicId === "manualCountBars") {
    const manualShare = modeShareFromManualPoints(activeObserved);
    if (manualShare.length) modeShare = manualShare;
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

  const facilityLikert =
    spec.graphicId === "facilityInventory"
      ? (() => {
          const byType = new Map<string, number>();
          for (const p of activeObserved.filter((pt) => pt.properties?.datasetKind === "parking")) {
            const t = String(p.properties?.facilityCategory || "Parking");
            byType.set(t, (byType.get(t) || 0) + Number(p.value || 0));
          }
          return [...byType.entries()].map(([label, value]) => ({ label, value }));
        })()
      : spec.graphicId === "accessibilityBars" && accessibilityLikert?.length
        ? accessibilityLikert
        : cityName === "Copenhagen" &&
            (spec.graphicId === "likertRadar" || spec.graphicId === "surveyLikert")
          ? activeObserved
              .filter((p) => p.properties?.datasetKind === "survey")
              .map((p) => ({
                label: String(p.properties?.likertLabel || p.properties?.category || "Response"),
                value: Number(p.properties?.interventionValue ?? p.value),
              }))
          : likertFromPoints(activeObserved);

  const surveyStatCards =
    cityName === "Copenhagen" && spec.graphicId === "sentimentGauge"
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
      : tubeSpeedCards ?? statCardsFromView(view, selectedKpi);

  const payload: ObservatoryGraphicPayload = {
    spec: accessibilityEmptySpec !== spec ? accessibilityEmptySpec : spec,
    zone,
    kpiId: selectedKpi,
    observatoryType,
    dataClass,
    sourceLabel,
    kpiValue: view.kpiValue,
    modeShare,
    trend: trendFromView(view),
    cameraDirections,
    activeDirectionId,
    likert: facilityLikert,
    statCards: surveyStatCards,
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

  if (activeObserved.length === 0 && dataClass === "mock" && spec.emptyState) {
    payload.spec = { ...spec, emptyState: spec.emptyState };
  }

  return payload;
}

export function getCityCenter(cityName: string): { lat: number; lon: number } | null {
  const row = CITY_DATA.find((c) => c.city === cityName);
  return row ? { lat: row.lat, lon: row.lon } : null;
}
