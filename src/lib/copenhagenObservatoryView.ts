import type { JunctionConfig } from "@/data/junctionConfigs";
import type { JunctionPeriodView, JunctionStudyView } from "@/lib/issyJunctionAnalytics";
import { buildMockJunctionStudyView } from "@/lib/junctionMockAnalytics";
import { getKpiDefinition } from "@/config/kpiDefinitions";
import {
  getSegmentHighlight,
  segmentMetricKindForKpi,
} from "@/lib/segmentHighlight";
import type { MapScenario } from "@/context/MapIntelligenceContext";
import type { LocalCityPoint } from "@/services/localCityData";
import { getCopenhagenPilotRecord } from "@/data/copenhagenPilotRegistry";
import {
  inferOtcWorkbookKey,
  resolveMethodologyConstraint,
} from "@/data/copenhagenLocationRegistry";
import {
  applyMethodologyToAgg,
  getMethodologyConstraintForWorkbook,
} from "@/lib/copenhagenMethodology";
import {
  buildParkingSegmentId,
  normalizeCopenhagenSegmentKey,
} from "@/lib/copenhagenMapLayers/copenhagenParkingLayerStyles";
import {
  getCopenhagenLocationFromSelection,
  parseCopenhagenMapSelection,
} from "@/lib/copenhagenMapSelection";
import { areAllTravelModesSelected } from "@/lib/travelModeMapLink";

type ModeBreakdown = {
  pre: { bike: number; pedestrian: number; motorised: number; ptw: number; total: number };
  post: { bike: number; pedestrian: number; motorised: number; ptw: number; total: number };
};

type ModeAgg = {
  bike: number;
  pedestrian: number;
  motorised: number;
  ptw: number;
  total: number;
};

type ModeBreakdown = {
  pre: ModeAgg;
  post: ModeAgg;
};

function pct(part: number, total: number): number {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return 0;
  return (part / total) * 100;
}

function selectedActiveCount(b: ModeAgg, modes: string[]): number {
  const strict = modes.length > 0 && !areAllTravelModesSelected(modes);
  if (!strict) return b.bike + b.pedestrian;
  let total = 0;
  if (modes.includes("Cycle")) total += b.bike;
  if (modes.includes("Pedestrian")) total += b.pedestrian;
  if (modes.includes("Private Car") || modes.includes("Public Transport")) total += b.motorised;
  if (modes.includes("PTW")) total += b.ptw;
  return total;
}

function aggregateModeBreakdown(points: LocalCityPoint[]): ModeBreakdown {
  const pre: ModeAgg = { bike: 0, pedestrian: 0, motorised: 0, ptw: 0, total: 0 };
  const post: ModeAgg = { bike: 0, pedestrian: 0, motorised: 0, ptw: 0, total: 0 };

  for (const point of points) {
    const mb = point.properties?.modeBreakdown as ModeBreakdown | undefined;
    if (!mb) continue;
    const workbookKey = inferOtcWorkbookKey(String(point.properties?.streetName ?? ""));
    const rule = getMethodologyConstraintForWorkbook(workbookKey);
    const flow = String(point.properties?.direction ?? point.properties?.mode ?? "");
    let preAgg = {
      flow,
      bike: mb.pre.bike,
      pedestrian: mb.pre.pedestrian,
      motorized: mb.pre.motorised,
      ptw: mb.pre.ptw,
      total: mb.pre.total,
    };
    let postAgg = {
      flow,
      bike: mb.post.bike,
      pedestrian: mb.post.pedestrian,
      motorized: mb.post.motorised,
      ptw: mb.post.ptw,
      total: mb.post.total,
    };
    if (rule) {
      preAgg = applyMethodologyToAgg(preAgg, rule);
      postAgg = applyMethodologyToAgg(postAgg, rule);
    }
    pre.bike += preAgg.bike;
    pre.pedestrian += preAgg.pedestrian;
    pre.motorised += preAgg.motorized;
    pre.ptw += preAgg.ptw;
    pre.total += preAgg.total;
    post.bike += postAgg.bike;
    post.pedestrian += postAgg.pedestrian;
    post.motorised += postAgg.motorized;
    post.ptw += postAgg.ptw;
    post.total += postAgg.total;
  }

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
      "Public Transport": pct(agg.motorised * 0.35, agg.total),
      Car: pct(agg.motorised * 0.65, agg.total),
      PTW: pct(agg.ptw, agg.total),
    },
    dailyCycleCount: Math.round(agg.bike),
    peakCongestion: Math.min(1, motorShare / 100),
    avgSpeedKmh: Math.max(12, 32 - motorShare * 0.12),
    co2ProxyKgDay: Math.round((agg.motorised + agg.ptw) * 0.42),
    trendCycle: [trendBase * 0.92, trendBase * 0.96, trendBase],
    trendCar: peerAgg
      ? [peerAgg.motorised * 0.94, peerAgg.motorised, peerAgg.motorised * 1.03]
      : [agg.motorised * 0.94, agg.motorised, agg.motorised * 1.03],
  };
}

function kpiValueFromAgg(
  agg: ModeAgg,
  selectedKpi: string,
  selectedModeTypes: string[]
): number {
  const total = Math.max(1, agg.total);
  switch (selectedKpi) {
    case "kpi1.2":
      return pct(selectedActiveCount(agg, selectedModeTypes), total);
    case "kpi2.1": {
      const motor = agg.motorised + agg.ptw;
      return pct(motor, total) * 0.6 + Math.min(100, (total / 200) * 100) * 0.4;
    }
    case "kpi3.2": {
      const motorPct = pct(agg.motorised + agg.ptw, total);
      return motorPct * 0.7 + Math.min(100, (total / 250) * 100) * 0.3;
    }
    default:
      return pct(agg.bike + agg.pedestrian, total);
  }
}

export function filterCopenhagenObservatoryPoints(
  points: LocalCityPoint[],
  selectionId: string | null | undefined
): LocalCityPoint[] {
  if (!selectionId) return points;

  if (selectionId.startsWith("parking-")) {
    return points.filter((p) => {
      const seg = String(p.properties?.segmentId ?? p.id);
      if (seg === selectionId) return true;
      const street = String(p.properties?.streetName ?? "");
      const category = String(p.properties?.facilityCategory ?? p.properties?.category ?? "");
      if (!street || !category) return false;
      return buildParkingSegmentId(street, category) === selectionId;
    });
  }

  if (selectionId.startsWith("a11y-")) {
    const categoryKey = selectionId.slice("a11y-".length);
    return points.filter((p) => {
      const seg = String(p.properties?.segmentId ?? p.id);
      if (seg === selectionId) return true;
      const category = String(
        p.properties?.facilityCategory ?? p.properties?.category ?? p.properties?.streetName ?? ""
      );
      return normalizeCopenhagenSegmentKey(category) === categoryKey;
    });
  }

  const parsed = parseCopenhagenMapSelection(selectionId);
  if (parsed.kind === "site" && parsed.workbookKey) {
    return points.filter(
      (p) => inferOtcWorkbookKey(String(p.properties?.streetName ?? "")) === parsed.workbookKey
    );
  }
  if (parsed.kind === "location") {
    const loc = getCopenhagenLocationFromSelection(selectionId);
    if (loc?.otcWorkbookKey) {
      return points.filter(
        (p) => inferOtcWorkbookKey(String(p.properties?.streetName ?? "")) === loc.otcWorkbookKey
      );
    }
    if (loc?.id) {
      return points;
    }
  }
  if (parsed.kind === "direction" && parsed.directionSegmentId) {
    return points.filter(
      (p) => String(p.properties?.segmentId ?? p.id) === parsed.directionSegmentId
    );
  }
  return points.filter(
    (p) =>
      String(p.properties?.segmentId ?? p.id) === selectionId ||
      String(p.properties?.segmentId ?? "").includes(selectionId) ||
      selectionId.includes(String(p.properties?.segmentId ?? ""))
  );
}

export function buildCopenhagenObservatoryView(
  config: JunctionConfig,
  pilotId: string,
  selectedKpi: string,
  scenario: MapScenario,
  points: LocalCityPoint[],
  options?: {
    pilotLabel?: string;
    selectionId?: string | null;
    selectedModeTypes?: string[];
    segmentName?: string | null;
  }
): JunctionStudyView {
  const observed = points.filter((p) => p.properties?.dataOrigin === "local-city-dataset");
  const base = buildMockJunctionStudyView(config, selectedKpi, scenario);
  if (!observed.length) {
    return {
      ...base,
      dataClass: "mock",
      sourceLabel: "OpenTrafficCam — awaiting observed directional rows",
    };
  }

  const scoped = options?.selectionId
    ? filterCopenhagenObservatoryPoints(observed, options.selectionId)
    : observed;
  const activePoints = options?.selectionId ? scoped : observed;
  const { pre, post } = aggregateModeBreakdown(activePoints);
  const modeTypes = options?.selectedModeTypes ?? [];
  const infraPoints = activePoints.filter(
    (p) =>
      p.properties?.datasetKind === "parking" || p.properties?.datasetKind === "accessibility"
  );
  const hasModeBreakdown = pre.total > 0 || post.total > 0;

  const infraPeriod = (value: number, label: string, periodLabel: string): JunctionPeriodView => ({
    label,
    period: periodLabel,
    modeShare: {},
    dailyCycleCount: Math.round(value),
    peakCongestion: 0,
    avgSpeedKmh: value,
    co2ProxyKgDay: 0,
    trendCycle: [value],
    trendCar: [value],
  });

  let baselineValue: number;
  let interventionValue: number;
  if (infraPoints.length && !hasModeBreakdown) {
    baselineValue = infraPoints.reduce(
      (sum, p) => sum + Number(p.properties?.baselineValue ?? 0),
      0
    );
    interventionValue = infraPoints.reduce(
      (sum, p) => sum + Number(p.properties?.interventionValue ?? p.value ?? 0),
      0
    );
  } else {
    baselineValue = kpiValueFromAgg(pre, selectedKpi, modeTypes);
    interventionValue = kpiValueFromAgg(post, selectedKpi, modeTypes);
  }

  const baselinePeriod = hasModeBreakdown
    ? periodFromAgg(pre, "Pre-intervention", "OpenTrafficCam pre sample", post)
    : infraPeriod(
        baselineValue,
        "Pre-intervention",
        infraPoints[0]?.properties?.source
          ? String(infraPoints[0].properties.source)
          : "Parking inventory (Eksisterende forhold)"
      );
  const interventionPeriod = hasModeBreakdown
    ? periodFromAgg(post, "Post-intervention", "OpenTrafficCam post sample", pre)
    : infraPeriod(
        interventionValue,
        "Post-intervention",
        infraPoints[0]?.properties?.source
          ? String(infraPoints[0].properties.source)
          : "Parking inventory (Udført)"
      );
  const scenarioValue =
    scenario === "baseline"
      ? baselineValue
      : scenario === "comparison"
        ? interventionValue - baselineValue
        : interventionValue;

  const metric = segmentMetricKindForKpi(selectedKpi);
  const highlight = getSegmentHighlight(scenarioValue, baselineValue, interventionValue, metric);
  const kpiDef = getKpiDefinition(selectedKpi);
  const pilotRecord = getCopenhagenPilotRecord(pilotId);

  const siteNames = [
    ...new Set(
      activePoints.map((p) => String(p.properties?.streetName ?? "").trim()).filter(Boolean)
    ),
  ];
  const directionCount = activePoints.length;
  const selectionMeta = parseCopenhagenMapSelection(options?.selectionId);
  const selectedLocation = getCopenhagenLocationFromSelection(options?.selectionId ?? null);

  let displayName = options?.segmentName || siteNames[0] || config.name;
  if (!options?.segmentName && selectionMeta.kind === "direction" && activePoints[0]) {
    const direction = String(
      activePoints[0].properties?.direction ?? activePoints[0].properties?.mode ?? ""
    );
    displayName = `${siteNames[0] ?? config.name} · ${direction}`;
  } else if (selectedLocation?.name) {
    displayName = selectedLocation.name;
  } else if (siteNames.length > 1) {
    displayName = `${siteNames.length} workbook sites · ${directionCount} directions`;
  }

  const lat =
    activePoints.reduce((s, p) => s + p.lat, 0) / activePoints.length;
  const lon =
    activePoints.reduce((s, p) => s + p.lon, 0) / activePoints.length;

  const segmentApiId =
    selectionMeta.kind === "site" && selectionMeta.workbookKey
      ? selectionMeta.workbookKey
      : selectionMeta.kind === "location" && selectedLocation?.otcWorkbookKey
        ? selectedLocation.otcWorkbookKey
        : String(activePoints[0]?.properties?.segmentId ?? config.segmentApiId);

  const methodologyRule = resolveMethodologyConstraint({
    selectionId: options?.selectionId,
    siteName: siteNames[0],
    locationId: selectedLocation?.id,
  });

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
    pilot: options?.pilotLabel ?? config.pilot,
    interventionType: pilotRecord?.intervention.summary ?? config.interventionType,
    coordinates: [lat, lon],
    monitoringPeriod:
      infraPoints.length && !hasModeBreakdown
        ? `Parking inventory · ${infraPoints.length} matched record${infraPoints.length === 1 ? "" : "s"}`
        : `OpenTrafficCam · ${directionCount} observed direction${directionCount === 1 ? "" : "s"}`,
    sensors: directionCount,
    approachesCovered: directionCount,
    totalApproaches: directionCount,
    dataConfidence: 0.88,
    baseline: baselinePeriod,
    intervention: interventionPeriod,
    dataSource: "observed",
    dataClass: "observed",
    sourceLabel: methodologyRule
      ? `OpenTrafficCam (methodology filtered) · ${pilotRecord?.code ?? "CPH"}`
      : `OpenTrafficCam directional counts · ${pilotRecord?.code ?? "CPH"}`,
    streetNS: config.streetNS,
    streetEW: config.streetEW,
  };
}
