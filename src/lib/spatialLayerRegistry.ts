/**
 * Unified KPI → spatial system contract for map + legend.
 * Marketplace path (Tier 3): Marketplace dataset → NormalizedFeatureSet → spatialLayerRegistry → KPI metrics
 */

import { isIssyStudyPilot } from "@/lib/issyPilot2Junction";
import { isIssyCity } from "@/lib/issyMapRouting";
import { getPilotGeometryRecord, type GeometryRegime } from "@/lib/pilotGeometryContract";
import { resolvePilotGeometryRender } from "@/lib/pilotGeometryRenderer";

export type SpatialSystem =
  | "flows"
  | "segments"
  | "facility-points"
  | "climate-hex"
  | "sentiment-field"
  | "accessibility"
  | "points"
  | "areas"
  | "hotspots";

export type LayerGeometryKind = "arc" | "polyline" | "point" | "polygon" | "hex" | "isochrone" | "blob";

export type SpatialRendererId =
  | "issy-junction-arms"
  | "issy-zone-flows"
  | "issy-climate-hex"
  | "issy-facility-points"
  | "issy-sentiment-field"
  | "issy-accessibility"
  | "issy-traffic-segments"
  | "milan-speed-segments"
  | "milan-environment-segments"
  | "milan-mode-share-deck"
  | "local-points"
  | "segment-hotspots"
  | "synthetic-segments"
  | "area-polygons"
  | "hex-circles"
  | "generic-points";

export interface SpatialResolveOptions {
  junctionStudy?: boolean;
  scenario?: "baseline" | "intervention" | "comparison";
  runtimeLinkage?: "exact" | "matched" | "inferred";
}

export interface SpatialRenderPlan {
  spatialSystem: SpatialSystem;
  geometryKind: LayerGeometryKind;
  rendererId: SpatialRendererId;
  legendHint: string;
}

const KPI_SPATIAL_DEFAULT: Record<string, SpatialSystem> = {
  "kpi1.2": "points",
  "kpi2.1": "hotspots",
  "kpi3.1": "facility-points",
  "kpi3.2": "climate-hex",
  "kpi4.1": "sentiment-field",
  "kpi4.2": "accessibility",
};

function geometryForSystem(system: SpatialSystem): LayerGeometryKind {
  switch (system) {
    case "flows":
      return "arc";
    case "segments":
      return "polyline";
    case "facility-points":
    case "points":
    case "hotspots":
      return "point";
    case "climate-hex":
      return "hex";
    case "sentiment-field":
      return "blob";
    case "accessibility":
      return "isochrone";
    case "areas":
      return "polygon";
    default:
      return "point";
  }
}

/** Primary spatial lens — Issy junction overrides city defaults. */
export function resolveSpatialSystem(
  city: string,
  kpiId: string,
  options?: SpatialResolveOptions & { pilotId?: string | null }
): SpatialSystem {
  const cityKey = city.toLowerCase();
  const junctionStudy =
    options?.junctionStudy ??
    (isIssyCity(city) && isIssyStudyPilot(options?.pilotId ?? null));

  if (isIssyCity(city)) {
    switch (kpiId) {
      case "kpi1.2":
        return junctionStudy ? "segments" : "flows";
      case "kpi2.1":
        return "segments";
      case "kpi3.1":
        return "facility-points";
      case "kpi3.2":
        return "climate-hex";
      case "kpi4.1":
        return "sentiment-field";
      case "kpi4.2":
        return "accessibility";
      default:
        return "facility-points";
    }
  }

  if (cityKey === "milan") {
    if (kpiId === "kpi2.1" || kpiId === "kpi3.2") return "segments";
    if (kpiId === "kpi1.2") return "points";
    if (kpiId === "kpi4.2") return "accessibility";
    if (kpiId === "kpi3.1") return "facility-points";
  }

  if (cityKey === "copenhagen" && (kpiId === "kpi1.2" || kpiId === "kpi2.1")) {
    return "points";
  }

  if (cityKey === "helsinki" && (kpiId === "kpi1.1" || kpiId === "kpi1.2" || kpiId === "kpi2.1" || kpiId === "kpi3.1" || kpiId === "kpi4.1" || kpiId === "kpi4.2")) {
    return "points";
  }

  if (cityKey === "zaragoza" && (kpiId === "kpi1.2" || kpiId === "kpi2.1" || kpiId === "kpi4.2")) {
    return "points";
  }

  if (cityKey === "milan" && kpiId === "kpi4.2") {
    return "points";
  }

  return KPI_SPATIAL_DEFAULT[kpiId] ?? "points";
}

function resolveRendererForRegimeAndKpi(
  pilotId: string,
  regime: GeometryRegime,
  kpiId: string,
  baseVisualization: SpatialRendererId
): SpatialRendererId {
  if (regime === "segment") {
    if (pilotId === "mil-p3") return "milan-environment-segments";
    if (kpiId === "kpi3.2") return "milan-environment-segments";
    if (kpiId === "kpi2.1") return "milan-speed-segments";
    if (kpiId === "kpi1.2") return "milan-mode-share-deck";
    return baseVisualization;
  }
  if (regime === "camera_directional") return baseVisualization;
  if (regime === "corridor" && kpiId === "kpi1.2") return "issy-junction-arms";
  return baseVisualization;
}

/** Map rendering dispatch id for HeroMap early-return routing. */
export function resolveSpatialRenderPlan(
  city: string,
  kpiId: string,
  options?: SpatialResolveOptions & { pilotId?: string | null }
): SpatialRenderPlan {
  const pilotRecord = getPilotGeometryRecord(options?.pilotId ?? null);
  if (pilotRecord) {
    const geometrySpec = resolvePilotGeometryRender({
      pilot: pilotRecord,
      runtimeLinkage: options?.runtimeLinkage,
    });
    if (geometrySpec.interactionModel === "dashboard_only") {
      return {
        spatialSystem: "points",
        geometryKind: "point",
        rendererId: "generic-points",
        legendHint: geometrySpec.legendHint,
      };
    }
    const rendererId = resolveRendererForRegimeAndKpi(
      pilotRecord.pilotId,
      pilotRecord.regime,
      kpiId,
      geometrySpec.visualizationMode
    );
    const spatial = resolveSpatialSystem(city, kpiId, {
      ...options,
      pilotId: pilotRecord.pilotId,
    });
    return {
      spatialSystem: spatial,
      geometryKind: geometryForSystem(spatial),
      rendererId,
      legendHint: geometrySpec.reductionCaption ?? geometrySpec.legendHint,
    };
  }

  const cityKey = city.toLowerCase();
  const junctionStudy =
    options?.junctionStudy ??
    (isIssyCity(city) && isIssyStudyPilot(options?.pilotId ?? null));
  const spatial = resolveSpatialSystem(city, kpiId, { ...options, junctionStudy });

  if (isIssyCity(city) && junctionStudy) {
    const rendererByKpi: Record<string, SpatialRendererId> = {
      "kpi1.2": "issy-junction-arms",
      "kpi2.1": "issy-junction-arms",
      "kpi3.1": "issy-facility-points",
      "kpi3.2": "issy-climate-hex",
      "kpi4.1": "issy-sentiment-field",
      "kpi4.2": "issy-accessibility",
    };
    const rendererId = rendererByKpi[kpiId] ?? "issy-junction-arms";
    return {
      spatialSystem: spatial,
      geometryKind: geometryForSystem(spatial),
      rendererId,
      legendHint: `Junction study — ${spatial.replace(/-/g, " ")} layer.`,
    };
  }

  if (isIssyCity(city) && kpiId === "kpi1.2" && spatial === "flows") {
    return {
      spatialSystem: "flows",
      geometryKind: "arc",
      rendererId: "issy-zone-flows",
      legendHint: "Zone-to-zone OD flows from observed CSV extracts.",
    };
  }

  if (isIssyCity(city)) {
    const issyCityRenderers: Partial<Record<string, SpatialRendererId>> = {
      "kpi3.2": "issy-climate-hex",
      "kpi3.1": "issy-facility-points",
      "kpi4.1": "issy-sentiment-field",
      "kpi4.2": "issy-accessibility",
      "kpi2.1": "issy-traffic-segments",
    };
    if (issyCityRenderers[kpiId]) {
      return {
        spatialSystem: spatial,
        geometryKind: geometryForSystem(spatial),
        rendererId: issyCityRenderers[kpiId]!,
        legendHint: `Issy ${spatial.replace(/-/g, " ")}.`,
      };
    }
  }

  if (cityKey === "milan") {
    if (kpiId === "kpi2.1") {
      return {
        spatialSystem: "segments",
        geometryKind: "polyline",
        rendererId: "milan-speed-segments",
        legendHint: "Road segments from AMAT speed shapefiles.",
      };
    }
    if (kpiId === "kpi3.2") {
      return {
        spatialSystem: "segments",
        geometryKind: "polyline",
        rendererId: "milan-environment-segments",
        legendHint: "RETE network segments for environmental pressure.",
      };
    }
    if (kpiId === "kpi1.2") {
      return {
        spatialSystem: "points",
        geometryKind: "point",
        rendererId: "milan-mode-share-deck",
        legendHint: "Mode-share intensity at pilot anchors.",
      };
    }
  }

  if (spatial === "segments" && kpiId === "kpi2.1" && isIssyCity(city)) {
    return {
      spatialSystem: "segments",
      geometryKind: "polyline",
      rendererId: "issy-traffic-segments",
      legendHint: "Live traficissy segment geometry.",
    };
  }

  if (kpiId === "kpi2.1") {
    return {
      spatialSystem: "hotspots",
      geometryKind: "point",
      rendererId: "segment-hotspots",
      legendHint: "Safety pressure hotspots (point clusters).",
    };
  }

  if (kpiId === "kpi3.2" && spatial === "climate-hex") {
    return {
      spatialSystem: "climate-hex",
      geometryKind: "hex",
      rendererId: "hex-circles",
      legendHint: "Environmental intensity hex / heat field.",
    };
  }

  if (spatial === "accessibility") {
    return {
      spatialSystem: "accessibility",
      geometryKind: "isochrone",
      rendererId: "area-polygons",
      legendHint: "Reachability isochrone bands.",
    };
  }

  return {
    spatialSystem: spatial,
    geometryKind: geometryForSystem(spatial),
    rendererId: "generic-points",
    legendHint: "Point-based KPI intensity layer.",
  };
}

/** Coarse render intent (legacy HeroMap branches). */
export function resolveRenderIntent(
  cityName: string,
  kpiId: string,
  options?: SpatialResolveOptions & { pilotId?: string | null }
): "point" | "segment" | "polygon" | "hex" {
  const system = resolveSpatialSystem(cityName, kpiId, options);
  if (system === "segments" || system === "flows") return "segment";
  if (system === "climate-hex") return "hex";
  if (system === "accessibility" || system === "areas") return "polygon";
  return "point";
}
