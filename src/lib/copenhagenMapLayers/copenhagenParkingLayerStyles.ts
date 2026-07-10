import L from "leaflet";
import type { SegmentInteractionHandlers } from "@/lib/wireMapSegmentInteraction";
import { wirePolylineSegment } from "@/lib/wireMapSegmentInteraction";
import {
  CPH_LINE_FOCUS_DIM,
  CPH_PARKING_LOD_ZOOM,
  getCopenhagenParkingLineStyles,
} from "./copenhagenFlowStyles";

export const CPH_PARKING_POPUP_CLASS = "cph-parking-popup";

const PARKING_NEON: Record<string, string> = {
  handicap: "#00d2ff",
  cykel: "#2ecc71",
  erhverv: "#ffb300",
  almindelig: "#ff4d4d",
};

export function normalizeCopenhagenSegmentKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildParkingSegmentId(street: string, category: string): string {
  return `parking-${normalizeCopenhagenSegmentKey(street)}-${normalizeCopenhagenSegmentKey(category)}`;
}

export function buildAccessibilitySegmentId(category: string): string {
  return `a11y-${normalizeCopenhagenSegmentKey(category)}`;
}

export function parkingSegmentDetailFromProps(
  props: Record<string, unknown>,
  selectedKpi: string
): { segmentId: string; segmentName: string } {
  const street = String(props.Vejnavn ?? props.streetName ?? "Parking");
  const category = String(props.Parkering ?? props.P_ordning ?? props.facilityCategory ?? "Parking");
  const bays = Number(props.Antal_plad ?? props.bays ?? 0);
  const segmentId =
    selectedKpi === "kpi4.2"
      ? buildAccessibilitySegmentId(category)
      : buildParkingSegmentId(street, category);
  const segmentName = bays
    ? `${street} · ${category} · ${bays} ${bays === 1 ? "bay" : "bays"}`
    : `${street} · ${category}`;
  return { segmentId, segmentName };
}

export function getParkingCategoryLabel(feature?: GeoJSON.Feature): string {
  const props = feature?.properties ?? {};
  return String(props.Parkering ?? props.P_ordning ?? props.facilityCategory ?? "Parking");
}

export function resolveParkingCategoryColor(category: string): string {
  const t = category.toLowerCase();
  if (t.includes("handicap")) return PARKING_NEON.handicap;
  if (t.includes("cykel")) return PARKING_NEON.cykel;
  if (t.includes("erhverv") || t.includes("besøg") || t.includes("besog") || t.includes("besogs")) {
    return PARKING_NEON.erhverv;
  }
  if (t.includes("almindelig")) return PARKING_NEON.almindelig;
  return "#94a3b8";
}

export function buildParkingPopupHtml(props: Record<string, unknown>): string {
  const street = String(props.Vejnavn ?? props.streetName ?? "Parking segment");
  const type = String(props.Parkering ?? props.P_ordning ?? props.facilityCategory ?? "Parking");
  const bays = Number(props.Antal_plad ?? props.bays ?? 1);
  const accent = resolveParkingCategoryColor(type);
  const bayLabel = bays === 1 ? "Bay" : "Bays";
  return `
    <div style="font-family: 'DM Sans', sans-serif; padding: 4px 2px; min-width: 160px;">
      <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #ffffff;">
        <b>${street}</b> &bull; <span style="color: ${accent};">${type}</span> &bull; <strong>${bays} ${bayLabel}</strong>
      </p>
    </div>
  `;
}

export function renderCopenhagenStreetUnderlay(
  map: L.Map,
  streetsGeoJson: GeoJSON.FeatureCollection,
  polylinesOut: L.Polyline[]
): void {
  const layer = L.geoJSON(streetsGeoJson, {
    style: {
      color: "#2c3e50",
      weight: 2,
      opacity: 0.15,
      fillOpacity: 0,
      interactive: false,
      className: "cph-street-underlay",
    },
  }).addTo(map);

  layer.eachLayer((child) => {
    if (child instanceof L.Polyline) {
      polylinesOut.push(child);
    }
  });
}

function pushPolylineLayers(
  group: L.GeoJSON,
  polylinesOut: L.Polyline[],
  onPolyline?: (line: L.Polyline) => void
): void {
  group.eachLayer((layer) => {
    if (layer instanceof L.Polyline) {
      onPolyline?.(layer);
      polylinesOut.push(layer);
    }
  });
}

export function renderCopenhagenParkingPolygons(
  map: L.Map,
  parkingGeoJson: GeoJSON.FeatureCollection,
  polylinesOut: L.Polyline[],
  selectedKpi: string,
  segmentHandlers: SegmentInteractionHandlers,
  selectedSegmentId?: string | null,
  zoom = map.getZoom()
): void {
  if (zoom < CPH_PARKING_LOD_ZOOM) {
    return;
  }

  parkingGeoJson.features.forEach((feature) => {
    const props = feature.properties ?? {};
    const type = getParkingCategoryLabel(feature);
    const color = resolveParkingCategoryColor(type);
    const popupHtml = buildParkingPopupHtml(props);
    const { segmentId, segmentName } = parkingSegmentDetailFromProps(props, selectedKpi);
    const lineStyles = getCopenhagenParkingLineStyles(color, selectedKpi);

    const glow = L.geoJSON(feature, {
      style: { ...lineStyles.glow, className: "cph-parking-glow" },
    }).addTo(map);

    const core = L.geoJSON(feature, {
      style: { ...lineStyles.core, className: "cph-parking-core" },
    }).addTo(map);

    pushPolylineLayers(glow, polylinesOut);
    pushPolylineLayers(core, polylinesOut, (line) => {
      line.bindPopup(popupHtml, {
        className: CPH_PARKING_POPUP_CLASS,
        maxWidth: 300,
        closeButton: false,
      });
      const baseStyle: L.PathOptions = { ...lineStyles.core };
      wirePolylineSegment(
        line,
        { segmentId, segmentName, speed: null, congestion: null },
        segmentHandlers,
        {
          baseStyle,
          highlightStyle: lineStyles.highlight,
          selectedSegmentId,
          focusDim: CPH_LINE_FOCUS_DIM,
        }
      );
    });
  });
}
