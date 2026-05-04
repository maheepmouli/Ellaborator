import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import L from "leaflet";
import { ScatterplotLayer } from "@deck.gl/layers";
import type { Layer } from "@deck.gl/core";
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
import { getPilotsByCity, getPilotById, SelectedPilot, ViewState } from "@/data/pilotDefinitions";
import { useLocalCityData } from "@/hooks/use-local-city-data";
import { useIssyFlowData } from "@/hooks/use-issy-flow-data";
import { getIssyZoneCentroid, getIssyZoneCentroids } from "@/services/issyFlowData";
import { useMilanEnvironmentSegments, useMilanSpeedSegments } from "@/hooks/use-milan-segment-data";
import { getStoryPointsForPilot } from "@/data/storyConfig";
import { SEGMENT_PRESSURE_ITEMS } from "@/lib/mapLayerLegend";
import { DeckLeafletOverlay } from "@/components/map/DeckLeafletOverlay";
import type { LocalCityPoint } from "@/services/localCityData";

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
  onDataQualitySummaryChange?: (summary: {
    recordsLabel: string;
    spatialQuality: string;
    dataType: string;
    temporalCoverage: string;
    confidence: "High" | "Medium" | "Low";
  } | null) => void;
  /** Milan KPI 3.2 RETE windows; when omitted, derived from baseline vs intervention/comparison scenario. */
  milanEnvironmentWindow?: "08-09" | "18-19";
}

function resolveRenderIntent(cityName: string, kpiId: string): "point" | "segment" | "polygon" | "hex" {
  const cityKey = cityName.toLowerCase();
  if (kpiId === "kpi3.2") return "hex";
  if (cityKey.includes("issy") && (kpiId === "kpi2.1" || kpiId === "kpi3.2")) return "segment";
  if (cityKey.includes("copenhagen") && (kpiId === "kpi1.2" || kpiId === "kpi2.1")) return "point";
  if (kpiId === "kpi4.2") return "polygon";
  if (kpiId === "kpi3.1" || kpiId === "kpi1.2") return "point";
  return "point";
}

/**
 * Pilot overview uses large HTML markers; raw coordinates can sit close enough that cards overlap at z13–14.
 * Spread positions around their centroid while preserving direction so cards stay readable (display-only).
 */
function spreadPilotOverviewPositions(
  coords: ReadonlyArray<{ lat: number; lng: number }>,
): Array<[number, number]> {
  const n = coords.length;
  if (n === 0) return [];
  if (n === 1) return [[coords[0].lat, coords[0].lng]];

  let meanLat = 0;
  let meanLng = 0;
  for (const c of coords) {
    meanLat += c.lat;
    meanLng += c.lng;
  }
  meanLat /= n;
  meanLng /= n;

  const minRadialDeg = 0.032;
  const outwardScale = 2.35;

  return coords.map((c, i) => {
    let dx = c.lng - meanLng;
    let dy = c.lat - meanLat;
    const dist = Math.hypot(dx, dy);

    let tx = dx;
    let ty = dy;

    if (dist < 1e-8) {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2;
      tx = Math.cos(angle) * minRadialDeg;
      ty = Math.sin(angle) * minRadialDeg;
    } else {
      const target = Math.max(dist * outwardScale, minRadialDeg * 0.92);
      tx = (dx / dist) * target;
      ty = (dy / dist) * target;
    }

    return [meanLat + ty, meanLng + tx];
  });
}

/** Resolve pilot coordinates with fallback grid, without mutating canonical pilot defs. */
function pilotFallbackCoord(
  p: { lat?: number; lng?: number },
  idx: number,
  cityLat: number,
  cityLon: number,
): { lat: number; lng: number } {
  return {
    lat: p.lat ?? cityLat + (idx - 1) * 0.012,
    lng: p.lng ?? cityLon + (idx - 1) * 0.015,
  };
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
  onDataQualitySummaryChange,
  milanEnvironmentWindow,
}: HeroMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapPaneWrapperRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [leafletMapUi, setLeafletMapUi] = useState<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const circlesRef = useRef<Array<L.CircleMarker | L.Circle>>([]);
  const polylinesRef = useRef<L.Polyline[]>([]);
  const polygonsRef = useRef<L.Polygon[]>([]);
  const interventionLayerRef = useRef<L.LayerGroup | null>(null);
  const storyPinsLayerRef = useRef<L.LayerGroup | null>(null);
  const cityBoundaryRef = useRef<L.Polygon | null>(null);
  const [viewLevel, setViewLevel] = useState<ViewState>("EUROPE");
  const [currentCity, setCurrentCity] = useState<string | null>(null);
  const [currentPilot, setCurrentPilot] = useState<SelectedPilot | null>(null);
  const [milanLayerQa, setMilanLayerQa] = useState<{
    layer: "safety" | "environment";
    parsed: number;
    rendered: number;
    missingJoins: number;
    invalidGeometry: number;
    avgValue: number;
    dataConfidence: "real" | "proxy" | "unavailable";
    statusMessage?: string;
  } | null>(null);
  const currentCityData = currentCity ? CITY_DATA.find((c) => c.city === currentCity) || null : null;
  const selectedPilotMeta = getPilotById(currentCity || "", selectedPilotId);
  const isKpiSupportedByPilot = selectedPilotMeta
    ? selectedPilotMeta.supportedKpis.includes(selectedKpi)
    : true;
  const lastExternalSelectionRef = useRef<string>("");

  const badge = (label: string) =>
    `<span style="display:inline-block;padding:2px 6px;border-radius:999px;border:1px solid rgba(101,125,245,0.35);background:rgba(101,125,245,0.14);font-size:9px;color:#2F1B6D;margin:2px 3px 0 0;">${label}</span>`;

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
  const { data: localCityPoints } = useLocalCityData(
    currentCity || "",
    selectedKpi,
    currentCityData ? { lat: currentCityData.lat, lon: currentCityData.lon } : null,
    selectedPilotId,
    scenario
  );
  const { data: issyFlows } = useIssyFlowData(
    "all",
    !!currentCity && currentCity.toLowerCase().includes("issy") && selectedKpi === "kpi1.2"
  );
  const milanPilotId: "mil-p1" | "mil-p2" | "mil-p3" =
    selectedPilotId === "mil-p1" || selectedPilotId === "mil-p2" || selectedPilotId === "mil-p3"
      ? selectedPilotId
      : "mil-p2";
  const { data: milanSpeedSegments } = useMilanSpeedSegments(
    milanPilotId,
    !!currentCity && currentCity.toLowerCase() === "milan" && selectedKpi === "kpi2.1"
  );
  const resolvedMilanEnvWindow =
    milanEnvironmentWindow ?? (scenario === "baseline" ? "08-09" : "18-19");

  const { data: milanEnvironmentSegments } = useMilanEnvironmentSegments(
    resolvedMilanEnvWindow,
    !!currentCity && currentCity.toLowerCase() === "milan" && selectedKpi === "kpi3.2"
  );

  const deckOverlayLayers = useMemo((): Layer[] => {
    const enabled =
      viewLevel === "PILOT_DATA" &&
      currentCity?.toLowerCase() === "milan" &&
      selectedKpi === "kpi1.2" &&
      !!(localCityPoints && localCityPoints.length);
    if (!enabled || !localCityPoints?.length) return [];
    const fillFor = (v: number): [number, number, number, number] => {
      if (v >= 80) return [47, 27, 109, 210];
      if (v >= 60) return [101, 125, 245, 200];
      if (v >= 40) return [150, 194, 239, 190];
      return [211, 227, 255, 180];
    };
    return [
      new ScatterplotLayer<LocalCityPoint>({
        id: "elab-deck-milan-mode-share",
        data: localCityPoints.slice(0, 2500),
        getPosition: (d) => [d.lon, d.lat],
        getFillColor: (d) => fillFor(d.value),
        getRadius: 6,
        radiusUnits: "pixels",
        stroked: true,
        getLineWidth: 1,
        lineWidthUnits: "pixels",
        getLineColor: [255, 255, 255, 120],
      }),
    ];
  }, [viewLevel, currentCity, selectedKpi, localCityPoints]);

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
    if (storyPinsLayerRef.current) {
      storyPinsLayerRef.current.remove();
      storyPinsLayerRef.current = null;
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

  const getQuantile = (values: number[], q: number) => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const pos = (sorted.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    if (sorted[base + 1] !== undefined) {
      return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
    }
    return sorted[base];
  };

  const getSegmentHighlight = (value: number, lowThreshold: number, highThreshold: number) => {
    if (value >= highThreshold) {
      return { band: "High", color: "#F97316", weight: 6.4, opacity: 0.95 };
    }
    if (value <= lowThreshold) {
      return { band: "Low", color: "#22C55E", weight: 5.8, opacity: 0.9 };
    }
    return { band: "Mid", color: "#7B8AB8", weight: 3.2, opacity: 0.35 };
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

      const attachPilotStoryPins = () => {
        if (!mapRef.current || !selectedPilotId) return;
        const pins = getStoryPointsForPilot(cityName, selectedPilotId);
        if (!pins.length) return;
        if (storyPinsLayerRef.current) {
          storyPinsLayerRef.current.remove();
          storyPinsLayerRef.current = null;
        }
        const lg = L.layerGroup();
        pins.forEach((p) => {
          const marker = L.circleMarker([p.lat, p.lng], {
            radius: 11,
            color: "#92400e",
            weight: 3,
            fillColor: "#FBBF24",
            fillOpacity: 0.95,
          }).addTo(lg);
          marker.bindPopup(`
            <div style="font-family:'DM Sans',sans-serif;padding:8px;max-width:228px;">
              <p style="font-size:10px;color:#92400e;margin:0 0 4px;text-transform:uppercase;">Story pin</p>
              <p style="font-size:13px;font-weight:700;color:#2F1B6D;margin:0 0 6px;line-height:1.2">${p.title}</p>
              <p style="font-size:11px;color:#383155;margin:0;line-height:1.35">${p.body}</p>
            </div>
          `);
        });
        lg.addTo(mapRef.current);
        storyPinsLayerRef.current = lg;
      };

      try {
      setMilanLayerQa(null);

      if (selectedPilotId && selectedPilotMeta && !isKpiSupportedByPilot) {
        const unsupportedNotice = L.marker([cityData.lat, cityData.lon], {
          icon: L.divIcon({
            className: "unsupported-kpi-notice",
            html: `
              <div style="padding:8px 10px;border-radius:8px;background:rgba(24,31,46,0.92);border:1px solid rgba(255,255,255,0.2);color:#EAF7FF;font-family:'DM Sans',sans-serif;max-width:260px;">
                <p style="margin:0;font-size:11px;font-weight:700;">Unsupported KPI for this pilot</p>
                <p style="margin:4px 0 0 0;font-size:10px;opacity:0.9;">${selectedPilotMeta.name} supports: ${selectedPilotMeta.supportedKpis.join(", ")}</p>
              </div>
            `,
            iconSize: [260, 62],
            iconAnchor: [130, 31],
          }),
        }).addTo(mapRef.current!);
        markersRef.current.push(unsupportedNotice);
        addInterventionLayer(cityData, showInterventionLayer);
        return;
      }

      // Add city boundary
      addCityBoundary(cityData);

      const visualizationType = getVisualizationType(selectedKpi);
      const isIssy = cityName.toLowerCase().includes("issy");
      const ISSY_SEGMENT_KPIS = ["kpi2.1", "kpi3.2"];
      const shouldRenderIssySegments = isIssy && ISSY_SEGMENT_KPIS.includes(selectedKpi);
      const kpiDefinition = getKpiDefinition(selectedKpi);
      const renderIntent = resolveRenderIntent(cityName, selectedKpi);
      const ensureCityCoverage = (
        sourcePoints: Array<{ lat: number; lon: number; value: number; id: string; properties?: Record<string, any> }>,
        minCount: number = 60,
        fallbackCount: number = 220
      ) => {
        if (sourcePoints.length >= minCount) return sourcePoints;
        const anchorValue =
          sourcePoints.length > 0
            ? sourcePoints.reduce((sum, point) => sum + point.value, 0) / sourcePoints.length
            : cityData.kpiData[selectedKpi]?.mainValue || 50;
        const synthetic = generateHexbinData(cityData, selectedKpi, fallbackCount).map((point) => ({
          ...point,
          value: Math.max(0, Math.min(100, anchorValue * 0.72 + point.value * 0.28)),
          properties: {
            dataOrigin: "coverage-fallback",
          },
        }));
        return [...sourcePoints, ...synthetic];
      };

      // Issy KPI1.2: zone-to-zone flow map from baseline/post CSV datasets
      if (isIssy && selectedKpi === "kpi1.2" && issyFlows && issyFlows.length > 0) {
        setMilanLayerQa(null);
        const isSustainableMode = (mode: string) =>
          mode.includes("bicycle") || mode.includes("pedestrian") || mode.includes("public");

        const modeColor = (mode: string) => {
          const lower = mode.toLowerCase();
          if (lower.includes("bicycle")) return "#10B981";
          if (lower.includes("pedestrian")) return "#38BDF8";
          if (lower.includes("car")) return "#8578C3";
          if (lower.includes("bus")) return "#657DF5";
          return "#96C2EF";
        };

        // draw placeholder zone centroids (clearly flagged as placeholder geometry)
        getIssyZoneCentroids().forEach((zone) => {
          const zoneMarker = L.circleMarker([zone.lat, zone.lon], {
            radius: 7,
            fillColor: "#A78BFA",
            fillOpacity: 0.35,
            color: "#DDD6FE",
            weight: 1.4,
            opacity: 0.9,
          }).addTo(mapRef.current!);
          zoneMarker.bindPopup(`
            <div style="font-family: 'DM Sans', sans-serif; padding: 6px; min-width: 130px;">
              <p style="font-size: 10px; color: #2F1B6D; margin: 0 0 3px 0; font-weight: 700;">Data Quality</p>
              <div style="margin-bottom: 4px;">${badge("Approximate")}${badge("Inferred")}${badge("Coverage-expanded")}${badge("Proxy")}</div>
              <p style="font-size: 11px; color: #8578C3; margin: 0 0 4px 0; text-transform: uppercase;">Issy Zone ${zone.zone}</p>
              <p style="font-size: 10px; color: #96C2EF; margin: 0;">${zone.label}</p>
              <p style="font-size: 9px; color: #96C2EF; margin: 4px 0 0 0;">Placeholder geometry</p>
            </div>
          `);
          circlesRef.current.push(zoneMarker);
        });

        const rankedFlows = issyFlows
          .map((flow) => {
            const from = getIssyZoneCentroid(flow.fromZone);
            const to = getIssyZoneCentroid(flow.toZone);
            if (!from || !to || from.zone === to.zone) return null;
            const baselineValue = flow.baselineValue;
            const interventionValue = flow.interventionValue;
            const renderValue =
              scenario === "baseline"
                ? baselineValue
                : scenario === "intervention"
                  ? interventionValue
                  : Math.abs(flow.change);
            return { ...flow, from, to, renderValue };
          })
          .filter((flow): flow is NonNullable<typeof flow> => !!flow)
          .filter((flow) => flow.renderValue >= 0.5);

        rankedFlows.sort((a, b) => b.renderValue - a.renderValue);
        /** Cap simultaneous ribbons + stagger shared corridors so arcs do not pile on top of each other. */
        const flowCandidates = rankedFlows.slice(0, scenario === "comparison" ? 32 : 44);

        const edgeKeyCounts = new Map<string, number>();
        flowCandidates.forEach((flow) => {
          const key = `${flow.fromZone}->${flow.toZone}|${flow.vehicleCategory}`;
          edgeKeyCounts.set(key, (edgeKeyCounts.get(key) ?? 0) + 1);
        });
        const edgeOrdinal = new Map<string, number>();

        flowCandidates.forEach((flow, slotIndex) => {
          const from = flow.from;
          const to = flow.to;
          const key = `${flow.fromZone}->${flow.toZone}|${flow.vehicleCategory}`;
          const nth = edgeOrdinal.get(key) ?? 0;
          edgeOrdinal.set(key, nth + 1);

          const dLat = to.lat - from.lat;
          const dLon = to.lon - from.lon;
          const len = Math.hypot(dLat, dLon) || 1e-9;
          const staggerBand = nth - Math.floor(edgeKeyCounts.get(key)! / 2);
          const stagger = staggerBand + (slotIndex % 3) * 0.35;
          const perpLat = (-dLon / len) * 0.0019 * stagger;
          const phi = (((from.lat + to.lat) / 2) * Math.PI) / 180;
          const cosPhi = Math.max(0.5, Math.cos(phi));
          const perpLon = (dLat / len) * 0.0019 * stagger / cosPhi;

          let midLat = (from.lat + to.lat) / 2 + 0.0016 + perpLat;
          let midLon = (from.lon + to.lon) / 2 + perpLon;
          const path: [number, number][] = [
            [from.lat, from.lon],
            [midLat, midLon],
            [to.lat, to.lon],
          ];

          const positiveImpact = isSustainableMode(flow.vehicleCategory)
            ? flow.change >= 0
            : flow.change <= 0;
          const color =
            scenario === "comparison"
              ? positiveImpact
                ? "#22C55E"
                : "#8578C3"
              : modeColor(flow.vehicleCategory);
          const thickness = Math.max(1.75, Math.min(8.5, 1.85 + flow.renderValue * 0.55));

          const line = L.polyline(path, {
            color,
            weight: thickness,
            opacity: scenario === "comparison" ? Math.min(0.72, 0.42 + thickness * 0.05) : 0.74,
            lineCap: "round",
            lineJoin: "round",
          }).addTo(mapRef.current!);

          // simple direction cue near destination
          const directionDot = L.circleMarker([to.lat, to.lon], {
            radius: Math.max(3, Math.min(7, thickness * 0.55)),
            fillColor: color,
            fillOpacity: 0.95,
            color: "#E9D5FF",
            weight: 1,
            opacity: 0.95,
          }).addTo(mapRef.current!);

          const tooltip = `
            <div style="font-family: 'DM Sans', sans-serif; padding: 8px; min-width: 190px;">
              <p style="font-size: 10px; color: #2F1B6D; margin: 0 0 3px 0; font-weight: 700;">Data Quality</p>
              <div style="margin-bottom: 4px;">${badge("Observed")}${badge("Zone-flow")}${badge("Baseline/Post")}${badge("CSV")}</div>
              <p style="font-size: 11px; color: #8578C3; margin: 0 0 4px 0; text-transform: uppercase;">Issy Zone Flow</p>
              <p style="font-size: 10px; color: #96C2EF; margin: 0;">Mode: ${flow.vehicleCategory}</p>
              <p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">From zone ${flow.fromZone} → zone ${flow.toZone}</p>
              <p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Baseline avg: ${flow.baselineValue.toFixed(2)}</p>
              <p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Post avg: ${flow.interventionValue.toFixed(2)}</p>
              <p style="font-size: 11px; font-weight: 700; color: ${flow.change >= 0 ? "#22C55E" : "#A78BFA"}; margin-top: 4px;">
                Change: ${flow.change >= 0 ? "+" : ""}${flow.change.toFixed(2)} (${flow.changePercent.toFixed(1)}%)
              </p>
              <p style="font-size: 9px; color: #96C2EF; margin-top: 4px;">Observed zone-to-zone CSV flow</p>
            </div>
          `;
          line.bindPopup(tooltip);
          directionDot.bindPopup(tooltip);
          polylinesRef.current.push(line);
          circlesRef.current.push(directionDot);
        });

        addInterventionLayer(cityData, showInterventionLayer);
        return;
      }

      // Milan KPI2.1: render speed/risk on actual road segments from shapefile.
      if (
        cityName.toLowerCase() === "milan" &&
        selectedKpi === "kpi2.1" &&
        milanSpeedSegments
      ) {
        if (milanSpeedSegments.records.length === 0) {
          setMilanLayerQa({
            layer: "safety",
            parsed: 0,
            rendered: 0,
            missingJoins: 0,
            invalidGeometry: 0,
            avgValue: 0,
            dataConfidence: milanSpeedSegments.dataConfidence,
            statusMessage: milanSpeedSegments.statusMessage,
          });
          addInterventionLayer(cityData, showInterventionLayer);
          return;
        }
        const allValues = milanSpeedSegments.records.map((record) => record.value);
        const lowThreshold = getQuantile(allValues, 0.15);
        const highThreshold = getQuantile(allValues, 0.85);
        let renderedCount = 0;
        milanSpeedSegments.records.forEach((segment) => {
          const highlight = getSegmentHighlight(segment.value, lowThreshold, highThreshold);
          const line = L.polyline(segment.coordinates, {
            color: highlight.color,
            weight: highlight.weight,
            opacity: highlight.opacity,
            lineJoin: "round",
            lineCap: "round",
          }).addTo(mapRef.current!);

          const props = segment.properties || {};
          line.bindPopup(`
            <div style="font-family: 'DM Sans', sans-serif; padding: 8px; min-width: 170px;">
              <p style="font-size: 10px; color: #2F1B6D; margin: 0 0 3px 0; font-weight: 700;">Data Quality</p>
              <div style="margin-bottom: 4px;">${badge("Matched")}${badge("Observed")}${badge("Segment-level")}${badge("2024 snapshot")}</div>
              <p style="font-size: 11px; color: #8578C3; margin: 0 0 4px 0; text-transform: uppercase;">Milan Speed Segment</p>
              <p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">City: Milan</p>
              <p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Pilot: ${milanPilotId.toUpperCase()}</p>
              <p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">KPI: KPI2.1 Road User Safety</p>
              <p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Street: ${String(props.streetName || "n/a")}</p>
              <p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Avg speed: ${Number(props.avgSpeed || 0).toFixed(1)} km/h</p>
              <p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">P85 speed: ${Number(props.p85Speed || 0).toFixed(1)} km/h</p>
              <p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Observations: ${Math.round(Number(props.hits || 0))}</p>
              <p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Band: ${highlight.band}</p>
              ${props.cameraCount ? `<p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Camera joins: ${props.cameraCount} (${String(props.cameraJoin || "nearest_geometry")})</p>` : ""}
              <p style="font-size: 9px; color: #96C2EF; margin-top: 6px;">Source: Milan speed network shapefile (${String(props.sourceLabel || "AMAT")})</p>
              <p style="font-size: 9px; color: #96C2EF; margin-top: 2px;">Metric: Segment-level speed risk proxy</p>
              <p style="font-size: 9px; color: #96C2EF; margin-top: 2px;">Geometry: LineString segment</p>
              <p style="font-size: 9px; color: #96C2EF; margin-top: 2px;">Spatial: matched</p>
              <p style="font-size: 9px; color: #96C2EF; margin-top: 2px;">Confidence: ${milanSpeedSegments.dataConfidence}</p>
            </div>
          `);
          polylinesRef.current.push(line);
          renderedCount += 1;
        });
        setMilanLayerQa({
          layer: "safety",
          parsed: milanSpeedSegments.stats.parsedSegments,
          rendered: renderedCount,
          missingJoins: milanSpeedSegments.stats.missingMetricJoins,
          invalidGeometry: milanSpeedSegments.stats.invalidGeometries,
          avgValue: milanSpeedSegments.stats.avgMetricValue,
          dataConfidence: milanSpeedSegments.dataConfidence,
          statusMessage: milanSpeedSegments.statusMessage,
        });
        addInterventionLayer(cityData, showInterventionLayer);
        return;
      }

      // Milan KPI3.2: render environment proxy on road network segments from shapefile.
      if (
        cityName.toLowerCase() === "milan" &&
        selectedKpi === "kpi3.2" &&
        milanEnvironmentSegments &&
        milanEnvironmentSegments.records.length > 0
      ) {
        const allValues = milanEnvironmentSegments.records.map((record) => record.value);
        const lowThreshold = getQuantile(allValues, 0.15);
        const highThreshold = getQuantile(allValues, 0.85);
        let renderedCount = 0;
        milanEnvironmentSegments.records.forEach((segment) => {
          const highlight = getSegmentHighlight(segment.value, lowThreshold, highThreshold);
          const line = L.polyline(segment.coordinates, {
            color: highlight.color,
            weight: highlight.weight,
            opacity: highlight.opacity,
            lineJoin: "round",
            lineCap: "round",
          }).addTo(mapRef.current!);

          const props = segment.properties || {};
          line.bindPopup(`
            <div style="font-family: 'DM Sans', sans-serif; padding: 8px; min-width: 170px;">
              <p style="font-size: 10px; color: #2F1B6D; margin: 0 0 3px 0; font-weight: 700;">Data Quality</p>
              <div style="margin-bottom: 4px;">${badge("Matched")}${badge("Derived")}${badge("Segment-level")}${badge("Available period")}</div>
              <p style="font-size: 11px; color: #8578C3; margin: 0 0 4px 0; text-transform: uppercase;">Milan Climate Segment</p>
              <p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">City: Milan</p>
              <p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Pilot: ${milanPilotId.toUpperCase()}</p>
              <p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">KPI: KPI3.2 Climate and Environmental Impact</p>
              <p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Street: ${String(props.streetName || "n/a")}</p>
              <p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Auto: ${Math.round(Number(props.vAuto || 0))}</p>
              <p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Medium/Heavy: ${Math.round(Number(props.vMedi || 0) + Number(props.vPesanti || 0))}</p>
              <p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Band: ${highlight.band}</p>
              ${props.cameraCount ? `<p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Camera joins: ${props.cameraCount} (${String(props.cameraJoin || "nearest_geometry")})</p>` : ""}
              <p style="font-size: 9px; color: #96C2EF; margin-top: 6px;">Source: Milan RETE_H08/H18 network shapefile</p>
              <p style="font-size: 9px; color: #96C2EF; margin-top: 2px;">Metric: Derived environmental pressure proxy</p>
              <p style="font-size: 9px; color: #96C2EF; margin-top: 2px;">Geometry: LineString segment</p>
              <p style="font-size: 9px; color: #96C2EF; margin-top: 2px;">Spatial: matched</p>
              <p style="font-size: 9px; color: #96C2EF; margin-top: 2px;">Confidence: ${milanEnvironmentSegments.dataConfidence}</p>
            </div>
          `);
          polylinesRef.current.push(line);
          renderedCount += 1;
        });
        setMilanLayerQa({
          layer: "environment",
          parsed: milanEnvironmentSegments.stats.parsedSegments,
          rendered: renderedCount,
          missingJoins: milanEnvironmentSegments.stats.missingMetricJoins,
          invalidGeometry: milanEnvironmentSegments.stats.invalidGeometries,
          avgValue: milanEnvironmentSegments.stats.avgMetricValue,
          dataConfidence: milanEnvironmentSegments.dataConfidence,
          statusMessage: milanEnvironmentSegments.statusMessage,
        });
        addInterventionLayer(cityData, showInterventionLayer);
        return;
      }

      // Always show road segments with traffic data (50% opacity, gradient) when available
      // Traffic data should ALWAYS be rendered as LineString segments, not points
      if (shouldRenderIssySegments && trafficData?.results && trafficData.results.length > 0) {
        console.log(`[HeroMap] Rendering ${trafficData.results.length} traffic segments for ${cityName}`);
        const roadSegments = trafficSegmentsToSegments(trafficData.results, selectedKpi);
        console.log(`[HeroMap] Converted to ${roadSegments.length} map segments`);
        const values = roadSegments.map((segment) => segment.value);
        const lowThreshold = getQuantile(values, 0.15);
        const highThreshold = getQuantile(values, 0.85);
        
        let renderedCount = 0;
        roadSegments.forEach((segment) => {
          const highlight = getSegmentHighlight(segment.value, lowThreshold, highThreshold);

          // Use LineString geometry from geo_shape (the real road segment)
          if (!segment.coordinates || segment.coordinates.length < 2) {
            console.warn(`[HeroMap] Invalid segment coordinates for segment ${segment.id}`);
            return;
          }

          const polyline = L.polyline(segment.coordinates, {
            color: highlight.color,
            weight: highlight.weight,
            opacity: highlight.opacity,
            lineJoin: "round",
            lineCap: "round",
          }).addTo(mapRef.current!);

          const props = segment.properties || {};
          const popupContent = `
            <div style="font-family: 'DM Sans', sans-serif; padding: 8px; min-width: 150px;">
              <p style="font-size: 10px; color: #2F1B6D; margin: 0 0 3px 0; font-weight: 700;">Data Quality</p>
              <div style="margin-bottom: 4px;">${badge("Observed")}${badge("Segment-level")}${badge("Available period")}${badge("API")}</div>
              <p style="font-size: 11px; color: #8578C3; margin: 0 0 4px 0; text-transform: uppercase;">Road Segment</p>
              <p style="font-size: 10px; color: #96C2EF; margin: 0 0 4px 0; font-weight: 600;">Segment: ${segment.id}</p>
              <p style="font-size: 18px; font-weight: bold; color: #2F1B6D; margin: 0 0 6px 0;">${segment.value.toFixed(1)}%</p>
              ${props.vitesse_km_h ? `<p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Speed: ${props.vitesse_km_h.toFixed(1)} km/h</p>` : ''}
              ${props.indice_de_congestion ? `<p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Congestion index: ${props.indice_de_congestion.toFixed(2)}</p>` : ''}
              ${props.distance_metres ? `<p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Observed length: ${(props.distance_metres / 1000).toFixed(2)} km</p>` : ''}
              <p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Band: ${highlight.band}</p>
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
            polyline.setStyle({ weight: highlight.weight, opacity: highlight.opacity });
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
      } else if (shouldRenderIssySegments) {
        console.log(`[HeroMap] No traffic data available:`, {
          isLoading: isLoadingTraffic,
          hasData: !!trafficData,
          resultsCount: trafficData?.results?.length || 0,
          error: trafficError,
          cityName: cityName
        });
      }

      // Road safety is best represented as clustered hotspots with drill-in zoom.
      if (selectedKpi === "kpi2.1" && renderIntent === "point") {
        let safetyPoints =
          (localCityPoints && localCityPoints.length > 0)
            ? localCityPoints.slice(0, 320)
            : generateHexbinData(cityData, selectedKpi, 240);

        safetyPoints = ensureCityCoverage(safetyPoints, 40, 220);

        const hotspotBuckets = new Map<
          string,
          { lat: number; lon: number; total: number; count: number }
        >();

        safetyPoints.forEach((point) => {
          if (point.value < filterRange[0] || point.value > filterRange[1]) return;
          const key = `${Math.round(point.lat * 190)}_${Math.round(point.lon * 190)}`;
          const existing = hotspotBuckets.get(key);
          if (existing) {
            existing.lat += point.lat;
            existing.lon += point.lon;
            existing.total += point.value;
            existing.count += 1;
          } else {
            hotspotBuckets.set(key, {
              lat: point.lat,
              lon: point.lon,
              total: point.value,
              count: 1,
            });
          }
        });

        Array.from(hotspotBuckets.values()).forEach((cluster, index) => {
          const centerLat = cluster.lat / cluster.count;
          const centerLon = cluster.lon / cluster.count;
          const avgValue = cluster.total / cluster.count;
          const radius = Math.max(10, Math.min(28, 10 + cluster.count * 1.3));
          const color = getValueColor(avgValue, true);

          const marker = L.circleMarker([centerLat, centerLon], {
            radius,
            fillColor: color,
            fillOpacity: 0.65,
            color: "#e7ecff",
            weight: 1.5,
            opacity: 0.95,
          }).addTo(mapRef.current!);

          marker.bindPopup(`
            <div style="font-family: 'DM Sans', sans-serif; padding: 8px; min-width: 170px;">
              <p style="font-size: 11px; color: #8578C3; margin: 0 0 4px 0; text-transform: uppercase;">Road Safety Hotspot</p>
              <p style="font-size: 16px; font-weight: bold; color: #2F1B6D; margin: 0;">Risk score: ${avgValue.toFixed(1)}</p>
              <p style="font-size: 10px; color: #96C2EF; margin-top: 4px;">${cluster.count} measurements grouped</p>
              <p style="font-size: 10px; color: #96C2EF; margin-top: 2px;">Click to zoom into data level</p>
            </div>
          `);

          marker.on("click", () => {
            const targetZoom = Math.max(14, mapRef.current?.getZoom() || 14);
            mapRef.current?.flyTo([centerLat, centerLon], targetZoom, { duration: 0.8 });
            onSegmentFocus?.({
              segmentName: `Safety hotspot ${index + 1}`,
              speed: null,
              congestion: avgValue,
            });
          });

          circlesRef.current.push(marker);
        });

        addInterventionLayer(cityData, showInterventionLayer);
        return;
      }

      // SEGMENTS VISUALIZATION (Lines) - for traffic/congestion/emissions (only if not already shown above)
      if (isSegmentVisualization(selectedKpi) && !(shouldRenderIssySegments && trafficData?.results && trafficData.results.length > 0)) {
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
        const values = segments.map((segment) => segment.value);
        const lowThreshold = getQuantile(values, 0.15);
        const highThreshold = getQuantile(values, 0.85);

        segments.forEach((segment) => {
          const highlight = getSegmentHighlight(segment.value, lowThreshold, highThreshold);

          const polyline = L.polyline(segment.coordinates, {
            color: highlight.color,
            weight: highlight.weight,
            opacity: highlight.opacity,
            lineJoin: "round",
            lineCap: "round",
          }).addTo(mapRef.current!);

          const popupContent = `
            <div style="font-family: 'DM Sans', sans-serif; padding: 8px; min-width: 150px;">
              <p style="font-size: 11px; color: #8578C3; margin: 0 0 4px 0; text-transform: uppercase;">Traffic Segment</p>
              <p style="font-size: 18px; font-weight: bold; color: #2F1B6D; margin: 0 0 6px 0;">${segment.value.toFixed(1)}%</p>
              <p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Band: ${highlight.band}</p>
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

        if (!points && localCityPoints && localCityPoints.length > 0) {
          points = localCityPoints.map((point) => ({
            ...point,
            properties: {
              ...(point.properties || {}),
              dataOrigin: "local-city-dataset",
            },
          }));
        }
        
        if (!points) {
          // Generate synthetic points
          points = generateHexbinData(cityData, selectedKpi, 200);
        }
        points = ensureCityCoverage(points, 55, 220);

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
              <p style="font-size: 10px; color: #2F1B6D; margin: 0 0 3px 0; font-weight: 700;">Data Quality</p>
              <div style="margin-bottom: 4px;">${
                props.locationMethod === "approximate_cluster"
                  ? `${badge("Approximate")}${badge("Inferred")}${badge("Coverage-expanded")}${badge("Proxy")}`
                  : props.spatialQuality === "inferred"
                    ? `${badge("Inferred")}${badge("Derived proxy")}${badge("Point/flow-based")}${badge("Available period")}`
                    : `${badge("Exact")}${badge(String(props.type || "observed"))}${badge("Point-level")}${badge("2024 snapshot")}`
              }</div>
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
                <p style="font-size: 9px; color: #96C2EF; margin: 0;">${
                  point.properties?.dataOrigin === "local-city-dataset"
                    ? "Local dataset (SharePoint)"
                    : point.properties?.dataOrigin === "coverage-fallback"
                      ? "Coverage-expanded from local dataset"
                    : isIssy
                      ? "Live data"
                      : "Synthetic data"
                }</p>
                ${props.spatialNote ? `<p style="font-size: 9px; color: #96C2EF; margin: 2px 0 0 0;">${String(props.spatialNote)}</p>` : ""}
                ${props.locationMethod === "approximate_cluster" ? `<p style="font-size: 9px; color: #96C2EF; margin: 2px 0 0 0;">Approximate location</p>` : ""}
                ${props.locationMethod === "pilot_area_inference" ? `<p style="font-size: 9px; color: #96C2EF; margin: 2px 0 0 0;">Location inferred from network segment</p>` : ""}
              </div>
            </div>
          `;
          
          circle.bindPopup(popupContent);
          circlesRef.current.push(circle);
        });
      }
      // AREAS VISUALIZATION (Polygons) - for accessibility/catchment/coverage/emissions
      else if (isAreaVisualization(selectedKpi)) {
        if (selectedKpi === "kpi3.2" && renderIntent === "hex") {
          const sourcePoints =
            (localCityPoints && localCityPoints.length > 0)
              ? localCityPoints.slice(0, 350)
              : generateHexbinData(cityData, selectedKpi, 220);
          const climatePoints = ensureCityCoverage(sourcePoints, 70, 240);

          const climateBuckets = new Map<
            string,
            { lat: number; lon: number; total: number; count: number }
          >();

          climatePoints.forEach((point) => {
            if (point.value < filterRange[0] || point.value > filterRange[1]) return;
            const key = `${Math.round(point.lat * 170)}_${Math.round(point.lon * 170)}`;
            const existing = climateBuckets.get(key);
            if (existing) {
              existing.lat += point.lat;
              existing.lon += point.lon;
              existing.total += point.value;
              existing.count += 1;
            } else {
              climateBuckets.set(key, {
                lat: point.lat,
                lon: point.lon,
                total: point.value,
                count: 1,
              });
            }
          });

          Array.from(climateBuckets.values()).forEach((cluster) => {
            const centerLat = cluster.lat / cluster.count;
            const centerLon = cluster.lon / cluster.count;
            const intensity = Math.max(0, Math.min(100, cluster.total / cluster.count));
            const color =
              intensity >= 75
                ? "#E02020"
                : intensity >= 55
                  ? "#F97316"
                  : intensity >= 35
                    ? "#FBBF24"
                    : "#22C55E";

            const heatCircle = L.circle([centerLat, centerLon], {
              radius: 180 + cluster.count * 24,
              fillColor: color,
              fillOpacity: 0.14 + intensity / 650,
              color,
              weight: 1.1,
              opacity: 0.75,
            }).addTo(mapRef.current!);

            heatCircle.bindPopup(`
              <div style="font-family: 'DM Sans', sans-serif; padding: 8px; min-width: 150px;">
                <p style="font-size: 11px; color: #8578C3; margin: 0 0 4px 0; text-transform: uppercase;">Climate Impact Zone</p>
                <p style="font-size: 16px; font-weight: bold; color: #2F1B6D; margin: 0;">Estimated intensity: ${intensity.toFixed(1)}%</p>
                <p style="font-size: 10px; color: #96C2EF; margin-top: 4px;">${cluster.count} records aggregated</p>
              </div>
            `);

            circlesRef.current.push(heatCircle);
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
      } finally {
        attachPilotStoryPins();
      }
    },
    [selectedKpi, filterRange, trafficData, bicycleData, selectedModeTypes, addCityBoundary, onSegmentFocus, addInterventionLayer, showInterventionLayer, localCityPoints, issyFlows, milanSpeedSegments, milanEnvironmentSegments, scenario, selectedPilotId, selectedPilotMeta, isKpiSupportedByPilot]
  );

  useEffect(() => {
    if (!currentCity || !onDataQualitySummaryChange) return;
    if (currentCity.toLowerCase() === "milan" && selectedKpi === "kpi2.1" && milanSpeedSegments) {
      const total = Math.max(1, milanSpeedSegments.stats.parsedSegments);
      const inferredPct = Math.min(100, Math.round((milanSpeedSegments.stats.missingMetricJoins / total) * 100));
      const matchedPct = Math.max(0, 100 - inferredPct);
      onDataQualitySummaryChange({
        recordsLabel: `${milanSpeedSegments.stats.parsedSegments.toLocaleString()} segments`,
        spatialQuality: `${matchedPct}% matched, ${inferredPct}% inferred`,
        dataType: "observed speed + derived risk index",
        temporalCoverage: "2024 snapshot",
        confidence: "High",
      });
      return;
    }
    if (currentCity.toLowerCase().includes("helsinki")) {
      const total = localCityPoints?.length || 0;
      onDataQualitySummaryChange({
        recordsLabel: `${total.toLocaleString()} points`,
        spatialQuality: "inferred from network segments",
        dataType: selectedKpi === "kpi2.1" ? "derived proxy from Telraam flows" : "observed counts",
        temporalCoverage: "available period",
        confidence: "Medium",
      });
      return;
    }
    if (currentCity.toLowerCase().includes("issy") && selectedKpi === "kpi1.2" && issyFlows) {
      onDataQualitySummaryChange({
        recordsLabel: `${issyFlows.length.toLocaleString()} zone flows`,
        spatialQuality: "zone-flow linkage",
        dataType: "observed baseline/post flows",
        temporalCoverage: "before-after",
        confidence: "High",
      });
      return;
    }
    const fallbackCount = localCityPoints?.length || 0;
    onDataQualitySummaryChange({
      recordsLabel: `${fallbackCount.toLocaleString()} records`,
      spatialQuality: "coverage-expanded inferred proxy",
      dataType: "inferred proxy",
      temporalCoverage: "available period",
      confidence: "Low",
    });
  }, [currentCity, selectedKpi, localCityPoints, milanSpeedSegments, issyFlows, onDataQualitySummaryChange]);

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
          const pilots = getPilotsByCity(city.city);
          const fallbackCoords = pilots.map((p, idx) => pilotFallbackCoord(p, idx, city.lat, city.lon));
          const spreadPts = spreadPilotOverviewPositions(fallbackCoords);
          pilots.forEach((pilot, pi) => {
            const icon = L.divIcon({
              className: "pilot-card-marker",
              html: getPilotCardHtml(city.city, pilot),
              iconSize: [320, 146],
              iconAnchor: [160, 73],
            });

            const pilotMarker = L.marker(spreadPts[pi], { icon }).addTo(mapRef.current!);
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
    lastExternalSelectionRef.current = "";
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
      const selectionKey = `${selectedCity}::${selectedPilotId || "none"}`;
      if (selectionKey === lastExternalSelectionRef.current) {
        return;
      }
      lastExternalSelectionRef.current = selectionKey;

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
            const pilots = getPilotsByCity(selectedCity);
            const fallbackCoords = pilots.map((p, idx) => pilotFallbackCoord(p, idx, cityData.lat, cityData.lon));
            const spreadPts = spreadPilotOverviewPositions(fallbackCoords);
            pilots.forEach((pilot, pi) => {
              const icon = L.divIcon({
                className: "pilot-card-marker",
                html: getPilotCardHtml(selectedCity, pilot),
                iconSize: [320, 146],
                iconAnchor: [160, 73],
              });
              const pilotMarker = L.marker(spreadPts[pi], { icon }).addTo(mapRef.current!);
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
    setLeafletMapUi(map);
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
      setLeafletMapUi(null);
    };
  }, []);

  return (
    <div className="relative w-full h-full" ref={mapPaneWrapperRef}>
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
      <DeckLeafletOverlay
        leafletMap={leafletMapUi}
        parentRef={mapPaneWrapperRef}
        layers={deckOverlayLayers}
        enabled={deckOverlayLayers.length > 0}
      />
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

      {currentCity?.toLowerCase() === "milan" && viewLevel === "PILOT_DATA" && (
        <div className="pointer-events-none absolute bottom-6 right-6 z-30 w-[280px] rounded-xl border border-white/25 bg-black/35 backdrop-blur-xl p-3 text-[11px] text-white">
          <p className="font-semibold text-violet mb-2">
            {selectedKpi === "kpi2.1" ? "Road safety (segments)" : selectedKpi === "kpi3.2" ? "Environmental pressure (segments)" : "Legend"}
          </p>
          <div className="space-y-1.5 mb-3">
            {SEGMENT_PRESSURE_ITEMS.map((row) => (
              <div key={row.label} className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-10 rounded-full shadow-[0_0_0_1px_rgba(255,255,255,0.12)]" style={{ backgroundColor: row.color }} />
                <span>{row.label}</span>
              </div>
            ))}
          </div>
          {milanLayerQa && (
            <div className="border-t border-white/20 pt-2 space-y-1 text-[10px] text-white/90">
              <p className="font-semibold text-violet">Parser QA ({milanLayerQa.layer})</p>
              <p>Confidence: {milanLayerQa.dataConfidence}</p>
              {milanLayerQa.statusMessage && <p>Status: {milanLayerQa.statusMessage}</p>}
              <p>Segments parsed: {milanLayerQa.parsed}</p>
              <p>Segments rendered: {milanLayerQa.rendered}</p>
              <p>Missing joins: {milanLayerQa.missingJoins}</p>
              <p>Invalid geometries: {milanLayerQa.invalidGeometry}</p>
              <p>Avg normalized metric: {milanLayerQa.avgValue.toFixed(1)}</p>
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default HeroMap;
