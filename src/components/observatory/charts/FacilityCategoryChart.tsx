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
      : payload.kpiId === "kpi4.2"
        ? "Accessibility dimensions"
        : payload.kpiId === "kpi3.1"
          ? payload.sourceLabel?.toLowerCase().includes("milan") ||
            payload.sourceLabel?.toLowerCase().includes("zero-emission")
            ? "Facility sites by type (mock)"
            : payload.sourceLabel?.toLowerCase().includes("kallio") ||
                payload.sourceLabel?.toLowerCase().includes("scooter")
              ? "Parking observations by category"
              : "Parking bay types (I100275)"
          : "Category breakdown";

  if (!categories.length) {
    const mockCats = [
      { label: "Cycle parking", value: 2 },
      { label: "Charging", value: 1 },
      { label: "Shared mobility", value: 1 },
      { label: "Pedestrian", value: 1 },
      { label: "Parking", value: 1 },
    ];
    const maxMock = Math.max(...mockCats.map((c) => c.value), 1);
    return (
      <div className={obsGlassCardClass(compact)} style={obsGlassCardStyle()}>
        <p className="text-[11px] font-semibold text-white/70 mb-2">{title}</p>
        <div className="space-y-2">
          {mockCats.map((cat) => (
            <div key={cat.label}>
              <div className="flex justify-between text-[10px] text-white/50 mb-0.5">
                <span>{cat.label}</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: OBS_C.border }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(cat.value / maxMock) * 100}%`,
                    background: OBS_C.cyan,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const hideEndValues = payload.kpiId === "kpi4.1" || payload.kpiId === "kpi4.2";

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
                {!hideEndValues ? <span>{cat.value}</span> : null}
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
