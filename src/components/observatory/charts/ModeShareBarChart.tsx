import { useState } from "react";
import { motion } from "framer-motion";
import { MODE_COLORS, OBS_C, obsGlassCardClass, obsGlassCardStyle } from "@/components/observatory/observatoryStyles";
import type { ObservatoryGraphicPayload } from "@/lib/observatoryGraphicTypes";

interface ModeShareBarChartProps {
  payload: ObservatoryGraphicPayload;
  compact?: boolean;
  onSelectMode?: (mode: string) => void;
}

function colorForMode(mode: string): string {
  if (MODE_COLORS[mode]) return MODE_COLORS[mode];
  const lower = mode.toLowerCase();
  if (lower.includes("walk") || lower.includes("ped")) return OBS_C.lime;
  if (lower.includes("cycl") || lower.includes("bike")) return OBS_C.cyan;
  if (lower.includes("car") || lower.includes("motor")) return OBS_C.lavender;
  if (lower.includes("public") || lower.includes("tram")) return OBS_C.violet;
  if (lower.includes("near") || lower.includes("accident") || lower.includes("fall")) return "#f87171";
  if (lower.includes("unsafe") || lower.includes("danger") || lower.includes("hazard")) return OBS_C.amber;
  if (lower.includes("positive")) return OBS_C.lime;
  if (lower.includes("negative")) return "#f87171";
  if (lower.includes("neutral") || lower.includes("climate")) return OBS_C.amber;
  return OBS_C.muted;
}

export function ModeShareBarChart({ payload, compact, onSelectMode }: ModeShareBarChartProps) {
  const rows = payload.modeShare ?? [];
  const maxVal = Math.max(1, ...rows.flatMap((r) => [r.before, r.after]));
  const fmtPct = (value: number) => `${Number(value).toFixed(1)}%`;
  const [activeMode, setActiveMode] = useState<string | null>(null);
  const [hoverMode, setHoverMode] = useState<string | null>(null);

  const title =
    payload.kpiId === "kpi2.1"
      ? "Hazard mix — type share of survey"
      : payload.kpiId === "kpi3.2"
        ? "Safety-climate attitude — citywide survey"
        : payload.kpiId === "kpi4.1"
          ? "Viikki UX satisfaction — by question"
          : payload.kpiId === "kpi1.1"
            ? "Expansion readiness — monitoring vs plan"
            : "Mode share — before vs after";

  return (
    <div
      className={`${obsGlassCardClass(compact)} relative z-10 pointer-events-auto`}
      style={obsGlassCardStyle()}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="text-[11px] font-semibold text-white/70">{title}</p>
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
        {rows.length === 0 ? (
          <p className="text-[10px] text-white/45 py-4 text-center">No before/after share rows linked.</p>
        ) : (
          rows.map((row) => {
            const color = colorForMode(row.mode);
            const beforeW = (row.before / maxVal) * 100;
            const afterW = (row.after / maxVal) * 100;
            const delta = row.after - row.before;
            const isActive = activeMode === row.mode;
            const isHover = hoverMode === row.mode;
            return (
              <button
                key={row.mode}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const next = isActive ? null : row.mode;
                  setActiveMode(next);
                  if (next) onSelectMode?.(next);
                }}
                onMouseEnter={() => setHoverMode(row.mode)}
                onMouseLeave={() => setHoverMode(null)}
                onFocus={() => setHoverMode(row.mode)}
                onBlur={() => setHoverMode(null)}
                title={`${row.mode}: ${fmtPct(row.before)} → ${fmtPct(row.after)} (${delta >= 0 ? "+" : ""}${delta.toFixed(1)} pp)`}
                className="w-full text-left rounded-md px-1.5 py-1.5 transition-colors cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400/60"
                style={{
                  background:
                    isActive || isHover ? "rgba(255,255,255,0.08)" : "transparent",
                  outline: isActive ? `1px solid ${color}66` : isHover ? `1px solid ${color}33` : "none",
                }}
              >
                <div className="flex justify-between text-[10px] text-white/50 mb-1 gap-2">
                  <span className="text-white/80 font-medium truncate">{row.mode}</span>
                  <span className="shrink-0">
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
                <div className="grid grid-cols-2 gap-2 pointer-events-none">
                  <div
                    className="h-2.5 rounded-full overflow-hidden"
                    style={{ background: OBS_C.border }}
                  >
                    <motion.div
                      className="h-full rounded-full"
                      style={{
                        background: isHover || isActive ? "rgba(255,255,255,0.42)" : "rgba(255,255,255,0.28)",
                      }}
                      initial={false}
                      animate={{ width: `${beforeW}%` }}
                      transition={{ duration: 0.35, ease: "easeOut" }}
                    />
                  </div>
                  <div
                    className="h-2.5 rounded-full overflow-hidden"
                    style={{ background: OBS_C.border }}
                  >
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: color, opacity: isHover || isActive ? 1 : 0.88 }}
                      initial={false}
                      animate={{ width: `${afterW}%` }}
                      transition={{ duration: 0.35, ease: "easeOut" }}
                    />
                  </div>
                </div>
                {(isActive || isHover) && (
                  <p className="mt-1.5 text-[10px] text-white/55">
                    {row.mode}: {fmtPct(row.before)} before → {fmtPct(row.after)} after (
                    {delta >= 0 ? "+" : ""}
                    {delta.toFixed(1)} percentage points)
                  </p>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
