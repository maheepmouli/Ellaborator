import type { DatasetMetadata } from "@/data/datasetMetadata";
import { DATASET_REGISTRY } from "@/data/datasetMetadata";
import { WP7_EVIDENCE_OVERRIDES } from "./wp7EvidenceOverrides";
import type {
  Wp7CollectionMethodCategory,
  Wp7DatasetRecord,
  Wp7DatasetStatus,
  Wp7EvidenceOverride,
  Wp7GdprStatus,
  Wp7KpiEvidenceProfiles,
  Wp7LocationMeta,
  Wp7TemporalLabel,
  Wp7UniversalMetadata,
} from "./wp7Types";

function mapBeforeAfterToTemporal(
  status: DatasetMetadata["beforeAfterStatus"]
): Wp7TemporalLabel {
  switch (status) {
    case "before-only":
      return "before";
    case "after-only":
      return "after";
    case "both":
    case "ongoing":
      return "during";
    default:
      return "unclear";
  }
}

function inferCollectionMethod(d: DatasetMetadata): Wp7CollectionMethodCategory {
  const blob = `${d.id} ${d.title} ${d.source}`.toLowerCase();
  if (blob.includes("telraam")) return "telraam";
  if (blob.includes("survey") || blob.includes("questionnaire") || blob.includes("ux"))
    return "public-survey";
  if (blob.includes("workshop")) return "workshop";
  if (blob.includes("camera") || blob.includes("cv")) return "camera-cv";
  if (blob.includes("api") || d.fileFormat === "api") return "open-data-api";
  if (blob.includes("count") || blob.includes("counter")) return "traffic-counter";
  if (blob.includes("observation") || blob.includes("field")) return "field-observation";
  if (blob.includes("plan") || blob.includes("document")) return "plan-document";
  if (d.dataType === "modelled") return "modelled";
  if (blob.includes("sensor") || blob.includes("iot") || blob.includes("alarm"))
    return "sensor-iot";
  return "other";
}

function inferLocation(d: DatasetMetadata): Wp7LocationMeta {
  if (d.geometryType === "point") {
    return { description: d.title, geometryKind: "gps" };
  }
  if (d.geometryType === "segment") {
    return { description: d.title, geometryKind: "segment" };
  }
  if (d.geometryType === "polygon" || d.geometryType === "hex") {
    return { description: d.title, geometryKind: "polygon" };
  }
  return { description: d.notes || d.title, geometryKind: "none" };
}

function inferGdpr(d: DatasetMetadata): Wp7GdprStatus {
  if (d.dataType === "mock") return "restricted";
  const blob = `${d.title} ${d.notes || ""}`.toLowerCase();
  if (blob.includes("survey") || blob.includes("respondent") || blob.includes("interview")) {
    return "anonymised";
  }
  if (d.geometryType === "none" || d.dataType === "derived") return "aggregated-only";
  return "no-personal-data";
}

function emptyToMissing(value: string | undefined | null): string {
  return (value || "").trim();
}

export function listMissingUniversalFields(u: Wp7UniversalMetadata): string[] {
  const required: Array<keyof Wp7UniversalMetadata> = [
    "interventionCodes",
    "dataSource",
    "collectionMethodCategory",
    "location",
    "collectionDates",
    "temporalLabel",
    "responsibleOrg",
    "methodDescription",
    "gdprStatus",
    "accessRights",
    "datasetStatus",
    "versionDate",
  ];
  const missing: string[] = [];
  for (const key of required) {
    const v = u[key];
    if (key === "interventionCodes") {
      if (!Array.isArray(v) || v.length === 0) missing.push(key);
      continue;
    }
    if (key === "location") {
      const loc = v as Wp7LocationMeta;
      if (!loc?.description?.trim()) missing.push("location.description");
      continue;
    }
    if (typeof v === "string" && !v.trim()) missing.push(key);
  }
  return missing;
}

export function adaptDatasetToWp7(
  base: DatasetMetadata,
  override?: Wp7EvidenceOverride
): Wp7DatasetRecord {
  const o = override ?? WP7_EVIDENCE_OVERRIDES[base.id] ?? {};

  const universal: Wp7UniversalMetadata = {
    interventionCodes: o.interventionCodes ?? [],
    dataSource: emptyToMissing(o.dataSource) || base.source,
    collectionMethodCategory: o.collectionMethodCategory ?? inferCollectionMethod(base),
    location: o.location ?? inferLocation(base),
    collectionDates: emptyToMissing(o.collectionDates) || base.temporalCoverage,
    temporalLabel: o.temporalLabel ?? mapBeforeAfterToTemporal(base.beforeAfterStatus),
    responsibleOrg:
      emptyToMissing(o.responsibleOrg) || base.responsiblePartner || "",
    responsibleContact: emptyToMissing(o.responsibleContact),
    methodDescription:
      emptyToMissing(o.methodDescription) || emptyToMissing(base.notes),
    contextualFactors: o.contextualFactors ?? [],
    aggregationNotes: emptyToMissing(o.aggregationNotes),
    datasetStatus: (o.datasetStatus ?? "draft") as Wp7DatasetStatus,
    versionDate: emptyToMissing(o.versionDate),
    gdprStatus: o.gdprStatus ?? inferGdpr(base),
    accessRights: emptyToMissing(o.accessRights),
  };

  const linkedKpis = o.linkedKpisOverride ?? [...base.linkedKpis];
  const kpiEvidence: Wp7KpiEvidenceProfiles = { ...(o.kpiEvidence ?? {}) };
  const wrongProxyForKpis = o.wrongProxyForKpis ?? [];

  return {
    id: base.id,
    city: base.city,
    pilotIds: [...base.pilotIds],
    title: base.title,
    linkedKpis,
    base,
    universal,
    kpiEvidence,
    wrongProxyForKpis,
    missingUniversalFields: listMissingUniversalFields(universal),
  };
}

export function getAllWp7Datasets(): Wp7DatasetRecord[] {
  return DATASET_REGISTRY.map((d) => adaptDatasetToWp7(d));
}

export function getWp7DatasetsByCity(city: string): Wp7DatasetRecord[] {
  return getAllWp7Datasets().filter((d) => d.city === city);
}

export function getWp7DatasetById(id: string): Wp7DatasetRecord | undefined {
  const base = DATASET_REGISTRY.find((d) => d.id === id);
  return base ? adaptDatasetToWp7(base) : undefined;
}
