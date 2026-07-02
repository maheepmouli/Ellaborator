import { OBS_C, obsGlassCardClass, obsGlassCardStyle } from "@/components/observatory/observatoryStyles";
import type { ObservatoryGraphicPayload } from "@/lib/observatoryGraphicTypes";
import { PrePostTrendChart } from "@/components/observatory/charts/PrePostTrendChart";

interface DirectionBreakdownPanelProps {
  payload: ObservatoryGraphicPayload;
  compact?: boolean;
  onSelectDirection?: (id: string) => void;
}

export function DirectionBreakdownPanel({
  payload,
  compact,
  onSelectDirection,
}: DirectionBreakdownPanelProps) {
  const rows = payload.cameraDirections ?? [];
  const activeId = payload.activeDirectionId;

  if (!rows.length) {
    return (
      <div className={obsGlassCardClass(compact)} style={obsGlassCardStyle()}>
        <p className="text-[11px] text-white/60">No directional camera observations linked.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {!compact && <PrePostTrendChart payload={payload} compact />}
      <div className={obsGlassCardClass(compact)} style={obsGlassCardStyle()}>
        <p className="text-[11px] font-semibold text-white/70 mb-2">Camera directions</p>
        <div className="space-y-1.5 max-h-40 overflow-y-auto">
          {rows.map((row, index) => (
            <button
              key={`${row.id}-${index}`}
              type="button"
              onClick={() => onSelectDirection?.(row.id)}
              className={`w-full text-left rounded-lg border px-2 py-1.5 text-[10px] ${
                activeId === row.id
                  ? "border-cyan-400/50 bg-cyan-500/10"
                  : "border-white/15 bg-white/[0.03]"
              }`}
            >
              <p className="font-medium text-white/88">{row.direction}</p>
              <p className="text-white/55">{row.site}</p>
              <p className="text-white/65">
                Pre {row.baselinePct.toFixed(0)}% → Post {row.interventionPct.toFixed(0)}%
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
