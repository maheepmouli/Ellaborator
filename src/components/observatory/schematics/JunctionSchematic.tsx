import { motion } from "framer-motion";
import { OBS_C } from "@/components/observatory/observatoryStyles";
import type { ObservatoryGraphicPayload } from "@/lib/observatoryGraphicTypes";

function SensorDot({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <motion.g
        style={{ transformOrigin: `${cx}px ${cy}px` }}
        animate={{ opacity: [0, 0.2, 0], scale: [0.65, 1.45, 0.65] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <circle cx={cx} cy={cy} r={8} fill={OBS_C.cyan} />
      </motion.g>
      <circle cx={cx} cy={cy} r={3.5} fill={OBS_C.cyan} opacity={0.9} />
      <circle cx={cx} cy={cy} r={2} fill="white" opacity={0.8} />
    </g>
  );
}

function missToneColor(tone?: string): string {
  if (tone === "hazard") return "#f59e0b";
  if (tone === "sensor") return OBS_C.cyan;
  return "#f87171"; // near-miss / conflict
}

interface JunctionSchematicProps {
  payload: ObservatoryGraphicPayload;
  expanded?: boolean;
}

export function JunctionSchematic({ payload, expanded }: JunctionSchematicProps) {
  const size = expanded ? 260 : 200;
  const cx = size / 2;
  const cy = size / 2;
  const roadW = 36;
  const streetNS = payload.streetNS;
  const streetEW = payload.streetEW;
  const missPoints = (payload.markers ?? []).filter((m) => m.x != null && m.y != null);
  const showMissOverlay = missPoints.length > 0;
  const title = showMissOverlay
    ? payload.pilotTitle || "Near-miss & hazard junction diagram"
    : "Monitored intervention corridor highlighted";
  const footer = showMissOverlay
    ? "Red = near-miss · Amber = hazard type · Cyan = sensor"
    : "Visualized movement direction";

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Intersection schematic with near-miss points"
    >
      <rect width={size} height={size} fill="#06050f" rx="12" />
      <defs>
        <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={OBS_C.cyan} stopOpacity="0.18" />
          <stop offset="100%" stopColor="transparent" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x={cx - roadW / 2} y={0} width={roadW} height={size} fill="#1a1830" />
      <rect x={0} y={cy - roadW / 2} width={size} height={roadW} fill="#1a1830" />
      <line
        x1={cx}
        y1={0}
        x2={cx}
        y2={cy - roadW / 2 - 2}
        stroke="#ffffff18"
        strokeWidth="1"
        strokeDasharray="6 5"
      />
      <line
        x1={cx}
        y1={cy + roadW / 2 + 2}
        x2={cx}
        y2={size}
        stroke="#ffffff18"
        strokeWidth="1"
        strokeDasharray="6 5"
      />
      <line
        x1={0}
        y1={cy}
        x2={cx - roadW / 2 - 2}
        y2={cy}
        stroke="#ffffff18"
        strokeWidth="1"
        strokeDasharray="6 5"
      />
      <line
        x1={cx + roadW / 2 + 2}
        y1={cy}
        x2={size}
        y2={cy}
        stroke="#ffffff18"
        strokeWidth="1"
        strokeDasharray="6 5"
      />
      <rect x={cx - roadW / 2} y={cy - roadW / 2} width={roadW} height={roadW} fill="#21203c" />
      <circle cx={cx} cy={cy} r={28} fill="url(#centerGlow)" />
      <line
        x1={cx}
        y1={cy + roadW / 2 + 8}
        x2={cx}
        y2={size - 14}
        stroke={OBS_C.cyan}
        strokeWidth="1.5"
        opacity="0.45"
      />
      <line
        x1={cx + roadW / 2 + 8}
        y1={cy}
        x2={size - 14}
        y2={cy}
        stroke={OBS_C.lime}
        strokeWidth="1.5"
        opacity="0.35"
      />
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i}>
          <rect
            x={cx - roadW / 2 + 2}
            y={cy - roadW / 2 - 8 + i * 2}
            width={roadW - 4}
            height={1}
            fill="#ffffff50"
          />
          <rect
            x={cx - roadW / 2 + 2}
            y={cy + roadW / 2 + 1 + i * 2}
            width={roadW - 4}
            height={1}
            fill="#ffffff50"
          />
          <rect
            x={cx - roadW / 2 - 8 + i * 2}
            y={cy - roadW / 2 + 2}
            width={1}
            height={roadW - 4}
            fill="#ffffff50"
          />
          <rect
            x={cx + roadW / 2 + 1 + i * 2}
            y={cy - roadW / 2 + 2}
            width={1}
            height={roadW - 4}
            fill="#ffffff50"
          />
        </g>
      ))}
      <polygon
        points={`${cx - 5},${cy - roadW / 2 - 18} ${cx + 5},${cy - roadW / 2 - 18} ${cx},${cy - roadW / 2 - 28}`}
        fill="#ffffff55"
      />
      <polygon
        points={`${cx - 4},${cy + roadW / 2 + 28} ${cx + 4},${cy + roadW / 2 + 28} ${cx},${cy + roadW / 2 + 18}`}
        fill="#ffffff55"
      />
      <polygon
        points={`${cx + roadW / 2 + 18},${cy - 4} ${cx + roadW / 2 + 18},${cy + 4} ${cx + roadW / 2 + 28},${cy}`}
        fill="#ffffff55"
      />
      <polygon
        points={`${cx - roadW / 2 - 28},${cy - 4} ${cx - roadW / 2 - 28},${cy + 4} ${cx - roadW / 2 - 18},${cy}`}
        fill="#ffffff55"
      />

      {!showMissOverlay ? <SensorDot cx={cx} cy={cy - roadW / 2 - 22} /> : null}

      {missPoints.map((m) => {
        const px = (m.x / 100) * size;
        const py = (m.y / 100) * size;
        const color = missToneColor((m as { tone?: string }).tone);
        const count = Number((m as { count?: number }).count ?? 0);
        const r = Math.max(4, Math.min(9, 3.5 + Math.log10(count + 1) * 2.2));
        return (
          <g key={m.id}>
            <motion.circle
              cx={px}
              cy={py}
              r={r + 6}
              fill={color}
              opacity={0.12}
              animate={{ opacity: [0.08, 0.2, 0.08], scale: [0.9, 1.15, 0.9] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              style={{ transformOrigin: `${px}px ${py}px` }}
            />
            <circle cx={px} cy={py} r={r} fill={color} opacity={0.92} />
            <circle cx={px} cy={py} r={Math.max(1.5, r * 0.35)} fill="white" opacity={0.85} />
            {m.label ? (
              <text
                x={px}
                y={py + r + 9}
                textAnchor="middle"
                fill="#ffffff88"
                fontSize="5.5"
                fontFamily="sans-serif"
              >
                {m.label.length > 22 ? `${m.label.slice(0, 20)}…` : m.label}
              </text>
            ) : null}
          </g>
        );
      })}

      {streetEW ? (
        <text
          x={size / 2}
          y={cy - roadW / 2 - 6}
          textAnchor="middle"
          fill="#ffffff70"
          fontSize="7"
          fontFamily="sans-serif"
        >
          {streetEW.length > 22 ? `${streetEW.slice(0, 20)}…` : streetEW}
        </text>
      ) : null}
      {streetNS ? (
        <text
          x={cx + roadW / 2 + 10}
          y={size / 2}
          textAnchor="start"
          fill="#ffffff70"
          fontSize="7"
          fontFamily="sans-serif"
          transform={`rotate(90 ${cx + roadW / 2 + 10} ${size / 2})`}
        >
          {streetNS.length > 22 ? `${streetNS.slice(0, 20)}…` : streetNS}
        </text>
      ) : null}
      <text x={size / 2} y={10} textAnchor="middle" fill="#9FE6FF" fontSize="7" fontFamily="sans-serif">
        {title.length > 42 ? `${title.slice(0, 40)}…` : title}
      </text>
      <text x={size / 2} y={size - 4} textAnchor="middle" fill="#ffffff45" fontSize="6" fontFamily="sans-serif">
        {footer}
      </text>
    </svg>
  );
}
