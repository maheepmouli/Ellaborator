import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import L from "leaflet";
import { ScatterplotLayer } from "@deck.gl/layers";
import type { Layer } from "@deck.gl/core";
import { useQuery } from "@tanstack/react-query";
import "leaflet/dist/leaflet.css";
import { CITY_DATA, ELABORATOR_KPIS, generateHexbinData } from "@/data/kpiDefinitions";
import { useLatestTrafficData } from "@/hooks/use-traffic-data";
import { trafficSegmentsToSegments, type MapSegment } from "@/services/trafficApi";
import { useLatestBicycleCounting } from "@/hooks/use-bicycle-counting";
import { bicycleCountingToSegments, bicycleCountingToHexbin } from "@/services/bicycleCountingApi";
import { useLatestCyclingInfrastructure } from "@/hooks/use-cycling-infrastructure";
import { cyclingInfrastructureToSegments, cyclingInfrastructureToHexbin } from "@/services/cyclingInfrastructureApi";
import { getQuantile, getSegmentHighlight } from "@/lib/segmentHighlight";
import { getVisualizationType, isSegmentVisualization, isPointVisualization, isAreaVisualization } from "@/lib/visualization-types";
import { generateIsochrones, generateGridAreas, generateEmissionZones, type MapArea } from "@/services/areaGenerator";
import { getKpiDefinition } from "@/config/kpiDefinitions";
import { getPilotsByCity, getPilotById, SelectedPilot, ViewState } from "@/data/pilotDefinitions";
import { getCityPilotProfile } from "@/data/cityPilotProfiles";
import { useLocalCityData } from "@/hooks/use-local-city-data";
import { useIssyFlowData } from "@/hooks/use-issy-flow-data";
import { useIssyWorkbooks } from "@/hooks/use-issy-workbooks";
import { getIssyZoneCentroid, getIssyZoneCentroids } from "@/services/issyFlowData";
import { useMilanEnvironmentSegments, useMilanSpeedSegments } from "@/hooks/use-milan-segment-data";
import { getStoryPointsForPilot } from "@/data/storyConfig";
import { SEGMENT_PRESSURE_ITEMS } from "@/lib/mapLayerLegend";
import {
  bindJunctionObservatoryLayer,
  renderIssyJunctionArms,
  resolveJunctionModeAccent,
} from "@/lib/renderIssyJunctionArms";
import {
  segmentInteractionHandlers,
  wireCircleMarkerSegment,
  wirePolygonSegment,
  wirePolylineSegment,
  type SegmentInteractionHandlers,
} from "@/lib/wireMapSegmentInteraction";
import { filterPointsInPilotZone } from "@/lib/interventionZone";
import {
  getCopenhagenCameraIdsForPilot,
  inferOtcWorkbookKey,
  isCopenhagenCameraKpi,
} from "@/data/copenhagenCameraSites";
import { renderCopenhagenMapLayers } from "@/lib/copenhagenMapLayers/renderCopenhagenMapLayers";
import { renderTrikalaMapLayers } from "@/lib/trikalaMapLayers";
import { getTrikalaSegmentInsights } from "@/services/trikalaSurveyParser";
import { isTrikalaCityName, getTrikalaPilotAnchor, trikalaMapZoom } from "@/lib/trikalaMapConfig";
import {
  filterTrikalaLocationsByKpi,
  filterTrikalaLocationsByPilot,
  loadTrikalaLocationsBundle,
} from "@/data/trikalaLocationRegistry";
import { loadCopenhagenParkingGeoJson, loadCopenhagenStreetsGeoJson } from "@/services/copenhagenExtendedParsers";
import {
  ISSY_SEGMENT_KPIS,
  isIssyCity,
  shouldRenderIssyTrafficSegments,
} from "@/lib/issyMapRouting";
import {
  resolveRenderIntent,
  resolveSpatialRenderPlan,
} from "@/lib/spatialLayerRegistry";
import { provenanceBadgesHtml } from "@/lib/dataProvenance";
import { renderInfluenceField } from "@/lib/renderInfluenceField";
import { resolveMapPointIconSpec } from "@/lib/mapPointIconTaxonomy";
import { createMapPointDivIcon, addNeonPointMarker } from "@/lib/mapPointIcons";
import {
  renderIssyAccessibilityField,
  renderIssyClimateHexField,
  renderIssyFacilityLayers,
  renderIssySentimentField,
} from "@/lib/issyMapLayers";
import {
  countIssyFacilityRenderables,
  filterCyclingInfrastructureForIssy,
} from "@/lib/issyFacilityMap";
import type { IssyDayCategory } from "@/services/issyFlowData";
import { DeckLeafletOverlay } from "@/components/map/DeckLeafletOverlay";
import { getLocalCityDiagnostics, type LocalCityPoint } from "@/services/localCityData";
import {
  loadCopenhagenCountSitesGeoJson,
  loadHelsinkiDangerousLocationsGeoJson,
  loadHelsinkiInterventionLocationsGeoJson,
  loadZaragozaInterventionAreasGeoJson,
} from "@/services/staticGeoData";
import {
  HELSINKI_GEO_LAYER_LABELS,
  loadHelsinkiGeoSample,
} from "@/lib/helsinkiGeoLayers";
import { getIssyAccessibilityMock } from "@/data/issyAccessibilityMock";
import { getIssySentimentMock } from "@/data/issySentimentMock";
import { infrastructureChartLabelMatchesFeature } from "@/lib/infrastructureChartMapLink";
import {
  areAllTravelModesSelected,
  travelModeMatchesIssyVehicleCategory,
} from "@/lib/travelModeMapLink";
import {
  ISSY_OD_CSV_DISCLAIMER,
  ISSY_OD_DIRECTIONAL_NOTE,
} from "@/lib/issyDataTransparency";
import type { PilotGeometryRenderSpec } from "@/lib/pilotGeometryRenderer";
import type { RuntimeLinkage } from "@/lib/pilotGeometryRenderer";
import { getKpi32TimeSeriesIntensity, resolveKpi32PolygonBaseIntensity } from "@/lib/kpi32YearIntensity";
import {
  dedupeTrafficBySegmentId,
  filterMapSegmentsNearJunction,
  getIssyJunctionClipRadiusM,
  isIssyStudyPilot,
  isNearIssyJunction,
  ISSY_P2_JUNCTION,
  junctionMarkerLatLng,
} from "@/lib/issyPilot2Junction";

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
  /** Issy Pilot 2 — open segment observatory when a junction arm is clicked. */
  onJunctionSegmentClick?: (detail: {
    segmentId: string;
    segmentName: string;
    speed: number | null;
    congestion: number | null;
  }) => void;
  showInterventionLayer?: boolean;
  onPilotSelect?: (pilot: SelectedPilot | null) => void;
  onDataQualitySummaryChange?: (summary: {
    recordsLabel: string;
    spatialQuality: string;
    dataType: string;
    temporalCoverage: string;
    confidence: "High" | "Medium" | "Low";
    provenanceType?: string;
    geometryLinkage?: string;
    spatialSystemHint?: string;
  } | null) => void;
  /** Milan KPI 3.2 RETE windows; when omitted, derived from baseline vs intervention/comparison scenario. */
  milanEnvironmentWindow?: "08-09" | "18-19";
  /** Issy KPI 1.2 zone-flow CSV: filter by day type (bundled baseline/post extracts). */
  issyFlowDayCategory?: "all" | IssyDayCategory;
  /** Sidebar chart drill: zoom map to pilot / city anchor. */
  pilotFlyToSignal?: {
    nonce: number;
    lat?: number;
    lng?: number;
    zoom?: number;
    bounds?: [[number, number], [number, number]];
    maxZoom?: number;
  } | null;
  /** KPI 3.1: show only assets whose type/label fuzzy-matches the clicked chart bar. */
  infrastructureCategoryFocus?: string | null;
  /** KPI 3.2: chart year (e.g. "2022") — map climate hex + emission zones follow time series intensity. */
  kpi32SelectedYear?: string | null;
  /** Issy junction study — highlight colour for the selected arm marker. */
  selectedJunctionSegmentId?: string | null;
  /** Transient hover highlight (Copenhagen markers / flow endpoints). */
  hoveredJunctionSegmentId?: string | null;
  /** Segment focus — dim non-selected layers. */
  focusMode?: boolean;
  onSegmentHover?: (detail: {
    segmentId: string;
    segmentName: string;
    speed?: number | null;
    congestion?: number | null;
  } | null) => void;
  pilotGeometrySpec?: PilotGeometryRenderSpec | null;
  runtimeLinkage?: RuntimeLinkage;
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

const COPENHAGEN_SITE_ALIASES: Array<{ key: string; patterns: string[] }> = [
  { key: "hojbro", patterns: ["hojbro"] },
  { key: "norreport", patterns: ["norreport", "norreport"] },
  { key: "gammeltorv", patterns: ["gammeltorv"] },
  { key: "stormgade", patterns: ["stormgade"] },
  { key: "vandkunsten", patterns: ["vandkunsten"] },
];

function normalizeSiteName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function resolveCopenhagenSiteKey(value: string): string | null {
  const normalized = normalizeSiteName(value);
  for (const alias of COPENHAGEN_SITE_ALIASES) {
    if (alias.patterns.some((pattern) => normalized.includes(pattern))) return alias.key;
  }
  return null;
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

function corridorMatchesSelection(
  selectedId: string | null | undefined,
  cameraId: string,
  segmentId: string
): boolean {
  if (!selectedId) return true;
  if (selectedId === segmentId) return true;
  if (selectedId === `corridor:${cameraId}`) return true;
  if (selectedId.includes(cameraId)) return true;
  return false;
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
  onJunctionSegmentClick,
  showInterventionLayer = false,
  onPilotSelect,
  onDataQualitySummaryChange,
  milanEnvironmentWindow,
  issyFlowDayCategory = "all",
  pilotFlyToSignal = null,
  infrastructureCategoryFocus = null,
  kpi32SelectedYear = null,
  selectedJunctionSegmentId = null,
  hoveredJunctionSegmentId = null,
  focusMode = false,
  onSegmentHover,
  pilotGeometrySpec = null,
  runtimeLinkage,
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
  const [cphParkingGeo, setCphParkingGeo] = useState<GeoJSON.FeatureCollection | null>(null);
  const [cphStreetsGeo, setCphStreetsGeo] = useState<GeoJSON.FeatureCollection | null>(null);
  const currentCityData = currentCity ? CITY_DATA.find((c) => c.city === currentCity) || null : null;
  const selectedPilotMeta = getPilotById(currentCity || "", selectedPilotId);
  const selectedPilotProfile = getCityPilotProfile(selectedPilotId);
  const isKpiSupportedByPilot = selectedPilotMeta
    ? selectedPilotMeta.supportedKpis.includes(selectedKpi)
    : true;
  const lastExternalSelectionRef = useRef<string>("");
  const onJunctionSegmentClickRef = useRef(onJunctionSegmentClick);
  const onSegmentHoverRef = useRef(onSegmentHover);
  const onSegmentFocusRef = useRef(onSegmentFocus);
  useEffect(() => {
    onJunctionSegmentClickRef.current = onJunctionSegmentClick;
  }, [onJunctionSegmentClick]);
  useEffect(() => {
    onSegmentHoverRef.current = onSegmentHover;
  }, [onSegmentHover]);
  useEffect(() => {
    onSegmentFocusRef.current = onSegmentFocus;
  }, [onSegmentFocus]);

  useEffect(() => {
    if (!currentCity?.toLowerCase().includes("copenhagen")) {
      setCphParkingGeo(null);
      setCphStreetsGeo(null);
      return;
    }
    void loadCopenhagenParkingGeoJson().then(setCphParkingGeo);
    void loadCopenhagenStreetsGeoJson().then(setCphStreetsGeo);
  }, [currentCity]);

  const isCopenhagenCameraContext =
    currentCity?.toLowerCase().includes("copenhagen") && isCopenhagenCameraKpi(selectedKpi);
  const segmentInteractionEnabled =
    isCopenhagenCameraContext ||
    (pilotGeometrySpec?.interactionModel !== "network" &&
      pilotGeometrySpec?.interactionModel !== "dashboard_only");
  const suppressMapSpatialLayers =
    pilotGeometrySpec?.interactionModel === "dashboard_only" && !isCopenhagenCameraContext;

  const badge = (label: string) => provenanceBadgesHtml([label]);

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
  const issyJunctionStudy = isIssyStudyPilot(selectedPilotId);

  const bicycleDataForMap = useMemo(() => {
    if (!bicycleData?.results?.length || !issyJunctionStudy) return bicycleData;
    const clipRadius = getIssyJunctionClipRadiusM(selectedPilotId);
    const results = bicycleData.results.filter((row) => {
      if (clipRadius === null) return true;
      return isNearIssyJunction(row.coordinates.lat, row.coordinates.lon, clipRadius);
    });
    return { ...bicycleData, results, total_count: results.length };
  }, [bicycleData, issyJunctionStudy, selectedPilotId]);

  const cyclingInfrastructureForMap = useMemo(() => {
    if (!cyclingInfrastructureData?.results?.length) return cyclingInfrastructureData;
    if (!issyJunctionStudy) return cyclingInfrastructureData;
    const slice = filterCyclingInfrastructureForIssy(
      cyclingInfrastructureData,
      selectedPilotId,
      true
    );
    return {
      ...cyclingInfrastructureData,
      results: slice.results,
      total_count: slice.total_count,
    };
  }, [cyclingInfrastructureData, issyJunctionStudy, selectedPilotId]);

  const issyFacilityLayerStatus = useMemo(() => {
    if (!isIssyCity(currentCity || "") || selectedKpi !== "kpi3.1") return null;
    const slice = filterCyclingInfrastructureForIssy(
      cyclingInfrastructureData,
      selectedPilotId,
      issyJunctionStudy
    );
    const { lines, points } = countIssyFacilityRenderables(slice.results);
    let statusMessage = "";
    if (isLoadingCyclingInfra) {
      statusMessage = "Loading bundled cycling infrastructure snapshot…";
    } else if (slice.apiTotal === 0) {
      statusMessage = "Bundled snapshot contains no facility records for Issy-les-Moulineaux.";
    } else if (slice.results.length === 0) {
      statusMessage = `All ${slice.apiTotal} API records fall outside the ${slice.clipLabel}. Try Pilot 2 (Intermodal) for city-wide corridors.`;
    } else {
      statusMessage = `${lines} corridor${lines === 1 ? "" : "s"}, ${points} node${points === 1 ? "" : "s"} within ${slice.clipLabel}.`;
    }
    return {
      apiTotal: slice.apiTotal,
      visibleLines: lines,
      visiblePoints: points,
      clipLabel: slice.clipLabel,
      statusMessage,
      loading: isLoadingCyclingInfra,
      isEmpty: !isLoadingCyclingInfra && lines + points === 0,
    };
  }, [
    currentCity,
    selectedKpi,
    cyclingInfrastructureData,
    selectedPilotId,
    issyJunctionStudy,
    isLoadingCyclingInfra,
  ]);

  const { data: localCityPoints } = useLocalCityData(
    currentCity || "",
    selectedKpi,
    currentCityData ? { lat: currentCityData.lat, lon: currentCityData.lon } : null,
    selectedPilotId,
    scenario
  );
  const isTrikalaCity = !!currentCity?.toLowerCase().includes("trikala");
  const { data: trikalaSegmentInsights = [] } = useQuery({
    queryKey: ["trikala-segment-insights"],
    queryFn: getTrikalaSegmentInsights,
    enabled: isTrikalaCity,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const { data: trikalaLocationsBundle } = useQuery({
    queryKey: ["trikala-locations-bundle"],
    queryFn: loadTrikalaLocationsBundle,
    enabled: isTrikalaCity,
    staleTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const trikalaInfrastructureLocations = useMemo(() => {
    const byKpi = filterTrikalaLocationsByKpi(
      trikalaLocationsBundle?.locations ?? [],
      selectedKpi
    );
    return filterTrikalaLocationsByPilot(byKpi, selectedPilotId);
  }, [trikalaLocationsBundle?.locations, selectedKpi, selectedPilotId]);
  const { data: issyFlows } = useIssyFlowData(
    issyFlowDayCategory,
    !!currentCity && isIssyCity(currentCity) && selectedKpi === "kpi1.2"
  );
  const issyWorkbooksEnabled = !!currentCity && isIssyCity(currentCity);
  const { classeur: issyClasseurQuery, wintics: issyWinticsQuery } = useIssyWorkbooks(
    issyWorkbooksEnabled
  );
  const issyClasseur = issyClasseurQuery.data ?? null;
  const issyWintics = issyWinticsQuery.data ?? null;
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
    !!currentCity && currentCity.toLowerCase() === "milan" && selectedKpi === "kpi3.2",
    milanPilotId
  );

  const deckOverlayLayers = useMemo((): Layer[] => {
    const milanModeShare =
      viewLevel === "PILOT_DATA" &&
      currentCity?.toLowerCase() === "milan" &&
      selectedKpi === "kpi1.2" &&
      !!(localCityPoints && localCityPoints.length);

    if (milanModeShare && localCityPoints?.length) {
      const scopedMilanPoints = filterPointsInPilotZone(
        localCityPoints,
        currentCity || "Milan",
        selectedPilotId
      );
      if (!scopedMilanPoints.length) return [];
      const fillFor = (v: number): [number, number, number, number] => {
        if (v >= 80) return [47, 27, 109, 210];
        if (v >= 60) return [101, 125, 245, 200];
        if (v >= 40) return [150, 194, 239, 190];
        return [211, 227, 255, 180];
      };
      return [
        new ScatterplotLayer<LocalCityPoint>({
          id: "elab-deck-milan-mode-share",
          data: scopedMilanPoints.slice(0, 800),
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
    }
    return [];
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

  const addInterventionLayer = useCallback(
    (cityData: { lat: number; lon: number }, enabled: boolean, skipAtJunction?: boolean) => {
    if (!mapRef.current || !enabled || skipAtJunction) return;
    const layer = L.layerGroup();
    const focusLat = selectedPilotMeta?.lat ?? cityData.lat;
    const focusLng = selectedPilotMeta?.lng ?? cityData.lon;
    const focusRadiusM = selectedPilotMeta?.scale === "street" ? 450 : selectedPilotMeta?.scale === "district" ? 900 : 1400;
    // Single pilot boundary — avoid two stacked filled discs that read as duplicate layers.
    const isCopenhagenPilot =
      currentCity?.toLowerCase().includes("copenhagen") && selectedPilotId?.startsWith("cph-");
    if (!isCopenhagenPilot) {
      const interventionBoundary = L.circle([focusLat, focusLng], {
        radius: focusRadiusM,
        color: "#a78bfa",
        weight: 2,
        dashArray: "6 8",
        fillColor: "#8b5cf6",
        fillOpacity: 0.06,
        interactive: false,
        bubblingMouseEvents: false,
      });
      layer.addLayer(interventionBoundary);
    }
    if (selectedPilotProfile?.interventionMarkers?.length) {
      selectedPilotProfile.interventionMarkers.forEach((marker) => {
        const markerLayer = L.circleMarker([marker.lat, marker.lng], {
          radius: marker.isPlaceholder ? 8 : 7,
          color: marker.isPlaceholder ? "#f59e0b" : "#a78bfa",
          weight: 2,
          fillColor: marker.isPlaceholder ? "#fbbf24" : "#c4b5fd",
          fillOpacity: marker.isPlaceholder ? 0.55 : 0.9,
        });
        markerLayer.bindPopup(`
          <div style="font-family:'DM Sans',sans-serif;min-width:260px;padding:8px 10px;">
            <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#2f1b6d;">${marker.title}</p>
            <p style="margin:0 0 6px;font-size:10px;color:#5b4d84;">${marker.interventionType}</p>
            <p style="margin:0 0 4px;font-size:10px;color:#2f1b6d;">Coordinates: ${marker.lat.toFixed(6)}, ${marker.lng.toFixed(6)}</p>
            <p style="margin:0 0 2px;font-size:10px;color:#2f1b6d;">Data availability: ${marker.dataAvailability}</p>
            <p style="margin:0 0 2px;font-size:10px;color:#2f1b6d;">Baseline: ${marker.baselineStatus}</p>
            <p style="margin:0;font-size:10px;color:#2f1b6d;">Post-intervention: ${marker.postStatus}</p>
          </div>
        `);
        layer.addLayer(markerLayer);
      });
    }
    const pilotId = selectedPilotId as HelsinkiPilotId | null;
    if (pilotId && (pilotId === "hel-p1" || pilotId === "hel-p2")) {
      void loadHelsinkiGeoSample(pilotId, pilotId === "hel-p1" ? 80 : 40).then((points) => {
        if (!mapRef.current || interventionLayerRef.current !== layer) return;
        const layerLabel = HELSINKI_GEO_LAYER_LABELS[pilotId] || "Observed Helsinki layer";
        points.forEach((point, index) => {
          const markerLayer = L.circleMarker([point.lat, point.lng], {
            radius: 4,
            color: "#7c3aed",
            weight: 1,
            fillColor: "#ddd6fe",
            fillOpacity: 0.75,
          });
          markerLayer.bindPopup(`
            <div style="font-family:'DM Sans',sans-serif;min-width:220px;padding:8px 10px;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#2f1b6d;">${point.title}</p>
              <p style="margin:0;font-size:10px;color:#5b4d84;">${layerLabel} · point ${index + 1}</p>
            </div>
          `);
          layer.addLayer(markerLayer);
        });
      });
    }
    layer.addTo(mapRef.current);
    interventionLayerRef.current = layer;
  }, [currentCity, selectedPilotId, selectedPilotMeta?.lat, selectedPilotMeta?.lng, selectedPilotMeta?.scale, selectedPilotProfile]);

  // Add city boundary polygon
  const addCityBoundary = useCallback((cityData: { lat: number; lon: number; city: string }) => {
    if (!mapRef.current || cityBoundaryRef.current) return;
    const isCopenhagenPilot =
      cityData.city.toLowerCase().includes("copenhagen") && selectedPilotId?.startsWith("cph-");
    if (isCopenhagenPilot) return;

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
  }, [selectedPilotId]);

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

      const segmentHandlers = segmentInteractionHandlers(
        (detail) => onSegmentHoverRef.current?.(detail),
        (ctx) => onSegmentFocusRef.current?.(ctx),
        (detail) => onJunctionSegmentClickRef.current?.(detail)
      );
      const activeMapSegmentId = hoveredJunctionSegmentId ?? selectedJunctionSegmentId;

      const isMilanInterventionPilot =
        cityName.toLowerCase() === "milan" &&
        (milanPilotId === "mil-p1" || milanPilotId === "mil-p2");

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

      // Add city boundary (skip for Trikala survey/infrastructure canvas)
      if (!suppressMapSpatialLayers) {
        addCityBoundary(cityData);
      }

      if (suppressMapSpatialLayers) {
        const anchor = getTrikalaPilotAnchor(selectedPilotId);
        renderTrikalaMapLayers({
          map: mapRef.current!,
          anchor,
          selectedPilotId,
          records: filterPointsInPilotZone(localCityPoints ?? [], cityName, selectedPilotId),
          segmentInsights: trikalaSegmentInsights,
          infrastructureLocations: trikalaInfrastructureLocations,
          selectedKpi,
          scenario,
          selectedSegmentId: activeMapSegmentId,
          filterRange,
          segmentHandlers,
          getValueColor,
          markersOut: markersRef.current,
          circlesOut: circlesRef.current,
          polylinesOut: polylinesRef.current,
          polygonsOut: polygonsRef.current,
          wireCircleMarker: wireCircleMarkerSegment,
        });
        return;
      }

      const visualizationType = getVisualizationType(selectedKpi);
      const isIssy = isIssyCity(cityName);
      const shouldRenderIssySegments = shouldRenderIssyTrafficSegments(cityName, selectedKpi);
      const issyLayerRefs = {
        circles: circlesRef.current,
        markers: markersRef.current,
        polylines: polylinesRef.current,
        polygons: polygonsRef.current,
      };
      const addIssyInfluenceField = () => {
        if (!mapRef.current) return;
        renderInfluenceField(mapRef.current, circlesRef.current, {
          center: [ISSY_P2_JUNCTION.lat, ISSY_P2_JUNCTION.lon],
          radiusMeters: ISSY_P2_JUNCTION.radiusMeters,
          flagship: selectedPilotId === "issy-p1" || selectedPilotId === "issy-p3",
        });
      };
      const kpiDefinition = getKpiDefinition(selectedKpi);
      const spatialPlan = resolveSpatialRenderPlan(cityName, selectedKpi, {
        junctionStudy: issyJunctionStudy,
        pilotId: selectedPilotId,
        scenario,
        runtimeLinkage,
      });
      const renderIntent = resolveRenderIntent(cityName, selectedKpi, {
        junctionStudy: issyJunctionStudy,
        pilotId: selectedPilotId,
      });
      const ensureCityCoverage = (
        sourcePoints: Array<{ lat: number; lon: number; value: number; id: string; properties?: Record<string, any> }>,
        minCount: number = 60,
        fallbackCount: number = 220
      ) => {
        const cityKey = cityName.toLowerCase();
        const observedCount = sourcePoints.filter(
          (p) =>
            p.properties?.dataOrigin !== "coverage-fallback" &&
            p.properties?.type !== "mock" &&
            p.properties?.dataOrigin !== "mock"
        ).length;
        const usesObservedOnly =
          cityKey.includes("copenhagen") || cityKey.includes("zaragoza") || cityKey.includes("trikala");
        const minRequired = usesObservedOnly ? Math.max(sourcePoints.length, 1) : minCount;
        if (sourcePoints.length >= minRequired && (usesObservedOnly || observedCount >= minCount)) {
          return sourcePoints;
        }
        if (usesObservedOnly && sourcePoints.length > 0) return sourcePoints;
        const anchorValue =
          sourcePoints.length > 0
            ? sourcePoints.reduce((sum, point) => sum + point.value, 0) / sourcePoints.length
            : cityData.kpiData[selectedKpi]?.mainValue || 50;
        const synthetic = generateHexbinData(cityData, selectedKpi, fallbackCount).map((point) => ({
          ...point,
          value: Math.max(0, Math.min(100, anchorValue * 0.72 + point.value * 0.28)),
          properties: {
            dataOrigin: "coverage-fallback",
            type: "mock",
          },
        }));
        return [...sourcePoints, ...synthetic];
      };

      // Issy junction observatory — dispatch via spatialLayerRegistry render plan
      if (issyJunctionStudy && spatialPlan.rendererId.startsWith("issy-")) {
        setMilanLayerQa(null);
        const jLat = ISSY_P2_JUNCTION.lat;
        const jLon = ISSY_P2_JUNCTION.lon;

        const emitJunctionObservatory = (detail: {
          segmentId: string;
          segmentName: string;
          speed: number | null;
          congestion: number | null;
        }) => {
          onSegmentFocus?.({
            segmentName: detail.segmentName,
            speed: detail.speed,
            congestion: detail.congestion,
          });
          onJunctionSegmentClickRef.current?.(detail);
        };

        const junctionTrafficRows =
          trafficData?.results?.length
            ? filterMapSegmentsNearJunction(dedupeTrafficBySegmentId(trafficData.results))
            : [];

        const wireJunctionFeatureClicks = () => {
          if (!junctionTrafficRows.length || !mapRef.current) return;
          const map = mapRef.current;
          for (const layer of issyLayerRefs.circles) {
            if (!layer.options.interactive) continue;
            const ll = layer.getLatLng();
            bindJunctionObservatoryLayer(
              layer,
              map,
              junctionTrafficRows,
              emitJunctionObservatory,
              ll.lat,
              ll.lng,
              segmentHandlers
            );
          }
          for (const layer of issyLayerRefs.polygons) {
            const center = layer.getBounds().getCenter();
            bindJunctionObservatoryLayer(
              layer,
              map,
              junctionTrafficRows,
              emitJunctionObservatory,
              center.lat,
              center.lng,
              segmentHandlers
            );
          }
        };

        if (selectedKpi === "kpi3.2") {
          renderIssyClimateHexField(mapRef.current!, jLat, jLon, issyLayerRefs, {
            rings: 3,
            cellSizeM: 44,
            kpiRow: cityData.kpiData["kpi3.2"],
            kpi32Year: kpi32SelectedYear,
            filterRange,
            scenario,
            segmentHandlers,
            selectedSegmentId: selectedJunctionSegmentId,
            classeur: issyClasseur,
          });
          return;
        }

        if (selectedKpi === "kpi3.1") {
          renderIssyFacilityLayers(
            mapRef.current!,
            cyclingInfrastructureForMap?.results ?? [],
            issyLayerRefs,
            {
              filterRange,
              categoryFocus: infrastructureCategoryFocus,
              segmentHandlers,
            }
          );
          addIssyInfluenceField();
          wireJunctionFeatureClicks();
          addInterventionLayer(cityData, showInterventionLayer, true);
          return;
        }

        if (selectedKpi === "kpi4.1") {
          const issySentimentMock = getIssySentimentMock(selectedPilotId);
          renderIssySentimentField(mapRef.current!, cityData, issyLayerRefs, {
            localPoints: localCityPoints?.map((p) => ({
              lat: p.lat,
              lon: p.lon,
              value: p.value,
              id: p.id,
            })),
            filterRange,
            segmentHandlers,
            selectedSegmentId: selectedJunctionSegmentId,
            mockProfile: issySentimentMock,
          });
          addIssyInfluenceField();
          wireJunctionFeatureClicks();
          addInterventionLayer(cityData, showInterventionLayer, true);
          return;
        }

        if (selectedKpi === "kpi4.2") {
          const issyA11yMock = getIssyAccessibilityMock(selectedPilotId);
          renderIssyAccessibilityField(
            mapRef.current!,
            jLat,
            jLon,
            issyLayerRefs,
            issyA11yMock?.reachScore ?? cityData.kpiData["kpi4.2"]?.mainValue ?? 55,
            {
              filterRange,
              segmentHandlers,
              selectedSegmentId: selectedJunctionSegmentId,
              mockProfile: issyA11yMock,
            }
          );
          addIssyInfluenceField();
          wireJunctionFeatureClicks();
          addInterventionLayer(cityData, showInterventionLayer, true);
          return;
        }

        if (selectedKpi === "kpi1.2" || selectedKpi === "kpi2.1") {
          if (junctionTrafficRows.length > 0) {
            const issyK32Intensity =
              selectedKpi === "kpi3.2"
                ? getKpi32TimeSeriesIntensity(cityData.kpiData["kpi3.2"], kpi32SelectedYear)
                : null;
            const issyEnvScale =
              issyK32Intensity != null ? issyK32Intensity / 100 : 1;
            const roadSegments = trafficSegmentsToSegments(junctionTrafficRows, selectedKpi).map(
              (seg) => ({
                ...seg,
                value: Math.min(100, seg.value * issyEnvScale),
              })
            );

            renderIssyJunctionArms(
              mapRef.current!,
              roadSegments,
              selectedKpi,
              issyLayerRefs,
              {
                onObservatoryClick: emitJunctionObservatory,
                selectedSegmentId: selectedJunctionSegmentId,
                scenario,
                filterRange,
                onSegmentHover,
                segmentHandlers,
                modeAccent:
                  selectedKpi === "kpi1.2"
                    ? resolveJunctionModeAccent(selectedModeTypes)
                    : undefined,
              }
            );

            addIssyInfluenceField();
          }
          addInterventionLayer(cityData, showInterventionLayer, issyJunctionStudy);
          return;
        }

        addInterventionLayer(cityData, showInterventionLayer, issyJunctionStudy);
        return;
      }

      // Issy KPI1.2 city view: zone-to-zone flows (not used at junction study pilots)
      if (
        isIssy &&
        selectedKpi === "kpi1.2" &&
        issyFlows &&
        issyFlows.length > 0 &&
        !issyJunctionStudy
      ) {
        setMilanLayerQa(null);
        const isSustainableMode = (mode: string) => {
          const c = mode.toLowerCase();
          return (
            c.includes("bicycle") ||
            c.includes("cycl") ||
            c.includes("bike") ||
            c.includes("person") ||
            c.includes("pedestrian") ||
            c.includes("bus") ||
            c.includes("transit")
          );
        };

        const modeColor = (mode: string) => {
          const lower = mode.toLowerCase();
          if (lower.includes("bicycle")) return "#10B981";
          if (lower.includes("pedestrian")) return "#38BDF8";
          if (lower.includes("car")) return "#8578C3";
          if (lower.includes("bus")) return "#657DF5";
          return "#96C2EF";
        };

        getIssyZoneCentroids().forEach((zone) => {
          const zoneMarker = L.circleMarker([zone.lat, zone.lon], {
            radius: 7,
            fillColor: "#A78BFA",
            fillOpacity: 0.35,
            color: "#DDD6FE",
            weight: 1.4,
            opacity: 0.9,
          }).addTo(mapRef.current!);
          const geomNote = zone.layoutApproximation
            ? `<p style="font-size: 9px; color: #96C2EF; margin: 4px 0 0 0;">Pins are spaced for readable OD arcs (~Issy centre). Swap in official zoning polygons when available.</p>`
            : "";
          zoneMarker.bindPopup(`
            <div style="font-family: 'DM Sans', sans-serif; padding: 6px; min-width: 130px;">
              <p style="font-size: 10px; color: #2F1B6D; margin: 0 0 3px 0; font-weight: 700;">Data Quality</p>
              <div style="margin-bottom: 4px;">${badge("Observed")}${badge("Zone OD")}${badge("CSV")}</div>
              <p style="font-size: 11px; color: #8578C3; margin: 0 0 4px 0; text-transform: uppercase;">Issy zone ${zone.zone}</p>
              <p style="font-size: 10px; color: #96C2EF; margin: 0;">${zone.label}</p>
              ${geomNote}
            </div>
          `);
          circlesRef.current.push(zoneMarker);
        });

        const reverseFlowSet = new Set<string>();
        issyFlows.forEach((f) => {
          if (f.baselineValue > 0 || f.interventionValue > 0) {
            reverseFlowSet.add(`${f.fromZone}|${f.toZone}|${f.vehicleCategory}`);
          }
        });

        let rankedFlows = issyFlows
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
            const reverseObserved = reverseFlowSet.has(
              `${flow.toZone}|${flow.fromZone}|${flow.vehicleCategory}`
            );
            return { ...flow, from, to, renderValue, reverseObserved };
          })
          .filter((flow): flow is NonNullable<typeof flow> => !!flow)
          .filter((flow) => flow.renderValue >= 0.5);

        if (!areAllTravelModesSelected(selectedModeTypes)) {
          rankedFlows = rankedFlows.filter((flow) =>
            selectedModeTypes.some((mode) => travelModeMatchesIssyVehicleCategory(mode, flow.vehicleCategory))
          );
        }

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

          const reverseLine = flow.reverseObserved
            ? `<p style="font-size: 9px; color: #96C2EF; margin-top: 4px;">Reverse leg (zone ${flow.toZone} → zone ${flow.fromZone}) is also present in the dataset and rendered separately.</p>`
            : `<p style="font-size: 9px; color: #A78BFA; margin-top: 4px;">No reverse record (zone ${flow.toZone} → zone ${flow.fromZone}) in the dataset — reverse movement is not inferred.</p>`;

          const tooltip = `
            <div style="font-family: 'DM Sans', sans-serif; padding: 8px; min-width: 200px;">
              <p style="font-size: 10px; color: #2F1B6D; margin: 0 0 3px 0; font-weight: 700;">Data Quality</p>
              <div style="margin-bottom: 4px;">${badge("Observed")}${badge("Zone-flow")}${badge("Directional")}${badge("CSV")}</div>
              <p style="font-size: 11px; color: #8578C3; margin: 0 0 4px 0; text-transform: uppercase;">Issy Zone OD Flow</p>
              <p style="font-size: 10px; color: #96C2EF; margin: 0;">Mode: ${flow.vehicleCategory}</p>
              <p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Direction: zone ${flow.fromZone} → zone ${flow.toZone}</p>
              <p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Baseline avg: ${flow.baselineValue.toFixed(2)}</p>
              <p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Post avg: ${flow.interventionValue.toFixed(2)}</p>
              <p style="font-size: 11px; font-weight: 700; color: ${flow.change >= 0 ? "#22C55E" : "#A78BFA"}; margin-top: 4px;">
                Change: ${flow.change >= 0 ? "+" : ""}${flow.change.toFixed(2)} (${flow.changePercent.toFixed(1)}%)
              </p>
              ${reverseLine}
              <p style="font-size: 9px; color: #A78BFA; margin-top: 4px; line-height: 1.35;">${ISSY_OD_DIRECTIONAL_NOTE}</p>
              <p style="font-size: 9px; color: #A78BFA; margin-top: 4px; line-height: 1.35;">${ISSY_OD_CSV_DISCLAIMER}</p>
            </div>
          `;
          line.bindPopup(tooltip);
          directionDot.bindPopup(tooltip);
          if (segmentHandlers) {
            const flowDetail = {
              segmentId: `issy-od:${flow.fromZone}->${flow.toZone}:${flow.vehicleCategory}`,
              segmentName: `Zone ${flow.fromZone} → ${flow.toZone} · ${flow.vehicleCategory}`,
              speed: null as number | null,
              congestion: null as number | null,
            };
            wirePolylineSegment(line, flowDetail, segmentHandlers, {
              baseStyle: {
                color,
                weight: thickness,
                opacity: scenario === "comparison" ? Math.min(0.72, 0.42 + thickness * 0.05) : 0.74,
              },
              highlightStyle: { weight: thickness + 2.5, opacity: 0.95 },
              selectedSegmentId: selectedJunctionSegmentId,
            });
            wireCircleMarkerSegment(directionDot, flowDetail, segmentHandlers, {
              baseRadius: Math.max(3, Math.min(7, thickness * 0.55)),
              highlightRadius: Math.max(5, Math.min(9, thickness * 0.65)),
              selectedSegmentId: selectedJunctionSegmentId,
            });
          }
          polylinesRef.current.push(line);
          circlesRef.current.push(directionDot);
        });

        addInterventionLayer(cityData, showInterventionLayer);
        return;
      }

      if (isIssy && selectedKpi === "kpi3.2") {
        setMilanLayerQa(null);
        renderIssyClimateHexField(mapRef.current!, ISSY_P2_JUNCTION.lat, ISSY_P2_JUNCTION.lon, issyLayerRefs, {
          rings: 3,
          cellSizeM: 44,
          kpiRow: cityData.kpiData["kpi3.2"],
          kpi32Year: kpi32SelectedYear,
          filterRange,
          scenario,
          segmentHandlers,
          selectedSegmentId: selectedJunctionSegmentId,
          classeur: issyClasseur,
        });
        return;
      }

      if (isIssy && selectedKpi === "kpi3.1") {
        setMilanLayerQa(null);
        renderIssyFacilityLayers(
          mapRef.current!,
          cyclingInfrastructureForMap?.results ?? [],
          issyLayerRefs,
          {
            filterRange,
            categoryFocus: infrastructureCategoryFocus,
            segmentHandlers,
          }
        );
        addIssyInfluenceField();
        return;
      }

      if (isIssy && selectedKpi === "kpi4.1") {
        setMilanLayerQa(null);
        const issySentimentMock = getIssySentimentMock(selectedPilotId);
        renderIssySentimentField(mapRef.current!, cityData, issyLayerRefs, {
          localPoints: localCityPoints?.map((p) => ({
            lat: p.lat,
            lon: p.lon,
            value: p.value,
            id: p.id,
          })),
          filterRange,
          segmentHandlers,
          selectedSegmentId: selectedJunctionSegmentId,
          mockProfile: issySentimentMock,
        });
        addIssyInfluenceField();
        return;
      }

      if (isIssy && selectedKpi === "kpi4.2") {
        setMilanLayerQa(null);
        const issyA11yMock = getIssyAccessibilityMock(selectedPilotId);
        renderIssyAccessibilityField(
          mapRef.current!,
          ISSY_P2_JUNCTION.lat,
          ISSY_P2_JUNCTION.lon,
          issyLayerRefs,
          issyA11yMock?.reachScore ?? cityData.kpiData["kpi4.2"]?.mainValue ?? 55,
          {
            filterRange,
            segmentHandlers,
            selectedSegmentId: selectedJunctionSegmentId,
            mockProfile: issyA11yMock,
          }
        );
        addIssyInfluenceField();
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
          if (milanPilotId === "mil-p3" && mapRef.current) {
            const gapIcon = L.divIcon({
              className: "milan-gap-marker",
              html: `<div style="font-family:'DM Sans',sans-serif;padding:10px 12px;border-radius:10px;background:rgba(20,20,35,0.92);color:#e2e8f0;border:1px solid rgba(148,163,184,0.5);max-width:220px;font-size:11px;line-height:1.35;"><strong>Pilot 3 — segment data unavailable</strong><br/>Speed shapefiles are not published for this pilot yet. KPI readiness matrix marks mil-p3 as limited — do not infer synthetic segments.</div>`,
              iconSize: [220, 72],
              iconAnchor: [110, 36],
            });
            const gapMarker = L.marker([45.44, 9.19], { icon: gapIcon, interactive: true }).addTo(mapRef.current);
            markersRef.current.push(gapMarker);
          }
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
          const segmentName = String(props.streetName || segment.id);
          const avgSpeed = Number(props.avgSpeed || 0);
          const baseStyle = {
            color: highlight.color,
            weight: highlight.weight,
            opacity: highlight.opacity,
            lineJoin: "round" as const,
            lineCap: "round" as const,
          };
          line.bindPopup(`
            <div style="font-family: 'DM Sans', sans-serif; padding: 8px; min-width: 170px;">
              <p style="font-size: 10px; color: #2F1B6D; margin: 0 0 3px 0; font-weight: 700;">Data Quality</p>
              <div style="margin-bottom: 4px;">${badge("Matched")}${badge("Observed")}${badge("Segment-level")}${badge("2024 snapshot")}</div>
              <p style="font-size: 11px; color: #8578C3; margin: 0 0 4px 0; text-transform: uppercase;">Milan Speed Segment</p>
              <p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">City: Milan</p>
              <p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Pilot: ${milanPilotId.toUpperCase()}</p>
              <p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">KPI: KPI2.1 Road User Safety</p>
              <p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Street: ${segmentName}</p>
              <p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Avg speed: ${avgSpeed.toFixed(1)} km/h</p>
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
          if (segmentInteractionEnabled) {
            wirePolylineSegment(
              line,
              {
                segmentId: segment.id,
                segmentName,
                speed: avgSpeed,
                congestion: Math.min(1, segment.value / 100),
              },
              segmentHandlers,
              {
                baseStyle,
                selectedSegmentId: selectedJunctionSegmentId,
                focusDim: 0.28,
              }
            );
          }
          polylinesRef.current.push(line);
          renderedCount += 1;
        });
        const joinPct = milanSpeedSegments.stats.cameraJoinRatePct;
        setMilanLayerQa({
          layer: "safety",
          parsed: milanSpeedSegments.stats.parsedSegments,
          rendered: renderedCount,
          missingJoins: milanSpeedSegments.stats.missingMetricJoins,
          invalidGeometry: milanSpeedSegments.stats.invalidGeometries,
          avgValue: milanSpeedSegments.stats.avgMetricValue,
          dataConfidence: milanSpeedSegments.dataConfidence,
          statusMessage:
            joinPct != null
              ? `${milanSpeedSegments.statusMessage || ""} Camera join rate: ${joinPct}%.`.trim()
              : milanSpeedSegments.statusMessage,
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
        const milanK32Intensity = getKpi32TimeSeriesIntensity(cityData.kpiData["kpi3.2"], kpi32SelectedYear);
        const milanYearScale = milanK32Intensity != null ? milanK32Intensity / 100 : 1;
        const allValues = milanEnvironmentSegments.records.map((record) => record.value * milanYearScale);
        const lowThreshold = getQuantile(allValues, 0.15);
        const highThreshold = getQuantile(allValues, 0.85);
        let renderedCount = 0;
        milanEnvironmentSegments.records.forEach((segment) => {
          const scaledValue = segment.value * milanYearScale;
          const highlight = getSegmentHighlight(scaledValue, lowThreshold, highThreshold);
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
              ${
                kpi32SelectedYear && milanK32Intensity != null
                  ? `<p style="font-size: 9px; color: #A78BFA; margin-top: 4px; font-weight: 600;">KPI chart ${kpi32SelectedYear}: stress scaled ×${milanYearScale.toFixed(2)} (${milanK32Intensity.toFixed(1)}% series intensity).</p>`
                  : ""
              }
              <p style="font-size: 9px; color: #96C2EF; margin-top: 6px;">Source: Milan RETE_H08/H18 network shapefile</p>
              <p style="font-size: 9px; color: #96C2EF; margin-top: 2px;">Metric: Derived environmental pressure proxy</p>
              <p style="font-size: 9px; color: #96C2EF; margin-top: 2px;">Geometry: LineString segment</p>
              <p style="font-size: 9px; color: #96C2EF; margin-top: 2px;">Spatial: matched</p>
              <p style="font-size: 9px; color: #96C2EF; margin-top: 2px;">Confidence: ${milanEnvironmentSegments.dataConfidence}</p>
            </div>
          `);
          const segmentName = String(props.streetName || segment.id);
          const baseStyle = {
            color: highlight.color,
            weight: highlight.weight,
            opacity: highlight.opacity,
            lineJoin: "round" as const,
            lineCap: "round" as const,
          };
          if (segmentInteractionEnabled) {
            wirePolylineSegment(
              line,
              {
                segmentId: segment.id,
                segmentName,
                speed: null,
                congestion: scaledValue / 100,
              },
              segmentHandlers,
              {
                baseStyle,
                selectedSegmentId: selectedJunctionSegmentId,
                focusDim: 0.28,
              }
            );
          }
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
        const roadSegments = trafficSegmentsToSegments(trafficData.results, selectedKpi);
        const issyK32Intensity =
          selectedKpi === "kpi3.2" ? getKpi32TimeSeriesIntensity(cityData.kpiData["kpi3.2"], kpi32SelectedYear) : null;
        const issyEnvScale = issyK32Intensity != null ? issyK32Intensity / 100 : 1;
        const values = roadSegments.map((segment) => segment.value * issyEnvScale);
        const lowThreshold = getQuantile(values, 0.15);
        const highThreshold = getQuantile(values, 0.85);
        
        const segmentMetric = selectedKpi === "kpi3.2" ? "climate" : "safety";
        let renderedCount = 0;
        roadSegments.forEach((segment) => {
          const scaledValue = segment.value * issyEnvScale;
          const highlight = getSegmentHighlight(
            scaledValue,
            lowThreshold,
            highThreshold,
            segmentMetric
          );

          // Use LineString geometry from geo_shape (the real road segment)
          if (!segment.coordinates || segment.coordinates.length < 2) {
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
              <p style="font-size: 11px; color: #8578C3; margin: 0 0 4px 0; text-transform: uppercase;">${
                selectedKpi === "kpi3.2"
                  ? "Environmental pressure (segment)"
                  : "Road safety (segment)"
              }</p>
              <p style="font-size: 10px; color: #96C2EF; margin: 0 0 4px 0; font-weight: 600;">Segment: ${segment.id}</p>
              <p style="font-size: 18px; font-weight: bold; color: #2F1B6D; margin: 0 0 6px 0;">${scaledValue.toFixed(1)}%</p>
              ${
                selectedKpi === "kpi3.2" && kpi32SelectedYear && issyK32Intensity != null
                  ? `<p style="font-size: 9px; color: #A78BFA; margin: 2px 0; font-weight: 600;">KPI chart ${kpi32SelectedYear}: ×${issyEnvScale.toFixed(2)} (${issyK32Intensity.toFixed(1)}% intensity); raw segment ${segment.value.toFixed(1)}%.</p>`
                  : ""
              }
              ${props.vitesse_km_h ? `<p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Speed: ${props.vitesse_km_h.toFixed(1)} km/h</p>` : ''}
              ${props.indice_de_congestion ? `<p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Congestion index: ${props.indice_de_congestion.toFixed(2)}</p>` : ''}
              ${props.distance_metres ? `<p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Observed length: ${(props.distance_metres / 1000).toFixed(2)} km</p>` : ''}
              <p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Band: ${highlight.band}</p>
              <p style="font-size: 9px; color: #96C2EF; margin-top: 6px;">${kpiDefinition?.dataLabel || "Observed"} data</p>
            </div>
          `;
          
          polyline.bindPopup(popupContent);
          const segName = `Road ${segment.id}`;
          const baseStyle = {
            color: highlight.color,
            weight: highlight.weight,
            opacity: highlight.opacity,
            lineJoin: "round" as const,
            lineCap: "round" as const,
          };
          wirePolylineSegment(
            polyline,
            {
              segmentId: segment.id,
              segmentName: segName,
              speed: props.vitesse_km_h ?? null,
              congestion: props.indice_de_congestion ?? null,
            },
            segmentHandlers,
            { baseStyle, selectedSegmentId: selectedJunctionSegmentId }
          );
          polyline.bindTooltip(
            `Segment: ${segment.id}<br/>Speed: ${(props.vitesse_km_h ?? 0).toFixed(1)} km/h<br/>Congestion index: ${(props.indice_de_congestion ?? 0).toFixed(2)}`,
            { sticky: true, direction: "top", opacity: 0.9 }
          );
          polylinesRef.current.push(polyline);
          renderedCount++;
        });
        if (import.meta.env.DEV) {
          console.debug(`[HeroMap] Rendered ${renderedCount} traffic segments on map`);
        }
        // Live segment geometry is authoritative — do not also draw hex/area scaffolding on top.
        if (ISSY_SEGMENT_KPIS.includes(selectedKpi)) {
          addInterventionLayer(cityData, showInterventionLayer);
          return;
        }
      } else if (
        import.meta.env.DEV &&
        shouldRenderIssySegments &&
        !isLoadingTraffic &&
        (!trafficData?.results || trafficData.results.length === 0)
      ) {
        console.debug("[HeroMap] No traffic data available for Issy segment layer", {
          error: trafficError,
          cityName,
        });
      }

      const issySafetySegmentDataMissing =
        isIssy &&
        shouldRenderIssySegments &&
        selectedKpi === "kpi2.1" &&
        (!trafficData?.results || trafficData.results.length === 0);

      const isCopenhagenCity = currentCity.toLowerCase().includes("copenhagen");
      if (isCopenhagenCity && !isCopenhagenCameraKpi(selectedKpi)) {
        addInterventionLayer(cityData, showInterventionLayer);
        return;
      }
      if (isCopenhagenCity && isCopenhagenCameraKpi(selectedKpi)) {
        addInterventionLayer(cityData, showInterventionLayer);
        const pilotCameraIds = getCopenhagenCameraIdsForPilot(selectedPilotId);
        const allObservedPoints = (localCityPoints || []).filter(
          (p) => p.properties?.dataOrigin === "local-city-dataset"
        );
        const observedPoints =
          selectedKpi === "kpi4.2"
            ? allObservedPoints.filter((p) => p.properties?.datasetKind === "accessibility")
            : allObservedPoints;
        const cphDiagnostics = getLocalCityDiagnostics("Copenhagen", selectedKpi, selectedPilotId);
        if (observedPoints.length === 0) {
          const recordsLabel =
            selectedKpi === "kpi4.2"
              ? "No EN 17210 accessibility audit — CPHK2 shows infrastructure proxy from parking inventory when selected."
              : cphDiagnostics?.reason === "files-unavailable"
                ? "Observed directional source unavailable"
                : cphDiagnostics?.reason === "pilot-scope-empty"
                  ? "No observed directional mobility records for the selected configuration."
                  : "No observed directional mobility records for the selected configuration.";
          const temporalCoverage =
            selectedKpi === "kpi4.2"
              ? "documentation"
              : cphDiagnostics?.reason === "files-unavailable"
                ? "source unavailable"
                : "before-after";
          onDataQualitySummaryChange?.({
            recordsLabel,
            spatialQuality:
              selectedKpi === "kpi4.2"
                ? "parking inventory proxy (derived)"
                : "exact OpenTrafficCam coordinates",
            dataType:
              selectedKpi === "kpi4.2"
                ? "derived accessibility infrastructure proxy"
                : "observed directional camera counts",
            temporalCoverage,
            confidence: cphDiagnostics?.reason === "files-unavailable" ? "Low" : "Medium",
            provenanceType: selectedKpi === "kpi4.2" ? "derived" : "observed",
            geometryLinkage: selectedKpi === "kpi4.2" ? "matched" : "exact",
            spatialSystemHint:
              selectedKpi === "kpi4.2"
                ? "Parking bay before/after categories — not a formal accessibility audit."
                : "Observed directional mobility count points only.",
          });
          if (selectedKpi === "kpi4.2" && cphParkingGeo?.features?.length) {
            renderCopenhagenMapLayers({
              map: mapRef.current!,
              pilotId: selectedPilotId,
              observedPoints: [],
              scenario,
              selectedSegmentId: activeMapSegmentId,
              segmentHandlers,
              getValueColor,
              selectedKpi,
              markersOut: markersRef.current,
              circlesOut: circlesRef.current,
              polylinesOut: polylinesRef.current,
              polygonsOut: polygonsRef.current,
              circlesInfluenceOut: circlesRef.current,
              showPilotField: showInterventionLayer,
              wireCircleMarker: wireCircleMarkerSegment,
              parkingGeoJson: cphParkingGeo,
              streetsGeoJson: cphStreetsGeo,
            });
          }
          return;
        }
        const modeSelected = selectedModeTypes?.length ? selectedModeTypes : [];
        const strictModeFilterActive =
          modeSelected.length > 0 && !areAllTravelModesSelected(modeSelected);
        const selectedCountFromBreakdown = (breakdown: any): number => {
          const bike = Number(breakdown?.bike ?? 0);
          const pedestrian = Number(breakdown?.pedestrian ?? 0);
          const motorised = Number(breakdown?.motorised ?? 0);
          const ptw = Number(breakdown?.ptw ?? 0);
          if (!strictModeFilterActive) return bike + pedestrian;
          let selected = 0;
          if (modeSelected.includes("Cycle")) selected += bike;
          if (modeSelected.includes("Pedestrian")) selected += pedestrian;
          if (modeSelected.includes("Private Car") || modeSelected.includes("Public Transport")) {
            selected += motorised;
          }
          if (modeSelected.includes("PTW")) selected += ptw;
          return selected;
        };
        const recomputeKpi12Pct = (breakdown: any): number => {
          const total = Number(breakdown?.total ?? 0);
          if (total <= 0) return 0;
          const selected = selectedCountFromBreakdown(breakdown);
          return (selected / total) * 100;
        };
        if (
          strictModeFilterActive &&
          !observedPoints.some((point) => {
            const modeBreakdown = point.properties?.modeBreakdown as
              | { pre: { bike: number; pedestrian: number; motorised: number; ptw: number; total: number }; post: { bike: number; pedestrian: number; motorised: number; ptw: number; total: number } }
              | undefined;
            if (!modeBreakdown) return false;
            return (
              selectedCountFromBreakdown(modeBreakdown.pre) > 0 ||
              selectedCountFromBreakdown(modeBreakdown.post) > 0
            );
          })
        ) {
          onDataQualitySummaryChange?.({
            recordsLabel: "No observed directional mobility records for the selected configuration.",
            spatialQuality: "exact OpenTrafficCam coordinates",
            dataType: "observed directional camera counts",
            temporalCoverage: "before-after",
            confidence: "High",
            provenanceType: "observed",
            geometryLinkage: "exact",
            spatialSystemHint: "Mode filter currently excludes all observed directional rows.",
          });
          return;
        }

        const scopedObservedPoints =
          selectedKpi === "kpi4.2"
            ? observedPoints
            : pilotCameraIds
              ? observedPoints.filter((point) => {
                  const key = inferOtcWorkbookKey(String(point.properties?.streetName ?? ""));
                  return key != null && pilotCameraIds.has(key);
                })
              : observedPoints;

        const flowPoints = scopedObservedPoints
          .map((point) => {
            const props = point.properties || {};
            const modeBreakdown = props.modeBreakdown as
              | {
                  pre: { bike: number; pedestrian: number; motorised: number; ptw: number; total: number };
                  post: { bike: number; pedestrian: number; motorised: number; ptw: number; total: number };
                }
              | undefined;
            let baselineValue = Number(props.baselineValue ?? point.value ?? 0);
            let interventionValue = Number(props.interventionValue ?? point.value ?? 0);
            if (selectedKpi === "kpi1.2" && modeBreakdown) {
              baselineValue = recomputeKpi12Pct(modeBreakdown.pre);
              interventionValue = recomputeKpi12Pct(modeBreakdown.post);
            }
            const comparisonValue =
              typeof props.comparisonValue === "number"
                ? Number(props.comparisonValue)
                : interventionValue - baselineValue;
            const renderValue =
              scenario === "baseline"
                ? baselineValue
                : scenario === "comparison"
                  ? comparisonValue
                  : interventionValue;
            const compareValue = scenario === "comparison" ? Math.abs(renderValue) : renderValue;
            return {
              point,
              compareValue,
              baselineValue,
              interventionValue,
              comparisonValue,
            };
          })
          .filter(
            ({ compareValue }) => compareValue >= filterRange[0] && compareValue <= filterRange[1]
          )
          .map(({ point, baselineValue, interventionValue, comparisonValue }) => ({
            lat: point.lat,
            lon: point.lon,
            id: point.id,
            value: point.value,
            properties: {
              ...(point.properties || {}),
              baselineValue,
              interventionValue,
              comparisonValue,
            },
          }));

        renderCopenhagenMapLayers({
          map: mapRef.current!,
          pilotId: selectedPilotId,
          observedPoints: flowPoints,
          scenario,
          selectedSegmentId: activeMapSegmentId,
          segmentHandlers,
          getValueColor,
          selectedKpi,
          modeFilterLabel: strictModeFilterActive
            ? modeSelected.join(", ")
            : "Active mobility (bike + pedestrian)",
          markersOut: markersRef.current,
          circlesOut: circlesRef.current,
          polylinesOut: polylinesRef.current,
          polygonsOut: polygonsRef.current,
          circlesInfluenceOut: circlesRef.current,
          showPilotField: showInterventionLayer,
          wireCircleMarker: wireCircleMarkerSegment,
          parkingGeoJson: cphParkingGeo,
          streetsGeoJson: cphStreetsGeo,
        });

        return;
      }

      if (cityName.toLowerCase().includes("copenhagen") && selectedKpi === "kpi1.2") {
        const countValueBySite = new Map<string, { baseline?: number; intervention?: number; comparison?: number }>();
        (localCityPoints ?? []).forEach((point) => {
          const siteName = String(point.properties?.streetName ?? point.properties?.siteName ?? "");
          const siteKey = resolveCopenhagenSiteKey(siteName);
          if (!siteKey) return;
          const existing = countValueBySite.get(siteKey) ?? {};
          const baseline =
            typeof point.properties?.baselineValue === "number"
              ? Number(point.properties.baselineValue)
              : undefined;
          const intervention =
            typeof point.properties?.interventionValue === "number"
              ? Number(point.properties.interventionValue)
              : undefined;
          const comparison =
            typeof point.properties?.comparisonValue === "number"
              ? Number(point.properties.comparisonValue)
              : intervention !== undefined && baseline !== undefined
                ? intervention - baseline
                : undefined;
          countValueBySite.set(siteKey, {
            baseline: existing.baseline ?? baseline,
            intervention: existing.intervention ?? intervention,
            comparison: existing.comparison ?? comparison,
          });
        });

        void loadCopenhagenCountSitesGeoJson().then((geojson) => {
          if (!mapRef.current) return;
          geojson.features.forEach((feature) => {
            const coordinates = feature.geometry.coordinates as [number, number];
            const source = String(feature.properties.source || "manual").toLowerCase();
            const isOtc = source === "otc";
            const marker = L.circleMarker([coordinates[1], coordinates[0]], {
              radius: isOtc ? 8 : 6.5,
              fillColor: isOtc ? "#00ffff" : "#f59e0b",
              fillOpacity: isOtc ? 0.86 : 0.74,
              color: isOtc ? "#cffafe" : "#fde68a",
              weight: 1.5,
              opacity: 0.98,
            }).addTo(mapRef.current!);

            const siteName = String(feature.properties.name ?? "Copenhagen count site");
            marker.bindTooltip(siteName, {
              direction: "top",
              opacity: 1,
              className: "tri-segment-tooltip",
            });
            const siteKey = resolveCopenhagenSiteKey(siteName);
            const observed = siteKey ? countValueBySite.get(siteKey) : undefined;
            const observedHtml =
              observed && (observed.baseline !== undefined || observed.intervention !== undefined)
                ? `
                  ${observed.baseline !== undefined ? `<p style="font-size:10px;color:#96C2EF;margin:2px 0;">Baseline: ${observed.baseline.toFixed(1)}%</p>` : ""}
                  ${observed.intervention !== undefined ? `<p style="font-size:10px;color:#96C2EF;margin:2px 0;">Intervention: ${observed.intervention.toFixed(1)}%</p>` : ""}
                  ${observed.comparison !== undefined ? `<p style="font-size:10px;color:${observed.comparison >= 0 ? "#22C55E" : "#F97316"};margin:2px 0;">Δ ${observed.comparison >= 0 ? "+" : ""}${observed.comparison.toFixed(1)}%</p>` : ""}
                `
                : `<p style="font-size:10px;color:#96C2EF;margin:2px 0;">Monitored location</p>`;

            marker.bindPopup(`
              <div style="font-family:'DM Sans',sans-serif;padding:8px;min-width:180px;">
                <p style="font-size:10px;color:#8578C3;margin:0 0 4px 0;text-transform:uppercase;">Copenhagen count site</p>
                <p style="font-size:14px;font-weight:700;color:#2F1B6D;margin:0 0 6px 0;">${siteName}</p>
                <p style="font-size:10px;color:#96C2EF;margin:0 0 4px 0;">Source: ${isOtc ? "OpenTrafficCam" : "Manual counting"}</p>
                ${observedHtml}
              </div>
            `);
            circlesRef.current.push(marker);
          });
        });
        addInterventionLayer(cityData, showInterventionLayer);
        return;
      }

      if (cityName.toLowerCase().includes("helsinki") && selectedKpi === "kpi2.1") {
        void Promise.all([
          loadHelsinkiDangerousLocationsGeoJson(),
          loadHelsinkiInterventionLocationsGeoJson(),
        ]).then(([dangerousGeoJson, interventionGeoJson]) => {
          if (!mapRef.current) return;
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
            }).addTo(mapRef.current!);
            circlesRef.current.push(marker);
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
          }).addTo(mapRef.current!);
          if (interventionLayer instanceof L.LayerGroup) {
            interventionLayer.eachLayer((member) => {
              if (member instanceof L.Polygon) polygonsRef.current.push(member);
            });
          }

          const viikki = L.circleMarker([60.224599, 25.017236], {
            radius: selectedPilotId === "hel-p3" ? 12 : 10,
            fillColor: "#2ecc71",
            fillOpacity: 0.92,
            color: "#dcfce7",
            weight: 2.5,
            opacity: 1,
          }).addTo(mapRef.current!);
          viikki.bindPopup(`
            <div style="font-family:'DM Sans',sans-serif;padding:8px;min-width:180px;">
              <p style="font-size:10px;color:#8578C3;margin:0 0 4px 0;text-transform:uppercase;">Viikki anchor</p>
              <p style="font-size:14px;font-weight:700;color:#2F1B6D;margin:0 0 6px 0;">Intersection safety at Viikki</p>
              <p style="font-size:10px;color:#96C2EF;margin:0;">Dangerous locations loaded: ${dangerousGeoJson.features.length}</p>
              <p style="font-size:10px;color:#96C2EF;margin:2px 0 0 0;">Intervention markers loaded: ${interventionGeoJson.features.length}</p>
            </div>
          `);
          circlesRef.current.push(viikki);
        });
        addInterventionLayer(cityData, showInterventionLayer);
        return;
      }

      if (cityName.toLowerCase().includes("zaragoza")) {
        void loadZaragozaInterventionAreasGeoJson().then((geojson) => {
          if (!mapRef.current) return;
          const layer = L.geoJSON(geojson as GeoJSON.GeoJsonObject, {
            style: (feature) => {
              const pilotId = String(feature?.properties?.pilotId ?? "");
              const isActive = !!selectedPilotId && pilotId === selectedPilotId;
              return {
                color: isActive ? "#2ecc71" : "#64748b",
                weight: isActive ? 4 : 1.8,
                opacity: isActive ? 0.98 : 0.72,
                fillColor: isActive ? "#22c55e" : "#334155",
                fillOpacity: isActive ? 0.24 : 0.08,
              };
            },
            onEachFeature: (feature, layerItem) => {
              const pilotId = String(feature.properties?.pilotId ?? "zaragoza-area");
              const isActive = !!selectedPilotId && pilotId === selectedPilotId;
              layerItem.bindPopup(`
                <div style="font-family:'DM Sans',sans-serif;padding:8px;min-width:170px;">
                  <p style="font-size:10px;color:#8578C3;margin:0 0 4px 0;text-transform:uppercase;">Zaragoza intervention area</p>
                  <p style="font-size:14px;font-weight:700;color:#2F1B6D;margin:0 0 6px 0;">${pilotId.toUpperCase()}</p>
                  <p style="font-size:10px;color:#96C2EF;margin:0;">${isActive ? "Active pilot highlight" : "Contextual outline"}</p>
                </div>
              `);
              if (layerItem instanceof L.Polygon) {
                if (segmentInteractionEnabled) {
                  wirePolygonSegment(
                    layerItem,
                    {
                      segmentId: pilotId,
                      segmentName: `Zaragoza ${pilotId.toUpperCase()} intervention area`,
                      speed: null,
                      congestion: null,
                    },
                    segmentHandlers,
                    {
                      baseStyle: {
                        color: isActive ? "#2ecc71" : "#64748b",
                        weight: isActive ? 4 : 1.8,
                        opacity: isActive ? 0.98 : 0.72,
                        fillColor: isActive ? "#22c55e" : "#334155",
                        fillOpacity: isActive ? 0.24 : 0.08,
                      },
                      highlightStyle: {
                        weight: 5,
                        opacity: 1,
                        fillOpacity: isActive ? 0.32 : 0.2,
                      },
                      selectedSegmentId: activeMapSegmentId,
                    }
                  );
                }
                polygonsRef.current.push(layerItem);
              }
            },
          }).addTo(mapRef.current);
          if (layer instanceof L.LayerGroup) {
            layer.eachLayer((member) => {
              if (member instanceof L.Polygon && !polygonsRef.current.includes(member)) {
                polygonsRef.current.push(member);
              }
            });
          }
        });
        addInterventionLayer(cityData, showInterventionLayer);
      }

      // Road safety is best represented as clustered hotspots with drill-in zoom.
      // Issy normally expects segment geometry from the traffic API; when it is empty, hotspots + scaled grid fallback read as real "data" rather than an empty map.
      if (
        selectedKpi === "kpi2.1" &&
        !isCopenhagenCity &&
        (renderIntent === "point" || (issySafetySegmentDataMissing && !isIssy))
      ) {
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
              ${
                issySafetySegmentDataMissing
                  ? `<p style="font-size: 9px; color: #A78BFA; margin-top: 6px;">Issy segment API returned no road features — showing demo risk surface (KPI + coverage points).</p>`
                  : ""
              }
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
      if (isPointVisualization(selectedKpi) && !(isIssy && (selectedKpi === "kpi3.1" || selectedKpi === "kpi4.1"))) {
        let points: Array<{ lat: number; lon: number; value: number; id: string; properties?: Record<string, any> }> | undefined;
        
        if (isIssy) {
          if (selectedKpi === "kpi1.2" && bicycleDataForMap?.results && bicycleDataForMap.results.length > 0) {
            // Use bicycle counting data for Mode Share
            points = bicycleCountingToHexbin(bicycleDataForMap.results, selectedKpi);
          } else if (selectedKpi === "kpi3.1" && cyclingInfrastructureForMap?.results && cyclingInfrastructureForMap.results.length > 0) {
            // Use cycling infrastructure data for Green Infrastructure
            points = cyclingInfrastructureToHexbin(cyclingInfrastructureForMap.results, selectedKpi);
          }
          // NOTE: Traffic data should NOT be used here - it should always be rendered as LineString segments above
          // Traffic data lives on roads and must be visualized as polylines, not points
        }

        if (!points && localCityPoints && localCityPoints.length > 0) {
          const scoped = filterPointsInPilotZone(
            localCityPoints,
            cityName,
            selectedPilotId
          );
          points = scoped.map((point) => ({
            ...point,
            properties: {
              ...(point.properties || {}),
              dataOrigin: "local-city-dataset",
            },
          }));
        }

        if (!points) {
          const isCopenhagenKpi42 =
            currentCity.toLowerCase().includes("copenhagen") && selectedKpi === "kpi4.2";
          if (isCopenhagenKpi42 || isMilanInterventionPilot) {
            points = [];
          } else {
            // Generate synthetic points
            points = generateHexbinData(cityData, selectedKpi, 200);
          }
        }
        if (isMilanInterventionPilot) {
          points = filterPointsInPilotZone(points, cityName, milanPilotId);
        }
        if (!isMilanInterventionPilot) {
          points = ensureCityCoverage(points, 55, 220);
        }

        const isCopenhagenCity = currentCity.toLowerCase().includes("copenhagen");
        if (selectedKpi === "kpi1.2") {
          if (isCopenhagenCity && isCopenhagenCameraKpi(selectedKpi)) {
            addInterventionLayer(cityData, showInterventionLayer);
            return;
          }

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
          if (
            selectedKpi === "kpi3.1" &&
            infrastructureCategoryFocus &&
            !infrastructureChartLabelMatchesFeature(props, infrastructureCategoryFocus)
          ) {
            return;
          }
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
          const iconSpec = resolveMapPointIconSpec({
            facilityCategory: props.facilityCategory ?? props.type_amgt_cycl,
            category: props.category,
            datasetKind: props.datasetKind,
            type: props.type_amgt_cycl,
            kind: props.kind,
          });
          const useNeonBadge =
            selectedKpi === "kpi3.1" ||
            iconSpec.key !== "generic" ||
            !!props.dataOrigin ||
            isIssy;

          const dataType = selectedKpi === "kpi1.2" ? "Bicycle Count" : 
                          selectedKpi === "kpi3.1" ? "Cycling Infrastructure" : 
                          "Sensor Data";
          const valueLabel = selectedKpi === "kpi1.2" ? " bikes" : 
                            selectedKpi === "kpi3.1" ? "" : 
                            "%";
          
          const isCph = currentCity.toLowerCase().includes("copenhagen") &&
            point.properties?.dataOrigin === "local-city-dataset";
          const baselineNum = typeof props.baselineValue === "number" ? (props.baselineValue as number) : undefined;
          const interventionNum = typeof props.interventionValue === "number" ? (props.interventionValue as number) : undefined;
          const deltaNum =
            typeof props.comparisonValue === "number"
              ? (props.comparisonValue as number)
              : interventionNum !== undefined && baselineNum !== undefined
                ? interventionNum - baselineNum
                : undefined;
          const cphHeader = isCph
            ? `
              <p style="font-size: 11px; color: #8578C3; margin: 0 0 2px 0; text-transform: uppercase;">${String(props.streetName ?? "Copenhagen camera")}</p>
              ${props.direction ? `<p style="font-size: 10px; color: #96C2EF; margin: 0 0 4px 0;">Direction: ${String(props.direction)}</p>` : ""}
              <p style="font-size: 16px; font-weight: bold; color: #2F1B6D; margin: 0 0 4px 0;">${point.value.toFixed(1)}${valueLabel}</p>
              ${baselineNum !== undefined ? `<p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Baseline: ${baselineNum.toFixed(1)}${valueLabel}</p>` : ""}
              ${interventionNum !== undefined ? `<p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Intervention: ${interventionNum.toFixed(1)}${valueLabel}</p>` : ""}
              ${deltaNum !== undefined ? `<p style="font-size: 10px; font-weight: 700; color: ${deltaNum >= 0 ? "#22C55E" : "#A78BFA"}; margin: 2px 0;">Δ ${deltaNum >= 0 ? "+" : ""}${deltaNum.toFixed(1)}${valueLabel}</p>` : ""}
              <p style="font-size: 9px; color: #96C2EF; margin: 4px 0 0 0;">Source: OpenTrafficCam Excel · Type: observed</p>
            `
            : "";
          const popupContent = `
            <div style="font-family: 'DM Sans', sans-serif; padding: 6px; min-width: 140px;">
              <p style="font-size: 10px; color: #2F1B6D; margin: 0 0 3px 0; font-weight: 700;">Data Quality</p>
              <div style="margin-bottom: 4px;">${
                isCph
                  ? `${badge("Exact")}${badge("Observed")}${badge("Per direction")}${badge("Pre + Post")}`
                  : props.locationMethod === "approximate_cluster"
                  ? `${badge("Approximate")}${badge("Inferred")}${badge("Coverage-expanded")}${badge("Proxy")}`
                  : props.spatialQuality === "inferred"
                    ? `${badge("Inferred")}${badge("Derived proxy")}${badge("Point/flow-based")}${badge("Available period")}`
                    : `${badge("Exact")}${badge(String(props.type || "observed"))}${badge("Point-level")}${badge("2024 snapshot")}`
              }</div>
              ${isCph ? cphHeader : `
              <p style="font-size: 11px; color: #8578C3; margin: 0 0 4px 0; text-transform: uppercase;">${dataType}</p>
              ${selectedKpi === "kpi3.1" && props.type_amgt_cycl ? (
                `<p style="font-size: 18px; font-weight: bold; color: #2F1B6D; margin: 0 0 6px 0;">${props.type_amgt_cycl}</p><p style="font-size: 10px; color: #96C2EF; margin: 0 0 6px 0;">Category: ${iconSpec.label}</p>`
              ) : (
                `<p style="font-size: 18px; font-weight: bold; color: #2F1B6D; margin: 0 0 6px 0;">${point.value.toFixed(1)}${valueLabel}</p>`
              )}
              ${props.type_amgt_cycl && selectedKpi !== "kpi3.1" ? `<p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Type: ${props.type_amgt_cycl}</p>` : ''}
              ${props.localisation ? `<p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">${props.localisation}</p>` : ''}
              ${props.longueur_m !== undefined ? `<p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Length: ${typeof props.longueur_m === 'number' ? props.longueur_m.toFixed(0) : props.longueur_m}m</p>` : ''}
              `}
              <div style="border-top: 1px solid rgba(101, 125, 245, 0.2); padding-top: 4px; margin-top: 4px;">
                <p style="font-size: 9px; color: #96C2EF; margin: 0;">${
                  point.properties?.dataOrigin === "local-city-dataset"
                    ? "Local dataset (SharePoint)"
                    : point.properties?.dataOrigin === "coverage-fallback"
                      ? "Coverage-expanded from local dataset"
                    : isIssy
                      ? "Bundled SharePoint snapshot"
                      : "Synthetic data"
                }</p>
                ${props.spatialNote ? `<p style="font-size: 9px; color: #96C2EF; margin: 2px 0 0 0;">${String(props.spatialNote)}</p>` : ""}
                ${props.locationMethod === "approximate_cluster" ? `<p style="font-size: 9px; color: #96C2EF; margin: 2px 0 0 0;">Approximate location</p>` : ""}
                ${props.locationMethod === "pilot_area_inference" ? `<p style="font-size: 9px; color: #96C2EF; margin: 2px 0 0 0;">Location inferred from network segment</p>` : ""}
              </div>
            </div>
          `;

          const segId = String(props.segmentId ?? point.id);
          const segName = `${iconSpec.label} · ${String(
            props.streetName ?? props.siteId ?? props.localisation ?? "Intervention site"
          )}`;
          const segmentDetail = {
            segmentId: segId,
            segmentName: segName,
            speed: null as number | null,
            congestion: point.value / 100,
          };

          if (useNeonBadge && mapRef.current) {
            const hitRadius = Math.max(10, Math.min(16, 8 + normalizedValue * 8));
            const { visual, hit } = addNeonPointMarker(
              mapRef.current,
              point.lat,
              point.lon,
              iconSpec,
              segmentDetail,
              segmentInteractionEnabled ? segmentHandlers : undefined,
              {
                title: segName,
                hitRadius,
                selectedSegmentId: selectedJunctionSegmentId,
                popupHtml: popupContent,
              }
            );
            markersRef.current.push(visual);
            circlesRef.current.push(hit);
          } else {
            const circle = L.circleMarker([point.lat, point.lon], {
              radius: size,
              fillColor: color,
              fillOpacity: opacity,
              color: borderColor,
              weight: borderWidth,
              opacity: 0.9,
            }).addTo(mapRef.current!);
            circle.bindPopup(popupContent);
            if (segmentInteractionEnabled) {
              wireCircleMarkerSegment(circle, segmentDetail, segmentHandlers, { baseRadius: size });
            }
            circlesRef.current.push(circle);
          }
        });
      }
      // AREAS VISUALIZATION (Polygons) - for accessibility/catchment/coverage/emissions
      else if (isAreaVisualization(selectedKpi)) {
        if (currentCity.toLowerCase().includes("copenhagen") && isCopenhagenCameraKpi(selectedKpi)) {
          addInterventionLayer(cityData, showInterventionLayer);
          return;
        }
        if (currentCity.toLowerCase().includes("copenhagen") && selectedKpi === "kpi4.2") {
          addInterventionLayer(cityData, showInterventionLayer);
          return;
        }
        if (isIssy && selectedKpi === "kpi3.2") {
          /* Issy climate hex rendered above */
        } else if (selectedKpi === "kpi3.2" && renderIntent === "hex") {
          const k32 = cityData.kpiData["kpi3.2"];
          const yearAnchor = getKpi32TimeSeriesIntensity(k32, kpi32SelectedYear);
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
            const localIntensity = Math.max(0, Math.min(100, cluster.total / cluster.count));
            const intensity =
              yearAnchor !== null
                ? Math.max(0, Math.min(100, localIntensity * 0.35 + yearAnchor * 0.65))
                : localIntensity;
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

            const yearLine =
              kpi32SelectedYear && yearAnchor !== null
                ? `<p style="font-size: 10px; color: #A78BFA; margin-top: 4px; font-weight: 600;">Chart year ${kpi32SelectedYear} · series intensity ${yearAnchor.toFixed(1)}%</p>`
                : "";

            heatCircle.bindPopup(`
              <div style="font-family: 'DM Sans', sans-serif; padding: 8px; min-width: 150px;">
                <p style="font-size: 11px; color: #8578C3; margin: 0 0 4px 0; text-transform: uppercase;">Climate Impact Zone</p>
                <p style="font-size: 16px; font-weight: bold; color: #2F1B6D; margin: 0;">Estimated intensity: ${intensity.toFixed(1)}%</p>
                ${yearLine}
                <p style="font-size: 10px; color: #96C2EF; margin-top: 4px;">${cluster.count} records aggregated</p>
              </div>
            `);

            circlesRef.current.push(heatCircle);
          });

          addInterventionLayer(cityData, showInterventionLayer);
          return;
        }
        let areas: MapArea[] = [];
        const kpiRow = cityData.kpiData[selectedKpi];
        const kpiValue = kpiRow?.mainValue || 50;
        
        if (selectedKpi === "kpi4.2") {
          // Accessibility - generate isochrones around city center
          areas = generateIsochrones(cityData.lat, cityData.lon, [2, 4, 6], kpiValue);
        } else if (selectedKpi === "kpi2.1") {
          // Safety: CITY_DATA stores a ~0–5 star band; grid math expects ~0–100 so opacity/filters behave like other pilots.
          const starMain =
            typeof kpiRow?.mainValue === "number" && Number.isFinite(kpiRow.mainValue)
              ? kpiRow.mainValue
              : 2.5;
          const scaledBase = Math.min(100, Math.max(0, (starMain / 5) * 100));
          areas = generateGridAreas(cityData.lat, cityData.lon, 8, 1, scaledBase);
        } else if (selectedKpi === "kpi3.2") {
          // CO2 / environmental intensity — align polygon rings with chart year when selected
          const emissionIntensity = resolveKpi32PolygonBaseIntensity(kpiRow, kpi32SelectedYear);
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
              ${selectedKpi === "kpi3.2" && kpi32SelectedYear ? `<p style="font-size: 10px; color: #A78BFA; margin: 2px 0; font-weight: 600;">Chart year ${kpi32SelectedYear} (city time series)</p>` : ''}
              ${selectedKpi === "kpi3.2" ? `<p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">~ Reduction vs baseline: ${Math.max(0, 100 - area.value).toFixed(1)}%</p>` : ''}
            </div>
          `;
          
          polygon.bindPopup(popupContent);
          polygonsRef.current.push(polygon);
        });
      }
      addInterventionLayer(cityData, showInterventionLayer, issyJunctionStudy || isIssy);
      } finally {
        attachPilotStoryPins();
      }
    },
    [
      selectedKpi,
      filterRange,
      trafficData,
      bicycleData,
      selectedModeTypes,
      addCityBoundary,
      onSegmentFocus,
      onJunctionSegmentClick,
      addInterventionLayer,
      showInterventionLayer,
      localCityPoints,
      issyFlows,
      issyClasseur,
      issyFlowDayCategory,
      infrastructureCategoryFocus,
      kpi32SelectedYear,
      milanSpeedSegments,
      milanEnvironmentSegments,
      scenario,
      selectedPilotId,
      selectedPilotMeta,
      isKpiSupportedByPilot,
      issyJunctionStudy,
      selectedJunctionSegmentId,
      hoveredJunctionSegmentId,
      onSegmentHover,
      pilotGeometrySpec,
      runtimeLinkage,
      segmentInteractionEnabled,
      suppressMapSpatialLayers,
      cphParkingGeo,
      cphStreetsGeo,
      trikalaSegmentInsights,
      trikalaInfrastructureLocations,
    ]
  );

  useEffect(() => {
    if (!pilotFlyToSignal || !mapRef.current || viewLevel !== "PILOT_DATA") return;
    const maxZoom = pilotFlyToSignal.maxZoom ?? pilotGeometrySpec?.maxZoom ?? 18;
    if (pilotFlyToSignal.bounds) {
      const bounds = L.latLngBounds(pilotFlyToSignal.bounds);
      mapRef.current.fitBounds(bounds, {
        padding: [52, 52],
        maxZoom,
        animate: true,
        duration: 0.85,
      });
      return;
    }
    if (pilotFlyToSignal.lat == null || pilotFlyToSignal.lng == null) return;
    const requested = pilotFlyToSignal.zoom ?? Math.max(mapRef.current.getZoom(), 13);
    const zoom = Math.min(requested, maxZoom);
    mapRef.current.flyTo([pilotFlyToSignal.lat, pilotFlyToSignal.lng], zoom, { duration: 0.85 });
  }, [pilotFlyToSignal, viewLevel, pilotGeometrySpec?.maxZoom]);

  useEffect(() => {
    if (!mapRef.current || pilotGeometrySpec?.maxZoom == null) return;
    mapRef.current.setMaxZoom(pilotGeometrySpec.maxZoom);
    if (pilotGeometrySpec.minZoom != null) {
      mapRef.current.setMinZoom(pilotGeometrySpec.minZoom);
    } else if (!isTrikalaCity) {
      mapRef.current.setMinZoom(4);
    }
  }, [pilotGeometrySpec?.maxZoom, pilotGeometrySpec?.minZoom, isTrikalaCity]);

  useEffect(() => {
    if (!currentCity || !onDataQualitySummaryChange) return;
    const spatialPlan = resolveSpatialRenderPlan(currentCity, selectedKpi, {
      junctionStudy: issyJunctionStudy,
      pilotId: selectedPilotId,
      scenario,
      runtimeLinkage,
    });
    const uncertainty = pilotGeometrySpec?.uncertaintyLevel;
    const aggregateLabel =
      pilotGeometrySpec?.labelStyle === "aggregate" ? " · aggregate view" : "";
    const reductionNote = pilotGeometrySpec?.reductionCaption
      ? ` · ${pilotGeometrySpec.reductionCaption}`
      : "";
    if (currentCity.toLowerCase() === "milan" && selectedKpi === "kpi2.1" && milanSpeedSegments) {
      const total = Math.max(1, milanSpeedSegments.stats.parsedSegments);
      const inferredPct = Math.min(100, Math.round((milanSpeedSegments.stats.missingMetricJoins / total) * 100));
      const matchedPct = Math.max(0, 100 - inferredPct);
      const joinPct = milanSpeedSegments.stats.cameraJoinRatePct;
      const probabilistic = pilotGeometrySpec?.interactionModel === "network";
      onDataQualitySummaryChange({
        recordsLabel: `${milanSpeedSegments.stats.parsedSegments.toLocaleString()} segments`,
        spatialQuality: probabilistic
          ? `probabilistic CO₂/noise network${aggregateLabel}${reductionNote}`
          : `${matchedPct}% metric-matched${joinPct != null ? ` · ${joinPct}% camera-linked` : ""}${aggregateLabel}`,
        dataType: probabilistic
          ? "derived environmental network proxy"
          : "observed speed + derived risk index",
        temporalCoverage: "2024 snapshot",
        confidence:
          uncertainty === "high" || milanSpeedSegments.dataConfidence === "unavailable"
            ? "Low"
            : "High",
        provenanceType: probabilistic ? "derived" : "observed",
        geometryLinkage: probabilistic ? "inferred" : "matched",
        spatialSystemHint: spatialPlan.legendHint,
      });
      return;
    }
    if (currentCity.toLowerCase().includes("helsinki")) {
      const total = localCityPoints?.length || 0;
      const linkage =
        localCityPoints?.some((p) => p.properties?.geometryLinkage === "matched") ? "matched" : "inferred";
      onDataQualitySummaryChange({
        recordsLabel: `${total.toLocaleString()} points`,
        spatialQuality:
          (linkage === "matched" ? "Telraam coordinates when present" : "inferred ring layout") +
          aggregateLabel +
          reductionNote,
        dataType: selectedKpi === "kpi1.2" ? "observed Telraam counts" : "derived Telraam proxy",
        temporalCoverage: "before-after",
        confidence: uncertainty === "high" || linkage === "inferred" ? "Low" : "Medium",
        provenanceType: selectedKpi === "kpi1.2" ? "observed" : "derived",
        geometryLinkage: linkage,
        spatialSystemHint: spatialPlan.legendHint,
      });
      return;
    }
    if (currentCity.toLowerCase().includes("copenhagen")) {
      const total = localCityPoints?.length || 0;
      const kpiUnavailable = !isCopenhagenCameraKpi(selectedKpi);
      const cphDiagnostics = getLocalCityDiagnostics("Copenhagen", selectedKpi, selectedPilotId);
      const recordsLabel = kpiUnavailable
        ? "KPI preview only — not available yet"
        : cphDiagnostics?.reason === "files-unavailable"
          ? "Observed directional source unavailable"
          : cphDiagnostics?.reason === "pilot-scope-empty"
            ? "No observed directional mobility records for the selected configuration."
            : `${total.toLocaleString()} camera-direction points`;
      onDataQualitySummaryChange({
        recordsLabel,
        spatialQuality: "exact OpenTrafficCam coordinates",
        dataType: kpiUnavailable
          ? "preview state"
          : "observed directional mobility counts",
        temporalCoverage:
          !kpiUnavailable && cphDiagnostics?.reason === "files-unavailable"
            ? "source unavailable"
            : "before-after",
        confidence:
          kpiUnavailable || cphDiagnostics?.reason === "files-unavailable"
            ? "Low"
            : total >= 4
              ? "High"
              : "Medium",
        provenanceType: kpiUnavailable ? "derived" : "observed",
        geometryLinkage: "exact",
        spatialSystemHint: spatialPlan.legendHint,
      });
      return;
    }
    if (currentCity.toLowerCase().includes("issy") && selectedKpi === "kpi3.1") {
      const slice = filterCyclingInfrastructureForIssy(
        cyclingInfrastructureData,
        selectedPilotId,
        issyJunctionStudy
      );
      const { lines, points } = countIssyFacilityRenderables(slice.results);
      const rendered = lines + points;
      onDataQualitySummaryChange({
        recordsLabel: isLoadingCyclingInfra
          ? "Loading live facilities…"
          : `${slice.apiTotal.toLocaleString()} API · ${rendered.toLocaleString()} on map`,
        spatialQuality: slice.clipLabel,
        dataType: "live cycling infrastructure (zero-emission mobility)",
        temporalCoverage: slice.apiTotal > 0 ? "open-data catalogue" : "unavailable",
        confidence:
          isLoadingCyclingInfra || rendered === 0
            ? "Low"
            : lines > 0
              ? "Medium"
              : "Medium",
        provenanceType: "observed",
        geometryLinkage:
          lines > 0 ? "linestring corridors" : points > 0 ? "facility centroids" : "none in clip",
        spatialSystemHint: spatialPlan.legendHint,
      });
      return;
    }
    if (currentCity.toLowerCase().includes("issy") && selectedKpi === "kpi4.1") {
      const mock = getIssySentimentMock(selectedPilotId);
      onDataQualitySummaryChange({
        recordsLabel: mock
          ? `${mock.samples.length} mock survey samples`
          : "No GecoAir survey feed",
        spatialQuality: "junction corridor arms (mode-share segments)",
        dataType: "mock GecoAir satisfaction placeholder",
        temporalCoverage: "demo scenario",
        confidence: "Low",
        provenanceType: "mock",
        geometryLinkage: "matched",
        spatialSystemHint: spatialPlan.legendHint,
      });
      return;
    }
    if (currentCity.toLowerCase().includes("issy") && selectedKpi === "kpi4.2") {
      const mock = getIssyAccessibilityMock(selectedPilotId);
      onDataQualitySummaryChange({
        recordsLabel: mock
          ? `${mock.totalFeatures} mock accessibility features`
          : "No accessibility inventory",
        spatialQuality: "junction corridor arms (mode-share segments)",
        dataType: "mock accessibility inventory",
        temporalCoverage: "demo scenario",
        confidence: "Low",
        provenanceType: "mock",
        geometryLinkage: "matched",
        spatialSystemHint: spatialPlan.legendHint,
      });
      return;
    }
    if (currentCity.toLowerCase().includes("issy") && selectedKpi === "kpi3.2") {
      onDataQualitySummaryChange({
        recordsLabel: issyClasseur
          ? `ASIF model · ${Math.round(issyClasseur.totalBaselineCo2G)} g CO₂/h baseline`
          : "Derived congestion hex field",
        spatialQuality: "climate hex grid at junction",
        dataType: issyClasseur ? "modelled ASIF emissions (Classeur.xlsx)" : "derived traffic-pressure proxy",
        temporalCoverage: issyClasseur ? "Nov 2024 baseline inputs" : "demo scenario",
        confidence: issyClasseur ? "Medium" : "Low",
        provenanceType: issyClasseur ? "modelled" : "derived",
        geometryLinkage: "matched",
        spatialSystemHint: spatialPlan.legendHint,
      });
      return;
    }
    if (currentCity.toLowerCase().includes("issy") && selectedKpi === "kpi1.2" && issyFlows) {
      const winticsNote =
        selectedPilotId === "issy-p1" && issyWintics
          ? ` + Wintics site (${issyWintics.overall.modalSharePct.cyclists?.toFixed(1) ?? "?"}% cyclists at camera)`
          : "";
      onDataQualitySummaryChange({
        recordsLabel: `${issyFlows.length.toLocaleString()} zone flows${winticsNote}`,
        spatialQuality: "zone-flow linkage",
        dataType: "observed baseline/post flows",
        temporalCoverage: "before-after",
        confidence: "High",
        provenanceType: "observed",
        geometryLinkage: "matched",
        spatialSystemHint: spatialPlan.legendHint,
      });
      return;
    }
    if (currentCity.toLowerCase().includes("trikala")) {
      const total = localCityPoints?.length || 0;
      const infraCount = trikalaInfrastructureLocations.length;
      const spatialQuality =
        infraCount > 0
          ? `partner GIS (${infraCount} mapped features)`
          : "inferred pilot anchor (survey aggregates)";
      const recordsLabel =
        infraCount > 0
          ? `${infraCount.toLocaleString()} GIS features · ${total.toLocaleString()} survey aggregates`
          : `${total.toLocaleString()} survey aggregates`;
      onDataQualitySummaryChange({
        recordsLabel,
        spatialQuality,
        dataType: infraCount > 0 ? "observed GIS + survey aggregates" : "observed survey Likert aggregates",
        temporalCoverage: total > 0 ? "before-after" : "unavailable",
        confidence: infraCount > 0 || total > 0 ? "Medium" : "Low",
        provenanceType: "observed",
        geometryLinkage: infraCount > 0 ? "matched" : "inferred",
        spatialSystemHint: spatialPlan.legendHint,
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
      provenanceType: "mock",
      geometryLinkage: "inferred",
      spatialSystemHint: spatialPlan.legendHint,
    });
  }, [
    currentCity,
    selectedKpi,
    localCityPoints,
    selectedPilotId,
    milanSpeedSegments,
    issyFlows,
    issyClasseur,
    issyWintics,
    onDataQualitySummaryChange,
    issyJunctionStudy,
    scenario,
    pilotGeometrySpec,
    runtimeLinkage,
    cyclingInfrastructureData,
    isLoadingCyclingInfra,
    trikalaInfrastructureLocations,
  ]);

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
          if (!mapRef.current) return;
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

            const pilotMarker = L.marker(spreadPts[pi], { icon }).addTo(mapRef.current);
            markersRef.current.push(pilotMarker);
            pilotMarker.on("click", () => {
              setCurrentPilot(pilot);
              onPilotSelect?.(pilot);
              setViewLevel("PILOT_DATA");
              onCitySelect?.(city.city);
              mapRef.current!.flyTo(
                [pilot.lat ?? city.lat, pilot.lng ?? city.lon],
                isTrikalaCityName(city.city) ? trikalaMapZoom() : 14,
                { duration: 0.9 }
              );
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

  const autoFitRenderedData = useCallback(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const bounds = L.latLngBounds([]);
    let hasGeometry = false;
    const cityCenter = currentCity
      ? CITY_DATA.find((city) => city.city === currentCity)
      : undefined;
    const focusLatLng =
      selectedPilotMeta?.lat != null && selectedPilotMeta?.lng != null
        ? L.latLng(selectedPilotMeta.lat, selectedPilotMeta.lng)
        : cityCenter
          ? L.latLng(cityCenter.lat, cityCenter.lon)
          : null;
    const focusRadiusM =
      selectedPilotMeta?.scale === "street"
        ? 7000
        : selectedPilotMeta?.scale === "district"
          ? 18000
          : 45000;

    const extendBounds = (lat: number, lon: number) => {
      if (focusLatLng) {
        const candidate = L.latLng(lat, lon);
        if (focusLatLng.distanceTo(candidate) > focusRadiusM) return;
      }
      bounds.extend([lat, lon]);
      hasGeometry = true;
    };

    markersRef.current.forEach((marker) => {
      const latLng = marker.getLatLng?.();
      if (!latLng) return;
      extendBounds(latLng.lat, latLng.lng);
    });

    circlesRef.current.forEach((layer) => {
      const circleBounds = (layer as L.Circle).getBounds?.();
      if (circleBounds?.isValid()) {
        const center = circleBounds.getCenter?.();
        if (!focusLatLng || (center && focusLatLng.distanceTo(center) <= focusRadiusM)) {
          bounds.extend(circleBounds.getSouthWest());
          bounds.extend(circleBounds.getNorthEast());
          hasGeometry = true;
        }
        return;
      }
      const latLng = (layer as L.CircleMarker).getLatLng?.();
      if (latLng) extendBounds(latLng.lat, latLng.lng);
    });

    polylinesRef.current.forEach((line) => {
      const lineBounds = line.getBounds?.();
      if (!lineBounds?.isValid()) return;
      const center = lineBounds.getCenter?.();
      if (!focusLatLng || (center && focusLatLng.distanceTo(center) <= focusRadiusM)) {
        bounds.extend(lineBounds.getSouthWest());
        bounds.extend(lineBounds.getNorthEast());
        hasGeometry = true;
      }
    });

    polygonsRef.current.forEach((poly) => {
      const polyBounds = poly.getBounds?.();
      if (!polyBounds?.isValid()) return;
      const center = polyBounds.getCenter?.();
      if (!focusLatLng || (center && focusLatLng.distanceTo(center) <= focusRadiusM)) {
        bounds.extend(polyBounds.getSouthWest());
        bounds.extend(polyBounds.getNorthEast());
        hasGeometry = true;
      }
    });

    if (!hasGeometry || !bounds.isValid()) return;
    map.fitBounds(bounds, {
      padding: [48, 48],
      maxZoom: pilotGeometrySpec?.maxZoom ?? 17,
      animate: true,
      duration: 0.6,
    });
  }, [
    pilotGeometrySpec?.maxZoom,
    currentCity,
    selectedPilotMeta?.lat,
    selectedPilotMeta?.lng,
    selectedPilotMeta?.scale,
  ]);

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
          mapRef.current.flyTo(
            [selectedPilot.lat ?? cityData.lat, selectedPilot.lng ?? cityData.lon],
            isTrikalaCityName(selectedCity) ? trikalaMapZoom() : 14,
            { duration: 1.2 }
          );
          setTimeout(() => {
            if (!mapRef.current) return;
            clearLayers();
            addHexbinData(selectedCity, selectedModeTypes);
          }, 800);
        } else {
          setCurrentPilot(null);
          setViewLevel("CITY_INTERVENTIONS");
          mapRef.current.flyTo([cityData.lat, cityData.lon], 13, { duration: 1.2 });
          setTimeout(() => {
            if (!mapRef.current) return;
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
              const pilotMarker = L.marker(spreadPts[pi], { icon }).addTo(mapRef.current);
              markersRef.current.push(pilotMarker);
              pilotMarker.on("click", () => {
                setCurrentPilot(pilot);
                onPilotSelect?.(pilot);
                setViewLevel("PILOT_DATA");
                mapRef.current!.flyTo(
                  [pilot.lat ?? cityData.lat, pilot.lng ?? cityData.lon],
                  isTrikalaCityName(selectedCity) ? trikalaMapZoom() : 14,
                  { duration: 0.9 }
                );
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
  }, [
    selectedKpi,
    filterRange,
    viewLevel,
    currentCity,
    clearLayers,
    addHexbinData,
    trafficData,
    bicycleData,
    cyclingInfrastructureData,
    selectedModeTypes,
    kpi32SelectedYear,
    infrastructureCategoryFocus,
    selectedPilotId,
    scenario,
    localCityPoints,
    trikalaInfrastructureLocations,
    trikalaSegmentInsights,
    selectedJunctionSegmentId,
    hoveredJunctionSegmentId,
  ]);

  useEffect(() => {
    if (viewLevel !== "PILOT_DATA" || !currentCity || !mapRef.current) return;
    const timer = window.setTimeout(() => {
      autoFitRenderedData();
    }, 220);
    return () => window.clearTimeout(timer);
  }, [
    viewLevel,
    currentCity,
    selectedPilotId,
    selectedKpi,
    filterRange,
    selectedModeTypes,
    scenario,
    trafficData,
    bicycleData,
    cyclingInfrastructureData,
    localCityPoints,
    trikalaLocationsBundle,
    trikalaInfrastructureLocations,
    kpi32SelectedYear,
    infrastructureCategoryFocus,
    autoFitRenderedData,
  ]);

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
        .cph-parking-popup .leaflet-popup-content-wrapper {
          background: #131a30 !important;
          color: #ffffff !important;
          border: 1px solid #2b385c !important;
          border-radius: 6px !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5) !important;
          padding: 8px 12px !important;
        }
        .cph-parking-popup .leaflet-popup-content {
          margin: 0 !important;
        }
        .cph-parking-popup .leaflet-popup-tip {
          background: #131a30 !important;
          border: 1px solid #2b385c !important;
          box-shadow: none !important;
        }
      `}</style>
      <div className="absolute inset-0 pointer-events-none z-10 bg-gradient-to-b from-background/30 via-transparent to-background/20" />
      {viewLevel === "PILOT_DATA" && (
        <div
          className="absolute inset-0 pointer-events-none z-[11]"
          style={{ background: "rgba(8, 6, 24, 0.18)" }}
          aria-hidden
        />
      )}
      {focusMode && selectedJunctionSegmentId && (
        <div
          className="absolute inset-0 pointer-events-none z-[12] transition-opacity duration-200"
          style={{ background: "rgba(8, 6, 24, 0.42)" }}
          aria-hidden
        />
      )}
      <div ref={mapContainer} className="h-full w-full" />
      <DeckLeafletOverlay
        leafletMap={leafletMapUi}
        parentRef={mapPaneWrapperRef}
        layers={deckOverlayLayers}
        enabled={deckOverlayLayers.length > 0}
      />
      {scenario === "comparison" && viewLevel === "PILOT_DATA" && currentCity && (
        <div className="pointer-events-none absolute top-20 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-lg border border-white/25 bg-black/45 backdrop-blur-md px-3 py-1.5 text-intel-meta font-medium text-white/90">
          <span className="inline-block h-2 w-6 rounded-full" style={{ background: "#22C55E" }} />
          <span>Favourable change</span>
          <span className="inline-block h-2 w-6 rounded-full ml-1" style={{ background: "#8578C3" }} />
          <span>Other direction</span>
          <span className="text-white/50 hidden sm:inline">— thickness = magnitude of difference</span>
        </div>
      )}

      {currentCity?.toLowerCase().includes("issy") &&
        viewLevel === "PILOT_DATA" &&
        selectedKpi === "kpi3.1" &&
        issyFacilityLayerStatus && (
        <div className="pointer-events-none absolute bottom-6 right-6 z-30 w-[300px] rounded-xl border border-white/25 bg-black/35 backdrop-blur-xl p-3 text-[11px] text-white">
          <p className="font-semibold text-violet mb-2">Zero-emission facilities (KPI 3.1)</p>
          <div className="space-y-1.5 mb-3">
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-1 w-10 rounded-full shadow-[0_0_8px_rgba(46,204,113,0.55)]"
                style={{ backgroundColor: "#2ecc71" }}
              />
              <span>Cycling corridor (dual-pass track)</span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full border-2 border-white shadow-[0_0_10px_rgba(0,255,255,0.65)]"
                style={{ backgroundColor: "#00ffff" }}
              />
              <span>Parking / hub node</span>
            </div>
          </div>
          <div
            className={`border-t border-white/20 pt-2 space-y-1 text-[10px] ${
              issyFacilityLayerStatus.isEmpty ? "text-amber-200" : "text-white/90"
            }`}
          >
            <p className="font-semibold text-violet">Live facility layer</p>
            <p>Spatial boundary: {issyFacilityLayerStatus.clipLabel}</p>
            <p>API records: {issyFacilityLayerStatus.apiTotal}</p>
            <p>
              Rendered: {issyFacilityLayerStatus.visibleLines} corridors ·{" "}
              {issyFacilityLayerStatus.visiblePoints} nodes
            </p>
            <p>{issyFacilityLayerStatus.statusMessage}</p>
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
