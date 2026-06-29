import { OBS_C } from "@/components/observatory/observatoryStyles";
import type { ObservatoryGraphicPayload } from "@/lib/observatoryGraphicTypes";

interface StreetSegmentSchematicProps {
  payload: ObservatoryGraphicPayload;
  expanded?: boolean;
}

export function StreetSegmentSchematic({ payload, expanded }: StreetSegmentSchematicProps) {
  const w = expanded ? 280 : 200;
  const h = expanded ? 80 : 60;
  const gradient = payload.segmentGradient ?? 0.5;
  const gradColor = `hsl(${120 - gradient * 80}, 70%, 55%)`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-label="Street segment schematic">
      <rect width={w} height={h} fill="#06050f" rx="10" />
      <rect x={16} y={h / 2 - 14} width={w - 32} height={28} fill="#1a1830" rx="4" />
      <rect
        x={16}
        y={h / 2 - 14}
        width={(w - 32) * gradient}
        height={28}
        fill={gradColor}
        opacity={0.55}
        rx="4"
      />
      <line x1={16} y1={h / 2} x2={w - 16} y2={h / 2} stroke="#ffffff30" strokeWidth="1" strokeDasharray="4 4" />
      <circle cx={w * 0.25} cy={h / 2 - 22} r={3} fill={OBS_C.cyan} />
      <circle cx={w * 0.75} cy={h / 2 - 22} r={3} fill={OBS_C.lime} />
      <text x={w / 2} y={14} textAnchor="middle" fill="#9FE6FF" fontSize="7" fontFamily="sans-serif">
        {payload.streetEW || payload.pilotTitle || "Monitored street segment"}
      </text>
      <text x={w / 2} y={h - 6} textAnchor="middle" fill="#ffffff45" fontSize="6" fontFamily="sans-serif">
        Speed / KPI gradient along segment
      </text>
    </svg>
  );
}
