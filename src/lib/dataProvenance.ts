import type { DataType } from "@/data/datasetMetadata";

export type GeometryLinkage = "exact" | "matched" | "inferred" | "unlinked";

export const DATA_TYPE_COLORS: Record<DataType, { bg: string; text: string; border: string }> = {
  observed: { bg: "rgba(16,185,129,0.2)", text: "#a7f3d0", border: "rgba(52,211,153,0.45)" },
  derived: { bg: "rgba(101,125,245,0.2)", text: "#c7d2fe", border: "rgba(101,125,245,0.45)" },
  modelled: { bg: "rgba(245,158,11,0.18)", text: "#fde68a", border: "rgba(251,191,36,0.45)" },
  mock: { bg: "rgba(148,163,184,0.2)", text: "#e2e8f0", border: "rgba(148,163,184,0.4)" },
};

export function formatDataTypeLabel(type: DataType | string): string {
  const key = String(type).toLowerCase() as DataType;
  if (key === "observed") return "OBSERVED";
  if (key === "derived") return "DERIVED";
  if (key === "modelled") return "MODELLED";
  if (key === "mock") return "MOCK";
  return String(type).toUpperCase();
}

export function formatGeometryLinkage(linkage: GeometryLinkage | string): string {
  const key = String(linkage).toLowerCase();
  if (key === "exact") return "exact";
  if (key === "matched") return "matched";
  if (key === "inferred") return "inferred";
  if (key === "unlinked") return "unlinked";
  return key;
}

/** Inline HTML chips for Leaflet popups (matches DataProvenanceBadge palette). */
export function provenanceBadgesHtml(labels: string[]): string {
  return labels
    .map((label) => {
      const upper = label.toUpperCase();
      let type: DataType = "derived";
      if (upper.includes("OBSERV")) type = "observed";
      else if (upper.includes("MODEL")) type = "modelled";
      else if (upper.includes("MOCK") || upper.includes("COVERAGE")) type = "mock";
      const c = DATA_TYPE_COLORS[type];
      return `<span style="display:inline-block;padding:2px 6px;border-radius:999px;border:1px solid ${c.border};background:${c.bg};font-size:9px;color:${c.text};margin:2px 3px 0 0;">${label}</span>`;
    })
    .join("");
}
