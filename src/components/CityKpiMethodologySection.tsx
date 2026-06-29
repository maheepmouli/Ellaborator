import { getCityKpiMethodology } from "@/data/cityKpiMethodology";

const READINESS_COLORS: Record<"ready" | "partial" | "missing", string> = {
  ready: "border-emerald-400/40 bg-emerald-500/10 text-emerald-100",
  partial: "border-amber-400/40 bg-amber-500/10 text-amber-100",
  missing: "border-white/20 bg-white/5 text-white/70",
};

export default function CityKpiMethodologySection({ city }: { city: string }) {
  const entries = getCityKpiMethodology(city);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {entries.map((entry) => (
        <article key={`${city}-${entry.kpiId}`} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[12px] font-semibold text-white">
              {entry.kpiRef} · {entry.kpiName}
            </p>
            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${READINESS_COLORS[entry.readiness]}`}>
              {entry.readiness}
            </span>
          </div>
          <p className="text-[11px] text-white/80 leading-snug">
            <span className="font-semibold text-white">Meaning:</span> {entry.meaning}
          </p>
          <p className="text-[11px] text-white/80 leading-snug">
            <span className="font-semibold text-white">Calculation:</span> {entry.calculationMethod}
          </p>
          <p className="text-[11px] text-white/70 leading-snug">
            <span className="font-semibold text-white">Limitations:</span> {entry.limitations}
          </p>
          <p className="text-[10px] text-white/55">
            Sources: {entry.sources.length ? entry.sources.join(" · ") : "No linked dataset yet"}
          </p>
        </article>
      ))}
    </div>
  );
}
