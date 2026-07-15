import L from "leaflet";
import type { LocalCityPoint } from "@/services/localCityData";
import type { TrikalaSegmentInsight } from "@/services/trikalaSurveyParser";
import type { SegmentInteractionHandlers } from "@/lib/wireMapSegmentInteraction";
import { wirePolylineSegment, wireMarkerSegment } from "@/lib/wireMapSegmentInteraction";
import {
  buildSmartCrossingPolyline,
  jitterSurveyPosition,
  segmentRingRadiiMeters,
} from "./trikalaMapGeometry";
import {
  buildSurveyPopupHtml,
  resolveTrikalaSegmentTheme,
  resolveTrikalaSubSegmentAccent,
  resolveTrikalaSubSegmentLabel,
  themeColor,
  TRIKALA_SEGMENT_RING_THEMES,
  type TrikalaThemeId,
} from "./trikalaMapStyles";
import type { TrikalaLocation } from "@/data/trikalaLocationRegistry";
import { renderTrikalaInfrastructureLayers } from "./renderTrikalaInfrastructureLayers";
import { renderTrikalaModeShareRadar } from "./renderTrikalaModeShareRadar";
import { renderTrikalaPilot2ModeShareRadar } from "./renderTrikalaPilot2ModeShareRadar";
import { resolveTrikalaSurveyIconSpec } from "./trikalaPointIcons";
import { createMapPointDivIcon } from "@/lib/mapPointIcons";

export interface RenderTrikalaMapLayersOptions {
  map: L.Map;
  anchor: { lat: number; lng: number };
  selectedPilotId?: string | null;
  records: LocalCityPoint[];
  segmentInsights: TrikalaSegmentInsight[];
  infrastructureLocations?: TrikalaLocation[];
  selectedKpi: string;
  scenario: "baseline" | "intervention" | "comparison";
  selectedSegmentId?: string | null;
  filterRange?: [number, number];
  segmentHandlers: SegmentInteractionHandlers;
  getValueColor: (value: number, safetyKpi: boolean) => string;
  markersOut: L.Marker[];
  circlesOut: Array<L.Circle | L.CircleMarker>;
  polylinesOut: L.Polyline[];
  polygonsOut?: L.Polygon[];
  wireCircleMarker: (
    marker: L.CircleMarker,
    meta: { segmentId: string; segmentName: string; speed: null; congestion: number | null },
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

const RING_SEGMENTS: TrikalaSegmentInsight["segment"][] = [
  "village",
  "caregiver",
  "urban",
  "suburban",
];

function hasSmartCrossingRecords(records: LocalCityPoint[]): boolean {
  return records.some((r) =>
    String(r.properties?.segmentId ?? "").includes("smart-crossing")
  );
}

function renderSegmentGlowRings(
  map: L.Map,
  anchor: { lat: number; lng: number },
  insights: TrikalaSegmentInsight[],
  circlesOut: L.Circle[],
  selectedKpi: string
): void {
  RING_SEGMENTS.forEach((segmentKey, segmentIndex) => {
    const insight = insights.find((i) => i.segment === segmentKey);
    if (!insight || insight.responseCount <= 0) return;

    let theme: TrikalaThemeId = TRIKALA_SEGMENT_RING_THEMES[segmentKey] ?? "mobility";
    if (selectedKpi === "kpi4.1" || selectedKpi === "kpi4.2") {
      if (segmentKey === "urban" || segmentKey === "suburban") theme = "infrastructure";
    }
    if (selectedKpi === "kpi2.1") theme = "safety";

    const color = themeColor(theme);
    const radii = segmentRingRadiiMeters(insight.responseCount);
    const ringOffset = segmentIndex * 6;

    radii.forEach((radiusM, ringIdx) => {
      const ring = L.circle([anchor.lat, anchor.lng], {
        radius: radiusM + ringOffset,
        color,
        weight: ringIdx === 0 ? 2.8 : 2,
        opacity: 0.82 - ringIdx * 0.12,
        fillOpacity: 0.04,
        interactive: false,
        className: "tri-segment-glow-ring",
      }).addTo(map);
      circlesOut.push(ring);
    });

    const innerCore = L.circle([anchor.lat, anchor.lng], {
      radius: 12 + segmentIndex * 4,
      color: "rgba(255,255,255,0.55)",
      weight: 1.4,
      fillColor: color,
      fillOpacity: 0.2,
      interactive: false,
    }).addTo(map);
    circlesOut.push(innerCore);
  });
}

function renderSmartCrossingVector(
  map: L.Map,
  anchor: { lat: number; lng: number },
  records: LocalCityPoint[],
  selectedKpi: string,
  selectedSegmentId: string | null | undefined,
  segmentHandlers: SegmentInteractionHandlers,
  polylinesOut: L.Polyline[]
): void {
  if (selectedKpi !== "kpi2.1" && selectedKpi !== "kpi4.2") return;
  if (!hasSmartCrossingRecords(records)) return;

  const coords = buildSmartCrossingPolyline(anchor);
  const color = themeColor("safety");
  const baseStyle: L.PathOptions = {
    color,
    weight: 4,
    opacity: 0.88,
    dashArray: "8 8",
    className: "tri-crossing-dash-animated",
    lineCap: "round",
  };

  const polyline = L.polyline(coords, baseStyle).addTo(map);
  polyline.bindPopup(`
    <div style="font-family:'DM Sans',sans-serif;padding:8px;min-width:180px;">
      <p style="font-size:11px;color:#8578C3;margin:0 0 4px 0;text-transform:uppercase;">Smart crossing corridor</p>
      <p style="font-size:12px;font-weight:600;color:#2F1B6D;margin:0;">Vasili Tsitsani · Military School</p>
      <p style="font-size:10px;color:#96C2EF;margin:4px 0 0 0;">Smart crossing corridor — same anchor as mobility KPI 1.2</p>
    </div>
  `);

  wirePolylineSegment(
    polyline,
    {
      segmentId: "tri-p1-smart-crossing",
      segmentName: "Smart crossing — Military School",
      speed: null,
      congestion: null,
    },
    segmentHandlers,
    {
      baseStyle,
      highlightStyle: { weight: 5.5, opacity: 1, color: "#00ffff" },
      selectedSegmentId,
    }
  );
  polylinesOut.push(polyline);
}

function shouldHideAggregateSurveyMarkers(
  selectedKpi: string,
  selectedPilotId: string | null | undefined,
  infrastructureLocations: TrikalaLocation[],
  modeShareRadarActive: boolean
): boolean {
  if (modeShareRadarActive) return true;
  // Pilot 3 always shows survey pins alongside sensor nodes (different KPI semantics).
  if (selectedPilotId === "tri-p3") return false;
  if (selectedPilotId !== "tri-p1") return false;
  if (selectedKpi !== "kpi2.1" && selectedKpi !== "kpi4.2") return false;
  return infrastructureLocations.some((l) => l.kind === "smart_crossing_site");
}

function renderSurveyMarkers(
  map: L.Map,
  records: LocalCityPoint[],
  selectedKpi: string,
  selectedPilotId: string | null | undefined,
  selectedSegmentId: string | null | undefined,
  filterRange: [number, number],
  segmentHandlers: SegmentInteractionHandlers,
  markersOut: L.Marker[],
  circlesOut: L.Circle[],
  wireCircleMarker: RenderTrikalaMapLayersOptions["wireCircleMarker"],
  infrastructureLocations: TrikalaLocation[] = [],
  modeShareRadarActive = false
): void {
  if (shouldHideAggregateSurveyMarkers(selectedKpi, selectedPilotId, infrastructureLocations, modeShareRadarActive)) {
    return;
  }

  const visible = records.filter(
    (p) => p.value >= filterRange[0] && p.value <= filterRange[1]
  );

  visible.forEach((point, index) => {
    const props = point.properties || {};
    const segmentId = String(props.segmentId ?? point.id);
    const isEnvironmental =
      props.datasetKind === "environmental-sensor" || segmentId.includes("environmental");
    const isBikeLaneSensor = props.datasetKind === "bike-lane-sensor";
    if (
      isEnvironmental &&
      selectedKpi === "kpi3.2" &&
      infrastructureLocations.some((l) => l.kind === "air_quality_sensor")
    ) {
      return;
    }
    if (
      isBikeLaneSensor &&
      (selectedKpi === "kpi2.1" || selectedKpi === "kpi4.2") &&
      infrastructureLocations.some((l) => l.kind === "bike_lane_sensor")
    ) {
      return;
    }
    const [lat, lon] = jitterSurveyPosition(point.lat, point.lon, index, visible.length, segmentId);
    const accentColor = resolveTrikalaSubSegmentAccent(segmentId);
    const isSelected = selectedSegmentId === segmentId;
    const segName = resolveTrikalaSubSegmentLabel(segmentId, props);
    const iconSpec = resolveTrikalaSurveyIconSpec(segmentId, selectedKpi, props);
    const metricLabel = String(props.likertLabel ?? props.streetName ?? "Survey metric");

    const marker = L.marker([lat, lon], {
      icon: createMapPointDivIcon(iconSpec, `${iconSpec.label} · ${segName}`),
      zIndexOffset: isSelected ? 1200 : 1000 + index,
      interactive: true,
    }).addTo(map);
    marker.bindPopup(buildSurveyPopupHtml(point));
    marker.bindTooltip(
      `<span class="tri-segment-tooltip-inner" style="color:${accentColor}">${segName}</span><span class="tri-segment-tooltip-metric">${metricLabel}</span>`,
      {
        direction: "top",
        offset: [0, -10],
        opacity: 0.96,
        className: "tri-segment-tooltip",
      }
    );

    wireMarkerSegment(
      marker,
      {
        segmentId,
        segmentName: `${iconSpec.label} · ${segName}`,
        speed: null,
        congestion: point.value / 100,
      },
      segmentHandlers
    );

    markersOut.push(marker);
  });
}

function shouldRenderWomenMobilityRings(
  selectedPilotId: string | null | undefined,
  selectedKpi: string
): boolean {
  return selectedPilotId === "tri-p1" && selectedKpi === "kpi1.2";
}

export function renderTrikalaMapLayers(options: RenderTrikalaMapLayersOptions): void {
  const {
    map,
    anchor,
    selectedPilotId,
    records,
    segmentInsights,
    infrastructureLocations = [],
    selectedKpi,
    scenario,
    selectedSegmentId,
    filterRange = [0, 100],
    segmentHandlers,
    markersOut,
    circlesOut,
    polylinesOut,
    polygonsOut = [],
    wireCircleMarker,
    getValueColor,
  } = options;

  const modeShareRadarActive =
    (selectedPilotId === "tri-p1" &&
      selectedKpi === "kpi1.2" &&
      renderTrikalaModeShareRadar({
        map,
        hub: anchor,
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
      })) ||
    (selectedPilotId === "tri-p2" &&
      selectedKpi === "kpi1.2" &&
      renderTrikalaPilot2ModeShareRadar({
        map,
        hub: anchor,
        locations: infrastructureLocations,
        scenario,
        selectedSegmentId,
        segmentHandlers,
        markersOut,
        circlesOut,
        polylinesOut,
        polygonsOut,
        wireCircleMarker,
        getValueColor,
      }));

  if (shouldRenderWomenMobilityRings(selectedPilotId, selectedKpi) && !modeShareRadarActive) {
    renderSegmentGlowRings(map, anchor, segmentInsights, circlesOut as L.Circle[], selectedKpi);
  }

  if (infrastructureLocations.length > 0) {
    const bikeLaneBusyPctByLocationId: Record<string, number> = {};
    records.forEach((point) => {
      if (point.properties?.datasetKind !== "bike-lane-sensor") return;
      const locId = String(point.properties?.segmentId ?? "");
      if (!locId.startsWith("tri-loc-")) return;
      const busy =
        typeof point.properties?.busyPct === "number"
          ? point.properties.busyPct
          : selectedKpi === "kpi2.1"
            ? point.value
            : typeof point.properties?.availabilityPct === "number"
              ? 100 - point.properties.availabilityPct
              : 100 - point.value;
      bikeLaneBusyPctByLocationId[locId] = busy;
    });

    renderTrikalaInfrastructureLayers({
      map,
      anchor,
      locations: infrastructureLocations,
      selectedKpi,
      selectedPilotId,
      selectedSegmentId,
      segmentHandlers,
      markersOut,
      circlesOut,
      polylinesOut,
      polygonsOut,
      hideParkRideHubMarkers: modeShareRadarActive,
      bikeLaneBusyPctByLocationId,
    });
  } else {
    renderSmartCrossingVector(
      map,
      anchor,
      records,
      selectedKpi,
      selectedSegmentId,
      segmentHandlers,
      polylinesOut
    );
  }

  renderSurveyMarkers(
    map,
    records,
    selectedKpi,
    selectedPilotId,
    selectedSegmentId,
    filterRange,
    segmentHandlers,
    markersOut,
    circlesOut,
    wireCircleMarker,
    infrastructureLocations,
    modeShareRadarActive
  );
}
