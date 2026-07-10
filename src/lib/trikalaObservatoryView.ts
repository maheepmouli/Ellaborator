import type { JunctionConfig } from "@/data/junctionConfigs";
import type { JunctionStudyView } from "@/lib/issyJunctionAnalytics";
import type { TrikalaLocation, TrikalaSensorJoin } from "@/data/trikalaLocationRegistry";
import type { TrikalaSegmentInsight } from "@/services/trikalaSurveyParser";
import type { MapScenario } from "@/context/MapIntelligenceContext";
import type { LocalCityPoint } from "@/services/localCityData";
import {
  buildCityObservatoryView,
  buildSegmentScopedObservatoryView,
  type SegmentSelectionMeta,
} from "@/lib/observatoryCityContent";

const INFRA_KIND_LABEL: Record<string, string> = {
  park_and_ride: "Park & Ride hub",
  parking_station: "Municipal parking",
  bike_station: "Bike station",
  bike_lane_sensor: "Bike-lane sensor node",
  air_quality_sensor: "Air quality sensor",
  traffic_signal: "Traffic signal",
  smart_crossing_site: "Smart crossing site",
};

function pointRecordId(point: LocalCityPoint): string {
  return String(point.properties?.id ?? point.id ?? "");
}

export function findTrikalaLocationBySelection(
  locations: TrikalaLocation[],
  selectionId: string | null | undefined
): TrikalaLocation | undefined {
  if (!selectionId) return undefined;
  return locations.find(
    (l) => l.id === selectionId || l.segmentId === selectionId
  );
}

/** Map hover/selection ids to women-mobility survey segment keys. */
export function resolveTrikalaInsightSegmentFromSelection(
  selectionId: string | null | undefined
): TrikalaSegmentInsight["segment"] | null {
  if (!selectionId) return null;
  const normalized = selectionId
    .replace(/^tri-flow-/, "")
    .replace(/-(active|car)$/, "");
  const map: Record<string, TrikalaSegmentInsight["segment"]> = {
    "tri-p1-village": "village",
    "tri-p1-caregiver": "caregiver",
    "tri-p1-urban": "urban",
    "tri-p1-suburban": "suburban",
    "tri-p1-women-mobility": "all",
  };
  return map[normalized] ?? null;
}

export function filterTrikalaObservatoryPoints(
  points: LocalCityPoint[],
  selectionId: string,
  location?: TrikalaLocation | null,
  sensorJoins?: TrikalaSensorJoin[]
): LocalCityPoint[] {
  const normalizedSelection = selectionId
    .replace(/^tri-flow-/, "")
    .replace(/-(active|car)$/, "");

  const direct = points.filter((p) => {
    const sid = String(p.properties?.segmentId ?? p.properties?.siteId ?? p.id ?? "");
    const rid = pointRecordId(p);
    return (
      sid === selectionId ||
      sid === normalizedSelection ||
      rid === selectionId ||
      rid === `trikala-kpi3.2-${selectionId}` ||
      rid === `trikala-kpi3.2-${normalizedSelection}` ||
      sid.includes(selectionId) ||
      selectionId.includes(sid) ||
      normalizedSelection.includes(sid) ||
      sid.includes(normalizedSelection)
    );
  });
  if (direct.length) return direct;

  if (selectionId.startsWith("tri-loc-")) {
    const byRegistryId = points.filter(
      (p) =>
        String(p.properties?.segmentId ?? "") === selectionId ||
        pointRecordId(p) === `trikala-kpi3.2-${selectionId}`
    );
    if (byRegistryId.length) return byRegistryId;

    const join = sensorJoins?.find((j) => j.locationId === selectionId);
    if (join) {
      const bySensor = points.filter((p) =>
        pointRecordId(p).includes(`sensor-${join.sensorId}`)
      );
      if (bySensor.length) return bySensor;
    }
  }

  if (selectionId.startsWith("trikala-kpi3.2-")) {
    const suffix = selectionId.replace("trikala-kpi3.2-", "");
    const bySuffix = points.filter(
      (p) => pointRecordId(p) === selectionId || String(p.properties?.segmentId ?? "") === suffix
    );
    if (bySuffix.length) return bySuffix;
  }

  if (location?.segmentId) {
    const byGroup = points.filter(
      (p) => String(p.properties?.segmentId ?? "") === location.segmentId
    );
    if (byGroup.length === 1) return byGroup;
  }
  return [];
}

function enrichAirQualityHoverView(
  view: JunctionStudyView,
  location: TrikalaLocation,
  scoped: LocalCityPoint[],
  sensorJoin?: TrikalaSensorJoin | null
): JunctionStudyView {
  const pt = scoped[0];
  const monitoringIndex =
    typeof pt?.value === "number" ? Math.round(pt.value) : view.kpiValue;
  const method = String(pt?.properties?.method ?? "");
  const statusMatch = method.match(/\b(online|offline)\b/i);
  const statusLabel = statusMatch ? statusMatch[1] : "registered";
  const capabilityMatch = method.match(/capability breadth (\d+)%/i);
  const capabilityPct = capabilityMatch ? capabilityMatch[1] : null;
  const sensorLabel = sensorJoin?.label ?? location.name;

  return {
    ...view,
    name: sensorLabel,
    shortName: sensorLabel,
    coordinates: [location.lat, location.lng],
    kpiValue: monitoringIndex,
    interventionType: `${statusLabel} · Smart Citizen monitoring index ${monitoringIndex}%`,
    monitoringPeriod: capabilityPct
      ? `Capability breadth ${capabilityPct}% · PM2.5 / noise / gas sensors per workbook registry`
      : view.monitoringPeriod,
    segmentApiId: location.id,
    sourceLabel: "Smart Citizen Kit registry",
  };
}

function enrichPilot2InfraView(
  view: JunctionStudyView,
  location: TrikalaLocation,
  selectedKpi: string
): JunctionStudyView {
  const kindLabel = INFRA_KIND_LABEL[location.kind] ?? location.kind;
  const linked = location.linkedKpis.length
    ? location.linkedKpis.join(", ")
    : "kpi3.1";
  const modeShareNote =
    selectedKpi === "kpi1.2"
      ? " · hover mode-share bars scoped to this site"
      : "";
  return {
    ...view,
    name: location.name,
    shortName: location.name,
    coordinates: [location.lat, location.lng],
    interventionType: `${kindLabel} · intermodal access point`,
    monitoringPeriod: `Linked KPIs: ${linked}${modeShareNote} · post-intervention occupancy counts pending`,
    segmentApiId: location.id,
    sourceLabel: location.folderPath.join(" › ") || "Partner My Maps registry",
  };
}

export function buildTrikalaObservatoryView(
  config: JunctionConfig,
  city: string,
  pilotId: string | null | undefined,
  selectedKpi: string,
  scenario: MapScenario,
  points: LocalCityPoint[],
  options?: {
    hoverSelectionId?: string | null;
    segmentName?: string | null;
    speed?: number | null;
    congestion?: number | null;
    locations?: TrikalaLocation[];
    sensorJoins?: TrikalaSensorJoin[];
  }
): JunctionStudyView {
  const selectionId = options?.hoverSelectionId ?? null;
  if (!selectionId) {
    return buildCityObservatoryView(config, city, pilotId, selectedKpi, scenario, points);
  }

  const location = findTrikalaLocationBySelection(options?.locations ?? [], selectionId);
  const sensorJoin =
    options?.sensorJoins?.find((j) => j.locationId === selectionId) ??
    options?.sensorJoins?.find((j) => selectionId.includes(String(j.sensorId)));
  const scoped = filterTrikalaObservatoryPoints(
    points,
    selectionId,
    location,
    options?.sensorJoins
  );
  const segmentName =
    options?.segmentName ??
    location?.name ??
    sensorJoin?.label ??
    scoped[0]?.properties?.streetName?.toString() ??
    scoped[0]?.properties?.likertLabel?.toString() ??
    "Map feature";

  const segment: SegmentSelectionMeta = {
    segmentId: selectionId,
    segmentName: String(segmentName),
    speed: options?.speed ?? null,
    congestion: options?.congestion ?? null,
    properties: {
      ...(scoped[0]?.properties ?? {}),
      infraKind: location?.kind,
      folderPath: location?.folderPath?.join(" › "),
      linkedKpis: location?.linkedKpis,
      sensorId: sensorJoin?.sensorId,
      locationId: location?.id ?? sensorJoin?.locationId,
    },
  };

  const view = buildSegmentScopedObservatoryView(
    config,
    city,
    pilotId,
    selectedKpi,
    scenario,
    scoped.length ? scoped : points,
    segment
  );

  if (location?.kind === "air_quality_sensor" && scoped.length) {
    return enrichAirQualityHoverView(view, location, scoped, sensorJoin);
  }

  if (pilotId === "tri-p2" && location && !scoped.length) {
    return enrichPilot2InfraView(view, location, selectedKpi);
  }

  if (location && !scoped.length) {
    const kindLabel = INFRA_KIND_LABEL[location.kind] ?? location.kind;
    return {
      ...view,
      name: location.name,
      shortName: location.name,
      coordinates: [location.lat, location.lng],
      interventionType: `${kindLabel} · partner My Maps geodata`,
      monitoringPeriod: location.linkedKpis.length
        ? `Linked KPIs: ${location.linkedKpis.join(", ")}`
        : view.monitoringPeriod,
      segmentApiId: location.id,
      sourceLabel: location.folderPath.join(" › ") || "Partner My Maps registry",
    };
  }

  return view;
}
