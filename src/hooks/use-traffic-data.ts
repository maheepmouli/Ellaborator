import { useQuery } from "@tanstack/react-query";
import { fetchTrafficData, fetchTrafficByDateRange, fetchTrafficBySegment } from "@/services/trafficApi";
import type { TrafficAPIParams, TrafficSegment } from "@/types/traffic";

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
export function useLatestTrafficData(cityName: string, limit: number = 100) {
  // For Issy-les-Moulineaux, fetch recent data
  const isIssy = cityName.toLowerCase().includes("issy");
  
  return useQuery({
    queryKey: ["traffic-data", "latest", cityName, limit],
    queryFn: () => {
      if (isIssy) {
        // Get data from last 24 hours
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
        return fetchTrafficByDateRange(startDate, endDate, { limit });
      }
      // For other cities, return empty (could be extended with other APIs)
      return Promise.resolve({ total_count: 0, results: [] });
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: isIssy,
  });
}
