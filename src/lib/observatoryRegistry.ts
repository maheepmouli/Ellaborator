import { KPI_READINESS_MATRIX } from "@/data/kpiReadinessMatrix";

export type ObservatoryTabId =
  | "overview"
  | "pressure"
  | "modes"
  | "corridor"
  | "field"
  | "delta"
  | "beforeAfter"
  | "data";

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
    subtitle: "Travel behaviour and modal split on the selected corridor",
    tabs: [
      { id: "modes", label: "Modes" },
      { id: "corridor", label: "Corridor" },
      { id: "beforeAfter", label: "Before / After" },
      { id: "data", label: "Data" },
    ],
    primaryMetricLabel: "Sustainable mode share",
  },
  "kpi2.1": {
    title: "Safety pressure observatory",
    subtitle: "Speed, congestion, and segment-level risk on approach arms",
    tabs: [
      { id: "pressure", label: "Pressure" },
      { id: "beforeAfter", label: "Before / After" },
      { id: "overview", label: "Intersection" },
      { id: "data", label: "Data" },
    ],
    primaryMetricLabel: "Safety / congestion index",
  },
  "kpi3.2": {
    title: "Environmental field observatory",
    subtitle: "Emissions proxy and climate intensity around the junction",
    tabs: [
      { id: "field", label: "Field" },
      { id: "delta", label: "Delta" },
      { id: "data", label: "Data" },
    ],
    primaryMetricLabel: "Environmental pressure",
  },
  "kpi3.1": {
    title: "Infrastructure observatory",
    subtitle: "Cycling and zero-emission facilities near the study zone",
    tabs: [
      { id: "overview", label: "Facilities" },
      { id: "data", label: "Data" },
    ],
    primaryMetricLabel: "Facility intensity",
  },
  "kpi4.1": {
    title: "Sentiment observatory",
    subtitle: "Perception and satisfaction samples in the corridor",
    tabs: [
      { id: "overview", label: "Perception" },
      { id: "data", label: "Data" },
    ],
    primaryMetricLabel: "Satisfaction index",
  },
  "kpi4.2": {
    title: "Accessibility observatory",
    subtitle: "Reach bands and access features",
    tabs: [
      { id: "overview", label: "Reach" },
      { id: "data", label: "Data" },
    ],
    primaryMetricLabel: "Accessibility score",
  },
};

export function getObservatoryConfig(
  kpiId: string,
  city: string,
  pilotId?: string | null
): ObservatoryConfig {
  const base = KPI_OBSERVATORY[kpiId] ?? KPI_OBSERVATORY["kpi2.1"];
  const readiness = KPI_READINESS_MATRIX.find((c) => c.city === city && c.kpiId === kpiId);

  let emptyState: string | undefined;
  if (readiness?.readiness === "missing") {
    emptyState = `No observed dataset linked for ${city} · ${kpiId}. ${readiness.notes}`;
  } else if (readiness?.readiness === "partial") {
    emptyState = `Partial coverage for this KPI. ${readiness.notes}${pilotId ? ` (pilot ${pilotId})` : ""}`;
  }

  return {
    kpiId,
    ...base,
    emptyState,
  };
}

export function defaultObservatoryTab(kpiId: string): ObservatoryTabId {
  const cfg = KPI_OBSERVATORY[kpiId];
  return cfg?.tabs[0]?.id ?? "overview";
}
