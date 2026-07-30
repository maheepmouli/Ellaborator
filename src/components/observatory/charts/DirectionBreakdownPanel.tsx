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
  const linkedRows = payload.cameraDirections ?? [];
  const isMock = linkedRows.length === 0;
  const rows = isMock
    ? [
        { id: "mock-n", direction: "North approach", site: "Demo camera", baselinePct: 42, interventionPct: 38 },
        { id: "mock-e", direction: "East approach", site: "Demo camera", baselinePct: 28, interventionPct: 31 },
        { id: "mock-s", direction: "South approach", site: "Demo camera", baselinePct: 18, interventionPct: 20 },
        { id: "mock-w", direction: "West approach", site: "Demo camera", baselinePct: 12, interventionPct: 11 },
      ]
    : linkedRows;
  const activeId = payload.activeDirectionId;

  return (
    <div className="space-y-2">
      {!compact && <PrePostTrendChart payload={payload} compact />}
      <div className={obsGlassCardClass(compact)} style={obsGlassCardStyle()}>
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-[11px] font-semibold text-white/70">
            {payload.kpiId === "kpi2.1" ? "Hazard types (click to focus)" : "Camera directions"}
          </p>
          {isMock ? (
            <span className="rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-violet-100 bg-violet-500/30 border border-violet-300/35">
              Mock plot
            </span>
          ) : null}
        </div>
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
              <p className="font-medium text-white/90">{row.direction}</p>
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
