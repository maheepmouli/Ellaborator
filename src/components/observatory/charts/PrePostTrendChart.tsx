import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  Tooltip as RechTooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import { OBS_C, obsGlassCardClass, obsGlassCardStyle } from "@/components/observatory/observatoryStyles";
import type { ObservatoryGraphicPayload } from "@/lib/observatoryGraphicTypes";

interface PrePostTrendChartProps {
  payload: ObservatoryGraphicPayload;
  compact?: boolean;
}

function resolveBeforeAfter(payload: ObservatoryGraphicPayload): {
  before: number;
  after: number;
  label: string;
} | null {
  const active =
    payload.cameraDirections?.find((d) => d.id === payload.activeDirectionId) ??
    payload.cameraDirections?.[0];
  if (active) {
    return {
      before: active.baselinePct,
      after: active.interventionPct,
      label: `${active.site} · ${active.direction}`,
    };
  }

  const trend = payload.trend ?? [];
  if (trend.length >= 2) {
    const beforePt = trend.find((t) => /before|base/i.test(t.t)) ?? trend[0];
    const afterPt = trend.find((t) => /after|intervent|post/i.test(t.t)) ?? trend[trend.length - 1];
    return {
      before: Number(beforePt.v) || 0,
      after: Number(afterPt.v) || 0,
      label: "Before / after",
    };
  }

  if (typeof payload.kpiValue === "number" && Number.isFinite(payload.kpiValue)) {
    return { before: payload.kpiValue, after: payload.kpiValue, label: "Before / after" };
  }
  return null;
}

export function PrePostTrendChart({ payload, compact }: PrePostTrendChartProps) {
  const pair = resolveBeforeAfter(payload);
  const isMock = payload.dataClass === "mock";
  const delta = pair ? pair.after - pair.before : 0;
  const data = pair
    ? [
        { t: "Before", v: pair.before, fill: "rgba(148,163,184,0.85)" },
        { t: "After", v: pair.after, fill: OBS_C.cyan },
      ]
    : [];

  return (
    <div
      className={`${obsGlassCardClass(compact)} relative z-10 pointer-events-auto`}
      style={obsGlassCardStyle()}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-[11px] font-semibold text-white/70">
          {pair?.label ?? "Before / after"}
        </p>
        {isMock && (
          <span className="text-[9px] font-bold tracking-wide text-amber-200/90 px-1.5 py-0.5 rounded border border-amber-400/30 bg-amber-500/10">
            MOCK
          </span>
        )}
      </div>
      <div
        className={`${compact ? "h-32" : "h-40"} w-full cursor-crosshair`}
        style={{ pointerEvents: "auto", touchAction: "manipulation" }}
      >
        {data.length ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }} barCategoryGap="28%">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis dataKey="t" tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis hide domain={[0, "auto"]} />
              <Bar dataKey="v" radius={[6, 6, 0, 0]} isAnimationActive={false}>
                {data.map((entry) => (
                  <Cell key={entry.t} fill={entry.fill} />
                ))}
              </Bar>
              <RechTooltip
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                contentStyle={{
                  background: "rgba(10,8,28,0.95)",
                  border: `1px solid ${OBS_C.border}`,
                  borderRadius: 6,
                  fontSize: 10,
                  color: "#fff",
                  pointerEvents: "none",
                }}
                formatter={(value: number | string) => [`${Number(value).toFixed(1)}`, "Value"]}
                labelFormatter={(label) => String(label)}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-[10px] text-white/45 h-full flex items-center justify-center">
            Before / after values not available for this selection.
          </p>
        )}
      </div>
      {pair && (
        <p className="text-[10px] text-white/50 mt-1">
          Before {pair.before.toFixed(1)} → After {pair.after.toFixed(1)}
          {Number.isFinite(delta) ? (
            <span style={{ color: delta >= 0 ? OBS_C.lime : "#f87171" }}>
              {" "}
              ({delta >= 0 ? "+" : ""}
              {delta.toFixed(1)})
            </span>
          ) : null}
        </p>
      )}
    </div>
  );
}
