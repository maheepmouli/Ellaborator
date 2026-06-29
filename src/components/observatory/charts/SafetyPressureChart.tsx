import { Gauge, Activity } from "lucide-react";
import { OBS_C, obsGlassCardClass, obsGlassCardStyle } from "@/components/observatory/observatoryStyles";
import type { ObservatoryGraphicPayload } from "@/lib/observatoryGraphicTypes";

interface SafetyPressureChartProps {
  payload: ObservatoryGraphicPayload;
  compact?: boolean;
}

export function SafetyPressureChart({ payload, compact }: SafetyPressureChartProps) {
  const speed = payload.kpiValue;
  const congestionPct = Math.round((payload.segmentGradient ?? 0.5) * 100);

  return (
    <div className={obsGlassCardClass(compact)} style={obsGlassCardStyle()}>
      <p className="text-[11px] font-semibold text-white/70 mb-3">Safety / flow pressure</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border p-2" style={{ borderColor: OBS_C.border }}>
          <div className="flex items-center gap-1.5 text-[10px] text-white/50 mb-1">
            <Gauge className="h-3 w-3" /> Speed proxy
          </div>
          <p className="text-lg font-bold" style={{ color: OBS_C.cyan }}>
            {speed.toFixed(1)}
          </p>
          <p className="text-[9px] text-white/40">km/h equivalent</p>
        </div>
        <div className="rounded-lg border p-2" style={{ borderColor: OBS_C.border }}>
          <div className="flex items-center gap-1.5 text-[10px] text-white/50 mb-1">
            <Activity className="h-3 w-3" /> Congestion
          </div>
          <p className="text-lg font-bold" style={{ color: OBS_C.amber }}>
            {congestionPct}%
          </p>
          <p className="text-[9px] text-white/40">pressure index</p>
        </div>
      </div>
      <div className="mt-3 h-2 rounded-full overflow-hidden" style={{ background: OBS_C.border }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.min(100, congestionPct)}%`,
            background: `linear-gradient(90deg, ${OBS_C.violet}, ${OBS_C.amber})`,
          }}
        />
      </div>
    </div>
  );
}
