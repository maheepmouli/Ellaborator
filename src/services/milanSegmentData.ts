import * as shapefile from "shapefile";

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
    coordinates?: [number, number][];
  };
  properties?: Record<string, unknown>;
}

const SPEED_SOURCES = {
  "mil-p1": {
    networkShp:
      "/sharepoint-data/Milan/4. Speed measurements/Pilot 1_Olimpic itineraries_AMAT/jobs_7882016_results_Itinerari_Olimpici_Maggio2025.shapefile/network.shp",
    networkDbf:
      "/sharepoint-data/Milan/4. Speed measurements/Pilot 1_Olimpic itineraries_AMAT/jobs_7882016_results_Itinerari_Olimpici_Maggio2025.shapefile/network.dbf",
    metricDbf:
      "/sharepoint-data/Milan/4. Speed measurements/Pilot 1_Olimpic itineraries_AMAT/jobs_7882016_results_Itinerari_Olimpici_Maggio2025.shapefile/Maggio 2025_0_8_00-9_00_0.dbf",
    label: "Pilot 1 speed",
  },
  "mil-p2": {
    networkShp:
      "/sharepoint-data/Milan/4. Speed measurements/Pilot 2_west axis_AMAT/jobs_7735361_results_Asse_Ovest.shapefile/network.shp",
    networkDbf:
      "/sharepoint-data/Milan/4. Speed measurements/Pilot 2_west axis_AMAT/jobs_7735361_results_Asse_Ovest.shapefile/network.dbf",
    metricDbf:
      "/sharepoint-data/Milan/4. Speed measurements/Pilot 2_west axis_AMAT/jobs_7735361_results_Asse_Ovest.shapefile/Ottobre_2024_0_8_00-9_00_0.dbf",
    label: "Pilot 2 speed",
  },
} as const;

const ENVIRONMENT_SOURCES = {
  "08-09": {
    shp: "/sharepoint-data/Milan/6. CO2 and noise emissions/traffic_08-09_AMAT/RETE_H08_archi.shp",
    dbf: "/sharepoint-data/Milan/6. CO2 and noise emissions/traffic_08-09_AMAT/RETE_H08_archi.dbf",
    label: "08-09 AMAT",
  },
  "18-19": {
    shp: "/sharepoint-data/Milan/6. CO2 and noise emissions/traffic_18-19_AMAT/RETE_H18_archi.shp",
    dbf: "/sharepoint-data/Milan/6. CO2 and noise emissions/traffic_18-19_AMAT/RETE_H18_archi.dbf",
    label: "18-19 AMAT",
  },
} as const;

const speedCache = new Map<string, MilanSegmentDataset>();
const environmentCache = new Map<string, MilanSegmentDataset>();
const cameraCache = new Map<string, Record<string, unknown>[]>();

const MILAN_CAMERA_NETWORK = {
  shp: "/sharepoint-data/Milan/3. Road user counts/evaluation_cameras.shp",
  dbf: "/sharepoint-data/Milan/3. Road user counts/evaluation_cameras.dbf",
};

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

function toLeafletCoordinates(coords: [number, number][]): [number, number][] {
  return coords.map(([lon, lat]) => [lat, lon]);
}

function getLineMidpoint(coords: [number, number][]): [number, number] {
  if (coords.length === 0) return [0, 0];
  const mid = coords[Math.floor(coords.length / 2)];
  return [mid[1], mid[0]];
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

const MILAN_PILOT_BUFFERS: Record<
  "mil-p1" | "mil-p2" | "mil-p3",
  { lat: number; lon: number; radiusDeg: number }
> = {
  "mil-p1": { lat: 45.476, lon: 9.195, radiusDeg: 0.018 },
  "mil-p2": { lat: 45.458, lon: 9.175, radiusDeg: 0.022 },
  "mil-p3": { lat: 45.44, lon: 9.19, radiusDeg: 0.02 },
};

function segmentMidpointLatLng(coords: [number, number][]): [number, number] | null {
  if (coords.length === 0) return null;
  const mid = coords[Math.floor(coords.length / 2)];
  return [mid[0], mid[1]];
}

export function filterMilanSegmentsNearPilot(
  records: MilanSegmentRecord[],
  pilotId: "mil-p1" | "mil-p2" | "mil-p3"
): MilanSegmentRecord[] {
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

function withCameraJoinStats(dataset: MilanSegmentDataset): MilanSegmentDataset {
  const joined = dataset.records.filter((r) => (r.properties?.cameraCount as number) > 0).length;
  const rate = dataset.records.length > 0 ? Math.round((joined / dataset.records.length) * 100) : 0;
  return {
    ...dataset,
    stats: { ...dataset.stats, cameraJoinRatePct: rate },
  };
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
  if (params.metricType === "speed") {
    metricRows.forEach((row) => {
      const id = Math.round(toNumber(row.BS_Id));
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

  features.forEach((feature) => {
    if (feature.geometry?.type !== "LineString" || !feature.geometry.coordinates) {
      invalidGeometries += 1;
      return;
    }
    const props = feature.properties || {};
    const segmentId = Math.round(toNumber(props.Id));
    if (segmentId <= 0) return;

    let value = 0;
    const outProps: Record<string, unknown> = {
      sourceLabel: params.sourceLabel,
      timeWindow: params.timeWindow,
      metricType: params.metricType,
      segmentId,
    };

    if (params.metricType === "speed") {
      const metric = speedRowsById.get(segmentId);
      if (!metric) {
        missingMetricJoins += 1;
        return;
      }
      const avgSpeed = toNumber(metric.BS_AvgSp);
      const p85Speed = toNumber(metric.BS_P85sp);
      const hits = toNumber(metric.BS_Hits);
      value = Math.max(0, p85Speed * 0.7 + avgSpeed * 0.3);
      outProps.avgSpeed = avgSpeed;
      outProps.p85Speed = p85Speed;
      outProps.hits = hits;
      outProps.streetName = props.StreetName;
      outProps.speedLimit = toNumber(props.SpeedLimit);
    } else {
      // Environmental proxy based on traffic composition by segment.
      const auto = toNumber(props.V_AUTO);
      const moto = toNumber(props.V_MOTO);
      const light = toNumber(props.V_LEGGERI);
      const medium = toNumber(props.V_MEDI);
      const heavy = toNumber(props.V_PESANTI);
      const weightedTraffic = auto * 1 + moto * 0.8 + light * 1.4 + medium * 2.2 + heavy * 3.2;
      value = weightedTraffic;
      outProps.vAuto = auto;
      outProps.vMoto = moto;
      outProps.vLeggeri = light;
      outProps.vMedi = medium;
      outProps.vPesanti = heavy;
      outProps.streetName = props.NOME_VIA;
      outProps.municipality = props.NOME_COMUN;
    }

    const directCameraMatches = camerasBySegment.get(segmentId) || [];
    if (directCameraMatches.length > 0) {
      outProps.cameraJoin = "segment_id";
      outProps.cameraCount = directCameraMatches.length;
    } else if (cameraLocations.length > 0) {
      const lineMidpoint = getLineMidpoint(feature.geometry.coordinates);
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
      outProps.cameraJoin = "nearest_geometry";
      outProps.cameraCount = 1;
      outProps.cameraDistance = Math.sqrt(bestDist);
    }

    values.push(value);
    records.push({
      id: `${params.metricType}-${params.timeWindow}-${segmentId}`,
      coordinates: toLeafletCoordinates(feature.geometry.coordinates),
      value,
      properties: outProps,
    });
  });

  const normalizedValues = normalize(values);
  const normalizedRecords = records.map((record, index) => ({
    ...record,
    value: normalizedValues[index] ?? record.value,
  }));
  return {
    records: normalizedRecords,
    stats: {
      parsedSegments: normalizedRecords.length,
      invalidGeometries,
      missingMetricJoins,
      avgMetricValue:
        normalizedRecords.length > 0
          ? normalizedRecords.reduce((sum, record) => sum + record.value, 0) / normalizedRecords.length
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
    const unavailable: MilanSegmentDataset = {
      records: [],
      stats: {
        parsedSegments: 0,
        invalidGeometries: 0,
        missingMetricJoins: 0,
        avgMetricValue: 0,
      },
      dataConfidence: "unavailable",
      renderMode: "segment",
      statusMessage: "Segment-level safety data is not available for Milan Pilot 3 yet.",
    };
    speedCache.set(cacheKey, unavailable);
    return unavailable;
  }

  const source = SPEED_SOURCES[pilotId];
  if (!cameraCache.has("milan-cameras")) {
    try {
      const cameraFeatures = await readShapefileFeatures(MILAN_CAMERA_NETWORK.shp, MILAN_CAMERA_NETWORK.dbf);
      const rows = cameraFeatures.map((feature) => feature.properties || {});
      cameraCache.set("milan-cameras", rows);
    } catch {
      cameraCache.set("milan-cameras", []);
    }
  }
  const metricRows = await readDbfRows(source.metricDbf);
  const dataset = await parseMilanSegmentShapefile({
    file: { shp: source.networkShp, dbf: source.networkDbf },
    metricType: "speed",
    sourceLabel: source.label,
    timeWindow: "08:00-09:00",
    metricRows,
  });
  speedCache.set(cacheKey, withCameraJoinStats(dataset));
  return speedCache.get(cacheKey)!;
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
    try {
      const cameraFeatures = await readShapefileFeatures(MILAN_CAMERA_NETWORK.shp, MILAN_CAMERA_NETWORK.dbf);
      const rows = cameraFeatures.map((feature) => feature.properties || {});
      cameraCache.set("milan-cameras", rows);
    } catch {
      cameraCache.set("milan-cameras", []);
    }
  }
  const dataset = await parseMilanSegmentShapefile({
    file: { shp: source.shp, dbf: source.dbf },
    metricType: "co2",
    sourceLabel: source.label,
    timeWindow: window,
  });
  let scoped = dataset;
  if (pilotId) {
    const filtered = filterMilanSegmentsNearPilot(dataset.records, pilotId);
    scoped = {
      ...dataset,
      records: filtered,
      stats: {
        ...dataset.stats,
        parsedSegments: filtered.length,
        pilotScoped: true,
      },
      statusMessage: `RETE segments clipped to ${pilotId} buffer (~${filtered.length} links). Environmental proxy from traffic composition; camera joins where available.`,
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
