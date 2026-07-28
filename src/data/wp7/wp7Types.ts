/**
 * WP7 City Data Specification (FINAL January 2026) — typed submission metadata.
 * Cities supply underlying data + metadata; WP7 calculates KPIs.
 */

import type { DatasetMetadata } from "@/data/datasetMetadata";

export type Wp7TemporalLabel = "before" | "after" | "during" | "unclear";
export type Wp7DatasetStatus = "draft" | "final" | "replaces-prior";
export type Wp7GdprStatus =
  | "anonymised"
  | "aggregated-only"
  | "no-personal-data"
  | "restricted";
export type Wp7ComplianceStatus = "ready" | "partial" | "missing";

export type Wp7CollectionMethodCategory =
  | "traffic-counter"
  | "camera-cv"
  | "telraam"
  | "manual-count"
  | "gps-probe"
  | "public-survey"
  | "workshop"
  | "interview"
  | "field-observation"
  | "sensor-iot"
  | "open-data-api"
  | "plan-document"
  | "modelled"
  | "other";

export type Wp7AggregationMethod =
  | "AADT"
  | "peak-hour"
  | "daily-mean"
  | "hourly"
  | "survey-window"
  | "single-day"
  | "period-total"
  | "other"
  | "not-applicable";

export type Wp7SafetyEvidenceType =
  | "speed-flow"
  | "conflicts"
  | "imagery"
  | "star-rating"
  | "cyclerap-inputs"
  | "citizen-hazard"
  | "alarm-proxy"
  | "other"
  | "not-crash-based";

export interface Wp7LocationMeta {
  description: string;
  geometryKind: "gps" | "segment" | "polygon" | "written" | "none";
}

export interface Wp7Kpi11Evidence {
  planDocumentType?: string;
  planStatus?: "draft" | "adopted" | "proposed" | "none" | "proxy-only";
  expansionLocation?: string;
  scale?: "street" | "district" | "city" | "network";
  /** True only when a real expansion-plan artifact exists (not monitoring coverage). */
  isFormalPlanArtifact: boolean;
}

export interface Wp7Kpi12Evidence {
  modesCovered: string[];
  aggregation: Wp7AggregationMethod;
  hasBeforeAfterPair: boolean;
}

export interface Wp7Kpi21Evidence {
  evidenceTypes: Wp7SafetyEvidenceType[];
  /** Explicitly not crash/casualty statistics. */
  excludesCrashStats: boolean;
}

export interface Wp7Kpi31Evidence {
  facilityTypes: string[];
  unitCount?: number;
  status: "installed" | "planned" | "mixed" | "unknown";
}

export interface Wp7Kpi32Evidence {
  partA_attitudeOrBehaviour: boolean;
  partB_heatExposure: boolean;
  partC_circularMaterials: boolean;
  notes?: string;
}

export interface Wp7Kpi41Evidence {
  satisfactionDimensions: string[];
  sampleSize?: number;
  engagementMethod?: string;
  meets75PercentTarget?: boolean | null;
  targetPercent: number;
}

export interface Wp7Kpi42Evidence {
  accessibilityFeatureInventory: boolean;
  obstructionFlags?: boolean;
  timeSpentOptional?: boolean;
  diversityRatingOptional?: boolean;
  notes?: string;
}

export interface Wp7KpiEvidenceProfiles {
  "kpi1.1"?: Wp7Kpi11Evidence;
  "kpi1.2"?: Wp7Kpi12Evidence;
  "kpi2.1"?: Wp7Kpi21Evidence;
  "kpi3.1"?: Wp7Kpi31Evidence;
  "kpi3.2"?: Wp7Kpi32Evidence;
  "kpi4.1"?: Wp7Kpi41Evidence;
  "kpi4.2"?: Wp7Kpi42Evidence;
}

/** Enrichment overlay keyed by DatasetMetadata.id — does not replace the registry. */
export interface Wp7EvidenceOverride {
  interventionCodes?: string[];
  dataSource?: string;
  collectionMethodCategory?: Wp7CollectionMethodCategory;
  location?: Wp7LocationMeta;
  collectionDates?: string;
  temporalLabel?: Wp7TemporalLabel;
  responsibleOrg?: string;
  responsibleContact?: string;
  methodDescription?: string;
  contextualFactors?: string[];
  aggregationNotes?: string;
  datasetStatus?: Wp7DatasetStatus;
  versionDate?: string;
  gdprStatus?: Wp7GdprStatus;
  accessRights?: string;
  /** When set, overrides linkedKpis for WP7 scoring (honest KPI typing). */
  linkedKpisOverride?: string[];
  kpiEvidence?: Wp7KpiEvidenceProfiles;
  /** Flag wrong-proxy links (e.g. monitoring counted as expansion plan). */
  wrongProxyForKpis?: string[];
}

export interface Wp7UniversalMetadata {
  interventionCodes: string[];
  dataSource: string;
  collectionMethodCategory: Wp7CollectionMethodCategory;
  location: Wp7LocationMeta;
  collectionDates: string;
  temporalLabel: Wp7TemporalLabel;
  responsibleOrg: string;
  responsibleContact: string;
  methodDescription: string;
  contextualFactors: string[];
  aggregationNotes: string;
  datasetStatus: Wp7DatasetStatus;
  versionDate: string;
  gdprStatus: Wp7GdprStatus;
  accessRights: string;
}

export interface Wp7DatasetRecord {
  id: string;
  city: string;
  pilotIds: string[];
  title: string;
  linkedKpis: string[];
  base: DatasetMetadata;
  universal: Wp7UniversalMetadata;
  kpiEvidence: Wp7KpiEvidenceProfiles;
  wrongProxyForKpis: string[];
  /** Fields still empty after adapter + override — used by checklist UI. */
  missingUniversalFields: string[];
}

export interface Wp7FieldCheck {
  field: string;
  required: boolean;
  present: boolean;
  detail?: string;
}

export interface Wp7DatasetKpiAssessment {
  datasetId: string;
  kpiId: string;
  status: Wp7ComplianceStatus;
  checks: Wp7FieldCheck[];
  notes: string[];
}

export interface Wp7CityPilotKpiCell {
  city: string;
  pilotId: string | null;
  kpiId: string;
  status: Wp7ComplianceStatus;
  datasetIds: string[];
  notes: string[];
  assessments: Wp7DatasetKpiAssessment[];
}
