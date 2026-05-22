import type { SegmentHighlightStyle } from "@/lib/segmentHighlight";
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
