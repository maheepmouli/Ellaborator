import { OBS_C, obsGlassCardClass, obsGlassCardStyle } from "@/components/observatory/observatoryStyles";
import type { ObservatoryGraphicPayload } from "@/lib/observatoryGraphicTypes";

const DEFAULT_CATEGORIES = [
  { label: "Cycle parking", value: 72 },
  { label: "Charging", value: 45 },
  { label: "Shared mobility", value: 38 },
  { label: "Pedestrian", value: 55 },
];

interface FacilityCategoryChartProps {
  payload: ObservatoryGraphicPayload;
  compact?: boolean;
}

export function FacilityCategoryChart({ payload, compact }: FacilityCategoryChartProps) {
  const categories =
    payload.likert?.length && payload.kpiId === "kpi3.1"
      ? payload.likert.map((l) => ({ label: l.label, value: l.value }))
      : DEFAULT_CATEGORIES;
  const max = Math.max(...categories.map((c) => c.value), 1);

  return (
    <div className={obsGlassCardClass(compact)} style={obsGlassCardStyle()}>
      <p className="text-[11px] font-semibold text-white/70 mb-3">Facility categories</p>
      <div className="space-y-2">
        {categories.map((cat) => (
          <div key={cat.label}>
            <div className="flex justify-between text-[10px] text-white/50 mb-0.5">
              <span>{cat.label}</span>
              <span>{cat.value}</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: OBS_C.border }}>
              <div
                className="h-full rounded-full"
                style={{ width: `${(cat.value / max) * 100}%`, background: OBS_C.cyan }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
