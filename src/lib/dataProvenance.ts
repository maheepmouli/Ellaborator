import { DATASET_REGISTRY, type DataType, type DatasetMetadata } from "@/data/datasetMetadata";
import { dataSourceTrustLabel, kpiPrimaryIssySource } from "@/lib/issyDataTransparency";
import { isIssyCity } from "@/lib/issyMapRouting";

export type GeometryLinkage = "exact" | "matched" | "inferred" | "unlinked";

/** Canonical trust classes shown to users. Modelled calculations fold into DERIVED. */
export type TrustClass = "observed" | "derived" | "mock";

export const DATA_TYPE_COLORS: Record<DataType, { bg: string; text: string; border: string }> = {
  observed: { bg: "rgba(16,185,129,0.2)", text: "#a7f3d0", border: "rgba(52,211,153,0.45)" },
  derived: { bg: "rgba(101,125,245,0.2)", text: "#c7d2fe", border: "rgba(101,125,245,0.45)" },
  modelled: { bg: "rgba(101,125,245,0.2)", text: "#c7d2fe", border: "rgba(101,125,245,0.45)" },
  mock: { bg: "rgba(148,163,184,0.2)", text: "#e2e8f0", border: "rgba(148,163,184,0.4)" },
};

export const TRUST_CLASS_BLURBS: Record<TrustClass, string> = {
  observed: "Values taken directly from partner datasets",
  derived: "Calculated / composed from datasets (incl. former “modelled”)",
  mock: "Illustrative fill where partner evidence is missing",
};

/** City×KPI pairs that reuse observed files as mock survey/accessibility placeholders. */
const CITY_OVERVIEW_TRUST_OVERRIDES: Record<string, TrustClass> = {
  "Copenhagen|kpi4.1": "mock",
  "Copenhagen|kpi4.2": "mock",
  "Zaragoza|kpi4.1": "mock",
  "Zaragoza|kpi4.2": "mock",
  "Zaragoza|kpi3.2": "observed", // Nanoenvi for p1; p2 mock handled in-pilot
  "Milan|kpi4.1": "mock",
  "Trikala|kpi4.1": "mock",
};

function datasetOverviewTrust(dataset: DatasetMetadata): TrustClass {
  if (
    dataset.dataType === "mock" ||
    dataset.realDataStatus === "mock" ||
    String(dataset.parserStatus).toLowerCase() === "mock" ||
    String(dataset.notes ?? "").toLowerCase().includes("labelled mock") ||
    String(dataset.title ?? "").toLowerCase().includes("mock ")
  ) {
    return "mock";
  }
  if (dataset.realDataStatus === "fallback" && dataset.dataType !== "observed") {
    return "mock";
  }
  return toTrustClass(dataset.dataType);
}

/**
 * Static trust class for Europe-map city popups (no live pilot slice).
 * Prefer partner-observed evidence when linked; otherwise DERIVED / MOCK.
 */
export function resolveCityOverviewTrust(city: string, kpiId: string): TrustClass {
  // Road safety overview = baseline view → OBSERVED (post/comparison MOCK only in scenario UI).
  if (kpiId === "kpi2.1") return "observed";

  const override = CITY_OVERVIEW_TRUST_OVERRIDES[`${city}|${kpiId}`];
  if (override) return override;

  const datasets = DATASET_REGISTRY.filter(
    (d) => d.city === city && d.linkedKpis.includes(kpiId)
  );
  if (datasets.length === 0) return "mock";

  if (isIssyCity(city)) {
    return toTrustClass(dataSourceTrustLabel(kpiPrimaryIssySource(kpiId)));
  }

  const trusts = datasets.map(datasetOverviewTrust);
  if (trusts.includes("observed")) return "observed";
  if (trusts.includes("derived")) return "derived";
  return "mock";
}

/** Compact OBSERVED | DERIVED | MOCK chip for Leaflet HTML popups. */
export function trustChipHtml(trust: TrustClass): string {
  const c = DATA_TYPE_COLORS[trust];
  return `<span style="display:inline-block;padding:2px 7px;border-radius:999px;border:1px solid ${c.border};background:${c.bg};font-size:9px;font-weight:700;letter-spacing:0.04em;color:${c.text};">${formatDataTypeLabel(trust)}</span>`;
}

/** Map any provenance string to the three trust classes users see. */
export function toTrustClass(type: string | null | undefined): TrustClass {
  const key = String(type ?? "").toLowerCase().trim();
  if (!key) return "mock";
  if (key === "observed" || key.includes("observ")) return "observed";
  if (
    key === "mock" ||
    key.includes("mock") ||
    key.includes("illustrative") ||
    key.includes("demo") ||
    key.includes("placeholder")
  ) {
    return "mock";
  }
  // derived | modelled | calculated | proxy → DERIVED
  return "derived";
}

export function formatDataTypeLabel(type: DataType | string): string {
  const trust = toTrustClass(type);
  if (trust === "observed") return "OBSERVED";
  if (trust === "derived") return "DERIVED";
  return "MOCK";
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
      const trust = toTrustClass(label);
      const c = DATA_TYPE_COLORS[trust];
      const trimmed = label.trim();
      // Canonicalize pure trust words; keep descriptive suffixes (e.g. "KPI 4.1").
      const chip = /^(observed|derived|modelled|modeled|mock|illustrative)$/i.test(trimmed)
        ? formatDataTypeLabel(trust)
        : trimmed;
      return `<span style="display:inline-block;padding:2px 6px;border-radius:999px;border:1px solid ${c.border};background:${c.bg};font-size:9px;color:${c.text};margin:2px 3px 0 0;">${chip}</span>`;
    })
    .join("");
}
