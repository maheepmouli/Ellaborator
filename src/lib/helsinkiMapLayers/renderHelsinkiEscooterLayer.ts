import L from "leaflet";
import { loadHelsinkiEscooterObservationsGeoJson } from "@/services/staticGeoData";
import { wireCircleMarkerSegment, type SegmentInteractionHandlers } from "@/lib/wireMapSegmentInteraction";
import { scheduleLeafletLayerRepaint } from "@/lib/leafletMapSync";
import {
  renderHelsinkiPilotInfluence,
  sampleGeoJsonPoints,
} from "@/lib/helsinkiMapLayers/helsinkiMapHelpers";
import { fitHelsinkiKpiView } from "@/lib/helsinkiMapLayers/helsinkiKpiMapFit";

export interface RenderHelsinkiEscooterLayerOptions {
  map: L.Map;
  /** Highlight obstruction/hazard flags instead of plain category colours (KPI 4.2). */
  emphasizeAccessibility?: boolean;
  /** Cap rendered points — peers never paint full 509-observation scatter. */
  maxPoints?: number;
  /** When true, only obstruction/hazard-flagged points (KPI 4.2). */
  flaggedOnly?: boolean;
  selectedPilotId?: string | null;
  segmentInteractionEnabled: boolean;
  segmentHandlers: SegmentInteractionHandlers;
  activeMapSegmentId?: string | null;
  circlesOut: L.CircleMarker[];
  markersOut: L.Marker[];
  circlesInfluenceOut?: L.Circle[];
}

const CATEGORY_COLORS: Record<string, string> = {
  on_pavement: "#f97316",
  on_street: "#38bdf8",
  on_cycleway: "#38bdf8",
  outside_parking_zone: "#ef4444",
  bike_not_in_racks: "#2ecc71",
};

const CATEGORY_LABELS: Record<string, string> = {
  on_pavement: "On pavement",
  on_street: "On street",
  on_cycleway: "On cycleway",
  outside_parking_zone: "Outside designated zone",
  bike_not_in_racks: "Bike not in racks",
};

const DEFAULT_MAX_POINTS = 50;

/** FVH2 Kallio e-scooter parking — sampled observation points (no site boundary polygon). */
export function renderHelsinkiEscooterLayer(
  options: RenderHelsinkiEscooterLayerOptions
): Promise<void> {
  const {
    map,
    emphasizeAccessibility,
    maxPoints = DEFAULT_MAX_POINTS,
    flaggedOnly = false,
    selectedPilotId,
    segmentInteractionEnabled,
    segmentHandlers,
    activeMapSegmentId,
    circlesOut,
    markersOut,
    circlesInfluenceOut,
  } = options;

  return Promise.all([
    loadHelsinkiEscooterObservationsGeoJson(),
  ]).then(([geojson]) => {
    if (circlesInfluenceOut) {
      renderHelsinkiPilotInfluence(map, selectedPilotId ?? "hel-p2", circlesInfluenceOut);
    }

    let features = geojson.features;
    if (flaggedOnly || emphasizeAccessibility) {
      const flagged = features.filter((feature) => {
        const hazard = String(feature.properties.hazardToOthers || "").toLowerCase().startsWith("yes");
        const obstructs = String(feature.properties.obstructsOthers || "").toLowerCase().startsWith("yes");
        return hazard || obstructs;
      });
      features = flagged.length ? flagged : features;
    }

    const sampled = sampleGeoJsonPoints(features, maxPoints);
    const total = geojson.features.length;

    sampled.forEach((feature, index) => {
      const coordinates = feature.geometry.coordinates as [number, number];
      const category = String(feature.properties.category || "uncategorised");
      const hazard = String(feature.properties.hazardToOthers || "").toLowerCase().startsWith("yes");
      const obstructs = String(feature.properties.obstructsOthers || "").toLowerCase().startsWith("yes");
      const flagged = hazard || obstructs;
      const color = emphasizeAccessibility
        ? flagged
          ? "#ef4444"
          : "#2ecc71"
        : CATEGORY_COLORS[category] ?? "#94a3b8";

      const marker = L.circleMarker([coordinates[1], coordinates[0]], {
        radius: flagged && emphasizeAccessibility ? 5 : 3.5,
        fillColor: color,
        fillOpacity: 0.72,
        color: "#ffffff",
        weight: 0.6,
        opacity: 0.85,
      }).addTo(map);

      marker.bindPopup(`
        <div style="font-family:'DM Sans',sans-serif;padding:8px;min-width:200px;">
          <p style="font-size:10px;color:#8578C3;margin:0 0 4px 0;text-transform:uppercase;">Kallio eScooter (FVH2)</p>
          <p style="font-size:14px;font-weight:700;color:#2F1B6D;margin:0 0 6px 0;">${CATEGORY_LABELS[category] ?? category}</p>
          <p style="font-size:10px;color:#96C2EF;margin:2px 0;">Obstructs pedestrians: ${obstructs ? "Yes" : "No"}</p>
          <p style="font-size:10px;color:#96C2EF;margin:2px 0;">Hazard to others: ${hazard ? "Yes" : "No"}</p>
          <p style="font-size:9px;color:#96C2EF;margin:6px 0 0 0;">Map shows ${sampled.length} of ${total} observations</p>
        </div>
      `);

      if (segmentInteractionEnabled) {
        wireCircleMarkerSegment(
          marker,
          {
            segmentId: `hel-escooter-obs-${index}`,
            segmentName: `eScooter · ${CATEGORY_LABELS[category] ?? category}`,
            speed: null,
            congestion: null,
          },
          segmentHandlers,
          {
            baseRadius: flagged && emphasizeAccessibility ? 5 : 3.5,
            selectedSegmentId: activeMapSegmentId,
          }
        );
      }

      circlesOut.push(marker);
    });

    circlesOut.forEach((circle) => {
      if (typeof circle.bringToFront === "function") circle.bringToFront();
    });

    fitHelsinkiKpiView(
      map,
      sampled.map((feature) => {
        const coordinates = feature.geometry.coordinates as [number, number];
        return { lat: coordinates[1], lon: coordinates[0] };
      }),
      "kallio"
    );
    scheduleLeafletLayerRepaint(map, markersOut);
  });
}
