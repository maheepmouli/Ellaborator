import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Camera, ArrowRight, Activity, BarChart3, Database } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, Tooltip as RechTooltip, XAxis, YAxis } from "recharts";
import { useLocalCityData } from "@/hooks/use-local-city-data";
import { getLocalCityDiagnostics } from "@/services/localCityData";
import { CITY_DATA } from "@/data/kpiDefinitions";
import type { MapScenario } from "@/context/MapIntelligenceContext";
import { areAllTravelModesSelected } from "@/lib/travelModeMapLink";

type ModeBreakdown = {
  pre: { bike: number; pedestrian: number; motorised: number; ptw: number; total: number };
  post: { bike: number; pedestrian: number; motorised: number; ptw: number; total: number };
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  selectedKpi: string;
  scenario: MapScenario;
  selectedModeTypes: string[];
  selectedDirectionId?: string | null;
  onSelectDirectionId?: (id: string) => void;
  selectedPilotId?: string | null;
}

const C = {
  panel: "rgba(8,7,22,0.97)",
  border: "rgba(255,255,255,0.11)",
  glass: "rgba(255,255,255,0.055)",
  text: "rgba(255,255,255,0.82)",
  muted: "rgba(255,255,255,0.50)",
  cyan: "#63ccff",
  lime: "#b0edba",
  violet: "#8578c3",
};

function clampPercent(v: number): number {
  return Math.max(0, Math.min(100, v));
}

function pct(part: number, total: number): number {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return 0;
  return (part / total) * 100;
}

function selectedCount(b: ModeBreakdown["post"], modes: string[]): number {
  const hasAny = modes.length > 0 && !areAllTravelModesSelected(modes);
  if (!hasAny) return b.bike + b.pedestrian;
  let total = 0;
  if (modes.includes("Cycle")) total += b.bike;
  if (modes.includes("Pedestrian")) total += b.pedestrian;
  if (modes.includes("Private Car") || modes.includes("Public Transport")) total += b.motorised;
  if (modes.includes("PTW")) total += b.ptw;
  return total;
}

function badge(label: string) {
  return (
    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] text-white/80"
      style={{ borderColor: C.border, background: C.glass }}>
      {label}
    </span>
  );
}

function selectedModeLabel(modes: string[]): string {
  if (!modes.length || areAllTravelModesSelected(modes)) {
    return "Bicycle + pedestrian categories";
  }
  return modes.join(", ");
}

export default function CopenhagenObservatoryPanel({
  isOpen,
  onClose,
  selectedKpi,
  scenario,
  selectedModeTypes,
  selectedDirectionId,
  onSelectDirectionId,
  selectedPilotId,
}: Props) {
  const isEnvironmental = selectedKpi === "kpi3.2";
  const isMobility = selectedKpi === "kpi1.2";
  const center = CITY_DATA.Copenhagen
    ? { lat: CITY_DATA.Copenhagen.lat, lon: CITY_DATA.Copenhagen.lon }
    : null;
  const { data: points } = useLocalCityData(
    "Copenhagen",
    selectedKpi,
    center,
    selectedPilotId,
    "intervention"
  );
  const diagnostics = getLocalCityDiagnostics("Copenhagen", selectedKpi, selectedPilotId);

  const rows = useMemo(() => {
    const source = (points || []).filter((p) => p.properties?.dataOrigin === "local-city-dataset");
    return source
      .map((p) => {
        const props = p.properties || {};
        const mb = props.modeBreakdown as ModeBreakdown | undefined;
        if (!mb) return null;
        const id = String(props.segmentId || props.id || p.id);
        const site = String(props.streetName || "Copenhagen camera");
        const direction = String(props.direction || props.mode || "Direction n/a");
        const preActive = mb.pre.bike + mb.pre.pedestrian;
        const postActive = mb.post.bike + mb.post.pedestrian;
        const selectedPost = selectedCount(mb.post, selectedModeTypes || []);
        const selectedPre = selectedCount(mb.pre, selectedModeTypes || []);
        const baselineMobility = pct(selectedPre, mb.pre.total);
        const interventionMobility = pct(selectedPost, mb.post.total);
        const envFrom = (b: ModeBreakdown["pre"] | ModeBreakdown["post"]) => {
          const total = Math.max(1, b.total);
          const motorPct = ((b.motorised + b.ptw) / total) * 100;
          return clampPercent(motorPct * 0.7 + clampPercent((total / 250) * 100) * 0.3);
        };
        const baselinePct = isEnvironmental ? envFrom(mb.pre) : baselineMobility;
        const interventionPct = isEnvironmental ? envFrom(mb.post) : interventionMobility;
        const delta = interventionPct - baselinePct;
        return {
          id,
          site,
          direction,
          mb,
          baselinePct,
          interventionPct,
          delta,
          scenarioValue:
            scenario === "baseline"
              ? baselinePct
              : scenario === "comparison"
                ? delta
                : interventionPct,
          trend: [
            { t: "Pre", v: baselinePct },
            { t: "Mid", v: (baselinePct + interventionPct) / 2 },
            { t: "Post", v: interventionPct },
          ],
          selectedPre,
          selectedPost,
          preActive,
          postActive,
        };
      })
      .filter((r): r is NonNullable<typeof r> => !!r)
      .sort((a, b) => b.scenarioValue - a.scenarioValue);
  }, [points, scenario, selectedModeTypes, isEnvironmental]);

  const selected = rows.find((r) => r.id === selectedDirectionId) || rows[0];
  const strictModeFilterActive = isMobility && selectedModeTypes.length > 0 && !areAllTravelModesSelected(selectedModeTypes);
  const hasSelectedModeRecords = rows.some((r) => r.selectedPre > 0 || r.selectedPost > 0);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          initial={{ x: 420, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 420, opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 260 }}
          className="fixed right-4 top-24 z-[75] w-[min(460px,calc(100vw-24px))] rounded-2xl border p-4"
          style={{ background: C.panel, borderColor: C.border, color: C.text }}
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-white/55 uppercase tracking-wider">Copenhagen Mobility Observatory</p>
              <h3 className="text-sm font-semibold text-white">
                {isEnvironmental ? "KPI Preview" : "Directional mobility observations"}
              </h3>
              <p className="text-[11px] text-white/60">
                {isEnvironmental
                  ? "Not available yet for demo presentation."
                  : "OpenTrafficCam pre/post directional observations supporting KPI1.2"}
              </p>
            </div>
            <button onClick={onClose} className="rounded p-1 text-white/70 hover:bg-white/10 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>

          {selectedKpi === "kpi4.2" ? (
            <div className="rounded-xl border p-3 text-[12px] leading-relaxed" style={{ borderColor: C.border, background: C.glass }}>
              <div className="mb-2 flex items-center gap-2 text-white/85"><Database className="h-4 w-4" />Observed accessibility dataset unavailable</div>
              <p className="text-white/70">
                KPI4.2 is not computed for Copenhagen because no observed accessibility dataset is currently linked.
              </p>
              <p className="mt-2 text-white/60">
                Available observed datasets: OpenTrafficCam directional mobility counts (pre/post) for KPI1.2/KPI2.1/KPI3.2 context.
              </p>
              <p className="mt-2 text-white/60">
                Required for KPI4.2 support: observed accessibility audits (e.g. barrier-free network, curb ramps, crossing accessibility, sidewalk quality, POI accessibility), geocoded to corridor segments with pre/post coverage.
              </p>
            </div>
          ) : strictModeFilterActive && !hasSelectedModeRecords ? (
            <div className="rounded-xl border p-3 text-[12px] leading-relaxed" style={{ borderColor: C.border, background: C.glass }}>
              <div className="mb-2 flex items-center gap-2 text-white/85"><Database className="h-4 w-4" />No observed directional mobility records for the selected configuration.</div>
              <p className="text-white/70">
                The selected mode filter has no observed OpenTrafficCam records in the current directional camera dataset.
              </p>
              <p className="mt-2 text-white/60">
                Try another mode or re-enable all categories to view directional mobility observations.
              </p>
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-xl border p-3 text-[12px] leading-relaxed" style={{ borderColor: C.border, background: C.glass }}>
              <div className="mb-2 flex items-center gap-2 text-white/85"><Database className="h-4 w-4" />{
                diagnostics?.reason === "files-unavailable"
                  ? "Observed directional source unavailable"
                  : "No observed directional mobility records for the selected configuration."
              }</div>
              <p className="text-white/70">
                {diagnostics?.reason === "files-unavailable"
                  ? (diagnostics.message || "One or more required OpenTrafficCam directional files could not be loaded at runtime.")
                  : diagnostics?.reason === "pilot-scope-empty"
                    ? "The selected pilot scope has no directional camera rows for the current KPI and scenario."
                    : "No observed directional mobility records were found for the current configuration."}
              </p>
              {diagnostics?.reason === "files-unavailable" && diagnostics.missingFiles?.length ? (
                <p className="mt-2 text-white/60">
                  Missing files: {diagnostics.missingFiles.map((file) => file.split("/").pop()).join(", ")}
                </p>
              ) : (
                <p className="mt-2 text-white/60">
                  Available observed directional mobility datasets: KPI1.2 (primary), with directional pre/post camera counts.
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {badge(isEnvironmental ? "Derived" : "OBSERVED")}
                {badge("PRE/POST DIRECTIONAL COMPARISON")}
                {badge(isEnvironmental ? "Modelled field" : "DIRECTIONAL COUNTS")}
                {badge(isEnvironmental ? "Environmental intensity" : "CAMERA-BASED")}
              </div>

              {selected ? (
                <div className="mb-3 rounded-xl border p-3" style={{ borderColor: C.border, background: C.glass }}>
                  <div className="mb-2 flex items-center gap-2 text-white">
                    <Camera className="h-4 w-4" />
                    <span className="text-sm font-medium">{selected.site}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-white/60" />
                    <span className="text-[12px] text-white/75">{selected.direction}</span>
                  </div>
                  <p className="text-[11px] text-white/70 mb-2">
                    Selected mode: <span className="text-white/90">{selectedModeLabel(selectedModeTypes)}</span>
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-[11px]">
                    <div className="rounded-lg border p-2" style={{ borderColor: C.border }}>
                      <p className="text-white/55">{isEnvironmental ? "Before pressure" : "Pre observations"}</p>
                      <p className="text-sm font-semibold text-white">{selected.baselinePct.toFixed(1)}%</p>
                    </div>
                    <div className="rounded-lg border p-2" style={{ borderColor: C.border }}>
                      <p className="text-white/55">{isEnvironmental ? "Intervention pressure" : "Post observations"}</p>
                      <p className="text-sm font-semibold text-white">{selected.interventionPct.toFixed(1)}%</p>
                    </div>
                    <div className="rounded-lg border p-2" style={{ borderColor: C.border }}>
                      <p className="text-white/55">Comparison</p>
                      <p className={`text-sm font-semibold ${selected.delta >= 0 ? "text-lime-300" : "text-violet-300"}`}>
                        {selected.delta >= 0 ? "+" : ""}{selected.delta.toFixed(1)} pp
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 h-20 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={selected.trend}>
                        <XAxis dataKey="t" hide />
                        <YAxis hide domain={[0, 100]} />
                        <Line type="monotone" dataKey="v" stroke={C.cyan} strokeWidth={2} dot={false} />
                        <RechTooltip
                          contentStyle={{ background: "rgba(10,8,28,0.95)", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 10, color: "#fff" }}
                          formatter={(v: number) => [
                            `${v.toFixed(1)}%`,
                            isEnvironmental
                              ? "modelled environmental intensity"
                              : "observed directional comparison",
                          ]}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-3 space-y-1 text-[10px] text-white/65">
                    <p>Source: OpenTrafficCam Excel</p>
                    <p>Data type: observed directional counts</p>
                    <p>Geometry: exact sensor location / linked street geometry</p>
                  </div>
                </div>
              ) : (
                <div className="mb-3 rounded-xl border p-3 text-[12px] text-white/65" style={{ borderColor: C.border, background: C.glass }}>
                  No observed directional mobility records for the selected configuration.
                </div>
              )}

              <div className="max-h-[38vh] space-y-2 overflow-auto pr-1">
                {rows.map((row) => {
                  const isSelected = selectedDirectionId ? selectedDirectionId === row.id : selected?.id === row.id;
                  return (
                    <button
                      key={row.id}
                      onClick={() => onSelectDirectionId?.(row.id)}
                      className={`w-full rounded-xl border p-2 text-left transition ${
                        isSelected ? "border-cyan-300/50 bg-cyan-400/10" : "border-white/10 bg-white/[0.04] hover:bg-white/[0.08]"
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <p className="text-[12px] font-medium text-white">{row.site}</p>
                        <span className="text-[10px] text-white/55">{row.direction}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-[10px] text-white/70">
                        <span className="inline-flex items-center gap-1"><Activity className="h-3 w-3" />{isEnvironmental ? "Before pressure" : "Pre"} {row.baselinePct.toFixed(1)}%</span>
                        <span className="inline-flex items-center gap-1"><BarChart3 className="h-3 w-3" />{isEnvironmental ? "Post pressure" : "Post"} {row.interventionPct.toFixed(1)}%</span>
                        <span className={row.delta >= 0 ? "text-lime-300" : "text-violet-300"}>{row.delta >= 0 ? "+" : ""}{row.delta.toFixed(1)} pp</span>
                      </div>
                      <div className="mt-1 text-[10px] text-white/55">
                        {isEnvironmental
                          ? `Modelled from observed mobility mix: bike ${row.mb.post.bike}, pedestrian ${row.mb.post.pedestrian}, motorised ${row.mb.post.motorised}, PTW ${row.mb.post.ptw}`
                          : `Mode counts (post): bike ${row.mb.post.bike}, pedestrian ${row.mb.post.pedestrian}, motorised ${row.mb.post.motorised}, PTW ${row.mb.post.ptw}`}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

