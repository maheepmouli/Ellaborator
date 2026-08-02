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
  | "surveyPie"
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
  /** Optional compass bearing (0 = north) for schematic arm placement. */
  bearingDeg?: number;
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
  /** KPI 4.1 — Likert 1–7 share pies (before/after) */
  surveyDistribution?: {
    before: Array<{ label: string; value: number; score?: number }>;
    after: Array<{ label: string; value: number; score?: number }>;
  };
  statCards?: Array<{ label: string; value: string; note?: string; color?: string; icon?: string }>;
  markers?: Array<{ id: string; x: number; y: number; label?: string; tone?: string; count?: number }>;
  segmentGradient?: number;
  /** Milan KPI 2.1 — render AMAT Maggio speed cards instead of generic speed proxy / congestion */
  amatSegmentSpeed?: boolean;
  /** Milan KPI 2.1 header diagram — observed speeds vs limit (also Zaragoza safety/speed). */
  speedDiagram?: {
    avgKmh: number;
    p85Kmh?: number;
    limitKmh?: number;
    baselineKmh?: number;
    interventionKmh?: number;
    streetName?: string;
    /** Defaults to "AMAT segment speed" */
    title?: string;
    /** Defaults to "km/h" */
    unitLabel?: string;
    caption?: string;
  };
  streetNS?: string;
  streetEW?: string;
  highlightArmId?: string;
  /** Mode / dimension row to highlight (e.g. map pin hover → chart row). */
  highlightedMode?: string | null;
  pilotTitle?: string;
  /** Compass bearing (0 = north) for camera FOV wedge in corridor schematic */
  cameraBearingDeg?: number;
  /** KPI 3.2 — directional emissions arms for sensor segment map in panel */
  emissionDirections?: Array<{
    id: string;
    flow: string;
    preCo2GPerHour: number;
    postCo2GPerHour: number;
    baselinePct: number;
    interventionPct: number;
  }>;
}

export type ObservatoryGraphicMatrix = Record<
  ObservatoryType,
  Partial<Record<KPIFrameworkId, ObservatoryGraphicId>>
>;
