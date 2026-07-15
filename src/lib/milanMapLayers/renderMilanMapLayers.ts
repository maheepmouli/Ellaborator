import L from "leaflet";
import type { LocalCityPoint } from "@/services/localCityData";
import type { SegmentInteractionHandlers } from "@/lib/wireMapSegmentInteraction";
import { renderCopenhagenRadarFlowLayout } from "@/lib/copenhagenMapLayers/copenhagenRadarFlowLayout";
import { renderCopenhagenTrafficPulseOverlay } from "@/lib/copenhagenMapLayers/copenhagenTrafficPulse";
import type { CopenhagenObservedPoint } from "@/lib/copenhagenMapLayers/renderCopenhagenMapLayers";
import { resolveCopenhagenIntensityColor } from "@/lib/copenhagenMapLayers/copenhagenFlowStyles";
import {
  milanFlowIdFromPoint,
  milanSiteHubFromFlows,
  milanSiteKeyFromPoint,
  milanSiteSegmentId,
  resolveMilanFlowBearing,
} from "./milanFlowGeometry";

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
  } = options;
  return `
    <div style="font-family:'DM Sans',sans-serif;padding:8px;min-width:170px;">
      <p style="font-size:10px;color:#2F1B6D;margin:0 0 3px 0;font-weight:700;">${illustrative ? "Illustrative · mock" : "AMAT count · observed"}</p>
      <p style="font-size:11px;color:#8578C3;margin:0 0 4px 0;text-transform:uppercase;">${streetName}</p>
      <p style="font-size:13px;font-weight:700;color:#2F1B6D;margin:0 0 4px 0;">${direction}</p>
      <p style="font-size:16px;font-weight:bold;color:#2F1B6D;margin:0 0 4px 0;">${interventionValue.toFixed(1)}%</p>
      <p style="font-size:10px;color:#96C2EF;margin:2px 0;">Mode filter: ${modeFilterLabel}</p>
      <p style="font-size:10px;color:#96C2EF;margin:2px 0;">Baseline: ${baselineValue.toFixed(1)}%</p>
      <p style="font-size:10px;color:#96C2EF;margin:2px 0;">Comparison: ${comparisonValue >= 0 ? "+" : ""}${comparisonValue.toFixed(1)} pp</p>
      ${peakWindow ? `<p style="font-size:9px;color:#96C2EF;margin-top:4px;">Peak window: ${peakWindow}</p>` : ""}
      <p style="font-size:9px;color:#96C2EF;margin-top:4px;">Source: ${illustrative ? "Illustrative junction mock (KPI 2.1 network)" : "AMAT road user counts (SharePoint bundle)"}</p>
    </div>
  `;
}

function toRadarFlowPoint(point: LocalCityPoint): CopenhagenObservedPoint {
  const props = point.properties ?? {};
  const flowId = milanFlowIdFromPoint(props);
  const direction = String(props.direction ?? props.mode ?? flowId.toUpperCase());
  return {
    lat: point.lat,
    lon: point.lon,
    id: point.id,
    value: point.value,
    properties: {
      ...props,
      direction,
      mode: direction,
      flowBearing: resolveMilanFlowBearing(flowId, direction),
      baselineValue: props.baselineValue ?? point.value,
      interventionValue: props.interventionValue ?? point.value,
      comparisonValue:
        typeof props.comparisonValue === "number"
          ? props.comparisonValue
          : Number(props.interventionValue ?? point.value) -
            Number(props.baselineValue ?? point.value),
    },
  };
}

function milanFeatureSelected(
  selectedId: string | null | undefined,
  segmentId: string,
  hubKey: string
): boolean {
  if (!selectedId) return false;
  if (selectedId === segmentId) return true;
  if (selectedId === hubKey) return true;
  if (!hubKey.startsWith("mil-junction-") && selectedId === milanSiteSegmentId(hubKey)) return true;
  if (selectedId.startsWith(`${hubKey}-`)) return selectedId === segmentId;
  return false;
}

/**
 * Copenhagen-parity radar hub layout for Milan AMAT count sites:
 * concentric rings, directional spokes, endpoint markers, and hub pulse.
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
    const hubKey = String(props.junctionId ?? milanSiteKeyFromPoint(props));
    const list = flowsBySite.get(hubKey) ?? [];
    list.push(point);
    flowsBySite.set(hubKey, list);
  });

  const svgRenderer = L.svg({ padding: 0.8 });
  let siteCount = 0;

  flowsBySite.forEach((siteFlows, hubKey) => {
    if (!siteFlows.length) return;
    const hub = milanSiteHubFromFlows(siteFlows);
    const radarFlows = siteFlows.map(toRadarFlowPoint);
    const props0 = siteFlows[0]?.properties ?? {};
    const studyName = String(
      props0.junctionLabel ?? props0.streetName ?? hubKey
    ).split(" · ")[0];
    const siteKey = String(props0.siteKey ?? milanSiteKeyFromPoint(props0));

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
      hideFlowEndpointMarkers: true,
      featureSelected: (segmentId) => milanFeatureSelected(selectedSegmentId, segmentId, hubKey),
      buildPopup: (point) => {
        const props = point.properties ?? {};
        const direction = String(props.direction ?? props.mode ?? "n/a");
        const baselineValue = Number(props.baselineValue ?? point.value ?? 0);
        const interventionValue = Number(props.interventionValue ?? point.value ?? 0);
        const comparisonValue =
          typeof props.comparisonValue === "number"
            ? Number(props.comparisonValue)
            : interventionValue - baselineValue;
        return buildMilanFlowPopup({
          streetName: studyName,
          direction,
          baselineValue,
          interventionValue,
          comparisonValue,
          modeFilterLabel,
          peakWindow: String(props.peakWindow ?? "8:30–9:30"),
          illustrative:
            props.parserStatus === "illustrative" || props.dataOrigin === "mock",
        });
      },
    });

    renderCopenhagenTrafficPulseOverlay(
      map,
      hub.lat,
      hub.lon,
      radarFlows,
      scenario,
      markersOut,
      circlesOut,
      studyName,
      { showAnchorDot: false }
    );

    const hubHit = L.circleMarker([hub.lat, hub.lon], {
      radius: 8,
      fillColor: resolveCopenhagenIntensityColor({
        scenario,
        baselineValue: radarFlows.reduce(
          (s, f) => s + Number(f.properties?.baselineValue ?? f.value ?? 0),
          0
        ) / radarFlows.length,
        interventionValue: radarFlows.reduce(
          (s, f) => s + Number(f.properties?.interventionValue ?? f.value ?? 0),
          0
        ) / radarFlows.length,
        comparisonValue: radarFlows.reduce((s, f) => {
          const props = f.properties ?? {};
          const comparison =
            typeof props.comparisonValue === "number"
              ? Number(props.comparisonValue)
              : Number(props.interventionValue ?? f.value ?? 0) -
                Number(props.baselineValue ?? f.value ?? 0);
          return s + comparison;
        }, 0) / radarFlows.length,
        getValueColor,
        safetyKpi: false,
      }),
      color: "#ffffff",
      weight: 2,
      fillOpacity: 0.95,
      opacity: 1,
    }).addTo(map);
    wireCircleMarker(
      hubHit,
      {
        segmentId: hubKey.startsWith("mil-junction-") ? hubKey : milanSiteSegmentId(siteKey),
        segmentName: studyName,
        speed: null,
        congestion: null,
      },
      segmentHandlers,
      {
        baseRadius: 8,
        highlightRadius: 11,
        selectedSegmentId,
      }
    );
    circlesOut.push(hubHit);
    siteCount += 1;
  });

  return siteCount;
}
