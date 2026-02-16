import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ArrowLeft } from "lucide-react";
import { CITY_DATA, ELABORATOR_KPIS, generateHexbinData } from "@/data/kpiDefinitions";
import { useLatestTrafficData } from "@/hooks/use-traffic-data";
import { trafficSegmentsToSegments, type MapSegment } from "@/services/trafficApi";
import { useLatestBicycleCounting } from "@/hooks/use-bicycle-counting";
import { bicycleCountingToSegments, bicycleCountingToHexbin } from "@/services/bicycleCountingApi";
import { useLatestCyclingInfrastructure } from "@/hooks/use-cycling-infrastructure";
import { cyclingInfrastructureToSegments, cyclingInfrastructureToHexbin } from "@/services/cyclingInfrastructureApi";
import { getVisualizationType, isSegmentVisualization, isPointVisualization, isAreaVisualization } from "@/lib/visualization-types";
import { generateIsochrones, generateGridAreas, type MapArea } from "@/services/areaGenerator";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

type ViewLevel = "europe" | "city" | "detail";

interface HeroMapProps {
  onMapReady?: (map: L.Map) => void;
  onCitySelect?: (cityName: string) => void;
  onViewLevelChange?: (level: ViewLevel) => void;
  selectedCity?: string;
  selectedKpi?: string;
  scenario?: "baseline" | "intervention" | "comparison";
  filterRange?: [number, number];
}

const HeroMap = ({
  onMapReady,
  onCitySelect,
  onViewLevelChange,
  selectedCity,
  selectedKpi = "kpi1.2",
  scenario = "baseline",
  filterRange = [0, 100],
}: HeroMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const circlesRef = useRef<L.CircleMarker[]>([]);
  const polylinesRef = useRef<L.Polyline[]>([]);
  const polygonsRef = useRef<L.Polygon[]>([]);
  const [viewLevel, setViewLevel] = useState<ViewLevel>("europe");
  const [currentCity, setCurrentCity] = useState<string | null>(null);

  // Fetch real traffic data for Issy-les-Moulineaux
  const { data: trafficData, isLoading: isLoadingTraffic } = useLatestTrafficData(
    currentCity || "",
    200
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

  const addHexbinData = useCallback(
    (cityName: string) => {
      if (!mapRef.current) return;

      const cityData = CITY_DATA.find((c) => c.city === cityName);
      if (!cityData) return;

      const visualizationType = getVisualizationType(selectedKpi);
      const isIssy = cityName.toLowerCase().includes("issy");

      // SEGMENTS VISUALIZATION (Lines) - for traffic/congestion/emissions
      if (isSegmentVisualization(selectedKpi)) {
        let segments: MapSegment[] | undefined;
        
        if (isIssy && trafficData?.results && trafficData.results.length > 0) {
          segments = trafficSegmentsToSegments(trafficData.results, selectedKpi);
        } else {
          // Generate synthetic segments for other cities
          const hexPoints = generateHexbinData(cityData, selectedKpi, 50);
          segments = hexPoints.map((point, i) => {
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
        }

        if (segments && segments.length > 0) {
          segments.forEach((segment) => {
            if (segment.value < filterRange[0] || segment.value > filterRange[1]) return;

            const color = getValueColor(segment.value, true); // Use gradient colors
            const opacity = 0.7;
            const weight = 3; // Constant width for clean look

            const polyline = L.polyline(segment.coordinates, {
              color: color,
              weight: weight,
              opacity: opacity,
            }).addTo(mapRef.current!);

            const props = segment.properties || {};
            const popupContent = `
              <div style="font-family: 'DM Sans', sans-serif; padding: 8px; min-width: 150px;">
                <p style="font-size: 11px; color: #8578C3; margin: 0 0 4px 0; text-transform: uppercase;">Traffic Segment</p>
                <p style="font-size: 18px; font-weight: bold; color: #2F1B6D; margin: 0 0 6px 0;">${segment.value.toFixed(1)}%</p>
                ${props.vitesse_km_h ? `<p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Speed: ${props.vitesse_km_h.toFixed(1)} km/h</p>` : ''}
                ${props.indice_de_congestion ? `<p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Congestion: ${(props.indice_de_congestion * 100).toFixed(1)}%</p>` : ''}
                ${isIssy ? `<p style="font-size: 9px; color: #96C2EF; margin-top: 6px;">Live data</p>` : ''}
              </div>
            `;
            
            polyline.bindPopup(popupContent);
            polylinesRef.current.push(polyline);
          });
        }
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
          } else if (trafficData?.results && trafficData.results.length > 0) {
            // Use traffic point data
            points = trafficData.results.map((seg) => ({
              lat: seg.geo_point_2d.lat,
              lon: seg.geo_point_2d.lon,
              value: seg.indice_de_congestion * 100,
              id: seg.id,
            }));
          }
        }
        
        if (!points) {
          // Generate synthetic points
          points = generateHexbinData(cityData, selectedKpi, 200);
        }

        // Calculate size range based on values
        const values = points.map(p => p.value);
        const minValue = Math.min(...values);
        const maxValue = Math.max(...values);
        const valueRange = maxValue - minValue || 1;

        points.forEach((point) => {
          if (point.value < filterRange[0] || point.value > filterRange[1]) return;

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

          const props = point.properties || {};
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
      // AREAS VISUALIZATION (Polygons) - for accessibility/catchment/coverage
      else if (isAreaVisualization(selectedKpi)) {
        let areas: MapArea[] = [];
        const kpiValue = cityData.kpiData[selectedKpi]?.mainValue || 50;
        
        if (selectedKpi === "kpi4.2") {
          // Accessibility - generate isochrones around city center
          areas = generateIsochrones(cityData.lat, cityData.lon, [2, 4, 6], kpiValue);
        } else if (selectedKpi === "kpi2.1") {
          // Safety Stars - generate grid areas
          areas = generateGridAreas(cityData.lat, cityData.lon, 8, 1, kpiValue);
        }

        areas.forEach((area) => {
          if (area.value < filterRange[0] || area.value > filterRange[1]) return;

          const color = getValueColor(area.value);
          const opacity = 0.15 + (area.value / 100) * 0.25; // Soft opacity for areas

          const polygon = L.polygon(area.coordinates, {
            fillColor: color,
            fillOpacity: opacity,
            color: color,
            weight: 1,
            opacity: 0.6,
          }).addTo(mapRef.current!);

          const props = area.properties || {};
          const popupContent = `
            <div style="font-family: 'DM Sans', sans-serif; padding: 8px; min-width: 150px;">
              <p style="font-size: 11px; color: #8578C3; margin: 0 0 4px 0; text-transform: uppercase;">${selectedKpi === "kpi4.2" ? "Accessibility Zone" : "Safety Area"}</p>
              <p style="font-size: 18px; font-weight: bold; color: #2F1B6D; margin: 0 0 6px 0;">${area.value.toFixed(1)}${selectedKpi === "kpi4.2" ? " score" : " ⭐"}</p>
              ${props.radius ? `<p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Radius: ${props.radius} km</p>` : ''}
              ${props.coverage ? `<p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Coverage: ${props.coverage.toFixed(1)}%</p>` : ''}
            </div>
          `;
          
          polygon.bindPopup(popupContent);
          polygonsRef.current.push(polygon);
        });
      }
    },
    [selectedKpi, filterRange, trafficData, bicycleData]
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
            <span style="font-size: 11px; color: #2F1B6D; font-weight: 600;">${value}${unit === '%' ? '%' : ''}</span>
          </div>
        `;
      }).join('');

      // Popup with more transparency
      marker.bindPopup(`
        <div style="font-family: 'DM Sans', sans-serif; min-width: 200px; max-width: 240px; padding: 12px;">
          <p style="font-weight: 600; color: #2F1B6D; margin: 0 0 10px 0; font-size: 14px; text-align: center; border-bottom: 1px solid rgba(101, 125, 245, 0.2); padding-bottom: 8px;">${city.city}</p>
          <div style="background: rgba(248, 249, 252, 0.7); border-radius: 8px; padding: 8px;">
            ${kpiListHtml}
          </div>
          <p style="font-size: 9px; color: #8578C3; margin-top: 8px; text-align: center;">Click to explore</p>
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
        setViewLevel("city");
        onCitySelect?.(city.city);
        mapRef.current!.flyTo([city.lat, city.lon], 12, { duration: 1.2 });
        setTimeout(() => {
          clearLayers();
          addHexbinData(city.city);
        }, 800);
      });
    });
  }, [clearLayers, onCitySelect, selectedKpi, addHexbinData]);

  const resetToEurope = useCallback(() => {
    if (!mapRef.current) return;
    clearLayers();
    setViewLevel("europe");
    setCurrentCity(null);
    onCitySelect?.("");
    mapRef.current.flyTo([50, 10], 4, { duration: 1 });
    setTimeout(() => addCityMarkers(), 500);
  }, [clearLayers, addCityMarkers, onCitySelect]);

  useEffect(() => {
    if (selectedCity && selectedCity !== currentCity && mapRef.current) {
      const cityData = CITY_DATA.find((c) => c.city === selectedCity);
      if (cityData) {
        setCurrentCity(selectedCity);
        setViewLevel("city");
        mapRef.current.flyTo([cityData.lat, cityData.lon], 12, { duration: 1.2 });
        setTimeout(() => {
          clearLayers();
          addHexbinData(selectedCity);
        }, 800);
      }
    }
  }, [selectedCity, currentCity, clearLayers, addHexbinData]);

  useEffect(() => {
    if (viewLevel === "city" && currentCity && mapRef.current) {
      clearLayers();
      addHexbinData(currentCity);
    }
  }, [selectedKpi, filterRange, viewLevel, currentCity, clearLayers, addHexbinData, trafficData, bicycleData, cyclingInfrastructureData]);

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
          background: rgba(255, 255, 255, 0.85) !important;
          backdrop-filter: blur(8px);
          border-radius: 12px !important;
          box-shadow: 0 8px 32px rgba(47, 27, 109, 0.2) !important;
        }
        .city-popup .leaflet-popup-tip {
          background: rgba(255, 255, 255, 0.85) !important;
        }
      `}</style>
      <div className="absolute inset-0 pointer-events-none z-10 bg-gradient-to-b from-background/30 via-transparent to-background/20" />
      <div ref={mapContainer} className="h-full w-full" />

      {viewLevel !== "europe" && (
        <div className="absolute top-20 left-[380px] z-20 flex items-center gap-2">
          <button
            onClick={resetToEurope}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card/95 backdrop-blur-md border border-border-color shadow-lg hover:bg-card transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-violet" />
            <span className="text-sm font-medium text-foreground">All Cities</span>
          </button>

          <div className="px-3 py-2 rounded-lg bg-violet/90 backdrop-blur-md shadow-lg">
            <p className="text-sm font-medium text-primary-foreground">
              {currentCity}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default HeroMap;
