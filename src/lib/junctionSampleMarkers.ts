import type { SegmentHighlightStyle } from "@/lib/segmentHighlight";
import {
  wireCircleMarkerSegment,
  type SegmentInteractionDetail,
  type SegmentInteractionHandlers,
} from "@/lib/wireMapSegmentInteraction";
import L from "leaflet";

/** Pixel diameter for sample dots along an approach (matches reference mock). */
export function junctionSampleDotDiameter(highlight: SegmentHighlightStyle): number {
  if (highlight.band.toLowerCase().includes("high") || highlight.band.toLowerCase().includes("higher")) {
    return 26;
  }
  if (highlight.band.toLowerCase().includes("low") || highlight.band.toLowerCase().includes("lower")) {
    return 18;
  }
  if (highlight.band === "Mid" || highlight.band === "Medium") {
    return 22;
  }
  return 24;
}

function dotHtml(fill: string, diameter: number, variant: "sample" | "anchor"): string {
  if (variant === "anchor") {
    const outer = 34;
    return `
      <div class="junction-marker-anchor" style="width:${outer}px;height:${outer}px">
        <div class="junction-marker-anchor__halo"></div>
        <div class="junction-marker-anchor__ring junction-marker-anchor__ring--white"></div>
        <div class="junction-marker-anchor__ring junction-marker-anchor__ring--accent"></div>
        <div class="junction-marker-anchor__core" style="background:${fill}"></div>
      </div>
    `;
  }

  const border = 2.5;
  const inner = Math.max(12, diameter - border * 2);
  return `
    <div class="junction-marker-dot" style="width:${diameter}px;height:${diameter}px">
      <div
        class="junction-marker-dot__fill"
        style="width:${inner}px;height:${inner}px;background:${fill}"
      ></div>
    </div>
  `;
}

export function createJunctionSampleDotIcon(
  highlight: SegmentHighlightStyle,
  variant: "sample" | "anchor" = "sample"
): L.DivIcon {
  const diameter = variant === "anchor" ? 34 : junctionSampleDotDiameter(highlight);
  return L.divIcon({
    className: variant === "anchor" ? "junction-marker-icon junction-marker-icon--anchor" : "junction-marker-icon",
    html: dotHtml(highlight.color, diameter, variant),
    iconSize: [diameter, diameter],
    iconAnchor: [diameter / 2, diameter / 2],
  });
}

export interface JunctionFieldPointMarkerLayers {
  visual: L.Marker;
  hit: L.CircleMarker;
}

/** Subtle survey pin — solid dot + white ring, no neon glow (field audit / mock assets). */
export function addJunctionFieldPointMarker(
  map: L.Map,
  lat: number,
  lon: number,
  highlight: SegmentHighlightStyle,
  detail: SegmentInteractionDetail,
  handlers?: SegmentInteractionHandlers,
  options?: {
    hitRadius?: number;
    zIndexOffset?: number;
    selectedSegmentId?: string | null;
    popupHtml?: string;
    tooltip?: string;
  }
): JunctionFieldPointMarkerLayers {
  const hitRadius = options?.hitRadius ?? 10;
  const visual = L.marker([lat, lon], {
    icon: createJunctionSampleDotIcon(highlight, "sample"),
    interactive: false,
    zIndexOffset: options?.zIndexOffset ?? 760,
  }).addTo(map);

  const hit = L.circleMarker([lat, lon], {
    radius: hitRadius,
    fillOpacity: 0,
    opacity: 0,
    weight: 0,
    interactive: true,
    className: "map-point-hit-target",
  }).addTo(map);

  if (options?.popupHtml) {
    visual.bindPopup(options.popupHtml);
    hit.bindPopup(options.popupHtml);
  }
  if (options?.tooltip) {
    hit.bindTooltip(options.tooltip, { direction: "top", opacity: 0.92 });
  }

  if (handlers) {
    wireCircleMarkerSegment(hit, detail, handlers, {
      baseRadius: hitRadius,
      highlightRadius: hitRadius + 2,
      selectedSegmentId: options?.selectedSegmentId,
      baseStyle: { fillOpacity: 0, opacity: 0, weight: 0 },
      highlightStyle: {
        fillOpacity: 0.1,
        opacity: 0.35,
        weight: 1.5,
        color: highlight.color,
      },
    });
  }

  return { visual, hit };
}

/** Dashed purple study ring around the junction anchor (reference halo). */
export function addJunctionAnchorHalo(
  map: L.Map,
  lat: number,
  lon: number,
  radiusM = 32
): L.Circle {
  return L.circle([lat, lon], {
    radius: radiusM,
    color: "#a78bfa",
    weight: 2,
    opacity: 0.85,
    fillOpacity: 0,
    dashArray: "7 6",
    interactive: false,
  }).addTo(map);
}
