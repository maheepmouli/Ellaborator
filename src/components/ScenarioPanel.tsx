import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { CITY_DATA, ELABORATOR_KPIS } from "@/data/kpiDefinitions";
import { getKpiFrameworkConfig } from "@/config/kpiFramework";
import { getKpiDefinition } from "@/config/kpiDefinitions";
import { getPilotById } from "@/data/pilotDefinitions";
import { useLocalCityData } from "@/hooks/use-local-city-data";
import { isCopenhagenCameraKpi } from "@/data/copenhagenCameraSites";
import { useCopenhagenEmissions } from "@/hooks/use-copenhagen-emissions";
import { resolveKpiProvenance, provenanceConfidenceLine } from "@/lib/kpiProvenance";
import { formatConfidenceLine } from "@/lib/kpiMissingDataMessage";
import { DataProvenanceBadge } from "@/components/DataProvenanceBadge";
import { getLocalCityDiagnostics } from "@/services/localCityData";
import { aggregateHelsinkiObservedKpi } from "@/lib/helsinkiKpiDisplay";
import type { PilotGeometryRenderSpec } from "@/lib/pilotGeometryRenderer";

interface ScenarioPanelProps {
  scenario: "baseline" | "intervention" | "comparison";
  selectedCity: string;
  selectedKpi: string;
  selectedPilotName?: string;
  selectedPilotId?: string | null;
  pilotGeometrySpec?: PilotGeometryRenderSpec | null;
  dataQualitySummary?: {
    confidence?: "High" | "Medium" | "Low";
    provenanceType?: string;
    dataType?: string;
    recordsLabel?: string;
  } | null;
  manifestAvailable?: boolean;
  onClose: () => void;
}

const ScenarioPanel = ({
  scenario,
  selectedCity,
  selectedKpi,
  selectedPilotName,
  selectedPilotId,
  pilotGeometrySpec = null,
  dataQualitySummary = null,
  manifestAvailable,
  onClose,
}: ScenarioPanelProps) => {
  const cityData = CITY_DATA.find((c) => c.city === selectedCity);
  const kpiDef = ELABORATOR_KPIS.find((k) => k.id === selectedKpi);
  const kpiValue = cityData?.kpiData[selectedKpi];
  const kpiFramework = getKpiFrameworkConfig(selectedKpi);
  const kpiDefinition = getKpiDefinition(selectedKpi);
  const selectedPilot = getPilotById(selectedCity, selectedPilotId);
  const isCopenhagenMobility = selectedCity === "Copenhagen" && selectedKpi === "kpi1.2";
  const isCopenhagenCamera = selectedCity === "Copenhagen" && isCopenhagenCameraKpi(selectedKpi);
  const isHelsinkiCity = selectedCity === "Helsinki";
  const cityCenter = cityData ? { lat: cityData.lat, lon: cityData.lon } : null;
  const { data: copenhagenPoints } = useLocalCityData(
    "Copenhagen",
    selectedKpi,
    isCopenhagenCamera ? cityCenter : isCopenhagenMobility ? cityCenter : null,
    selectedPilotId,
    "intervention"
  );
  const { data: helsinkiPoints } = useLocalCityData(
    "Helsinki",
    selectedKpi,
    isHelsinkiCity ? cityCenter : null,
    selectedPilotId,
    "intervention"
  );
  const { snapshot: cphEmissions } = useCopenhagenEmissions();

  const copenhagenObserved = (() => {
    if (!isCopenhagenMobility || !copenhagenPoints?.length) return null;
    let preActive = 0;
    let postActive = 0;
    let preTotal = 0;
    let postTotal = 0;
    copenhagenPoints
      .filter((p) => p.properties?.dataOrigin === "local-city-dataset")
      .forEach((point) => {
        const mb = point.properties?.modeBreakdown as
          | {
              pre: { bike: number; pedestrian: number; motorised: number; ptw: number; total: number };
              post: { bike: number; pedestrian: number; motorised: number; ptw: number; total: number };
            }
          | undefined;
        if (!mb) return;
        preActive += Number(mb.pre.bike ?? 0) + Number(mb.pre.pedestrian ?? 0);
        postActive += Number(mb.post.bike ?? 0) + Number(mb.post.pedestrian ?? 0);
        preTotal += Number(mb.pre.total ?? 0);
        postTotal += Number(mb.post.total ?? 0);
      });
    const baseline = preTotal > 0 ? (preActive / preTotal) * 100 : 0;
    const intervention = postTotal > 0 ? (postActive / postTotal) * 100 : 0;
    return { baseline, intervention, change: intervention - baseline };
  })();

  const helsinkiObserved = (() => {
    if (!isHelsinkiCity || !helsinkiPoints?.length) return null;
    return aggregateHelsinkiObservedKpi(
      helsinkiPoints.filter((p) => p.properties?.dataOrigin === "local-city-dataset"),
      selectedKpi
    );
  })();

  if (!kpiDef || !kpiValue) return null;

  const diagnostics = getLocalCityDiagnostics(selectedCity, selectedKpi, selectedPilotId);
  const mapUsesLocalDataset = Boolean(
    copenhagenPoints?.some((p) => p.properties?.dataOrigin === "local-city-dataset") ||
      helsinkiPoints?.some((p) => p.properties?.dataOrigin === "local-city-dataset")
  );
  const provenance = resolveKpiProvenance({
    city: selectedCity,
    kpiId: selectedKpi,
    pilot: selectedPilot,
    diagnostics,
    dataQualitySummary,
    manifestAvailable,
    panelUsesObservedSlice: Boolean(copenhagenObserved || helsinkiObserved?.hasSelectedRecords),
    mapUsesLocalDataset,
    copenhagenEmissionsActive: selectedKpi === "kpi3.2" && Boolean(cphEmissions?.flows?.length),
  });

  const baselineMainValue = copenhagenObserved
    ? copenhagenObserved.baseline
    : helsinkiObserved
      ? helsinkiObserved.baselineMain
    : Math.max(0, Number(kpiValue.mainValue) - (kpiValue.change || 0));
  const interventionMainValue = copenhagenObserved
    ? copenhagenObserved.intervention
    : helsinkiObserved
      ? helsinkiObserved.interventionMain
    : Number(kpiValue.mainValue);
  const changeValue = copenhagenObserved?.change ?? helsinkiObserved?.change ?? kpiValue.change;
  const changeLabel = `${changeValue > 0 ? "+" : ""}${changeValue.toFixed(1)}${kpiDef.unit === "%" ? "pp" : ""}`;
  const methodLabel = kpiDefinition?.method || (kpiFramework?.isModelled ? "Modelled estimate" : "Observed / reported");
  const isHelsinkiObservedBeforeAfter =
    selectedCity === "Helsinki" &&
    (selectedKpi === "kpi1.2" || selectedKpi === "kpi2.1") &&
    !!helsinkiObserved;
  const isCopenhagenObservedBeforeAfter = isCopenhagenMobility;
  const temporalLabel = isHelsinkiObservedBeforeAfter || isCopenhagenObservedBeforeAfter ? "before-after" : "single-period";
  const spatialLabel =
    pilotGeometrySpec?.uncertaintyLevel === "high"
      ? "inferred"
      : pilotGeometrySpec?.labelStyle === "aggregate"
        ? "aggregate"
        : pilotGeometrySpec?.interactionModel === "dashboard_only"
          ? "contextual"
          : "exact";
  const spatialDetail =
    pilotGeometrySpec?.reductionCaption ??
    (pilotGeometrySpec?.uncertaintyLevel === "high"
      ? "Location inferred or network-level — not street-precise"
      : undefined);

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
        <div className="relative px-6 pb-3 flex flex-wrap gap-1.5 text-[10px] text-white/90 border-b border-white/10">
          <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/20">Spatial: {spatialLabel}</span>
          {pilotGeometrySpec?.labelStyle === "aggregate" && (
            <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-100">
              Aggregate view
            </span>
          )}
          {pilotGeometrySpec?.uncertaintyLevel === "high" && (
            <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-100">
              Spatial uncertainty
            </span>
          )}
          <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/20">Method: {isHelsinkiObservedBeforeAfter ? "derived proxy" : isCopenhagenObservedBeforeAfter ? "Observed counts by camera direction and movement category" : methodLabel}</span>
          <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/20">Temporal: {temporalLabel}</span>
          <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/20">Source: {isHelsinkiObservedBeforeAfter ? "Local" : isCopenhagenObservedBeforeAfter ? "OpenTrafficCam Excel" : provenance.sourceLabel}</span>
          <DataProvenanceBadge type={provenance.trustClass ?? provenance.headlineSource} />
        </div>

        {provenance.degradedBanner && (
          <div className="relative mx-6 mt-2 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-[10px] text-amber-100/90 leading-relaxed">
            {provenance.degradedBanner}
          </div>
        )}
        {provenance.panelMapSplit && (
          <div className="relative mx-6 mt-2 rounded-lg border border-sky-400/25 bg-sky-500/10 px-3 py-2 text-[10px] text-sky-100/90 leading-relaxed">
            Panel uses illustrative KPI figures · Map shows local observed dataset for this selection.
          </div>
        )}

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
              <p><span className="text-white font-semibold">Data Type:</span> {isHelsinkiObservedBeforeAfter ? (selectedKpi === "kpi2.1" ? "DERIVED" : "OBSERVED") : isCopenhagenObservedBeforeAfter ? "OBSERVED" : provenance.dataLabel}</p>
              <p><span className="text-white font-semibold">Source:</span> {isHelsinkiObservedBeforeAfter ? "Telraam" : isCopenhagenObservedBeforeAfter ? "OpenTrafficCam Excel" : provenance.sourceLabel}</p>
              <p><span className="text-white font-semibold">Confidence:</span> {provenanceConfidenceLine(provenance, formatConfidenceLine)}</p>
              <p><span className="text-white font-semibold">Spatial:</span> {spatialLabel}</p>
              <p><span className="text-white font-semibold">Temporal:</span> {temporalLabel}</p>
              <p><span className="text-white font-semibold">Method:</span> {isHelsinkiObservedBeforeAfter ? "Derived from Telraam flows" : isCopenhagenObservedBeforeAfter ? "Observed counts by camera direction and movement category" : methodLabel}</p>
              {spatialDetail && <p><span className="text-white font-semibold">Note:</span> {spatialDetail}</p>}
              {spatialLabel === "inferred" && !spatialDetail && <p><span className="text-white font-semibold">Note:</span> Location inferred from network segment</p>}
              {isCopenhagenObservedBeforeAfter && (
                <p><span className="text-white font-semibold">Limitation:</span> This is not a full city-wide modal share indicator. Values represent observed directional counts at monitored camera locations.</p>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ScenarioPanel;
