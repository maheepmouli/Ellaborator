import { useState } from "react";
import { OBS_C } from "@/components/observatory/observatoryStyles";
import type { ObservatoryGraphicPayload } from "@/lib/observatoryGraphicTypes";

interface CameraCorridorSchematicProps {
  payload: ObservatoryGraphicPayload;
  expanded?: boolean;
  onSelectDirection?: (id: string) => void;
}

/** Compass bearing (0=north) to SVG radians (0=east). */
function bearingToSvgRad(bearingDeg: number): number {
  return ((bearingDeg - 90) * Math.PI) / 180;
}

/** Build a camera FOV wedge path centered on hub at the given compass bearing. */
function fovWedgePath(cx: number, cy: number, bearingDeg: number, radius = 36, sweepDeg = 54): string {
  const mid = bearingToSvgRad(bearingDeg);
  const half = (sweepDeg * Math.PI) / 180 / 2;
  const x1 = cx + Math.cos(mid - half) * radius;
  const y1 = cy + Math.sin(mid - half) * radius;
  const x2 = cx + Math.cos(mid + half) * radius;
  const y2 = cy + Math.sin(mid + half) * radius;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2} Z`;
}

/** Compass bearing for OTC-style labels like "Hojbro south" / "Vestergade east". */
function directionAngle(
  direction: string,
  index: number,
  total: number,
  bearingDeg?: number
): number {
  if (typeof bearingDeg === "number" && Number.isFinite(bearingDeg)) {
    // Compass 0=N CW → SVG math angle 0=E (y grows down, so north is -90°).
    return bearingDeg - 90;
  }
  const d = direction.toLowerCase();
  const dest = d.includes("-->") ? d.split("-->").pop() ?? d : d;
  // Issy zone labels: "Zone 2 · NE"
  if (/\bnw\b/.test(dest) || dest.includes("north-west") || dest.includes("northwest")) return -135;
  if (/\bne\b/.test(dest) || dest.includes("north-east") || dest.includes("northeast")) return -45;
  if (/\bsw\b/.test(dest) || dest.includes("south-west") || dest.includes("southwest")) return 135;
  if (/\bse\b/.test(dest) || dest.includes("south-east") || dest.includes("southeast")) return 45;
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
 * Partner-style camera hub schematic (Copenhagen directional corridor).
 * Crossroads + FOV wedge + one-way directional counting links.
 * Arms are hover/click targets when onSelectDirection is provided.
 */
export function CameraCorridorSchematic({
  payload,
  expanded,
  onSelectDirection,
}: CameraCorridorSchematicProps) {
  const size = expanded ? 360 : 220;
  const cx = size / 2;
  const cy = size / 2;
  const roadW = 32;
  const activeId = payload.activeDirectionId;
  const directions = payload.cameraDirections ?? [];
  const armLen = size * 0.36;
  const cameraBearing = payload.cameraBearingDeg ?? 0;
  const fovColor = "#96C2EF";
  const interactive = typeof onSelectDirection === "function";
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const isZoneHub = directions.some((d) => d.id.startsWith("issy-zone-"));
  const isTelraamModeArms = directions.some((d) => d.id.startsWith("telraam-"));

  const angleCounts = new Map<number, number>();
  const angleIndex = new Map<string, number>();
  directions.forEach((cam, index) => {
    const angle =
      Math.round(directionAngle(cam.direction, index, directions.length, cam.bearingDeg) / 90) * 90;
    const n = angleCounts.get(angle) ?? 0;
    angleIndex.set(cam.id, n);
    angleCounts.set(angle, n + 1);
  });

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className="relative z-10 pointer-events-auto select-none"
      aria-label={
        isTelraamModeArms
          ? "Telraam mode-share arms — hover or click to focus"
          : isZoneHub
            ? "Zone OD destination links — hover or click to focus"
            : "Directional traffic flow links — hover or click to focus"
      }
      role="group"
    >
      <rect width={size} height={size} fill={OBS_C.schematicBg} rx="12" />

      <g aria-label="North" pointerEvents="none">
        <line x1={14} y1={22} x2={14} y2={10} stroke="#ffffff55" strokeWidth="1.2" />
        <polygon points="14,6 11,12 17,12" fill="#ffffff88" />
        <text x={14} y={30} textAnchor="middle" fill="#ffffff66" fontSize="7" fontFamily="sans-serif">
          N
        </text>
      </g>

      <defs>
        <radialGradient id="cphCamGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#EF4444" stopOpacity="0.22" />
          <stop offset="100%" stopColor="transparent" stopOpacity="0" />
        </radialGradient>
      </defs>

      <g pointerEvents="none">
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

        <circle cx={cx} cy={cy} r={22} fill="url(#cphCamGlow)" />
        <path d={fovWedgePath(cx, cy, cameraBearing, 28)} fill={fovColor} opacity="0.28" />
        <circle cx={cx} cy={cy} r={5} fill={fovColor} opacity="0.95" stroke="#ffffff" strokeWidth="0.8" />
      </g>

      {directions.map((cam, index) => {
        const angleDeg = directionAngle(cam.direction, index, directions.length, cam.bearingDeg);
        const angleRad = (angleDeg * Math.PI) / 180;
        const isActive = cam.id === activeId;
        const isHovered = cam.id === hoveredId;
        const emphasized = isActive || isHovered;
        const flowPct = cam.interventionPct || cam.baselinePct || 0;
        const armColor = flowRateColor(flowPct, emphasized);
        const label = flowDirectionLabel(cam.direction);

        const lane = angleIndex.get(cam.id) ?? 0;
        const sameRayCount = angleCounts.get(Math.round(angleDeg / 90) * 90) ?? 1;
        const pairOffset = sameRayCount > 1 ? (lane === 0 ? -5 : 5) : 0;
        const orthoX = -Math.sin(angleRad) * pairOffset;
        const orthoY = Math.cos(angleRad) * pairOffset;

        const startR = roadW * 0.62;
        const endR = armLen;
        const nearX = cx + Math.cos(angleRad) * startR + orthoX;
        const nearY = cy + Math.sin(angleRad) * startR + orthoY;
        const shaftEndR = endR - 6;
        const shaftX = cx + Math.cos(angleRad) * shaftEndR + orthoX;
        const shaftY = cy + Math.sin(angleRad) * shaftEndR + orthoY;
        const tipX = cx + Math.cos(angleRad) * endR + orthoX;
        const tipY = cy + Math.sin(angleRad) * endR + orthoY;
        const labelX = cx + Math.cos(angleRad) * (armLen * 0.58) + orthoX;
        const labelY = cy + Math.sin(angleRad) * (armLen * 0.58) + orthoY;

        const linkR = roadW * 0.78;
        const linkCx = cx + Math.cos(angleRad) * linkR + orthoX;
        const linkCy = cy + Math.sin(angleRad) * linkR + orthoY;
        const linkHalf = 7;
        const linkAx = linkCx - Math.sin(angleRad) * linkHalf;
        const linkAy = linkCy + Math.cos(angleRad) * linkHalf;
        const linkBx = linkCx + Math.sin(angleRad) * linkHalf;
        const linkBy = linkCy - Math.cos(angleRad) * linkHalf;

        const strokeW = emphasized ? 3.4 : 2.4;
        const chipW = Math.min(96, label.length * 4.4 + 10);
        const dimmed = hoveredId != null && !emphasized;
        const tipLabel = `${cam.direction}: ${flowPct.toFixed(0)}% sustainable modes`;

        const select = () => {
          if (!interactive) return;
          onSelectDirection?.(cam.id);
        };

        return (
          <g
            key={`${cam.id}-${index}`}
            role={interactive ? "button" : undefined}
            tabIndex={interactive ? 0 : undefined}
            aria-pressed={interactive ? isActive : undefined}
            aria-label={tipLabel}
            style={{ cursor: interactive ? "pointer" : undefined, outline: "none" }}
            opacity={dimmed ? 0.38 : 1}
            onClick={(e) => {
              e.stopPropagation();
              select();
            }}
            onKeyDown={(e) => {
              if (!interactive) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                select();
              }
            }}
            onMouseEnter={() => setHoveredId(cam.id)}
            onMouseLeave={() => setHoveredId((prev) => (prev === cam.id ? null : prev))}
            onFocus={() => setHoveredId(cam.id)}
            onBlur={() => setHoveredId((prev) => (prev === cam.id ? null : prev))}
          >
            {/* Fat invisible hit target */}
            <line
              x1={nearX}
              y1={nearY}
              x2={tipX}
              y2={tipY}
              stroke="transparent"
              strokeWidth={18}
              strokeLinecap="round"
            />
            <rect
              x={labelX - chipW / 2 - 4}
              y={labelY - 10}
              width={chipW + 8}
              height={20}
              fill="transparent"
            />
            <line
              x1={linkAx}
              y1={linkAy}
              x2={linkBx}
              y2={linkBy}
              stroke={armColor}
              strokeWidth={1.4}
              opacity={0.75}
              strokeLinecap="butt"
              pointerEvents="none"
            />
            <line
              x1={nearX}
              y1={nearY}
              x2={shaftX}
              y2={shaftY}
              stroke={armColor}
              strokeWidth={strokeW}
              opacity={emphasized ? 1 : 0.8}
              strokeLinecap="butt"
              pointerEvents="none"
            />
            <g pointerEvents="none">
              <SmallArrowHead
                x={shaftX}
                y={shaftY}
                angleDeg={angleDeg}
                color={armColor}
                size={emphasized ? 5.5 : 4.5}
              />
            </g>
            <rect
              x={labelX - chipW / 2}
              y={labelY - 6}
              width={chipW}
              height={12}
              rx={2.5}
              fill={emphasized ? "#7F1D1D" : "#3F0A0A"}
              opacity={0.94}
              stroke={armColor}
              strokeWidth={emphasized ? 1 : 0.6}
              pointerEvents="none"
            />
            <text
              x={labelX}
              y={labelY + 2.5}
              textAnchor="middle"
              fill="#ffffff"
              fontSize="6"
              fontFamily="sans-serif"
              fontWeight="700"
              pointerEvents="none"
            >
              {label}
            </text>
            {emphasized ? (
              <g pointerEvents="none">
                <text
                  x={tipX + Math.cos(angleRad) * 10}
                  y={tipY + Math.sin(angleRad) * 10}
                  textAnchor="middle"
                  fill="#FCA5A5"
                  fontSize="6"
                  fontFamily="sans-serif"
                  fontWeight="700"
                >
                  {flowPct.toFixed(0)}%
                </text>
                <text
                  x={tipX + Math.cos(angleRad) * 10}
                  y={tipY + Math.sin(angleRad) * 10 + 8}
                  textAnchor="middle"
                  fill="#ffffff66"
                  fontSize="4.5"
                  fontFamily="sans-serif"
                >
                  sustainable modes
                </text>
              </g>
            ) : null}
            <title>{tipLabel}</title>
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
        pointerEvents="none"
      >
        {payload.pilotTitle ||
          (isTelraamModeArms
            ? "Telraam · mode arms"
            : isZoneHub
              ? "Zone hub · OD links"
              : "Camera hub · directional links")}
      </text>
      <text
        x={size / 2}
        y={size - 6}
        textAnchor="middle"
        fill="#ffffff45"
        fontSize="6"
        fontFamily="sans-serif"
        pointerEvents="none"
      >
        {directions.length
          ? interactive
            ? isTelraamModeArms
              ? `${directions.length} mode arm${directions.length === 1 ? "" : "s"} — hover / click to focus`
              : isZoneHub
                ? `${directions.length} OD destination${directions.length === 1 ? "" : "s"} — hover / click to focus`
                : `${directions.length} one-way link${directions.length === 1 ? "" : "s"} — hover / click to focus`
            : isTelraamModeArms
              ? `${directions.length} mode arm${directions.length === 1 ? "" : "s"} at this Telraam counter`
              : isZoneHub
                ? `${directions.length} OD destination${directions.length === 1 ? "" : "s"} from this zone`
                : `${directions.length} one-way link${directions.length === 1 ? "" : "s"} at this camera hub`
          : isTelraamModeArms
            ? "Select a Telraam counter to show mode arms"
            : "Select a camera hub to show its directional links"}
      </text>
    </svg>
  );
}
