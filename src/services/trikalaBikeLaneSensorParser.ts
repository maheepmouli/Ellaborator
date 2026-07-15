import type { NormalizedCityRecord } from "@/types/normalized-city-data";
import { getTrikalaPilotAnchor } from "@/lib/trikalaMapConfig";
import {
  loadTrikalaLocationsBundle,
  findTrikalaLocationById,
  type TrikalaBikeLaneSensorJoin,
} from "@/data/trikalaLocationRegistry";

export const TRIKALA_BIKE_LANE_METRICS_BUNDLE = "/data/trikala/bike-lane-sensor-metrics.json";
export const TRIKALA_BIKE_LANE_SENSORS_MIRROR = "/sharepoint-data/Trikala/bike-lane-sensors/";

export interface TrikalaBikeLaneSensorMetric {
  deviceId: string;
  label: string;
  sourceFile: string;
  locationId: string | null;
  joinMethod: string | null;
  observationCount: number;
  busyCount: number;
  freeCount: number;
  unknownStatusCount: number;
  busyPct: number | null;
  availabilityPct: number | null;
  periodStart: string | null;
  periodEnd: string | null;
  avgTempC: number | null;
  avgBattMv: number | null;
  sheetCount: number;
  sheetNames: string[];
}

export interface TrikalaBikeLaneMetricsBundle {
  generatedAt: string;
  sourceDir: string | null;
  sourceZip: string | null;
  sensorCount: number;
  joinedCount: number;
  sensors: TrikalaBikeLaneSensorMetric[];
  fleet: {
    busyPct: number | null;
    availabilityPct: number | null;
    observationCount: number;
    linkedLocationCount?: number;
  };
}

let metricsCache: TrikalaBikeLaneMetricsBundle | null = null;

export async function loadTrikalaBikeLaneMetricsBundle(): Promise<TrikalaBikeLaneMetricsBundle> {
  if (metricsCache) return metricsCache;
  try {
    const res = await fetch(TRIKALA_BIKE_LANE_METRICS_BUNDLE);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    metricsCache = (await res.json()) as TrikalaBikeLaneMetricsBundle;
    return metricsCache;
  } catch {
    metricsCache = {
      generatedAt: "",
      sourceDir: null,
      sourceZip: null,
      sensorCount: 0,
      joinedCount: 0,
      sensors: [],
      fleet: { busyPct: null, availabilityPct: null, observationCount: 0 },
    };
    return metricsCache;
  }
}

function kpiValueForSensor(kpiId: string, sensor: TrikalaBikeLaneSensorMetric): number | null {
  if (kpiId === "kpi2.1") return sensor.busyPct;
  if (kpiId === "kpi4.2") return sensor.availabilityPct;
  return null;
}

function fleetValueForKpi(kpiId: string, fleet: TrikalaBikeLaneMetricsBundle["fleet"]): number | null {
  if (kpiId === "kpi2.1") return fleet.busyPct;
  if (kpiId === "kpi4.2") return fleet.availabilityPct;
  return null;
}

export async function buildTrikalaBikeLaneSensorRecords(
  kpiId: string
): Promise<NormalizedCityRecord[]> {
  if (kpiId !== "kpi2.1" && kpiId !== "kpi4.2") return [];

  const [metrics, registry] = await Promise.all([
    loadTrikalaBikeLaneMetricsBundle(),
    loadTrikalaLocationsBundle(),
  ]);
  if (!metrics.sensors.length) return [];

  const anchor = getTrikalaPilotAnchor("tri-p3");
  const records: NormalizedCityRecord[] = [];
  const fleetValue = fleetValueForKpi(kpiId, metrics.fleet);

  if (fleetValue != null) {
    const metricLabel =
      kpiId === "kpi2.1" ? "Fleet lane occupancy stress" : "Fleet lane availability index";
    records.push({
      id: `trikala-${kpiId}-bike-lane-fleet`,
      city: "Trikala",
      cityId: "trikala",
      interventionId: "tri-p3",
      kpiId,
      sourceFile: TRIKALA_BIKE_LANE_METRICS_BUNDLE,
      geometryType: "point",
      lat: anchor.lat,
      lng: anchor.lng,
      geometry: [[anchor.lat, anchor.lng]],
      value: fleetValue,
      baselineValue: fleetValue,
      interventionValue: fleetValue,
      source: "Bike-lane LoRa sensor fleet",
      method: `${metricLabel}: ${fleetValue}% across ${metrics.sensorCount} sensors (${metrics.fleet.observationCount.toLocaleString()} observations).`,
      type: "observed",
      spatialQuality: "matched",
      geometryLinkage: "matched",
      temporalCoverage: "multi-period",
      locationMethod: "pilot_area_inference",
      segmentId: "tri-p3-bike-lane",
      streetName: "Redesigned bike lanes — fleet summary",
      spatialNote: "Fleet aggregate at Pilot 3 anchor; per-sensor values at registry coordinates.",
      parserStatus: metrics.joinedCount < metrics.sensorCount ? "partial" : "ready",
      datasetKind: "bike-lane-sensor-fleet",
    });
  }

  metrics.sensors.forEach((sensor) => {
    const value = kpiValueForSensor(kpiId, sensor);
    if (value == null) return;

    const location =
      (sensor.locationId && findTrikalaLocationById(registry.locations, sensor.locationId)) ??
      null;
    const lat = location?.lat ?? anchor.lat;
    const lng = location?.lng ?? anchor.lng;
    const segmentId = sensor.locationId ?? "tri-p3-bike-lane";
    const recordId = sensor.locationId
      ? `trikala-${kpiId}-${sensor.locationId}`
      : `trikala-${kpiId}-device-${sensor.deviceId}`;

    const stressOrAvail =
      kpiId === "kpi2.1"
        ? `Occupancy stress ${sensor.busyPct}% (${sensor.busyCount} busy / ${sensor.freeCount} free)`
        : `Lane availability ${sensor.availabilityPct}%`;

    records.push({
      id: recordId,
      city: "Trikala",
      cityId: "trikala",
      interventionId: "tri-p3",
      kpiId,
      sourceFile: `${TRIKALA_BIKE_LANE_SENSORS_MIRROR}${sensor.label}.xlsx`,
      geometryType: "point",
      lat,
      lng,
      geometry: [[lat, lng]],
      value,
      baselineValue: value,
      interventionValue: value,
      source: "Bike-lane LoRa sensor time-series",
      method: `${sensor.label} (${sensor.deviceId}) — ${stressOrAvail} from ${sensor.observationCount.toLocaleString()} readings${sensor.periodStart ? ` (${sensor.periodStart.slice(0, 10)} → ${sensor.periodEnd?.slice(0, 10) ?? "?"})` : ""}.`,
      type: "observed",
      spatialQuality: location ? "matched" : "inferred",
      geometryLinkage: location ? "matched" : "inferred",
      temporalCoverage: "multi-period",
      locationMethod: location ? "segment_id_join" : "pilot_area_inference",
      segmentId,
      streetName: sensor.label,
      spatialNote: location
        ? `Position from partner My Maps registry (${sensor.joinMethod ?? "join"}).`
        : "Device label could not be joined to registry — value shown at pilot anchor.",
      parserStatus: location ? "ready" : "partial",
      datasetKind: "bike-lane-sensor",
      deviceId: sensor.deviceId,
      busyPct: sensor.busyPct ?? undefined,
      availabilityPct: sensor.availabilityPct ?? undefined,
      observationCount: sensor.observationCount,
    });
  });

  return records;
}

export function bikeLaneJoinsFromMetrics(
  metrics: TrikalaBikeLaneMetricsBundle
): TrikalaBikeLaneSensorJoin[] {
  return metrics.sensors.map((sensor) => ({
    deviceId: sensor.deviceId,
    locationId: sensor.locationId,
    label: sensor.label,
    joinMethod: sensor.joinMethod,
    busyPct: sensor.busyPct,
    availabilityPct: sensor.availabilityPct,
    observationCount: sensor.observationCount,
    periodStart: sensor.periodStart,
    periodEnd: sensor.periodEnd,
  }));
}
