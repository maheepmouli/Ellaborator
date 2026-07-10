import { useQuery } from "@tanstack/react-query";
import { loadIssyCyclingInfrastructureSnapshot } from "@/services/issyLocalSnapshots";
import type { CyclingInfrastructureAPIParams } from "@/types/cycling-infrastructure";

/**
 * Hook to fetch cycling infrastructure data (Issy: bundled snapshot only).
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
      "local-snapshot",
    ],
    queryFn: () => loadIssyCyclingInfrastructureSnapshot(),
    enabled: isIssy,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}

/** Bundled cycling infrastructure snapshot for Issy-les-Moulineaux. */
export function useLatestCyclingInfrastructure(
  cityName: string,
  limit: number = 515
) {
  const isIssy = cityName.toLowerCase().includes("issy");

  return useQuery({
    queryKey: ["cycling-infrastructure", "latest", cityName, limit, "local-snapshot"],
    queryFn: () => loadIssyCyclingInfrastructureSnapshot(),
    enabled: isIssy,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}

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
