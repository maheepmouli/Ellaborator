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
  const speed = payload.kpiValue ?? 0;
  const congestionPct = Math.round((payload.segmentGradient ?? 0.5) * 100);
  const categories = payload.likert ?? [];
  const maxCat = Math.max(1, ...categories.map((c) => c.value));
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const isHelsinkiHazard = payload.kpiId === "kpi2.1" && categories.length > 0;

  return (
    <div className={obsGlassCardClass(compact)} style={obsGlassCardStyle()}>
      <p className="text-[11px] font-semibold text-white/70 mb-3">
        {isHelsinkiHazard ? "Hazard-type pressure (interactive)" : "Safety / flow pressure"}
      </p>

      {categories.length > 0 ? (
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
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border p-2" style={{ borderColor: OBS_C.border }}>
              <div className="flex items-center gap-1.5 text-[10px] text-white/50 mb-1">
                <Gauge className="h-3 w-3" /> Speed proxy
              </div>
              <p className="text-lg font-bold" style={{ color: OBS_C.cyan }}>
                {speed.toFixed(1)}
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
          <div className="mt-3 h-2 rounded-full overflow-hidden" style={{ background: OBS_C.border }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, congestionPct)}%`,
                background: `linear-gradient(90deg, ${OBS_C.violet}, ${OBS_C.amber})`,
              }}
            />
          </div>
        </>
      )}

      {isHelsinkiHazard && payload.statCards?.length ? (
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
