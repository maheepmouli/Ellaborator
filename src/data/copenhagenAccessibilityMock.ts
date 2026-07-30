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
  | "Inclusive design"
  | "Cycle parking";

export interface CphAccessibilitySampleMock {
  id: string;
  segmentId: string;
  lat: number;
  lon: number;
  label: string;
  streetName: string;
  dimension: CphAccessibilityDimension;
  /** Icon taxonomy category for map badges. */
  facilityCategory: string;
  accessScore: number;
  baselineScore: number;
  /** Baseline shows 3; intervention adds a 4th site. */
  visibleIn: Array<"baseline" | "intervention">;
}

export interface CphAccessibilityPilotMock {
  pilotId: CopenhagenPilotId;
  title: string;
  accessPct: number;
  baselineAccessPct: number;
  confidencePct: number;
  breakdown: Record<string, number>;
  baselineBreakdown: Record<string, number>;
  samples: CphAccessibilitySampleMock[];
  disclaimer: string;
  methodology: string;
}

const BASELINE_DIMENSIONS: CphAccessibilityDimension[] = [
  "Perceived security",
  "Access ease",
  "Inclusive design",
];

const FACILITY_FOR_DIMENSION: Record<CphAccessibilityDimension, string> = {
  "Perceived security": "Accessibility",
  "Access ease": "Accessibility",
  "Inclusive design": "Pedestrian",
  "Cycle parking": "Cycle parking",
};

/** Small ring offsets so 3–4 pins stay readable on the Vandkunsten corridor. */
const SAMPLE_OFFSETS: Array<{ dLat: number; dLon: number }> = [
  { dLat: 0.00042, dLon: -0.00018 },
  { dLat: -0.00012, dLon: 0.00048 },
  { dLat: -0.00048, dLon: -0.00022 },
  { dLat: 0.00028, dLon: 0.00052 },
];

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

/**
 * Exactly 3 baseline pins + 4 intervention pins (3 shared + 1 new cycle-parking site).
 */
function buildSamples(
  pilotId: CopenhagenPilotId,
  accessPct: number,
  baselinePct: number
): CphAccessibilitySampleMock[] {
  const sites = modeShareSitesForPilot(pilotId);
  const anchor = sites[0] ?? {
    id: `${pilotId}-anchor`,
    name: "Corridor hub",
    lat: 55.676056,
    lon: 12.574152,
    otcWorkbookKey: "vandkunsten",
  };

  const samples: CphAccessibilitySampleMock[] = [];

  for (let i = 0; i < 4; i += 1) {
    const offset = SAMPLE_OFFSETS[i]!;
    const isExtra = i === 3;
    const dimension: CphAccessibilityDimension = isExtra
      ? "Cycle parking"
      : BASELINE_DIMENSIONS[i]!;
    const site = sites[i % Math.max(sites.length, 1)] ?? anchor;
    const accessScore = hashScore(`${pilotId}-a11y-post-${i}`, accessPct);
    const baselineScore = hashScore(`${pilotId}-a11y-pre-${i}`, baselinePct, 10);
    const streetName = isExtra
      ? `${site.name ?? anchor.name} · new bay`
      : String(site.name ?? anchor.name);

    samples.push({
      id: `cph-mock-a11y-${pilotId}-${i + 1}`,
      segmentId: `cph-mock-a11y-${pilotId}-${i + 1}`,
      lat: Number(site.lat ?? anchor.lat) + offset.dLat,
      lon: Number(site.lon ?? anchor.lon) + offset.dLon,
      label: `${dimension} · ${streetName}`,
      streetName,
      dimension,
      facilityCategory: FACILITY_FOR_DIMENSION[dimension],
      accessScore,
      baselineScore,
      visibleIn: isExtra ? ["intervention"] : ["baseline", "intervention"],
    });
  }

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
    "Cycle parking": hashScore(`${pilotId}-park`, accessPct + 5, 4),
  };
  const baselineBreakdown = {
    "Perceived security": hashScore(`${pilotId}-sec-b`, baselineAccessPct, 4),
    "Access ease": hashScore(`${pilotId}-ease-b`, baselineAccessPct - 2, 5),
    "Inclusive design": hashScore(`${pilotId}-incl-b`, baselineAccessPct + 1, 5),
  };

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
  "cph-p2": buildPilotMock(
    "cph-p2",
    "MOCK accessibility — Vandkunsten mode-share corridor (Pilot 2)",
    70,
    63
  ),
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
  const phase: "baseline" | "intervention" = useBaseline ? "baseline" : "intervention";
  return profile.samples
    .filter((sample) => sample.visibleIn.includes(phase))
    .map((sample) => {
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
          facilityCategory: sample.facilityCategory,
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
    unit: "accessible",
    change: profile.accessPct - profile.baselineAccessPct,
    breakdown: { ...profile.breakdown },
    baselineBreakdown: { ...profile.baselineBreakdown },
  };
}

/** Equal access / Baseline / Change — same pattern as Milan / Issy observatory cards. */
export function copenhagenAccessibilityStatCards(
  profile: CphAccessibilityPilotMock,
  scenario: ScenarioType = "intervention"
): Array<{ label: string; value: string; color?: string; note?: string; icon?: string }> {
  const post = profile.accessPct;
  const baseline = profile.baselineAccessPct;
  const delta = post - baseline;
  const baselineCount = profile.samples.filter((s) => s.visibleIn.includes("baseline")).length;
  const interventionCount = profile.samples.filter((s) =>
    s.visibleIn.includes("intervention")
  ).length;
  const pinCount = scenario === "baseline" ? baselineCount : interventionCount;
  return [
    {
      label: "Equal access (post)",
      value: `${Math.round(post)}%`,
      color: "#63ccff",
      note: `${pinCount} map pin${pinCount === 1 ? "" : "s"} · ${baselineCount} before → ${interventionCount} after`,
      icon: "accessibility",
    },
    {
      label: "Baseline",
      value: `${Math.round(baseline)}%`,
      note: `${baselineCount} corridor samples`,
      icon: "baseline",
    },
    {
      label: "Change",
      value: `${delta >= 0 ? "+" : ""}${Math.round(delta)} pp`,
      note: `+${interventionCount - baselineCount} site after intervention`,
      icon: "change",
    },
  ];
}
