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
  baselineScore: number;
  /** existing = present in baseline; post-intervention = added after; planned = not yet installed */
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
  baselineFeatureCount: number;
  confidencePct: number;
  breakdown: Record<string, number>;
  baselineBreakdown: Record<string, number>;
  features: IssyAccessibilityFeatureMock[];
  disclaimer: string;
  methodology: string;
}

/** Distances along carriageway stubs — keep markers on the road near the junction. */
const ARM_FIELD_DISTANCE_M: Record<IssyJunctionArmId, number> = {
  west: 32,
  east: 36,
  north: 40,
  south: 34,
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
    // Stagger along the arm so west/east duplicates don't stack; stay within ~80 m of hub.
    const distanceM = ARM_FIELD_DISTANCE_M[armId] + index * 12 + u * 6;
    const [lat, lon] = placeFieldPointOnJunctionArm(armId, distanceM);
    const qualityScore = Math.round(62 + u * 28);
    const baselineScore = Math.max(32, Math.round(qualityScore - 10 - (index % 4) * 3));
    // Deterministic mix so every pilot always has map points + a visible before→after delta.
    // Seed-based status previously marked all issy-p1 slots "planned" → 0 map features.
    const status: IssyAccessibilityFeatureMock["status"] =
      index === 0 || (slots.length > 3 && index === 1)
        ? "existing"
        : index === slots.length - 1 && slots.length > 2
          ? "planned"
          : "post-intervention";

    return {
      id: `${pilotId}-a11y-${armId}-${index + 1}`,
      segmentId: arm.segmentId,
      lat,
      lon,
      category,
      label: `${category} · ${arm.mapLabel}`,
      armLabel: arm.mapLabel,
      qualityScore,
      baselineScore,
      status,
    };
  });
}

function scoreBreakdown(
  features: IssyAccessibilityFeatureMock[],
  period: "baseline" | "intervention"
): Record<string, number> {
  const buckets = new Map<string, { sum: number; n: number }>();
  for (const f of features) {
    if (period === "baseline" && f.status !== "existing") continue;
    if (period === "intervention" && f.status === "planned") continue;
    const score = period === "baseline" ? f.baselineScore : f.qualityScore;
    const existing = buckets.get(f.category) ?? { sum: 0, n: 0 };
    existing.sum += score;
    existing.n += 1;
    buckets.set(f.category, existing);
  }
  const out: Record<string, number> = {};
  for (const [cat, { sum, n }] of buckets) {
    out[cat] = Math.round(sum / Math.max(1, n));
  }
  return out;
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
  const interventionFeatures = features.filter((f) => f.status !== "planned");
  const baselineFeatures = features.filter((f) => f.status === "existing");
  return {
    pilotId,
    anchor: { lat: ISSY_P2_JUNCTION.lat, lon: ISSY_P2_JUNCTION.lon },
    totalFeatures: interventionFeatures.length,
    baselineFeatureCount: Math.max(1, baselineFeatures.length),
    breakdown: scoreBreakdown(features, "intervention"),
    baselineBreakdown: scoreBreakdown(features, "baseline"),
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
    baselineIndex: 58,
    confidencePct: 62,
    methodology:
      "Five mock assets on ISSY1 mode-share corridor arms only (traficissy segments at Pont d'Issy). Not a certified audit.",
  }),
  "issy-p2": buildProfile("issy-p2", {
    title: "Observatory corridor — mock accessibility (5 arms)",
    reachScore: 69,
    compositeIndex: 68,
    baselineIndex: 55,
    confidencePct: 58,
    methodology:
      "Five mock assets placed on the same three junction arms used for KPI 1.2 mode-share context — city inventory proxy, not field survey.",
  }),
  "issy-p3": buildProfile("issy-p3", {
    title: "GecoAir corridor — mock accessibility (3 arms)",
    reachScore: 61,
    compositeIndex: 59,
    baselineIndex: 48,
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

/** Features visible for the active scenario (baseline fewer; intervention adds post assets). */
export function issyAccessibilityFeaturesForScenario(
  profile: IssyAccessibilityPilotMock,
  scenario: ScenarioType = "intervention"
): IssyAccessibilityFeatureMock[] {
  if (scenario === "baseline") {
    return profile.features.filter((f) => f.status === "existing");
  }
  // Intervention + comparison: show installed assets (existing + post-intervention).
  return profile.features.filter((f) => f.status !== "planned");
}

export function issyAccessibilityToLocalPoints(
  profile: IssyAccessibilityPilotMock,
  scenario: ScenarioType = "intervention"
): LocalCityPoint[] {
  const useBaseline = scenario === "baseline";
  const visible = issyAccessibilityFeaturesForScenario(profile, scenario);
  return visible.map((feature) => {
    const baselineValue = feature.baselineScore;
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

export function issyAccessibilityKpiHeadline(
  profile: IssyAccessibilityPilotMock,
  scenario: ScenarioType = "intervention"
): {
  mainValue: number;
  unit: string;
  change: number;
  breakdown: Record<string, number>;
  baselineBreakdown: Record<string, number>;
} {
  const useBaseline = scenario === "baseline";
  return {
    mainValue: useBaseline ? profile.baselineFeatureCount : profile.totalFeatures,
    unit: "features (mock)",
    change: profile.totalFeatures - profile.baselineFeatureCount,
    breakdown: { ...profile.breakdown },
    baselineBreakdown: { ...profile.baselineBreakdown },
  };
}
