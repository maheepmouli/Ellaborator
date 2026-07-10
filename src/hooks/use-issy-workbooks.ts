import { useQuery } from "@tanstack/react-query";
import {
  loadIssyClasseurEmissionsSnapshot,
  loadIssyWinticsBaselineSnapshot,
} from "@/services/issyWorkbookSnapshots";

export function useIssyWorkbooks(enabled: boolean = true) {
  const wintics = useQuery({
    queryKey: ["issy-wintics-baseline"],
    queryFn: loadIssyWinticsBaselineSnapshot,
    enabled,
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const classeur = useQuery({
    queryKey: ["issy-classeur-emissions"],
    queryFn: loadIssyClasseurEmissionsSnapshot,
    enabled,
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return { wintics, classeur };
}
