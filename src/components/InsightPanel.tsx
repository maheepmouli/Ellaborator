import { useCallback, useEffect, useMemo, useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
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
  baselineKpiSlice,
  interventionKpiSlice,
  computeBaselineMainValue,
} from "@/lib/kpiBaselineVersusIntervention";
import { formatKpiFigure } from "@/lib/formatKpiFigure";
import { useIssyFlowData } from "@/hooks/use-issy-flow-data";
import { buildIssyModeShareKpiSlices } from "@/lib/issyFlowAggregates";
import type { ChartDrillPayload } from "@/types/chartMapInteraction";
import { getKpi32TimeSeriesIntensity } from "@/lib/kpi32YearIntensity";
import { LayerTrustStrip, type LayerTrustSummary } from "@/components/LayerTrustStrip";
import { DataProvenanceBadge } from "@/components/DataProvenanceBadge";
import { PilotDataSummary } from "@/components/PilotDataSummary";
import {
  formatConfidenceLine,
  getKpiMissingDataNotice,
} from "@/lib/kpiMissingDataMessage";
import { dataSourceTrustLabel, kpiPrimaryIssySource } from "@/lib/issyDataTransparency";
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
  mapSelection?: MapSelectionState;
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
  mapSelection,
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
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [chartRadarFocus, setChartRadarFocus] = useState<string | null>(null);
  const [chartA11yFocus, setChartA11yFocus] = useState<string | null>(null);

  useEffect(() => {
    setChartRadarFocus(null);
    setChartA11yFocus(null);
  }, [selectedKpi]);

  const isIssyCity = selectedCity.toLowerCase().includes("issy");
  const issyFlowsQueryEnabled = isIssyCity && selectedKpi === "kpi1.2";
  const { data: issyFlowFeatures } = useIssyFlowData(issyFlowDayCategory, issyFlowsQueryEnabled);
  const issyModeShareFromCsv = useMemo(
    () =>
      issyFlowsQueryEnabled && issyFlowFeatures?.length
        ? buildIssyModeShareKpiSlices(issyFlowFeatures)
        : null,
    [issyFlowsQueryEnabled, issyFlowFeatures]
  );
  const usingIssyObservedModeShare = !!issyModeShareFromCsv;

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

  const segmentFocusId = mapSelection?.segmentId ?? null;

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

  if (!kpiDef || !kpiValue) return null;

  const baselineKvSlice = issyModeShareFromCsv?.baseline ?? baselineKpiSlice(kpiValue);
  const interventionKvSlice = issyModeShareFromCsv?.intervention ?? interventionKpiSlice(kpiValue);
  const baselineMainValue = issyModeShareFromCsv
    ? issyModeShareFromCsv.baseline.mainValue
    : computeBaselineMainValue(kpiValue);
  const interventionMainValue = issyModeShareFromCsv
    ? issyModeShareFromCsv.intervention.mainValue
    : Number(kpiValue.mainValue);
  const headlineChange = issyModeShareFromCsv?.intervention.change ?? kpiValue.change;
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

  const stakeholderSummary = useMemo(() => {
    const fwEarly = getKpiFrameworkConfig(selectedKpi);
    if (!selectedPilot) return null;
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
      unit: kpiValue.unit,
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
    kpiValue.unit,
    baselineMainValue,
    interventionMainValue,
    headlineChange,
  ]);

  const summaryHasBreakdown =
    !!baselineKvSlice.breakdown && Object.keys(baselineKvSlice.breakdown).length > 0;

  const missingDataNotice = useMemo(
    () => getKpiMissingDataNotice(selectedCity, selectedKpi, selectedPilot),
    [selectedCity, selectedKpi, selectedPilot]
  );

  const confidenceLine = useMemo(() => {
    const sourceHint = isIssyCity
      ? dataSourceTrustLabel(kpiPrimaryIssySource(selectedKpi))
      : dataQualitySummary?.dataType;
    return formatConfidenceLine(
      kpiDefinition?.dataLabel ?? dataQualitySummary?.provenanceType ?? "Derived",
      dataQualitySummary?.confidence,
      sourceHint
    );
  }, [isIssyCity, selectedKpi, kpiDefinition, dataQualitySummary]);

  return (
    <div className="insight-sidebar absolute top-20 left-4 z-30 flex w-[320px] max-h-[calc(100vh-6.5rem)] flex-col overflow-hidden bg-[linear-gradient(165deg,rgba(22,18,48,0.94)_0%,rgba(12,10,32,0.98)_100%)] rounded-2xl shadow-[0_10px_40px_rgba(10,10,45,0.35)] text-white border border-white/35 leading-intel tracking-intel intel-ui">
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
          unit={kpiValue.unit}
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
              {kpiDef.ref} — {kpiFramework?.displayName || kpiDef.shortName}
            </p>
            <p className="text-intel-body text-primary-foreground/95 leading-relaxed">
              {kpiDefinition?.interpretation || kpiFramework?.summary || kpiDef.question}
            </p>
            {selectedPilot && (
              <p className="text-intel-body font-semibold text-primary-foreground/95 leading-snug">
                {selectedPilot.name}: {selectedPilot.title}
              </p>
            )}
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
                <span className="text-intel-kpi-label font-semibold text-violet">{kpiValue.unit}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-intel-meta text-white/80 w-14 shrink-0">After</span>
                <span className="text-3xl font-bold text-violet tabular-nums">{formatKpiFigure(interventionMainValue)}</span>
                <span className="text-intel-kpi-label font-semibold text-violet">{kpiValue.unit}</span>
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
              <span className="text-4xl font-bold text-violet tabular-nums tracking-tight">
                {formatKpiFigure(currentMainValue)}
              </span>
              {kpiValue.unit && (
                <span className="text-2xl font-bold text-violet leading-none">{kpiValue.unit}</span>
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
            <span className="text-intel-meta font-semibold text-white/88">{confidenceLine}</span>
          </div>
        </div>

        {/* Plot — always visible, directly under metrics (reference layout) */}
        <div className="mx-4 mt-3 mb-2 insight-chart-panel rounded-xl p-3 min-h-[200px] backdrop-blur-md">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-intel-label font-bold text-violet">Segment focus</span>
            {onOpenObservatory && (
              <button
                type="button"
                onClick={onOpenObservatory}
                className="text-intel-meta font-bold text-violet hover:underline shrink-0"
              >
                Open observatory
              </button>
            )}
          </div>
          {segmentFocusId && (
            <p className="text-[10px] font-medium text-white/70 mb-1 truncate">
              {mapSelection?.segmentId ?? segmentFocusId}
            </p>
          )}
          <p className="text-intel-meta font-medium text-white/82 mb-3 leading-snug">
            {isIssyCity && isModeShare
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
            <p className="font-semibold text-violet mb-1">Map focus</p>
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
              Data trust & filters
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
        {isModeShare && (
          <div className="rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2">
            <p className="text-intel-meta font-bold text-white/85 mb-2">Travel modes (map filter)</p>
            <div className="space-y-1.5">
              {["Pedestrian", "Cycle", "Public Transport", "Private Car", "PTW"].map((modeType) => {
                const isSelected = selectedModeTypes.includes(modeType);
                const value = currentBreakdown?.[modeType] || 0;
                const displayValue = usingIssyObservedModeShare
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
                      <span className="text-xs font-bold text-violet tabular-nums">{displayValue}</span>
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
              className="text-intel-meta font-bold text-violet hover:underline"
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
