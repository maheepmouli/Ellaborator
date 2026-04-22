import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { CITY_DATA, ELABORATOR_KPIS } from "@/data/kpiDefinitions";
import { getKpiFrameworkConfig } from "@/config/kpiFramework";
import { getKpiDefinition } from "@/config/kpiDefinitions";

interface ScenarioPanelProps {
  scenario: "baseline" | "intervention" | "comparison";
  selectedCity: string;
  selectedKpi: string;
  selectedPilotName?: string;
  onClose: () => void;
}

const ScenarioPanel = ({
  scenario,
  selectedCity,
  selectedKpi,
  selectedPilotName,
  onClose,
}: ScenarioPanelProps) => {
  const cityData = CITY_DATA.find((c) => c.city === selectedCity);
  const kpiDef = ELABORATOR_KPIS.find((k) => k.id === selectedKpi);
  const kpiValue = cityData?.kpiData[selectedKpi];
  const kpiFramework = getKpiFrameworkConfig(selectedKpi);
  const kpiDefinition = getKpiDefinition(selectedKpi);

  if (!kpiDef || !kpiValue) return null;

  const baselineMainValue = Math.max(0, Number(kpiValue.mainValue) - (kpiValue.change || 0));
  const interventionMainValue = Number(kpiValue.mainValue);

  const changeLabel = `${kpiValue.change > 0 ? "+" : ""}${kpiValue.change}${kpiDef.unit === "%" ? "pp" : ""}`;
  const methodLabel = kpiDefinition?.method || (kpiFramework?.isModelled ? "Modelled estimate" : "Observed / reported");
  const typeLabel = kpiFramework?.isMock ? "Mock" : "Estimated";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-[linear-gradient(165deg,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0.07)_45%,rgba(255,255,255,0.04)_100%)] backdrop-blur-[30px] border-t border-white/35 shadow-[0_-8px_40px_rgba(10,10,45,0.35)]"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_75%_at_10%_0%,rgba(255,255,255,0.28)_0%,rgba(255,255,255,0.06)_45%,rgba(255,255,255,0)_80%)]" />
        <div className="pointer-events-none absolute inset-[1px] border border-white/15" />
        {/* Header */}
        <div className="relative flex items-center justify-between px-6 py-4 border-b border-white/15">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold text-white">
              KPI Data Summary — {kpiDefinition?.name || (kpiFramework?.displayName || kpiDef.shortName)}
            </h2>
            <span className="px-3 py-1 text-xs font-medium bg-violet/20 text-violet rounded-full">
              {selectedPilotName ? `${selectedCity}, ${selectedPilotName}` : selectedCity}
            </span>
            {kpiDef && (
              <span className="px-3 py-1 text-xs font-medium bg-muted-bg/70 text-white rounded-full">
                {kpiDef.ref} · {kpiFramework?.displayName || kpiDef.shortName}
              </span>
            )}
            <span className="px-3 py-1 text-xs font-medium bg-muted-bg/70 text-white/80 rounded-full">
              {scenario === "baseline" ? "Baseline" : scenario === "intervention" ? "Intervention" : "Comparison"}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted-bg transition-colors"
          >
            <X className="h-5 w-5 text-white/80" />
          </button>
        </div>

        {/* Content */}
        <div className="relative px-6 py-5 max-h-[50vh] overflow-y-auto space-y-4">
          <div className="bg-white/[0.06] backdrop-blur-2xl rounded-xl border border-white/25 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]">
            <p className="text-xs text-white/80 mb-1">KPI Data Summary</p>
            <div className="grid grid-cols-3 gap-3 text-white">
              <p className="text-sm"><span className="block text-[10px] text-white/70">Baseline</span><span className="font-bold">{baselineMainValue}{kpiValue.unit}</span></p>
              <p className="text-sm"><span className="block text-[10px] text-white/70">Intervention</span><span className="font-bold">{interventionMainValue}{kpiValue.unit}</span></p>
              <p className="text-sm"><span className="block text-[10px] text-white/70">Change</span><span className="font-bold">{changeLabel}</span></p>
            </div>
          </div>

          <div className="bg-white/[0.06] backdrop-blur-2xl rounded-xl border border-white/25 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]">
            <p className="text-xs text-white/80 mb-2">Supporting Indicators</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {Object.entries(kpiValue.breakdown || {}).slice(0, 6).map(([name, value]) => (
                <p key={name} className="text-white">{name}: <span className="font-semibold">{value}%</span></p>
              ))}
            </div>
          </div>

          <div className="bg-white/[0.05] backdrop-blur-2xl rounded-xl border border-white/25 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]">
            <p className="text-xs font-bold text-white mb-3">Data Transparency</p>
            <div className="grid grid-cols-3 gap-3 text-[11px] text-white/80">
              <p><span className="text-white font-semibold">Source:</span> {kpiDefinition?.dataSource || "City-provided dataset"}</p>
              <p><span className="text-white font-semibold">Method:</span> {methodLabel}</p>
              <p><span className="text-white font-semibold">Type:</span> {typeLabel}</p>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ScenarioPanel;
