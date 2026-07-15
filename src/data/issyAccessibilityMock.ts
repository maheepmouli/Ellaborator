import {
  ISSY_JUNCTION_ARMS,
  ISSY_P2_JUNCTION,
  type IssyJunctionArmId,
} from "@/lib/issyPilot2Junction";
import { placeFieldPointOnJunctionArm } from "@/lib/issyJunctionArmPlacement";
import type { IssyPilotId } from "@/data/issyPilotProfiles";
import type { LocalCityPoint } from "@/services/localCityData";
import type { ScenarioType } from "@/types/normalized-city-data";

export const ISSY_ACCESSIBILITY_MOCK_DISCLAIMER =
  "Mock accessibility inventory for dashboard demonstration — structured like a field audit but not verified against EN 17210 / on-site survey.";

export type IssyAccessibilityCategory =
  | "Ramps"
  | "Tactile Paving"
  | "Audio Signals"
  | "Rest Areas"
  | "Dropped Kerbs"
  | "Contrasting strips";

export interface IssyAccessibilityFeatureMock {
  id: string;
  segmentId: string;
  lat: number;
  lon: number;
  category: IssyAccessibilityCategory;
  label: string;
  armLabel: string;
  qualityScore: number;
  status: "existing" | "post-intervention" | "planned";
}

export interface IssyAccessibilityPilotMock {
  pilotId: IssyPilotId;
  title: string;
  anchor: { lat: number; lon: number };
  reachScore: number;
  compositeIndex: number;
  baselineIndex: number;
  totalFeatures: number;
  confidencePct: number;
  breakdown: Record<string, number>;
  features: IssyAccessibilityFeatureMock[];
  disclaimer: string;
  methodology: string;
}

const ARM_FIELD_DISTANCE_M: Record<IssyJunctionArmId, number> = {
  west: 38,
  east: 44,
  north: 52,
  south: 48,
};

/** Which junction arms get a mock asset — only on KPI 1.2 corridor segments. */
const PILOT_ARM_SLOTS: Record<IssyPilotId, IssyJunctionArmId[]> = {
  "issy-p1": ["west", "east", "south", "west", "east"],
  "issy-p2": ["west", "east", "south", "west", "east"],
  "issy-p3": ["west", "east", "south"],
};

const SLOT_CATEGORIES: IssyAccessibilityCategory[] = [
  "Tactile Paving",
  "Ramps",
  "Audio Signals",
  "Dropped Kerbs",
  "Contrasting strips",
];

function seededUnit(seed: string, index: number): number {
  let h = 0;
  const key = `${seed}:${index}`;
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return (h % 10_000) / 10_000;
}

function getArm(armId: IssyJunctionArmId) {
  return ISSY_JUNCTION_ARMS.find((a) => a.id === armId)!;
}

function placeFeaturesOnJunctionArms(pilotId: IssyPilotId): IssyAccessibilityFeatureMock[] {
  const slots = PILOT_ARM_SLOTS[pilotId];

  return slots.map((armId, index) => {
    const arm = getArm(armId);
    const category = SLOT_CATEGORIES[index % SLOT_CATEGORIES.length];
    const u = seededUnit(pilotId, index);
    const distanceM = ARM_FIELD_DISTANCE_M[armId] + index * 11 + u * 9;
    const [lat, lon] = placeFieldPointOnJunctionArm(armId, distanceM);
    const qualityScore = Math.round(58 + u * 32);
    const status: IssyAccessibilityFeatureMock["status"] =
      u > 0.7 ? "post-intervention" : u > 0.2 ? "existing" : "planned";

    return {
      id: `${pilotId}-a11y-${armId}-${index + 1}`,
      segmentId: arm.segmentId,
      lat,
      lon,
      category,
      label: `${category} · ${arm.mapLabel}`,
      armLabel: arm.mapLabel,
      qualityScore,
      status,
    };
  });
}

function breakdownFromFeatures(features: IssyAccessibilityFeatureMock[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const f of features) {
    counts[f.category] = (counts[f.category] ?? 0) + 1;
  }
  return counts;
}

function buildProfile(
  pilotId: IssyPilotId,
  config: {
    title: string;
    reachScore: number;
    compositeIndex: number;
    baselineIndex: number;
    confidencePct: number;
    methodology: string;
  }
): IssyAccessibilityPilotMock {
  const features = placeFeaturesOnJunctionArms(pilotId);
  return {
    pilotId,
    anchor: { lat: ISSY_P2_JUNCTION.lat, lon: ISSY_P2_JUNCTION.lon },
    totalFeatures: features.length,
    breakdown: breakdownFromFeatures(features),
    features,
    disclaimer: ISSY_ACCESSIBILITY_MOCK_DISCLAIMER,
    ...config,
  };
}

const ISSY_ACCESSIBILITY_BY_PILOT: Record<IssyPilotId, IssyAccessibilityPilotMock> = {
  "issy-p1": buildProfile("issy-p1", {
    title: "Pont d'Issy corridor — mock accessibility (5 arms)",
    reachScore: 74,
    compositeIndex: 72,
    baselineIndex: 64,
    confidencePct: 62,
    methodology:
      "Five mock assets on ISSY1 mode-share corridor arms only (traficissy segments at Pont d'Issy). Not a certified audit.",
  }),
  "issy-p2": buildProfile("issy-p2", {
    title: "Observatory corridor — mock accessibility (5 arms)",
    reachScore: 69,
    compositeIndex: 68,
    baselineIndex: 61,
    confidencePct: 58,
    methodology:
      "Five mock assets placed on the same three junction arms used for KPI 1.2 mode-share context — city inventory proxy, not field survey.",
  }),
  "issy-p3": buildProfile("issy-p3", {
    title: "GecoAir corridor — mock accessibility (3 arms)",
    reachScore: 61,
    compositeIndex: 59,
    baselineIndex: 54,
    confidencePct: 54,
    methodology:
      "Three mock walkability assets on west / east / south corridor arms where mode-share segments are monitored.",
  }),
};

export function getIssyAccessibilityMock(
  pilotId: string | null | undefined
): IssyAccessibilityPilotMock | null {
  if (!pilotId || !(pilotId in ISSY_ACCESSIBILITY_BY_PILOT)) return null;
  return ISSY_ACCESSIBILITY_BY_PILOT[pilotId as IssyPilotId];
}

export function issyAccessibilityToLocalPoints(
  profile: IssyAccessibilityPilotMock,
  scenario: ScenarioType = "intervention"
): LocalCityPoint[] {
  const useBaseline = scenario === "baseline";
  return profile.features.map((feature, index) => {
    const baselineValue = Math.max(35, feature.qualityScore - 8 - (index % 5));
    const interventionValue = feature.qualityScore;
    const value = useBaseline ? baselineValue : interventionValue;
    return {
      lat: feature.lat,
      lon: feature.lon,
      value,
      id: feature.id,
      properties: {
        type: "mock",
        dataOrigin: "mock",
        datasetKind: "accessibility",
        facilityCategory: feature.category,
        category: feature.category,
        source: "Issy mock accessibility inventory",
        method: profile.methodology,
        pilotId: profile.pilotId,
        parserStatus: "mock",
        spatialQuality: "matched",
        locationMethod: "junction_arm_placement",
        spatialNote: profile.disclaimer,
        baselineValue,
        interventionValue,
        comparisonValue: interventionValue - baselineValue,
        featureStatus: feature.status,
        featureLabel: feature.label,
        segmentId: feature.segmentId,
        streetName: feature.armLabel,
        mockDisclaimer: ISSY_ACCESSIBILITY_MOCK_DISCLAIMER,
      },
    };
  });
}

export function issyAccessibilityKpiHeadline(profile: IssyAccessibilityPilotMock): {
  mainValue: number;
  unit: string;
  change: number;
  breakdown: Record<string, number>;
} {
  return {
    mainValue: profile.totalFeatures,
    unit: "features (mock)",
    change: Math.max(1, profile.totalFeatures - 1),
    breakdown: { ...profile.breakdown },
  };
}
