import { OBS_C } from "@/components/observatory/observatoryStyles";
import type { ObservatoryGraphicPayload } from "@/lib/observatoryGraphicTypes";

interface CameraCorridorSchematicProps {
  payload: ObservatoryGraphicPayload;
  expanded?: boolean;
  onSelectDirection?: (id: string) => void;
}

/** Compass bearing for OTC-style labels like "Hojbro south" / "Vestergade east". */
function directionAngle(direction: string, index: number, total: number): number {
  const d = direction.toLowerCase();
  // Prefer destination side of OD strings ("A --> B south").
  const dest = d.includes("-->") ? d.split("-->").pop() ?? d : d;
  if (dest.includes("north") || dest.includes("nord")) return -90;
  if (dest.includes("east") || dest.includes("øst") || dest.includes("ost")) return 0;
  if (dest.includes("south") || dest.includes("syd")) return 90;
  if (dest.includes("west") || dest.includes("vest")) return 180;
  return -90 + (360 / Math.max(total, 1)) * index;
}

function flowRateColor(pct: number, active: boolean): string {
  const t = Math.max(0, Math.min(100, pct));
  if (active) return "#F87171";
  if (t < 30) return "#FB7185";
  if (t < 60) return "#EF4444";
  if (t < 85) return "#DC2626";
  return "#B91C1C";
}

/** Partner-readable label: street + compass (drop long OD arrows). */
function flowDirectionLabel(direction: string): string {
  const trimmed = direction.trim();
  if (trimmed.includes("-->")) {
    const parts = trimmed.split("-->").map((p) => p.trim());
    const to = parts[1] || parts[0] || trimmed;
    return to.length <= 22 ? to : `${to.slice(0, 20)}…`;
  }
  if (trimmed.length <= 22) return trimmed;
  return `${trimmed.slice(0, 20)}…`;
}

/** Small fixed-size arrowhead — does not scale with stroke width. */
function SmallArrowHead({
  x,
  y,
  angleDeg,
  color,
  size = 5,
}: {
  x: number;
  y: number;
  angleDeg: number;
  color: string;
  size?: number;
}) {
  const rad = (angleDeg * Math.PI) / 180;
  const tipX = x + Math.cos(rad) * size;
  const tipY = y + Math.sin(rad) * size;
  const leftX = x + Math.cos(rad + 2.45) * size * 0.75;
  const leftY = y + Math.sin(rad + 2.45) * size * 0.75;
  const rightX = x + Math.cos(rad - 2.45) * size * 0.75;
  const rightY = y + Math.sin(rad - 2.45) * size * 0.75;
  return <polygon points={`${tipX},${tipY} ${leftX},${leftY} ${rightX},${rightY}`} fill={color} />;
}

/**
 * Partner-style directional link diagram:
 * thin counting link + slim one-way arrow with a small tip (no giant / double heads).
 */
export function CameraCorridorSchematic({
  payload,
  expanded,
  onSelectDirection,
}: CameraCorridorSchematicProps) {
  const size = expanded ? 280 : 220;
  const cx = size / 2;
  const cy = size / 2;
  const roadW = 32;
  const activeId = payload.activeDirectionId;
  const directions = payload.cameraDirections ?? [];
  const armLen = size * 0.36;

  // Offset only when two flows share the same compass ray (avoids stacked “double heads”).
  const angleCounts = new Map<number, number>();
  const angleIndex = new Map<string, number>();
  directions.forEach((cam, index) => {
    const angle = Math.round(directionAngle(cam.direction, index, directions.length) / 90) * 90;
    const n = angleCounts.get(angle) ?? 0;
    angleIndex.set(cam.id, n);
    angleCounts.set(angle, n + 1);
  });

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      aria-label="Directional traffic flow links"
    >
      <rect width={size} height={size} fill={OBS_C.schematicBg} rx="12" />
      <defs>
        <radialGradient id="cphCamGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#EF4444" stopOpacity="0.22" />
          <stop offset="100%" stopColor="transparent" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Crossroads */}
      <rect x={cx - roadW / 2} y={0} width={roadW} height={size} fill="#1a1830" />
      <rect x={0} y={cy - roadW / 2} width={size} height={roadW} fill="#1a1830" />
      <line
        x1={cx}
        y1={0}
        x2={cx}
        y2={cy - roadW / 2 - 2}
        stroke="#ffffff14"
        strokeWidth="1"
        strokeDasharray="6 5"
      />
      <line
        x1={cx}
        y1={cy + roadW / 2 + 2}
        x2={cx}
        y2={size}
        stroke="#ffffff14"
        strokeWidth="1"
        strokeDasharray="6 5"
      />
      <line
        x1={0}
        y1={cy}
        x2={cx - roadW / 2 - 2}
        y2={cy}
        stroke="#ffffff14"
        strokeWidth="1"
        strokeDasharray="6 5"
      />
      <line
        x1={cx + roadW / 2 + 2}
        y1={cy}
        x2={size}
        y2={cy}
        stroke="#ffffff14"
        strokeWidth="1"
        strokeDasharray="6 5"
      />
      <rect
        x={cx - roadW / 2}
        y={cy - roadW / 2}
        width={roadW}
        height={roadW}
        fill="#21203c"
        rx="4"
      />

      {/* Camera point + FOV wedge */}
      <circle cx={cx} cy={cy} r={22} fill="url(#cphCamGlow)" />
      <path
        d={`M ${cx} ${cy} L ${cx + 18} ${cy - 22} A 28 28 0 0 1 ${cx + 18} ${cy + 22} Z`}
        fill="#EF4444"
        opacity="0.28"
      />
      <circle cx={cx} cy={cy} r={5} fill="#EF4444" opacity="0.95" />
      <text
        x={cx}
        y={cy + 2}
        textAnchor="middle"
        fill="#ffffff"
        fontSize="4.5"
        fontFamily="sans-serif"
        fontWeight="700"
      >
        CAM
      </text>

      {directions.map((cam, index) => {
        const angleDeg = directionAngle(cam.direction, index, directions.length);
        const angleRad = (angleDeg * Math.PI) / 180;
        const isActive = cam.id === activeId;
        const flowPct = cam.interventionPct || cam.baselinePct || 0;
        const armColor = flowRateColor(flowPct, isActive);
        const label = flowDirectionLabel(cam.direction);

        const lane = angleIndex.get(cam.id) ?? 0;
        const sameRayCount =
          angleCounts.get(Math.round(angleDeg / 90) * 90) ?? 1;
        const pairOffset = sameRayCount > 1 ? (lane === 0 ? -5 : 5) : 0;
        const orthoX = -Math.sin(angleRad) * pairOffset;
        const orthoY = Math.cos(angleRad) * pairOffset;

        const startR = roadW * 0.62;
        const endR = armLen;
        const nearX = cx + Math.cos(angleRad) * startR + orthoX;
        const nearY = cy + Math.sin(angleRad) * startR + orthoY;
        // Stop shaft before tip so shaft + head don't merge into a second blob.
        const shaftEndR = endR - 6;
        const shaftX = cx + Math.cos(angleRad) * shaftEndR + orthoX;
        const shaftY = cy + Math.sin(angleRad) * shaftEndR + orthoY;
        const tipX = cx + Math.cos(angleRad) * endR + orthoX;
        const tipY = cy + Math.sin(angleRad) * endR + orthoY;
        const labelX = cx + Math.cos(angleRad) * (armLen * 0.58) + orthoX;
        const labelY = cy + Math.sin(angleRad) * (armLen * 0.58) + orthoY;

        // Thin counting link near the hub (once per approach lane).
        const linkR = roadW * 0.78;
        const linkCx = cx + Math.cos(angleRad) * linkR + orthoX;
        const linkCy = cy + Math.sin(angleRad) * linkR + orthoY;
        const linkHalf = 7;
        const linkAx = linkCx - Math.sin(angleRad) * linkHalf;
        const linkAy = linkCy + Math.cos(angleRad) * linkHalf;
        const linkBx = linkCx + Math.sin(angleRad) * linkHalf;
        const linkBy = linkCy - Math.cos(angleRad) * linkHalf;

        const strokeW = isActive ? 3.2 : 2.4;
        const chipW = Math.min(96, label.length * 4.4 + 10);

        return (
          <g
            key={`${cam.id}-${index}`}
            style={{ cursor: onSelectDirection ? "pointer" : undefined }}
            onClick={() => onSelectDirection?.(cam.id)}
          >
            <line
              x1={linkAx}
              y1={linkAy}
              x2={linkBx}
              y2={linkBy}
              stroke={armColor}
              strokeWidth={1.4}
              opacity={0.75}
              strokeLinecap="butt"
            />
            <line
              x1={nearX}
              y1={nearY}
              x2={shaftX}
              y2={shaftY}
              stroke={armColor}
              strokeWidth={strokeW}
              opacity={isActive ? 1 : 0.8}
              strokeLinecap="butt"
            />
            <SmallArrowHead
              x={shaftX}
              y={shaftY}
              angleDeg={angleDeg}
              color={armColor}
              size={isActive ? 5.5 : 4.5}
            />
            <rect
              x={labelX - chipW / 2}
              y={labelY - 6}
              width={chipW}
              height={12}
              rx={2.5}
              fill={isActive ? "#7F1D1D" : "#3F0A0A"}
              opacity={0.94}
              stroke={armColor}
              strokeWidth={0.6}
            />
            <text
              x={labelX}
              y={labelY + 2.5}
              textAnchor="middle"
              fill="#ffffff"
              fontSize="6"
              fontFamily="sans-serif"
              fontWeight="700"
            >
              {label}
            </text>
            {isActive ? (
              <text
                x={tipX + Math.cos(angleRad) * 8}
                y={tipY + Math.sin(angleRad) * 8}
                textAnchor="middle"
                fill="#FCA5A5"
                fontSize="5.5"
                fontFamily="sans-serif"
              >
                {flowPct.toFixed(0)}%
              </text>
            ) : null}
          </g>
        );
      })}

      <text
        x={size / 2}
        y={12}
        textAnchor="middle"
        fill="#FCA5A5"
        fontSize="7"
        fontFamily="sans-serif"
      >
        {payload.pilotTitle || "Directional flow links · observatory"}
      </text>
      <text
        x={size / 2}
        y={size - 6}
        textAnchor="middle"
        fill="#ffffff45"
        fontSize="6"
        fontFamily="sans-serif"
      >
        {directions.length
          ? `${directions.length} one-way link${directions.length === 1 ? "" : "s"} at this camera hub`
          : "Select a camera hub to show its directional links"}
      </text>
    </svg>
  );
}
