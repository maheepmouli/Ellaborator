/**
 * Deterministic WP7 compliance scorer: Ready / Partial / Missing.
 */

import type { Wp7DatasetRecord, Wp7DatasetKpiAssessment, Wp7ComplianceStatus } from "@/data/wp7/wp7Types";
import { WP7_NO_FORMAL_PLAN_DATASETS } from "@/data/wp7/wp7EvidenceOverrides";
import {
  evaluateDatasetKpiEvidence,
  requiredChecksPass,
  anyRequiredPresent,
} from "./kpiEvidenceRules";

function isMockOrUnavailable(record: Wp7DatasetRecord): boolean {
  return record.base.dataType === "mock" || record.base.realDataStatus === "mock";
}

function universalCoreComplete(record: Wp7DatasetRecord): boolean {
  // Contact is preferred but not required for Ready (may be internal).
  const critical = record.missingUniversalFields.filter(
    (f) => f !== "responsibleContact" && f !== "aggregationNotes" && f !== "contextualFactors"
  );
  // Soften: allow missing accessRights/versionDate to keep Partial rather than block every city.
  const blocking = critical.filter(
    (f) =>
      f === "dataSource" ||
      f === "responsibleOrg" ||
      f === "methodDescription" ||
      f === "collectionDates" ||
      f === "gdprStatus"
  );
  return blocking.length === 0 && !!record.universal.responsibleOrg;
}

export function assessDatasetForKpi(
  record: Wp7DatasetRecord,
  kpiId: string
): Wp7DatasetKpiAssessment {
  const notes: string[] = [];
  const linked = record.linkedKpis.includes(kpiId);
  const wrongProxy = record.wrongProxyForKpis.includes(kpiId);
  const checks = evaluateDatasetKpiEvidence(record, kpiId);

  if (isMockOrUnavailable(record)) {
    return {
      datasetId: record.id,
      kpiId,
      status: "missing",
      checks,
      notes: ["Mock / unavailable dataset cannot score Ready or Partial for WP7 submission."],
    };
  }

  if (wrongProxy || (WP7_NO_FORMAL_PLAN_DATASETS.has(record.id) && kpiId === "kpi1.1")) {
    notes.push("Wrong proxy for this KPI (e.g. monitoring ≠ formal expansion plan).");
    return {
      datasetId: record.id,
      kpiId,
      status: linked || wrongProxy ? "partial" : "missing",
      checks,
      notes,
    };
  }

  if (!linked && checks.every((c) => !c.present)) {
    return {
      datasetId: record.id,
      kpiId,
      status: "missing",
      checks,
      notes: ["Dataset not linked to this KPI for WP7 evidence."],
    };
  }

  // KPI 3.2 special: attitude-only without B/C and without proper Part A climate → Partial max
  if (kpiId === "kpi3.2") {
    const e = record.kpiEvidence["kpi3.2"];
    if (!e) {
      return {
        datasetId: record.id,
        kpiId,
        status: linked ? "partial" : "missing",
        checks,
        notes: ["No KPI 3.2 evidence profile declared."],
      };
    }
    if (e.partB_heatExposure || e.partC_circularMaterials) {
      // Would need metadata complete for Ready — currently no city has B/C
      const ready =
        requiredChecksPass(checks) &&
        universalCoreComplete(record) &&
        record.base.realDataStatus === "active";
      return {
        datasetId: record.id,
        kpiId,
        status: ready ? "ready" : "partial",
        checks,
        notes: e.notes ? [e.notes] : notes,
      };
    }
    if (e.partA_attitudeOrBehaviour) {
      notes.push(
        "Attitude/behaviour aggregates only — not sufficient for Ready on 3.2 (heat/circular Missing; Part A climate inventory not confirmed)."
      );
      return { datasetId: record.id, kpiId, status: "partial", checks, notes };
    }
    return {
      datasetId: record.id,
      kpiId,
      status: linked ? "partial" : "missing",
      checks,
      notes,
    };
  }

  // KPI 1.1: Ready only with formal plan artifact
  if (kpiId === "kpi1.1") {
    const e = record.kpiEvidence["kpi1.1"];
    if (!e?.isFormalPlanArtifact) {
      notes.push("No formal expansion-plan artifact.");
      return {
        datasetId: record.id,
        kpiId,
        status: linked || !!e ? "partial" : "missing",
        checks,
        notes,
      };
    }
  }

  if (!linked) {
    // Has evidence profile but not linked — treat as partial candidate
    if (anyRequiredPresent(checks)) {
      return {
        datasetId: record.id,
        kpiId,
        status: "partial",
        checks,
        notes: ["Evidence profile present but KPI not in linkedKpis."],
      };
    }
    return {
      datasetId: record.id,
      kpiId,
      status: "missing",
      checks,
      notes: ["Not linked and no evidence."],
    };
  }

  const evidenceReady = requiredChecksPass(checks);
  const metaReady = universalCoreComplete(record);
  const parserOk =
    record.base.parserStatus === "ready" && record.base.realDataStatus === "active";

  if (evidenceReady && metaReady && parserOk) {
    return { datasetId: record.id, kpiId, status: "ready", checks, notes };
  }

  if (evidenceReady || anyRequiredPresent(checks) || linked) {
    if (!evidenceReady) notes.push("KPI evidence profile incomplete.");
    if (!metaReady) notes.push("Universal metadata incomplete.");
    if (!parserOk) notes.push(`Parser/real-data status: ${record.base.parserStatus}/${record.base.realDataStatus}.`);
    return { datasetId: record.id, kpiId, status: "partial", checks, notes };
  }

  return { datasetId: record.id, kpiId, status: "missing", checks, notes };
}

export function rollupStatus(statuses: Wp7ComplianceStatus[]): Wp7ComplianceStatus {
  if (statuses.some((s) => s === "ready")) return "ready";
  if (statuses.some((s) => s === "partial")) return "partial";
  return "missing";
}

export function scoreCityKpi(
  datasets: Wp7DatasetRecord[],
  city: string,
  kpiId: string,
  pilotId?: string | null
): {
  status: Wp7ComplianceStatus;
  datasetIds: string[];
  assessments: Wp7DatasetKpiAssessment[];
  notes: string[];
} {
  const scoped = datasets.filter((d) => {
    if (d.city !== city) return false;
    if (pilotId && !d.pilotIds.includes(pilotId)) return false;
    return true;
  });

  const relevant = scoped.filter(
    (d) =>
      d.linkedKpis.includes(kpiId) ||
      d.wrongProxyForKpis.includes(kpiId) ||
      !!d.kpiEvidence[kpiId as keyof typeof d.kpiEvidence]
  );

  if (relevant.length === 0) {
    // Also consider city-level datasets that list the KPI in base registry via adapter linked list
    const anyLinked = scoped.filter((d) => d.base.linkedKpis.includes(kpiId));
    if (anyLinked.length === 0) {
      return {
        status: "missing",
        datasetIds: [],
        assessments: [],
        notes: ["No dataset linked to this city×KPI."],
      };
    }
  }

  const pool = relevant.length > 0 ? relevant : scoped.filter((d) => d.base.linkedKpis.includes(kpiId));
  const assessments = pool.map((d) => assessDatasetForKpi(d, kpiId));
  const status = rollupStatus(assessments.map((a) => a.status));
  const notes = assessments.flatMap((a) => a.notes).slice(0, 8);

  return {
    status,
    datasetIds: pool.map((d) => d.id),
    assessments,
    notes,
  };
}
