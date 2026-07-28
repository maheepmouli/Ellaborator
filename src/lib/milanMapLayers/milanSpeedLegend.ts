import { getQuantile } from "@/lib/segmentHighlight";
import type { MapLegendItem } from "@/lib/mapLayerLegend";
import type { MilanSegmentRecord } from "@/services/milanSegmentData";
import { milanSpeedSegmentMetric } from "./renderMilanSpeedUnderlay";

function fmtKmh(n: number): string {
  return `${n.toFixed(0)} km/h`;
}

/** Legend bands aligned with HeroMap KPI 2.1 quantile colouring (15th / 85th). */
export function buildMilanSpeedLegendItems(records: MilanSegmentRecord[]): MapLegendItem[] {
  const measured = records.filter((r) => r.properties?.hasMetric !== false);
  const networkOnly = records.length - measured.length;

  if (!measured.length) {
    const items: MapLegendItem[] = [
      { label: "AMAT network segment", color: "#64748b" },
    ];
    if (networkOnly > 0) {
      items.push({ label: "No Maggio speed reading", color: "#475569" });
    }
    return items;
  }

  const values = measured.map((r) => milanSpeedSegmentMetric(r));
  const low = getQuantile(values, 0.15);
  const high = getQuantile(values, 0.85);

  const items: MapLegendItem[] = [
    { label: `Lower (≤ ${fmtKmh(low)})`, color: "#22C55E" },
    { label: `Mid (${fmtKmh(low)}–${fmtKmh(high)})`, color: "#94A3D4" },
    { label: `Higher (≥ ${fmtKmh(high)})`, color: "#F97316" },
  ];

  if (networkOnly > 0) {
    items.push({
      label: "Network (no Maggio reading)",
      color: "#64748b",
    });
  }

  return items;
}
