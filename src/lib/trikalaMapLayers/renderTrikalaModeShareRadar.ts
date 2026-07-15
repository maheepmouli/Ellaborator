import L from "leaflet";
import type { CopenhagenObservedPoint } from "@/lib/copenhagenMapLayers/renderCopenhagenMapLayers";
import type { SegmentInteractionHandlers } from "@/lib/wireMapSegmentInteraction";
import type { TrikalaSegmentInsight } from "@/services/trikalaSurveyParser";
import { buildTrikalaModeShareFlowPoints } from "./trikalaModeShareMapFlows";
import { renderTrikalaMobilityHubStack } from "./renderTrikalaMobilityHubStack";

const HUB_SEGMENT_ID = "tri-p1-women-mobility";

function buildTrikalaFlowPopup(options: {
  anchorLabel: string;
  direction: string;
  baselineValue: number;
  interventionValue: number;
  comparisonValue: number;
  subSegment?: string;
}): string {
  const { anchorLabel, direction, baselineValue, interventionValue, comparisonValue, subSegment } =
    options;
  return `
    <div style="font-family: 'DM Sans', sans-serif; padding: 8px; min-width: 205px;">
      <p style="font-size: 11px; color: #8578C3; margin: 0 0 2px 0; text-transform: uppercase;">Survey mode share</p>
      <p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Anchor: ${anchorLabel}</p>
      ${subSegment ? `<p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Segment: ${subSegment}</p>` : ""}
      <p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Spoke: ${direction}</p>
      <p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Before: ${baselineValue.toFixed(1)}%</p>
      <p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Intervention: ${interventionValue.toFixed(1)}%</p>
      <p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Comparison: ${comparisonValue >= 0 ? "+" : ""}${comparisonValue.toFixed(1)} pp</p>
      <p style="font-size: 9px; color: #96C2EF; margin-top: 4px;">Source: Women mobility questionnaire (self-reported)</p>
    </div>
  `;
}

export interface RenderTrikalaModeShareRadarOptions {
  map: L.Map;
  hub: { lat: number; lng: number };
  hubLabel?: string;
  segmentInsights: TrikalaSegmentInsight[];
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

/** Copenhagen-style mobility radar at the women mobility survey anchor (KPI 1.2). */
export function renderTrikalaModeShareRadar(options: RenderTrikalaModeShareRadarOptions): boolean {
  const {
    map,
    hub,
    hubLabel = "Women mobility survey anchor",
    segmentInsights,
    scenario,
    selectedSegmentId,
    segmentHandlers,
    markersOut,
    circlesOut,
    polylinesOut,
    polygonsOut,
    wireCircleMarker,
    getValueColor,
  } = options;

  const flows = buildTrikalaModeShareFlowPoints(segmentInsights, hub);
  if (!flows.length) return false;

  const hubSelected =
    selectedSegmentId === HUB_SEGMENT_ID ||
    selectedSegmentId === "tri-p1-smart-crossing";

  renderTrikalaMobilityHubStack({
    map,
    hubLat: hub.lat,
    hubLon: hub.lng,
    hubSegmentId: HUB_SEGMENT_ID,
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
    ringScale: 1,
    singleHubMarker: true,
    featureSelected: (segmentId) => {
      if (!selectedSegmentId) return false;
      if (selectedSegmentId === segmentId) return true;
      if (hubSelected) return false;
      const selectedBase = selectedSegmentId.replace(/-car$/, "");
      const spokeBase = segmentId.replace(/-car$/, "");
      return selectedBase === spokeBase;
    },
    buildPopup: (point: CopenhagenObservedPoint) => {
      const props = point.properties ?? {};
      return buildTrikalaFlowPopup({
        anchorLabel: hubLabel,
        direction: String(props.direction ?? props.mode ?? "n/a"),
        baselineValue: Number(props.baselineValue ?? point.value ?? 0),
        interventionValue: Number(props.interventionValue ?? point.value ?? 0),
        comparisonValue:
          typeof props.comparisonValue === "number"
            ? Number(props.comparisonValue)
            : Number(props.interventionValue ?? point.value ?? 0) -
              Number(props.baselineValue ?? point.value ?? 0),
        subSegment: String(props.subSegment ?? ""),
      });
    },
  });

  return true;
}
