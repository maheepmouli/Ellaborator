import { OBS_C } from "@/components/observatory/observatoryStyles";
import type { ObservatoryGraphicPayload } from "@/lib/observatoryGraphicTypes";

interface InterventionPointsSchematicProps {
  payload: ObservatoryGraphicPayload;
  expanded?: boolean;
}

export function InterventionPointsSchematic({ payload, expanded }: InterventionPointsSchematicProps) {
  const size = expanded ? 260 : 200;
  const markers = payload.markers?.length
    ? payload.markers
    : [
        { id: "a", x: 35, y: 40, label: "Site A" },
        { id: "b", x: 65, y: 55, label: "Site B" },
      ];

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-label="Intervention points schematic">
      <rect width={size} height={size} fill="#06050f" rx="12" />
      <rect x={20} y={30} width={size - 40} height={size - 60} fill="none" stroke="#ffffff15" strokeWidth="1" strokeDasharray="4 4" rx="8" />
      {markers.map((m) => {
        const px = (m.x / 100) * size;
        const py = (m.y / 100) * size;
        return (
          <g key={m.id}>
            <circle cx={px} cy={py} r={14} fill={OBS_C.cyan} opacity={0.15} />
            <circle cx={px} cy={py} r={5} fill={OBS_C.cyan} />
            <circle cx={px} cy={py} r={2.5} fill="white" opacity={0.9} />
            {m.label ? (
              <text x={px} y={py + 16} textAnchor="middle" fill="#ffffff70" fontSize="7" fontFamily="sans-serif">
                {m.label.length > 16 ? `${m.label.slice(0, 14)}…` : m.label}
              </text>
            ) : null}
          </g>
        );
      })}
      <text x={size / 2} y={14} textAnchor="middle" fill="#9FE6FF" fontSize="7" fontFamily="sans-serif">
        {payload.pilotTitle || "Intervention monitoring points"}
      </text>
      <text x={size / 2} y={size - 6} textAnchor="middle" fill="#ffffff45" fontSize="6" fontFamily="sans-serif">
        Authoritative intervention coordinates
      </text>
    </svg>
  );
}
