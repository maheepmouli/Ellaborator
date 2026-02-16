import { useQuery } from "@tanstack/react-query";
import {
  fetchCyclingInfrastructureData,
  type CyclingInfrastructureAPIParams,
} from "@/services/cyclingInfrastructureApi";
import { CYCLING_INFRASTRUCTURE_API_CONFIG } from "@/lib/api-config";

/**
 * Hook to fetch cycling infrastructure data
 */
export function useCyclingInfrastructureData(
  cityName: string,
  params: CyclingInfrastructureAPIParams = {}
) {
  const isIssy = cityName.toLowerCase().includes("issy");

  return useQuery({
    queryKey: [
      "cycling-infrastructure",
      cityName,
      params.limit,
      params.offset,
      params.where,
      params.refine,
    ],
    queryFn: () => fetchCyclingInfrastructureData(params),
    enabled: isIssy, // Only fetch for Issy-les-Moulineaux
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
  });
}

/**
 * Hook to fetch latest cycling infrastructure data (all records)
 */
export function useLatestCyclingInfrastructure(
  cityName: string,
  limit: number = CYCLING_INFRASTRUCTURE_API_CONFIG.defaultLimit
) {
  return useCyclingInfrastructureData(cityName, {
    limit,
    offset: 0,
    order_by: "longueur_m desc", // Order by length descending
  });
}

/**
 * Hook to fetch cycling infrastructure by type
 */
export function useCyclingInfrastructureByType(
  cityName: string,
  type: string,
  limit: number = 200
) {
  return useCyclingInfrastructureData(cityName, {
    limit,
    offset: 0,
    refine: {
      type_amgt_cycl: type,
    },
  });
}

/**
 * Hook to fetch cycling infrastructure by location
 */
export function useCyclingInfrastructureByLocation(
  cityName: string,
  location: string,
  limit: number = 100
) {
  return useCyclingInfrastructureData(cityName, {
    limit,
    offset: 0,
    where: `localisation LIKE "%${location}%"`,
  });
}
