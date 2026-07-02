/** Shared OTC mode aggregation → ELABORATOR chart breakdowns (Insight + observatory). */

export type CopenhagenModeTotals = {
  bike: number;
  pedestrian: number;
  motorised: number;
  ptw: number;
  total: number;
};

export function emptyModeTotals(): CopenhagenModeTotals {
  return { bike: 0, pedestrian: 0, motorised: 0, ptw: 0, total: 0 };
}

export function pct(part: number, total: number): number {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return 0;
  return (part / total) * 100;
}

/**
 * OTC only distinguishes motorised as one bucket — split for ELABORATOR UI keys
 * (same 35% / 65% heuristic as copenhagenObservatoryView).
 */
export function toElaboratorModeShareBreakdown(
  pre: CopenhagenModeTotals,
  post: CopenhagenModeTotals
): {
  breakdownBaseline: Record<string, number>;
  breakdownIntervention: Record<string, number>;
} {
  const motorisedSplit = (motorised: number, total: number) => ({
    "Public Transport": pct(motorised * 0.35, total),
    "Private Car": pct(motorised * 0.65, total),
  });

  return {
    breakdownBaseline: {
      Pedestrian: pct(pre.pedestrian, pre.total),
      Cycle: pct(pre.bike, pre.total),
      ...motorisedSplit(pre.motorised, pre.total),
      PTW: pct(pre.ptw, pre.total),
    },
    breakdownIntervention: {
      Pedestrian: pct(post.pedestrian, post.total),
      Cycle: pct(post.bike, post.total),
      ...motorisedSplit(post.motorised, post.total),
      PTW: pct(post.ptw, post.total),
    },
  };
}

/** Scale 0–100% shares to 0–5 for the safety radar chart. */
export function toSafetyRadarBreakdown(totals: CopenhagenModeTotals): Record<string, number> {
  const total = Math.max(1, totals.total);
  const motorPct = pct(totals.motorised + totals.ptw, total);
  const activePct = pct(totals.bike + totals.pedestrian, total);
  const cyclePct = pct(totals.bike, total);
  const ptwPct = pct(totals.ptw, total);
  const volumePct = Math.min(100, (totals.total / 200) * 100);
  const toRadar = (value: number) => Math.round((value / 100) * 50) / 10;

  return {
    "Motor pressure": toRadar(motorPct),
    "Active mobility": toRadar(activePct),
    "Flow volume": toRadar(volumePct),
    "Cycle share": toRadar(cyclePct),
    "PTW share": toRadar(ptwPct),
  };
}

export function safetyKpiFromTotals(totals: CopenhagenModeTotals): number {
  const total = Math.max(1, totals.total);
  const motor = totals.motorised + totals.ptw;
  return pct(motor, total) * 0.6 + Math.min(100, (total / 200) * 100) * 0.4;
}
