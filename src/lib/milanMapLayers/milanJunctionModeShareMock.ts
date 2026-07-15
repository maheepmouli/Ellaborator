import type { MilanModeTotals } from "@/lib/milanModeBreakdown";
import { finalizeMilanModeTotals } from "@/lib/milanModeBreakdown";
import type { LocalCityPoint } from "@/services/localCityData";
import type { MilanSegmentRecord } from "@/services/milanSegmentData";
import { haversineMeters } from "@/lib/issyPilot2Junction";
import {
  MILAN_MODE_SHARE_JUNCTION_LIMIT,
  MILAN_MODE_SHARE_JUNCTION_MIN,
  type MilanJunctionAnchor,
  selectMajorJunctionsFromSpeedSegments,
} from "./milanJunctionAnchors";

const FLOW_SPECS = [
  { flowId: "sb", flowLabel: "Southbound" },
  { flowId: "nb", flowLabel: "Northbound" },
  { flowId: "eb", flowLabel: "Eastbound" },
] as const;

function seededUnit(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return (hash % 1000) / 1000;
}

function buildIllustrativeModeTotals(
  seed: string,
  phase: "pre" | "post",
  junctionIndex: number
): MilanModeTotals {
  const bikeBase = 35 + seededUnit(`${seed}-bike`) * 220 + junctionIndex * 9;
  const pedBase = 18 + seededUnit(`${seed}-ped`) * 95;
  const carBase = 160 + seededUnit(`${seed}-car`) * 520;
  const ptwBase = 8 + seededUnit(`${seed}-ptw`) * 72;
  const ptBase = 12 + seededUnit(`${seed}-pt`) * 110;

  const interventionBoost = phase === "post" ? 1.06 : 1;
  const carScale = phase === "post" ? 0.94 : 1;

  return finalizeMilanModeTotals({
    bike: Math.round(bikeBase * interventionBoost),
    pedestrian: Math.round(pedBase * interventionBoost),
    motorised: Math.round(carBase * carScale),
    ptw: Math.round(ptwBase),
    pt: Math.round(ptBase * (phase === "post" ? 1.04 : 1)),
    total: 0,
  });
}

function sustainableSharePct(totals: MilanModeTotals): number {
  if (totals.total <= 0) return 0;
  return ((totals.bike + totals.pedestrian) / totals.total) * 100;
}

function segmentMidpoint(segment: MilanSegmentRecord): { lat: number; lon: number } | null {
  const coords = segment.coordinates;
  if (!coords || coords.length < 2) return null;
  const mid = coords[Math.floor(coords.length / 2)];
  return { lat: mid[0], lon: mid[1] };
}

/** Ensure 6–8 presentation junctions even when the graph yields few high-degree nodes. */
export function pickJunctionsForModeSharePresentation(
  records: MilanSegmentRecord[],
  min = MILAN_MODE_SHARE_JUNCTION_MIN,
  max = MILAN_MODE_SHARE_JUNCTION_LIMIT
): MilanJunctionAnchor[] {
  const primary = selectMajorJunctionsFromSpeedSegments(records, max);
  if (primary.length >= min) {
    return primary.slice(0, max);
  }

  const picked = [...primary];
  const usedKeys = new Set(picked.map((j) => `${j.lat.toFixed(4)},${j.lon.toFixed(4)}`));

  const segmentCandidates = [...records]
    .map((segment) => {
      const midpoint = segmentMidpoint(segment);
      if (!midpoint) return null;
      return {
        segment,
        midpoint,
        hits: Number(segment.properties?.hits ?? 1),
        pressure: Number(segment.value ?? 0),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null)
    .sort((a, b) => b.hits + b.pressure - (a.hits + a.pressure));

  for (const candidate of segmentCandidates) {
    if (picked.length >= min) break;
    const tooClose = picked.some(
      (junction) =>
        haversineMeters(
          junction.lat,
          junction.lon,
          candidate.midpoint.lat,
          candidate.midpoint.lon
        ) < 120
    );
    const key = `${candidate.midpoint.lat.toFixed(4)},${candidate.midpoint.lon.toFixed(4)}`;
    if (tooClose || usedKeys.has(key)) continue;

    const street = String(candidate.segment.properties?.streetName ?? "Corridor node");
    picked.push({
      id: `mil-junction-${picked.length + 1}`,
      lat: candidate.midpoint.lat,
      lon: candidate.midpoint.lon,
      label: street,
      degree: 1,
      score: candidate.hits + candidate.pressure,
      streetNames: [street],
    });
    usedKeys.add(key);
  }

  return picked.slice(0, max);
}

/**
 * Copenhagen-style illustrative mode-share flows at safety-network junction hubs.
 * Deterministic per junction — labelled mock in UI/provenance.
 */
export function buildMilanJunctionModeShareMockPoints(
  junctions: MilanJunctionAnchor[],
  pilotId: string
): LocalCityPoint[] {
  const points: LocalCityPoint[] = [];

  junctions.forEach((junction, junctionIndex) => {
    FLOW_SPECS.forEach((flow, flowIndex) => {
      const seed = `${pilotId}-${junction.id}-${flow.flowId}`;
      const pre = buildIllustrativeModeTotals(seed, "pre", junctionIndex + flowIndex);
      const post = buildIllustrativeModeTotals(seed, "post", junctionIndex + flowIndex);
      const baselineValue = sustainableSharePct(pre);
      const interventionValue = sustainableSharePct(post);

      points.push({
        id: `milan-mock-kpi1.2-${junction.id}-${flow.flowId}`,
        lat: junction.lat,
        lon: junction.lon,
        value: interventionValue,
        properties: {
          dataOrigin: "mock",
          datasetKind: "amat-count",
          type: "mock",
          parserStatus: "illustrative",
          interventionId: pilotId,
          junctionId: junction.id,
          junctionLabel: junction.label,
          siteKey: junction.id,
          flowId: flow.flowId,
          segmentId: `${junction.id}-${flow.flowId}`,
          streetName: `${junction.label} · ${flow.flowLabel}`,
          direction: flow.flowLabel,
          mode: flow.flowLabel,
          baselineValue,
          interventionValue,
          comparisonValue: interventionValue - baselineValue,
          modeBreakdown: { pre, post },
          source: "Illustrative junction mode-share (KPI 2.1 network anchors)",
          method: "Copenhagen-style mock presentation at major safety junctions",
          spatialNote:
            "Illustrative mode-share proxy for stakeholder demo — not AMAT field counts",
          temporalCoverage: "illustrative",
          spatialQuality: "inferred",
          locationMethod: "safety_network_junction",
          peakWindow: "8:30–9:30 (illustrative)",
        },
      });
    });
  });

  return points;
}
