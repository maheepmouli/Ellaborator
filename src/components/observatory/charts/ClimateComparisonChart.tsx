import { useState } from "react";
import { motion } from "framer-motion";
import { Leaf } from "lucide-react";
import { OBS_C, obsGlassCardClass, obsGlassCardStyle } from "@/components/observatory/observatoryStyles";
import type { ObservatoryGraphicPayload } from "@/lib/observatoryGraphicTypes";

interface ClimateComparisonChartProps {
  payload: ObservatoryGraphicPayload;
  compact?: boolean;
}

function toneForClimateRow(label: string): string {
  const lower = label.toLowerCase();
  if (lower.includes("positive") || lower.includes("sustainable")) return OBS_C.lime;
  if (lower.includes("negative") || lower.includes("motor") || lower.includes("car")) return "#f87171";
  if (lower.includes("neutral")) return OBS_C.amber;
  return OBS_C.cyan;
}

export function ClimateComparisonChart({ payload, compact }: ClimateComparisonChartProps) {
  const cards = payload.statCards ?? [];
  const co2Card = cards.find(
    (c) =>
      c.label.toLowerCase().includes("co₂") ||
      c.label.toLowerCase().includes("co2") ||
      c.label.toLowerCase().includes("positive climate")
  );
  const baselineCard = cards.find((c) => c.label === "Baseline");
  const congestionCard = cards.find((c) => c.label === "Congestion");
  const negativeCard = cards.find((c) => c.label.toLowerCase().includes("negative"));
  const shareRows = payload.modeShare ?? [];
  const maxShare = Math.max(1, ...shareRows.flatMap((r) => [r.before, r.after]));
  const [activeMode, setActiveMode] = useState<string | null>(null);
  const [hoverMode, setHoverMode] = useState<string | null>(null);

  return (
    <div
      className={`${obsGlassCardClass(compact)} relative z-10 pointer-events-auto`}
      style={obsGlassCardStyle()}
    >
      <p className="text-[11px] font-semibold text-white/70 mb-3 flex items-center gap-1.5">
        <Leaf className="h-3.5 w-3.5" /> Environmental comparison
      </p>
      <div className="grid grid-cols-3 gap-2 text-center">
        {co2Card && (
          <div className="rounded-lg border p-2" style={{ borderColor: OBS_C.border }}>
            <p className="text-[9px] text-white/45">
              {co2Card.label.toLowerCase().includes("positive") ? "Positive" : "Intervention"}
            </p>
            <p className="text-sm font-bold" style={{ color: OBS_C.lime }}>
              {co2Card.value}
            </p>
          </div>
        )}
        {baselineCard && (
          <div className="rounded-lg border p-2" style={{ borderColor: OBS_C.border }}>
            <p className="text-[9px] text-white/45">Baseline</p>
            <p className="text-sm font-bold text-white/80">{baselineCard.value}</p>
          </div>
        )}
        {(congestionCard || negativeCard) && (
          <div className="rounded-lg border p-2" style={{ borderColor: OBS_C.border }}>
            <p className="text-[9px] text-white/45">
              {negativeCard && !congestionCard ? "Negative" : "Pressure"}
            </p>
            <p className="text-sm font-bold" style={{ color: OBS_C.amber }}>
              {(congestionCard ?? negativeCard)?.value}
            </p>
          </div>
        )}
      </div>

      {!compact && shareRows.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-[9px] uppercase tracking-wide text-white/35">Climate share mix</p>
          {shareRows.map((row) => {
            const color = toneForClimateRow(row.mode);
            const width = (row.after / maxShare) * 100;
            const isActive = activeMode === row.mode;
            const isHover = hoverMode === row.mode;
            return (
              <button
                key={row.mode}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setActiveMode(isActive ? null : row.mode);
                }}
                onMouseEnter={() => setHoverMode(row.mode)}
                onMouseLeave={() => setHoverMode(null)}
                className="w-full text-left rounded-md px-1.5 py-1.5 transition-colors cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400/60"
                style={{
                  background: isActive || isHover ? "rgba(255,255,255,0.08)" : "transparent",
                  outline: isActive ? `1px solid ${color}66` : isHover ? `1px solid ${color}33` : "none",
                }}
                title={`${row.mode}: ${Number(row.after).toFixed(1)}%`}
              >
                <div className="flex justify-between text-[10px] text-white/50 mb-1 gap-2">
                  <span className="text-white/80 font-medium truncate">{row.mode}</span>
                  <span className="shrink-0">{Number(row.after).toFixed(1)}%</span>
                </div>
                <div
                  className="h-2.5 rounded-full overflow-hidden pointer-events-none"
                  style={{ background: OBS_C.border }}
                >
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: color }}
                    initial={false}
                    animate={{ width: `${width}%` }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {payload.dataClass !== "observed" && (
        <p className="text-[9px] text-amber-200/80 mt-2">Derived proxy — not measured emissions.</p>
      )}
      {payload.kpiId === "kpi3.2" && payload.sourceLabel?.toLowerCase().includes("helsinki") && (
        <p className="text-[9px] text-white/40 mt-2">
          Perception + motor-intensity proxies — not ambient CO₂.
        </p>
      )}
    </div>
  );
}
