import { Leaf } from "lucide-react";
import { OBS_C, obsGlassCardClass, obsGlassCardStyle } from "@/components/observatory/observatoryStyles";
import type { ObservatoryGraphicPayload } from "@/lib/observatoryGraphicTypes";

interface ClimateComparisonChartProps {
  payload: ObservatoryGraphicPayload;
  compact?: boolean;
}

export function ClimateComparisonChart({ payload, compact }: ClimateComparisonChartProps) {
  const cards = payload.statCards ?? [];
  const co2Card = cards.find((c) => c.label.toLowerCase().includes("co₂") || c.label.toLowerCase().includes("co2"));
  const baselineCard = cards.find((c) => c.label === "Baseline");
  const congestionCard = cards.find((c) => c.label === "Congestion");

  return (
    <div className={obsGlassCardClass(compact)} style={obsGlassCardStyle()}>
      <p className="text-[11px] font-semibold text-white/70 mb-3 flex items-center gap-1.5">
        <Leaf className="h-3.5 w-3.5" /> Environmental comparison
      </p>
      <div className="grid grid-cols-3 gap-2 text-center">
        {co2Card && (
          <div className="rounded-lg border p-2" style={{ borderColor: OBS_C.border }}>
            <p className="text-[9px] text-white/45">Intervention</p>
            <p className="text-sm font-bold" style={{ color: OBS_C.lime }}>
              {co2Card.value}
            </p>
          </div>
        )}
        {baselineCard && (
          <div className="rounded-lg border p-2" style={{ borderColor: OBS_C.border }}>
            <p className="text-[9px] text-white/45">Baseline</p>
            <p className="text-sm font-bold text-white/80">{baselineCard.value}</p>
          </div>
        )}
        {congestionCard && (
          <div className="rounded-lg border p-2" style={{ borderColor: OBS_C.border }}>
            <p className="text-[9px] text-white/45">Pressure</p>
            <p className="text-sm font-bold" style={{ color: OBS_C.amber }}>
              {congestionCard.value}
            </p>
          </div>
        )}
      </div>
      {payload.dataClass !== "observed" && (
        <p className="text-[9px] text-amber-200/80 mt-2">Derived proxy — not measured emissions.</p>
      )}
    </div>
  );
}
