import L from "leaflet";
import { directionPairSlot } from "./copenhagenFlowGeometry";
import {
  copenhagenFlowLineOpacity,
  copenhagenFlowLineWeight,
  copenhagenZoomLineBoost,
  resolveCopenhagenIntensityColor,
} from "./copenhagenFlowStyles";
import { bindCopenhagenMapTooltip } from "./copenhagenMapTooltips";
import type { SegmentInteractionHandlers } from "@/lib/wireMapSegmentInteraction";
import { wirePolylineSegment } from "@/lib/wireMapSegmentInteraction";

function flowArrowIcon(bearingDeg: number, color: string, size = 14): L.DivIcon {
  return L.divIcon({
    className: "cph-street-flow-arrow",
    html: `<svg width="${size}" height="${size}" viewBox="0 0 12 12" style="transform: rotate(${bearingDeg}deg); filter: drop-shadow(0 0 2px ${color});"><path d="M6 1 L10 9 L6 7 L2 9 Z" fill="${color}" opacity="0.95"/></svg>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function bearingBetweenCoords(from: [number, number], to: [number, number]): number {
  const [lat1, lon1] = from;
  const [lat2, lon2] = to;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const lat1r = (lat1 * Math.PI) / 180;
  const lat2r = (lat2 * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2r);
  const x =
    Math.cos(lat1r) * Math.sin(lat2r) -
    Math.sin(lat1r) * Math.cos(lat2r) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function pointAlongLine(
  coords: [number, number][],
  fraction: number
): { point: [number, number]; bearing: number } | null {
  if (coords.length < 2) return null;
  const idx = Math.min(coords.length - 2, Math.floor(fraction * (coords.length - 1)));
  const a = coords[idx];
  const b = coords[idx + 1];
  const t = fraction * (coords.length - 1) - idx;
  return {
    point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
    bearing: bearingBetweenCoords(a, b),
  };
}

export interface RenderFlowCorridorAlongPathOptions {
  map: L.Map;
  latLngs: [number, number][];
  segmentId: string;
  segmentName: string;
  scenario: "baseline" | "intervention" | "comparison";
  baselineValue: number;
  interventionValue: number;
  comparisonValue: number;
  selectedSegmentId?: string | null;
  segmentHandlers: SegmentInteractionHandlers;
  polylinesOut: L.Polyline[];
  markersOut?: L.Marker[];
  getValueColor?: (value: number, safetyKpi: boolean) => string;
  safetyKpi?: boolean;
  flowDirection?: string;
  flowIndex?: number;
}

/** Issy/Copenhagen-style glowing corridor on an arbitrary path (street geometry or survey spoke). */
export function renderFlowCorridorAlongPath(options: RenderFlowCorridorAlongPathOptions): void {
  const {
    map,
    latLngs,
    segmentId,
    segmentName,
    scenario,
    baselineValue,
    interventionValue,
    comparisonValue,
    selectedSegmentId,
    segmentHandlers,
    polylinesOut,
    markersOut,
    getValueColor,
    safetyKpi = false,
    flowDirection = "",
    flowIndex = 0,
  } = options;

  if (latLngs.length < 2) return;

  const hasFocus = Boolean(selectedSegmentId);
  const isSelected = selectedSegmentId === segmentId;
  const dimmed = hasFocus && !isSelected;
  const intensityValue =
    scenario === "baseline"
      ? baselineValue
      : scenario === "intervention"
        ? interventionValue
        : Math.min(100, Math.abs(comparisonValue) * 4);

  const lineColor = resolveCopenhagenIntensityColor({
    scenario,
    baselineValue,
    interventionValue,
    comparisonValue,
    getValueColor,
    safetyKpi,
  });
  const zoomBoost = copenhagenZoomLineBoost(map.getZoom());
  const weight = copenhagenFlowLineWeight(intensityValue, isSelected) * zoomBoost;
  const opacity = copenhagenFlowLineOpacity(intensityValue, isSelected, dimmed);

  const glow = L.polyline(latLngs, {
    color: lineColor,
    weight: weight + 8,
    opacity: isSelected ? 0.42 : opacity * 0.35,
    lineCap: "round",
    lineJoin: "round",
    interactive: false,
  }).addTo(map);
  polylinesOut.push(glow);

  const aura = L.polyline(latLngs, {
    color: isSelected ? "#00ffff" : lineColor,
    weight: weight + 4,
    opacity: isSelected ? 0.55 : opacity * 0.5,
    lineCap: "round",
    lineJoin: "round",
    interactive: false,
  }).addTo(map);
  polylinesOut.push(aura);

  const core = L.polyline(latLngs, {
    color: isSelected ? "#ffffff" : lineColor,
    weight,
    opacity,
    lineCap: "round",
    lineJoin: "round",
    dashArray: scenario === "baseline" ? "7 5" : undefined,
    interactive: false,
  }).addTo(map);
  polylinesOut.push(core);

  const hit = L.polyline(latLngs, {
    color: lineColor,
    weight: Math.max(14, weight + 6),
    opacity: 0,
    lineCap: "round",
    lineJoin: "round",
    interactive: true,
  }).addTo(map);
  wirePolylineSegment(
    hit,
    { segmentId, segmentName, speed: null, congestion: null },
    segmentHandlers,
    {
      baseStyle: { color: lineColor, weight: 14, opacity: 0 },
      highlightStyle: {
        color: isSelected ? "#00ffff" : lineColor,
        weight: 18,
        opacity: 0.22,
      },
      selectedSegmentId,
    }
  );
  bindCopenhagenMapTooltip(hit, segmentName);
  polylinesOut.push(hit);

  if (!markersOut) return;

  const inbound = directionPairSlot(flowDirection, flowIndex) === 0;
  const outbound = directionPairSlot(flowDirection, flowIndex) === 1;

  const placeArrow = (fraction: number, bearing: number) => {
    const along = pointAlongLine(latLngs, fraction);
    if (!along) return;
    const marker = L.marker(along.point, {
      icon: flowArrowIcon(bearing, lineColor),
      interactive: false,
      zIndexOffset: 900,
    }).addTo(map);
    markersOut.push(marker);
  };

  if (inbound) {
    const along = pointAlongLine(latLngs, 0.72);
    if (along) placeArrow(0.72, along.bearing);
  }
  if (outbound) {
    const along = pointAlongLine(latLngs, 0.28);
    if (along) placeArrow(0.28, (along.bearing + 180) % 360);
  }
  if (!inbound && !outbound) {
    const along = pointAlongLine(latLngs, 0.65);
    if (along) placeArrow(0.65, along.bearing);
    const reverse = pointAlongLine(latLngs, 0.35);
    if (reverse) placeArrow(0.35, (reverse.bearing + 180) % 360);
  }
}
