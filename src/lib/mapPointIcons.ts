import L from "leaflet";
import type { MapPointIconSpec } from "@/lib/mapPointIconTaxonomy";
import {
  wireCircleMarkerSegment,
  type SegmentInteractionDetail,
  type SegmentInteractionHandlers,
} from "@/lib/wireMapSegmentInteraction";

const SVG_ICONS: Record<string, string> = {
  cycleParking: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="M6 17l5-9h4l3 9M11 8l3 9" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  charging: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L4 13h6l-1 9 9-11h-6l1-9z" stroke-linejoin="round"/></svg>`,
  sharedMobility: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><circle cx="5" cy="12" r="2"/><circle cx="19" cy="12" r="2"/><path d="M8 12h8" stroke-linecap="round"/></svg>`,
  pedestrian: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="2"/><path d="M12 7v5l4 2M12 12l-3 4m3-4l3 7m-6-3l-2 4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  sensor: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/><circle cx="12" cy="12" r="3.5"/></svg>`,
  parking: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M10 16V8h4a2.5 2.5 0 010 5h-4"/></svg>`,
  accessibility: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="2"/><path d="M7 10h10M12 10v9m0-6l-4 6m4-6l4 6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  generic: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/></svg>`,
};

export function createMapPointDivIcon(spec: MapPointIconSpec, title?: string): L.DivIcon {
  const svg = SVG_ICONS[spec.key] ?? SVG_ICONS.generic;
  const safeTitle = (title ?? spec.label).replace(/"/g, "&quot;");
  return L.divIcon({
    className: "map-point-icon-host",
    html: `
      <div class="map-point-icon-badge" style="--icon-accent:${spec.accent};--icon-glow:${spec.glow}" title="${safeTitle}">
        <span class="map-point-icon">${svg}</span>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

export interface NeonPointMarkerLayers {
  visual: L.Marker;
  hit: L.CircleMarker;
}

/** Visual divIcon badge + transparent hit circle for reliable hover/click tracking. */
export function addNeonPointMarker(
  map: L.Map,
  lat: number,
  lon: number,
  spec: MapPointIconSpec,
  detail: SegmentInteractionDetail,
  handlers?: SegmentInteractionHandlers,
  options?: {
    title?: string;
    hitRadius?: number;
    zIndexOffset?: number;
    selectedSegmentId?: string | null;
    popupHtml?: string;
    tooltip?: string;
  }
): NeonPointMarkerLayers {
  const hitRadius = options?.hitRadius ?? 12;
  const visual = L.marker([lat, lon], {
    icon: createMapPointDivIcon(spec, options?.title ?? spec.label),
    interactive: false,
    zIndexOffset: options?.zIndexOffset ?? 820,
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
      highlightRadius: hitRadius + 3,
      selectedSegmentId: options?.selectedSegmentId,
      baseStyle: { fillOpacity: 0, opacity: 0, weight: 0 },
      highlightStyle: { fillOpacity: 0.12, opacity: 0.35, weight: 1.5, color: spec.glow },
    });
    hit.on("mouseover", () => {
      visual.getElement()?.querySelector(".map-point-icon-badge")?.classList.add("map-point-icon-badge--hover");
    });
    hit.on("mouseout", () => {
      visual.getElement()?.querySelector(".map-point-icon-badge")?.classList.remove("map-point-icon-badge--hover");
    });
  }

  return { visual, hit };
}
