import { useCallback, useEffect, useMemo, useState } from "react";
import { Printer, TrendingUp, TrendingDown } from "lucide-react";
import { Link } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ELABORATOR_KPIS, CITY_DATA, KPIValue } from "@/data/kpiDefinitions";
import { getPilotsByCity, getPilotById } from "@/data/pilotDefinitions";
import KPIChart from "./KPICharts";
import { getKpiFrameworkConfig } from "@/config/kpiFramework";
import { getKpiDefinition } from "@/config/kpiDefinitions";
import {
  buildImpactAtGlance,
  getPlainLanguageSummary,
  resolveImpactDisclaimer,
} from "@/data/narratives";
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

  const impactAtGlance = useMemo(() => {
    const kd = ELABORATOR_KPIS.find((k) => k.id === selectedKpi);
    const cityRow = CITY_DATA.find((c) => c.city === selectedCity);
    const kv = cityRow?.kpiData[selectedKpi];
    const fwEarly = getKpiFrameworkConfig(selectedKpi);
    if (!selectedPilot || !kd || !kv) return null;
    const helsinkiBA = selectedCity === "Helsinki" && (selectedKpi === "kpi1.2" || selectedKpi === "kpi2.1");
    const disc = resolveImpactDisclaimer({
      kpiId: selectedKpi,
      isMockFramework: !!fwEarly?.isMock,
      isHelsinkiObservedBeforeAfter: helsinkiBA,
      hasSegmentContext: !!mapContext,
    });
    const liveContextLine = dataQualitySummary
      ? `Active layer: ${dataQualitySummary.recordsLabel}; ${dataQualitySummary.spatialQuality}; ${dataQualitySummary.temporalCoverage}.`
      : undefined;
    return buildImpactAtGlance({
      selectedCity,
      pilotName: selectedPilot.name,
      kpiDisplayName: fwEarly?.displayName || kd.shortName,
      scenario,
      kpiValue: kv,
      kpiRef: kd.ref,
      changeVerb: "Change in card metric:",
      disclaimerLine: disc.line,
      liveContextLine,
    });
  }, [selectedPilot, selectedKpi, selectedCity, scenario, mapContext, dataQualitySummary]);

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
  const changeColor = isPositiveChange ? "text-green" : "text-red-500";
  const TrendIcon = isPositiveChange ? TrendingUp : TrendingDown;

  const summaryHasBreakdown =
    !!baselineKvSlice.breakdown && Object.keys(baselineKvSlice.breakdown).length > 0;

  return (
    <div className="absolute top-20 left-4 z-30 w-[320px] max-h-[calc(100vh-6.5rem)] overflow-y-auto bg-[linear-gradient(165deg,rgba(255,255,255,0.18)_0%,rgba(255,255,255,0.07)_45%,rgba(255,255,255,0.04)_100%)] backdrop-blur-[30px] rounded-2xl shadow-[0_10px_40px_rgba(10,10,45,0.35)] text-white border border-white/35 leading-intel tracking-intel">
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(120%_60%_at_15%_0%,rgba(255,255,255,0.32)_0%,rgba(255,255,255,0.08)_45%,rgba(255,255,255,0)_80%)]" />
      <div className="pointer-events-none absolute inset-[1px] rounded-2xl border border-white/20" />
      {/* Header with City & KPI Selector */}
      <div className="relative px-5 pt-5 pb-4 bg-gradient-to-br from-violet/90 to-violet/70 rounded-t-2xl">
        <div className="flex items-center gap-2">
          <Select value={selectedCity} onValueChange={onCityChange}>
            <SelectTrigger className="w-fit h-auto p-0 border-0 bg-transparent text-xl font-bold text-primary-foreground hover:text-blue-light transition-colors">
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
            <SelectTrigger className="h-8 px-2.5 border border-primary-foreground/40 bg-primary-foreground/10 rounded-lg text-sm font-semibold text-primary-foreground flex items-center gap-1.5">
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
        <p className="text-xs text-primary-foreground/85 mt-2 leading-relaxed">
          {getPlainLanguageSummary(selectedKpi) || kpiFramework?.question || kpiDef.question}
        </p>

        {/* KPI Selector */}
        <Select value={selectedKpi} onValueChange={onKpiChange}>
          <SelectTrigger className="w-full h-auto px-3 py-2 mt-3 border border-primary-foreground/30 bg-primary-foreground/15 backdrop-blur-sm rounded-xl text-xs font-semibold text-primary-foreground hover:bg-primary-foreground/25 transition-all duration-200 shadow-md">
            <span>{kpiDef.ref} - {(kpiFramework?.displayName || kpiDef.shortName).toUpperCase()}</span>
          </SelectTrigger>
          <SelectContent className="bg-card/95 backdrop-blur-xl border-border-color/50 z-50 shadow-2xl">
            {availableKpis.map((kpi) => (
              <SelectItem key={kpi.id} value={kpi.id} className="text-sm py-2.5 hover:bg-violet/10 focus:bg-violet/10">
                {kpi.ref} - {getKpiFrameworkConfig(kpi.id)?.displayName || kpi.shortName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedPilot && (
          <div className="mt-3 rounded-lg border border-primary-foreground/25 bg-primary-foreground/10 p-2.5 text-[11px] text-primary-foreground/90">
            <p className="font-semibold">
              {kpiDef.ref} — {kpiFramework?.displayName || kpiDef.shortName}
            </p>
            <p className="mt-0.5 leading-snug">
              {kpiDefinition?.interpretation ||
                getPlainLanguageSummary(selectedKpi) ||
                kpiFramework?.question}
            </p>
            <p className="mt-1.5 text-[10px] text-primary-foreground/70 leading-snug">
              {selectedPilot.name}: {selectedPilot.title}
            </p>
          </div>
        )}

        {impactAtGlance && (
          <>
            <div className="mt-3 rounded-lg border border-primary-foreground/25 bg-primary-foreground/10 px-2.5 py-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8 w-full text-xs font-semibold bg-primary-foreground text-violet hover:bg-primary-foreground/90 shadow-sm"
                onClick={() => setSummaryOpen(true)}
              >
                View summary
              </Button>
            </div>
            <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
              <DialogContent className="insight-summary-dialog sm:max-w-2xl max-h-[90vh] overflow-y-auto text-foreground bg-card border-border-color">
                <div id="insight-summary-print-target" className="space-y-4">
                  <DialogHeader>
                    <DialogTitle>Story in plain words</DialogTitle>
                    <DialogDescription className="sr-only">
                      Narrative summary of the selected KPI, city, and pilot for printing or sharing.
                    </DialogDescription>
                    <p className="text-xs text-muted-foreground font-normal">
                      {kpiDef.ref} · {selectedCity}
                      {selectedPilot ? ` · ${selectedPilot.name}` : ""}
                    </p>
                  </DialogHeader>
                  <div className="text-sm space-y-3">
                    <p className="leading-relaxed">{impactAtGlance.lead}</p>
                    <ul className="list-disc pl-5 space-y-1.5 text-sm">
                      {impactAtGlance.bullets.map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  </div>

                  <section className="rounded-lg border border-border bg-muted/40 px-3 py-3 space-y-2">
                    <h3 className="text-sm font-semibold text-foreground">Before and after</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      <strong className="text-foreground">Before</strong> is the baseline encoded for this indicator (pre-intervention).
                      <strong className="text-foreground"> After</strong> is the headline value on the KPI card (post-intervention).
                      The gap between them is the coded shift on the card — not an independent field audit.
                    </p>
                    <div className="grid sm:grid-cols-3 gap-3 text-sm pt-1">
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Before</p>
                        <p className="font-semibold tabular-nums text-foreground">
                          {formatKpiFigure(baselineMainValue)}
                          <span className="text-muted-foreground font-normal ml-1">{kpiValue.unit}</span>
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">After</p>
                        <p className="font-semibold tabular-nums text-violet">
                          {formatKpiFigure(interventionMainValue)}
                          <span className="text-muted-foreground font-normal ml-1">{kpiValue.unit}</span>
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Change on card</p>
                        <p className="font-semibold tabular-nums text-foreground">
                          {isPositiveChange ? "+" : ""}
                          {formatKpiFigure(headlineChange)}
                          {kpiDef.unit === "%" ? " pp" : ""}
                        </p>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-2">
                    <h3 className="text-sm font-semibold text-foreground">Plots</h3>
                    <p className="text-[9px] text-muted-foreground leading-snug">
                      Chart selections drive the explorer map filters and camera (Pilot view).
                    </p>
                    {summaryHasBreakdown ? (
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">Before (baseline)</p>
                          <div className="insight-summary-chart-wrap rounded-lg overflow-hidden border border-white/15 bg-[#151130] min-h-[200px]">
                            <KPIChart
                              kpiId={selectedKpi}
                              data={baselineKvSlice}
                              cityName={selectedCity}
                              chartSelectionKeys={chartExplorerKeys}
                              onChartDrill={handleExplorerChartDrill}
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">After (intervention)</p>
                          <div className="insight-summary-chart-wrap rounded-lg overflow-hidden border border-white/15 bg-[#151130] min-h-[200px]">
                            <KPIChart
                              kpiId={selectedKpi}
                              data={interventionKvSlice}
                              cityName={selectedCity}
                              chartSelectionKeys={chartExplorerKeys}
                              onChartDrill={handleExplorerChartDrill}
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          This KPI uses the headline metric for baseline vs after; the chart shows the intervention view only.
                        </p>
                        <div className="insight-summary-chart-wrap rounded-lg overflow-hidden border border-white/15 bg-[#151130] min-h-[200px]">
                          <KPIChart
                            kpiId={selectedKpi}
                            data={interventionKvSlice}
                            cityName={selectedCity}
                            chartSelectionKeys={chartExplorerKeys}
                            onChartDrill={handleExplorerChartDrill}
                          />
                        </div>
                      </div>
                    )}
                  </section>
                </div>
                <DialogFooter className="flex-col gap-2 sm:flex-col print:hidden">
                  <Button type="button" variant="default" className="w-full gap-2" onClick={printInsightSummary}>
                    <Printer className="h-4 w-4" />
                    Print summary with plots
                  </Button>
                  <Button variant="outline" className="w-full" asChild>
                    <Link to={reportHref} target="_blank" rel="noopener noreferrer">
                      Open full printable report (new tab)
                    </Link>
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>

      {/* Scenario Toggle */}
      <div className="px-5 pt-4 pb-2">
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
            className="flex-1 data-[state=on]:bg-violet/20 data-[state=on]:text-violet data-[state=on]:border-violet border border-border-color/30"
          >
            Baseline
          </ToggleGroupItem>
          <ToggleGroupItem
            value="intervention"
            aria-label="Intervention"
            className="flex-1 data-[state=on]:bg-violet/20 data-[state=on]:text-violet data-[state=on]:border-violet border border-border-color/30"
          >
            Intervention
          </ToggleGroupItem>
          <ToggleGroupItem
            value="comparison"
            aria-label="Comparison"
            className="flex-1 data-[state=on]:bg-violet/20 data-[state=on]:text-violet data-[state=on]:border-violet border border-border-color/30 text-xs shrink-0 whitespace-nowrap px-1"
          >
            Comparison
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Level 1 — analytical KPI card */}
      <div className="relative px-5 py-4 bg-white/[0.03] border-b border-border-color/20">
        <div className="flex items-start justify-between gap-3">
          {scenario !== "comparison" ? (
            <div className="flex flex-col min-w-0">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-4xl font-semibold text-violet tracking-tight tabular-nums">
                  {formatKpiFigure(currentMainValue)}
                </span>
                <span className="text-intel-kpi-label font-semibold text-violet">{kpiValue.unit}</span>
              </div>
              {isModeShare && (
                <span className="text-intel-meta text-white/70 mt-0.5">Share of sustainable modes</span>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2 w-full">
              <div className="flex items-baseline gap-2">
                <span className="text-intel-meta text-white/90 font-medium w-[5.75rem] shrink-0">Before</span>
                <span className="text-2xl font-semibold text-white tabular-nums">{formatKpiFigure(baselineMainValue)}</span>
                <span className="text-sm font-semibold text-violet">{kpiValue.unit}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-intel-meta text-white/90 font-medium w-[5.75rem] shrink-0">After</span>
                <span className="text-2xl font-semibold text-violet tabular-nums">
                  {formatKpiFigure(interventionMainValue)}
                </span>
                <span className="text-sm font-semibold text-violet">{kpiValue.unit}</span>
              </div>
            </div>
          )}
          {(scenario === "intervention" || scenario === "comparison") && (
            <div
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg ${isPositiveChange ? "bg-green/20" : "bg-red-500/20"} ${changeColor} flex-shrink-0`}
            >
              <TrendIcon className="h-3 w-3" />
              <span className="text-intel-meta font-semibold tabular-nums">
                {isPositiveChange ? "+" : ""}
                {formatKpiFigure(headlineChange)}
                {kpiDef.unit === "%" ? "pp" : ""}
              </span>
            </div>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {dataQualitySummary?.provenanceType && (
            <DataProvenanceBadge type={dataQualitySummary.provenanceType} />
          )}
          {dataQualitySummary && (
            <span className="text-intel-meta text-white/60">
              Confidence: {dataQualitySummary.confidence}
            </span>
          )}
        </div>
      </div>

      {/* Level 3 — segment focus (chart + observatory link) */}
      {segmentFocusId && (
        <div className="px-4 py-3 bg-muted-bg/50 border-b border-border-color/30">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-intel-label font-semibold text-violet">Segment focus</p>
            {onOpenObservatory && (
              <button
                type="button"
                onClick={onOpenObservatory}
                className="text-intel-meta font-semibold text-violet hover:underline"
              >
                Open observatory
              </button>
            )}
          </div>
            <p className="text-intel-meta text-muted-foreground mb-2 leading-snug">
            {isIssyCity && isModeShare
              ? "City view: zone-to-zone OD arcs. Junction view: observed traficissy segment context on arms — not CSV mode share per street."
              : "Chart and map stay linked to the selected approach arm."}
          </p>
          <KPIChart
            kpiId={selectedKpi}
            data={currentKpiValue}
            cityName={selectedCity}
            chartSelectionKeys={chartExplorerKeys}
            onChartDrill={handleExplorerChartDrill}
          />
        </div>
      )}

      <Accordion type="multiple" defaultValue={[]} className="px-5 pb-2">
        {dataQualitySummary && (
          <AccordionItem value="data-trust" className="border-border-color/30">
            <AccordionTrigger className="text-intel-meta font-semibold py-2 hover:no-underline">
              Data trust & filters
            </AccordionTrigger>
            <AccordionContent>
              <LayerTrustStrip summary={dataQualitySummary} compact />
            </AccordionContent>
          </AccordionItem>
        )}
        {issyFlowsQueryEnabled && onIssyFlowDayCategoryChange && (
          <AccordionItem value="issy-day" className="border-border-color/30">
            <AccordionTrigger className="text-[10px] font-semibold py-2 hover:no-underline">
              Zone-to-zone flow (observed OD CSV)
            </AccordionTrigger>
            <AccordionContent>
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
                  className="flex-1 text-[10px] data-[state=on]:bg-violet/20 data-[state=on]:text-violet data-[state=on]:border-violet border border-border-color/30"
                >
                  All days
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="weekday"
                  className="flex-1 text-[10px] data-[state=on]:bg-violet/20 data-[state=on]:text-violet data-[state=on]:border-violet border border-border-color/30"
                >
                  Weekday
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="weekend"
                  className="flex-1 text-[10px] data-[state=on]:bg-violet/20 data-[state=on]:text-violet data-[state=on]:border-violet border border-border-color/30"
                >
                  Weekend
                </ToggleGroupItem>
              </ToggleGroup>
              <p className="text-[9px] text-muted-foreground mt-1.5 leading-snug">
                Observed OD flow data (zone_in / zone_out). Map arcs show zone-to-zone movement — not measured
                values on individual street segments. Junction arms use traficissy segment API only.
              </p>
            </AccordionContent>
          </AccordionItem>
        )}
        {selectedCity === "Milan" && selectedKpi === "kpi3.2" && onMilanEnvironmentWindowChange && (
          <AccordionItem value="milan-window" className="border-border-color/30">
            <AccordionTrigger className="text-[10px] font-semibold py-2 hover:no-underline">
              Time of day (Milan roads)
            </AccordionTrigger>
            <AccordionContent>
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
                  className="flex-1 text-[10px] data-[state=on]:bg-violet/20 data-[state=on]:text-violet data-[state=on]:border-violet border border-border-color/30"
                >
                  08–09
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="18-19"
                  className="flex-1 text-[10px] data-[state=on]:bg-violet/20 data-[state=on]:text-violet data-[state=on]:border-violet border border-border-color/30"
                >
                  18–19
                </ToggleGroupItem>
              </ToggleGroup>
              <p className="text-[9px] text-muted-foreground mt-1.5 leading-snug">
                Morning vs evening RETE windows — map segments follow this band.
              </p>
            </AccordionContent>
          </AccordionItem>
        )}
        {isModeShare && (
          <AccordionItem value="mode-filter" className="border-border-color/30">
            <AccordionTrigger className="text-[10px] font-semibold py-2 hover:no-underline">
              Travel modes (map filter)
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                {["Pedestrian", "Cycle", "Public Transport", "Private Car", "PTW"].map((modeType) => {
                  const isSelected = selectedModeTypes.includes(modeType);
                  const value = currentBreakdown?.[modeType] || 0;
                  const displayValue = usingIssyObservedModeShare
                    ? `${value.toFixed(1)}%`
                    : String(Math.round(value));
                  return (
                    <div
                      key={modeType}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted-bg/60 transition-colors cursor-pointer"
                      onClick={() => handleModeTypeToggle(modeType)}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => handleModeTypeToggle(modeType)}
                        className="data-[state=checked]:bg-violet data-[state=checked]:border-violet"
                      />
                      <div className="flex-1 flex items-center justify-between">
                        <span className="text-xs text-foreground font-medium">{modeType}</span>
                        <span className="text-xs text-muted-foreground">{displayValue}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}
        <AccordionItem value="methodology" className="border-border-color/30">
          <AccordionTrigger className="text-intel-meta font-semibold py-2 hover:no-underline">
            Methodology & data summary
          </AccordionTrigger>
          <AccordionContent>
            <button
              type="button"
              onClick={onOpenDataSummary}
              className="text-intel-meta font-semibold text-violet hover:underline"
            >
              Open data summary
            </button>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {mapContext && (
        <div className="mx-5 mb-3 rounded-lg border border-violet/45 bg-violet/25 backdrop-blur-2xl p-3 text-intel-meta shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]">
          <p className="font-semibold text-violet mb-1">Map focus</p>
          <p className="text-foreground">{mapContext.segmentName}</p>
          <p className="text-white/80">
            Speed: {mapContext.speed !== null ? `${mapContext.speed.toFixed(1)} km/h` : "n/a"} · Congestion:{" "}
            {mapContext.congestion !== null ? mapContext.congestion.toFixed(2) : "n/a"}
          </p>
        </div>
      )}
      {/* Footer - KPI Info */}
      <div className="px-4 py-2 bg-violet/10 border-t border-border-color/30">
        <p className="text-[10px] text-muted-foreground">
          <span className="font-semibold text-foreground">{kpiDef.ref}</span> · {kpiFramework?.displayName || kpiDef.name}
        </p>
      </div>
    </div>
  );
};

export default InsightPanel;
