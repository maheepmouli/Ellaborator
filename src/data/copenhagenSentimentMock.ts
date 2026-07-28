/**
 * Copenhagen KPI 4.1 — MOCK user satisfaction samples placed on the same
 * OTC / mode-share corridor sites used for KPI 1.2 (not a live citizen feed).
 */
import {
  getLocationsForPilot,
  type CopenhagenPilotId,
} from "@/data/copenhagenLocationRegistry";
import type { LocalCityPoint } from "@/services/localCityData";
import type { ScenarioType } from "@/types/normalized-city-data";

export const CPH_SENTIMENT_MOCK_DISCLAIMER =
  "MOCK user satisfaction — sample points reuse KPI 1.2 mode-share (OTC) corridor sites for dashboard demonstration only. Not linked to Acceptability_Intervention1 survey responses.";

export type CphSentimentDimension =
  | "Overall satisfaction"
  | "Perceived safety"
  | "Street amenity";

export interface CphSentimentSampleMock {
  id: string;
  segmentId: string;
  lat: number;
  lon: number;
  label: string;
  streetName: string;
  dimension: CphSentimentDimension;
  satisfactionScore: number;
  baselineScore: number;
}

export interface CphSentimentPilotMock {
  pilotId: CopenhagenPilotId;
  title: string;
  satisfiedPct: number;
  baselineSatisfiedPct: number;
  confidencePct: number;
  breakdown: Record<CphSentimentDimension, number>;
  baselineBreakdown: Record<CphSentimentDimension, number>;
  samples: CphSentimentSampleMock[];
  disclaimer: string;
  methodology: string;
}

const DIMENSIONS: CphSentimentDimension[] = [
  "Overall satisfaction",
  "Perceived safety",
  "Street amenity",
];

/** Small geographic offsets so N/S (or multi-arm) mode-share links are visible as separate pins. */
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

function buildSamples(pilotId: CopenhagenPilotId, satisfiedPct: number, baselinePct: number): CphSentimentSampleMock[] {
  const sites = modeShareSitesForPilot(pilotId);
  const samples: CphSentimentSampleMock[] = [];

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
      const satisfactionScore = hashScore(`${site.id}-${direction}-post`, satisfiedPct);
      const baselineScore = hashScore(`${site.id}-${direction}-pre`, baselinePct, 10);
      const armLabel =
        direction === "hub" ? site.name : `${site.name} · ${direction.replace(/_/g, " ")}`;

      samples.push({
        id: `cph-mock-sat-${pilotId}-${site.id}-${direction}`,
        segmentId: `cph-mock-sat-${site.otcWorkbookKey ?? site.id}-${direction}`,
        lat: site.lat + offset.dLat,
        lon: site.lon + offset.dLon,
        label: `${dimension} · ${armLabel}`,
        streetName: armLabel,
        dimension,
        satisfactionScore,
        baselineScore,
      });
    });
  });

  return samples;
}

function buildPilotMock(
  pilotId: CopenhagenPilotId,
  title: string,
  satisfiedPct: number,
  baselineSatisfiedPct: number
): CphSentimentPilotMock {
  const samples = buildSamples(pilotId, satisfiedPct, baselineSatisfiedPct);
  const breakdown = {
    "Overall satisfaction": hashScore(`${pilotId}-overall`, satisfiedPct, 4),
    "Perceived safety": hashScore(`${pilotId}-safety`, satisfiedPct - 4, 5),
    "Street amenity": hashScore(`${pilotId}-amenity`, satisfiedPct + 3, 5),
  } as Record<CphSentimentDimension, number>;
  const baselineBreakdown = {
    "Overall satisfaction": hashScore(`${pilotId}-overall-b`, baselineSatisfiedPct, 4),
    "Perceived safety": hashScore(`${pilotId}-safety-b`, baselineSatisfiedPct - 3, 5),
    "Street amenity": hashScore(`${pilotId}-amenity-b`, baselineSatisfiedPct + 2, 5),
  } as Record<CphSentimentDimension, number>;

  return {
    pilotId,
    title,
    satisfiedPct,
    baselineSatisfiedPct,
    confidencePct: 42,
    breakdown,
    baselineBreakdown,
    samples,
    disclaimer: CPH_SENTIMENT_MOCK_DISCLAIMER,
    methodology:
      "MOCK: satisfaction scores placed on KPI 1.2 OpenTrafficCam / mode-share corridor sites (workbook hubs + camera nodes). Deterministic placeholder scores for UI demo only.",
  };
}

const BY_PILOT: Record<CopenhagenPilotId, CphSentimentPilotMock> = {
  "cph-p1": buildPilotMock("cph-p1", "MOCK satisfaction — mode-share corridors (Pilot 1)", 68, 61),
  "cph-p2": buildPilotMock("cph-p2", "MOCK satisfaction — Vandkunsten mode-share corridor (Pilot 2)", 64, 58),
  "cph-p3": buildPilotMock("cph-p3", "MOCK satisfaction — mode-share corridors (Pilot 3)", 66, 59),
};

export function getCopenhagenSentimentMock(
  pilotId: string | null | undefined
): CphSentimentPilotMock | null {
  if (!pilotId || !(pilotId in BY_PILOT)) return null;
  return BY_PILOT[pilotId as CopenhagenPilotId];
}

export function copenhagenSentimentToLocalPoints(
  profile: CphSentimentPilotMock,
  scenario: ScenarioType = "intervention"
): LocalCityPoint[] {
  const useBaseline = scenario === "baseline";
  return profile.samples.map((sample) => {
    const interventionValue = sample.satisfactionScore;
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
        datasetKind: "survey",
        category: sample.dimension,
        likertLabel: sample.dimension,
        source: "MOCK — mode-share site satisfaction",
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
        mockDisclaimer: CPH_SENTIMENT_MOCK_DISCLAIMER,
        mockLabel: "MOCK",
      },
    };
  });
}

export function copenhagenSentimentKpiHeadline(
  profile: CphSentimentPilotMock,
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
    mainValue: useBaseline ? profile.baselineSatisfiedPct : profile.satisfiedPct,
    baselineMain: profile.baselineSatisfiedPct,
    unit: "% satisfied (MOCK)",
    change: profile.satisfiedPct - profile.baselineSatisfiedPct,
    breakdown: { ...profile.breakdown },
    baselineBreakdown: { ...profile.baselineBreakdown },
  };
}
