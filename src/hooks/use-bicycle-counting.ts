import { useQuery } from "@tanstack/react-query";
import {
  fetchBicycleCountingData,
  fetchBicycleCountingDataPaginated,
  fetchBicycleCountingByDateRange,
  fetchBicycleCountingByCounter,
} from "@/services/bicycleCountingApi";
import { ISSY_OPENDATA_MAX_LIMIT } from "@/lib/issy-opendata";
import type { BicycleCountingAPIParams } from "@/types/bicycle-counting";

/**
 * Hook to fetch bicycle counting data with React Query
 */
export function useBicycleCountingData(params: BicycleCountingAPIParams = {}) {
  return useQuery({
    queryKey: ["bicycle-counting", params],
    queryFn: () => fetchBicycleCountingData(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to fetch bicycle counting data for a date range
 */
export function useBicycleCountingByDateRange(
  startDate: Date,
  endDate: Date,
  params: Omit<BicycleCountingAPIParams, "where"> = {}
) {
  return useQuery({
    queryKey: ["bicycle-counting", "date-range", startDate, endDate, params],
    queryFn: () => fetchBicycleCountingByDateRange(startDate, endDate, params),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: !!startDate && !!endDate,
  });
}

/**
 * Hook to fetch bicycle counting data for a specific counter
 */
export function useBicycleCountingByCounter(
  counterId: string | null,
  params: Omit<BicycleCountingAPIParams, "where"> = {}
) {
  return useQuery({
    queryKey: ["bicycle-counting", "counter", counterId, params],
    queryFn: () => fetchBicycleCountingByCounter(counterId!, params),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: !!counterId,
  });
}

/**
 * Hook to get latest bicycle counting data for a city
 */
export function useLatestBicycleCounting(cityName: string, limit: number = 200) {
  // For Issy-les-Moulineaux, fetch recent data
  const isIssy = cityName.toLowerCase().includes("issy");
  
  return useQuery({
    queryKey: ["bicycle-counting", "latest", cityName, limit],
    queryFn: async () => {
      if (isIssy) {
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        const startISO = startDate.toISOString().split("T")[0];
        const endISO = endDate.toISOString().split("T")[0];
        const where = `date >= date'${startISO}' AND date <= date'${endISO}'`;

        if (limit > ISSY_OPENDATA_MAX_LIMIT) {
          return fetchBicycleCountingDataPaginated(
            { where, order_by: "date" },
            limit
          );
        }
        return fetchBicycleCountingByDateRange(startDate, endDate, { limit });
      }
      // For other cities, return empty (could be extended with other APIs)
      return Promise.resolve({ total_count: 0, results: [] });
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: isIssy,
  });
}
