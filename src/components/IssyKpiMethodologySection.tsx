import { Link } from "react-router-dom";
import { ExternalLink, MapPin, CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import {
  ISSY_KPI_METHODOLOGY,
  ISSY_CITY_NAME,
  type IssyKpiMethodologyEntry,
} from "@/data/issyKpiMethodology";
import { DATASET_REGISTRY, type DataType } from "@/data/datasetMetadata";
import { getReadinessForCity, type KpiReadiness } from "@/data/kpiReadinessMatrix";
import { dataSourceTrustLabel } from "@/lib/issyDataTransparency";

const DATA_TYPE_COLORS: Record<DataType, string> = {
  observed: "bg-violet-600 border-violet-300/70 text-white",
  derived: "bg-sky-700 border-sky-300/70 text-white",
  modelled: "bg-amber-700 border-amber-300/70 text-white",
  mock: "bg-white/15 border-white/30 text-white",
};

const READINESS_COLORS: Record<KpiReadiness, string> = {
  ready: "bg-emerald-500/30 text-emerald-50 border-emerald-400/50",
  partial: "bg-amber-500/30 text-amber-50 border-amber-400/50",
  missing: "bg-white/10 text-white/60 border-white/20",
};

const READINESS_ICON: Record<KpiReadiness, React.ReactNode> = {
  ready: <CheckCircle2 className="h-3 w-3 text-emerald-400" />,
  partial: <AlertCircle className="h-3 w-3 text-amber-400" />,
  missing: <XCircle className="h-3 w-3 text-white/25" />,
};

const GITHUB_METHODOLOGY_URL =
  "https://github.com/maheepmouli/Ellaborator/blob/main/docs/ISSY_KPI_METHODOLOGY.md";

function datasetTitle(id: string): string {
  return DATASET_REGISTRY.find((d) => d.id === id)?.title ?? id;
}

function DataTypeBadge({ type }: { type: DataType }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold capitalize ${DATA_TYPE_COLORS[type]}`}
    >
      {type}
    </span>
  );
}

function ReadinessBadge({ readiness }: { readiness: KpiReadiness }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${READINESS_COLORS[readiness]}`}
    >
      {READINESS_ICON[readiness]}
      {readiness}
    </span>
  );
}

function MethodologyCard({
  entry,
  readiness,
}: {
  entry: IssyKpiMethodologyEntry;
  readiness: KpiReadiness;
}) {
  return (
    <article
      className="flex flex-col rounded-xl border border-violet-500/30 bg-gradient-to-br from-violet-500/[0.08] to-transparent p-4 h-full"
    >
      <header className="mb-3">
        <div className="flex flex-wrap items-center gap-2 mb-1.5">
          <span className="text-[11px] font-bold text-violet-300/90 tracking-wide">{entry.ref}</span>
          <DataTypeBadge type={entry.dataType} />
          <ReadinessBadge readiness={readiness} />
        </div>
        <h3 className="text-[14px] font-semibold text-white leading-snug">{entry.name}</h3>
        <p className="mt-1 text-[11px] text-white/45">
          Trust label: {dataSourceTrustLabel(entry.sourceKind)}
        </p>
      </header>

      <section className="mb-3">
        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-1.5">
          Primary datasets
        </h4>
        {entry.primaryDatasetIds.length === 0 ? (
          <p className="text-[11px] text-white/40 italic">No dataset linked in registry</p>
        ) : (
          <ul className="space-y-1 text-[11px] text-white/70 list-disc list-inside">
            {entry.primaryDatasetIds.map((id) => (
              <li key={id}>
                <span className="text-white/50 font-mono text-[10px]">{id}</span>
                {" — "}
                {datasetTitle(id)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-3 flex-1">
        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-1.5">
          Derivation steps
        </h4>
        <ol className="space-y-1.5 text-[11px] text-white/65 list-decimal list-inside leading-relaxed">
          {entry.steps.map((step, i) => (
            <li key={i} className="pl-0.5">
              {step}
            </li>
          ))}
        </ol>
      </section>

      <section className="mb-3">
        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-1.5">
          Formulas
        </h4>
        <pre className="rounded-lg border border-white/10 bg-black/30 p-3 font-mono text-[10px] text-white/80 whitespace-pre-wrap leading-relaxed overflow-x-auto">
          {entry.formulas}
        </pre>
      </section>

      <section className="mb-3">
        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-1.5">
          Limitations
        </h4>
        <ul className="space-y-1 text-[11px] text-white/50 list-disc list-inside leading-relaxed">
          {entry.limitations.map((note, i) => (
            <li key={i}>{note}</li>
          ))}
        </ul>
      </section>

      <footer className="mt-auto pt-2 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-2">
        <span className="text-[10px] text-white/35 font-mono">{entry.codeRefs.join(" · ")}</span>
        <Link
          to={`/map`}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-violet-300 hover:text-violet-200"
        >
          <MapPin className="h-3 w-3" />
          View on map
        </Link>
      </footer>
    </article>
  );
}

export default function IssyKpiMethodologySection() {
  const readinessByKpi = new Map(
    getReadinessForCity(ISSY_CITY_NAME).map((c) => [c.kpiId, c.readiness])
  );

  return (
    <div>
      <p className="text-[12px] text-white/50 leading-relaxed mb-4 max-w-3xl">
        Formulas below reflect the <strong className="text-white/70 font-medium">current app integration</strong>{" "}
        (May 2026), not the full official EU ELABORATOR indicator specification. For KPI 1.2, mode share is{" "}
        <strong className="text-white/70 font-medium">derived from zone OD flow volumes</strong>, not used to build
        the OD matrix.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {ISSY_KPI_METHODOLOGY.map((entry) => (
          <MethodologyCard
            key={entry.kpiId}
            entry={entry}
            readiness={readinessByKpi.get(entry.kpiId) ?? "missing"}
          />
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <a
          href={GITHUB_METHODOLOGY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[12px] text-violet-300 hover:text-violet-200 font-medium"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Full methodology (GitHub)
        </a>
      </div>
    </div>
  );
}
