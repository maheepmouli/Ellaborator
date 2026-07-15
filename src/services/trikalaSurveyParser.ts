import * as XLSX from "xlsx";
import type { NormalizedCityRecord } from "@/types/normalized-city-data";
import { buildTrikalaEnvironmentalRecords } from "@/services/trikalaEnvironmentalParser";
import { buildTrikalaBikeLaneSensorRecords } from "@/services/trikalaBikeLaneSensorParser";

import { TRIKALA_MAP_ANCHOR, getTrikalaPilotAnchor, type TrikalaPilotId } from "@/lib/trikalaMapConfig";
import { computeWomenMobilityModeShareRows } from "@/lib/trikalaModeShare";
import { resolveTrikalaInsightSegmentFromSelection } from "@/lib/trikalaObservatoryView";
import type { ModeShareRow } from "@/lib/observatoryGraphicTypes";

/** @deprecated Use TRIKALA_MAP_ANCHOR or getTrikalaPilotAnchor */
export const TRIKALA_PILOT_ANCHOR = TRIKALA_MAP_ANCHOR;

export const TRIKALA_SURVEY_FILES = {
  smartCrossingBaseline:
    "/sharepoint-data/Trikala/baseline data of the smart crossing on line survey_english.xlsx",
  womenMobility:
    "/sharepoint-data/Trikala/ELABORATOR_ Women Mobility Questionnaire (Responses).xlsx",
  bikeLaneBaseline:
    "/sharepoint-data/Trikala/baseline data on bike safety from the on line syrvey_english.xlsx",
  smartCrossingPost:
    "/sharepoint-data/Trikala/post/Post Intervention _ELABORATOR_ Smart crossing_raw data eng.xlsx",
  bikeLanePost:
    "/sharepoint-data/Trikala/post/Post Intervention_ELABORATOR_Cycling Safety_Raw dataEnglish_headers.xlsx",
  smartaAppPost: "/sharepoint-data/Trikala/post/Survey of SMARTA app_row data.xlsx",
} as const;

export type TrikalaSegmentId =
  | "all"
  | "caregiver"
  | "nonCaregiver"
  | "urban"
  | "suburban"
  | "village";

export interface TrikalaSegmentInsight {
  segment: TrikalaSegmentId;
  label: string;
  responseCount: number;
  daySafetyAvg?: number;
  nightSafetyAvg?: number;
  harassmentPct?: number;
  routeAvoidancePct?: number;
  activeModeSharePct?: number;
  carModeSharePct?: number;
  bikeLaneSafetyAvg?: number;
  bikeLaneConditionAvg?: number;
  bikeNightSafetyAvg?: number;
  encroachmentFactors?: Array<{ factor: string; pct: number }>;
}

export interface TrikalaSurveyBundle {
  smartCrossingBaseline: Record<string, unknown>[];
  smartCrossingPost: Record<string, unknown>[];
  womenMobility: Record<string, unknown>[];
  bikeLaneBaseline: Record<string, unknown>[];
  bikeLanePost: Record<string, unknown>[];
  smartaAppPost: Record<string, unknown>[];
}

let surveyBundleCache: TrikalaSurveyBundle | null = null;
let segmentInsightCache: TrikalaSegmentInsight[] | null = null;
const recordCache = new Map<string, NormalizedCityRecord[]>();

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function parseNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const cleaned = value.replace(",", ".").replace(/[^\d.-]/g, "");
    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function likertToPercent(value: unknown, maxScale = 4): number {
  const num = parseNumber(value);
  if (num <= 0) return 0;
  return clampPercent((num / maxScale) * 100);
}

export function averageLikert(rows: Record<string, unknown>[], columnMatch: RegExp): number {
  const values: number[] = [];
  rows.forEach((row) => {
    const key = Object.keys(row).find((k) => columnMatch.test(k));
    if (!key) return;
    const num = parseNumber(row[key]);
    if (num > 0) values.push(num);
  });
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function resolveResponseSheet(workbook: XLSX.WorkBook): string {
  const preferred = workbook.SheetNames.find((n) =>
    /form responses|απαντήσεις φόρμας|sheet1/i.test(n)
  );
  return preferred ?? workbook.SheetNames[0];
}

async function fetchSurveyRows(path: string): Promise<Record<string, unknown>[]> {
  try {
    const response = await fetch(encodeURI(path));
    if (!response.ok) return [];
    const workbook = XLSX.read(await response.arrayBuffer(), { type: "array" });
    const sheetName = resolveResponseSheet(workbook);
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], {
      defval: null,
    });
  } catch {
    return [];
  }
}

export async function loadTrikalaSurveyBundle(): Promise<TrikalaSurveyBundle> {
  if (surveyBundleCache) return surveyBundleCache;
  const [
    smartCrossingBaseline,
    smartCrossingPost,
    womenMobility,
    bikeLaneBaseline,
    bikeLanePost,
    smartaAppPost,
  ] = await Promise.all([
    fetchSurveyRows(TRIKALA_SURVEY_FILES.smartCrossingBaseline),
    fetchSurveyRows(TRIKALA_SURVEY_FILES.smartCrossingPost),
    fetchSurveyRows(TRIKALA_SURVEY_FILES.womenMobility),
    fetchSurveyRows(TRIKALA_SURVEY_FILES.bikeLaneBaseline),
    fetchSurveyRows(TRIKALA_SURVEY_FILES.bikeLanePost),
    fetchSurveyRows(TRIKALA_SURVEY_FILES.smartaAppPost),
  ]);
  surveyBundleCache = {
    smartCrossingBaseline,
    smartCrossingPost,
    womenMobility,
    bikeLaneBaseline,
    bikeLanePost,
    smartaAppPost,
  };
  return surveyBundleCache;
}

function findColumnKey(row: Record<string, unknown>, match: RegExp): string | undefined {
  return Object.keys(row).find((k) => match.test(k));
}

function isAffirmative(value: unknown): boolean {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return false;
  return /^(ναι|yes|y|1|true)/i.test(text) || text.includes("ναι");
}

function isNegative(value: unknown): boolean {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return false;
  return /^(όχι|οχι|no|n|0|false)/i.test(text) || text.includes("όχι") || text.includes("οχι");
}

function classifyResidence(row: Record<string, unknown>): TrikalaSegmentId {
  const residenceKey = findColumnKey(row, /πού μένεις|where do you live/i);
  const villageKey = findColumnKey(row, /χωριό|village/i);
  const residence = String(residenceKey ? row[residenceKey] : "").toLowerCase();
  const villageName = String(villageKey ? row[villageKey] : "").trim();
  if (villageName || residence.includes("χωρι") || residence.includes("village")) return "village";
  if (residence.includes("προάστ") || residence.includes("suburb")) return "suburban";
  return "urban";
}

function isCaregiver(row: Record<string, unknown>): boolean {
  const key = findColumnKey(row, /χρειάζετα|care for|depend/i);
  if (!key) return false;
  const val = row[key];
  if (isNegative(val)) return false;
  return isAffirmative(val) || String(val ?? "").trim().length > 2;
}

function filterWomenSegment(
  rows: Record<string, unknown>[],
  segment: TrikalaSegmentId
): Record<string, unknown>[] {
  if (segment === "all") return rows;
  return rows.filter((row) => {
    if (segment === "caregiver") return isCaregiver(row);
    if (segment === "nonCaregiver") return !isCaregiver(row);
    return classifyResidence(row) === segment;
  });
}

function pctAffirmative(rows: Record<string, unknown>[], columnMatch: RegExp): number {
  if (rows.length === 0) return 0;
  let hits = 0;
  rows.forEach((row) => {
    const key = findColumnKey(row, columnMatch);
    if (!key) return;
    if (isAffirmative(row[key])) hits += 1;
  });
  return clampPercent((hits / rows.length) * 100);
}

function activeModeShare(rows: Record<string, unknown>[]): number {
  let activeTrips = 0;
  let totalTrips = 0;
  rows.forEach((row) => {
    const modes = ["Ποδήλατο", "Περπάτημα", "Αυτοκίνητο", "Μηχανάκι", "Λεωφορείο", "Άλλο"];
    modes.forEach((mode) => {
      const key = Object.keys(row).find((k) => k.includes(mode));
      if (!key) return;
      const freq = String(row[key] || "").toLowerCase();
      if (!freq || freq === "καθόλου" || freq === "not at all") return;
      totalTrips += 1;
      if (mode === "Ποδήλατο" || mode === "Περπάτημα") activeTrips += 1;
    });
  });
  return totalTrips > 0 ? clampPercent((activeTrips / totalTrips) * 100) : 0;
}

function carModeShare(rows: Record<string, unknown>[]): number {
  let carTrips = 0;
  let totalTrips = 0;
  rows.forEach((row) => {
    const modes = ["Ποδήλατο", "Περπάτημα", "Αυτοκίνητο", "Μηχανάκι", "Λεωφορείο", "Άλλο"];
    modes.forEach((mode) => {
      const key = Object.keys(row).find((k) => k.includes(mode));
      if (!key) return;
      const freq = String(row[key] || "").toLowerCase();
      if (!freq || freq === "καθόλου" || freq === "not at all") return;
      totalTrips += 1;
      if (mode === "Αυτοκίνητο") carTrips += 1;
    });
  });
  return totalTrips > 0 ? clampPercent((carTrips / totalTrips) * 100) : 0;
}

function encroachmentFactors(rows: Record<string, unknown>[]): Array<{ factor: string; pct: number }> {
  const counts = new Map<string, number>();
  let respondents = 0;
  rows.forEach((row) => {
    const key = findColumnKey(row, /unsafe on the bike lane|feel unsafe/i);
    if (!key || !row[key]) return;
    respondents += 1;
    String(row[key])
      .split(/[,;]/)
      .map((part) => part.trim())
      .filter(Boolean)
      .forEach((factor) => {
        counts.set(factor, (counts.get(factor) || 0) + 1);
      });
  });
  if (respondents === 0) return [];
  return [...counts.entries()]
    .map(([factor, count]) => ({ factor, pct: clampPercent((count / respondents) * 100) }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 6);
}

const SEGMENT_LABELS: Record<TrikalaSegmentId, string> = {
  all: "All women respondents",
  caregiver: "Caregivers",
  nonCaregiver: "Non-caregivers",
  urban: "Urban core",
  suburban: "Suburban",
  village: "Village residents",
};

export function computeTrikalaSegmentInsights(bundle: TrikalaSurveyBundle): TrikalaSegmentInsight[] {
  const segments: TrikalaSegmentId[] = [
    "all",
    "caregiver",
    "nonCaregiver",
    "urban",
    "suburban",
    "village",
  ];
  return segments.map((segment) => {
    const womenRows = filterWomenSegment(bundle.womenMobility, segment);
    const bikeRows =
      segment === "all" || segment === "urban" || segment === "suburban" || segment === "village"
        ? bundle.bikeLaneBaseline
        : bundle.bikeLaneBaseline;
    return {
      segment,
      label: SEGMENT_LABELS[segment],
      responseCount: womenRows.length,
      daySafetyAvg: averageLikert(womenRows, /ασφαλής.*μέρα/i),
      nightSafetyAvg: averageLikert(womenRows, /ασφαλής.*νύχτα/i),
      harassmentPct: pctAffirmative(womenRows, /παρενόχλησης|harassment/i),
      routeAvoidancePct: pctAffirmative(womenRows, /αποφεύγεις|avoid/i),
      activeModeSharePct: activeModeShare(womenRows),
      carModeSharePct: carModeShare(womenRows),
      bikeLaneSafetyAvg: averageLikert(bikeRows, /safe.*bike lane/i),
      bikeLaneConditionAvg: averageLikert(bikeRows, /condition of the bike lane/i),
      bikeNightSafetyAvg: averageLikert(bikeRows, /cycling at night/i),
      encroachmentFactors: encroachmentFactors(bikeRows),
    };
  });
}

export async function getTrikalaSegmentInsights(): Promise<TrikalaSegmentInsight[]> {
  if (segmentInsightCache) return segmentInsightCache;
  const bundle = await loadTrikalaSurveyBundle();
  segmentInsightCache = computeTrikalaSegmentInsights(bundle);
  return segmentInsightCache;
}

/** Per-mode shares from women mobility questionnaire rows (segment-scoped). */
export async function getTrikalaWomenMobilityModeShareRows(
  selectionId?: string | null
): Promise<ModeShareRow[]> {
  const segmentKey = resolveTrikalaInsightSegmentFromSelection(selectionId) ?? "all";
  const bundle = await loadTrikalaSurveyBundle();
  const rows = filterWomenSegment(bundle.womenMobility, segmentKey);
  return computeWomenMobilityModeShareRows(rows);
}

function pushSurveyRecord(
  records: NormalizedCityRecord[],
  kpiId: string,
  opts: {
    idSuffix: string;
    value: number;
    baselineValue: number;
    interventionValue: number;
    sourceFile: string;
    source: string;
    method: string;
    segmentId?: string;
    subSegment?: string;
    likertLabel?: string;
    interventionId?: TrikalaPilotId;
  }
) {
  if (opts.value <= 0 && opts.baselineValue <= 0 && opts.interventionValue <= 0) return;
  const interventionId = opts.interventionId ?? "tri-p1";
  const anchor = getTrikalaPilotAnchor(interventionId);
  const comparison = opts.interventionValue - opts.baselineValue;
  records.push({
    id: `trikala-${kpiId}-${opts.idSuffix}`,
    city: "Trikala",
    cityId: "trikala",
    interventionId,
    kpiId,
    sourceFile: opts.sourceFile,
    geometryType: "point",
    lat: anchor.lat,
    lng: anchor.lng,
    geometry: [[anchor.lat, anchor.lng]],
    value: opts.interventionValue || opts.baselineValue || opts.value,
    baselineValue: opts.baselineValue,
    interventionValue: opts.interventionValue || opts.baselineValue,
    comparisonValue: comparison,
    source: opts.source,
    method: opts.method,
    type: "derived",
    spatialQuality: "inferred",
    geometryLinkage: "inferred",
    temporalCoverage: opts.baselineValue > 0 && opts.interventionValue > 0 ? "before-after" : "single-period",
    locationMethod: "pilot_area_inference",
    segmentId: opts.segmentId ?? "tri-p1-smart-crossing",
    streetName: opts.subSegment ? `Trikala survey — ${opts.subSegment}` : "Smart crossing corridor",
    spatialNote: "Survey aggregate at pilot anchor from partner My Maps geodata.",
    parserStatus: "partial",
    likertLabel: opts.likertLabel,
  });
}

function addBeforeAfterLikert(
  records: NormalizedCityRecord[],
  kpiId: string,
  idSuffix: string,
  baselineRows: Record<string, unknown>[],
  postRows: Record<string, unknown>[],
  columnMatch: RegExp,
  source: string,
  likertLabel: string,
  sourceFile: string,
  segmentId: string,
  maxScale = 4,
  interventionId: TrikalaPilotId = "tri-p1"
) {
  const baselineAvg = averageLikert(baselineRows, columnMatch);
  const postAvg = averageLikert(postRows, columnMatch);
  const baselinePct = likertToPercent(baselineAvg, maxScale);
  const postPct = likertToPercent(postAvg, maxScale);
  if (baselinePct <= 0 && postPct <= 0) return;
  pushSurveyRecord(records, kpiId, {
    idSuffix,
    value: postPct || baselinePct,
    baselineValue: baselinePct,
    interventionValue: postPct || baselinePct,
    sourceFile,
    source,
    method: `Mean Likert (${likertLabel}) — baseline n=${baselineRows.length}, post n=${postRows.length}.`,
    segmentId,
    likertLabel,
    interventionId,
  });
}

function addSegmentSafetyRecords(
  records: NormalizedCityRecord[],
  kpiId: string,
  insights: TrikalaSegmentInsight[]
) {
  if (kpiId !== "kpi2.1") return;
  const targets: Array<{ segment: TrikalaSegmentId; suffix: string }> = [
    { segment: "village", suffix: "women-village-night-safety" },
    { segment: "caregiver", suffix: "women-caregiver-night-safety" },
    { segment: "urban", suffix: "women-urban-day-safety" },
  ];
  targets.forEach(({ segment, suffix }) => {
    const insight = insights.find((i) => i.segment === segment);
    if (!insight || insight.responseCount === 0) return;
    const isNight = suffix.includes("night");
    const avg = isNight ? insight.nightSafetyAvg : insight.daySafetyAvg;
    const pct = likertToPercent(avg ?? 0);
    if (pct <= 0) return;
    pushSurveyRecord(records, kpiId, {
      idSuffix: suffix,
      value: pct,
      baselineValue: pct,
      interventionValue: pct,
      sourceFile: TRIKALA_SURVEY_FILES.womenMobility,
      source: "Women mobility questionnaire",
      method: `${insight.label}: mean ${isNight ? "nighttime" : "daytime"} safety (n=${insight.responseCount}).`,
      segmentId: `tri-p1-${segment}`,
      subSegment: insight.label,
      likertLabel: isNight ? "Night safety" : "Day safety",
    });
  });
}

export async function buildTrikalaRecords(kpiId: string): Promise<NormalizedCityRecord[]> {
  const cached = recordCache.get(kpiId);
  if (cached) return cached;

  const bundle = await loadTrikalaSurveyBundle();
  const insights = computeTrikalaSegmentInsights(bundle);
  const records: NormalizedCityRecord[] = [];

  const {
    smartCrossingBaseline,
    smartCrossingPost,
    womenMobility,
    bikeLaneBaseline,
    bikeLanePost,
    smartaAppPost,
  } = bundle;

  if (smartCrossingBaseline.length > 0 || smartCrossingPost.length > 0) {
    addBeforeAfterLikert(
      records,
      "kpi2.1",
      "smart-crossing-safety",
      smartCrossingBaseline,
      smartCrossingPost,
      /how safe do you feel/i,
      "Smart crossing on-line survey",
      "Perceived crossing safety",
      TRIKALA_SURVEY_FILES.smartCrossingBaseline,
      "tri-p1-smart-crossing"
    );
    addBeforeAfterLikert(
      records,
      "kpi2.1",
      "smart-crossing-cyclist-safety",
      smartCrossingBaseline,
      smartCrossingPost,
      /how safe is the road for a cyclist/i,
      "Smart crossing on-line survey",
      "Cyclist safety",
      TRIKALA_SURVEY_FILES.smartCrossingBaseline,
      "tri-p1-smart-crossing"
    );
    addBeforeAfterLikert(
      records,
      "kpi4.2",
      "smart-crossing-condition",
      smartCrossingBaseline,
      smartCrossingPost,
      /rate the current condition|evaluate the current condition/i,
      "Smart crossing on-line survey",
      "Crossing condition",
      TRIKALA_SURVEY_FILES.smartCrossingBaseline,
      "tri-p1-smart-crossing"
    );
    addBeforeAfterLikert(
      records,
      "kpi4.1",
      "smart-crossing-accessibility",
      smartCrossingBaseline,
      smartCrossingPost,
      /overall impression.*accessibility|accessibility in the city/i,
      "Smart crossing on-line survey",
      "Accessibility impression",
      TRIKALA_SURVEY_FILES.smartCrossingBaseline,
      "tri-p1-smart-crossing"
    );
    addBeforeAfterLikert(
      records,
      "kpi4.2",
      "smart-crossing-connectivity",
      smartCrossingBaseline,
      smartCrossingPost,
      /connected to other parts/i,
      "Smart crossing on-line survey",
      "Area connectivity",
      TRIKALA_SURVEY_FILES.smartCrossingBaseline,
      "tri-p1-smart-crossing"
    );
  }

  if (bikeLaneBaseline.length > 0 || bikeLanePost.length > 0) {
    addBeforeAfterLikert(
      records,
      "kpi2.1",
      "bike-lane-safety",
      bikeLaneBaseline,
      bikeLanePost,
      /safe.*bike lane/i,
      "Bike lane safety survey",
      "Bike lane safety",
      TRIKALA_SURVEY_FILES.bikeLaneBaseline,
      "tri-p3-bike-lane",
      4,
      "tri-p3"
    );
    addBeforeAfterLikert(
      records,
      "kpi2.1",
      "bike-night-safety",
      bikeLaneBaseline,
      bikeLanePost,
      /cycling at night/i,
      "Bike lane safety survey",
      "Night cycling safety",
      TRIKALA_SURVEY_FILES.bikeLaneBaseline,
      "tri-p3-bike-lane",
      5,
      "tri-p3"
    );
    addBeforeAfterLikert(
      records,
      "kpi4.2",
      "bike-lane-condition",
      bikeLaneBaseline,
      bikeLanePost,
      /condition of the bike lane/i,
      "Bike lane safety survey",
      "Bike lane condition",
      TRIKALA_SURVEY_FILES.bikeLaneBaseline,
      "tri-p3-bike-lane",
      4,
      "tri-p3"
    );
  }

  if (womenMobility.length > 0) {
    const daySafety = averageLikert(womenMobility, /ασφαλής.*μέρα/i);
    const nightSafety = averageLikert(womenMobility, /ασφαλής.*νύχτα/i);
    if (kpiId === "kpi2.1") {
      pushSurveyRecord(records, kpiId, {
        idSuffix: "women-mobility-day-safety",
        value: likertToPercent(daySafety),
        baselineValue: likertToPercent(daySafety),
        interventionValue: likertToPercent(daySafety),
        sourceFile: TRIKALA_SURVEY_FILES.womenMobility,
        source: "Women mobility questionnaire",
        method: `Mean daytime safety perception from ${womenMobility.length} responses.`,
        segmentId: "tri-p1-women-mobility",
        likertLabel: "Day safety (women)",
      });
      pushSurveyRecord(records, kpiId, {
        idSuffix: "women-mobility-night-safety",
        value: likertToPercent(nightSafety),
        baselineValue: likertToPercent(nightSafety),
        interventionValue: likertToPercent(nightSafety),
        sourceFile: TRIKALA_SURVEY_FILES.womenMobility,
        source: "Women mobility questionnaire",
        method: `Mean nighttime safety perception from ${womenMobility.length} responses.`,
        segmentId: "tri-p1-women-mobility",
        likertLabel: "Night safety (women)",
      });
      addSegmentSafetyRecords(records, kpiId, insights);
    }
  }

  if (kpiId === "kpi1.2" && womenMobility.length > 0) {
    const share = activeModeShare(womenMobility);
    pushSurveyRecord(records, kpiId, {
      idSuffix: "women-mobility-active-share",
      value: share,
      baselineValue: share,
      interventionValue: share,
      sourceFile: TRIKALA_SURVEY_FILES.womenMobility,
      source: "Women mobility questionnaire",
      method: "Share of reported trip modes that are walking or cycling.",
      segmentId: "tri-p1-women-mobility",
    });
    const villageInsight = insights.find((i) => i.segment === "village");
    if (villageInsight && villageInsight.responseCount > 0 && villageInsight.activeModeSharePct) {
      pushSurveyRecord(records, kpiId, {
        idSuffix: "women-village-active-share",
        value: villageInsight.activeModeSharePct,
        baselineValue: villageInsight.activeModeSharePct,
        interventionValue: villageInsight.activeModeSharePct,
        sourceFile: TRIKALA_SURVEY_FILES.womenMobility,
        source: "Women mobility questionnaire",
        method: `Village residents active mode share (n=${villageInsight.responseCount}).`,
        segmentId: "tri-p1-village",
        subSegment: "Village residents",
      });
    }
  }

  if (kpiId === "kpi4.1" && smartaAppPost.length > 0) {
    const satisfactionAvg = averageLikert(smartaAppPost, /meets my mobility needs/i);
    const usabilityAvg = averageLikert(smartaAppPost, /well organized|user-friendly/i);
    pushSurveyRecord(records, kpiId, {
      idSuffix: "smarta-mobility-needs",
      value: likertToPercent(satisfactionAvg, 5),
      baselineValue: 0,
      interventionValue: likertToPercent(satisfactionAvg, 5),
      sourceFile: TRIKALA_SURVEY_FILES.smartaAppPost,
      source: "SMARTA app post-intervention survey",
      method: `Mean mobility-needs satisfaction from ${smartaAppPost.length} post responses.`,
      segmentId: "tri-p1-smarta-app",
      likertLabel: "SMARTA mobility needs",
    });
    pushSurveyRecord(records, kpiId, {
      idSuffix: "smarta-usability",
      value: likertToPercent(usabilityAvg, 5),
      baselineValue: 0,
      interventionValue: likertToPercent(usabilityAvg, 5),
      sourceFile: TRIKALA_SURVEY_FILES.smartaAppPost,
      source: "SMARTA app post-intervention survey",
      method: `Mean app usability score from ${smartaAppPost.length} post responses.`,
      segmentId: "tri-p1-smarta-app",
      likertLabel: "SMARTA usability",
    });
  }

  if (kpiId === "kpi3.2") {
    const envRecords = await buildTrikalaEnvironmentalRecords(kpiId);
    records.push(...envRecords);
  }

  if (kpiId === "kpi2.1" || kpiId === "kpi4.2") {
    const bikeLaneRecords = await buildTrikalaBikeLaneSensorRecords(kpiId);
    records.push(...bikeLaneRecords);
  }

  const filtered = records.filter((r) => r.kpiId === kpiId);
  recordCache.set(kpiId, filtered);
  return filtered;
}

export function clearTrikalaSurveyCaches(): void {
  surveyBundleCache = null;
  segmentInsightCache = null;
  recordCache.clear();
}
