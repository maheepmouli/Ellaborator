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

export function CameraCorridorSchematic({
  payload,
  expanded,
  onSelectDirection,
}: CameraCorridorSchematicProps) {
  const size = expanded ? 260 : 200;
  const cx = size / 2;
  const cy = size / 2;
  const activeId = payload.activeDirectionId;
  const directions = payload.cameraDirections ?? [];
  const radius = size * 0.34;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-label="Camera corridor schematic">
      <rect width={size} height={size} fill={OBS_C.schematicBg} rx="12" />
      <rect x={cx - 20} y={0} width={40} height={size} fill="#1a1830" />
      <rect x={0} y={cy - 20} width={size} height={40} fill="#1a1830" />
      <rect x={cx - 20} y={cy - 20} width={40} height={40} fill="#21203c" rx="4" />
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
        const coneColor = isActive ? OBS_C.cyan : "rgba(99,204,255,0.25)";
        const label = cam.direction.length > 16 ? `${cam.direction.slice(0, 14)}…` : cam.direction;
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
              stroke={isActive ? OBS_C.lime : "rgba(255,255,255,0.2)"}
              strokeWidth={isActive ? 2.2 : 1.2}
            />
            <polygon
              points={`${armX},${armY} ${cx + Math.cos(angleRad - 0.35) * (radius * 0.45)},${cy + Math.sin(angleRad - 0.35) * (radius * 0.45)} ${cx + Math.cos(angleRad + 0.35) * (radius * 0.45)},${cy + Math.sin(angleRad + 0.35) * (radius * 0.45)}`}
              fill={coneColor}
              opacity={0.55}
            />
            <circle cx={armX} cy={armY} r={isActive ? 5.5 : 4} fill={isActive ? OBS_C.lime : OBS_C.cyan} />
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
          </g>
        );
      })}
      <text x={size / 2} y={12} textAnchor="middle" fill="#9FE6FF" fontSize="7" fontFamily="sans-serif">
        {payload.pilotTitle || "Camera corridor"}
      </text>
      <text x={size / 2} y={size - 6} textAnchor="middle" fill="#ffffff45" fontSize="6" fontFamily="sans-serif">
        {directions.length
          ? `${directions.length} observed directional flow${directions.length === 1 ? "" : "s"}`
          : "Directional camera cones"}
      </text>
    </svg>
  );
}
