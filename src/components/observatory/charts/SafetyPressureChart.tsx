import { useState } from "react";
import { motion } from "framer-motion";
import { Gauge, Activity } from "lucide-react";
import { OBS_C, obsGlassCardClass, obsGlassCardStyle } from "@/components/observatory/observatoryStyles";
import type { ObservatoryGraphicPayload } from "@/lib/observatoryGraphicTypes";

interface SafetyPressureChartProps {
  payload: ObservatoryGraphicPayload;
  compact?: boolean;
}

export function SafetyPressureChart({ payload, compact }: SafetyPressureChartProps) {
  const speed = payload.kpiValue ?? 42;
  const congestionPct = Math.round((payload.segmentGradient ?? 0.5) * 100);
  const linkedCategories = payload.likert ?? [];
  const isMockCategories = linkedCategories.length === 0;
  const categories = isMockCategories
    ? [
        { label: "Near-miss", value: 28 },
        { label: "Conflict", value: 22 },
        { label: "Speeding", value: 18 },
        { label: "Yield failure", value: 14 },
        { label: "Other", value: 10 },
      ]
    : linkedCategories;
  const maxCat = Math.max(1, ...categories.map((c) => c.value));
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const isHelsinkiHazard =
    payload.kpiId === "kpi2.1" &&
    !payload.amatSegmentSpeed &&
    !(payload.speedDiagram && payload.statCards?.length);
  const isMilanAmatSpeed =
    payload.kpiId === "kpi2.1" && payload.amatSegmentSpeed && (payload.statCards?.length ?? 0) > 0;
  const isMilanSegmentDetail =
    isMilanAmatSpeed && payload.statCards?.some((card) => card.label === "Avg speed");
  const isConflictPressureCards =
    isMilanAmatSpeed &&
    payload.statCards?.some((card) => /conflict pressure/i.test(card.label));
  const isZaragozaSpeed =
    isMilanAmatSpeed &&
    (payload.sourceLabel?.toLowerCase().includes("zaragoza") ||
      payload.sourceLabel?.toLowerCase().includes("comparativa") ||
      payload.sourceLabel?.toLowerCase().includes("ayzg") ||
      payload.sourceLabel?.toLowerCase().includes("romareda") ||
      payload.sourceLabel?.toLowerCase().includes("school") ||
      payload.sourceLabel?.toLowerCase().includes("hospital") ||
      isConflictPressureCards);

  return (
    <div className={obsGlassCardClass(compact)} style={obsGlassCardStyle()}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="text-[11px] font-semibold text-white/70">
          {isHelsinkiHazard && !isMilanAmatSpeed
            ? "Hazard-type pressure (interactive)"
            : isMilanAmatSpeed
              ? isZaragozaSpeed
                ? isConflictPressureCards
                  ? "School corridor conflict"
                  : isMilanSegmentDetail
                    ? "Corridor speeds"
                    : "Corridor speed network"
                : isMilanSegmentDetail
                  ? "AMAT segment speeds"
                  : "AMAT speed network"
              : payload.kpiId === "kpi4.2"
                ? "DSS accessibility"
                : "Safety / flow pressure"}
        </p>
        {isMockCategories && !isMilanAmatSpeed ? (
          <span className="rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-violet-100 bg-violet-500/30 border border-violet-300/35">
            Mock plot
          </span>
        ) : null}
      </div>

      {isMilanAmatSpeed && payload.statCards ? (
        <>
          <div className={`grid grid-cols-2 gap-2 ${compact ? "mb-2" : "mb-3"}`}>
            {payload.statCards.slice(0, 4).map((card) => (
              <div key={card.label} className="rounded-lg border p-2" style={{ borderColor: OBS_C.border }}>
                <p className="text-[9px] uppercase tracking-wide text-white/45 truncate">{card.label}</p>
                <p className="text-lg font-bold" style={{ color: card.color ?? OBS_C.cyan }}>
                  {card.value}
                </p>
                {card.note ? <p className="text-[9px] text-white/40 mt-0.5">{card.note}</p> : null}
              </div>
            ))}
          </div>
          <p className="text-[9px] text-white/45 leading-relaxed">
            {isZaragozaSpeed
              ? "Corridor speed / conflict pressure from Zaragoza Comparativa KPIs, school monitoring, and manual counts. Green delta = calmer after."
              : "Observed speeds from AMAT Maggio 2025 metric DBF joined to network.shp by segment ID (BS_Id). Values are partner measurements — not a derived congestion or speed proxy."}
          </p>
        </>
      ) : payload.kpiId === "kpi4.2" && payload.statCards?.length ? (
        <div className={`grid grid-cols-2 gap-2 ${compact ? "mb-2" : "mb-3"}`}>
          {payload.statCards.slice(0, 4).map((card) => (
            <div key={card.label} className="rounded-lg border p-2" style={{ borderColor: OBS_C.border }}>
              <p className="text-[9px] uppercase tracking-wide text-white/45 truncate">{card.label}</p>
              <p className="text-lg font-bold" style={{ color: card.color ?? OBS_C.cyan }}>
                {card.value}
              </p>
              {card.note ? <p className="text-[9px] text-white/40 mt-0.5">{card.note}</p> : null}
            </div>
          ))}
        </div>
      ) : (
        <div className={`space-y-2 ${compact ? "mb-2" : "mb-3"}`}>
          {categories.slice(0, compact ? 5 : 8).map((row) => {
            const isActive = activeLabel === row.label;
            return (
              <button
                key={row.label}
                type="button"
                onClick={() => setActiveLabel(isActive ? null : row.label)}
                className="w-full text-left rounded-md px-1 py-1 transition-colors"
                style={{
                  background: isActive ? "rgba(255,255,255,0.06)" : "transparent",
                  outline: isActive ? `1px solid ${OBS_C.cyan}55` : "none",
                }}
              >
                <div className="flex justify-between text-[10px] text-white/50 mb-0.5 gap-2">
                  <span className="text-white/75 font-medium truncate">{row.label}</span>
                  <span className="shrink-0">{row.value.toFixed(0)}</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: OBS_C.border }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      background: isActive
                        ? `linear-gradient(90deg, ${OBS_C.violet}, ${OBS_C.cyan})`
                        : `linear-gradient(90deg, ${OBS_C.violet}, ${OBS_C.amber})`,
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${(row.value / maxCat) * 100}%` }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                  />
                </div>
              </button>
            );
          })}
          {activeLabel ? (
            <p className="text-[9px] text-white/45 pt-0.5">
              Selected: {activeLabel} · relative intensity vs top hazard type
            </p>
          ) : null}
          {!isHelsinkiHazard && isMockCategories ? (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="rounded-lg border p-2" style={{ borderColor: OBS_C.border }}>
                <div className="flex items-center gap-1.5 text-[10px] text-white/50 mb-1">
                  <Gauge className="h-3 w-3" /> Speed proxy
                </div>
                <p className="text-lg font-bold" style={{ color: OBS_C.cyan }}>
                  {Number(speed || 42).toFixed(1)}
                </p>
                <p className="text-[9px] text-white/40">km/h equivalent</p>
              </div>
              <div className="rounded-lg border p-2" style={{ borderColor: OBS_C.border }}>
                <div className="flex items-center gap-1.5 text-[10px] text-white/50 mb-1">
                  <Activity className="h-3 w-3" /> Congestion
                </div>
                <p className="text-lg font-bold" style={{ color: OBS_C.amber }}>
                  {congestionPct}%
                </p>
                <p className="text-[9px] text-white/40">pressure index</p>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {isHelsinkiHazard && !isMilanAmatSpeed && payload.statCards?.length ? (
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {payload.statCards.slice(0, 4).map((card) => (
            <div
              key={card.label}
              className="rounded-md border px-1.5 py-1"
              style={{ borderColor: OBS_C.border }}
            >
              <p className="text-[8px] uppercase tracking-wide text-white/40 truncate">{card.label}</p>
              <p className="text-[12px] font-semibold" style={{ color: card.color ?? OBS_C.cyan }}>
                {card.value}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
