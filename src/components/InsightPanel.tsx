import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, TrendingDown, TrendingUp } from "lucide-react";
import { PanelResizeHandle } from "@/components/PanelResizeHandle";
import { useResizablePanelWidth } from "@/hooks/use-resizable-panel-width";
import { Checkbox } from "@/components/ui/checkbox";
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
import { loadTrikalaLocationsBundle } from "@/data/trikalaLocationRegistry";
import {
  getTrikalaSegmentInsights,
  getTrikalaWomenMobilityModeShareRows,
} from "@/services/trikalaSurveyParser";
import { useQuery } from "@tanstack/react-query";
import { isCopenhagenCameraKpi } from "@/data/copenhagenCameraSites";
import { filterCopenhagenObservatoryPoints } from "@/lib/copenhagenObservatoryView";
import {
  aggregateCopenhagenObservedKpi,
  resolveCopenhagenKpiDisplayUnit,
} from "@/lib/copenhagenKpiDisplay";
import type { ChartDrillPayload } from "@/types/chartMapInteraction";
import { getKpi32TimeSeriesIntensity } from "@/lib/kpi32YearIntensity";
import { LayerTrustStrip, type LayerTrustSummary } from "@/components/LayerTrustStrip";
import { DataProvenanceBadge } from "@/components/DataProvenanceBadge";
import { PilotDataSummary } from "@/components/PilotDataSummary";
import {
  formatConfidenceLine,
} from "@/lib/kpiMissingDataMessage";
import { resolveKpiProvenance, provenanceConfidenceLine } from "@/lib/kpiProvenance";
import { getLocalCityDiagnostics } from "@/services/localCityData";
import { useMilanEnvironmentSegments, useMilanSpeedSegments } from "@/hooks/use-milan-segment-data";
import {
  aggregateMilanObservedKpi,
  filterMilanObservatoryPoints,
} from "@/lib/milanObservatoryView";
import {
  aggregateMilanJunctionMockKpi,
  buildMilanJunctionAccessibilityMockPoints,
  buildMilanJunctionClimateMockPoints,
  buildMilanJunctionModeShareMockPoints,
  milanHasObservedAccessibilityData,
  milanHasObservedClimateData,
  milanJunctionAnchorsForPilot,
  pickJunctionsForModeSharePresentation,
} from "@/lib/milanMapLayers";
import { getIssySentimentMock, issySentimentKpiHeadline } from "@/data/issySentimentMock";
import { getIssyAccessibilityMock, issyAccessibilityKpiHeadline } from "@/data/issyAccessibilityMock";
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
  const segmentFocusId = hoveredSegmentId ?? mapSelection?.segmentId ?? null;
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
    queryKey: ["trikala-women-mobility-mode-share", segmentFocusId],
    queryFn: () => getTrikalaWomenMobilityModeShareRows(segmentFocusId),
    enabled:
      isTrikalaCity && selectedKpi === "kpi1.2" && selectedPilotId !== "tri-p2",
    staleTime: 120_000,
  });
  const trikalaObservedModeShare = useMemo(() => {
    if (!isTrikalaCity || selectedKpi !== "kpi1.2") return null;
    if (selectedPilotId === "tri-p2") {
      return buildTrikalaModeShareSliceForSelection({
        pilotId: selectedPilotId,
        segmentId: segmentFocusId,
        insights: trikalaSegmentInsights,
        locations: trikalaLocationsBundle?.locations,
      });
    }
    if (!trikalaSegmentInsights.length && !trikalaWomenMobilityModeShare.length) return null;
    return buildTrikalaModeShareSliceForSelection({
      pilotId: selectedPilotId,
      segmentId: segmentFocusId,
      insights: trikalaSegmentInsights,
      womenMobilityModeShare: trikalaWomenMobilityModeShare,
    });
  }, [
    isTrikalaCity,
    selectedKpi,
    selectedPilotId,
    trikalaSegmentInsights,
    segmentFocusId,
    trikalaLocationsBundle?.locations,
    trikalaWomenMobilityModeShare,
  ]);
  const usingTrikalaObservedModeShare = !!trikalaObservedModeShare;
  const usingTrikalaIllustrativeModeShare =
    isTrikalaCity && selectedPilotId === "tri-p2" && selectedKpi === "kpi1.2" && !!trikalaObservedModeShare;
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
      ? cphEncounters?.records
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
  const issyAccessibilityMock = useMemo(() => {
    if (!isIssyCity || selectedKpi !== "kpi4.2" || !selectedPilotId) return null;
    return getIssyAccessibilityMock(selectedPilotId);
  }, [isIssyCity, selectedKpi, selectedPilotId]);
  const issyAccessibilityFromMock = useMemo(() => {
    if (!issyAccessibilityMock) return null;
    const headline = issyAccessibilityKpiHeadline(issyAccessibilityMock);
    return {
      baseline: {
        mainValue: Math.max(1, headline.mainValue - headline.change),
        breakdown: headline.breakdown,
        change: 0,
      },
      intervention: {
        mainValue: headline.mainValue,
        breakdown: headline.breakdown,
        change: headline.change,
      },
      unit: headline.unit,
    };
  }, [issyAccessibilityMock]);
  const isMilanCity = selectedCity === "Milan";
  const milanPilotId =
    selectedPilotId === "mil-p1" || selectedPilotId === "mil-p2" || selectedPilotId === "mil-p3"
      ? selectedPilotId
      : "mil-p2";
  const milanCenter = cityData ? { lat: cityData.lat, lon: cityData.lon } : null;
  const shouldUseMilanLocalPoints =
    isMilanCity && (selectedKpi === "kpi1.2" || selectedKpi === "kpi4.2");
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
      return buildMilanJunctionModeShareMockPoints(junctions, milanPilotId);
    }
    if (selectedKpi === "kpi3.2" && !milanHasObservedClimateData(milanEnvDataset)) {
      return buildMilanJunctionClimateMockPoints(junctions, milanPilotId);
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
    const scoped = segmentFocusId
      ? filterMilanObservatoryPoints(milanJunctionMockPoints, segmentFocusId)
      : milanJunctionMockPoints;
    const pointsForAgg = scoped.length ? scoped : milanJunctionMockPoints;
    return aggregateMilanObservedKpi(pointsForAgg, "kpi1.2", selectedModeTypes);
  }, [milanJunctionMockPoints, segmentFocusId, selectedModeTypes, selectedKpi]);

  const milanIllustrativeClimateKpi = useMemo(() => {
    if (selectedKpi !== "kpi3.2" || !milanJunctionMockPoints?.length) return null;
    const scoped = segmentFocusId
      ? filterMilanObservatoryPoints(milanJunctionMockPoints, segmentFocusId)
      : milanJunctionMockPoints;
    const pointsForAgg = scoped.length ? scoped : milanJunctionMockPoints;
    return aggregateMilanJunctionMockKpi(pointsForAgg, scenario);
  }, [milanJunctionMockPoints, segmentFocusId, selectedKpi, scenario]);

  const milanIllustrativeAccessibilityKpi = useMemo(() => {
    if (selectedKpi !== "kpi4.2" || !milanJunctionMockPoints?.length) return null;
    const scoped = segmentFocusId
      ? filterMilanObservatoryPoints(milanJunctionMockPoints, segmentFocusId)
      : milanJunctionMockPoints;
    const pointsForAgg = scoped.length ? scoped : milanJunctionMockPoints;
    return aggregateMilanJunctionMockKpi(pointsForAgg, scenario);
  }, [milanJunctionMockPoints, segmentFocusId, selectedKpi, scenario]);

  const milanObservedPointKpi = useMemo(() => {
    if (!shouldUseMilanLocalPoints || !milanLocalPoints?.length) return null;
    const observed = milanLocalPoints.filter(
      (p) => p.properties?.dataOrigin === "local-city-dataset"
    );
    if (!observed.length) return null;
    const scoped = segmentFocusId
      ? filterMilanObservatoryPoints(observed, segmentFocusId)
      : observed;
    const pointsForAgg = scoped.length ? scoped : observed;
    return aggregateMilanObservedKpi(pointsForAgg, selectedKpi, selectedModeTypes);
  }, [
    shouldUseMilanLocalPoints,
    milanLocalPoints,
    selectedKpi,
    segmentFocusId,
    selectedModeTypes,
  ]);
  const milanModeShareKpi = milanIllustrativeModeShareKpi ?? milanObservedPointKpi;
  const usingMilanIllustrativeModeShare =
    isMilanCity && selectedKpi === "kpi1.2" && !!milanIllustrativeModeShareKpi;
  const usingMilanIllustrativeClimate =
    isMilanCity && selectedKpi === "kpi3.2" && !!milanIllustrativeClimateKpi;
  const usingMilanIllustrativeAccessibility =
    isMilanCity && selectedKpi === "kpi4.2" && !!milanIllustrativeAccessibilityKpi;
  const usingMilanObservedModeShare =
    isMilanCity && selectedKpi === "kpi1.2" && !!milanObservedPointKpi && !usingMilanIllustrativeModeShare;
  const milanSegmentHeadline = useMemo(() => {
    if (!isMilanCity) return null;
    if (selectedKpi === "kpi2.1" && milanSpeedDataset?.records?.length) {
      const avg =
        milanSpeedDataset.records.reduce(
          (sum, record) => sum + Number(record.properties?.avgSpeed ?? record.value),
          0
        ) / milanSpeedDataset.records.length;
      return {
        baselineMain: avg * 1.08,
        interventionMain: avg,
        change: avg - avg * 1.08,
      };
    }
    if (selectedKpi === "kpi3.2" && milanEnvDataset?.records?.length) {
      const avg = milanEnvDataset.stats.avgMetricValue;
      return {
        baselineMain: avg * 1.17,
        interventionMain: avg,
        change: avg - avg * 1.17,
      };
    }
    if (selectedKpi === "kpi3.2" && milanIllustrativeClimateKpi) {
      return milanIllustrativeClimateKpi;
    }
    if (selectedKpi === "kpi4.2" && milanIllustrativeAccessibilityKpi) {
      return milanIllustrativeAccessibilityKpi;
    }
    return null;
  }, [
    isMilanCity,
    selectedKpi,
    milanSpeedDataset,
    milanEnvDataset,
    milanIllustrativeClimateKpi,
    milanIllustrativeAccessibilityKpi,
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

    const scopedPoints = segmentFocusId
      ? filterCopenhagenObservatoryPoints(observed, segmentFocusId)
      : observed;
    const pointsForAgg = scopedPoints.length ? scopedPoints : observed;

    return aggregateCopenhagenObservedKpi(pointsForAgg, selectedKpi, selectedModeTypes);
  }, [shouldUseCopenhagenObserved, copenhagenLocalPoints, selectedModeTypes, selectedKpi, segmentFocusId]);

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
              : null;
    const diagnostics =
      milanSegmentDiagnostics ?? getLocalCityDiagnostics(selectedCity, selectedKpi, selectedPilotId);
    const mapUsesLocalDataset = Boolean(
      copenhagenLocalPoints?.some((p) => p.properties?.dataOrigin === "local-city-dataset") ||
        milanLocalPoints?.some((p) => p.properties?.dataOrigin === "local-city-dataset") ||
        (milanSpeedDataset?.records?.length ?? 0) > 0 ||
        (milanEnvDataset?.records?.length ?? 0) > 0 ||
        dataQualitySummary?.provenanceType === "observed" ||
        dataQualitySummary?.provenanceType === "mock"
    );
    const panelUsesObservedSlice = Boolean(
      usingIssyObservedModeShare ||
        (usingTrikalaObservedModeShare && !usingTrikalaIllustrativeModeShare) ||
        copenhagenObservedModeShare ||
        (milanModeShareKpi && !usingMilanIllustrativeModeShare) ||
        (milanSegmentHeadline && !usingMilanIllustrativeClimate && !usingMilanIllustrativeAccessibility) ||
        usingMilanIllustrativeClimate ||
        usingMilanIllustrativeAccessibility ||
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
    dataQualitySummary,
    manifestAvailable,
    usingIssyObservedModeShare,
    usingTrikalaObservedModeShare,
    usingTrikalaIllustrativeModeShare,
    copenhagenObservedModeShare,
    milanModeShareKpi,
    milanSegmentHeadline,
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
    if (issyAccessibilityFromMock?.unit) return issyAccessibilityFromMock.unit;
    if (isMilanCity && selectedKpi === "kpi2.1" && milanSegmentHeadline) return "km/h";
    if (isMilanCity && selectedKpi === "kpi3.2" && usingMilanIllustrativeClimate) return " env. idx";
    if (isMilanCity && selectedKpi === "kpi4.2" && usingMilanIllustrativeAccessibility) return "%";
    return isTrikalaCity && trikalaObservedModeShare
      ? "%"
      : isCopenhagenCity && copenhagenObservedModeShare
      ? resolveCopenhagenKpiDisplayUnit(selectedKpi)
      : kpiValue.unit;
  }, [
    isTrikalaCity,
    trikalaObservedModeShare,
    isCopenhagenCity,
    copenhagenObservedModeShare,
    selectedKpi,
    kpiValue,
    issySentimentFromMock,
    issyAccessibilityFromMock,
    isMilanCity,
    milanSegmentHeadline,
    usingMilanIllustrativeClimate,
    usingMilanIllustrativeAccessibility,
    selectedKpi,
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

  const handleModeTypeToggle = (modeType: string) => {
    const newSelected = selectedModeTypes.includes(modeType)
      ? selectedModeTypes.filter((m) => m !== modeType)
      : [...selectedModeTypes, modeType];
    onModeTypesChange?.(newSelected);
  };


  const isModeShare = selectedKpi === "kpi1.2";
  const modeTypes = isModeShare && kpiValue?.breakdown
    ? Object.keys(kpiValue.breakdown)
    : [];


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
    if (!kpiDef || !kpiValue) return;
    if (!supportedKpisForPilot.includes(selectedKpi)) {
      const fallbackKpi = supportedKpisForPilot[0];
      if (fallbackKpi) onKpiChange(fallbackKpi);
    }
  }, [kpiDef, kpiValue, selectedKpi, supportedKpisForPilot, onKpiChange]);

  const missingDataNotice = useMemo(() => provenance.missingNotice, [provenance]);

  const confidenceLine = useMemo(
    () => provenanceConfidenceLine(provenance, formatConfidenceLine),
    [provenance]
  );

  const stakeholderSummary = useMemo(() => {
    if (!kpiDef || !kpiValue || !selectedPilot) return null;
    const fwEarly = getKpiFrameworkConfig(selectedKpi);
    const baselineMainValue = issyModeShareFromCsv
      ? issyModeShareFromCsv.baseline.mainValue
      : issySentimentFromMock
        ? issySentimentFromMock.baseline.mainValue
        : issyAccessibilityFromMock
          ? issyAccessibilityFromMock.baseline.mainValue
          : trikalaObservedModeShare
          ? trikalaObservedModeShare.baselineMain
          : copenhagenObservedModeShare
            ? copenhagenObservedModeShare.baselineMain
            : milanModeShareKpi
              ? milanModeShareKpi.baselineMain
              : milanSegmentHeadline
                ? milanSegmentHeadline.baselineMain
                : computeBaselineMainValue(kpiValue);
    const interventionMainValue = issyModeShareFromCsv
      ? issyModeShareFromCsv.intervention.mainValue
      : issySentimentFromMock
        ? issySentimentFromMock.intervention.mainValue
        : issyAccessibilityFromMock
          ? issyAccessibilityFromMock.intervention.mainValue
          : trikalaObservedModeShare
            ? trikalaObservedModeShare.interventionMain
            : copenhagenObservedModeShare
              ? copenhagenObservedModeShare.interventionMain
              : milanModeShareKpi
                ? milanModeShareKpi.interventionMain
                : milanSegmentHeadline
                  ? milanSegmentHeadline.interventionMain
                  : Number(kpiValue.mainValue);
    const headlineChange =
      issyModeShareFromCsv?.intervention.change ??
      issySentimentFromMock?.intervention.change ??
      issyAccessibilityFromMock?.intervention.change ??
      trikalaObservedModeShare?.change ??
      copenhagenObservedModeShare?.change ??
      milanModeShareKpi?.change ??
      milanSegmentHeadline?.change ??
      kpiValue.change;
    const helsinkiBA =
      selectedCity === "Helsinki" && (selectedKpi === "kpi1.2" || selectedKpi === "kpi2.1");
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
    issyAccessibilityFromMock,
    copenhagenObservedModeShare,
    milanModeShareKpi,
    milanSegmentHeadline,
    trikalaObservedModeShare,
    displayUnit,
  ]);

  if (!kpiDef || !kpiValue) return null;

  const baselineKvSlice = issyModeShareFromCsv
    ? issyModeShareFromCsv.baseline
    : issySentimentFromMock
      ? issySentimentFromMock.baseline
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
      : issyAccessibilityFromMock
        ? issyAccessibilityFromMock.baseline.mainValue
        : trikalaObservedModeShare
          ? trikalaObservedModeShare.baselineMain
          : copenhagenObservedModeShare
          ? copenhagenObservedModeShare.baselineMain
          : milanModeShareKpi
            ? milanModeShareKpi.baselineMain
            : milanSegmentHeadline
              ? milanSegmentHeadline.baselineMain
          : computeBaselineMainValue(kpiValue);
  const interventionMainValue = issyModeShareFromCsv
    ? issyModeShareFromCsv.intervention.mainValue
    : issySentimentFromMock
      ? issySentimentFromMock.intervention.mainValue
      : issyAccessibilityFromMock
        ? issyAccessibilityFromMock.intervention.mainValue
        : trikalaObservedModeShare
          ? trikalaObservedModeShare.interventionMain
          : copenhagenObservedModeShare
          ? copenhagenObservedModeShare.interventionMain
          : milanModeShareKpi
            ? milanModeShareKpi.interventionMain
            : milanSegmentHeadline
              ? milanSegmentHeadline.interventionMain
          : Number(kpiValue.mainValue);
  const headlineChange =
    issyModeShareFromCsv?.intervention.change ??
    issySentimentFromMock?.intervention.change ??
    issyAccessibilityFromMock?.intervention.change ??
    trikalaObservedModeShare?.change ??
    copenhagenObservedModeShare?.change ??
    milanModeShareKpi?.change ??
    milanSegmentHeadline?.change ??
    kpiValue.change;
  const currentMainValue = scenario === "baseline" ? baselineMainValue : interventionMainValue;
  const currentBreakdown =
    scenario === "baseline" ? baselineKvSlice.breakdown : interventionKvSlice.breakdown;

  const currentKpiValue: KPIValue = {
    ...kpiValue,
    mainValue: currentMainValue,
    breakdown: currentBreakdown,
  };

  const isPositiveChange = headlineChange > 0;
  const changeColor = isPositiveChange ? "text-green" : "text-red-400";
  const TrendIcon = isPositiveChange ? TrendingUp : TrendingDown;
  const showTrendPill = scenario === "intervention" || scenario === "comparison";

  const summaryHasBreakdown =
    !!baselineKvSlice.breakdown && Object.keys(baselineKvSlice.breakdown).length > 0;

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
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground/75">
              Section C · KPI explorer
            </p>
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

          <div className="mt-3 rounded-xl border border-primary-foreground/30 bg-primary-foreground/12 px-3 py-3 space-y-3">
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-primary-foreground/70">
                Section A · Intervention Overview
              </p>
              <p className="text-intel-label font-bold text-primary-foreground">
                {`${kpiDef.ref} — ${kpiFramework?.displayName || kpiDef.shortName}`}
              </p>
              <p className="text-intel-body text-primary-foreground/95 leading-relaxed">
                {kpiDefinition?.interpretation || kpiFramework?.summary || kpiDef.question}
              </p>
            </div>
            <div className="space-y-1.5 rounded-lg border border-white/20 bg-white/8 px-2.5 py-2 text-[10px] text-white/90 leading-relaxed">
              <p className="font-semibold text-white">Section B · Intervention context</p>
              <p>
                <span className="font-semibold text-white">Summary:</span>{" "}
                {selectedPilotProfile?.interventionSummary || selectedPilot?.description || "Intervention summary pending."}
              </p>
              <p>
                <span className="font-semibold text-white">Objectives:</span>{" "}
                {selectedPilotProfile?.objectives?.join(" · ") || selectedPilot?.goal || "Objectives pending."}
              </p>
              <p>
                <span className="font-semibold text-white">Expected impacts:</span>{" "}
                {selectedPilotProfile?.expectedImpacts?.join(" · ") || "Impact expectations pending partner validation."}
              </p>
            </div>
            {selectedPilot && (
              <p className="text-intel-body font-semibold text-primary-foreground/95 leading-snug">
                {selectedPilot.name}: {selectedPilot.title}
              </p>
            )}
            <p className="text-[10px] text-primary-foreground/80 leading-snug">
              <span className="font-semibold text-white">Section E · Data availability:</span>{" "}
              {selectedPilotProfile?.dataAvailability || "Pilot data availability follows KPI readiness and trust indicators below."}
            </p>
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
            {dataQualitySummary?.provenanceType && (
              <DataProvenanceBadge type={dataQualitySummary.provenanceType} />
            )}
            {provenance.headlineSource === "mock" && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-100">
                Illustrative
              </span>
            )}
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
          {provenance.panelMapSplit && (
            <div className="mt-2 rounded-lg border border-sky-400/25 bg-sky-500/10 px-3 py-2 text-[10px] text-sky-100/90 leading-relaxed">
              Panel uses illustrative KPI figures · Map shows local observed dataset for this selection.
            </div>
          )}
        </div>

        {/* Plot — always visible, directly under metrics (reference layout) */}
        <div className="mx-4 mt-3 mb-2 insight-chart-panel rounded-xl p-3 min-h-[200px] backdrop-blur-md">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-intel-label font-bold text-primary-foreground">Segment focus</span>
            {showObservatory && (
              <button
                type="button"
                onClick={onOpenObservatory}
                className="text-intel-meta font-bold text-cyan-200 hover:underline shrink-0 text-right"
              >
                Segment Observatory
                {primaryJunction ? (
                  <span className="block text-[10px] font-medium text-white/70">
                    {primaryJunction.shortName} ›
                  </span>
                ) : null}
              </button>
            )}
          </div>
          {segmentFocusId && (
            <p className="text-[10px] font-medium text-white/70 mb-1 truncate">
              {mapSelection?.segmentId ?? segmentFocusId}
            </p>
          )}
          <p className="text-intel-meta font-medium text-white/82 mb-3 leading-snug">
            {showObservatory
              ? "Before/after analytics · sensor schematic · modal shift story"
              : isIssyCity && isModeShare
                ? "Monitored intervention corridor: observed traficissy segment context. Mode share KPI uses OD CSV in city view."
                : "Chart and map stay linked to the selected monitored intervention corridor."}
          </p>
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

        {mapContext && (
          <div className="mx-4 mb-3 rounded-lg border border-violet/45 bg-violet/25 p-3 text-intel-meta">
            <p className="font-semibold text-primary-foreground mb-1">Map focus</p>
            <p className="text-white/90">{mapContext.segmentName}</p>
            <p className="text-white/80">
              Speed: {mapContext.speed !== null ? `${mapContext.speed.toFixed(1)} km/h` : "n/a"} · Congestion:{" "}
              {mapContext.congestion !== null ? mapContext.congestion.toFixed(2) : "n/a"}
            </p>
          </div>
        )}

        <Accordion type="multiple" defaultValue={[]} className="px-4 pb-3">
          <AccordionItem value="trust-filters" className="border-white/15 border-t">
            <AccordionTrigger className="text-intel-label font-bold text-white/92 py-3 hover:no-underline">
              Section D · Data trust / provenance
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pb-4">
              {selectedPilot && (
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
          <p className="text-intel-meta font-bold text-white/85 mb-1.5">Data availability summary</p>
          <p className="text-[10px] text-white/80 leading-snug">
            Ready: {cityReadinessSummary.ready} · Partial: {cityReadinessSummary.partial} · Missing: {cityReadinessSummary.missing}
          </p>
          <p className="text-[10px] text-white/68 mt-1 leading-snug">
            {selectedPilotProfile?.methodologyNotes || "Use intervention geometry first; missing datasets are surfaced explicitly by KPI."}
          </p>
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
          <div className="rounded-lg border border-amber-400/25 bg-amber-500/10 px-3 py-2">
            <p className="text-intel-meta font-bold text-white/85 mb-1.5">
              Near encounters ({cphEncounterSummary[0]?.sourceKind === "partner" ? "partner" : "OTC proxy"})
            </p>
            <p className="text-[10px] text-white/88 leading-snug">
              {cphEncounterSummary.length} site(s) · encounter-pressure index from mixed-mode 15-min bins
            </p>
            <p className="text-intel-meta font-medium text-white/68 mt-1.5 leading-snug">
              Derived proxy until UCPH delivers structured near-encounter export — not observed conflict counts.
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
        {isModeShare && (
          <div className="rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2">
            <p className="text-intel-meta font-bold text-white/85 mb-2">Travel modes (map filter)</p>
            <div className="space-y-1.5">
              {["Pedestrian", "Cycle", "Public Transport", "Private Car", "PTW"].map((modeType) => {
                const isSelected = selectedModeTypes.includes(modeType);
                const value = currentBreakdown?.[modeType] || 0;
                const displayValue =
                  usingIssyObservedModeShare ||
                  usingTrikalaObservedModeShare ||
                  usingMilanObservedModeShare ||
                  usingMilanIllustrativeModeShare
                    ? `${value.toFixed(1)}%`
                    : String(Math.round(value));
                return (
                  <div
                    key={modeType}
                    className="insight-filter-row flex items-center gap-2 p-2 rounded-lg hover:bg-white/[0.08] transition-colors cursor-pointer"
                    onClick={() => handleModeTypeToggle(modeType)}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => handleModeTypeToggle(modeType)}
                      className="data-[state=checked]:bg-violet data-[state=checked]:border-violet"
                    />
                    <div className="flex-1 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold">{modeType}</span>
                      <span className="text-xs font-bold text-cyan-200 tabular-nums">{displayValue}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
            <button
              type="button"
              onClick={onOpenDataSummary}
              className="text-intel-meta font-bold text-cyan-200 hover:underline"
            >
              Open data summary
            </button>
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
