import L from "leaflet";
import { renderCopenhagenRadarFlowLayout } from "@/lib/copenhagenMapLayers/copenhagenRadarFlowLayout";
import type { SegmentInteractionHandlers } from "@/lib/wireMapSegmentInteraction";
import type { TrikalaLocation } from "@/data/trikalaLocationRegistry";
import { buildTrikalaPilot2HubLocalFlows } from "./trikalaPilot2ModeShare";

const PILOT2_RADAR_RING_SCALE = 6;

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

function buildPilot2FlowPopup(options: {
  siteName: string;
  direction: string;
  baselineValue: number;
  interventionValue: number;
  comparisonValue: number;
}): string {
  const { siteName, direction, baselineValue, interventionValue, comparisonValue } = options;
  return `
    <div style="font-family: 'DM Sans', sans-serif; padding: 8px; min-width: 205px;">
      <p style="font-size: 11px; color: #8578C3; margin: 0 0 2px 0; text-transform: uppercase;">P+R mode share</p>
      <p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Hub: ${siteName}</p>
      <p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Spoke: ${direction}</p>
      <p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Before: ${baselineValue.toFixed(1)}%</p>
      <p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Intervention: ${interventionValue.toFixed(1)}%</p>
      <p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Comparison: ${comparisonValue >= 0 ? "+" : ""}${comparisonValue.toFixed(1)} pp</p>
      <p style="font-size: 9px; color: #96C2EF; margin-top: 4px;">Illustrative intermodal proxy — partner P+R survey pending</p>
    </div>
  `;
}

function featureSelectedForHub(
  selectedSegmentId: string | null | undefined,
  hubId: string,
  flowSegmentId: string
): boolean {
  if (!selectedSegmentId) return false;
  if (selectedSegmentId === flowSegmentId) return true;
  const selectedBase = selectedSegmentId.replace(/-(active|car)$/, "");
  const spokeBase = flowSegmentId.replace(/-(active|car)$/, "");
  return selectedBase === spokeBase || selectedSegmentId === hubId;
}

export interface RenderTrikalaPilot2ModeShareRadarOptions {
  map: L.Map;
  hub: { lat: number; lng: number };
  hubLabel?: string;
  locations: TrikalaLocation[];
  scenario: "baseline" | "intervention" | "comparison";
  selectedSegmentId?: string | null;
  segmentHandlers: SegmentInteractionHandlers;
  markersOut: L.Marker[];
  circlesOut: Array<L.Circle | L.CircleMarker>;
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

/** Copenhagen-style mini radar at each P+R hub — spokes scale for district zoom (KPI 1.2). */
export function renderTrikalaPilot2ModeShareRadar(
  options: RenderTrikalaPilot2ModeShareRadarOptions
): boolean {
  const {
    map,
    locations,
    scenario,
    selectedSegmentId,
    segmentHandlers,
    circlesOut,
    polylinesOut,
    wireCircleMarker,
  } = options;

  const parkRideSites = locations.filter((l) => l.kind === "park_and_ride");
  if (!parkRideSites.length) return false;

  const svgRenderer = L.svg({ padding: 0.8 });
  const circleMarkers = circlesOut as L.CircleMarker[];

  parkRideSites.forEach((site, siteIndex) => {
    const flows = buildTrikalaPilot2HubLocalFlows(site, siteIndex);
    if (!flows.length) return;

    renderCopenhagenRadarFlowLayout({
      map,
      hubLat: site.lat,
      hubLon: site.lng,
      flows,
      scenario,
      selectedSegmentId,
      segmentHandlers,
      polylinesOut,
      circlesOut: circleMarkers,
      svgRenderer,
      wireCircleMarker,
      ringScale: PILOT2_RADAR_RING_SCALE,
      intensityScalar,
      featureSelected: (segmentId) =>
        featureSelectedForHub(selectedSegmentId, site.id, segmentId),
      buildPopup: (point) => {
        const props = point.properties ?? {};
        return buildPilot2FlowPopup({
          siteName: String(props.subSegment ?? props.streetName ?? site.name),
          direction: String(props.direction ?? props.mode ?? "n/a"),
          baselineValue: Number(props.baselineValue ?? point.value ?? 0),
          interventionValue: Number(props.interventionValue ?? point.value ?? 0),
          comparisonValue:
            typeof props.comparisonValue === "number"
              ? Number(props.comparisonValue)
              : Number(props.interventionValue ?? point.value ?? 0) -
                Number(props.baselineValue ?? point.value ?? 0),
        });
      },
    });
  });

  return true;
}
