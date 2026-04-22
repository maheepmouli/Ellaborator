import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { CITY_DATA, ELABORATOR_KPIS, generateHexbinData } from "@/data/kpiDefinitions";
import { useLatestTrafficData } from "@/hooks/use-traffic-data";
import { trafficSegmentsToSegments, type MapSegment } from "@/services/trafficApi";
import { useLatestBicycleCounting } from "@/hooks/use-bicycle-counting";
import { bicycleCountingToSegments, bicycleCountingToHexbin } from "@/services/bicycleCountingApi";
import { useLatestCyclingInfrastructure } from "@/hooks/use-cycling-infrastructure";
import { cyclingInfrastructureToSegments, cyclingInfrastructureToHexbin } from "@/services/cyclingInfrastructureApi";
import { getVisualizationType, isSegmentVisualization, isPointVisualization, isAreaVisualization } from "@/lib/visualization-types";
import { generateIsochrones, generateGridAreas, generateEmissionZones, type MapArea } from "@/services/areaGenerator";
import { getKpiDefinition } from "@/config/kpiDefinitions";
import { getPilotsByCity, SelectedPilot, ViewState } from "@/data/pilotDefinitions";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface HeroMapProps {
  onMapReady?: (map: L.Map) => void;
  onCitySelect?: (cityName: string) => void;
  onViewLevelChange?: (level: ViewState) => void;
  onResetToEuropeReady?: (resetFn: () => void) => void;
  selectedCity?: string;
  selectedPilotId?: string | null;
  selectedKpi?: string;
  scenario?: "baseline" | "intervention" | "comparison";
  filterRange?: [number, number];
  selectedModeTypes?: string[];
  onSegmentFocus?: (segment: { segmentName: string; speed: number | null; congestion: number | null } | null) => void;
  showInterventionLayer?: boolean;
  onPilotSelect?: (pilot: SelectedPilot | null) => void;
}

const HeroMap = ({
  onMapReady,
  onCitySelect,
  onViewLevelChange,
  onResetToEuropeReady,
  selectedCity,
  selectedPilotId,
  selectedKpi = "kpi1.2",
  scenario = "baseline",
  filterRange = [0, 100],
  selectedModeTypes = ["Pedestrian", "Cycle", "Public Transport", "Private Car", "PTW"],
  onSegmentFocus,
  showInterventionLayer = false,
  onPilotSelect,
}: HeroMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const circlesRef = useRef<L.CircleMarker[]>([]);
  const polylinesRef = useRef<L.Polyline[]>([]);
  const polygonsRef = useRef<L.Polygon[]>([]);
  const interventionLayerRef = useRef<L.LayerGroup | null>(null);
  const cityBoundaryRef = useRef<L.Polygon | null>(null);
  const [viewLevel, setViewLevel] = useState<ViewState>("EUROPE");
  const [currentCity, setCurrentCity] = useState<string | null>(null);
  const [currentPilot, setCurrentPilot] = useState<SelectedPilot | null>(null);

  // Fetch real traffic data for Issy-les-Moulineaux
  const { data: trafficData, isLoading: isLoadingTraffic, error: trafficError } = useLatestTrafficData(
    currentCity || "",
    500 // Increased limit to get more segments
  );

  // Fetch real bicycle counting data for Issy-les-Moulineaux (especially for Mode Share KPI)
  const { data: bicycleData, isLoading: isLoadingBicycle } = useLatestBicycleCounting(
    currentCity || "",
    200
  );

  // Fetch real cycling infrastructure data for Issy-les-Moulineaux (for Green Infrastructure KPI)
  const { data: cyclingInfrastructureData, isLoading: isLoadingCyclingInfra } = useLatestCyclingInfrastructure(
    currentCity || "",
    500
  );

  // Notify parent of view level changes
  useEffect(() => {
    onViewLevelChange?.(viewLevel);
  }, [viewLevel, onViewLevelChange]);

  const clearLayers = useCallback(() => {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    circlesRef.current.forEach((c) => c.remove());
    circlesRef.current = [];
    polylinesRef.current.forEach((p) => p.remove());
    polylinesRef.current = [];
    polygonsRef.current.forEach((p) => p.remove());
    polygonsRef.current = [];
    if (cityBoundaryRef.current) {
      cityBoundaryRef.current.remove();
      cityBoundaryRef.current = null;
    }
    if (interventionLayerRef.current) {
      interventionLayerRef.current.remove();
      interventionLayerRef.current = null;
    }
  }, []);

  const addInterventionLayer = useCallback((cityData: { lat: number; lon: number }, enabled: boolean) => {
    if (!mapRef.current || !enabled) return;
    const layer = L.layerGroup();
    const interventionRadius = L.circle([cityData.lat, cityData.lon], {
      radius: 1200,
      color: "#a78bfa",
      weight: 2,
      fillColor: "#a78bfa",
      fillOpacity: 0.12,
    });
    const interventionCore = L.circle([cityData.lat, cityData.lon], {
      radius: 600,
      color: "#8b5cf6",
      weight: 1,
      fillColor: "#8b5cf6",
      fillOpacity: 0.2,
    });
    layer.addLayer(interventionRadius);
    layer.addLayer(interventionCore);
    layer.addTo(mapRef.current);
    interventionLayerRef.current = layer;
  }, []);

  // Add city boundary polygon
  const addCityBoundary = useCallback((cityData: { lat: number; lon: number; city: string }) => {
    if (!mapRef.current || cityBoundaryRef.current) return;

    // Create a simple rectangular boundary around the city center
    // For a more accurate boundary, you would use Overpass API or GeoJSON data
    const boundarySize = 0.15; // ~15km radius
    const boundary: [number, number][] = [
      [cityData.lat - boundarySize, cityData.lon - boundarySize * 1.5],
      [cityData.lat - boundarySize, cityData.lon + boundarySize * 1.5],
      [cityData.lat + boundarySize, cityData.lon + boundarySize * 1.5],
      [cityData.lat + boundarySize, cityData.lon - boundarySize * 1.5],
    ];

    cityBoundaryRef.current = L.polygon(boundary, {
      fillColor: "#657DF5",
      fillOpacity: 0.1,
      color: "#657DF5",
      weight: 2,
      opacity: 0.5,
      dashArray: "5, 5",
    }).addTo(mapRef.current);

    // Add popup
    cityBoundaryRef.current.bindPopup(`
      <div style="font-family: 'DM Sans', sans-serif; padding: 8px;">
        <p style="font-size: 12px; font-weight: 600; color: #2F1B6D; margin: 0;">${cityData.city} Boundary</p>
      </div>
    `);
  }, []);

  const getValueColor = (value: number, isGradient: boolean = false, infrastructureType?: string) => {
    // Special color scheme for cycling infrastructure (KPI3.1)
    if (infrastructureType) {
      switch (infrastructureType) {
        case "Bande cyclable":
          return "#10B981"; // Emerald green - dedicated bike lane
        case "Pictogrammes seuls":
          return "#38BDF8"; // Sky blue - bike symbols only
        case "Piste cyclable":
          return "#10B981"; // Emerald green - bike path
        case "Voie verte":
          return "#22C55E"; // Green - greenway
        case "Double sens cyclable":
          return "#3B82F6"; // Blue - two-way cycling
        default:
          return "#96C2EF"; // Light blue - other types
      }
    }

    if (isGradient) {
      // Smooth gradient colors for segments (traffic/congestion)
      if (value >= 80) return "#2F1B6D"; // Heavy congestion - deep purple
      if (value >= 60) return "#657DF5"; // Moderate - violet
      if (value >= 40) return "#8578C3"; // Light - light purple
      if (value >= 20) return "#96C2EF"; // Free flow - light blue
      return "#D3E3FF"; // Very free - very light blue
    } else {
      // Standard colors for points/areas based on value
      if (value >= 80) return "#10B981"; // High value - emerald green
      if (value >= 60) return "#38BDF8"; // Medium-high - sky blue
      if (value >= 40) return "#96C2EF"; // Medium - light blue
      if (value >= 20) return "#8578C3"; // Low-medium - light purple
      return "#D3E3FF"; // Very low - very light blue
    }
  };

  const getPilotCardHtml = (cityLabel: string, pilot: SelectedPilot) => `
    <div style="
      width: 320px;
      padding: 10px 14px 9px 14px;
      border-radius: 8px;
      color: white;
      font-family: 'DM Sans', sans-serif;
      border: 1px solid rgba(172, 183, 255, 0.45);
      box-shadow: 0 10px 24px rgba(10, 8, 36, 0.45), inset 0 1px 0 rgba(255,255,255,0.16);
      backdrop-filter: blur(18px);
      background: linear-gradient(165deg, rgba(60, 37, 142, 0.92) 0%, rgba(48, 28, 116, 0.95) 100%);
      cursor: pointer;">
      <div style="display: flex; align-items: flex-start; gap: 8px;">
        <svg width="16" height="18" viewBox="0 0 24 24" fill="none" style="opacity: 0.95; flex-shrink: 0; margin-top: 2px;">
          <path d="M12 22s7-6.2 7-13a7 7 0 1 0-14 0c0 6.8 7 13 7 13z" fill="#A78BFA"/>
          <circle cx="12" cy="9" r="2.6" fill="#EDE9FE"/>
        </svg>
        <div style="flex: 1;">
          <p style="font-size: 16px; font-weight: 800; margin: 0; line-height: 1.05; letter-spacing: 0.6px;">${cityLabel.toUpperCase()}</p>
          <p style="font-size: 30px; font-weight: 800; margin: -1px 0 0 0; line-height: 0.95;">${pilot.name}</p>
          <p style="font-size: 11px; font-weight: 700; margin: 4px 0 0 0; opacity: 0.98;">${pilot.title}</p>
        </div>
      </div>
      <div style="margin-top: 8px; border: 2px solid rgba(173, 236, 255, 0.92); border-radius: 999px; padding: 5px 10px;">
        <p style="font-size: 10px; opacity: 0.95; margin: 0; line-height: 1.25; white-space: normal;">${pilot.description}</p>
      </div>
    </div>
  `;

  const addHexbinData = useCallback(
    (cityName: string, modeTypes?: string[]) => {
      if (!mapRef.current) return;

      const cityData = CITY_DATA.find((c) => c.city === cityName);
      if (!cityData) return;

      // Add city boundary
      addCityBoundary(cityData);

      const visualizationType = getVisualizationType(selectedKpi);
      const isIssy = cityName.toLowerCase().includes("issy");
      const kpiDefinition = getKpiDefinition(selectedKpi);

      // Always show road segments with traffic data (50% opacity, gradient) when available
      // Traffic data should ALWAYS be rendered as LineString segments, not points
      if (isIssy && trafficData?.results && trafficData.results.length > 0) {
        console.log(`[HeroMap] Rendering ${trafficData.results.length} traffic segments for ${cityName}`);
        const roadSegments = trafficSegmentsToSegments(trafficData.results, selectedKpi);
        console.log(`[HeroMap] Converted to ${roadSegments.length} map segments`);
        
        let renderedCount = 0;
        roadSegments.forEach((segment) => {
          // Filter by range if applicable (but show all segments for traffic visualization)
          // For traffic data, we want to show all segments regardless of filter range
          // The filter range applies to the KPI value, not traffic visibility
          
          const color = getValueColor(segment.value, true); // Use gradient colors
          const opacity = 0.6; // Increased from 0.5 for better visibility
          const weight = 5; // Increased for better visibility

          // Use LineString geometry from geo_shape (the real road segment)
          if (!segment.coordinates || segment.coordinates.length < 2) {
            console.warn(`[HeroMap] Invalid segment coordinates for segment ${segment.id}`);
            return;
          }

          const polyline = L.polyline(segment.coordinates, {
            color: color,
            weight: weight,
            opacity: opacity,
            lineJoin: "round",
            lineCap: "round",
          }).addTo(mapRef.current!);

          const props = segment.properties || {};
          const popupContent = `
            <div style="font-family: 'DM Sans', sans-serif; padding: 8px; min-width: 150px;">
              <p style="font-size: 11px; color: #8578C3; margin: 0 0 4px 0; text-transform: uppercase;">Road Segment</p>
              <p style="font-size: 10px; color: #96C2EF; margin: 0 0 4px 0; font-weight: 600;">Segment: ${segment.id}</p>
              <p style="font-size: 18px; font-weight: bold; color: #2F1B6D; margin: 0 0 6px 0;">${segment.value.toFixed(1)}%</p>
              ${props.vitesse_km_h ? `<p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Speed: ${props.vitesse_km_h.toFixed(1)} km/h</p>` : ''}
              ${props.indice_de_congestion ? `<p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Congestion index: ${props.indice_de_congestion.toFixed(2)}</p>` : ''}
              ${props.distance_metres ? `<p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Observed length: ${(props.distance_metres / 1000).toFixed(2)} km</p>` : ''}
              <p style="font-size: 9px; color: #96C2EF; margin-top: 6px;">${kpiDefinition?.dataLabel || "Observed"} data</p>
            </div>
          `;
          
          polyline.bindPopup(popupContent);
          polyline.on("mouseover", () => {
            polyline.setStyle({ weight: 7, opacity: 0.95 });
            onSegmentFocus?.({
              segmentName: `Road ${segment.id}`,
              speed: props.vitesse_km_h ?? null,
              congestion: props.indice_de_congestion ?? null,
            });
            polyline.bindTooltip(
              `Segment: ${segment.id}<br/>Speed: ${(props.vitesse_km_h ?? 0).toFixed(1)} km/h<br/>Congestion index: ${(props.indice_de_congestion ?? 0).toFixed(2)}`,
              { sticky: true, direction: "top", opacity: 0.9 }
            ).openTooltip();
          });
          polyline.on("mouseout", () => {
            polyline.setStyle({ weight, opacity });
          });
          polyline.on("click", () => {
            onSegmentFocus?.({
              segmentName: `Road ${segment.id}`,
              speed: props.vitesse_km_h ?? null,
              congestion: props.indice_de_congestion ?? null,
            });
          });
          polylinesRef.current.push(polyline);
          renderedCount++;
        });
        console.log(`[HeroMap] Rendered ${renderedCount} traffic segments on map`);
      } else if (isIssy) {
        console.log(`[HeroMap] No traffic data available:`, {
          isLoading: isLoadingTraffic,
          hasData: !!trafficData,
          resultsCount: trafficData?.results?.length || 0,
          error: trafficError,
          cityName: cityName
        });
      }

      // SEGMENTS VISUALIZATION (Lines) - for traffic/congestion/emissions (only if not already shown above)
      if (isSegmentVisualization(selectedKpi) && !(isIssy && trafficData?.results && trafficData.results.length > 0)) {
        // Generate synthetic segments for other cities or when no traffic data
        const hexPoints = generateHexbinData(cityData, selectedKpi, 50);
        const segments = hexPoints.map((point, i) => {
          // Create small segments around points
          const offset = 0.001;
          return {
            id: `segment-${i}`,
            coordinates: [
              [point.lat - offset, point.lon - offset],
              [point.lat + offset, point.lon + offset],
            ],
            value: point.value,
          };
        });

        segments.forEach((segment) => {
          if (segment.value < filterRange[0] || segment.value > filterRange[1]) return;

          const color = getValueColor(segment.value, true); // Use gradient colors
          const opacity = 0.5; // 50% opacity as requested
          const weight = 4; // Slightly thicker for visibility with opacity

          const polyline = L.polyline(segment.coordinates, {
            color: color,
            weight: weight,
            opacity: opacity,
            lineJoin: "round",
            lineCap: "round",
          }).addTo(mapRef.current!);

          const popupContent = `
            <div style="font-family: 'DM Sans', sans-serif; padding: 8px; min-width: 150px;">
              <p style="font-size: 11px; color: #8578C3; margin: 0 0 4px 0; text-transform: uppercase;">Traffic Segment</p>
              <p style="font-size: 18px; font-weight: bold; color: #2F1B6D; margin: 0 0 6px 0;">${segment.value.toFixed(1)}%</p>
            </div>
          `;
          
          polyline.bindPopup(popupContent);
          polylinesRef.current.push(polyline);
        });
      }
      // POINTS VISUALIZATION (Aggregated) - for counts/intensity/sensors
      else if (isPointVisualization(selectedKpi)) {
        let points: Array<{ lat: number; lon: number; value: number; id: string; properties?: Record<string, any> }> | undefined;
        
        if (isIssy) {
          if (selectedKpi === "kpi1.2" && bicycleData?.results && bicycleData.results.length > 0) {
            // Use bicycle counting data for Mode Share
            points = bicycleCountingToHexbin(bicycleData.results, selectedKpi);
          } else if (selectedKpi === "kpi3.1" && cyclingInfrastructureData?.results && cyclingInfrastructureData.results.length > 0) {
            // Use cycling infrastructure data for Green Infrastructure
            points = cyclingInfrastructureToHexbin(cyclingInfrastructureData.results, selectedKpi);
          }
          // NOTE: Traffic data should NOT be used here - it should always be rendered as LineString segments above
          // Traffic data lives on roads and must be visualized as polylines, not points
        }
        
        if (!points) {
          // Generate synthetic points
          points = generateHexbinData(cityData, selectedKpi, 200);
        }

        if (selectedKpi === "kpi1.2") {
          const buckets = new Map<string, { lat: number; lon: number; total: number; count: number }>();
          points.forEach((point) => {
            if (point.value < filterRange[0] || point.value > filterRange[1]) return;
            if (selectedModeTypes && selectedModeTypes.length > 0 && !selectedModeTypes.includes("Cycle")) return;
            const key = `${Math.round(point.lat * 250)}_${Math.round(point.lon * 250)}`;
            const existing = buckets.get(key);
            if (existing) {
              existing.lat += point.lat;
              existing.lon += point.lon;
              existing.total += point.value;
              existing.count += 1;
            } else {
              buckets.set(key, { lat: point.lat, lon: point.lon, total: point.value, count: 1 });
            }
          });

          Array.from(buckets.values()).forEach((cluster) => {
            const centerLat = cluster.lat / cluster.count;
            const centerLon = cluster.lon / cluster.count;
            const avgValue = cluster.total / cluster.count;
            const size = Math.max(8, Math.min(20, 8 + cluster.count * 1.1));
            const color = getValueColor(avgValue, false);
            const circle = L.circleMarker([centerLat, centerLon], {
              radius: size,
              fillColor: color,
              fillOpacity: 0.72,
              color: "#DDE6FF",
              weight: 1.2,
              opacity: 0.95,
            }).addTo(mapRef.current!);
            circle.bindPopup(`
              <div style="font-family: 'DM Sans', sans-serif; padding: 6px; min-width: 150px;">
                <p style="font-size: 11px; color: #8578C3; margin: 0 0 4px 0; text-transform: uppercase;">Mode Share Cluster</p>
                <p style="font-size: 16px; font-weight: bold; color: #2F1B6D; margin: 0;">${cluster.count} points</p>
                <p style="font-size: 10px; color: #96C2EF; margin: 4px 0 0 0;">Avg value: ${avgValue.toFixed(1)}%</p>
              </div>
            `);
            circlesRef.current.push(circle);
          });
          addInterventionLayer(cityData, showInterventionLayer);
          return;
        }

        // Calculate size range based on values
        const values = points.map(p => p.value);
        const minValue = Math.min(...values);
        const maxValue = Math.max(...values);
        const valueRange = maxValue - minValue || 1;

        // Filter by mode types for Mode Share KPI
        const shouldFilterByMode = selectedKpi === "kpi1.2" && selectedModeTypes && selectedModeTypes.length > 0;
        
        points.forEach((point) => {
          if (point.value < filterRange[0] || point.value > filterRange[1]) return;
          
          // For Mode Share, filter based on selected mode types
          // Since bicycle counting data represents cycling mode, only show if Cycle is selected
          if (shouldFilterByMode && !selectedModeTypes.includes("Cycle")) {
            return;
          }

          const props = point.properties || {};
          // Use infrastructure type for color if available (KPI3.1)
          const color = getValueColor(
            point.value, 
            false, 
            selectedKpi === "kpi3.1" ? props.type_amgt_cycl : undefined
          );
          
          const normalizedValue = (point.value - minValue) / valueRange;
          const size = Math.max(4, Math.min(20, 4 + normalizedValue * 16)); // 4-20px radius
          const opacity = selectedKpi === "kpi3.1" ? 0.8 : 0.7 + normalizedValue * 0.2;

          // For cycling infrastructure, use a border to make points stand out
          const borderColor = selectedKpi === "kpi3.1" ? "#FFFFFF" : color;
          const borderWidth = selectedKpi === "kpi3.1" ? 1.5 : 2;

          const circle = L.circleMarker([point.lat, point.lon], {
            radius: size,
            fillColor: color,
            fillOpacity: opacity,
            color: borderColor,
            weight: borderWidth,
            opacity: 0.9,
          }).addTo(mapRef.current!);

          const dataType = selectedKpi === "kpi1.2" ? "Bicycle Count" : 
                          selectedKpi === "kpi3.1" ? "Cycling Infrastructure" : 
                          "Sensor Data";
          const valueLabel = selectedKpi === "kpi1.2" ? " bikes" : 
                            selectedKpi === "kpi3.1" ? "" : 
                            "%";
          
          const popupContent = `
            <div style="font-family: 'DM Sans', sans-serif; padding: 6px; min-width: 120px;">
              <p style="font-size: 11px; color: #8578C3; margin: 0 0 4px 0; text-transform: uppercase;">${dataType}</p>
              ${selectedKpi === "kpi3.1" && props.type_amgt_cycl ? (
                `<p style="font-size: 18px; font-weight: bold; color: #2F1B6D; margin: 0 0 6px 0;">${props.type_amgt_cycl}</p>`
              ) : (
                `<p style="font-size: 18px; font-weight: bold; color: #2F1B6D; margin: 0 0 6px 0;">${point.value.toFixed(1)}${valueLabel}</p>`
              )}
              ${props.type_amgt_cycl && selectedKpi !== "kpi3.1" ? `<p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Type: ${props.type_amgt_cycl}</p>` : ''}
              ${props.localisation ? `<p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">${props.localisation}</p>` : ''}
              ${props.longueur_m !== undefined ? `<p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Length: ${typeof props.longueur_m === 'number' ? props.longueur_m.toFixed(0) : props.longueur_m}m</p>` : ''}
              <div style="border-top: 1px solid rgba(101, 125, 245, 0.2); padding-top: 4px; margin-top: 4px;">
                <p style="font-size: 9px; color: #96C2EF; margin: 0;">${isIssy ? 'Live data' : 'Synthetic data'}</p>
              </div>
            </div>
          `;
          
          circle.bindPopup(popupContent);
          circlesRef.current.push(circle);
        });
      }
      // AREAS VISUALIZATION (Polygons) - for accessibility/catchment/coverage/emissions
      else if (isAreaVisualization(selectedKpi)) {
        if (selectedKpi === "kpi3.2") {
          const points = generateHexbinData(cityData, selectedKpi, 70);
          points.forEach((point) => {
            if (point.value < filterRange[0] || point.value > filterRange[1]) return;
            const intensity = Math.max(0, Math.min(100, point.value));
            const color = intensity >= 70 ? "#ef4444" : intensity >= 50 ? "#f97316" : intensity >= 30 ? "#eab308" : "#22c55e";
            const radius = 0.0032;
            const hex: [number, number][] = Array.from({ length: 6 }).map((_, i) => {
              const angle = (Math.PI / 3) * i;
              return [point.lat + radius * Math.sin(angle), point.lon + radius * Math.cos(angle)];
            });
            const polygon = L.polygon(hex, {
              fillColor: color,
              fillOpacity: 0.22,
              color,
              weight: 1.4,
              opacity: 0.85,
            }).addTo(mapRef.current!);
            polygon.bindPopup(
              `<div style="font-family: 'DM Sans', sans-serif; padding: 8px; min-width: 150px;">
                <p style="font-size: 11px; color: #8578C3; margin: 0 0 4px 0; text-transform: uppercase;">Emission Hexagon</p>
                <p style="font-size: 16px; font-weight: bold; color: #2F1B6D; margin: 0;">Estimated intensity: ${intensity.toFixed(1)}%</p>
              </div>`
            );
            polygonsRef.current.push(polygon);
          });
          addInterventionLayer(cityData, showInterventionLayer);
          return;
        }
        let areas: MapArea[] = [];
        const kpiValue = cityData.kpiData[selectedKpi]?.mainValue || 50;
        
        if (selectedKpi === "kpi4.2") {
          // Accessibility - generate isochrones around city center
          areas = generateIsochrones(cityData.lat, cityData.lon, [2, 4, 6], kpiValue);
        } else if (selectedKpi === "kpi2.1") {
          // Safety Stars - generate grid areas
          areas = generateGridAreas(cityData.lat, cityData.lon, 8, 1, kpiValue);
        } else if (selectedKpi === "kpi3.2") {
          // CO2 Emissions - generate emission zones/heat map
          // Convert reduction percentage to emission intensity (inverse)
          const emissionIntensity = 100 - (typeof kpiValue === 'number' ? kpiValue : parseFloat(String(kpiValue)));
          areas = generateEmissionZones(cityData.lat, cityData.lon, emissionIntensity, 5);
        }

        areas.forEach((area) => {
          if (area.value < filterRange[0] || area.value > filterRange[1]) return;

          // Special color scheme for CO2 emissions - red to green gradient
          let color: string;
          let opacity: number;
          
          if (selectedKpi === "kpi3.2") {
            // CO2: Red (high emissions) to Green (low emissions)
            if (area.value >= 80) color = "#E02020"; // High emissions - red
            else if (area.value >= 60) color = "#F97316"; // Medium-high - orange
            else if (area.value >= 40) color = "#FBBF24"; // Medium - yellow
            else if (area.value >= 20) color = "#84CC16"; // Low-medium - light green
            else color = "#10B981"; // Very low - green
            opacity = 0.25 + (area.value / 100) * 0.3; // Higher opacity for higher emissions
          } else {
            color = getValueColor(area.value);
            opacity = 0.15 + (area.value / 100) * 0.25; // Soft opacity for areas
          }

          const polygon = L.polygon(area.coordinates, {
            fillColor: color,
            fillOpacity: opacity,
            color: selectedKpi === "kpi3.2" ? color : color,
            weight: selectedKpi === "kpi3.2" ? 2 : 1,
            opacity: selectedKpi === "kpi3.2" ? 0.7 : 0.6,
          }).addTo(mapRef.current!);

          const props = area.properties || {};
          const popupContent = `
            <div style="font-family: 'DM Sans', sans-serif; padding: 8px; min-width: 150px;">
              <p style="font-size: 11px; color: #8578C3; margin: 0 0 4px 0; text-transform: uppercase;">${
                selectedKpi === "kpi4.2" ? "Accessibility Zone" : 
                selectedKpi === "kpi2.1" ? "Safety Area" : 
                selectedKpi === "kpi3.2" ? "Emission Zone" : "Area"
              }</p>
              <p style="font-size: 18px; font-weight: bold; color: #2F1B6D; margin: 0 0 6px 0;">${
                selectedKpi === "kpi3.2" 
                  ? `${area.value.toFixed(1)}% intensity` 
                  : `${area.value.toFixed(1)}${selectedKpi === "kpi4.2" ? " score" : " ⭐"}`
              }</p>
              ${props.radius ? `<p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Radius: ${props.radius.toFixed(2)} km</p>` : ''}
              ${props.coverage ? `<p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Derived zone extent: ${props.coverage.toFixed(1)}%</p>` : ''}
              ${selectedKpi === "kpi3.2" ? `<p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Reduction: ${(100 - area.value).toFixed(1)}%</p>` : ''}
            </div>
          `;
          
          polygon.bindPopup(popupContent);
          polygonsRef.current.push(polygon);
        });
      }
      addInterventionLayer(cityData, showInterventionLayer);
    },
    [selectedKpi, filterRange, trafficData, bicycleData, selectedModeTypes, addCityBoundary, onSegmentFocus, addInterventionLayer, showInterventionLayer]
  );

  const addCityMarkers = useCallback(() => {
    if (!mapRef.current) return;

    CITY_DATA.forEach((city) => {
      // Calculate width based on city name length
      const textWidth = city.city.length * 8 + 28;

      const cityIcon = L.divIcon({
        className: "custom-marker",
        html: `
          <div style="
            padding: 8px 14px;
            background: linear-gradient(135deg, hsl(250, 60%, 35%), hsl(250, 70%, 25%)); 
            border-radius: 20px; 
            border: 2px solid rgba(255,255,255,0.3); 
            box-shadow: 0 4px 16px rgba(47,27,109,0.5); 
            display: inline-flex; 
            align-items: center; 
            justify-content: center; 
            color: white; 
            font-family: 'DM Sans', sans-serif;
            cursor: pointer;
            white-space: nowrap;
            min-width: fit-content;
          ">
            <span style="font-size: 12px; font-weight: 600;">${city.city}</span>
          </div>
        `,
        iconSize: [textWidth, 36],
        iconAnchor: [textWidth / 2, 18],
      });

      const marker = L.marker([city.lat, city.lon], { icon: cityIcon }).addTo(mapRef.current!);
      markersRef.current.push(marker);

      // Build KPI list HTML - text only, no icons
      const kpiListHtml = ELABORATOR_KPIS.map(kpi => {
        const kpiData = city.kpiData[kpi.id];
        const value = kpiData?.mainValue || 0;
        const unit = kpiData?.unit || kpi.unit;
        return `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 5px 0; border-bottom: 1px solid rgba(101, 125, 245, 0.1);">
            <span style="font-size: 10px; color: #657DF5; font-weight: 500; text-transform: uppercase;">${kpi.shortName}</span>
            <span style="font-size: 11px; color: #FFFFFF; font-weight: 700; text-shadow: 0 0 8px rgba(255,255,255,0.25);">${value}${unit === '%' ? '%' : ''}</span>
          </div>
        `;
      }).join('');

      // Popup with more transparency
      marker.bindPopup(`
        <div style="font-family: 'DM Sans', sans-serif; min-width: 200px; max-width: 240px; padding: 12px;">
          <p style="font-weight: 700; color: #7C6CFF; margin: 0 0 10px 0; font-size: 14px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.22); padding-bottom: 8px; text-shadow: 0 0 10px rgba(124,108,255,0.45);">${city.city}</p>
          <div style="background: linear-gradient(165deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.08) 45%, rgba(255,255,255,0.04) 100%); border-radius: 8px; padding: 8px; border: 1px solid rgba(255,255,255,0.22); box-shadow: inset 0 1px 0 rgba(255,255,255,0.25);">
            ${kpiListHtml}
          </div>
          <p style="font-size: 10px; color: rgba(220, 214, 255, 0.95); margin-top: 8px; text-align: center; text-shadow: 0 0 8px rgba(124,108,255,0.35);">Click to explore</p>
        </div>
      `, { 
        offset: [0, -10],
        className: 'city-popup'
      });

      marker.on("mouseover", () => {
        marker.openPopup();
      });

      marker.on("click", () => {
        setCurrentCity(city.city);
        setCurrentPilot(null);
        onPilotSelect?.(null);
        setViewLevel("CITY_INTERVENTIONS");
        onCitySelect?.(city.city);
        mapRef.current!.flyTo([city.lat, city.lon], 13, { duration: 1.2 });
        setTimeout(() => {
          clearLayers();
          const pilots = getPilotsByCity(city.city).map((p, idx) => ({
            ...p,
            lat: p.lat || city.lat + (idx - 1) * 0.012,
            lng: p.lng || city.lon + (idx - 1) * 0.015,
          }));
          pilots.forEach((pilot) => {
            const icon = L.divIcon({
              className: "pilot-card-marker",
              html: getPilotCardHtml(city.city, pilot),
              iconSize: [320, 146],
              iconAnchor: [160, 73],
            });

            const pilotMarker = L.marker([pilot.lat, pilot.lng], { icon }).addTo(mapRef.current!);
            markersRef.current.push(pilotMarker);
            pilotMarker.on("click", () => {
              setCurrentPilot(pilot);
              onPilotSelect?.(pilot);
              setViewLevel("PILOT_DATA");
              onCitySelect?.(city.city);
              mapRef.current!.flyTo([city.lat, city.lon], 12, { duration: 0.9 });
              setTimeout(() => {
                clearLayers();
                addHexbinData(city.city, selectedModeTypes);
              }, 500);
            });
          });
        }, 800);
      });
    });
  }, [clearLayers, onCitySelect, addHexbinData, selectedModeTypes, onPilotSelect]);

  const resetToEurope = useCallback(() => {
    if (!mapRef.current) return;
    clearLayers();
    setViewLevel("EUROPE");
    setCurrentCity(null);
    setCurrentPilot(null);
    onPilotSelect?.(null);
    onCitySelect?.("");
    mapRef.current.flyTo([50, 10], 4, { duration: 1 });
    setTimeout(() => addCityMarkers(), 500);
  }, [clearLayers, addCityMarkers, onCitySelect, onPilotSelect]);

  // Expose reset action to parent (e.g., header logo click)
  useEffect(() => {
    onResetToEuropeReady?.(resetToEurope);
  }, [onResetToEuropeReady, resetToEurope]);

  useEffect(() => {
    if (selectedCity && mapRef.current) {
      const cityData = CITY_DATA.find((c) => c.city === selectedCity);
      if (cityData) {
        if (selectedCity !== currentCity) {
          setCurrentCity(selectedCity);
        }
        const cityPilots = getPilotsByCity(selectedCity);
        const selectedPilot = cityPilots.find((pilot) => pilot.id === selectedPilotId);

        if (selectedPilot) {
          setCurrentPilot(selectedPilot);
          setViewLevel("PILOT_DATA");
          mapRef.current.flyTo([cityData.lat, cityData.lon], 12, { duration: 1.2 });
          setTimeout(() => {
            clearLayers();
            addHexbinData(selectedCity, selectedModeTypes);
          }, 800);
        } else {
          setCurrentPilot(null);
          setViewLevel("CITY_INTERVENTIONS");
          mapRef.current.flyTo([cityData.lat, cityData.lon], 13, { duration: 1.2 });
          setTimeout(() => {
            clearLayers();
            addCityMarkers();
            clearLayers();
            const pilots = getPilotsByCity(selectedCity).map((p, idx) => ({
              ...p,
              lat: p.lat || cityData.lat + (idx - 1) * 0.012,
              lng: p.lng || cityData.lon + (idx - 1) * 0.015,
            }));
            pilots.forEach((pilot) => {
              const icon = L.divIcon({
                className: "pilot-card-marker",
                html: getPilotCardHtml(selectedCity, pilot),
                iconSize: [320, 146],
                iconAnchor: [160, 73],
              });
              const pilotMarker = L.marker([pilot.lat, pilot.lng], { icon }).addTo(mapRef.current!);
              markersRef.current.push(pilotMarker);
              pilotMarker.on("click", () => {
                setCurrentPilot(pilot);
                onPilotSelect?.(pilot);
                setViewLevel("PILOT_DATA");
                mapRef.current!.flyTo([cityData.lat, cityData.lon], 12, { duration: 0.9 });
                setTimeout(() => {
                  clearLayers();
                  addHexbinData(selectedCity, selectedModeTypes);
                }, 500);
              });
            });
          }, 800);
        }
      }
    }
  }, [selectedCity, selectedPilotId, currentCity, clearLayers, addHexbinData, selectedModeTypes, onPilotSelect, addCityMarkers]);

  useEffect(() => {
    if (viewLevel === "PILOT_DATA" && currentCity && mapRef.current) {
      clearLayers();
      addHexbinData(currentCity, selectedModeTypes);
    }
  }, [selectedKpi, filterRange, viewLevel, currentCity, clearLayers, addHexbinData, trafficData, bicycleData, cyclingInfrastructureData, selectedModeTypes]);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = L.map(mapContainer.current, { zoomControl: false }).setView([50, 10], 4);
    mapRef.current = map;
    onMapReady?.(map);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: "&copy; OpenStreetMap &copy; CARTO",
      maxZoom: 19,
    }).addTo(map);

    addCityMarkers();

    return () => {
      clearLayers();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div className="relative w-full h-full">
      <style>{`
        .city-popup .leaflet-popup-content-wrapper {
          background: linear-gradient(165deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.08) 45%, rgba(255,255,255,0.04) 100%) !important;
          backdrop-filter: blur(22px);
          -webkit-backdrop-filter: blur(22px);
          border-radius: 12px !important;
          border: 1px solid rgba(255,255,255,0.30) !important;
          box-shadow: 0 10px 34px rgba(12, 10, 40, 0.32), inset 0 1px 0 rgba(255,255,255,0.22) !important;
        }
        .city-popup .leaflet-popup-tip {
          background: rgba(255, 255, 255, 0.16) !important;
          backdrop-filter: blur(22px);
          -webkit-backdrop-filter: blur(22px);
          border: 1px solid rgba(255,255,255,0.22) !important;
        }
      `}</style>
      <div className="absolute inset-0 pointer-events-none z-10 bg-gradient-to-b from-background/30 via-transparent to-background/20" />
      <div ref={mapContainer} className="h-full w-full" />
      {scenario === "comparison" && viewLevel === "PILOT_DATA" && (
        <div className="pointer-events-none absolute inset-0 z-20">
          <div className="absolute inset-y-0 left-1/2 w-[2px] bg-white/70 shadow-[0_0_12px_rgba(255,255,255,0.45)]" />
          <div className="absolute top-6 left-[calc(50%-160px)] text-[11px] px-2 py-1 rounded bg-card/80 border border-border-color/40">
            Baseline
          </div>
          <div className="absolute top-6 left-[calc(50%+16px)] text-[11px] px-2 py-1 rounded bg-violet/80 text-primary-foreground">
            Intervention
          </div>
        </div>
      )}

    </div>
  );
};

export default HeroMap;
