import { useState } from "react";
import { motion } from "framer-motion";
import { MODE_COLORS, OBS_C, obsGlassCardClass, obsGlassCardStyle } from "@/components/observatory/observatoryStyles";
import type { ObservatoryGraphicPayload } from "@/lib/observatoryGraphicTypes";

interface ModeShareBarChartProps {
  payload: ObservatoryGraphicPayload;
  compact?: boolean;
  onSelectMode?: (mode: string | null) => void;
  /** Fires on row hover (and clears on leave) for map / parent sync. */
  onHoverMode?: (mode: string | null) => void;
}

function colorForMode(mode: string): string {
  if (MODE_COLORS[mode]) return MODE_COLORS[mode];
  const lower = mode.toLowerCase();
  if (lower.includes("walk") || lower.includes("ped")) return OBS_C.lime;
  if (lower.includes("scooter")) return OBS_C.amber;
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

export function ModeShareBarChart({
  payload,
  compact,
  onSelectMode,
  onHoverMode,
}: ModeShareBarChartProps) {
  const linkedRows = payload.modeShare ?? [];
  const isEmptyFallback = linkedRows.length === 0;
  const isMock = isEmptyFallback || payload.dataClass === "mock";
  const rows = isEmptyFallback
    ? [
        { mode: "Pedestrian", before: 16, after: 18 },
        { mode: "Cycle", before: 10, after: 12 },
        { mode: "Public Transport", before: 20, after: 22 },
        { mode: "Private Car", before: 46, after: 40 },
        { mode: "PTW", before: 8, after: 8 },
      ]
    : linkedRows;
  const maxVal = Math.max(1, ...rows.flatMap((r) => [r.before, r.after]));
  const fmtPct = (value: number) => `${Number(value).toFixed(1)}%`;
  const [activeMode, setActiveMode] = useState<string | null>(null);
  const [hoverMode, setHoverMode] = useState<string | null>(null);
  const externalHover = payload.highlightedMode?.trim() || null;
  const hideEndValues = payload.kpiId === "kpi4.1" || payload.kpiId === "kpi4.2";
  const isEscooterParking = rows.some((row) =>
    /pavement|cycleway|racks|outside parking|on street/i.test(row.mode)
  );

  const title =
    payload.kpiId === "kpi2.1"
      ? /crossing|cyclist|perceived|safety/i.test(rows.map((r) => r.mode).join(" "))
        ? "Perceived safety — before vs after"
        : "Safety reports by category"
      : payload.kpiId === "kpi3.2"
        ? payload.dataClass === "mock"
          ? "Climate attitude — mock (citywide proxy)"
          : "Safety-climate attitude — citywide survey"
        : payload.kpiId === "kpi4.1"
          ? /crossing|condition|maintenance|accessibility|connectivity|impression/i.test(
              rows.map((r) => r.mode).join(" ")
            ) || payload.dataClass === "mock"
            ? "Satisfaction — before vs after"
            : "Viikki UX satisfaction — by question"
          : payload.kpiId === "kpi4.2"
            ? /crossing|condition|connectivity|accessibility|impression/i.test(
                rows.map((r) => r.mode).join(" ")
              )
              ? "Accessibility — before vs after"
              : payload.dataClass === "mock"
                ? "Accessibility — before vs after"
                : "Accessibility — before vs after"
            : payload.kpiId === "kpi1.1"
              ? "Expansion readiness — monitoring vs plan"
              : payload.kpiId === "kpi3.1"
                ? "Facilities — before vs after"
                : payload.kpiId === "kpi1.2" &&
                    /park.?and.?ride|P\+R|bike uptake/i.test(payload.sourceLabel ?? "")
                  ? "Bike uptake from P+R — before vs after"
                  : isEscooterParking
                    ? "Parking observations by category"
                    : payload.kpiId === "kpi1.2" &&
                        (payload.dataClass === "mock" ||
                          /conflict|dangerous|FVH1|FVH2|near-miss|mock mode share|Kallio travel/i.test(
                            payload.sourceLabel ?? ""
                          ))
                      ? /Kallio|FVH2/i.test(payload.sourceLabel ?? "")
                        ? "Mode share — mock (Kallio travel mix)"
                        : "Mode share — mock (conflict travel mix)"
                      : payload.kpiId === "kpi1.2" &&
                          /hazard|dangerous|crossing|sidewalk|intersection|visibility|lighting|unsafe/i.test(
                            rows.map((r) => r.mode).join(" ")
                          )
                        ? "Hazard types in focused cluster"
                        : "Mode share — before vs after";

  return (
    <div
      className={`${obsGlassCardClass(compact)} relative z-10 pointer-events-auto`}
      style={obsGlassCardStyle()}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="text-[11px] font-semibold text-white/70">{title}</p>
        <div className="flex items-center gap-2">
          {isMock ? (
            <span className="rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-violet-100 bg-violet-500/30 border border-violet-300/35">
              Mock plot
            </span>
          ) : null}
          {!compact && (
          <div className="flex items-center gap-3 text-[9px] uppercase tracking-wide text-white/40">
            {/* Bars are mode-coloured; columns encode period (not cyan baseline/intervention). */}
            <span className="inline-flex items-center gap-1">
              <span
                className="inline-block h-1.5 w-3 rounded-full"
                style={{ background: "rgba(255,255,255,0.35)" }}
              />
              Baseline (left)
            </span>
            <span className="inline-flex items-center gap-1">
              <span
                className="inline-block h-1.5 w-3 rounded-full"
                style={{ background: "rgba(255,255,255,0.85)" }}
              />
              Intervention (right)
            </span>
          </div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-[1fr_1fr] gap-2 mb-1 px-0.5">
        <p className="text-[9px] uppercase tracking-wide text-white/35">Baseline</p>
        <p className="text-[9px] uppercase tracking-wide text-white/35">Intervention</p>
      </div>
      <div className="space-y-2.5">
        {rows.map((row) => {
            const color = colorForMode(row.mode);
            const beforeW = (row.before / maxVal) * 100;
            const afterW = (row.after / maxVal) * 100;
            const delta = row.after - row.before;
            const isActive = activeMode === row.mode;
            const isHover =
              hoverMode === row.mode ||
              (externalHover != null &&
                (externalHover === row.mode ||
                  row.mode.toLowerCase().includes(externalHover.toLowerCase()) ||
                  externalHover.toLowerCase().includes(row.mode.toLowerCase())));
            const isDimmed =
              (hoverMode != null || activeMode != null || externalHover != null) &&
              !isActive &&
              !isHover;
            return (
              <button
                key={row.mode}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const next = isActive ? null : row.mode;
                  setActiveMode(next);
                  onSelectMode?.(next);
                }}
                onMouseEnter={() => {
                  setHoverMode(row.mode);
                  onHoverMode?.(row.mode);
                  onSelectMode?.(row.mode);
                }}
                onMouseLeave={() => {
                  setHoverMode(null);
                  onHoverMode?.(null);
                  if (!activeMode) onSelectMode?.(null);
                  else onSelectMode?.(activeMode);
                }}
                onFocus={() => {
                  setHoverMode(row.mode);
                  onHoverMode?.(row.mode);
                }}
                onBlur={() => {
                  setHoverMode(null);
                  onHoverMode?.(null);
                }}
                title={
                  hideEndValues
                    ? row.mode
                    : `${row.mode}: ${fmtPct(row.before)} → ${fmtPct(row.after)} (${delta >= 0 ? "+" : ""}${delta.toFixed(1)} pp)`
                }
                className="w-full text-left rounded-md px-1.5 py-1.5 transition-all duration-150 cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400/60"
                style={{
                  background:
                    isActive || isHover ? "rgba(255,255,255,0.10)" : "transparent",
                  outline: isActive
                    ? `1px solid ${color}88`
                    : isHover
                      ? `1px solid ${color}55`
                      : "none",
                  opacity: isDimmed ? 0.4 : 1,
                  transform: isHover || isActive ? "translateX(2px)" : "none",
                }}
              >
                <div className="flex justify-between text-[10px] text-white/50 mb-1 gap-2">
                  <span
                    className="font-medium truncate"
                    style={{ color: isHover || isActive ? "#fff" : "rgba(255,255,255,0.8)" }}
                  >
                    {row.mode}
                  </span>
                  {!hideEndValues ? (
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
                  ) : null}
                </div>
                <div className="grid grid-cols-2 gap-2 pointer-events-none">
                  <div
                    className="h-2.5 rounded-full overflow-hidden"
                    style={{ background: OBS_C.border }}
                  >
                    <motion.div
                      className="h-full rounded-full"
                      style={{
                        background: color,
                        opacity: isHover || isActive ? 0.65 : 0.45,
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
                      style={{
                        background: color,
                        opacity: 0.95,
                        boxShadow: isHover || isActive ? `0 0 10px ${color}66` : "none",
                      }}
                      initial={false}
                      animate={{ width: `${afterW}%` }}
                      transition={{ duration: 0.35, ease: "easeOut" }}
                    />
                  </div>
                </div>
                {(isActive || isHover) && !hideEndValues && (
                  <p className="mt-1.5 text-[10px] text-white/55">
                    {row.mode}: {fmtPct(row.before)} before → {fmtPct(row.after)} after (
                    {delta >= 0 ? "+" : ""}
                    {delta.toFixed(1)} percentage points)
                  </p>
                )}
                {(isActive || isHover) && hideEndValues ? (
                  <p className="mt-1.5 text-[10px] text-white/55">{row.mode}</p>
                ) : null}
              </button>
            );
          })}
      </div>
    </div>
  );
}
