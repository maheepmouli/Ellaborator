/**
 * Copenhagen KPI 4.2 — MOCK accessibility / security samples placed on the same
 * OTC / mode-share corridor sites used for KPI 1.2 (survey-style placeholder,
 * not an EN 17210 audit or parking-inventory proxy).
 */
import {
  getLocationsForPilot,
  type CopenhagenPilotId,
} from "@/data/copenhagenLocationRegistry";
import type { LocalCityPoint } from "@/services/localCityData";
import type { ScenarioType } from "@/types/normalized-city-data";

export const CPH_ACCESSIBILITY_MOCK_DISCLAIMER =
  "MOCK accessibility & security — sample points reuse KPI 1.2 mode-share (OTC) corridor sites for dashboard demonstration only. Placeholder for interviews / explorative walks / citizen survey — not an EN 17210 audit or parking conversion proxy.";

export type CphAccessibilityDimension =
  | "Perceived security"
  | "Access ease"
  | "Inclusive design";

export interface CphAccessibilitySampleMock {
  id: string;
  segmentId: string;
  lat: number;
  lon: number;
  label: string;
  streetName: string;
  dimension: CphAccessibilityDimension;
  accessScore: number;
  baselineScore: number;
}

export interface CphAccessibilityPilotMock {
  pilotId: CopenhagenPilotId;
  title: string;
  accessPct: number;
  baselineAccessPct: number;
  confidencePct: number;
  breakdown: Record<CphAccessibilityDimension, number>;
  baselineBreakdown: Record<CphAccessibilityDimension, number>;
  samples: CphAccessibilitySampleMock[];
  disclaimer: string;
  methodology: string;
}

const DIMENSIONS: CphAccessibilityDimension[] = [
  "Perceived security",
  "Access ease",
  "Inclusive design",
];

const DIRECTION_OFFSET: Record<string, { dLat: number; dLon: number }> = {
  north: { dLat: 0.00055, dLon: 0 },
  south: { dLat: -0.00055, dLon: 0 },
  east: { dLat: 0, dLon: 0.0007 },
  west: { dLat: 0, dLon: -0.0007 },
  towards_stormgade: { dLat: 0.00035, dLon: 0.00045 },
  towards_vandkunsten: { dLat: -0.00035, dLon: -0.00045 },
};

function hashScore(seed: string, base: number, spread = 12): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const jitter = (h % (spread * 2 + 1)) - spread;
  return Math.max(35, Math.min(95, Math.round(base + jitter)));
}

function modeShareSitesForPilot(pilotId: CopenhagenPilotId) {
  return getLocationsForPilot(pilotId).filter(
    (loc) =>
      loc.mapVisible !== false &&
      (loc.kind === "otc_workbook_site" || loc.kind === "intelligent_camera")
  );
}

function buildSamples(
  pilotId: CopenhagenPilotId,
  accessPct: number,
  baselinePct: number
): CphAccessibilitySampleMock[] {
  const sites = modeShareSitesForPilot(pilotId);
  const samples: CphAccessibilitySampleMock[] = [];

  sites.forEach((site, siteIndex) => {
    const directions =
      site.monitoredDirections?.length && site.kind === "otc_workbook_site"
        ? site.monitoredDirections
        : ["hub"];

    directions.forEach((direction, dirIndex) => {
      const offset = DIRECTION_OFFSET[direction] ?? {
        dLat: (siteIndex % 3) * 0.00012,
        dLon: (dirIndex % 2 === 0 ? 1 : -1) * 0.00014,
      };
      const dimension = DIMENSIONS[(siteIndex + dirIndex) % DIMENSIONS.length];
      const accessScore = hashScore(`${site.id}-${direction}-a11y-post`, accessPct);
      const baselineScore = hashScore(`${site.id}-${direction}-a11y-pre`, baselinePct, 10);
      const armLabel =
        direction === "hub" ? site.name : `${site.name} · ${direction.replace(/_/g, " ")}`;

      samples.push({
        id: `cph-mock-a11y-${pilotId}-${site.id}-${direction}`,
        segmentId: `cph-mock-a11y-${site.otcWorkbookKey ?? site.id}-${direction}`,
        lat: site.lat + offset.dLat,
        lon: site.lon + offset.dLon,
        label: `${dimension} · ${armLabel}`,
        streetName: armLabel,
        dimension,
        accessScore,
        baselineScore,
      });
    });
  });

  return samples;
}

function buildPilotMock(
  pilotId: CopenhagenPilotId,
  title: string,
  accessPct: number,
  baselineAccessPct: number
): CphAccessibilityPilotMock {
  const samples = buildSamples(pilotId, accessPct, baselineAccessPct);
  const breakdown = {
    "Perceived security": hashScore(`${pilotId}-sec`, accessPct, 4),
    "Access ease": hashScore(`${pilotId}-ease`, accessPct - 3, 5),
    "Inclusive design": hashScore(`${pilotId}-incl`, accessPct + 2, 5),
  } as Record<CphAccessibilityDimension, number>;
  const baselineBreakdown = {
    "Perceived security": hashScore(`${pilotId}-sec-b`, baselineAccessPct, 4),
    "Access ease": hashScore(`${pilotId}-ease-b`, baselineAccessPct - 2, 5),
    "Inclusive design": hashScore(`${pilotId}-incl-b`, baselineAccessPct + 1, 5),
  } as Record<CphAccessibilityDimension, number>;

  return {
    pilotId,
    title,
    accessPct,
    baselineAccessPct,
    confidencePct: 40,
    breakdown,
    baselineBreakdown,
    samples,
    disclaimer: CPH_ACCESSIBILITY_MOCK_DISCLAIMER,
    methodology:
      "MOCK: accessibility/security scores placed on KPI 1.2 OpenTrafficCam / mode-share corridor sites. Survey-style placeholder (interviews / walks / citizen feedback) — not parking inventory or EN 17210.",
  };
}

const BY_PILOT: Record<CopenhagenPilotId, CphAccessibilityPilotMock> = {
  "cph-p1": buildPilotMock("cph-p1", "MOCK accessibility — mode-share corridors (Pilot 1)", 72, 65),
  "cph-p2": buildPilotMock("cph-p2", "MOCK accessibility — Vandkunsten mode-share corridor (Pilot 2)", 70, 63),
  "cph-p3": buildPilotMock("cph-p3", "MOCK accessibility — mode-share corridors (Pilot 3)", 69, 62),
};

export function getCopenhagenAccessibilityMock(
  pilotId: string | null | undefined
): CphAccessibilityPilotMock | null {
  if (!pilotId || !(pilotId in BY_PILOT)) return null;
  return BY_PILOT[pilotId as CopenhagenPilotId];
}

export function copenhagenAccessibilityToLocalPoints(
  profile: CphAccessibilityPilotMock,
  scenario: ScenarioType = "intervention"
): LocalCityPoint[] {
  const useBaseline = scenario === "baseline";
  return profile.samples.map((sample) => {
    const interventionValue = sample.accessScore;
    const baselineValue = sample.baselineScore;
    const value = useBaseline ? baselineValue : interventionValue;
    return {
      lat: sample.lat,
      lon: sample.lon,
      value,
      id: sample.id,
      properties: {
        type: "mock",
        dataOrigin: "mock",
        datasetKind: "accessibility",
        category: sample.dimension,
        likertLabel: sample.dimension,
        source: "MOCK — mode-share site accessibility",
        method: profile.methodology,
        pilotId: profile.pilotId,
        parserStatus: "mock",
        spatialQuality: "matched",
        locationMethod: "mode_share_site_reuse",
        spatialNote: profile.disclaimer,
        baselineValue,
        interventionValue,
        comparisonValue: interventionValue - baselineValue,
        featureLabel: sample.label,
        segmentId: sample.segmentId,
        streetName: `[MOCK] ${sample.streetName}`,
        mockDisclaimer: CPH_ACCESSIBILITY_MOCK_DISCLAIMER,
        mockLabel: "MOCK",
      },
    };
  });
}

export function copenhagenAccessibilityKpiHeadline(
  profile: CphAccessibilityPilotMock,
  scenario: ScenarioType = "intervention"
): {
  mainValue: number;
  baselineMain: number;
  unit: string;
  change: number;
  breakdown: Record<string, number>;
  baselineBreakdown: Record<string, number>;
} {
  const useBaseline = scenario === "baseline";
  return {
    mainValue: useBaseline ? profile.baselineAccessPct : profile.accessPct,
    baselineMain: profile.baselineAccessPct,
    unit: "% accessible (MOCK)",
    change: profile.accessPct - profile.baselineAccessPct,
    breakdown: { ...profile.breakdown },
    baselineBreakdown: { ...profile.baselineBreakdown },
  };
}
