import type { LocalCityPoint } from "@/services/localCityData";
import type { SpatialRendererId } from "@/lib/spatialLayerRegistry";
import {
  getPilotGeometryRecord,
  type PilotGeometryRecord,
} from "@/lib/pilotGeometryContract";
import { trikalaMapZoom, TRIKALA_MIN_MAP_ZOOM, TRIKALA_MAX_MAP_ZOOM } from "@/lib/trikalaMapConfig";

export type RuntimeLinkage = "exact" | "matched" | "inferred";

export interface LatLngZoom {
  lat: number;
  lng: number;
  zoom: number;
}

export interface PilotGeometryRenderSpec {
  bounds: LatLngZoom | null;
  visualizationMode: SpatialRendererId;
  interactionModel:
    | "point"
    | "segment"
    | "area"
    | "network"
    | "camera"
    | "dashboard_only";
  flyToAllowed: boolean;
  minZoom?: number;
  maxZoom: number;
  labelStyle: "precise" | "aggregate";
  uncertaintyLevel: "none" | "low" | "high";
  legendHint: string;
  reductionCaption?: string;
}

export function dominantRuntimeLinkage(
  points: LocalCityPoint[]
): RuntimeLinkage | undefined {
  if (!points.length) return undefined;
  let hasExact = false;
  let hasMatched = false;
  let hasInferred = false;
  for (const point of points) {
    const linkage = String(point.properties?.geometryLinkage ?? "").toLowerCase();
    if (linkage === "exact") hasExact = true;
    else if (linkage === "matched") hasMatched = true;
    else if (linkage === "inferred") hasInferred = true;
  }
  if (hasExact) return "exact";
  if (hasMatched) return "matched";
  if (hasInferred) return "inferred";
  return undefined;
}

function boundsFromFocus(
  pilot: PilotGeometryRecord,
  defaultZoom: number
): LatLngZoom | null {
  if (!pilot.focus) return null;
  return {
    lat: pilot.focus.lat,
    lng: pilot.focus.lng,
    zoom: pilot.focus.zoom ?? defaultZoom,
  };
}

function reductionCaption(pilot: PilotGeometryRecord): string | undefined {
  if (!pilot.geometryReduction) return undefined;
  if (pilot.pilotId === "zar-p1") {
    return "Aggregated representation of 4 intervention zones";
  }
  return `Reduced from ${pilot.geometryReduction.from} to ${pilot.geometryReduction.to}: ${pilot.geometryReduction.reason}`;
}

function pointRenderer(pilot: PilotGeometryRecord): PilotGeometryRenderSpec {
  const bounds = boundsFromFocus(pilot, 14);
  return {
    bounds,
    visualizationMode: "local-points",
    interactionModel: "point",
    flyToAllowed: true,
    maxZoom: 17,
    labelStyle: "precise",
    uncertaintyLevel: "none",
    legendHint: "Point-based intervention sites and survey clusters.",
    reductionCaption: reductionCaption(pilot),
  };
}

function segmentRenderer(pilot: PilotGeometryRecord): PilotGeometryRenderSpec {
  const probabilistic = pilot.renderTier === "probabilistic";
  const bounds = boundsFromFocus(pilot, probabilistic ? 13 : 15);
  return {
    bounds,
    visualizationMode: probabilistic
      ? "milan-environment-segments"
      : "milan-speed-segments",
    interactionModel: probabilistic ? "network" : "segment",
    flyToAllowed: !probabilistic,
    maxZoom: probabilistic ? 13 : 17,
    labelStyle: probabilistic ? "aggregate" : "precise",
    uncertaintyLevel: probabilistic ? "high" : "none",
    legendHint: probabilistic
      ? "Probabilistic CO₂/noise network — not a deterministic corridor."
      : "Road segments from AMAT speed shapefiles.",
    reductionCaption: reductionCaption(pilot),
  };
}

function areaRenderer(pilot: PilotGeometryRecord): PilotGeometryRenderSpec {
  const bounds = boundsFromFocus(pilot, 14);
  return {
    bounds,
    visualizationMode: "generic-points",
    interactionModel: "area",
    flyToAllowed: true,
    maxZoom: 15,
    labelStyle: "aggregate",
    uncertaintyLevel: "low",
    legendHint: "Intervention area centroids (polygon geometry reduced for map).",
    reductionCaption: reductionCaption(pilot),
  };
}

function networkRenderer(pilot: PilotGeometryRecord): PilotGeometryRenderSpec {
  const bounds = boundsFromFocus(pilot, 12);
  return {
    bounds,
    visualizationMode: "local-points",
    interactionModel: "network",
    flyToAllowed: false,
    maxZoom: 12,
    labelStyle: "aggregate",
    uncertaintyLevel: "high",
    legendHint: "Telraam sensor network — multiple street segments, not one junction.",
    reductionCaption: reductionCaption(pilot),
  };
}

function cameraRenderer(pilot: PilotGeometryRecord): PilotGeometryRenderSpec {
  const bounds = boundsFromFocus(pilot, 17);
  return {
    bounds,
    visualizationMode: "local-points",
    interactionModel: "camera",
    flyToAllowed: true,
    maxZoom: 18,
    labelStyle: "precise",
    uncertaintyLevel: "none",
    legendHint: "OpenTrafficCam sites with directional flow counts.",
    reductionCaption: reductionCaption(pilot),
  };
}

function corridorRenderer(pilot: PilotGeometryRecord): PilotGeometryRenderSpec {
  const bounds = boundsFromFocus(pilot, 17);
  return {
    bounds,
    visualizationMode: "issy-junction-arms",
    interactionModel: "segment",
    flyToAllowed: true,
    maxZoom: 18,
    labelStyle: "precise",
    uncertaintyLevel:
      pilot.renderEligibility === "render_with_uncertainty" ? "low" : "none",
    legendHint: "Monitored intervention corridor at junction.",
    reductionCaption: reductionCaption(pilot),
  };
}

function regimeBaseSpec(pilot: PilotGeometryRecord): PilotGeometryRenderSpec {
  switch (pilot.regime) {
    case "point":
      return pointRenderer(pilot);
    case "segment":
      return segmentRenderer(pilot);
    case "area":
      return areaRenderer(pilot);
    case "hybrid_network":
      return networkRenderer(pilot);
    case "camera_directional":
      return cameraRenderer(pilot);
    case "corridor":
      return corridorRenderer(pilot);
    default:
      return pointRenderer(pilot);
  }
}

function applyInferredHardRule(
  spec: PilotGeometryRenderSpec
): PilotGeometryRenderSpec {
  return {
    ...spec,
    flyToAllowed: false,
    maxZoom: Math.min(spec.maxZoom, 12),
    labelStyle: "aggregate",
    uncertaintyLevel: "high",
  };
}

function applyUncertaintyEligibility(
  spec: PilotGeometryRenderSpec,
  pilot: PilotGeometryRecord
): PilotGeometryRenderSpec {
  if (pilot.renderEligibility !== "render_with_uncertainty") return spec;
  if (spec.uncertaintyLevel === "high") return spec;
  return {
    ...spec,
    uncertaintyLevel: spec.uncertaintyLevel === "none" ? "low" : spec.uncertaintyLevel,
  };
}

export function resolvePilotGeometryRender(input: {
  pilot: PilotGeometryRecord;
  runtimeLinkage?: RuntimeLinkage;
}): PilotGeometryRenderSpec {
  const { pilot, runtimeLinkage } = input;

  if (pilot.renderEligibility === "dashboard_only") {
    const trikalaPilot = pilot.pilotId.startsWith("tri-");
    const defaultZoom = trikalaPilot ? trikalaMapZoom() : 14;
    const bounds = boundsFromFocus(pilot, defaultZoom);
    const observedGis =
      pilot.geometryTruth.status === "exact" && pilot.geometryTruth.source === "gis";
    return {
      bounds: bounds ? { ...bounds, zoom: defaultZoom } : null,
      visualizationMode: "generic-points",
      interactionModel: "dashboard_only",
      flyToAllowed: !!bounds,
      minZoom: trikalaPilot ? TRIKALA_MIN_MAP_ZOOM : undefined,
      maxZoom: trikalaPilot ? TRIKALA_MAX_MAP_ZOOM : 14,
      labelStyle: observedGis ? "precise" : "aggregate",
      uncertaintyLevel: observedGis ? "none" : "high",
      legendHint: observedGis
        ? "Partner GIS site anchors (My Maps) — some KPI overlays use simplified corridor graphics."
        : "Survey observatory cluster — inferred anchor geometry.",
      reductionCaption: reductionCaption(pilot),
    };
  }

  let spec = regimeBaseSpec(pilot);

  if (
    pilot.geometryTruth.status === "inferred" ||
    runtimeLinkage === "inferred"
  ) {
    spec = applyInferredHardRule(spec);
  } else {
    spec = applyUncertaintyEligibility(spec, pilot);
  }

  return spec;
}

export function resolvePilotGeometryRenderById(
  pilotId: string | null | undefined,
  runtimeLinkage?: RuntimeLinkage
): PilotGeometryRenderSpec | null {
  const pilot = getPilotGeometryRecord(pilotId);
  if (!pilot) return null;
  return resolvePilotGeometryRender({ pilot, runtimeLinkage });
}
