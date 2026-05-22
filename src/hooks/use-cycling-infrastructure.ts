import { useQuery } from "@tanstack/react-query";
import {
  fetchCyclingInfrastructureData,
  fetchCyclingInfrastructureDataPaginated,
  type CyclingInfrastructureAPIParams,
} from "@/services/cyclingInfrastructureApi";
import { ISSY_OPENDATA_MAX_LIMIT } from "@/lib/issy-opendata";

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
  limit: number = 515
) {
  const isIssy = cityName.toLowerCase().includes("issy");

  return useQuery({
    queryKey: ["cycling-infrastructure", "latest", cityName, limit],
    queryFn: () => {
      const params = {
        limit: Math.min(limit, ISSY_OPENDATA_MAX_LIMIT),
        offset: 0,
        order_by: "longueur_m desc",
      };
      return limit > ISSY_OPENDATA_MAX_LIMIT
        ? fetchCyclingInfrastructureDataPaginated(params, limit)
        : fetchCyclingInfrastructureData(params);
    },
    enabled: isIssy,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
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
