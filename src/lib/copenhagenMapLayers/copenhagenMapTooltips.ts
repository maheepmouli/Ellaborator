import type { CircleMarker, Layer, Marker, Polyline } from "leaflet";

const TOOLTIP_OPTS = {
  direction: "top" as const,
  opacity: 1,
  className: "tri-segment-tooltip",
};

/** Hover label for Copenhagen map points, corridors, and sensors. */
export function bindCopenhagenMapTooltip(layer: Layer, label: string): void {
  if (!label.trim()) return;
  layer.bindTooltip(label, TOOLTIP_OPTS);
}

export function copenhagenFlowTerminalLabel(
  streetName: string,
  direction: string,
  isInbound: boolean
): string {
  const flow = `${streetName} · ${direction}`;
  return isInbound ? `Inbound · ${flow}` : `Outbound · ${flow}`;
}

export type CopenhagenTooltipLayer = Marker | CircleMarker | Polyline;
