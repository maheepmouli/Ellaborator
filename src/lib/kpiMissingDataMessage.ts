import { KPI_READINESS_MATRIX } from "@/data/kpiReadinessMatrix";
import type { PilotDefinition } from "@/data/pilotDefinitions";
import type { DataLabel } from "@/config/kpiDefinitions";
import type { LocalCityDiagnostics } from "@/services/localCityData";

const KPI_SPECIFIC: Record<string, string> = {
  "kpi3.2":
    "No observed environmental dataset available for this pilot. Showing derived proxy from traffic intensity.",
  "kpi4.1":
    "No live GecoAir survey feed — showing pilot-scoped mock satisfaction samples on corridor arms.",
  "kpi4.2":
    "Mock accessibility inventory for this pilot — structured like an audit but not EN 17210 verified. Feature points and reach bands are labelled Mock / demo.",
};

function requiredDatasetHint(city: string, kpiId: string): string {
  if (city === "Helsinki" && kpiId === "kpi1.2") {
    return "Intervention geometry is available; directional observed monitoring links are still being completed.";
  }
  if (city === "Helsinki" && kpiId === "kpi4.2") {
    return "Geometry available, monitoring data pending for accessibility-support evidence.";
  }
  if (city === "Zaragoza" || city === "Trikala") {
    return "Intervention area can be shown, but baseline/post observed datasets are still required.";
  }
  return "Add baseline and post-intervention observed datasets linked to intervention geometry.";
}

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

  if (KPI_SPECIFIC[kpiId] && pilot?.datasetType === "derived") {
    return KPI_SPECIFIC[kpiId];
  }

  const cell = KPI_READINESS_MATRIX.find((c) => c.city === city && c.kpiId === kpiId);
  if (cell?.readiness === "missing") {
    return `No observed dataset linked for ${city} · ${kpiId}. ${requiredDatasetHint(city, kpiId)}`;
  }
  if (cell?.readiness === "partial") {
    return `Partial coverage for this KPI. ${cell.notes}${pilot ? ` (${pilot.name})` : ""}. ${requiredDatasetHint(city, kpiId)}`;
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
