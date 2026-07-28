import * as shapefile from "shapefile";
import proj4 from "proj4";
import {
  MILAN_CAMERA_NETWORK,
  MILAN_CAMERA_NETWORK_LEGACY,
  MILAN_ENVIRONMENT_SOURCES,
  MILAN_ENVIRONMENT_SOURCES_LEGACY,
  MILAN_SPEED_SOURCES,
  MILAN_SPEED_SOURCES_LEGACY,
} from "@/lib/milanDataPaths";
import { MILAN_PILOT_ANCHORS } from "@/lib/milanMapConfig";
import { milanSourcePilotIds } from "@/lib/milanPilotScope";

proj4.defs(
  "EPSG:3003",
  "+proj=tmerc +lat_0=0 +lon_0=9 +k=0.9996 +x_0=1500000 +y_0=0 +ellps=intl +towgs84=-104.1,-49.1,-9.9,0.416,0.41,0.35,-5.71 +units=m +no_defs"
);

export interface MilanSegmentRecord {
  id: string;
  coordinates: [number, number][];
  value: number;
  properties?: Record<string, unknown>;
}

export interface MilanSegmentStats {
  parsedSegments: number;
  invalidGeometries: number;
  missingMetricJoins: number;
  avgMetricValue: number;
  /** Share of segments with a camera join (segment_id or nearest). */
  cameraJoinRatePct?: number;
  pilotScoped?: boolean;
}

export interface MilanSegmentDataset {
  records: MilanSegmentRecord[];
  stats: MilanSegmentStats;
  dataConfidence: "real" | "proxy" | "unavailable";
  renderMode: "segment" | "proxy";
  statusMessage?: string;
}

interface GeoFeature {
  geometry?: {
    type?: string;
    coordinates?: [number, number][] | [number, number][][];
  };
  properties?: Record<string, unknown>;
}

const SPEED_SOURCES = MILAN_SPEED_SOURCES;
const ENVIRONMENT_SOURCES = MILAN_ENVIRONMENT_SOURCES;

const speedCache = new Map<string, MilanSegmentDataset>();
const environmentCache = new Map<string, MilanSegmentDataset>();
const cameraCache = new Map<string, Record<string, unknown>[]>();

const MILAN_SPEED_JSON_FALLBACK = "/data/milan/speed-segments.json";

interface MilanSpeedJsonBundle {
  pilots?: Record<string, MilanSegmentDataset>;
}

function cameraRowsFromFeatures(features: GeoFeature[]): Record<string, unknown>[] {
  return features.map((feature) => {
    const props = { ...(feature.properties || {}) };
    const coords = feature.geometry?.coordinates;
    if (coords && coords.length >= 2) {
      const [lng, lat] = proj4("EPSG:3003", "WGS84", [coords[0], coords[1]]);
      props.lat = lat;
      props.lon = lng;
    }
    return props;
  });
}

async function readShapefileWithFallback(
  candidates: Array<{ shp: string; dbf: string }>
): Promise<GeoFeature[]> {
  for (const candidate of candidates) {
    try {
      const features = await readShapefileFeatures(candidate.shp, candidate.dbf);
      if (features.length > 0) return features;
    } catch {
      // try next path
    }
  }
  return [];
}

async function readDbfWithFallback(candidates: string[]): Promise<Record<string, unknown>[]> {
  for (const dbfPath of candidates) {
    try {
      const rows = await readDbfRows(dbfPath);
      if (rows.length > 0) return rows;
    } catch {
      // try next path
    }
  }
  return [];
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function normalize(values: number[]): number[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 50);
  return values.map((value) => ((value - min) / (max - min)) * 100);
}

async function readShapefileFeatures(shpPath: string, dbfPath: string): Promise<GeoFeature[]> {
  const source = await shapefile.open(encodeURI(shpPath), encodeURI(dbfPath));
  const features: GeoFeature[] = [];
  while (true) {
    const result = await source.read();
    if (result.done) break;
    features.push(result.value as GeoFeature);
  }
  return features;
}

async function readDbfRows(dbfPath: string): Promise<Record<string, unknown>[]> {
  const source = await shapefile.openDbf(encodeURI(dbfPath));
  const rows: Record<string, unknown>[] = [];
  while (true) {
    const result = await source.read();
    if (result.done) break;
    rows.push((result.value || {}) as Record<string, unknown>);
  }
  return rows;
}

function isProjectedCoord(x: number, y: number): boolean {
  return Math.abs(x) > 180 || Math.abs(y) > 90;
}

/** Shapefile lines may be EPSG:3003 (Monte Mario) or WGS84 — always return Leaflet [lat, lng]. */
function reprojectLineToLeaflet(coords: [number, number][]): [number, number][] {
  return coords.map(([x, y]) => {
    if (isProjectedCoord(x, y)) {
      const [lng, lat] = proj4("EPSG:3003", "WGS84", [x, y]);
      return [lat, lng];
    }
    return [y, x];
  });
}

function lineMidpointLatLng(coords: [number, number][]): [number, number] {
  if (coords.length === 0) return [0, 0];
  const mid = coords[Math.floor(coords.length / 2)];
  return [mid[0], mid[1]];
}


function parseSegmentId(value: unknown): number | null {
  const asNumber = Math.round(toNumber(value));
  return asNumber > 0 ? asNumber : null;
}

function parseCameraCoordinate(row: Record<string, unknown>): [number, number] | null {
  const lat = toNumber(row.lat ?? row.LAT ?? row.y ?? row.Y);
  const lon = toNumber(row.lon ?? row.LON ?? row.x ?? row.X);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat === 0 || lon === 0) return null;
  return [lat, lon];
}

function distanceSquared(a: [number, number], b: [number, number]): number {
  const dLat = a[0] - b[0];
  const dLon = a[1] - b[1];
  return dLat * dLat + dLon * dLon;
}

export const MILAN_PILOT_BUFFERS = MILAN_PILOT_ANCHORS;

function segmentMidpointLatLng(coords: [number, number][]): [number, number] | null {
  return lineMidpointLatLng(coords);
}

export function filterMilanSegmentsNearPilot(
  records: MilanSegmentRecord[],
  pilotId: "mil-p1" | "mil-p2" | "mil-p3"
): MilanSegmentRecord[] {
  const sources = milanSourcePilotIds(pilotId);
  if (sources.length > 1) {
    const seen = new Set<string>();
    const merged: MilanSegmentRecord[] = [];
    for (const src of sources) {
      for (const record of filterMilanSegmentsNearPilot(records, src)) {
        if (seen.has(record.id)) continue;
        seen.add(record.id);
        merged.push(record);
      }
    }
    return merged;
  }
  const anchor = MILAN_PILOT_BUFFERS[pilotId];
  const r2 = anchor.radiusDeg * anchor.radiusDeg;
  return records.filter((record) => {
    const mid = segmentMidpointLatLng(record.coordinates);
    if (!mid) return false;
    const dLat = mid[0] - anchor.lat;
    const dLon = mid[1] - anchor.lon;
    return dLat * dLat + dLon * dLon <= r2;
  });
}

function mergeMilanSegmentDatasets(
  left: MilanSegmentDataset,
  right: MilanSegmentDataset,
  pilotId: "mil-p3"
): MilanSegmentDataset {
  const seen = new Set<string>();
  const records: MilanSegmentRecord[] = [];
  for (const record of [...left.records, ...right.records]) {
    if (seen.has(record.id)) continue;
    seen.add(record.id);
    records.push(record);
  }
  const avgMetricValue =
    records.length > 0
      ? records.reduce((sum, record) => sum + record.value, 0) / records.length
      : 0;
  const dataConfidence =
    left.dataConfidence === "unavailable" && right.dataConfidence === "unavailable"
      ? "unavailable"
      : left.dataConfidence === "unavailable"
        ? right.dataConfidence
        : right.dataConfidence === "unavailable"
          ? left.dataConfidence
          : left.dataConfidence === "proxy" || right.dataConfidence === "proxy"
            ? "proxy"
            : "real";
  return withCameraJoinStats({
    records,
    stats: {
      parsedSegments: records.length,
      invalidGeometries: left.stats.invalidGeometries + right.stats.invalidGeometries,
      missingMetricJoins: left.stats.missingMetricJoins + right.stats.missingMetricJoins,
      avgMetricValue,
      pilotScoped: true,
    },
    dataConfidence,
    renderMode: left.renderMode === "proxy" || right.renderMode === "proxy" ? "proxy" : "segment",
    statusMessage: `Merged mil-p1 (${left.records.length}) + mil-p2 (${right.records.length}) segments for ${pilotId} (${records.length} unique).`,
  });
}

function withCameraJoinStats(dataset: MilanSegmentDataset): MilanSegmentDataset {
  const joined = dataset.records.filter((r) => (r.properties?.cameraCount as number) > 0).length;
  const rate = dataset.records.length > 0 ? Math.round((joined / dataset.records.length) * 100) : 0;
  return {
    ...dataset,
    stats: { ...dataset.stats, cameraJoinRatePct: rate },
  };
}

async function loadMilanSpeedFromJsonFallback(
  pilotId: "mil-p1" | "mil-p2"
): Promise<MilanSegmentDataset | null> {
  try {
    const response = await fetch(MILAN_SPEED_JSON_FALLBACK);
    if (!response.ok) return null;
    const bundle = (await response.json()) as MilanSpeedJsonBundle;
    const pilotBundle = bundle.pilots?.[pilotId];
    if (!pilotBundle?.records?.length) return null;
    return withCameraJoinStats({
      ...pilotBundle,
      dataConfidence: pilotBundle.dataConfidence || "proxy",
      renderMode: "segment",
      statusMessage:
        pilotBundle.statusMessage ||
        `Bundled AMAT network.shp segments for ${pilotId} (SharePoint shapefiles unavailable on this host).`,
    });
  } catch {
    return null;
  }
}

function unavailableMilanSpeedDataset(message: string): MilanSegmentDataset {
  return {
    records: [],
    stats: {
      parsedSegments: 0,
      invalidGeometries: 0,
      missingMetricJoins: 0,
      avgMetricValue: 0,
    },
    dataConfidence: "unavailable",
    renderMode: "segment",
    statusMessage: message,
  };
}

function extractLineGeometries(feature: GeoFeature): [number, number][][] {
  const geometry = feature.geometry;
  if (!geometry?.coordinates) return [];
  if (geometry.type === "LineString") {
    const line = reprojectLineToLeaflet(geometry.coordinates as [number, number][]);
    return line.length >= 2 ? [line] : [];
  }
  if (geometry.type === "MultiLineString") {
    return (geometry.coordinates as [number, number][][])
      .map((part) => reprojectLineToLeaflet(part))
      .filter((line) => line.length >= 2);
  }
  return [];
}

export async function parseMilanSegmentShapefile(params: {
  file: { shp: string; dbf: string };
  metricType: "speed" | "co2" | "noise";
  sourceLabel: string;
  timeWindow: string;
  metricRows?: Record<string, unknown>[];
}): Promise<MilanSegmentDataset> {
  const features = await readShapefileFeatures(params.file.shp, params.file.dbf);
  let metricRows = params.metricRows || [];
  if (!metricRows.length && params.metricType === "speed") {
    return {
      records: [],
      stats: {
        parsedSegments: 0,
        invalidGeometries: 0,
        missingMetricJoins: 0,
        avgMetricValue: 0,
      },
      dataConfidence: "unavailable",
      renderMode: "segment",
      statusMessage: "Segment-level speed metrics are unavailable for this source.",
    };
  }

  const speedRowsById = new Map<number, Record<string, unknown>>();
  /** Maggio/Ottobre DBFs use hour-prefixed columns (BS_*, CS2_*, CS11_*, …). */
  const pickMetricKey = (row: Record<string, unknown>, suffix: string): string | undefined =>
    Object.keys(row).find((key) => key.toLowerCase().endsWith(suffix.toLowerCase()));
  if (params.metricType === "speed") {
    metricRows.forEach((row) => {
      const idKey = pickMetricKey(row, "_Id");
      const id = Math.round(toNumber(idKey ? row[idKey] : row.BS_Id));
      if (id > 0) speedRowsById.set(id, row);
    });
  }

  const cameraRows = cameraCache.get("milan-cameras") || [];
  const camerasBySegment = new Map<number, Record<string, unknown>[]>();
  const cameraLocations: Array<{ coord: [number, number]; row: Record<string, unknown> }> = [];
  cameraRows.forEach((row) => {
    const maybeSegmentId =
      parseSegmentId(row.segment_id) ||
      parseSegmentId(row.segmentId) ||
      parseSegmentId(row.SEGMENT_ID) ||
      parseSegmentId(row.ID);
    if (maybeSegmentId) {
      const list = camerasBySegment.get(maybeSegmentId) || [];
      list.push(row);
      camerasBySegment.set(maybeSegmentId, list);
    }
    const coord = parseCameraCoordinate(row);
    if (coord) cameraLocations.push({ coord, row });
  });

  const records: MilanSegmentRecord[] = [];
  const values: number[] = [];
  let invalidGeometries = 0;
  let missingMetricJoins = 0;
  let reteOrdinal = 0;

  features.forEach((feature) => {
    const lineParts = extractLineGeometries(feature);
    if (!lineParts.length) {
      invalidGeometries += 1;
      return;
    }
    const props = feature.properties || {};
    // Speed network uses Id; RETE env uses node pair A/B (no Id field).
    let segmentId = Math.round(toNumber(props.Id ?? props.ID));
    if (segmentId <= 0 && (props.A != null || props["A-B"] != null)) {
      reteOrdinal += 1;
      segmentId = reteOrdinal;
    }
    if (segmentId <= 0) return;

    const outProps: Record<string, unknown> = {
      sourceLabel: params.sourceLabel,
      timeWindow: params.timeWindow,
      metricType: params.metricType,
      segmentId,
      streetName: props.StreetName ?? props.NOME_VIA ?? props.NOME_COMUN,
      speedLimit: toNumber(props.SpeedLimit),
      reteFrom: props.A != null ? toNumber(props.A) : undefined,
      reteTo: props.B != null ? toNumber(props.B) : undefined,
      reteLink: props["A-B"] != null ? String(props["A-B"]) : undefined,
    };

    if (params.metricType === "speed") {
      const metric = speedRowsById.get(segmentId);
      if (!metric) {
        missingMetricJoins += 1;
        lineParts.forEach((leafletCoords, partIndex) => {
          const baseId = `${params.metricType}-${params.timeWindow}-${segmentId}`;
          records.push({
            id: lineParts.length > 1 ? `${baseId}-L${partIndex}` : baseId,
            coordinates: leafletCoords,
            value: 0,
            properties: { ...outProps, hasMetric: false },
          });
        });
        return;
      }
      const avgKey = pickMetricKey(metric, "_AvgSp");
      const p85Key = pickMetricKey(metric, "_P85sp");
      const hitsKey = pickMetricKey(metric, "_Hits");
      const avgSpeed = toNumber(avgKey ? metric[avgKey] : metric.BS_AvgSp);
      const p85Speed = toNumber(p85Key ? metric[p85Key] : metric.BS_P85sp);
      const hits = toNumber(hitsKey ? metric[hitsKey] : metric.BS_Hits);
      const rawValue = Math.max(0, p85Speed * 0.7 + avgSpeed * 0.3);
      outProps.avgSpeed = avgSpeed;
      outProps.p85Speed = p85Speed;
      outProps.hits = hits;
      outProps.hasMetric = true;
      outProps.rawMetricValue = rawValue;
      values.push(rawValue);
    } else {
      // Environmental proxy based on traffic composition by segment (RETE).
      const auto = toNumber(props.V_AUTO ?? props.vAuto);
      const moto = toNumber(props.V_MOTO ?? props.vMoto);
      const light = toNumber(props.V_LEGGERI ?? props.vLeggeri);
      const medium = toNumber(props.V_MEDI ?? props.vMedi);
      const heavy = toNumber(props.V_PESANTI ?? props.vPesanti);
      const weightedTraffic = auto * 1 + moto * 0.8 + light * 1.4 + medium * 2.2 + heavy * 3.2;
      // Keep zero-traffic links out of the pressure scale (still leave geometry for context via underlay).
      if (weightedTraffic <= 0) return;
      const value = weightedTraffic;
      outProps.vAuto = auto;
      outProps.vMoto = moto;
      outProps.vLeggeri = light;
      outProps.vMedi = medium;
      outProps.vPesanti = heavy;
      outProps.hasMetric = true;
      values.push(value);
    }

    const rawValue = values[values.length - 1]!;
    for (let partIndex = 0; partIndex < lineParts.length; partIndex += 1) {
      const leafletCoords = lineParts[partIndex]!;
      const baseId = `${params.metricType}-${params.timeWindow}-${segmentId}`;
      const directCameraMatches = camerasBySegment.get(segmentId) || [];
      const cameraProps: Record<string, unknown> = {};
      if (directCameraMatches.length > 0) {
        cameraProps.cameraJoin = "segment_id";
        cameraProps.cameraCount = directCameraMatches.length;
      } else if (cameraLocations.length > 0) {
        const lineMidpoint = lineMidpointLatLng(leafletCoords);
        let best = cameraLocations[0];
        let bestDist = distanceSquared(lineMidpoint, best.coord);
        for (let i = 1; i < cameraLocations.length; i += 1) {
          const candidate = cameraLocations[i];
          const candidateDist = distanceSquared(lineMidpoint, candidate.coord);
          if (candidateDist < bestDist) {
            best = candidate;
            bestDist = candidateDist;
          }
        }
        cameraProps.cameraJoin = "nearest_geometry";
        cameraProps.cameraCount = 1;
        cameraProps.cameraDistance = Math.sqrt(bestDist);
        cameraProps.centroidLat = lineMidpoint[0];
        cameraProps.centroidLon = lineMidpoint[1];
      }

      records.push({
        id: lineParts.length > 1 ? `${baseId}-L${partIndex}` : baseId,
        coordinates: leafletCoords,
        value: rawValue,
        properties: { ...outProps, ...cameraProps },
      });
    }
  });

  const segmentRawValues = new Map<number, number>();
  records.forEach((record) => {
    if (record.properties?.hasMetric === false) return;
    const segId = Math.round(Number(record.properties?.segmentId ?? 0));
    if (segId > 0 && !segmentRawValues.has(segId)) {
      segmentRawValues.set(segId, Number(record.properties?.rawMetricValue ?? record.value));
    }
  });
  const rawList = [...segmentRawValues.values()];
  const normalizedList = normalize(rawList.length ? rawList : values);
  const normalizedBySegmentId = new Map<number, number>();
  [...segmentRawValues.keys()].forEach((segId, index) => {
    normalizedBySegmentId.set(segId, normalizedList[index] ?? segmentRawValues.get(segId)!);
  });

  const normalizedRecords = records.map((record) => {
    if (record.properties?.hasMetric === false) return record;
    const segId = Math.round(Number(record.properties?.segmentId ?? 0));
    const nextValue = normalizedBySegmentId.get(segId) ?? record.value;
    return { ...record, value: nextValue };
  });
  return {
    records: normalizedRecords,
    stats: {
      parsedSegments: normalizedRecords.length,
      invalidGeometries,
      missingMetricJoins,
      avgMetricValue:
        rawList.length > 0
          ? rawList.reduce((sum, value) => sum + value, 0) / rawList.length
          : 0,
    },
    dataConfidence: "real",
    renderMode: "segment",
  };
}

export async function loadMilanSpeedSegments(
  pilotId: "mil-p1" | "mil-p2" | "mil-p3" = "mil-p2"
): Promise<MilanSegmentDataset> {
  const cacheKey = `speed-${pilotId}`;
  const cached = speedCache.get(cacheKey);
  if (cached) return cached;

  if (pilotId === "mil-p3") {
    const p1 = await loadMilanSpeedSegments("mil-p1");
    const p2 = await loadMilanSpeedSegments("mil-p2");
    const merged = mergeMilanSegmentDatasets(p1, p2, "mil-p3");
    speedCache.set(cacheKey, merged);
    return merged;
  }

  const source = SPEED_SOURCES[pilotId];
  try {
    if (!cameraCache.has("milan-cameras")) {
      const cameraFeatures = await readShapefileWithFallback([
        MILAN_CAMERA_NETWORK,
        MILAN_CAMERA_NETWORK_LEGACY,
      ]);
      const rows = cameraRowsFromFeatures(cameraFeatures);
      cameraCache.set("milan-cameras", rows);
    }
    const metricRows = await readDbfWithFallback([
      source.metricDbf,
      MILAN_SPEED_SOURCES_LEGACY[pilotId].metricDbf,
    ]);
    let dataset = await parseMilanSegmentShapefile({
      file: { shp: source.networkShp, dbf: source.networkDbf },
      metricType: "speed",
      sourceLabel: source.label,
      timeWindow: "08:00-09:00",
      metricRows,
    });
    if (dataset.records.length === 0) {
      const legacy = MILAN_SPEED_SOURCES_LEGACY[pilotId];
      dataset = await parseMilanSegmentShapefile({
        file: { shp: legacy.networkShp, dbf: legacy.networkDbf },
        metricType: "speed",
        sourceLabel: legacy.label,
        timeWindow: "08:00-09:00",
        metricRows,
      });
    }
    if (dataset.records.length === 0) {
      const fallback = await loadMilanSpeedFromJsonFallback(pilotId);
      if (fallback) {
        speedCache.set(cacheKey, fallback);
        return fallback;
      }
      const unavailable = unavailableMilanSpeedDataset(
        dataset.statusMessage || "Segment-level speed metrics are unavailable for this source."
      );
      speedCache.set(cacheKey, unavailable);
      return unavailable;
    }
    // network.shp is already the intervention corridor — do not circular-clip (sticky #05 / #17).
    const scoped: MilanSegmentDataset = {
      ...withCameraJoinStats({
        ...dataset,
        stats: {
          ...dataset.stats,
          pilotScoped: true,
        },
        statusMessage: `${source.label} · full network.shp (${dataset.records.length} segments).`,
      }),
    };
    speedCache.set(cacheKey, scoped);
    return scoped;
  } catch {
    const fallback = await loadMilanSpeedFromJsonFallback(pilotId);
    if (fallback) {
      speedCache.set(cacheKey, fallback);
      return fallback;
    }
    const unavailable = unavailableMilanSpeedDataset(
      "Milan AMAT speed shapefiles are not hosted on this deployment. Add /sharepoint-data/Milan/ or use the bundled fallback."
    );
    speedCache.set(cacheKey, unavailable);
    return unavailable;
  }
}

export async function loadMilanEnvironmentSegments(
  window: "08-09" | "18-19" = "08-09",
  pilotId?: "mil-p1" | "mil-p2" | "mil-p3" | null
): Promise<MilanSegmentDataset> {
  const cacheKey = `environment-${window}-${pilotId || "city"}`;
  const cached = environmentCache.get(cacheKey);
  if (cached) return cached;

  const source = ENVIRONMENT_SOURCES[window];
  if (!cameraCache.has("milan-cameras")) {
    const cameraFeatures = await readShapefileWithFallback([
      MILAN_CAMERA_NETWORK,
      MILAN_CAMERA_NETWORK_LEGACY,
    ]);
    const rows = cameraRowsFromFeatures(cameraFeatures);
    cameraCache.set("milan-cameras", rows);
  }
  let dataset = await parseMilanSegmentShapefile({
    file: { shp: source.shp, dbf: source.dbf },
    metricType: "co2",
    sourceLabel: source.label,
    timeWindow: window,
  });
  if (dataset.records.length === 0) {
    const legacy = MILAN_ENVIRONMENT_SOURCES_LEGACY[window];
    dataset = await parseMilanSegmentShapefile({
      file: { shp: legacy.shp, dbf: legacy.dbf },
      metricType: "co2",
      sourceLabel: legacy.label,
      timeWindow: window,
    });
  }
  let scoped = dataset;
  if (pilotId) {
    const filtered = filterMilanSegmentsNearPilot(dataset.records, pilotId);
    // Cap dense RETE extracts so Leaflet stays responsive (keep highest-pressure links).
    const MAP_RETE_CAP = 2800;
    const capped =
      filtered.length > MAP_RETE_CAP
        ? [...filtered]
            .sort((a, b) => Number(b.value ?? 0) - Number(a.value ?? 0))
            .slice(0, MAP_RETE_CAP)
        : filtered;
    scoped = {
      ...dataset,
      records: capped,
      stats: {
        ...dataset.stats,
        parsedSegments: capped.length,
        pilotScoped: true,
      },
      statusMessage:
        pilotId === "mil-p3"
          ? `RETE segments clipped to Pilot 1 + Pilot 2 buffers (~${capped.length} of ${filtered.length} links). Environmental proxy from traffic composition.`
          : `RETE segments clipped to ${pilotId} buffer (~${capped.length}${
              filtered.length > capped.length ? ` of ${filtered.length}` : ""
            } links). Environmental proxy from traffic composition.`,
    };
  } else {
    scoped.statusMessage =
      "Derived environmental pressure proxy from traffic composition fields, linked with camera network by segment ID or nearest geometry.";
  }
  scoped.dataConfidence = "proxy";
  scoped.renderMode = "segment";
  const finalDataset = withCameraJoinStats(scoped);
  environmentCache.set(cacheKey, finalDataset);
  return finalDataset;
}
