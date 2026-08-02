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
        pointRecordId(p) === selectionId ||
        pointRecordId(p) === `trikala-kpi3.2-${selectionId}` ||
        pointRecordId(p) === `trikala-kpi2.1-${selectionId}` ||
        pointRecordId(p) === `trikala-kpi4.2-${selectionId}`
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

  if (selectionId.startsWith("trikala-kpi2.1-") || selectionId.startsWith("trikala-kpi4.2-")) {
    const suffix = selectionId.replace(/^trikala-kpi[\d.]+-/, "");
    const bySuffix = points.filter(
      (p) => pointRecordId(p) === selectionId || String(p.properties?.segmentId ?? "") === suffix
    );
    if (bySuffix.length) return bySuffix;
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
    if (byGroup.length) return byGroup;
  }

  // Smart-crossing site hover should keep all paired Likert survey metrics.
  if (
    location?.kind === "smart_crossing_site" ||
    /smart-crossing|military school/i.test(selectionId)
  ) {
    const surveyPts = points.filter((p) =>
      String(p.properties?.segmentId ?? "").includes("smart-crossing")
    );
    if (surveyPts.length) return surveyPts;
  }

  return [];
}

function enrichBikeLaneSensorHoverView(
  view: JunctionStudyView,
  location: TrikalaLocation,
  scoped: LocalCityPoint[],
  selectedKpi: string,
  scenario: MapScenario = "intervention"
): JunctionStudyView {
  const pt = scoped[0];
  const scenarioBusy =
    scenario === "baseline" && typeof pt?.properties?.baselineValue === "number"
      ? Number(pt.properties.baselineValue)
      : typeof pt?.value === "number"
        ? Number(pt.value)
        : null;
  const busyPct =
    selectedKpi === "kpi2.1" && scenarioBusy != null
      ? Math.round(scenarioBusy)
      : typeof pt?.properties?.busyPct === "number"
        ? Math.round(Number(pt.properties.busyPct))
        : null;
  const availabilityPct =
    selectedKpi === "kpi4.2" && scenarioBusy != null
      ? Math.round(scenarioBusy)
      : typeof pt?.properties?.availabilityPct === "number"
        ? Math.round(Number(pt.properties.availabilityPct))
        : null;
  const mockSpeed =
    scenario === "baseline" && typeof pt?.properties?.mockSpeedBaselineKmh === "number"
      ? Number(pt.properties.mockSpeedBaselineKmh)
      : typeof pt?.properties?.mockSpeedKmh === "number"
        ? Number(pt.properties.mockSpeedKmh)
        : busyPct != null
          ? Math.round(18 * (1 - busyPct / 100) * 10) / 10
          : null;
  const obsCount = pt?.properties?.observationCount;
  const deviceId = pt?.properties?.deviceId;
  const metricLine =
    selectedKpi === "kpi4.2" && availabilityPct != null
      ? `Lane availability ${availabilityPct}%`
      : selectedKpi === "kpi2.1" && mockSpeed != null
        ? `Mock speed ${mockSpeed} km/h · occupancy ${busyPct ?? "—"}%`
        : busyPct != null
          ? `Occupancy stress ${busyPct}%`
          : view.interventionType;

  const congestion = busyPct != null ? busyPct / 100 : view.intervention.peakCongestion;
  const postMock =
    selectedKpi === "kpi2.1" && (scenario === "intervention" || scenario === "comparison");

  return {
    ...view,
    name: location.name,
    shortName: location.name,
    coordinates: [location.lat, location.lng],
    kpiValue:
      selectedKpi === "kpi2.1" && mockSpeed != null
        ? mockSpeed
        : pt?.value ?? view.kpiValue,
    dataClass: selectedKpi === "kpi2.1" ? (postMock ? "mock" : "observed") : "observed",
    dataSource: selectedKpi === "kpi2.1" ? (postMock ? "mock" : "observed") : "observed",
    interventionType: `${metricLine}${deviceId ? ` · device ${deviceId}` : ""}`,
    monitoringPeriod: obsCount
      ? postMock
        ? `${Number(obsCount).toLocaleString()} LoRa readings · baseline observed · post MOCK`
        : `${Number(obsCount).toLocaleString()} LoRa FREE/BUSY readings · speed from occupancy`
      : "Bike-lane LoRa sensor time-series",
    segmentApiId: location.id,
    sourceLabel:
      selectedKpi === "kpi2.1"
        ? postMock
          ? "MOCK post/comparison — LoRa occupancy baseline only"
          : "Bike-lane LoRa occupancy (FREE/BUSY) · baseline observed"
        : "Bike-lane sensor workbook (SharePoint)",
    intervention: {
      ...view.intervention,
      avgSpeedKmh: mockSpeed ?? view.intervention.avgSpeedKmh,
      peakCongestion: congestion,
    },
    baseline: {
      ...view.baseline,
      avgSpeedKmh:
        typeof pt?.properties?.mockSpeedBaselineKmh === "number"
          ? Number(pt.properties.mockSpeedBaselineKmh)
          : view.baseline.avgSpeedKmh,
      peakCongestion:
        typeof pt?.properties?.baselineValue === "number" && selectedKpi === "kpi2.1"
          ? Number(pt.properties.baselineValue) / 100
          : view.baseline.peakCongestion,
    },
  };
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
    interventionType: `${statusLabel} · MOCK Smart Citizen monitoring index ${monitoringIndex}%`,
    monitoringPeriod: capabilityPct
      ? `MOCK · Capability breadth ${capabilityPct}% · Pilot 4 illustrative climate proxy`
      : "MOCK · Pilot 4 Smart Citizen Kit geography",
    segmentApiId: location.id,
    sourceLabel: "MOCK climate — Pilot 4 Smart Citizen Kit fleet proxy",
    dataClass: "mock",
    dataSource: "mock",
    dataConfidence: 0.35,
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
      ? " · MOCK bike uptake % change scoped to this P+R hub"
      : "";
  return {
    ...view,
    name: location.name,
    shortName: location.name,
    coordinates: [location.lat, location.lng],
    interventionType:
      location.kind === "park_and_ride"
        ? "Park & Ride · bike / micromobility uptake hub"
        : location.kind === "bike_station"
          ? "Bike docking · shared fleet access"
          : `${kindLabel} · intermodal access point`,
    monitoringPeriod: `Linked KPIs: ${linked}${modeShareNote} · partner occupancy survey pending`,
    segmentApiId: location.id,
    sourceLabel:
      selectedKpi === "kpi1.2"
        ? "MOCK mode share — P+R bike uptake (partner occupancy survey pending)"
        : selectedKpi === "kpi3.1"
          ? "Installed P+R hubs · Partner My Maps"
          : selectedKpi === "kpi4.1"
            ? "MOCK satisfaction — no P+R user survey linked"
            : location.folderPath.join(" › ") || "Partner My Maps registry",
    ...(selectedKpi === "kpi3.1"
      ? {
          kpiValue: location.kind === "park_and_ride" ? 1 : view.kpiValue,
          dataClass: "observed" as const,
          dataSource: "observed" as const,
        }
      : selectedKpi === "kpi1.2" || selectedKpi === "kpi4.1"
        ? {
            dataClass: "mock" as const,
            dataSource: "mock" as const,
            dataConfidence: 0.35,
          }
        : {}),
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

  const surveyScoped = (scoped.length ? scoped : points).filter(
    (p) =>
      p.properties?.datasetKind === "survey" ||
      Boolean(p.properties?.likertLabel) ||
      String(p.properties?.segmentId ?? "").includes("smart-crossing") ||
      String(p.properties?.segmentId ?? "").includes("tri-p3-bike-lane")
  );
  if (
    surveyScoped.length &&
    (selectedKpi === "kpi2.1" || selectedKpi === "kpi4.1" || selectedKpi === "kpi4.2") &&
    (pilotId === "tri-p1" ||
      location?.kind === "smart_crossing_site" ||
      String(selectionId).includes("smart-crossing") ||
      (pilotId === "tri-p3" &&
        selectedKpi === "kpi4.2" &&
        (location?.kind === "bike_lane_sensor" ||
          String(selectionId).includes("tri-p3-bike-lane") ||
          String(selectionId).startsWith("tri-loc-"))))
  ) {
    const avgSurvey =
      surveyScoped.reduce((s, p) => s + Number(p.value ?? 0), 0) / surveyScoped.length;
    const a11yPt = surveyScoped.find((p) =>
      /accessibility/i.test(String(p.properties?.likertLabel ?? ""))
    );
    return {
      ...view,
      name: location?.name ?? String(segmentName),
      shortName: (location?.name ?? String(segmentName)).slice(0, 28),
      kpiValue: Math.round(Number(a11yPt?.value ?? avgSurvey) * 10) / 10,
      dataClass: "observed",
      dataSource: "observed",
      dataConfidence: Math.max(view.dataConfidence, 0.82),
      sourceLabel: String(
        surveyScoped[0]?.properties?.source ??
          (pilotId === "tri-p3"
            ? "Bike lane safety survey · SharePoint"
            : "Smart crossing on-line survey · SharePoint")
      ),
      monitoringPeriod: `Survey baseline + post · ${surveyScoped.length} Likert dimension${
        surveyScoped.length === 1 ? "" : "s"
      }`,
      interventionType:
        pilotId === "tri-p3" && selectedKpi === "kpi4.2"
          ? "Bike-lane corridor · online accessibility & condition survey"
          : selectedKpi === "kpi2.1"
            ? "Smart crossing · perceived safety survey"
            : selectedKpi === "kpi4.1"
              ? "Smart crossing · accessibility impression survey"
              : "Smart crossing · condition & connectivity survey",
      coordinates: location ? [location.lat, location.lng] : view.coordinates,
      segmentApiId: location?.id ?? view.segmentApiId,
    };
  }

  if (location?.kind === "air_quality_sensor" && scoped.length) {
    return enrichAirQualityHoverView(view, location, scoped, sensorJoin);
  }

  if (location?.kind === "bike_lane_sensor" && scoped.length && selectedKpi !== "kpi4.2") {
    return enrichBikeLaneSensorHoverView(view, location, scoped, selectedKpi, scenario);
  }

  if (pilotId === "tri-p2" && location && !scoped.length) {
    return enrichPilot2InfraView(view, location, selectedKpi);
  }

  if (pilotId === "tri-p2" && selectedKpi === "kpi3.1") {
    const hubs = (options?.locations ?? []).filter((l) => l.kind === "park_and_ride");
    const hubCount = hubs.length || 3;
    const installed = scenario === "baseline" ? 0 : hubCount;
    return {
      ...view,
      name: hubs.length ? hubs.map((h) => h.name).join(" · ") : "SMY · DEH · GiSeMi",
      shortName: "Park & Ride hubs",
      kpiValue: installed,
      dataClass: "observed",
      dataSource: "observed",
      dataConfidence: Math.max(view.dataConfidence, 0.7),
      sourceLabel: "Installed P+R hubs · Partner My Maps",
      monitoringPeriod: `Baseline 0 → intervention ${hubCount} hubs`,
      interventionType: "Park & Ride · zero-emission facility inventory",
    };
  }

  if (pilotId === "tri-p2" && selectedKpi === "kpi1.2") {
    return {
      ...view,
      name: "Park & Ride stations",
      shortName: "P+R hubs",
      dataClass: "mock",
      dataSource: "mock",
      dataConfidence: 0.35,
      sourceLabel: "MOCK mode share — P+R bike uptake (partner occupancy survey pending)",
      monitoringPeriod: "MOCK placeholder · partner occupancy survey pending",
      interventionType: "Park & Ride · MOCK bike uptake / mode share",
    };
  }

  if (pilotId === "tri-p2" && selectedKpi === "kpi4.1") {
    return {
      ...view,
      name: "Park & Ride stations",
      shortName: "P+R hubs",
      kpiValue: scenario === "baseline" ? 60 : 74,
      dataClass: "mock",
      dataSource: "mock",
      dataConfidence: 0.35,
      sourceLabel: "MOCK satisfaction — no P+R user survey linked",
      monitoringPeriod: "MOCK placeholder · partner survey not delivered",
      interventionType: "Park & Ride · MOCK satisfaction only",
    };
  }

  if (location && !scoped.length) {
    const kindLabel = INFRA_KIND_LABEL[location.kind] ?? location.kind;
    const registryOnlyNote =
      location.kind === "bike_lane_sensor"
        ? selectedKpi === "kpi2.1"
          ? "Registry position only — no linked LoRa time-series for this node. Fleet mock speed is shown when a joined sensor is selected."
          : "Registry position only — run build-trikala-bike-lane-sensors to link observed time-series."
        : undefined;
    return {
      ...view,
      name: location.name,
      shortName: location.name,
      coordinates: [location.lat, location.lng],
      interventionType: `${kindLabel} · partner My Maps geodata`,
      monitoringPeriod:
        registryOnlyNote ??
        (location.linkedKpis.length
          ? `Linked KPIs: ${location.linkedKpis.join(", ")}`
          : view.monitoringPeriod),
      segmentApiId: location.id,
      sourceLabel: location.folderPath.join(" › ") || "Partner My Maps registry",
      dataClass:
        location.kind === "bike_lane_sensor" &&
        selectedKpi === "kpi2.1" &&
        (scenario === "intervention" || scenario === "comparison")
          ? "mock"
          : location.kind === "bike_lane_sensor" && selectedKpi === "kpi2.1"
            ? "observed"
            : view.dataClass,
    };
  }

  return view;
}
