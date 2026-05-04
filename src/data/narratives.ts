/**
 * Phase 1 narrative spec — stakeholder copy guardrails aligned with KPI_FRAMEWORK IDs
 * and parser behaviour (mixed observed / synthetic / coverage fallback layers).
 */

import type { KPIFrameworkId } from "@/config/kpiFramework";
import { getKpiFrameworkConfig } from "@/config/kpiFramework";
import { getKpiDefinition } from "@/config/kpiDefinitions";
import type { KPIValue } from "@/data/kpiDefinitions";

export type StakeholderAudienceMode = "policy" | "technical" | "public";

/** Labels for KPI numeric claims in stakeholder UI */
export const METRIC_ASSERTION_RULES = {
  observed: "Value from city/parser sources for this layer.",
  derived: "Value derived by ELABORATOR from upstream counts or geometry.",
  modelled: "Modelled or interpolated estimate — not a raw sensor read.",
  mock: "Illustrative / demo aggregate in CITY_DATA — do not cite as audited fact.",
  coverageFallback:
    "Map may supplement sparse areas — see Data Summary and badges for coverage.",
} as const;

/** Personas: short vignettes — used for contextual colour, not as numeric evidence */
export const PERSONA_SNIPPETS = {
  policy:
    "A policy lead needs defensible wording: lead with headline change, cite type (observed/modelled/mock), link to methodology.",
  technical:
    "An analyst verifies joins, geometry, and period alignment before comparing cities.",
  public:
    "A resident-facing view keeps jargon low and highlights what changed on streets they recognise.",
} as const;

/** Impact-at-a-glance: which fields MUST be truthful vs explicitly labelled illustrative */
export const IMPACT_FIELDS_SPEC = {
  headlineSource: ["selectedCity", "selectedPilot.name", "kpi.displayName"],
  metricSource: ["CITY_DATA.kpiData[selectedKpi] when present", "map layer / parsers when segment selected"],
  provenanceBullets: [
    "spatialLabel (exact | matched | inferred)",
    "dataTypeLabel (observed | derived | modelled | mock)",
    "temporalLabel (snapshot | before-after | single-period)",
  ],
  disclaimerHooks: [
    "If kpiFramework.isMock → prefix narrative bullets with Illustrative.",
    "If Helsinki Telraam before/after KPIs → label observed vs derived explicitly.",
    "If segment mapContext present → cite segment-level read; else CITY-level aggregate caveat.",
  ],
} as const;

const PLAIN_LANGUAGE: Partial<Record<KPIFrameworkId, string>> = {
  "kpi1.2":
    "This shows walking, cycling, public transport and car shares — higher sustainable share usually means quieter, safer corridors.",
  "kpi2.1":
    "Street safety compares relative risk or congestion-style pressure on segments — darker lines often mean tougher conditions.",
  "kpi3.1":
    "New cycling or green infrastructure kilometres and types — more facilities can shorten detours.",
  "kpi3.2":
    "Environmental pressure snapshot from travel or fleet proxies — directional, not lab-grade air readings.",
  "kpi4.1":
    "Survey‑style satisfaction from samples — watch sample size.",
  "kpi4.2":
    "Accessibility-ready features counted where data exists.",
};

export function getPlainLanguageSummary(kpiId: string): string {
  const id = kpiId as KPIFrameworkId;
  if (PLAIN_LANGUAGE[id]) return PLAIN_LANGUAGE[id]!;
  const fw = getKpiFrameworkConfig(id);
  return fw?.description || getKpiDefinition(kpiId)?.summary || fw?.question || "";
}

export type ImpactDisclaimerKind = "illustrative" | "derived" | "observed_segment" | "standard";

export function resolveImpactDisclaimer(args: {
  kpiId: string;
  isMockFramework: boolean;
  isHelsinkiObservedBeforeAfter: boolean;
  hasSegmentContext: boolean;
}): { kind: ImpactDisclaimerKind; line: string } {
  if (args.isMockFramework) {
    return {
      kind: "illustrative",
      line: "Illustrative headline from demo aggregates — verify with Data Summary and maps before quoting externally.",
    };
  }
  if (args.isHelsinkiObservedBeforeAfter) {
    return {
      kind: "observed_segment",
      line: "Helsinki/Telraam before–after linkage — directional comparison within the sampled period.",
    };
  }
  if (args.hasSegmentContext) {
    return {
      kind: "observed_segment",
      line: "You are viewing one network segment — values may differ from city-wide KPI cards.",
    };
  }
  return {
    kind: "standard",
    line: "Numbers follow the KPI definition and parsers shown in badges — see Data Summary for full provenance.",
  };
}

export function buildImpactAtGlance(args: {
  selectedCity: string;
  pilotName: string;
  kpiDisplayName: string;
  scenario: "baseline" | "intervention" | "comparison";
  kpiValue: KPIValue;
  kpiRef: string;
  changeVerb: string;
  disclaimerLine: string;
}): { lead: string; bullets: string[] } {
  const scen =
    args.scenario === "baseline"
      ? "baseline period"
      : args.scenario === "intervention"
        ? "intervention view"
        : "before vs after snapshot";
  const main = `${args.kpiValue.mainValue}${args.kpiValue.unit ? args.kpiValue.unit : ""}`;
  const bullet1 = `${args.kpiRef} (${args.kpiDisplayName}): headline value ${main} in ${scen}.`;
  const changeStr =
    args.kpiValue.change === 0
      ? "no net change coded in CARD"
      : `${args.changeVerb} ${args.kpiValue.change > 0 ? "+" : ""}${args.kpiValue.change}`;
  const bullet2 =
    args.scenario === "comparison" || args.scenario === "intervention"
      ? `Directional shift in card metrics: ${changeStr}${args.kpiValue.unit === "%" ? " pp" : ""}.`
      : `Baseline-relative shift (card): ${changeStr}${args.kpiValue.unit === "%" ? " pp" : ""}.`;
  const bullet3 = args.disclaimerLine;
  return {
    lead: `${args.selectedCity} — ${args.pilotName}: quick readout for stakeholder conversations. Figures come from ELABORATOR layers for the selected KPI; treat mock/demo values as illustrative only.`,
    bullets: [bullet1, bullet2, bullet3],
  };
}

export function stakeholderReportDisclaimer(): string {
  return `${METRIC_ASSERTION_RULES.mock} ${METRIC_ASSERTION_RULES.coverageFallback}`;
}
