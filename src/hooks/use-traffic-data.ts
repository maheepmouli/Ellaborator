import { useQuery } from "@tanstack/react-query";
import {
  fetchIssyJunctionTraffic,
  fetchTrafficData,
  fetchTrafficByDateRange,
  fetchTrafficBySegment,
} from "@/services/trafficApi";
import { filterTrafficToJunction } from "@/lib/issyPilot2Junction";
import type { TrafficAPIParams, TrafficSegment } from "@/types/traffic";

function filterIssyTrafficResponse(data: { total_count: number; results: TrafficSegment[] }) {
  const results = filterTrafficToJunction(data.results ?? []);
  return { total_count: results.length, results };
}

/**
 * Hook to fetch traffic data with React Query
 */
export function useTrafficData(params: TrafficAPIParams = {}) {
  return useQuery({
    queryKey: ["traffic-data", params],
    queryFn: () => fetchTrafficData(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to fetch traffic data for a date range
 */
export function useTrafficByDateRange(
  startDate: Date,
  endDate: Date,
  params: Omit<TrafficAPIParams, "where"> = {}
) {
  return useQuery({
    queryKey: ["traffic-data", "date-range", startDate, endDate, params],
    queryFn: () => fetchTrafficByDateRange(startDate, endDate, params),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: !!startDate && !!endDate,
  });
}

/**
 * Hook to fetch traffic data for a specific segment
 */
export function useTrafficBySegment(
  segmentId: string | null,
  params: Omit<TrafficAPIParams, "where"> = {}
) {
  return useQuery({
    queryKey: ["traffic-data", "segment", segmentId, params],
    queryFn: () => fetchTrafficBySegment(segmentId!, params),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: !!segmentId,
  });
}

/**
 * Hook to get latest traffic data for a city
 */
export function useLatestTrafficData(cityName: string, limit: number = 500) {
  // For Issy-les-Moulineaux, fetch recent data
  const isIssy = cityName.toLowerCase().includes("issy");
  
  return useQuery({
    queryKey: ["traffic-data", "latest", cityName, limit],
    queryFn: async () => {
      if (isIssy) {
        try {
          const junction = await fetchIssyJunctionTraffic();
          if (junction.results.length > 0) {
            return junction;
          }
          return { total_count: 0, results: [] };
        } catch {
          return { total_count: 0, results: [] };
        }
      }
      // For other cities, return empty (could be extended with other APIs)
      return Promise.resolve({ total_count: 0, results: [] });
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: isIssy,
  });
}
