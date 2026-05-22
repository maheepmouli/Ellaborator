import { useQuery } from "@tanstack/react-query";
import {
  loadMilanEnvironmentSegments,
  loadMilanSpeedSegments,
  type MilanSegmentDataset,
} from "@/services/milanSegmentData";

export function useMilanSpeedSegments(
  pilotId: "mil-p1" | "mil-p2" | "mil-p3",
  enabled: boolean
) {
  return useQuery<MilanSegmentDataset>({
    queryKey: ["milan-speed-segments", pilotId],
    queryFn: () => loadMilanSpeedSegments(pilotId),
    enabled,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useMilanEnvironmentSegments(
  window: "08-09" | "18-19",
  enabled: boolean,
  pilotId?: "mil-p1" | "mil-p2" | "mil-p3" | null
) {
  return useQuery<MilanSegmentDataset>({
    queryKey: ["milan-environment-segments", window, pilotId || "city"],
    queryFn: () => loadMilanEnvironmentSegments(window, pilotId),
    enabled,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
