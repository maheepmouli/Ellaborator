import L from "leaflet";
import type { LocalCityPoint } from "@/services/localCityData";
import { renderHubRipplePulseOverlay } from "@/lib/copenhagenMapLayers/copenhagenTrafficPulse";
import {
  wireCircleMarkerSegment,
  type SegmentInteractionHandlers,
} from "@/lib/wireMapSegmentInteraction";

const SAFETY_KINDS = new Set(["school-monitoring", "manual-count", "comparativa"]);
const PULSE_MIN_ZOOM = 11;
const HUB_RING_SCALE = 0.7;

export interface RenderZaragozaKpi21LayersOptions {
  map: L.Map;
  points: LocalCityPoint[];
  selectedPilotId?: string | null;
  activeMapSegmentId?: string | null;
  scenario?: "baseline" | "intervention" | "comparison";
  segmentInteractionEnabled?: boolean;
  segmentHandlers?: SegmentInteractionHandlers;
  markersOut: L.Marker[];
  circlesOut: L.CircleMarker[];
  wireCircleMarker?: typeof wireCircleMarkerSegment;
}

function displaySpeedKmh(
  point: LocalCityPoint,
  scenario: "baseline" | "intervention" | "comparison"
): number {
  const props = point.properties ?? {};
  if (scenario === "baseline") return Number(props.baselineValue ?? point.value) || 0;
  if (scenario === "comparison") return Math.abs(Number(props.comparisonValue ?? 0));
  return Number(props.interventionValue ?? point.value) || 0;
}

function isSpeedPoint(point: LocalCityPoint): boolean {
  const method = String(point.properties?.method ?? "");
  const source = String(point.properties?.source ?? "");
  return (
    point.properties?.datasetKind === "comparativa" ||
    /\bkm\/h\b/i.test(method) ||
    /corridor speeds|hospital/i.test(source)
  );
}

function hubColor(point: LocalCityPoint, value: number): { fill: string; inbound: boolean } {
  if (!isSpeedPoint(point)) {
    // Conflict / parking pressure — red when elevated.
    return value >= 40
      ? { fill: "#ef4444", inbound: true }
      : { fill: "#f97316", inbound: true };
  }
  // Speed: red = faster / hotter, blue = calmer.
  return value >= 32
    ? { fill: "#ef4444", inbound: true }
    : { fill: "#38bdf8", inbound: false };
}

/**
 * Zaragoza KPI 2.1 — safety hubs (school conflict / hospital mock speeds).
 * Copenhagen-style ripples, no FOV wedges.
 */
export function renderZaragozaKpi21Layers(options: RenderZaragozaKpi21LayersOptions): number {
  const {
    map,
    points,
    activeMapSegmentId,
    scenario = "intervention",
    segmentInteractionEnabled,
    segmentHandlers,
    markersOut,
    circlesOut,
    wireCircleMarker,
  } = options;

  const safetyPoints = points.filter((p) =>
    SAFETY_KINDS.has(String(p.properties?.datasetKind ?? ""))
  );
  const pool = safetyPoints.length ? safetyPoints : points;
  if (!pool.length) return 0;

  let rendered = 0;
  pool.forEach((point, index) => {
    const value = displaySpeedKmh(point, scenario);
    const { fill, inbound } = hubColor(point, value);
    const segmentId = String(
      point.properties?.segmentId ?? point.properties?.siteId ?? point.id ?? `zar-safety-${index}`
    );
    const label = String(
      point.properties?.streetName ?? point.properties?.category ?? "Safety site"
    );
    const unit = isSpeedPoint(point) ? "km/h" : "idx";
    const segmentName = `${label} · ${value.toFixed(1)} ${unit}`;

    renderHubRipplePulseOverlay(map, point.lat, point.lon, inbound, markersOut, circlesOut, {
      showAnchorDot: true,
      ringColor: fill,
      ringScale: HUB_RING_SCALE,
      minZoom: PULSE_MIN_ZOOM,
      interaction:
        segmentInteractionEnabled && segmentHandlers
          ? {
              segmentId,
              segmentName,
              segmentHandlers,
              selectedSegmentId: activeMapSegmentId,
              wireCircleMarker,
            }
          : undefined,
    });

    const hub = circlesOut[circlesOut.length - 1];
    if (hub && "bindTooltip" in hub) {
      hub.bindTooltip(segmentName, {
        direction: "top",
        opacity: 1,
        className: "tri-segment-tooltip",
      });
    }
    rendered += 1;
  });

  return rendered;
}
