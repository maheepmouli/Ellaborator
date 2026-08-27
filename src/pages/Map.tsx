import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Eye, X } from "lucide-react";
import Header from "@/components/Header";
import HeroMap from "@/components/HeroMap";
import InsightPanel from "@/components/InsightPanel";
import { isTrikalaCityName } from "@/lib/trikalaMapConfig";
import { getTrikalaPilot2FitBounds } from "@/lib/trikalaMapLayers/trikalaParkRideBounds";
import MapControls from "@/components/MapControls";
import MapTour from "@/components/MapTour";
import DataSummaryPanel from "@/components/ScenarioPanel";
import SegmentIntelligencePanel from "@/components/SegmentIntelligencePanel";
import { getPilotsByCity, findPilotByIdGlobally, SelectedPilot, ViewState } from "@/data/pilotDefinitions";
import { CITY_DATA, ELABORATOR_KPIS } from "@/data/kpiDefinitions";
import { resolveMapLegend, type MapLegendMarker } from "@/lib/mapLayerLegend";
import { ISSY_P2_JUNCTION, ISSY_JUNCTION_SEGMENT_IDS, isIssyStudyPilot } from "@/lib/issyPilot2Junction";
import { getIssyZoneCentroids } from "@/services/issyFlowData";
import { useIssyFlowData } from "@/hooks/use-issy-flow-data";
import {
  buildIssyZoneModeShareStudyView,
  buildIssyZoneSustainableModeSharePoints,
  parseIssyZoneSegmentId,
} from "@/lib/issyFlowAggregates";
import { getKpi32TimeSeriesIntensity } from "@/lib/kpi32YearIntensity";
import { useLatestTrafficData } from "@/hooks/use-traffic-data";
import { pickDefaultSegment, buildJunctionStudyView } from "@/lib/issyJunctionAnalytics";
import { getPrimaryJunctionConfig } from "@/data/junctionConfigs";
import { buildMockJunctionStudyView, mergeJunctionConfig } from "@/lib/junctionMockAnalytics";
import { buildCityObservatoryView, buildSegmentScopedObservatoryView } from "@/lib/observatoryCityContent";
import { buildTrikalaObservatoryView } from "@/lib/trikalaObservatoryView";
import { loadTrikalaLocationsBundle } from "@/data/trikalaLocationRegistry";
import { buildCopenhagenObservatoryView, filterCopenhagenObservatoryPoints } from "@/lib/copenhagenObservatoryView";
import { buildMilanObservatoryView } from "@/lib/milanObservatoryView";
import { buildZaragozaObservatoryView } from "@/lib/zaragozaObservatoryView";
import { useLocalCityData } from "@/hooks/use-local-city-data";
import { isIssyCity } from "@/lib/issyMapRouting";
import { getIssyPilotProfile, isIssyCityWideModeSharePilot } from "@/data/issyPilotProfiles";
import { getIssySentimentMock, issySentimentKpiHeadline } from "@/data/issySentimentMock";
import {
  getIssyAccessibilityMock,
  issyAccessibilityFeaturesForScenario,
} from "@/data/issyAccessibilityMock";
import {
  buildIssyCityClimateStudyView,
  buildIssyClimateHexStudyView,
  isIssyClimateCitySegmentId,
  parseIssyClimateHexSegmentId,
} from "@/lib/issyClimateHexObservatory";
import { useIssyWorkbooks } from "@/hooks/use-issy-workbooks";
import { canOpenObservatory } from "@/lib/observatoryAccess";
import { isHelsinkiMapDrivenSelectionId, isHelsinkiSelectionCompatibleWithPilot } from "@/lib/helsinkiObservatoryView";
import {
  isCopenhagenObservatoryContext,
  copenhagenSiteSegmentId,
  parseCopenhagenMapSelection,
} from "@/lib/copenhagenMapSelection";
import { getCopenhagenPilotLatLngBounds } from "@/data/copenhagenCameraSites";
import { getZaragozaPilotLatLngBounds } from "@/data/zaragozaPilotProfiles";
import {
  isZaragozaCityName,
  isZaragozaPilotId,
  isZaragozaUnlocked,
  lockZaragoza,
} from "@/lib/zaragozaAccess";
import { ZaragozaPasswordDialog } from "@/components/ZaragozaPasswordGate";
import type { MapSelectionState } from "@/types/mapSelection";
import { useMilanEnvironmentSegments, useMilanSpeedSegments } from "@/hooks/use-milan-segment-data";
import {
  buildMilanJunctionAccessibilityMockPoints,
  buildMilanJunctionClimateMockPoints,
  buildMilanJunctionModeShareMockPoints,
  milanHasObservedAccessibilityData,
  milanHasObservedClimateData,
  milanHasObservedModeShareData,
  milanHubSegmentId,
  milanJunctionAnchorsForPilot,
  prepareMilanModeShareDisplayPoints,
} from "@/lib/milanMapLayers";
import type { TrafficSegment } from "@/types/traffic";
import { filterPointsInPilotZone, filterMilanLocalPoints, pickDefaultSegmentId } from "@/lib/interventionZone";
import type { MilanSegmentRecord } from "@/services/milanSegmentData";
import {
  dominantRuntimeLinkage,
  resolvePilotGeometryRender,
} from "@/lib/pilotGeometryRenderer";
import { getPilotGeometryRecord } from "@/lib/pilotGeometryContract";
import type { PilotGeometryRenderSpec } from "@/lib/pilotGeometryRenderer";
import { fetchSharepointManifest } from "@/data/sharepointDatasets";
import { MapIntelligenceProvider, useMapIntelligence } from "@/context/MapIntelligenceContext";
import { useMapSideInsets } from "@/hooks/use-map-side-insets";

/** Milan camera hubs: persisted click beats stale hover so observatory matches the selected sensor. */
function resolveObservatorySegmentId(
  city: string,
  selectedId: string | null | undefined,
  hoveredId: string | null | undefined
): string | null {
  if (city === "Milan") return selectedId ?? hoveredId ?? null;
  return hoveredId ?? selectedId ?? null;
}

/** Glyphs aligned with geometry: discs for points, short bars for polylines, squares for polygons, strips for ramps. */
function LegendSwatch({ marker, color }: { marker: Exclude<MapLegendMarker, "polygonRamp">; color: string }) {
  if (marker === "line") {
    return (
      <span
        className="inline-block h-2.5 w-[3.75rem] rounded-full shrink-0 shadow-[0_0_0_1px_rgba(255,255,255,0.12)]"
        style={{ backgroundColor: color }}
        aria-hidden
      />
    );
  }
  if (marker === "polygon") {
    return (
      <span
        className="inline-block h-3.5 w-3.5 rounded-sm shrink-0 border border-white/35 shadow-sm"
        style={{ backgroundColor: color }}
        aria-hidden
      />
    );
  }
  if (marker === "ramp") {
    return (
      <span
        className="inline-block h-3 flex-1 min-w-0 rounded-[3px]"
        style={{ backgroundColor: color }}
        aria-hidden
      />
    );
  }
  return (
    <span
      className="inline-block h-3.5 w-3.5 rounded-full shrink-0 border border-white/35 shadow-sm"
      style={{ backgroundColor: color }}
      aria-hidden
    />
  );
}

type SegmentContext = {
  segmentName: string;
  speed: number | null;
  congestion: number | null;
  properties?: Record<string, unknown>;
};

type DataQualitySummary = {
  recordsLabel: string;
  spatialQuality: string;
  dataType: string;
  temporalCoverage: string;
  confidence: "High" | "Medium" | "Low";
  provenanceType?: string;
  geometryLinkage?: string;
  spatialSystemHint?: string;
};

const MapContent = () => {
  const intel = useMapIntelligence();
  // First visit: show how-to tour once; reopen anytime via "How to Use"
  const [showTour, setShowTour] = useState(true);
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedPilot, setSelectedPilot] = useState<SelectedPilot | null>(null);
  const [zaragozaGateOpen, setZaragozaGateOpen] = useState(false);
  const pendingZaragozaCityRef = useRef<string | null>(null);
  const pendingZaragozaPilotRef = useRef<SelectedPilot | null>(null);
  const issyJunctionStudy = isIssyStudyPilot(selectedPilot?.id);
  const isCopenhagenMap = isCopenhagenObservatoryContext(selectedCity, selectedPilot?.id);
  const isTrikalaMap = isTrikalaCityName(selectedCity);
  const [selectedKpi, setSelectedKpi] = useState("kpi1.2");
  const [mapRef, setMapRef] = useState<any>(null);
  const [viewLevel, setViewLevel] = useState<ViewState>("EUROPE");
  const [isDataSummaryOpen, setIsDataSummaryOpen] = useState(false);
  const [isObservatoryOpen, setIsObservatoryOpen] = useState(false);
  const {
    scenario,
    setScenario,
    filterRange,
    setFilterRange,
    modeTypes: selectedModeTypes,
    setModeTypes: setSelectedModeTypes,
    segmentId: selectedJunctionSegmentId,
    setSegmentId: setSelectedJunctionSegmentId,
    focusMode,
    setFocusMode,
    patchSelection,
    setCity: setIntelCity,
    setPilotId: setIntelPilotId,
    setKpiId: setIntelKpiId,
    setTimeWindow,
  } = intel;
  const { data: issyJunctionTraffic } = useLatestTrafficData(
    selectedCity.toLowerCase().includes("issy") ? selectedCity : "",
    8
  );
  const { classeur: issyClasseurQuery } = useIssyWorkbooks(isIssyCity(selectedCity));
  const issyClasseur = issyClasseurQuery.data ?? null;
  const [isLegendOpen, setIsLegendOpen] = useState(true);
  const [mapContext, setMapContext] = useState<SegmentContext | null>(null);
  /** Pilot map highlights intervention streets by default — no toggle in the sidebar. */
  const showInterventionLayer = true;
  const [dataQualitySummary, setDataQualitySummary] = useState<DataQualitySummary | null>(null);
  const { data: sharepointManifest } = useQuery({
    queryKey: ["sharepoint-manifest-map"],
    queryFn: fetchSharepointManifest,
    staleTime: 300_000,
  });
  const manifestAvailable = sharepointManifest != null;
  const [mapSelection, setMapSelection] = useState<MapSelectionState>({});
  /** Milan KPI 3.2 RETE hour band (discrete); independent of baseline/intervention scenario toggle. */
  const [milanEnvWindow, setMilanEnvWindow] = useState<"08-09" | "18-19">("08-09");
  /** Issy KPI 1.2 zone-flow CSV weekday vs weekend (React Query key shared with map). */
  const [issyFlowDayCategory, setIssyFlowDayCategory] = useState<"all" | "weekday" | "weekend">("all");
  const { data: issyFlowFeatures = [] } = useIssyFlowData(
    issyFlowDayCategory,
    isIssyCity(selectedCity)
  );
  /** Sidebar chart drills → animate map viewport to pilot anchors. */
  const pilotFlyNonceRef = useRef(0);
  const [pilotFlyToSignal, setPilotFlyToSignal] = useState<{
    nonce: number;
    lat?: number;
    lng?: number;
    zoom?: number;
    bounds?: [[number, number], [number, number]];
    maxZoom?: number;
  } | null>(null);
  /** KPI 3.1 chart selection → tighten infrastructure points on the map. */
  const [infrastructureMapFocus, setInfrastructureMapFocus] = useState<string | null>(null);
  /** KPI 3.2 trend chart — selected year drives map emission / climate intensity. */
  const [emissionsIntensityYear, setEmissionsIntensityYear] = useState<string | null>(null);
  const [selectedDirectionId, setSelectedDirectionId] = useState<string | null>(null);
  /** Transient map hover — drives Copenhagen observatory preview without pinning selection. */
  const [hoveredSegmentId, setHoveredSegmentId] = useState<string | null>(null);
  const resetToEuropeRef = useRef<null | (() => void)>(null);

  const cityCenter = useMemo(() => {
    const row = CITY_DATA.find((c) => c.city === selectedCity);
    return row ? { lat: row.lat, lon: row.lon } : null;
  }, [selectedCity]);

  const { data: localObservatoryPoints = [] } = useLocalCityData(
    selectedCity,
    selectedKpi,
    cityCenter,
    selectedPilot?.id,
    scenario
  );

  const { data: trikalaLocationsBundle } = useQuery({
    queryKey: ["trikala-locations-bundle"],
    queryFn: loadTrikalaLocationsBundle,
    enabled: isTrikalaMap,
    staleTime: 600_000,
  });

  const runtimeLinkage = useMemo(
    () => dominantRuntimeLinkage(localObservatoryPoints),
    [localObservatoryPoints]
  );

  const pilotGeometrySpec: PilotGeometryRenderSpec | null = useMemo(() => {
    const record = getPilotGeometryRecord(selectedPilot?.id);
    if (!record) return null;
    return resolvePilotGeometryRender({ pilot: record, runtimeLinkage });
  }, [selectedPilot?.id, runtimeLinkage]);

  const requestPilotMapFocus = useCallback((lat: number, lng: number, zoom?: number) => {
    pilotFlyNonceRef.current += 1;
    setPilotFlyToSignal({ nonce: pilotFlyNonceRef.current, lat, lng, zoom });
  }, []);

  const requestPilotMapBounds = useCallback(
    (bounds: [[number, number], [number, number]], maxZoom?: number) => {
      pilotFlyNonceRef.current += 1;
      setPilotFlyToSignal({ nonce: pilotFlyNonceRef.current, bounds, maxZoom });
    },
    []
  );

  useEffect(() => {
    setIntelCity(selectedCity);
  }, [selectedCity, setIntelCity]);

  useEffect(() => {
    setIntelKpiId(selectedKpi);
  }, [selectedKpi, setIntelKpiId]);

  useEffect(() => {
    setIntelPilotId(selectedPilot?.id ?? null);
  }, [selectedPilot?.id, setIntelPilotId]);

  useEffect(() => {
    setTimeWindow("scenario", scenario);
  }, [scenario, setTimeWindow]);

  useEffect(() => {
    if (selectedCity.toLowerCase().includes("issy") && selectedKpi === "kpi1.2") {
      setTimeWindow("issyDay", issyFlowDayCategory);
    }
  }, [issyFlowDayCategory, selectedCity, selectedKpi, setTimeWindow]);

  useEffect(() => {
    if (selectedCity === "Milan" && selectedKpi === "kpi3.2") {
      setTimeWindow("milanEnv", milanEnvWindow);
    }
  }, [milanEnvWindow, selectedCity, selectedKpi, setTimeWindow]);

  useEffect(() => {
    if (
      focusMode &&
      selectedJunctionSegmentId &&
      canOpenObservatory(selectedCity, selectedPilot?.id, selectedKpi)
    ) {
      setIsObservatoryOpen(true);
    }
  }, [focusMode, selectedJunctionSegmentId, selectedCity, selectedPilot?.id, selectedKpi]);

  useEffect(() => {
    setInfrastructureMapFocus(null);
    setEmissionsIntensityYear(null);
  }, [selectedKpi]);

  useEffect(() => {
    setInfrastructureMapFocus(null);
    setEmissionsIntensityYear(null);
    setMapContext(null);
    setSelectedDirectionId(null);
    setHoveredSegmentId(null);
    setSelectedJunctionSegmentId(null);
    setFocusMode(false);
    patchSelection({ segmentId: null });
    if (!selectedCity.toLowerCase().includes("copenhagen")) {
      setIsObservatoryOpen(false);
    }
  }, [selectedPilot?.id, selectedCity, setSelectedJunctionSegmentId, setFocusMode, patchSelection]);

  useEffect(() => {
    setSelectedJunctionSegmentId(null);
    setMapContext(null);
    setSelectedDirectionId(null);
    setHoveredSegmentId(null);
    patchSelection({ segmentId: null });
  }, [selectedKpi, setSelectedJunctionSegmentId, patchSelection]);

  useEffect(() => {
    if (!selectedPilot?.id) return;
    const autoOpenCities = ["Copenhagen", "Helsinki", "Milan", "Zaragoza", "Trikala"];
    if (autoOpenCities.includes(selectedCity) && canOpenObservatory(selectedCity, selectedPilot.id, selectedKpi)) {
      setIsObservatoryOpen(true);
    }
  }, [selectedCity, selectedPilot?.id, selectedKpi]);

  useEffect(() => {
    if (!selectedPilot?.id?.startsWith("issy-p")) return;
    const profile = getIssyPilotProfile(selectedPilot.id);
    if (profile && selectedPilot.supportedKpis.includes(profile.defaultKpi)) {
      setSelectedKpi(profile.defaultKpi);
    }
    // Pilot 2 + Pilot 3 = city-wide observatory — fit OD zones (same scale as each other).
    if (isIssyCityWideModeSharePilot(selectedPilot.id)) {
      const zones = getIssyZoneCentroids();
      if (zones.length >= 2) {
        const lats = zones.map((z) => z.lat);
        const lons = zones.map((z) => z.lon);
        requestPilotMapBounds(
          [
            [Math.min(...lats), Math.min(...lons)],
            [Math.max(...lats), Math.max(...lons)],
          ],
          14
        );
      } else {
        requestPilotMapFocus(ISSY_P2_JUNCTION.lat, ISSY_P2_JUNCTION.lon, 14);
      }
    } else {
      requestPilotMapFocus(ISSY_P2_JUNCTION.lat, ISSY_P2_JUNCTION.lon, 17);
    }
    const defaultSeg = pickDefaultSegment(issyJunctionTraffic?.results ?? []);
    if (defaultSeg) {
      patchSelection({ segmentId: defaultSeg.id });
    }
    setMapSelection({
      city: selectedCity,
      pilotId: selectedPilot.id,
      kpi: profile?.defaultKpi ?? selectedKpi,
      segmentId: defaultSeg?.id ?? null,
    });
  }, [selectedPilot?.id, requestPilotMapFocus, requestPilotMapBounds, issyJunctionTraffic?.results, selectedCity, selectedPilot?.supportedKpis, patchSelection]);

  // Issy P2/P3 accessibility + satisfaction — same city OD footprint as mode-share hubs.
  useEffect(() => {
    if (!selectedPilot?.id || !isIssyCityWideModeSharePilot(selectedPilot.id)) return;
    if (selectedKpi !== "kpi4.2" && selectedKpi !== "kpi4.1") return;
    const a11yProfile = getIssyAccessibilityMock(selectedPilot.id);
    const a11yFeatures = a11yProfile
      ? issyAccessibilityFeaturesForScenario(a11yProfile, "intervention")
      : [];
    const sentimentProfile = getIssySentimentMock(selectedPilot.id);
    const sentimentPts = sentimentProfile?.samples ?? [];
    const features =
      selectedKpi === "kpi4.1"
        ? sentimentPts.map((s) => ({ lat: s.lat, lon: s.lon }))
        : a11yFeatures.map((f) => ({ lat: f.lat, lon: f.lon }));
    if (features.length >= 2) {
      const lats = features.map((f) => f.lat);
      const lons = features.map((f) => f.lon);
      requestPilotMapBounds(
        [
          [Math.min(...lats), Math.min(...lons)],
          [Math.max(...lats), Math.max(...lons)],
        ],
        14
      );
    } else {
      const zones = getIssyZoneCentroids();
      if (zones.length >= 2) {
        requestPilotMapBounds(
          [
            [Math.min(...zones.map((z) => z.lat)), Math.min(...zones.map((z) => z.lon))],
            [Math.max(...zones.map((z) => z.lat)), Math.max(...zones.map((z) => z.lon))],
          ],
          14
        );
      } else {
        requestPilotMapFocus(ISSY_P2_JUNCTION.lat, ISSY_P2_JUNCTION.lon, 14);
      }
    }
  }, [selectedPilot?.id, selectedKpi, requestPilotMapBounds, requestPilotMapFocus]);

  // Issy P2/P3 mode share — keep city OD frame when returning to KPI 1.2.
  useEffect(() => {
    if (!selectedPilot?.id || !isIssyCityWideModeSharePilot(selectedPilot.id)) return;
    if (selectedKpi !== "kpi1.2") return;
    const zones = getIssyZoneCentroids();
    if (zones.length < 2) return;
    const lats = zones.map((z) => z.lat);
    const lons = zones.map((z) => z.lon);
    requestPilotMapBounds(
      [
        [Math.min(...lats), Math.min(...lons)],
        [Math.max(...lats), Math.max(...lons)],
      ],
      14
    );
  }, [selectedPilot?.id, selectedKpi, requestPilotMapBounds]);

  useEffect(() => {
    if (!selectedPilot) return;
    if (selectedPilot.id.startsWith("issy-p")) return;
    if (selectedPilot.id.startsWith("hel-")) return;
    // Milan HeroMap layers own viewport (once-fit). Re-flying on every KPI /
    // runtimeLinkage change fights wheel zoom the same way Helsinki used to.
    if (selectedPilot.id.startsWith("mil-")) return;
    if (selectedPilot.id === "tri-p2") {
      requestPilotMapBounds(getTrikalaPilot2FitBounds(selectedKpi), 17);
      return;
    }
    if (selectedPilot.id.startsWith("cph-")) {
      const bounds = getCopenhagenPilotLatLngBounds(selectedPilot.id);
      if (bounds) {
        const maxZoom =
          selectedPilot.id === "cph-p2" ? 18 : selectedPilot.id === "cph-p3" ? 17 : 16;
        requestPilotMapBounds(bounds, maxZoom);
        return;
      }
    }
    if (selectedPilot.id.startsWith("zar-")) {
      const bounds = getZaragozaPilotLatLngBounds(selectedPilot.id);
      if (bounds) {
        requestPilotMapBounds(bounds, 17);
        return;
      }
    }
    if (pilotGeometrySpec?.flyToAllowed && pilotGeometrySpec.bounds) {
      requestPilotMapFocus(
        pilotGeometrySpec.bounds.lat,
        pilotGeometrySpec.bounds.lng,
        pilotGeometrySpec.bounds.zoom
      );
      return;
    }
    if (pilotGeometrySpec?.interactionModel === "dashboard_only") {
      if (typeof selectedPilot.lat === "number" && typeof selectedPilot.lng === "number") {
        requestPilotMapFocus(selectedPilot.lat, selectedPilot.lng, pilotGeometrySpec?.maxZoom ?? 14);
      }
      return;
    }
    if (pilotGeometrySpec?.flyToAllowed === false) {
      return;
    }
    if (typeof selectedPilot.lat === "number" && typeof selectedPilot.lng === "number") {
      requestPilotMapFocus(selectedPilot.lat, selectedPilot.lng, 14);
    }
  }, [selectedPilot, selectedKpi, pilotGeometrySpec, requestPilotMapFocus, requestPilotMapBounds]);

  const milanPilotId =
    selectedPilot?.id === "mil-p1" || selectedPilot?.id === "mil-p2" || selectedPilot?.id === "mil-p3"
      ? selectedPilot.id
      : "mil-p2";
  const { data: milanSpeedForObservatory } = useMilanSpeedSegments(
    milanPilotId,
    selectedCity === "Milan" &&
      (selectedKpi === "kpi2.1" ||
        selectedKpi === "kpi1.2" ||
        selectedKpi === "kpi3.1" ||
        selectedKpi === "kpi3.2" ||
        selectedKpi === "kpi4.2" ||
        !!selectedPilot?.id?.startsWith("mil-"))
  );

  const { data: milanEnvForObservatory } = useMilanEnvironmentSegments(
    milanEnvWindow,
    selectedCity === "Milan" && selectedKpi === "kpi3.2",
    milanPilotId
  );

  const milanJunctionMockPoints = useMemo(() => {
    if (selectedCity !== "Milan" || !milanSpeedForObservatory?.records?.length) return [];
    const junctions = milanJunctionAnchorsForPilot(milanSpeedForObservatory.records);
    if (!junctions.length) return [];

    if (selectedKpi === "kpi1.2") {
      if (!milanHasObservedModeShareData(localObservatoryPoints, milanPilotId)) {
        return buildMilanJunctionModeShareMockPoints(junctions, milanPilotId);
      }
      return [];
    }
    if (selectedKpi === "kpi3.2" && !milanHasObservedClimateData(milanEnvForObservatory)) {
      return buildMilanJunctionClimateMockPoints(
        junctions,
        milanPilotId,
        milanSpeedForObservatory.records
      );
    }
    if (
      selectedKpi === "kpi4.2" &&
      !milanHasObservedAccessibilityData(localObservatoryPoints, milanPilotId)
    ) {
      return buildMilanJunctionAccessibilityMockPoints(junctions, milanPilotId);
    }
    return [];
  }, [
    selectedCity,
    selectedKpi,
    milanSpeedForObservatory,
    milanEnvForObservatory,
    localObservatoryPoints,
    milanPilotId,
  ]);

  const scopedObservatoryPoints = useMemo(() => {
    if (selectedCity === "Milan" && milanJunctionMockPoints.length) {
      return milanJunctionMockPoints;
    }
    if (selectedCity === "Milan") {
      const scoped = filterMilanLocalPoints(localObservatoryPoints, selectedPilot?.id);
      if (selectedKpi === "kpi1.2" && milanHasObservedModeShareData(scoped, milanPilotId)) {
        return prepareMilanModeShareDisplayPoints(
          scoped.filter((p) => p.properties?.datasetKind === "amat-count"),
          milanPilotId
        );
      }
      return scoped;
    }
    return filterPointsInPilotZone(localObservatoryPoints, selectedCity, selectedPilot?.id);
  }, [
    localObservatoryPoints,
    selectedCity,
    selectedKpi,
    selectedPilot?.id,
    milanJunctionMockPoints,
    milanPilotId,
  ]);

  const milanRecordToTrafficSegment = useCallback((record: MilanSegmentRecord): TrafficSegment => {
    const props = record.properties || {};
    return {
      id: record.id,
      segment: String(props.streetName || record.id),
      type: "Radial",
      noeud_amont: "milan-upstream",
      noeud_aval: "milan-downstream",
      geo_shape: {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: (record.coordinates || []).map(([lat, lon]) => [lon, lat] as [number, number]),
        },
        properties: props,
      },
      date_et_heure_de_comptage_utc: new Date().toISOString(),
      distance_metres: Math.max(1, Math.round((record.coordinates?.length || 2) * 25)),
      vitesse_km_h: Number(props.avgSpeed || 0),
      temps_perdu_secondes: 0,
      indice_de_congestion: Math.min(1, record.value / 100),
      geo_point_2d: {
        lon: Number(props.centroidLon ?? record.coordinates?.[0]?.[1] ?? 9.19),
        lat: Number(props.centroidLat ?? record.coordinates?.[0]?.[0] ?? 45.47),
      },
    };
  }, []);

  const observatorySegments: TrafficSegment[] = useMemo(() => {
    if (selectedCity.toLowerCase().includes("issy") && issyJunctionTraffic?.results?.length) {
      return issyJunctionTraffic.results;
    }
    if (selectedCity === "Milan") {
      if (selectedKpi === "kpi1.2") {
        const hubSource =
          milanJunctionMockPoints.length > 0
            ? milanJunctionMockPoints
            : scopedObservatoryPoints.filter(
                (p) => p.properties?.datasetKind === "amat-count"
              );
        const seenHubs = new Set<string>();
        return hubSource
          .filter((point) => {
            const hubId = milanHubSegmentId(point.properties as Record<string, unknown>);
            if (!hubId || seenHubs.has(hubId)) return false;
            seenHubs.add(hubId);
            return true;
          })
          .map((point, index) => {
            const hubId = milanHubSegmentId(point.properties as Record<string, unknown>);
            const label = String(
              point.properties?.junctionLabel ??
                point.properties?.streetName ??
                point.properties?.siteKey ??
                `Junction ${index + 1}`
            ).split(" · ")[0];
            return {
              id: hubId,
              segment: label,
              type: "Radial",
              noeud_amont: "upstream",
              noeud_aval: "downstream",
              geo_shape: {
                type: "Feature",
                geometry: { type: "Point", coordinates: [point.lon, point.lat] as [number, number] },
                properties: point.properties ?? {},
              },
              date_et_heure_de_comptage_utc: new Date().toISOString(),
              distance_metres: 0,
              vitesse_km_h: null,
              temps_perdu_secondes: 0,
              indice_de_congestion:
                point.value != null && Number.isFinite(point.value)
                  ? Math.min(1, point.value / 100)
                  : null,
              geo_point_2d: { lat: point.lat, lon: point.lon },
            };
          });
      }
      if (selectedKpi === "kpi4.2") {
        const a11yPoints = scopedObservatoryPoints.filter(
          (p) => p.properties?.datasetKind === "accessibility"
        );
        if (a11yPoints.length) {
          const seenIds = new Set<string>();
          return a11yPoints
            .map((point, index) => {
              const props = (point.properties ?? {}) as Record<string, unknown>;
              const junctionLike =
                String(props.junctionId ?? "").startsWith("mil-junction-") ||
                String(props.siteKey ?? "").startsWith("mil-junction-");
              const id = junctionLike
                ? milanHubSegmentId(props)
                : String(props.segmentId ?? props.id ?? point.id ?? `mil-a11y-${index}`);
              return { point, props, id, index };
            })
            .filter(({ id }) => {
              if (!id || seenIds.has(id)) return false;
              seenIds.add(id);
              return true;
            })
            .map(({ point, props, id, index }) => ({
              id,
              segment: String(
                props.junctionLabel ??
                  props.streetName ??
                  props.category ??
                  props.facilityCategory ??
                  `Accessibility ${index + 1}`
              ),
              type: "Radial",
              noeud_amont: "upstream",
              noeud_aval: "downstream",
              geo_shape: {
                type: "Feature",
                geometry: { type: "Point", coordinates: [point.lon, point.lat] as [number, number] },
                properties: props,
              },
              date_et_heure_de_comptage_utc: new Date().toISOString(),
              distance_metres: 0,
              vitesse_km_h: null,
              temps_perdu_secondes: 0,
              indice_de_congestion:
                point.value != null && Number.isFinite(point.value)
                  ? Math.min(1, point.value / 100)
                  : null,
              geo_point_2d: { lat: point.lat, lon: point.lon },
            }));
        }
      }
      if (milanJunctionMockPoints.length) {
        const seenHubs = new Set<string>();
        return milanJunctionMockPoints
          .filter((point) => {
            const hubId = milanHubSegmentId(point.properties as Record<string, unknown>);
            if (!hubId || seenHubs.has(hubId)) return false;
            seenHubs.add(hubId);
            return true;
          })
          .map((point, index) => ({
            id: milanHubSegmentId(point.properties as Record<string, unknown>),
            segment: String(point.properties?.junctionLabel ?? `Junction ${index + 1}`),
            type: "Radial",
            noeud_amont: "upstream",
            noeud_aval: "downstream",
            geo_shape: {
              type: "Feature",
              geometry: { type: "Point", coordinates: [point.lon, point.lat] as [number, number] },
              properties: point.properties ?? {},
            },
            date_et_heure_de_comptage_utc: new Date().toISOString(),
            distance_metres: 0,
            vitesse_km_h: null,
            temps_perdu_secondes: 0,
            indice_de_congestion:
              point.value != null && Number.isFinite(point.value)
                ? Math.min(1, point.value / 100)
                : null,
            geo_point_2d: { lat: point.lat, lon: point.lon },
          }));
      }
      const milanRecords =
        selectedKpi === "kpi3.2"
          ? milanEnvForObservatory?.records
          : selectedKpi === "kpi2.1"
            ? milanSpeedForObservatory?.records
            : undefined;
      if (milanRecords?.length) {
        return milanRecords.map(milanRecordToTrafficSegment);
      }
    }
    if (scopedObservatoryPoints.length > 0) {
      return scopedObservatoryPoints.map((p, index) => ({
        id: String(p.properties?.segmentId ?? p.id ?? `local-seg-${index}`),
        segment: String(
          p.properties?.streetName ?? p.properties?.siteId ?? mapContext?.segmentName ?? `Site ${index + 1}`
        ),
        type: "Radial",
        noeud_amont: "upstream",
        noeud_aval: "downstream",
        geo_shape: {
          type: "Feature",
          geometry: { type: "Point", coordinates: [p.lon, p.lat] },
          properties: p.properties ?? {},
        },
        date_et_heure_de_comptage_utc: new Date().toISOString(),
        distance_metres: 0,
        vitesse_km_h:
          selectedKpi === "kpi4.2"
            ? null
            : p.properties?.avgSpeed != null
              ? Number(p.properties.avgSpeed)
              : null,
        temps_perdu_secondes: 0,
        // KPI 4.2 values are equal-access % — do not map them to congestion.
        indice_de_congestion:
          selectedKpi === "kpi4.2"
            ? null
            : p.value != null && Number.isFinite(p.value)
              ? Math.min(1, p.value / 100)
              : null,
        geo_point_2d: { lat: p.lat, lon: p.lon },
      }));
    }
    return [];
  }, [
    selectedCity,
    issyJunctionTraffic?.results,
    milanSpeedForObservatory?.records,
    milanEnvForObservatory?.records,
    milanJunctionMockPoints,
    selectedKpi,
    scopedObservatoryPoints,
    milanRecordToTrafficSegment,
  ]);

  useEffect(() => {
    if (!selectedPilot?.id || isIssyCity(selectedCity) || isTrikalaMap) return;

    // Copenhagen: default observatory map = OTC workbook hub (Stormgade 4-way cross),
    // never the first flat directional row from local points.
    if (isCopenhagenMap) {
      const junction = getPrimaryJunctionConfig(selectedPilot.id);
      const defaultWorkbook =
        junction?.segmentApiId &&
        ["stormgade", "norreport", "gammeltorv", "hojbro", "vandkunsten"].includes(
          junction.segmentApiId
        )
          ? junction.segmentApiId
          : "stormgade";
      const defaultSiteId = copenhagenSiteSegmentId(defaultWorkbook);
      const parsed = parseCopenhagenMapSelection(selectedJunctionSegmentId);

      if (!selectedJunctionSegmentId) {
        patchSelection({ segmentId: defaultSiteId });
        setMapContext({
          segmentName: junction?.name ?? "Stormgade camera hub",
          speed: null,
          congestion: null,
        });
        return;
      }

      // Keep explicit map hub / camera clicks.
      if (parsed.kind === "site" || parsed.kind === "location") return;

      // Replace only the legacy auto-pick (first observatory point row).
      const autoId = observatorySegments[0]?.id;
      if (autoId && selectedJunctionSegmentId === autoId) {
        patchSelection({ segmentId: defaultSiteId });
        setMapContext({
          segmentName: junction?.name ?? "Stormgade camera hub",
          speed: null,
          congestion: null,
        });
      }
      return;
    }

    const segmentIds = observatorySegments.map((s) => s.id);
    if (segmentIds.length > 0) {
      // Preserve Helsinki hub / sample / sensor clicks that are not aggregate observatory rows.
      // Resetting them to segmentIds[0] made Pilot 1 KPI interactions appear dead.
      if (
        selectedCity === "Helsinki" &&
        selectedJunctionSegmentId &&
        isHelsinkiMapDrivenSelectionId(selectedJunctionSegmentId) &&
        isHelsinkiSelectionCompatibleWithPilot(selectedJunctionSegmentId, selectedPilot?.id) &&
        !segmentIds.includes(selectedJunctionSegmentId)
      ) {
        return;
      }
      // Preserve map click/hover selection when it is still a valid observatory target.
      // Always resetting to segmentIds[0] made Milan accessibility/climate clicks appear dead.
      const nextId = pickDefaultSegmentId(segmentIds, selectedJunctionSegmentId);
      if (nextId && nextId !== selectedJunctionSegmentId) {
        patchSelection({ segmentId: nextId });
        const seg = observatorySegments.find((s) => s.id === nextId);
        if (seg) {
          setMapContext({
            segmentName: String(seg.segment),
            speed: seg.vitesse_km_h ?? null,
            congestion: seg.indice_de_congestion ?? null,
          });
        }
      }
      return;
    }
    if (scopedObservatoryPoints.length > 0 && !selectedJunctionSegmentId) {
      const p = scopedObservatoryPoints[0];
      const id = String(p.properties?.segmentId ?? p.properties?.id ?? p.id);
      patchSelection({ segmentId: id });
      setMapContext({
        segmentName: String(p.properties?.streetName ?? p.properties?.siteId ?? "Intervention site"),
        speed: null,
        congestion: p.value != null ? p.value / 100 : null,
      });
    }
  }, [
    selectedPilot?.id,
    selectedCity,
    selectedKpi,
    observatorySegments,
    scopedObservatoryPoints,
    patchSelection,
    isTrikalaMap,
    isCopenhagenMap,
    selectedJunctionSegmentId,
  ]);

  const junctionConfig = selectedPilot?.id ? getPrimaryJunctionConfig(selectedPilot.id) : null;

  // KPI panel appears only when a pilot is selected
  const showPanel = viewLevel === "PILOT_DATA" && selectedCity;
  const selectedKpiMeta = ELABORATOR_KPIS.find((kpi) => kpi.id === selectedKpi);
  const issyKpi32Intensity =
    selectedCity.toLowerCase().includes("issy") && selectedKpi === "kpi3.2"
      ? getKpi32TimeSeriesIntensity(
          CITY_DATA[selectedCity]?.kpiData["kpi3.2"],
          emissionsIntensityYear
        )
      : null;

  const effectiveDirectionId = useMemo(() => {
    const hoverId = hoveredSegmentId;
    if (isCopenhagenMap) {
      if (!hoverId) return selectedDirectionId;
      if (hoverId.startsWith("loc:") || hoverId.startsWith("site:")) return selectedDirectionId;
      return hoverId;
    }
    if (selectedCity === "Zaragoza" && hoverId) {
      return hoverId;
    }
    if (selectedCity === "Milan" && selectedKpi === "kpi1.2" && hoverId) {
      return hoverId;
    }
    if (isTrikalaMap && selectedKpi === "kpi1.2" && hoverId) {
      return hoverId;
    }
    return selectedDirectionId;
  }, [hoveredSegmentId, isCopenhagenMap, isTrikalaMap, selectedCity, selectedKpi, selectedDirectionId]);

  const activeJunctionView = useMemo(() => {
    if (!junctionConfig || !selectedPilot?.id) return null;
    const label = selectedPilot
      ? `${selectedCity} — ${selectedPilot.name}`
      : junctionConfig.pilot;
    const intensity =
      issyKpi32Intensity != null ? issyKpi32Intensity / 100 : 1;

    if (isCopenhagenMap) {
      const selectionId = hoveredSegmentId ?? selectedJunctionSegmentId;
      const filtered = selectionId
        ? filterCopenhagenObservatoryPoints(scopedObservatoryPoints, selectionId)
        : scopedObservatoryPoints;
      return buildCopenhagenObservatoryView(
        junctionConfig,
        selectedPilot.id,
        selectedKpi,
        scenario,
        filtered.length ? filtered : scopedObservatoryPoints,
        {
          pilotLabel: label,
          selectionId,
          selectedModeTypes,
          segmentName: mapContext?.segmentName ?? null,
        }
      );
    }

    if (selectedCity === "Zaragoza") {
      const selectionId = hoveredSegmentId ?? selectedJunctionSegmentId;
      return buildZaragozaObservatoryView(
        junctionConfig,
        selectedPilot.id,
        selectedKpi,
        scenario,
        scopedObservatoryPoints,
        {
          pilotLabel: label,
          selectionId,
          segmentName: mapContext?.segmentName ?? null,
        }
      );
    }

    if (isTrikalaMap) {
      const trikalaSelectionId = hoveredSegmentId ?? selectedJunctionSegmentId;
      return buildTrikalaObservatoryView(
        junctionConfig,
        selectedCity,
        selectedPilot.id,
        selectedKpi,
        scenario,
        scopedObservatoryPoints,
        {
          hoverSelectionId: trikalaSelectionId,
          segmentName: mapContext?.segmentName ?? null,
          speed: mapContext?.speed ?? null,
          congestion: mapContext?.congestion ?? null,
          locations: trikalaLocationsBundle?.locations ?? [],
          sensorJoins: trikalaLocationsBundle?.sensorJoins ?? [],
        }
      );
    }

    if (selectedCity === "Milan") {
      const selectionId = resolveObservatorySegmentId(
        selectedCity,
        selectedJunctionSegmentId,
        hoveredSegmentId
      );
      const milanRecord =
        selectedKpi === "kpi3.2"
          ? milanEnvForObservatory?.records?.find((r) => r.id === selectionId)
          : selectedKpi === "kpi2.1"
            ? milanSpeedForObservatory?.records?.find((r) => r.id === selectionId)
            : undefined;
      return buildMilanObservatoryView(
        junctionConfig,
        selectedPilot.id,
        selectedKpi,
        scenario,
        scopedObservatoryPoints,
        {
          selectionId,
          segmentName: mapContext?.segmentName ?? null,
          speed: mapContext?.speed ?? null,
          congestion: mapContext?.congestion ?? null,
          segmentProperties: milanRecord?.properties,
          speedDataset: milanSpeedForObservatory ?? null,
          envDataset: milanEnvForObservatory ?? null,
          pilotLabel: label,
        }
      );
    }

    if (selectedCity === "Helsinki" && junctionConfig && selectedPilot?.id) {
      const selectionId = hoveredSegmentId ?? selectedJunctionSegmentId;
      if (selectionId) {
        const matchedSeg = observatorySegments.find((s) => s.id === selectionId);
        return buildSegmentScopedObservatoryView(
          junctionConfig,
          selectedCity,
          selectedPilot.id,
          selectedKpi,
          scenario,
          scopedObservatoryPoints,
          {
            segmentId: selectionId,
            segmentName:
              mapContext?.segmentName ??
              String(matchedSeg?.segment ?? "Helsinki intervention site"),
            speed: mapContext?.speed ?? matchedSeg?.vitesse_km_h ?? null,
            congestion: mapContext?.congestion ?? matchedSeg?.indice_de_congestion ?? null,
            properties: mapContext?.properties,
          },
          intensity,
          selectedModeTypes
        );
      }
      return buildCityObservatoryView(
        junctionConfig,
        selectedCity,
        selectedPilot.id,
        selectedKpi,
        scenario,
        scopedObservatoryPoints,
        intensity
      );
    }

    const seg =
      observatorySegments.find((s) => s.id === selectedJunctionSegmentId) ??
      pickDefaultSegment(observatorySegments);

    if (seg && isIssyCity(selectedCity)) {
      const issySelectionRaw = hoveredSegmentId ?? selectedJunctionSegmentId;
      const issySelectionId = issySelectionRaw?.replace(/:arm-end$/, "") ?? null;
      const climateCellId =
        selectedKpi === "kpi3.2" ? parseIssyClimateHexSegmentId(issySelectionId) : null;

      // Pilot 2 city OD zones — observatory tracks the zone under the cursor.
      const zoneId = parseIssyZoneSegmentId(issySelectionId);
      if (zoneId != null && selectedKpi === "kpi1.2" && issyFlowFeatures.length) {
        const zonePoints = buildIssyZoneSustainableModeSharePoints(
          issyFlowFeatures,
          getIssyZoneCentroids()
        );
        const zone = zonePoints.find((z) => z.zone === zoneId);
        if (zone) {
          return mergeJunctionConfig(
            buildIssyZoneModeShareStudyView(zone, {
              pilotLabel: label,
              pilotId: selectedPilot.id,
              scenario,
              features: issyFlowFeatures,
              centroids: getIssyZoneCentroids(),
            }),
            junctionConfig
          );
        }
      }

      // KPI 3.2 — one city-wide climate reading (hex cells retired for map UX).
      if (selectedKpi === "kpi3.2" && junctionConfig) {
        const cityRow = CITY_DATA.find((c) => c.city === selectedCity);
        if (
          isIssyClimateCitySegmentId(issySelectionId) ||
          !issySelectionId ||
          climateCellId == null
        ) {
          return mergeJunctionConfig(
            buildIssyCityClimateStudyView(junctionConfig, {
              pilotLabel: label,
              pilotId: selectedPilot.id,
              scenario,
              kpiRow: cityRow?.kpiData["kpi3.2"],
              kpi32Year: emissionsIntensityYear,
              classeur: issyClasseur,
              cityLat: cityRow?.lat,
              cityLon: cityRow?.lon,
            }),
            junctionConfig
          );
        }
        const hexView = buildIssyClimateHexStudyView(climateCellId, junctionConfig, {
          pilotLabel: label,
          pilotId: selectedPilot.id,
          scenario,
          kpiRow: cityRow?.kpiData["kpi3.2"],
          kpi32Year: emissionsIntensityYear,
          rings: 3,
          cellSizeM: 44,
          classeur: issyClasseur,
        });
        if (hexView) {
          return mergeJunctionConfig(hexView, junctionConfig);
        }
      }

      const activeSeg =
        (issySelectionId
          ? observatorySegments.find((s) => s.id === issySelectionId)
          : undefined) ?? seg;
      const junctionArms = observatorySegments.filter((s) =>
        ISSY_JUNCTION_SEGMENT_IDS.includes(s.id)
      );
      const real = buildJunctionStudyView(
        activeSeg,
        junctionArms.length ? junctionArms : [activeSeg],
        label,
        selectedKpi,
        intensity,
        scenario,
        selectedPilot.id
      );
      if (selectedKpi === "kpi4.1") {
        const sentimentMock = getIssySentimentMock(selectedPilot.id);
        if (sentimentMock) {
          const headline = issySentimentKpiHeadline(sentimentMock, scenario);
          return mergeJunctionConfig(
            {
              ...real,
              kpiValue: headline.mainValue,
              dataSource: "mock",
              dataClass: "mock",
              sourceLabel: "Mock GecoAir satisfaction placeholder",
              dataConfidence: sentimentMock.confidencePct,
              monitoringPeriod: `${sentimentMock.samples.length} mock survey samples · corridor arms`,
            },
            junctionConfig
          );
        }
      }
      return mergeJunctionConfig(real, junctionConfig);
    }

    const activeSelectionId = hoveredSegmentId ?? selectedJunctionSegmentId;
    const activeSeg =
      observatorySegments.find((s) => s.id === activeSelectionId) ?? seg;
    if (activeSeg && activeSelectionId) {
      const milanRecord =
        selectedCity === "Milan"
          ? selectedKpi === "kpi3.2"
            ? milanEnvForObservatory?.records?.find((r) => r.id === activeSelectionId)
            : selectedKpi === "kpi2.1"
              ? milanSpeedForObservatory?.records?.find((r) => r.id === activeSelectionId)
              : undefined
          : undefined;
      return buildSegmentScopedObservatoryView(
        junctionConfig,
        selectedCity,
        selectedPilot.id,
        selectedKpi,
        scenario,
        scopedObservatoryPoints,
        {
          segmentId: activeSelectionId,
          segmentName: mapContext?.segmentName ?? String(activeSeg.segment),
          speed: mapContext?.speed ?? activeSeg.vitesse_km_h ?? null,
          congestion: mapContext?.congestion ?? activeSeg.indice_de_congestion ?? null,
          properties:
            milanRecord?.properties ??
            (selectedCity === "Helsinki" ? mapContext?.properties : undefined),
        },
        intensity,
        selectedModeTypes
      );
    }

    return buildCityObservatoryView(
      junctionConfig,
      selectedCity,
      selectedPilot.id,
      selectedKpi,
      scenario,
      scopedObservatoryPoints,
      intensity
    );
  }, [
    junctionConfig,
    selectedPilot,
    observatorySegments,
    selectedJunctionSegmentId,
    selectedCity,
    selectedKpi,
    scenario,
    issyKpi32Intensity,
    scopedObservatoryPoints,
    emissionsIntensityYear,
    mapContext,
    milanSpeedForObservatory?.records,
    milanEnvForObservatory?.records,
    isCopenhagenMap,
    isTrikalaMap,
    trikalaLocationsBundle?.locations,
    trikalaLocationsBundle?.sensorJoins,
    focusMode,
    selectedModeTypes,
    hoveredSegmentId,
    issyClasseur,
    issyFlowFeatures,
  ]);

  const mapLegendSpec = resolveMapLegend(selectedCity || "", selectedKpi, scenario, {
    issyJunctionStudy,
    pilotId: selectedPilot?.id ?? intel.pilotId ?? null,
    milanSpeedRecords:
      selectedCity === "Milan" && selectedKpi === "kpi2.1"
        ? milanSpeedForObservatory?.records
        : undefined,
    milanIllustrativeLayer:
      selectedCity === "Milan" &&
      (selectedKpi === "kpi1.2" || selectedKpi === "kpi3.2" || selectedKpi === "kpi4.2") &&
      dataQualitySummary?.provenanceType === "mock",
  });
  const pilotSupportsKpi = selectedPilot ? selectedPilot.supportedKpis.includes(selectedKpi) : true;
  const shouldShowLegend = !showTour && showPanel && pilotSupportsKpi;
  const mapSideInsets = useMapSideInsets(!!showPanel, isObservatoryOpen);

  const handleTourClose = () => {
    setShowTour(false);
  };

  const handleZoomIn = useCallback(() => {
    mapRef?.zoomIn();
  }, [mapRef]);

  const handleZoomOut = useCallback(() => {
    mapRef?.zoomOut();
  }, [mapRef]);

  const handleViewLevelChange = (level: ViewState) => {
    setViewLevel(level);
    if (level === "EUROPE") {
      if (isZaragozaCityName(selectedCity)) {
        lockZaragoza();
      }
      setSelectedCity("");
      setSelectedPilot(null);
    }
  };

  const applyCitySelect = useCallback(
    (city: string) => {
      // Leaving Zaragoza requires a fresh password next time.
      if (isZaragozaCityName(selectedCity) && !isZaragozaCityName(city)) {
        lockZaragoza();
      }
      setSelectedCity(city);
      setIntelCity(city);
    },
    [setIntelCity, selectedCity]
  );

  const handleCitySelect = (city: string) => {
    if (city && isZaragozaCityName(city) && !isZaragozaUnlocked()) {
      pendingZaragozaCityRef.current = city;
      pendingZaragozaPilotRef.current = null;
      setZaragozaGateOpen(true);
      return;
    }
    applyCitySelect(city);
  };

  const resolveCityLabelFromPilot = useCallback((pilot: SelectedPilot): string => {
    const found = findPilotByIdGlobally(pilot.id);
    if (found?.pilotsKey === "issy-les-moulineaux") return "Issy-les-Moulineaux";
    if (found?.pilotsKey) {
      return found.pilotsKey.charAt(0).toUpperCase() + found.pilotsKey.slice(1);
    }
    const row = CITY_DATA.find(
      (c) => c.city.toLowerCase().replace(/[^a-z]/g, "") === pilot.cityId.toLowerCase().replace(/[^a-z]/g, "")
    );
    return row?.city ?? pilot.cityId;
  }, []);

  const resolvePilotDefaultKpi = useCallback((pilot: SelectedPilot | null, currentKpi: string) => {
    if (!pilot) return currentKpi;
    const catalogIds = new Set(ELABORATOR_KPIS.map((kpi) => kpi.id));
    const supportedInCatalog = pilot.supportedKpis.filter((id) => catalogIds.has(id));
    const issyProfile = getIssyPilotProfile(pilot.id);
    if (
      issyProfile &&
      supportedInCatalog.includes(issyProfile.defaultKpi) &&
      catalogIds.has(issyProfile.defaultKpi)
    ) {
      return issyProfile.defaultKpi;
    }
    if (supportedInCatalog.length && !supportedInCatalog.includes(currentKpi)) {
      return supportedInCatalog[0];
    }
    if (!catalogIds.has(currentKpi) && supportedInCatalog.length) {
      return supportedInCatalog[0];
    }
    return currentKpi;
  }, []);

  const applyPilotSelect = useCallback(
    (pilot: SelectedPilot | null) => {
      if (pilot) {
        const cityLabel = resolveCityLabelFromPilot(pilot);
        // Switching away from a Zaragoza pilot re-locks access.
        if (isZaragozaCityName(selectedCity) && !isZaragozaCityName(cityLabel)) {
          lockZaragoza();
        }
        setSelectedPilot(pilot);
        setSelectedCity(cityLabel);
        setIntelCity(cityLabel);
        const nextKpi = resolvePilotDefaultKpi(pilot, selectedKpi);
        setSelectedKpi(nextKpi);
        setIntelKpiId(nextKpi);
        // Copenhagen pilots always open on the default OTC hub map (Stormgade for P1).
        if (pilot.id.startsWith("cph-")) {
          const junction = getPrimaryJunctionConfig(pilot.id);
          const workbook = junction?.segmentApiId ?? "stormgade";
          const siteId = copenhagenSiteSegmentId(workbook);
          patchSelection({ segmentId: siteId });
          setHoveredSegmentId(null);
          setMapContext({
            segmentName: junction?.name ?? "Camera hub",
            speed: null,
            congestion: null,
          });
        } else {
          setSelectedJunctionSegmentId(null);
          setHoveredSegmentId(null);
          setMapContext(null);
          patchSelection({ segmentId: null });
        }
      } else {
        if (isZaragozaCityName(selectedCity) || isZaragozaPilotId(selectedPilot?.id)) {
          lockZaragoza();
        }
        setSelectedPilot(null);
      }
    },
    [resolveCityLabelFromPilot, setIntelCity, resolvePilotDefaultKpi, selectedKpi, setIntelKpiId, patchSelection, setSelectedJunctionSegmentId, selectedCity, selectedPilot?.id]
  );

  const handlePilotSelect = useCallback(
    (pilot: SelectedPilot | null) => {
      if (pilot && isZaragozaPilotId(pilot.id) && !isZaragozaUnlocked()) {
        pendingZaragozaPilotRef.current = pilot;
        pendingZaragozaCityRef.current = resolveCityLabelFromPilot(pilot);
        setZaragozaGateOpen(true);
        return;
      }
      applyPilotSelect(pilot);
    },
    [applyPilotSelect, resolveCityLabelFromPilot]
  );

  const handleZaragozaUnlocked = useCallback(() => {
    const pilot = pendingZaragozaPilotRef.current;
    const city = pendingZaragozaCityRef.current;
    pendingZaragozaPilotRef.current = null;
    pendingZaragozaCityRef.current = null;
    if (pilot) {
      applyPilotSelect(pilot);
    } else if (city) {
      applyCitySelect(city);
    }
  }, [applyPilotSelect, applyCitySelect]);

  const handleZaragozaGateCancel = useCallback(() => {
    pendingZaragozaPilotRef.current = null;
    pendingZaragozaCityRef.current = null;
    lockZaragoza();
    // Map may have been mid-navigation; always return to Europe on cancel.
    resetToEuropeRef.current?.();
  }, []);

  const handleSegmentHover = useCallback(
    (detail: {
      segmentId: string;
      segmentName: string;
      speed?: number | null;
      congestion?: number | null;
      properties?: Record<string, unknown>;
    } | null) => {
      if (detail === null) {
        setHoveredSegmentId(null);
        const preserveContext =
          (isCopenhagenMap ||
            isIssyCity(selectedCity) ||
            isTrikalaMap ||
            selectedCity === "Milan" ||
            selectedCity === "Helsinki" ||
            selectedCity === "Zaragoza") &&
          selectedJunctionSegmentId;
        if (!preserveContext) {
          setMapContext(null);
        }
        return;
      }

      setHoveredSegmentId(detail.segmentId);
      if (canOpenObservatory(selectedCity, selectedPilot?.id, selectedKpi)) {
        setIsObservatoryOpen(true);
      }
      setMapContext({
        segmentName: detail.segmentName,
        speed: detail.speed ?? null,
        congestion: detail.congestion ?? null,
        properties: detail.properties,
      });
      // Milan / Issy P2 zone dots / Helsinki hubs: keep selection in sync on hover so the
      // observatory panel tracks the marker under the cursor.
      if (
        selectedCity === "Milan" ||
        selectedCity === "Helsinki" ||
        (isIssyCity(selectedCity) &&
          isIssyCityWideModeSharePilot(selectedPilot?.id) &&
          selectedKpi === "kpi1.2" &&
          detail.segmentId.startsWith("issy-zone-"))
      ) {
        patchSelection({ segmentId: detail.segmentId });
        setMapSelection({
          segmentId: detail.segmentId,
          city: selectedCity,
          pilotId: selectedPilot?.id,
          kpi: selectedKpi,
        });
      } else {
        setMapSelection((prev) => ({
          ...prev,
          segmentId: prev.segmentId,
          city: selectedCity,
          pilotId: selectedPilot?.id,
          kpi: selectedKpi,
        }));
      }
    },
    [selectedCity, selectedPilot?.id, selectedKpi, isCopenhagenMap, isTrikalaMap, selectedJunctionSegmentId, patchSelection]
  );

  const handlePilotChange = (pilotId: string) => {
    const pilot = getPilotsByCity(selectedCity).find((p) => p.id === pilotId) || null;
    setSelectedPilot(pilot);
    const nextKpi = resolvePilotDefaultKpi(pilot, selectedKpi);
    setSelectedKpi(nextKpi);
    setIntelKpiId(nextKpi);
    if (pilot?.id.startsWith("cph-")) {
      const junction = getPrimaryJunctionConfig(pilot.id);
      const workbook = junction?.segmentApiId ?? "stormgade";
      const siteId = copenhagenSiteSegmentId(workbook);
      patchSelection({ segmentId: siteId });
      setHoveredSegmentId(null);
      setMapContext({
        segmentName: junction?.name ?? "Camera hub",
        speed: null,
        congestion: null,
      });
      setMapSelection({ segmentId: siteId, city: selectedCity, pilotId, kpi: nextKpi });
    } else {
      // Drop stale cross-pilot map selection immediately (e.g. Telraam id on hel-p1).
      setSelectedJunctionSegmentId(null);
      setHoveredSegmentId(null);
      setMapContext(null);
      patchSelection({ segmentId: null });
      setMapSelection((prev) => ({ ...prev, segmentId: null, pilotId, kpi: nextKpi }));
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-background relative">
      {/* Map Tour Popup */}
      <MapTour isOpen={showTour} onClose={handleTourClose} optionalCityName={selectedCity} />

      <ZaragozaPasswordDialog
        open={zaragozaGateOpen}
        onOpenChange={setZaragozaGateOpen}
        onUnlocked={handleZaragozaUnlocked}
        onCancel={handleZaragozaGateCancel}
      />

      {/* Simple Header with Logo only */}
      <Header
        onLogoClick={() => {
          // Close overlays and reset to “All Cities” view
          setIsDataSummaryOpen(false);
          resetToEuropeRef.current?.();
        }}
      />

      {/* Full-Screen Map */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="absolute inset-0 z-0"
      >
        <HeroMap
          onMapReady={setMapRef}
          onCitySelect={handleCitySelect}
          onViewLevelChange={handleViewLevelChange}
          onResetToEuropeReady={(fn) => {
            resetToEuropeRef.current = fn;
          }}
          selectedCity={selectedCity}
          selectedKpi={selectedKpi}
          scenario={scenario}
          filterRange={filterRange}
          selectedModeTypes={selectedModeTypes}
          onSegmentFocus={(ctx) => {
            setMapContext(ctx);
            setMapSelection((prev) => ({
              ...prev,
              city: selectedCity,
              pilotId: selectedPilot?.id,
              kpi: selectedKpi,
            }));
          }}
          focusMode={focusMode}
          onSegmentHover={handleSegmentHover}
          onJunctionSegmentClick={(detail: {
            segmentId: string;
            segmentName: string;
            speed?: number | null;
            congestion?: number | null;
            properties?: Record<string, unknown>;
          }) => {
            patchSelection({ segmentId: detail.segmentId });
            setHoveredSegmentId(detail.segmentId);
            setMapContext({
              segmentName: detail.segmentName,
              speed: detail.speed ?? null,
              congestion: detail.congestion ?? null,
              properties: detail.properties,
            });
            if (selectedCity === "Helsinki") {
              // City-wide FVH1 / climate views: update observatory only — do not yank zoom on hub click.
              // Viikki FVH3 sensors still get a gentle focus.
              const isViikkiSensor =
                selectedPilot?.id === "hel-p3" ||
                /telraam|mobilysis|viikki/i.test(detail.segmentId);
              if (isViikkiSensor) {
                const fromPropsLat = Number(detail.properties?.lat);
                const fromPropsLon = Number(detail.properties?.lon);
                if (Number.isFinite(fromPropsLat) && Number.isFinite(fromPropsLon)) {
                  requestPilotMapFocus(fromPropsLat, fromPropsLon, 16);
                } else {
                  const match = scopedObservatoryPoints.find((point) => {
                    const segmentId = String(
                      point.properties?.segmentId ?? point.properties?.siteId ?? point.id
                    );
                    return segmentId === detail.segmentId;
                  });
                  if (match) {
                    requestPilotMapFocus(match.lat, match.lon, 16);
                  }
                }
              }
            }
            if (isCopenhagenMap) {
              if (!detail.segmentId.startsWith("loc:") && !detail.segmentId.startsWith("site:")) {
                setSelectedDirectionId(detail.segmentId);
              } else {
                setSelectedDirectionId(null);
              }
            }
            setMapSelection({
              segmentId: detail.segmentId,
              city: selectedCity,
              pilotId: selectedPilot?.id,
              kpi: selectedKpi,
            });
            if (canOpenObservatory(selectedCity, selectedPilot?.id, selectedKpi)) {
              setIsObservatoryOpen(true);
            }
          }}
          showInterventionLayer={showInterventionLayer}
          selectedPilotId={selectedPilot?.id}
          onPilotSelect={handlePilotSelect}
          onDataQualitySummaryChange={setDataQualitySummary}
          milanEnvironmentWindow={
            selectedCity === "Milan" && selectedKpi === "kpi3.2" ? milanEnvWindow : undefined
          }
          issyFlowDayCategory={
            selectedCity.toLowerCase().includes("issy") && selectedKpi === "kpi1.2"
              ? issyFlowDayCategory
              : undefined
          }
          pilotFlyToSignal={pilotFlyToSignal}
          infrastructureCategoryFocus={infrastructureMapFocus}
          kpi32SelectedYear={emissionsIntensityYear}
          selectedJunctionSegmentId={selectedJunctionSegmentId}
          hoveredJunctionSegmentId={hoveredSegmentId}
          pilotGeometrySpec={pilotGeometrySpec}
          runtimeLinkage={runtimeLinkage}
        />
      </motion.div>

      {/* Left Insight Panel - Only visible at city zoom level */}
      {!showTour && showPanel && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <InsightPanel
            selectedCity={selectedCity}
            selectedPilotName={selectedPilot?.name}
            selectedPilotId={selectedPilot?.id}
            selectedKpi={selectedKpi}
            onCityChange={handleCitySelect}
            onPilotChange={handlePilotChange}
            onKpiChange={(kpi) => {
              setSelectedKpi(kpi);
              setIntelKpiId(kpi);
            }}
            selectedModeTypes={selectedModeTypes}
            onOpenObservatory={() => {
              if (canOpenObservatory(selectedCity, selectedPilot?.id, selectedKpi)) {
                setIsObservatoryOpen(true);
              }
            }}
            onRangeChange={setFilterRange}
            onModeTypesChange={setSelectedModeTypes}
            scenario={scenario}
            onScenarioChange={setScenario}
            onOpenDataSummary={() => setIsDataSummaryOpen(true)}
            mapContext={mapContext}
            dataQualitySummary={dataQualitySummary}
            manifestAvailable={manifestAvailable}
            mapSelection={mapSelection}
            hoveredSegmentId={hoveredSegmentId}
            milanEnvironmentWindow={milanEnvWindow}
            onMilanEnvironmentWindowChange={setMilanEnvWindow}
            issyFlowDayCategory={issyFlowDayCategory}
            onIssyFlowDayCategoryChange={setIssyFlowDayCategory}
            infrastructureMapFocus={infrastructureMapFocus}
            onInfrastructureMapFocus={setInfrastructureMapFocus}
            onRequestPilotMapFocus={requestPilotMapFocus}
            emissionsIntensityYear={emissionsIntensityYear}
            onEmissionsIntensityYearChange={setEmissionsIntensityYear}
          />
        </motion.div>
      )}

      {!showTour && viewLevel !== "EUROPE" && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 rounded-xl border border-white/30 bg-[linear-gradient(165deg,rgba(255,255,255,0.18)_0%,rgba(255,255,255,0.08)_45%,rgba(255,255,255,0.04)_100%)] backdrop-blur-xl shadow-[0_10px_30px_rgba(10,10,45,0.35)] px-2 py-1.5">
          <button
            onClick={() => {
              if (viewLevel === "PILOT_DATA") {
                setSelectedPilot(null);
                return;
              }
              resetToEuropeRef.current?.();
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/70 text-foreground border border-white/30 shadow-sm hover:bg-white/80 transition-colors whitespace-nowrap"
          >
            <ArrowLeft className="h-3.5 w-3.5 text-violet" />
            <span className="text-xs font-medium text-foreground">
              {viewLevel === "PILOT_DATA" ? "All Pilots" : "All Cities"}
            </span>
          </button>

          <div className="px-2.5 py-1.5 rounded-lg bg-violet/85 border border-violet/30 backdrop-blur-md shadow-sm whitespace-nowrap">
            <p className="text-xs font-medium text-primary-foreground">
              {selectedPilot ? `${selectedCity}, ${selectedPilot.name}` : selectedCity}
            </p>
          </div>
        </div>
      )}

      <AnimatePresence>
        {shouldShowLegend && (
          <>
            {isLegendOpen ? (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 16 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="fixed bottom-3 z-[62] flex max-h-[min(38vh,300px)] flex-col overflow-hidden rounded-2xl border border-white/15 shadow-[0_12px_32px_rgba(0,0,0,0.45)]"
                style={{
                  left: mapSideInsets.left,
                  right: mapSideInsets.right,
                  background: "rgba(14, 14, 28, 0.92)",
                  backdropFilter: "blur(14px)",
                  WebkitBackdropFilter: "blur(14px)",
                }}
              >
                <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
                  <div className="min-w-0 pr-2">
                    <p className="text-[13px] font-semibold text-white leading-tight">
                      {selectedKpiMeta?.shortName || "KPI Layer"}
                    </p>
                    <p className="mt-0.5 text-[11px] text-white/70">{selectedKpiMeta?.ref || selectedKpi}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsLegendOpen(false)}
                    className="shrink-0 rounded p-1 text-white/65 hover:bg-white/10 hover:text-white/90 transition-colors"
                    aria-label="Hide legend"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 scrollbar-thin">
                  {(() => {
                    const items = mapLegendSpec.items;
                    const stripRamp =
                      mapLegendSpec.marker === "ramp" || mapLegendSpec.marker === "polygonRamp";
                    if (stripRamp) {
                      const isPolyStrip = mapLegendSpec.marker === "polygonRamp";
                      const labeledTicks = items.filter((item) => item.label);
                      return (
                        <div>
                          <div
                            className="h-3 w-full rounded overflow-hidden ring-1 ring-white/15"
                            style={{
                              background: isPolyStrip
                                ? undefined
                                : `linear-gradient(90deg, ${items.map((item) => item.color).join(", ")})`,
                            }}
                            aria-label="Intensity scale"
                          >
                            {isPolyStrip ? (
                              <div className="flex h-full items-center gap-px">
                                {items.map((item, i) => (
                                  <span
                                    key={`strip-p-${i}`}
                                    className="inline-block h-full flex-1 min-w-0 border-r border-white/10 last:border-r-0"
                                    style={{ backgroundColor: item.color }}
                                    aria-hidden
                                  />
                                ))}
                              </div>
                            ) : null}
                          </div>
                          <div className="mt-1.5 flex justify-between gap-1 text-intel-meta text-white/80">
                            {(labeledTicks.length ? labeledTicks : [items[0], items[items.length - 1]].filter(Boolean)).map(
                              (item, i, arr) => (
                                <span
                                  key={`tick-${i}-${item?.label}`}
                                  className={`min-w-0 truncate ${i === 0 ? "text-left" : i === arr.length - 1 ? "text-right" : "text-center"}`}
                                >
                                  {item?.label}
                                </span>
                              )
                            )}
                          </div>
                          {!isPolyStrip && (
                            <div className="mt-1 flex justify-between text-[10px] text-white/55">
                              <span>Lower intensity</span>
                              <span>Higher intensity</span>
                            </div>
                          )}
                        </div>
                      );
                    }
                    const rowMarker =
                      mapLegendSpec.marker === "line" ||
                      mapLegendSpec.marker === "point" ||
                      mapLegendSpec.marker === "polygon"
                        ? mapLegendSpec.marker
                        : "point";
                    return (
                      <div
                        className="grid gap-x-6 gap-y-2"
                        style={{
                          gridTemplateColumns: "repeat(auto-fill, minmax(11.5rem, 1fr))",
                        }}
                      >
                        {items.map((item, i) => (
                          <div key={`legend-row-${i}-${item.color}`} className="flex min-w-0 items-center gap-2">
                            <LegendSwatch marker={rowMarker} color={item.color} />
                            {item.label ? (
                              <span className="text-intel-meta text-white/90 leading-snug">{item.label}</span>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                {mapLegendSpec.hint ? (
                  <div className="shrink-0 border-t border-white/10 px-4 py-2.5">
                    <div className="flex items-start gap-2 text-intel-meta text-white/85 leading-snug">
                      <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/60" />
                      <p>{mapLegendSpec.hint}</p>
                    </div>
                  </div>
                ) : null}
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.2 }}
                className="fixed bottom-3 z-[62] flex justify-center pointer-events-none"
                style={{ left: mapSideInsets.left, right: mapSideInsets.right }}
              >
                <button
                  type="button"
                  onClick={() => setIsLegendOpen(true)}
                  className="pointer-events-auto rounded-xl border border-white/20 bg-[rgba(14,14,28,0.9)] px-3 py-1.5 text-[11px] font-medium text-white/90 backdrop-blur-[12px] hover:text-white shadow-lg"
                >
                  Show legend
                </button>
              </motion.div>
            )}
          </>
        )}
      </AnimatePresence>

      {/* Right-Side Map Controls */}
      {!showTour && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="hidden lg:block absolute top-1/2 z-30 -translate-y-1/2"
          style={{
            // Keep zoom controls clear of the observatory panel (same inset as legend).
            right: mapSideInsets.right,
          }}
        >
          <MapControls
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
          />
        </motion.div>
      )}

      {/* Data Summary - Bottom expandable panel */}
      {!showTour && showPanel && isDataSummaryOpen && (
        <DataSummaryPanel
          scenario={scenario}
          selectedCity={selectedCity}
          selectedKpi={selectedKpi}
          selectedPilotName={selectedPilot?.name}
          selectedPilotId={selectedPilot?.id}
          pilotGeometrySpec={pilotGeometrySpec}
          dataQualitySummary={dataQualitySummary}
          manifestAvailable={manifestAvailable}
          onClose={() => setIsDataSummaryOpen(false)}
        />
      )}

      <SegmentIntelligencePanel
        isOpen={isObservatoryOpen}
        onClose={() => setIsObservatoryOpen(false)}
        pilotLabel={
          selectedPilot
            ? `${selectedCity} — ${selectedPilot.name}`
            : undefined
        }
        segments={observatorySegments}
        selectedSegmentId={resolveObservatorySegmentId(
          selectedCity,
          selectedJunctionSegmentId,
          hoveredSegmentId
        )}
        onSelectSegmentId={(id) => patchSelection({ segmentId: id })}
        selectedKpi={selectedKpi}
        scenario={scenario}
        city={selectedCity}
        pilotId={selectedPilot?.id}
        kpi32IntensityScale={
          issyKpi32Intensity != null ? issyKpi32Intensity / 100 : 1
        }
        junctionView={activeJunctionView}
        streetLabels={
          junctionConfig
            ? { streetNS: junctionConfig.streetNS, streetEW: junctionConfig.streetEW }
            : undefined
        }
        selectedModeTypes={selectedModeTypes}
        selectedDirectionId={effectiveDirectionId}
        onSelectDirectionId={(id) => {
          if (!id) {
            setSelectedDirectionId(null);
            setHoveredSegmentId(null);
            return;
          }
          // Chart hover on MOCK satisfaction dimensions — temporary map highlight only.
          if (id.startsWith("cph-mock-sat-")) {
            setSelectedDirectionId(id);
            setHoveredSegmentId(id);
            return;
          }
          // Zone arms navigate to another OD zone; reset direction so the new hub picks its first link.
          setSelectedDirectionId(id.startsWith("issy-zone-") ? null : id);
          patchSelection({ segmentId: id });
          setMapSelection((prev) => ({ ...prev, segmentId: id }));
        }}
        pilotGeometrySpec={pilotGeometrySpec}
      />

      {/* Bottom Attribution — tucked under left panel (corner, low z) */}
      <div
        className={`fixed left-3 bottom-3 z-[12] max-w-[min(280px,calc(100vw-24px))] text-[10px] text-primary-foreground/80 bg-purple/70 backdrop-blur-xl px-3 py-1.5 rounded-lg border border-primary-foreground/10 transition-opacity duration-200 ${
          showTour ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
      >
        Data period: 2024 snapshot · ELABORATOR Consortium · © OpenStreetMap contributors
      </div>

      {/* How to Use — tucked under right panel (corner, low z) */}
      {!showTour && (
        <div
          className="fixed bottom-3 z-[12]"
          style={{ right: mapSideInsets.right }}
        >
          <button
            type="button"
            onClick={() => setShowTour(true)}
            className="text-xs font-medium text-primary-foreground bg-violet/80 backdrop-blur-xl px-4 py-2 rounded-lg border border-violet/30 hover:bg-violet transition-all shadow-lg"
          >
            How to Use
          </button>
        </div>
      )}
    </div>
  );
};

const Map = () => (
  <MapIntelligenceProvider>
    <MapContent />
  </MapIntelligenceProvider>
);

export default Map;
