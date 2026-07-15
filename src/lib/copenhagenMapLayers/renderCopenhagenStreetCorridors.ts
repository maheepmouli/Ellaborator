import L from "leaflet";
import { directionPairSlot } from "./copenhagenFlowGeometry";
import {
  copenhagenFlowLineOpacity,
  copenhagenFlowLineWeight,
  copenhagenZoomLineBoost,
  resolveCopenhagenIntensityColor,
} from "./copenhagenFlowStyles";
import { bindCopenhagenMapTooltip } from "./copenhagenMapTooltips";
import type { CopenhagenObservedPoint } from "./renderCopenhagenMapLayers";
import type { SegmentInteractionHandlers } from "@/lib/wireMapSegmentInteraction";
import { wirePolylineSegment } from "@/lib/wireMapSegmentInteraction";

function normalizeStreetKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "");
}

function flowMatchesStreet(street: string, flowLabel: string): boolean {
  const streetKey = normalizeStreetKey(street);
  const flowKey = normalizeStreetKey(flowLabel);
  if (!streetKey || !flowKey) return false;
  return flowKey.includes(streetKey) || streetKey.includes(flowKey.slice(0, Math.min(flowKey.length, 8)));
}

function intensityForFlow(
  point: CopenhagenObservedPoint,
  scenario: "baseline" | "intervention" | "comparison"
): number {
  const props = point.properties ?? {};
  const baseline = Number(props.baselineValue ?? point.value ?? 0);
  const intervention = Number(props.interventionValue ?? point.value ?? 0);
  const comparison =
    typeof props.comparisonValue === "number"
      ? Number(props.comparisonValue)
      : intervention - baseline;
  if (scenario === "baseline") return baseline;
  if (scenario === "intervention") return intervention;
  return Math.min(100, Math.abs(comparison) * 4);
}

function flowArrowIcon(bearingDeg: number, color: string, size = 14): L.DivIcon {
  return L.divIcon({
    className: "cph-street-flow-arrow",
    html: `<svg width="${size}" height="${size}" viewBox="0 0 12 12" style="transform: rotate(${bearingDeg}deg); filter: drop-shadow(0 0 2px ${color});"><path d="M6 1 L10 9 L6 7 L2 9 Z" fill="${color}" opacity="0.95"/></svg>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function bearingBetweenCoords(
  from: [number, number],
  to: [number, number]
): number {
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

export interface RenderCopenhagenStreetCorridorsOptions {
  map: L.Map;
  streetsGeoJson: GeoJSON.FeatureCollection;
  flowsByWorkbook: Map<string, CopenhagenObservedPoint[]>;
  scenario: "baseline" | "intervention" | "comparison";
  selectedSegmentId?: string | null;
  segmentHandlers: SegmentInteractionHandlers;
  polylinesOut: L.Polyline[];
  markersOut: L.Marker[];
  getValueColor: (value: number, safetyKpi: boolean) => string;
  safetyKpi?: boolean;
}

/**
 * Issy-style glowing street corridors on real OSM geometry, coloured by flow rate.
 */
export function renderCopenhagenStreetCorridors(
  options: RenderCopenhagenStreetCorridorsOptions
): void {
  const {
    map,
    streetsGeoJson,
    flowsByWorkbook,
    scenario,
    selectedSegmentId,
    segmentHandlers,
    polylinesOut,
    markersOut,
    getValueColor,
    safetyKpi = false,
  } = options;

  const hasFocus = Boolean(selectedSegmentId);

  streetsGeoJson.features.forEach((feature) => {
    if (feature.geometry?.type !== "LineString") return;
    const props = feature.properties ?? {};
    const street = String(props.street ?? "");
    const cameraId = String(props.cameraId ?? "");
    const flows = flowsByWorkbook.get(cameraId) ?? [];
    if (!flows.length || !street) return;

    const matched = flows.filter((flow) => {
      const direction = String(flow.properties?.direction ?? flow.properties?.mode ?? "");
      return flowMatchesStreet(street, direction);
    });
    if (!matched.length) return;

    let baselineSum = 0;
    let interventionSum = 0;
    let comparisonSum = 0;
    matched.forEach((flow) => {
      const props = flow.properties ?? {};
      baselineSum += Number(props.baselineValue ?? flow.value ?? 0);
      interventionSum += Number(props.interventionValue ?? flow.value ?? 0);
      comparisonSum +=
        typeof props.comparisonValue === "number"
          ? Number(props.comparisonValue)
          : Number(props.interventionValue ?? flow.value ?? 0) -
            Number(props.baselineValue ?? flow.value ?? 0);
    });
    const n = matched.length;
    const baselineValue = baselineSum / n;
    const interventionValue = interventionSum / n;
    const comparisonValue = comparisonSum / n;
    const intensityValue =
      scenario === "baseline"
        ? baselineValue
        : scenario === "intervention"
          ? interventionValue
          : Math.min(100, Math.abs(comparisonValue) * 4);

    const primary = matched[0];
    const segmentId = String(
      primary.properties?.segmentId || primary.properties?.id || primary.id
    );
    const segmentName = `${street} · ${String(primary.properties?.direction ?? "flow")}`;
    const isSelected = selectedSegmentId === segmentId;
    const dimmed = hasFocus && !isSelected;

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

    const rawCoords = feature.geometry.coordinates as [number, number][];
    const latLngs: [number, number][] = rawCoords.map(([lon, lat]) => [lat, lon]);

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

    const inboundFlows = matched.filter((flow, idx) => {
      const direction = String(flow.properties?.direction ?? flow.properties?.mode ?? "");
      return directionPairSlot(direction, idx) === 0;
    });
    const outboundFlows = matched.filter((flow, idx) => {
      const direction = String(flow.properties?.direction ?? flow.properties?.mode ?? "");
      return directionPairSlot(direction, idx) === 1;
    });

    const placeArrow = (fraction: number, bearing: number, color: string) => {
      const along = pointAlongLine(latLngs, fraction);
      if (!along) return;
      const marker = L.marker(along.point, {
        icon: flowArrowIcon(bearing, color),
        interactive: false,
        zIndexOffset: 900,
      }).addTo(map);
      markersOut.push(marker);
    };

    if (inboundFlows.length) {
      const along = pointAlongLine(latLngs, 0.72);
      if (along) placeArrow(0.72, along.bearing, lineColor);
    }
    if (outboundFlows.length) {
      const along = pointAlongLine(latLngs, 0.28);
      if (along) placeArrow(0.28, (along.bearing + 180) % 360, lineColor);
    }
    if (!inboundFlows.length && !outboundFlows.length) {
      const along = pointAlongLine(latLngs, 0.65);
      if (along) placeArrow(0.65, along.bearing, lineColor);
      const reverse = pointAlongLine(latLngs, 0.35);
      if (reverse) placeArrow(0.35, (reverse.bearing + 180) % 360, lineColor);
    }
  });
}
