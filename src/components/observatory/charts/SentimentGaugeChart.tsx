import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { OBS_C, obsGlassCardClass, obsGlassCardStyle } from "@/components/observatory/observatoryStyles";
import type { ObservatoryGraphicPayload } from "@/lib/observatoryGraphicTypes";

interface SentimentGaugeChartProps {
  payload: ObservatoryGraphicPayload;
  compact?: boolean;
}

export function SentimentGaugeChart({ payload, compact }: SentimentGaugeChartProps) {
  const pct = Math.max(0, Math.min(100, Number(payload.kpiValue ?? 0)));
  const rest = Math.max(0, 100 - pct);
  const pieData = [
    { name: "score", value: pct, fill: OBS_C.violet },
    { name: "rest", value: rest, fill: "rgba(101,125,245,0.15)" },
  ];
  const isMock = payload.dataClass === "mock";
  const label =
    payload.kpiId === "kpi4.2"
      ? "Access index"
      : "Satisfaction index";
  const height = compact ? 160 : 200;

  return (
    <div className={`${obsGlassCardClass(compact)} w-full max-w-md mx-auto`} style={obsGlassCardStyle()}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="text-[11px] font-semibold text-white/70">
          {payload.kpiId === "kpi4.2" ? "Accessibility index" : "User satisfaction"}
        </p>
        {isMock && (
          <span className="text-[9px] font-bold tracking-wide text-amber-200/90 px-1.5 py-0.5 rounded border border-amber-400/30 bg-amber-500/10">
            MOCK
          </span>
        )}
      </div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={compact ? 46 : 52}
              outerRadius={compact ? 60 : 68}
              paddingAngle={0}
              dataKey="value"
              stroke="none"
              startAngle={90}
              endAngle={-270}
            >
              {pieData.map((entry, i) => (
                <Cell key={`gauge-${i}`} fill={entry.fill} stroke="transparent" />
              ))}
            </Pie>
            <text
              x="50%"
              y="46%"
              dominantBaseline="middle"
              textAnchor="middle"
              fill="#ffffff"
              fontSize={compact ? 20 : 22}
              fontWeight={700}
            >
              {pct.toFixed(0)}%
            </text>
            <text
              x="50%"
              y="61%"
              dominantBaseline="middle"
              textAnchor="middle"
              fill="rgba(255,255,255,0.65)"
              fontSize={11}
            >
              {label}
            </text>
          </PieChart>
        </ResponsiveContainer>
      </div>
      {isMock && payload.sourceLabel ? (
        <p className="text-[9px] text-white/40 leading-relaxed mt-1">{payload.sourceLabel}</p>
      ) : null}
    </div>
  );
}
