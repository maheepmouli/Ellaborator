import { useEffect, useMemo, useState } from "react";
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

interface InsightPanelProps {
  selectedCity: string;
  selectedPilotName?: string;
  selectedPilotId?: string | null;
  selectedKpi: string;
  onCityChange: (city: string) => void;
  onPilotChange?: (pilotId: string) => void;
  onKpiChange: (kpi: string) => void;
  onRangeChange: (range: [number, number]) => void;
  onModeTypesChange?: (modeTypes: string[]) => void;
  scenario: "baseline" | "intervention" | "comparison";
  onScenarioChange: (scenario: "baseline" | "intervention" | "comparison") => void;
  onOpenDataSummary: () => void;
  mapContext?: {
    segmentName: string;
    speed: number | null;
    congestion: number | null;
  } | null;
  dataQualitySummary?: {
    recordsLabel: string;
    spatialQuality: string;
    dataType: string;
    temporalCoverage: string;
    confidence: "High" | "Medium" | "Low";
  } | null;
  /** Milan KPI 3.2 RETE load window (paired with HeroMap parsers). */
  milanEnvironmentWindow?: "08-09" | "18-19";
  onMilanEnvironmentWindowChange?: (window: "08-09" | "18-19") => void;
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
  onModeTypesChange,
  scenario,
  onScenarioChange,
  onOpenDataSummary,
  mapContext,
  dataQualitySummary,
  milanEnvironmentWindow = "08-09",
  onMilanEnvironmentWindowChange,
}: InsightPanelProps) => {
  const [selectedModeTypes, setSelectedModeTypes] = useState<string[]>([
    "Pedestrian",
    "Cycle",
    "Public Transport",
    "Private Car",
    "PTW",
  ]);

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

  const handleModeTypeToggle = (modeType: string) => {
    const newSelected = selectedModeTypes.includes(modeType)
      ? selectedModeTypes.filter((m) => m !== modeType)
      : [...selectedModeTypes, modeType];
    setSelectedModeTypes(newSelected);
    onModeTypesChange?.(newSelected);
  };

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
    return buildImpactAtGlance({
      selectedCity,
      pilotName: selectedPilot.name,
      kpiDisplayName: fwEarly?.displayName || kd.shortName,
      scenario,
      kpiValue: kv,
      kpiRef: kd.ref,
      changeVerb: "Change in card metric:",
      disclaimerLine: disc.line,
    });
  }, [selectedPilot, selectedKpi, selectedCity, scenario, mapContext]);

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

  const baselineKvSlice = baselineKpiSlice(kpiValue);
  const interventionKvSlice = interventionKpiSlice(kpiValue);
  const baselineMainValue = computeBaselineMainValue(kpiValue);
  const interventionMainValue = Number(kpiValue.mainValue);
  const currentMainValue = scenario === "baseline" ? baselineMainValue : interventionMainValue;
  const currentBreakdown =
    scenario === "baseline" ? baselineKvSlice.breakdown : interventionKvSlice.breakdown;

  const currentKpiValue: KPIValue = {
    ...kpiValue,
    mainValue: currentMainValue,
    breakdown: currentBreakdown,
  };

  const isPositiveChange = kpiValue.change > 0;
  const changeColor = isPositiveChange ? "text-green" : "text-red-500";
  const TrendIcon = isPositiveChange ? TrendingUp : TrendingDown;

  const summaryHasBreakdown =
    !!baselineKvSlice.breakdown && Object.keys(baselineKvSlice.breakdown).length > 0;

  return (
    <div className="absolute top-20 left-4 z-30 w-[320px] max-h-[calc(100vh-6.5rem)] overflow-y-auto bg-[linear-gradient(165deg,rgba(255,255,255,0.18)_0%,rgba(255,255,255,0.07)_45%,rgba(255,255,255,0.04)_100%)] backdrop-blur-[30px] rounded-2xl shadow-[0_10px_40px_rgba(10,10,45,0.35)] text-white border border-white/35">
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
              {selectedCity} — {selectedPilot.name}
            </p>
            <p className="mt-0.5">{selectedPilot.goal}</p>
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
                          {formatKpiFigure(kpiValue.change)}
                          {kpiDef.unit === "%" ? " pp" : ""}
                        </p>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-2">
                    <h3 className="text-sm font-semibold text-foreground">Plots</h3>
                    {summaryHasBreakdown ? (
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">Before (baseline)</p>
                          <div className="insight-summary-chart-wrap rounded-lg overflow-hidden border border-white/15 bg-[#151130] min-h-[200px]">
                            <KPIChart kpiId={selectedKpi} data={baselineKvSlice} cityName={selectedCity} />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">After (intervention)</p>
                          <div className="insight-summary-chart-wrap rounded-lg overflow-hidden border border-white/15 bg-[#151130] min-h-[200px]">
                            <KPIChart kpiId={selectedKpi} data={interventionKvSlice} cityName={selectedCity} />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          This KPI uses the headline metric for baseline vs after; the chart shows the intervention view only.
                        </p>
                        <div className="insight-summary-chart-wrap rounded-lg overflow-hidden border border-white/15 bg-[#151130] min-h-[200px]">
                          <KPIChart kpiId={selectedKpi} data={interventionKvSlice} cityName={selectedCity} />
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
            comparission
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {selectedCity === "Milan" && selectedKpi === "kpi3.2" && onMilanEnvironmentWindowChange && (
          <div className="px-5 pb-3">
            <p className="text-[10px] font-semibold text-foreground/90 mb-1.5">Time of day (Milan roads)</p>
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
              Morning vs evening hours change how busy the segments look — pick one to compare.
            </p>
          </div>
        )}

      {/* Main Stat */}
      <div className="relative px-5 py-4 bg-white/[0.03]">
        <div className="mb-3">
          <p className="text-xs font-semibold text-violet drop-shadow-[0_0_10px_rgba(139,92,246,0.7)]">KPI Card</p>
        </div>

        {mapContext && (
          <div className="mb-3 rounded-lg border border-violet/45 bg-violet/25 backdrop-blur-2xl p-3 text-[11px] shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]">
            <p className="font-semibold text-violet mb-1">Map focus: one street segment</p>
            <p className="text-foreground">Segment: {mapContext.segmentName}</p>
            <p className="text-white/80">
              Speed: {mapContext.speed !== null ? `${mapContext.speed.toFixed(1)} km/h` : "n/a"}
            </p>
            <p className="text-white/80">
              Congestion index: {mapContext.congestion !== null ? mapContext.congestion.toFixed(2) : "n/a"}
            </p>
          </div>
        )}

        <div className="flex items-start justify-between gap-3">
          {scenario !== "comparison" ? (
            <div className="flex flex-col">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-4xl font-bold text-violet tracking-tight drop-shadow-[0_0_14px_rgba(139,92,246,0.75)] tabular-nums">
                  {formatKpiFigure(currentMainValue)}
                </span>
                <span className="text-lg font-bold text-violet drop-shadow-[0_0_10px_rgba(139,92,246,0.7)]">{kpiValue.unit}</span>
              </div>
              {isModeShare && (
                <span className="text-[10px] text-white/70 mt-0.5 leading-relaxed">
                  Share of sustainable modes
                </span>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2 w-full">
              <p className="text-[10px] text-primary-foreground/80 leading-snug mb-1">
                Side‑by‑side for the same indicator: numbers before changes vs after changes.
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-xs text-white/90 font-medium w-[5.75rem] shrink-0">Before</span>
                <span className="text-2xl font-bold text-white tabular-nums">{formatKpiFigure(baselineMainValue)}</span>
                <span className="text-sm font-semibold text-violet">{kpiValue.unit}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xs text-white/90 font-medium w-[5.75rem] shrink-0">After</span>
                <span className="text-2xl font-bold text-violet drop-shadow-[0_0_10px_rgba(139,92,246,0.55)] tabular-nums">
                  {formatKpiFigure(interventionMainValue)}
                </span>
                <span className="text-sm font-semibold text-violet">{kpiValue.unit}</span>
              </div>
            </div>
          )}

          {(scenario === "intervention" || scenario === "comparison") && (
            <div className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg ${isPositiveChange ? 'bg-green/20' : 'bg-red-500/20'} ${changeColor} flex-shrink-0`}>
              <TrendIcon className="h-3 w-3" />
              <span className="text-xs font-bold tabular-nums">
                {isPositiveChange ? "+" : ""}
                {formatKpiFigure(kpiValue.change)}
                {kpiDef.unit === "%" ? "pp" : ""}
              </span>
            </div>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <button
            onClick={onOpenDataSummary}
            className="text-[11px] font-semibold text-violet hover:underline"
          >
            Data Summary
          </button>
          {kpiDefinition && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted-bg text-muted-foreground">
              {kpiDefinition.dataLabel}
            </span>
          )}
          {kpiFramework?.isModelled && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted-bg text-muted-foreground">
              Modelled estimate
            </span>
          )}
          {kpiFramework?.isMock && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted-bg text-muted-foreground">
              Mock/demo value
            </span>
          )}
        </div>
        {dataQualitySummary && (
          <p className="mt-3 text-[10px] text-white/80">
            Data confidence: <span className="font-semibold text-white">{dataQualitySummary.confidence}</span>
          </p>
        )}
      </div>

      {/* Chart */}
      <div className="px-4 py-3 bg-muted-bg/40 border-y border-border-color/30">
        <KPIChart
          kpiId={selectedKpi}
          data={currentKpiValue}
          cityName={selectedCity}
        />
      </div>
      {/* Mode Type Filter (for Mode Share KPI) */}
      {isModeShare && (
        <div className="px-4 py-3 bg-card/60">
          <span className="text-xs font-semibold text-foreground mb-3 block">Travel modes shown in the chart</span>
          
          <div className="space-y-2">
            {[
              "Pedestrian",
              "Cycle",
              "Public Transport",
              "Private Car",
              "PTW"
            ].map((modeType) => {
              const isSelected = selectedModeTypes.includes(modeType);
              const value = currentBreakdown?.[modeType] || 0;
              // Show raw number instead of percentage for monitored data
              const displayValue = Math.round(value);
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
          <p className="text-[10px] text-muted-foreground mt-3 pt-3 border-t border-border-color/30">
            {kpiDef.ref} - {kpiDef.name}
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
