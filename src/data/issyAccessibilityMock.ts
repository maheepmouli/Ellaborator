import {
  ISSY_JUNCTION_ARMS,
  ISSY_P2_JUNCTION,
  type IssyJunctionArmId,
} from "@/lib/issyPilot2Junction";
import { placeAccessibilityPointOnJunctionArm } from "@/lib/issyJunctionArmPlacement";
import { isIssyCityWideModeSharePilot, type IssyPilotId } from "@/data/issyPilotProfiles";
import { getIssyZoneCentroids } from "@/services/issyFlowData";
import { issyZoneSegmentId } from "@/lib/issyFlowAggregates";
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

/** Pont d'Issy flagship — junction-arm slots only. */
const PILOT1_ARM_SLOTS: IssyJunctionArmId[] = ["west", "east", "south", "west", "east"];

const SLOT_CATEGORIES: IssyAccessibilityCategory[] = [
  "Tactile Paving",
  "Ramps",
  "Audio Signals",
  "Dropped Kerbs",
  "Contrasting strips",
  "Rest Areas",
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

function featureStatus(
  index: number,
  total: number
): IssyAccessibilityFeatureMock["status"] {
  if (index === 0 || (total > 3 && index === 1)) return "existing";
  if (index === total - 1 && total > 2) return "planned";
  return "post-intervention";
}

function placeFeaturesOnJunctionArms(pilotId: IssyPilotId): IssyAccessibilityFeatureMock[] {
  const slots = PILOT1_ARM_SLOTS;

  return slots.map((armId, index) => {
    const arm = getArm(armId);
    const category = SLOT_CATEGORIES[index % SLOT_CATEGORIES.length];
    const u = seededUnit(pilotId, index);
    const [lat, lon] = placeAccessibilityPointOnJunctionArm(armId, index);
    const qualityScore = Math.round(62 + u * 28);
    const baselineScore = Math.max(32, Math.round(qualityScore - 10 - (index % 4) * 3));

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
      status: featureStatus(index, slots.length),
    };
  });
}

/**
 * Pilot 2 / Pilot 3 — one mock accessibility asset near each ISSY1 mode-share OD zone hub
 * (same six points as KPI 1.2 city view), with a small sidewalk offset so pins don't stack.
 */
function placeFeaturesNearModeShareZones(pilotId: IssyPilotId): IssyAccessibilityFeatureMock[] {
  const zones = getIssyZoneCentroids();
  // Slight N/E/S/W offsets (~40–70 m) so accessibility sits beside the ripple hub.
  const offsets: Array<[number, number]> = [
    [0.00042, 0.00018],
    [-0.00028, 0.00045],
    [0.00035, -0.00038],
    [-0.00045, -0.00022],
    [0.00018, 0.00052],
    [-0.00038, 0.00012],
  ];

  return zones.map((zone, index) => {
    const category = SLOT_CATEGORIES[index % SLOT_CATEGORIES.length];
    const u = seededUnit(pilotId, index);
    const [dLat, dLon] = offsets[index % offsets.length];
    const lat = zone.lat + dLat;
    const lon = zone.lon + dLon;
    const qualityScore = Math.round(62 + u * 28);
    const baselineScore = Math.max(32, Math.round(qualityScore - 10 - (index % 4) * 3));

    return {
      id: `${pilotId}-a11y-zone-${zone.zone}`,
      segmentId: issyZoneSegmentId(zone.zone),
      lat,
      lon,
      category,
      label: `${category} · ${zone.label}`,
      armLabel: zone.label,
      qualityScore,
      baselineScore,
      status: featureStatus(index, zones.length),
    };
  });
}

function placeFeaturesForPilot(pilotId: IssyPilotId): IssyAccessibilityFeatureMock[] {
  if (isIssyCityWideModeSharePilot(pilotId)) {
    return placeFeaturesNearModeShareZones(pilotId);
  }
  return placeFeaturesOnJunctionArms(pilotId);
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
  const features = placeFeaturesForPilot(pilotId);
  const interventionFeatures = features.filter((f) => f.status !== "planned");
  const baselineFeatures = features.filter((f) => f.status === "existing");
  const cityWide = isIssyCityWideModeSharePilot(pilotId);
  const core = getIssyZoneCentroids().find((z) => z.zone === 3);
  return {
    pilotId,
    anchor: cityWide
      ? { lat: core?.lat ?? ISSY_P2_JUNCTION.lat, lon: core?.lon ?? ISSY_P2_JUNCTION.lon }
      : { lat: ISSY_P2_JUNCTION.lat, lon: ISSY_P2_JUNCTION.lon },
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
    title: "City OD hubs — mock accessibility (6 zones)",
    reachScore: 69,
    compositeIndex: 68,
    baselineIndex: 55,
    confidencePct: 58,
    methodology:
      "Six mock assets placed beside the ISSY1 mode-share OD zone hubs (same city footprint as KPI 1.2) — inventory proxy, not field survey.",
  }),
  "issy-p3": buildProfile("issy-p3", {
    title: "City OD hubs — mock accessibility (6 zones)",
    reachScore: 69,
    compositeIndex: 68,
    baselineIndex: 55,
    confidencePct: 58,
    methodology:
      "Six mock walkability assets beside the same ISSY1 mode-share OD zone hubs as Pilot 2 — matched city scale, not a certified audit.",
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
        locationMethod: feature.segmentId.startsWith("issy-zone-")
          ? "mode_share_zone_hub"
          : "junction_sidewalk_placement",
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
    unit: "Index",
    change: profile.totalFeatures - profile.baselineFeatureCount,
    breakdown: { ...profile.breakdown },
    baselineBreakdown: { ...profile.baselineBreakdown },
  };
}

/** Equal access / Baseline / Change cards — same pattern as Milan DSS observatory. */
export function issyAccessibilityStatCards(
  profile: IssyAccessibilityPilotMock,
  _scenario: ScenarioType = "intervention"
): Array<{ label: string; value: string; color?: string; note?: string }> {
  const post = profile.compositeIndex;
  const baseline = profile.baselineIndex;
  const delta = post - baseline;
  return [
    {
      label: "Equal access (post)",
      value: `${post.toFixed(1)}%`,
      color: "#63ccff",
      note: "Issy mock accessibility inventory",
    },
    {
      label: "Baseline",
      value: `${baseline.toFixed(1)}%`,
      note: `${profile.baselineFeatureCount} category row${profile.baselineFeatureCount === 1 ? "" : "s"}`,
    },
    {
      label: "Change",
      value: `${delta >= 0 ? "+" : ""}${delta.toFixed(1)} pp`,
      note: "Derived · pilot-scoped",
    },
  ];
}
