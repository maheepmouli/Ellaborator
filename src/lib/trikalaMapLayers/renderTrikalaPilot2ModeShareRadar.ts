import L from "leaflet";
import type { SegmentInteractionHandlers } from "@/lib/wireMapSegmentInteraction";
import type { TrikalaLocation } from "@/data/trikalaLocationRegistry";
import { buildTrikalaPilot2HubLocalFlows } from "./trikalaPilot2ModeShare";
import { renderTrikalaMobilityHubStack } from "./renderTrikalaMobilityHubStack";

const PILOT2_RADAR_RING_SCALE = 6;

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
}

/** Copenhagen-style radar at each P+R hub — spokes scale for district zoom (KPI 1.2). */
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
    polygonsOut,
    markersOut,
    wireCircleMarker,
    getValueColor,
  } = options;

  const parkRideSites = locations.filter((l) => l.kind === "park_and_ride");
  if (!parkRideSites.length) return false;

  parkRideSites.forEach((site, siteIndex) => {
    const flows = buildTrikalaPilot2HubLocalFlows(site, siteIndex);
    if (!flows.length) return;

    renderTrikalaMobilityHubStack({
      map,
      hubLat: site.lat,
      hubLon: site.lng,
      hubSegmentId: site.id,
      hubLabel: site.name,
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
      ringScale: PILOT2_RADAR_RING_SCALE,
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
