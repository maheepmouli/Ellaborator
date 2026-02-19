/**
 * Visualization type mapping for KPIs
 * Automatically determines the best visualization style based on KPI type
 */

export type VisualizationType = "segments" | "points" | "areas";

export interface KPIVisualizationConfig {
  kpiId: string;
  type: VisualizationType;
  description: string;
}

/**
 * KPI to Visualization Type Mapping
 * Based on data characteristics:
 * - Segments: Network-based data (roads, traffic flows)
 * - Points: Location-based counts/intensity (sensors, facilities)
 * - Areas: Spatial coverage (accessibility, catchment, impact zones)
 */
export const KPI_VISUALIZATION_MAP: Record<string, VisualizationType> = {
  // Segments (Lines) - Network-based mobility data
  // "kpi3.2": "segments", // CO₂ & Emissions - now using areas for heat map visualization
  
  // Points (Aggregated) - Location-based counts/intensity
  "kpi1.2": "points", // Mode Share - bicycle/traffic counts at sensors
  "kpi3.1": "points", // Green Infrastructure - facility locations
  "kpi4.1": "points", // Satisfaction - survey points
  
  // Areas (Polygons/Grids) - Spatial coverage
  "kpi3.2": "areas", // CO₂ & Emissions - emission zones/heat maps
  "kpi4.2": "areas", // Accessibility - catchment areas/isochrones
  "kpi2.1": "areas", // Safety Stars - area-based safety ratings
};

/**
 * Get visualization type for a KPI
 */
export function getVisualizationType(kpiId: string): VisualizationType {
  return KPI_VISUALIZATION_MAP[kpiId] || "points"; // Default to points
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
