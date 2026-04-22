import { useMemo, useState } from "react";
import { Info, TrendingUp, TrendingDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Switch } from "@/components/ui/switch";
import { ELABORATOR_KPIS, CITY_DATA, KPIValue } from "@/data/kpiDefinitions";
import { getPilotsByCity } from "@/data/pilotDefinitions";
import KPIChart from "./KPICharts";
import { getKpiFrameworkConfig } from "@/config/kpiFramework";
import { getKpiDefinition } from "@/config/kpiDefinitions";

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
  contextTitle?: string;
  mapContext?: {
    segmentName: string;
    speed: number | null;
    congestion: number | null;
  } | null;
  showInterventionLayer: boolean;
  onInterventionLayerChange: (value: boolean) => void;
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
  contextTitle,
  mapContext,
  showInterventionLayer,
  onInterventionLayerChange,
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
  const [showDataExplanation, setShowDataExplanation] = useState(false);

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

  if (!kpiDef || !kpiValue) return null;

  // Calculate baseline values
  const getBaselineValue = (interventionValue: number, change: number): number => {
    return Math.max(0, interventionValue - change);
  };

  const getBaselineBreakdown = (breakdown: Record<string, number> | undefined, change: number): Record<string, number> | undefined => {
    if (!breakdown) return undefined;
    const baselineBreakdown: Record<string, number> = {};
    
    // For mode share, sustainable modes are Pedestrian, Cycle, Public Transport
    const sustainableModes = ["Pedestrian", "Cycle", "Public Transport"];
    const nonSustainableModes = ["Private Car", "PTW"];
    
    // Calculate baseline: reduce sustainable modes, increase non-sustainable modes
    Object.keys(breakdown).forEach((mode) => {
      const interventionValue = breakdown[mode];
      if (sustainableModes.includes(mode)) {
        // Reduce sustainable modes proportionally
        const totalSustainable = sustainableModes.reduce((sum, m) => sum + (breakdown[m] || 0), 0);
        if (totalSustainable > 0) {
          const proportion = interventionValue / totalSustainable;
          const baselineSustainableTotal = Math.max(0, totalSustainable - change);
          baselineBreakdown[mode] = Math.max(0, baselineSustainableTotal * proportion);
        } else {
          baselineBreakdown[mode] = 0;
        }
      } else if (nonSustainableModes.includes(mode)) {
        // Increase non-sustainable modes proportionally to maintain 100% total
        const totalNonSustainable = nonSustainableModes.reduce((sum, m) => sum + (breakdown[m] || 0), 0);
        if (totalNonSustainable > 0) {
          const proportion = interventionValue / totalNonSustainable;
          const baselineNonSustainableTotal = totalNonSustainable + change;
          baselineBreakdown[mode] = Math.max(0, baselineNonSustainableTotal * proportion);
        } else {
          baselineBreakdown[mode] = interventionValue;
        }
      } else {
        baselineBreakdown[mode] = interventionValue;
      }
    });
    
    return baselineBreakdown;
  };

  // Get current scenario values
  const baselineMainValue = getBaselineValue(Number(kpiValue.mainValue), kpiValue.change);
  const interventionMainValue = Number(kpiValue.mainValue);
  const currentMainValue =
    scenario === "baseline" ? baselineMainValue : interventionMainValue;
  
  const currentBreakdown = scenario === "baseline"
    ? getBaselineBreakdown(kpiValue.breakdown, kpiValue.change)
    : kpiValue.breakdown;

  // Create a modified KPI value for the chart
  const currentKpiValue: KPIValue = {
    ...kpiValue,
    mainValue: currentMainValue,
    breakdown: currentBreakdown,
  };

  const isPositiveChange = kpiValue.change > 0;
  const changeColor = isPositiveChange ? "text-green" : "text-red-500";
  const TrendIcon = isPositiveChange ? TrendingUp : TrendingDown;

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
        
        <p className="text-xs text-primary-foreground/80 mt-2 leading-relaxed">
          {kpiFramework?.question || kpiDef.question}
        </p>
        {contextTitle && (
          <p className="text-[11px] mt-1 text-primary-foreground/90 font-semibold">
            {contextTitle}
          </p>
        )}

        {/* KPI Selector */}
        <Select value={selectedKpi} onValueChange={onKpiChange}>
          <SelectTrigger className="w-full h-auto px-3 py-2 mt-3 border border-primary-foreground/30 bg-primary-foreground/15 backdrop-blur-sm rounded-xl text-xs font-semibold text-primary-foreground hover:bg-primary-foreground/25 transition-all duration-200 shadow-md">
            <span>{kpiDef.ref} - {(kpiFramework?.displayName || kpiDef.shortName).toUpperCase()}</span>
          </SelectTrigger>
          <SelectContent className="bg-card/95 backdrop-blur-xl border-border-color/50 z-50 shadow-2xl">
            {ELABORATOR_KPIS.map((kpi) => (
              <SelectItem key={kpi.id} value={kpi.id} className="text-sm py-2.5 hover:bg-violet/10 focus:bg-violet/10">
                {kpi.ref} - {getKpiFrameworkConfig(kpi.id)?.displayName || kpi.shortName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
            className="flex-1 data-[state=on]:bg-violet/20 data-[state=on]:text-violet data-[state=on]:border-violet border border-border-color/30"
          >
            Comparison
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Main Stat */}
      <div className="relative px-5 py-4 bg-white/[0.03]">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-violet drop-shadow-[0_0_10px_rgba(139,92,246,0.7)]">KPI Card</p>
          <button
            className="h-6 w-6 rounded-full border border-border-color/40 flex items-center justify-center hover:bg-muted-bg"
            onClick={() => setShowDataExplanation((prev) => !prev)}
            aria-label="Open KPI data layer explanation"
          >
            <Info className="h-3.5 w-3.5 text-violet" />
          </button>
        </div>
        {showDataExplanation && kpiDefinition && (
          <div className="mb-3 text-[11px] rounded-lg border border-border-color/40 bg-muted-bg/60 p-3 space-y-1.5">
            <p className="font-semibold text-violet drop-shadow-[0_0_10px_rgba(139,92,246,0.7)]">{kpiDefinition.name}</p>
            <p className="text-white/80">{kpiDefinition.summary}</p>
            <p><span className="font-semibold text-foreground">Data source:</span> {kpiDefinition.dataSource}</p>
            <p><span className="font-semibold text-foreground">Method:</span> {kpiDefinition.method}</p>
            <p><span className="font-semibold text-foreground">Status:</span> {kpiDefinition.status}</p>
          </div>
        )}

        {kpiDefinition && (
          <div className="mb-3 rounded-lg border border-white/25 p-3 bg-white/[0.06] backdrop-blur-2xl text-xs shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
            <p className="font-semibold text-violet drop-shadow-[0_0_10px_rgba(139,92,246,0.7)]">KPI: {kpiDefinition.name}</p>
            <div className="my-2 border-t border-border-color/30" />
            <p className="text-white/80">Indicator: {kpiDefinition.indicator}</p>
            <p className="text-white/80">Value: {currentMainValue}{kpiValue.unit}</p>
            <p className="text-white/80">
              Change: {kpiValue.change > 0 ? "+" : ""}{kpiValue.change}{kpiDef.unit === "%" ? "pp" : ""}
            </p>
            <div className="my-2 border-t border-border-color/30" />
            <p className="text-violet mb-1 drop-shadow-[0_0_10px_rgba(139,92,246,0.7)]">Based on:</p>
            {kpiDefinition.supportingData.map((source) => (
              <p className="text-white/75" key={source}>- {source}</p>
            ))}
          </div>
        )}

        {mapContext && (
          <div className="mb-3 rounded-lg border border-violet/45 bg-violet/25 backdrop-blur-2xl p-3 text-[11px] shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]">
            <p className="font-semibold text-violet mb-1">You are viewing data for this segment</p>
            <p className="text-foreground">Segment: {mapContext.segmentName}</p>
            <p className="text-white/80">
              Speed: {mapContext.speed !== null ? `${mapContext.speed.toFixed(1)} km/h` : "n/a"}
            </p>
            <p className="text-white/80">
              Congestion index: {mapContext.congestion !== null ? mapContext.congestion.toFixed(2) : "n/a"}
            </p>
          </div>
        )}

        <div className="mb-3 rounded-lg border border-white/25 p-3 bg-white/[0.06] backdrop-blur-2xl text-xs shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-violet drop-shadow-[0_0_10px_rgba(139,92,246,0.7)]">Show intervention area</p>
              <p className="text-white/80">Intervention scale: Neighbourhood level</p>
            </div>
            <Switch checked={showInterventionLayer} onCheckedChange={onInterventionLayerChange} />
          </div>
          <p className="text-white/80 mt-2">Description: Pilot streets around the selected intervention zone.</p>
        </div>

        <div className="flex items-start justify-between gap-3">
          {scenario !== "comparison" ? (
            <div className="flex flex-col">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-4xl font-bold text-violet tracking-tight drop-shadow-[0_0_14px_rgba(139,92,246,0.75)]">{currentMainValue}</span>
                <span className="text-lg font-bold text-violet drop-shadow-[0_0_10px_rgba(139,92,246,0.7)]">{kpiValue.unit}</span>
              </div>
              {isModeShare && (
                <span className="text-[10px] text-white/70 mt-0.5 leading-relaxed">
                  Share of sustainable modes
                </span>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline gap-2">
                <span className="text-xs text-white/75 w-20">Baseline</span>
                <span className="text-lg font-bold text-foreground">{baselineMainValue}</span>
                <span className="text-xs text-white/75">{kpiValue.unit}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xs text-white/75 w-20">Intervention</span>
                <span className="text-lg font-bold text-foreground">{interventionMainValue}</span>
                <span className="text-xs text-white/75">{kpiValue.unit}</span>
              </div>
            </div>
          )}

          {scenario === "intervention" && (
            <div className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg ${isPositiveChange ? 'bg-green/20' : 'bg-red-500/20'} ${changeColor} flex-shrink-0`}>
              <TrendIcon className="h-3 w-3" />
              <span className="text-xs font-bold">
                {isPositiveChange ? "+" : ""}
                {kpiValue.change}
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
        <div className="mt-2 text-[10px] text-white/80 space-y-0.5">
          <p><span className="font-semibold text-white">Source:</span> {kpiDefinition?.dataSource || "City dataset (mock)"}</p>
          <p><span className="font-semibold text-white">Method:</span> {kpiDefinition?.method || "Derived"}</p>
          <p><span className="font-semibold text-white">Type:</span> {kpiFramework?.isMock ? "Mock" : "Estimated"}</p>
        </div>
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
          <span className="text-xs font-semibold text-foreground mb-3 block">Filter Monitored Data</span>
          
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
