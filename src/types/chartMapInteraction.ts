/** Payload when user drills from a KPI chart — map + filters react in the explorer. */
export type ChartDrillPayload =
  | { source: "kpi1.2"; key: string }
  | { source: "kpi2.1"; key: string }
  | { source: "kpi3.1"; key: string }
  | { source: "kpi3.2"; key: string }
  | { source: "kpi4.2"; key: string };
