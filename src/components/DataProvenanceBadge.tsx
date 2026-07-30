import type { DataType } from "@/data/datasetMetadata";
import { DATA_TYPE_COLORS, formatDataTypeLabel, toTrustClass } from "@/lib/dataProvenance";

type DataProvenanceBadgeProps = {
  type: DataType | string;
  className?: string;
};

/** Always shows OBSERVED | DERIVED | MOCK (modelled → DERIVED). */
export function DataProvenanceBadge({ type, className = "" }: DataProvenanceBadgeProps) {
  const trust = toTrustClass(type);
  const palette = DATA_TYPE_COLORS[trust];
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-intel-meta font-semibold tracking-wide ${className}`}
      style={{
        backgroundColor: palette.bg,
        color: palette.text,
        border: `1px solid ${palette.border}`,
      }}
      title={
        trust === "observed"
          ? "Values taken directly from partner datasets"
          : trust === "derived"
            ? "Values calculated or composed from partner datasets"
            : "No partner dataset for this view — illustrative mock"
      }
    >
      {formatDataTypeLabel(trust)}
    </span>
  );
}
