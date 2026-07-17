import { useState } from "react";
import { motion } from "framer-motion";
import { MODE_COLORS, OBS_C, obsGlassCardClass, obsGlassCardStyle } from "@/components/observatory/observatoryStyles";
import type { ObservatoryGraphicPayload } from "@/lib/observatoryGraphicTypes";

interface ModeShareBarChartProps {
  payload: ObservatoryGraphicPayload;
  compact?: boolean;
}

export function ModeShareBarChart({ payload, compact }: ModeShareBarChartProps) {
  const rows = payload.modeShare ?? [];
  const maxVal = Math.max(1, ...rows.flatMap((r) => [r.before, r.after]));
  const fmtPct = (value: number) => `${Number(value).toFixed(1)}%`;
  const [activeMode, setActiveMode] = useState<string | null>(null);

  return (
    <div className={obsGlassCardClass(compact)} style={obsGlassCardStyle()}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="text-[11px] font-semibold text-white/70">Mode share — before vs after</p>
        {!compact && (
          <div className="flex items-center gap-3 text-[9px] uppercase tracking-wide text-white/40">
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-1.5 w-3 rounded-full bg-white/25" />
              Before
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-1.5 w-3 rounded-full" style={{ background: OBS_C.cyan }} />
              After
            </span>
          </div>
        )}
      </div>
      <div className="grid grid-cols-[1fr_1fr] gap-2 mb-1 px-0.5">
        <p className="text-[9px] uppercase tracking-wide text-white/35">Baseline</p>
        <p className="text-[9px] uppercase tracking-wide text-white/35">Intervention</p>
      </div>
      <div className="space-y-2.5">
        {rows.map((row) => {
          const color = MODE_COLORS[row.mode] ?? OBS_C.muted;
          const beforeW = (row.before / maxVal) * 100;
          const afterW = (row.after / maxVal) * 100;
          const delta = row.after - row.before;
          const isActive = activeMode === row.mode;
          return (
            <button
              key={row.mode}
              type="button"
              onClick={() => setActiveMode(isActive ? null : row.mode)}
              className="w-full text-left rounded-md px-1 py-1 transition-colors"
              style={{
                background: isActive ? "rgba(255,255,255,0.06)" : "transparent",
                outline: isActive ? `1px solid ${color}55` : "none",
              }}
            >
              <div className="flex justify-between text-[10px] text-white/50 mb-1">
                <span className="text-white/75 font-medium">{row.mode}</span>
                <span>
                  {fmtPct(row.before)} → {fmtPct(row.after)}
                  <span
                    className="ml-1.5"
                    style={{ color: delta >= 0 ? "#4ade80" : "#f87171" }}
                  >
                    {delta >= 0 ? "+" : ""}
                    {delta.toFixed(1)} pp
                  </span>
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="h-2.5 rounded-full overflow-hidden" style={{ background: OBS_C.border }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: `rgba(255,255,255,0.28)` }}
                    initial={{ width: 0 }}
                    animate={{ width: `${beforeW}%` }}
                    transition={{ duration: 0.45, ease: "easeOut" }}
                  />
                </div>
                <div className="h-2.5 rounded-full overflow-hidden" style={{ background: OBS_C.border }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${afterW}%` }}
                    transition={{ duration: 0.45, ease: "easeOut" }}
                  />
                </div>
              </div>
              {isActive && (
                <p className="mt-1.5 text-[10px] text-white/45">
                  {row.mode}: {fmtPct(row.before)} before → {fmtPct(row.after)} after (
                  {delta >= 0 ? "+" : ""}
                  {delta.toFixed(1)} percentage points)
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
