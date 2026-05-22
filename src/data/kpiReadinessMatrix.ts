import { DATASET_REGISTRY, ALL_CITIES } from "./datasetMetadata";
import { ELABORATOR_KPIS } from "./kpiDefinitions";

export type KpiReadiness = "ready" | "partial" | "missing";

export interface KpiReadinessCell {
  city: string;
  kpiId: string;
  readiness: KpiReadiness;
  datasetCount: number;
  notes: string;
}

/**
 * Derive readiness from the dataset registry.
 * ready   = at least one dataset with parserStatus "ready" + realDataStatus "active"
 * partial = at least one dataset linked, but parserStatus "partial" or realDataStatus "fallback"
 * missing = no datasets linked to this city+KPI combination
 */
function deriveReadiness(city: string, kpiId: string): KpiReadinessCell {
  const datasets = DATASET_REGISTRY.filter(
    (d) => d.city === city && d.linkedKpis.includes(kpiId)
  );

  if (datasets.length === 0) {
    return { city, kpiId, readiness: "missing", datasetCount: 0, notes: "No dataset linked" };
  }

  const hasReady = datasets.some(
    (d) => d.parserStatus === "ready" && d.realDataStatus === "active"
  );
  if (hasReady) {
    return {
      city,
      kpiId,
      readiness: "ready",
      datasetCount: datasets.length,
      notes: datasets
        .filter((d) => d.parserStatus === "ready" && d.realDataStatus === "active")
        .map((d) => d.title)
        .join(", "),
    };
  }

  return {
    city,
    kpiId,
    readiness: "partial",
    datasetCount: datasets.length,
    notes: datasets.map((d) => `${d.title} (${d.parserStatus})`).join(", "),
  };
}

export const KPI_READINESS_MATRIX: KpiReadinessCell[] = ALL_CITIES.flatMap((city) =>
  ELABORATOR_KPIS.map((kpi) => deriveReadiness(city, kpi.id))
);

export function getReadinessForCity(city: string): KpiReadinessCell[] {
  return KPI_READINESS_MATRIX.filter((c) => c.city === city);
}

export function getReadinessForKpi(kpiId: string): KpiReadinessCell[] {
  return KPI_READINESS_MATRIX.filter((c) => c.kpiId === kpiId);
}

export function getCityReadinessSummary(city: string): {
  ready: number;
  partial: number;
  missing: number;
  total: number;
} {
  const cells = getReadinessForCity(city);
  return {
    ready: cells.filter((c) => c.readiness === "ready").length,
    partial: cells.filter((c) => c.readiness === "partial").length,
    missing: cells.filter((c) => c.readiness === "missing").length,
    total: cells.length,
  };
}
