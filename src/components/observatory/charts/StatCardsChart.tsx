import { OBS_C, obsGlassCardClass, obsGlassCardStyle } from "@/components/observatory/observatoryStyles";
import type { ObservatoryGraphicPayload } from "@/lib/observatoryGraphicTypes";

interface StatCardsChartProps {
  payload: ObservatoryGraphicPayload;
  compact?: boolean;
}

export function StatCardsChart({ payload, compact }: StatCardsChartProps) {
  const cards = payload.statCards ?? [{ label: "KPI value", value: payload.kpiValue?.toFixed(1) ?? "—" }];

  return (
    <div className={`grid gap-2 ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}>
      {cards.map((card) => (
        <div key={card.label} className={obsGlassCardClass(true)} style={obsGlassCardStyle()}>
          <p className="text-[10px] text-white/45 mb-1">{card.label}</p>
          <p className="text-lg font-bold" style={{ color: card.color ?? OBS_C.cyan }}>
            {card.value}
          </p>
          {card.note && <p className="text-[9px] text-white/40 mt-0.5">{card.note}</p>}
        </div>
      ))}
    </div>
  );
}
