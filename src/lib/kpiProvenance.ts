import type { DataLabel } from "@/config/kpiDefinitions";
import { getKpiDefinition } from "@/config/kpiDefinitions";
import { getCityKpiMethodology } from "@/data/cityKpiMethodology";
import { DATASET_REGISTRY } from "@/data/datasetMetadata";
import { getReadinessForCity } from "@/data/kpiReadinessMatrix";
import type { PilotDefinition } from "@/data/pilotDefinitions";
import { getKpiMissingDataNotice } from "@/lib/kpiMissingDataMessage";
import { kpiPrimaryIssySource, dataSourceTrustLabel } from "@/lib/issyDataTransparency";
import { isIssyCity } from "@/lib/issyMapRouting";
import type { LocalCityDiagnostics } from "@/services/localCityData";

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
  diagnostics?: LocalCityDiagnostics | null
): string {
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
  const { kpiId, pilot, diagnostics, panelUsesObservedSlice, copenhagenEmissionsActive, city } =
    input;

  if (diagnostics?.reason === "mock") return "mock";

  if (panelUsesObservedSlice) {
    if (copenhagenEmissionsActive && kpiId === "kpi3.2") return "modelled";
    if (kpiId === "kpi3.2" && pilot?.datasetType === "derived" && !copenhagenEmissionsActive) {
      return "derived";
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
  if (mapUsesLocalDataset && !panelUsesObservedSlice) {
    return "Map uses local dataset; panel headline may still be illustrative.";
  }
  return null;
}

/** Pure synchronous provenance resolver — safe inside useMemo and hover handlers. */
export function resolveKpiProvenance(input: KpiProvenanceInput): KpiProvenance {
  const { city, kpiId, pilot, dataQualitySummary } = input;
  const readiness =
    getReadinessForCity(city).find((c) => c.kpiId === kpiId)?.readiness ?? "missing";
  const headlineSource = resolveHeadlineSource(input);
  const kpiDef = getKpiDefinition(kpiId);
  const dataLabel =
    headlineSource === "mock"
      ? "Illustrative"
      : headlineSource === "modelled"
        ? "Modelled"
        : headlineSource === "derived"
          ? "Derived"
          : (kpiDef?.dataLabel ?? "Observed");

  const missingNotice = getKpiMissingDataNotice(city, kpiId, pilot, input.diagnostics) ?? null;

  return {
    headlineSource,
    sourceLabel: resolveSourceLabel(city, kpiId, input.diagnostics),
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
