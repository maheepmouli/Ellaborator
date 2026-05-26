import { isIssyStudyPilot } from "@/lib/issyPilot2Junction";
import { isIssyCity } from "@/lib/issyMapRouting";

/** Whether the segment intelligence panel can open for this city/pilot/KPI combo. */
export function canOpenObservatory(
  city: string,
  pilotId: string | null | undefined,
  kpiId: string
): boolean {
  if (
    isIssyCity(city) &&
    isIssyStudyPilot(pilotId) &&
    ["kpi1.2", "kpi2.1", "kpi3.1", "kpi3.2", "kpi4.1", "kpi4.2"].includes(kpiId)
  ) {
    return true;
  }
  if (city === "Milan" && kpiId === "kpi2.1") {
    return true;
  }
  if (
    city === "Copenhagen" &&
    ["kpi1.2"].includes(kpiId)
  ) {
    return true;
  }
  return false;
}
