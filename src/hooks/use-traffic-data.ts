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
export function useLatestTrafficData(cityName: string, limit: number = 500) {
  // For Issy-les-Moulineaux, fetch recent data
  const isIssy = cityName.toLowerCase().includes("issy");
  
  return useQuery({
    queryKey: ["traffic-data", "latest", cityName, limit],
    queryFn: async () => {
      if (isIssy) {
        // First try to fetch latest data without date filtering to ensure we get results
        // The API should return the most recent records by default
        try {
          const data = await fetchTrafficData({ 
            limit
            // Don't specify order_by - let API return default order (usually latest first)
          });
          
          // If we got results, return them
          if (data.results && data.results.length > 0) {
            console.log(`[useLatestTrafficData] Fetched ${data.results.length} traffic segments`);
            return data;
          }
          
          // If no results, try with date range (last 30 days)
          console.log(`[useLatestTrafficData] No results without date filter, trying date range...`);
          const endDate = new Date();
          const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000); // Last 30 days
          const dateRangeData = await fetchTrafficByDateRange(startDate, endDate, { limit });
          
          if (dateRangeData.results && dateRangeData.results.length > 0) {
            console.log(`[useLatestTrafficData] Fetched ${dateRangeData.results.length} traffic segments from date range`);
            return dateRangeData;
          }
          
          // If still no results, return empty
          console.warn(`[useLatestTrafficData] No traffic data found for ${cityName}`);
          return { total_count: 0, results: [] };
        } catch (error) {
          console.error(`[useLatestTrafficData] Error fetching traffic data:`, error);
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
