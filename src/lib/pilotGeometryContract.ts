import { getCopenhagenPilotMapFocus } from "@/data/copenhagenCameraSites";
import { getPilotById } from "@/data/pilotDefinitions";
import { trikalaMapZoom } from "@/lib/trikalaMapConfig";

export type GeometryRegime =
  | "point"
  | "segment"
  | "area"
  | "hybrid_network"
  | "camera_directional"
  | "corridor";

export type GeometryTruthStatus = "exact" | "derived" | "inferred";

export interface GeometryTruth {
  status: GeometryTruthStatus;
  source: "gis" | "csv" | "survey" | "api" | "mixed";
  spatialReliability: number;
}

export type GeometryRenderEligibility =
  | "render_safe"
  | "render_with_uncertainty"
  | "dashboard_only";

export interface GeometryReduction {
  from: "polygon" | "segment" | "point";
  to: "centroid" | "point" | "segment";
  reason: string;
}

export interface PilotGeometryFocus {
  lat: number;
  lng: number;
  zoom?: number;
}

export interface PilotGeometryRecord {
  pilotId: string;
  regime: GeometryRegime;
  geometryTruth: GeometryTruth;
  renderEligibility: GeometryRenderEligibility;
  geometryReduction?: GeometryReduction;
  renderTier?: "deterministic" | "probabilistic";
  focus?: PilotGeometryFocus;
}

function pilotFocus(
  city: string,
  pilotId: string,
  fallbackZoom = 14
): PilotGeometryFocus | undefined {
  const pilot = getPilotById(city, pilotId);
  if (typeof pilot?.lat === "number" && typeof pilot?.lng === "number") {
    return { lat: pilot.lat, lng: pilot.lng, zoom: fallbackZoom };
  }
  return undefined;
}

function cphFocus(pilotId: string): PilotGeometryFocus | undefined {
  const focus = getCopenhagenPilotMapFocus(pilotId);
  if (!focus) return undefined;
  return { lat: focus.lat, lng: focus.lon, zoom: focus.zoom };
}

export const PILOT_GEOMETRY_REGISTRY: Record<string, PilotGeometryRecord> = {
  "issy-p1": {
    pilotId: "issy-p1",
    regime: "corridor",
    geometryTruth: { status: "exact", source: "api", spatialReliability: 0.9 },
    renderEligibility: "render_safe",
    focus: pilotFocus("Issy-les-Moulineaux", "issy-p1", 17),
  },
  "issy-p2": {
    pilotId: "issy-p2",
    regime: "corridor",
    geometryTruth: { status: "exact", source: "api", spatialReliability: 0.92 },
    renderEligibility: "render_safe",
    focus: pilotFocus("Issy-les-Moulineaux", "issy-p2", 17),
  },
  "issy-p3": {
    pilotId: "issy-p3",
    regime: "corridor",
    geometryTruth: { status: "derived", source: "mixed", spatialReliability: 0.65 },
    renderEligibility: "render_with_uncertainty",
    focus: pilotFocus("Issy-les-Moulineaux", "issy-p3", 16),
  },
  "cph-p1": {
    pilotId: "cph-p1",
    regime: "camera_directional",
    geometryTruth: { status: "exact", source: "survey", spatialReliability: 0.95 },
    renderEligibility: "render_safe",
    focus: cphFocus("cph-p1"),
  },
  "cph-p2": {
    pilotId: "cph-p2",
    regime: "camera_directional",
    geometryTruth: { status: "exact", source: "survey", spatialReliability: 0.95 },
    renderEligibility: "render_safe",
    focus: cphFocus("cph-p2"),
  },
  "cph-p3": {
    pilotId: "cph-p3",
    regime: "camera_directional",
    geometryTruth: { status: "exact", source: "survey", spatialReliability: 0.95 },
    renderEligibility: "render_safe",
    focus: cphFocus("cph-p3"),
  },
  "hel-p1": {
    pilotId: "hel-p1",
    regime: "point",
    geometryTruth: { status: "derived", source: "mixed", spatialReliability: 0.55 },
    renderEligibility: "render_with_uncertainty",
    focus: pilotFocus("Helsinki", "hel-p1", 14),
  },
  "hel-p2": {
    pilotId: "hel-p2",
    regime: "point",
    geometryTruth: { status: "exact", source: "gis", spatialReliability: 0.88 },
    renderEligibility: "render_safe",
    focus: pilotFocus("Helsinki", "hel-p2", 15),
  },
  "hel-p3": {
    pilotId: "hel-p3",
    regime: "hybrid_network",
    geometryTruth: { status: "inferred", source: "api", spatialReliability: 0.35 },
    renderEligibility: "render_with_uncertainty",
    focus: pilotFocus("Helsinki", "hel-p3", 12),
  },
  "mil-p1": {
    pilotId: "mil-p1",
    regime: "segment",
    geometryTruth: { status: "exact", source: "gis", spatialReliability: 0.85 },
    renderEligibility: "render_safe",
    renderTier: "deterministic",
    focus: pilotFocus("Milan", "mil-p1", 15),
  },
  "mil-p2": {
    pilotId: "mil-p2",
    regime: "segment",
    geometryTruth: { status: "exact", source: "gis", spatialReliability: 0.88 },
    renderEligibility: "render_safe",
    renderTier: "deterministic",
    focus: pilotFocus("Milan", "mil-p2", 16),
  },
  "mil-p3": {
    pilotId: "mil-p3",
    regime: "segment",
    geometryTruth: { status: "derived", source: "mixed", spatialReliability: 0.45 },
    renderEligibility: "render_with_uncertainty",
    renderTier: "probabilistic",
    focus: pilotFocus("Milan", "mil-p3", 13),
  },
  "zar-p1": {
    pilotId: "zar-p1",
    regime: "area",
    geometryTruth: { status: "derived", source: "gis", spatialReliability: 0.6 },
    renderEligibility: "render_with_uncertainty",
    geometryReduction: {
      from: "polygon",
      to: "centroid",
      reason: "UI simplification / KPI alignment",
    },
    focus: pilotFocus("Zaragoza", "zar-p1", 14),
  },
  "tri-p1": {
    pilotId: "tri-p1",
    regime: "point",
    geometryTruth: { status: "exact", source: "gis", spatialReliability: 0.82 },
    renderEligibility: "dashboard_only",
    focus: pilotFocus("Trikala", "tri-p1", trikalaMapZoom()),
  },
  "tri-p2": {
    pilotId: "tri-p2",
    regime: "area",
    geometryTruth: { status: "exact", source: "gis", spatialReliability: 0.78 },
    renderEligibility: "dashboard_only",
    focus: pilotFocus("Trikala", "tri-p2", trikalaMapZoom()),
  },
  "tri-p3": {
    pilotId: "tri-p3",
    regime: "segment",
    geometryTruth: { status: "exact", source: "gis", spatialReliability: 0.8 },
    renderEligibility: "dashboard_only",
    focus: pilotFocus("Trikala", "tri-p3", trikalaMapZoom()),
  },
};

export function getPilotGeometryRecord(
  pilotId: string | null | undefined
): PilotGeometryRecord | null {
  if (!pilotId) return null;
  return PILOT_GEOMETRY_REGISTRY[pilotId] ?? null;
}
