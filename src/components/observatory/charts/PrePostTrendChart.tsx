import {
  ResponsiveContainer,
  LineChart,
  Line,
  Tooltip as RechTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { OBS_C, obsGlassCardClass, obsGlassCardStyle } from "@/components/observatory/observatoryStyles";
import type { ObservatoryGraphicPayload } from "@/lib/observatoryGraphicTypes";

interface PrePostTrendChartProps {
  payload: ObservatoryGraphicPayload;
  compact?: boolean;
}

export function PrePostTrendChart({ payload, compact }: PrePostTrendChartProps) {
  const active =
    payload.cameraDirections?.find((d) => d.id === payload.activeDirectionId) ??
    payload.cameraDirections?.[0];
  const data = active?.trend ?? payload.trend ?? [];
  const hasTrend = data.length >= 2 && data.every((d) => Number.isFinite(d.v));

  return (
    <div
      className={`${obsGlassCardClass(compact)} relative z-10 pointer-events-auto`}
      style={obsGlassCardStyle()}
    >
      <p className="text-[11px] font-semibold text-white/70 mb-2">
        {active ? `${active.site} · ${active.direction}` : "Pre / post trend"}
      </p>
      <div
        className={`${compact ? "h-28" : "h-36"} w-full cursor-crosshair`}
        style={{ pointerEvents: "auto", touchAction: "manipulation" }}
      >
        {hasTrend ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
              <XAxis dataKey="t" tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }} />
              <YAxis hide domain={[0, "auto"]} />
              <Line
                type="monotone"
                dataKey="v"
                stroke={OBS_C.cyan}
                strokeWidth={2}
                dot={{ r: 3, fill: OBS_C.cyan, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: "#fff", stroke: OBS_C.cyan, strokeWidth: 2 }}
                isAnimationActive={false}
              />
              <RechTooltip
                cursor={{ stroke: "rgba(255,255,255,0.25)", strokeWidth: 1 }}
                contentStyle={{
                  background: "rgba(10,8,28,0.95)",
                  border: `1px solid ${OBS_C.border}`,
                  borderRadius: 6,
                  fontSize: 10,
                  color: "#fff",
                  pointerEvents: "none",
                }}
                formatter={(value: number | string) => [`${Number(value).toFixed(1)}%`, "Share"]}
                labelFormatter={(label) => String(label)}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-[10px] text-white/45 h-full flex items-center justify-center">
            Not enough trend points for this direction.
          </p>
        )}
      </div>
      {active && (
        <p className="text-[10px] text-white/50 mt-1">
          Pre {active.baselinePct.toFixed(0)}% → Post {active.interventionPct.toFixed(0)}%
        </p>
      )}
      {!active && hasTrend ? (
        <p className="text-[10px] text-white/45 mt-1">Hover points for monthly sustainable-mode share</p>
      ) : null}
    </div>
  );
}
