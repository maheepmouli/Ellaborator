import { OBS_C } from "@/components/observatory/observatoryStyles";
import type { ObservatoryGraphicPayload } from "@/lib/observatoryGraphicTypes";

interface AreaPolygonSchematicProps {
  payload: ObservatoryGraphicPayload;
  expanded?: boolean;
}

export function AreaPolygonSchematic({ payload, expanded }: AreaPolygonSchematicProps) {
  const size = expanded ? 260 : 200;
  const cx = size / 2;
  const cy = size / 2;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-label="Intervention area schematic">
      <rect width={size} height={size} fill={OBS_C.schematicBg} rx="12" />
      <polygon
        points={`${cx},${cy - 55} ${cx + 60},${cy - 15} ${cx + 45},${cy + 50} ${cx - 45},${cy + 50} ${cx - 60},${cy - 15}`}
        fill="rgba(99,204,255,0.12)"
        stroke={OBS_C.cyan}
        strokeWidth="1.5"
        strokeOpacity={0.6}
      />
      <circle cx={cx} cy={cy} r={4} fill={OBS_C.lime} />
      {(payload.markers ?? []).slice(0, 3).map((m, i) => {
        const angles = [-60, 0, 60];
        const rad = (angles[i] * Math.PI) / 180;
        const px = cx + Math.cos(rad) * 35;
        const py = cy + Math.sin(rad) * 25;
        return (
          <g key={m.id}>
            <circle cx={px} cy={py} r={3.5} fill={OBS_C.violet} />
            {m.label ? (
              <text x={px} y={py + 12} textAnchor="middle" fill="#ffffff60" fontSize="6" fontFamily="sans-serif">
                {m.label.slice(0, 10)}
              </text>
            ) : null}
          </g>
        );
      })}
      <text x={size / 2} y={14} textAnchor="middle" fill="#9FE6FF" fontSize="7" fontFamily="sans-serif">
        {payload.pilotTitle || "Intervention area boundary"}
      </text>
      <text x={size / 2} y={size - 6} textAnchor="middle" fill="#ffffff45" fontSize="6" fontFamily="sans-serif">
        Area-level monitoring scope — illustrative polygon
      </text>
    </svg>
  );
}
