import { DataProvenanceBadge } from "@/components/DataProvenanceBadge";
import type { DataType } from "@/data/datasetMetadata";

export type LayerTrustSummary = {
  recordsLabel: string;
  spatialQuality: string;
  dataType: string;
  temporalCoverage: string;
  confidence: "High" | "Medium" | "Low";
  /** Optional normalized provenance chip */
  provenanceType?: DataType | string;
  geometryLinkage?: string;
  spatialSystemHint?: string;
};

type LayerTrustStripProps = {
  summary: LayerTrustSummary;
  compact?: boolean;
};

function inferProvenanceType(dataType: string): DataType {
  const lower = dataType.toLowerCase();
  if (lower.includes("mock") || lower.includes("coverage")) return "mock";
  if (lower.includes("model")) return "modelled";
  if (lower.includes("deriv") || lower.includes("proxy")) return "derived";
  if (lower.includes("observ")) return "observed";
  return "derived";
}

export function LayerTrustStrip({ summary, compact = false }: LayerTrustStripProps) {
  const provenance = summary.provenanceType ?? inferProvenanceType(summary.dataType);
  return (
    <div
      className={`rounded-lg border border-white/15 bg-white/5 ${compact ? "p-2 space-y-1" : "p-3 space-y-2"}`}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <DataProvenanceBadge type={provenance} />
        <span className="text-intel-meta px-1.5 py-0.5 rounded bg-white/10 text-white/90">
          Confidence {summary.confidence}
        </span>
        {summary.geometryLinkage && (
          <span className="text-intel-meta px-1.5 py-0.5 rounded bg-white/10 text-white/80">
            Linkage: {summary.geometryLinkage}
          </span>
        )}
      </div>
      <p className="text-intel-meta text-white/90">
        <span className="text-white/65">Records:</span> {summary.recordsLabel}
      </p>
      <p className="text-intel-meta text-white/85">
        <span className="text-white/65">Spatial:</span> {summary.spatialQuality}
      </p>
      <p className="text-intel-meta text-white/85">
        <span className="text-white/65">Period:</span> {summary.temporalCoverage}
      </p>
      {summary.spatialSystemHint && (
        <p className="text-intel-meta text-violet-200/95">{summary.spatialSystemHint}</p>
      )}
    </div>
  );
}
