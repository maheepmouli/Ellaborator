import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, TrendingDown, TrendingUp } from "lucide-react";
import { PanelResizeHandle } from "@/components/PanelResizeHandle";
import { useResizablePanelWidth } from "@/hooks/use-resizable-panel-width";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ELABORATOR_KPIS, CITY_DATA, KPIValue } from "@/data/kpiDefinitions";
import { getPilotsByCity, getPilotById } from "@/data/pilotDefinitions";
import KPIChart from "./KPICharts";
import { StakeholderSummaryDialog } from "@/components/StakeholderSummaryDialog";
import { getKpiFrameworkConfig } from "@/config/kpiFramework";
import { getKpiDefinition } from "@/config/kpiDefinitions";
import {
  buildStakeholderPrintSummary,
  getPlainLanguageSummary,
  resolveImpactDisclaimer,
} from "@/data/narratives";
import { getIssyPilotProfile } from "@/data/issyPilotProfiles";
import { ISSY_OD_CSV_DISCLAIMER } from "@/lib/issyDataTransparency";
import {
  formatWinticsModalShareLine,
  ISSY_WINTICS_SITE_DISCLAIMER,
  winticsSustainableSharePct,
} from "@/lib/issyWinticsSite";
import {
  baselineKpiSlice,
  interventionKpiSlice,
  computeBaselineMainValue,
} from "@/lib/kpiBaselineVersusIntervention";
import { formatKpiFigure } from "@/lib/formatKpiFigure";
import { useIssyFlowData } from "@/hooks/use-issy-flow-data";
import { useIssyWorkbooks } from "@/hooks/use-issy-workbooks";
import { useCopenhagenNearEncounters } from "@/hooks/use-copenhagen-encounters";
import { useCopenhagenEmissions } from "@/hooks/use-copenhagen-emissions";
import { useLocalCityData } from "@/hooks/use-local-city-data";
import { buildIssyModeShareKpiSlices } from "@/lib/issyFlowAggregates";
import { buildTrikalaModeShareSliceForSelection } from "@/lib/trikalaModeShare";
import {
  aggregateHelsinkiObservedKpi,
  resolveHelsinkiKpiDisplayUnit,
} from "@/lib/helsinkiKpiDisplay";
import { loadTrikalaLocationsBundle } from "@/data/trikalaLocationRegistry";
import {
  getTrikalaSegmentInsights,
  getTrikalaWomenMobilityModeShareRows,
} from "@/services/trikalaSurveyParser";
import { useQuery } from "@tanstack/react-query";
import { isCopenhagenCameraKpi } from "@/data/copenhagenCameraSites";
import {
  aggregateCopenhagenObservedKpi,
  resolveCopenhagenKpiDisplayUnit,
} from "@/lib/copenhagenKpiDisplay";
import type { ChartDrillPayload } from "@/types/chartMapInteraction";
import { getKpi32TimeSeriesIntensity } from "@/lib/kpi32YearIntensity";
import { LayerTrustStrip, type LayerTrustSummary } from "@/components/LayerTrustStrip";
import { DataProvenanceBadge } from "@/components/DataProvenanceBadge";
import { PilotDataSummary } from "@/components/PilotDataSummary";
import { resolveKpiProvenance } from "@/lib/kpiProvenance";
import { getLocalCityDiagnostics } from "@/services/localCityData";
import { useMilanEnvironmentSegments, useMilanSpeedSegments } from "@/hooks/use-milan-segment-data";
import {
  aggregateMilanObservedKpi,
} from "@/lib/milanObservatoryView";
import {
  aggregateMilanJunctionMockKpi,
  buildMilanJunctionAccessibilityMockPoints,
  buildMilanJunctionClimateMockPoints,
  buildMilanJunctionModeShareMockPoints,
  milanHasObservedAccessibilityData,
  milanHasObservedClimateData,
  milanHasObservedModeShareData,
  milanJunctionAnchorsForPilot,
  pickJunctionsForModeSharePresentation,
} from "@/lib/milanMapLayers";
import { getIssySentimentMock, issySentimentKpiHeadline } from "@/data/issySentimentMock";
import {
  getCopenhagenSentimentMock,
  copenhagenSentimentKpiHeadline,
} from "@/data/copenhagenSentimentMock";
import {
  getCopenhagenAccessibilityMock,
  copenhagenAccessibilityKpiHeadline,
} from "@/data/copenhagenAccessibilityMock";
import { getIssyAccessibilityMock, issyAccessibilityKpiHeadline } from "@/data/issyAccessibilityMock";
import { aggregateMilanFacilitySiteKpi } from "@/data/milanZeroEmissionMock";
import { getCityPilotProfile } from "@/data/cityPilotProfiles";
import { getPrimaryJunctionConfig, hasJunctionConfig } from "@/data/junctionConfigs";
import { getCityReadinessSummary } from "@/data/kpiReadinessMatrix";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { MapSelectionState } from "@/types/mapSelection";

interface InsightPanelProps {
  selectedCity: string;
  selectedPilotName?: string;
  selectedPilotId?: string | null;
  selectedKpi: string;
  onCityChange: (city: string) => void;
  onPilotChange?: (pilotId: string) => void;
  onKpiChange: (kpi: string) => void;
  onRangeChange: (range: [number, number]) => void;
  selectedModeTypes?: string[];
  onModeTypesChange?: (modeTypes: string[]) => void;
  onOpenObservatory?: () => void;
  scenario: "baseline" | "intervention" | "comparison";
  onScenarioChange: (scenario: "baseline" | "intervention" | "comparison") => void;
  onOpenDataSummary: () => void;
  mapContext?: {
    segmentName: string;
    speed: number | null;
    congestion: number | null;
  } | null;
  dataQualitySummary?: LayerTrustSummary | null;
  manifestAvailable?: boolean;
  mapSelection?: MapSelectionState;
  /** Copenhagen map hover — scopes segment-focus charts without persisting selection. */
  hoveredSegmentId?: string | null;
  /** Milan KPI 3.2 RETE load window (paired with HeroMap parsers). */
  milanEnvironmentWindow?: "08-09" | "18-19";
  onMilanEnvironmentWindowChange?: (window: "08-09" | "18-19") => void;
  issyFlowDayCategory?: "all" | "weekday" | "weekend";
  onIssyFlowDayCategoryChange?: (category: "all" | "weekday" | "weekend") => void;
  /** KPI 3.1 — chart ↔ map: filter cycling infrastructure features. */
  infrastructureMapFocus?: string | null;
  onInfrastructureMapFocus?: (label: string | null) => void;
  /** Fly the pilot map after a chart drill (lat/lng/zoom). */
  onRequestPilotMapFocus?: (lat: number, lng: number, zoom?: number) => void;
  /** KPI 3.2 — selected trend year (synced map + chart highlight). */
  emissionsIntensityYear?: string | null;
  onEmissionsIntensityYearChange?: (year: string | null) => void;
}

const InsightPanel = ({
  selectedCity,
  selectedPilotName,
  selectedPilotId,
  selectedKpi,
  onCityChange,
  onPilotChange,
  onKpiChange,
  onRangeChange,
  selectedModeTypes: selectedModeTypesProp = [
    "Pedestrian",
    "Cycle",
    "Public Transport",
    "Private Car",
    "PTW",
  ],
  onModeTypesChange,
  onOpenObservatory,
  scenario,
  onScenarioChange,
  onOpenDataSummary,
  mapContext,
  dataQualitySummary,
  manifestAvailable,
  mapSelection,
  hoveredSegmentId = null,
  milanEnvironmentWindow = "08-09",
  onMilanEnvironmentWindowChange,
  issyFlowDayCategory = "all",
  onIssyFlowDayCategoryChange,
  infrastructureMapFocus = null,
  onInfrastructureMapFocus,
  onRequestPilotMapFocus,
  emissionsIntensityYear = null,
  onEmissionsIntensityYearChange,
}: InsightPanelProps) => {
  const selectedModeTypes = selectedModeTypesProp;

  const cityData = CITY_DATA.find((c) => c.city === selectedCity);
  const kpiDef = ELABORATOR_KPIS.find((k) => k.id === selectedKpi);
  const kpiValue: KPIValue | undefined = cityData?.kpiData[selectedKpi];
  const kpiFramework = useMemo(() => getKpiFrameworkConfig(selectedKpi), [selectedKpi]);
  const kpiDefinition = useMemo(() => getKpiDefinition(selectedKpi), [selectedKpi]);
  const pilotsForCity = useMemo(() => getPilotsByCity(selectedCity), [selectedCity]);
  const selectedPilot = useMemo(
    () => getPilotById(selectedCity, selectedPilotId || pilotsForCity[0]?.id),
    [selectedCity, selectedPilotId, pilotsForCity]
  );
  const supportedKpisForPilot = selectedPilot?.supportedKpis || ELABORATOR_KPIS.map((kpi) => kpi.id);
  const availableKpis = ELABORATOR_KPIS.filter((kpi) => supportedKpisForPilot.includes(kpi.id));
  const selectedPilotProfile = useMemo(
    () => getCityPilotProfile(selectedPilot?.id),
    [selectedPilot?.id]
  );
  const primaryJunction = useMemo(
    () => getPrimaryJunctionConfig(selectedPilotId),
    [selectedPilotId]
  );
  const showObservatory =
    !!onOpenObservatory && !!selectedPilotId && hasJunctionConfig(selectedPilotId);
  const cityReadinessSummary = useMemo(
    () => getCityReadinessSummary(selectedCity),
    [selectedCity]
  );
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [chartRadarFocus, setChartRadarFocus] = useState<string | null>(null);
  const [chartA11yFocus, setChartA11yFocus] = useState<string | null>(null);
  const { width: panelWidth, maxWidth: panelMaxWidth, isResizing, startResize, setPreset } =
    useResizablePanelWidth({
      storageKey: "elab-insight-panel-width",
      defaultWidth: 340,
      minWidth: 300,
      maxWidthCap: 560,
      maxViewportFraction: 0.42,
      side: "left",
    });
  const insightPanelWide = panelWidth >= 420;

  useEffect(() => {
    setChartRadarFocus(null);
    setChartA11yFocus(null);
  }, [selectedKpi]);

  const isIssyCity = selectedCity.toLowerCase().includes("issy");
  const isCopenhagenCity = selectedCity === "Copenhagen";
  const isTrikalaCity = selectedCity.toLowerCase().includes("trikala");
  const isHelsinkiCity = selectedCity === "Helsinki";
  const { data: trikalaSegmentInsights = [] } = useQuery({
    queryKey: ["trikala-segment-insights-insight-panel"],
    queryFn: getTrikalaSegmentInsights,
    enabled: isTrikalaCity && selectedKpi === "kpi1.2",
    staleTime: 120_000,
  });
  const { data: trikalaLocationsBundle } = useQuery({
    queryKey: ["trikala-locations-bundle-insight-panel"],
    queryFn: loadTrikalaLocationsBundle,
    enabled: isTrikalaCity && selectedKpi === "kpi1.2" && selectedPilotId === "tri-p2",
    staleTime: 600_000,
  });
  const { data: trikalaWomenMobilityModeShare = [] } = useQuery({
    queryKey: ["trikala-women-mobility-mode-share", "intervention-wide"],
    queryFn: () => getTrikalaWomenMobilityModeShareRows(null),
    enabled:
      isTrikalaCity && selectedKpi === "kpi1.2" && selectedPilotId !== "tri-p2",
    staleTime: 120_000,
  });
  const trikalaObservedModeShare = useMemo(() => {
    if (!isTrikalaCity || selectedKpi !== "kpi1.2") return null;
    if (selectedPilotId === "tri-p2") {
      return buildTrikalaModeShareSliceForSelection({
        pilotId: selectedPilotId,
        segmentId: null,
        insights: trikalaSegmentInsights,
        locations: trikalaLocationsBundle?.locations,
      });
    }
    if (!trikalaSegmentInsights.length && !trikalaWomenMobilityModeShare.length) return null;
    return buildTrikalaModeShareSliceForSelection({
      pilotId: selectedPilotId,
      segmentId: null,
      insights: trikalaSegmentInsights,
      womenMobilityModeShare: trikalaWomenMobilityModeShare,
    });
  }, [
    isTrikalaCity,
    selectedKpi,
    selectedPilotId,
    trikalaSegmentInsights,
    trikalaLocationsBundle?.locations,
    trikalaWomenMobilityModeShare,
  ]);
  const usingTrikalaObservedModeShare = !!trikalaObservedModeShare;
  const usingTrikalaIllustrativeModeShare =
    isTrikalaCity && selectedPilotId === "tri-p2" && selectedKpi === "kpi1.2" && !!trikalaObservedModeShare;
  const trikalaCityCenter = useMemo(() => {
    const city = CITY_DATA.find((c) => c.city === "Trikala");
    return city ? { lat: city.lat, lon: city.lon } : null;
  }, []);
  const { data: trikalaBikeLanePoints = [] } = useLocalCityData(
    isTrikalaCity && selectedPilotId === "tri-p3" && selectedKpi === "kpi2.1" ? "Trikala" : "",
    "kpi2.1",
    isTrikalaCity && selectedPilotId === "tri-p3" && selectedKpi === "kpi2.1" ? trikalaCityCenter : null,
    "tri-p3",
    "intervention"
  );
  const { data: trikalaBikeLaneSurveyPoints = [] } = useLocalCityData(
    isTrikalaCity && selectedPilotId === "tri-p3" && selectedKpi === "kpi4.2" ? "Trikala" : "",
    "kpi4.2",
    isTrikalaCity && selectedPilotId === "tri-p3" && selectedKpi === "kpi4.2" ? trikalaCityCenter : null,
    "tri-p3",
    "intervention"
  );
  const trikalaBikeLaneSafetyKpi = useMemo(() => {
    if (!isTrikalaCity || selectedPilotId !== "tri-p3" || selectedKpi !== "kpi2.1") return null;
    const fleet = trikalaBikeLanePoints.find(
      (p) => p.properties?.datasetKind === "bike-lane-sensor-fleet"
    );
    const sensors = trikalaBikeLanePoints.filter(
      (p) => p.properties?.datasetKind === "bike-lane-sensor"
    );
    const pool = fleet ? [fleet] : sensors;
    if (!pool.length) return null;
    const baseline =
      pool.reduce(
        (s, p) =>
          s +
          Number(
            p.properties?.mockSpeedBaselineKmh ??
              (typeof p.properties?.baselineValue === "number"
                ? 18 * (1 - Number(p.properties.baselineValue) / 100)
                : 0)
          ),
        0
      ) / pool.length;
    const intervention =
      pool.reduce(
        (s, p) =>
          s +
          Number(
            p.properties?.mockSpeedKmh ??
              (typeof p.properties?.interventionValue === "number"
                ? 18 * (1 - Number(p.properties.interventionValue) / 100)
                : p.value)
          ),
        0
      ) / pool.length;
    const baselineMain = Math.round(baseline * 10) / 10;
    const interventionMain = Math.round(intervention * 10) / 10;
    return {
      baselineMain,
      interventionMain,
      change: Math.round((interventionMain - baselineMain) * 10) / 10,
      unit: "km/h",
      note: "Mock speed from bike-lane LoRa occupancy (FREE/BUSY) — no radar speed feed",
    };
  }, [isTrikalaCity, selectedPilotId, selectedKpi, trikalaBikeLanePoints]);
  const usingTrikalaBikeLaneSafety = !!trikalaBikeLaneSafetyKpi;
  const trikalaBikeLaneSurveyKpi = useMemo(() => {
    if (!isTrikalaCity || selectedPilotId !== "tri-p3" || selectedKpi !== "kpi4.2") return null;
    const survey = trikalaBikeLaneSurveyPoints.filter(
      (p) =>
        p.properties?.datasetKind === "survey" ||
        Boolean(p.properties?.likertLabel) ||
        String(p.properties?.segmentId ?? "").includes("tri-p3-bike-lane")
    );
    if (!survey.length) return null;
    const a11y =
      survey.find((p) => /accessibility/i.test(String(p.properties?.likertLabel ?? ""))) ??
      survey[0];
    const baselineMain = Math.round(Number(a11y.properties?.baselineValue ?? a11y.value) * 10) / 10;
    const interventionMain =
      Math.round(Number(a11y.properties?.interventionValue ?? a11y.value) * 10) / 10;
    return {
      baselineMain,
      interventionMain,
      change: Math.round((interventionMain - baselineMain) * 10) / 10,
      unit: "%",
      note: "Online bike-safety survey (SharePoint) — city accessibility Likert, not LoRa availability",
    };
  }, [isTrikalaCity, selectedPilotId, selectedKpi, trikalaBikeLaneSurveyPoints]);
  const usingTrikalaBikeLaneSurvey = !!trikalaBikeLaneSurveyKpi;
  const issyFlowsQueryEnabled = isIssyCity && selectedKpi === "kpi1.2";
  const { data: issyFlowFeatures } = useIssyFlowData(issyFlowDayCategory, issyFlowsQueryEnabled);
  const { wintics: issyWinticsQuery, classeur: issyClasseurQuery } = useIssyWorkbooks(isIssyCity);
  const issyWinticsBaseline =
    selectedPilot?.id === "issy-p1" && selectedKpi === "kpi1.2"
      ? (issyWinticsQuery.data ?? null)
      : null;
  const issyClasseurEmissions = selectedKpi === "kpi3.2" ? (issyClasseurQuery.data ?? null) : null;
  const { snapshot: cphEncounters } = useCopenhagenNearEncounters();
  const { snapshot: cphEmissions } = useCopenhagenEmissions();
  const cphEncounterSummary =
    isCopenhagenCity && selectedKpi === "kpi2.1" && selectedPilotId === "cph-p3"
      ? cphEncounters?.records?.filter((r) => r.sourceKind === "partner") ?? null
      : null;
  const cphEmissionsModel =
    isCopenhagenCity && selectedKpi === "kpi3.2" ? cphEmissions : null;
  const issyModeShareFromCsv = useMemo(
    () =>
      issyFlowsQueryEnabled && issyFlowFeatures?.length
        ? buildIssyModeShareKpiSlices(issyFlowFeatures)
        : null,
    [issyFlowsQueryEnabled, issyFlowFeatures]
  );
  const usingIssyObservedModeShare = !!issyModeShareFromCsv;
  const issySentimentMock = useMemo(() => {
    if (!isIssyCity || selectedKpi !== "kpi4.1" || !selectedPilotId) return null;
    return getIssySentimentMock(selectedPilotId);
  }, [isIssyCity, selectedKpi, selectedPilotId]);
  const issySentimentFromMock = useMemo(() => {
    if (!issySentimentMock) return null;
    const headline = issySentimentKpiHeadline(issySentimentMock, scenario);
    return {
      baseline: {
        mainValue: headline.baselineMain,
        breakdown: headline.baselineBreakdown,
        change: 0,
      },
      intervention: {
        mainValue: headline.mainValue,
        breakdown: headline.breakdown,
        change: headline.change,
      },
      unit: headline.unit,
    };
  }, [issySentimentMock, scenario]);
  const copenhagenSentimentMock = useMemo(() => {
    if (!isCopenhagenCity || selectedKpi !== "kpi4.1" || !selectedPilotId) return null;
    return getCopenhagenSentimentMock(selectedPilotId);
  }, [isCopenhagenCity, selectedKpi, selectedPilotId]);
  const copenhagenSentimentFromMock = useMemo(() => {
    if (!copenhagenSentimentMock) return null;
    const headline = copenhagenSentimentKpiHeadline(copenhagenSentimentMock, scenario);
    return {
      baseline: {
        mainValue: headline.baselineMain,
        breakdown: headline.baselineBreakdown,
        change: 0,
      },
      intervention: {
        mainValue: headline.mainValue,
        breakdown: headline.breakdown,
        change: headline.change,
      },
      unit: headline.unit,
    };
  }, [copenhagenSentimentMock, scenario]);
  const copenhagenAccessibilityMock = useMemo(() => {
    if (!isCopenhagenCity || selectedKpi !== "kpi4.2" || !selectedPilotId) return null;
    return getCopenhagenAccessibilityMock(selectedPilotId);
  }, [isCopenhagenCity, selectedKpi, selectedPilotId]);
  const copenhagenAccessibilityFromMock = useMemo(() => {
    if (!copenhagenAccessibilityMock) return null;
    const headline = copenhagenAccessibilityKpiHeadline(copenhagenAccessibilityMock, scenario);
    return {
      baseline: {
        mainValue: headline.baselineMain,
        breakdown: headline.baselineBreakdown,
        change: 0,
      },
      intervention: {
        mainValue: headline.mainValue,
        breakdown: headline.breakdown,
        change: headline.change,
      },
      unit: headline.unit,
    };
  }, [copenhagenAccessibilityMock, scenario]);
  const issyAccessibilityMock = useMemo(() => {
    if (!isIssyCity || selectedKpi !== "kpi4.2" || !selectedPilotId) return null;
    return getIssyAccessibilityMock(selectedPilotId);
  }, [isIssyCity, selectedKpi, selectedPilotId]);
  const issyAccessibilityFromMock = useMemo(() => {
    if (!issyAccessibilityMock) return null;
    const headline = issyAccessibilityKpiHeadline(issyAccessibilityMock, scenario);
    return {
      baseline: {
        mainValue: issyAccessibilityMock.baselineFeatureCount,
        breakdown: headline.baselineBreakdown,
        change: 0,
      },
      intervention: {
        mainValue: issyAccessibilityMock.totalFeatures,
        breakdown: headline.breakdown,
        change: headline.change,
      },
      unit: headline.unit,
    };
  }, [issyAccessibilityMock, scenario]);
  const isMilanCity = selectedCity === "Milan";
  const milanPilotId =
    selectedPilotId === "mil-p1" || selectedPilotId === "mil-p2" || selectedPilotId === "mil-p3"
      ? selectedPilotId
      : "mil-p2";
  const milanCenter = cityData ? { lat: cityData.lat, lon: cityData.lon } : null;
  const shouldUseMilanLocalPoints =
    isMilanCity &&
    (selectedKpi === "kpi1.2" ||
      selectedKpi === "kpi3.1" ||
      selectedKpi === "kpi4.1" ||
      selectedKpi === "kpi4.2");
  const { data: milanLocalPoints } = useLocalCityData(
    "Milan",
    selectedKpi,
    shouldUseMilanLocalPoints ? milanCenter : null,
    selectedPilotId || null,
    scenario
  );
  const { data: milanSpeedDataset } = useMilanSpeedSegments(
    milanPilotId,
    isMilanCity &&
      (selectedKpi === "kpi2.1" ||
        selectedKpi === "kpi1.2" ||
        selectedKpi === "kpi3.2" ||
        selectedKpi === "kpi4.2")
  );
  const { data: milanEnvDataset } = useMilanEnvironmentSegments(
    milanEnvironmentWindow,
    isMilanCity && selectedKpi === "kpi3.2",
    milanPilotId
  );
  const milanJunctionMockPoints = useMemo(() => {
    if (!isMilanCity || !milanSpeedDataset?.records?.length) return null;
    const junctions = milanJunctionAnchorsForPilot(milanSpeedDataset.records);
    if (!junctions.length) return null;

    if (selectedKpi === "kpi1.2") {
      if (!milanHasObservedModeShareData(milanLocalPoints, milanPilotId)) {
        return buildMilanJunctionModeShareMockPoints(junctions, milanPilotId);
      }
      return null;
    }
    if (selectedKpi === "kpi3.2" && !milanHasObservedClimateData(milanEnvDataset)) {
      return buildMilanJunctionClimateMockPoints(
        junctions,
        milanPilotId,
        milanSpeedDataset.records
      );
    }
    if (
      selectedKpi === "kpi4.2" &&
      !milanHasObservedAccessibilityData(milanLocalPoints, milanPilotId)
    ) {
      return buildMilanJunctionAccessibilityMockPoints(junctions, milanPilotId);
    }
    return null;
  }, [
    isMilanCity,
    selectedKpi,
    milanSpeedDataset,
    milanEnvDataset,
    milanLocalPoints,
    milanPilotId,
  ]);

  const milanIllustrativeModeShareKpi = useMemo(() => {
    if (selectedKpi !== "kpi1.2" || !milanJunctionMockPoints?.length) return null;
    // Left panel is always intervention-wide; corridor detail lives in the observatory.
    return aggregateMilanObservedKpi(milanJunctionMockPoints, "kpi1.2", selectedModeTypes);
  }, [milanJunctionMockPoints, selectedModeTypes, selectedKpi]);

  const milanIllustrativeClimateKpi = useMemo(() => {
    if (selectedKpi !== "kpi3.2" || !milanJunctionMockPoints?.length) return null;
    return aggregateMilanJunctionMockKpi(milanJunctionMockPoints, scenario);
  }, [milanJunctionMockPoints, selectedKpi, scenario]);

  const milanIllustrativeAccessibilityKpi = useMemo(() => {
    if (selectedKpi !== "kpi4.2" || !milanJunctionMockPoints?.length) return null;
    return aggregateMilanJunctionMockKpi(milanJunctionMockPoints, scenario);
  }, [milanJunctionMockPoints, selectedKpi, scenario]);

  const milanIllustrativeSatisfactionKpi = useMemo(() => {
    if (!isMilanCity || selectedKpi !== "kpi4.1" || !milanLocalPoints?.length) return null;
    const surveys = milanLocalPoints.filter(
      (p) =>
        p.properties?.datasetKind === "survey" ||
        p.properties?.dataOrigin === "mock" ||
        p.properties?.mockLabel === "MOCK"
    );
    if (!surveys.length) return null;
    const baselineMain =
      Math.round(
        (surveys.reduce((s, p) => s + Number(p.properties?.baselineValue ?? p.value), 0) /
          surveys.length) *
          10
      ) / 10;
    const interventionMain =
      Math.round(
        (surveys.reduce((s, p) => s + Number(p.properties?.interventionValue ?? p.value), 0) /
          surveys.length) *
          10
      ) / 10;
    return {
      baselineMain,
      interventionMain,
      change: Math.round((interventionMain - baselineMain) * 10) / 10,
      unit: "%",
      isMock: surveys.every(
        (p) => p.properties?.dataOrigin === "mock" || p.properties?.type === "mock"
      ),
    };
  }, [isMilanCity, selectedKpi, milanLocalPoints]);

  const milanObservedPointKpi = useMemo(() => {
    if (!shouldUseMilanLocalPoints || !milanLocalPoints?.length) return null;
    const observed = milanLocalPoints.filter(
      (p) => p.properties?.dataOrigin === "local-city-dataset"
    );
    if (!observed.length) return null;
    return aggregateMilanObservedKpi(observed, selectedKpi, selectedModeTypes);
  }, [shouldUseMilanLocalPoints, milanLocalPoints, selectedKpi, selectedModeTypes]);
  const milanModeShareKpi = milanIllustrativeModeShareKpi ?? milanObservedPointKpi;
  const usingMilanIllustrativeModeShare =
    isMilanCity && selectedKpi === "kpi1.2" && !!milanIllustrativeModeShareKpi;
  const usingMilanIllustrativeClimate =
    isMilanCity && selectedKpi === "kpi3.2" && !!milanIllustrativeClimateKpi;
  const usingMilanIllustrativeAccessibility =
    isMilanCity && selectedKpi === "kpi4.2" && !!milanIllustrativeAccessibilityKpi;
  const usingMilanIllustrativeSatisfaction =
    isMilanCity && selectedKpi === "kpi4.1" && !!milanIllustrativeSatisfactionKpi;
  const usingMilanObservedModeShare =
    isMilanCity && selectedKpi === "kpi1.2" && !!milanObservedPointKpi && !usingMilanIllustrativeModeShare;
  const milanSegmentHeadline = useMemo(() => {
    if (!isMilanCity) return null;
    if (selectedKpi === "kpi2.1" && milanSpeedDataset?.records?.length) {
      const speeds = milanSpeedDataset.records.map((r) =>
        Number(r.properties?.avgSpeed ?? r.value)
      );
      const avg =
        speeds.reduce((sum, v) => sum + (Number.isFinite(v) ? v : 0), 0) /
        Math.max(speeds.length, 1);
      return {
        baselineMain: avg * 1.08,
        interventionMain: avg,
        change: avg - avg * 1.08,
      };
    }
    if (selectedKpi === "kpi3.2" && milanEnvDataset?.records?.length) {
      // RETE avg is a traffic-composition pressure index — not a % reduction.
      // Headline keeps the CITY_DATA unit ("% reduction") via before→after scenario delta.
      const avg = milanEnvDataset.stats.avgMetricValue;
      const baselinePressure = avg * 1.17;
      const interventionPressure = avg;
      const reductionPct =
        baselinePressure > 0
          ? ((baselinePressure - interventionPressure) / baselinePressure) * 100
          : 0;
      const rounded = Math.round(reductionPct * 100) / 100;
      return {
        baselineMain: 0,
        interventionMain: rounded,
        change: -rounded,
      };
    }
    if (selectedKpi === "kpi3.2" && milanIllustrativeClimateKpi) {
      return milanIllustrativeClimateKpi;
    }
    if (selectedKpi === "kpi4.2" && milanIllustrativeAccessibilityKpi) {
      return milanIllustrativeAccessibilityKpi;
    }
    if (selectedKpi === "kpi4.1" && milanIllustrativeSatisfactionKpi) {
      return {
        baselineMain: milanIllustrativeSatisfactionKpi.baselineMain,
        interventionMain: milanIllustrativeSatisfactionKpi.interventionMain,
        change: milanIllustrativeSatisfactionKpi.change,
      };
    }
    if (selectedKpi === "kpi3.1" && milanLocalPoints?.length) {
      const facilities = milanLocalPoints.filter(
        (p) => p.properties?.datasetKind === "parking"
      );
      if (facilities.length) {
        return aggregateMilanFacilitySiteKpi(facilities);
      }
    }
    return null;
  }, [
    isMilanCity,
    selectedKpi,
    milanSpeedDataset,
    milanEnvDataset,
    milanIllustrativeClimateKpi,
    milanIllustrativeAccessibilityKpi,
    milanIllustrativeSatisfactionKpi,
    milanLocalPoints,
  ]);
  const copenhagenCenter = cityData ? { lat: cityData.lat, lon: cityData.lon } : null;
  const shouldUseCopenhagenObserved =
    selectedCity === "Copenhagen" && isCopenhagenCameraKpi(selectedKpi);
  const { data: copenhagenLocalPoints } = useLocalCityData(
    "Copenhagen",
    selectedKpi,
    shouldUseCopenhagenObserved ? copenhagenCenter : null,
    selectedPilotId || null,
    scenario
  );
  const copenhagenObservedModeShare = useMemo(() => {
    if (!shouldUseCopenhagenObserved || !copenhagenLocalPoints?.length) return null;
    const observed = copenhagenLocalPoints.filter(
      (p) => p.properties?.dataOrigin === "local-city-dataset"
    );
    if (!observed.length) return null;

    // Left panel KPI chart is always intervention-wide; corridor detail lives in the observatory.
    return aggregateCopenhagenObservedKpi(observed, selectedKpi, selectedModeTypes);
  }, [shouldUseCopenhagenObserved, copenhagenLocalPoints, selectedModeTypes, selectedKpi]);

  const helsinkiCenter = cityData ? { lat: cityData.lat, lon: cityData.lon } : null;
  const { data: helsinkiLocalPoints } = useLocalCityData(
    "Helsinki",
    selectedKpi,
    isHelsinkiCity ? helsinkiCenter : null,
    selectedPilotId || null,
    scenario
  );
  const helsinkiObservedKpi = useMemo(() => {
    if (!isHelsinkiCity || !helsinkiLocalPoints?.length) return null;
    const observed = helsinkiLocalPoints.filter(
      (p) =>
        p.properties?.dataOrigin === "local-city-dataset" ||
        p.properties?.parserStatus === "ready"
    );
    if (!observed.length) return null;
    return aggregateHelsinkiObservedKpi(observed, selectedKpi, selectedModeTypes);
  }, [isHelsinkiCity, helsinkiLocalPoints, selectedKpi, selectedModeTypes]);
  const usingHelsinkiObservedKpi = !!helsinkiObservedKpi?.hasSelectedRecords;

  const milanJunctionIllustrativeNote = useMemo(() => {
    if (!isMilanCity || !milanSpeedDataset?.records?.length) return null;
    const junctionCount = milanJunctionAnchorsForPilot(milanSpeedDataset.records).length;
    if (!junctionCount) {
      return "KPI 2.1 safety network unavailable — illustrative junction data cannot be placed.";
    }
    if (selectedKpi === "kpi1.2" && usingMilanIllustrativeModeShare) {
      return `Copenhagen-style illustrative demo: ${junctionCount} major junction${junctionCount === 1 ? "" : "s"} from the KPI 2.1 network (target 6–8). Mode-share values are mock proxies — not partner AMAT counts.`;
    }
    if (selectedKpi === "kpi3.2" && usingMilanIllustrativeClimate) {
      return `Illustrative climate proxy at ${junctionCount} mode-share junction hub${junctionCount === 1 ? "" : "s"} — RETE environment segments unavailable for this pilot.`;
    }
    if (selectedKpi === "kpi4.2" && usingMilanIllustrativeAccessibility) {
      return `Illustrative accessibility proxy at ${junctionCount} mode-share junction hub${junctionCount === 1 ? "" : "s"} — DSS workbook has no pilot-scoped rows.`;
    }
    return null;
  }, [
    isMilanCity,
    selectedKpi,
    milanSpeedDataset,
    usingMilanIllustrativeModeShare,
    usingMilanIllustrativeClimate,
    usingMilanIllustrativeAccessibility,
  ]);

  const milanSatisfactionNote = useMemo(() => {
    if (!usingMilanIllustrativeSatisfaction) return null;
    return milanIllustrativeSatisfactionKpi?.isMock
      ? "MOCK CDM3 Activity 5 satisfaction themes — SharePoint folder 7 (Satisfaction LL) has no survey workbooks yet."
      : "Milan satisfaction survey aggregates from SharePoint folder 7.";
  }, [usingMilanIllustrativeSatisfaction, milanIllustrativeSatisfactionKpi]);

  const provenance = useMemo(() => {
    const milanSegmentDiagnostics =
      isMilanCity && selectedKpi === "kpi2.1" && (milanSpeedDataset?.records?.length ?? 0) > 0
        ? {
            reason: "ok" as const,
            message: `${milanSpeedDataset!.records.length} AMAT speed segments loaded for ${milanPilotId}.`,
          }
        : isMilanCity && selectedKpi === "kpi3.2" && (milanEnvDataset?.records?.length ?? 0) > 0
          ? {
              reason: "ok" as const,
              message: `${milanEnvDataset!.records.length} RETE segments loaded (${milanEnvironmentWindow}).`,
            }
          : isMilanCity && selectedKpi === "kpi3.2" && usingMilanIllustrativeClimate
            ? {
                reason: "mock" as const,
                message: `${milanJunctionAnchorsForPilot(milanSpeedDataset!.records).length} illustrative junction climate proxies (mode-share anchors).`,
              }
          : isMilanCity && selectedKpi === "kpi1.2" && usingMilanIllustrativeModeShare
            ? {
                reason: "mock" as const,
                message: `${pickJunctionsForModeSharePresentation(milanSpeedDataset!.records).length} illustrative junction hubs on KPI 2.1 network (mock mode-share).`,
              }
            : isMilanCity &&
              selectedKpi === "kpi1.2" &&
              (milanLocalPoints?.filter((p) => p.properties?.datasetKind === "amat-count").length ?? 0) > 0
            ? {
                reason: "ok" as const,
                message: `${milanLocalPoints!.filter((p) => p.properties?.datasetKind === "amat-count").length} AMAT approach flow points loaded for ${milanPilotId}.`,
              }
            : isMilanCity &&
                selectedKpi === "kpi4.2" &&
                (milanLocalPoints?.filter((p) => p.properties?.datasetKind === "accessibility").length ?? 0) > 0
              ? {
                  reason: "ok" as const,
                  message: `${milanLocalPoints!.filter((p) => p.properties?.datasetKind === "accessibility").length} DSS accessibility categories loaded for ${milanPilotId}.`,
                }
            : isMilanCity && selectedKpi === "kpi4.2" && usingMilanIllustrativeAccessibility
              ? {
                  reason: "mock" as const,
                  message: `${milanJunctionAnchorsForPilot(milanSpeedDataset!.records).length} illustrative junction accessibility proxies (mode-share anchors).`,
                }
            : isMilanCity &&
                selectedKpi === "kpi4.1" &&
                (milanLocalPoints?.filter((p) => p.properties?.datasetKind === "survey").length ?? 0) > 0
              ? {
                  reason: (milanLocalPoints!.some(
                    (p) =>
                      p.properties?.dataOrigin === "mock" ||
                      p.properties?.mockLabel === "MOCK" ||
                      p.properties?.type === "mock"
                  )
                    ? "mock"
                    : "ok") as "mock" | "ok",
                  message: `${milanLocalPoints!.filter((p) => p.properties?.datasetKind === "survey").length} satisfaction theme sample${
                    milanLocalPoints!.filter((p) => p.properties?.datasetKind === "survey").length === 1
                      ? ""
                      : "s"
                  } for ${milanPilotId}.`,
                }
              : null;
    const diagnostics =
      milanSegmentDiagnostics ?? getLocalCityDiagnostics(selectedCity, selectedKpi, selectedPilotId);
    const mapUsesLocalDataset = Boolean(
      copenhagenLocalPoints?.some((p) => p.properties?.dataOrigin === "local-city-dataset") ||
        helsinkiLocalPoints?.some((p) => p.properties?.dataOrigin === "local-city-dataset") ||
        milanLocalPoints?.some((p) => p.properties?.dataOrigin === "local-city-dataset") ||
        (milanSpeedDataset?.records?.length ?? 0) > 0 ||
        (milanEnvDataset?.records?.length ?? 0) > 0 ||
        dataQualitySummary?.provenanceType === "observed" ||
        dataQualitySummary?.provenanceType === "mock"
    );
    const panelUsesObservedSlice = Boolean(
      usingIssyObservedModeShare ||
        (usingTrikalaObservedModeShare && !usingTrikalaIllustrativeModeShare) ||
        usingTrikalaBikeLaneSafety ||
        usingTrikalaBikeLaneSurvey ||
        copenhagenObservedModeShare ||
        usingHelsinkiObservedKpi ||
        (milanModeShareKpi && !usingMilanIllustrativeModeShare) ||
        (milanSegmentHeadline && !usingMilanIllustrativeClimate && !usingMilanIllustrativeAccessibility) ||
        usingMilanIllustrativeClimate ||
        usingMilanIllustrativeAccessibility ||
        usingMilanIllustrativeSatisfaction ||
        (isCopenhagenCity && selectedKpi === "kpi3.2" && cphEmissionsModel)
    );
    return resolveKpiProvenance({
      city: selectedCity,
      kpiId: selectedKpi,
      pilot: selectedPilot,
      diagnostics,
      dataQualitySummary,
      manifestAvailable,
      panelUsesObservedSlice,
      mapUsesLocalDataset,
      copenhagenEmissionsActive: Boolean(cphEmissionsModel?.flows?.length),
    });
  }, [
    selectedCity,
    selectedKpi,
    selectedPilot,
    selectedPilotId,
    copenhagenLocalPoints,
    helsinkiLocalPoints,
    dataQualitySummary,
    manifestAvailable,
    usingIssyObservedModeShare,
    usingTrikalaObservedModeShare,
    usingTrikalaIllustrativeModeShare,
    usingTrikalaBikeLaneSafety,
    usingTrikalaBikeLaneSurvey,
    copenhagenObservedModeShare,
    usingHelsinkiObservedKpi,
    milanModeShareKpi,
    milanSegmentHeadline,
    usingMilanIllustrativeModeShare,
    usingMilanIllustrativeClimate,
    usingMilanIllustrativeAccessibility,
    usingMilanIllustrativeSatisfaction,
    milanLocalPoints,
    milanSpeedDataset,
    milanEnvDataset,
    milanEnvironmentWindow,
    milanPilotId,
    isMilanCity,
    cphEmissionsModel,
  ]);

  const displayUnit = useMemo(() => {
    if (!kpiValue) return "";
    if (issySentimentFromMock?.unit) return issySentimentFromMock.unit;
    if (copenhagenSentimentFromMock?.unit) return copenhagenSentimentFromMock.unit;
    if (copenhagenAccessibilityFromMock?.unit) return copenhagenAccessibilityFromMock.unit;
    if (issyAccessibilityFromMock?.unit) return issyAccessibilityFromMock.unit;
    if (isMilanCity && selectedKpi === "kpi2.1" && milanSegmentHeadline) return "km/h";
    if (isMilanCity && selectedKpi === "kpi3.1" && milanSegmentHeadline) return "sites";
    // RETE headline is converted to % reduction; illustrative junction mock stays an index.
    if (isMilanCity && selectedKpi === "kpi3.2" && usingMilanIllustrativeClimate) return " env. idx";
    if (isMilanCity && selectedKpi === "kpi3.2" && milanSegmentHeadline) return "% reduction";
    if (isMilanCity && selectedKpi === "kpi4.2" && usingMilanIllustrativeAccessibility) return "%";
    if (isMilanCity && selectedKpi === "kpi4.1" && milanSegmentHeadline) return "%";
    if (usingTrikalaBikeLaneSafety) return "km/h";
    if (usingTrikalaBikeLaneSurvey) return "%";
    return isTrikalaCity && trikalaObservedModeShare
      ? "%"
      : isCopenhagenCity && copenhagenObservedModeShare
      ? resolveCopenhagenKpiDisplayUnit(selectedKpi)
      : isHelsinkiCity && helsinkiObservedKpi
        ? helsinkiObservedKpi.unit || resolveHelsinkiKpiDisplayUnit(selectedKpi)
      : kpiValue.unit;
  }, [
    isTrikalaCity,
    trikalaObservedModeShare,
    usingTrikalaBikeLaneSafety,
    usingTrikalaBikeLaneSurvey,
    isCopenhagenCity,
    copenhagenObservedModeShare,
    isHelsinkiCity,
    helsinkiObservedKpi,
    selectedKpi,
    kpiValue,
    issySentimentFromMock,
    copenhagenSentimentFromMock,
    copenhagenAccessibilityFromMock,
    issyAccessibilityFromMock,
    isMilanCity,
    milanSegmentHeadline,
    usingMilanIllustrativeClimate,
    usingMilanIllustrativeAccessibility,
  ]);

  const chartExplorerKeys = useMemo(() => {
    if (selectedKpi === "kpi1.2") return selectedModeTypes;
    if (selectedKpi === "kpi2.1") return chartRadarFocus ? [chartRadarFocus] : [];
    if (selectedKpi === "kpi3.1") return infrastructureMapFocus ? [infrastructureMapFocus] : [];
    if (selectedKpi === "kpi3.2") return emissionsIntensityYear ? [emissionsIntensityYear] : [];
    if (selectedKpi === "kpi4.2") return chartA11yFocus ? [chartA11yFocus] : [];
    return [];
  }, [
    selectedKpi,
    selectedModeTypes,
    chartRadarFocus,
    infrastructureMapFocus,
    emissionsIntensityYear,
    chartA11yFocus,
  ]);

  const handleExplorerChartDrill = useCallback(
    (payload: ChartDrillPayload) => {
      const pilotLat = typeof selectedPilot?.lat === "number" ? selectedPilot.lat : undefined;
      const pilotLon = typeof selectedPilot?.lng === "number" ? selectedPilot.lng : undefined;
      const lat = pilotLat ?? cityData?.lat;
      const lng = pilotLon ?? cityData?.lon;

      switch (payload.source) {
        case "kpi1.2":
          onModeTypesChange?.([payload.key]);
          break;
        case "kpi2.1":
          setChartRadarFocus((prev) => (prev === payload.key ? null : payload.key));
          break;
        case "kpi3.1":
          onInfrastructureMapFocus?.(infrastructureMapFocus === payload.key ? null : payload.key);
          break;
        case "kpi3.2":
          onEmissionsIntensityYearChange?.(emissionsIntensityYear === payload.key ? null : payload.key);
          break;
        case "kpi4.2":
          setChartA11yFocus((prev) => (prev === payload.key ? null : payload.key));
          break;
        default:
          break;
      }
      if (lat != null && lng != null) {
        onRequestPilotMapFocus?.(lat, lng, 13);
      }
    },
    [
      cityData?.lat,
      cityData?.lon,
      infrastructureMapFocus,
      selectedPilot?.lat,
      selectedPilot?.lng,
      emissionsIntensityYear,
      onInfrastructureMapFocus,
      onModeTypesChange,
      onEmissionsIntensityYearChange,
      onRequestPilotMapFocus,
    ]
  );

  const emissionsYearSeriesIntensity = useMemo(() => {
    if (selectedKpi !== "kpi3.2" || !emissionsIntensityYear) return null;
    return getKpi32TimeSeriesIntensity(cityData?.kpiData["kpi3.2"], emissionsIntensityYear);
  }, [cityData?.kpiData, emissionsIntensityYear, selectedKpi]);

  const isModeShare = selectedKpi === "kpi1.2";
  const observatoryCtaLabel =
    selectedPilotProfile?.observatoryType === "camera"
      ? "Camera Observatory"
      : "Segment Observatory";

  const reportHref = useMemo(() => {
    const q = new URLSearchParams({
      city: selectedCity,
      kpi: selectedKpi,
      scenario,
    });
    if (selectedPilot?.id) q.set("pilotId", selectedPilot.id);
    if (selectedPilot?.name) q.set("pilotName", selectedPilot.name);
    return `/report?${q.toString()}`;
  }, [selectedCity, selectedKpi, scenario, selectedPilot?.id, selectedPilot?.name]);

  /** Print narrative + plots from the open dialog (`#insight-summary-print-target`). */
  const printInsightSummary = () => {
    if (typeof window === "undefined") return;
    document.documentElement.classList.add("printing-insight-summary");
    requestAnimationFrame(() => {
      window.print();
      const cleanup = () => {
        document.documentElement.classList.remove("printing-insight-summary");
        window.removeEventListener("afterprint", cleanup);
      };
      window.addEventListener("afterprint", cleanup);
      window.setTimeout(cleanup, 1800);
    });
  };

  useEffect(() => {
    // Always keep a catalog KPI that this pilot supports — unknown ids (e.g. kpi1.1
    // before it was registered) would otherwise make this panel return null and hide
    // the pilot / KPI selectors.
    if (!availableKpis.length) return;
    const selectedIsAvailable = availableKpis.some((kpi) => kpi.id === selectedKpi);
    if (!selectedIsAvailable || !kpiDef || !kpiValue) {
      const fallbackKpi = availableKpis[0]?.id;
      if (fallbackKpi && fallbackKpi !== selectedKpi) onKpiChange(fallbackKpi);
    }
  }, [kpiDef, kpiValue, selectedKpi, availableKpis, onKpiChange]);

  const missingDataNotice = useMemo(() => provenance.missingNotice, [provenance]);

  const confidenceLine = useMemo(() => {
    const parts: string[] = [];
    if (provenance.sourceLabel) parts.push(provenance.sourceLabel);
    if (provenance.confidence) parts.push(`${provenance.confidence} confidence`);
    return parts.join(" · ");
  }, [provenance]);

  const stakeholderSummary = useMemo(() => {
    if (!kpiDef || !kpiValue || !selectedPilot) return null;
    const fwEarly = getKpiFrameworkConfig(selectedKpi);
    const baselineMainValue = issyModeShareFromCsv
      ? issyModeShareFromCsv.baseline.mainValue
      : issySentimentFromMock
        ? issySentimentFromMock.baseline.mainValue
        : copenhagenSentimentFromMock
          ? copenhagenSentimentFromMock.baseline.mainValue
        : copenhagenAccessibilityFromMock
          ? copenhagenAccessibilityFromMock.baseline.mainValue
        : issyAccessibilityFromMock
          ? issyAccessibilityFromMock.baseline.mainValue
          : trikalaBikeLaneSafetyKpi
            ? trikalaBikeLaneSafetyKpi.baselineMain
          : trikalaBikeLaneSurveyKpi
            ? trikalaBikeLaneSurveyKpi.baselineMain
          : trikalaObservedModeShare
          ? trikalaObservedModeShare.baselineMain
          : copenhagenObservedModeShare
            ? copenhagenObservedModeShare.baselineMain
            : helsinkiObservedKpi
              ? helsinkiObservedKpi.baselineMain
            : milanModeShareKpi
              ? milanModeShareKpi.baselineMain
              : milanSegmentHeadline
                ? milanSegmentHeadline.baselineMain
                : computeBaselineMainValue(kpiValue);
    const interventionMainValue = issyModeShareFromCsv
      ? issyModeShareFromCsv.intervention.mainValue
      : issySentimentFromMock
        ? issySentimentFromMock.intervention.mainValue
        : copenhagenSentimentFromMock
          ? copenhagenSentimentFromMock.intervention.mainValue
        : copenhagenAccessibilityFromMock
          ? copenhagenAccessibilityFromMock.intervention.mainValue
        : issyAccessibilityFromMock
          ? issyAccessibilityFromMock.intervention.mainValue
          : trikalaBikeLaneSafetyKpi
            ? trikalaBikeLaneSafetyKpi.interventionMain
          : trikalaBikeLaneSurveyKpi
            ? trikalaBikeLaneSurveyKpi.interventionMain
          : trikalaObservedModeShare
            ? trikalaObservedModeShare.interventionMain
            : copenhagenObservedModeShare
              ? copenhagenObservedModeShare.interventionMain
              : helsinkiObservedKpi
                ? helsinkiObservedKpi.interventionMain
              : milanModeShareKpi
                ? milanModeShareKpi.interventionMain
                : milanSegmentHeadline
                  ? milanSegmentHeadline.interventionMain
                  : Number(kpiValue.mainValue);
    const headlineChange =
      issyModeShareFromCsv?.intervention.change ??
      issySentimentFromMock?.intervention.change ??
      copenhagenSentimentFromMock?.intervention.change ??
      copenhagenAccessibilityFromMock?.intervention.change ??
      issyAccessibilityFromMock?.intervention.change ??
      trikalaBikeLaneSafetyKpi?.change ??
      trikalaBikeLaneSurveyKpi?.change ??
      trikalaObservedModeShare?.change ??
      copenhagenObservedModeShare?.change ??
      helsinkiObservedKpi?.change ??
      milanModeShareKpi?.change ??
      milanSegmentHeadline?.change ??
      kpiValue.change;
    const helsinkiBA =
      selectedCity === "Helsinki" &&
      (selectedKpi === "kpi1.2" || selectedKpi === "kpi2.1") &&
      usingHelsinkiObservedKpi;
    const disc = resolveImpactDisclaimer({
      kpiId: selectedKpi,
      isMockFramework: !!fwEarly?.isMock,
      isHelsinkiObservedBeforeAfter: helsinkiBA,
      hasSegmentContext: !!mapContext,
    });
    const liveContextLine = dataQualitySummary
      ? `Active layer: ${dataQualitySummary.recordsLabel}; ${dataQualitySummary.spatialQuality}; ${dataQualitySummary.temporalCoverage}.`
      : undefined;
    const issyProfile = getIssyPilotProfile(selectedPilot.id);
    let focusNote: string | undefined;
    if (issyProfile && issyProfile.defaultKpi !== selectedKpi) {
      const defaultFw = getKpiFrameworkConfig(issyProfile.defaultKpi);
      focusNote = `Primary analytical lens for this pilot is ${defaultFw?.displayName || issyProfile.defaultKpi} — you are viewing ${fwEarly?.displayName || selectedKpi} in the explorer.`;
    }
    const issyOdNote =
      isIssyCity && selectedKpi === "kpi1.2" ? ISSY_OD_CSV_DISCLAIMER : undefined;

    return buildStakeholderPrintSummary({
      selectedCity,
      pilot: {
        name: selectedPilot.name,
        title: selectedPilot.title,
        description: selectedPilot.description,
        interventionType: selectedPilot.interventionType,
        goal: selectedPilot.goal,
        datasets: selectedPilot.datasets,
        focusNote,
      },
      kpiRef: kpiDef.ref,
      kpiDisplayName: kpiFramework?.displayName || kpiDef.shortName,
      kpiPlainLanguage:
        getPlainLanguageSummary(selectedKpi) || kpiFramework?.question || kpiDef.question,
      scenario,
      unit: displayUnit,
      baselineMainValue,
      interventionMainValue,
      headlineChange,
      disclaimerLine: disc.line,
      liveContextLine,
      issyOdNote,
    });
  }, [
    selectedPilot,
    selectedKpi,
    selectedCity,
    scenario,
    mapContext,
    dataQualitySummary,
    isIssyCity,
    kpiDef,
    kpiFramework,
    kpiValue,
    issyModeShareFromCsv,
    issySentimentFromMock,
    copenhagenSentimentFromMock,
    copenhagenAccessibilityFromMock,
    issyAccessibilityFromMock,
    copenhagenObservedModeShare,
    helsinkiObservedKpi,
    milanModeShareKpi,
    milanSegmentHeadline,
    trikalaObservedModeShare,
    trikalaBikeLaneSafetyKpi,
    trikalaBikeLaneSurveyKpi,
    displayUnit,
  ]);

  if (!kpiDef || !kpiValue) return null;

  const baselineKvSlice = issyModeShareFromCsv
    ? issyModeShareFromCsv.baseline
    : issySentimentFromMock
      ? issySentimentFromMock.baseline
      : copenhagenSentimentFromMock
        ? copenhagenSentimentFromMock.baseline
      : copenhagenAccessibilityFromMock
        ? copenhagenAccessibilityFromMock.baseline
      : issyAccessibilityFromMock
        ? issyAccessibilityFromMock.baseline
        : trikalaObservedModeShare
          ? {
              mainValue: trikalaObservedModeShare.baselineMain,
              breakdown: trikalaObservedModeShare.breakdownBaseline,
              change: 0,
            }
          : copenhagenObservedModeShare
          ? {
              mainValue: copenhagenObservedModeShare.baselineMain,
              breakdown: copenhagenObservedModeShare.breakdownBaseline,
              change: 0,
            }
          : helsinkiObservedKpi
          ? {
              mainValue: helsinkiObservedKpi.baselineMain,
              breakdown: helsinkiObservedKpi.breakdownBaseline,
              change: 0,
            }
          : milanModeShareKpi
            ? {
                mainValue: milanModeShareKpi.baselineMain,
                breakdown: milanModeShareKpi.breakdownBaseline,
                change: 0,
              }
            : milanSegmentHeadline
              ? {
                  mainValue: milanSegmentHeadline.baselineMain,
                  change: 0,
                }
          : baselineKpiSlice(kpiValue);
  const interventionKvSlice = issyModeShareFromCsv
    ? issyModeShareFromCsv.intervention
    : issySentimentFromMock
      ? issySentimentFromMock.intervention
      : copenhagenSentimentFromMock
        ? copenhagenSentimentFromMock.intervention
      : copenhagenAccessibilityFromMock
        ? copenhagenAccessibilityFromMock.intervention
      : issyAccessibilityFromMock
        ? issyAccessibilityFromMock.intervention
        : trikalaObservedModeShare
          ? {
              mainValue: trikalaObservedModeShare.interventionMain,
              breakdown: trikalaObservedModeShare.breakdownIntervention,
              change: trikalaObservedModeShare.change,
            }
          : copenhagenObservedModeShare
          ? {
              mainValue: copenhagenObservedModeShare.interventionMain,
              breakdown: copenhagenObservedModeShare.breakdownIntervention,
              change: copenhagenObservedModeShare.change,
            }
          : helsinkiObservedKpi
          ? {
              mainValue: helsinkiObservedKpi.interventionMain,
              breakdown: helsinkiObservedKpi.breakdownIntervention,
              change: helsinkiObservedKpi.change,
            }
          : milanModeShareKpi
            ? {
                mainValue: milanModeShareKpi.interventionMain,
                breakdown: milanModeShareKpi.breakdownIntervention,
                change: milanModeShareKpi.change,
              }
            : milanSegmentHeadline
              ? {
                  mainValue: milanSegmentHeadline.interventionMain,
                  change: milanSegmentHeadline.change,
                }
          : interventionKpiSlice(kpiValue);
  const baselineMainValue = issyModeShareFromCsv
    ? issyModeShareFromCsv.baseline.mainValue
    : issySentimentFromMock
      ? issySentimentFromMock.baseline.mainValue
      : copenhagenSentimentFromMock
        ? copenhagenSentimentFromMock.baseline.mainValue
      : copenhagenAccessibilityFromMock
        ? copenhagenAccessibilityFromMock.baseline.mainValue
      : issyAccessibilityFromMock
        ? issyAccessibilityFromMock.baseline.mainValue
        : trikalaBikeLaneSafetyKpi
          ? trikalaBikeLaneSafetyKpi.baselineMain
        : trikalaBikeLaneSurveyKpi
          ? trikalaBikeLaneSurveyKpi.baselineMain
        : trikalaObservedModeShare
          ? trikalaObservedModeShare.baselineMain
          : copenhagenObservedModeShare
          ? copenhagenObservedModeShare.baselineMain
          : helsinkiObservedKpi
          ? helsinkiObservedKpi.baselineMain
          : milanModeShareKpi
            ? milanModeShareKpi.baselineMain
            : milanSegmentHeadline
              ? milanSegmentHeadline.baselineMain
          : computeBaselineMainValue(kpiValue);
  const interventionMainValue = issyModeShareFromCsv
    ? issyModeShareFromCsv.intervention.mainValue
    : issySentimentFromMock
      ? issySentimentFromMock.intervention.mainValue
      : copenhagenSentimentFromMock
        ? copenhagenSentimentFromMock.intervention.mainValue
      : copenhagenAccessibilityFromMock
        ? copenhagenAccessibilityFromMock.intervention.mainValue
      : issyAccessibilityFromMock
        ? issyAccessibilityFromMock.intervention.mainValue
        : trikalaBikeLaneSafetyKpi
          ? trikalaBikeLaneSafetyKpi.interventionMain
        : trikalaBikeLaneSurveyKpi
          ? trikalaBikeLaneSurveyKpi.interventionMain
        : trikalaObservedModeShare
          ? trikalaObservedModeShare.interventionMain
          : copenhagenObservedModeShare
          ? copenhagenObservedModeShare.interventionMain
          : helsinkiObservedKpi
          ? helsinkiObservedKpi.interventionMain
          : milanModeShareKpi
            ? milanModeShareKpi.interventionMain
            : milanSegmentHeadline
              ? milanSegmentHeadline.interventionMain
          : Number(kpiValue.mainValue);
  const headlineChange =
    issyModeShareFromCsv?.intervention.change ??
    issySentimentFromMock?.intervention.change ??
    copenhagenSentimentFromMock?.intervention.change ??
    copenhagenAccessibilityFromMock?.intervention.change ??
    issyAccessibilityFromMock?.intervention.change ??
    trikalaBikeLaneSafetyKpi?.change ??
    trikalaBikeLaneSurveyKpi?.change ??
    trikalaObservedModeShare?.change ??
    copenhagenObservedModeShare?.change ??
    helsinkiObservedKpi?.change ??
    milanModeShareKpi?.change ??
    milanSegmentHeadline?.change ??
    kpiValue.change;
  const currentMainValue = scenario === "baseline" ? baselineMainValue : interventionMainValue;
  const baselineBreakdown =
    "breakdown" in baselineKvSlice ? baselineKvSlice.breakdown : undefined;
  const interventionBreakdown =
    "breakdown" in interventionKvSlice ? interventionKvSlice.breakdown : undefined;
  const currentBreakdown = scenario === "baseline" ? baselineBreakdown : interventionBreakdown;

  const currentKpiValue: KPIValue = {
    ...kpiValue,
    mainValue: currentMainValue,
    breakdown:
      selectedKpi === "kpi2.1" && isCopenhagenCity
        ? interventionBreakdown
        : currentBreakdown,
    breakdownBaseline: baselineBreakdown,
  };

  const isPositiveChange = headlineChange > 0;
  const changeColor = isPositiveChange ? "text-green" : "text-red-400";
  const TrendIcon = isPositiveChange ? TrendingUp : TrendingDown;
  const showTrendPill = scenario === "intervention" || scenario === "comparison";

  const summaryHasBreakdown =
    !!baselineBreakdown && Object.keys(baselineBreakdown).length > 0;

  return (
    <div
      className="insight-sidebar absolute top-16 left-4 z-30 flex max-h-[calc(100vh-4.5rem)] min-h-[min(520px,calc(100vh-4.5rem))] flex-col overflow-hidden bg-[linear-gradient(165deg,rgba(22,18,48,0.94)_0%,rgba(12,10,32,0.98)_100%)] rounded-2xl shadow-[0_10px_40px_rgba(10,10,45,0.35)] text-white border border-white/35 leading-intel tracking-intel intel-ui"
      style={{ width: panelWidth }}
    >
      <PanelResizeHandle side="left" onResizeStart={startResize} isResizing={isResizing} />
      <div className="absolute top-3 right-3 z-[2] flex items-center gap-1">
        <button
          type="button"
          onClick={() =>
            setPreset(insightPanelWide ? 340 : Math.min(480, panelMaxWidth))
          }
          className="p-1.5 rounded-lg transition-colors hover:bg-white/10"
          style={{ color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.06)" }}
          title={insightPanelWide ? "Narrow panel" : "Widen panel"}
          aria-label={insightPanelWide ? "Narrow panel" : "Widen panel"}
        >
          {insightPanelWide ? (
            <ChevronLeft className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(120%_60%_at_15%_0%,rgba(255,255,255,0.32)_0%,rgba(255,255,255,0.08)_45%,rgba(255,255,255,0)_80%)]" />
      <div className="pointer-events-none absolute inset-[1px] rounded-2xl border border-white/20" />
      {stakeholderSummary && (
        <StakeholderSummaryDialog
          open={summaryOpen}
          onOpenChange={setSummaryOpen}
          summary={stakeholderSummary}
          city={selectedCity}
          kpiRef={kpiDef.ref}
          kpiDisplayName={kpiFramework?.displayName || kpiDef.shortName}
          scenario={scenario}
          unit={displayUnit}
          baselineMainValue={baselineMainValue}
          interventionMainValue={interventionMainValue}
          headlineChange={headlineChange}
          isPositiveChange={isPositiveChange}
          baselineKvSlice={baselineKvSlice}
          interventionKvSlice={interventionKvSlice}
          selectedKpi={selectedKpi}
          selectedCity={selectedCity}
          summaryHasBreakdown={summaryHasBreakdown}
          chartSelectionKeys={chartExplorerKeys}
          onChartDrill={handleExplorerChartDrill}
          reportHref={reportHref}
          onPrint={printInsightSummary}
        />
      )}

      <div className="insight-sidebar-scroll relative z-[1] min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-2xl">
        {/* KPI header — reference layout */}
        <div className="bg-gradient-to-br from-violet/90 to-violet/70 px-5 pt-5 pb-4 rounded-t-2xl">
          <div className="flex items-center gap-2 mb-3">
            <Select value={selectedCity} onValueChange={onCityChange}>
              <SelectTrigger className="w-fit h-auto p-0 border-0 bg-transparent text-lg font-bold text-primary-foreground hover:text-blue-light transition-colors">
                <span>{selectedCity}</span>
              </SelectTrigger>
              <SelectContent className="bg-card/95 backdrop-blur-xl border-border-color/50 z-50 shadow-2xl">
                {CITY_DATA.map((city) => (
                  <SelectItem key={city.city} value={city.city} className="text-sm py-2.5 hover:bg-violet/10 focus:bg-violet/10">
                    {city.city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedPilotId || pilotsForCity[0]?.id} onValueChange={(value) => onPilotChange?.(value)}>
              <SelectTrigger className="h-8 px-2.5 border border-primary-foreground/40 bg-primary-foreground/10 rounded-lg text-sm font-semibold text-primary-foreground">
                <span>{selectedPilotName || pilotsForCity[0]?.name || "Pilot 1"}</span>
              </SelectTrigger>
              <SelectContent className="bg-card/95 backdrop-blur-xl border-border-color/50 z-50 shadow-2xl">
                {pilotsForCity.map((pilot) => (
                  <SelectItem key={pilot.id} value={pilot.id} className="text-sm py-2.5 hover:bg-violet/10 focus:bg-violet/10">
                    {pilot.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Select value={selectedKpi} onValueChange={onKpiChange}>
            <SelectTrigger className="w-full h-auto px-3 py-2.5 border border-primary-foreground/35 bg-primary-foreground/15 rounded-full text-intel-label font-bold text-primary-foreground hover:bg-primary-foreground/25 intel-transition">
              <span>
                {kpiDef.ref} - {(kpiFramework?.displayName || kpiDef.shortName).toUpperCase()}
              </span>
            </SelectTrigger>
            <SelectContent className="bg-card/95 backdrop-blur-xl border-border-color/50 z-50 shadow-2xl">
              {availableKpis.map((kpi) => (
                <SelectItem key={kpi.id} value={kpi.id} className="text-sm py-2.5 hover:bg-violet/10 focus:bg-violet/10">
                  {kpi.ref} - {getKpiFrameworkConfig(kpi.id)?.displayName || kpi.shortName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="mt-3 rounded-xl border border-primary-foreground/30 bg-primary-foreground/12 px-3 py-3 space-y-2">
            <p className="text-intel-label font-bold text-primary-foreground">
              {`${kpiDef.ref} — ${kpiFramework?.displayName || kpiDef.shortName}`}
            </p>
            <p className="text-intel-body text-primary-foreground/95 leading-relaxed">
              {kpiDefinition?.interpretation || kpiFramework?.summary || kpiDef.question}
            </p>
            {selectedPilotProfile?.interventionSummary && (
              <p className="text-[11px] text-primary-foreground/88 leading-relaxed">
                {selectedPilotProfile.interventionSummary}
              </p>
            )}
            {selectedPilotProfile?.expectedImpacts?.length ? (
              <div className="rounded-lg border border-white/20 bg-white/8 px-2.5 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-primary-foreground/75 mb-1.5">
                  Expected impact
                </p>
                <ul className="list-disc pl-3.5 space-y-1 text-[11px] text-primary-foreground/90 leading-snug">
                  {selectedPilotProfile.expectedImpacts.map((impact) => (
                    <li key={impact}>{impact}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          {stakeholderSummary && (
            <button
              type="button"
              onClick={() => setSummaryOpen(true)}
              className="insight-view-summary-btn mt-3 flex h-10 w-full items-center justify-center rounded-xl bg-white text-sm font-bold shadow-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
            >
              View summary
            </button>
          )}
        </div>

        {/* Scenario + headline metrics */}
        <div className="px-5 py-4 border-b border-white/10 bg-[rgba(14,12,32,0.6)]">
          <ToggleGroup
            type="single"
            value={scenario}
            onValueChange={(value) => {
              if (value === "baseline" || value === "intervention" || value === "comparison") {
                onScenarioChange(value);
              }
            }}
            className="w-full"
          >
            <ToggleGroupItem
              value="baseline"
              aria-label="Baseline"
              className="flex-1 text-intel-meta font-semibold data-[state=on]:bg-violet/30 data-[state=on]:text-violet data-[state=on]:border-violet border border-white/20 text-white/88"
            >
              Baseline
            </ToggleGroupItem>
            <ToggleGroupItem
              value="intervention"
              aria-label="Intervention"
              className="flex-1 text-intel-meta font-semibold data-[state=on]:bg-violet/30 data-[state=on]:text-violet data-[state=on]:border-violet border border-white/20 text-white/88"
            >
              Intervention
            </ToggleGroupItem>
            <ToggleGroupItem
              value="comparison"
              aria-label="Comparison"
              className="flex-1 text-intel-meta font-semibold data-[state=on]:bg-violet/30 data-[state=on]:text-violet data-[state=on]:border-violet border border-white/20 text-white/88 shrink-0 whitespace-nowrap px-1"
            >
              Comparison
            </ToggleGroupItem>
          </ToggleGroup>

          {scenario === "comparison" ? (
            <div className="mt-4 space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-intel-meta text-white/80 w-14 shrink-0">Before</span>
                <span className="text-3xl font-bold text-white tabular-nums">{formatKpiFigure(baselineMainValue)}</span>
                <span className="text-intel-kpi-label font-semibold text-cyan-200">{displayUnit}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-intel-meta text-white/80 w-14 shrink-0">After</span>
                <span className="text-3xl font-bold text-white tabular-nums">{formatKpiFigure(interventionMainValue)}</span>
                <span className="text-intel-kpi-label font-semibold text-cyan-200">{displayUnit}</span>
                {showTrendPill && (
                  <div
                    className={`ml-auto flex items-center gap-1 px-2 py-1 rounded-lg ${isPositiveChange ? "bg-green/20" : "bg-red-500/20"} ${changeColor}`}
                  >
                    <TrendIcon className="h-3 w-3" />
                    <span className="text-intel-meta font-bold tabular-nums">
                      {isPositiveChange ? "+" : ""}
                      {formatKpiFigure(headlineChange)}
                      {kpiDef.unit === "%" ? "pp" : ""}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-4 flex items-baseline gap-2 flex-wrap">
              <span className="text-4xl font-bold text-white tabular-nums tracking-tight">
                {formatKpiFigure(currentMainValue)}
              </span>
              {displayUnit && (
                <span className="text-2xl font-bold text-cyan-200 leading-none">{displayUnit}</span>
              )}
              {isModeShare && (
                <span className="w-full text-intel-meta text-white/75 -mt-1">Share of sustainable modes</span>
              )}
              {showTrendPill && (
                <div
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg ${isPositiveChange ? "bg-green/20" : "bg-red-500/20"} ${changeColor}`}
                >
                  <TrendIcon className="h-3.5 w-3.5" />
                  <span className="text-intel-meta font-bold tabular-nums">
                    {isPositiveChange ? "+" : ""}
                    {formatKpiFigure(headlineChange)}
                    {kpiDef.unit === "%" ? "pp" : ""}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <DataProvenanceBadge
              type={
                provenance.headlineSource === "observed"
                  ? "observed"
                  : provenance.headlineSource === "modelled"
                    ? "modelled"
                    : provenance.headlineSource === "derived"
                      ? "derived"
                      : "mock"
              }
            />
            <span className="text-intel-meta font-semibold text-white/88">{confidenceLine}</span>
          </div>
          {provenance.degradedBanner && (
            <div className="mt-2 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-[10px] text-amber-100/90 leading-relaxed">
              {provenance.degradedBanner}
            </div>
          )}
          {milanJunctionIllustrativeNote && (
            <div className="mt-2 rounded-lg border border-violet-400/30 bg-violet-500/10 px-3 py-2 text-[10px] text-violet-100/90 leading-relaxed">
              {milanJunctionIllustrativeNote}
            </div>
          )}
          {milanSatisfactionNote && (
            <div className="mt-2 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-[10px] text-amber-100/90 leading-relaxed">
              {milanSatisfactionNote}
            </div>
          )}
          {provenance.panelMapSplit && (
            <div className="mt-2 rounded-lg border border-sky-400/25 bg-sky-500/10 px-3 py-2 text-[10px] text-sky-100/90 leading-relaxed">
              Panel figures and map evidence may diverge for this selection.{" "}
              <Link to="/wp7-compliance" className="underline text-sky-200 hover:text-white">
                WP7 Compliance
              </Link>
            </div>
          )}
        </div>

        {/* Plot — intervention-wide KPI chart (corridor detail is in the observatory) */}
        <div className="mx-4 mt-3 mb-2 insight-chart-panel rounded-xl p-3 min-h-[200px] backdrop-blur-md">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-intel-label font-bold text-primary-foreground">
              Intervention overview
            </span>
            {showObservatory && (
              <button
                type="button"
                onClick={onOpenObservatory}
                className="text-intel-meta font-bold text-cyan-200 hover:underline shrink-0 text-right"
              >
                {observatoryCtaLabel}
                {primaryJunction ? (
                  <span className="block text-[10px] font-medium text-white/70">
                    {primaryJunction.shortName} ›
                  </span>
                ) : null}
              </button>
            )}
          </div>
          <KPIChart
            kpiId={selectedKpi}
            data={currentKpiValue}
            cityName={selectedCity}
            chartSelectionKeys={chartExplorerKeys}
            onChartDrill={handleExplorerChartDrill}
          />
        </div>

        {missingDataNotice && (
          <p className="mx-4 mb-3 rounded-lg border border-amber-400/30 bg-amber-500/12 px-3 py-2 text-intel-meta font-medium text-amber-100/95 leading-snug">
            {missingDataNotice}
          </p>
        )}

        <Accordion type="multiple" defaultValue={[]} className="px-4 pb-3">
          <AccordionItem value="trust-filters" className="border-white/15 border-t">
            <AccordionTrigger className="text-intel-label font-bold text-white/92 py-3 hover:no-underline">
              Data trust / provenance
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pb-4">
              {selectedPilot && selectedKpi !== "kpi1.2" && (
                <PilotDataSummary
                  pilot={selectedPilot}
                  city={selectedCity}
                  selectedKpi={selectedKpi}
                  kpiRef={kpiDef.ref}
                  kpiDisplayName={kpiFramework?.displayName || kpiDef.shortName}
                  dataQualitySummary={dataQualitySummary}
                />
              )}
        <div className="rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2">
          <p className="text-intel-meta font-bold text-white/85 mb-1.5">Data availability</p>
          <p className="text-[10px] text-white/80 leading-snug">
            Ready: {cityReadinessSummary.ready} · Partial: {cityReadinessSummary.partial} · Missing: {cityReadinessSummary.missing}
          </p>
          {selectedKpi === "kpi1.2" && selectedPilotProfile?.dataAvailability && (
            <p className="text-[10px] text-white/68 mt-1 leading-snug">
              {selectedPilotProfile.dataAvailability}
            </p>
          )}
        </div>
        {dataQualitySummary && (
          <div className="rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2">
              <p className="text-intel-meta font-bold text-white/85 mb-1.5">Data trust</p>
              <LayerTrustStrip summary={dataQualitySummary} compact />
          </div>
        )}
        {issyFlowsQueryEnabled && onIssyFlowDayCategoryChange && (
          <div className="rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2">
            <p className="text-intel-meta font-bold text-white/85 mb-2">Zone-to-zone flow (observed OD CSV)</p>
            <ToggleGroup
              type="single"
              value={issyFlowDayCategory}
              onValueChange={(v) => {
                if (v === "all" || v === "weekday" || v === "weekend") onIssyFlowDayCategoryChange(v);
              }}
              className="w-full"
            >
              <ToggleGroupItem
                value="all"
                className="flex-1 text-[10px] font-semibold data-[state=on]:bg-violet/25 data-[state=on]:text-violet data-[state=on]:border-violet border border-white/20 text-white/80"
              >
                All days
              </ToggleGroupItem>
              <ToggleGroupItem
                value="weekday"
                className="flex-1 text-[10px] font-semibold data-[state=on]:bg-violet/25 data-[state=on]:text-violet data-[state=on]:border-violet border border-white/20 text-white/80"
              >
                Weekday
              </ToggleGroupItem>
              <ToggleGroupItem
                value="weekend"
                className="flex-1 text-[10px] font-semibold data-[state=on]:bg-violet/25 data-[state=on]:text-violet data-[state=on]:border-violet border border-white/20 text-white/80"
              >
                Weekend
              </ToggleGroupItem>
            </ToggleGroup>
            <p className="text-intel-meta font-medium text-white/75 mt-1.5 leading-snug">
              Observed OD flow data (zone_in / zone_out). Map arcs show zone-to-zone movement — not measured
              values on individual street segments.
            </p>
          </div>
        )}
        {selectedPilot?.id === "issy-p1" && selectedKpi === "kpi1.2" && issyWinticsBaseline && (
          <div className="rounded-lg border border-cyan-400/25 bg-cyan-500/10 px-3 py-2">
            <p className="text-intel-meta font-bold text-white/85 mb-1.5">
              Wintics site camera (baseline · {issyWinticsBaseline.period})
            </p>
            <p className="text-[10px] text-white/88 leading-snug">
              {formatWinticsModalShareLine(issyWinticsBaseline)} · sustainable modes{" "}
              {winticsSustainableSharePct(issyWinticsBaseline)}%
            </p>
            <p className="text-[10px] text-white/70 mt-1.5 leading-snug">
              Mean speed {issyWinticsBaseline.overall.meanSpeedKmh?.toFixed(1) ?? "n/a"} km/h · 85th %ile{" "}
              {issyWinticsBaseline.overall.p85SpeedKmh?.toFixed(1) ?? "n/a"} km/h
            </p>
            <p className="text-intel-meta font-medium text-white/68 mt-1.5 leading-snug">
              {ISSY_WINTICS_SITE_DISCLAIMER}
            </p>
          </div>
        )}
        {isCopenhagenCity && selectedKpi === "kpi2.1" && cphEncounterSummary?.length ? (
          <div className="rounded-lg border border-rose-400/25 bg-rose-500/10 px-3 py-2">
            <p className="text-intel-meta font-bold text-white/85 mb-1.5">
              Near encounters (partner)
            </p>
            <p className="text-[10px] text-white/88 leading-snug">
              {cphEncounterSummary.length} site(s) · partner-observed conflict / near-miss counts
            </p>
          </div>
        ) : null}
        {isCopenhagenCity && selectedKpi === "kpi3.2" && cphEmissionsModel && (
          <div className="rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-3 py-2">
            <p className="text-intel-meta font-bold text-white/85 mb-1.5">
              Modelled corridor CO₂ ({cphEmissionsModel.modelLabel})
            </p>
            <p className="text-[10px] text-white/88 leading-snug">
              {cphEmissionsModel.flows.length} directional flow(s) · COPERT-lite urban fleet factors
            </p>
            <p className="text-intel-meta font-medium text-white/68 mt-1.5 leading-snug">
              Modelled from normalised OTC mode counts — not measured ambient CO₂.
            </p>
          </div>
        )}
        {isIssyCity && selectedKpi === "kpi3.2" && issyClasseurEmissions && (
          <div className="rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-3 py-2">
            <p className="text-intel-meta font-bold text-white/85 mb-1.5">
              ASIF emissions model (Classeur.xlsx)
            </p>
            <p className="text-[10px] text-white/88 leading-snug">
              {issyClasseurEmissions.corridorLengthM} m corridor · baseline{" "}
              {Math.round(issyClasseurEmissions.totalBaselineCo2G)} g CO₂/h
            </p>
            <p className="text-intel-meta font-medium text-white/68 mt-1.5 leading-snug">
              Modelled from Nov 2024 traffic flows and Île-de-France fleet factors — hex map uses
              distance-weighted allocation; not measured air quality.
            </p>
          </div>
        )}
        {selectedCity === "Milan" && selectedKpi === "kpi3.2" && onMilanEnvironmentWindowChange && (
          <div className="rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2">
            <p className="text-intel-meta font-bold text-white/85 mb-2">Time of day (Milan roads)</p>
            <ToggleGroup
              type="single"
              value={milanEnvironmentWindow}
              onValueChange={(v) => {
                if (v === "08-09" || v === "18-19") onMilanEnvironmentWindowChange(v);
              }}
              className="w-full"
            >
              <ToggleGroupItem
                value="08-09"
                className="flex-1 text-[10px] font-semibold data-[state=on]:bg-violet/25 data-[state=on]:text-violet border border-white/20 text-white/80"
              >
                08–09
              </ToggleGroupItem>
              <ToggleGroupItem
                value="18-19"
                className="flex-1 text-[10px] font-semibold data-[state=on]:bg-violet/25 data-[state=on]:text-violet border border-white/20 text-white/80"
              >
                18–19
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        )}
        {usingTrikalaIllustrativeModeShare && (
          <div
            className="rounded-lg border px-3 py-2 text-[10px] text-amber-100/90 leading-relaxed"
            style={{ borderColor: "rgba(245,158,11,0.35)", background: "rgba(245,158,11,0.08)" }}
          >
            Illustrative intermodal proxy per P+R hub — partner occupancy survey pending (June 2026
            drop).
          </div>
        )}
        {usingTrikalaBikeLaneSafety && (
          <div
            className="rounded-lg border px-3 py-2 text-[10px] text-amber-100/90 leading-relaxed"
            style={{ borderColor: "rgba(245,158,11,0.35)", background: "rgba(245,158,11,0.08)" }}
          >
            {trikalaBikeLaneSafetyKpi?.note ??
              "Mock speed from bike-lane LoRa occupancy — no radar speed feed. Baseline uses a constructed pre-redesign offset so before/after differ."}
          </div>
        )}
        {usingTrikalaBikeLaneSurvey && (
          <div
            className="rounded-lg border px-3 py-2 text-[10px] text-emerald-100/90 leading-relaxed"
            style={{ borderColor: "rgba(34,197,94,0.35)", background: "rgba(34,197,94,0.08)" }}
          >
            {trikalaBikeLaneSurveyKpi?.note ??
              "Online bike-safety survey (SharePoint) — map pins are bike-lane sensors; scores are survey Likert."}
          </div>
        )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="px-4 py-3 bg-violet/20 border-t border-white/15">
          <p className="text-intel-meta font-semibold text-white/90">
            <span className="font-bold text-white">{kpiDef.ref}</span> · {kpiFramework?.displayName || kpiDef.name}
          </p>
        </div>
      </div>
    </div>
  );
};

export default InsightPanel;
