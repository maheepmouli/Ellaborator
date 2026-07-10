import { useQuery } from "@tanstack/react-query";
import { loadIssyBicycleCountingSnapshot } from "@/services/issyLocalSnapshots";
import type { BicycleCountingAPIParams } from "@/types/bicycle-counting";

/**
 * Hook to fetch bicycle counting data with React Query
 */
export function useBicycleCountingData(params: BicycleCountingAPIParams = {}) {
  return useQuery({
    queryKey: ["bicycle-counting", params],
    queryFn: () => loadIssyBicycleCountingSnapshot(),
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: false,
  });
}

export function useBicycleCountingByDateRange(
  startDate: Date,
  endDate: Date,
  params: Omit<BicycleCountingAPIParams, "where"> = {}
) {
  return useQuery({
    queryKey: ["bicycle-counting", "date-range", startDate, endDate, params],
    queryFn: () => loadIssyBicycleCountingSnapshot(),
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: false,
  });
}

export function useBicycleCountingByCounter(
  counterId: string | null,
  params: Omit<BicycleCountingAPIParams, "where"> = {}
) {
  return useQuery({
    queryKey: ["bicycle-counting", "counter", counterId, params],
    queryFn: () => loadIssyBicycleCountingSnapshot(),
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: false,
  });
}

/** Issy bicycle counting — bundled SharePoint snapshot only. */
export function useLatestBicycleCounting(cityName: string, limit: number = 200) {
  const isIssy = cityName.toLowerCase().includes("issy");

  return useQuery({
    queryKey: ["bicycle-counting", "latest", cityName, limit, "local-snapshot"],
    queryFn: () => loadIssyBicycleCountingSnapshot(),
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: isIssy,
  });
}
