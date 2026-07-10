import type { TrikalaLocationKind } from "@/data/trikalaLocationRegistry";
import { TRIKALA_DEFAULT_MAP_ZOOM } from "@/lib/trikalaMapConfig";
import type * as L from "leaflet";

export const TRIKALA_INFRA_COLORS = {
  cyan: "#00ffff",
  amber: "#ffb300",
  emerald: "#2ecc71",
  indigo: "#7f5af0",
} as const;

/** Core neon fill per asset kind (legend taxonomy). */
export const TRIKALA_KIND_COLORS: Record<TrikalaLocationKind, string> = {
  smart_crossing_site: TRIKALA_INFRA_COLORS.cyan,
  traffic_signal: TRIKALA_INFRA_COLORS.cyan,
  air_quality_sensor: TRIKALA_INFRA_COLORS.amber,
  bike_station: TRIKALA_INFRA_COLORS.emerald,
  park_and_ride: TRIKALA_INFRA_COLORS.emerald,
  parking_station: TRIKALA_INFRA_COLORS.indigo,
  bike_lane_sensor: TRIKALA_INFRA_COLORS.cyan,
};

/** Hover / glow halo per kind. */
export const TRIKALA_KIND_GLOW: Record<TrikalaLocationKind, string> = {
  smart_crossing_site: "#e0ffff",
  traffic_signal: "#e0ffff",
  air_quality_sensor: "#ffe082",
  bike_lane_sensor: "#e0ffff",
  bike_station: "#a3e4d7",
  park_and_ride: "#a3e4d7",
  parking_station: "#b39ddb",
};

/** Base pixel radius at reference zoom (17) before capacity + zoom scaling. */
export const TRIKALA_KIND_BASE_RADIUS: Record<TrikalaLocationKind, number> = {
  smart_crossing_site: 9,
  traffic_signal: 9,
  air_quality_sensor: 10,
  bike_lane_sensor: 9,
  bike_station: 11,
  park_and_ride: 10,
  parking_station: 9,
};

export const TRIKALA_PULSE_KINDS = new Set<TrikalaLocationKind>([
  "air_quality_sensor",
  "bike_lane_sensor",
]);

export function getInfraColorByKind(kind: TrikalaLocationKind): string {
  return TRIKALA_KIND_COLORS[kind];
}

export function getInfraGlowByKind(kind: TrikalaLocationKind): string {
  return TRIKALA_KIND_GLOW[kind];
}

/**
 * Zoom-aware marker radius — larger at wide views (z14), tighter at z19.
 * Hover / selection applies +50% expansion.
 */
export function infraMarkerRadius(
  kind: TrikalaLocationKind,
  zoom: number,
  capacityScale = 1,
  expanded = false
): number {
  const base = TRIKALA_KIND_BASE_RADIUS[kind] * capacityScale;
  const zoomScaled = base * Math.pow(1.1, zoom - TRIKALA_DEFAULT_MAP_ZOOM);
  const clamped = Math.min(18, Math.max(8, zoomScaled));
  return expanded ? clamped * 1.5 : clamped;
}

export function infraCircleMarkerStyle(
  kind: TrikalaLocationKind,
  zoom: number,
  capacityScale: number,
  expanded: boolean
): L.CircleMarkerOptions {
  const fill = getInfraColorByKind(kind);
  const stroke = getInfraGlowByKind(kind);
  const selected = expanded;
  const fillOpacity =
    kind === "parking_station" ? (selected ? 0.72 : 0.55) : selected ? 0.9 : 0.65;

  return {
    radius: infraMarkerRadius(kind, zoom, capacityScale, expanded),
    color: stroke,
    weight: selected ? 3 : kind === "bike_station" ? 2 : 1.5,
    opacity: 1,
    fillColor: fill,
    fillOpacity,
    className: `tri-infra-marker tri-infra-marker--${kind}`,
  };
}

export function applyInfraMarkerGlow(layer: L.CircleMarker, kind: TrikalaLocationKind): void {
  layer.on("add", () => {
    const el = layer.getElement();
    if (!el) return;
    el.style.setProperty("--marker-glow-color", getInfraGlowByKind(kind));
    el.setAttribute("data-kind", kind);
  });
}

export function infrastructureMarkerHtml(options: {
  kind: TrikalaLocationKind;
  color: string;
  isSelected?: boolean;
  scale?: number;
}): string {
  const { kind, color, isSelected = false, scale = 1 } = options;
  const size = Math.round((kind === "park_and_ride" ? 18 : 14) * scale);
  const glow = isSelected ? `0 0 14px ${color}` : `0 0 8px ${color}88`;
  const ring =
    kind === "air_quality_sensor"
      ? `<span class="tri-infra-outer-ring" style="border-color:${color}55"></span>`
      : "";
  const shape =
    kind === "bike_station" || kind === "park_and_ride"
      ? `<span class="tri-infra-pin" style="background:${color};box-shadow:${glow}"></span>`
      : `<span class="tri-infra-dot" style="background:${color};box-shadow:${glow}"></span>`;
  return `<div class="tri-infra-marker tri-infra-${kind}${isSelected ? " is-selected" : ""}" style="--tri-infra-color:${color};--tri-infra-size:${size}px">${ring}${shape}</div>`;
}

export function infrastructurePopupHtml(name: string, kind: TrikalaLocationKind, folder: string): string {
  const label = kind.replace(/_/g, " ");
  return `
    <div style="font-family:'DM Sans',sans-serif;padding:8px;min-width:180px;">
      <p style="font-size:10px;color:#96C2EF;margin:0 0 4px 0;text-transform:uppercase;">${label}</p>
      <p style="font-size:12px;font-weight:600;color:#EAF7FF;margin:0;">${name}</p>
      <p style="font-size:10px;color:#ffffff99;margin:4px 0 0 0;">${folder}</p>
    </div>
  `;
}

export function capacityScale(capacity?: number): number {
  if (!capacity || capacity <= 0) return 1;
  return Math.min(1.45, 0.85 + Math.log10(capacity + 1) * 0.18);
}
