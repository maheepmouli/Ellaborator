import { DATASET_REGISTRY } from "@/data/datasetMetadata";
import { ELABORATOR_KPIS } from "@/data/kpiDefinitions";
import { getReadinessForCity } from "@/data/kpiReadinessMatrix";

export interface CityKpiMethodologyEntry {
  city: string;
  kpiId: string;
  kpiRef: string;
  kpiName: string;
  meaning: string;
  calculationMethod: string;
  limitations: string;
  sources: string[];
  readiness: "ready" | "partial" | "missing";
}

const KPI_METHOD_FALLBACKS: Record<
  string,
  { meaning: string; calculationMethod: string; limitations: string }
> = {
  "kpi1.1": {
    meaning: "Formal intervention expansion-plan readiness at the pilot site.",
    calculationMethod:
      "Counts formal expansion plans against the ≥1 plan target; when the plan artifact is pending, monitoring coverage (Telraam / Mobilysis) is used as a readiness proxy.",
    limitations:
      "Helsinki FVH3 currently lacks a structured expansion-plan artifact — readiness is monitoring-based until the plan is delivered.",
  },
  "kpi1.2": {
    meaning: "Mobility behavior change in intervention context.",
    calculationMethod: "Observed or derived mode-oriented counts are normalized and compared across baseline/intervention periods.",
    limitations: "Not always city-wide; interpretation depends on intervention-linked monitoring coverage.",
  },
  "kpi2.1": {
    meaning: "Safety pressure and conflict risk around intervention areas.",
    calculationMethod: "Observed speed/flow proxies are transformed into comparative pressure indicators.",
    limitations: "Proxy-based in pilots without direct incident risk datasets.",
  },
  "kpi3.1": {
    meaning: "Availability of green/zero-emission support infrastructure.",
    calculationMethod: "Facility inventories are counted and spatially linked to intervention zones.",
    limitations: "Coverage depends on partner inventory completeness and geometry quality.",
  },
  "kpi3.2": {
    meaning: "Environmental pressure related to mobility intensity.",
    calculationMethod: "Observed or derived mobility intensity is converted into environmental proxy signals.",
    limitations: "Often modelled/derived; not a direct measured emissions dataset unless specified by source.",
  },
  "kpi4.1": {
    meaning: "User sentiment and perceived quality in intervention contexts.",
    calculationMethod: "Survey or feedback samples are aggregated to KPI scale.",
    limitations: "May be unavailable where no live survey feed exists.",
  },
  "kpi4.2": {
    meaning: "Accessibility support and inclusive mobility conditions.",
    calculationMethod: "Accessibility features or reachability proxies are aggregated for intervention comparison.",
    limitations: "Requires observed audit datasets for high-confidence interpretation.",
  },
};

export function getCityKpiMethodology(city: string): CityKpiMethodologyEntry[] {
  const readiness = new Map(getReadinessForCity(city).map((cell) => [cell.kpiId, cell.readiness]));

  return ELABORATOR_KPIS.map((kpi) => {
    const datasets = DATASET_REGISTRY.filter((d) => d.city === city && d.linkedKpis.includes(kpi.id));
    const fallback = KPI_METHOD_FALLBACKS[kpi.id] ?? {
      meaning: `${kpi.shortName} methodology is pending partner confirmation.`,
      calculationMethod: "Method details follow city dataset linkage when available.",
      limitations: "No city-specific methodology fallback is registered for this KPI yet.",
    };

    return {
      city,
      kpiId: kpi.id,
      kpiRef: kpi.ref,
      kpiName: kpi.shortName,
      meaning: fallback.meaning,
      calculationMethod:
        datasets.length > 0
          ? `Primary datasets: ${datasets.map((d) => d.title).join(", ")}. ${fallback.calculationMethod}`
          : fallback.calculationMethod,
      limitations:
        datasets.length > 0
          ? `${fallback.limitations} Source readiness: ${datasets.map((d) => `${d.parserStatus}/${d.realDataStatus}`).join(", ")}.`
          : `${fallback.limitations} Dataset link currently missing.`,
      sources: datasets.map((d) => d.title),
      readiness: (readiness.get(kpi.id) ?? "missing") as "ready" | "partial" | "missing",
    };
  });
}
