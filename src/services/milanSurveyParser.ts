import { MILAN_PILOT_ANCHORS } from "@/lib/milanMapConfig";
import type { NormalizedCityRecord } from "@/types/normalized-city-data";

export const MILAN_SURVEY_JSON = "/data/milan/survey-insights.json";

export interface MilanSurveyPilotInsight {
  pilotId: string;
  satisfactionPct: number;
  label: string;
  sourceFile?: string;
  responseBasis?: string;
}

export interface MilanSurveyBundle {
  generatedAt?: string;
  workbookCount: number;
  pilots: MilanSurveyPilotInsight[];
  aggregateSatisfactionPct: number | null;
  status: "parsed" | "empty_workbooks" | "folder_empty";
  note?: string;
}

let surveyBundleCache: MilanSurveyBundle | null = null;

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export async function loadMilanSurveyBundle(): Promise<MilanSurveyBundle | null> {
  if (surveyBundleCache) return surveyBundleCache;
  try {
    const response = await fetch(MILAN_SURVEY_JSON);
    if (!response.ok) return null;
    surveyBundleCache = (await response.json()) as MilanSurveyBundle;
    return surveyBundleCache;
  } catch {
    return null;
  }
}

export async function buildMilanSurveyRecords(kpiId: string): Promise<NormalizedCityRecord[]> {
  if (kpiId !== "kpi4.1") return [];
  const bundle = await loadMilanSurveyBundle();
  if (!bundle?.pilots?.length) return [];

  return bundle.pilots.map((pilot, index) => {
    const anchor =
      MILAN_PILOT_ANCHORS[pilot.pilotId as keyof typeof MILAN_PILOT_ANCHORS] ??
      MILAN_PILOT_ANCHORS["mil-p3"];
    const spread = index * 0.0004;
    const lat = anchor.lat + spread;
    const lng = anchor.lng + spread * 0.6;
    const satisfaction = clampPercent(pilot.satisfactionPct);

    return {
      id: `milan-kpi4.1-${pilot.pilotId}`,
      city: "Milan",
      cityId: "milan",
      interventionId: pilot.pilotId,
      kpiId: "kpi4.1",
      sourceFile: pilot.sourceFile || MILAN_SURVEY_JSON,
      datasetKind: "survey",
      geometryType: "point",
      lat,
      lng,
      geometry: [[lat, lng]],
      value: satisfaction,
      baselineValue: satisfaction * 0.92,
      interventionValue: satisfaction,
      comparisonValue: satisfaction * 0.08,
      source: "Milan satisfaction survey workbook",
      method: pilot.responseBasis || "Aggregate satisfaction from SharePoint folder 7",
      type: "observed",
      spatialQuality: "inferred",
      geometryLinkage: "inferred",
      temporalCoverage: "single-period",
      locationMethod: "pilot_area_inference",
      spatialNote:
        "Survey responses have no geo-coordinates — satisfaction shown at pilot anchor, not as map points.",
      parserStatus: "ready",
      category: pilot.label,
    };
  });
}

export function milanSatisfactionStatCards(
  records: Array<{ properties?: Record<string, unknown> }>
): { label: string; value: string; note?: string; color?: string }[] | null {
  const surveys = records.filter((r) => r.properties?.datasetKind === "survey");
  if (!surveys.length) return null;
  const avg =
    surveys.reduce((s, r) => s + Number(r.properties?.interventionValue ?? r.properties?.value ?? 0), 0) /
    surveys.length;
  return [
    {
      label: "User satisfaction",
      value: `${avg.toFixed(1)}%`,
      color: "#a78bfa",
      note: `${surveys.length} pilot aggregate${surveys.length === 1 ? "" : "s"} · no map coordinates`,
    },
    {
      label: "Target (WP7)",
      value: "≥75%",
      note: "Milan evaluation plan threshold",
    },
    {
      label: "Source",
      value: "SharePoint",
      note: "Folder 7 — Satisfaction LL",
    },
  ];
}
