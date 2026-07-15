import L from "leaflet";
import { getQuantile, getSegmentHighlight } from "@/lib/segmentHighlight";
import type { MilanSegmentRecord } from "@/services/milanSegmentData";

export function milanSpeedSegmentMetric(segment: MilanSegmentRecord): number {
  const avg = Number(segment.properties?.avgSpeed ?? 0);
  const p85 = Number(segment.properties?.p85Speed ?? 0);
  if (avg > 0 || p85 > 0) return avg * 0.3 + p85 * 0.7;
  return segment.value;
}

/** Dim KPI 2.1 road-safety segments under KPI 1.2 junction hubs for spatial context. */
export function renderMilanSpeedSegmentUnderlay(
  map: L.Map,
  records: MilanSegmentRecord[],
  polylinesOut: L.Polyline[],
  opacityScale = 0.28
): number {
  if (!records.length) return 0;
  const values = records.map((record) => milanSpeedSegmentMetric(record));
  const lowThreshold = getQuantile(values, 0.15);
  const highThreshold = getQuantile(values, 0.85);
  let rendered = 0;

  records.forEach((segment) => {
    if (!segment.coordinates || segment.coordinates.length < 2) return;
    const metricValue = milanSpeedSegmentMetric(segment);
    const highlight = getSegmentHighlight(metricValue, lowThreshold, highThreshold);
    const line = L.polyline(segment.coordinates, {
      color: highlight.color,
      weight: Math.max(2, highlight.weight - 1),
      opacity: Math.min(0.55, highlight.opacity * opacityScale + 0.08),
      lineJoin: "round",
      lineCap: "round",
      interactive: false,
    }).addTo(map);
    polylinesOut.push(line);
    rendered += 1;
  });

  return rendered;
}
