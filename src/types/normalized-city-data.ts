export type GeometryType = "point" | "segment" | "flow" | "polygon" | "hex";
export type DataTypeLabel = "observed" | "derived" | "modelled" | "mock";
export type ScenarioType = "baseline" | "intervention" | "comparison";
export type SpatialQuality = "exact" | "matched" | "inferred";
export type TemporalCoverage = "single-period" | "before-after" | "multi-year";
export type LocationMethod =
  | "coordinates"
  | "segment_id_join"
  | "street_name_join"
  | "pilot_area_inference"
  | "approximate_cluster";

export interface NormalizedCityRecord {
  id: string;
  city: string;
  cityId: string;
  interventionId: string;
  kpiId: string;
  sourceFile: string;
  geometryType: GeometryType;
  lat?: number;
  lng?: number;
  geometry?: [number, number][];
  timestamp?: string;
  value: number;
  baselineValue?: number;
  interventionValue?: number;
  comparisonValue?: number;
  mode?: string;
  source: string;
  method: string;
  type: DataTypeLabel;
  spatialQuality?: SpatialQuality;
  temporalCoverage?: TemporalCoverage;
  locationMethod?: LocationMethod;
  segmentId?: string;
  streetName?: string;
  spatialNote?: string;
  parserStatus?: "ready" | "partial" | "planned";
}
