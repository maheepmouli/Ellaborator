import { useQuery } from "@tanstack/react-query";
import { getIssyFlowFeatures, type IssyDayCategory } from "@/services/issyFlowData";

export function useIssyFlowData(dayCategory: "all" | IssyDayCategory = "all", enabled: boolean = true) {
  return useQuery({
    queryKey: ["issy-flow-data", dayCategory],
    queryFn: () => getIssyFlowFeatures(dayCategory),
    enabled,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
