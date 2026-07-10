import {
  ISSY_JUNCTION_ARMS,
  ISSY_P2_JUNCTION,
  type IssyJunctionArmId,
} from "@/lib/issyPilot2Junction";
import { destinationLatLng } from "@/lib/copenhagenMapLayers/copenhagenFlowGeometry";
import type { IssyPilotId } from "@/data/issyPilotProfiles";
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

const ARM_BEARING: Record<IssyJunctionArmId, number> = {
  west: 270,
  east: 90,
  north: 355,
  south: 175,
};

/** Survey slots on KPI 1.2 mode-share corridor arms only. */
const PILOT_SENTIMENT_ARMS: Partial<Record<IssyPilotId, IssyJunctionArmId[]>> = {
  "issy-p3": ["north", "east", "south"],
};

const ARM_DIMENSIONS: IssySentimentDimension[] = [
  "General Satisfaction",
  "Safety & Security",
  "Physical Accessibility",
];

function getArm(armId: IssyJunctionArmId) {
  return ISSY_JUNCTION_ARMS.find((a) => a.id === armId)!;
}

function placeSamplesOnArms(pilotId: IssyPilotId, profile: Omit<IssySentimentPilotMock, "samples">): IssySentimentSampleMock[] {
  const arms = PILOT_SENTIMENT_ARMS[pilotId] ?? [];
  const { lat: hubLat, lon: hubLon } = ISSY_P2_JUNCTION;
  const breakdownEntries = Object.entries(profile.breakdown) as [IssySentimentDimension, number][];
  const baselineEntries = Object.entries(profile.baselineBreakdown) as [IssySentimentDimension, number][];

  return arms.map((armId, index) => {
    const arm = getArm(armId);
    const dimension = ARM_DIMENSIONS[index % ARM_DIMENSIONS.length];
    const satisfactionScore = breakdownEntries.find(([k]) => k === dimension)?.[1] ?? profile.satisfiedPct;
    const baselineScore = baselineEntries.find(([k]) => k === dimension)?.[1] ?? profile.baselineSatisfiedPct;
    const distanceM = 72 + index * 16;
    const [lat, lon] = destinationLatLng(hubLat, hubLon, ARM_BEARING[armId], distanceM);

    return {
      id: `${pilotId}-sentiment-${armId}`,
      segmentId: arm.segmentId,
      lat,
      lon,
      label: `${dimension} · ${arm.mapLabel}`,
      armLabel: arm.mapLabel,
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
  const base = {
    pilotId,
    anchor: { lat: ISSY_P2_JUNCTION.lat, lon: ISSY_P2_JUNCTION.lon },
    disclaimer: ISSY_SENTIMENT_MOCK_DISCLAIMER,
    ...config,
  };
  return {
    ...base,
    samples: placeSamplesOnArms(pilotId, base),
  };
}

const ISSY_SENTIMENT_BY_PILOT: Partial<Record<IssyPilotId, IssySentimentPilotMock>> = {
  "issy-p3": buildProfile("issy-p3", {
    title: "GecoAir corridor — mock satisfaction (3 arms)",
    satisfiedPct: 82,
    baselineSatisfiedPct: 66,
    confidencePct: 54,
    breakdown: {
      "Physical Accessibility": 78,
      "Safety & Security": 85,
      "General Satisfaction": 84,
    },
    baselineBreakdown: {
      "Physical Accessibility": 62,
      "Safety & Security": 69,
      "General Satisfaction": 68,
    },
    methodology:
      "Three mock survey samples on north / east / south corridor arms where KPI 1.2 mode-share segments are monitored. Headline 82% matches registry demo anchor; per-arm hover values are mock cohort scores.",
  }),
};

export function getIssySentimentMock(
  pilotId: string | null | undefined
): IssySentimentPilotMock | null {
  if (!pilotId || !(pilotId in ISSY_SENTIMENT_BY_PILOT)) return null;
  return ISSY_SENTIMENT_BY_PILOT[pilotId as IssyPilotId] ?? null;
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
        locationMethod: "junction_arm_placement",
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
