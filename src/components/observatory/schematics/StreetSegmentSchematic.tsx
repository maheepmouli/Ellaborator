import { OBS_C, obsGlassCardClass, obsGlassCardStyle } from "@/components/observatory/observatoryStyles";
import type { ObservatoryGraphicPayload } from "@/lib/observatoryGraphicTypes";

interface StreetSegmentSchematicProps {
  payload: ObservatoryGraphicPayload;
  expanded?: boolean;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** Milan KPI 2.1 — observed speed vs limit with before/after delta (reused for Zaragoza safety). */
function MilanSpeedDiagram({ payload, expanded }: StreetSegmentSchematicProps) {
  const profile = payload.speedDiagram;
  const baselineRaw = Number(profile?.baselineKmh ?? payload.trend?.[0]?.v ?? 0);
  const interventionRaw = Number(
    profile?.interventionKmh ?? payload.trend?.[1]?.v ?? profile?.avgKmh ?? payload.kpiValue ?? 0
  );
  // Prefer intervention intensity for the bar marker. Never plot a negative comparison delta as "Avg".
  const rawAvg = Number(profile?.avgKmh ?? payload.kpiValue ?? interventionRaw);
  const intervention =
    interventionRaw > 0 ? interventionRaw : rawAvg > 0 ? rawAvg : 0;
  const avg = rawAvg < 0 && intervention > 0 ? intervention : rawAvg >= 0 ? rawAvg : intervention;
  const baseline = baselineRaw > 0 ? baselineRaw : avg > 0 ? avg * 1.08 : 0;
  const p85 = Number(profile?.p85Kmh ?? 0);
  const limit = Number(profile?.limitKmh ?? 0);
  const street =
    profile?.streetName ||
    payload.streetEW ||
    payload.pilotTitle ||
    "Monitored street segment";
  const title = profile?.title ?? "AMAT segment speed";
  const unit = profile?.unitLabel ?? "km/h";
  const caption =
    profile?.caption ??
    `Observed Maggio avg speed on the selected network.shp link${
      limit > 0 ? ` · limit ${limit} ${unit}` : ""
    }. Green = well below limit; orange = near/over limit.`;

  const scaleMax = Math.max(limit > 0 ? limit : 50, avg, p85, baseline, intervention, 1) * 1.08;
  const avgPct = clamp((avg / scaleMax) * 100, 0, 100);
  const p85Pct = p85 > 0 ? clamp((p85 / scaleMax) * 100, 0, 100) : null;
  const limitPct = limit > 0 ? clamp((limit / scaleMax) * 100, 0, 100) : null;
  const delta = intervention - baseline;
  const deltaColor = delta <= 0 ? OBS_C.lime : OBS_C.amber;
  const fillColor =
    limit > 0 && avg > limit * 0.95
      ? "#F97316"
      : limit > 0 && avg > limit * 0.75
        ? "#94A3D4"
        : "#22C55E";

  const formatValue = (n: number) =>
    unit === "km/h" ? `${n.toFixed(1)} km/h` : `${n.toFixed(1)} ${unit}`;

  return (
    <div
      className={`${obsGlassCardClass(!expanded)} w-full max-w-[320px]`}
      style={obsGlassCardStyle()}
    >
      <p className="text-[10px] uppercase tracking-wide text-white/45 mb-1">{title}</p>
      <p className="text-[13px] font-semibold text-white/90 truncate mb-3" title={street}>
        {street}
      </p>

      <div className="relative mb-4 pt-5 pb-1">
        <div className="h-3 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${avgPct}%`,
              background: `linear-gradient(90deg, ${fillColor}aa, ${fillColor})`,
            }}
          />
        </div>

        <div
          className="absolute top-0 -translate-x-1/2 flex flex-col items-center"
          style={{ left: `${avgPct}%` }}
        >
          <span className="text-[9px] font-semibold whitespace-nowrap" style={{ color: OBS_C.cyan }}>
            Avg {avg.toFixed(0)}
          </span>
          <span
            className="mt-0.5 h-2 w-2 rounded-full border border-white/80"
            style={{ background: OBS_C.cyan }}
          />
        </div>

        {p85Pct != null ? (
          <div
            className="absolute bottom-0 -translate-x-1/2 flex flex-col items-center"
            style={{ left: `${p85Pct}%` }}
          >
            <span
              className="mb-0.5 h-1.5 w-1.5 rounded-full"
              style={{ background: OBS_C.amber }}
            />
            <span className="text-[8px] text-white/50 whitespace-nowrap">P85 {p85.toFixed(0)}</span>
          </div>
        ) : null}

        {limitPct != null ? (
          <div
            className="absolute inset-y-5 w-px"
            style={{ left: `${limitPct}%`, background: "rgba(255,255,255,0.55)" }}
            title={`Limit ${limit} ${unit}`}
          >
            <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[8px] text-white/55 whitespace-nowrap">
              Limit {limit}
            </span>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-2">
        <div>
          <p className="text-[8px] uppercase text-white/40">Before</p>
          <p className="text-[12px] font-semibold text-white/80">{formatValue(baseline)}</p>
        </div>
        <div>
          <p className="text-[8px] uppercase text-white/40">After</p>
          <p className="text-[12px] font-semibold" style={{ color: OBS_C.cyan }}>
            {formatValue(intervention)}
          </p>
        </div>
        <div>
          <p className="text-[8px] uppercase text-white/40">Delta</p>
          <p className="text-[12px] font-semibold" style={{ color: deltaColor }}>
            {delta >= 0 ? "+" : ""}
            {delta.toFixed(1)} {unit}
          </p>
        </div>
      </div>

      <p className="text-[9px] text-white/40 leading-relaxed">{caption}</p>
    </div>
  );
}

/** Generic corridor placeholder for non-speed KPIs. */
function GenericCorridorSchematic({ payload, expanded }: StreetSegmentSchematicProps) {
  const w = expanded ? 280 : 240;
  const h = expanded ? 100 : 72;
  const fill = clamp(payload.segmentGradient ?? 0.45, 0.08, 1);
  const street = payload.streetEW || payload.pilotTitle || "Monitored street segment";

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-label="Street segment schematic">
      <rect width={w} height={h} fill="#06050f" rx="10" />
      <text x={w / 2} y={16} textAnchor="middle" fill="#9FE6FF" fontSize="9" fontFamily="sans-serif">
        {street.length > 34 ? `${street.slice(0, 32)}…` : street}
      </text>
      <rect x={18} y={h / 2 - 10} width={w - 36} height={20} fill="#1a1830" rx="6" />
      <rect
        x={18}
        y={h / 2 - 10}
        width={(w - 36) * fill}
        height={20}
        fill={OBS_C.cyan}
        opacity={0.45}
        rx="6"
      />
      <circle cx={18 + (w - 36) * fill} cy={h / 2} r={4} fill={OBS_C.cyan} />
      <text x={w / 2} y={h - 8} textAnchor="middle" fill="#ffffff50" fontSize="7" fontFamily="sans-serif">
        Corridor intensity along monitored segment
      </text>
    </svg>
  );
}

export function StreetSegmentSchematic({ payload, expanded }: StreetSegmentSchematicProps) {
  // Milan AMAT speed + Zaragoza corridor safety/speed — never treat Trikala occupancy % as km/h.
  const isSpeedDiagram =
    Boolean(payload.speedDiagram) ||
    (payload.kpiId === "kpi2.1" && Boolean(payload.amatSegmentSpeed));

  if (isSpeedDiagram) {
    return <MilanSpeedDiagram payload={payload} expanded={expanded} />;
  }

  return <GenericCorridorSchematic payload={payload} expanded={expanded} />;
}
