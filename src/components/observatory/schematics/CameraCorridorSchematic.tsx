import { OBS_C } from "@/components/observatory/observatoryStyles";
import type { ObservatoryGraphicPayload } from "@/lib/observatoryGraphicTypes";

interface CameraCorridorSchematicProps {
  payload: ObservatoryGraphicPayload;
  expanded?: boolean;
  onSelectDirection?: (id: string) => void;
}

function directionAngle(direction: string, index: number, total: number): number {
  const d = direction.toLowerCase();
  if (d.includes("north") || d.includes("nord")) return -90;
  if (d.includes("east") || d.includes("øst") || d.includes("ost")) return 0;
  if (d.includes("south") || d.includes("syd")) return 90;
  if (d.includes("west") || d.includes("vest")) return 180;
  return -90 + (360 / Math.max(total, 1)) * index;
}

function flowRateColor(pct: number, active: boolean): string {
  const t = Math.max(0, Math.min(100, pct));
  if (active) return OBS_C.cyan;
  if (t < 30) return "#6EE7B7";
  if (t < 60) return OBS_C.cyan;
  if (t < 85) return "#FBBF24";
  return "#F97316";
}

function ArmArrow({
  x,
  y,
  angleDeg,
  color,
  opacity = 0.75,
}: {
  x: number;
  y: number;
  angleDeg: number;
  color: string;
  opacity?: number;
}) {
  const rad = (angleDeg * Math.PI) / 180;
  const tipX = x + Math.cos(rad) * 10;
  const tipY = y + Math.sin(rad) * 10;
  const leftX = x + Math.cos(rad + 2.6) * 6;
  const leftY = y + Math.sin(rad + 2.6) * 6;
  const rightX = x + Math.cos(rad - 2.6) * 6;
  const rightY = y + Math.sin(rad - 2.6) * 6;
  return (
    <polygon
      points={`${tipX},${tipY} ${leftX},${leftY} ${rightX},${rightY}`}
      fill={color}
      opacity={opacity}
    />
  );
}

export function CameraCorridorSchematic({
  payload,
  expanded,
  onSelectDirection,
}: CameraCorridorSchematicProps) {
  const size = expanded ? 260 : 200;
  const cx = size / 2;
  const cy = size / 2;
  const roadW = 34;
  const activeId = payload.activeDirectionId;
  const directions = payload.cameraDirections ?? [];
  const radius = size * 0.31;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-label="Camera corridor schematic">
      <rect width={size} height={size} fill={OBS_C.schematicBg} rx="12" />
      <defs>
        <radialGradient id="cphCamGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={OBS_C.cyan} stopOpacity="0.2" />
          <stop offset="100%" stopColor="transparent" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x={cx - roadW / 2} y={0} width={roadW} height={size} fill="#1a1830" />
      <rect x={0} y={cy - roadW / 2} width={size} height={roadW} fill="#1a1830" />
      <line x1={cx} y1={0} x2={cx} y2={cy - roadW / 2 - 2} stroke="#ffffff18" strokeWidth="1" strokeDasharray="6 5" />
      <line x1={cx} y1={cy + roadW / 2 + 2} x2={cx} y2={size} stroke="#ffffff18" strokeWidth="1" strokeDasharray="6 5" />
      <line x1={0} y1={cy} x2={cx - roadW / 2 - 2} y2={cy} stroke="#ffffff18" strokeWidth="1" strokeDasharray="6 5" />
      <line x1={cx + roadW / 2 + 2} y1={cy} x2={size} y2={cy} stroke="#ffffff18" strokeWidth="1" strokeDasharray="6 5" />
      <rect x={cx - roadW / 2} y={cy - roadW / 2} width={roadW} height={roadW} fill="#21203c" rx="4" />
      <circle cx={cx} cy={cy} r={24} fill="url(#cphCamGlow)" />
      <circle cx={cx} cy={cy} r={7} fill={OBS_C.cyan} opacity={0.9} />
      <text x={cx} y={cy + 3} textAnchor="middle" fill="#ffffffcc" fontSize="6" fontFamily="sans-serif">
        CAM
      </text>

      {directions.map((cam, index) => {
        const angleDeg = directionAngle(cam.direction, index, directions.length);
        const angleRad = (angleDeg * Math.PI) / 180;
        const armX = cx + Math.cos(angleRad) * radius;
        const armY = cy + Math.sin(angleRad) * radius;
        const isActive = cam.id === activeId;
        const flowPct = cam.interventionPct || cam.baselinePct || 0;
        const armColor = flowRateColor(flowPct, isActive);
        const label = cam.direction.length > 16 ? `${cam.direction.slice(0, 14)}…` : cam.direction;
        const midX = cx + Math.cos(angleRad) * (radius * 0.55);
        const midY = cy + Math.sin(angleRad) * (radius * 0.55);
        const nearX = cx + Math.cos(angleRad) * (radius * 0.22);
        const nearY = cy + Math.sin(angleRad) * (radius * 0.22);
        const farX = cx + Math.cos(angleRad) * (radius * 0.88);
        const farY = cy + Math.sin(angleRad) * (radius * 0.88);

        return (
          <g
            key={`${cam.id}-${index}`}
            style={{ cursor: onSelectDirection ? "pointer" : undefined }}
            onClick={() => onSelectDirection?.(cam.id)}
          >
            <line
              x1={cx}
              y1={cy}
              x2={armX}
              y2={armY}
              stroke={armColor}
              strokeWidth={isActive ? 3.2 : 2.2}
              opacity={isActive ? 1 : 0.72}
              strokeLinecap="round"
            />
            <ArmArrow x={farX} y={farY} angleDeg={angleDeg} color={armColor} opacity={isActive ? 0.95 : 0.7} />
            <ArmArrow
              x={nearX}
              y={nearY}
              angleDeg={(angleDeg + 180) % 360}
              color={armColor}
              opacity={isActive ? 0.75 : 0.45}
            />
            <circle cx={armX} cy={armY} r={isActive ? 5.5 : 4} fill={armColor} opacity={0.9} />
            <text
              x={armX}
              y={armY + (angleDeg > 0 ? 14 : -8)}
              textAnchor="middle"
              fill={isActive ? "#ffffff" : "#ffffff80"}
              fontSize="7"
              fontFamily="sans-serif"
            >
              {label}
            </text>
            {isActive ? (
              <text x={midX} y={midY} textAnchor="middle" fill="#ffffffaa" fontSize="6" fontFamily="sans-serif">
                {flowPct.toFixed(0)}%
              </text>
            ) : null}
          </g>
        );
      })}

      <text x={size / 2} y={12} textAnchor="middle" fill="#9FE6FF" fontSize="7" fontFamily="sans-serif">
        {payload.pilotTitle || "Monitored intervention corridor highlighted"}
      </text>
      <text x={size / 2} y={size - 6} textAnchor="middle" fill="#ffffff45" fontSize="6" fontFamily="sans-serif">
        {directions.length
          ? `${directions.length} observed directional flow${directions.length === 1 ? "" : "s"} · colour = flow rate`
          : "Visualized movement direction"}
      </text>
    </svg>
  );
}
