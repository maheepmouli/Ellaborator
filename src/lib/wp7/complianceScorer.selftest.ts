/**
 * Deterministic WP7 scorer self-checks (no test-runner dependency).
 * Run: npm run test:wp7
 */

import { getAllWp7Datasets, getWp7DatasetById } from "@/data/wp7/adaptDataset";
import { getCityKpiMatrix } from "./cityComplianceMatrix";
import { assessDatasetForKpi, scoreCityKpi } from "./complianceScorer";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`WP7 self-check failed: ${message}`);
  }
}

export function runWp7SelfChecks(): void {
  const hel41 = getWp7DatasetById("hel-viikki-ux-survey");
  assert(!!hel41, "hel-viikki-ux-survey exists");
  const a41 = assessDatasetForKpi(hel41!, "kpi4.1");
  assert(a41.status === "ready", `Helsinki 4.1 should be Ready, got ${a41.status}`);

  const telraam = getWp7DatasetById("hel-telraam");
  assert(!!telraam, "hel-telraam exists");
  assert(
    !telraam!.linkedKpis.includes("kpi1.1"),
    "Telraam must not link KPI 1.1 for WP7"
  );
  const a11tel = assessDatasetForKpi(telraam!, "kpi1.1");
  assert(
    a11tel.status !== "ready",
    "Telraam must not score Ready for KPI 1.1"
  );

  const city11 = scoreCityKpi(getAllWp7Datasets(), "Helsinki", "kpi1.1", null);
  assert(
    city11.status !== "ready",
    `Helsinki city KPI 1.1 must not be Ready without a plan artifact (got ${city11.status})`
  );

  const attitude = getWp7DatasetById("hel-dangerous-locations-survey-insights");
  assert(!!attitude, "attitude survey exists");
  assert(
    !attitude!.linkedKpis.includes("kpi3.2"),
    "Attitude survey must not claim KPI 3.2 Ready linkage"
  );

  const city32 = scoreCityKpi(getAllWp7Datasets(), "Helsinki", "kpi3.2", null);
  assert(
    city32.status !== "ready",
    `Helsinki 3.2 must not be Ready (B/C missing); got ${city32.status}`
  );

  const mockSentiment = getWp7DatasetById("issy-sentiment-field-derived");
  assert(!!mockSentiment, "issy mock sentiment exists");
  const mock41 = assessDatasetForKpi(mockSentiment!, "kpi4.1");
  assert(
    mock41.status === "missing",
    `Issy mock 4.1 must be Missing, got ${mock41.status}`
  );

  const matrix = getCityKpiMatrix();
  assert(matrix.length === 6 * 7, `Expected 42 city×KPI cells, got ${matrix.length}`);
  assert(
    matrix.every((c) => ["ready", "partial", "missing"].includes(c.status)),
    "All matrix statuses must be ready|partial|missing"
  );

  const hel12 = scoreCityKpi(getAllWp7Datasets(), "Helsinki", "kpi1.2", "hel-p3");
  assert(
    hel12.status === "ready" || hel12.status === "partial",
    `Helsinki Pilot 3 KPI 1.2 should have evidence (got ${hel12.status})`
  );

  console.log("WP7 self-checks passed.");
}
