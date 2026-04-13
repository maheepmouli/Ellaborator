/**
 * Visualization type mapping for KPIs
 * Automatically determines the best visualization style based on KPI type
 */

import { getKpiFrameworkConfig } from "@/config/kpiFramework";

export type VisualizationType = "segments" | "points" | "areas";

export interface KPIVisualizationConfig {
  kpiId: string;
  type: VisualizationType;
  description: string;
}

/**
 * Get visualization type for a KPI
 */
export function getVisualizationType(kpiId: string): VisualizationType {
  // Source of truth lives in the KPI framework config.
  return (getKpiFrameworkConfig(kpiId)?.visualizationType as VisualizationType) || "points";
}

/**
 * Check if KPI should use segments
 */
export function isSegmentVisualization(kpiId: string): boolean {
  return getVisualizationType(kpiId) === "segments";
}

/**
 * Check if KPI should use points
 */
export function isPointVisualization(kpiId: string): boolean {
  return getVisualizationType(kpiId) === "points";
}

/**
 * Check if KPI should use areas
 */
export function isAreaVisualization(kpiId: string): boolean {
  return getVisualizationType(kpiId) === "areas";
}
