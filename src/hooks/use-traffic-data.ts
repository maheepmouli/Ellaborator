import { useQuery } from "@tanstack/react-query";
import {
  loadIssyJunctionTrafficSnapshot,
  loadIssyTrafficNetworkSnapshot,
} from "@/services/issyLocalSnapshots";
import type { TrafficAPIParams } from "@/types/traffic";

/**
 * Hook to fetch traffic data with React Query
 * @deprecated Issy uses bundled snapshots — kept for API compatibility with non-Issy cities.
 */
export function useTrafficData(params: TrafficAPIParams = {}) {
  return useQuery({
    queryKey: ["traffic-data", params],
    queryFn: () => loadIssyTrafficNetworkSnapshot(),
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: false,
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
    queryFn: () => loadIssyTrafficNetworkSnapshot(),
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: false,
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
    queryFn: () => loadIssyJunctionTrafficSnapshot(),
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: false,
  });
}

/**
 * Hook to get latest traffic data for a city (Issy: bundled SharePoint snapshots only).
 */
export function useLatestTrafficData(cityName: string, limit: number = 500) {
  const isIssy = cityName.toLowerCase().includes("issy");

  return useQuery({
    queryKey: ["traffic-data", "latest", cityName, limit, "local-snapshot"],
    queryFn: () => loadIssyTrafficNetworkSnapshot(),
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: isIssy,
  });
}
