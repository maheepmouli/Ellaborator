import type { DataType } from "@/data/datasetMetadata";
import { DATA_TYPE_COLORS, formatDataTypeLabel } from "@/lib/dataProvenance";

type DataProvenanceBadgeProps = {
  type: DataType | string;
  className?: string;
};

export function DataProvenanceBadge({ type, className = "" }: DataProvenanceBadgeProps) {
  const key = String(type).toLowerCase() as DataType;
  const palette = DATA_TYPE_COLORS[key] ?? DATA_TYPE_COLORS.derived;
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-intel-meta font-semibold ${className}`}
      style={{
        backgroundColor: palette.bg,
        color: palette.text,
        border: `1px solid ${palette.border}`,
      }}
    >
      {formatDataTypeLabel(key)}
    </span>
  );
}
