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

  if (diagnostics?.reason === "mock") return "mock";
  if (String(dataQualitySummary?.provenanceType ?? "").toLowerCase() === "mock") return "mock";
  if (city === "Copenhagen" && kpiId === "kpi4.1") return "mock";
  if (city === "Copenhagen" && kpiId === "kpi4.2") return "mock";
  // Trikala Pilot 2 has no P+R user-satisfaction survey — CITY_DATA figure is mock only.
  if (city === "Trikala" && kpiId === "kpi4.1" && pilot?.id === "tri-p2") return "mock";
  // Milan Pilot 3: SharePoint folder 7 empty — CDM3 Activity 5 satisfaction proxy.
  if (city === "Milan" && kpiId === "kpi4.1") {
    if (
      diagnostics?.reason === "mock" ||
      String(dataQualitySummary?.provenanceType ?? "").toLowerCase() === "mock" ||
      pilot?.id === "mil-p3"
    ) {
      // Real survey workbooks win when diagnostics say ok.
      if (diagnostics?.reason === "ok") return "observed";
      return "mock";
    }
  }
  // Trikala Pilot 3 road safety: mock speed derived from LoRa FREE/BUSY occupancy (no radar).
  if (city === "Trikala" && kpiId === "kpi2.1" && pilot?.id === "tri-p3") return "derived";

  // Local partner datasets count as observed only when the panel uses a live slice.
  if (
    panelUsesObservedSlice &&
    mapUsesLocalDataset &&
    (kpiId === "kpi1.2" || kpiId === "kpi2.1" || kpiId === "kpi3.1") &&
    (city === "Copenhagen" || city === "Helsinki" || city === "Milan")
  ) {
    return "observed";
  }

  if (panelUsesObservedSlice) {
    if (copenhagenEmissionsActive && kpiId === "kpi3.2") return "modelled";
    // Climate KPI is always a composition/proxy index (RETE traffic mix, congestion, etc.) — not measured CO₂.
    if (kpiId === "kpi3.2" && !copenhagenEmissionsActive) {
      return "derived";
    }
    if (pilot?.datasetType === "derived") {
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
  const { city, diagnostics, manifestAvailable, mapUsesLocalDataset, panelUsesObservedSlice } =
    input;

  // Observed panel figures or live map layers — no SharePoint/fallback scare banners.
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
  const kpiDef = getKpiDefinition(kpiId);
  const dataLabel =
    headlineSource === "mock"
      ? city === "Trikala" && kpiId === "kpi4.1" && pilot?.id === "tri-p2"
        ? "MOCK"
        : "Illustrative"
      : headlineSource === "modelled"
        ? "Modelled"
        : headlineSource === "derived"
          ? "Derived"
          : (kpiDef?.dataLabel ?? "Observed");

  const missingNotice = getKpiMissingDataNotice(city, kpiId, pilot, input.diagnostics) ?? null;

  return {
    headlineSource,
    sourceLabel: resolveSourceLabel(city, kpiId, input.diagnostics, pilot),
    dataLabel,
    confidence: dataQualitySummary?.confidence,
    missingNotice,
    degradedBanner: resolveDegradedBanner(input),
    panelMapSplit: Boolean(
      input.mapUsesLocalDataset && !input.panelUsesObservedSlice
    ),
    readiness,
  };
}

export function provenanceConfidenceLine(
  provenance: KpiProvenance,
  formatLine: (dataLabel: DataLabel | string, confidence?: string, sourceHint?: string) => string
): string {
  return formatLine(provenance.dataLabel, provenance.confidence, provenance.sourceLabel);
}
