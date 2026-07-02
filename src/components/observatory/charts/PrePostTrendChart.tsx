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
    <div className={obsGlassCardClass(compact)} style={obsGlassCardStyle()}>
      <p className="text-[11px] font-semibold text-white/70 mb-2">
        {active ? `${active.site} · ${active.direction}` : "Pre / post trend"}
      </p>
      <div className={compact ? "h-24" : "h-32"}>
        {hasTrend ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <XAxis dataKey="t" tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }} />
              <YAxis hide domain={[0, 100]} />
              <Line type="monotone" dataKey="v" stroke={OBS_C.cyan} strokeWidth={2} dot />
              <RechTooltip
                contentStyle={{
                  background: "rgba(10,8,28,0.95)",
                  border: `1px solid ${OBS_C.border}`,
                  borderRadius: 6,
                  fontSize: 10,
                  color: "#fff",
                }}
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
    </div>
  );
}
