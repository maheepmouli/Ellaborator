import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  Tooltip,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  LineChart,
  Line,
  Area,
  ReferenceLine,
  PieChart,
  Pie,
  LabelList,
} from "recharts";
import type { ReactNode } from "react";
import type { KPIValue } from "@/data/kpiDefinitions";
import type { ChartDrillPayload } from "@/types/chartMapInteraction";

export interface KPIChartProps {
  kpiId: string;
  data: KPIValue;
  cityName: string;
  /** Highlight chart marks that match explorer selection / last chart drill */
  chartSelectionKeys?: string[];
  /** Drill-down: sync map filters / camera (explorer only; optional elsewhere). */
  onChartDrill?: (payload: ChartDrillPayload) => void;
}

const TICK = "#E9E2FF";
const TICK_STRONG = "#F4F1FF";
const GRID = "rgba(184, 166, 255, 0.18)";

const TOOLTIP_STYLE = {
  backgroundColor: "rgba(21, 17, 48, 0.92)",
  border: "1px solid #657DF5",
  borderRadius: 8,
  color: TICK_STRONG,
  fontSize: 12,
};

/** Default tooltip rows ignore `contentStyle.color` — set these so values stay readable on dark panels. */
const TOOLTIP_LABEL_STYLE = { color: TICK, fontWeight: 600 as const };
const TOOLTIP_ITEM_STYLE = { color: TICK_STRONG };

/** Recharts categorical charts pass click state with `activePayload`; shape varies slightly by chart type. */
function payloadFromChartClick<P extends Record<string, unknown>>(state: unknown): P | undefined {
  if (!state || typeof state !== "object") return undefined;
  const ap = (state as { activePayload?: unknown }).activePayload;
  if (!Array.isArray(ap) || ap.length === 0) return undefined;
  const wrap = ap[0];
  if (!wrap || typeof wrap !== "object") return undefined;
  const payload = (wrap as { payload?: unknown }).payload;
  if (!payload || typeof payload !== "object") return undefined;
  return payload as P;
}

const modeColors: Record<string, string> = {
  Pedestrian: "#B0EDBA",
  Cycle: "#96C2EF",
  "Public Transport": "#657DF5",
  "Private Car": "#8578C3",
  PTW: "#2F1B6D",
};

function hasPositiveBreakdown(breakdown?: Record<string, number>): boolean {
  if (!breakdown) return false;
  return Object.values(breakdown).some((v) => Number(v) > 0);
}

/** Always-on demo breakdowns when a pilot/KPI has no linked chart series. */
function mockBreakdownForKpi(kpiId: string, data: KPIValue): Record<string, number> {
  const main = Number(data.mainValue);
  const safeMain = Number.isFinite(main) && main > 0 ? main : 50;
  const change = Number(data.change) || 0;
  switch (kpiId) {
    case "kpi1.1":
      return {
        "DSS dissemination": Math.max(1, Math.round(safeMain)),
        "Expansion plan": Math.max(1, Math.round(Math.abs(change) || 1)),
        "Partner readiness": Math.max(1, Math.round(safeMain * 0.6)),
      };
    case "kpi1.2":
      return {
        Pedestrian: 18,
        Cycle: 12,
        "Public Transport": 22,
        "Private Car": 40,
        PTW: 8,
      };
    case "kpi2.1":
      return {
        Pedestrian: 3.8,
        Cyclist: 3.5,
        Motorcyclist: 3.2,
        "Vehicle Occupant": 4.0,
      };
    case "kpi3.1":
      return {
        "Cycle parking": 2,
        Charging: 1,
        "Shared mobility": 1,
        Pedestrian: 1,
        Parking: 1,
      };
    case "kpi3.2":
      return {
        "CO₂ (kg/day)": 12500,
        "PM2.5 (µg/m³)": 18,
        "Noise (dB)": 62,
      };
    case "kpi4.1":
      return {
        "Physical Accessibility": Math.max(35, Math.round(safeMain - 4)),
        "Safety & Security": Math.min(95, Math.round(safeMain + 3)),
        "General Satisfaction": Math.round(safeMain),
      };
    case "kpi4.2":
      return {
        "Equal access": Math.max(1, Math.round(safeMain * 0.34)),
        "Slight barriers": Math.max(1, Math.round(safeMain * 0.28)),
        "Heavy barriers": Math.max(1, Math.round(safeMain * 0.22)),
        "Priority upgrades": Math.max(1, Math.round(Math.abs(change) || safeMain * 0.16)),
      };
    default:
      return {
        Category: Math.max(1, Math.round(safeMain)),
        Other: Math.max(1, Math.round(safeMain * 0.45)),
      };
  }
}

function mockTimeSeries(data: KPIValue): Array<{ year: number; value: number }> {
  const reduction = Math.abs(Number(data.mainValue) || 17);
  const end = Math.max(55, Math.min(95, 100 - reduction));
  return [
    { year: 2020, value: 100 },
    { year: 2021, value: 94 },
    { year: 2022, value: 88 },
    { year: 2023, value: 85 },
    { year: 2024, value: end },
  ];
}

function resolveChartBreakdown(
  kpiId: string,
  data: KPIValue
): { breakdown: Record<string, number>; isMock: boolean } {
  if (hasPositiveBreakdown(data.breakdown)) {
    return { breakdown: data.breakdown!, isMock: false };
  }
  if (hasPositiveBreakdown(data.breakdownBaseline)) {
    return { breakdown: data.breakdownBaseline!, isMock: false };
  }
  return { breakdown: mockBreakdownForKpi(kpiId, data), isMock: true };
}

function MockPlotFrame({ isMock: _isMock, children }: { isMock: boolean; children: ReactNode }) {
  return <div className="relative">{children}</div>;
}

function ModeShareBarLabel(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  value?: number | string;
}) {
  const { x = 0, y = 0, width = 0, height = 0, value } = props;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return (
    <text
      x={x + width + 6}
      y={y + height / 2}
      fill={TICK_STRONG}
      fontSize={10}
      fontWeight={600}
      dominantBaseline="middle"
      stroke="none"
    >
      {`${numeric.toFixed(1)}%`}
    </text>
  );
}

export const ModeShareChart = ({
  data,
  chartSelectionKeys,
  onChartDrill,
}: Pick<KPIChartProps, "data" | "chartSelectionKeys" | "onChartDrill"> &
  Omit<KPIChartProps, "kpiId" | "cityName">) => {
  const resolved = resolveChartBreakdown("kpi1.2", data);
  const breakdown = resolved.breakdown;
  const standardModes = ["Pedestrian", "Cycle", "Public Transport", "Private Car", "PTW"];
  const dynamicModes = Object.keys(breakdown).filter((key) => Number(breakdown[key]) > 0);
  const modesToShow = standardModes.some((mode) => Number(breakdown[mode]) > 0)
    ? standardModes
    : dynamicModes;
  const chartData = modesToShow.map((mode) => ({
    mode,
    value: Number(breakdown[mode] || 0),
    fill: modeColors[mode] || "#96C2EF",
  }));
  const hasKeys = !!(chartSelectionKeys && chartSelectionKeys.length > 0);

  const handleBarPlotClick = (state: unknown) => {
    if (!onChartDrill) return;
    const payload = payloadFromChartClick<{ mode?: string }>(state);
    if (payload?.mode) onChartDrill({ source: "kpi1.2", key: payload.mode });
  };

  return (
    <MockPlotFrame isMock={resolved.isMock}>
    <ResponsiveContainer width="100%" height={200}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 8, right: 44, bottom: 8, left: 8 }}
        style={{ cursor: onChartDrill ? "pointer" : undefined }}
        onClick={onChartDrill ? handleBarPlotClick : undefined}
      >
        <XAxis type="number" domain={[0, 100]} tick={{ fill: TICK, fontSize: 10 }} tickFormatter={(v) => `${v}%`} stroke={GRID} />
        <YAxis type="category" dataKey="mode" tick={{ fill: TICK, fontSize: 11, fontWeight: 600 }} width={118} stroke="transparent" />
        <Tooltip
          formatter={(v: number) => [`${v.toFixed(1)}%`, "Share"]}
          contentStyle={TOOLTIP_STYLE}
          labelStyle={TOOLTIP_LABEL_STYLE}
          itemStyle={TOOLTIP_ITEM_STYLE}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive={false}>
          <LabelList dataKey="value" content={<ModeShareBarLabel />} />
          {chartData.map((row, i) => {
            const selected = !!(row.mode && hasKeys && chartSelectionKeys?.includes(row.mode));
            const dim = !!(hasKeys && !selected);
            return (
              <Cell
                key={i}
                fill={row.fill}
                opacity={dim ? 0.35 : 1}
                stroke={selected ? "#ffffff" : "transparent"}
                strokeWidth={selected ? 2 : 0}
              />
            );
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
    </MockPlotFrame>
  );
};

export const SafetyModeSpeedChart = ({
  data,
  chartSelectionKeys,
  onChartDrill,
}: Pick<KPIChartProps, "data" | "chartSelectionKeys" | "onChartDrill"> &
  Omit<KPIChartProps, "kpiId" | "cityName">) => {
  const mockModes = mockBreakdownForKpi("kpi1.2", data);
  const after = hasPositiveBreakdown(data.breakdown) ? data.breakdown! : mockModes;
  const before = hasPositiveBreakdown(data.breakdownBaseline)
    ? data.breakdownBaseline!
    : Object.fromEntries(
        Object.entries(after).map(([k, v]) => [k, Math.max(0, Number(v) - (Number(data.change) || 2))])
      );
  const isMock = !hasPositiveBreakdown(data.breakdown) && !hasPositiveBreakdown(data.breakdownBaseline);
  const modeKeys = ["Pedestrian", "Cycle", "Public Transport", "Private Car", "PTW"].filter(
    (k) => (before[k] ?? 0) > 0 || (after[k] ?? 0) > 0
  );
  const speedBefore = Number(before["Avg speed (km/h)"] ?? (isMock ? 28 : 0));
  const speedAfter = Number(after["Avg speed (km/h)"] ?? (isMock ? 24 : 0));
  const hasSpeed =
    speedBefore > 0 ||
    speedAfter > 0 ||
    "Avg speed (km/h)" in before ||
    "Avg speed (km/h)" in after;
  const hasKeys = !!(chartSelectionKeys && chartSelectionKeys.length > 0);

  const modeRows = modeKeys.map((mode) => {
    const b = Number(before[mode] ?? 0);
    const a = Number(after[mode] ?? 0);
    return {
      mode,
      before: b,
      after: a,
      delta: a - b,
      fill: modeColors[mode] || "#96C2EF",
    };
  });
  const maxShare = Math.max(1, ...modeRows.flatMap((r) => [r.before, r.after]));

  return (
    <MockPlotFrame isMock={isMock}>
    <div className="space-y-3 px-0.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold text-[#E9E2FF]/85">Mode share — before vs after</p>
        <div className="flex items-center gap-3 text-[9px] uppercase tracking-wide text-[#E9E2FF]/45">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-1.5 w-3 rounded-full bg-[#96C2EF]/55" />
            Baseline
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-1.5 w-3 rounded-full bg-[#96C2EF]" />
            Intervention
          </span>
        </div>
      </div>
      <div className="grid grid-cols-[1fr_1fr] gap-2 mb-0.5">
        <p className="text-[9px] uppercase tracking-wide text-[#E9E2FF]/35">Baseline</p>
        <p className="text-[9px] uppercase tracking-wide text-[#E9E2FF]/35">Intervention</p>
      </div>
      <div className="space-y-2">
        {modeRows.map((row) => {
          const selected = !!(hasKeys && chartSelectionKeys?.includes(row.mode));
          const dim = !!(hasKeys && !selected);
          return (
            <button
              key={row.mode}
              type="button"
              className="w-full text-left"
              style={{ opacity: dim ? 0.4 : 1 }}
              onClick={() => onChartDrill?.({ source: "kpi2.1", key: row.mode })}
            >
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <span
                  className="text-[11px] font-semibold"
                  style={{ color: selected ? TICK_STRONG : TICK }}
                >
                  {row.mode}
                </span>
                <span className="text-[10px] tabular-nums text-[#E9E2FF]/70">
                  {row.before.toFixed(1)}% → {row.after.toFixed(1)}%{" "}
                  <span style={{ color: row.delta >= 0 ? "#B0EDBA" : "#f87171", fontWeight: 700 }}>
                    {row.delta >= 0 ? "+" : ""}
                    {row.delta.toFixed(1)} pp
                  </span>
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(row.before / maxShare) * 100}%`,
                      background: row.fill,
                      opacity: Math.max(0.35, Math.min(1, 0.35 + (row.before / maxShare) * 0.65)),
                    }}
                  />
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(row.after / maxShare) * 100}%`,
                      background: row.fill,
                      opacity: Math.max(0.35, Math.min(1, 0.35 + (row.after / maxShare) * 0.65)),
                    }}
                  />
                </div>
              </div>
            </button>
          );
        })}
      </div>
      {hasSpeed && (
        <div className="rounded-lg border border-white/15 bg-white/[0.04] px-2.5 py-2">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-[10px] font-semibold text-[#E9E2FF]/85">Avg speed — before vs after</p>
            <span className="text-[9px] text-amber-200/80">Derived from motor mix</span>
          </div>
          <div className="flex items-end justify-between gap-3">
            <div className="flex-1">
              <p className="text-[9px] uppercase text-[#E9E2FF]/40 mb-1">Baseline</p>
              <p className="text-lg font-bold tabular-nums text-white/90">{speedBefore.toFixed(1)} km/h</p>
            </div>
            <div className="flex-1 text-right">
              <p className="text-[9px] uppercase text-[#E9E2FF]/40 mb-1">Intervention</p>
              <p className="text-lg font-bold tabular-nums text-[#96C2EF]">{speedAfter.toFixed(1)} km/h</p>
            </div>
          </div>
          <p className="text-[10px] mt-1.5 tabular-nums" style={{ color: speedAfter - speedBefore >= 0 ? "#B0EDBA" : "#f87171" }}>
            {speedAfter - speedBefore >= 0 ? "+" : ""}
            {(speedAfter - speedBefore).toFixed(1)} km/h
          </p>
        </div>
      )}
    </div>
    </MockPlotFrame>
  );
};

export const SafetyRadarChart = ({
  data,
  chartSelectionKeys,
  onChartDrill,
}: Pick<KPIChartProps, "data" | "chartSelectionKeys" | "onChartDrill"> &
  Omit<KPIChartProps, "kpiId" | "cityName">) => {
  const resolved = resolveChartBreakdown("kpi2.1", data);
  const breakdown = resolved.breakdown;
  const keys = Object.keys(breakdown);
  const chartData = keys.map((k) => ({
    subject: k.length > 14 ? `${k.slice(0, 12)}…` : k,
    fullSubject: k,
    value: Number(breakdown[k]) || 0,
  }));
  const maxValue = chartData.length ? Math.max(...chartData.map((d) => d.value), 0) : 0;
  const radiusMax = Math.max(5, Math.ceil(maxValue * 10) / 10);
  const hasKeys = !!(chartSelectionKeys && chartSelectionKeys.length > 0);

  // Radar needs ≥3 axes and star-rating-ish scale. Observed Helsinki pressure /
  // hazard-mix shares are better as horizontal bars (1-axis radar looks blank).
  const useBarFallback = chartData.length < 3 || maxValue > 5;
  if (useBarFallback) {
    const barData = chartData.map((d, i) => ({
      category: d.subject,
      fullLabel: d.fullSubject,
      value: d.value,
      fill: ["#657DF5", "#8578C3", "#96C2EF", "#B0EDBA"][i % 4],
    }));
    const handleBarPlotClick = (state: unknown) => {
      if (!onChartDrill) return;
      const payload = payloadFromChartClick<{ fullLabel?: string }>(state);
      if (payload?.fullLabel) onChartDrill({ source: "kpi2.1", key: payload.fullLabel });
    };
    return (
      <MockPlotFrame isMock={resolved.isMock}>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart
          data={barData}
          layout="vertical"
          margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
          style={{ cursor: onChartDrill ? "pointer" : undefined }}
          onClick={onChartDrill ? handleBarPlotClick : undefined}
        >
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="category"
            width={100}
            tick={{ fill: TICK, fontSize: 10, fontWeight: 600 }}
            stroke="transparent"
          />
          <Tooltip
            formatter={(v: number) => [v, maxValue > 5 ? "Reports" : "Rating"]}
            labelFormatter={(l, p) => (p?.[0]?.payload?.fullLabel as string) || String(l)}
            contentStyle={TOOLTIP_STYLE}
            labelStyle={TOOLTIP_LABEL_STYLE}
            itemStyle={TOOLTIP_ITEM_STYLE}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} label={{ position: "right", fill: TICK_STRONG, fontSize: 10 }}>
            {barData.map((e, i) => {
              const selected = !!(hasKeys && chartSelectionKeys?.includes(e.fullLabel));
              const dim = !!(hasKeys && !selected);
              return (
                <Cell
                  key={`s-${i}`}
                  fill={e.fill}
                  opacity={dim ? 0.35 : 1}
                  stroke={selected ? "#fff" : "transparent"}
                  strokeWidth={selected ? 2 : 0}
                />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      </MockPlotFrame>
    );
  }

  return (
      <MockPlotFrame isMock={resolved.isMock}>
      <ResponsiveContainer width="100%" height={200} className="insight-radar-chart">
      <RadarChart
        cx="50%"
        cy="52%"
        outerRadius="72%"
        data={chartData}
        style={{ cursor: onChartDrill ? "pointer" : undefined, background: "transparent" }}
      >
        <PolarGrid stroke={GRID} />
        <PolarAngleAxis
          dataKey="subject"
          tick={(props: { x?: number; y?: number; payload?: { value?: string }; textAnchor?: string; index?: number }) => {
            const i =
              typeof props.index === "number"
                ? props.index
                : chartData.findIndex((d) => d.subject === props.payload?.value);
            const entry = chartData[i] ?? chartData[0];
            const full = entry?.fullSubject ?? props.payload?.value ?? "";
            const selected = !!(hasKeys && full && chartSelectionKeys?.includes(full));
            const dim = !!(hasKeys && full && chartSelectionKeys && !chartSelectionKeys.includes(full));
            const x = props.x ?? 0;
            const y = props.y ?? 0;
            const ta = (props.textAnchor as "start" | "middle" | "end") || "middle";
            return (
              <text
                x={x}
                y={y}
                dy={4}
                textAnchor={ta}
                fill={dim ? `${TICK}99` : selected ? TICK_STRONG : TICK}
                fontSize={12}
                fontWeight={selected ? 800 : 600}
                className={onChartDrill ? "[&:hover]:fill-white [&:hover]:underline" : ""}
                role={onChartDrill ? "button" : undefined}
                tabIndex={onChartDrill ? 0 : undefined}
                onClick={(ev) => {
                  ev.stopPropagation();
                  if (full) onChartDrill?.({ source: "kpi2.1", key: full });
                }}
              >
                {props.payload?.value}
              </text>
            );
          }}
        />
        <PolarRadiusAxis angle={90} domain={[0, radiusMax]} tick={{ fill: TICK, fontSize: 12 }} />
        <Radar name="Safety" dataKey="value" stroke="#657DF5" fill="#657DF5" fillOpacity={hasKeys ? 0.55 : 0.35} strokeWidth={2} />
        <Tooltip
          formatter={(v: number) => [`${Number(v).toFixed(2)}`, "Rating"]}
          labelFormatter={(_, payload) =>
            payload && payload[0]?.payload?.fullSubject ? String((payload[0].payload as { fullSubject?: string }).fullSubject) : ""
          }
          contentStyle={TOOLTIP_STYLE}
          labelStyle={TOOLTIP_LABEL_STYLE}
          itemStyle={TOOLTIP_ITEM_STYLE}
        />
      </RadarChart>
    </ResponsiveContainer>
    </MockPlotFrame>
  );
};

export const InfrastructureBarChart = ({
  data,
  chartSelectionKeys,
  onChartDrill,
}: Pick<KPIChartProps, "data" | "chartSelectionKeys" | "onChartDrill"> &
  Omit<KPIChartProps, "kpiId" | "cityName">) => {
  const resolved = resolveChartBreakdown("kpi3.1", data);
  const breakdown = resolved.breakdown;
  const chartData = Object.entries(breakdown)
    .map(([name, value]) => ({
      name: name.length > 18 ? `${name.slice(0, 16)}…` : name,
      fullName: name,
      value: Number(value),
    }))
    .filter((row) => Number.isFinite(row.value) && row.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)
    .map((row, i) => ({
      ...row,
      fill: ["#ff4d4d", "#ffb300", "#fbbf24", "#00d2ff", "#a78bfa", "#38bdf8", "#34d399", "#f472b6", "#657DF5", "#94a3b8"][
        i % 10
      ],
    }));
  const hasKeys = !!(chartSelectionKeys && chartSelectionKeys.length > 0);
  const drillFromBar = (entry: { fullName?: string } | undefined) => {
    if (!onChartDrill || !entry?.fullName) return;
    onChartDrill({ source: "kpi3.1", key: entry.fullName });
  };

  const handleBarPlotClick = (state: unknown) => {
    if (!onChartDrill) return;
    const payload = payloadFromChartClick<{ fullName?: string }>(state);
    drillFromBar(payload);
  };

  const useHorizontal = chartData.length > 5;

  return (
    <MockPlotFrame isMock={resolved.isMock}>
    <ResponsiveContainer width="100%" height={useHorizontal ? Math.max(200, chartData.length * 28) : 200}>
      <BarChart
        data={chartData}
        layout={useHorizontal ? "vertical" : "horizontal"}
        margin={
          useHorizontal
            ? { top: 8, right: 12, left: 8, bottom: 8 }
            : { top: 10, right: 8, left: 0, bottom: 36 }
        }
        style={{ cursor: onChartDrill ? "pointer" : undefined }}
        onClick={onChartDrill ? handleBarPlotClick : undefined}
      >
        {useHorizontal ? (
          <>
            <XAxis type="number" tick={{ fill: TICK, fontSize: 10 }} stroke={GRID} />
            <YAxis
              type="category"
              dataKey="name"
              width={92}
              tick={{ fill: TICK, fontSize: 10, fontWeight: 600 }}
              stroke={GRID}
            />
          </>
        ) : (
          <>
            <XAxis
              dataKey="name"
              tick={{ fill: TICK, fontSize: 9, fontWeight: 600 }}
              stroke={GRID}
              angle={-25}
              textAnchor="end"
              height={50}
              interval={0}
            />
            <YAxis tick={{ fill: TICK, fontSize: 10 }} stroke={GRID} />
          </>
        )}
        <Tooltip
          formatter={(v: number) => [Number(v).toLocaleString(), "Count"]}
          labelFormatter={(l, p) => (p?.[0]?.payload?.fullName as string) || String(l)}
          contentStyle={TOOLTIP_STYLE}
          labelStyle={TOOLTIP_LABEL_STYLE}
          itemStyle={TOOLTIP_ITEM_STYLE}
        />
        <Bar
          dataKey="value"
          radius={useHorizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
          onClick={
            onChartDrill
              ? (entry) => drillFromBar(entry as { fullName?: string })
              : undefined
          }
        >
          {chartData.map((e, i) => {
            const selected = !!(hasKeys && chartSelectionKeys?.includes(e.fullName));
            const dim = !!(hasKeys && !selected);
            return (
              <Cell key={`i-${i}`} fill={e.fill} opacity={dim ? 0.35 : 1} stroke={selected ? "#fff" : "transparent"} strokeWidth={selected ? 2 : 0} />
            );
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
    </MockPlotFrame>
  );
};

export const EmissionsLineChart = ({
  data,
  chartSelectionKeys,
  onChartDrill,
}: Pick<KPIChartProps, "data" | "chartSelectionKeys" | "onChartDrill"> &
  Omit<KPIChartProps, "kpiId" | "cityName">) => {
  const rawSeries = data.timeSeries || [];
  const isMock = rawSeries.length === 0;
  const timeSeries = isMock ? mockTimeSeries(data) : rawSeries;
  const chartData = timeSeries.map((t) => ({ year: String(t.year), intensity: Number(t.value) }));

  const minY = chartData.length ? Math.min(...chartData.map((d) => d.intensity)) * 0.95 : 60;
  const maxY = chartData.length ? Math.max(...chartData.map((d) => d.intensity)) * 1.05 : 105;

  const hasKeys = !!(chartSelectionKeys && chartSelectionKeys.length > 0);

  const handleLinePlotClick = (state: unknown) => {
    if (!onChartDrill) return;
    const payload = payloadFromChartClick<{ year?: string }>(state);
    if (payload?.year != null && String(payload.year).length > 0) {
      onChartDrill({ source: "kpi3.2", key: String(payload.year) });
    }
  };

  return (
    <MockPlotFrame isMock={isMock}>
    <ResponsiveContainer width="100%" height={200}>
      <LineChart
        data={chartData}
        margin={{ top: 10, right: 8, left: 0, bottom: 4 }}
        style={{ cursor: onChartDrill ? "pointer" : undefined }}
        onClick={onChartDrill ? handleLinePlotClick : undefined}
      >
        <XAxis dataKey="year" tick={{ fill: TICK, fontSize: 10, fontWeight: 600 }} stroke={GRID} />
        <YAxis domain={[Math.floor(minY), Math.ceil(maxY)]} tick={{ fill: TICK, fontSize: 10 }} tickFormatter={(v) => `${v}%`} stroke={GRID} />
        <Tooltip
          formatter={(v: number) => [`${v.toFixed(1)}% intensity`, `Reduction ~${(100 - v).toFixed(1)}%`]}
          contentStyle={TOOLTIP_STYLE}
          labelStyle={TOOLTIP_LABEL_STYLE}
          itemStyle={TOOLTIP_ITEM_STYLE}
        />
        <ReferenceLine y={100} stroke="#E02020" strokeDasharray="4 4" label={{ value: "Baseline", fill: TICK_STRONG, fontSize: 10 }} />
        {/* Let pointer events reach the Line/dots underneath (Area fill was stealing clicks). */}
        <Area
          type="monotone"
          dataKey="intensity"
          stroke="none"
          fillOpacity={0.35}
          fill="#10B981"
          isAnimationActive={false}
          style={{ pointerEvents: "none" }}
        />
        <Line
          type="monotone"
          dataKey="intensity"
          stroke="#10B981"
          strokeWidth={2}
          isAnimationActive={false}
          dot={(dotProps: { cx?: number; cy?: number; payload?: { year: string; intensity: number } }) => {
            const { cx, cy, payload } = dotProps;
            if (cx == null || cy == null || !payload?.year) return <g />;
            const selected = !!(hasKeys && chartSelectionKeys?.includes(payload.year));
            const dim = !!(hasKeys && !selected);
            const drill = () => onChartDrill?.({ source: "kpi3.2", key: payload.year });
            return (
              <g
                key={payload.year}
                style={{ cursor: onChartDrill ? "pointer" : undefined }}
              >
                <circle
                  cx={cx}
                  cy={cy}
                  r={14}
                  fill="transparent"
                  onClick={(e) => {
                    e.stopPropagation();
                    drill();
                  }}
                />
                <circle
                  cx={cx}
                  cy={cy}
                  r={selected ? 6 : 4}
                  fill={dim ? "#10B98155" : "#10B981"}
                  stroke={selected ? "#fff" : "#065f46"}
                  strokeWidth={selected ? 2 : 1}
                  style={{ pointerEvents: "none" }}
                />
              </g>
            );
          }}
        />
      </LineChart>
    </ResponsiveContainer>
    </MockPlotFrame>
  );
};

export const SatisfactionGaugeChart = ({ data }: { data: KPIValue }) => {
  const resolved = resolveChartBreakdown("kpi4.1", data);
  const breakdown = resolved.breakdown;
  const likertSlices = Object.entries(breakdown)
    .map(([name, value]) => {
      const score = Number(/^(\d+)/.exec(name)?.[1] ?? NaN);
      return {
        name,
        value: Number(value) || 0,
        score: Number.isFinite(score) ? score : undefined,
      };
    })
    .filter((s) => s.value > 0 && s.score && s.score >= 1 && s.score <= 7)
    .sort((a, b) => (a.score ?? 0) - (b.score ?? 0));

  if (likertSlices.length >= 3) {
    const colors = ["#ef4444", "#f97316", "#fbbf24", "#a3a3a3", "#84cc16", "#22c55e", "#15803d"];
    return (
      <ResponsiveContainer width="100%" height={200}>
        <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
          <Pie
            data={likertSlices}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={42}
            outerRadius={68}
            paddingAngle={1}
            stroke="rgba(0,0,0,0.35)"
          >
            {likertSlices.map((e, i) => (
              <Cell key={`ls-${i}`} fill={colors[(e.score ?? 1) - 1]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v: number, name: string) => [`${Number(v).toFixed(1)}%`, String(name)]}
            contentStyle={TOOLTIP_STYLE}
            labelStyle={TOOLTIP_LABEL_STYLE}
            itemStyle={TOOLTIP_ITEM_STYLE}
          />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  const pct = Math.max(0, Math.min(100, Number(data.mainValue) || 62));
  const rest = Math.max(0, 100 - pct);
  const pieData = [
    { name: "score", value: pct, fill: "#657DF5" },
    { name: "rest", value: rest, fill: "rgba(101,125,245,0.15)" },
  ];

  return (
    <MockPlotFrame isMock={resolved.isMock}>
    <ResponsiveContainer width="100%" height={180}>
      <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
        <Pie data={pieData} cx="50%" cy="50%" innerRadius={52} outerRadius={68} paddingAngle={0} dataKey="value" stroke="none">
          {pieData.map((e, i) => (
            <Cell key={`c-${i}`} fill={e.fill} stroke="transparent" />
          ))}
        </Pie>
        <text x="50%" y="46%" dominantBaseline="middle" textAnchor="middle" fill={TICK_STRONG} fontSize={22} fontWeight={700}>
          {pct.toFixed(0)}%
        </text>
        <text x="50%" y="61%" dominantBaseline="middle" textAnchor="middle" fill={TICK} fontSize={11}>
          Satisfaction index
        </text>
      </PieChart>
    </ResponsiveContainer>
    </MockPlotFrame>
  );
};

export const AccessibilityBarChart = ({
  data,
  chartSelectionKeys,
  onChartDrill,
  kpiId = "kpi4.2",
}: Pick<KPIChartProps, "data" | "chartSelectionKeys" | "onChartDrill" | "kpiId"> &
  Omit<KPIChartProps, "cityName"> & { kpiId?: string }) => {
  const resolved = resolveChartBreakdown(kpiId === "kpi1.1" ? "kpi1.1" : "kpi4.2", data);
  const breakdown = resolved.breakdown;
  const chartData = Object.entries(breakdown)
    .map(([category, raw], i) => ({
      category: category.length > 18 ? `${category.slice(0, 16)}…` : category,
      fullLabel: category,
      value: Number(raw),
      fill: ["#657DF5", "#8578C3", "#96C2EF", "#B0EDBA"][i % 4],
    }))
    .filter((row) => Number.isFinite(row.value) && row.value > 0);
  const hasKeys = !!(chartSelectionKeys && chartSelectionKeys.length > 0);
  const handleBarPlotClick = (state: unknown) => {
    if (!onChartDrill) return;
    const payload = payloadFromChartClick<{ fullLabel?: string }>(state);
    if (payload?.fullLabel) onChartDrill({ source: "kpi4.2", key: payload.fullLabel });
  };

  const chartKey = chartData.map((d) => `${d.fullLabel}:${d.value}`).join("|");

  return (
    <MockPlotFrame isMock={resolved.isMock}>
    <ResponsiveContainer width="100%" height={180}>
      <BarChart
        key={chartKey}
        data={chartData}
        layout="vertical"
        margin={{ top: 4, right: 28, bottom: 4, left: 8 }}
        style={{ cursor: onChartDrill ? "pointer" : undefined }}
        onClick={onChartDrill ? handleBarPlotClick : undefined}
      >
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="category" width={100} tick={{ fill: TICK, fontSize: 10, fontWeight: 600 }} stroke="transparent" />
        <Tooltip
          formatter={(v: number) => [v, "Count"]}
          labelFormatter={(l, p) => (p?.[0]?.payload?.fullLabel as string) || String(l)}
          contentStyle={TOOLTIP_STYLE}
          labelStyle={TOOLTIP_LABEL_STYLE}
          itemStyle={TOOLTIP_ITEM_STYLE}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive={false}>
          {chartData.map((e, i) => {
            const selected = !!(hasKeys && chartSelectionKeys?.includes(e.fullLabel));
            const dim = !!(hasKeys && !selected);
            return (
              <Cell key={`a-${i}`} fill={e.fill} opacity={dim ? 0.35 : 1} stroke={selected ? "#fff" : "transparent"} strokeWidth={selected ? 2 : 0} />
            );
          })}
          <LabelList dataKey="value" position="right" fill={TICK_STRONG} fontSize={10} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
    </MockPlotFrame>
  );
};

const KPIChart = ({ kpiId, data, cityName, chartSelectionKeys, onChartDrill }: KPIChartProps) => {
  switch (kpiId) {
    case "kpi1.1":
      // Expansion readiness uses category totals, not mode-share keys.
      return <AccessibilityBarChart kpiId="kpi1.1" data={data} chartSelectionKeys={chartSelectionKeys} onChartDrill={onChartDrill} />;
    case "kpi1.2":
      return <ModeShareChart data={data} cityName={cityName} chartSelectionKeys={chartSelectionKeys} onChartDrill={onChartDrill} />;
    case "kpi2.1":
      return cityName === "Copenhagen" ? (
        <SafetyModeSpeedChart data={data} chartSelectionKeys={chartSelectionKeys} onChartDrill={onChartDrill} />
      ) : (
        <SafetyRadarChart data={data} cityName={cityName} chartSelectionKeys={chartSelectionKeys} onChartDrill={onChartDrill} />
      );
    case "kpi3.1":
      return <InfrastructureBarChart data={data} cityName={cityName} chartSelectionKeys={chartSelectionKeys} onChartDrill={onChartDrill} />;
    case "kpi3.2":
      return cityName === "Helsinki" ? (
        <ModeShareChart data={data} cityName={cityName} chartSelectionKeys={chartSelectionKeys} onChartDrill={onChartDrill} />
      ) : (
        <EmissionsLineChart data={data} cityName={cityName} chartSelectionKeys={chartSelectionKeys} onChartDrill={onChartDrill} />
      );
    case "kpi4.1":
      return <SatisfactionGaugeChart data={data} />;
    case "kpi4.2":
      return cityName === "Helsinki" ? (
        <InfrastructureBarChart data={data} cityName={cityName} chartSelectionKeys={chartSelectionKeys} onChartDrill={onChartDrill} />
      ) : (
        <AccessibilityBarChart data={data} chartSelectionKeys={chartSelectionKeys} onChartDrill={onChartDrill} />
      );
    default:
      return <ModeShareChart data={data} cityName={cityName} chartSelectionKeys={chartSelectionKeys} onChartDrill={onChartDrill} />;
  }
};

export default KPIChart;
