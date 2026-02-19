import { useState } from "react";
import { ChevronDown, TrendingUp, TrendingDown } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ELABORATOR_KPIS, CITY_DATA, KPIValue } from "@/data/kpiDefinitions";
import KPIChart from "./KPICharts";

interface InsightPanelProps {
  selectedCity: string;
  selectedKpi: string;
  onCityChange: (city: string) => void;
  onKpiChange: (kpi: string) => void;
  onRangeChange: (range: [number, number]) => void;
  onModeTypesChange?: (modeTypes: string[]) => void;
}

const InsightPanel = ({
  selectedCity,
  selectedKpi,
  onCityChange,
  onKpiChange,
  onRangeChange,
  onModeTypesChange,
}: InsightPanelProps) => {
  const [range, setRange] = useState<[number, number]>([0, 100]);
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

  const handleRangeChange = (values: number[]) => {
    const newRange: [number, number] = [values[0], values[1]];
    setRange(newRange);
    onRangeChange(newRange);
  };

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

  const isPositiveChange = kpiValue.change > 0;
  const changeColor = isPositiveChange ? "text-green" : "text-red-500";
  const TrendIcon = isPositiveChange ? TrendingUp : TrendingDown;

  return (
    <div className="absolute top-20 left-4 z-30 w-[320px] bg-card/95 backdrop-blur-2xl rounded-2xl shadow-2xl shadow-purple/20 text-foreground overflow-hidden border border-border-color/40">
      {/* Header with City & KPI Selector */}
      <div className="px-5 pt-5 pb-4 bg-gradient-to-br from-violet to-violet/90 rounded-t-2xl">
        {/* City Selector */}
        <Select value={selectedCity} onValueChange={onCityChange}>
          <SelectTrigger className="w-fit h-auto p-0 border-0 bg-transparent text-xl font-bold text-primary-foreground hover:text-blue-light transition-colors">
            <SelectValue placeholder={selectedCity} />
          </SelectTrigger>
          <SelectContent className="bg-card/95 backdrop-blur-xl border-border-color/50 z-50 shadow-2xl">
            {CITY_DATA.map((city) => (
              <SelectItem key={city.city} value={city.city} className="text-sm py-2.5 hover:bg-violet/10 focus:bg-violet/10">
                {city.city}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <p className="text-xs text-primary-foreground/80 mt-2 leading-relaxed">{kpiDef.question}</p>

        {/* KPI Selector */}
        <Select value={selectedKpi} onValueChange={onKpiChange}>
          <SelectTrigger className="w-full h-auto px-3 py-2 mt-3 border border-primary-foreground/30 bg-primary-foreground/15 backdrop-blur-sm rounded-xl text-xs font-semibold text-primary-foreground hover:bg-primary-foreground/25 transition-all duration-200 shadow-md">
            <span>{kpiDef.ref} - {kpiDef.shortName.toUpperCase()}</span>
          </SelectTrigger>
          <SelectContent className="bg-card/95 backdrop-blur-xl border-border-color/50 z-50 shadow-2xl">
            {ELABORATOR_KPIS.map((kpi) => (
              <SelectItem key={kpi.id} value={kpi.id} className="text-sm py-2.5 hover:bg-violet/10 focus:bg-violet/10">
                {kpi.ref} - {kpi.shortName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>


      {/* Main Stat */}
      <div className="px-5 py-4 bg-card/60">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-4xl font-bold text-foreground tracking-tight">{kpiValue.mainValue}</span>
              <span className="text-lg font-bold text-foreground">{kpiValue.unit}</span>
            </div>
            {isModeShare && (
              <span className="text-[10px] text-muted-foreground/70 mt-0.5 leading-relaxed">
                Share of sustainable transport modes
              </span>
            )}
          </div>
          <div className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg ${isPositiveChange ? 'bg-green/20' : 'bg-red-500/20'} ${changeColor} flex-shrink-0`}>
            <TrendIcon className="h-3 w-3" />
            <span className="text-xs font-bold">
              {isPositiveChange ? "+" : ""}
              {kpiValue.change}
              {kpiDef.unit === "%" ? "pp" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="px-4 py-3 bg-muted-bg/40 border-y border-border-color/30">
        <KPIChart kpiId={selectedKpi} data={kpiValue} cityName={selectedCity} />
      </div>

      {/* Mode Type Filter (for Mode Share KPI) */}
      {isModeShare && (
        <div className="px-4 py-3 bg-card/60">
          <span className="text-xs font-semibold text-foreground mb-3 block">Filter by mode type</span>
          
          <div className="space-y-2">
            {[
              "Pedestrian",
              "Cycle",
              "Public Transport",
              "Private Car",
              "PTW"
            ].map((modeType) => {
              const isSelected = selectedModeTypes.includes(modeType);
              const value = kpiValue?.breakdown?.[modeType] || 0;
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
                    <span className="text-xs text-muted-foreground">{value}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Distribution Filter (for other KPIs) */}
      {!isModeShare && kpiValue.distribution && (
        <div className="px-4 py-3 bg-card/60">
          <span className="text-xs font-semibold text-foreground mb-2 block">Filter by range</span>

          {/* Mini Histogram */}
          <div className="h-10 flex items-end gap-0.5 mb-2 p-1.5 bg-muted-bg/60 rounded-lg border border-border-color/30">
            {kpiValue.distribution.map((value, idx) => {
              const maxVal = Math.max(...kpiValue.distribution!);
              const height = (value / maxVal) * 100;
              const totalBars = kpiValue.distribution!.length;
              const inRange =
                idx >= (range[0] / 100) * totalBars && idx < (range[1] / 100) * totalBars;
              return (
                <div
                  key={idx}
                  className="flex-1 rounded-t-sm transition-all duration-300"
                  style={{
                    height: `${height}%`,
                    backgroundColor: inRange ? "hsl(var(--violet))" : "hsl(var(--border-color))",
                  }}
                />
              );
            })}
          </div>

          {/* Range Slider */}
          <Slider
            defaultValue={[0, 100]}
            max={100}
            min={0}
            step={1}
            value={range}
            onValueChange={handleRangeChange}
            className="w-full"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>{range[0]}%</span>
            <span>{range[1]}%</span>
          </div>
        </div>
      )}

      {/* Footer - KPI Info */}
      <div className="px-4 py-2 bg-violet/10 border-t border-border-color/30">
        <p className="text-[10px] text-muted-foreground">
          <span className="font-semibold text-foreground">{kpiDef.ref}</span> · {kpiDef.name}
        </p>
      </div>
    </div>
  );
};

export default InsightPanel;
