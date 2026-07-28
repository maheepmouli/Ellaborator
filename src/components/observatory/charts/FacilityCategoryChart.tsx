import { OBS_C, obsGlassCardClass, obsGlassCardStyle } from "@/components/observatory/observatoryStyles";
import type { ObservatoryGraphicPayload } from "@/lib/observatoryGraphicTypes";
import { resolveParkingCategoryColor } from "@/lib/copenhagenMapLayers/copenhagenParkingLayerStyles";

interface FacilityCategoryChartProps {
  payload: ObservatoryGraphicPayload;
  compact?: boolean;
}

export function FacilityCategoryChart({ payload, compact }: FacilityCategoryChartProps) {
  const categories = (payload.likert ?? [])
    .map((l) => ({ label: l.label, value: Number(l.value) || 0 }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value);
  const max = Math.max(...categories.map((c) => c.value), 1);
  const title =
    payload.kpiId === "kpi2.1"
      ? "Hazard categories"
      : payload.kpiId === "kpi3.1" || payload.kpiId === "kpi4.2"
        ? payload.sourceLabel?.toLowerCase().includes("kallio") ||
          payload.sourceLabel?.toLowerCase().includes("scooter")
          ? "Parking observations by category"
          : payload.kpiId === "kpi4.2"
            ? "Category breakdown"
            : "Parking bay types (I100275)"
        : "Category breakdown";

  if (!categories.length) {
    return (
      <div className={obsGlassCardClass(compact)} style={obsGlassCardStyle()}>
        <p className="text-[11px] font-semibold text-white/70 mb-2">{title}</p>
        <p className="text-[10px] text-white/45 leading-relaxed">
          {payload.spec.emptyState ||
            "No parking inventory categories for this selection — load I100275 bay types or clear segment focus."}
        </p>
      </div>
    );
  }

  return (
    <div className={obsGlassCardClass(compact)} style={obsGlassCardStyle()}>
      <p className="text-[11px] font-semibold text-white/70 mb-3">{title}</p>
      <div className="space-y-2">
        {categories.map((cat) => {
          const barColor =
            payload.kpiId === "kpi3.1" ? resolveParkingCategoryColor(cat.label) : OBS_C.cyan;
          return (
            <div key={cat.label}>
              <div className="flex justify-between text-[10px] text-white/50 mb-0.5">
                <span>{cat.label}</span>
                <span>{cat.value}</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: OBS_C.border }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(cat.value / max) * 100}%`, background: barColor }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
