/**
 * Required / preferred WP7 evidence fields per KPI (cheat-sheet FINAL Jan 2026).
 */

import type { Wp7DatasetRecord, Wp7FieldCheck } from "@/data/wp7/wp7Types";

export const WP7_KPI_IDS = [
  "kpi1.1",
  "kpi1.2",
  "kpi2.1",
  "kpi3.1",
  "kpi3.2",
  "kpi4.1",
  "kpi4.2",
] as const;

export type Wp7KpiId = (typeof WP7_KPI_IDS)[number];

export interface Wp7KpiRuleSummary {
  kpiId: Wp7KpiId;
  title: string;
  requiredEvidence: string[];
  preferredMetadata: string[];
  notes: string;
}

export const KPI_EVIDENCE_RULE_SUMMARIES: Wp7KpiRuleSummary[] = [
  {
    kpiId: "kpi1.1",
    title: "Intervention expansion plan",
    requiredEvidence: [
      "Formal expansion-plan artifact (not monitoring coverage alone)",
      "Plan status / type",
      "Location or scale of expansion",
    ],
    preferredMetadata: ["interventionCodes", "responsibleOrg", "gdprStatus", "versionDate"],
    notes: "Monitoring sensors or footprints are Partial proxies at best — never Ready without a plan document.",
  },
  {
    kpiId: "kpi1.2",
    title: "Mobility mode share",
    requiredEvidence: ["Modes covered", "Aggregation method", "Temporal coverage"],
    preferredMetadata: ["before/after pair", "interventionCodes", "aggregationNotes"],
    notes: "Cities supply counts/shares; WP7 computes mode-share KPIs.",
  },
  {
    kpiId: "kpi2.1",
    title: "Road-user safety (non-crash)",
    requiredEvidence: [
      "Speed/flow, conflicts, imagery, Star/CycleRAP inputs, or citizen hazard evidence",
      "Explicit exclusion of crash-based statistics",
    ],
    preferredMetadata: ["evidenceTypes", "methodDescription", "gdprStatus"],
    notes: "Crash/casualty series are out of scope for this KPI evidence path.",
  },
  {
    kpiId: "kpi3.1",
    title: "Zero-emission facilities",
    requiredEvidence: ["Facility types", "Installed or planned status", "Unit counts when available"],
    preferredMetadata: ["interventionCodes", "location"],
    notes: "Inventory of EV/bike/micromobility facilities and services.",
  },
  {
    kpiId: "kpi3.2",
    title: "Climate & environmental (A/B/C)",
    requiredEvidence: [
      "Part A: emissions / attitude-behaviour climate evidence as specified by WP7",
      "Part B: heat exposure (when claimed)",
      "Part C: circular materials (when claimed)",
    ],
    preferredMetadata: ["part flags", "methodDescription"],
    notes: "Attitude surveys alone do not satisfy heat (B) or circular (C).",
  },
  {
    kpiId: "kpi4.1",
    title: "User satisfaction",
    requiredEvidence: [
      "Satisfaction dimensions",
      "Sample size n",
      "Engagement method",
      "≥75% target status",
    ],
    preferredMetadata: ["temporalLabel after/during", "gdprStatus anonymised"],
    notes: "Mock panel headlines must not score Ready.",
  },
  {
    kpiId: "kpi4.2",
    title: "Accessibility",
    requiredEvidence: ["Accessibility feature inventory and/or obstruction / challenge flags"],
    preferredMetadata: ["optional time-spent", "diversity rating"],
    notes: "Partial when only challenge rates exist without a feature inventory.",
  },
];

function check(
  field: string,
  present: boolean,
  required: boolean,
  detail?: string
): Wp7FieldCheck {
  return { field, present, required, detail };
}

/** Evaluate one dataset against one KPI’s evidence profile. */
export function evaluateDatasetKpiEvidence(
  record: Wp7DatasetRecord,
  kpiId: string
): Wp7FieldCheck[] {
  const ev = record.kpiEvidence;
  switch (kpiId) {
    case "kpi1.1": {
      const e = ev["kpi1.1"];
      return [
        check("formalPlanArtifact", !!e?.isFormalPlanArtifact, true),
        check("planStatus", !!e?.planStatus && e.planStatus !== "proxy-only", true),
        check("planDocumentType", !!e?.planDocumentType?.trim(), true),
        check("expansionLocationOrScale", !!(e?.expansionLocation || e?.scale), true),
      ];
    }
    case "kpi1.2": {
      const e = ev["kpi1.2"];
      return [
        check("modesCovered", (e?.modesCovered?.length ?? 0) > 0, true),
        check("aggregation", !!e?.aggregation && e.aggregation !== "not-applicable", true),
        check("hasBeforeAfterPair", e?.hasBeforeAfterPair === true, false, "preferred"),
      ];
    }
    case "kpi2.1": {
      const e = ev["kpi2.1"];
      return [
        check("evidenceTypes", (e?.evidenceTypes?.length ?? 0) > 0, true),
        check("excludesCrashStats", e?.excludesCrashStats === true, true),
      ];
    }
    case "kpi3.1": {
      const e = ev["kpi3.1"];
      return [
        check("facilityTypes", (e?.facilityTypes?.length ?? 0) > 0, true),
        check("status", !!e?.status && e.status !== "unknown", true),
        check("unitCount", typeof e?.unitCount === "number", false, "preferred"),
      ];
    }
    case "kpi3.2": {
      const e = ev["kpi3.2"];
      return [
        check("partA", e?.partA_attitudeOrBehaviour === true, false),
        check("partB_heat", e?.partB_heatExposure === true, false),
        check("partC_circular", e?.partC_circularMaterials === true, false),
        check(
          "anyClimatePart",
          !!(e?.partA_attitudeOrBehaviour || e?.partB_heatExposure || e?.partC_circularMaterials),
          true,
          "At least one declared 3.2 part with real evidence profile"
        ),
      ];
    }
    case "kpi4.1": {
      const e = ev["kpi4.1"];
      return [
        check("satisfactionDimensions", (e?.satisfactionDimensions?.length ?? 0) > 0, true),
        check("sampleSize", typeof e?.sampleSize === "number" && e.sampleSize > 0, true),
        check("engagementMethod", !!e?.engagementMethod?.trim(), true),
        check(
          "meets75PercentTarget",
          e?.meets75PercentTarget === true || e?.meets75PercentTarget === false,
          true,
          "Record whether ≥75% target is met (false is still complete metadata)"
        ),
      ];
    }
    case "kpi4.2": {
      const e = ev["kpi4.2"];
      return [
        check(
          "featureInventoryOrFlags",
          !!(e?.accessibilityFeatureInventory || e?.obstructionFlags),
          true
        ),
        check("accessibilityFeatureInventory", e?.accessibilityFeatureInventory === true, false),
      ];
    }
    default:
      return [];
  }
}

export function requiredChecksPass(checks: Wp7FieldCheck[]): boolean {
  return checks.filter((c) => c.required).every((c) => c.present);
}

export function anyRequiredPresent(checks: Wp7FieldCheck[]): boolean {
  const req = checks.filter((c) => c.required);
  if (req.length === 0) return false;
  return req.some((c) => c.present);
}
