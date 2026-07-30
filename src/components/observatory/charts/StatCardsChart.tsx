import {
  Accessibility,
  Activity,
  Gauge,
  History,
  Layers,
  ListChecks,
  MessageSquareText,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { OBS_C, obsGlassCardClass, obsGlassCardStyle } from "@/components/observatory/observatoryStyles";
import type { ObservatoryGraphicPayload } from "@/lib/observatoryGraphicTypes";

interface StatCardsChartProps {
  payload: ObservatoryGraphicPayload;
  compact?: boolean;
}

function resolveCardIcon(
  label: string,
  iconKey?: string,
  value?: string
): LucideIcon {
  const key = (iconKey ?? label).toLowerCase();
  if (key.includes("access") || key.includes("equal")) return Accessibility;
  if (key.includes("baseline") || key.includes("before")) return History;
  if (key.includes("change") || key.includes("delta")) {
    const numeric = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
    return Number.isFinite(numeric) && numeric < 0 ? TrendingDown : TrendingUp;
  }
  if (key.includes("confidence") || key.includes("security")) return ShieldCheck;
  if (key.includes("feature") || key.includes("indexed") || key.includes("site")) return Layers;
  if (key.includes("dimension") || key.includes("category")) return ListChecks;
  if (key.includes("survey") || key.includes("satisf")) return MessageSquareText;
  if (key.includes("speed") || key.includes("pressure")) return Activity;
  if (key.includes("index") || key.includes("gauge")) return Gauge;
  return Gauge;
}

export function StatCardsChart({ payload, compact }: StatCardsChartProps) {
  const cards = payload.statCards ?? [{ label: "KPI value", value: payload.kpiValue?.toFixed(1) ?? "—" }];

  return (
    <div className={`grid gap-2 ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}>
      {cards.map((card) => {
        const Icon = resolveCardIcon(card.label, card.icon, card.value);
        return (
          <div key={card.label} className={obsGlassCardClass(true)} style={obsGlassCardStyle()}>
            <div className="flex items-start justify-between gap-2 mb-1">
              <p className="text-[10px] text-white/45 leading-snug">{card.label}</p>
              <Icon
                className="h-3.5 w-3.5 shrink-0 mt-0.5"
                style={{ color: card.color ?? OBS_C.cyan }}
                aria-hidden
              />
            </div>
            <p className="text-lg font-bold" style={{ color: card.color ?? OBS_C.cyan }}>
              {card.value}
            </p>
            {card.note && <p className="text-[9px] text-white/40 mt-0.5">{card.note}</p>}
          </div>
        );
      })}
    </div>
  );
}
