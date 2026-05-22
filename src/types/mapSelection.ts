/** Cross-filter bus: map selection propagates to sidebar charts and highlights. */
export type MapSelectionState = {
  segmentId?: string | null;
  mode?: string | null;
  kpi?: string | null;
  pilotId?: string | null;
  city?: string | null;
};
