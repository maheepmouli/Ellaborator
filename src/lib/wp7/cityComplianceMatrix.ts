/**
 * City × pilot × KPI compliance matrix for UI + export.
 */

import { ALL_CITIES } from "@/data/datasetMetadata";
import { ELABORATOR_KPIS } from "@/data/kpiDefinitions";
import { CITY_PILOTS } from "@/data/pilotDefinitions";
import { getAllWp7Datasets } from "@/data/wp7/adaptDataset";
import type { Wp7CityPilotKpiCell, Wp7ComplianceStatus } from "@/data/wp7/wp7Types";
import { scoreCityKpi } from "./complianceScorer";
import { WP7_KPI_IDS } from "./kpiEvidenceRules";

const CITY_NAME_TO_PILOTS_KEY: Record<string, string> = {
  "Issy-les-Moulineaux": "issy-les-moulineaux",
  Copenhagen: "copenhagen",
  Helsinki: "helsinki",
  Milan: "milan",
  Zaragoza: "zaragoza",
  Trikala: "trikala",
};

function pilotIdsForCity(city: string): string[] {
  const key = CITY_NAME_TO_PILOTS_KEY[city];
  if (!key) return [];
  return (CITY_PILOTS[key] || []).map((p) => p.id);
}

export function buildCityComplianceMatrix(): Wp7CityPilotKpiCell[] {
  const datasets = getAllWp7Datasets();
  const cells: Wp7CityPilotKpiCell[] = [];

  for (const city of ALL_CITIES) {
    const kpiIds = WP7_KPI_IDS.filter((id) => ELABORATOR_KPIS.some((k) => k.id === id));

    // City-level rollup (pilotId null)
    for (const kpiId of kpiIds) {
      const scored = scoreCityKpi(datasets, city, kpiId, null);
      cells.push({
        city,
        pilotId: null,
        kpiId,
        status: scored.status,
        datasetIds: scored.datasetIds,
        notes: scored.notes,
        assessments: scored.assessments,
      });
    }

    for (const pilotId of pilotIdsForCity(city)) {
      for (const kpiId of kpiIds) {
        const scored = scoreCityKpi(datasets, city, kpiId, pilotId);
        cells.push({
          city,
          pilotId,
          kpiId,
          status: scored.status,
          datasetIds: scored.datasetIds,
          notes: scored.notes,
          assessments: scored.assessments,
        });
      }
    }
  }

  return cells;
}

export function getCityKpiMatrix(city?: string): Wp7CityPilotKpiCell[] {
  const all = buildCityComplianceMatrix();
  const cityLevel = all.filter((c) => c.pilotId === null);
  return city ? cityLevel.filter((c) => c.city === city) : cityLevel;
}

export function getCityComplianceSummary(city: string): {
  ready: number;
  partial: number;
  missing: number;
  total: number;
} {
  const cells = getCityKpiMatrix(city);
  return {
    ready: cells.filter((c) => c.status === "ready").length,
    partial: cells.filter((c) => c.status === "partial").length,
    missing: cells.filter((c) => c.status === "missing").length,
    total: cells.length,
  };
}

export function statusLabel(status: Wp7ComplianceStatus): string {
  switch (status) {
    case "ready":
      return "Ready";
    case "partial":
      return "Partial";
    default:
      return "Missing";
  }
}

/** Memoised matrix for the session (rebuild on module reload). */
export const WP7_COMPLIANCE_MATRIX: Wp7CityPilotKpiCell[] = buildCityComplianceMatrix();
export const WP7_CITY_KPI_MATRIX: Wp7CityPilotKpiCell[] = WP7_COMPLIANCE_MATRIX.filter(
  (c) => c.pilotId === null
);
