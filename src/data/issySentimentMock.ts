import { ISSY_P2_JUNCTION } from "@/lib/issyPilot2Junction";
import { isIssyCityWideModeSharePilot, type IssyPilotId } from "@/data/issyPilotProfiles";
import { getIssyZoneCentroids } from "@/services/issyFlowData";
import { issyZoneSegmentId } from "@/lib/issyFlowAggregates";
import type { LocalCityPoint } from "@/services/localCityData";
import type { ScenarioType } from "@/types/normalized-city-data";

export const ISSY_SENTIMENT_MOCK_DISCLAIMER =
  "Mock GecoAir satisfaction samples for dashboard demonstration — structured like survey responses but not linked to a live citizen feed.";

export type IssySentimentDimension =
  | "Physical Accessibility"
  | "Safety & Security"
  | "General Satisfaction";

export interface IssySentimentSampleMock {
  id: string;
  segmentId: string;
  lat: number;
  lon: number;
  label: string;
  armLabel: string;
  dimension: IssySentimentDimension;
  satisfactionScore: number;
  baselineScore: number;
  responseWindow: string;
}

export interface IssySentimentPilotMock {
  pilotId: IssyPilotId;
  title: string;
  anchor: { lat: number; lon: number };
  satisfiedPct: number;
  baselineSatisfiedPct: number;
  confidencePct: number;
  breakdown: Record<IssySentimentDimension, number>;
  baselineBreakdown: Record<IssySentimentDimension, number>;
  samples: IssySentimentSampleMock[];
  disclaimer: string;
  methodology: string;
}

const ZONE_DIMENSIONS: IssySentimentDimension[] = [
  "General Satisfaction",
  "Safety & Security",
  "Physical Accessibility",
  "General Satisfaction",
  "Safety & Security",
  "Physical Accessibility",
];

/**
 * Slight offsets (~50–80 m) so satisfaction pins sit beside mode-share / accessibility hubs,
 * not stacked on the same pixel.
 */
const ZONE_OFFSETS: Array<[number, number]> = [
  [-0.00048, 0.00022],
  [0.00032, -0.00042],
  [-0.00022, -0.00048],
  [0.00048, 0.00028],
  [-0.00035, 0.00045],
  [0.00028, -0.00018],
];

function placeSamplesNearModeShareZones(
  pilotId: IssyPilotId,
  profile: Omit<IssySentimentPilotMock, "samples">
): IssySentimentSampleMock[] {
  const zones = getIssyZoneCentroids();
  const breakdownEntries = Object.entries(profile.breakdown) as [IssySentimentDimension, number][];
  const baselineEntries = Object.entries(profile.baselineBreakdown) as [
    IssySentimentDimension,
    number,
  ][];

  return zones.map((zone, index) => {
    const dimension = ZONE_DIMENSIONS[index % ZONE_DIMENSIONS.length];
    const satisfactionScore =
      breakdownEntries.find(([k]) => k === dimension)?.[1] ?? profile.satisfiedPct;
    const baselineScore =
      baselineEntries.find(([k]) => k === dimension)?.[1] ?? profile.baselineSatisfiedPct;
    const [dLat, dLon] = ZONE_OFFSETS[index % ZONE_OFFSETS.length];

    return {
      id: `${pilotId}-sentiment-zone-${zone.zone}`,
      segmentId: issyZoneSegmentId(zone.zone),
      lat: zone.lat + dLat,
      lon: zone.lon + dLon,
      label: `${dimension} · ${zone.label}`,
      armLabel: zone.label,
      dimension,
      satisfactionScore,
      baselineScore,
      responseWindow: "GecoAir mock cohort · Q3 2025",
    };
  });
}

function buildProfile(
  pilotId: IssyPilotId,
  config: {
    title: string;
    satisfiedPct: number;
    baselineSatisfiedPct: number;
    confidencePct: number;
    breakdown: Record<IssySentimentDimension, number>;
    baselineBreakdown: Record<IssySentimentDimension, number>;
    methodology: string;
  }
): IssySentimentPilotMock {
  const core = getIssyZoneCentroids().find((z) => z.zone === 3);
  const base = {
    pilotId,
    anchor: {
      lat: core?.lat ?? ISSY_P2_JUNCTION.lat,
      lon: core?.lon ?? ISSY_P2_JUNCTION.lon,
    },
    disclaimer: ISSY_SENTIMENT_MOCK_DISCLAIMER,
    ...config,
  };
  return {
    ...base,
    samples: placeSamplesNearModeShareZones(pilotId, base),
  };
}

const CITY_WIDE_SENTIMENT_CONFIG = {
  title: "City OD hubs — mock satisfaction (6 zones)",
  satisfiedPct: 82,
  baselineSatisfiedPct: 66,
  confidencePct: 54,
  breakdown: {
    "Physical Accessibility": 78,
    "Safety & Security": 85,
    "General Satisfaction": 84,
  } as Record<IssySentimentDimension, number>,
  baselineBreakdown: {
    "Physical Accessibility": 62,
    "Safety & Security": 69,
    "General Satisfaction": 68,
  } as Record<IssySentimentDimension, number>,
  methodology:
    "Six mock survey samples beside the ISSY1 mode-share OD zone hubs (same city footprint as KPI 1.2 / 4.2). Headline 82% is a demo anchor; per-hub values are mock cohort scores.",
};

const ISSY_SENTIMENT_BY_PILOT: Partial<Record<IssyPilotId, IssySentimentPilotMock>> = {
  "issy-p2": buildProfile("issy-p2", CITY_WIDE_SENTIMENT_CONFIG),
  "issy-p3": buildProfile("issy-p3", CITY_WIDE_SENTIMENT_CONFIG),
};

export function getIssySentimentMock(
  pilotId: string | null | undefined
): IssySentimentPilotMock | null {
  if (!pilotId || !(pilotId in ISSY_SENTIMENT_BY_PILOT)) return null;
  return ISSY_SENTIMENT_BY_PILOT[pilotId as IssyPilotId] ?? null;
}

/** True when this Issy pilot uses city OD hubs for satisfaction (same as accessibility). */
export function isIssyCityWideSentimentPilot(pilotId: string | null | undefined): boolean {
  return isIssyCityWideModeSharePilot(pilotId) && Boolean(getIssySentimentMock(pilotId));
}

export function issySentimentToLocalPoints(
  profile: IssySentimentPilotMock,
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
        datasetKind: "sentiment",
        category: sample.dimension,
        likertLabel: sample.dimension,
        source: "Issy mock GecoAir satisfaction",
        method: profile.methodology,
        pilotId: profile.pilotId,
        parserStatus: "mock",
        spatialQuality: "matched",
        locationMethod: sample.segmentId.startsWith("issy-zone-")
          ? "mode_share_zone_hub"
          : "junction_arm_placement",
        spatialNote: profile.disclaimer,
        baselineValue,
        interventionValue,
        comparisonValue: interventionValue - baselineValue,
        featureLabel: sample.label,
        segmentId: sample.segmentId,
        streetName: sample.armLabel,
        mockDisclaimer: ISSY_SENTIMENT_MOCK_DISCLAIMER,
        responseWindow: sample.responseWindow,
      },
    };
  });
}

export function issySentimentKpiHeadline(
  profile: IssySentimentPilotMock,
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
  const mainValue = useBaseline ? profile.baselineSatisfiedPct : profile.satisfiedPct;
  const breakdown = useBaseline ? profile.baselineBreakdown : profile.breakdown;
  return {
    mainValue,
    baselineMain: profile.baselineSatisfiedPct,
    unit: "% satisfied (mock)",
    change: profile.satisfiedPct - profile.baselineSatisfiedPct,
    breakdown: { ...breakdown },
    baselineBreakdown: { ...profile.baselineBreakdown },
  };
}

export function issySentimentAverageFromSamples(
  profile: IssySentimentPilotMock,
  scenario: ScenarioType = "intervention"
): number {
  const points = issySentimentToLocalPoints(profile, scenario);
  if (!points.length) return profile.satisfiedPct;
  return Math.round(points.reduce((sum, p) => sum + p.value, 0) / points.length);
}
