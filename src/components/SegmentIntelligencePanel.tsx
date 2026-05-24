/**
 * SegmentIntelligencePanel
 *
 * Issy monitored corridor observatory (all study pilots) at Stalingrad / Issy study coordinates.
 * KPI 1.2 mode share: observed OD CSV at city level; corridor = traficissy segment context only.
 *
 * Coordinates: 48.829725, 2.261046
 *
 * Structure:
 *   Header  →  TabBar  →  [ Overview | Before/After | Corridor | Insights | Data ]
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ChevronRight,
  ChevronLeft,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Clock,
  MapPin,
  Radio,
  BarChart2,
  BarChart3,
  Eye,
  Layers,
  FileText,
  GitBranch,
  Bike,
  Car,
  TrendingUp,
  Gauge,
  Leaf,
  Footprints,
  type LucideIcon,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  Tooltip as RechTooltip,
  YAxis,
} from "recharts";
import { ISSY_JUNCTION_ARMS, ISSY_P2_JUNCTION } from "@/lib/issyPilot2Junction";
import {
  buildJunctionStudyView,
  pickDefaultSegment,
  type JunctionStudyView,
} from "@/lib/issyJunctionAnalytics";
import type { TrafficSegment } from "@/types/traffic";
import {
  defaultObservatoryTab,
  getObservatoryConfig,
  type ObservatoryConfig,
  type ObservatoryTabId,
} from "@/lib/observatoryRegistry";
import type { MapScenario } from "@/context/MapIntelligenceContext";
import { exportObservatoryReport } from "@/lib/exportObservatory";
import { getKpiDefinition } from "@/config/kpiDefinitions";
import {
  ISSY_JUNCTION_ARM_VISUAL_DISCLAIMER,
  ISSY_JUNCTION_KPI12_ARM_NOTE,
  ISSY_OD_CSV_DISCLAIMER,
  getIssyPilotInterventionCopy,
  segmentHasDirectKpiDataset,
  dataSourceTrustLabel,
  kpiPrimaryIssySource,
} from "@/lib/issyDataTransparency";

// ─── Palette ─────────────────────────────────────────────────────────────────
const C = {
  cyan:     "#63ccff",
  lime:     "#b0edba",
  violet:   "#657df5",
  lavender: "#8578c3",
  amber:    "#f59e0b",
  rose:     "#f43f5e",
  muted:    "rgba(255,255,255,0.40)",
  panel:    "rgba(8,7,22,0.97)",
  glass:    "rgba(255,255,255,0.055)",
  border:   "rgba(255,255,255,0.11)",
};

// Mode color map
const MODE_COLORS: Record<string, string> = {
  Pedestrian:          C.lime,
  Cycle:               C.cyan,
  "Public Transport":  C.violet,
  Car:                 C.lavender,
  PTW:                 "#a78bfa",
};

// ─── Small shared primitives ──────────────────────────────────────────────────

function GlassCard({
  children,
  className = "",
  glow,
}: {
  children: React.ReactNode;
  className?: string;
  glow?: string;
}) {
  return (
    <div
      className={`rounded-xl border ${className}`}
      style={{
        background: C.glass,
        borderColor: C.border,
        boxShadow: glow ? `0 0 18px ${glow}` : undefined,
      }}
    >
      {children}
    </div>
  );
}

function WhiteSymbol({
  icon: Icon,
  className = "h-4 w-4",
}: {
  icon: LucideIcon;
  className?: string;
}) {
  return <Icon className={`${className} text-white/75 shrink-0`} strokeWidth={1.75} aria-hidden />;
}

function Chip({
  label,
  value,
  color = C.muted,
  icon,
}: {
  label: string;
  value: string;
  color?: string;
  icon?: LucideIcon;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium border"
      style={{ background: "rgba(255,255,255,0.05)", borderColor: C.border, color }}
    >
      {icon ? <WhiteSymbol icon={icon} className="h-3 w-3" /> : null}
      <span className="text-white/40">{label}</span>
      <span>{value}</span>
    </span>
  );
}

function DeltaArrow({ value, unit = "" }: { value: number; unit?: string }) {
  const pos = value > 0;
  const zero = value === 0;
  const Icon = zero ? Minus : pos ? ArrowUpRight : ArrowDownRight;
  const color = zero ? C.muted : pos ? C.lime : C.rose;
  return (
    <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold" style={{ color }}>
      <Icon className="h-3.5 w-3.5" />
      {pos ? "+" : ""}{value}{unit}
    </span>
  );
}

// ─── Mini sparkline ───────────────────────────────────────────────────────────
function Sparkline({
  data,
  color,
}: {
  data: number[];
  color: string;
}) {
  const chartData = data.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={32}>
      <LineChart data={chartData}>
        <YAxis domain={["dataMin - 10", "dataMax + 10"]} hide />
        <Line
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={true}
          animationDuration={800}
        />
        <RechTooltip
          contentStyle={{
            background: "rgba(10,8,28,0.95)",
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            fontSize: 10,
            color: "#fff",
          }}
          formatter={(v: number) => [v, ""]}
          labelFormatter={() => ""}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ─── Tab 1 — Overview ─────────────────────────────────────────────────────────
function OverviewTab({ view }: { view: JunctionStudyView }) {
  const { baseline, intervention } = view;

  const deltaCount     = intervention.dailyCycleCount - baseline.dailyCycleCount;
  const deltaCong      = Math.round((intervention.peakCongestion - baseline.peakCongestion) * 100);
  const deltaCo2       = Math.round(((intervention.co2ProxyKgDay - baseline.co2ProxyKgDay) / baseline.co2ProxyKgDay) * 100);

  const stats = [
    {
      label: "Daily cycle trips",
      before: baseline.dailyCycleCount,
      after: intervention.dailyCycleCount,
      delta: deltaCount,
      unit: "",
      suffix: "/day",
      color: C.cyan,
      trend: intervention.trendCycle,
    },
    {
      label: "Peak congestion index",
      before: (baseline.peakCongestion * 100).toFixed(0),
      after: (intervention.peakCongestion * 100).toFixed(0),
      delta: deltaCong,
      unit: "",
      suffix: "%",
      color: C.amber,
      trend: null,
    },
    {
      label: "CO₂ proxy",
      before: `${baseline.co2ProxyKgDay}`,
      after: `${intervention.co2ProxyKgDay}`,
      delta: deltaCo2,
      unit: "%",
      suffix: " kg/day",
      color: C.lime,
      trend: null,
    },
    {
      label: "Data confidence",
      before: null,
      after: view.dataConfidence,
      delta: null,
      unit: "%",
      suffix: "%",
      color: C.violet,
      trend: null,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Segment meta */}
      <GlassCard className="px-4 py-3">
        <div className="grid grid-cols-2 gap-x-5 gap-y-2 text-[11px]">
          {[
            ["Monitored corridor", view.name],
            ["traficissy ID",   view.segmentApiId],
            ["Junction node",   view.shortName],
            ["Monitoring",      view.monitoringPeriod],
            ["Sensors active",  `${view.sensors} stations`],
            ["Context streets", `${view.approachesCovered}/${view.totalApproaches} available`],
            ["Intervention",    view.interventionType],
          ].map(([k, v]) => (
            <div key={k}>
              <p className="text-white/35 mb-0.5">{k}</p>
              <p className="text-white/85 font-medium">{v}</p>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Sensor coverage bar */}
      <div>
        <div className="flex justify-between mb-1 text-[10px] text-white/40">
          <span>Context street coverage</span>
          <span>{view.approachesCovered}/{view.totalApproaches} monitored</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: C.border }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: `linear-gradient(90deg, ${C.cyan}, ${C.violet})` }}
            initial={{ width: 0 }}
            animate={{ width: `${(view.approachesCovered / view.totalApproaches) * 100}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* KPI stat cards */}
      <div className="grid grid-cols-2 gap-2.5">
        {stats.map((s) => (
          <GlassCard key={s.label} className="px-3 py-3">
            <p className="text-[10px] text-white/40 mb-1.5 leading-tight">{s.label}</p>
            <div className="flex items-end justify-between gap-1">
              <div>
                <span className="text-xl font-bold" style={{ color: s.color }}>
                  {s.after}
                </span>
                <span className="text-[10px] text-white/40 ml-0.5">{s.suffix}</span>
              </div>
              {s.delta !== null && (
                <DeltaArrow value={s.delta} unit={s.unit} />
              )}
            </div>
            {s.trend && (
              <div className="mt-2 -mx-1">
                <Sparkline data={s.trend} color={s.color} />
              </div>
            )}
          </GlassCard>
        ))}
      </div>
    </div>
  );
}

// ─── Tab 2 — Before / After ───────────────────────────────────────────────────

function MirroredModeBar({
  mode,
  before,
  after,
  maxVal = 60,
}: {
  mode: string;
  before: number;
  after: number;
  maxVal?: number;
}) {
  const delta = after - before;
  const color = MODE_COLORS[mode] ?? C.muted;
  const beforePct = (before / maxVal) * 100;
  const afterPct  = (after / maxVal) * 100;

  return (
    <div className="grid items-center gap-0" style={{ gridTemplateColumns: "1fr 82px 1fr" }}>
      {/* Before bar — grows leftward */}
      <div className="flex items-center justify-end gap-1.5 min-w-0">
        <span className="text-[10px] text-white/40 shrink-0">{before}%</span>
        <div className="h-[18px] rounded-l-md overflow-hidden" style={{ width: `${beforePct * 0.9}%`, minWidth: 2, background: "rgba(255,255,255,0.14)" }}>
          <motion.div
            className="h-full"
            style={{ background: `rgba(${hexToRgb(color)}, 0.4)`, width: "100%", transformOrigin: "right" }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Label + delta */}
      <div className="flex flex-col items-center gap-0.5 px-1">
        <span className="text-[10px] text-white/70 text-center leading-tight whitespace-nowrap">{mode}</span>
        <DeltaArrow value={delta} unit="pp" />
      </div>

      {/* After bar — grows rightward */}
      <div className="flex items-center gap-1.5 min-w-0">
        <div className="h-[18px] rounded-r-md overflow-hidden" style={{ width: `${afterPct * 0.9}%`, minWidth: 2, background: "rgba(255,255,255,0.14)" }}>
          <motion.div
            className="h-full"
            style={{ background: color, width: "100%", transformOrigin: "left" }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
          />
        </div>
        <span className="text-[10px] text-white/40 shrink-0">{after}%</span>
      </div>
    </div>
  );
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

function TransparencyNotice({
  children,
  tone = "amber",
}: {
  children: React.ReactNode;
  tone?: "amber" | "cyan";
}) {
  const border = tone === "cyan" ? "rgba(99,204,255,0.35)" : "rgba(245,158,11,0.35)";
  const bg = tone === "cyan" ? "rgba(99,204,255,0.08)" : "rgba(245,158,11,0.08)";
  return (
    <div
      className="rounded-lg border px-3 py-2.5 text-[10px] text-white/65 leading-relaxed"
      style={{ borderColor: border, background: bg }}
    >
      {children}
    </div>
  );
}

function MobilityKpi12ArmTab({ view }: { view: JunctionStudyView }) {
  const { baseline, intervention } = view;
  return (
    <div className="space-y-4">
      <TransparencyNotice>
        <p className="font-semibold text-white/80 mb-1">Observed OD flow data (city / pilot level)</p>
        <p>{ISSY_OD_CSV_DISCLAIMER}</p>
        <p className="mt-2">{ISSY_JUNCTION_KPI12_ARM_NOTE}</p>
      </TransparencyNotice>

      <GlassCard className="px-4 py-3">
        <p className="text-[11px] font-semibold text-white/60 mb-2">
          Observed segment data — monitored intervention corridor
        </p>
        <p className="text-[10px] text-white/40 mb-3">
          Segment ID {view.segmentApiId} · traficissy API · {dataSourceTrustLabel("traficissy-segment")}
        </p>
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div>
            <p className="text-white/35 text-[10px]">Baseline (derived)</p>
            <p className="text-white/75 font-medium">{baseline.avgSpeedKmh.toFixed(1)} km/h</p>
            <p className="text-white/45">Congestion {(baseline.peakCongestion * 100).toFixed(0)}%</p>
          </div>
          <div>
            <p className="text-white/35 text-[10px]">Latest observation</p>
            <p className="text-white/75 font-medium">{intervention.avgSpeedKmh.toFixed(1)} km/h</p>
            <p className="text-white/45">Congestion {(intervention.peakCongestion * 100).toFixed(0)}%</p>
          </div>
        </div>
        <p className="text-[10px] text-white/40 mt-3 leading-snug">
          Map line weight on this monitored corridor reflects traffic context from the segment API — not modal share
          from zone_in / zone_out CSV. Open the sidebar at city zoom for zone-to-zone flow arcs and
          mode-share percentages.
        </p>
      </GlassCard>
    </div>
  );
}

function BeforeAfterTab({
  view,
  selectedKpi,
}: {
  view: JunctionStudyView;
  selectedKpi: string;
}) {
  if (selectedKpi === "kpi1.2") {
    return <MobilityKpi12ArmTab view={view} />;
  }
  const { baseline, intervention } = view;
  const modes = Object.keys(baseline.modeShare) as (keyof typeof baseline.modeShare)[];
  const maxVal = Math.max(...modes.map((m) => Math.max(baseline.modeShare[m], intervention.modeShare[m])));

  const summaryCards: Array<{
    Icon: LucideIcon;
    label: string;
    before: string;
    after: string;
    delta: number;
    unit: string;
    color: string;
  }> = [
    {
      Icon: Bike,
      label: "Cycling share",
      before: `${baseline.modeShare.Cycle}%`,
      after: `${intervention.modeShare.Cycle}%`,
      delta: intervention.modeShare.Cycle - baseline.modeShare.Cycle,
      unit: "pp",
      color: C.cyan,
    },
    {
      Icon: Car,
      label: "Car share",
      before: `${baseline.modeShare.Car}%`,
      after: `${intervention.modeShare.Car}%`,
      delta: intervention.modeShare.Car - baseline.modeShare.Car,
      unit: "pp",
      color: C.lavender,
    },
    {
      Icon: TrendingUp,
      label: "Daily cycling",
      before: `${baseline.dailyCycleCount}`,
      after: `${intervention.dailyCycleCount}`,
      delta: Math.round(((intervention.dailyCycleCount - baseline.dailyCycleCount) / baseline.dailyCycleCount) * 100),
      unit: "%",
      color: C.lime,
    },
    {
      Icon: Gauge,
      label: "Congestion index",
      before: `${(baseline.peakCongestion * 100).toFixed(0)}`,
      after: `${(intervention.peakCongestion * 100).toFixed(0)}`,
      delta: Math.round((intervention.peakCongestion - baseline.peakCongestion) * 100),
      unit: "pts",
      color: C.amber,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Period headers */}
      <div className="grid items-center gap-0" style={{ gridTemplateColumns: "1fr 82px 1fr" }}>
        <div className="text-right">
          <p className="text-[10px] font-semibold text-white/50 uppercase tracking-widest">Baseline</p>
          <p className="text-[10px] text-white/30">{baseline.period}</p>
        </div>
        <div />
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: C.cyan }}>Post-Intervention</p>
          <p className="text-[10px] text-white/30">{intervention.period}</p>
        </div>
      </div>

      {!segmentHasDirectKpiDataset(selectedKpi) && (
        <TransparencyNotice>
          No direct segment-level dataset for this KPI on the selected monitored corridor. Showing derived pilot-level
          context from traficissy speed and congestion fields.
        </TransparencyNotice>
      )}

      {/* Mirrored mode share — safety/climate proxies only; not OD CSV */}
      <GlassCard className="px-4 py-3 space-y-2.5">
        <p className="text-[11px] font-semibold text-white/60 mb-3">Derived corridor comparison (segment API)</p>
        {modes.map((mode) => (
          <MirroredModeBar
            key={mode}
            mode={mode}
            before={baseline.modeShare[mode]}
            after={intervention.modeShare[mode]}
            maxVal={maxVal + 5}
          />
        ))}
      </GlassCard>

      {/* Summary delta cards */}
      <div className="grid grid-cols-2 gap-2">
        {summaryCards.map((s) => (
          <GlassCard
            key={s.label}
            className="px-3 py-2.5"
            glow={s.delta !== 0 ? `rgba(${hexToRgb(s.color)}, 0.08)` : undefined}
          >
            <div className="flex items-start justify-between mb-1">
              <WhiteSymbol icon={s.Icon} className="h-4 w-4" />
              <DeltaArrow value={s.delta} unit={s.unit} />
            </div>
            <p className="text-[10px] text-white/40 mb-0.5">{s.label}</p>
            <div className="flex items-center gap-1 text-[11px]">
              <span className="text-white/40">{s.before}</span>
              <ChevronRight className="h-2.5 w-2.5 text-white/25" />
              <span className="font-bold" style={{ color: s.color }}>{s.after}</span>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Trend sparklines */}
      <GlassCard className="px-4 py-3">
        <p className="text-[11px] font-semibold text-white/60 mb-3">Daily counts over monitoring period</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] text-white/35 mb-1 flex items-center gap-1.5">
              <WhiteSymbol icon={Bike} className="h-3 w-3" />
              Cycling trend
            </p>
            <Sparkline data={[...baseline.trendCycle, ...intervention.trendCycle]} color={C.cyan} />
          </div>
          <div>
            <p className="text-[10px] text-white/35 mb-1 flex items-center gap-1.5">
              <WhiteSymbol icon={Car} className="h-3 w-3" />
              Car trend
            </p>
            <Sparkline data={[...baseline.trendCar, ...intervention.trendCar]} color={C.lavender} />
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

// ─── Tab 3 — Intersection schematic ──────────────────────────────────────────

function IntersectionSVG({
  expanded,
  highlightArmId,
}: {
  expanded?: boolean;
  highlightArmId?: string;
}) {
  const size    = expanded ? 260 : 200;
  const cx      = size / 2;
  const cy      = size / 2;
  const roadW   = 36;

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Intersection schematic"
    >
      {/* Background */}
      <rect width={size} height={size} fill="#06050f" rx="12" />

      {/* Subtle radial glow at center */}
      <defs>
        <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={C.cyan} stopOpacity="0.18" />
          <stop offset="100%" stopColor="transparent" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="sensorGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={C.cyan} stopOpacity="0.5" />
          <stop offset="100%" stopColor="transparent" stopOpacity="0" />
        </radialGradient>
        <filter id="blur2">
          <feGaussianBlur stdDeviation="2" />
        </filter>
        <filter id="blur4">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>

      {/* Road bodies (N-S and E-W) */}
      {/* N-S road */}
      <rect x={cx - roadW / 2} y={0} width={roadW} height={size} fill="#1a1830" />
      {/* E-W road */}
      <rect x={0} y={cy - roadW / 2} width={size} height={roadW} fill="#1a1830" />

      {/* Road center lines */}
      <line x1={cx} y1={0} x2={cx} y2={cy - roadW / 2 - 2} stroke="#ffffff18" strokeWidth="1" strokeDasharray="6 5" />
      <line x1={cx} y1={cy + roadW / 2 + 2} x2={cx} y2={size} stroke="#ffffff18" strokeWidth="1" strokeDasharray="6 5" />
      <line x1={0} y1={cy} x2={cx - roadW / 2 - 2} y2={cy} stroke="#ffffff18" strokeWidth="1" strokeDasharray="6 5" />
      <line x1={cx + roadW / 2 + 2} y1={cy} x2={size} y2={cy} stroke="#ffffff18" strokeWidth="1" strokeDasharray="6 5" />

      {/* Intersection box */}
      <rect x={cx - roadW / 2} y={cy - roadW / 2} width={roadW} height={roadW} fill="#21203c" />

      {/* Glow at center */}
      <circle cx={cx} cy={cy} r={28} fill="url(#centerGlow)" />

      {/* Movement-direction hints (derived schematic — not measured geometry) */}
      <line x1={cx} y1={cy + roadW / 2 + 8} x2={cx} y2={size - 14} stroke={C.cyan} strokeWidth="1.5" opacity="0.45" markerEnd="url(#none)" />
      <line x1={cx + roadW / 2 + 8} y1={cy} x2={size - 14} y2={cy} stroke={C.lime} strokeWidth="1.5" opacity="0.35" />

      {/* ── Pedestrian crossings ─────────────────────────────────────────── */}
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i}>
          {/* North crossing */}
          <rect x={cx - roadW / 2 + 2} y={cy - roadW / 2 - 8 + i * 2} width={roadW - 4} height={1} fill="#ffffff50" />
          {/* South crossing */}
          <rect x={cx - roadW / 2 + 2} y={cy + roadW / 2 + 1 + i * 2} width={roadW - 4} height={1} fill="#ffffff50" />
          {/* West crossing */}
          <rect x={cx - roadW / 2 - 8 + i * 2} y={cy - roadW / 2 + 2} width={1} height={roadW - 4} fill="#ffffff50" />
          {/* East crossing */}
          <rect x={cx + roadW / 2 + 1 + i * 2} y={cy - roadW / 2 + 2} width={1} height={roadW - 4} fill="#ffffff50" />
        </g>
      ))}

      {/* ── Traffic flow arrows ───────────────────────────────────────────── */}
      {/* North outbound arrow */}
      <polygon points={`${cx - 5},${cy - roadW / 2 - 18} ${cx + 5},${cy - roadW / 2 - 18} ${cx},${cy - roadW / 2 - 28}`} fill="#ffffff55" />
      {/* South inbound arrow */}
      <polygon points={`${cx - 4},${cy + roadW / 2 + 28} ${cx + 4},${cy + roadW / 2 + 28} ${cx},${cy + roadW / 2 + 18}`} fill="#ffffff55" />
      {/* East outbound arrow */}
      <polygon points={`${cx + roadW / 2 + 18},${cy - 4} ${cx + roadW / 2 + 18},${cy + 4} ${cx + roadW / 2 + 28},${cy}`} fill="#ffffff55" />
      {/* West inbound arrow */}
      <polygon points={`${cx - roadW / 2 - 28},${cy - 4} ${cx - roadW / 2 - 28},${cy + 4} ${cx - roadW / 2 - 18},${cy}`} fill="#ffffff55" />

      {/* ── Sensor positions (pulsing) ─────────────────────────────────────── */}
      {/* Sensor 1: North approach */}
      <SensorDot cx={cx - roadW / 4} cy={cy - roadW / 2 - 22} />
      {/* Sensor 2: South-East approach */}
      <SensorDot cx={cx + roadW / 4} cy={cy + roadW / 2 + 22} />
      {/* Sensor 3: East approach */}
      <SensorDot cx={cx + roadW / 2 + 22} cy={cy + roadW / 4} />

      {/* Monitored corridor emphasis without equal-weight arm labels */}
      <text x={size / 2} y={10} textAnchor="middle" fill="#9FE6FF" fontSize="7" fontFamily="sans-serif">
        Monitored intervention corridor highlighted
      </text>

      <text x={size / 2} y={size - 4} textAnchor="middle" fill="#ffffff45" fontSize="6" fontFamily="sans-serif">
        Visualized movement direction
      </text>
    </svg>
  );
}

function SensorDot({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      {/* Outer glow pulse */}
      <motion.circle
        cx={cx}
        cy={cy}
        r={8}
        fill={C.cyan}
        opacity={0}
        animate={{ opacity: [0, 0.2, 0], r: [5, 12, 5] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Inner dot */}
      <circle cx={cx} cy={cy} r={3.5} fill={C.cyan} opacity={0.9} />
      <circle cx={cx} cy={cy} r={2} fill="white" opacity={0.8} />
    </g>
  );
}

function IntersectionTab({
  view,
  pilotId,
}: {
  view: JunctionStudyView;
  pilotId?: string | null;
}) {
  const intervention = getIssyPilotInterventionCopy(pilotId);
  return (
    <div className="space-y-4">
      <TransparencyNotice tone="cyan">
        {intervention.schematicCaption}. {ISSY_JUNCTION_ARM_VISUAL_DISCLAIMER}
      </TransparencyNotice>
      <GlassCard className="px-4 py-4 flex flex-col items-center">
        <p className="text-[11px] font-semibold text-white/50 mb-3 self-start">
          Monitored intervention corridor schematic — {view.shortName}
        </p>
        <IntersectionSVG expanded highlightArmId={view.armId} />
      </GlassCard>

      <GlassCard className="px-4 py-3">
        <p className="text-[11px] font-semibold text-white/50 mb-2.5">Corridor monitoring scope</p>
        <p className="text-[11px] text-white/65 leading-relaxed">
          Active monitored intervention corridor: <span className="text-white/80 font-medium">{view.name}</span> ({view.segmentApiId}).
          Nearby traficissy segments remain visible as low-opacity contextual streets and are not analyzed as equal measured approaches.
        </p>
      </GlassCard>

      <GlassCard className="px-4 py-3">
        <p className="text-[11px] font-semibold text-white/50 mb-2">{intervention.title}</p>
        <p className="text-[11px] text-white/60 leading-relaxed">{intervention.summary}</p>
      </GlassCard>
    </div>
  );
}

// ─── Tab 4 — Insights ─────────────────────────────────────────────────────────

function InsightsTab({
  view,
  selectedKpi,
}: {
  view: JunctionStudyView;
  selectedKpi: string;
}) {
  const isMobility = selectedKpi === "kpi1.2";
  return (
    <div className="space-y-4">
      {isMobility && (
        <TransparencyNotice>
          {ISSY_OD_CSV_DISCLAIMER} Use the map at city zoom for zone-to-zone flow arcs; this monitored corridor panel
          only summarises observed traficissy segment speed and congestion.
        </TransparencyNotice>
      )}
      {/* Narrative */}
      <GlassCard className="px-4 py-4">
        <div
          className="h-1 w-10 rounded-full mb-3"
          style={{ background: `linear-gradient(90deg, ${C.cyan}, ${C.violet})` }}
        />
        <p className="text-[12px] text-white/75 leading-[1.7]">
          On the <span className="text-white font-medium">monitored intervention corridor</span> ({view.name}), the latest API
          snapshot shows <span className="text-white font-medium">{view.intervention.avgSpeedKmh.toFixed(1)} km/h</span> average
          speed and a congestion index of{" "}
          <span className="text-white font-medium">{(view.intervention.peakCongestion * 100).toFixed(0)}%</span> versus a
          derived baseline of {(view.baseline.peakCongestion * 100).toFixed(0)}%.
        </p>
        {!isMobility && (
          <p className="text-[12px] text-white/75 leading-[1.7] mt-3">
            Derived flow estimate on this monitored corridor: daily cycling proxy {view.baseline.dailyCycleCount} →{" "}
            {view.intervention.dailyCycleCount}. Environmental proxy {view.baseline.co2ProxyKgDay} →{" "}
            {view.intervention.co2ProxyKgDay} kg/day ({dataSourceTrustLabel("derived-proxy")}).
          </p>
        )}
      </GlassCard>

      {/* Key findings */}
      <GlassCard className="px-4 py-3">
        <p className="text-[11px] font-semibold text-white/50 mb-3">Key findings</p>
        <div className="space-y-2.5">
          {(
            isMobility
              ? [
                  { Icon: Bike, text: "Modal split for KPI 1.2 is computed from observed OD CSV at pilot level — not per street segment on this monitored corridor." },
                  { Icon: Gauge, text: `Observed speed on the monitored corridor: ${view.intervention.avgSpeedKmh.toFixed(1)} km/h (traficissy segment API).` },
                  { Icon: Car, text: `Congestion index ${(view.intervention.peakCongestion * 100).toFixed(0)}% — use for traffic context only.` },
                  { Icon: BarChart3, text: "Compare zone-to-zone arcs in city view before citing mode-share change in percentage points." },
                ]
              : [
                  { Icon: Bike, text: "Safety pressure uses derived proxy from segment speed (reference 60 km/h) — not an official star rating." },
                  { Icon: Car, text: "Congestion-linked pressure shifts with live traficissy snapshots on the monitored intervention corridor." },
                  { Icon: Leaf, text: "Climate proxies are derived from congestion — not measured CO₂ unless emissions data is linked." },
                  { Icon: Footprints, text: "Schematic shows visualized movement direction, not facility inventory geometry." },
                  { Icon: BarChart3, text: "Strongest comparison signals depend on scenario tab (baseline / intervention / comparison)." },
                ]
          ).map((f, i) => (
            <div key={i} className="flex items-start gap-2.5 text-[11px]">
              <WhiteSymbol icon={f.Icon} className="h-3.5 w-3.5 mt-0.5" />
              <p className="text-white/70 leading-relaxed">{f.text}</p>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Intervention timeline */}
      <GlassCard className="px-4 py-4">
        <p className="text-[11px] font-semibold text-white/50 mb-3">Intervention timeline</p>
        <div className="relative pl-5">
          {/* Vertical line */}
          <div
            className="absolute left-1.5 top-2 bottom-2 w-px"
            style={{ background: "linear-gradient(180deg, rgba(99,204,255,0.5), rgba(99,204,255,0.05))" }}
          />
          <div className="space-y-4">
            {view.timeline.map((item, i) => (
              <div key={i} className="relative flex items-start gap-3">
                {/* Node */}
                <div
                  className="absolute -left-[13px] mt-0.5 h-3 w-3 rounded-full border-2 flex-shrink-0"
                  style={{
                    background:    item.status === "done" ? C.cyan : "transparent",
                    borderColor:   item.status === "done" ? C.cyan : "rgba(255,255,255,0.25)",
                    boxShadow:     item.status === "done" ? `0 0 8px ${C.cyan}88` : "none",
                  }}
                />
                <div>
                  <p className="text-[10px] font-semibold" style={{ color: item.status === "done" ? C.cyan : "rgba(255,255,255,0.35)" }}>
                    {item.date}
                  </p>
                  <p className="text-[11px] text-white/65 leading-snug mt-0.5">{item.event}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

// ─── KPI 3.2 — Climate field ───────────────────────────────────────────────────

function ClimateFieldTab({ view }: { view: JunctionStudyView }) {
  const { baseline, intervention } = view;
  const baselinePressure = Math.round(baseline.peakCongestion * 100);
  const interventionPressure = Math.round(intervention.peakCongestion * 100);
  const reductionPct = Math.max(
    0,
    Math.round(((baseline.co2ProxyKgDay - intervention.co2ProxyKgDay) / baseline.co2ProxyKgDay) * 100)
  );

  const stats = [
    {
      label: "Environmental pressure index",
      value: `${view.kpiValue}`,
      suffix: "%",
      color: C.lime,
      note: `Band: ${view.kpiBand}`,
    },
    {
      label: "CO₂ proxy (observed corridor)",
      value: `${intervention.co2ProxyKgDay}`,
      suffix: " kg/day",
      color: C.cyan,
      note: `Baseline proxy ${baseline.co2ProxyKgDay} kg/day`,
    },
    {
      label: "Congestion-linked pressure",
      value: `${interventionPressure}`,
      suffix: "%",
      color: C.amber,
      note: `Baseline ${baselinePressure}%`,
    },
    {
      label: "Estimated reduction vs baseline",
      value: `${reductionPct}`,
      suffix: "%",
      color: C.violet,
      note: "Derived from traffic intensity + hex field",
    },
  ];

  return (
    <div className="space-y-4">
      <TransparencyNotice>
        {dataSourceTrustLabel("derived-proxy")} — environmental pressure from congestion / traffic
        intensity, not measured CO₂. See docs/ISSY_KPI_METHODOLOGY.md.
      </TransparencyNotice>
      <GlassCard className="px-4 py-3">
        <p className="text-[11px] text-white/55 leading-relaxed">
          Climate view for this monitored corridor — derived environmental pressure aligned with the map hex
          field. No modal-share or per-street OD CSV values here.
        </p>
      </GlassCard>
      <div className="grid grid-cols-2 gap-2.5">
        {stats.map((s) => (
          <GlassCard key={s.label} className="px-3 py-3">
            <p className="text-[10px] text-white/40 mb-1 leading-tight">{s.label}</p>
            <p className="text-xl font-bold tabular-nums" style={{ color: s.color }}>
              {s.value}
              <span className="text-[10px] text-white/45 ml-0.5 font-medium">{s.suffix}</span>
            </p>
            <p className="text-[10px] text-white/35 mt-1 leading-snug">{s.note}</p>
          </GlassCard>
        ))}
      </div>
      <GlassCard className="px-4 py-3">
        <p className="text-[11px] font-semibold text-white/60 mb-2">Influence field</p>
        <p className="text-[11px] text-white/55 leading-relaxed">
          Map buffer ~{280} m around {view.shortName} — soft concentric field replaces the old dashed
          intervention disc. Hex cells inside show scenario-specific environmental pressure.
        </p>
      </GlassCard>
    </div>
  );
}

function ClimateDeltaTab({ view }: { view: JunctionStudyView }) {
  const { baseline, intervention } = view;
  const co2Delta = Math.round(
    ((intervention.co2ProxyKgDay - baseline.co2ProxyKgDay) / baseline.co2ProxyKgDay) * 100
  );
  const pressureDelta = Math.round((intervention.peakCongestion - baseline.peakCongestion) * 100);
  const speedDelta = intervention.avgSpeedKmh - baseline.avgSpeedKmh;

  const rows = [
    {
      label: "CO₂ proxy",
      before: `${baseline.co2ProxyKgDay} kg/day`,
      after: `${intervention.co2ProxyKgDay} kg/day`,
      delta: co2Delta,
      unit: "%",
      color: C.lime,
    },
    {
      label: "Peak congestion pressure",
      before: `${(baseline.peakCongestion * 100).toFixed(0)}%`,
      after: `${(intervention.peakCongestion * 100).toFixed(0)}%`,
      delta: pressureDelta,
      unit: " pts",
      color: C.amber,
    },
    {
      label: "Average speed (traffic proxy)",
      before: `${baseline.avgSpeedKmh.toFixed(1)} km/h`,
      after: `${intervention.avgSpeedKmh.toFixed(1)} km/h`,
      delta: Math.round(speedDelta * 10) / 10,
      unit: " km/h",
      color: C.cyan,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div>
          <p className="font-semibold text-white/50 uppercase tracking-widest">Baseline</p>
          <p className="text-white/30">{baseline.period}</p>
        </div>
        <div>
          <p className="font-semibold uppercase tracking-widest" style={{ color: C.lime }}>
            Intervention
          </p>
          <p className="text-white/30">{intervention.period}</p>
        </div>
      </div>
      {rows.map((r) => (
        <GlassCard key={r.label} className="px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold text-white/70">{r.label}</p>
            <p className="text-[10px] text-white/40 mt-0.5">
              {r.before} → <span style={{ color: r.color }}>{r.after}</span>
            </p>
          </div>
          <DeltaArrow value={r.delta} unit={r.unit} />
        </GlassCard>
      ))}
    </div>
  );
}

function FacilitiesTab({ view }: { view: JunctionStudyView }) {
  return (
    <div className="space-y-4">
      <GlassCard className="px-4 py-3">
        <p className="text-[11px] text-white/55 leading-relaxed">
          Zero-emission and cycling infrastructure assets in the study buffer — point features on the map,
          filtered by facility type in the sidebar.
        </p>
        <p className="text-[11px] text-white/70 mt-2 font-medium">{view.interventionType}</p>
      </GlassCard>
      <OverviewTab view={view} />
    </div>
  );
}

function ObservatoryTabContent({
  tabId,
  selectedKpi,
  view,
  pilotLabel,
  pilotId,
  config,
}: {
  tabId: ObservatoryTabId;
  selectedKpi: string;
  view: JunctionStudyView;
  pilotLabel?: string;
  pilotId?: string | null;
  config: ObservatoryConfig;
}) {
  if (tabId === "data") {
    return <DataTab view={view} pilotLabel={pilotLabel} selectedKpi={selectedKpi} config={config} />;
  }

  if (selectedKpi === "kpi3.2") {
    if (tabId === "field") return <ClimateFieldTab view={view} />;
    if (tabId === "delta" || tabId === "beforeAfter") return <ClimateDeltaTab view={view} />;
    return <ClimateFieldTab view={view} />;
  }

  if (selectedKpi === "kpi3.1") {
    if (tabId === "overview") return <FacilitiesTab view={view} />;
    return <FacilitiesTab view={view} />;
  }

  if (selectedKpi === "kpi1.2") {
    if (tabId === "modes" || tabId === "beforeAfter") {
      return <BeforeAfterTab view={view} selectedKpi={selectedKpi} />;
    }
    if (tabId === "corridor") return <InsightsTab view={view} selectedKpi={selectedKpi} />;
    return <BeforeAfterTab view={view} selectedKpi={selectedKpi} />;
  }

  if (selectedKpi === "kpi2.1") {
    if (tabId === "pressure" || tabId === "overview") {
      return <IntersectionTab view={view} pilotId={pilotId} />;
    }
    if (tabId === "beforeAfter") return <BeforeAfterTab view={view} selectedKpi={selectedKpi} />;
    return <IntersectionTab view={view} pilotId={pilotId} />;
  }

  if (tabId === "beforeAfter") return <BeforeAfterTab view={view} selectedKpi={selectedKpi} />;
  if (tabId === "intersection" || tabId === "pressure") {
    return <IntersectionTab view={view} pilotId={pilotId} />;
  }
  if (tabId === "corridor" || tabId === "insights") {
    return <InsightsTab view={view} selectedKpi={selectedKpi} />;
  }
  return <OverviewTab view={view} />;
}

// ─── Tab 5 — Data transparency ────────────────────────────────────────────────

function DataTab({
  view,
  pilotLabel,
  selectedKpi,
  config,
}: {
  view: JunctionStudyView;
  pilotLabel?: string;
  selectedKpi: string;
  config: ObservatoryConfig;
}) {
  const kpiDef = getKpiDefinition(selectedKpi);
  const climateSources =
    selectedKpi === "kpi3.2"
      ? [
          {
            title: "City KPI 3.2 time series",
            type: "derived",
            spatial: "hex-field",
            temporal: "Multi-year trend",
            format: "CARD + chart year",
            confidence: "Medium",
          },
          {
            title: "Traffic intensity proxy (traficissy)",
            type: "observed",
            spatial: "segment-join",
            temporal: "Live snapshot",
            format: "REST API",
            confidence: "High",
          },
        ]
      : null;
  const facilitySources =
    selectedKpi === "kpi3.1"
      ? [
          {
            title: "Cycling infrastructure API",
            type: "observed",
            spatial: "point",
            temporal: "2024 inventory",
            format: "REST API",
            confidence: "High",
          },
        ]
      : null;
  const mobilitySources =
    selectedKpi === "kpi1.2"
      ? [
          {
            title: "ISSY1 zone-to-zone flow CSV (directional zone_in → zone_out)",
            type: "observed",
            spatial: "zone OD only — not split across contextual streets",
            temporal: "Nov 2024 baseline · Nov 2025 post",
            format: "CSV",
            confidence: "High",
          },
          {
            title: "Traffic Segment API (traficissy)",
            type: "observed",
            spatial: "monitored corridor + contextual streets — traffic context, no mode share",
            temporal: "Live snapshot",
            format: "REST API",
            confidence: "High",
          },
        ]
      : null;
  const safetySources =
    selectedKpi === "kpi2.1"
      ? [
          {
            title: "Traffic Segment API (traficissy)",
            type: "observed",
            spatial: "direct-coordinates",
            temporal: "Jun 2024 – ongoing",
            format: "REST API",
            confidence: "High",
          },
          {
            title: "Safety pressure proxy",
            type: "derived",
            spatial: "segment",
            temporal: "Derived baseline vs live",
            format: "formula",
            confidence: "Medium",
          },
        ]
      : null;
  const defaultSources = [
    {
      title: "Traffic Segment API (traficissy)",
      type: "observed",
      spatial: "direct-coordinates",
      temporal: "Jun 2024 – ongoing",
      format: "REST API",
      confidence: "High",
    },
  ];
  const sources =
    climateSources ?? facilitySources ?? mobilitySources ?? safetySources ?? defaultSources;
  return (
    <div className="space-y-4">
      {/* Data source chips */}
      <GlassCard className="px-4 py-3">
        <p className="text-[11px] font-semibold text-white/50 mb-3">Data sources</p>
        <div className="space-y-2.5">
          {sources.map((src) => (
            <div key={src.title} className="rounded-lg border px-3 py-2.5 space-y-2" style={{ background: "rgba(255,255,255,0.03)", borderColor: C.border }}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold text-white/80">{src.title}</p>
                <span
                  className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                  style={{ background: src.confidence === "High" ? "rgba(176,237,186,0.15)" : "rgba(245,158,11,0.15)", color: src.confidence === "High" ? C.lime : C.amber }}
                >
                  {src.confidence} confidence
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Chip label="type"     value={src.type}     color={C.violet} />
                <Chip label="spatial"  value={src.spatial}  color={C.cyan}   />
                <Chip label="temporal" value={src.temporal}  />
                <Chip label="format"   value={src.format}   />
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Metadata summary */}
      <GlassCard className="px-4 py-3">
        <p className="text-[11px] font-semibold text-white/50 mb-3">Dataset metadata</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[11px]">
          {[
            ["Pilot",                 pilotLabel ?? view.pilot],
            ["Segment ID",            view.segmentApiId],
            ["API label",             view.name],
            ["Responsible partner",   "Issy-les-Moulineaux"],
            ["WP7 KPI",               kpiDef?.ref ? `${kpiDef.ref} — ${kpiDef.name}` : config.primaryMetricLabel],
            ["Intervention scale",    "Street"],
            ["Before/after",          "Both periods available"],
            ["Update frequency",      "Live (APIs) / Static (CSV)"],
            ["Geometry quality",      "Exact (APIs) + Matched (CSV)"],
          ].map(([k, v]) => (
            <div key={k as string}>
              <p className="text-white/35 text-[10px] mb-0.5">{k}</p>
              <p className="text-white/75 font-medium">{v}</p>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Confidence breakdown */}
      <GlassCard className="px-4 py-3">
        <p className="text-[11px] font-semibold text-white/50 mb-3">Confidence breakdown</p>
        {[
          { label: "Spatial accuracy",    pct: 95, color: C.lime   },
          { label: "Temporal coverage",   pct: 82, color: C.cyan   },
          { label: "Modal attribution",   pct: 78, color: C.violet },
          { label: "Before/after parity", pct: 90, color: C.amber  },
        ].map((row) => (
          <div key={row.label} className="mb-2.5 last:mb-0">
            <div className="flex justify-between text-[10px] text-white/45 mb-1">
              <span>{row.label}</span>
              <span>{row.pct}%</span>
            </div>
            <div className="h-1 rounded-full" style={{ background: C.border }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: row.color }}
                initial={{ width: 0 }}
                animate={{ width: `${row.pct}%` }}
                transition={{ duration: 0.7, ease: "easeOut" }}
              />
            </div>
          </div>
        ))}
      </GlassCard>
    </div>
  );
}

const REGISTRY_TAB_ICONS: Partial<Record<ObservatoryTabId, React.ReactNode>> = {
  overview: <Activity className="h-3.5 w-3.5" />,
  pressure: <MapPin className="h-3.5 w-3.5" />,
  modes: <BarChart2 className="h-3.5 w-3.5" />,
  corridor: <GitBranch className="h-3.5 w-3.5" />,
  field: <Radio className="h-3.5 w-3.5" />,
  delta: <BarChart2 className="h-3.5 w-3.5" />,
  beforeAfter: <BarChart2 className="h-3.5 w-3.5" />,
  data: <Layers className="h-3.5 w-3.5" />,
};

// ─── Main panel ───────────────────────────────────────────────────────────────

interface SegmentIntelligencePanelProps {
  isOpen: boolean;
  onClose: () => void;
  pilotLabel?: string;
  segments?: TrafficSegment[];
  selectedSegmentId?: string | null;
  onSelectSegmentId?: (segmentId: string) => void;
  selectedKpi?: string;
  scenario?: MapScenario;
  city?: string;
  pilotId?: string | null;
  /** KPI 3.2 chart year intensity (1 = no scale). */
  kpi32IntensityScale?: number;
}

export default function SegmentIntelligencePanel({
  isOpen,
  onClose,
  pilotLabel,
  segments = [],
  selectedSegmentId = null,
  onSelectSegmentId,
  selectedKpi = "kpi2.1",
  scenario = "intervention",
  city = "",
  pilotId = null,
  kpi32IntensityScale = 1,
}: SegmentIntelligencePanelProps) {
  const observatoryConfig = useMemo(
    () => getObservatoryConfig(selectedKpi, city || "Issy-les-Moulineaux", pilotId),
    [selectedKpi, city, pilotId]
  );
  const observatoryKpiDef = useMemo(() => getKpiDefinition(selectedKpi), [selectedKpi]);
  const [activeRegistryTab, setActiveRegistryTab] = useState<ObservatoryTabId>("overview");
  const [expanded, setExpanded] = useState(false);
  const isFlagship = pilotId === "issy-p2";

  const junctionArms = useMemo(
    () => segments.filter((s) => ISSY_JUNCTION_ARMS.some((a) => a.segmentId === s.id)),
    [segments]
  );

  const view = useMemo(() => {
    const seg =
      segments.find((s) => s.id === selectedSegmentId) ?? pickDefaultSegment(segments);
    if (!seg) return null;
    return buildJunctionStudyView(
      seg,
      junctionArms.length ? junctionArms : [seg],
      pilotLabel,
      selectedKpi,
      kpi32IntensityScale,
      scenario,
      pilotId
    );
  }, [segments, selectedSegmentId, pilotLabel, selectedKpi, kpi32IntensityScale, junctionArms, scenario, pilotId]);

  useEffect(() => {
    if (isOpen) {
      setActiveRegistryTab(defaultObservatoryTab(selectedKpi));
    }
  }, [isOpen, selectedSegmentId, selectedKpi]);

  const handleExport = useCallback(() => {
    if (!view) return;
    exportObservatoryReport(view, observatoryConfig, pilotLabel);
  }, [view, observatoryConfig, pilotLabel]);

  return (
    <AnimatePresence>
      {isOpen && !view && (
        <motion.div
          className="fixed top-4 right-4 z-[75] flex flex-col overflow-hidden rounded-[18px] border px-5 py-6"
          style={{
            width: 360,
            background: C.panel,
            borderColor: C.border,
            boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
          }}
          initial={{ x: "110%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "110%", opacity: 0 }}
        >
          <p className="text-sm font-semibold text-white">Segment observatory</p>
          <p className="text-xs text-white/55 mt-2 leading-relaxed">
            Monitored intervention corridor data is still loading or unavailable. Try again in a moment, or pick another monitored corridor after data appears on the map.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 self-start text-xs font-medium px-3 py-1.5 rounded-lg border border-white/20 text-white/80 hover:bg-white/10"
          >
            Close
          </button>
        </motion.div>
      )}
      {isOpen && view && (
        <>
          {/* ── Backdrop scrim (subtle) ── */}
          <motion.div
            className="fixed inset-0 z-[70] pointer-events-none"
            style={{ background: "radial-gradient(ellipse 60% 80% at 100% 50%, rgba(8,6,24,0.45) 0%, transparent 100%)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          />

          {/* ── Panel ── */}
          <motion.div
            className="fixed top-0 right-0 bottom-0 z-[75] flex flex-col overflow-hidden sm:top-4 sm:bottom-4 sm:rounded-[18px]"
            style={{
              width: expanded ? "min(580px, 100vw)" : "min(440px, 100vw)",
              background: C.panel,
              border: `1px solid ${isFlagship ? "rgba(99,204,255,0.35)" : C.border}`,
              borderRadius: 0,
              boxShadow: isFlagship
                ? `0 24px 60px rgba(0,0,0,0.65), 0 0 32px rgba(99,204,255,0.12), inset 0 1px 0 rgba(255,255,255,0.08)`
                : `0 24px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,204,255,0.06), inset 0 1px 0 rgba(255,255,255,0.08)`,
            }}
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {/* Top gradient sheen */}
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-px"
              style={{ background: `linear-gradient(90deg, transparent, ${C.cyan}55, ${C.violet}55, transparent)` }}
            />

            {/* ── Header ─────────────────────────────────────────────────────── */}
            <div
              className="relative flex-shrink-0 px-5 pt-5 pb-4"
              style={{ borderBottom: `1px solid ${C.border}` }}
            >
              {/* Live pulse + status */}
              <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center gap-1.5">
                  <motion.div
                    className="h-2 w-2 rounded-full"
                    style={{ background: C.lime }}
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  <span className="text-[10px] font-medium text-white/50 uppercase tracking-widest">Live observed</span>
                </div>
                <div
                  className="ml-auto px-2.5 py-0.5 rounded-full text-[10px] font-semibold"
                  style={{ background: "rgba(101,125,245,0.18)", color: C.violet, border: `1px solid rgba(101,125,245,0.30)` }}
                >
                  {view.kpiLabel}
                </div>
              </div>

              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/45">
                {observatoryConfig.title}
              </p>
              <h2 className="text-[17px] font-bold text-white leading-tight mt-1">
                Monitored intervention corridor
              </h2>
              <p className="text-[12px] mt-0.5 font-medium" style={{ color: view.armColor }}>
                {view.name}
              </p>
              <p className="text-[11px] mt-0.5 text-white/45">
                {observatoryConfig.subtitle}
              </p>
              {observatoryConfig.emptyState && (
                <p className="text-[11px] mt-2 text-amber-200/90 leading-snug border border-amber-400/25 rounded-lg px-2 py-1.5 bg-amber-500/10">
                  {observatoryConfig.emptyState}
                </p>
              )}

              <div className="flex flex-wrap gap-1 mt-2.5">
                <span
                  className="px-2 py-1 rounded-md text-[10px] font-medium border"
                  style={{
                    borderColor: "rgba(99,204,255,0.45)",
                    background: "rgba(99,204,255,0.12)",
                    color: "#9FE6FF",
                  }}
                >
                  Active monitored corridor · {view.segmentApiId}
                </span>
                <span
                  className="px-2 py-1 rounded-md text-[10px] font-medium border"
                  style={{
                    borderColor: "rgba(255,255,255,0.16)",
                    background: "rgba(255,255,255,0.04)",
                    color: "rgba(255,255,255,0.52)",
                  }}
                >
                  Other streets shown as contextual geometry only
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5 mt-2">
                <Chip label="KPI" value={`${view.kpiValue} · ${view.kpiBand}`} />
                <Chip
                  icon={MapPin}
                  label="Coords"
                  value={`${view.coordinates[0].toFixed(4)}°N, ${view.coordinates[1].toFixed(4)}°E`}
                />
                {selectedKpi === "kpi3.2" ? (
                  <>
                    <Chip
                      label="CO₂ proxy"
                      value={`${view.intervention.co2ProxyKgDay} kg/day`}
                      color={C.lime}
                    />
                    <Chip
                      label="Pressure"
                      value={`${(view.intervention.peakCongestion * 100).toFixed(0)}%`}
                      color={C.amber}
                    />
                  </>
                ) : selectedKpi === "kpi3.1" ? (
                  <Chip label="Facilities" value="Zero-emission / cycle assets" color={C.cyan} />
                ) : (
                  <>
                    <Chip icon={Gauge} label="Speed" value={`${view.intervention.avgSpeedKmh.toFixed(1)} km/h`} />
                    <Chip
                      icon={Activity}
                      label="Congestion"
                      value={`${(view.intervention.peakCongestion * 100).toFixed(0)}%`}
                    />
                  </>
                )}
              </div>

              {/* Performance indicator bar */}
              <div className="mt-3">
                <div className="flex justify-between text-[10px] text-white/35 mb-1">
                  <span>Junction performance vs baseline</span>
                  <span style={{ color: C.lime }}>+18% improvement</span>
                </div>
                <div className="h-1 rounded-full overflow-hidden" style={{ background: C.border }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: `linear-gradient(90deg, ${C.violet}, ${C.cyan}, ${C.lime})` }}
                    initial={{ width: "50%" }}
                    animate={{ width: "68%" }}
                    transition={{ duration: 1, ease: "easeOut", delay: 0.4 }}
                  />
                </div>
              </div>

              {/* Controls */}
              <div className="absolute top-4 right-4 flex items-center gap-1.5">
                <button
                  onClick={() => setExpanded((v) => !v)}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: "rgba(255,255,255,0.45)", background: "rgba(255,255,255,0.06)" }}
                  title={expanded ? "Collapse" : "Expand"}
                >
                  {expanded ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg transition-colors hover:bg-white/10"
                  style={{ color: "rgba(255,255,255,0.45)" }}
                  aria-label="Close panel"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* ── Mini junction preview strip ─────────────────────────────── */}
            <div
              className="flex-shrink-0 px-5 py-2.5 flex items-center gap-3"
              style={{ borderBottom: `1px solid ${C.border}`, background: "rgba(255,255,255,0.015)" }}
            >
              <IntersectionSVG highlightArmId={view.armId} />
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: C.cyan }} />
                  <span className="text-white/55">
                    {selectedKpi === "kpi3.2"
                      ? "Climate / emissions field active"
                      : selectedKpi === "kpi3.1"
                        ? "Zero-emission facilities in buffer"
                        : "Cycle continuity corridor active"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px]">
                  <motion.span
                    className="h-2 w-2 rounded-full flex-shrink-0"
                    style={{ background: C.lime }}
                    animate={{ opacity: [1, 0.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  <span className="text-white/55">1 monitored corridor · traficissy API context</span>
                </div>
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: C.lavender }} />
                  <span className="text-white/55">Post-intervention monitoring</span>
                </div>
              </div>
            </div>

            {/* ── Tab bar ─────────────────────────────────────────────────────── */}
            <div
              className="flex-shrink-0 flex items-center gap-0 px-2 pt-2 pb-0"
              style={{ borderBottom: `1px solid ${C.border}` }}
            >
              {observatoryConfig.tabs.map((tab) => {
                const active = activeRegistryTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveRegistryTab(tab.id)}
                    className="relative flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-medium rounded-t-lg transition-colors whitespace-nowrap"
                    style={{
                      color:      active ? "white" : "rgba(255,255,255,0.40)",
                      background: active ? "rgba(255,255,255,0.06)" : "transparent",
                    }}
                  >
                    {REGISTRY_TAB_ICONS[tab.id] ?? <Activity className="h-3.5 w-3.5" />}
                    {tab.label}
                    {active && (
                      <motion.div
                        className="absolute bottom-0 inset-x-3 h-0.5 rounded-t-full"
                        style={{ background: C.cyan }}
                        layoutId="tab-indicator"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* ── Tab content ─────────────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-thin" style={{ scrollbarColor: `${C.border} transparent` }}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${selectedKpi}-${activeRegistryTab}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                >
                  <ObservatoryTabContent
                    tabId={activeRegistryTab}
                    selectedKpi={selectedKpi}
                    view={view}
                    pilotLabel={pilotLabel}
                    pilotId={pilotId}
                    config={observatoryConfig}
                  />
                </motion.div>
              </AnimatePresence>
            </div>

            {/* ── Footer ─────────────────────────────────────────────────────── */}
            <div
              className="flex-shrink-0 flex items-center justify-between px-5 py-3"
              style={{ borderTop: `1px solid ${C.border}`, background: "rgba(255,255,255,0.02)" }}
            >
              <div className="flex flex-col gap-1 text-[10px] text-white/50 max-w-[70%]">
                <div className="flex items-center gap-2">
                  <GitBranch className="h-3 w-3 shrink-0" />
                  <span>
                    ELABORATOR · {pilotLabel ?? "Issy"} · {dataSourceTrustLabel(kpiPrimaryIssySource(selectedKpi))}
                  </span>
                </div>
                <span className="pl-5 font-semibold text-white/65">
                  Provenance: {observatoryKpiDef?.dataLabel ?? "Derived"} · Observed / Derived / Modelled / Mock
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExport}
                  className="flex items-center gap-1.5 text-[10px] text-white/40 hover:text-white/70 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-white/5"
                >
                  <FileText className="h-3 w-3" />
                  Export
                </button>
                {selectedKpi !== "kpi3.2" && selectedKpi !== "kpi3.1" && (
                  <button
                    type="button"
                    onClick={() => setActiveRegistryTab("corridor")}
                    className="flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1.5 rounded-lg transition-colors"
                    style={{ background: "rgba(101,125,245,0.15)", color: C.violet }}
                  >
                    Read story
                    <ChevronRight className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
