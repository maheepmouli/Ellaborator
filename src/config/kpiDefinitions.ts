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
  "kpi1.1": {
    id: "kpi1.1",
    ref: "KPI1.1",
    name: "Intervention Expansion",
    type: "mobility",
    mapType: "points",
    indicator: "Formal expansion plans (≥1 target)",
    supportingData: ["Expansion plan artifact", "Telraam / Mobilysis monitoring coverage"],
    summary:
      "This view tracks whether a formal intervention expansion plan is available, with monitoring readiness shown when the plan artifact is still pending.",
    interpretation:
      "KPI 1.1 expects at least one formal expansion plan. Helsinki FVH3 currently surfaces monitoring readiness while the structured plan artifact remains pending.",
    dataSource: "Helsinki Evaluation Plan + Viikki monitoring feeds",
    method: "Plan-count target with monitoring-readiness proxy when plan artifact is missing",
    status: "ongoing",
    dataLabel: "Derived",
    isModelled: true,
  },
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
    dataSource: "Traffic API / speed layers — baseline observed; post & comparison illustrative",
    method: "Safety proxy from observed speed / congestion; post-intervention figures are MOCK where evaluation is pending",
    status: "after",
    dataLabel: "Observed",
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
    indicator: "Accessibility index",
    supportingData: ["Observed accessibility scores", "Category-level aggregation"],
    summary: "This view shows accessibility index levels and how categories vary spatially.",
    interpretation: "Higher index values suggest stronger local accessibility support and service reach.",
    dataSource: "City accessibility inventory",
    method: "Observed points with derived accessibility index",
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
