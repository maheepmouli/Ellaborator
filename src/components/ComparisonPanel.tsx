import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, HelpCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ELABORATOR_KPIS, CITY_DATA } from "@/data/kpiDefinitions";

interface ComparisonPanelProps {
  selectedCity: string;
  selectedKpi: string;
  isOpen: boolean;
  onToggle: () => void;
}

const ComparisonPanel = ({
  selectedCity,
  selectedKpi,
  isOpen,
  onToggle,
}: ComparisonPanelProps) => {
  const cityData = CITY_DATA.find((c) => c.city === selectedCity);
  
  // Get the 4 KPIs shown in the image
  const comparisonKPIs = ["kpi1.2", "kpi2.1", "kpi3.1", "kpi3.2"];
  
  // Calculate baseline values (intervention - change)
  const getBaselineValue = (kpiId: string): number => {
    const kpiValue = cityData?.kpiData[kpiId];
    if (!kpiValue) return 0;
    const intervention = typeof kpiValue.mainValue === 'number' ? kpiValue.mainValue : parseFloat(String(kpiValue.mainValue));
    const change = kpiValue.change || 0;
    return Math.max(0, intervention - change);
  };

  const getInterventionValue = (kpiId: string): number => {
    const kpiValue = cityData?.kpiData[kpiId];
    if (!kpiValue) return 0;
    return typeof kpiValue.mainValue === 'number' ? kpiValue.mainValue : parseFloat(String(kpiValue.mainValue));
  };

  return (
    <>
      {/* Collapsed Button - Vertical (Rotated 90 degrees) */}
      {!isOpen && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-40"
        >
          <Button
            onClick={onToggle}
            className="h-32 w-12 rounded-l-lg rounded-r-none bg-violet/90 hover:bg-violet text-primary-foreground shadow-lg border-r border-violet/50 flex flex-col items-center justify-center gap-2"
          >
            <ChevronLeft className="h-4 w-4 rotate-90" />
            <span className="font-medium writing-vertical-rl text-center" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
              Comparison
            </span>
          </Button>
        </motion.div>
      )}

      {/* Expanded Sidebar */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-20 bottom-4 z-40 w-[420px] bg-card/95 backdrop-blur-2xl rounded-l-2xl shadow-2xl border-l border-border-color/50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-color/30">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-foreground">Comparison</h2>
                <span className="px-3 py-1 text-xs font-medium bg-violet/20 text-violet rounded-full">
                  {selectedCity}
                </span>
                <span className="px-3 py-1 text-xs font-medium bg-muted-bg text-foreground rounded-full">
                  {ELABORATOR_KPIS.find(k => k.id === selectedKpi)?.ref || selectedKpi}
                </span>
              </div>
              <Button
                onClick={onToggle}
                variant="ghost"
                size="icon"
                className="h-8 w-8"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Description and Intervention Coverage */}
            <div className="px-6 py-4 border-b border-border-color/30">
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                Compare metrics between baseline and intervention scenarios side by side.
              </p>
              <div className="flex items-center gap-4">
                <p className="text-xs text-muted-foreground">Intervention coverage</p>
                <div className="flex-1 h-2 bg-muted-bg rounded-full overflow-hidden">
                  <div className="h-full w-3/4 bg-gradient-to-r from-violet to-green rounded-full" />
                </div>
              </div>
            </div>

            {/* KPI Comparison Cards */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <h3 className="text-sm font-bold text-foreground mb-4">KPI Comparison: Baseline vs Intervention</h3>
              <div className="space-y-4">
                {comparisonKPIs.map((kpiId) => {
                  const kpiDef = ELABORATOR_KPIS.find((k) => k.id === kpiId);
                  const kpiValue = cityData?.kpiData[kpiId];
                  if (!kpiDef || !kpiValue) return null;

                  const baseline = getBaselineValue(kpiId);
                  const intervention = getInterventionValue(kpiId);
                  const change = kpiValue.change || 0;
                  const maxValue = Math.max(baseline, intervention, 100);
                  const baselinePercent = (baseline / maxValue) * 100;
                  const interventionPercent = (intervention / maxValue) * 100;

                  return (
                    <div
                      key={kpiId}
                      className="bg-muted-bg/50 rounded-xl p-4 border border-border-color/30 hover:border-violet/50 transition-colors"
                    >
                      <p className="text-xs text-muted-foreground mb-1">{kpiDef.ref}</p>
                      <p className="text-sm font-semibold text-foreground mb-3">{kpiDef.shortName}</p>
                      <div className="space-y-3">
                        {/* Baseline */}
                        <div>
                          <p className="text-[10px] text-muted-foreground mb-1">Baseline</p>
                          <div className="h-8 bg-border-color/50 rounded relative overflow-hidden">
                            <div
                              className="absolute bottom-0 left-0 right-0 bg-muted-foreground/40 rounded"
                              style={{ height: `${baselinePercent}%` }}
                            />
                          </div>
                          <p className="text-xs font-medium text-foreground mt-1">{baseline}{kpiDef.unit === "%" ? "%" : kpiDef.unit === "⭐" ? "⭐" : ""}</p>
                        </div>
                        {/* Intervention */}
                        <div>
                          <p className="text-[10px] text-muted-foreground mb-1">Intervention</p>
                          <div className="h-8 bg-border-color/50 rounded relative overflow-hidden">
                            <div
                              className="absolute bottom-0 left-0 right-0 bg-violet rounded"
                              style={{ height: `${interventionPercent}%` }}
                            />
                          </div>
                          <p className="text-xs font-medium text-foreground mt-1">{intervention}{kpiDef.unit === "%" ? "%" : kpiDef.unit === "⭐" ? "⭐" : ""}</p>
                        </div>
                        {/* Change */}
                        <div className={`text-xs font-bold px-2 py-1 rounded text-center ${
                          change > 0 
                            ? 'text-green bg-green/20' 
                            : change < 0 
                            ? 'text-red-500 bg-red-500/20' 
                            : 'text-muted-foreground bg-muted-bg'
                        }`}>
                          {change > 0 ? '+' : ''}{change}{kpiDef.unit === "%" ? "%" : kpiDef.unit === "⭐" ? "" : ""}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ComparisonPanel;
