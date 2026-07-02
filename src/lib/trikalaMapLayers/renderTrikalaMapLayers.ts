import L from "leaflet";
import type { LocalCityPoint } from "@/services/localCityData";
import type { TrikalaSegmentInsight } from "@/services/trikalaSurveyParser";
import { renderInfluenceField } from "@/lib/renderInfluenceField";
import type { SegmentInteractionHandlers } from "@/lib/wireMapSegmentInteraction";
import { wireCircleMarkerSegment, wirePolylineSegment } from "@/lib/wireMapSegmentInteraction";
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
  surveyMarkerHtml,
  themeColor,
  TRIKALA_SEGMENT_RING_THEMES,
  type TrikalaThemeId,
} from "./trikalaMapStyles";

export interface RenderTrikalaMapLayersOptions {
  map: L.Map;
  anchor: { lat: number; lng: number };
  records: LocalCityPoint[];
  segmentInsights: TrikalaSegmentInsight[];
  selectedKpi: string;
  scenario: "baseline" | "intervention" | "comparison";
  selectedSegmentId?: string | null;
  filterRange?: [number, number];
  segmentHandlers: SegmentInteractionHandlers;
  getValueColor: (value: number, safetyKpi: boolean) => string;
  markersOut: L.Marker[];
  circlesOut: L.Circle[];
  polylinesOut: L.Polyline[];
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

function renderInfluenceAndPulse(
  map: L.Map,
  anchor: { lat: number; lng: number },
  circlesOut: L.Circle[]
): void {
  renderInfluenceField(map, circlesOut, {
    center: [anchor.lat, anchor.lng],
    radiusMeters: 220,
    tone: "neutral",
  });

  const outline = L.circle([anchor.lat, anchor.lng], {
    radius: 220,
    color: "rgba(255,255,255,0.18)",
    weight: 1.1,
    dashArray: "5 7",
    fillOpacity: 0,
    interactive: false,
  }).addTo(map);
  circlesOut.push(outline);

  const pulse = L.circle([anchor.lat, anchor.lng], {
    radius: 180,
    color: "rgba(0,255,255,0.35)",
    weight: 1.5,
    fillColor: "#00ffff",
    fillOpacity: 0.12,
    className: "trikala-survey-pulse-glow",
    interactive: false,
  }).addTo(map);
  circlesOut.push(pulse);
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
        weight: ringIdx === 0 ? 2 : 1.2,
        opacity: 0.55 - ringIdx * 0.1,
        fillOpacity: 0,
        interactive: false,
        className: "tri-segment-glow-ring",
      }).addTo(map);
      circlesOut.push(ring);
    });

    const innerCore = L.circle([anchor.lat, anchor.lng], {
      radius: 12 + segmentIndex * 4,
      color: "rgba(255,255,255,0.35)",
      weight: 1,
      fillColor: color,
      fillOpacity: 0.08,
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
      <p style="font-size:12px;font-weight:600;color:#2F1B6D;margin:0;">Asklipiou × Stratigou Sarafi</p>
      <p style="font-size:10px;color:#96C2EF;margin:4px 0 0 0;">Inferred crossing vector — survey anchor geometry</p>
    </div>
  `);

  wirePolylineSegment(
    polyline,
    {
      segmentId: "tri-p1-smart-crossing",
      segmentName: "Smart crossing — Asklipiou",
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

function renderSurveyMarkers(
  map: L.Map,
  records: LocalCityPoint[],
  selectedKpi: string,
  selectedSegmentId: string | null | undefined,
  filterRange: [number, number],
  segmentHandlers: SegmentInteractionHandlers,
  markersOut: L.Marker[],
  circlesOut: L.Circle[],
  wireCircleMarker: RenderTrikalaMapLayersOptions["wireCircleMarker"]
): void {
  const visible = records.filter(
    (p) => p.value >= filterRange[0] && p.value <= filterRange[1]
  );

  visible.forEach((point, index) => {
    const props = point.properties || {};
    const segmentId = String(props.segmentId ?? point.id);
    const [lat, lon] = jitterSurveyPosition(point.lat, point.lon, index, visible.length, segmentId);
    const theme = resolveTrikalaSegmentTheme(segmentId, selectedKpi);
    const accentColor = resolveTrikalaSubSegmentAccent(segmentId);
    const isEnvironmental =
      props.datasetKind === "environmental-sensor" || segmentId.includes("environmental");
    const isSelected = selectedSegmentId === segmentId;
    const segName = resolveTrikalaSubSegmentLabel(segmentId, props);
    const metricLabel = String(props.likertLabel ?? props.streetName ?? "Survey metric");

    const marker = L.marker([lat, lon], {
      icon: L.divIcon({
        className: "tri-survey-icon",
        html: surveyMarkerHtml({
          theme,
          accentColor,
          isSelected,
          intensity: point.value,
          isEnvironmental,
        }),
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      }),
      zIndexOffset: isSelected ? 1200 : 1000 + index,
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

    const hit = L.circleMarker([lat, lon], {
      radius: 14,
      fillOpacity: 0,
      opacity: 0,
      weight: 0,
    }).addTo(map);

    wireCircleMarker(
      hit,
      {
        segmentId,
        segmentName: segName,
        speed: null,
        congestion: point.value / 100,
      },
      segmentHandlers,
      { baseRadius: 14, highlightRadius: 17, selectedSegmentId }
    );

    markersOut.push(marker);
    circlesOut.push(hit);
  });
}

export function renderTrikalaMapLayers(options: RenderTrikalaMapLayersOptions): void {
  const {
    map,
    anchor,
    records,
    segmentInsights,
    selectedKpi,
    selectedSegmentId,
    filterRange = [0, 100],
    segmentHandlers,
    markersOut,
    circlesOut,
    polylinesOut,
    wireCircleMarker,
  } = options;

  renderInfluenceAndPulse(map, anchor, circlesOut);
  renderSegmentGlowRings(map, anchor, segmentInsights, circlesOut, selectedKpi);
  renderSmartCrossingVector(
    map,
    anchor,
    records,
    selectedKpi,
    selectedSegmentId,
    segmentHandlers,
    polylinesOut
  );
  renderSurveyMarkers(
    map,
    records,
    selectedKpi,
    selectedSegmentId,
    filterRange,
    segmentHandlers,
    markersOut,
    circlesOut,
    wireCircleMarker
  );
}
