import L from "leaflet";
import type { LocalCityPoint } from "@/services/localCityData";
import type { SegmentInteractionHandlers } from "@/lib/wireMapSegmentInteraction";
import { renderCopenhagenRadarFlowLayout } from "@/lib/copenhagenMapLayers/copenhagenRadarFlowLayout";
import { renderCopenhagenTrafficPulseOverlay } from "@/lib/copenhagenMapLayers/copenhagenTrafficPulse";
import type { CopenhagenObservedPoint } from "@/lib/copenhagenMapLayers/renderCopenhagenMapLayers";
import {
  milanFlowIdFromPoint,
  milanHubSegmentId,
  milanSiteHubFromFlows,
  milanSiteKeyFromPoint,
  resolveMilanFlowBearing,
} from "./milanFlowGeometry";

/** Larger than CPH default so ripples read clearly on Milan corridor zoom. */
const MILAN_HUB_RING_SCALE = 2.4;

export interface RenderMilanMapLayersOptions {
  map: L.Map;
  points: LocalCityPoint[];
  scenario: "baseline" | "intervention" | "comparison";
  selectedSegmentId?: string | null;
  segmentHandlers: SegmentInteractionHandlers;
  getValueColor: (value: number, safetyKpi: boolean) => string;
  modeFilterLabel?: string;
  markersOut: L.Marker[];
  circlesOut: L.CircleMarker[];
  polylinesOut: L.Polyline[];
  polygonsOut?: L.Polygon[];
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
}

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

function buildMilanFlowPopup(options: {
  streetName: string;
  direction: string;
  baselineValue: number;
  interventionValue: number;
  comparisonValue: number;
  modeFilterLabel: string;
  peakWindow?: string;
  illustrative?: boolean;
  /** Post / comparison values are MOCK even when baseline counts are observed. */
  postMock?: boolean;
}): string {
  const {
    streetName,
    direction,
    baselineValue,
    interventionValue,
    comparisonValue,
    modeFilterLabel,
    peakWindow,
    illustrative = false,
    postMock = false,
  } = options;
  const trustLine = illustrative
    ? "MOCK · illustrative junction hub"
    : postMock
      ? "Baseline observed · post/comparison MOCK"
      : "AMAT count · observed";
  return `
    <div style="font-family:'DM Sans',sans-serif;padding:8px;min-width:170px;">
      <p style="font-size:10px;color:#2F1B6D;margin:0 0 3px 0;font-weight:700;">${trustLine}</p>
      <p style="font-size:11px;color:#8578C3;margin:0 0 4px 0;text-transform:uppercase;">${streetName}</p>
      <p style="font-size:13px;font-weight:700;color:#2F1B6D;margin:0 0 4px 0;">${direction}</p>
      <p style="font-size:16px;font-weight:bold;color:#2F1B6D;margin:0 0 4px 0;">${interventionValue.toFixed(1)}%</p>
      <p style="font-size:10px;color:#96C2EF;margin:2px 0;">Mode filter: ${modeFilterLabel}</p>
      <p style="font-size:10px;color:#96C2EF;margin:2px 0;">Baseline: ${baselineValue.toFixed(1)}%</p>
      <p style="font-size:10px;color:#96C2EF;margin:2px 0;">Comparison: ${comparisonValue >= 0 ? "+" : ""}${comparisonValue.toFixed(1)} pp</p>
      ${peakWindow ? `<p style="font-size:9px;color:#96C2EF;margin-top:4px;">Peak window: ${peakWindow}</p>` : ""}
      <p style="font-size:9px;color:#96C2EF;margin-top:4px;">Source: ${
        illustrative
          ? "MOCK illustrative junction hub (KPI 2.1 network)"
          : postMock
            ? "AMAT baseline counts · post/comparison MOCK"
            : "AMAT road user counts (SharePoint bundle)"
      }</p>
    </div>
  `;
}

function toRadarFlowPointAtHub(
  point: LocalCityPoint,
  hubLat: number,
  hubLon: number,
  flowIndex: number,
  flowCount: number
): CopenhagenObservedPoint {
  const props = point.properties ?? {};
  const flowId = milanFlowIdFromPoint(props);
  const direction = String(props.direction ?? props.mode ?? flowId.toUpperCase());
  const labeledBearing = resolveMilanFlowBearing(flowId, direction);
  const hasCardinal =
    flowId === "nb" ||
    flowId === "sb" ||
    flowId === "eb" ||
    flowId === "wb" ||
    /north|south|east|west/i.test(direction);
  const fanBearing =
    flowCount <= 4 ? [0, 90, 180, 270][flowIndex % 4]! : (360 / Math.max(flowCount, 1)) * flowIndex;
  const bearing = hasCardinal ? labeledBearing : fanBearing;

  return {
    lat: hubLat,
    lon: hubLon,
    id: point.id,
    value: Math.max(Number(point.value) || 0, 12),
    properties: {
      ...props,
      direction,
      mode: direction,
      flowBearing: bearing,
      baselineValue: Number(props.baselineValue ?? point.value ?? 12),
      interventionValue: Number(props.interventionValue ?? point.value ?? 12),
      comparisonValue:
        typeof props.comparisonValue === "number"
          ? props.comparisonValue
          : Number(props.interventionValue ?? point.value ?? 0) -
            Number(props.baselineValue ?? point.value ?? 0),
    },
  };
}

function milanFeatureSelected(
  selectedId: string | null | undefined,
  segmentId: string,
  hubSegmentId: string
): boolean {
  if (!selectedId) return false;
  if (selectedId === segmentId) return true;
  if (selectedId === hubSegmentId) return true;
  if (selectedId.startsWith(`${hubSegmentId}-`)) return selectedId === segmentId;
  return false;
}

/**
 * Copenhagen-parity hub layout for Milan:
 * CSS ripples + white-bordered circleMarker center (same as OTC / CPH hubs).
 */
export function renderMilanMapLayers(options: RenderMilanMapLayersOptions): number {
  const {
    map,
    points,
    scenario,
    selectedSegmentId,
    segmentHandlers,
    getValueColor,
    modeFilterLabel = "Active mobility (bike + pedestrian)",
    markersOut,
    circlesOut,
    polylinesOut,
    wireCircleMarker,
  } = options;

  const countPoints = points.filter((p) => p.properties?.datasetKind === "amat-count");
  if (!countPoints.length) return 0;

  const flowsBySite = new Map<string, LocalCityPoint[]>();
  countPoints.forEach((point) => {
    const props = point.properties ?? {};
    const hubKey = milanHubSegmentId(props);
    const list = flowsBySite.get(hubKey) ?? [];
    list.push(point);
    flowsBySite.set(hubKey, list);
  });

  const svgRenderer = L.svg({ padding: 0.8 });
  let siteCount = 0;

  flowsBySite.forEach((siteFlows, hubSegmentId) => {
    if (!siteFlows.length) return;
    const hub = milanSiteHubFromFlows(siteFlows);
    const radarFlows = siteFlows.map((point, index) =>
      toRadarFlowPointAtHub(point, hub.lat, hub.lon, index, siteFlows.length)
    );
    const props0 = siteFlows[0]?.properties ?? {};
    const studyName = String(
      props0.junctionLabel ?? props0.streetName ?? milanSiteKeyFromPoint(props0)
    ).split(" · ")[0];
    const postMock = scenario === "intervention" || scenario === "comparison";

    renderCopenhagenRadarFlowLayout({
      map,
      hubLat: hub.lat,
      hubLon: hub.lon,
      flows: radarFlows,
      scenario,
      selectedSegmentId,
      segmentHandlers,
      polylinesOut,
      circlesOut,
      markersOut,
      svgRenderer,
      wireCircleMarker,
      intensityScalar,
      getValueColor,
      safetyKpi: false,
      ringScale: MILAN_HUB_RING_SCALE,
      hideFlowEndpointMarkers: true,
      hideFlowSpokes: true,
      featureSelected: (segmentId) =>
        milanFeatureSelected(selectedSegmentId, segmentId, hubSegmentId),
      buildPopup: (point) => {
        const props = point.properties ?? {};
        const direction = String(props.direction ?? props.mode ?? "n/a");
        const baselineValue = Number(props.baselineValue ?? point.value ?? 0);
        const interventionValue = Number(props.interventionValue ?? point.value ?? 0);
        const comparisonValue =
          typeof props.comparisonValue === "number"
            ? Number(props.comparisonValue)
            : interventionValue - baselineValue;
        const illustrative =
          props.parserStatus === "illustrative" || props.dataOrigin === "mock";
        return buildMilanFlowPopup({
          streetName: studyName,
          direction,
          baselineValue,
          interventionValue,
          comparisonValue,
          modeFilterLabel,
          peakWindow: String(props.peakWindow ?? "8:30–9:30"),
          illustrative,
          postMock,
        });
      },
    });

    // Copenhagen-parity hub: CSS ripple + solid white-bordered circleMarker (same as OTC hubs).
    renderCopenhagenTrafficPulseOverlay(
      map,
      hub.lat,
      hub.lon,
      radarFlows,
      scenario,
      markersOut,
      circlesOut,
      studyName,
      {
        showAnchorDot: true,
        ringScale: MILAN_HUB_RING_SCALE,
        segmentId: hubSegmentId,
        segmentHandlers,
        wireCircleMarker,
        selectedSegmentId,
      }
    );

    siteCount += 1;
  });

  return siteCount;
}
