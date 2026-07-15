import type { CopenhagenEmissionsSnapshot } from "@/types/copenhagen-emissions";

export const CPH_EMISSION_FACTORS_G_CO2_PER_VEHICLE_HOUR: Record<string, number> = {
  car: 1180,
  van: 1420,
  bus: 4200,
  truck: 5800,
  motorcycle: 620,
  scooter: 380,
};

/** Map modelled g CO₂/h to 0–100 map intensity (lower CO₂ = better for KPI 3.2). */
export function co2GPerHourToKpiIntensity(co2GPerHour: number, referenceMax = 12000): number {
  if (!Number.isFinite(co2GPerHour) || co2GPerHour <= 0) return 0;
  const cap = Math.max(referenceMax, 1);
  return Math.max(0, Math.min(100, (co2GPerHour / cap) * 100));
}

/** CO₂ emissions gradient — red (high) → green (low). */
export function emissionsIntensityToColor(intensity: number): string {
  const t = Math.max(0, Math.min(100, intensity));
  if (t >= 80) return "#E02020";
  if (t >= 60) return "#F97316";
  if (t >= 40) return "#FBBF24";
  if (t >= 20) return "#10B981";
  return "#22C55E";
}

export function maxCo2GPerHourFromFlows(
  flows: ReadonlyArray<{ preCo2GPerHour: number; postCo2GPerHour: number }>
): number {
  let max = 1;
  flows.forEach((f) => {
    max = Math.max(max, f.preCo2GPerHour, f.postCo2GPerHour);
  });
  return max;
}

export function co2ReductionPct(preCo2: number, postCo2: number): number {
  if (preCo2 <= 0) return 0;
  return Math.max(-100, Math.min(100, ((preCo2 - postCo2) / preCo2) * 100));
}

export function findEmissionFlowForSite(
  snapshot: CopenhagenEmissionsSnapshot,
  siteName: string,
  flow?: string
): CopenhagenEmissionsSnapshot["flows"][number] | undefined {
  const siteLower = siteName.toLowerCase();
  const matches = snapshot.flows.filter((f) => f.siteName.toLowerCase().includes(siteLower.slice(0, 8)));
  if (flow) {
    return matches.find((f) => f.flow === flow) ?? matches[0];
  }
  if (matches.length === 1) return matches[0];
  return matches.reduce(
    (best, row) =>
      row.postCo2GPerHour + row.preCo2GPerHour > best.postCo2GPerHour + best.preCo2GPerHour
        ? row
        : best,
    matches[0]
  );
}

export function aggregateSiteEmissionsCo2(
  snapshot: CopenhagenEmissionsSnapshot,
  siteName: string
): { preCo2GPerHour: number; postCo2GPerHour: number } {
  const siteLower = siteName.toLowerCase();
  const rows = snapshot.flows.filter((f) => {
    const n = f.siteName.toLowerCase();
    return n.includes(siteLower.slice(0, 6)) || siteLower.includes(n.slice(0, 6));
  });
  return {
    preCo2GPerHour: rows.reduce((s, r) => s + r.preCo2GPerHour, 0),
    postCo2GPerHour: rows.reduce((s, r) => s + r.postCo2GPerHour, 0),
  };
}
