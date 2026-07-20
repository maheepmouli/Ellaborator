import L from "leaflet";
import {
  HELSINKI_VIIKKI_ANCHOR,
  type HelsinkiHslTram15Sample,
} from "@/lib/helsinkiDataPaths";
import { loadHelsinkiHslTramSnapshot } from "@/services/helsinkiLocalSnapshots";
import { bindCopenhagenMapTooltip } from "@/lib/copenhagenMapLayers/copenhagenMapTooltips";
import { scheduleLeafletLayerRepaint } from "@/lib/leafletMapSync";
import {
  wirePolylineSegment,
  type SegmentInteractionHandlers,
} from "@/lib/wireMapSegmentInteraction";

export interface RenderHelsinkiHslTramLayerOptions {
  map: L.Map;
  /** When provided, skips snapshot fetch (HeroMap may prefetch via React Query). */
  tramSample?: HelsinkiHslTram15Sample | null;
  selectedPilotId?: string | null;
  polylinesOut: L.Polyline[];
  /** Faint underlay when true (KPI 1.2). */
  subtle?: boolean;
  /** Clip corridor to Viikki vicinity so HeroMap fitBounds does not zoom to citywide. */
  clipNearViikki?: boolean;
  segmentInteractionEnabled?: boolean;
  segmentHandlers?: SegmentInteractionHandlers;
  activeMapSegmentId?: string | null;
}

function peakHourLabel(sample: HelsinkiHslTram15Sample): string {
  const peak = sample.hourlyPresence.reduce(
    (best, row) => (row.pings > best.pings ? row : best),
    sample.hourlyPresence[0] ?? { hour: 0, pings: 0, vehicles: 0 }
  );
  return `${String(peak.hour).padStart(2, "0")}:00 · ${peak.vehicles} vehicles`;
}

/** Keep only corridor vertices within ~radiusDeg of Viikki (~2–3 km). */
function clipLatLngsNearViikki(
  latlngs: Array<[number, number]>,
  radiusDeg = 0.028
): Array<[number, number]> {
  const clipped = latlngs.filter(
    ([lat, lng]) =>
      Math.hypot(lat - HELSINKI_VIIKKI_ANCHOR.lat, lng - HELSINKI_VIIKKI_ANCHOR.lng) <= radiusDeg
  );
  return clipped.length >= 2 ? clipped : latlngs.slice(0, Math.min(40, latlngs.length));
}

/** HSL tram line 15 corridor sample through Viikki (FVH3 multimodal context). */
export async function renderHelsinkiHslTramLayer(
  options: RenderHelsinkiHslTramLayerOptions
): Promise<void> {
  const {
    map,
    selectedPilotId,
    polylinesOut,
    subtle = false,
    clipNearViikki = true,
    segmentInteractionEnabled,
    segmentHandlers,
    activeMapSegmentId,
  } = options;
  if (selectedPilotId && selectedPilotId !== "hel-p3") return;

  const sample = options.tramSample ?? (await loadHelsinkiHslTramSnapshot());
  if (!sample?.corridorSample?.geometry?.coordinates?.length) return;

  let latlngs = sample.corridorSample.geometry.coordinates.map(
    ([lng, lat]) => [lat, lng] as [number, number]
  );
  if (clipNearViikki) {
    latlngs = clipLatLngsNearViikki(latlngs);
  }

  const line = L.polyline(latlngs, {
    color: subtle ? "#94a3b8" : "#8578C3",
    weight: subtle ? 3 : 4,
    opacity: subtle ? 0.45 : 0.82,
    dashArray: subtle ? "6 8" : "10 6",
    lineCap: "round",
    interactive: true,
  });

  bindCopenhagenMapTooltip(line, `HSL line ${sample.line} · ${sample.sampleDate}`);
  line.bindPopup(`
    <div style="font-family:'DM Sans',sans-serif;padding:8px;min-width:200px;">
      <p style="font-size:10px;color:#8578C3;margin:0 0 4px 0;text-transform:uppercase;">FVH3 · HSL tram corridor</p>
      <p style="font-size:14px;font-weight:700;color:#2F1B6D;margin:0 0 6px 0;">Line ${sample.line} position sample</p>
      <p style="font-size:10px;color:#96C2EF;margin:2px 0;">Date: ${sample.sampleDate}</p>
      <p style="font-size:10px;color:#96C2EF;margin:2px 0;">Vehicles: ${sample.vehicleCount} · Pings: ${sample.totalPings.toLocaleString()}</p>
      <p style="font-size:10px;color:#96C2EF;margin:2px 0;">Peak hour: ${peakHourLabel(sample)}</p>
      <p style="font-size:10px;color:#64748b;margin:6px 0 0 0;">Corridor clipped to Viikki crossing context · click for observatory</p>
    </div>
  `);

  if (segmentInteractionEnabled && segmentHandlers) {
    wirePolylineSegment(
      line,
      {
        segmentId: "hel-hsl-tram15",
        segmentName: `HSL tram line ${sample.line}`,
        speed: null,
        congestion: null,
      },
      segmentHandlers,
      { selectedSegmentId: activeMapSegmentId }
    );
  }

  line.addTo(map);
  polylinesOut.push(line);

  scheduleLeafletLayerRepaint(map);
}
