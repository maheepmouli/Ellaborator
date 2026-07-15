import {
  getLocationById,
  getTelraamOutcomeForLocation,
  type CopenhagenTelraamOutcome,
} from "@/data/copenhagenLocationRegistry";

const C = {
  border: "rgba(255,255,255,0.11)",
  glass: "rgba(255,255,255,0.055)",
  cyan: "#63ccff",
};

function formatDelta(value: number): string {
  return value > 0 ? `+${value}%` : `${value}%`;
}

function deltaColor(value: number): string {
  if (value < 0) return "#f87171";
  if (value > 0) return "#86efac";
  return "rgba(255,255,255,0.75)";
}

function MetricRow({
  label,
  value,
  muted,
}: {
  label: string;
  value: number;
  muted?: boolean;
}) {
  return (
    <tr className="border-b border-white/5 last:border-0">
      <td className={`py-1.5 pr-2 text-[11px] ${muted ? "text-white/55" : "text-white/75"}`}>
        {label}
      </td>
      <td
        className="py-1.5 text-right text-[11px] font-semibold tabular-nums"
        style={{ color: deltaColor(value) }}
      >
        {formatDelta(value)}
      </td>
    </tr>
  );
}

export function TelraamSummaryCard({
  locationId,
  className = "",
}: {
  locationId: string;
  className?: string;
}) {
  const location = getLocationById(locationId);
  const outcome = getTelraamOutcomeForLocation(locationId);
  if (!location || location.kind !== "telraam_counter" || !outcome) return null;

  return (
    <div
      className={`rounded-xl border px-4 py-3 ${className}`}
      style={{ background: C.glass, borderColor: C.border }}
    >
      <div className="mb-2 flex items-center gap-2">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: C.cyan, boxShadow: `0 0 8px ${C.cyan}` }}
        />
        <p className="text-[11px] font-semibold text-white/90">Telraam continuous sensor summary</p>
      </div>
      <p className="mb-2 text-[10px] text-white/58">{location.name}</p>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-white/10 text-left text-[9px] uppercase tracking-wide text-white/45">
            <th className="pb-1 font-medium">Transport mode</th>
            <th className="pb-1 text-right font-medium">Relative delta (pre vs post)</th>
          </tr>
        </thead>
        <tbody>
          <MetricRow label="Motorized traffic" value={outcome.motorizedPctChange} />
          <MetricRow label="Bicycles" value={outcome.bicyclePctChange} />
          {typeof outcome.pedestrianPctChange === "number" ? (
            <MetricRow
              label="Pedestrians (relative change only)"
              value={outcome.pedestrianPctChange}
              muted={outcome.pedestrianUndercountWarning}
            />
          ) : outcome.pedestrianUndercountWarning ? (
            <tr>
              <td colSpan={2} className="py-1.5 text-[10px] text-amber-200/75">
                Pedestrian absolute volumes excluded — Telraam undercounts foot traffic.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
      <TelraamFootnotes outcome={outcome} />
    </div>
  );
}

function TelraamFootnotes({ outcome }: { outcome: CopenhagenTelraamOutcome }) {
  return (
    <div className="mt-2 space-y-1 text-[10px] leading-relaxed text-white/55">
      <p>{outcome.period}</p>
      <p>{outcome.source}</p>
      {outcome.pedestrianUndercountWarning && (
        <p className="text-amber-200/80">
          Pedestrian hardware undercount (&gt;20% at some sites). Evaluate relative percentage change
          only.
        </p>
      )}
      {outcome.cautionNote ? <p className="text-amber-200/75">{outcome.cautionNote}</p> : null}
    </div>
  );
}
