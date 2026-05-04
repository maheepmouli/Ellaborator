import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { CITY_DATA, ELABORATOR_KPIS } from "@/data/kpiDefinitions";
import { getKpiFrameworkConfig } from "@/config/kpiFramework";
import { getKpiDefinition } from "@/config/kpiDefinitions";
import { getPilotById } from "@/data/pilotDefinitions";

interface ScenarioPanelProps {
  scenario: "baseline" | "intervention" | "comparison";
  selectedCity: string;
  selectedKpi: string;
  selectedPilotName?: string;
  selectedPilotId?: string | null;
  onClose: () => void;
}

const ScenarioPanel = ({
  scenario,
  selectedCity,
  selectedKpi,
  selectedPilotName,
  selectedPilotId,
  onClose,
}: ScenarioPanelProps) => {
  const cityData = CITY_DATA.find((c) => c.city === selectedCity);
  const kpiDef = ELABORATOR_KPIS.find((k) => k.id === selectedKpi);
  const kpiValue = cityData?.kpiData[selectedKpi];
  const kpiFramework = getKpiFrameworkConfig(selectedKpi);
  const kpiDefinition = getKpiDefinition(selectedKpi);
  const selectedPilot = getPilotById(selectedCity, selectedPilotId);

  if (!kpiDef || !kpiValue) return null;

  const baselineMainValue = Math.max(0, Number(kpiValue.mainValue) - (kpiValue.change || 0));
  const interventionMainValue = Number(kpiValue.mainValue);

  const changeLabel = `${kpiValue.change > 0 ? "+" : ""}${kpiValue.change}${kpiDef.unit === "%" ? "pp" : ""}`;
  const methodLabel = kpiDefinition?.method || (kpiFramework?.isModelled ? "Modelled estimate" : "Observed / reported");
  const typeLabel =
    kpiFramework?.isMock
      ? "mock"
      : (kpiDefinition?.dataLabel?.toLowerCase() as "observed" | "derived" | "modelled" | undefined) ||
        (kpiFramework?.isModelled ? "modelled" : "observed");
  const isHelsinkiObservedBeforeAfter = selectedCity === "Helsinki" && (selectedKpi === "kpi1.2" || selectedKpi === "kpi2.1");
  const dataTypeLabel = isHelsinkiObservedBeforeAfter
    ? (selectedKpi === "kpi2.1" ? "derived" : "observed")
    : typeLabel;
  const temporalLabel = isHelsinkiObservedBeforeAfter ? "before-after" : "single-period";
  const spatialLabel = selectedCity === "Milan" ? "matched" : selectedCity === "Helsinki" ? "inferred" : "exact";

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
              {scenario === "baseline" ? "Baseline" : scenario === "intervention" ? "Intervention" : "comparission"}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted-bg transition-colors"
          >
            <X className="h-5 w-5 text-white/80" />
          </button>
        </div>
        <div className="relative px-6 pb-3 flex flex-wrap gap-1.5 text-[10px] text-white/90 border-b border-white/10">
          <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/20">Spatial: {selectedCity === "Milan" ? "matched" : selectedCity === "Helsinki" ? "inferred" : "exact"}</span>
          <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/20">Method: {isHelsinkiObservedBeforeAfter ? "derived proxy" : dataTypeLabel}</span>
          <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/20">Temporal: {temporalLabel}</span>
          <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/20">Source: {isHelsinkiObservedBeforeAfter ? "Local" : "API/Local"}</span>
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

          {selectedPilot && (
            <div className="bg-white/[0.06] backdrop-blur-2xl rounded-xl border border-white/25 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]">
              <p className="text-xs font-bold text-white mb-2">Pilot Context</p>
              <div className="text-[11px] text-white/85 space-y-1">
                <p><span className="text-white font-semibold">Intervention:</span> {selectedPilot.interventionType}</p>
                <p><span className="text-white font-semibold">Scale:</span> {selectedPilot.scale}</p>
                <p><span className="text-white font-semibold">Why:</span> {selectedPilot.goal}</p>
                <p><span className="text-white font-semibold">Datasets:</span> {selectedPilot.datasets.join(", ")}</p>
                <p><span className="text-white font-semibold">KPI coverage:</span> {selectedPilot.supportedKpis.join(", ")}</p>
                <p><span className="text-white font-semibold">Data completeness:</span> {selectedPilot.dataCompleteness || "partial"}</p>
              </div>
            </div>
          )}

          <div className="bg-white/[0.05] backdrop-blur-2xl rounded-xl border border-white/25 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]">
            <p className="text-xs font-bold text-white mb-3">Data Transparency</p>
            <div className="grid grid-cols-2 gap-3 text-[11px] text-white/80">
              <p><span className="text-white font-semibold">Data Type:</span> {dataTypeLabel}</p>
              <p><span className="text-white font-semibold">Source:</span> {isHelsinkiObservedBeforeAfter ? "Telraam" : (kpiDefinition?.dataSource || "City-provided dataset")}</p>
              <p><span className="text-white font-semibold">Spatial:</span> {spatialLabel}</p>
              <p><span className="text-white font-semibold">Temporal:</span> {temporalLabel}</p>
              <p><span className="text-white font-semibold">Method:</span> {isHelsinkiObservedBeforeAfter ? "Derived from Telraam flows" : methodLabel}</p>
              {spatialLabel === "inferred" && <p><span className="text-white font-semibold">Note:</span> Location inferred from network segment</p>}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ScenarioPanel;
