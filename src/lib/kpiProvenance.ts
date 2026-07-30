import type { DataLabel } from "@/config/kpiDefinitions";
import { getKpiDefinition } from "@/config/kpiDefinitions";
import { getCityKpiMethodology } from "@/data/cityKpiMethodology";
import { DATASET_REGISTRY } from "@/data/datasetMetadata";
import { getReadinessForCity } from "@/data/kpiReadinessMatrix";
import type { PilotDefinition } from "@/data/pilotDefinitions";
import { getKpiMissingDataNotice } from "@/lib/kpiMissingDataMessage";
import { kpiPrimaryIssySource, dataSourceTrustLabel } from "@/lib/issyDataTransparency";
import { isIssyCity } from "@/lib/issyMapRouting";
import { formatDataTypeLabel, toTrustClass } from "@/lib/dataProvenance";
import type { LocalCityDiagnostics } from "@/services/localCityData";

/** Internal source kinds. UI always collapses modelled → DERIVED. */
export type HeadlineSource = "observed" | "derived" | "modelled" | "mock";

export type KpiProvenanceInput = {
  city: string;
  kpiId: string;
  pilot?: PilotDefinition | null;
  diagnostics?: LocalCityDiagnostics | null;
  dataQualitySummary?: {
    confidence?: "High" | "Medium" | "Low";
    provenanceType?: string;
    dataType?: string;
    recordsLabel?: string;
  } | null;
  manifestAvailable?: boolean;
  /** Panel is using live parsed slice (not CITY_DATA mock). */
  panelUsesObservedSlice?: boolean;
  /** Map layer uses live local-city dataset. */
  mapUsesLocalDataset?: boolean;
  copenhagenEmissionsActive?: boolean;
};

export type KpiProvenance = {
  headlineSource: HeadlineSource;
  /** Always observed | derived | mock for badges. */
  trustClass: "observed" | "derived" | "mock";
  sourceLabel: string;
  dataLabel: DataLabel | string;
  confidence?: "High" | "Medium" | "Low";
  missingNotice: string | null;
  degradedBanner: string | null;
  panelMapSplit: boolean;
  readiness: "ready" | "partial" | "missing";
};

function cityDatasets(city: string, kpiId: string) {
  return DATASET_REGISTRY.filter((d) => d.city === city && d.linkedKpis.includes(kpiId));
}

function diagnosticsDegraded(diagnostics?: LocalCityDiagnostics | null): boolean {
  if (!diagnostics) return false;
  return diagnostics.reason === "files-unavailable" || diagnostics.reason === "no-records";
}

function diagnosticsUsesBundledFallback(diagnostics?: LocalCityDiagnostics | null): boolean {
  if (!diagnostics?.message) return false;
  const msg = diagnostics.message.toLowerCase();
  return msg.includes("bundled json fallback") || msg.includes("json fallback");
}

function resolveSourceLabel(
  city: string,
  kpiId: string,
  diagnostics?: LocalCityDiagnostics | null,
  pilot?: PilotDefinition | null
): string {
  if (city === "Copenhagen" && kpiId === "kpi4.1") {
    return "MOCK satisfaction (mode-share sites)";
  }
  if (city === "Trikala" && kpiId === "kpi4.1" && pilot?.id === "tri-p2") {
    return "MOCK satisfaction — no P+R user survey linked";
  }
  if (city === "Copenhagen" && kpiId === "kpi4.2") {
    return "MOCK accessibility (mode-share sites)";
  }
  if (city === "Zaragoza" && kpiId === "kpi4.1") {
    return "MOCK satisfaction at Nanoenvi AQ sites";
  }
  if (city === "Zaragoza" && kpiId === "kpi4.2") {
    return pilot?.id === "zar-p3"
      ? "MOCK hospital accessibility features"
      : "MOCK accessibility features (AYZG1 corridor)";
  }
  if (city === "Zaragoza" && kpiId === "kpi3.2" && pilot?.id === "zar-p2") {
    return "MOCK Romareda climate pins (no Nanoenvi rows)";
  }
  if (city === "Zaragoza" && kpiId === "kpi2.1" && pilot?.id === "zar-p3") {
    return "MOCK hospital corridor speeds";
  }
  if (diagnostics?.reason === "mock") {
    return "Illustrative junction mode-share mock";
  }
  const methodology = getCityKpiMethodology(city).find((e) => e.kpiId === kpiId);
  if (methodology?.sources.length) {
    return methodology.sources[0];
  }
  const datasets = cityDatasets(city, kpiId);
  if (datasets.length) {
    return datasets[0].title;
  }
  if (isIssyCity(city)) {
    return dataSourceTrustLabel(kpiPrimaryIssySource(kpiId));
  }
  return getKpiDefinition(kpiId)?.dataSource ?? "City-provided dataset";
}

function resolveHeadlineSource(input: KpiProvenanceInput): HeadlineSource {
  const {
    kpiId,
    pilot,
    diagnostics,
    panelUsesObservedSlice,
    copenhagenEmissionsActive,
    city,
    mapUsesLocalDataset,
    dataQualitySummary,
  } = input;

  const pq = toTrustClass(dataQualitySummary?.provenanceType);
  const pqRaw = String(dataQualitySummary?.provenanceType ?? "").toLowerCase();

  // Map-layer / quality summary is the strongest runtime signal when present.
  if (pqRaw) {
    if (pq === "mock") return "mock";
    if (pqRaw === "modelled") return "modelled";
    if (pq === "derived") return "derived";
    if (pq === "observed") return "observed";
  }

  if (diagnostics?.reason === "mock") return "mock";
  if (city === "Copenhagen" && kpiId === "kpi4.1") return "mock";
  if (city === "Copenhagen" && kpiId === "kpi4.2") return "mock";
  if (city === "Trikala" && kpiId === "kpi4.1" && pilot?.id === "tri-p2") return "mock";
  if (city === "Milan" && kpiId === "kpi4.1") {
    if (diagnostics?.reason === "mock" || pilot?.id === "mil-p3") {
      if (diagnostics?.reason === "ok") return "observed";
      return "mock";
    }
  }
  if (city === "Trikala" && kpiId === "kpi2.1" && pilot?.id === "tri-p3") return "derived";

  if (
    panelUsesObservedSlice &&
    mapUsesLocalDataset &&
    (kpiId === "kpi1.2" || kpiId === "kpi2.1" || kpiId === "kpi3.1") &&
    (city === "Copenhagen" || city === "Helsinki" || city === "Milan" || city === "Zaragoza")
  ) {
    return "observed";
  }

  if (panelUsesObservedSlice) {
    if (copenhagenEmissionsActive && kpiId === "kpi3.2") return "modelled";
    if (kpiId === "kpi3.2" && !copenhagenEmissionsActive) {
      return "derived";
    }
    if (pilot?.datasetType === "derived") {
      return "derived";
    }
    if (pilot?.datasetType === "mock") {
      return "mock";
    }
    return "observed";
  }

  if (diagnosticsDegraded(diagnostics)) {
    if (diagnosticsUsesBundledFallback(diagnostics)) return "derived";
    return "mock";
  }

  const readiness = getReadinessForCity(city).find((c) => c.kpiId === kpiId)?.readiness;
  if (readiness === "missing") return "mock";

  const kpiDef = getKpiDefinition(kpiId);
  if (kpiDef?.dataLabel === "Modelled") return "modelled";
  if (kpiDef?.dataLabel === "Derived") return "derived";
  if (kpiDef?.dataLabel === "Observed") return "observed";
  return "mock";
}

function resolveDegradedBanner(input: KpiProvenanceInput): string | null {
  const { diagnostics, manifestAvailable, mapUsesLocalDataset, panelUsesObservedSlice } = input;

  if (panelUsesObservedSlice || mapUsesLocalDataset) {
    return null;
  }
  if (manifestAvailable === false) {
    return "SharePoint extract missing — map may use bundled fallback; panel figures may be illustrative.";
  }
  if (diagnosticsDegraded(diagnostics)) {
    if (diagnostics?.reason === "files-unavailable") {
      return "Observed source files unavailable — showing fallback or illustrative data.";
    }
    if (diagnostics?.reason === "no-records") {
      return "No records parsed for this pilot/KPI configuration.";
    }
  }
  if (diagnosticsUsesBundledFallback(diagnostics)) {
    return "Using bundled JSON fallback — SharePoint xlsx mirror was unavailable or incomplete.";
  }
  return null;
}

/** Pure synchronous provenance resolver — safe inside useMemo and hover handlers. */
export function resolveKpiProvenance(input: KpiProvenanceInput): KpiProvenance {
  const { city, kpiId, pilot, dataQualitySummary } = input;
  const readiness =
    getReadinessForCity(city).find((c) => c.kpiId === kpiId)?.readiness ?? "missing";
  const headlineSource = resolveHeadlineSource(input);
  const trustClass = toTrustClass(headlineSource);
  const dataLabel = formatDataTypeLabel(trustClass);

  const missingNotice = getKpiMissingDataNotice(city, kpiId, pilot, input.diagnostics) ?? null;

  return {
    headlineSource,
    trustClass,
    sourceLabel: resolveSourceLabel(city, kpiId, input.diagnostics, pilot),
    dataLabel,
    confidence: dataQualitySummary?.confidence,
    missingNotice,
    degradedBanner: resolveDegradedBanner(input),
    panelMapSplit: Boolean(input.mapUsesLocalDataset && !input.panelUsesObservedSlice),
    readiness,
  };
}

export function provenanceConfidenceLine(
  provenance: KpiProvenance,
  formatLine: (dataLabel: DataLabel | string, confidence?: string, sourceHint?: string) => string
): string {
  return formatLine(provenance.dataLabel, provenance.confidence, provenance.sourceLabel);
}
