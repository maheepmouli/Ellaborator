import L from "leaflet";
import type { LocalCityPoint } from "@/services/localCityData";
import {
  loadHelsinkiDangerousLocationsGeoJson,
  loadHelsinkiInterventionLocationsGeoJson,
} from "@/services/staticGeoData";
import { wireCircleMarkerSegment, wirePolygonSegment, type SegmentInteractionHandlers } from "@/lib/wireMapSegmentInteraction";
import { renderLocalCityInteractivePoints } from "@/lib/renderLocalCityInteractivePoints";
import { scheduleLeafletLayerRepaint } from "@/lib/leafletMapSync";

export interface RenderHelsinkiKpi21LayersOptions {
  map: L.Map;
  localCityPoints?: LocalCityPoint[];
  filterRange: [number, number];
  selectedPilotId?: string | null;
  activeMapSegmentId?: string | null;
  segmentInteractionEnabled: boolean;
  segmentHandlers: SegmentInteractionHandlers;
  circlesOut: L.CircleMarker[];
  polygonsOut: L.Polygon[];
  markersOut: L.Marker[];
  getValueColor: (value: number, inverted?: boolean) => string;
}

/** Dangerous-location context + intervention polygons + interactive Telraam safety proxies. */
export function renderHelsinkiKpi21Layers(
  options: RenderHelsinkiKpi21LayersOptions
): Promise<void> {
  const {
    map,
    localCityPoints,
    filterRange,
    selectedPilotId,
    activeMapSegmentId,
    segmentInteractionEnabled,
    segmentHandlers,
    circlesOut,
    polygonsOut,
    markersOut,
    getValueColor,
  } = options;

  return Promise.all([
    loadHelsinkiDangerousLocationsGeoJson(),
    loadHelsinkiInterventionLocationsGeoJson(),
  ]).then(([dangerousGeoJson, interventionGeoJson]) => {
    const hazardCount = Math.max(1, dangerousGeoJson.features.length);
    dangerousGeoJson.features.forEach((feature, index) => {
      const coordinates = feature.geometry.coordinates as [number, number];
      const percentile = index / hazardCount;
      const marker = L.circleMarker([coordinates[1], coordinates[0]], {
        radius: 2 + percentile * 4.2,
        fillColor: "#7c3aed",
        fillOpacity: 0.08 + percentile * 0.22,
        color: "#a78bfa",
        weight: 0.5,
        opacity: 0.32,
        interactive: false,
      }).addTo(map);
      circlesOut.push(marker);
    });

    const interventionLayer = L.geoJSON(interventionGeoJson as GeoJSON.GeoJsonObject, {
      style: () => ({
        color: "#22c55e",
        weight: 2,
        opacity: 0.78,
        fillColor: "#16a34a",
        fillOpacity: 0.12,
      }),
      onEachFeature: (feature, layerItem) => {
        const areaName = String(
          feature?.properties?.name ??
            feature?.properties?.Name ??
            feature?.properties?.pilot ??
            "Helsinki intervention area"
        );
        layerItem.bindPopup(`
          <div style="font-family:'DM Sans',sans-serif;padding:8px;min-width:180px;">
            <p style="font-size:10px;color:#8578C3;margin:0 0 4px 0;text-transform:uppercase;">Helsinki intervention area</p>
            <p style="font-size:14px;font-weight:700;color:#2F1B6D;margin:0 0 6px 0;">${areaName}</p>
            <p style="font-size:10px;color:#96C2EF;margin:0;">Source: Helsinki intervention locations GPKG</p>
          </div>
        `);
        if (segmentInteractionEnabled && layerItem instanceof L.Polygon) {
          wirePolygonSegment(
            layerItem,
            {
              segmentId: `hel-area:${areaName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
              segmentName: areaName,
              speed: null,
              congestion: null,
            },
            segmentHandlers,
            {
              selectedSegmentId: activeMapSegmentId,
              baseStyle: {
                color: "#22c55e",
                weight: 2,
                opacity: 0.78,
                fillColor: "#16a34a",
                fillOpacity: 0.12,
              },
            }
          );
        }
      },
    }).addTo(map);
    if (interventionLayer instanceof L.LayerGroup) {
      interventionLayer.eachLayer((member) => {
        if (member instanceof L.Polygon) polygonsOut.push(member);
      });
    }

    const viikki = L.circleMarker([60.224599, 25.017236], {
      radius: selectedPilotId === "hel-p3" ? 12 : 10,
      fillColor: "#2ecc71",
      fillOpacity: 0.92,
      color: "#dcfce7",
      weight: 2.5,
      opacity: 1,
    }).addTo(map);
    viikki.bindPopup(`
      <div style="font-family:'DM Sans',sans-serif;padding:8px;min-width:180px;">
        <p style="font-size:10px;color:#8578C3;margin:0 0 4px 0;text-transform:uppercase;">Viikki anchor</p>
        <p style="font-size:14px;font-weight:700;color:#2F1B6D;margin:0 0 6px 0;">Intersection safety at Viikki</p>
        <p style="font-size:10px;color:#96C2EF;margin:0;">Dangerous locations loaded: ${dangerousGeoJson.features.length}</p>
        <p style="font-size:10px;color:#96C2EF;margin:2px 0 0 0;">Intervention markers loaded: ${interventionGeoJson.features.length}</p>
      </div>
    `);
    if (segmentInteractionEnabled) {
      wireCircleMarkerSegment(
        viikki,
        {
          segmentId: "hel-viikki-anchor",
          segmentName: "Viikki intersection safety anchor",
          speed: null,
          congestion: null,
        },
        segmentHandlers,
        { baseRadius: selectedPilotId === "hel-p3" ? 12 : 10 }
      );
    }
    circlesOut.push(viikki);

    if (localCityPoints?.length) {
      renderLocalCityInteractivePoints({
        map,
        cityName: "Helsinki",
        selectedKpi: "kpi2.1",
        points: localCityPoints,
        filterRange,
        segmentHandlers,
        segmentInteractionEnabled,
        selectedSegmentId: activeMapSegmentId,
        markersOut,
        circlesOut,
        spreadOverlaps: true,
        getValueColor,
      });
    }

    scheduleLeafletLayerRepaint(map, markersOut);
  });
}
