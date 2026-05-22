import type { TrafficAPIResponse, TrafficAPIParams, TrafficSegment } from "@/types/traffic";
import { getTrafficApiUrl } from "@/lib/api-config";
import {
  clampOpendataLimit,
  fetchOpendataPaginated,
} from "@/lib/issy-opendata";
import { dedupeTrafficBySegmentId, ISSY_JUNCTION_SEGMENT_IDS } from "@/lib/issyPilot2Junction";
import { ISSY_OPENDATA_MAX_LIMIT } from "@/lib/issy-opendata";

/**
 * Fetches traffic data from the Issy-les-Moulineaux traffic API
 */
export async function fetchTrafficData(
  params: TrafficAPIParams = {}
): Promise<TrafficAPIResponse> {
  const {
    limit: requestedLimit = 100,
    offset = 0,
    where,
    select,
    order_by,
    refine,
    exclude,
    lang,
    timezone = "Europe/Berlin",
  } = params;

  const limit = clampOpendataLimit(requestedLimit);

  const searchParams = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
    timezone,
  });

  if (where) searchParams.append("where", where);
  if (select) searchParams.append("select", select);
  if (order_by) searchParams.append("order_by", order_by);
  if (lang) searchParams.append("lang", lang);

  // Add refine parameters
  if (refine) {
    Object.entries(refine).forEach(([key, value]) => {
      searchParams.append(`refine.${key}`, value);
    });
  }

  // Add exclude parameters
  if (exclude) {
    Object.entries(exclude).forEach(([key, value]) => {
      searchParams.append(`exclude.${key}`, value);
    });
  }

  const url = `${getTrafficApiUrl()}?${searchParams.toString()}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    
    const data: TrafficAPIResponse = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching traffic data from:", url, error);
    // Return empty response instead of throwing to allow fallback to synthetic data
    return { total_count: 0, results: [] };
  }
}

/** Fetches up to `desiredLimit` rows using 100-row API pages. */
export async function fetchTrafficDataPaginated(
  params: TrafficAPIParams = {},
  desiredLimit: number = 100
): Promise<TrafficAPIResponse> {
  const { limit: _ignored, offset: _offsetIgnored, ...rest } = params;
  return fetchOpendataPaginated(
    (limit, offset) => fetchTrafficData({ ...rest, limit, offset }),
    desiredLimit
  );
}

/**
 * Fetches traffic data for a specific date range
 */
export async function fetchTrafficByDateRange(
  startDate: Date,
  endDate: Date,
  params: Omit<TrafficAPIParams, "where"> = {}
): Promise<TrafficAPIResponse> {
  const startISO = startDate.toISOString();
  const endISO = endDate.toISOString();
  const where = `date_et_heure_de_comptage_utc >= date'${startISO}' AND date_et_heure_de_comptage_utc <= date'${endISO}'`;

  return fetchTrafficData({
    ...params,
    where,
    order_by: "date_et_heure_de_comptage_utc",
  });
}

/**
 * Fetches traffic data for a specific segment
 */
export async function fetchTrafficBySegment(
  segmentId: string,
  params: Omit<TrafficAPIParams, "where"> = {}
): Promise<TrafficAPIResponse> {
  const where = `id = "${segmentId}"`;
  return fetchTrafficData({
    ...params,
    where,
  });
}

/** Latest observation per arm at the Issy Pilot 2 junction (two segment IDs only). */
export async function fetchIssyJunctionTraffic(): Promise<TrafficAPIResponse> {
  const collected: TrafficSegment[] = [];
  for (const segmentId of ISSY_JUNCTION_SEGMENT_IDS) {
    const page = await fetchTrafficBySegment(segmentId, {
      limit: ISSY_OPENDATA_MAX_LIMIT,
      order_by: "date_et_heure_de_comptage_utc desc",
    });
    if (page.results?.length) collected.push(...page.results);
  }
  const results = dedupeTrafficBySegmentId(collected);
  return { total_count: results.length, results };
}

/**
 * Converts traffic segments to map segments (polylines)
 */
export interface MapSegment {
  id: string;
  coordinates: [number, number][]; // [lat, lon] pairs for Leaflet
  value: number;
  properties?: {
    segment?: string;
    type?: string;
    vitesse_km_h?: number;
    indice_de_congestion?: number;
    distance_metres?: number;
  };
}

/** Map one traficissy row to 0–100 KPI intensity (same rules as map polylines). */
export function getTrafficKpiValue(segment: TrafficSegment, kpiId: string): number {
  switch (kpiId) {
    case "kpi1.2":
      return segment.indice_de_congestion * 100;
    case "kpi2.1":
      return Math.max(0, 100 - (segment.vitesse_km_h / 60) * 100);
    case "kpi3.2":
      return segment.indice_de_congestion * 100;
    default:
      return segment.indice_de_congestion * 100;
  }
}

export function trafficSegmentsToSegments(
  segments: TrafficSegment[],
  kpiId: string
): MapSegment[] {
  return segments.map((segment) => {
    const value = getTrafficKpiValue(segment, kpiId);

    // Convert LineString coordinates from [lon, lat] to [lat, lon] for Leaflet
    const coordinates: [number, number][] = segment.geo_shape.geometry.coordinates.map(
      ([lon, lat]) => [lat, lon] as [number, number]
    );

    return {
      id: segment.id,
      coordinates,
      value: Math.min(100, Math.max(0, value)),
      properties: {
        segment: segment.segment,
        type: segment.type,
        vitesse_km_h: segment.vitesse_km_h,
        indice_de_congestion: segment.indice_de_congestion,
        distance_metres: segment.distance_metres,
      },
    };
  });
}

/**
 * Legacy function for backward compatibility - converts to points
 * @deprecated Use trafficSegmentsToSegments instead
 */
export function trafficSegmentsToHexbin(
  segments: TrafficSegment[],
  kpiId: string
): Array<{ lat: number; lon: number; value: number; id: string }> {
  return segments.map((segment) => {
    let value = 0;
    switch (kpiId) {
      case "kpi1.2":
        value = segment.indice_de_congestion * 100;
        break;
      case "kpi2.1":
        value = Math.max(0, 100 - (segment.vitesse_km_h / 60) * 100);
        break;
      case "kpi3.2":
        value = segment.indice_de_congestion * 100;
        break;
      default:
        value = segment.indice_de_congestion * 100;
    }
    return {
      lat: segment.geo_point_2d.lat,
      lon: segment.geo_point_2d.lon,
      value: Math.min(100, Math.max(0, value)),
      id: segment.id,
    };
  });
}
