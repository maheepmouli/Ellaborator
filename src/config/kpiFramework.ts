// Kept local to avoid circular dependency with `src/lib/visualization-types.ts`
export type VisualizationType = "segments" | "points" | "areas";

export type MapGeometryHint = VisualizationType | "hexagons" | "grid";

export type KPIFrameworkId =
  | "kpi1.2"
  | "kpi2.1"
  | "kpi3.1"
  | "kpi3.2"
  | "kpi4.1"
  | "kpi4.2";

export type KPIMetadataFieldId = "dataSource" | "collectionPeriod" | "method" | "status";

export type KPISummaryFieldId =
  // KPI 1.2
  | "sustainableModesShare"
  | "changeFromBaseline"
  | "countsByMode"
  // KPI 2.1
  | "meanSpeed"
  | "p85Speed"
  | "congestionIndex"
  | "safetyRating"
  // KPI 3.1
  | "installedFacilitiesTotal"
  | "facilityCategories"
  | "deploymentStatus"
  // KPI 3.2
  | "co2Change"
  | "estimateType"
  | "environmentalBreakdown"
  // KPI 4.1
  | "shareSatisfied"
  | "sampleSize"
  | "engagementMethod"
  // KPI 4.2
  | "accessibilityFeaturesTotal"
  | "accessibilityFeatureCategories"
  | "locationCoverage";

export interface KPIFrameworkConfig {
  id: KPIFrameworkId;
  displayName: string;
  description: string;
  question: string;
  supportedMapGeometry: MapGeometryHint[];
  visualizationType: VisualizationType;
  summaryFields: Array<{ id: KPISummaryFieldId; label: string }>;
  metadataFields: Array<{ id: KPIMetadataFieldId; label: string }>;
  isModelled?: boolean;
  isMock?: boolean;
}

export const KPI_FRAMEWORK: Record<KPIFrameworkId, KPIFrameworkConfig> = {
  "kpi1.2": {
    id: "kpi1.2",
    displayName: "Mobility Mode Share",
    description:
      "Observed mode share and usage based on counts or equivalent city-provided data, before and after intervention.",
    question: "How has the share of sustainable transport modes changed?",
    supportedMapGeometry: ["points", "grid", "areas"],
    visualizationType: "points",
    summaryFields: [
      { id: "sustainableModesShare", label: "Share of sustainable modes" },
      { id: "changeFromBaseline", label: "Change from baseline" },
      { id: "countsByMode", label: "Counts / shares by mode" },
    ],
    metadataFields: [
      { id: "dataSource", label: "Data source" },
      { id: "collectionPeriod", label: "Collection period" },
      { id: "method", label: "Method" },
      { id: "status", label: "Status" },
    ],
    isMock: true,
  },
  "kpi2.1": {
    id: "kpi2.1",
    displayName: "Road User Safety",
    description:
      "Safety indicators derived from speeds, flows, conflict analysis, and perceived safety (not primarily crash data).",
    question: "How safe are the streets for different road users?",
    supportedMapGeometry: ["segments", "points", "areas"],
    visualizationType: "areas",
    summaryFields: [
      { id: "meanSpeed", label: "Mean speed" },
      { id: "p85Speed", label: "85th percentile speed" },
      { id: "congestionIndex", label: "Traffic Congestion Index" },
      { id: "safetyRating", label: "Road User Safety Rating" },
    ],
    metadataFields: [
      { id: "dataSource", label: "Data source" },
      { id: "collectionPeriod", label: "Collection period" },
      { id: "method", label: "Method" },
      { id: "status", label: "Status" },
    ],
    isMock: true,
  },
  "kpi3.1": {
    id: "kpi3.1",
    displayName: "Zero-Emission Facilities and Services",
    description:
      "Inventory of deployed facilities and services supporting zero-emission modes (e.g., EV charging, bike racks, mobility hubs, pedestrian-priority zones).",
    question: "How many zero-emission facilities have been deployed?",
    supportedMapGeometry: ["points", "areas"],
    visualizationType: "points",
    summaryFields: [
      { id: "installedFacilitiesTotal", label: "Installed facilities" },
      { id: "facilityCategories", label: "Facility categories" },
      { id: "deploymentStatus", label: "Deployment status" },
    ],
    metadataFields: [
      { id: "dataSource", label: "Data source" },
      { id: "collectionPeriod", label: "Collection period" },
      { id: "method", label: "Method" },
      { id: "status", label: "Status" },
    ],
    isMock: true,
  },
  "kpi3.2": {
    id: "kpi3.2",
    displayName: "Climate and Environmental Impact",
    description:
      "Measured or modelled environmental indicators (CO₂, air/noise proxies, heat mitigation). CO₂ should be reported as kg CO₂ per day when possible.",
    question: "How much have emissions reduced since interventions?",
    supportedMapGeometry: ["hexagons", "segments", "areas"],
    visualizationType: "areas",
    summaryFields: [
      { id: "co2Change", label: "Estimated change in CO₂ emissions" },
      { id: "estimateType", label: "Estimate type" },
      { id: "environmentalBreakdown", label: "Environmental indicators" },
    ],
    metadataFields: [
      { id: "dataSource", label: "Data source" },
      { id: "collectionPeriod", label: "Collection period" },
      { id: "method", label: "Method" },
      { id: "status", label: "Status" },
    ],
    isModelled: true,
    isMock: true,
  },
  "kpi4.1": {
    id: "kpi4.1",
    displayName: "User Satisfaction",
    description:
      "Perception-based KPI reported as share of respondents satisfied, with method and sample size.",
    question: "How satisfied are users with the mobility interventions?",
    supportedMapGeometry: ["points"],
    visualizationType: "points",
    summaryFields: [
      { id: "shareSatisfied", label: "Share of respondents satisfied" },
      { id: "sampleSize", label: "Sample size" },
      { id: "engagementMethod", label: "Engagement method" },
    ],
    metadataFields: [
      { id: "dataSource", label: "Data source" },
      { id: "collectionPeriod", label: "Collection period" },
      { id: "method", label: "Method" },
      { id: "status", label: "Status" },
    ],
    isMock: true,
  },
  "kpi4.2": {
    id: "kpi4.2",
    displayName: "Accessibility and Security",
    description:
      "Accessibility and security improvements based on installed features (ramps, tactile paving, lighting, seating, crossings) and their coverage.",
    question: "How accessible are public spaces for all users?",
    supportedMapGeometry: ["points", "areas"],
    visualizationType: "areas",
    summaryFields: [
      { id: "accessibilityFeaturesTotal", label: "Installed accessibility features" },
      { id: "accessibilityFeatureCategories", label: "Feature categories" },
      { id: "locationCoverage", label: "Location coverage" },
    ],
    metadataFields: [
      { id: "dataSource", label: "Data source" },
      { id: "collectionPeriod", label: "Collection period" },
      { id: "method", label: "Method" },
      { id: "status", label: "Status" },
    ],
    isMock: true,
  },
};

export function getKpiFrameworkConfig(kpiId: string): KPIFrameworkConfig | undefined {
  return KPI_FRAMEWORK[kpiId as KPIFrameworkId];
}

