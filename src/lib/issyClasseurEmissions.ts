import type { CityKPIData } from "@/data/kpiDefinitions";
import type { IssyClasseurEmissionsSnapshot } from "@/types/issy-workbooks";
import { haversineMeters } from "@/lib/issyPilot2Junction";
import { getKpi32TimeSeriesIntensity } from "@/lib/kpi32YearIntensity";

export interface ClimateHexCo2Allocation {
  cellId: string;
  lat: number;
  lon: number;
  distM: number;
  weight: number;
  baselineCo2GPerHour: number;
  interventionCo2GPerHour: number;
  displayCo2GPerHour: number;
  intensityPct: number;
}

/** Distribute ASIF corridor total across hex cells by distance decay (center = junction). */
export function allocateClasseurCo2ToHexGrid(
  cells: Array<{ id: string; lat: number; lon: number }>,
  centerLat: number,
  centerLon: number,
  classeur: IssyClasseurEmissionsSnapshot,
  options: {
    kpiRow?: CityKPIData;
    kpi32Year?: string | null;
    scenario?: "baseline" | "intervention" | "comparison";
  } = {}
): ClimateHexCo2Allocation[] {
  const scenario = options.scenario ?? "intervention";
  const totalBaseline = classeur.totalBaselineCo2G;
  const decayM = Math.max(40, classeur.corridorLengthM * 2.4);

  const weights = cells.map((cell) => {
    const distM = haversineMeters(centerLat, centerLon, cell.lat, cell.lon);
    return Math.exp(-distM / decayM);
  });
  const weightSum = weights.reduce((sum, w) => sum + w, 0) || 1;

  const yearIntensity = getKpi32TimeSeriesIntensity(options.kpiRow, options.kpi32Year ?? null);
  const reductionPct = options.kpiRow?.mainValue ?? 20;
  const interventionFactor =
    yearIntensity != null
      ? Math.max(0.35, Math.min(1, yearIntensity / 100))
      : Math.max(0.35, 1 - reductionPct / 100);

  return cells.map((cell, idx) => {
    const distM = haversineMeters(centerLat, centerLon, cell.lat, cell.lon);
    const weight = weights[idx]! / weightSum;
    const baselineCo2GPerHour = totalBaseline * weight;
    const interventionCo2GPerHour = baselineCo2GPerHour * interventionFactor;
    const displayCo2GPerHour =
      scenario === "baseline"
        ? baselineCo2GPerHour
        : scenario === "intervention"
          ? interventionCo2GPerHour
          : Math.abs(interventionCo2GPerHour - baselineCo2GPerHour);

    const intensityPct = Math.min(
      100,
      Math.max(8, (displayCo2GPerHour / (totalBaseline * 0.55)) * 100)
    );

    return {
      cellId: cell.id,
      lat: cell.lat,
      lon: cell.lon,
      distM,
      weight,
      baselineCo2GPerHour,
      interventionCo2GPerHour,
      displayCo2GPerHour,
      intensityPct,
    };
  });
}

export function classeurCo2ForCell(
  allocations: ClimateHexCo2Allocation[],
  cellId: string
): ClimateHexCo2Allocation | null {
  return allocations.find((a) => a.cellId === cellId) ?? null;
}
