export type GeometryType = "point" | "segment" | "flow" | "polygon" | "hex";
export type DataTypeLabel = "observed" | "derived" | "modelled" | "mock";
export type ScenarioType = "baseline" | "intervention" | "comparison";
export type SpatialQuality = "exact" | "matched" | "inferred";
/** Geometry linkage quality for trust UI (exact sensor → segment join → inferred cluster). */
export type GeometryLinkage = "exact" | "matched" | "inferred" | "unlinked";
export type TemporalCoverage = "single-period" | "before-after" | "multi-year";
export type LocationMethod =
  | "coordinates"
  | "segment_id_join"
  | "street_name_join"
  | "pilot_area_inference"
  | "approximate_cluster";

export interface ModeBreakdown {
  pre: { bike: number; pedestrian: number; motorised: number; ptw: number; total: number };
  post: { bike: number; pedestrian: number; motorised: number; ptw: number; total: number };
}

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
  modeBreakdown?: ModeBreakdown;
  source: string;
  method: string;
  type: DataTypeLabel;
  spatialQuality?: SpatialQuality;
  geometryLinkage?: GeometryLinkage;
  temporalCoverage?: TemporalCoverage;
  locationMethod?: LocationMethod;
  segmentId?: string;
  streetName?: string;
  spatialNote?: string;
  methodologyWarnings?: string[];
  parserStatus?: "ready" | "partial" | "planned";
  datasetKind?: string;
  category?: string;
  likertLabel?: string;
  facilityCategory?: string;
  preCo2GPerHour?: number;
  postCo2GPerHour?: number;
  /** KPI 3.2 — per-direction CO₂ arms for the selected sensor (panel segment map). */
  emissionDirections?: Array<{
    id: string;
    flow: string;
    preCo2GPerHour: number;
    postCo2GPerHour: number;
    baselinePct: number;
    interventionPct: number;
  }>;
  /** LoRa device hex id (Trikala bike-lane sensors). */
  deviceId?: string;
  busyPct?: number;
  availabilityPct?: number;
  observationCount?: number;
  /** Trikala P3 — mock free-flow bike speed (km/h) derived from LoRa occupancy. */
  mockSpeedKmh?: number;
  mockSpeedBaselineKmh?: number;
  /** Helsinki FVH1 — top dangerous-location type counts for observatory charts. */
  hazardCategories?: Array<{ label: string; count: number }>;
  /** Helsinki FVH2 — parking-category counts per observation cluster. */
  parkingCategories?: Array<{ label: string; count: number }>;
  /** Helsinki FVH1 — near-miss / conflict incident mix. */
  conflictCategories?: Array<{ label: string; count: number }>;
  /** Helsinki FVH1 — travel mode mix among conflict reports. */
  conflictModes?: Array<{ label: string; count: number }>;
  /** Helsinki KPI 3.2 — attitude survey positive/negative/neutral shares. */
  climateAttitudeRows?: Array<{ label: string; count: number }>;
  /** Helsinki FVH3 UX — satisfaction % by survey question. */
  uxSatisfactionRows?: Array<{ label: string; count: number }>;
  /** Helsinki FVH3 UX — share who felt the crossing unsafe before the warning system. */
  feltCrossingUnsafeBeforePct?: number | null;
  /** Helsinki FVH3 UX — share who noticed signs / sound / lights. */
  noticedWarningSystemPct?: { signs?: number | null; sound?: number | null; lights?: number | null };
  /** Helsinki Telraam — monthly sustainable-share trend for observatory charts. */
  monthlyTrend?: Array<{ t: string; v: number }>;
}
