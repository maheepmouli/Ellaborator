import type { BicycleCountingAPIResponse, BicycleCountingAPIParams } from "@/types/bicycle-counting";
import { getBicycleCountingApiUrl } from "@/lib/api-config";
import {
  clampOpendataLimit,
  fetchOpendataPaginated,
} from "@/lib/issy-opendata";
import type { MapSegment } from "./trafficApi";

/**
 * Fetches bicycle counting data from the Issy-les-Moulineaux bicycle counting API
 */
export async function fetchBicycleCountingData(
  params: BicycleCountingAPIParams = {}
): Promise<BicycleCountingAPIResponse> {
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

  const url = `${getBicycleCountingApiUrl()}?${searchParams.toString()}`;

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
    
    const data: BicycleCountingAPIResponse = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching bicycle counting data from:", url, error);
    // Return empty response instead of throwing to allow fallback to synthetic data
    return { total_count: 0, results: [] };
  }
}

export async function fetchBicycleCountingDataPaginated(
  params: BicycleCountingAPIParams = {},
  desiredLimit: number = 100
): Promise<BicycleCountingAPIResponse> {
  const { limit: _ignored, offset: _offsetIgnored, ...rest } = params;
  return fetchOpendataPaginated(
    (limit, offset) => fetchBicycleCountingData({ ...rest, limit, offset }),
    desiredLimit
  );
}

/**
 * Fetches bicycle counting data for a specific date range
 */
export async function fetchBicycleCountingByDateRange(
  startDate: Date,
  endDate: Date,
  params: Omit<BicycleCountingAPIParams, "where"> = {}
): Promise<BicycleCountingAPIResponse> {
  const startISO = startDate.toISOString().split('T')[0];
  const endISO = endDate.toISOString().split('T')[0];
  const where = `date >= date'${startISO}' AND date <= date'${endISO}'`;

  return fetchBicycleCountingData({
    ...params,
    where,
    order_by: "date",
  });
}

/**
 * Fetches bicycle counting data for a specific counter
 */
export async function fetchBicycleCountingByCounter(
  counterId: string,
  params: Omit<BicycleCountingAPIParams, "where"> = {}
): Promise<BicycleCountingAPIResponse> {
  const where = `id = "${counterId}"`;
  return fetchBicycleCountingData({
    ...params,
    where,
  });
}

/**
 * Converts bicycle counting records to map segments (polylines)
 * Creates segments by connecting nearby counters or creating route segments
 */
export function bicycleCountingToSegments(
  records: BicycleCountingRecord[],
  kpiId: string
): MapSegment[] {
  if (records.length === 0) return [];

  // Group records by counter location to aggregate counts
  const counterMap = new Map<string, { record: BicycleCountingRecord; totalCount: number }>();
  
  records.forEach((record) => {
    const key = record.id_compteur || record.id;
    const existing = counterMap.get(key);
    if (existing) {
      existing.totalCount += record.sum_counts;
    } else {
      counterMap.set(key, { record, totalCount: record.sum_counts });
    }
  });

  const counters = Array.from(counterMap.values());
  
  // Create segments by connecting nearby counters (within ~500m)
  const segments: MapSegment[] = [];
  const processed = new Set<string>();

  for (let i = 0; i < counters.length; i++) {
    const counter1 = counters[i];
    const key1 = counter1.record.id_compteur || counter1.record.id;
    
    if (processed.has(key1)) continue;

    // Find nearest counter
    let nearest: typeof counter1 | null = null;
    let minDistance = Infinity;

    for (let j = i + 1; j < counters.length; j++) {
      const counter2 = counters[j];
      const key2 = counter2.record.id_compteur || counter2.record.id;
      
      if (processed.has(key2)) continue;

      // Calculate distance (Haversine formula simplified)
      const lat1 = counter1.record.coordinates.lat;
      const lon1 = counter1.record.coordinates.lon;
      const lat2 = counter2.record.coordinates.lat;
      const lon2 = counter2.record.coordinates.lon;
      
      const R = 6371000; // Earth radius in meters
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;

      if (distance < 500 && distance < minDistance) {
        minDistance = distance;
        nearest = counter2;
      }
    }

    // Create segment
    let value = 0;
    switch (kpiId) {
      case "kpi1.2": // Mode Share - use bicycle counts directly
        value = Math.min(100, (counter1.totalCount / 10) * 100);
        break;
      default:
        value = Math.min(100, (counter1.totalCount / 10) * 100);
    }

    if (nearest) {
      // Create segment between two counters
      segments.push({
        id: `${key1}-${nearest.record.id_compteur || nearest.record.id}`,
        coordinates: [
          [counter1.record.coordinates.lat, counter1.record.coordinates.lon],
          [nearest.record.coordinates.lat, nearest.record.coordinates.lon],
        ],
        value: Math.max(value, Math.min(100, (nearest.totalCount / 10) * 100)),
        properties: {
          counter1: counter1.record.name,
          counter2: nearest.record.name,
          totalCount: counter1.totalCount + nearest.totalCount,
        },
      });
      processed.add(key1);
      processed.add(nearest.record.id_compteur || nearest.record.id);
    } else {
      // Create a small segment around the counter (representing the route)
      const offset = 0.001; // ~100m
      segments.push({
        id: key1,
        coordinates: [
          [counter1.record.coordinates.lat - offset, counter1.record.coordinates.lon - offset],
          [counter1.record.coordinates.lat + offset, counter1.record.coordinates.lon + offset],
        ],
        value,
        properties: {
          counter: counter1.record.name,
          totalCount: counter1.totalCount,
        },
      });
      processed.add(key1);
    }
  }

  return segments;
}

/**
 * Legacy function for backward compatibility - converts to points
 * @deprecated Use bicycleCountingToSegments instead
 */
export function bicycleCountingToHexbin(
  records: BicycleCountingRecord[],
  kpiId: string
): Array<{ lat: number; lon: number; value: number; id: string }> {
  return records.map((record) => {
    let value = 0;
    switch (kpiId) {
      case "kpi1.2":
        value = Math.min(100, (record.sum_counts / 10) * 100);
        break;
      default:
        value = Math.min(100, (record.sum_counts / 10) * 100);
    }
    return {
      lat: record.coordinates.lat,
      lon: record.coordinates.lon,
      value: Math.min(100, Math.max(0, value)),
      id: record.id_compteur || record.id,
    };
  });
}

/**
 * Aggregates bicycle counting data by date for time series
 */
export function aggregateBicycleCountsByDate(
  records: BicycleCountingRecord[]
): Array<{ date: string; total: number; count: number }> {
  const aggregated = new Map<string, { total: number; count: number }>();
  
  records.forEach((record) => {
    const dateKey = record.date.split('T')[0]; // Get just the date part
    const existing = aggregated.get(dateKey) || { total: 0, count: 0 };
    aggregated.set(dateKey, {
      total: existing.total + record.sum_counts,
      count: existing.count + 1,
    });
  });
  
  return Array.from(aggregated.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
