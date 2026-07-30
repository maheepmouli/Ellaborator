export type ObservatoryTabId =
  | "overview"
  | "pressure"
  | "modes"
  | "corridor"
  | "field"
  | "delta"
  | "beforeAfter"
  | "data"
  | "kpiAnalysis"
  | "methodology";

export type ObservatoryTab = {
  id: ObservatoryTabId;
  label: string;
};

export type ObservatoryConfig = {
  kpiId: string;
  title: string;
  subtitle: string;
  tabs: ObservatoryTab[];
  primaryMetricLabel: string;
  emptyState?: string;
};

const KPI_OBSERVATORY: Record<string, Omit<ObservatoryConfig, "kpiId" | "emptyState">> = {
  "kpi1.2": {
    title: "Mode share observatory",
    subtitle:
      "Modal split from observed OD CSV (city view); the monitored intervention corridor shows traficissy segment context only",
    tabs: [
      { id: "modes", label: "Overview" },
      { id: "corridor", label: "Flows" },
      { id: "beforeAfter", label: "Temporal" },
      { id: "data", label: "Data source" },
    ],
    primaryMetricLabel: "Sustainable mode share",
  },
  "kpi2.1": {
    title: "Safety pressure observatory",
    subtitle: "Speed, congestion, and segment-level risk on the monitored intervention corridor",
    tabs: [
      { id: "pressure", label: "Overview" },
      { id: "beforeAfter", label: "Temporal" },
      { id: "overview", label: "Intersection" },
      { id: "data", label: "Data source" },
    ],
    primaryMetricLabel: "Safety / congestion index",
  },
  "kpi3.2": {
    title: "Environmental field observatory",
    subtitle: "Emissions proxy and climate intensity around the monitored intervention corridor",
    tabs: [
      { id: "field", label: "Overview" },
      { id: "delta", label: "Comparison" },
      { id: "beforeAfter", label: "Temporal" },
      { id: "data", label: "Data source" },
    ],
    primaryMetricLabel: "Environmental pressure",
  },
  "kpi3.1": {
    title: "Infrastructure observatory",
    subtitle: "Cycling and zero-emission facilities near the study zone",
    tabs: [
      { id: "overview", label: "Overview" },
      { id: "data", label: "Data source" },
    ],
    primaryMetricLabel: "Facility intensity",
  },
  "kpi4.1": {
    title: "Sentiment observatory",
    subtitle: "Perception and satisfaction samples in the corridor",
    tabs: [
      { id: "overview", label: "Overview" },
      { id: "data", label: "Data source" },
    ],
    primaryMetricLabel: "Satisfaction index",
  },
  "kpi4.2": {
    title: "Accessibility observatory",
    subtitle: "Reach bands and access features",
    tabs: [
      { id: "overview", label: "Overview" },
      { id: "data", label: "Data source" },
    ],
    primaryMetricLabel: "Accessibility score",
  },
};

const DEFAULT_OBSERVATORY_TABS: ObservatoryTab[] = [
  { id: "overview", label: "Overview" },
  { id: "beforeAfter", label: "Before/After" },
];

export function getObservatoryConfig(
  kpiId: string,
  city: string,
  _pilotId?: string | null
): ObservatoryConfig {
  const kpiBase = KPI_OBSERVATORY[kpiId] ?? KPI_OBSERVATORY["kpi2.1"];
  const base = {
    ...kpiBase,
    tabs: DEFAULT_OBSERVATORY_TABS,
    subtitle:
      city === "Issy-les-Moulineaux"
        ? kpiBase.subtitle
        : city === "Copenhagen"
          ? "Directional counts for the selected camera corridor."
          : "Intervention-first observatory shell with explicit trust, data readiness, and methodology context.",
  };
  return {
    kpiId,
    ...base,
  };
}

export function defaultObservatoryTab(_kpiId?: string): ObservatoryTabId {
  return "overview";
}
