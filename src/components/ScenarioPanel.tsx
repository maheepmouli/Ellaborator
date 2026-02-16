import { motion, AnimatePresence } from "framer-motion";
import { X, HelpCircle, TrendingUp, TrendingDown } from "lucide-react";
import { CITY_DATA, ELABORATOR_KPIS } from "@/data/kpiDefinitions";

interface ScenarioPanelProps {
  scenario: "baseline" | "intervention" | "comparison";
  selectedCity: string;
  selectedKpi: string;
  onClose: () => void;
}

const ScenarioPanel = ({
  scenario,
  selectedCity,
  selectedKpi,
  onClose,
}: ScenarioPanelProps) => {
  const cityData = CITY_DATA.find((c) => c.city === selectedCity);
  const kpiDef = ELABORATOR_KPIS.find((k) => k.id === selectedKpi);
  const kpiValue = cityData?.kpiData[selectedKpi];

  const scenarioTitles = {
    baseline: "Baseline Analysis",
    intervention: "Intervention Impact Analysis",
    comparison: "Baseline vs Intervention Comparison",
  };

  const scenarioDescriptions = {
    baseline: "View current state metrics before any interventions are applied.",
    intervention: "Explore how interventions affect different populations and locations.",
    comparison: "Compare metrics between baseline and intervention scenarios side by side.",
  };

  // Simplified analysis cards - only the most relevant ones
  const analysisCards: Array<{
    id: string;
    title: string;
    mainValue: string;
    unit: string;
    data: number[];
    isGreen?: boolean;
  }> = scenario === "comparison" ? [] : [
    {
      id: "distance",
      title: "Distance to intervention",
      mainValue: scenario === "baseline" ? "6.8" : "4.2",
      unit: "km",
      data: [25, 35, 45, 30, 20],
    },
    {
      id: "emissions",
      title: "Emissions impact",
      mainValue: scenario === "baseline" ? "-5%" : "-17%",
      unit: "avg.",
      data: [50, 35, 25, 20, 15],
      isGreen: true,
    },
  ];

  // KPI comparison data
  const kpiComparison = ELABORATOR_KPIS.slice(0, 4).map((kpi) => ({
    id: kpi.id,
    name: kpi.shortName,
    ref: kpi.ref,
    baseline: Math.floor(Math.random() * 20) + 25,
    intervention: cityData?.kpiData[kpi.id]?.mainValue || 0,
    change: cityData?.kpiData[kpi.id]?.change || 0,
  }));

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-2xl border-t border-border-color/50 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-color/30">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold text-foreground">{scenarioTitles[scenario]}</h2>
            <span className="px-3 py-1 text-xs font-medium bg-violet/20 text-violet rounded-full">
              {selectedCity}
            </span>
            {kpiDef && (
              <span className="px-3 py-1 text-xs font-medium bg-muted-bg text-foreground rounded-full">
                {kpiDef.ref}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted-bg transition-colors"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 max-h-[50vh] overflow-y-auto">
          <div className="flex gap-6">
            {/* Left Info */}
            <div className="w-64 flex-shrink-0">
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                {scenarioDescriptions[scenario]}
              </p>
              <button className="flex items-center gap-2 text-sm text-violet hover:underline">
                <HelpCircle className="h-4 w-4" />
                How to read the charts?
              </button>
              {scenario !== "baseline" && (
                <div className="mt-4 pt-4 border-t border-border-color/30">
                  <p className="text-xs text-muted-foreground mb-2">Intervention coverage</p>
                  <div className="h-2 bg-muted-bg rounded-full overflow-hidden">
                    <div className="h-full w-3/4 bg-gradient-to-r from-violet to-green rounded-full" />
                  </div>
                </div>
              )}
            </div>

            {/* Analysis Cards */}
            <div className="flex-1 flex gap-4 overflow-x-auto pb-2">
              {analysisCards.map((card) => (
                <div
                  key={card.id}
                  className="min-w-[200px] bg-card rounded-xl border border-border-color/40 p-4 flex flex-col hover:border-violet/50 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-sm font-semibold text-foreground">{card.title}</h3>
                    <button className="text-muted-foreground hover:text-violet">
                      <HelpCircle className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className={`text-xl font-bold mb-3 ${card.isGreen ? 'text-green' : 'text-violet'}`}>
                    {card.mainValue}
                    <span className="text-sm font-normal text-muted-foreground ml-1">{card.unit}</span>
                  </p>

                  {/* Mini Chart */}
                  <div className="flex-1 flex items-end gap-1 min-h-[40px] mb-2">
                    {card.data.map((value, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div
                          className="w-full rounded-t-sm transition-all duration-300"
                          style={{
                            height: `${value}%`,
                            backgroundColor: card.isGreen ? "hsl(var(--green))" : "hsl(var(--violet))",
                            minHeight: "4px",
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* KPI Comparison Section (only for comparison scenario) */}
          {scenario === "comparison" && (
            <div className="mt-6 pt-6 border-t border-border-color/30">
              <h3 className="text-sm font-bold text-foreground mb-4">KPI Comparison: Baseline vs Intervention</h3>
              <div className="grid grid-cols-4 gap-4">
                {kpiComparison.map((kpi) => (
                  <div
                    key={kpi.id}
                    className="bg-muted-bg/50 rounded-xl p-4 border border-border-color/30 hover:border-violet/50 transition-colors cursor-pointer"
                  >
                    <p className="text-xs text-muted-foreground mb-1">{kpi.ref}</p>
                    <p className="text-sm font-semibold text-foreground mb-3">{kpi.name}</p>
                    <div className="flex items-end justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-[10px] text-muted-foreground mb-1">Baseline</p>
                        <div className="h-8 bg-border-color/50 rounded relative overflow-hidden">
                          <div
                            className="absolute bottom-0 left-0 right-0 bg-muted-foreground/40 rounded"
                            style={{ height: `${(kpi.baseline / 100) * 100}%` }}
                          />
                        </div>
                        <p className="text-xs font-medium text-foreground mt-1">{kpi.baseline}%</p>
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] text-muted-foreground mb-1">Intervention</p>
                        <div className="h-8 bg-border-color/50 rounded relative overflow-hidden">
                          <div
                            className="absolute bottom-0 left-0 right-0 bg-violet rounded"
                            style={{ height: `${(Number(kpi.intervention) / 100) * 100}%` }}
                          />
                        </div>
                        <p className="text-xs font-medium text-foreground mt-1">{kpi.intervention}%</p>
                      </div>
                      <div className={`text-xs font-bold px-2 py-1 rounded ${kpi.change > 0 ? 'text-green bg-green/20' : 'text-red-500 bg-red-500/20'}`}>
                        {kpi.change > 0 ? '+' : ''}{kpi.change}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Main KPI display for baseline/intervention */}
          {scenario !== "comparison" && kpiValue && (
            <div className="mt-6 pt-6 border-t border-border-color/30">
              <h3 className="text-sm font-bold text-foreground mb-4">
                {kpiDef?.ref} - {kpiDef?.shortName}: {scenario === "baseline" ? "Current State" : "After Intervention"}
              </h3>
              <div className="flex items-center gap-6">
                <div className="text-5xl font-bold text-foreground">
                  {scenario === "baseline" ? Math.round(Number(kpiValue.mainValue) * 0.85) : kpiValue.mainValue}
                  <span className="text-xl text-muted-foreground ml-2">{kpiValue.unit}</span>
                </div>
                {scenario === "intervention" && (
                  <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${kpiValue.change > 0 ? 'bg-green/20 text-green' : 'bg-red-500/20 text-red-500'}`}>
                    {kpiValue.change > 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                    <span className="text-lg font-bold">
                      {kpiValue.change > 0 ? '+' : ''}{kpiValue.change}{kpiDef?.unit === '%' ? 'pp' : ''}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ScenarioPanel;
