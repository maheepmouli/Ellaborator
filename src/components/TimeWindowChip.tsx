type TimeWindowChipProps = {
  label: string;
  detail?: string;
  className?: string;
};

/** Unified temporal window indicator (Tier 1 — no animation). */
export function TimeWindowChip({ label, detail, className = "" }: TimeWindowChipProps) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-lg border border-violet/50 bg-violet/30 px-3 py-1.5 text-intel-meta text-white/95 backdrop-blur-md shadow-sm ${className}`}
      role="status"
    >
      <span className="font-semibold text-violet-100">Time window</span>
      <span className="tabular-nums">{label}</span>
      {detail && <span className="text-white/65 hidden sm:inline">· {detail}</span>}
    </div>
  );
}
