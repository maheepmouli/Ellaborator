import { useState } from "react";
import { motion } from "framer-motion";
import { Leaf } from "lucide-react";
import { OBS_C, obsGlassCardClass, obsGlassCardStyle } from "@/components/observatory/observatoryStyles";
import { emissionsIntensityToColor } from "@/lib/copenhagenEmissionsModel";
import type { ObservatoryGraphicPayload } from "@/lib/observatoryGraphicTypes";

interface ClimateComparisonChartProps {
  payload: ObservatoryGraphicPayload;
  compact?: boolean;
  /** Header strip only — Overview shows the climate mix chart instead (no duplicate map). */
  showSegmentMap?: boolean;
}

function toneForClimateRow(label: string): string {
  const lower = label.toLowerCase();
  if (lower.includes("positive") || lower.includes("sustainable")) return OBS_C.lime;
  if (lower.includes("negative") || lower.includes("motor") || lower.includes("car")) return "#f87171";
  if (lower.includes("neutral")) return OBS_C.amber;
  return OBS_C.cyan;
}

/** Compass angle for OTC direction labels on the panel segment map. */
function directionAngleDeg(flow: string, index: number, total: number): number {
  const d = flow.toLowerCase();
  const dest = d.includes("-->") ? d.split("-->").pop() ?? d : d;
  if (dest.includes("north") || dest.includes("nord")) return -90;
  if (dest.includes("east") || dest.includes("øst") || dest.includes("ost")) return 0;
  if (dest.includes("south") || dest.includes("syd")) return 90;
  if (dest.includes("west") || dest.includes("vest")) return 180;
  return -90 + (360 / Math.max(total, 1)) * index;
}

function shortFlowLabel(flow: string): string {
  const trimmed = flow.trim();
  if (trimmed.includes("-->")) {
    const parts = trimmed.split("-->").map((p) => p.trim());
    return parts[1] || parts[0] || trimmed;
  }
  return trimmed.length <= 18 ? trimmed : `${trimmed.slice(0, 16)}…`;
}

/** Mini segment map: one hub + directional intensity points (panel only). */
function EmissionsSegmentMap({
  payload,
}: {
  payload: ObservatoryGraphicPayload;
}) {
  const dirs = payload.emissionDirections ?? [];
  if (!dirs.length) return null;

  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const arm = size * 0.34;
  const [activeId, setActiveId] = useState<string | null>(dirs[0]?.id ?? null);
  const active = dirs.find((d) => d.id === activeId) ?? dirs[0];

  return (
    <div className="mt-3 rounded-lg border overflow-hidden" style={{ borderColor: OBS_C.border }}>
      <div className="flex items-center justify-between px-2.5 pt-2">
        <p className="text-[9px] uppercase tracking-wide text-white/40">Sensor segment map</p>
        <p className="text-[9px] text-white/35">{dirs.length} directions</p>
      </div>
      <div className="flex justify-center py-2">
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-label="Directional emissions segment map">
          <rect width={size} height={size} fill="#0f172a" rx="10" />
          <g aria-label="North">
            <line x1={14} y1={22} x2={14} y2={10} stroke="#ffffff55" strokeWidth="1.2" />
            <polygon points="14,6 11,12 17,12" fill="#ffffff88" />
            <text x={14} y={30} textAnchor="middle" fill="#ffffff66" fontSize="7" fontFamily="sans-serif">
              N
            </text>
          </g>
          <line x1={cx} y1={18} x2={cx} y2={size - 18} stroke="#ffffff14" strokeWidth="10" strokeLinecap="round" />
          <line x1={18} y1={cy} x2={size - 18} y2={cy} stroke="#ffffff14" strokeWidth="10" strokeLinecap="round" />
          <circle cx={cx} cy={cy} r={7} fill="#94a3b8" stroke="#ffffff" strokeWidth="1.2" />

          {dirs.map((dir, index) => {
            const angleDeg = directionAngleDeg(dir.flow, index, dirs.length);
            const rad = (angleDeg * Math.PI) / 180;
            const x = cx + Math.cos(rad) * arm;
            const y = cy + Math.sin(rad) * arm;
            const intensity = dir.interventionPct || dir.baselinePct || 0;
            const color = emissionsIntensityToColor(intensity);
            const isActive = dir.id === active?.id;
            const label = shortFlowLabel(dir.flow);
            return (
              <g
                key={dir.id}
                style={{ cursor: "pointer" }}
                onClick={() => setActiveId(dir.id)}
              >
                <line
                  x1={cx}
                  y1={cy}
                  x2={x}
                  y2={y}
                  stroke={color}
                  strokeWidth={isActive ? 2.4 : 1.4}
                  opacity={isActive ? 0.9 : 0.45}
                />
                <circle
                  cx={x}
                  cy={y}
                  r={isActive ? 9 : 7}
                  fill={color}
                  stroke="#ffffff"
                  strokeWidth={isActive ? 2 : 1.4}
                />
                <text
                  x={x}
                  y={y + (Math.sin(rad) >= 0 ? 18 : -12)}
                  textAnchor="middle"
                  fill={isActive ? "#ffffff" : "#ffffff99"}
                  fontSize="6.5"
                  fontFamily="sans-serif"
                  fontWeight={isActive ? 700 : 500}
                >
                  {label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      {active && (
        <div className="px-2.5 pb-2.5 grid grid-cols-2 gap-1.5">
          <div className="rounded-md border px-2 py-1.5" style={{ borderColor: OBS_C.border }}>
            <p className="text-[8px] text-white/40 truncate">{shortFlowLabel(active.flow)} · post</p>
            <p className="text-[11px] font-semibold" style={{ color: OBS_C.lime }}>
              {Math.round(active.postCo2GPerHour).toLocaleString()} g/h
            </p>
          </div>
          <div className="rounded-md border px-2 py-1.5" style={{ borderColor: OBS_C.border }}>
            <p className="text-[8px] text-white/40">Baseline</p>
            <p className="text-[11px] font-semibold text-white/75">
              {Math.round(active.preCo2GPerHour).toLocaleString()} g/h
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export function ClimateComparisonChart({
  payload,
  compact,
  showSegmentMap = false,
}: ClimateComparisonChartProps) {
  const cards = payload.statCards ?? [];
  const co2Card = cards.find(
    (c) =>
      c.label.toLowerCase().includes("co₂") ||
      c.label.toLowerCase().includes("co2") ||
      c.label.toLowerCase().includes("positive climate") ||
      c.label.toLowerCase().includes("modelled")
  );
  const baselineCard = cards.find((c) => c.label === "Baseline" || c.label.toLowerCase().includes("baseline"));
  const congestionCard = cards.find(
    (c) =>
      c.label === "Congestion" ||
      c.label === "Pressure" ||
      c.label.toLowerCase().includes("reduction") ||
      c.label.toLowerCase().includes("pressure")
  );
  const negativeCard = cards.find((c) => c.label.toLowerCase().includes("negative"));
  const shareRows = payload.modeShare ?? [];
  const maxShare = Math.max(1, ...shareRows.flatMap((r) => [r.before, r.after]));
  const [activeMode, setActiveMode] = useState<string | null>(null);
  const [hoverMode, setHoverMode] = useState<string | null>(null);
  const hasSegmentMap = showSegmentMap && (payload.emissionDirections?.length ?? 0) > 0;

  // Header: segment map only. Overview: Intervention / Baseline / Pressure + climate share mix.
  if (hasSegmentMap) {
    return (
      <div
        className={`${obsGlassCardClass(compact)} relative z-10 pointer-events-auto w-full`}
        style={obsGlassCardStyle()}
      >
        <p className="text-[11px] font-semibold text-white/70 mb-1 flex items-center gap-1.5">
          <Leaf className="h-3.5 w-3.5" /> Sensor segment map
        </p>
        <EmissionsSegmentMap payload={payload} />
        {payload.dataClass !== "observed" && (
          <p className="text-[9px] text-amber-200/80 mt-2">Derived proxy — not measured emissions.</p>
        )}
      </div>
    );
  }

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
