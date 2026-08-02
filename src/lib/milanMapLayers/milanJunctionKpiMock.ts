import type { LocalCityPoint } from "@/services/localCityData";
import type { MilanSegmentDataset, MilanSegmentRecord } from "@/services/milanSegmentData";
import { sampleInterventionNetworkSites } from "@/data/milanZeroEmissionMock";
import { filterMilanLocalPoints, filterMilanAccessibilityPoints } from "@/lib/interventionZone";
import type { MilanJunctionAnchor } from "./milanJunctionAnchors";
import { pickJunctionsForModeSharePresentation } from "./milanJunctionModeShareMock";
import { getQuantile, getSegmentHighlight } from "@/lib/segmentHighlight";

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
  // Pilot 3 = combined Pilot 1 + Pilot 2 DSS civic-address inventory.
  const scoped = filterMilanAccessibilityPoints(observed, pilotId).filter(
    (p) => p.properties?.datasetKind === "accessibility"
  );
  return scoped.length > 0;
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
 * Illustrative climate / environmental pressure along the intervention network.
 * Used only when RETE environment segments are unavailable for the pilot.
 * Prefer network.shp samples so markers sit in the corridor (not a clustered hub pile).
 */
export function buildMilanJunctionClimateMockPoints(
  junctions: MilanJunctionAnchor[],
  pilotId: string,
  networkSegments?: MilanSegmentRecord[] | null
): LocalCityPoint[] {
  const targetCount = Math.max(junctions.length, 8);
  const networkSites = networkSegments?.length
    ? sampleInterventionNetworkSites(networkSegments, targetCount)
    : [];
  // Sticky #19: always emit climate proxies when we have corridor geometry or junction anchors.
  const sites =
    networkSites.length > 0
      ? networkSites
      : junctions.length > 0
        ? junctions.map((junction) => ({
            lat: junction.lat,
            lon: junction.lon,
            streetName: junction.label,
            segmentId: junction.id,
          }))
        : [];

  if (!sites.length) return [];

  return sites.map((site, siteIndex) => {
    const seed = `${pilotId}-${site.segmentId}-climate`;
    const baselineValue = 28 + seededUnit(`${seed}-base`) * 52 + siteIndex * 2.5;
    const interventionValue = baselineValue * (0.86 + seededUnit(`${seed}-post`) * 0.1);
    const comparisonValue = interventionValue - baselineValue;
    const preCo2GPerHour = Math.round(baselineValue * 42);
    const postCo2GPerHour = Math.round(interventionValue * 42);
    const junctionId = junctions[siteIndex % Math.max(junctions.length, 1)]?.id ?? `mil-climate-${siteIndex + 1}`;

    return {
      id: `milan-mock-kpi3.2-${site.segmentId}-${siteIndex}`,
      lat: site.lat,
      lon: site.lon,
      value: interventionValue,
      properties: {
        dataOrigin: "mock",
        datasetKind: "emissions",
        type: "mock",
        parserStatus: "illustrative",
        interventionId: pilotId,
        junctionId,
        junctionLabel: site.streetName,
        siteKey: site.segmentId,
        segmentId: site.segmentId,
        networkSegmentId: site.segmentId,
        streetName: site.streetName,
        baselineValue,
        interventionValue,
        comparisonValue,
        preCo2GPerHour,
        postCo2GPerHour,
        source: "Illustrative climate proxy along intervention network",
        method: "Derived environmental pressure mock on network.shp samples",
        spatialNote:
          "Illustrative climate proxy for stakeholder demo — RETE segments unavailable; placed along AMAT network.shp",
        temporalCoverage: "illustrative",
        spatialQuality: "inferred",
        locationMethod: "intervention_network_sample",
      },
    };
  });
}

/** Colour bands for Milan KPI 3.2 illustrative climate points (matches map + legend). */
export function milanClimatePressureColor(
  value: number,
  peers: number[]
): { color: string; band: string } {
  const low = getQuantile(peers, 0.15);
  const high = getQuantile(peers, 0.85);
  const highlight = getSegmentHighlight(value, low, high, "climate");
  return { color: highlight.color, band: highlight.band };
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
    const category =
      interventionValue >= 75
        ? "Equal access"
        : interventionValue >= 55
          ? "Slightly penalised"
          : "Heavily penalised";

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
        facilityCategory: category,
        category,
        likertLabel: category,
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
