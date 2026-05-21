/**
 * SegmentIntelligencePanel
 *
 * Cinematic floating observatory popup for the single monitored intersection
 * of Issy-les-Moulineaux Pilot 2 (Cycle Lane Continuity).
 *
 * Coordinates: 48.829722, 2.261056
 * Streets:     Rue Ernest Renan × Rue Camille Desmoulins
 *
 * Structure:
 *   Header  →  TabBar  →  [ Overview | Before/After | Intersection | Insights | Data ]
 */

import { useState, useEffect } from "react";
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
  Eye,
  Layers,
  FileText,
  GitBranch,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  Tooltip as RechTooltip,
  YAxis,
} from "recharts";

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

// ─── Hard-coded intersection data (Issy Pilot 2) ─────────────────────────────
const JUNCTION = {
  id:                 "issy-seg-junction-001",
  name:               "Rue Ernest Renan × Rue Camille Desmoulins",
  shortName:          "Ernest Renan Junction",
  pilot:              "Issy-les-Moulineaux — Pilot 2",
  interventionType:   "Cycle Lane Continuity",
  coordinates:        [48.829722, 2.261056] as [number, number],
  monitoringPeriod:   "Jun 2024 — ongoing",
  sensors:            3,
  approachesCovered:  3,
  totalApproaches:    4,
  dataConfidence:     87,

  baseline: {
    label:              "Baseline",
    period:             "Jun – Aug 2024",
    modeShare: {
      Pedestrian: 18,
      Cycle:       8,
      "Public Transport": 22,
      Car:        48,
      PTW:         4,
    },
    dailyCycleCount:    342,
    peakCongestion:     0.74,   // 0–1 index
    avgSpeedKmh:        18.2,
    co2ProxyKgDay:     1240,
    trendCycle:   [310, 322, 318, 335, 342, 339, 345, 338, 342],
    trendCar:     [1820, 1856, 1801, 1789, 1840, 1810, 1825, 1799, 1840],
  },

  intervention: {
    label:              "Post-Intervention",
    period:             "Nov 2024 — ongoing",
    modeShare: {
      Pedestrian: 20,
      Cycle:      15,
      "Public Transport": 21,
      Car:        41,
      PTW:         3,
    },
    dailyCycleCount:    621,
    peakCongestion:     0.61,
    avgSpeedKmh:        19.8,
    co2ProxyKgDay:     1058,
    trendCycle:   [480, 512, 558, 581, 605, 618, 614, 624, 621],
    trendCar:     [1650, 1618, 1590, 1571, 1548, 1532, 1521, 1510, 1505],
  },

  timeline: [
    { date: "Jun 2024",  event: "Baseline monitoring begins",          status: "done" },
    { date: "Sep 2024",  event: "Cycle infrastructure deployed",        status: "done" },
    { date: "Oct 2024",  event: "Sensor calibration & validation",      status: "done" },
    { date: "Nov 2024",  event: "Post-intervention monitoring begins",  status: "done" },
    { date: "Q2 2025",   event: "Full impact evaluation report",        status: "upcoming" },
  ],
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

function Chip({
  label,
  value,
  color = C.muted,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium border"
      style={{ background: "rgba(255,255,255,0.05)", borderColor: C.border, color }}
    >
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
function OverviewTab() {
  const { baseline, intervention } = JUNCTION;

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
      after: JUNCTION.dataConfidence,
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
            ["Segment ID",      JUNCTION.id],
            ["Intersection",    JUNCTION.shortName],
            ["Monitoring",      JUNCTION.monitoringPeriod],
            ["Sensors active",  `${JUNCTION.sensors} stations`],
            ["Approaches",      `${JUNCTION.approachesCovered}/${JUNCTION.totalApproaches} covered`],
            ["Intervention",    JUNCTION.interventionType],
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
          <span>Approach coverage</span>
          <span>{JUNCTION.approachesCovered}/{JUNCTION.totalApproaches} monitored</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: C.border }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: `linear-gradient(90deg, ${C.cyan}, ${C.violet})` }}
            initial={{ width: 0 }}
            animate={{ width: `${(JUNCTION.approachesCovered / JUNCTION.totalApproaches) * 100}%` }}
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

function BeforeAfterTab() {
  const { baseline, intervention } = JUNCTION;
  const modes = Object.keys(baseline.modeShare) as (keyof typeof baseline.modeShare)[];
  const maxVal = Math.max(...modes.map((m) => Math.max(baseline.modeShare[m], intervention.modeShare[m])));

  const summaryCards = [
    {
      icon: "🚴",
      label: "Cycling share",
      before: `${baseline.modeShare.Cycle}%`,
      after: `${intervention.modeShare.Cycle}%`,
      delta: intervention.modeShare.Cycle - baseline.modeShare.Cycle,
      unit: "pp",
      color: C.cyan,
    },
    {
      icon: "🚗",
      label: "Car share",
      before: `${baseline.modeShare.Car}%`,
      after: `${intervention.modeShare.Car}%`,
      delta: intervention.modeShare.Car - baseline.modeShare.Car,
      unit: "pp",
      color: C.lavender,
    },
    {
      icon: "📈",
      label: "Daily cycling",
      before: `${baseline.dailyCycleCount}`,
      after: `${intervention.dailyCycleCount}`,
      delta: Math.round(((intervention.dailyCycleCount - baseline.dailyCycleCount) / baseline.dailyCycleCount) * 100),
      unit: "%",
      color: C.lime,
    },
    {
      icon: "🚦",
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

      {/* Mirrored mode share */}
      <GlassCard className="px-4 py-3 space-y-2.5">
        <p className="text-[11px] font-semibold text-white/60 mb-3">Modal share comparison</p>
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
              <span className="text-[15px]">{s.icon}</span>
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
            <p className="text-[10px] text-white/35 mb-1">🚴 Cycling trend</p>
            <Sparkline data={[...baseline.trendCycle, ...intervention.trendCycle]} color={C.cyan} />
          </div>
          <div>
            <p className="text-[10px] text-white/35 mb-1">🚗 Car trend</p>
            <Sparkline data={[...baseline.trendCar, ...intervention.trendCar]} color={C.lavender} />
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

// ─── Tab 3 — Intersection schematic ──────────────────────────────────────────

function IntersectionSVG({ expanded }: { expanded?: boolean }) {
  const size    = expanded ? 260 : 200;
  const cx      = size / 2;
  const cy      = size / 2;
  const roadW   = 36;
  const cycleW  = 5;

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

      {/* ── Cycle lanes ─────────────────────────────────────────────────────── */}
      {/* South approach (new cycle lane added) — glowing cyan strip */}
      <rect
        x={cx + roadW / 2 - cycleW - 2}
        y={cy + roadW / 2}
        width={cycleW}
        height={size / 2 - roadW / 2}
        fill={C.cyan}
        opacity="0.75"
        rx="1"
      />
      {/* South approach glow */}
      <rect
        x={cx + roadW / 2 - cycleW - 2}
        y={cy + roadW / 2}
        width={cycleW}
        height={size / 2 - roadW / 2}
        fill={C.cyan}
        opacity="0.3"
        rx="1"
        filter="url(#blur2)"
      />
      {/* East approach cycle lane */}
      <rect
        x={cx + roadW / 2}
        y={cy - roadW / 2 + 2}
        width={size / 2 - roadW / 2}
        height={cycleW}
        fill={C.cyan}
        opacity="0.75"
        rx="1"
      />
      <rect
        x={cx + roadW / 2}
        y={cy - roadW / 2 + 2}
        width={size / 2 - roadW / 2}
        height={cycleW}
        fill={C.cyan}
        opacity="0.3"
        rx="1"
        filter="url(#blur2)"
      />

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

      {/* ── Street name labels ─────────────────────────────────────────────── */}
      <text x={cx} y={12} textAnchor="middle" fill="#ffffff55" fontSize="7.5" fontFamily="sans-serif">Rue Ernest Renan</text>
      <text x={size - 4} y={cy - roadW / 2 - 6} textAnchor="end" fill="#ffffff55" fontSize="7" fontFamily="sans-serif">Rue Camille</text>
      <text x={size - 4} y={cy - roadW / 2 + 3} textAnchor="end" fill="#ffffff55" fontSize="7" fontFamily="sans-serif">Desmoulins</text>

      {/* ── Cycle lane legend dot ──────────────────────────────────────────── */}
      <circle cx={8} cy={size - 12} r={4} fill={C.cyan} opacity="0.85" />
      <text x={16} y={size - 9} fill={C.cyan} fontSize="7" fontFamily="sans-serif" opacity="0.85">New cycle lane</text>
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

function IntersectionTab() {
  return (
    <div className="space-y-4">
      <GlassCard className="px-4 py-4 flex flex-col items-center">
        <p className="text-[11px] font-semibold text-white/50 mb-3 self-start">
          Junction schematic — {JUNCTION.shortName}
        </p>
        <IntersectionSVG expanded />
      </GlassCard>

      {/* Sensor legend */}
      <GlassCard className="px-4 py-3">
        <p className="text-[11px] font-semibold text-white/50 mb-2.5">Active sensors</p>
        <div className="space-y-2">
          {[
            { label: "North approach (Rue Ernest Renan N)",  type: "Bicycle + motor counter", id: "S-001" },
            { label: "South-East approach",                  type: "Bicycle + pedestrian",    id: "S-002" },
            { label: "East approach (Rue Camille Desmoulins)", type: "Motor vehicle counter", id: "S-003" },
          ].map((s) => (
            <div key={s.id} className="flex items-start gap-2.5 text-[11px]">
              <div className="mt-0.5 flex-shrink-0">
                <motion.div
                  className="h-2 w-2 rounded-full"
                  style={{ background: C.cyan }}
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </div>
              <div>
                <p className="text-white/75 font-medium leading-tight">{s.label}</p>
                <p className="text-white/35">{s.type} · {s.id}</p>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard className="px-4 py-3">
        <p className="text-[11px] font-semibold text-white/50 mb-2">Intervention summary</p>
        <p className="text-[11px] text-white/60 leading-relaxed">
          A continuous protected cycle lane was added on the <span className="text-cyan-400">south approach</span> and the
          <span className="text-cyan-400"> east approach</span> of the junction, closing a critical
          gap in the city cycling network. Pedestrian crossings remain unchanged. No traffic
          signal modifications were made.
        </p>
      </GlassCard>
    </div>
  );
}

// ─── Tab 4 — Insights ─────────────────────────────────────────────────────────

function InsightsTab() {
  return (
    <div className="space-y-4">
      {/* Narrative */}
      <GlassCard className="px-4 py-4">
        <div
          className="h-1 w-10 rounded-full mb-3"
          style={{ background: `linear-gradient(90deg, ${C.cyan}, ${C.violet})` }}
        />
        <p className="text-[12px] text-white/75 leading-[1.7]">
          Following the installation of a continuous protected cycle lane along the south and
          east approaches, <span className="text-white font-medium">cycling trips nearly doubled</span> at
          this junction — rising from 342 to 621 daily passages. The strongest modal shift occurred
          in the north-east corridor, where the new infrastructure created a direct, safe route
          toward the Seine riverfront cycle path.
        </p>
        <p className="text-[12px] text-white/75 leading-[1.7] mt-3">
          Private vehicle dominance dropped by 7 percentage points during peak hours, with
          congestion easing from a high-pressure 74 to a moderate 61 on the intervention index.
          The CO₂ proxy estimate improved by an estimated 15%, driven primarily by the shift
          away from short car trips under 3 km.
        </p>
      </GlassCard>

      {/* Key findings */}
      <GlassCard className="px-4 py-3">
        <p className="text-[11px] font-semibold text-white/50 mb-3">Key findings</p>
        <div className="space-y-2.5">
          {[
            { icon: "🚴", text: "Cycling continuity restored — journey time to river cycle path reduced by ~4 min" },
            { icon: "🚗", text: "Car dominance reduced at peak hours, particularly 08:00–09:00 and 17:30–18:30" },
            { icon: "🌱", text: "Estimated CO₂ reduction of 182 kg/day vs baseline (15% improvement)" },
            { icon: "👣", text: "Pedestrian crossing behaviour unchanged — no safety incidents reported post-intervention" },
            { icon: "📊", text: "Strongest signal in north-east corridor; west approach shows minimal change" },
          ].map((f, i) => (
            <div key={i} className="flex items-start gap-2.5 text-[11px]">
              <span className="mt-0.5">{f.icon}</span>
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
            {JUNCTION.timeline.map((item, i) => (
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

// ─── Tab 5 — Data transparency ────────────────────────────────────────────────

function DataTab() {
  return (
    <div className="space-y-4">
      {/* Data source chips */}
      <GlassCard className="px-4 py-3">
        <p className="text-[11px] font-semibold text-white/50 mb-3">Data sources</p>
        <div className="space-y-2.5">
          {[
            {
              title: "Bicycle Counting API",
              type: "observed",
              spatial: "direct-coordinates",
              temporal: "Jun 2024 – ongoing",
              format: "REST API",
              confidence: "High",
            },
            {
              title: "Traffic Segment API (traficissy)",
              type: "observed",
              spatial: "direct-coordinates",
              temporal: "Jun 2024 – ongoing",
              format: "REST API",
              confidence: "High",
            },
            {
              title: "ISSY1 Zone-to-Zone Flow CSV",
              type: "observed",
              spatial: "segment-join",
              temporal: "Jun–Aug 2024 / Nov 2024",
              format: "CSV",
              confidence: "Medium",
            },
          ].map((src) => (
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
            ["Pilot ID",              "issy-p2"],
            ["Segment ID",            "issy-seg-junction-001"],
            ["Responsible partner",   "Issy-les-Moulineaux"],
            ["WP7 KPI",               "KPI1.2 — Mobility Mode Share"],
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

// ─── Tab bar definition ───────────────────────────────────────────────────────

type TabId = "overview" | "before-after" | "intersection" | "insights" | "data";

const TABS: { id: TabId; icon: React.ReactNode; label: string }[] = [
  { id: "overview",      icon: <Activity className="h-3.5 w-3.5"  />, label: "Overview"    },
  { id: "before-after",  icon: <BarChart2 className="h-3.5 w-3.5" />, label: "Before/After" },
  { id: "intersection",  icon: <MapPin className="h-3.5 w-3.5"    />, label: "Intersection" },
  { id: "insights",      icon: <Eye className="h-3.5 w-3.5"       />, label: "Insights"     },
  { id: "data",          icon: <Layers className="h-3.5 w-3.5"    />, label: "Data"         },
];

// ─── Main panel ───────────────────────────────────────────────────────────────

interface SegmentIntelligencePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SegmentIntelligencePanel({ isOpen, onClose }: SegmentIntelligencePanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [expanded, setExpanded] = useState(false);

  // Reset to overview when panel opens
  useEffect(() => {
    if (isOpen) setActiveTab("overview");
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
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
            className="fixed top-4 right-4 bottom-4 z-[75] flex flex-col overflow-hidden"
            style={{
              width:        expanded ? 580 : 440,
              background:   C.panel,
              border:       `1px solid ${C.border}`,
              borderRadius: 18,
              boxShadow:    `0 24px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,204,255,0.06), inset 0 1px 0 rgba(255,255,255,0.08)`,
            }}
            initial={{ x: "110%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "110%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 30 }}
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
                  KPI1.2 — Mode Share
                </div>
              </div>

              {/* Title */}
              <h2 className="text-[17px] font-bold text-white leading-tight">
                {JUNCTION.shortName}
              </h2>
              <p className="text-[12px] mt-0.5" style={{ color: C.cyan }}>
                {JUNCTION.pilot}
              </p>

              {/* Coordinate + pilot badges */}
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                <Chip label="📍" value={`${JUNCTION.coordinates[0].toFixed(4)}°N, ${JUNCTION.coordinates[1].toFixed(4)}°E`} />
                <Chip label="⏱" value={JUNCTION.monitoringPeriod} />
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
              <IntersectionSVG />
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: C.cyan }} />
                  <span className="text-white/55">Cycle continuity corridor active</span>
                </div>
                <div className="flex items-center gap-2 text-[10px]">
                  <motion.span
                    className="h-2 w-2 rounded-full flex-shrink-0"
                    style={{ background: C.lime }}
                    animate={{ opacity: [1, 0.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  <span className="text-white/55">{JUNCTION.sensors} sensors streaming</span>
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
              {TABS.map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className="relative flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-medium rounded-t-lg transition-colors whitespace-nowrap"
                    style={{
                      color:      active ? "white" : "rgba(255,255,255,0.40)",
                      background: active ? "rgba(255,255,255,0.06)" : "transparent",
                    }}
                  >
                    {tab.icon}
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
                  key={activeTab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                >
                  {activeTab === "overview"     && <OverviewTab />}
                  {activeTab === "before-after" && <BeforeAfterTab />}
                  {activeTab === "intersection" && <IntersectionTab />}
                  {activeTab === "insights"     && <InsightsTab />}
                  {activeTab === "data"         && <DataTab />}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* ── Footer ─────────────────────────────────────────────────────── */}
            <div
              className="flex-shrink-0 flex items-center justify-between px-5 py-3"
              style={{ borderTop: `1px solid ${C.border}`, background: "rgba(255,255,255,0.02)" }}
            >
              <div className="flex items-center gap-2 text-[10px] text-white/30">
                <GitBranch className="h-3 w-3" />
                <span>ELABORATOR · WP7 · Issy Pilot 2</span>
              </div>
              <div className="flex items-center gap-2">
                <button className="flex items-center gap-1.5 text-[10px] text-white/40 hover:text-white/70 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-white/5">
                  <FileText className="h-3 w-3" />
                  Export
                </button>
                <button
                  onClick={() => setActiveTab("insights")}
                  className="flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1.5 rounded-lg transition-colors"
                  style={{ background: "rgba(101,125,245,0.15)", color: C.violet }}
                >
                  Read story
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
