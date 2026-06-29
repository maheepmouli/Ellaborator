import { OBS_C, obsGlassCardClass, obsGlassCardStyle } from "@/components/observatory/observatoryStyles";
import type { ObservatoryGraphicPayload } from "@/lib/observatoryGraphicTypes";

interface LikertDistributionChartProps {
  payload: ObservatoryGraphicPayload;
  compact?: boolean;
}

export function LikertDistributionChart({ payload, compact }: LikertDistributionChartProps) {
  const rows = payload.likert?.length
    ? payload.likert
    : [
        { label: "Strongly agree", value: 28 },
        { label: "Agree", value: 42 },
        { label: "Neutral", value: 18 },
        { label: "Disagree", value: 8 },
        { label: "Strongly disagree", value: 4 },
      ];
  const max = Math.max(...rows.map((r) => r.value), 1);

  return (
    <div className={obsGlassCardClass(compact)} style={obsGlassCardStyle()}>
      <p className="text-[11px] font-semibold text-white/70 mb-3">Survey distribution</p>
      <div className="space-y-1.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-2">
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
    </div>
  );
}
