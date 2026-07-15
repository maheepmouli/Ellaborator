import type { LocalCityPoint } from "@/services/localCityData";
import type { MilanSegmentDataset } from "@/services/milanSegmentData";
import { filterMilanLocalPoints } from "@/lib/interventionZone";
import type { MilanJunctionAnchor } from "./milanJunctionAnchors";
import { pickJunctionsForModeSharePresentation } from "./milanJunctionModeShareMock";

function seededUnit(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return (hash % 1000) / 1000;
}

export function milanHasObservedClimateData(
  envDataset: MilanSegmentDataset | null | undefined
): boolean {
  const records = envDataset?.records ?? [];
  if (!records.length) return false;
  const avg = records.reduce((sum, record) => sum + Number(record.value ?? 0), 0) / records.length;
  return avg > 0;
}

export function milanHasObservedAccessibilityData(
  points: LocalCityPoint[] | null | undefined,
  pilotId: string
): boolean {
  if (!points?.length) return false;
  const observed = points.filter(
    (p) =>
      p.properties?.datasetKind === "accessibility" &&
      p.properties?.dataOrigin !== "mock" &&
      p.properties?.parserStatus !== "illustrative"
  );
  const scoped = filterMilanLocalPoints(observed, pilotId);
  if (!scoped.length) return false;
  const avg =
    scoped.reduce((sum, p) => sum + Number(p.properties?.interventionValue ?? p.value ?? 0), 0) /
    scoped.length;
  return avg > 0;
}

export function milanHasObservedModeShareData(
  points: LocalCityPoint[] | null | undefined,
  pilotId: string
): boolean {
  if (!points?.length) return false;
  const observed = points.filter(
    (p) =>
      p.properties?.datasetKind === "amat-count" &&
      p.properties?.dataOrigin !== "mock" &&
      p.properties?.parserStatus !== "illustrative"
  );
  const scoped = filterMilanLocalPoints(observed, pilotId);
  return scoped.some((p) => p.properties?.spatialQuality === "matched");
}

/** Same 6–8 junction hubs as KPI 1.2 mode-share presentation. */
export function milanJunctionAnchorsForPilot(
  speedRecords: MilanSegmentDataset["records"] | null | undefined
): MilanJunctionAnchor[] {
  if (!speedRecords?.length) return [];
  return pickJunctionsForModeSharePresentation(speedRecords);
}

/**
 * Illustrative climate / environmental pressure at mode-share junction hubs.
 * Used only when RETE environment segments are unavailable for the pilot.
 */
export function buildMilanJunctionClimateMockPoints(
  junctions: MilanJunctionAnchor[],
  pilotId: string
): LocalCityPoint[] {
  return junctions.map((junction, junctionIndex) => {
    const seed = `${pilotId}-${junction.id}-climate`;
    const baselineValue = 28 + seededUnit(`${seed}-base`) * 52 + junctionIndex * 2.5;
    const interventionValue = baselineValue * (0.86 + seededUnit(`${seed}-post`) * 0.1);
    const comparisonValue = interventionValue - baselineValue;
    const preCo2GPerHour = Math.round(baselineValue * 42);
    const postCo2GPerHour = Math.round(interventionValue * 42);

    return {
      id: `milan-mock-kpi3.2-${junction.id}`,
      lat: junction.lat,
      lon: junction.lon,
      value: interventionValue,
      properties: {
        dataOrigin: "mock",
        datasetKind: "emissions",
        type: "mock",
        parserStatus: "illustrative",
        interventionId: pilotId,
        junctionId: junction.id,
        junctionLabel: junction.label,
        siteKey: junction.id,
        segmentId: junction.id,
        streetName: junction.label,
        baselineValue,
        interventionValue,
        comparisonValue,
        preCo2GPerHour,
        postCo2GPerHour,
        source: "Illustrative junction climate proxy (KPI 2.1 network anchors)",
        method: "Derived environmental pressure mock at mode-share junctions",
        spatialNote:
          "Illustrative climate proxy for stakeholder demo — RETE segments unavailable for this pilot",
        temporalCoverage: "illustrative",
        spatialQuality: "inferred",
        locationMethod: "safety_network_junction",
      },
    };
  });
}

/**
 * Illustrative equal-access / barrier scores at mode-share junction hubs.
 * Used only when DSS accessibility workbook rows are missing for the pilot.
 */
export function buildMilanJunctionAccessibilityMockPoints(
  junctions: MilanJunctionAnchor[],
  pilotId: string
): LocalCityPoint[] {
  return junctions.map((junction, junctionIndex) => {
    const seed = `${pilotId}-${junction.id}-a11y`;
    const baselineValue = 48 + seededUnit(`${seed}-base`) * 32 + junctionIndex * 1.8;
    const interventionValue = Math.min(
      96,
      baselineValue + 3 + seededUnit(`${seed}-post`) * 14
    );
    const comparisonValue = interventionValue - baselineValue;

    return {
      id: `milan-mock-kpi4.2-${junction.id}`,
      lat: junction.lat,
      lon: junction.lon,
      value: interventionValue,
      properties: {
        dataOrigin: "mock",
        datasetKind: "accessibility",
        type: "mock",
        parserStatus: "illustrative",
        interventionId: pilotId,
        junctionId: junction.id,
        junctionLabel: junction.label,
        siteKey: junction.id,
        segmentId: junction.id,
        streetName: junction.label,
        facilityCategory: "Universal access (illustrative)",
        baselineValue,
        interventionValue,
        comparisonValue,
        source: "Illustrative junction accessibility proxy (KPI 2.1 network anchors)",
        method: "DSS-style equal-access mock at mode-share junctions",
        spatialNote:
          "Illustrative accessibility proxy — DSS workbook has no pilot-scoped rows",
        temporalCoverage: "illustrative",
        spatialQuality: "inferred",
        locationMethod: "safety_network_junction",
      },
    };
  });
}

export function aggregateMilanJunctionMockKpi(
  points: LocalCityPoint[],
  scenario: "baseline" | "intervention" | "comparison"
): { baselineMain: number; interventionMain: number; change: number } | null {
  if (!points.length) return null;
  const baselineMain =
    points.reduce((s, p) => s + Number(p.properties?.baselineValue ?? 0), 0) / points.length;
  const interventionMain =
    points.reduce((s, p) => s + Number(p.properties?.interventionValue ?? p.value ?? 0), 0) /
    points.length;
  const change = interventionMain - baselineMain;
  if (scenario === "baseline") {
    return { baselineMain, interventionMain: baselineMain, change: 0 };
  }
  if (scenario === "comparison") {
    return { baselineMain, interventionMain, change };
  }
  return { baselineMain, interventionMain, change };
}
