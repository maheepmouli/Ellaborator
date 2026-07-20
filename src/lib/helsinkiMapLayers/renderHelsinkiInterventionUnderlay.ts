import L from "leaflet";
import { loadHelsinkiInterventionLocationsSnapshot } from "@/services/helsinkiLocalSnapshots";
import { drawHelsinkiPilotInterventionGeometry } from "@/lib/helsinkiMapLayers/helsinkiMapHelpers";
import type { SegmentInteractionHandlers } from "@/lib/wireMapSegmentInteraction";

export interface RenderHelsinkiInterventionUnderlayOptions {
  map: L.Map;
  selectedPilotId?: string | null;
  selectedKpi?: string;
  segmentInteractionEnabled: boolean;
  segmentHandlers: SegmentInteractionHandlers;
  activeMapSegmentId?: string | null;
  polygonsOut: L.Polygon[];
  circlesOut: L.CircleMarker[];
  circlesInfluenceOut?: L.Circle[];
  /** Draw site polygons (hel-p2 / hel-p3). */
  showSitePolygon?: boolean;
}

/** Pilot intervention site polygon (Kallio / Viikki) — influence fields stay in KPI layer renderers. */
export async function renderHelsinkiInterventionUnderlay(
  options: RenderHelsinkiInterventionUnderlayOptions
): Promise<void> {
  const {
    map,
    selectedPilotId,
    segmentInteractionEnabled,
    segmentHandlers,
    activeMapSegmentId,
    polygonsOut,
    circlesOut,
    showSitePolygon = false,
  } = options;

  if (!showSitePolygon || !selectedPilotId || selectedPilotId === "hel-p1") return;

  const geojson = await loadHelsinkiInterventionLocationsSnapshot();
  if (!geojson) return;

  drawHelsinkiPilotInterventionGeometry({
    map,
    geojson,
    pilotId: selectedPilotId,
    segmentInteractionEnabled,
    segmentHandlers,
    activeMapSegmentId,
    polygonsOut,
    circlesOut,
    strokeColor: selectedPilotId === "hel-p2" ? "#38bdf8" : "#22c55e",
    fillColor: selectedPilotId === "hel-p2" ? "#0ea5e9" : "#16a34a",
    interactive: false,
  });
}
