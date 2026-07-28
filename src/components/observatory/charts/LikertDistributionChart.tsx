import { OBS_C, obsGlassCardClass, obsGlassCardStyle } from "@/components/observatory/observatoryStyles";
import type { ObservatoryGraphicPayload } from "@/lib/observatoryGraphicTypes";

interface LikertDistributionChartProps {
  payload: ObservatoryGraphicPayload;
  compact?: boolean;
}

export function LikertDistributionChart({ payload, compact }: LikertDistributionChartProps) {
  const rows = payload.likert?.length
    ? payload.likert
    : payload.dataClass === "mock"
      ? [
          { label: "Strongly agree", value: 28 },
          { label: "Agree", value: 42 },
          { label: "Neutral", value: 18 },
          { label: "Disagree", value: 8 },
          { label: "Strongly disagree", value: 4 },
        ]
      : [];
  const max = Math.max(...rows.map((r) => r.value), 1);
  const title =
    payload.kpiId === "kpi2.1"
      ? "Perceived safety dimensions"
      : payload.kpiId === "kpi4.1"
        ? "Satisfaction dimensions"
        : payload.kpiId === "kpi4.2"
          ? "Accessibility dimensions"
          : "Survey distribution";

  return (
    <div className={obsGlassCardClass(compact)} style={obsGlassCardStyle()}>
      <p className="text-[11px] font-semibold text-white/70 mb-3">{title}</p>
      {rows.length === 0 ? (
        <p className="text-[10px] text-white/45 py-2">
          Survey Likert dimensions not linked for this selection.
        </p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((row, index) => (
            <div key={`${row.label}-${index}`} className="flex items-center gap-2">
              <span className="text-[9px] text-white/50 w-24 shrink-0 truncate">{row.label}</span>
              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: OBS_C.border }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(row.value / max) * 100}%`,
                    background: `linear-gradient(90deg, ${OBS_C.violet}, ${OBS_C.cyan})`,
                  }}
                />
              </div>
              <span className="text-[9px] text-white/45 w-8 text-right">{row.value.toFixed(0)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
