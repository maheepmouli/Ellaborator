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

function ChartEmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-[200px] items-center justify-center px-4 text-center text-[11px] font-medium leading-relaxed text-[#E9E2FF]/80">
      {message}
    </div>
  );
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
  const breakdown = data.breakdown || {};
  const allModes = ["Pedestrian", "Cycle", "Public Transport", "Private Car", "PTW"];
  const chartData = allModes.map((mode) => ({
    mode,
    value: breakdown[mode] || 0,
    fill: modeColors[mode] || "#96C2EF",
  }));
  const hasData = chartData.some((row) => row.value > 0);
  const hasKeys = !!(chartSelectionKeys && chartSelectionKeys.length > 0);

  if (!hasData) {
    return <ChartEmptyState message="No mode-share observations for the current pilot and filters." />;
  }

  const handleBarPlotClick = (state: unknown) => {
    if (!onChartDrill) return;
    const payload = payloadFromChartClick<{ mode?: string }>(state);
    if (payload?.mode) onChartDrill({ source: "kpi1.2", key: payload.mode });
  };

  return (
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
  );
};

export const SafetyRadarChart = ({
  data,
  chartSelectionKeys,
  onChartDrill,
}: Pick<KPIChartProps, "data" | "chartSelectionKeys" | "onChartDrill"> &
  Omit<KPIChartProps, "kpiId" | "cityName">) => {
  const breakdown = data.breakdown || {};
  const keys = Object.keys(breakdown);
  const chartData = keys.map((k) => ({
    subject: k.length > 14 ? `${k.slice(0, 12)}…` : k,
    fullSubject: k,
    value: Number(breakdown[k]) || 0,
  }));
  const hasData = chartData.some((d) => d.value > 0);
  const maxValue = chartData.length ? Math.max(...chartData.map((d) => d.value), 0) : 0;
  const radiusMax = Math.max(5, Math.ceil(maxValue * 10) / 10);
  const hasKeys = !!(chartSelectionKeys && chartSelectionKeys.length > 0);

  if (!hasData) {
    return (
      <ChartEmptyState message="No safety pressure breakdown linked for this pilot — select a camera direction or switch KPI." />
    );
  }

  return (
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
  );
};

export const InfrastructureBarChart = ({
  data,
  chartSelectionKeys,
  onChartDrill,
}: Pick<KPIChartProps, "data" | "chartSelectionKeys" | "onChartDrill"> &
  Omit<KPIChartProps, "kpiId" | "cityName">) => {
  const breakdown = data.breakdown || {};
  const chartData = Object.entries(breakdown).map(([name, value], i) => ({
    name: name.length > 16 ? `${name.slice(0, 14)}…` : name,
    fullName: name,
    value: Number(value),
    fill: ["#657DF5", "#8578C3", "#96C2EF", "#B0EDBA"][i % 4],
  }));
  const hasKeys = !!(chartSelectionKeys && chartSelectionKeys.length > 0);
  if (!chartData.length) {
    return <ChartEmptyState message="No infrastructure observations for the current pilot and segment." />;
  }
  const drillFromBar = (entry: { fullName?: string } | undefined) => {
    if (!onChartDrill || !entry?.fullName) return;
    onChartDrill({ source: "kpi3.1", key: entry.fullName });
  };

  const handleBarPlotClick = (state: unknown) => {
    if (!onChartDrill) return;
    const payload = payloadFromChartClick<{ fullName?: string }>(state);
    drillFromBar(payload);
  };

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart
        data={chartData}
        margin={{ top: 10, right: 8, left: 0, bottom: 36 }}
        style={{ cursor: onChartDrill ? "pointer" : undefined }}
        onClick={onChartDrill ? handleBarPlotClick : undefined}
      >
        <XAxis dataKey="name" tick={{ fill: TICK, fontSize: 9, fontWeight: 600 }} stroke={GRID} angle={-25} textAnchor="end" height={50} interval={0} />
        <YAxis tick={{ fill: TICK, fontSize: 10 }} stroke={GRID} />
        <Tooltip
          formatter={(v: number) => [Number(v).toLocaleString(), "Count"]}
          labelFormatter={(l, p) => (p?.[0]?.payload?.fullName as string) || String(l)}
          contentStyle={TOOLTIP_STYLE}
          labelStyle={TOOLTIP_LABEL_STYLE}
          itemStyle={TOOLTIP_ITEM_STYLE}
        />
        <Bar
          dataKey="value"
          radius={[4, 4, 0, 0]}
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
  );
};

export const EmissionsLineChart = ({
  data,
  chartSelectionKeys,
  onChartDrill,
}: Pick<KPIChartProps, "data" | "chartSelectionKeys" | "onChartDrill"> &
  Omit<KPIChartProps, "kpiId" | "cityName">) => {
  const timeSeries = data.timeSeries || [];
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
  );
};

export const SatisfactionGaugeChart = ({ data }: { data: KPIValue }) => {
  const pct = Math.max(0, Math.min(100, Number(data.mainValue)));
  const rest = Math.max(0, 100 - pct);
  const pieData = [
    { name: "score", value: pct, fill: "#657DF5" },
    { name: "rest", value: rest, fill: "rgba(101,125,245,0.15)" },
  ];

  return (
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
  );
};

export const AccessibilityBarChart = ({
  data,
  chartSelectionKeys,
  onChartDrill,
}: Pick<KPIChartProps, "data" | "chartSelectionKeys" | "onChartDrill"> &
  Omit<KPIChartProps, "kpiId" | "cityName">) => {
  const breakdown = data.breakdown || {};
  const chartData = Object.entries(breakdown).map(([category, raw], i) => ({
    category: category.length > 18 ? `${category.slice(0, 16)}…` : category,
    fullLabel: category,
    value: Number(raw),
    fill: ["#657DF5", "#8578C3", "#96C2EF", "#B0EDBA"][i % 4],
  }));
  const hasKeys = !!(chartSelectionKeys && chartSelectionKeys.length > 0);
  if (!chartData.length) {
    return <ChartEmptyState message="No accessibility features for the current pilot and segment." />;
  }
  const handleBarPlotClick = (state: unknown) => {
    if (!onChartDrill) return;
    const payload = payloadFromChartClick<{ fullLabel?: string }>(state);
    if (payload?.fullLabel) onChartDrill({ source: "kpi4.2", key: payload.fullLabel });
  };

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
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
        <Bar dataKey="value" radius={[0, 4, 4, 0]} label={{ position: "right", fill: TICK_STRONG, fontSize: 10 }}>
          {chartData.map((e, i) => {
            const selected = !!(hasKeys && chartSelectionKeys?.includes(e.fullLabel));
            const dim = !!(hasKeys && !selected);
            return (
              <Cell key={`a-${i}`} fill={e.fill} opacity={dim ? 0.35 : 1} stroke={selected ? "#fff" : "transparent"} strokeWidth={selected ? 2 : 0} />
            );
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

const KPIChart = ({ kpiId, data, cityName, chartSelectionKeys, onChartDrill }: KPIChartProps) => {
  switch (kpiId) {
    case "kpi1.2":
      return <ModeShareChart data={data} cityName={cityName} chartSelectionKeys={chartSelectionKeys} onChartDrill={onChartDrill} />;
    case "kpi2.1":
      return <SafetyRadarChart data={data} cityName={cityName} chartSelectionKeys={chartSelectionKeys} onChartDrill={onChartDrill} />;
    case "kpi3.1":
      return <InfrastructureBarChart data={data} cityName={cityName} chartSelectionKeys={chartSelectionKeys} onChartDrill={onChartDrill} />;
    case "kpi3.2":
      return <EmissionsLineChart data={data} cityName={cityName} chartSelectionKeys={chartSelectionKeys} onChartDrill={onChartDrill} />;
    case "kpi4.1":
      return <SatisfactionGaugeChart data={data} />;
    case "kpi4.2":
      return <AccessibilityBarChart data={data} cityName={cityName} chartSelectionKeys={chartSelectionKeys} onChartDrill={onChartDrill} />;
    default:
      return <ModeShareChart data={data} cityName={cityName} chartSelectionKeys={chartSelectionKeys} onChartDrill={onChartDrill} />;
  }
};

export default KPIChart;
