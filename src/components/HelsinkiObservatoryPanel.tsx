import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { CITY_DATA } from "@/data/kpiDefinitions";
import { useLocalCityData } from "@/hooks/use-local-city-data";
import { getObservatoryConfig, type ObservatoryTabId } from "@/lib/observatoryRegistry";
import { getCityPilotProfile } from "@/data/cityPilotProfiles";
import { getKpiMissingDataNotice } from "@/lib/kpiMissingDataMessage";

interface HelsinkiObservatoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedKpi: string;
  scenario: "baseline" | "intervention" | "comparison";
  selectedPilotId?: string | null;
}

function summarize(values: number[]): { min: number; max: number; avg: number } {
  if (!values.length) return { min: 0, max: 0, avg: 0 };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((s, n) => s + n, 0) / values.length;
  return { min, max, avg };
}

export default function HelsinkiObservatoryPanel({
  isOpen,
  onClose,
  selectedKpi,
  scenario,
  selectedPilotId,
}: HelsinkiObservatoryPanelProps) {
  const cityCenter = useMemo(() => {
    const row = CITY_DATA.find((c) => c.city === "Helsinki");
    return row ? { lat: row.lat, lon: row.lon } : null;
  }, []);
  const [activeTab, setActiveTab] = useState<ObservatoryTabId>("overview");
  const { data: points = [] } = useLocalCityData(
    "Helsinki",
    selectedKpi,
    cityCenter,
    selectedPilotId ?? null,
    scenario
  );

  const observatoryConfig = useMemo(
    () => getObservatoryConfig(selectedKpi, "Helsinki", selectedPilotId),
    [selectedKpi, selectedPilotId]
  );
  const pilotProfile = getCityPilotProfile(selectedPilotId);
  const values = useMemo(() => points.map((point) => point.value), [points]);
  const stats = useMemo(() => summarize(values), [values]);
  const missingNotice = useMemo(
    () =>
      getKpiMissingDataNotice("Helsinki", selectedKpi, {
        id: selectedPilotId || "hel-p1",
        name: pilotProfile?.title || "Pilot",
        datasetType: "derived",
      } as any),
    [selectedKpi, selectedPilotId, pilotProfile?.title]
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/45 backdrop-blur-sm z-[70]"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            className="fixed right-0 top-0 h-full w-full sm:w-[520px] z-[71] border-l border-white/15 bg-[rgba(10,8,28,0.95)] text-white flex flex-col"
          >
            <div className="px-5 py-4 border-b border-white/10">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wider text-white/60">Helsinki observatory</p>
                  <h2 className="text-base font-semibold mt-1">{observatoryConfig.title}</h2>
                  <p className="text-xs text-white/70 mt-1">{pilotProfile?.interventionSummary || observatoryConfig.subtitle}</p>
                </div>
                <button onClick={onClose} className="p-1.5 rounded-lg border border-white/20 hover:bg-white/10">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {observatoryConfig.tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`text-[11px] px-2.5 py-1.5 rounded-full border ${
                      activeTab === tab.id
                        ? "bg-violet/40 border-violet/60 text-white"
                        : "bg-white/5 border-white/15 text-white/80"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              {points.length === 0 && (
                <div className="rounded-xl border border-amber-400/35 bg-amber-500/10 px-3 py-3 text-xs text-amber-100/90 leading-relaxed">
                  {missingNotice || "No observed records available for this Helsinki intervention and KPI scope."}
                </div>
              )}

              {(activeTab === "overview" || activeTab === "kpiAnalysis") && (
                <div className="rounded-xl border border-white/15 bg-white/[0.04] p-3 space-y-2">
                  <p className="text-xs font-semibold text-white/85">Intervention KPI summary</p>
                  <p className="text-xs text-white/75">Observed points in scope: {points.length}</p>
                  <p className="text-xs text-white/75">Average value: {stats.avg.toFixed(1)}</p>
                  <p className="text-xs text-white/75">Range: {stats.min.toFixed(1)} to {stats.max.toFixed(1)}</p>
                </div>
              )}

              {(activeTab === "beforeAfter" || activeTab === "data") && (
                <div className="rounded-xl border border-white/15 bg-white/[0.04] p-3 space-y-2">
                  <p className="text-xs font-semibold text-white/85">Before/after and source</p>
                  <p className="text-xs text-white/75">Scenario: {scenario}</p>
                  <p className="text-xs text-white/75">Data availability: {pilotProfile?.dataAvailability || "Partial"}</p>
                  <p className="text-xs text-white/75">Primary source: Telraam and intervention-linked partner files.</p>
                </div>
              )}

              {activeTab === "methodology" && (
                <div className="rounded-xl border border-white/15 bg-white/[0.04] p-3 space-y-2">
                  <p className="text-xs font-semibold text-white/85">Methodology</p>
                  <p className="text-xs text-white/75 leading-relaxed">
                    {pilotProfile?.methodologyNotes ||
                      "Observed intervention data is compared across baseline and post periods where available; missing post datasets are surfaced explicitly."}
                  </p>
                  <p className="text-xs text-white/65 leading-relaxed">
                    No synthetic intervention locations are used. Official pilot markers are shown first, with contextual city layers faded.
                  </p>
                </div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
