/**
 * Issy KPI derivation copy for Data Catalogue — keep in sync with docs/ISSY_KPI_METHODOLOGY.md
 */
import type { DataType } from "@/data/datasetMetadata";
import { ELABORATOR_KPIS } from "@/data/kpiDefinitions";
import {
  ISSY_JUNCTION_ARM_VISUAL_DISCLAIMER,
  ISSY_JUNCTION_KPI12_ARM_NOTE,
  ISSY_OD_CSV_DISCLAIMER,
  ISSY_OD_DIRECTIONAL_NOTE,
  kpiPrimaryIssySource,
  type IssyDataSourceKind,
} from "@/lib/issyDataTransparency";

export const ISSY_CITY_NAME = "Issy-les-Moulineaux";

export interface IssyKpiMethodologyEntry {
  kpiId: string;
  ref: string;
  name: string;
  dataType: DataType;
  sourceKind: IssyDataSourceKind;
  primaryDatasetIds: string[];
  steps: string[];
  formulas: string;
  limitations: string[];
  codeRefs: string[];
}

function sourceKindToDataType(kind: IssyDataSourceKind): DataType {
  switch (kind) {
    case "od-csv":
    case "traficissy-segment":
    case "bike-api":
    case "infra-api":
      return kind === "traficissy-segment" ? "derived" : "observed";
    case "derived-proxy":
      return "derived";
    case "mock":
      return "mock";
    default:
      return "derived";
  }
}

function kpiMeta(kpiId: string) {
  const def = ELABORATOR_KPIS.find((k) => k.id === kpiId);
  if (!def) throw new Error(`Unknown KPI: ${kpiId}`);
  return def;
}

export const ISSY_KPI_METHODOLOGY: IssyKpiMethodologyEntry[] = [
  {
    ...(() => {
      const { id: kpiId, ref, name } = kpiMeta("kpi1.2");
      const sourceKind = kpiPrimaryIssySource(kpiId);
      return {
        kpiId,
        ref,
        name,
        sourceKind,
        dataType: sourceKindToDataType(sourceKind),
        primaryDatasetIds: [
          "issy-flow-baseline-csv",
          "issy-flow-post-csv",
          "issy-traffic-api",
          "issy-bike-counter-api",
        ],
        steps: [
          "Parse ISSY1 baseline and post-intervention CSV rows (vehicle_category, zone_in, zone_out, hour, day_category, avg_traffic).",
          "Each row is a directional movement: zone_in → zone_out for one vehicle category. The reverse direction is only present if a separate row exists.",
          "Aggregate volumes per (zone_in, zone_out, vehicle_category) pair (optional weekday / weekend filter). Reverse pairs are never inferred.",
          "Map each vehicle_category token to ELABORATOR mode buckets (Pedestrian, Cycle, Public Transport, Private Car, PTW).",
          "Sum flows across all zone pairs per mode for baseline and post periods.",
          "Compute mode share percentages and sustainable share (pedestrian + cycle + public transport).",
          "Compare post vs baseline; report change in percentage points on the KPI card.",
          "Draw one OD arc per CSV row between zone centroids on the map at city / pilot zoom — never split across multiple contextual streets.",
          "The monitored intervention corridor uses traficissy segment context only. No per-street mode share is assigned from the OD CSV.",
        ],
        formulas: `OD roll-up (per period, optional day filter):
  flow(z_in, z_out, cat) = Σ avg_traffic

Mode volume:
  V_m = Σ flow over all zone pairs for mode m

Mode share (%):
  Share_m = 100 × V_m / Σ_all V

Headline — sustainable share:
  S = Share_Pedestrian + Share_Cycle + Share_PublicTransport

Change (percentage points):
  ΔS = S_post − S_baseline

Fallback if CSV fails to load:
  sidebar uses CITY_DATA mock (e.g. 45% headline) — not observed OD.`,
        limitations: [
          "Direction of computation: OD flow data is primary; mode share is derived from OD volumes, not the reverse.",
          ISSY_OD_DIRECTIONAL_NOTE,
          "OD rows represent only the listed zone_in → zone_out directions. Reverse or street-level directions are not inferred.",
          "One OD relation is rendered as one zone-to-zone arc — it is never split across multiple contextual streets.",
          ISSY_OD_CSV_DISCLAIMER,
          ISSY_JUNCTION_KPI12_ARM_NOTE,
          ISSY_JUNCTION_ARM_VISUAL_DISCLAIMER,
        ],
        codeRefs: [
          "src/services/issyFlowData.ts",
          "src/lib/issyFlowAggregates.ts",
          "src/lib/travelModeMapLink.ts",
        ],
      };
    })(),
  },
  {
    ...(() => {
      const { id: kpiId, ref, name } = kpiMeta("kpi2.1");
      const sourceKind = kpiPrimaryIssySource(kpiId);
      return {
        kpiId,
        ref,
        name,
        sourceKind,
        dataType: sourceKindToDataType(sourceKind),
        primaryDatasetIds: ["issy-traffic-api"],
        steps: [
          "Fetch live road segments from the traficissy API (geometry, vitesse_km_h, indice_de_congestion).",
          "For each segment, compute a 0–100 safety pressure score from speed vs a reference speed.",
          "Colour segment polylines with one highlighted monitored intervention corridor and low-opacity contextual streets.",
          "Aggregate monitored-corridor context in the junction observatory study view.",
          "Sidebar star / radar values may still use CITY_DATA demo until official iRAP or crash-based scores are integrated.",
        ],
        formulas: `Per segment (traficissy):
  safetyPressure = max(0, 100 − (vitesse_km_h / 60) × 100)

referenceSpeed = 60 km/h (configurable assumption)

Junction study (illustrative):
  corridorPressure ≈ representative segment pressure on the monitored intervention corridor

Not an official iRAP Star Rating or crash-based safety score.`,
        limitations: [
          "Derived proxy from speed only — not observed crash risk or iRAP methodology.",
          "Headline KPI card may show mock star ratings from CITY_DATA while the map uses the segment proxy.",
          ISSY_JUNCTION_ARM_VISUAL_DISCLAIMER,
        ],
        codeRefs: [
          "src/services/trafficApi.ts (getTrafficKpiValue)",
          "src/lib/issyJunctionAnalytics.ts",
          "src/lib/renderIssyJunctionArms.ts",
        ],
      };
    })(),
  },
  {
    ...(() => {
      const { id: kpiId, ref, name } = kpiMeta("kpi3.1");
      const sourceKind = kpiPrimaryIssySource(kpiId);
      return {
        kpiId,
        ref,
        name,
        sourceKind,
        dataType: sourceKindToDataType(sourceKind),
        primaryDatasetIds: ["issy-cycling-infra-api"],
        steps: [
          "Fetch cycling / zero-emission facility features from the city cycling infrastructure API.",
          "Plot features with exact segment or point geometry on the map.",
          "Count or classify facilities by type for bar-chart breakdown (EV charging, bike parking, hubs, etc.).",
          "Link chart categories to map focus filters when KPI 3.1 is active.",
          "If the API is empty or unavailable, sidebar totals may fall back to CITY_DATA demo counts.",
        ],
        formulas: `Facility count by type (when API loaded):
  N_type = count(features where facility_type = type)

Headline (sidebar):
  mainValue = Σ N_type   (or demo mock if API partial)

Map:
  one point/segment per API feature — observed geometry`,
        limitations: [
          "Observed only where the API returns features; partial coverage shows as reduced counts.",
          "Sidebar headline may use CITY_DATA mock (312 units) when live aggregation is not wired.",
          "Not a full city inventory audit unless the API covers all facility types.",
        ],
        codeRefs: [
          "src/services/cyclingInfrastructureApi.ts",
          "src/hooks/use-cycling-infrastructure.ts",
        ],
      };
    })(),
  },
  {
    ...(() => {
      const { id: kpiId, ref, name } = kpiMeta("kpi3.2");
      const sourceKind = kpiPrimaryIssySource(kpiId);
      return {
        kpiId,
        ref,
        name,
        sourceKind,
        dataType: sourceKindToDataType(sourceKind),
        primaryDatasetIds: ["issy-traffic-api"],
        steps: [
          "Map / segment layer: derive environmental pressure from traficissy congestion index per segment.",
          "Sidebar chart: use CITY_DATA time series (2020–2024) for headline % reduction and year selector.",
          "Hex / influence field: scale visual intensity from selected chart year or headline mainValue.",
          "At junction zoom, segment colouring may multiply pressure by chart-year anchor for visual consistency with the line chart.",
          "Pilot 3 (GecoAir): narrative references citizen air-quality app — no direct GecoAir feed in map layers yet.",
        ],
        formulas: `Segment / map intensity (traficissy):
  environmentalPressure = indice_de_congestion × 100

Chart year anchor (sidebar time series):
  intensity(year) = clamp(timeSeries[year].value, 0, 120)

Hex / polygon base intensity:
  polygonBase = intensity(selectedYear) ?? (100 − mainValue)

Junction visual scaling (when year selected):
  displayedPressure ≈ segmentPressure × (intensity(year) / 100)

Not measured CO₂, PM2.5, or noise unless emissions inventory data is linked.`,
        limitations: [
          "Derived proxy from congestion — not measured emissions or air-quality raster.",
          "Sidebar breakdown (CO₂ kg/day, PM2.5, noise) is demo CITY_DATA unless inventory feeds are integrated.",
          "GecoAir app data is not yet wired into KPI computation.",
        ],
        codeRefs: [
          "src/services/trafficApi.ts",
          "src/lib/kpi32YearIntensity.ts",
          "src/components/HeroMap.tsx",
        ],
      };
    })(),
  },
  {
    ...(() => {
      const { id: kpiId, ref, name } = kpiMeta("kpi4.1");
      const sourceKind = kpiPrimaryIssySource(kpiId);
      return {
        kpiId,
        ref,
        name,
        sourceKind,
        dataType: sourceKindToDataType(sourceKind),
        primaryDatasetIds: [],
        steps: [
          "No Issy satisfaction survey or interview dataset is integrated in the current build.",
          "Sidebar gauge and breakdown use static CITY_DATA demo values for storytelling.",
          "Map sentiment field (if shown) is illustrative — not linked to observed survey responses.",
        ],
        formulas: `N/A — placeholder until survey dataset is linked.

Demo sidebar (CITY_DATA):
  mainValue = % satisfied (e.g. 82%)
  breakdown = Physical Accessibility, Safety & Security, General Satisfaction`,
        limitations: [
          "Mock / demo only — do not cite as observed citizen satisfaction for Issy.",
          "Replace with stratified survey or app ratings when data is delivered.",
        ],
        codeRefs: ["src/data/kpiDefinitions.ts (CITY_DATA Issy block)"],
      };
    })(),
  },
  {
    ...(() => {
      const { id: kpiId, ref, name } = kpiMeta("kpi4.2");
      const sourceKind = kpiPrimaryIssySource(kpiId);
      return {
        kpiId,
        ref,
        name,
        sourceKind,
        dataType: sourceKindToDataType(sourceKind),
        primaryDatasetIds: [],
        steps: [
          "No Issy-specific accessibility audit workbook (unlike Milan SharePoint KPI 4.2 sheet).",
          "Map may show inferred accessibility / reach layers from facility proximity where configured.",
          "Sidebar feature counts and change figures use CITY_DATA demo until audit geometry is linked.",
        ],
        formulas: `N/A — no Issy audit file in current integration.

Demo sidebar (CITY_DATA):
  mainValue = total accessibility features (e.g. 124)
  breakdown = Ramps, Tactile Paving, Audio Signals, Rest Areas

Map (when enabled):
  derived reach / facility proximity — not EN 17210 field audit`,
        limitations: [
          "Derived / demo — not an official EN 17210 or WCAG accessibility audit for Issy.",
          "Milan uses observed workbook percentages; Issy does not yet have an equivalent feed.",
        ],
        codeRefs: [
          "src/data/kpiDefinitions.ts",
          "src/lib/spatialLayerRegistry.ts",
        ],
      };
    })(),
  },
];

export function getIssyKpiMethodology(kpiId: string): IssyKpiMethodologyEntry | undefined {
  return ISSY_KPI_METHODOLOGY.find((e) => e.kpiId === kpiId);
}
