import type { JunctionConfig } from "@/data/junctionConfigs";
import type { JunctionStudyView } from "@/lib/issyJunctionAnalytics";
import { buildMockJunctionStudyView } from "@/lib/junctionMockAnalytics";
import { getCityPilotProfile } from "@/data/cityPilotProfiles";
import { getPilotById } from "@/data/pilotDefinitions";
import { getKpiDefinition } from "@/config/kpiDefinitions";
import { getSegmentHighlight, segmentMetricKindForKpi } from "@/lib/segmentHighlight";
import type { MapScenario } from "@/context/MapIntelligenceContext";
import type { LocalCityPoint } from "@/services/localCityData";
import { getCityKpiMethodology } from "@/data/cityKpiMethodology";
import {
  buildCopenhagenObservatoryView,
  filterCopenhagenObservatoryPoints,
} from "@/lib/copenhagenObservatoryView";
import { isCopenhagenObservatoryContext } from "@/lib/copenhagenMapSelection";

export type ObservatoryDataClass = "observed" | "derived" | "modelled" | "mock";

export function observatoryShellTitle(city: string, pilotId?: string | null): string {
  const profile = getCityPilotProfile(pilotId);
  switch (profile?.observatoryType) {
    case "camera":
      return "Camera Observatory";
    case "street-segment":
      return "Street Segment Observatory";
    case "area":
      return "Area Observatory";
    case "corridor":
      return "Corridor Observatory";
    default:
      if (city === "Issy-les-Moulineaux") return "Corridor Observatory";
      return "Intervention Observatory";
  }
}

export function observatoryCorridorLabel(city: string, pilotId?: string | null): string {
  const profile = getCityPilotProfile(pilotId);
  if (profile?.observatoryType === "camera") return "Monitored camera corridor";
  if (profile?.observatoryType === "street-segment") return "Monitored street segment";
  if (profile?.observatoryType === "area") return "Monitored intervention area";
  if (city === "Issy-les-Moulineaux") return "Monitored intervention corridor";
  return "Monitored intervention zone";
}

export function classifyDataOrigin(
  points: LocalCityPoint[],
  registrySource: "mock" | "observed" = "mock"
): ObservatoryDataClass {
  if (points.length === 0) return registrySource === "observed" ? "derived" : "mock";
  const origins = points.map((p) => String(p.properties?.type || p.properties?.dataOrigin || ""));
  if (origins.some((o) => o === "observed" || o.includes("local-city-dataset"))) return "observed";
  if (origins.some((o) => o === "derived")) return "derived";
  if (origins.some((o) => o === "modelled" || o.includes("fallback"))) return "modelled";
  if (origins.some((o) => o === "mock")) return "mock";
  return registrySource;
}

export function dataClassLabel(dataClass: ObservatoryDataClass): string {
  switch (dataClass) {
    case "observed":
      return "Observed";
    case "derived":
      return "Derived";
    case "modelled":
      return "Modelled";
    default:
      return "Mock";
  }
}

export function confidenceFromDataClass(
  dataClass: ObservatoryDataClass,
  configConfidence: number
): { label: string; pct: number } {
  if (dataClass === "observed") {
    return { label: "High", pct: Math.max(72, Math.round(configConfidence * 100)) };
  }
  if (dataClass === "derived") {
    return { label: "Medium", pct: Math.max(48, Math.round(configConfidence * 85)) };
  }
  if (dataClass === "modelled") {
    return { label: "Low", pct: 38 };
  }
  return { label: "Registry mock", pct: Math.round(configConfidence * 70) };
}

function avgPointValue(points: LocalCityPoint[]): number {
  if (!points.length) return 0;
  return points.reduce((sum, p) => sum + p.value, 0) / points.length;
}

function centroidFromPoints(points: LocalCityPoint[]): [number, number] | null {
  if (!points.length) return null;
  const lat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const lon = points.reduce((s, p) => s + p.lon, 0) / points.length;
  return [lat, lon];
}

function normalizeCityKey(city: string): string {
  return city.toLowerCase().trim();
}

function isCopenhagenCityName(city: string): boolean {
  return normalizeCityKey(city).includes("copenhagen");
}

export function buildCityObservatoryView(
  config: JunctionConfig,
  city: string,
  pilotId: string | null | undefined,
  selectedKpi: string,
  scenario: MapScenario,
  points: LocalCityPoint[] = [],
  kpi32IntensityScale = 1
): JunctionStudyView {
  const base = buildMockJunctionStudyView(config, selectedKpi, scenario, kpi32IntensityScale);
  const pilot = getPilotById(city, pilotId);
  const profile = getCityPilotProfile(pilotId);
  const dataClass = classifyDataOrigin(points, base.dataSource === "observed" ? "observed" : "mock");
  const observedValue = avgPointValue(points);
  const hasObserved = points.length > 0 && dataClass !== "mock";
  const metric = segmentMetricKindForKpi(selectedKpi);
  const kpiValue = hasObserved ? observedValue : base.kpiValue;
  const highlight = getSegmentHighlight(kpiValue, kpiValue * 0.9, kpiValue * 1.1, metric);
  const centroid = centroidFromPoints(points);
  const coords: [number, number] =
    centroid ??
    (pilot?.lat != null && pilot?.lng != null
      ? [pilot.lat, pilot.lng]
      : base.coordinates);
  const kpiDef = getKpiDefinition(selectedKpi);
  const sourceLabel =
    points[0]?.properties?.source ||
    profile?.dataAvailability ||
    "Pilot registry with linked dataset readiness";

  const isCopenhagen = isCopenhagenObservatoryContext(city, pilotId);
  if (isCopenhagen) {
    return buildCopenhagenObservatoryView(
      config,
      pilotId ?? "cph-p1",
      selectedKpi,
      scenario,
      points,
      {
        pilotLabel: pilot ? `${city} — ${pilot.name}` : undefined,
        selectedModeTypes: [],
      }
    );
  }

  return {
    ...base,
    name: profile?.title || config.name,
    shortName: config.shortName,
    kpiValue: Math.round(kpiValue * 10) / 10,
    kpiBand: highlight.band,
    armColor: highlight.color,
    bandColor: highlight.color,
    kpiLabel: kpiDef?.name ?? selectedKpi,
    coordinates: coords,
    dataSource: dataClass === "observed" ? "observed" : dataClass === "mock" ? "mock" : "observed",
    dataConfidence:
      dataClass === "observed"
        ? Math.max(base.dataConfidence, 0.82)
        : dataClass === "derived"
          ? Math.max(base.dataConfidence, 0.62)
          : base.dataConfidence,
    interventionType: profile?.interventionSummary || base.interventionType,
    monitoringPeriod: hasObserved
      ? `Linked datasets · ${points.length} monitoring point${points.length === 1 ? "" : "s"}`
      : base.monitoringPeriod,
    segmentApiId: hasObserved
      ? String(points[0]?.properties?.segmentId || config.segmentApiId)
      : config.segmentApiId,
    pilot: pilot ? `${city} — ${pilot.name}` : base.pilot,
    streetNS: config.streetNS,
    streetEW: config.streetEW,
    sourceLabel,
    dataClass,
  };
}

export function getObservatoryMethodology(city: string, kpiId: string) {
  return getCityKpiMethodology(city).find((entry) => entry.kpiId === kpiId);
}

export function performanceDeltaFromPoints(points: LocalCityPoint[]): number | null {
  const deltas = points
    .map((p) => Number(p.properties?.comparisonValue ?? p.properties?.comparisonDelta))
    .filter((v) => Number.isFinite(v));
  if (!deltas.length) return null;
  return deltas.reduce((s, v) => s + v, 0) / deltas.length;
}

export type SegmentSelectionMeta = {
  segmentId: string;
  segmentName: string;
  speed?: number | null;
  congestion?: number | null;
  properties?: Record<string, unknown>;
};

function pointsForSegment(
  points: LocalCityPoint[],
  segmentId: string
): LocalCityPoint[] {
  const direct = points.filter((p) => {
    const sid = String(p.properties?.segmentId ?? p.properties?.siteId ?? p.id ?? "");
    return sid === segmentId || sid.includes(segmentId) || segmentId.includes(sid);
  });
  if (direct.length) return direct;
  return points;
}

export function buildSegmentScopedObservatoryView(
  config: JunctionConfig,
  city: string,
  pilotId: string | null | undefined,
  selectedKpi: string,
  scenario: MapScenario,
  points: LocalCityPoint[],
  segment: SegmentSelectionMeta,
  kpi32IntensityScale = 1,
  selectedModeTypes: string[] = []
): JunctionStudyView {
  const isCopenhagen = isCopenhagenObservatoryContext(city, pilotId);
  const scopedPoints = isCopenhagen
    ? filterCopenhagenObservatoryPoints(points, segment.segmentId)
    : pointsForSegment(points, segment.segmentId);

  if (isCopenhagen) {
    return buildCopenhagenObservatoryView(
      config,
      pilotId ?? "cph-p1",
      selectedKpi,
      scenario,
      scopedPoints.length ? scopedPoints : points,
      {
        selectionId: segment.segmentId,
        segmentName: segment.segmentName,
        selectedModeTypes,
      }
    );
  }

  const base = buildCityObservatoryView(
    config,
    city,
    pilotId,
    selectedKpi,
    scenario,
    scopedPoints.length ? scopedPoints : points,
    kpi32IntensityScale
  );

  const props = segment.properties ?? {};
  const avgSpeed =
    segment.speed ??
    (typeof props.avgSpeed === "number" ? props.avgSpeed : null) ??
    (segment.congestion != null ? null : base.intervention?.avgSpeedKmh);
  const congestion =
    segment.congestion ??
    (typeof props.indice_de_congestion === "number"
      ? props.indice_de_congestion
      : typeof segment.properties?.value === "number"
        ? (segment.properties.value as number) / 100
        : base.intervention?.peakCongestion);

  const metric = segmentMetricKindForKpi(selectedKpi);
  const kpiValue =
    avgSpeed != null && selectedKpi === "kpi2.1"
      ? avgSpeed
      : congestion != null && metric === "congestion"
        ? congestion * 100
        : base.kpiValue;
  const highlight = getSegmentHighlight(kpiValue, kpiValue * 0.9, kpiValue * 1.1, metric);

  const lat =
    typeof props.centroidLat === "number"
      ? props.centroidLat
      : scopedPoints[0]?.lat ?? base.coordinates[0];
  const lon =
    typeof props.centroidLon === "number"
      ? props.centroidLon
      : scopedPoints[0]?.lon ?? base.coordinates[1];

  return {
    ...base,
    name: segment.segmentName,
    shortName: segment.segmentName.slice(0, 24),
    kpiValue: Math.round(kpiValue * 10) / 10,
    kpiBand: highlight.band,
    armColor: highlight.color,
    bandColor: highlight.color,
    coordinates: [lat, lon],
    segmentApiId: segment.segmentId,
    monitoringPeriod: `Segment · ${segment.segmentName}`,
    intervention: {
      ...base.intervention,
      avgSpeedKmh: avgSpeed ?? base.intervention.avgSpeedKmh,
      peakCongestion: congestion ?? base.intervention.peakCongestion,
    },
    baseline: {
      ...base.baseline,
      avgSpeedKmh:
        avgSpeed != null ? Math.max(0, avgSpeed * 1.08) : base.baseline.avgSpeedKmh,
      peakCongestion:
        congestion != null ? Math.min(1, congestion * 1.12) : base.baseline.peakCongestion,
    },
  };
}
