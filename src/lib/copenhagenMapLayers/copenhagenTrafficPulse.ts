import L from "leaflet";
import {
  CPH_INBOUND_COLOR,
  CPH_OUTBOUND_COLOR,
  directionPairSlot,
} from "./copenhagenFlowGeometry";
import type { SegmentInteractionHandlers } from "@/lib/wireMapSegmentInteraction";
import { copenhagenSiteSegmentId } from "@/lib/copenhagenMapSelection";
import type { CopenhagenObservedPoint } from "./renderCopenhagenMapLayers";
import { bindCopenhagenMapTooltip } from "./copenhagenMapTooltips";

export function sumDirectionalTraffic(
  flows: CopenhagenObservedPoint[],
  scenario: "baseline" | "intervention" | "comparison"
): { outbound: number; inbound: number } {
  let outbound = 0;
  let inbound = 0;
  flows.forEach((point, flowIndex) => {
    const props = point.properties ?? {};
    const direction = String(props.direction ?? props.mode ?? "");
    const slot = directionPairSlot(direction, flowIndex);
    const baseline = Number(props.baselineValue ?? point.value ?? 0);
    const intervention = Number(props.interventionValue ?? point.value ?? 0);
    const comparison =
      typeof props.comparisonValue === "number"
        ? Math.abs(Number(props.comparisonValue))
        : Math.abs(intervention - baseline);
    const value =
      scenario === "baseline"
        ? baseline
        : scenario === "intervention"
          ? intervention
          : comparison;
    if (slot === 0) inbound += value;
    else outbound += value;
  });
  return { outbound, inbound };
}

export function trafficPulseHtml(isInboundDominant: boolean): string {
  const pulseClass = isInboundDominant ? "pulse-inbound" : "pulse-outbound";
  return `
    <div class="traffic-pulse-container ${pulseClass}">
      <div class="pulse-ring ring-1"></div>
      <div class="pulse-ring ring-2"></div>
      <div class="pulse-ring ring-3"></div>
    </div>
  `;
}

/** Minimum map zoom before hub ripple markers are drawn (Milan pilot fit often lands at 14). */
export const HUB_PULSE_MIN_ZOOM = 14;

/** Copenhagen-style expanding ripple rings at a map hub (Issy junction, CPH camera, etc.). */
export function renderHubRipplePulseOverlay(
  map: L.Map,
  hubLat: number,
  hubLon: number,
  isInboundDominant: boolean,
  markersOut: L.Marker[],
  circlesOut: L.CircleMarker[],
  options?: { showAnchorDot?: boolean; minZoom?: number }
): void {
  const minZoom = options?.minZoom ?? HUB_PULSE_MIN_ZOOM;
  if (map.getZoom() < minZoom) return;

  const anchorFill = isInboundDominant ? CPH_INBOUND_COLOR : CPH_OUTBOUND_COLOR;

  const pulseMarker = L.marker([hubLat, hubLon], {
    icon: L.divIcon({
      html: trafficPulseHtml(isInboundDominant),
      className: "custom-traffic-pulse",
      iconSize: [200, 200],
      iconAnchor: [100, 100],
    }),
    interactive: false,
    zIndexOffset: 980,
  }).addTo(map);
  markersOut.push(pulseMarker);

  if (options?.showAnchorDot !== false) {
    const anchorDot = L.circleMarker([hubLat, hubLon], {
      radius: 6,
      fillColor: anchorFill,
      color: "#ffffff",
      weight: 2,
      fillOpacity: 1,
      opacity: 1,
      interactive: false,
      className: "cph-traffic-anchor-dot",
    }).addTo(map);
    anchorDot.bringToFront();
    circlesOut.push(anchorDot);
  }
}

/**
 * Hardware-accelerated CSS pulse at the camera hub — layered on top of flow arms / FOV,
 * without removing existing map geometry.
 */
export function renderCopenhagenTrafficPulseOverlay(
  map: L.Map,
  hubLat: number,
  hubLon: number,
  flows: CopenhagenObservedPoint[],
  scenario: "baseline" | "intervention" | "comparison",
  markersOut: L.Marker[],
  circlesOut: L.CircleMarker[],
  hubLabel?: string,
  options?: {
    workbookKey?: string;
    segmentHandlers?: SegmentInteractionHandlers;
    wireCircleMarker?: (
      marker: L.CircleMarker,
      meta: { segmentId: string; segmentName: string; speed: null; congestion: null },
      handlers: SegmentInteractionHandlers,
      opts: {
        baseRadius: number;
        highlightRadius?: number;
        selectedSegmentId?: string | null;
      }
    ) => void;
    selectedSegmentId?: string | null;
    showAnchorDot?: boolean;
  }
): void {
  if (!flows.length) return;

  const { outbound, inbound } = sumDirectionalTraffic(flows, scenario);
  const isInboundDominant = inbound >= outbound;
  renderHubRipplePulseOverlay(
    map,
    hubLat,
    hubLon,
    isInboundDominant,
    markersOut,
    circlesOut,
    { showAnchorDot: options?.showAnchorDot }
  );

  if (hubLabel?.trim()) {
    const hubHit = L.circleMarker([hubLat, hubLon], {
      radius: 14,
      fillOpacity: 0,
      opacity: 0,
      weight: 0,
      interactive: true,
    }).addTo(map);
    bindCopenhagenMapTooltip(hubHit, hubLabel);
    const workbookKey = options?.workbookKey;
    if (workbookKey && options?.segmentHandlers && options?.wireCircleMarker) {
      const segmentId = copenhagenSiteSegmentId(workbookKey);
      options.wireCircleMarker(
        hubHit,
        { segmentId, segmentName: hubLabel, speed: null, congestion: null },
        options.segmentHandlers,
        {
          baseRadius: 14,
          highlightRadius: 18,
          selectedSegmentId: options.selectedSegmentId,
        }
      );
    }
    circlesOut.push(hubHit);
  }
}
