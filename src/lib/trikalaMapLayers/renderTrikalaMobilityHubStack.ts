import L from "leaflet";
import { renderCopenhagenRadarFlowLayout } from "@/lib/copenhagenMapLayers/copenhagenRadarFlowLayout";
import { renderMobilityHubFovCone } from "@/lib/copenhagenMapLayers/renderMobilityHubFov";
import { renderCopenhagenTrafficPulseOverlay } from "@/lib/copenhagenMapLayers/copenhagenTrafficPulse";
import { resolveCopenhagenIntensityColor } from "@/lib/copenhagenMapLayers/copenhagenFlowStyles";
import type { CopenhagenObservedPoint } from "@/lib/copenhagenMapLayers/renderCopenhagenMapLayers";
import type { SegmentInteractionHandlers } from "@/lib/wireMapSegmentInteraction";
import { wireMarkerSegment } from "@/lib/wireMapSegmentInteraction";
import { bindCopenhagenMapTooltip } from "@/lib/copenhagenMapLayers/copenhagenMapTooltips";
import {
  trikalaMobilityHubMarkerHtml,
  trikalaMobilityWorkbookRingHtml,
} from "./trikalaMobilityHubMarkers";

function intensityScalar(
  scenario: "baseline" | "intervention" | "comparison",
  baselineValue: number,
  interventionValue: number,
  comparisonValue: number
): number {
  if (scenario === "baseline") return baselineValue;
  if (scenario === "intervention") return interventionValue;
  return Math.min(100, Math.abs(comparisonValue) * 4);
}

function hubAccentFromFlows(
  flows: CopenhagenObservedPoint[],
  scenario: "baseline" | "intervention" | "comparison",
  getValueColor?: (value: number, safetyKpi: boolean) => string
): string {
  if (!flows.length) return "#f59e0b";
  let baselineSum = 0;
  let interventionSum = 0;
  let comparisonSum = 0;
  flows.forEach((point) => {
    const props = point.properties ?? {};
    baselineSum += Number(props.baselineValue ?? point.value ?? 0);
    interventionSum += Number(props.interventionValue ?? point.value ?? 0);
    comparisonSum +=
      typeof props.comparisonValue === "number"
        ? Number(props.comparisonValue)
        : Number(props.interventionValue ?? point.value ?? 0) -
          Number(props.baselineValue ?? point.value ?? 0);
  });
  const n = flows.length;
  return resolveCopenhagenIntensityColor({
    scenario,
    baselineValue: baselineSum / n,
    interventionValue: interventionSum / n,
    comparisonValue: comparisonSum / n,
    getValueColor,
  });
}

export interface RenderTrikalaMobilityHubStackOptions {
  map: L.Map;
  hubLat: number;
  hubLon: number;
  hubSegmentId: string;
  hubLabel: string;
  flows: CopenhagenObservedPoint[];
  scenario: "baseline" | "intervention" | "comparison";
  selectedSegmentId?: string | null;
  segmentHandlers: SegmentInteractionHandlers;
  markersOut: L.Marker[];
  circlesOut: Array<L.Circle | L.CircleMarker>;
  polylinesOut: L.Polyline[];
  polygonsOut: L.Polygon[];
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
  getValueColor?: (value: number, safetyKpi: boolean) => string;
  ringScale?: number;
  featureSelected: (segmentId: string) => boolean;
  buildPopup: (flow: CopenhagenObservedPoint) => string;
  /** When true, skip the dashed workbook ring — one hub pin only. */
  singleHubMarker?: boolean;
}

/** Aggregated mobility hub: FOV wedge + pulse + threshold rings (no flow spokes). */
export function renderTrikalaMobilityHubStack(options: RenderTrikalaMobilityHubStackOptions): void {
  const {
    map,
    hubLat,
    hubLon,
    hubSegmentId,
    hubLabel,
    flows,
    scenario,
    selectedSegmentId,
    segmentHandlers,
    markersOut,
    circlesOut,
    polylinesOut,
    polygonsOut,
    wireCircleMarker,
    getValueColor,
    ringScale = 1,
    featureSelected,
    buildPopup,
    singleHubMarker = false,
  } = options;

  if (!flows.length) return;

  const hubSelected = selectedSegmentId === hubSegmentId;
  const hasFocus = Boolean(selectedSegmentId);
  const dimmed = hasFocus && !hubSelected;
  const accent = hubAccentFromFlows(flows, scenario, getValueColor);

  renderMobilityHubFovCone(map, hubLat, hubLon, flows, polygonsOut, {
    selected: hubSelected,
    ringScale,
  });

  const workbookMarker = singleHubMarker
    ? null
    : L.marker([hubLat, hubLon], {
        icon: L.divIcon({
          className: "cph-workbook-site-icon",
          html: trikalaMobilityWorkbookRingHtml(hubSelected, dimmed),
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        }),
        zIndexOffset: hubSelected ? 1180 : 1080,
      }).addTo(map);
  if (workbookMarker) {
    bindCopenhagenMapTooltip(workbookMarker, hubLabel);
    wireMarkerSegment(
      workbookMarker,
      { segmentId: hubSegmentId, segmentName: hubLabel, speed: null, congestion: null },
      segmentHandlers
    );
    markersOut.push(workbookMarker);
  }

  const cameraMarker = L.marker([hubLat, hubLon], {
    icon: L.divIcon({
      className: "cph-flow-camera-icon",
      html: trikalaMobilityHubMarkerHtml(hubSelected, accent, dimmed),
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    }),
    zIndexOffset: hubSelected ? 1250 : 1150,
  }).addTo(map);
  bindCopenhagenMapTooltip(cameraMarker, hubLabel);
  wireMarkerSegment(
    cameraMarker,
    { segmentId: hubSegmentId, segmentName: hubLabel, speed: null, congestion: null },
    segmentHandlers
  );
  markersOut.push(cameraMarker);

  const svgRenderer = L.svg({ padding: 0.8 });
  const circleMarkers = circlesOut as L.CircleMarker[];

  renderCopenhagenRadarFlowLayout({
    map,
    hubLat,
    hubLon,
    flows,
    scenario,
    selectedSegmentId,
    segmentHandlers,
    polylinesOut,
    circlesOut: circleMarkers,
    svgRenderer,
    wireCircleMarker,
    intensityScalar,
    getValueColor,
    markersOut,
    ringScale,
    hideFlowSpokes: true,
    hideFlowEndpointMarkers: true,
    featureSelected,
    buildPopup,
  });

  renderCopenhagenTrafficPulseOverlay(
    map,
    hubLat,
    hubLon,
    flows,
    scenario,
    markersOut,
    circleMarkers,
    hubLabel,
    {
      segmentId: hubSegmentId,
      segmentHandlers,
      wireCircleMarker,
      selectedSegmentId,
    }
  );
}
