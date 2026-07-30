import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { OBS_C, obsGlassCardClass, obsGlassCardStyle } from "@/components/observatory/observatoryStyles";
import type { ObservatoryGraphicPayload } from "@/lib/observatoryGraphicTypes";

/** Likert 1–7 palette — Trikala smart-crossing baseline pie style (page 16 family). */
const LIKERT_COLORS = ["#ef4444", "#f97316", "#fbbf24", "#a3a3a3", "#84cc16", "#22c55e", "#15803d"];

interface SurveyPieChartProps {
  payload: ObservatoryGraphicPayload;
  compact?: boolean;
}

type Slice = { label: string; value: number; score?: number; fill: string };

function colorFor(score: number | undefined, index: number): string {
  if (score && score >= 1 && score <= 7) return LIKERT_COLORS[score - 1];
  return LIKERT_COLORS[index % LIKERT_COLORS.length];
}

export function SurveyPieChart({ payload, compact }: SurveyPieChartProps) {
  const [period, setPeriod] = useState<"after" | "before">("after");
  const dist = payload.surveyDistribution;
  const mockSlices: Slice[] = [
    { label: "1", value: 6, score: 1, fill: colorFor(1, 0) },
    { label: "2", value: 9, score: 2, fill: colorFor(2, 1) },
    { label: "3", value: 14, score: 3, fill: colorFor(3, 2) },
    { label: "4", value: 18, score: 4, fill: colorFor(4, 3) },
    { label: "5", value: 22, score: 5, fill: colorFor(5, 4) },
    { label: "6", value: 19, score: 6, fill: colorFor(6, 5) },
    { label: "7", value: 12, score: 7, fill: colorFor(7, 6) },
  ];
  const fallback = (payload.likert ?? []).map((r, i) => ({
    label: r.label,
    value: Number(r.value) || 0,
    score: Number(/^(\d+)/.exec(r.label)?.[1] ?? NaN) || undefined,
    fill: colorFor(Number(/^(\d+)/.exec(r.label)?.[1] ?? NaN) || undefined, i),
  }));

  const before: Slice[] = (dist?.before ?? []).map((r, i) => ({
    ...r,
    fill: colorFor(r.score, i),
  }));
  const after: Slice[] = (dist?.after ?? fallback).map((r, i) => ({
    ...r,
    fill: colorFor(r.score, i),
  }));

  const linkedActive = (period === "before" ? before : after).filter((s) => s.value > 0);
  const isMock = linkedActive.length === 0;
  const active = isMock ? mockSlices : linkedActive;
  const title =
    payload.kpiId === "kpi4.1"
      ? "Acceptability distribution (Likert 1–7)"
      : payload.kpiId === "kpi4.2"
        ? "Accessibility distribution (Likert 1–7)"
        : "Survey distribution";

  return (
    <div className={obsGlassCardClass(compact)} style={obsGlassCardStyle()}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-[11px] font-semibold text-white/70">{title}</p>
        <div className="flex items-center gap-2">
          {isMock ? (
            <span className="rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-violet-100 bg-violet-500/30 border border-violet-300/35">
              Mock plot
            </span>
          ) : null}
          {(before.length > 0 || after.length > 0) && (
          <div className="flex rounded-md overflow-hidden border border-white/15 text-[10px]">
            <button
              type="button"
              className={`px-2 py-0.5 ${period === "before" ? "bg-white/15 text-white" : "text-white/50"}`}
              onClick={() => setPeriod("before")}
            >
              Before
            </button>
            <button
              type="button"
              className={`px-2 py-0.5 ${period === "after" ? "bg-white/15 text-white" : "text-white/50"}`}
              onClick={() => setPeriod("after")}
            >
              After
            </button>
          </div>
          )}
        </div>
      </div>
      <div className={compact ? "h-[200px]" : "h-[240px]"}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={active}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={compact ? 36 : 44}
              outerRadius={compact ? 68 : 82}
              paddingAngle={1}
              stroke="rgba(0,0,0,0.35)"
              strokeWidth={1}
            >
              {active.map((e, i) => (
                <Cell key={`slice-${i}`} fill={e.fill} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v: number, name: string) => [`${Number(v).toFixed(1)}%`, String(name)]}
              contentStyle={{
                background: "rgba(12,16,28,0.95)",
                border: `1px solid ${OBS_C.border}`,
                borderRadius: 8,
                fontSize: 11,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-1">
        {active.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 min-w-0">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ background: s.fill }} />
            <span className="text-[9px] text-white/55 truncate">
              {s.score ?? s.label}: {s.value.toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
      {payload.sourceLabel ? (
        <p className="mt-2 text-[9px] text-white/40 leading-relaxed">{payload.sourceLabel}</p>
      ) : null}
    </div>
  );
}
