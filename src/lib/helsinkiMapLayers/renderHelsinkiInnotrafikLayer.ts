import L from "leaflet";
import {
  HELSINKI_VIIKKI_ANCHOR,
  type HelsinkiInnotrafikAlarmSummary,
} from "@/lib/helsinkiDataPaths";
import { loadHelsinkiInnotrafikSummarySnapshot } from "@/services/helsinkiLocalSnapshots";
import { bindCopenhagenMapTooltip } from "@/lib/copenhagenMapLayers/copenhagenMapTooltips";
import { scheduleLeafletLayerRepaint } from "@/lib/leafletMapSync";
import {
  wireCircleMarkerSegment,
  type SegmentInteractionHandlers,
} from "@/lib/wireMapSegmentInteraction";

export interface RenderHelsinkiInnotrafikLayerOptions {
  map: L.Map;
  summary?: HelsinkiInnotrafikAlarmSummary | null;
  selectedPilotId?: string | null;
  activeMapSegmentId?: string | null;
  segmentInteractionEnabled: boolean;
  segmentHandlers: SegmentInteractionHandlers;
  circlesOut: L.CircleMarker[];
}

function intensityColor(value: number): string {
  if (value >= 75) return "#ef4444";
  if (value >= 50) return "#f97316";
  if (value >= 25) return "#fbbf24";
  return "#38bdf8";
}

/** Innotrafik warning-system alarm intensity markers at Viikki (chart-derived until raw events arrive). */
export async function renderHelsinkiInnotrafikLayer(
  options: RenderHelsinkiInnotrafikLayerOptions
): Promise<void> {
  const {
    map,
    selectedPilotId,
    activeMapSegmentId,
    segmentInteractionEnabled,
    segmentHandlers,
    circlesOut,
  } = options;
  if (selectedPilotId && selectedPilotId !== "hel-p3") return;

  const summary = options.summary ?? (await loadHelsinkiInnotrafikSummarySnapshot());
  if (!summary?.periods?.length) return;

  const anchor = summary.coordinates ?? HELSINKI_VIIKKI_ANCHOR;
  const maxIntensity = Math.max(
    ...summary.periods.map((p) => p.relativeIntensity ?? 0),
    ...summary.weekdayMinutePeaks.map((p) => p.relativeIntensity)
  );

  summary.periods.forEach((period, index) => {
    const intensity = period.relativeIntensity ?? 0;
    if (intensity <= 0 && maxIntensity <= 0) return;

    const offsetLng = anchor.lng + (index - (summary.periods.length - 1) / 2) * 0.00045;
    const segmentId = `hel-innotrafik-${period.startDate}`;
    const selected = activeMapSegmentId === segmentId;
    const radius = selected ? 11 : 8;

    const marker = L.circleMarker([anchor.lat, offsetLng], {
      radius,
      fillColor: intensityColor(intensity || 20),
      fillOpacity: 0.88,
      color: selected ? "#2F1B6D" : "#ffffff",
      weight: selected ? 3 : 2,
      interactive: true,
    });

    bindCopenhagenMapTooltip(marker, `Innotrafik · ${period.label}`);
    marker.bindPopup(`
      <div style="font-family:'DM Sans',sans-serif;padding:8px;min-width:190px;">
        <p style="font-size:10px;color:#8578C3;margin:0 0 4px 0;text-transform:uppercase;">FVH3 · Innotrafik alarms</p>
        <p style="font-size:14px;font-weight:700;color:#2F1B6D;margin:0 0 6px 0;">${period.label}</p>
        <p style="font-size:10px;color:#96C2EF;margin:2px 0;">${period.startDate} → ${period.endDate}</p>
        ${
          period.relativeIntensity != null
            ? `<p style="font-size:10px;color:#96C2EF;margin:2px 0;">Relative intensity: ${period.relativeIntensity.toFixed(0)}%</p>`
            : ""
        }
        ${
          summary.medianDurationSec != null
            ? `<p style="font-size:10px;color:#96C2EF;margin:2px 0;">Median duration: ${summary.medianDurationSec}s</p>`
            : ""
        }
        <p style="font-size:10px;color:#64748b;margin:6px 0 0 0;">${summary.note}</p>
      </div>
    `);

    if (segmentInteractionEnabled) {
      wireCircleMarkerSegment(marker, {
        segmentId,
        segmentName: `Innotrafik ${period.label}`,
        speed: null,
        handlers: segmentHandlers,
      });
    }

    marker.addTo(map);
    circlesOut.push(marker);
  });

  scheduleLeafletLayerRepaint(map);
}
