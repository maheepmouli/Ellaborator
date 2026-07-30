import type { PilotDefinition } from "@/data/pilotDefinitions";
import type { DataLabel } from "@/config/kpiDefinitions";
import type { LocalCityDiagnostics } from "@/services/localCityData";
import { isIssyCity } from "@/lib/issyMapRouting";

const KPI_SPECIFIC: Record<string, string> = {
  "kpi3.2":
    "No observed environmental dataset available for this pilot. Showing derived proxy from traffic intensity.",
  "kpi4.1":
    "No live GecoAir survey feed — showing pilot-scoped mock satisfaction samples on corridor arms.",
};

export function getKpiMissingDataNotice(
  city: string,
  kpiId: string,
  pilot?: PilotDefinition | null,
  diagnostics?: LocalCityDiagnostics | null
): string | null {
  if (diagnostics?.reason === "files-unavailable") {
    return "Observed source files are unavailable for this configuration. Map may use bundled JSON fallback.";
  }
  if (diagnostics?.reason === "no-records") {
    return "No records were parsed for this city, pilot, and KPI selection.";
  }
  if (diagnostics?.message?.toLowerCase().includes("bundled json fallback")) {
    return "SharePoint xlsx files were unavailable — using bundled JSON fallback counts.";
  }

  if (city === "Copenhagen" && kpiId === "kpi4.2") {
    return "No bicycle-parking inventory linked for this pilot — map shows intervention context only.";
  }

  if (city === "Trikala" && kpiId === "kpi4.1" && pilot?.id === "tri-p2") {
    return "No Park & Ride user-satisfaction survey linked — left-panel figure is mock placeholder only.";
  }

  if (city === "Milan" && kpiId === "kpi3.1") {
    return "Illustrative zero-emission facility inventory (mock) — not a certified AMAT asset audit.";
  }

  // Issy has city climate (ASIF Classeur / city reading) — do not claim missing env data.
  if (isIssyCity(city) && kpiId === "kpi3.2") {
    return null;
  }

  if (KPI_SPECIFIC[kpiId] && pilot?.datasetType === "derived") {
    return KPI_SPECIFIC[kpiId];
  }

  if (kpiId === "kpi3.2" && pilot?.datasetType === "derived") {
    return KPI_SPECIFIC["kpi3.2"];
  }

  return null;
}

export function formatConfidenceLine(
  dataLabel: DataLabel | string,
  confidence?: string,
  sourceHint?: string
): string {
  const parts = [dataLabel];
  if (sourceHint) parts.push(sourceHint);
  if (confidence) parts.push(`${confidence} confidence`);
  return parts.join(" · ");
}
