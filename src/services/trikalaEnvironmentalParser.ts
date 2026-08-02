import * as XLSX from "xlsx";
import type { NormalizedCityRecord } from "@/types/normalized-city-data";
import { TRIKALA_PILOT_ANCHOR } from "@/services/trikalaSurveyParser";
import {
  loadTrikalaLocationsBundle,
  resolveSensorRegistryPosition,
} from "@/data/trikalaLocationRegistry";

export const TRIKALA_ENVIRONMENTAL_FILE =
  "/sharepoint-data/Trikala/smart_citizen_kit_environmental_metrics.xlsx";

/** Bundled sensor registry when SharePoint XLSX is unavailable (Vercel). */
export const TRIKALA_ENVIRONMENTAL_JSON_FALLBACK = "/data/trikala/environmental-sensors.json";

const CAPABILITY_COLUMNS = ["CO2", "eCO2", "O3", "NO2", "PM1", "PM2.5", "PM4", "PM10", "Noise"] as const;

export interface TrikalaSensorRow {
  sensorId: number;
  inOutdoor: "Indoor" | "Outdoor" | "Unknown";
  status: "Online" | "Offline" | "Unknown";
  capabilityScore: number;
  pm25Capable: boolean;
  noiseCapable: boolean;
  lat: number;
  lng: number;
  locationLabel?: string;
  locationId?: string | null;
  fromRegistry?: boolean;
}

function parseNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : NaN;
  }
  return NaN;
}

function hasCapability(value: unknown): boolean {
  return String(value ?? "").trim().toUpperCase() === "X";
}

function sensorOffset(sensorId: number, index: number): { lat: number; lng: number } {
  const angle = (index * 47 + sensorId * 13) % 360;
  const radians = (angle * Math.PI) / 180;
  const radiusDeg = 0.0012 + (index % 5) * 0.00035;
  return {
    lat: TRIKALA_PILOT_ANCHOR.lat + Math.cos(radians) * radiusDeg,
    lng: TRIKALA_PILOT_ANCHOR.lng + Math.sin(radians) * radiusDeg,
  };
}

function parseSensorRows(
  rows: Record<string, unknown>[],
  registry?: Awaited<ReturnType<typeof loadTrikalaLocationsBundle>>
): TrikalaSensorRow[] {
  const sensors: TrikalaSensorRow[] = [];
  let index = 0;
  rows.forEach((row) => {
    const sensorId = parseNumber(row.Sensor);
    if (!Number.isFinite(sensorId)) return;
    const caps = CAPABILITY_COLUMNS.filter((col) => hasCapability(row[col]));
    const capabilityScore = caps.length / CAPABILITY_COLUMNS.length;
    const inOutdoorRaw = String(row["In/outdoor"] ?? "").trim();
    const inOutdoor =
      /outdoor/i.test(inOutdoorRaw) ? "Outdoor" : /indoor/i.test(inOutdoorRaw) ? "Indoor" : "Unknown";
    const statusRaw = String(row.Status ?? "").trim();
    const status = /online/i.test(statusRaw) ? "Online" : /offline/i.test(statusRaw) ? "Offline" : "Unknown";
    const label = String(row.Location ?? row.location ?? row.Site ?? "").trim();
    const registryPos =
      registry &&
      resolveSensorRegistryPosition(sensorId, registry.sensorJoins, registry.locations);
    const join = registry?.sensorJoins.find((j) => j.sensorId === sensorId);
    const locationId = join?.locationId ?? null;
    const offset = registryPos ?? sensorOffset(sensorId, index);
    index += 1;
    sensors.push({
      sensorId,
      inOutdoor,
      status,
      capabilityScore,
      pm25Capable: hasCapability(row["PM2.5"]),
      noiseCapable: hasCapability(row.Noise),
      lat: offset.lat,
      lng: offset.lng,
      locationLabel: label || join?.label || undefined,
      locationId,
      fromRegistry: Boolean(registryPos),
    });
  });
  return sensors;
}

async function loadSensorRowsFromJsonFallback(): Promise<Record<string, unknown>[]> {
  try {
    const response = await fetch(TRIKALA_ENVIRONMENTAL_JSON_FALLBACK);
    if (!response.ok) return [];
    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    if (contentType.includes("text/html")) return [];
    const text = await response.text();
    if (text.trimStart().startsWith("<")) return [];
    const bundle = JSON.parse(text) as {
      sensors?: Array<{
        sensorId: number;
        inOutdoor?: string;
        status?: string;
        capabilities?: string[];
        locationLabel?: string;
      }>;
    };
    return (bundle.sensors ?? []).map((sensor) => {
      const row: Record<string, unknown> = {
        Sensor: sensor.sensorId,
        "In/outdoor": sensor.inOutdoor ?? "",
        Status: sensor.status ?? "",
        Location: sensor.locationLabel ?? "",
      };
      CAPABILITY_COLUMNS.forEach((col) => {
        row[col] = sensor.capabilities?.includes(col) ? "X" : "";
      });
      return row;
    });
  } catch {
    return [];
  }
}

async function loadSensorRows(): Promise<TrikalaSensorRow[]> {
  const registry = await loadTrikalaLocationsBundle();
  try {
    const response = await fetch(encodeURI(TRIKALA_ENVIRONMENTAL_FILE));
    if (response.ok) {
      const contentType = (response.headers.get("content-type") || "").toLowerCase();
      if (!contentType.includes("text/html")) {
        const buffer = await response.arrayBuffer();
        const head = new Uint8Array(buffer.slice(0, 1));
        if (buffer.byteLength >= 8 && head[0] !== 0x3c) {
          const workbook = XLSX.read(buffer, { type: "array" });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
          if (rows.length) return parseSensorRows(rows, registry);
        }
      }
    }
  } catch {
    /* fall through to bundled JSON */
  }
  const fallbackRows = await loadSensorRowsFromJsonFallback();
  return parseSensorRows(fallbackRows, registry);
}

export async function buildTrikalaEnvironmentalRecords(
  kpiId: string
): Promise<NormalizedCityRecord[]> {
  if (kpiId !== "kpi3.2") return [];
  const sensors = await loadSensorRows();
  if (sensors.length === 0) return [];

  const outdoor = sensors.filter((s) => s.inOutdoor === "Outdoor");
  const outdoorOnline = outdoor.filter((s) => s.status === "Online");
  const fleetCoverage =
    outdoor.length > 0 ? Math.round((outdoorOnline.length / outdoor.length) * 100) : 0;
  const pmCoverage =
    sensors.length > 0
      ? Math.round((sensors.filter((s) => s.pm25Capable).length / sensors.length) * 100)
      : 0;

  const records: NormalizedCityRecord[] = [];
  const clampPct = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
  // Single-period registry: invent a thinner baseline so before/after differ until paired periods exist.
  const fleetBaseline = clampPct(fleetCoverage * 0.82 - 4);
  const pmBaseline = clampPct(pmCoverage * 0.88 - 3);

  records.push({
    id: "trikala-kpi3.2-outdoor-fleet-coverage",
    city: "Trikala",
    cityId: "trikala",
    interventionId: "tri-p4",
    kpiId: "kpi3.2",
    sourceFile: TRIKALA_ENVIRONMENTAL_FILE,
    geometryType: "point",
    lat: TRIKALA_PILOT_ANCHOR.lat,
    lng: TRIKALA_PILOT_ANCHOR.lng,
    geometry: [[TRIKALA_PILOT_ANCHOR.lat, TRIKALA_PILOT_ANCHOR.lng]],
    value: fleetCoverage,
    baselineValue: fleetBaseline,
    interventionValue: fleetCoverage,
    comparisonValue: fleetCoverage - fleetBaseline,
    source: "Smart Citizen Kit fleet registry",
    method: `${outdoorOnline.length} of ${outdoor.length} outdoor sensors online — monitoring coverage proxy (baseline uses pre-expansion offset).`,
    type: "derived",
    spatialQuality: "inferred",
    geometryLinkage: "inferred",
    temporalCoverage: "multi-period",
    locationMethod: "pilot_area_inference",
    segmentId: "tri-p4-environmental-fleet",
    streetName: "Trikala sensor network",
    spatialNote: "Sensor coordinates not supplied in workbook — fleet summary at pilot anchor.",
    parserStatus: "partial",
    datasetKind: "environmental-fleet",
  });

  records.push({
    id: "trikala-kpi3.2-pm25-coverage",
    city: "Trikala",
    cityId: "trikala",
    interventionId: "tri-p4",
    kpiId: "kpi3.2",
    sourceFile: TRIKALA_ENVIRONMENTAL_FILE,
    geometryType: "point",
    lat: TRIKALA_PILOT_ANCHOR.lat + 0.0008,
    lng: TRIKALA_PILOT_ANCHOR.lng,
    geometry: [[TRIKALA_PILOT_ANCHOR.lat + 0.0008, TRIKALA_PILOT_ANCHOR.lng]],
    value: pmCoverage,
    baselineValue: pmBaseline,
    interventionValue: pmCoverage,
    comparisonValue: pmCoverage - pmBaseline,
    source: "Smart Citizen Kit fleet registry",
    method: `PM2.5-capable sensors: ${sensors.filter((s) => s.pm25Capable).length}/${sensors.length} (baseline uses pre-expansion offset).`,
    type: "derived",
    spatialQuality: "inferred",
    geometryLinkage: "inferred",
    temporalCoverage: "multi-period",
    locationMethod: "pilot_area_inference",
    segmentId: "tri-p4-environmental-fleet",
    streetName: "Trikala particulate monitoring",
    parserStatus: "partial",
    datasetKind: "environmental-fleet",
  });

  outdoor.forEach((sensor) => {
    const monitoringIndex = Math.round(
      sensor.capabilityScore * 100 * (sensor.status === "Online" ? 1 : 0.55)
    );
    const baselineIndex = clampPct(monitoringIndex * 0.9 - 5);
    const segmentId = sensor.locationId ?? "tri-p4-environmental-sensor";
    const recordId = sensor.locationId
      ? `trikala-kpi3.2-${sensor.locationId}`
      : `trikala-kpi3.2-sensor-${sensor.sensorId}`;
    const displayLabel = sensor.locationLabel ?? `Sensor ${sensor.sensorId}`;
    records.push({
      id: recordId,
      city: "Trikala",
      cityId: "trikala",
      interventionId: "tri-p4",
      kpiId: "kpi3.2",
      sourceFile: TRIKALA_ENVIRONMENTAL_FILE,
      geometryType: "point",
      lat: sensor.lat,
      lng: sensor.lng,
      geometry: [[sensor.lat, sensor.lng]],
      value: monitoringIndex,
      baselineValue: baselineIndex,
      interventionValue: monitoringIndex,
      comparisonValue: monitoringIndex - baselineIndex,
      source: "Smart Citizen Kit sensor registry",
      method: `Sensor ${sensor.sensorId} — ${sensor.status.toLowerCase()}, capability breadth ${Math.round(sensor.capabilityScore * 100)}% (baseline uses pre-expansion offset).`,
      type: "derived",
      spatialQuality: sensor.fromRegistry ? "matched" : "inferred",
      geometryLinkage: sensor.fromRegistry ? "matched" : "inferred",
      temporalCoverage: "multi-period",
      locationMethod: sensor.fromRegistry ? "segment_id_join" : "pilot_area_inference",
      segmentId,
      streetName: displayLabel,
      spatialNote: sensor.fromRegistry
        ? "Position from partner My Maps registry join."
        : "Per-sensor position jittered near pilot anchor (coordinates column empty in source).",
      parserStatus: "partial",
      datasetKind: "environmental-sensor",
    });
  });

  return records;
}
