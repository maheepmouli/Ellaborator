import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import L from "leaflet";
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
import { isIssyCityWideModeSharePilot } from "@/data/issyPilotProfiles";
import { useMilanEnvironmentSegments, useMilanSpeedSegments } from "@/hooks/use-milan-segment-data";
import { getStoryPointsForPilot } from "@/data/storyConfig";
import { SEGMENT_PRESSURE_ITEMS } from "@/lib/mapLayerLegend";
import { buildMilanSpeedLegendItems } from "@/lib/milanMapLayers";
import { placeMilanZeroEmissionAlongNetwork, filterMilanFacilityPointsForScenario, aggregateMilanFacilitySiteKpi } from "@/data/milanZeroEmissionMock";
import {
  bindJunctionObservatoryLayer,
  renderIssyJunctionHubPulse,
} from "@/lib/renderIssyJunctionArms";
import { renderHubRipplePulseOverlay } from "@/lib/copenhagenMapLayers/copenhagenTrafficPulse";
import {
  kpiMetricKind,
  mapScenarioDisplayValue,
} from "@/lib/mapScenarioValue";
import { renderHelsinkiMapLayers } from "@/lib/helsinkiMapLayers";
import { useHelsinkiHslTram, useHelsinkiInnotrafikSummary } from "@/hooks/use-helsinki-data";
import { renderLocalCityInteractivePoints } from "@/lib/renderLocalCityInteractivePoints";
import {
  segmentInteractionHandlers,
  wireCircleMarkerSegment,
  wirePolygonSegment,
  wirePolylineSegment,
  type SegmentInteractionHandlers,
} from "@/lib/wireMapSegmentInteraction";
import { filterPointsInPilotZone, filterMilanLocalPoints, filterMilanAccessibilityPoints } from "@/lib/interventionZone";
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
import { formatDataTypeLabel, provenanceBadgesHtml, resolveCityOverviewTrust, trustChipHtml } from "@/lib/dataProvenance";
import { resolveMapPointIconSpec } from "@/lib/mapPointIconTaxonomy";
import { createMapPointDivIcon, addNeonPointMarker } from "@/lib/mapPointIcons";
import {
  kpiUsesZoomDependentMarkerLayout,
  layoutZoomTier,
  nudgeLeafletMapLayers,
  scheduleLeafletLayerRepaint,
  whenLeafletMapSettled,
} from "@/lib/leafletMapSync";
import {
  renderIssyAccessibilityField,
  renderIssyCityClimateReading,
  renderIssyFacilityLayers,
  renderIssySentimentField,
  renderIssyCityModeShareZones,
} from "@/lib/issyMapLayers";
import { buildIssyZoneSustainableModeSharePoints } from "@/lib/issyFlowAggregates";
import {
  countIssyFacilityRenderables,
  filterCyclingInfrastructureForIssy,
} from "@/lib/issyFacilityMap";
import type { IssyDayCategory } from "@/services/issyFlowData";
import { DeckLeafletOverlay } from "@/components/map/DeckLeafletOverlay";
import { getLocalCityDiagnostics, type LocalCityPoint } from "@/services/localCityData";
import {
  loadCopenhagenCountSitesGeoJson,
  loadZaragozaInterventionAreasGeoJson,
} from "@/services/staticGeoData";
import {
  filterValidZaragozaAreaFeatures,
  loadZaragozaReformadoOverlay,
  renderZaragozaKpi12Layers,
  renderZaragozaKpi21Layers,
  renderZaragozaKpi32Layers,
  renderZaragozaKpi42Layers,
} from "@/lib/zaragozaMapLayers";
import { isMilanCityName, milanMapZoom, MILAN_PILOT_ANCHORS } from "@/lib/milanMapConfig";
import { buildMilanKpi12MapPoints } from "@/lib/milanModeBreakdown";
import {
  prepareMilanModeShareDisplayPoints,
  buildMilanJunctionAccessibilityMockPoints,
  buildMilanJunctionClimateMockPoints,
  buildMilanJunctionModeShareMockPoints,
  milanHasObservedAccessibilityData,
  milanHasObservedClimateData,
  milanHasObservedModeShareData,
  milanJunctionAnchorsForPilot,
  pickJunctionsForModeSharePresentation,
  renderMilanKpi11Layers,
  renderMilanMapLayers,
  renderMilanSpeedSegmentUnderlay,
} from "@/lib/milanMapLayers";
import type { MilanSegmentRecord } from "@/services/milanSegmentData";
import { getIssyAccessibilityMock } from "@/data/issyAccessibilityMock";
import { getIssySentimentMock } from "@/data/issySentimentMock";
import { infrastructureChartLabelMatchesFeature } from "@/lib/infrastructureChartMapLink";
import {
  areAllTravelModesSelected,
  travelModeMatchesIssyVehicleCategory,
} from "@/lib/travelModeMapLink";
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
  ISSY_JUNCTION_ARMS,
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
    speed?: number | null;
    congestion?: number | null;
    properties?: Record<string, unknown>;
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
  /** KPI 3.2: chart year (e.g. "2022") — city climate reading follows time series intensity. */
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
    properties?: Record<string, unknown>;
  } | null) => void;
  pilotGeometrySpec?: PilotGeometryRenderSpec | null;
  runtimeLinkage?: RuntimeLinkage;
}

/**
 * Pilot overview uses large HTML markers (≈280×200px). Spread only enough that
 * cards do not stack — keep them inside the city, not across a country.
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

  let maxDist = 0;
  for (const c of coords) {
    maxDist = Math.max(maxDist, Math.hypot(c.lat - meanLat, c.lng - meanLng));
  }

  // Already geographically separated enough for 280px cards (e.g. Milan) — keep real sites.
  // Helsinki FVH sites span ~0.05° and still overlap at overview zoom — force a readable ring.
  const CARD_CLEAR_DEG = 0.1;
  if (maxDist >= CARD_CLEAR_DEG) {
    return coords.map((c) => [c.lat, c.lng] as [number, number]);
  }

  // Dense / mid cluster (Copenhagen medieval, Helsinki FVH): ring around the city.
  // ~0.16° ≈ 18 km for 3 pilots — clears card overlap at z11 without leaving metro area.
  const radiusDeg = n <= 2 ? 0.1 : n === 3 ? 0.16 : Math.min(0.2, 0.07 * n + 0.05);
  const lngScale = 1.2;

  const indexed = coords.map((c, i) => {
    const dx = c.lng - meanLng;
    const dy = c.lat - meanLat;
    const dist = Math.hypot(dx, dy);
    const angle =
      dist < 1e-8
        ? (2 * Math.PI * i) / n - Math.PI / 2
        : Math.atan2(dy, dx);
    return { i, angle };
  });

  indexed.sort((a, b) => a.angle - b.angle);

  const result: Array<[number, number]> = new Array(n);
  indexed.forEach(({ i }, slot) => {
    // 3 pilots: south / NW / NE — keeps Helsinki Pilot 3 (Viikki) readable in the NE.
    const ringAngle =
      n === 3
        ? [-Math.PI / 2, (Math.PI * 5) / 6, Math.PI / 6][slot]!
        : n === 4
          ? [-Math.PI * 0.75, -Math.PI * 0.25, Math.PI * 0.25, Math.PI * 0.75][slot]!
          : (2 * Math.PI * slot) / n - Math.PI / 2;
    result[i] = [
      meanLat + Math.sin(ringAngle) * radiusDeg,
      meanLng + Math.cos(ringAngle) * radiusDeg * lngScale,
    ];
  });

  return result;
}

/** Fit city zoom so large pilot HTML cards stay inside the viewport (side panels + card half-size). */
function fitMapToPilotOverviewCards(
  map: L.Map,
  positions: ReadonlyArray<[number, number]>,
  options?: { cityName?: string }
): void {
  if (!positions.length) return;
  const city = (options?.cityName ?? "").toLowerCase();
  const isMilan = city.includes("milan");
  const isCopenhagen = city.includes("copenhagen");
  const isHelsinki = city.includes("helsinki");
  const multiPilot = positions.length >= 3;
  // Dense city centres need a closer frame so cards stay on the metro map and readable.
  const overviewZoom = isCopenhagen || isHelsinki ? 11 : multiPilot ? 10 : isMilan ? 11 : 12;
  if (positions.length === 1) {
    map.flyTo(positions[0], overviewZoom, { duration: 0.55 });
    return;
  }
  let bounds = L.latLngBounds(positions.map(([lat, lng]) => L.latLng(lat, lng)));
  if (!bounds.isValid()) return;
  bounds = bounds.pad(multiPilot ? 0.4 : 0.55);
  map.fitBounds(bounds, {
    // Left InsightPanel (~380) + right gap + half card (~140) horizontally;
    // header/legend + half card (~110) vertically.
    paddingTopLeft: L.point(420, 180),
    paddingBottomRight: L.point(110, 180),
    maxZoom: overviewZoom,
    animate: true,
    duration: 0.55,
  });
}

const PILOT_CARD_ICON_SIZE: [number, number] = [300, 320];
const PILOT_CARD_ICON_ANCHOR: [number, number] = [150, 160];

function escapePilotCardHtml(value: string): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Copenhagen extended datasets are pilot-scoped in loadLocalCityData — not OTC workbook keys. */
const CPH_EXTENDED_MAP_DATASET_KINDS = new Set([
  "emissions",
  "survey",
  "irap",
  "near_encounter",
  "tube",
  "parking",
  "accessibility",
]);

function copenhagenPointUsesOtcCameraFilter(point: { properties?: Record<string, unknown> }): boolean {
  const kind = String(point.properties?.datasetKind ?? "");
  return !kind || !CPH_EXTENDED_MAP_DATASET_KINDS.has(kind);
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
  const [mapZoomRevision, setMapZoomRevision] = useState(0);
  const lastLayoutZoomTierRef = useRef(layoutZoomTier(14));
  const milanKpi12FitKeyRef = useRef("");
  const milanPointFitKeyRef = useRef("");
  const layerRefreshCancelRef = useRef<(() => void) | null>(null);
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
  const isMilanInteractiveKpi =
    currentCity?.toLowerCase() === "milan" &&
    (selectedKpi === "kpi1.2" ||
      selectedKpi === "kpi2.1" ||
      selectedKpi === "kpi3.2" ||
      selectedKpi === "kpi4.2");
  const segmentInteractionEnabled =
    isCopenhagenCameraContext ||
    isMilanInteractiveKpi ||
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
  const { data: helsinkiHslTram } = useHelsinkiHslTram(currentCity || "", selectedPilotId);
  const { data: helsinkiInnotrafikSummary } = useHelsinkiInnotrafikSummary(
    currentCity || "",
    selectedPilotId
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
    // Prefetch for any Issy pilot so P2/P3 mode share never races on empty flows.
    !!currentCity && isIssyCity(currentCity)
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
  const { data: milanSpeedSegments, isLoading: milanSpeedLoading } = useMilanSpeedSegments(
    milanPilotId,
    !!currentCity &&
      currentCity.toLowerCase() === "milan" &&
      (selectedKpi === "kpi2.1" ||
        selectedKpi === "kpi1.2" ||
        selectedKpi === "kpi3.1" ||
        selectedKpi === "kpi3.2" ||
        selectedKpi === "kpi4.2")
  );
  const resolvedMilanEnvWindow =
    milanEnvironmentWindow ?? (scenario === "baseline" ? "08-09" : "18-19");

  const { data: milanEnvironmentSegments, isLoading: milanEnvLoading } = useMilanEnvironmentSegments(
    resolvedMilanEnvWindow,
    !!currentCity && currentCity.toLowerCase() === "milan" && selectedKpi === "kpi3.2",
    milanPilotId
  );

  // Milan mode share uses Leaflet hub aggregation only — no Deck scatterplot dots.
  const deckOverlayLayers = useMemo((): Layer[] => [], []);

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
    const isMilanCity = currentCity?.toLowerCase().includes("milan");
    const isHelsinkiCity = currentCity?.toLowerCase().includes("helsinki");
    const isZaragozaCity = currentCity?.toLowerCase().includes("zaragoza");
    // Milan: AMAT shapefile segments / count points define geography — no synthetic buffer disc.
    // Helsinki: KPI renderers draw peer-style influence fields — skip duplicate purple buffer + GeoSample.
    // Zaragoza: partner GIS intervention polygons define geography — skip synthetic buffer disc.
    if (!isCopenhagenPilot && !isMilanCity && !isHelsinkiCity && !isZaragozaCity) {
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
    // Helsinki sampled clouds are owned by helsinkiMapLayers — do not double-paint via GeoSample.
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

  const getPilotCardHtml = (cityLabel: string, pilot: SelectedPilot) => {
    const city = escapePilotCardHtml(cityLabel.toUpperCase());
    const name = escapePilotCardHtml(pilot.name);
    const title = escapePilotCardHtml(pilot.title);
    const description = escapePilotCardHtml(pilot.description);
    return `
    <div style="
      width: 288px;
      box-sizing: border-box;
      padding: 10px 12px;
      border-radius: 10px;
      color: #F8F7FF;
      font-family: 'DM Sans', sans-serif;
      border: 1px solid rgba(172, 183, 255, 0.5);
      box-shadow: 0 12px 28px rgba(10, 8, 36, 0.5), inset 0 1px 0 rgba(255,255,255,0.18);
      backdrop-filter: blur(18px);
      background: linear-gradient(165deg, rgba(60, 37, 142, 0.94) 0%, rgba(42, 24, 108, 0.96) 100%);
      cursor: pointer;">
      <div style="display: flex; align-items: flex-start; gap: 8px;">
        <svg width="14" height="16" viewBox="0 0 24 24" fill="none" style="opacity: 0.95; flex-shrink: 0; margin-top: 2px;">
          <path d="M12 22s7-6.2 7-13a7 7 0 1 0-14 0c0 6.8 7 13 7 13z" fill="#A78BFA"/>
          <circle cx="12" cy="9" r="2.6" fill="#EDE9FE"/>
        </svg>
        <div style="flex: 1; min-width: 0;">
          <p style="font-size: 11px; font-weight: 800; margin: 0; line-height: 1.15; letter-spacing: 0.55px; color: #EEF0FF;">${city}</p>
          <p style="font-size: 20px; font-weight: 800; margin: 3px 0 0 0; line-height: 1.05; color: #FFFFFF;">${name}</p>
          <p style="font-size: 12px; font-weight: 600; margin: 5px 0 0 0; color: rgba(255,255,255,0.95); line-height: 1.35;">${title}</p>
        </div>
      </div>
      <div style="margin-top: 8px; border: 1.5px solid rgba(173, 236, 255, 0.7); border-radius: 8px; padding: 8px 10px; background: rgba(12, 10, 40, 0.28);">
        <p style="font-size: 11px; color: rgba(248,247,255,0.92); margin: 0; line-height: 1.45; white-space: normal; overflow: visible;">${description}</p>
      </div>
    </div>
  `;
  };

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
        isMilanCityName(cityName) &&
        (milanPilotId === "mil-p1" || milanPilotId === "mil-p2");
      const isMilanCity = isMilanCityName(cityName);

      const milanSpeedMetric = (segment: MilanSegmentRecord): number => {
        const avg = Number(segment.properties?.avgSpeed ?? 0);
        const p85 = Number(segment.properties?.p85Speed ?? 0);
        if (avg > 0 || p85 > 0) return avg * 0.3 + p85 * 0.7;
        return segment.value;
      };

      const milanEnvMetric = (segment: MilanSegmentRecord): number => {
        const p = segment.properties || {};
        return (
          Number(p.vAuto ?? 0) +
          Number(p.vMoto ?? 0) * 0.8 +
          Number(p.vLeggeri ?? 0) * 1.4 +
          Number(p.vMedi ?? 0) * 2.2 +
          Number(p.vPesanti ?? 0) * 3.2
        );
      };

      const fitMapToLatLngs = (
        coords: Array<[number, number]>,
        opts?: { pilotScoped?: boolean; hubPulse?: boolean }
      ) => {
        if (!mapRef.current || coords.length < 2) return;
        const segmentBounds = L.latLngBounds(coords);
        if (!segmentBounds.isValid()) return;

        const anchor = MILAN_PILOT_ANCHORS[milanPilotId];
        const pilotBounds = L.latLngBounds(
          [anchor.lat - anchor.radiusDeg, anchor.lon - anchor.radiusDeg],
          [anchor.lat + anchor.radiusDeg, anchor.lon + anchor.radiusDeg]
        );

        const latSpan = segmentBounds.getNorth() - segmentBounds.getSouth();
        const lonSpan = segmentBounds.getEast() - segmentBounds.getWest();
        const usePilotBounds =
          opts?.pilotScoped === true &&
          (latSpan > anchor.radiusDeg * 2.4 || lonSpan > anchor.radiusDeg * 2.4);

        const maxZoom = opts?.hubPulse ? 16 : milanMapZoom();
        mapRef.current.fitBounds(usePilotBounds ? pilotBounds : segmentBounds.pad(0.08), {
          animate: false,
          maxZoom,
        });
        if (opts?.hubPulse && mapRef.current.getZoom() < 14) {
          mapRef.current.setZoom(14, { animate: false });
        }
      };

      // One auto-fit per pilot×KPI×scenario — re-renders (hover/selection/data refresh)
      // must not fight the user's wheel zoom.
      const fitMilanOnce = (
        coords: Array<[number, number]>,
        opts?: { pilotScoped?: boolean; hubPulse?: boolean }
      ) => {
        const fitKey = `${milanPilotId}:${selectedKpi}:${scenario}`;
        if (milanPointFitKeyRef.current === fitKey) return;
        milanPointFitKeyRef.current = fitKey;
        milanKpi12FitKeyRef.current = fitKey;
        fitMapToLatLngs(coords, opts);
      };

      const fitMilanKpi12Once = fitMilanOnce;
      const fitMilanPointsOnce = (
        coords: Array<[number, number]>,
        opts?: { pilotScoped?: boolean; hubPulse?: boolean }
      ) => fitMilanOnce(coords, { pilotScoped: true, ...opts });

      const attachPilotStoryPins = () => {
        if (!mapRef.current || !selectedPilotId) return;
        // Sticky #16: Milan intervention narrative is in the left panel — no map pin.
        if (isMilanCityName(cityName)) return;
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
      const addIssyJunctionHubPulse = (
        segments: MapSegment[] = [],
        pulseOptions?: {
          showAnchorDot?: boolean;
          interaction?: import("@/lib/copenhagenMapLayers/copenhagenTrafficPulse").HubPulseInteraction;
        }
      ) => {
        if (!mapRef.current) return;
        if (selectedKpi !== "kpi1.2" && selectedKpi !== "kpi2.1") return;
        renderIssyJunctionHubPulse(mapRef.current, segments, issyLayerRefs, pulseOptions);
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
          cityKey.includes("copenhagen") ||
          cityKey.includes("zaragoza") ||
          cityKey.includes("trikala") ||
          cityKey.includes("milan");
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

        const junctionPulseSegments: MapSegment[] = junctionTrafficRows.length
          ? trafficSegmentsToSegments(junctionTrafficRows, selectedKpi)
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
          renderIssyCityClimateReading(mapRef.current!, cityData.lat, cityData.lon, issyLayerRefs, {
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
              fieldSurveyMarkers: true,
            }
          );
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
              scenario,
            }
          );
          wireJunctionFeatureClicks();
          addInterventionLayer(cityData, showInterventionLayer, true);
          return;
        }

        if (selectedKpi === "kpi1.2" || selectedKpi === "kpi2.1") {
          // Pilot 2 + Pilot 3: city-wide OD zone hubs — never fall back to Pont d'Issy P1 hub.
          if (selectedKpi === "kpi1.2" && isIssyCityWideModeSharePilot(selectedPilotId)) {
            if (issyFlows?.length) {
              const zonePoints = buildIssyZoneSustainableModeSharePoints(
                issyFlows,
                getIssyZoneCentroids()
              );
              renderIssyCityModeShareZones(mapRef.current!, zonePoints, issyLayerRefs, {
                scenario,
                segmentHandlers,
                selectedSegmentId: selectedJunctionSegmentId,
                filterRange,
              });
            }
            addInterventionLayer(cityData, showInterventionLayer, true);
            return;
          }

          // Sticky #04 (P1): same as Copenhagen — ripple hub only, no street-segment arms.
          const hubSegmentId = ISSY_JUNCTION_ARMS[0]?.segmentId ?? "issy-mode-share-hub";
          addIssyJunctionHubPulse(junctionPulseSegments, {
            showAnchorDot: true,
            interaction: {
              segmentId: hubSegmentId,
              segmentName: ISSY_P2_JUNCTION.shortName,
              segmentHandlers,
              selectedSegmentId: selectedJunctionSegmentId,
              wireCircleMarker: wireCircleMarkerSegment,
            },
          });
          if (mapRef.current) {
            const hubHit = L.circleMarker([ISSY_P2_JUNCTION.lat, ISSY_P2_JUNCTION.lon], {
              radius: 16,
              color: "transparent",
              weight: 0,
              fillColor: "#22c55e",
              fillOpacity: 0.01,
              opacity: 0,
            }).addTo(mapRef.current);
            hubHit.bindTooltip(
              selectedKpi === "kpi2.1"
                ? "Pont d'Issy · safety hub"
                : "Pont d'Issy · mode-share hub",
              { direction: "top", opacity: 1, className: "tri-segment-tooltip" }
            );
            hubHit.on("click", (e: L.LeafletMouseEvent) => {
              L.DomEvent.stopPropagation(e);
              emitJunctionObservatory({
                segmentId: hubSegmentId,
                segmentName: ISSY_P2_JUNCTION.shortName,
                speed: null,
                congestion: null,
              });
            });
            circlesRef.current.push(hubHit);
          }
          addInterventionLayer(cityData, showInterventionLayer, issyJunctionStudy);
          return;
        }

        addInterventionLayer(cityData, showInterventionLayer, issyJunctionStudy);
        return;
      }

      // Issy KPI1.2: ripple hubs only (sticky #02) — no OD arcs / street segments.
      if (isIssy && selectedKpi === "kpi1.2" && !issyJunctionStudy) {
        setMilanLayerQa(null);
        const pilots = getPilotsByCity(cityName);
        const hubs =
          pilots.length > 0
            ? pilots.map((p) => ({
                lat: p.lat ?? ISSY_P2_JUNCTION.lat,
                lon: p.lng ?? ISSY_P2_JUNCTION.lon,
                name: p.title || p.name,
                id: p.id,
              }))
            : [
                {
                  lat: ISSY_P2_JUNCTION.lat,
                  lon: ISSY_P2_JUNCTION.lon,
                  name: ISSY_P2_JUNCTION.shortName,
                  id: "issy-mode-share-hub",
                },
              ];
        hubs.forEach((hub) => {
          renderHubRipplePulseOverlay(
            mapRef.current!,
            hub.lat,
            hub.lon,
            true,
            markersRef.current,
            circlesRef.current,
            {
              showAnchorDot: true,
              interaction: {
                segmentId: hub.id,
                segmentName: hub.name,
                segmentHandlers,
                selectedSegmentId: selectedJunctionSegmentId,
                wireCircleMarker: wireCircleMarkerSegment,
              },
            }
          );
        });
        addInterventionLayer(cityData, showInterventionLayer, true);
        return;
      }

      if (isIssy && selectedKpi === "kpi3.2") {
        setMilanLayerQa(null);
        renderIssyCityClimateReading(mapRef.current!, cityData.lat, cityData.lon, issyLayerRefs, {
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
            scenario,
          }
        );
        return;
      }

      // Milan KPI2.1: render speed/risk on actual road segments from shapefile.
      if (isMilanCity && selectedKpi === "kpi2.1") {
        if (milanSpeedLoading) {
          addInterventionLayer(cityData, showInterventionLayer);
          return;
        }
        if (!milanSpeedSegments || milanSpeedSegments.records.length === 0) {
          setMilanLayerQa({
            layer: "safety",
            parsed: 0,
            rendered: 0,
            missingJoins: 0,
            invalidGeometry: 0,
            avgValue: 0,
            dataConfidence: milanSpeedSegments?.dataConfidence ?? "unavailable",
            statusMessage: milanSpeedSegments?.statusMessage,
          });
          addInterventionLayer(cityData, showInterventionLayer);
          return;
        }
        const measuredRecords = milanSpeedSegments.records.filter(
          (record) => record.properties?.hasMetric !== false
        );
        const allValues = measuredRecords.map((record) => milanSpeedMetric(record));
        const lowThreshold = allValues.length ? getQuantile(allValues, 0.15) : 0;
        const highThreshold = allValues.length ? getQuantile(allValues, 0.85) : 100;
        let renderedCount = 0;
        const fitCoords: Array<[number, number]> = [];
        milanSpeedSegments.records.forEach((segment) => {
          const hasMetric = segment.properties?.hasMetric !== false;
          const props = segment.properties || {};
          const segmentName = String(props.streetName || segment.id);
          const avgSpeed = Number(props.avgSpeed || 0);

          if (!hasMetric) {
            const line = L.polyline(segment.coordinates, {
              color: "#64748b",
              weight: 2,
              opacity: 0.42,
              lineJoin: "round",
              lineCap: "round",
            }).addTo(mapRef.current!);
            line.bindPopup(`
              <div style="font-family: 'DM Sans', sans-serif; padding: 8px; min-width: 170px;">
                <p style="font-size: 11px; color: #8578C3; margin: 0 0 4px 0; text-transform: uppercase;">Milan network segment</p>
                <p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Street: ${segmentName}</p>
                <p style="font-size: 9px; color: #96C2EF; margin-top: 6px;">Source: AMAT network.shp (intervention corridor)</p>
                <p style="font-size: 9px; color: #96C2EF; margin-top: 2px;">No Maggio 2025 speed reading joined for this link</p>
              </div>
            `);
            polylinesRef.current.push(line);
            renderedCount += 1;
            segment.coordinates.forEach((coord) => fitCoords.push(coord));
            return;
          }

          const metricValue = milanSpeedMetric(segment);
          const highlight = getSegmentHighlight(metricValue, lowThreshold, highThreshold);
          const line = L.polyline(segment.coordinates, {
            color: highlight.color,
            weight: highlight.weight,
            opacity: highlight.opacity,
            lineJoin: "round",
            lineCap: "round",
          }).addTo(mapRef.current!);

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
          segment.coordinates.forEach((coord) => fitCoords.push(coord));
        });
        scheduleLeafletLayerRepaint(mapRef.current, markersRef.current);
        // Fit to full network.shp extent (not circular pilot buffer) — sticky #05 / #17.
        fitMilanOnce(fitCoords);
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

      // Milan KPI 3.1 — illustrative zero-emission facility inventory.
      if (isMilanCity && selectedKpi === "kpi3.1" && mapRef.current) {
        if (milanSpeedLoading) {
          addInterventionLayer(cityData, showInterventionLayer);
          return;
        }
        const rawZemPoints = filterMilanLocalPoints(localCityPoints ?? [], milanPilotId).filter(
          (p) => p.properties?.datasetKind === "parking"
        );
        const placedZemPoints = placeMilanZeroEmissionAlongNetwork(
          rawZemPoints,
          milanSpeedSegments?.records
        );
        const zemPoints = filterMilanFacilityPointsForScenario(placedZemPoints, scenario);
        const placedOnNetwork = zemPoints.some(
          (p) => p.properties?.locationMethod === "intervention_network_sample"
        );
        if (zemPoints.length) {
          if (milanSpeedSegments?.records?.length) {
            renderMilanSpeedSegmentUnderlay(
              mapRef.current,
              milanSpeedSegments.records,
              polylinesRef.current,
              { neutral: true, opacityScale: 0.22 }
            );
          }
          renderLocalCityInteractivePoints({
            map: mapRef.current,
            cityName,
            selectedKpi,
            points: zemPoints,
            filterRange,
            scenario,
            segmentHandlers,
            segmentInteractionEnabled,
            selectedSegmentId: activeMapSegmentId,
            markersOut: markersRef.current,
            circlesOut: circlesRef.current,
            // Sticky #18: keep network-sampled sites where they are — do not re-cluster.
            spreadOverlaps: !placedOnNetwork,
            getValueColor,
          });
          const fitCoords: Array<[number, number]> = [
            ...zemPoints.map((p) => [p.lat, p.lon] as [number, number]),
            ...(milanSpeedSegments?.records ?? []).flatMap((segment) =>
              segment.coordinates.slice(0, 1)
            ),
          ];
          // Fit the corridor network + facilities (same for Pilot 1 and Pilot 2).
          fitMilanOnce(fitCoords);
          const siteKpi = aggregateMilanFacilitySiteKpi(placedZemPoints);
          setMilanLayerQa({
            layer: "zero-emission",
            parsed: placedZemPoints.length,
            rendered: zemPoints.length,
            missingJoins: 0,
            invalidGeometry: 0,
            avgValue: zemPoints.length,
            dataConfidence: "proxy",
            statusMessage: `KPI 3.1 illustrative inventory · ${zemPoints.length} visible site${zemPoints.length === 1 ? "" : "s"} (${siteKpi.baselineMain} baseline → ${siteKpi.interventionMain} intervention)`,
          });
          addInterventionLayer(cityData, showInterventionLayer);
          return;
        }
        addInterventionLayer(cityData, showInterventionLayer);
        return;
      }

      // Milan KPI3.2: RETE environment segments, or junction mock when missing.
      if (isMilanCity && selectedKpi === "kpi3.2") {
        if (milanEnvLoading || milanSpeedLoading) {
          addInterventionLayer(cityData, showInterventionLayer);
          return;
        }
        if (milanHasObservedClimateData(milanEnvironmentSegments)) {
        const milanK32Intensity = getKpi32TimeSeriesIntensity(cityData.kpiData["kpi3.2"], kpi32SelectedYear);
        const milanYearScale = milanK32Intensity != null ? milanK32Intensity / 100 : 1;
        const allValues = milanEnvironmentSegments!.records.map(
          (record) => milanEnvMetric(record) * milanYearScale
        );
        const lowThreshold = getQuantile(allValues, 0.15);
        const highThreshold = getQuantile(allValues, 0.85);
        let renderedCount = 0;
        const fitCoords: Array<[number, number]> = [];
        milanEnvironmentSegments!.records.forEach((segment) => {
          const scaledValue = milanEnvMetric(segment) * milanYearScale;
          const highlight = getSegmentHighlight(
            scaledValue,
            lowThreshold,
            highThreshold,
            "climate"
          );
          const line = L.polyline(segment.coordinates, {
            color: highlight.color,
            weight: highlight.weight,
            opacity: highlight.opacity,
            lineJoin: "round",
            lineCap: "round",
            interactive: true,
            bubblingMouseEvents: false,
            className: "milan-climate-segment",
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
              <p style="font-size: 9px; color: #96C2EF; margin-top: 2px;">Confidence: ${milanEnvironmentSegments!.dataConfidence}</p>
            </div>
          `);
          const segmentName = String(props.streetName || segment.id);
          const baseStyle = {
            color: highlight.color,
            weight: highlight.weight,
            opacity: highlight.opacity,
            lineJoin: "round" as const,
            lineCap: "round" as const,
            className: "milan-climate-segment",
          };
          // Always wire climate segments for observatory selection (pointer + click).
          // Use normalised segment.value (0–100), not raw RETE weight — raw/100 blows past 1.0.
          const congestion01 = Math.min(
            1,
            Math.max(0, Number(segment.value ?? scaledValue) / 100)
          );
          wirePolylineSegment(
            line,
            {
              segmentId: segment.id,
              segmentName,
              speed: null,
              congestion: congestion01,
            },
            segmentHandlers,
            {
              baseStyle,
              selectedSegmentId: selectedJunctionSegmentId,
              focusDim: 0.28,
            }
          );
          polylinesRef.current.push(line);
          renderedCount += 1;
          segment.coordinates.forEach((coord) => fitCoords.push(coord));
        });
        scheduleLeafletLayerRepaint(mapRef.current, markersRef.current);
        fitMilanOnce(fitCoords);
        setMilanLayerQa({
          layer: "environment",
          parsed: milanEnvironmentSegments!.stats.parsedSegments,
          rendered: renderedCount,
          missingJoins: milanEnvironmentSegments!.stats.missingMetricJoins,
          invalidGeometry: milanEnvironmentSegments!.stats.invalidGeometries,
          avgValue: milanEnvironmentSegments!.stats.avgMetricValue,
          dataConfidence: milanEnvironmentSegments!.dataConfidence,
          statusMessage: milanEnvironmentSegments!.statusMessage,
        });
        addInterventionLayer(cityData, showInterventionLayer);
        return;
        }
        const junctions = milanJunctionAnchorsForPilot(milanSpeedSegments?.records);
        const climateMockPoints = buildMilanJunctionClimateMockPoints(
          junctions,
          milanPilotId,
          milanSpeedSegments?.records
        );
        if (climateMockPoints.length && mapRef.current) {
          if (milanSpeedSegments?.records?.length) {
            renderMilanSpeedSegmentUnderlay(
              mapRef.current,
              milanSpeedSegments.records,
              polylinesRef.current,
              { neutral: true, opacityScale: 0.2 }
            );
          }
          renderLocalCityInteractivePoints({
            map: mapRef.current,
            cityName,
            selectedKpi,
            points: climateMockPoints,
            filterRange,
            scenario,
            segmentHandlers,
            segmentInteractionEnabled,
            selectedSegmentId: activeMapSegmentId,
            markersOut: markersRef.current,
            circlesOut: circlesRef.current,
            spreadOverlaps: false,
            markerStyle: "filled",
            getValueColor,
          });
          const fitCoords: Array<[number, number]> = [
            ...climateMockPoints.map((p) => [p.lat, p.lon] as [number, number]),
            ...(milanSpeedSegments?.records ?? []).flatMap((segment) =>
              segment.coordinates.slice(0, 1)
            ),
          ];
          // Sticky #19: fit corridor climate proxies (not empty pilot disc).
          fitMilanOnce(fitCoords);
          setMilanLayerQa({
            layer: "environment",
            parsed: climateMockPoints.length,
            rendered: climateMockPoints.length,
            missingJoins: 0,
            invalidGeometry: 0,
            avgValue:
              climateMockPoints.reduce((s, p) => s + p.value, 0) / climateMockPoints.length,
            dataConfidence: "proxy",
            statusMessage:
              "RETE unavailable — illustrative climate pressure points along AMAT network.shp",
          });
          addInterventionLayer(cityData, showInterventionLayer);
          return;
        }
        addInterventionLayer(cityData, showInterventionLayer);
        return;
      }

      // Milan KPI 1.1 — CDM3 expansion readiness hub (Pilot 3).
      if (isMilanCity && selectedKpi === "kpi1.1" && mapRef.current) {
        const expansionPoints = filterMilanLocalPoints(localCityPoints ?? [], milanPilotId).filter(
          (p) => p.properties?.datasetKind === "expansion-plan"
        );
        const rendered = renderMilanKpi11Layers({
          map: mapRef.current,
          points: expansionPoints.length ? expansionPoints : localCityPoints ?? [],
          scenario,
          activeMapSegmentId,
          segmentInteractionEnabled,
          segmentHandlers,
          circlesOut: circlesRef.current,
          markersOut: markersRef.current,
          fitMap: (coords) => fitMilanOnce(coords, { pilotScoped: true }),
        });
        if (rendered > 0) {
          addInterventionLayer(cityData, showInterventionLayer);
          return;
        }
        addInterventionLayer(cityData, showInterventionLayer);
        return;
      }

      // Milan KPI 1.2 — observed AMAT camera-linked counts first; junction mock fallback.
      if (isMilanCity && selectedKpi === "kpi1.2" && mapRef.current) {
        if (milanSpeedLoading) {
          addInterventionLayer(cityData, showInterventionLayer);
          return;
        }
        if (milanHasObservedModeShareData(localCityPoints, milanPilotId)) {
          const scopedMilanPoints = filterMilanLocalPoints(localCityPoints ?? [], milanPilotId).filter(
            (p) => p.properties?.datasetKind === "amat-count"
          );
          const observedDisplayPoints = buildMilanKpi12MapPoints(
            scopedMilanPoints,
            scenario,
            selectedModeTypes,
            filterRange
          );
          // Every AMAT camera site = one ripple hub (no junction snap drop).
          const hubDisplayPoints = prepareMilanModeShareDisplayPoints(
            observedDisplayPoints,
            milanPilotId
          );
          if (hubDisplayPoints.length) {
            const strictModeFilterActive =
              selectedModeTypes.length > 0 && !areAllTravelModesSelected(selectedModeTypes);
            const modeFilterLabel = strictModeFilterActive
              ? selectedModeTypes.join(", ")
              : "Active mobility (bike + pedestrian)";
            const fitCoords = hubDisplayPoints.map(
              (p) => [p.lat, p.lon] as [number, number]
            );
            fitMilanKpi12Once(fitCoords, { hubPulse: true });
            const renderedObserved = renderMilanMapLayers({
              map: mapRef.current,
              points: hubDisplayPoints,
              scenario,
              selectedSegmentId: activeMapSegmentId,
              segmentHandlers,
              getValueColor,
              modeFilterLabel,
              markersOut: markersRef.current,
              circlesOut: circlesRef.current,
              polylinesOut: polylinesRef.current,
              polygonsOut: polygonsRef.current,
              wireCircleMarker: wireCircleMarkerSegment,
            });
            if (renderedObserved > 0) {
              addInterventionLayer(cityData, showInterventionLayer);
              return;
            }
          }
        }
        if (milanSpeedSegments?.records?.length) {
          // Sticky #02: mode share = ripple hubs only — no speed-network segment underlay.
          const junctions = pickJunctionsForModeSharePresentation(milanSpeedSegments.records);
          let displayPoints = buildMilanJunctionModeShareMockPoints(junctions, milanPilotId);
          displayPoints = buildMilanKpi12MapPoints(
            displayPoints,
            scenario,
            selectedModeTypes,
            filterRange
          );
          if (displayPoints.length) {
            const strictModeFilterActive =
              selectedModeTypes.length > 0 && !areAllTravelModesSelected(selectedModeTypes);
            const modeFilterLabel = strictModeFilterActive
              ? selectedModeTypes.join(", ")
              : "Active mobility (bike + pedestrian)";
            fitMilanKpi12Once(
              junctions.map((j) => [j.lat, j.lon]),
              { hubPulse: true }
            );
            const renderedSites = renderMilanMapLayers({
              map: mapRef.current,
              points: displayPoints,
              scenario,
              selectedSegmentId: activeMapSegmentId,
              segmentHandlers,
              getValueColor,
              modeFilterLabel,
              markersOut: markersRef.current,
              circlesOut: circlesRef.current,
              polylinesOut: polylinesRef.current,
              polygonsOut: polygonsRef.current,
              wireCircleMarker: wireCircleMarkerSegment,
            });
            if (renderedSites > 0) {
              addInterventionLayer(cityData, showInterventionLayer);
              return;
            }
          }
        }
        addInterventionLayer(cityData, showInterventionLayer);
        return;
      }

      // Milan KPI 4.1 — satisfaction survey (SharePoint folder 7, or CDM3 Activity 5 mock when empty).
      if (isMilanCity && selectedKpi === "kpi4.1" && mapRef.current) {
        const surveyPoints = filterMilanLocalPoints(localCityPoints ?? [], milanPilotId).filter(
          (p) => p.properties?.datasetKind === "survey"
        );
        if (surveyPoints.length) {
          const usingMock = surveyPoints.every(
            (p) =>
              p.properties?.dataOrigin === "mock" ||
              p.properties?.mockLabel === "MOCK" ||
              p.properties?.type === "mock"
          );
          renderLocalCityInteractivePoints({
            map: mapRef.current,
            cityName,
            selectedKpi,
            points: surveyPoints,
            filterRange,
            scenario,
            segmentHandlers,
            segmentInteractionEnabled,
            selectedSegmentId: activeMapSegmentId,
            markersOut: markersRef.current,
            circlesOut: circlesRef.current,
            spreadOverlaps: true,
            markerStyle: "filled",
            getValueColor,
          });
          fitMilanPointsOnce(
            surveyPoints.map((p) => [p.lat, p.lon] as [number, number])
          );
          setMilanLayerQa({
            layer: "satisfaction",
            parsed: surveyPoints.length,
            rendered: surveyPoints.length,
            missingJoins: 0,
            invalidGeometry: 0,
            avgValue:
              surveyPoints.reduce((s, p) => s + Number(p.value ?? 0), 0) /
              Math.max(surveyPoints.length, 1),
            dataConfidence: usingMock ? "proxy" : "measured",
            statusMessage: usingMock
              ? `MOCK CDM3 Activity 5 · ${surveyPoints.length} theme samples (SharePoint folder 7 empty)`
              : `Satisfaction survey · ${surveyPoints.length} pilot aggregate${surveyPoints.length === 1 ? "" : "s"}`,
          });
          addInterventionLayer(cityData, showInterventionLayer);
          return;
        }
        addInterventionLayer(cityData, showInterventionLayer);
        return;
      }

      // Milan KPI 4.2 — DSS accessibility rows (observed).
      // Pilot 3 = Pilot 1 + Pilot 2 civic-address points as one combined layer.
      if (isMilanCity && selectedKpi === "kpi4.2" && mapRef.current) {
        if (milanSpeedLoading) {
          addInterventionLayer(cityData, showInterventionLayer);
          return;
        }
        const scopedA11yPoints = filterMilanAccessibilityPoints(
          localCityPoints ?? [],
          milanPilotId
        ).filter((p) => p.properties?.datasetKind === "accessibility");
        if (scopedA11yPoints.length) {
          if (milanSpeedSegments?.records?.length) {
            renderMilanSpeedSegmentUnderlay(
              mapRef.current,
              milanSpeedSegments.records,
              polylinesRef.current,
              { neutral: true, opacityScale: 0.16 }
            );
          }
          renderLocalCityInteractivePoints({
            map: mapRef.current,
            cityName,
            selectedKpi,
            points: scopedA11yPoints,
            filterRange,
            scenario,
            segmentHandlers,
            segmentInteractionEnabled,
            selectedSegmentId: activeMapSegmentId,
            markersOut: markersRef.current,
            circlesOut: circlesRef.current,
            // Keep civic-address positions — fan-out hides DSS category colour clusters.
            spreadOverlaps: false,
            markerStyle: "filled",
            getValueColor,
          });
          fitMilanPointsOnce(scopedA11yPoints.map((p) => [p.lat, p.lon] as [number, number]));
          addInterventionLayer(cityData, showInterventionLayer);
          return;
        }
        if (!milanSpeedLoading && milanSpeedSegments?.records?.length) {
          const junctions = milanJunctionAnchorsForPilot(milanSpeedSegments.records);
          const a11yMockPoints = buildMilanJunctionAccessibilityMockPoints(junctions, milanPilotId);
          if (a11yMockPoints.length) {
            renderMilanSpeedSegmentUnderlay(
              mapRef.current,
              milanSpeedSegments.records,
              polylinesRef.current,
              { neutral: true, opacityScale: 0.16 }
            );
            renderLocalCityInteractivePoints({
              map: mapRef.current,
              cityName,
              selectedKpi,
              points: a11yMockPoints,
              filterRange,
              scenario,
              segmentHandlers,
              segmentInteractionEnabled,
              selectedSegmentId: activeMapSegmentId,
              markersOut: markersRef.current,
              circlesOut: circlesRef.current,
              spreadOverlaps: false,
              markerStyle: "filled",
              getValueColor,
            });
            fitMilanPointsOnce(a11yMockPoints.map((p) => [p.lat, p.lon] as [number, number]));
            addInterventionLayer(cityData, showInterventionLayer);
            return;
          }
        }
        addInterventionLayer(cityData, showInterventionLayer);
        return;
      }

      if (isMilanCity) {
        addInterventionLayer(cityData, showInterventionLayer);
        return;
      }

      // Always show road segments with traffic data
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
              <p style="font-size: 9px; color: #96C2EF; margin-top: 6px;">${formatDataTypeLabel(kpiDefinition?.dataLabel || "Observed")} data</p>
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

      const isCopenhagenCity = cityName.toLowerCase().includes("copenhagen");
      if (isCopenhagenCity && !isCopenhagenCameraKpi(selectedKpi)) {
        addInterventionLayer(cityData, showInterventionLayer);
        return;
      }
      if (isCopenhagenCity && isCopenhagenCameraKpi(selectedKpi)) {
        addInterventionLayer(cityData, showInterventionLayer);
        const pilotCameraIds = getCopenhagenCameraIdsForPilot(selectedPilotId);
        const allObservedPoints = (localCityPoints || []).filter((p) => {
          if (p.properties?.dataOrigin === "local-city-dataset") return true;
          // KPI 4.1 / 4.2 MOCK pins use dataOrigin "mock" (mode-share site reuse).
          if (
            (selectedKpi === "kpi4.1" || selectedKpi === "kpi4.2") &&
            (p.properties?.dataOrigin === "mock" ||
              p.properties?.mockLabel === "MOCK" ||
              p.properties?.type === "mock" ||
              p.properties?.datasetKind === "survey" ||
              p.properties?.datasetKind === "accessibility")
          ) {
            return true;
          }
          return false;
        });
        const observedPoints =
          selectedKpi === "kpi4.2"
            ? allObservedPoints.filter((p) => p.properties?.datasetKind === "accessibility")
            : selectedKpi === "kpi4.1"
              ? allObservedPoints.filter((p) => p.properties?.datasetKind === "survey")
              : allObservedPoints;
        const cphDiagnostics = getLocalCityDiagnostics("Copenhagen", selectedKpi, selectedPilotId);
        const cphAlwaysRenderKpi =
          selectedKpi === "kpi3.1" ||
          selectedKpi === "kpi3.2" ||
          selectedKpi === "kpi4.1" ||
          selectedKpi === "kpi4.2";
        if (observedPoints.length === 0 && !cphAlwaysRenderKpi) {
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
                : selectedKpi === "kpi2.1" &&
                    (scenario === "intervention" || scenario === "comparison")
                  ? "MOCK post/comparison — OTC motor-mix / iRAP proxy"
                  : selectedKpi === "kpi2.1"
                    ? "observed OTC motor-mix / iRAP (baseline)"
                  : "observed directional camera counts",
            temporalCoverage,
            confidence:
              cphDiagnostics?.reason === "files-unavailable" ||
              (selectedKpi === "kpi2.1" &&
                (scenario === "intervention" || scenario === "comparison"))
                ? "Low"
                : "Medium",
            provenanceType:
              selectedKpi === "kpi4.2"
                ? "derived"
                : selectedKpi === "kpi2.1" &&
                    (scenario === "intervention" || scenario === "comparison")
                  ? "mock"
                  : "observed",
            geometryLinkage: selectedKpi === "kpi4.2" ? "matched" : "exact",
            spatialSystemHint:
              selectedKpi === "kpi4.2"
                ? "Parking bay before/after categories — not a formal accessibility audit."
                : selectedKpi === "kpi2.1" &&
                    (scenario === "intervention" || scenario === "comparison")
                  ? "MOCK post/comparison — OTC motor mix / iRAP proxy, not direct crash counts."
                  : selectedKpi === "kpi2.1"
                    ? "OTC motor mix / iRAP proxy (baseline observed) — not direct crash counts."
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
          const parts =
            Number(breakdown?.bike ?? 0) +
            Number(breakdown?.pedestrian ?? 0) +
            Number(breakdown?.motorised ?? 0) +
            Number(breakdown?.ptw ?? 0);
          const total = parts > 0 ? parts : Number(breakdown?.total ?? 0);
          if (total <= 0) return 0;
          const selected = selectedCountFromBreakdown(breakdown);
          return Math.max(0, Math.min(100, (selected / total) * 100));
        };
        const isOtcDirectionalKpi = selectedKpi === "kpi1.1" || selectedKpi === "kpi1.2";
        if (
          isOtcDirectionalKpi &&
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
          selectedKpi === "kpi4.2" || selectedKpi === "kpi4.1"
            ? observedPoints
            : pilotCameraIds
              ? observedPoints.filter((point) => {
                  if (!copenhagenPointUsesOtcCameraFilter(point)) return true;
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
          .filter(({ point, compareValue }) => {
            const datasetKind = String(point.properties?.datasetKind ?? "");
            if (datasetKind && CPH_EXTENDED_MAP_DATASET_KINDS.has(datasetKind)) {
              return true;
            }
            if (selectedKpi === "kpi3.2" && point.properties?.datasetKind === "emissions") {
              return true;
            }
            return compareValue >= filterRange[0] && compareValue <= filterRange[1];
          })
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

      if (cityName.toLowerCase().includes("helsinki")) {
        void renderHelsinkiMapLayers({
          map: mapRef.current!,
          selectedKpi,
          selectedPilotId,
          activeMapSegmentId: hoveredJunctionSegmentId ?? selectedJunctionSegmentId,
          scenario,
          segmentInteractionEnabled,
          segmentHandlers,
          localCityPoints: localCityPoints ?? [],
          filterRange,
          getValueColor,
          wireCircleMarker: wireCircleMarkerSegment,
          circlesOut: circlesRef.current,
          polygonsOut: polygonsRef.current,
          polylinesOut: polylinesRef.current,
          markersOut: markersRef.current,
          circlesInfluenceOut: circlesRef.current as unknown as L.Circle[],
          hslTramSample: helsinkiHslTram,
          innotrafikSummary: helsinkiInnotrafikSummary,
          showInterventionLayer,
        }).then((handled) => {
          if (handled) {
            addInterventionLayer(cityData, false);
          }
        });
        return;
      }

      if (cityName.toLowerCase().includes("zaragoza")) {
        // Partner GIS polygons are exact — keep street-level wheel zoom available.
        mapRef.current?.setMaxZoom?.(18);
        mapRef.current?.setMinZoom?.(4);
        void loadZaragozaInterventionAreasGeoJson().then((geojson) => {
          if (!mapRef.current) return;
          const features = filterValidZaragozaAreaFeatures(geojson.features ?? []);
          const filtered = { ...geojson, features };
          const layer = L.geoJSON(filtered as GeoJSON.GeoJsonObject, {
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
                  <p style="font-size:10px;color:#96C2EF;margin:0;">${
                    isActive ? "Active pilot highlight" : "Contextual outline"
                  }</p>
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
          if (mapRef.current) {
            // Reformado GPKG CAD overlay disabled (street line clutter).
            void loadZaragozaReformadoOverlay(
              mapRef.current,
              L,
              selectedPilotId,
              polygonsRef.current as unknown as L.Layer[]
            );
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
        // Zaragoza — dedicated safety hubs (school conflict / hospital mock speeds).
        if (cityName.toLowerCase().includes("zaragoza") && mapRef.current) {
          const zarSafetySource =
            localCityPoints && localCityPoints.length > 0 ? localCityPoints : [];
          const scopedSafety = filterPointsInPilotZone(
            zarSafetySource,
            cityName,
            selectedPilotId
          );
          const rendered = renderZaragozaKpi21Layers({
            map: mapRef.current,
            points: scopedSafety.length ? scopedSafety : zarSafetySource,
            selectedPilotId,
            activeMapSegmentId,
            scenario,
            segmentInteractionEnabled,
            segmentHandlers,
            markersOut: markersRef.current,
            circlesOut: circlesRef.current,
            wireCircleMarker: wireCircleMarkerSegment,
          });
          if (rendered > 0) {
            addInterventionLayer(cityData, showInterventionLayer);
            return;
          }
        }

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
          const scoped = isMilanCityName(cityName)
            ? filterMilanLocalPoints(localCityPoints, selectedPilotId)
            : filterPointsInPilotZone(localCityPoints, cityName, selectedPilotId);
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
            cityName.toLowerCase().includes("copenhagen") && selectedKpi === "kpi4.2";
          if (isCopenhagenKpi42 || isMilanInterventionPilot) {
            points = [];
          } else {
            // Generate synthetic points
            points = generateHexbinData(cityData, selectedKpi, 200);
          }
        }
        if (isMilanInterventionPilot) {
          points = filterMilanLocalPoints(points as LocalCityPoint[], milanPilotId);
        }
        if (!isMilanInterventionPilot) {
          points = ensureCityCoverage(points, 55, 220);
        }

        const cityKeyLower = cityName.toLowerCase();
        if (cityKeyLower.includes("zaragoza") && selectedKpi === "kpi1.2" && mapRef.current) {
          const scopedLocal = filterPointsInPilotZone(
            localCityPoints && localCityPoints.length > 0
              ? localCityPoints
              : (points as LocalCityPoint[]),
            cityName,
            selectedPilotId
          );
          const pulsePoints =
            scopedLocal.length > 0
              ? scopedLocal
              : ((localCityPoints ?? points) as LocalCityPoint[]);
          if (pulsePoints.length) {
            renderZaragozaKpi12Layers({
              map: mapRef.current,
              points: pulsePoints,
              selectedPilotId,
              activeMapSegmentId,
              scenario,
              segmentInteractionEnabled,
              segmentHandlers,
              markersOut: markersRef.current,
              circlesOut: circlesRef.current,
              wireCircleMarker: wireCircleMarkerSegment,
            });
            addInterventionLayer(cityData, showInterventionLayer);
            return;
          }
        }

        if (
          cityKeyLower.includes("zaragoza") &&
          (selectedKpi === "kpi3.2" || selectedKpi === "kpi4.1") &&
          mapRef.current
        ) {
          const aqSource =
            localCityPoints && localCityPoints.length > 0
              ? localCityPoints
              : (points as LocalCityPoint[]);
          const scopedAq = filterPointsInPilotZone(aqSource, cityName, selectedPilotId);
          const rendered = renderZaragozaKpi32Layers({
            map: mapRef.current,
            points: scopedAq.length ? scopedAq : aqSource,
            selectedKpi,
            selectedPilotId,
            activeMapSegmentId,
            segmentInteractionEnabled,
            segmentHandlers,
            markersOut: markersRef.current,
            circlesOut: circlesRef.current,
          });
          if (rendered > 0) {
            addInterventionLayer(cityData, showInterventionLayer);
            return;
          }
        }

        if (cityKeyLower.includes("zaragoza") && selectedKpi === "kpi4.2" && mapRef.current) {
          const a11ySource =
            localCityPoints && localCityPoints.length > 0
              ? localCityPoints
              : (points as LocalCityPoint[]);
          const scopedA11y = filterPointsInPilotZone(a11ySource, cityName, selectedPilotId);
          const rendered = renderZaragozaKpi42Layers({
            map: mapRef.current,
            points: scopedA11y.length ? scopedA11y : a11ySource,
            scenario,
            selectedPilotId,
            activeMapSegmentId,
            segmentInteractionEnabled,
            segmentHandlers,
            markersOut: markersRef.current,
            circlesOut: circlesRef.current,
          });
          if (rendered > 0) {
            addInterventionLayer(cityData, showInterventionLayer);
            return;
          }
        }

        const lighthouseLocalPoints =
          cityKeyLower.includes("helsinki") &&
          localCityPoints &&
          localCityPoints.length > 0;
        if (lighthouseLocalPoints && selectedKpi === "kpi1.2") {
          const scopedLocal = filterPointsInPilotZone(
            localCityPoints,
            cityName,
            selectedPilotId
          );
          if (scopedLocal.length && mapRef.current) {
            renderLocalCityInteractivePoints({
              map: mapRef.current,
              cityName,
              selectedKpi,
              points: scopedLocal,
              filterRange,
              scenario,
              segmentHandlers,
              segmentInteractionEnabled,
              selectedSegmentId: activeMapSegmentId,
              markersOut: markersRef.current,
              circlesOut: circlesRef.current,
              getValueColor,
            });
            addInterventionLayer(cityData, showInterventionLayer);
            return;
          }
        }

        const isCopenhagenCity = cityName.toLowerCase().includes("copenhagen");
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

        const values = points.map((p) => {
          const props = p.properties || {};
          const baseline = Number(props.baselineValue ?? p.value ?? 0);
          const intervention = Number(props.interventionValue ?? p.value ?? 0);
          const comparison =
            typeof props.comparisonValue === "number"
              ? Number(props.comparisonValue)
              : intervention - baseline;
          return mapScenarioDisplayValue(scenario, baseline, intervention, {
            comparison,
            kind: kpiMetricKind(selectedKpi),
          });
        });
        const minValue = Math.min(...values);
        const maxValue = Math.max(...values);
        const valueRange = maxValue - minValue || 1;

        // Filter by mode types for Mode Share KPI
        const shouldFilterByMode = selectedKpi === "kpi1.2" && selectedModeTypes && selectedModeTypes.length > 0;
        
        points.forEach((point, pointIndex) => {
          const displayValue = values[pointIndex] ?? point.value;
          if (displayValue < filterRange[0] || displayValue > filterRange[1]) return;
          
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
            displayValue,
            selectedKpi === "kpi2.1",
            selectedKpi === "kpi3.1" ? props.type_amgt_cycl : undefined
          );
          
          const normalizedValue = (displayValue - minValue) / valueRange;
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
          
          const isCph = cityName.toLowerCase().includes("copenhagen") &&
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
        const cityKeyLower = cityName.toLowerCase();
        if (
          cityKeyLower.includes("zaragoza") &&
          (selectedKpi === "kpi3.2" || selectedKpi === "kpi4.1") &&
          mapRef.current
        ) {
          const aqSource =
            localCityPoints && localCityPoints.length > 0
              ? localCityPoints
              : [];
          const scopedAq = filterPointsInPilotZone(aqSource, cityName, selectedPilotId);
          const rendered = renderZaragozaKpi32Layers({
            map: mapRef.current,
            points: scopedAq.length ? scopedAq : aqSource,
            selectedKpi,
            selectedPilotId,
            activeMapSegmentId,
            segmentInteractionEnabled,
            segmentHandlers,
            markersOut: markersRef.current,
            circlesOut: circlesRef.current,
          });
          addInterventionLayer(cityData, showInterventionLayer);
          if (rendered > 0) return;
        }

        if (cityKeyLower.includes("zaragoza") && selectedKpi === "kpi4.2" && mapRef.current) {
          const a11ySource =
            localCityPoints && localCityPoints.length > 0 ? localCityPoints : [];
          const scopedA11y = filterPointsInPilotZone(a11ySource, cityName, selectedPilotId);
          const rendered = renderZaragozaKpi42Layers({
            map: mapRef.current,
            points: scopedA11y.length ? scopedA11y : a11ySource,
            scenario,
            selectedPilotId,
            activeMapSegmentId,
            segmentInteractionEnabled,
            segmentHandlers,
            markersOut: markersRef.current,
            circlesOut: circlesRef.current,
          });
          addInterventionLayer(cityData, showInterventionLayer);
          if (rendered > 0) return;
        }
        const lighthouseAreaLocal =
          (cityKeyLower.includes("helsinki") ||
            cityKeyLower.includes("milan") ||
            cityKeyLower.includes("zaragoza")) &&
          localCityPoints &&
          localCityPoints.length > 0;
        if (
          lighthouseAreaLocal &&
          (selectedKpi === "kpi4.2" ||
            (selectedKpi === "kpi2.1" &&
              !cityKeyLower.includes("helsinki") &&
              !cityKeyLower.includes("milan"))) &&
          mapRef.current
        ) {
          const scopedLocal = isMilanCityName(cityName)
            ? filterMilanLocalPoints(localCityPoints, selectedPilotId)
            : filterPointsInPilotZone(localCityPoints, cityName, selectedPilotId);
          if (scopedLocal.length) {
            renderLocalCityInteractivePoints({
              map: mapRef.current,
              cityName,
              selectedKpi,
              points: scopedLocal,
              filterRange,
              scenario,
              segmentHandlers,
              segmentInteractionEnabled,
              selectedSegmentId: activeMapSegmentId,
              markersOut: markersRef.current,
              circlesOut: circlesRef.current,
              getValueColor,
            });
            addInterventionLayer(cityData, showInterventionLayer);
            return;
          }
        }
        if (cityName.toLowerCase().includes("copenhagen") && isCopenhagenCameraKpi(selectedKpi)) {
          addInterventionLayer(cityData, showInterventionLayer);
          return;
        }
        if (cityName.toLowerCase().includes("copenhagen") && selectedKpi === "kpi4.2") {
          addInterventionLayer(cityData, showInterventionLayer);
          return;
        }
        if (isIssy && selectedKpi === "kpi3.2") {
          addInterventionLayer(cityData, showInterventionLayer, true);
          return;
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
            const props = point.properties || {};
            const baseline = Number(props.baselineValue ?? point.value ?? 0);
            const intervention = Number(props.interventionValue ?? point.value ?? 0);
            const comparison =
              typeof props.comparisonValue === "number"
                ? Number(props.comparisonValue)
                : intervention - baseline;
            const scenarioValue = mapScenarioDisplayValue(scenario, baseline, intervention, {
              comparison,
              kind: "pressure",
            });
            if (scenarioValue < filterRange[0] || scenarioValue > filterRange[1]) return;
            const key = `${Math.round(point.lat * 170)}_${Math.round(point.lon * 170)}`;
            const existing = climateBuckets.get(key);
            if (existing) {
              existing.lat += point.lat;
              existing.lon += point.lon;
              existing.total += scenarioValue;
              existing.count += 1;
            } else {
              climateBuckets.set(key, {
                lat: point.lat,
                lon: point.lon,
                total: scenarioValue,
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
                ? `<p style="font-size: 10px; color: #A78BFA; margin-top: 4px; font-weight: 600;">Chart period ${kpi32SelectedYear} · series intensity ${yearAnchor.toFixed(1)}%</p>`
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
              ${selectedKpi === "kpi3.2" && kpi32SelectedYear ? `<p style="font-size: 10px; color: #A78BFA; margin: 2px 0; font-weight: 600;">Chart period ${kpi32SelectedYear} (city time series)</p>` : ''}
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
      milanSpeedLoading,
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
    const isHelsinki = currentCity?.toLowerCase().includes("helsinki");
    const isZaragoza = currentCity?.toLowerCase().includes("zaragoza");
    const isMilan = currentCity?.toLowerCase().includes("milan");
    // Exact GIS / AMAT corridor cities — never inherit the inferred maxZoom=12 lock.
    const unlockedMaxZoom =
      isHelsinki || isZaragoza || isMilan ? 18 : pilotGeometrySpec.maxZoom;
    mapRef.current.setMaxZoom(unlockedMaxZoom);
    if (pilotGeometrySpec.minZoom != null && !isHelsinki && !isZaragoza && !isMilan) {
      mapRef.current.setMinZoom(pilotGeometrySpec.minZoom);
    } else {
      mapRef.current.setMinZoom(4);
    }
  }, [pilotGeometrySpec?.maxZoom, pilotGeometrySpec?.minZoom, isTrikalaCity, currentCity]);

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
    if (currentCity.toLowerCase() === "milan" && selectedKpi === "kpi3.1") {
      const scoped = filterMilanLocalPoints(localCityPoints ?? [], selectedPilotId).filter(
        (p) => p.properties?.datasetKind === "parking"
      );
      const siteKpi = aggregateMilanFacilitySiteKpi(scoped);
      const visible = filterMilanFacilityPointsForScenario(scoped, scenario).length;
      onDataQualitySummaryChange({
        recordsLabel: `${visible} zero-emission facility site${visible === 1 ? "" : "s"}`,
        spatialQuality: "pilot corridor placement · taxonomy badges",
        dataType: "illustrative KPI 3.1 facility inventory",
        temporalCoverage: "illustrative baseline vs post-intervention deployment",
        confidence: scoped.length >= 4 ? "Medium" : "Low",
        provenanceType: "mock",
        geometryLinkage: "matched",
        spatialSystemHint: `${siteKpi.baselineMain} baseline sites → ${siteKpi.interventionMain} intervention sites`,
      });
      return;
    }
    if (currentCity.toLowerCase() === "milan" && selectedKpi === "kpi2.1") {
      if (milanSpeedLoading) return;
      if (!milanSpeedSegments) return;
      const total = Math.max(1, milanSpeedSegments.stats.parsedSegments);
      const inferredPct = Math.min(100, Math.round((milanSpeedSegments.stats.missingMetricJoins / total) * 100));
      const matchedPct = Math.max(0, 100 - inferredPct);
      const joinPct = milanSpeedSegments.stats.cameraJoinRatePct;
      const probabilistic = pilotGeometrySpec?.interactionModel === "network";
      const postComparisonMock = scenario === "intervention" || scenario === "comparison";
      onDataQualitySummaryChange({
        recordsLabel: `${milanSpeedSegments.stats.parsedSegments.toLocaleString()} segments`,
        spatialQuality: probabilistic
          ? `probabilistic CO₂/noise network${aggregateLabel}${reductionNote}`
          : `${matchedPct}% metric-matched${joinPct != null ? ` · ${joinPct}% camera-linked` : ""}${aggregateLabel}`,
        dataType: postComparisonMock
          ? "MOCK post/comparison — AMAT speed baseline only"
          : "observed AMAT speed / risk proxy",
        temporalCoverage: postComparisonMock
          ? "baseline observed · post/comparison MOCK"
          : "2024 snapshot",
        confidence: postComparisonMock ? "Low" : matchedPct >= 50 ? "Medium" : "Low",
        provenanceType: postComparisonMock ? "mock" : "observed",
        geometryLinkage: probabilistic ? "inferred" : "matched",
        spatialSystemHint: postComparisonMock
          ? "MOCK post/comparison — not direct crash evidence."
          : "AMAT speed / risk proxy — not direct crash evidence.",
      });
      return;
    }
    if (currentCity.toLowerCase() === "milan" && selectedKpi === "kpi1.2") {
      if (milanSpeedLoading) return;
      const scoped = filterMilanLocalPoints(localCityPoints ?? [], selectedPilotId).filter(
        (p) => p.properties?.datasetKind === "amat-count"
      );
      const observed = scoped.filter(
        (p) =>
          p.properties?.dataOrigin !== "mock" &&
          p.properties?.parserStatus !== "illustrative" &&
          p.properties?.spatialQuality === "matched"
      );
      const junctionCount = milanSpeedSegments?.records?.length
        ? pickJunctionsForModeSharePresentation(milanSpeedSegments.records).length
        : 0;
      const usingMock = !milanHasObservedModeShareData(localCityPoints, selectedPilotId ?? "mil-p2");
      const postComparisonMock = scenario === "intervention" || scenario === "comparison";
      const matchedCount = observed.length;
      const hasEvaluation = observed.some((p) => p.properties?.temporalCoverage !== "baseline-only");
      onDataQualitySummaryChange({
        recordsLabel: usingMock
          ? `${junctionCount || 0} MOCK junction hubs (Copenhagen-style ripples)`
          : `${matchedCount.toLocaleString()} AMAT count site${matchedCount === 1 ? "" : "s"}`,
        spatialQuality: usingMock
          ? "KPI 2.1 safety network anchors · CPH hub ripples"
          : "AMAT peak-hour counts · camera shapefile linkage · CPH hub ripples",
        dataType: usingMock
          ? "MOCK illustrative junction mode-share"
          : postComparisonMock
            ? "MOCK post/comparison — AMAT baseline only"
            : "observed AMAT road user counts (baseline)",
        temporalCoverage: usingMock
          ? "MOCK demo"
          : postComparisonMock
            ? "baseline observed · post/comparison MOCK"
            : hasEvaluation
              ? "baseline vs evaluation (8:30–9:30)"
              : "baseline counts only",
        confidence:
          usingMock || postComparisonMock
            ? "Low"
            : matchedCount >= 3
              ? "High"
              : "Medium",
        provenanceType: usingMock || postComparisonMock ? "mock" : "observed",
        geometryLinkage: usingMock ? "inferred" : "matched",
        spatialSystemHint: spatialPlan.legendHint,
      });
      return;
    }
    if (currentCity.toLowerCase() === "milan" && selectedKpi === "kpi3.2") {
      if (milanEnvLoading || milanSpeedLoading) return;
      const envRecords = milanEnvironmentSegments?.records?.length ?? 0;
      const hasObservedEnv = milanHasObservedClimateData(milanEnvironmentSegments);
      const speedCount = milanSpeedSegments?.records?.length ?? 0;
      const usingMock = !hasObservedEnv && speedCount > 0;
      onDataQualitySummaryChange({
        recordsLabel: usingMock
          ? `${Math.min(8, speedCount)} illustrative climate proxies on network.shp`
          : envRecords
            ? `${envRecords.toLocaleString()} RETE segments`
            : "RETE environmental network unavailable",
        spatialQuality: usingMock
          ? "AMAT network.shp samples · illustrative climate mock"
          : `derived environmental proxy · ${selectedPilotId ?? "city"} buffer`,
        dataType: usingMock ? "illustrative network climate mock" : "RETE traffic composition proxy",
        temporalCoverage: usingMock
          ? "illustrative demo"
          : (milanEnvironmentWindow ?? (scenario === "baseline" ? "08-09" : "18-19")) === "08-09"
            ? "Morning 08–09"
            : "Evening 18–19",
        confidence: usingMock ? "Low" : envRecords > 0 ? "Medium" : "Low",
        provenanceType: usingMock ? "mock" : envRecords > 0 ? "derived" : "mock",
        geometryLinkage: usingMock ? "inferred" : "matched",
        spatialSystemHint: spatialPlan.legendHint,
      });
      return;
    }
    if (currentCity.toLowerCase() === "milan" && selectedKpi === "kpi4.1") {
      const scoped = filterMilanLocalPoints(localCityPoints ?? [], selectedPilotId).filter(
        (p) =>
          p.properties?.datasetKind === "survey" ||
          p.properties?.dataOrigin === "mock" ||
          p.properties?.mockLabel === "MOCK"
      );
      const usingMock =
        scoped.length > 0 &&
        scoped.every(
          (p) =>
            p.properties?.dataOrigin === "mock" ||
            p.properties?.mockLabel === "MOCK" ||
            p.properties?.type === "mock"
        );
      const diagnostics = getLocalCityDiagnostics("Milan", selectedKpi, selectedPilotId);
      onDataQualitySummaryChange({
        recordsLabel: scoped.length
          ? usingMock
            ? `${scoped.length} MOCK CDM3 Activity 5 theme samples`
            : `${scoped.length} satisfaction survey aggregate${scoped.length === 1 ? "" : "s"}`
          : diagnostics?.message || "No Milan satisfaction survey linked",
        spatialQuality: usingMock
          ? "CDM3 corridor theme pins · illustrative"
          : "pilot-area anchor (no respondent geocoordinates)",
        dataType: usingMock
          ? "mock CDM3 Activity 5 satisfaction proxy"
          : "satisfaction survey aggregate",
        temporalCoverage: usingMock ? "illustrative before-after" : "evaluation period",
        confidence: usingMock ? "Low" : scoped.length > 0 ? "Medium" : "Low",
        provenanceType: usingMock ? "mock" : scoped.length > 0 ? "observed" : "mock",
        geometryLinkage: usingMock ? "inferred" : "inferred",
        spatialSystemHint: usingMock
          ? "MOCK — SharePoint folder 7 (Satisfaction LL) is empty; pins use CDM3 Activity 5 theme samples."
          : spatialPlan.legendHint,
      });
      return;
    }
    if (currentCity.toLowerCase() === "milan" && selectedKpi === "kpi4.2") {
      const scoped = filterMilanAccessibilityPoints(localCityPoints ?? [], selectedPilotId).filter(
        (p) => p.properties?.datasetKind === "accessibility"
      );
      const observed = scoped.filter(
        (p) => p.properties?.dataOrigin !== "mock" && p.properties?.parserStatus !== "illustrative"
      );
      const junctionCount = milanJunctionAnchorsForPilot(milanSpeedSegments?.records).length;
      const usingMock = observed.length === 0 && junctionCount > 0;
      const isCombined = selectedPilotId === "mil-p3";
      onDataQualitySummaryChange({
        recordsLabel: usingMock
          ? `${junctionCount} illustrative accessibility junction hubs`
          : isCombined
            ? `${scoped.length.toLocaleString()} DSS points (Pilot 1 + Pilot 2 combined)`
            : `${scoped.length.toLocaleString()} DSS civic-address points`,
        spatialQuality: usingMock
          ? "KPI 2.1 junction anchors · illustrative accessibility mock"
          : isCombined
            ? "matched DSS routing · Pilot 1 ∪ Pilot 2"
            : "matched DSS routing shapefile (EPSG:3003 → WGS84)",
        dataType: usingMock
          ? "illustrative junction accessibility mock"
          : isCombined
            ? "DSS civic-address routing · combined Pilot 1 + 2"
            : "DSS civic-address routing points",
        temporalCoverage: usingMock ? "illustrative demo" : "baseline vs post-intervention",
        confidence: usingMock ? "Low" : scoped.length > 0 ? "High" : "Low",
        provenanceType: usingMock ? "mock" : scoped.length > 0 ? "observed" : "mock",
        geometryLinkage: usingMock ? "inferred" : "matched",
        spatialSystemHint: spatialPlan.legendHint,
      });
      return;
    }
    if (currentCity.toLowerCase().includes("helsinki")) {
      const total = localCityPoints?.length || 0;
      const linkage =
        localCityPoints?.some((p) => p.properties?.geometryLinkage === "matched") ? "matched" : "inferred";
      const isP1ModeShareMock = selectedPilotId === "hel-p1" && selectedKpi === "kpi1.2";
      const isP2ModeShareMock = selectedPilotId === "hel-p2" && selectedKpi === "kpi1.2";
      const isClimateMock = selectedKpi === "kpi3.2";
      const isRoadSafety = selectedKpi === "kpi2.1";
      const roadSafetyPostMock =
        isRoadSafety && (scenario === "intervention" || scenario === "comparison");
      const isHelsinkiMock =
        isP1ModeShareMock || isP2ModeShareMock || isClimateMock || roadSafetyPostMock;
      onDataQualitySummaryChange({
        recordsLabel: isP1ModeShareMock
          ? `${Math.min(8, total || 8)} mock mode-share hubs`
          : isP2ModeShareMock
            ? `${Math.min(8, total || 8)} mock mode-share hubs`
            : isClimateMock
              ? `${Math.min(220, total || 220)} mock climate points`
              : isRoadSafety
                ? `${total.toLocaleString()} road-safety points`
                : `${total.toLocaleString()} points`,
        spatialQuality:
          (isP1ModeShareMock
            ? "Density hub layout (illustrative)"
            : isP2ModeShareMock
              ? "Kallio density anchors (illustrative mode-share hubs)"
              : isClimateMock
                ? "Hazard-density climate proxy (illustrative)"
                : isRoadSafety
                  ? roadSafetyPostMock
                    ? "MOCK post/comparison — survey / conflict density proxy"
                    : "Survey / conflict density proxy (baseline observed)"
                  : linkage === "matched"
                    ? "Telraam coordinates when present"
                    : "inferred ring layout") +
          aggregateLabel +
          reductionNote,
        dataType: isP1ModeShareMock
          ? "mock mode-share hubs (no FVH1 Telraam)"
          : isP2ModeShareMock
            ? "mock mode-share hubs (no FVH2 Telraam)"
            : isClimateMock
              ? "mock climate pressure (not ambient CO₂)"
              : isRoadSafety
                ? roadSafetyPostMock
                  ? "MOCK post/comparison — road safety evaluation pending"
                  : "observed survey / conflict density (baseline)"
                : selectedKpi === "kpi1.2"
                  ? "observed Telraam counts"
                  : "derived Telraam proxy",
        temporalCoverage: isHelsinkiMock
          ? roadSafetyPostMock
            ? "baseline observed · post/comparison MOCK"
            : "illustrative single-period"
          : "before-after",
        confidence: isHelsinkiMock
          ? "Low"
          : uncertainty === "high" || linkage === "inferred"
            ? "Low"
            : "Medium",
        provenanceType: isHelsinkiMock
          ? "mock"
          : selectedKpi === "kpi1.2" || isRoadSafety
            ? "observed"
            : "derived",
        geometryLinkage: isHelsinkiMock && !isRoadSafety ? "inferred" : linkage,
        spatialSystemHint: spatialPlan.legendHint,
      });
      return;
    }
    if (currentCity.toLowerCase().includes("copenhagen")) {
      const kpiUnavailable = !isCopenhagenCameraKpi(selectedKpi);
      const cphDiagnostics = getLocalCityDiagnostics("Copenhagen", selectedKpi, selectedPilotId);
      const points = localCityPoints ?? [];
      if (selectedKpi === "kpi4.1") {
        const mockPins = points.filter(
          (p) =>
            p.properties?.dataOrigin === "mock" ||
            p.properties?.mockLabel === "MOCK" ||
            p.properties?.datasetKind === "survey"
        );
        onDataQualitySummaryChange({
          recordsLabel: mockPins.length
            ? `${mockPins.length} MOCK satisfaction pin${mockPins.length === 1 ? "" : "s"} (mode-share sites)`
            : cphDiagnostics?.message || "MOCK satisfaction placeholder",
          spatialQuality: "KPI 1.2 OTC / mode-share corridor sites (reused)",
          dataType: "mock satisfaction placeholder",
          temporalCoverage: "demo scenario",
          confidence: "Low",
          provenanceType: "mock",
          geometryLinkage: "matched",
          spatialSystemHint:
            "MOCK — not live Acceptability_Intervention1 survey geodata. Pins reuse mode-share corridor sites.",
        });
        return;
      }
      if (selectedKpi === "kpi4.2") {
        const mockPins = points.filter(
          (p) =>
            p.properties?.dataOrigin === "mock" ||
            p.properties?.mockLabel === "MOCK" ||
            p.properties?.datasetKind === "accessibility"
        );
        onDataQualitySummaryChange({
          recordsLabel: mockPins.length
            ? `${mockPins.length} MOCK accessibility pin${mockPins.length === 1 ? "" : "s"} (mode-share sites)`
            : cphDiagnostics?.message || "MOCK accessibility placeholder",
          spatialQuality: "KPI 1.2 OTC / mode-share corridor sites (reused)",
          dataType: "mock accessibility / security placeholder",
          temporalCoverage: "demo scenario",
          confidence: "Low",
          provenanceType: "mock",
          geometryLinkage: "matched",
          spatialSystemHint:
            "MOCK — survey-style accessibility/security placeholder (interviews / walks). Not EN 17210 or parking conversion proxy.",
        });
        return;
      }
      if (selectedKpi === "kpi3.1") {
        const parking = points.filter((p) => p.properties?.datasetKind === "parking");
        const n = parking.length;
        onDataQualitySummaryChange({
          recordsLabel: n
            ? `${n.toLocaleString()} bicycle parking / facility bay${n === 1 ? "" : "s"}`
            : cphDiagnostics?.message || "Parking facility inventory",
          spatialQuality: "matched street-name join · I100275 Medieval City inventory",
          dataType: "observed zero-emission facility inventory (bike parking bays)",
          temporalCoverage: "2024–2025 deployment inventory",
          confidence: n >= 20 ? "High" : n > 0 ? "Medium" : "Low",
          provenanceType: "observed",
          geometryLinkage: "matched",
          spatialSystemHint:
            "Source: I100275 parking overview (SharePoint) · Method: bicycle parking / zero-emission facility bay inventory — not OpenTrafficCam counts.",
        });
        return;
      }
      if (selectedKpi === "kpi3.2") {
        onDataQualitySummaryChange({
          recordsLabel: cphDiagnostics?.message || "OTC-derived emissions pressure",
          spatialQuality: "OTC hub sites · modelled intensity",
          dataType: "modelled climate / emissions pressure (COPERT-lite proxy)",
          temporalCoverage: "before-after",
          confidence: "Medium",
          provenanceType: "modelled",
          geometryLinkage: "exact",
          spatialSystemHint:
            "Source: COPERT-lite emissions model on OTC hubs · Method: modelled pressure index — not ambient CO₂ sensors.",
        });
        return;
      }
      // Only OTC directional flows — not Telraam / Platomo / survey / etc. merged into localCityPoints.
      const otcDirectional = points.filter((p) => {
        const kind = String(p.properties?.datasetKind ?? "");
        if (kind && kind !== "otc") return false;
        return Boolean(
          p.properties?.modeBreakdown ||
            p.properties?.direction ||
            p.properties?.otcWorkbookKey
        );
      });
      const siteKeys = new Set(
        otcDirectional
          .map((p) =>
            String(
              p.properties?.otcWorkbookKey ??
                inferOtcWorkbookKey(String(p.properties?.streetName ?? "")) ??
                ""
            )
          )
          .filter(Boolean)
      );
      const flowCount = otcDirectional.length;
      const siteCount = siteKeys.size;
      const isRoadSafety = selectedKpi === "kpi2.1";
      const roadSafetyPostMock =
        isRoadSafety && (scenario === "intervention" || scenario === "comparison");
      const recordsLabel = kpiUnavailable
        ? "KPI preview only — not available yet"
        : cphDiagnostics?.reason === "files-unavailable"
          ? "Observed directional source unavailable"
          : cphDiagnostics?.reason === "pilot-scope-empty"
            ? "No observed directional mobility records for the selected configuration."
            : siteCount > 0
              ? `${siteCount} OpenTrafficCam site${siteCount === 1 ? "" : "s"} · ${flowCount} directional flow${flowCount === 1 ? "" : "s"}`
              : "OpenTrafficCam directional counts (pre/post)";
      onDataQualitySummaryChange({
        recordsLabel,
        spatialQuality: "exact OpenTrafficCam coordinates",
        dataType: kpiUnavailable
          ? "preview state"
          : roadSafetyPostMock
            ? "MOCK post/comparison — OTC motor-mix / iRAP proxy"
            : isRoadSafety
              ? "observed OTC motor-mix / iRAP pressure (baseline)"
              : "observed",
        temporalCoverage:
          !kpiUnavailable && cphDiagnostics?.reason === "files-unavailable"
            ? "source unavailable"
            : roadSafetyPostMock
              ? "baseline observed · post/comparison MOCK"
              : "before-after",
        confidence:
          kpiUnavailable || cphDiagnostics?.reason === "files-unavailable" || roadSafetyPostMock
            ? "Low"
            : flowCount >= 4
              ? "High"
              : "Medium",
        provenanceType: kpiUnavailable
          ? "derived"
          : roadSafetyPostMock
            ? "mock"
            : "observed",
        geometryLinkage: "exact",
        spatialSystemHint: kpiUnavailable
          ? spatialPlan.legendHint
          : roadSafetyPostMock
            ? "MOCK post/comparison — OTC motor mix / iRAP proxy, not direct crash counts."
            : isRoadSafety
              ? "OTC motor mix / iRAP proxy (baseline observed) — not direct crash counts."
              : "Source: OpenTrafficCam Excel · Method: observed counts by camera direction and movement category (not city-wide modal share).",
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
          ? `ASIF model · ${Math.round(issyClasseur.totalBaselineCo2G)} g CO₂/h city total`
          : "City climate time series (1 reading)",
        spatialQuality: "city-wide (single intensity)",
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
      const zoneCount =
        isIssyCityWideModeSharePilot(selectedPilotId) ? getIssyZoneCentroids().length : null;
      onDataQualitySummaryChange({
        recordsLabel: `${issyFlows.length.toLocaleString()} zone flows${winticsNote}`,
        spatialQuality:
          isIssyCityWideModeSharePilot(selectedPilotId)
            ? `city OD zones (${zoneCount ?? 6} centroids)`
            : "zone-flow linkage",
        dataType: "observed baseline/post flows",
        temporalCoverage: "before-after",
        confidence: "High",
        provenanceType: "observed",
        geometryLinkage: "matched",
        spatialSystemHint:
          isIssyCityWideModeSharePilot(selectedPilotId)
            ? "City-scale sustainable mobility % at OD zone centroids"
            : spatialPlan.legendHint,
      });
      return;
    }
    if (currentCity.toLowerCase().includes("zaragoza")) {
      const points = localCityPoints ?? [];
      const isMockPoint = (p: (typeof points)[number]) => {
        const type = String(p.properties?.type ?? "").toLowerCase();
        const origin = String(p.properties?.dataOrigin ?? "").toLowerCase();
        return (
          type === "mock" ||
          origin === "mock" ||
          p.properties?.mockLabel === "MOCK" ||
          String(p.properties?.sourceFile ?? "").startsWith("mock://")
        );
      };
      const isObservedPoint = (p: (typeof points)[number]) => {
        if (isMockPoint(p)) return false;
        const type = String(p.properties?.type ?? "").toLowerCase();
        const origin = String(p.properties?.dataOrigin ?? "").toLowerCase();
        return type === "observed" || origin === "local-city-dataset";
      };
      const isDerivedPoint = (p: (typeof points)[number]) => {
        if (isMockPoint(p) || isObservedPoint(p)) return false;
        const type = String(p.properties?.type ?? "").toLowerCase();
        return type === "derived" || type === "modelled" || type === "modeled";
      };
      const mockCount = points.filter(isMockPoint).length;
      const observedCount = points.filter(isObservedPoint).length;
      const derivedCount = points.filter(isDerivedPoint).length;
      const linkage = points.some((p) => p.properties?.geometryLinkage === "matched")
        ? "matched"
        : points.length > 0
          ? "inferred"
          : "inferred";
      const kinds = [
        ...new Set(
          points
            .map((p) => String(p.properties?.datasetKind ?? "").trim())
            .filter(Boolean)
        ),
      ];
      const kindHint = kinds.length ? kinds.slice(0, 3).join(" · ") : "local points";
      let provenanceType: "observed" | "derived" | "mock" = "mock";
      let dataType = "illustrative placeholder";
      let confidence: "High" | "Medium" | "Low" = "Low";
      if (selectedKpi === "kpi2.1") {
        const postMock = scenario === "intervention" || scenario === "comparison";
        provenanceType = postMock ? "mock" : "observed";
        dataType = postMock
          ? "MOCK post/comparison — corridor / school pressure"
          : "observed corridor / school pressure (baseline)";
        confidence = postMock ? "Low" : observedCount >= 2 ? "Medium" : "Low";
      } else if (observedCount > 0 && observedCount >= mockCount) {
        provenanceType = "observed";
        dataType = `observed ${kindHint}`;
        confidence = observedCount >= 2 ? "Medium" : "Low";
      } else if (observedCount > 0) {
        // Mixed observed + mock pins for this KPI — trust map evidence as observed.
        provenanceType = "observed";
        dataType = `observed + mock mix · ${kindHint}`;
        confidence = "Low";
      } else if (derivedCount > 0 && derivedCount >= mockCount) {
        provenanceType = "derived";
        dataType = `derived ${kindHint}`;
        confidence = "Low";
      } else if (mockCount > 0) {
        provenanceType = "mock";
        dataType =
          selectedKpi === "kpi4.1"
            ? "mock satisfaction at AQ / corridor sites"
            : selectedKpi === "kpi4.2"
              ? "mock accessibility features"
              : selectedKpi === "kpi3.2"
                ? "mock climate / env intensity pins"
                : "mock placeholder pins";
        confidence = "Low";
      } else {
        // Intervention GIS only — no KPI point series for this selection.
        provenanceType = "derived";
        dataType = "intervention GIS only (no KPI point series)";
        confidence = "Low";
      }
      onDataQualitySummaryChange({
        recordsLabel: points.length
          ? `${points.length.toLocaleString()} point${points.length === 1 ? "" : "s"} · ${kindHint}`
          : "Intervention area GIS · no KPI point series",
        spatialQuality:
          (linkage === "matched" ? "matched site coordinates" : "inferred pilot placement") +
          aggregateLabel,
        dataType,
        temporalCoverage: points.length > 0 ? "before-after where available" : "unavailable",
        confidence,
        provenanceType,
        geometryLinkage: linkage,
        spatialSystemHint: spatialPlan.legendHint,
      });
      return;
    }
    if (currentCity.toLowerCase().includes("trikala")) {
      const total = localCityPoints?.length || 0;
      const infraCount = trikalaInfrastructureLocations.length;
      const triP2MockKpi =
        selectedPilotId === "tri-p2" && (selectedKpi === "kpi1.2" || selectedKpi === "kpi4.1");
      const triRoadSafety = selectedKpi === "kpi2.1";
      const triRoadSafetyPostMock =
        triRoadSafety && (scenario === "intervention" || scenario === "comparison");
      const triP4Mock = selectedPilotId === "tri-p4" && selectedKpi !== "kpi4.1";
      const triP4ObservedSatisfaction = selectedPilotId === "tri-p4" && selectedKpi === "kpi4.1";
      const triMockKpi = triP2MockKpi || triRoadSafetyPostMock || triP4Mock;
      const spatialQuality =
        infraCount > 0
          ? `partner GIS (${infraCount} mapped features)`
          : "inferred pilot anchor (survey aggregates)";
      const recordsLabel =
        infraCount > 0
          ? `${infraCount.toLocaleString()} GIS features · ${total.toLocaleString()} survey aggregates`
          : `${total.toLocaleString()} survey aggregates`;
      onDataQualitySummaryChange({
        recordsLabel: triP4ObservedSatisfaction
          ? "Observed SMARTA2 user satisfaction (Pilot 4)"
          : triP4Mock
          ? selectedKpi === "kpi3.2"
            ? "MOCK climate · Smart Citizen Kit geography (Pilot 4)"
            : selectedKpi === "kpi1.2"
              ? "MOCK mode share · Pilot 4 SMARTA2 / survey proxy"
              : "MOCK · Pilot 4"
          : triP2MockKpi
          ? selectedKpi === "kpi1.2"
            ? "MOCK mode share · 3 P+R hubs (partner occupancy survey pending)"
            : "MOCK satisfaction · 3 P+R hubs (no user survey linked)"
          : triRoadSafetyPostMock
            ? "MOCK post/comparison — occupancy / speed evaluation pending"
            : triRoadSafety
              ? "Observed LoRa occupancy / speed (baseline)"
              : recordsLabel,
        spatialQuality,
        dataType: triP4ObservedSatisfaction
          ? "observed SMARTA2 user satisfaction survey"
          : triP4Mock
          ? "MOCK — Pilot 4 illustrative / proxy data"
          : triP2MockKpi
          ? selectedKpi === "kpi1.2"
            ? "MOCK bike uptake / mode-share mix at P+R hubs"
            : "MOCK user satisfaction at P+R hubs"
          : triRoadSafetyPostMock
            ? "MOCK post/comparison — LoRa occupancy / constructed speed"
            : triRoadSafety
              ? "observed LoRa occupancy / constructed speed (baseline)"
              : infraCount > 0
                ? "observed GIS + survey aggregates"
                : "observed survey Likert aggregates",
        temporalCoverage: triMockKpi
          ? triRoadSafetyPostMock
            ? "baseline observed · post/comparison MOCK"
            : "mock placeholder"
          : triP4ObservedSatisfaction || total > 0
            ? "before-after"
            : "unavailable",
        confidence: triMockKpi
          ? "Low"
          : triP4ObservedSatisfaction || infraCount > 0 || total > 0
            ? "Medium"
            : "Low",
        provenanceType: triMockKpi ? "mock" : "observed",
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
    milanSpeedLoading,
    milanEnvironmentSegments,
    milanEnvLoading,
    milanEnvironmentWindow,
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

      // Build KPI list HTML — trust class instead of stub numbers / Partial
      const kpiListHtml = ELABORATOR_KPIS.map((kpi) => {
        const trust = resolveCityOverviewTrust(city.city, kpi.id);
        return `
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 5px 0; border-bottom: 1px solid rgba(101, 125, 245, 0.1);">
            <span style="font-size: 10px; color: #657DF5; font-weight: 500; text-transform: uppercase;">${kpi.shortName}</span>
            ${trustChipHtml(trust)}
          </div>
        `;
      }).join("");

      // Popup with more transparency
      marker.bindPopup(`
        <div style="font-family: 'DM Sans', sans-serif; min-width: 220px; max-width: 280px; padding: 12px;">
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
        const map = mapRef.current!;
        map.flyTo(
          [city.lat, city.lon],
          getPilotsByCity(city.city).length >= 3
            ? city.city.toLowerCase().includes("copenhagen") ||
              city.city.toLowerCase().includes("helsinki")
              ? 11
              : 10
            : 12,
          {
          duration: 1.2,
        });
        whenLeafletMapSettled(map, () => {
          if (!mapRef.current) return;
          clearLayers();
          const pilots = getPilotsByCity(city.city);
          const fallbackCoords = pilots.map((p, idx) => pilotFallbackCoord(p, idx, city.lat, city.lon));
          const spreadPts = spreadPilotOverviewPositions(fallbackCoords);
          pilots.forEach((pilot, pi) => {
            const icon = L.divIcon({
              className: "pilot-card-marker",
              html: getPilotCardHtml(city.city, pilot),
              iconSize: PILOT_CARD_ICON_SIZE,
              iconAnchor: PILOT_CARD_ICON_ANCHOR,
            });

            const pilotMarker = L.marker(spreadPts[pi], { icon }).addTo(mapRef.current);
            markersRef.current.push(pilotMarker);
            pilotMarker.on("click", () => {
              setCurrentCity(city.city);
              setCurrentPilot(pilot);
              onPilotSelect?.(pilot);
              setViewLevel("PILOT_DATA");
              onCitySelect?.(city.city);
              mapRef.current!.flyTo(
                [pilot.lat ?? city.lat, pilot.lng ?? city.lon],
                isTrikalaCityName(city.city)
                  ? trikalaMapZoom()
                  : isMilanCityName(city.city)
                    ? milanMapZoom()
                    : 14,
                { duration: 0.9 }
              );
            });
          });
          fitMapToPilotOverviewCards(mapRef.current, spreadPts, { cityName: city.city });
        });
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
    if (
      currentCity?.toLowerCase().includes("issy") &&
      selectedKpi === "kpi3.2" &&
      isIssyStudyPilot(selectedPilotId)
    ) {
      return;
    }
    // Helsinki / Milan / Zaragoza KPI layers own their viewport (auto-fit fights user zoom).
    if (
      currentCity?.toLowerCase().includes("helsinki") ||
      currentCity?.toLowerCase().includes("milan") ||
      currentCity?.toLowerCase().includes("zaragoza")
    ) {
      return;
    }
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
    whenLeafletMapSettled(map, () => {
      if (!mapRef.current) return;
      scheduleLeafletLayerRepaint(mapRef.current, markersRef.current, circlesRef.current);
    });
  }, [
    pilotGeometrySpec?.maxZoom,
    currentCity,
    selectedKpi,
    selectedPilotId,
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
            isTrikalaCityName(selectedCity)
              ? trikalaMapZoom()
              : isMilanCityName(selectedCity)
                ? milanMapZoom()
                : 14,
            { duration: 1.2 }
          );
        } else {
          setCurrentPilot(null);
          setViewLevel("CITY_INTERVENTIONS");
          const map = mapRef.current;
          map.flyTo(
            [cityData.lat, cityData.lon],
            getPilotsByCity(selectedCity).length >= 3
              ? selectedCity.toLowerCase().includes("copenhagen") ||
                selectedCity.toLowerCase().includes("helsinki")
                ? 11
                : 10
              : 12,
            { duration: 1.2 }
          );
          whenLeafletMapSettled(map, () => {
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
                iconSize: PILOT_CARD_ICON_SIZE,
                iconAnchor: PILOT_CARD_ICON_ANCHOR,
              });
              const pilotMarker = L.marker(spreadPts[pi], { icon }).addTo(mapRef.current);
              markersRef.current.push(pilotMarker);
              pilotMarker.on("click", () => {
                setCurrentPilot(pilot);
                onPilotSelect?.(pilot);
                setViewLevel("PILOT_DATA");
                mapRef.current!.flyTo(
                  [pilot.lat ?? cityData.lat, pilot.lng ?? cityData.lon],
                  isTrikalaCityName(selectedCity)
              ? trikalaMapZoom()
              : isMilanCityName(selectedCity)
                ? milanMapZoom()
                : 14,
                  { duration: 0.9 }
                );
              });
            });
            fitMapToPilotOverviewCards(mapRef.current, spreadPts, { cityName: selectedCity });
            scheduleLeafletLayerRepaint(mapRef.current, markersRef.current, circlesRef.current);
          });
        }
      }
    }
  }, [selectedCity, selectedPilotId, currentCity, clearLayers, addHexbinData, selectedModeTypes, onPilotSelect, addCityMarkers]);

  useEffect(() => {
    if (viewLevel !== "PILOT_DATA" || !currentCity || !mapRef.current) return;

    layerRefreshCancelRef.current?.();
    const map = mapRef.current;
    layerRefreshCancelRef.current = whenLeafletMapSettled(map, () => {
      if (!mapRef.current) return;
      clearLayers();
      addHexbinData(currentCity, selectedModeTypes);
      scheduleLeafletLayerRepaint(
        mapRef.current,
        markersRef.current,
        circlesRef.current
      );
      requestAnimationFrame(() => {
        if (!mapRef.current) return;
        mapRef.current.invalidateSize({ pan: false });
        scheduleLeafletLayerRepaint(
          mapRef.current,
          markersRef.current,
          circlesRef.current
        );
      });
    });

    return () => {
      layerRefreshCancelRef.current?.();
      layerRefreshCancelRef.current = null;
    };
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
    helsinkiHslTram,
    helsinkiInnotrafikSummary,
    showInterventionLayer,
  ]);

  useEffect(() => {
    milanKpi12FitKeyRef.current = "";
    milanPointFitKeyRef.current = "";
  }, [currentCity, milanPilotId, selectedKpi]);

  useEffect(() => {
    const map = mapRef.current;
    if (map) {
      lastLayoutZoomTierRef.current = layoutZoomTier(map.getZoom());
    }
  }, [currentCity, selectedKpi, selectedPilotId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const onZoomEnd = () => {
      if (!kpiUsesZoomDependentMarkerLayout(currentCity, selectedKpi)) return;
      const tier = layoutZoomTier(map.getZoom());
      if (tier === lastLayoutZoomTierRef.current) return;
      lastLayoutZoomTierRef.current = tier;
      setMapZoomRevision((revision) => revision + 1);
    };

    map.on("zoomend", onZoomEnd);
    return () => {
      map.off("zoomend", onZoomEnd);
    };
  }, [currentCity, selectedKpi]);

  useEffect(() => {
    if (!leafletMapUi) return;

    const onPanelResize = () => {
      whenLeafletMapSettled(leafletMapUi, () => {
        leafletMapUi.invalidateSize({ pan: false });
        scheduleLeafletLayerRepaint(leafletMapUi, markersRef.current, circlesRef.current);
      });
    };

    window.addEventListener("elab-panel-width-change", onPanelResize);
    return () => window.removeEventListener("elab-panel-width-change", onPanelResize);
  }, [leafletMapUi]);

  useEffect(() => {
    if (viewLevel !== "PILOT_DATA" || !currentCity || !mapRef.current) return;
    if (selectedPilotId === "tri-p2" && selectedKpi === "kpi1.2") return;

    let timer: number | null = null;
    const cancelSettled = whenLeafletMapSettled(mapRef.current, () => {
      timer = window.setTimeout(() => {
        autoFitRenderedData();
      }, 160);
    });

    return () => {
      cancelSettled();
      if (timer) window.clearTimeout(timer);
    };
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

      {/* Sticky #16: segment-pressure legend only when coloured network segments are on the map (not mode-share hubs). */}
      {currentCity?.toLowerCase() === "milan" &&
        viewLevel === "PILOT_DATA" &&
        (selectedKpi === "kpi2.1" || selectedKpi === "kpi3.2") && (
        <div className="pointer-events-none absolute bottom-6 right-6 z-30 w-[280px] rounded-xl border border-white/25 bg-black/35 backdrop-blur-xl p-3 text-[11px] text-white">
          <p className="font-semibold text-violet mb-2">
            {selectedKpi === "kpi2.1" ? "Road safety (segments)" : "Environmental pressure (segments)"}
          </p>
          <div className="space-y-1.5 mb-3">
            {(selectedKpi === "kpi2.1" && milanSpeedSegments?.records?.length
              ? buildMilanSpeedLegendItems(milanSpeedSegments.records)
              : SEGMENT_PRESSURE_ITEMS
            ).map((row) => (
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
