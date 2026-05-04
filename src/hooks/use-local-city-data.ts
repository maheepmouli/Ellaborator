import { useQuery } from "@tanstack/react-query";
import { loadLocalCityPoints, type LocalCityPoint } from "@/services/localCityData";
import type { ScenarioType } from "@/types/normalized-city-data";

export function useLocalCityData(
  cityName: string,
  kpiId: string,
  cityCenter: { lat: number; lon: number } | null,
  selectedPilotId?: string | null,
  scenario: ScenarioType = "intervention"
) {
  return useQuery<LocalCityPoint[]>({
    queryKey: ["local-city-data", cityName, kpiId, cityCenter?.lat, cityCenter?.lon, selectedPilotId, scenario],
    queryFn: async () => {
      if (!cityCenter) return [];
      return loadLocalCityPoints(cityName, kpiId, cityCenter, selectedPilotId, scenario);
    },
    enabled: !!cityName && !!kpiId && !!cityCenter,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
