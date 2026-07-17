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
  copenhagenFlowLineOpacity,
  copenhagenFlowLineWeight,
  copenhagenZoomLineBoost,
  resolveCopenhagenIntensityColor,
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

/** Direction points on radar rings only (no spoke lines) — lat/lng meter offsets stay fixed across zoom. */
function renderRadarEndpointMarkersOnly(options: {
  map: L.Map;
  hubLat: number;
  hubLon: number;
  flows: CopenhagenObservedPoint[];
  scenario: "baseline" | "intervention" | "comparison";
  selectedSegmentId?: string | null;
  segmentHandlers: SegmentInteractionHandlers;
  circlesOut: L.CircleMarker[];
  ringScale: number;
  featureSelected: (segmentId: string) => boolean;
  intensityScalar: (
    scenario: "baseline" | "intervention" | "comparison",
    baselineValue: number,
    interventionValue: number,
    comparisonValue: number
  ) => number;
  getValueColor?: (value: number, safetyKpi: boolean) => string;
  safetyKpi: boolean;
  wireCircleMarker: RenderCopenhagenRadarFlowOptions["wireCircleMarker"];
  buildPopup: (flow: CopenhagenObservedPoint) => string;
}): void {
  const {
    map,
    hubLat,
    hubLon,
    flows,
    scenario,
    selectedSegmentId,
    segmentHandlers,
    circlesOut,
    ringScale,
    featureSelected,
    intensityScalar,
    getValueColor,
    safetyKpi,
    wireCircleMarker,
    buildPopup,
  } = options;
  const hasFocus = Boolean(selectedSegmentId);

  flows.forEach((point, flowIndex) => {
    const props = point.properties ?? {};
    const streetName = String(props.streetName ?? "Site");
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
    const { terminal } = buildRadarSpokeGeometry(hubLat, hubLon, bearing, isInbound, ringScale);
    const intensityColor = resolveCopenhagenIntensityColor({
      scenario,
      baselineValue,
      interventionValue,
      comparisonValue,
      getValueColor,
      safetyKpi,
    });
    const endpointStyle = getCopenhagenEndpointMarkerStyle(
      isSelected,
      isSelected ? "#00ffff" : intensityColor,
      intensityValue,
      hasFocus && !isSelected
    );
    if (endpointStyle.hidden) return;

    const endpointMarker = L.circleMarker(terminal, {
      radius: endpointStyle.radius,
      fillColor: endpointStyle.fillColor,
      fillOpacity: endpointStyle.fillOpacity,
      color: endpointStyle.color,
      weight: endpointStyle.weight,
      opacity: 0.98,
    }).addTo(map);
    endpointMarker.bindPopup(buildPopup(point));
    bindCopenhagenMapTooltip(
      endpointMarker,
      copenhagenFlowTerminalLabel(streetName, direction, isInbound)
    );
    wireCircleMarker(
      endpointMarker,
      {
        segmentId,
        segmentName: `${streetName} · ${direction}`,
        speed: null,
        congestion: null,
      },
      segmentHandlers,
      {
        baseRadius: endpointStyle.radius,
        highlightRadius: endpointStyle.radius + 3,
        selectedSegmentId,
        baseStyle: {
          fillColor: endpointStyle.fillColor,
          color: endpointStyle.color,
          fillOpacity: endpointStyle.fillOpacity,
          opacity: 0.98,
          weight: endpointStyle.weight,
        },
        highlightStyle: {
          fillOpacity: 1,
          opacity: 1,
          weight: (endpointStyle.weight as number) + 1,
          color: "#ffffff",
        },
      }
    );
    circlesOut.push(endpointMarker);
  });
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
  markersOut?: L.Marker[];
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
  getValueColor?: (value: number, safetyKpi: boolean) => string;
  safetyKpi?: boolean;
  /** Scale radar ring/spoke radius — use >1 when map is zoomed out (e.g. Trikala P+R network). */
  ringScale?: number;
  /** Hide spoke terminal dots — junction hubs use ripple + center marker only. */
  hideFlowEndpointMarkers?: boolean;
  /**
   * Partner preference: aggregate flows at the hub point.
   * Keeps concentric threshold rings; skips spoke lines, hit targets, arrows, and endpoints.
   */
  hideFlowSpokes?: boolean;
}

function flowArrowIcon(bearingDeg: number, color: string): L.DivIcon {
  return L.divIcon({
    className: "cph-radar-flow-arrow",
    html: `<svg width="12" height="12" viewBox="0 0 12 12" style="transform: rotate(${bearingDeg}deg);"><path d="M6 1 L10 9 L6 7 L2 9 Z" fill="${color}" opacity="0.92"/></svg>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
}

function pointAlongSpoke(
  path: [number, number][],
  fraction: number
): { point: [number, number]; bearing: number } | null {
  if (path.length < 2) return null;
  const a = path[0];
  const b = path[path.length - 1];
  return {
    point: [a[0] + (b[0] - a[0]) * fraction, a[1] + (b[1] - a[1]) * fraction],
    bearing: bearingBetween(a, b),
  };
}

function bearingBetween(from: [number, number], to: [number, number]): number {
  const [lat1, lon1] = from;
  const [lat2, lon2] = to;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const lat1r = (lat1 * Math.PI) / 180;
  const lat2r = (lat2 * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2r);
  const x =
    Math.cos(lat1r) * Math.sin(lat2r) -
    Math.sin(lat1r) * Math.cos(lat2r) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
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
    markersOut,
    svgRenderer,
    wireCircleMarker,
    buildPopup,
    featureSelected,
    intensityScalar,
    getValueColor,
    safetyKpi = false,
    ringScale = 1,
    hideFlowEndpointMarkers = false,
    hideFlowSpokes = false,
  } = options;

  if (!flows.length) return;

  const zoomBoost = copenhagenZoomLineBoost(map.getZoom());
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

  // Aggregate-at-hub mode: no spoke lines / arrows — optional ring endpoints stay meter-locked.
  if (hideFlowSpokes) {
    if (!hideFlowEndpointMarkers) {
      renderRadarEndpointMarkersOnly({
        map,
        hubLat,
        hubLon,
        flows,
        scenario,
        selectedSegmentId,
        segmentHandlers,
        circlesOut,
        ringScale,
        featureSelected,
        intensityScalar,
        getValueColor,
        safetyKpi,
        wireCircleMarker,
        buildPopup,
      });
    }
    return;
  }

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
    isInbound: boolean;
    baselineValue: number;
    interventionValue: number;
    comparisonValue: number;
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
    const flowStyle = getCopenhagenDirectionArmStyle({
      pairSlot,
      isSelected,
      scenario,
      dimmed: hasFocus && !isSelected,
    });
    const intensityColor = resolveCopenhagenIntensityColor({
      scenario,
      baselineValue,
      interventionValue,
      comparisonValue,
      getValueColor,
      safetyKpi,
    });

    spokeItems.push({
      path,
      terminal,
      pairSlot,
      armColor: intensityColor,
      flowStyle,
      segmentId,
      segmentName: `${streetName} · ${direction}`,
      tooltipLabel: copenhagenFlowTerminalLabel(streetName, direction, pairSlot === 0),
      popupHtml: buildPopup(point),
      intensityValue,
      isSelected,
      isInbound,
      baselineValue,
      interventionValue,
      comparisonValue,
    });
  });

  spokeItems
    .sort((a, b) => a.pairSlot - b.pairSlot)
    .forEach((spoke) => {
      const lineWeight =
        copenhagenFlowLineWeight(spoke.intensityValue, spoke.isSelected) * zoomBoost;
      const lineOpacity = copenhagenFlowLineOpacity(
        spoke.intensityValue,
        spoke.isSelected,
        hasFocus && !spoke.isSelected
      );
      const lineColor =
        scenario === "comparison"
          ? spoke.armColor
          : spoke.isSelected
            ? "#ffffff"
            : spoke.armColor;

      const glow = L.polyline(spoke.path, {
        color: spoke.armColor,
        weight: lineWeight + 7,
        opacity: spoke.isSelected ? 0.4 : lineOpacity * 0.32,
        lineCap: "round",
        lineJoin: "round",
        interactive: false,
      }).addTo(map);
      polylinesOut.push(glow);

      const polyline = L.polyline(spoke.path, {
        color: lineColor,
        weight: lineWeight,
        opacity: lineOpacity,
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

      if (!endpointStyle.hidden && !hideFlowEndpointMarkers) {
        const endpointMarker = L.circleMarker(spoke.terminal, {
          radius: endpointStyle.radius,
          fillColor: endpointStyle.fillColor,
          fillOpacity: endpointStyle.fillOpacity,
          color: endpointStyle.color,
          weight: endpointStyle.weight,
          opacity: 0.98,
        }).addTo(map);
        endpointMarker.bindPopup(spoke.popupHtml);
        bindCopenhagenMapTooltip(endpointMarker, spoke.tooltipLabel);
        wireCircleMarker(
          endpointMarker,
          {
            segmentId: spoke.segmentId,
            segmentName: spoke.segmentName,
            speed: null,
            congestion: null,
          },
          segmentHandlers,
          {
            baseRadius: endpointStyle.radius,
            highlightRadius: endpointStyle.radius + 3,
            selectedSegmentId,
            baseStyle: {
              fillColor: endpointStyle.fillColor,
              color: endpointStyle.color,
              fillOpacity: endpointStyle.fillOpacity,
              opacity: 0.98,
              weight: endpointStyle.weight,
            },
            highlightStyle: {
              fillOpacity: 1,
              opacity: 1,
              weight: (endpointStyle.weight as number) + 1,
              color: "#ffffff",
            },
          }
        );
        circlesOut.push(endpointMarker);
      }

      if (markersOut) {
        const outboundArrow = pointAlongSpoke(spoke.path, 0.82);
        if (outboundArrow) {
          const arrow = L.marker(outboundArrow.point, {
            icon: flowArrowIcon(outboundArrow.bearing, spoke.armColor),
            interactive: false,
            zIndexOffset: 850,
          }).addTo(map);
          markersOut.push(arrow);
        }
        const inboundArrow = pointAlongSpoke(spoke.path, 0.22);
        if (inboundArrow) {
          const arrow = L.marker(inboundArrow.point, {
            icon: flowArrowIcon((inboundArrow.bearing + 180) % 360, spoke.armColor),
            interactive: false,
            zIndexOffset: 850,
          }).addTo(map);
          markersOut.push(arrow);
        }
      }
    });
}
