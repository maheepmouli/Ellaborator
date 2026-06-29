import type { ObservatoryType } from "@/data/cityPilotProfiles";
import type { KPIFrameworkId } from "@/config/kpiFramework";
import type { ObservatoryDataClass } from "@/lib/observatoryCityContent";

export type ObservatoryGraphicZone = "header" | "overview" | "beforeAfter" | "kpiAnalysis";

export type ObservatorySchematicId =
  | "junctionSchematic"
  | "cameraCorridorSchematic"
  | "streetSegmentSchematic"
  | "interventionPointsSchematic"
  | "areaPolygonSchematic";

export type ObservatoryChartId =
  | "modeShareBars"
  | "junctionPressure"
  | "facilityInventory"
  | "climateField"
  | "sentimentGauge"
  | "accessibilityBars"
  | "directionModeBreakdown"
  | "flowPressure"
  | "motorIntensity"
  | "telraamModeBars"
  | "safetyDensity"
  | "envProxy"
  | "surveyLikert"
  | "accessLikert"
  | "segmentModeShare"
  | "speedProfile"
  | "facilityStrip"
  | "reteBand"
  | "sentiment"
  | "dssBars"
  | "manualCountBars"
  | "motorPressure"
  | "proxyDelta"
  | "likertRadar"
  | "directionBreakdown"
  | "prePostTrend";

export type ObservatoryGraphicId = ObservatorySchematicId | ObservatoryChartId;

export type ObservatoryGraphicVariant = "compact" | "expanded" | "directional" | "gradient";

export interface ObservatoryGraphicSpec {
  graphicId: ObservatoryGraphicId;
  kind: "schematic" | "chart";
  variant?: ObservatoryGraphicVariant;
  emptyState?: string;
  caption?: string;
}

export interface ObservatoryGraphicMeta {
  dataClass: ObservatoryDataClass;
  sourceLabel: string;
}

export interface ModeShareRow {
  mode: string;
  before: number;
  after: number;
  color?: string;
}

export interface TrendPoint {
  t: string;
  v: number;
}

export interface CameraDirectionRow {
  id: string;
  site: string;
  direction: string;
  baselinePct: number;
  interventionPct: number;
  delta: number;
  source: string;
  trend: TrendPoint[];
}

export interface LikertRow {
  label: string;
  value: number;
}

export interface ObservatoryGraphicPayload extends ObservatoryGraphicMeta {
  spec: ObservatoryGraphicSpec;
  zone: ObservatoryGraphicZone;
  kpiId: string;
  observatoryType: ObservatoryType;
  /** Junction / registry view for corridor and mock fallbacks */
  kpiValue?: number;
  modeShare?: ModeShareRow[];
  trend?: TrendPoint[];
  cameraDirections?: CameraDirectionRow[];
  activeDirectionId?: string | null;
  likert?: LikertRow[];
  statCards?: Array<{ label: string; value: string; note?: string; color?: string }>;
  markers?: Array<{ id: string; x: number; y: number; label?: string }>;
  segmentGradient?: number;
  streetNS?: string;
  streetEW?: string;
  highlightArmId?: string;
  pilotTitle?: string;
}

export type ObservatoryGraphicMatrix = Record<
  ObservatoryType,
  Partial<Record<KPIFrameworkId, ObservatoryGraphicId>>
>;
