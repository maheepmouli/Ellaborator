import L from "leaflet";
import { renderCopenhagenRadarFlowLayout } from "@/lib/copenhagenMapLayers/copenhagenRadarFlowLayout";
import type { CopenhagenObservedPoint } from "@/lib/copenhagenMapLayers/renderCopenhagenMapLayers";
import type { SegmentInteractionHandlers } from "@/lib/wireMapSegmentInteraction";
import { wireMarkerSegment } from "@/lib/wireMapSegmentInteraction";
import { createMapPointDivIcon } from "@/lib/mapPointIcons";
import type { TrikalaSegmentInsight } from "@/services/trikalaSurveyParser";
import { resolveTrikalaSurveyIconSpec } from "./trikalaPointIcons";
import { buildTrikalaModeShareFlowPoints } from "./trikalaModeShareMapFlows";

const HUB_SEGMENT_ID = "tri-p1-women-mobility";

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

/** Radar spokes from survey segments — same flow geometry as Copenhagen, no camera FOV or hardware icons. */
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
    wireCircleMarker,
  } = options;

  const flows = buildTrikalaModeShareFlowPoints(segmentInsights, hub);
  if (!flows.length) return false;

  const hubSelected =
    selectedSegmentId === HUB_SEGMENT_ID ||
    selectedSegmentId === "tri-p1-smart-crossing";

  const iconSpec = resolveTrikalaSurveyIconSpec(HUB_SEGMENT_ID, "kpi1.2", {
    subSegment: "Survey aggregate",
  });
  const hubMarker = L.marker([hub.lat, hub.lng], {
    icon: createMapPointDivIcon(iconSpec, `${iconSpec.label} · ${hubLabel}`),
    zIndexOffset: 1400,
  }).addTo(map);
  wireMarkerSegment(
    hubMarker,
    {
      segmentId: HUB_SEGMENT_ID,
      segmentName: hubLabel,
      speed: null,
      congestion: null,
    },
    segmentHandlers
  );
  hubMarker.bindTooltip(
    `${hubLabel}<br/><span style="font-size:9px;opacity:0.85">Self-reported segments · not camera counts</span>`,
    { direction: "top", opacity: 0.92 }
  );
  markersOut.push(hubMarker);

  const svgRenderer = L.svg({ padding: 0.8 });
  const circleMarkers = circlesOut as L.CircleMarker[];

  renderCopenhagenRadarFlowLayout({
    map,
    hubLat: hub.lat,
    hubLon: hub.lng,
    flows,
    scenario,
    selectedSegmentId,
    segmentHandlers,
    polylinesOut,
    circlesOut: circleMarkers,
    svgRenderer,
    wireCircleMarker,
    intensityScalar,
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
