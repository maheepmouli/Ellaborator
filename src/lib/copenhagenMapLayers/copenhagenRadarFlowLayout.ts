import L from "leaflet";
import {
  CPH_DIRECTION_PAIR_COLORS,
  CPH_INBOUND_COLOR,
  CPH_OUTBOUND_COLOR,
  destinationLatLng,
  directionPairSlot,
  resolveFlowBearing,
} from "./copenhagenFlowGeometry";
import {
  getCopenhagenDirectionArmStyle,
  getCopenhagenEndpointMarkerStyle,
  CPH_LINE_FOCUS_DIM,
} from "./copenhagenFlowStyles";
import {
  bindCopenhagenMapTooltip,
  copenhagenFlowTerminalLabel,
} from "./copenhagenMapTooltips";
import type { CopenhagenObservedPoint } from "./renderCopenhagenMapLayers";
import type { SegmentInteractionHandlers } from "@/lib/wireMapSegmentInteraction";
import { wirePolylineSegment } from "@/lib/wireMapSegmentInteraction";

export { CPH_INBOUND_COLOR as CPH_RADAR_INBOUND_COLOR, CPH_OUTBOUND_COLOR as CPH_RADAR_OUTBOUND_COLOR };

/** Outbound threshold ring (inner). */
export const CPH_RADAR_INNER_RING_M = 42;
/** Inbound threshold ring (outer). */
export const CPH_RADAR_OUTER_RING_M = 78;
/** Hub core clearance — outbound spokes start here. */
export const CPH_RADAR_CORE_M = 8;

export function isInboundTowardJunction(flowLabel: string, flowIndex = 0): boolean {
  return directionPairSlot(flowLabel, flowIndex) === 0;
}

function ringStrokeStyle(
  scenario: "baseline" | "intervention" | "comparison",
  color: string
): L.PolylineOptions {
  if (scenario === "baseline") {
    return {
      color,
      weight: 1.2,
      opacity: 0.2,
      dashArray: "1, 8",
      lineCap: "round",
      lineJoin: "round",
    };
  }
  return {
    color,
    weight: 1.2,
    opacity: 0.2,
    lineCap: "round",
    lineJoin: "round",
  };
}

export function buildRadarSpokeGeometry(
  hubLat: number,
  hubLon: number,
  bearingDeg: number,
  isInbound: boolean,
  ringScale = 1
): { path: [number, number][]; terminal: [number, number] } {
  const inner = destinationLatLng(hubLat, hubLon, bearingDeg, CPH_RADAR_INNER_RING_M * ringScale);
  const outer = destinationLatLng(hubLat, hubLon, bearingDeg, CPH_RADAR_OUTER_RING_M * ringScale);
  const core = destinationLatLng(hubLat, hubLon, bearingDeg, CPH_RADAR_CORE_M * ringScale);

  if (isInbound) {
    return { path: [inner, outer], terminal: outer };
  }
  return { path: [core, inner], terminal: inner };
}

function sampleRingLatLngs(
  hubLat: number,
  hubLon: number,
  radiusM: number,
  steps = 72
): [number, number][] {
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i += 1) {
    const bearing = (360 / steps) * i;
    ring.push(destinationLatLng(hubLat, hubLon, bearing, radiusM));
  }
  return ring;
}

export interface RenderCopenhagenRadarFlowOptions {
  map: L.Map;
  hubLat: number;
  hubLon: number;
  flows: CopenhagenObservedPoint[];
  scenario: "baseline" | "intervention" | "comparison";
  selectedSegmentId?: string | null;
  segmentHandlers: SegmentInteractionHandlers;
  polylinesOut: L.Polyline[];
  circlesOut: L.CircleMarker[];
  svgRenderer: L.Renderer;
  wireCircleMarker: (
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
  buildPopup: (flow: CopenhagenObservedPoint) => string;
  featureSelected: (segmentId: string) => boolean;
  intensityScalar: (
    scenario: "baseline" | "intervention" | "comparison",
    baselineValue: number,
    interventionValue: number,
    comparisonValue: number
  ) => number;
  /** Scale radar ring/spoke radius — use >1 when map is zoomed out (e.g. Trikala P+R network). */
  ringScale?: number;
}

/**
 * Concentric radar-spoke layout using the legacy corridor stroke palette
 * (red inbound / cyan outbound, dashed baseline, animated selection).
 */
export function renderCopenhagenRadarFlowLayout(options: RenderCopenhagenRadarFlowOptions): void {
  const {
    map,
    hubLat,
    hubLon,
    flows,
    scenario,
    selectedSegmentId,
    segmentHandlers,
    polylinesOut,
    circlesOut,
    svgRenderer,
    wireCircleMarker,
    buildPopup,
    featureSelected,
    intensityScalar,
    ringScale = 1,
  } = options;

  if (!flows.length) return;

  const hasFocus = Boolean(selectedSegmentId);

  const innerRing = L.polyline(
    sampleRingLatLngs(hubLat, hubLon, CPH_RADAR_INNER_RING_M * ringScale),
    {
      ...ringStrokeStyle(scenario, CPH_OUTBOUND_COLOR),
      interactive: false,
    }
  ).addTo(map);
  polylinesOut.push(innerRing);

  const outerRing = L.polyline(
    sampleRingLatLngs(hubLat, hubLon, CPH_RADAR_OUTER_RING_M * ringScale),
    {
      ...ringStrokeStyle(scenario, CPH_INBOUND_COLOR),
      interactive: false,
    }
  ).addTo(map);
  polylinesOut.push(outerRing);

  const spokeItems: Array<{
    path: [number, number][];
    terminal: [number, number];
    pairSlot: 0 | 1;
    armColor: string;
    flowStyle: ReturnType<typeof getCopenhagenDirectionArmStyle>;
    segmentId: string;
    segmentName: string;
    tooltipLabel: string;
    popupHtml: string;
    intensityValue: number;
    isSelected: boolean;
  }> = [];

  flows.forEach((point, flowIndex) => {
    const props = point.properties ?? {};
    const streetName = String(props.streetName ?? "Copenhagen");
    const direction = String(props.direction ?? props.mode ?? "n/a");
    const segmentId = String(props.segmentId || props.id || point.id);
    const isSelected = featureSelected(segmentId);

    const baselineValue = Number(props.baselineValue ?? point.value ?? 0);
    const interventionValue = Number(props.interventionValue ?? point.value ?? 0);
    const comparisonValue =
      typeof props.comparisonValue === "number"
        ? Number(props.comparisonValue)
        : interventionValue - baselineValue;

    const intensityValue = intensityScalar(
      scenario,
      baselineValue,
      interventionValue,
      comparisonValue
    );

    const bearing =
      typeof props.flowBearing === "number"
        ? props.flowBearing
        : resolveFlowBearing(streetName, direction, flowIndex, flows.length);
    const pairSlot = directionPairSlot(direction, flowIndex);
    const isInbound = pairSlot === 0;
    const { path, terminal } = buildRadarSpokeGeometry(hubLat, hubLon, bearing, isInbound, ringScale);
    const armColor = CPH_DIRECTION_PAIR_COLORS[pairSlot];
    const flowStyle = getCopenhagenDirectionArmStyle({
      pairSlot,
      isSelected,
      scenario,
      dimmed: hasFocus && !isSelected,
    });

    spokeItems.push({
      path,
      terminal,
      pairSlot,
      armColor,
      flowStyle,
      segmentId,
      segmentName: `${streetName} · ${direction}`,
      tooltipLabel: copenhagenFlowTerminalLabel(streetName, direction, pairSlot === 0),
      popupHtml: buildPopup(point),
      intensityValue,
      isSelected,
    });
  });

  spokeItems
    .sort((a, b) => a.pairSlot - b.pairSlot)
    .forEach((spoke) => {
      const polyline = L.polyline(spoke.path, {
        color: spoke.flowStyle.color,
        weight: spoke.flowStyle.weight,
        opacity: spoke.flowStyle.opacity,
        dashArray: spoke.flowStyle.dashArray,
        className: spoke.flowStyle.className,
        lineCap: "round",
        lineJoin: "round",
        renderer: spoke.flowStyle.className ? svgRenderer : undefined,
        interactive: false,
      }).addTo(map);
      polylinesOut.push(polyline);

      const hitPolyline = L.polyline(spoke.path, {
        color: spoke.armColor,
        weight: 14,
        opacity: 0,
        lineCap: "round",
        lineJoin: "round",
        interactive: true,
      }).addTo(map);
      wirePolylineSegment(
        hitPolyline,
        {
          segmentId: spoke.segmentId,
          segmentName: spoke.segmentName,
          speed: null,
          congestion: null,
        },
        segmentHandlers,
        {
          baseStyle: {
            color: spoke.armColor,
            weight: 14,
            opacity: 0,
          },
          highlightStyle: {
            color: spoke.isSelected ? "#00ffff" : spoke.armColor,
            weight: 16,
            opacity: 0.2,
          },
          selectedSegmentId,
          focusDim: CPH_LINE_FOCUS_DIM,
        }
      );
      polylinesOut.push(hitPolyline);

      const endpointStyle = getCopenhagenEndpointMarkerStyle(
        spoke.isSelected,
        spoke.isSelected ? "#00ffff" : spoke.armColor,
        spoke.intensityValue,
        hasFocus && !spoke.isSelected
      );

      if (!endpointStyle.hidden) {
        const endpointMarker = L.circleMarker(spoke.terminal, {
          radius: endpointStyle.radius,
          fillColor: endpointStyle.fillColor,
          fillOpacity: endpointStyle.fillOpacity,
          color: endpointStyle.color,
          weight: endpointStyle.weight,
          opacity: 0.98,
          interactive: false,
        }).addTo(map);
        endpointMarker.bindPopup(spoke.popupHtml);
        circlesOut.push(endpointMarker);
      }

      const endpointHit = L.circleMarker(spoke.terminal, {
        radius: endpointStyle.hidden ? 10 : endpointStyle.radius + 4,
        fillOpacity: 0,
        opacity: 0,
        weight: 0,
        interactive: true,
      }).addTo(map);
      wireCircleMarker(
        endpointHit,
        {
          segmentId: spoke.segmentId,
          segmentName: spoke.segmentName,
          speed: null,
          congestion: null,
        },
        segmentHandlers,
        {
          baseRadius: endpointStyle.radius + 4,
          highlightRadius: endpointStyle.radius + 6,
          selectedSegmentId,
          baseStyle: { fillOpacity: 0, opacity: 0, weight: 0 },
          highlightStyle: {
            fillOpacity: 0.12,
            opacity: 0.35,
            weight: 1.5,
            color: spoke.armColor,
          },
        }
      );
      endpointHit.bindPopup(spoke.popupHtml);
      bindCopenhagenMapTooltip(endpointHit, spoke.tooltipLabel);
      circlesOut.push(endpointHit);
    });
}
