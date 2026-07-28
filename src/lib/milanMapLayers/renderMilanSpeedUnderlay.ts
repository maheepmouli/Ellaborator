import L from "leaflet";
import { getQuantile, getSegmentHighlight } from "@/lib/segmentHighlight";
import type { MilanSegmentRecord } from "@/services/milanSegmentData";

export function milanSpeedSegmentMetric(segment: MilanSegmentRecord): number {
  const avg = Number(segment.properties?.avgSpeed ?? 0);
  const p85 = Number(segment.properties?.p85Speed ?? 0);
  if (avg > 0 || p85 > 0) return avg * 0.3 + p85 * 0.7;
  return segment.value;
}

export type MilanSpeedUnderlayOptions = {
  /** When true, draw a flat slate corridor (no speed quantile colours). */
  neutral?: boolean;
  opacityScale?: number;
};

/** Dim KPI 2.1 road-safety segments under other Milan KPI layers for spatial context. */
export function renderMilanSpeedSegmentUnderlay(
  map: L.Map,
  records: MilanSegmentRecord[],
  polylinesOut: L.Polyline[],
  opacityScaleOrOptions: number | MilanSpeedUnderlayOptions = 0.28
): number {
  if (!records.length) return 0;

  const options: MilanSpeedUnderlayOptions =
    typeof opacityScaleOrOptions === "number"
      ? { opacityScale: opacityScaleOrOptions }
      : opacityScaleOrOptions;
  const opacityScale = options.opacityScale ?? 0.28;
  const neutral = options.neutral === true;

  const measured = records.filter((record) => record.properties?.hasMetric !== false);
  const values = measured.map((record) => milanSpeedSegmentMetric(record));
  const lowThreshold = values.length ? getQuantile(values, 0.15) : 0;
  const highThreshold = values.length ? getQuantile(values, 0.85) : 100;
  let rendered = 0;

  records.forEach((segment) => {
    if (!segment.coordinates || segment.coordinates.length < 2) return;
    const hasMetric = segment.properties?.hasMetric !== false;

    let color = "#64748b";
    let weight = 2;
    let opacity = Math.min(0.45, 0.32 * opacityScale + 0.12);

    if (!neutral) {
      const metricValue = hasMetric ? milanSpeedSegmentMetric(segment) : 0;
      const highlight = hasMetric
        ? getSegmentHighlight(metricValue, lowThreshold, highThreshold)
        : { color: "#64748b", weight: 2, opacity: 0.35, band: "network" as const };
      color = highlight.color;
      weight = Math.max(2, highlight.weight - 1);
      opacity = hasMetric
        ? Math.min(0.55, highlight.opacity * opacityScale + 0.08)
        : Math.min(0.4, 0.35 * opacityScale + 0.1);
    }

    const line = L.polyline(segment.coordinates, {
      color,
      weight,
      opacity,
      lineJoin: "round",
      lineCap: "round",
      interactive: false,
    }).addTo(map);
    polylinesOut.push(line);
    rendered += 1;
  });

  return rendered;
}
