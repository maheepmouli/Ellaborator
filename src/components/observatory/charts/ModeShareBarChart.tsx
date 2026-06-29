import { motion } from "framer-motion";
import { MODE_COLORS, OBS_C, obsGlassCardClass, obsGlassCardStyle } from "@/components/observatory/observatoryStyles";
import type { ObservatoryGraphicPayload } from "@/lib/observatoryGraphicTypes";

interface ModeShareBarChartProps {
  payload: ObservatoryGraphicPayload;
  compact?: boolean;
}

export function ModeShareBarChart({ payload, compact }: ModeShareBarChartProps) {
  const rows = payload.modeShare ?? [];
  const maxVal = Math.max(1, ...rows.flatMap((r) => [r.before, r.after]));

  return (
    <div className={obsGlassCardClass(compact)} style={obsGlassCardStyle()}>
      <p className="text-[11px] font-semibold text-white/70 mb-3">Mode share — baseline vs intervention</p>
      <div className="space-y-2.5">
        {rows.map((row) => {
          const color = MODE_COLORS[row.mode] ?? OBS_C.muted;
          const beforeW = (row.before / maxVal) * 100;
          const afterW = (row.after / maxVal) * 100;
          return (
            <div key={row.mode}>
              <div className="flex justify-between text-[10px] text-white/50 mb-1">
                <span>{row.mode}</span>
                <span>
                  {row.before}% → {row.after}%
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="h-2 rounded-full overflow-hidden" style={{ background: OBS_C.border }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: `rgba(255,255,255,0.25)` }}
                    initial={{ width: 0 }}
                    animate={{ width: `${beforeW}%` }}
                  />
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: OBS_C.border }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${afterW}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
