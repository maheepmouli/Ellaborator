/**
 * Shared Helsinki map helpers — peer-aligned with Copenhagen/Trikala:
 * pilot-scoped geometry, soft influence fields, sampled point clouds.
 */
import L from "leaflet";
import {
  HELSINKI_KALLIO_ANCHOR,
  HELSINKI_VIIKKI_ANCHOR,
} from "@/lib/helsinkiDataPaths";
import { renderInfluenceField } from "@/lib/renderInfluenceField";
import type { HelsinkiInterventionLocationsGeoJson } from "@/services/staticGeoData";
import {
  wireCircleMarkerSegment,
  wirePolygonSegment,
  type SegmentInteractionHandlers,
} from "@/lib/wireMapSegmentInteraction";

/** Citywide HelsinkiArea MultiPolygon is survey extent, not a pilot footprint — never draw it. */
export function filterHelsinkiPilotInterventionFeatures(
  geojson: HelsinkiInterventionLocationsGeoJson,
  pilotId?: string | null
): GeoJSON.FeatureCollection {
  const features = geojson.features.filter((feature) => {
    const layer = String(feature.properties?.layer ?? "");
    const id = String(feature.properties?.pilotId ?? "");
    if (layer === "HelsinkiArea") return false;
    if (!pilotId) {
      return layer === "KallioSite" || layer === "ViikkiIntersection" || id === "hel-p2" || id === "hel-p3";
    }
    if (pilotId === "hel-p1") return false;
    if (pilotId === "hel-p2") return layer === "KallioSite" || id === "hel-p2";
    if (pilotId === "hel-p3") return layer === "ViikkiIntersection" || id === "hel-p3";
    return id === pilotId;
  });
  return { type: "FeatureCollection", features: features as GeoJSON.Feature[] };
}

export function renderHelsinkiPilotInfluence(
  map: L.Map,
  pilotId: string | null | undefined,
  circlesOut: L.Circle[]
): void {
  // FVH2: observation points define the footprint — no soft influence disc / border.
  if (pilotId === "hel-p2") return;
  if (pilotId === "hel-p3") {
    renderInfluenceField(map, circlesOut, {
      center: [HELSINKI_VIIKKI_ANCHOR.lat, HELSINKI_VIIKKI_ANCHOR.lng],
      radiusMeters: 420,
      tone: "neutral",
    });
    return;
  }
  if (pilotId === "hel-p1") {
    renderInfluenceField(map, circlesOut, {
      center: [60.171, 24.941],
      radiusMeters: 1100,
      tone: "default",
      flagship: true,
    });
  }
}

export function drawHelsinkiPilotInterventionGeometry(options: {
  map: L.Map;
  geojson: HelsinkiInterventionLocationsGeoJson;
  pilotId?: string | null;
  segmentInteractionEnabled: boolean;
  segmentHandlers: SegmentInteractionHandlers;
  activeMapSegmentId?: string | null;
  polygonsOut: L.Polygon[];
  circlesOut: L.CircleMarker[];
  strokeColor?: string;
  fillColor?: string;
  /**
   * When false (default), site polygons are visual context only — clicks pass through
   * to observation points underneath.
   */
  interactive?: boolean;
}): void {
  const {
    map,
    geojson,
    pilotId,
    segmentInteractionEnabled,
    segmentHandlers,
    activeMapSegmentId,
    polygonsOut,
    circlesOut,
    strokeColor = "#22c55e",
    fillColor = "#16a34a",
    interactive = false,
  } = options;

  const scoped = filterHelsinkiPilotInterventionFeatures(geojson, pilotId);
  if (!scoped.features.length) return;

  const layer = L.geoJSON(scoped as GeoJSON.GeoJsonObject, {
    style: () => ({
      color: strokeColor,
      weight: 2,
      opacity: 0.8,
      fillColor,
      fillOpacity: 0.12,
      interactive,
    }),
    interactive,
    pointToLayer: (_feature, latlng) =>
      L.circleMarker(latlng, {
        radius: 8,
        fillColor: strokeColor,
        fillOpacity: 0.88,
        color: "#ffffff",
        weight: 2,
        interactive: true,
      }),
    onEachFeature: (feature, layerItem) => {
      if (!interactive) {
        // Ensure path ignores pointer events even if a parent style re-enables them.
        const path = layerItem as L.Path;
        path.options.interactive = false;
        if (typeof path.setStyle === "function") {
          path.setStyle({ interactive: false });
        }
        return;
      }
      const areaName = String(
        feature?.properties?.name ?? feature?.properties?.Name ?? "Helsinki pilot site"
      );
      layerItem.bindPopup(`
        <div style="font-family:'DM Sans',sans-serif;padding:8px;min-width:170px;">
          <p style="font-size:10px;color:#8578C3;margin:0 0 4px 0;text-transform:uppercase;">Helsinki pilot site</p>
          <p style="font-size:14px;font-weight:700;color:#2F1B6D;margin:0 0 4px 0;">${areaName}</p>
        </div>
      `);
      if (segmentInteractionEnabled && layerItem instanceof L.Polygon) {
        wirePolygonSegment(
          layerItem,
          {
            segmentId: `hel-area:${areaName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
            segmentName: areaName,
            speed: null,
            congestion: null,
          },
          segmentHandlers,
          {
            selectedSegmentId: activeMapSegmentId,
            baseStyle: {
              color: strokeColor,
              weight: 2,
              opacity: 0.8,
              fillColor,
              fillOpacity: 0.12,
            },
          }
        );
      }
    },
  }).addTo(map);

  if (layer instanceof L.LayerGroup) {
    layer.eachLayer((member) => {
      if (member instanceof L.Polygon) polygonsOut.push(member);
      if (member instanceof L.CircleMarker) circlesOut.push(member);
    });
  }
}

/** Evenly sample GeoJSON point features (peer pattern: Trikala / Helsinki geo sample). */
export function sampleGeoJsonPoints<T extends { geometry: { type: string; coordinates: unknown } }>(
  features: T[],
  maxPoints: number
): T[] {
  if (features.length <= maxPoints) return features;
  const step = Math.max(1, Math.floor(features.length / maxPoints));
  const sampled: T[] = [];
  for (let i = 0; i < features.length && sampled.length < maxPoints; i += step) {
    const feature = features[i];
    if (feature.geometry?.type !== "Point") continue;
    sampled.push(feature);
  }
  return sampled;
}

export type HelsinkiSurveyUnderlayKind = "hazard" | "conflict";

/**
 * Sampled citizen-survey point cloud (full set stays in observatory).
 * Wired into segmentHandlers so clicks open the Intervention Observatory.
 */
export function renderHelsinkiSurveyPointUnderlay(options: {
  map: L.Map;
  features: Array<{
    geometry?: { type?: string; coordinates?: unknown } | null;
    properties?: Record<string, unknown>;
  }>;
  kind: HelsinkiSurveyUnderlayKind;
  maxPoints?: number;
  circlesOut: L.CircleMarker[];
  segmentInteractionEnabled?: boolean;
  segmentHandlers?: SegmentInteractionHandlers;
  activeMapSegmentId?: string | null;
  /** Optional bbox filter [minLat, minLng, maxLat, maxLng] or center+radiusDeg. */
  near?: { lat: number; lng: number; radiusDeg: number };
}): number {
  const {
    map,
    features,
    kind,
    maxPoints = 180,
    circlesOut,
    segmentInteractionEnabled,
    segmentHandlers,
    activeMapSegmentId,
    near,
  } = options;

  let pointFeatures = features.filter((f) => f.geometry?.type === "Point");
  if (near) {
    pointFeatures = pointFeatures.filter((f) => {
      const coords = f.geometry?.coordinates;
      if (!Array.isArray(coords) || coords.length < 2) return false;
      const lon = Number(coords[0]);
      const lat = Number(coords[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
      return Math.hypot(lat - near.lat, lon - near.lng) <= near.radiusDeg;
    });
  }

  const sampled = sampleGeoJsonPoints(
    pointFeatures as Array<{ geometry: { type: string; coordinates: unknown }; properties?: Record<string, unknown> }>,
    maxPoints
  );
  const fill = kind === "conflict" ? "#f97316" : "#ef4444";
  let drawn = 0;

  sampled.forEach((feature, index) => {
    const coords = feature.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return;
    const lon = Number(coords[0]);
    const lat = Number(coords[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

    const segmentId =
      kind === "conflict" ? `hel-conflict-sample-${index}` : `hel-hazard-sample-${index}`;
    const title =
      kind === "conflict"
        ? String(feature.properties?.incidentType || "Near-miss / conflict")
        : String(feature.properties?.locationType || "Dangerous location");

    const marker = L.circleMarker([lat, lon], {
      radius: kind === "conflict" ? 3.5 : 4,
      fillColor: fill,
      fillOpacity: 0.55,
      color: "#ffffff",
      weight: 0.6,
      opacity: 0.7,
      interactive: true,
    }).addTo(map);

    marker.bindTooltip(title, {
      direction: "top",
      opacity: 0.92,
      className: "tri-segment-tooltip",
    });
    marker.bindPopup(`
      <div style="font-family:'DM Sans',sans-serif;padding:8px;min-width:180px;">
        <p style="font-size:10px;color:#8578C3;margin:0 0 4px 0;text-transform:uppercase;">${
          kind === "conflict" ? "Conflict survey" : "Dangerous locations"
        }</p>
        <p style="font-size:13px;font-weight:700;color:#2F1B6D;margin:0 0 4px 0;">${title}</p>
        <p style="font-size:10px;color:#96C2EF;margin:0;">Click to open observatory · sample ${
          index + 1
        } of ${sampled.length.toLocaleString()}</p>
      </div>
    `);

    if (segmentInteractionEnabled && segmentHandlers) {
      wireCircleMarkerSegment(
        marker,
        {
          segmentId,
          segmentName: title,
          speed: null,
          congestion: null,
          properties: {
            lat,
            lon,
            datasetKind: kind === "conflict" ? "conflict" : "dangerous-location",
          },
        },
        segmentHandlers,
        {
          baseRadius: kind === "conflict" ? 3.5 : 4,
          selectedSegmentId: activeMapSegmentId,
        }
      );
    }

    circlesOut.push(marker);
    drawn += 1;
  });

  return drawn;
}

