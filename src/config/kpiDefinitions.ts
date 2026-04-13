export type KpiMapType = "points" | "segments" | "hexagons";
export type KpiType = "mobility" | "safety" | "co2" | "accessibility";
export type DataStatus = "before" | "after" | "ongoing" | "simulated";
export type DataLabel = "Observed" | "Derived" | "Modelled";

export interface KpiDefinitionConfig {
  id: string;
  ref: string;
  name: string;
  type: KpiType;
  mapType: KpiMapType;
  indicator: string;
  supportingData: string[];
  summary: string;
  interpretation: string;
  dataSource: string;
  method: string;
  status: DataStatus;
  dataLabel: DataLabel;
  isModelled: boolean;
}

export const KPI_DEFINITIONS: Record<string, KpiDefinitionConfig> = {
  "kpi1.2": {
    id: "kpi1.2",
    ref: "KPI1.2",
    name: "Mobility Mode Share",
    type: "mobility",
    mapType: "points",
    indicator: "Sustainable mode share",
    supportingData: ["Traffic flow data", "Mode assumptions"],
    summary: "This view shows the share of sustainable transport modes based on observed or aggregated mobility data.",
    interpretation:
      "Increase in sustainable modes is primarily driven by higher public transport and cycling usage.",
    dataSource: "Traffic count API (Issy-les-Moulineaux)",
    method: "Derived proxy from vehicle flow",
    status: "simulated",
    dataLabel: "Derived",
    isModelled: true,
  },
  "kpi2.1": {
    id: "kpi2.1",
    ref: "KPI2.1",
    name: "Road User Safety",
    type: "safety",
    mapType: "segments",
    indicator: "Safety proxy index",
    supportingData: ["Observed speed data", "Observed congestion index"],
    summary: "This view estimates safety conditions by combining segment-level speed and congestion observations.",
    interpretation: "Lower congestion and more stable segment speed profiles improve estimated safety conditions.",
    dataSource: "Traffic API",
    method: "Derived from segment speed and congestion proxy",
    status: "after",
    dataLabel: "Derived",
    isModelled: true,
  },
  "kpi3.2": {
    id: "kpi3.2",
    ref: "KPI3.2",
    name: "Climate and Environmental Impact",
    type: "co2",
    mapType: "hexagons",
    indicator: "Emission intensity",
    supportingData: ["Observed flow proxies", "Modelled emission factors"],
    summary: "This view displays estimated emission intensity using gridded spatial aggregation.",
    interpretation: "Lower-intensity cells indicate stronger intervention effect on emission-related pressure.",
    dataSource: "Traffic API + model coefficients",
    method: "Modelled hexagon intensity surface",
    status: "after",
    dataLabel: "Modelled",
    isModelled: true,
  },
  "kpi4.2": {
    id: "kpi4.2",
    ref: "KPI4.2",
    name: "Accessibility and Security",
    type: "accessibility",
    mapType: "points",
    indicator: "Accessibility feature availability",
    supportingData: ["Observed feature inventory", "Category-level aggregation"],
    summary: "This view shows where accessibility-supporting assets are concentrated and how categories vary spatially.",
    interpretation: "Clusters of points suggest stronger local accessibility support and service reach.",
    dataSource: "City accessibility inventory",
    method: "Observed points with derived category totals",
    status: "after",
    dataLabel: "Observed",
    isModelled: false,
  },
  "kpi3.1": {
    id: "kpi3.1",
    ref: "KPI3.1",
    name: "Zero-Emission Facilities and Services",
    type: "mobility",
    mapType: "points",
    indicator: "Installed low-emission facilities",
    supportingData: ["Observed infrastructure inventory", "Category totals"],
    summary: "This view presents observed low-emission facilities and services by location and category.",
    interpretation: "Concentrated infrastructure deployment usually improves local access to low-emission mobility.",
    dataSource: "Cycling and infrastructure API",
    method: "Observed assets, derived category aggregation",
    status: "after",
    dataLabel: "Observed",
    isModelled: false,
  },
  "kpi4.1": {
    id: "kpi4.1",
    ref: "KPI4.1",
    name: "User Satisfaction",
    type: "accessibility",
    mapType: "points",
    indicator: "Share of satisfied respondents",
    supportingData: ["Observed survey results", "Derived segment averages"],
    summary: "This view shows observed satisfaction responses aggregated by location.",
    interpretation: "Higher satisfaction generally tracks with perceived improvements in accessibility and safety.",
    dataSource: "Survey dataset",
    method: "Observed survey responses with derived local averages",
    status: "after",
    dataLabel: "Observed",
    isModelled: false,
  },
};

export function getKpiDefinition(id: string): KpiDefinitionConfig | undefined {
  return KPI_DEFINITIONS[id];
}
