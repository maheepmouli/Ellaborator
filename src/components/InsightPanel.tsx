import { useState } from "react";
import { ChevronDown, TrendingUp, TrendingDown } from "lucide-react";
import { Slider } from "@/components/ui/slider";
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
  onScenarioSelect: (scenario: "baseline" | "intervention" | "comparison") => void;
  activeScenario: "baseline" | "intervention" | "comparison" | null;
}

const InsightPanel = ({
  selectedCity,
  selectedKpi,
  onCityChange,
  onKpiChange,
  onRangeChange,
  onScenarioSelect,
  activeScenario,
}: InsightPanelProps) => {
  const [range, setRange] = useState<[number, number]>([0, 100]);

  const cityData = CITY_DATA.find((c) => c.city === selectedCity);
  const kpiDef = ELABORATOR_KPIS.find((k) => k.id === selectedKpi);
  const kpiValue: KPIValue | undefined = cityData?.kpiData[selectedKpi];

  const handleRangeChange = (values: number[]) => {
    const newRange: [number, number] = [values[0], values[1]];
    setRange(newRange);
    onRangeChange(newRange);
  };

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

      {/* Scenario Toggle */}
      <div className="px-4 py-3 bg-card/40 border-b border-border-color/30">
        <div className="flex bg-muted-bg/60 rounded-lg p-0.5">
          {[
            { id: "baseline", label: "Baseline" },
            { id: "intervention", label: "Intervention" },
            { id: "comparison", label: "Comparison" },
          ].map((s) => (
            <button
              key={s.id}
              onClick={() => onScenarioSelect(s.id as "baseline" | "intervention" | "comparison")}
              className={`flex-1 px-2 py-1.5 text-[10px] font-semibold rounded-md transition-all duration-200 ${
                activeScenario === s.id
                  ? "bg-violet text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Stat */}
      <div className="px-5 py-4 bg-card/60">
        <div className="flex items-end gap-2">
          <span className="text-4xl font-bold text-foreground tracking-tight">{kpiValue.mainValue}</span>
          <span className="text-lg text-muted-foreground mb-1">{kpiValue.unit}</span>
          <div className={`flex items-center gap-1 mb-1 ml-auto px-2 py-1 rounded-lg ${isPositiveChange ? 'bg-green/20' : 'bg-red-500/20'} ${changeColor}`}>
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

      {/* Distribution Filter (for applicable KPIs) */}
      {kpiValue.distribution && (
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
