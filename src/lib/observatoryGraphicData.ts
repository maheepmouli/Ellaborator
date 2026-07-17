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
import { normalizeConfidencePct } from "@/lib/observatoryCityContent";
import {
  filterCopenhagenObservatoryPoints,
  resolveCopenhagenWorkbookFocus,
  scopeCopenhagenPointsToWorkbookDirections,
} from "@/lib/copenhagenObservatoryView";
import { inferOtcWorkbookKey } from "@/data/copenhagenLocationRegistry";
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
  helsinkiTelraamStatCards,
} from "@/lib/helsinkiObservatoryView";
import {
  filterZaragozaObservatoryPoints,
  zaragozaCountStatCards,
} from "@/lib/zaragozaObservatoryView";
import {
  filterMilanObservatoryPoints,
  milanAccessibilityStatCards,
  milanClimateStatCards,
  milanCountStatCards,
  milanSpeedStatCards,
} from "@/lib/milanObservatoryView";
import type { MilanSegmentStats } from "@/services/milanSegmentData";

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
    const direction = String(p.properties?.direction || p.properties?.mode || "").trim();
    if (!direction || direction === "n/a") continue;

    const id = String(p.properties?.segmentId || p.id);
    const site = String(p.properties?.streetName || "Camera site");
    const mb = p.properties?.modeBreakdown as ModeBreakdown | undefined;

    let interventionPct = 0;
    let baselinePct = 0;
    if (mb) {
      const postActive = selectedCount(mb.post, selectedModeTypes);
      const preActive = selectedCount(mb.pre, selectedModeTypes);
      interventionPct = pct(postActive, mb.post.total);
      baselinePct = pct(preActive, mb.pre.total);
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

function isTrikalaPerSensorBikeLanePoint(p: LocalCityPoint): boolean {
  return (
    p.properties?.datasetKind === "bike-lane-sensor" &&
    String(p.properties?.segmentId ?? "").startsWith("tri-loc-")
  );
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
  const sensorPts = points.filter(isTrikalaPerSensorBikeLanePoint);
  if (!sensorPts.length) {
    const fleetPt = points.find((p) => p.properties?.datasetKind === "bike-lane-sensor-fleet");
    if (!fleetPt) return null;
    const fleetAvail = Math.round(fleetPt.value);
    const surveyPts = trikalaBikeLaneSurveyPoints(points);
    const perceivedSafety =
      surveyPts.length > 0
        ? Math.round(surveyPts.reduce((s, p) => s + p.value, 0) / surveyPts.length)
        : null;
    return [
      {
        label: "Lane availability (observed)",
        value: `${fleetAvail}%`,
        color: "#63ccff",
        note: "Fleet aggregate · LoRa parking-status",
      },
      {
        label: "Sensors linked",
        value: "29",
        note: "LoRa sensor workbooks · registry join",
      },
      perceivedSafety != null
        ? {
            label: "Perceived safety (survey)",
            value: `${perceivedSafety}%`,
            color: "#b0edba",
            note: `Bike-lane survey · n=${surveyPts.length} metrics`,
          }
        : {
            label: "Data class",
            value: "Observed",
            note: "Partner registry + SharePoint workbooks",
          },
    ];
  }

  const availabilityValues = sensorPts.map((p) =>
    typeof p.properties?.availabilityPct === "number"
      ? p.properties.availabilityPct
      : p.value
  );
  const avgAvailability = Math.round(
    availabilityValues.reduce((s, v) => s + v, 0) / availabilityValues.length
  );
  const totalObs = sensorPts.reduce(
    (s, p) => s + Number(p.properties?.observationCount ?? 0),
    0
  );
  const surveyPts = trikalaBikeLaneSurveyPoints(points);
  const perceivedSafety =
    surveyPts.length > 0
      ? Math.round(surveyPts.reduce((s, p) => s + p.value, 0) / surveyPts.length)
      : null;

  const cards: ObservatoryGraphicPayload["statCards"] = [
    {
      label: "Lane availability (observed)",
      value: `${avgAvailability}%`,
      color: "#63ccff",
      note:
        sensorPts.length === 1
          ? `${String(sensorPts[0].properties?.streetName ?? "Sensor")} · LoRa parking-status`
          : `LoRa parking-status · n=${sensorPts.length} sensors`,
    },
    {
      label: "Sensors linked",
      value: `${sensorPts.length}`,
      note: totalObs > 0 ? `${totalObs.toLocaleString()} readings` : "Registry join",
    },
  ];

  if (perceivedSafety != null) {
    cards.push({
      label: "Perceived safety (survey)",
      value: `${perceivedSafety}%`,
      color: "#b0edba",
      note: `Bike-lane survey · n=${surveyPts.length} metrics`,
    });
  } else {
    cards.push({
      label: "Observation coverage",
      value: totalObs > 0 ? totalObs.toLocaleString() : "—",
      note: "LoRa time-series aggregate",
    });
  }

  return cards;
}

function trikalaBikeLaneAccessibilityLikert(points: LocalCityPoint[]): LikertRow[] {
  const sensorRows = points
    .filter(isTrikalaPerSensorBikeLanePoint)
    .map((p) => ({
      label: String(p.properties?.streetName ?? "Sensor"),
      value:
        typeof p.properties?.availabilityPct === "number"
          ? p.properties.availabilityPct
          : p.value,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 12);

  const surveyRows = trikalaBikeLaneSurveyPoints(points).map((p) => ({
    label: String(p.properties?.likertLabel ?? p.properties?.streetName ?? "Survey"),
    value: Number(p.properties?.interventionValue ?? p.value),
    before: Number(p.properties?.baselineValue ?? 0),
    after: Number(p.properties?.interventionValue ?? p.value),
  }));

  return [...surveyRows, ...sensorRows];
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
        : `${Math.round(preAvg).toLocaleString()} g/h`;
      const postLabel = isIllustrative
        ? `${postAvg.toFixed(1)} idx`
        : `${Math.round(postAvg).toLocaleString()} g/h`;
      return [
        {
          label: isIllustrative ? "Env. pressure (post)" : "Modelled CO₂ (post)",
          value: postLabel,
          color: "#b0edba",
          note: isIllustrative
            ? `${emissionsPts.length} illustrative junction hub${emissionsPts.length === 1 ? "" : "s"}`
            : `≈ ${postKgDay} kg/day proxy`,
        },
        {
          label: "Baseline (pre)",
          value: preLabel,
          note: isIllustrative
            ? "Mode-share network anchors"
            : `≈ ${preKgDay} kg/day proxy`,
        },
        {
          label: "Reduction vs pre",
          value: `${reduction}%`,
          color: Number(reduction) >= 0 ? "#b0edba" : "#f43f5e",
          note: isIllustrative ? "Illustrative climate proxy" : "Modelled — not measured ambient CO₂",
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
  trikalaSegmentInsights?: TrikalaSegmentInsight[];
  trikalaLocations?: TrikalaLocation[];
  trikalaSensorJoins?: TrikalaSensorJoin[];
  trikalaWomenMobilityModeShare?: ModeShareRow[];
  milanSegmentStats?: MilanSegmentStats | null;
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
    trikalaSegmentInsights,
    trikalaLocations,
    trikalaSensorJoins,
    trikalaWomenMobilityModeShare,
    milanSegmentStats,
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
    view.dataClass ??
  classifyDataOrigin(points, view.dataSource === "observed" ? "observed" : "mock");
  const sourceLabel =
    String(view.sourceLabel || points[0]?.properties?.source || kpiDef?.dataLabel || profile?.dataAvailability || "Linked dataset");

  const observedPoints = points.filter(
    (p) =>
      p.properties?.dataOrigin === "local-city-dataset" ||
      p.properties?.type === "observed" ||
      p.properties?.type === "derived" ||
      (cityName === "Milan" &&
        (p.properties?.parserStatus === "illustrative" || p.properties?.dataOrigin === "mock") &&
        (selectedKpi === "kpi1.2" ||
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
      activeObserved = filterTrikalaObservatoryPoints(
        observedPoints,
        selectedSegmentId,
        location,
        trikalaSensorJoins
      );
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
  if (cityName === "Copenhagen") {
    const workbookFocus =
      resolveCopenhagenWorkbookFocus(selectedSegmentId, {
        segmentName: view.name,
        segmentApiId: view.segmentApiId,
        streetName: String(activeObserved[0]?.properties?.streetName ?? ""),
      }) ??
      inferOtcWorkbookKey(String(view.name || view.segmentApiId || "")) ??
      inferOtcWorkbookKey(String(activeObserved[0]?.properties?.streetName ?? ""));
    activeObserved = scopeCopenhagenPointsToWorkbookDirections(activeObserved, workbookFocus);
  }

  const cameraDirections =
    cityName === "Copenhagen"
      ? cameraRowsFromPoints(activeObserved, selectedModeTypes)
      : cityName === "Trikala" && selectedKpi === "kpi1.2"
        ? mobilityFlowRowsFromPoints(activeObserved)
        : cityName === "Milan" && selectedKpi === "kpi1.2"
          ? cameraRowsFromPoints(activeObserved, selectedModeTypes)
          : [];
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
  if (cityName === "Milan" && selectedKpi === "kpi1.2" && activeObserved.length > 0) {
    const milanShare = modeShareFromCopenhagenPoints(activeObserved);
    if (milanShare.some((row) => row.before > 0 || row.after > 0)) {
      modeShare = milanShare;
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
    const zarShare = modeShareFromCopenhagenPoints(activeObserved);
    if (zarShare.some((r) => r.before > 0 || r.after > 0)) modeShare = zarShare;
  }
  if (cityName === "Helsinki" && selectedKpi === "kpi1.2" && activeObserved.length > 0) {
    const fromTelraam = modeShareFromCopenhagenPoints(activeObserved);
    if (fromTelraam.some((r) => r.before > 0 || r.after > 0)) {
      modeShare = fromTelraam;
    }
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

  if (
    cityName === "Milan" &&
    (spec.graphicId === "accessibilityBars" || spec.graphicId === "dssBars")
  ) {
    const a11yBars = activeObserved
      .filter((p) => p.properties?.datasetKind === "accessibility")
      .map((p) => ({
        label: String(
          p.properties?.facilityCategory ??
            p.properties?.category ??
            p.properties?.junctionLabel ??
            p.properties?.streetName ??
            "Accessibility"
        ),
        before: Number(p.properties?.baselineValue ?? 0),
        after: Number(p.properties?.interventionValue ?? p.value ?? 0),
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
    spec.graphicId === "accessibilityBars"
  ) {
    const triA11yLikert = trikalaBikeLaneAccessibilityLikert(activeObserved);
    if (triA11yLikert.length) {
      accessibilityLikert = triA11yLikert;
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
        : (spec.graphicId === "dssBars" || spec.graphicId === "accessLikert") &&
            accessibilityLikert?.length
          ? accessibilityLikert
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

  const trikalaA11yCards =
    cityName === "Trikala" && pilotId === "tri-p3" && selectedKpi === "kpi4.2"
      ? trikalaBikeLaneA11yStatCards(activeObserved)
      : null;

  const helsinkiCards =
    cityName === "Helsinki" ? helsinkiTelraamStatCards(activeObserved) : null;
  const zaragozaCards =
    cityName === "Zaragoza" ? zaragozaCountStatCards(activeObserved) : null;
  const milanA11yCards =
    cityName === "Milan" && selectedKpi === "kpi4.2"
      ? milanAccessibilityStatCards(activeObserved)
      : null;
  const milanClimateCards =
    cityName === "Milan" && selectedKpi === "kpi3.2"
      ? milanClimateStatCards(activeObserved)
      : null;
  const milanCountCards =
    cityName === "Milan" && selectedKpi === "kpi1.2"
      ? milanCountStatCards(activeObserved)
      : null;
  const milanSpeedCards =
    cityName === "Milan" && selectedKpi === "kpi2.1" && spec.graphicId === "speedProfile"
      ? milanSpeedStatCards(milanSegmentStats)
      : null;

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
      : trikalaA11yCards ??
        milanClimateCards ??
        milanA11yCards ??
        milanCountCards ??
        milanSpeedCards ??
        helsinkiCards ??
        zaragozaCards ??
        tubeSpeedCards ??
        statCardsFromView(view, selectedKpi, activeObserved);

  const effectiveSourceLabel = trikalaA11yCards
    ? "Bike-lane LoRa sensor time-series · partner My Maps registry"
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
      : milanCountCards
        ? "Milan AMAT road user counts · SharePoint"
        : milanSpeedCards
          ? "Milan AMAT speed shapefile · SharePoint"
          : helsinkiCards
            ? "Helsinki Telraam flow export · SharePoint"
            : zaragozaCards
              ? "Zaragoza mobility workbooks & manual counts · SharePoint"
              : sourceLabel;
  const effectiveDataClass: ObservatoryDataClass =
    trikalaA11yCards || milanClimateCards || milanA11yCards || milanCountCards || milanSpeedCards || helsinkiCards || zaragozaCards
      ? activeObserved.some(
          (p) => p.properties?.parserStatus === "illustrative" || p.properties?.dataOrigin === "mock"
        )
        ? "mock"
        : "observed"
      : dataClass;

  const payload: ObservatoryGraphicPayload = {
    spec: accessibilityEmptySpec !== spec ? accessibilityEmptySpec : spec,
    zone,
    kpiId: selectedKpi,
    observatoryType,
    dataClass: effectiveDataClass,
    sourceLabel: effectiveSourceLabel,
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

  if (activeObserved.length === 0 && effectiveDataClass === "mock" && spec.emptyState) {
    payload.spec = { ...spec, emptyState: spec.emptyState };
  }

  return payload;
}

export function getCityCenter(cityName: string): { lat: number; lon: number } | null {
  const row = CITY_DATA.find((c) => c.city === cityName);
  return row ? { lat: row.lat, lon: row.lon } : null;
}
