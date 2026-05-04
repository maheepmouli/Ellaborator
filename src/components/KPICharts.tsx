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
} from "recharts";
import type { KPIValue } from "@/data/kpiDefinitions";

interface KPIChartProps {
  kpiId: string;
  data: KPIValue;
  cityName: string;
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

const modeColors: Record<string, string> = {
  Pedestrian: "#B0EDBA",
  Cycle: "#96C2EF",
  "Public Transport": "#657DF5",
  "Private Car": "#8578C3",
  PTW: "#2F1B6D",
};

export const ModeShareChart = ({ data }: { data: KPIValue; cityName: string }) => {
  const breakdown = data.breakdown || {};
  const allModes = ["Pedestrian", "Cycle", "Public Transport", "Private Car", "PTW"];
  const chartData = allModes.map((mode) => ({
    mode,
    value: breakdown[mode] || 0,
    fill: modeColors[mode] || "#96C2EF",
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
        <XAxis type="number" domain={[0, 100]} tick={{ fill: TICK, fontSize: 10 }} tickFormatter={(v) => `${v}%`} stroke={GRID} />
        <YAxis type="category" dataKey="mode" tick={{ fill: TICK, fontSize: 11, fontWeight: 600 }} width={118} stroke="transparent" />
        <Tooltip
          formatter={(v: number) => [`${v.toFixed(1)}%`, "Share"]}
          contentStyle={TOOLTIP_STYLE}
          labelStyle={TOOLTIP_LABEL_STYLE}
          itemStyle={TOOLTIP_ITEM_STYLE}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} label={{ fill: TICK_STRONG, fontSize: 10, position: "right", formatter: (v: unknown) => (Number(v) > 0 ? `${Number(v).toFixed(1)}%` : "") }}>
          {chartData.map((_, i) => (
            <Cell key={i} fill={chartData[i].fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

export const SafetyRadarChart = ({ data }: { data: KPIValue }) => {
  const breakdown = data.breakdown || {};
  const keys = Object.keys(breakdown);
  const chartData = keys.map((k) => ({
    subject: k.length > 14 ? `${k.slice(0, 12)}…` : k,
    fullSubject: k,
    value: Number(breakdown[k]) || 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <RadarChart cx="50%" cy="52%" outerRadius="72%" data={chartData}>
        <PolarGrid stroke={GRID} />
        <PolarAngleAxis dataKey="subject" tick={{ fill: TICK, fontSize: 9, fontWeight: 600 }} />
        <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fill: TICK, fontSize: 9 }} />
        <Radar name="Safety" dataKey="value" stroke="#657DF5" fill="#657DF5" fillOpacity={0.35} strokeWidth={2} />
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

export const InfrastructureBarChart = ({ data }: { data: KPIValue }) => {
  const breakdown = data.breakdown || {};
  const chartData = Object.entries(breakdown).map(([name, value], i) => ({
    name: name.length > 16 ? `${name.slice(0, 14)}…` : name,
    fullName: name,
    value: Number(value),
    fill: ["#657DF5", "#8578C3", "#96C2EF", "#B0EDBA"][i % 4],
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} margin={{ top: 10, right: 8, left: 0, bottom: 36 }}>
        <XAxis dataKey="name" tick={{ fill: TICK, fontSize: 9, fontWeight: 600 }} stroke={GRID} angle={-25} textAnchor="end" height={50} interval={0} />
        <YAxis tick={{ fill: TICK, fontSize: 10 }} stroke={GRID} />
        <Tooltip
          formatter={(v: number) => [Number(v).toLocaleString(), "Count"]}
          labelFormatter={(l, p) => (p?.[0]?.payload?.fullName as string) || String(l)}
          contentStyle={TOOLTIP_STYLE}
          labelStyle={TOOLTIP_LABEL_STYLE}
          itemStyle={TOOLTIP_ITEM_STYLE}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {chartData.map((e, i) => (
            <Cell key={`i-${i}`} fill={e.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

export const EmissionsLineChart = ({ data }: { data: KPIValue }) => {
  const timeSeries = data.timeSeries || [];
  const chartData = timeSeries.map((t) => ({ year: String(t.year), intensity: Number(t.value) }));

  const minY = chartData.length ? Math.min(...chartData.map((d) => d.intensity)) * 0.95 : 60;
  const maxY = chartData.length ? Math.max(...chartData.map((d) => d.intensity)) * 1.05 : 105;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={chartData} margin={{ top: 10, right: 8, left: 0, bottom: 4 }}>
        <XAxis dataKey="year" tick={{ fill: TICK, fontSize: 10, fontWeight: 600 }} stroke={GRID} />
        <YAxis domain={[Math.floor(minY), Math.ceil(maxY)]} tick={{ fill: TICK, fontSize: 10 }} tickFormatter={(v) => `${v}%`} stroke={GRID} />
        <Tooltip
          formatter={(v: number) => [`${v.toFixed(1)}% intensity`, `Reduction ~${(100 - v).toFixed(1)}%`]}
          contentStyle={TOOLTIP_STYLE}
          labelStyle={TOOLTIP_LABEL_STYLE}
          itemStyle={TOOLTIP_ITEM_STYLE}
        />
        <ReferenceLine y={100} stroke="#E02020" strokeDasharray="4 4" label={{ value: "Baseline", fill: TICK_STRONG, fontSize: 10 }} />
        <Area type="monotone" dataKey="intensity" stroke="#10B981" fillOpacity={0.35} fill="#10B981" />
        <Line type="monotone" dataKey="intensity" stroke="#10B981" strokeWidth={2} dot={{ fill: "#10B981", strokeWidth: 2 }} />
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

export const AccessibilityBarChart = ({ data }: { data: KPIValue }) => {
  const breakdown = data.breakdown || {};
  const chartData = Object.entries(breakdown).map(([category, raw], i) => ({
    category: category.length > 18 ? `${category.slice(0, 16)}…` : category,
    fullLabel: category,
    value: Number(raw),
    fill: ["#657DF5", "#8578C3", "#96C2EF", "#B0EDBA"][i % 4],
  }));

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
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
          {chartData.map((e, i) => (
            <Cell key={`a-${i}`} fill={e.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

const KPIChart = ({ kpiId, data, cityName }: KPIChartProps) => {
  switch (kpiId) {
    case "kpi1.2":
      return <ModeShareChart data={data} cityName={cityName} />;
    case "kpi2.1":
      return <SafetyRadarChart data={data} />;
    case "kpi3.1":
      return <InfrastructureBarChart data={data} />;
    case "kpi3.2":
      return <EmissionsLineChart data={data} />;
    case "kpi4.1":
      return <SatisfactionGaugeChart data={data} />;
    case "kpi4.2":
      return <AccessibilityBarChart data={data} />;
    default:
      return <ModeShareChart data={data} cityName={cityName} />;
  }
};

export default KPIChart;
