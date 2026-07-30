import L from "leaflet";
import {
  CPH_INBOUND_COLOR,
  CPH_OUTBOUND_COLOR,
  destinationLatLng,
  directionPairSlot,
} from "./copenhagenFlowGeometry";
import type { SegmentInteractionHandlers } from "@/lib/wireMapSegmentInteraction";
import { copenhagenSiteSegmentId } from "@/lib/copenhagenMapSelection";
import type { CopenhagenObservedPoint } from "./renderCopenhagenMapLayers";
import { bindCopenhagenMapTooltip } from "./copenhagenMapTooltips";

/** Match radar outer ring (meters) so the CSS pulse stays visually on the hub rings. */
const GEO_PULSE_OUTER_M = 78;

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

/** Ripple rings tinted to a KPI colour (e.g. Issy sustainable-% zone dots). */
export function coloredTrafficPulseHtml(ringColor: string): string {
  const safe = ringColor.replace(/[^\w#(),.%\s-]/g, "");
  return `
    <div class="traffic-pulse-container pulse-colored" style="--pulse-color:${safe}">
      <div class="pulse-ring ring-1"></div>
      <div class="pulse-ring ring-2"></div>
      <div class="pulse-ring ring-3"></div>
    </div>
  `;
}

/** Diameter in screen px for a geographic radius at the current map zoom. */
export function geographicDiameterPx(
  map: L.Map,
  hubLat: number,
  hubLon: number,
  radiusM: number
): number {
  const center = L.latLng(hubLat, hubLon);
  const [edgeLat, edgeLon] = destinationLatLng(hubLat, hubLon, 90, radiusM);
  const edge = L.latLng(edgeLat, edgeLon);
  const zoom = map.getZoom();
  const px = map.project(center, zoom).distanceTo(map.project(edge, zoom)) * 2;
  return Math.max(96, Math.min(480, Math.round(px * 1.45)));
}

/** Show pulse from slightly earlier zoom so Milan pilot fits still animate. */
export const HUB_PULSE_MIN_ZOOM = 12;

export type HubPulseInteraction = {
  segmentId: string;
  segmentName: string;
  segmentHandlers: SegmentInteractionHandlers;
  selectedSegmentId?: string | null;
  wireCircleMarker?: (
    marker: L.CircleMarker,
    meta: { segmentId: string; segmentName: string; speed: null; congestion: null },
    handlers: SegmentInteractionHandlers,
    opts: {
      baseRadius: number;
      highlightRadius?: number;
      selectedSegmentId?: string | null;
      baseStyle?: L.PathOptions;
      highlightStyle?: L.PathOptions;
    }
  ) => void;
};

/**
 * CSS ripple at hub + solid center point.
 * Center point carries cursor + observatory click/hover when `interaction` is set.
 */
export function renderHubRipplePulseOverlay(
  map: L.Map,
  hubLat: number,
  hubLon: number,
  isInboundDominant: boolean,
  markersOut: L.Marker[],
  circlesOut: L.CircleMarker[],
  options?: {
    showAnchorDot?: boolean;
    minZoom?: number;
    ringScale?: number;
    /** When set, rings use this colour instead of inbound/outbound blue/red. */
    ringColor?: string;
    interaction?: HubPulseInteraction;
  }
): void {
  const minZoom = options?.minZoom ?? HUB_PULSE_MIN_ZOOM;
  const interaction = options?.interaction;
  const canWire = Boolean(interaction?.segmentId && interaction.segmentHandlers);
  const showCenter = options?.showAnchorDot !== false;
  const anchorFill = options?.ringColor
    ? options.ringColor
    : isInboundDominant
      ? CPH_INBOUND_COLOR
      : CPH_OUTBOUND_COLOR;
  const isSelected = Boolean(
    interaction?.selectedSegmentId && interaction.selectedSegmentId === interaction.segmentId
  );

  if (map.getZoom() >= minZoom) {
    const ringScale = options?.ringScale ?? 1;
    const diameter = geographicDiameterPx(
      map,
      hubLat,
      hubLon,
      GEO_PULSE_OUTER_M * ringScale
    );
    const half = Math.round(diameter / 2);

    const pulseMarker = L.marker([hubLat, hubLon], {
      icon: L.divIcon({
        html: options?.ringColor
          ? coloredTrafficPulseHtml(options.ringColor)
          : trafficPulseHtml(isInboundDominant),
        className: "custom-traffic-pulse",
        iconSize: [diameter, diameter],
        iconAnchor: [half, half],
      }),
      interactive: false,
      keyboard: false,
      zIndexOffset: 980,
    }).addTo(map);
    markersOut.push(pulseMarker);
  }

  // When showAnchorDot is false, rings-only — caller already drew the clickable hub.
  if (!showCenter) return;

  const detail = canWire && interaction
    ? {
        segmentId: interaction.segmentId,
        segmentName: interaction.segmentName,
        speed: null as null,
        congestion: null as null,
      }
    : null;

  const centerRadius = isSelected ? 10 : 8;
  const centerPoint = L.circleMarker([hubLat, hubLon], {
    radius: centerRadius,
    fillColor: anchorFill,
    color: "#ffffff",
    weight: 2.5,
    fillOpacity: 1,
    opacity: 1,
    interactive: canWire,
    className: canWire ? "hub-ripple-center hub-ripple-center--interactive" : "hub-ripple-center",
  }).addTo(map);

  if (detail && interaction) {
    bindCopenhagenMapTooltip(centerPoint, interaction.segmentName);
    if (interaction.wireCircleMarker) {
      interaction.wireCircleMarker(centerPoint, detail, interaction.segmentHandlers, {
        baseRadius: 8,
        highlightRadius: 12,
        selectedSegmentId: interaction.selectedSegmentId,
        baseStyle: {
          fillColor: anchorFill,
          color: "#ffffff",
          weight: 2.5,
          fillOpacity: 1,
          opacity: 1,
        },
        highlightStyle: {
          fillColor: "#00ffff",
          color: "#ffffff",
          weight: 3,
          fillOpacity: 1,
          opacity: 1,
        },
      });
    } else {
      centerPoint.on("click", () => {
        interaction.segmentHandlers.onJunctionSegmentClick?.(detail);
      });
      centerPoint.on("mouseover", () => {
        centerPoint.setRadius(12);
        centerPoint.setStyle({ fillColor: "#00ffff" });
        interaction.segmentHandlers.onSegmentHover?.(detail);
      });
      centerPoint.on("mouseout", () => {
        centerPoint.setRadius(isSelected ? 10 : 8);
        centerPoint.setStyle({ fillColor: anchorFill });
        interaction.segmentHandlers.onSegmentHover?.(null);
      });
    }
  }

  centerPoint.bringToFront();
  circlesOut.push(centerPoint);
}

/**
 * Animated hub pulse + wired center point for observatory selection.
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
    segmentId?: string;
    segmentHandlers?: SegmentInteractionHandlers;
    wireCircleMarker?: HubPulseInteraction["wireCircleMarker"];
    selectedSegmentId?: string | null;
    showAnchorDot?: boolean;
    ringScale?: number;
  }
): void {
  if (!flows.length) return;

  const { outbound, inbound } = sumDirectionalTraffic(flows, scenario);
  const isInboundDominant = inbound >= outbound;

  const segmentId =
    options?.segmentId ??
    (options?.workbookKey ? copenhagenSiteSegmentId(options.workbookKey) : undefined);

  const interaction: HubPulseInteraction | undefined =
    segmentId && options?.segmentHandlers
      ? {
          segmentId,
          segmentName: hubLabel?.trim() || segmentId,
          segmentHandlers: options.segmentHandlers,
          selectedSegmentId: options.selectedSegmentId,
          wireCircleMarker: options.wireCircleMarker,
        }
      : undefined;

  renderHubRipplePulseOverlay(
    map,
    hubLat,
    hubLon,
    isInboundDominant,
    markersOut,
    circlesOut,
    {
      showAnchorDot: options?.showAnchorDot ?? true,
      ringScale: options?.ringScale,
      interaction,
    }
  );
}
