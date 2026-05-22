import { KPI_READINESS_MATRIX } from "@/data/kpiReadinessMatrix";
import type { PilotDefinition } from "@/data/pilotDefinitions";
import type { DataLabel } from "@/config/kpiDefinitions";

const KPI_SPECIFIC: Record<string, string> = {
  "kpi3.2":
    "No observed environmental dataset available for this pilot. Showing derived proxy from traffic intensity.",
  "kpi4.1": "No live satisfaction survey feed for this view. Showing modelled perception samples.",
  "kpi4.2": "Accessibility geometry is partial for this city. Reach bands use inferred facility points where needed.",
};

export function getKpiMissingDataNotice(
  city: string,
  kpiId: string,
  pilot?: PilotDefinition | null
): string | null {
  if (KPI_SPECIFIC[kpiId] && pilot?.datasetType === "derived") {
    return KPI_SPECIFIC[kpiId];
  }

  const cell = KPI_READINESS_MATRIX.find((c) => c.city === city && c.kpiId === kpiId);
  if (cell?.readiness === "missing") {
    return `No observed dataset linked for ${city} · ${kpiId}. ${cell.notes}`;
  }
  if (cell?.readiness === "partial") {
    return `Partial coverage for this KPI. ${cell.notes}${pilot ? ` (${pilot.name})` : ""}`;
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
