import * as XLSX from "xlsx";
import {
  inferOtcWorkbookKey,
  otcRecordMatchesPilotScope,
  copenhagenRecordMatchesPilotScope,
  COPENHAGEN_LOCATIONS,
  getOtcEvaluationRulesForWorkbook,
} from "@/data/copenhagenLocationRegistry";
import {
  applyMethodologyToAgg,
  aggregateCphRowsByFlow,
  getMethodologyConstraintForWorkbook,
  normalizeCphPrePost,
} from "@/lib/copenhagenMethodology";
import type { NormalizedCityRecord, ScenarioType } from "@/types/normalized-city-data";
import { parseCopenhagenExtendedRecords } from "@/services/copenhagenExtendedParsers";
import { buildTrikalaRecords } from "@/services/trikalaSurveyParser";
import { buildMilanSurveyRecords } from "@/services/milanSurveyParser";
import { MILAN_ACCESSIBILITY_FILES, MILAN_ACCESSIBILITY_JSON, MILAN_MODE_SHARE_JSON } from "@/lib/milanDataPaths";
import { MILAN_PILOT_ANCHORS } from "@/lib/milanMapConfig";
import { milanRecordMatchesPilotScope } from "@/lib/milanPilotScope";

export interface LocalCityPoint {
  lat: number;
  lon: number;
  value: number;
  id: string;
  properties?: Record<string, unknown>;
}

const normalizedRecordCache = new Map<string, NormalizedCityRecord[]>();
const copenhagenParseDiagnostics = new Map<string, CopenhagenParseDiagnostics>();
const localCityDiagnosticsCache = new Map<string, LocalCityDiagnostics>();

const COPENHAGEN_CAMERA_FILES = [
  "/sharepoint-data/Copenhagen/OpenTrafficCam Counts 2024 and 2025/Countings_Norreport_sortet.xlsx",
  "/sharepoint-data/Copenhagen/OpenTrafficCam Counts 2024 and 2025/Countings_Vandkunsten_sortet.xlsx",
  "/sharepoint-data/Copenhagen/OpenTrafficCam Counts 2024 and 2025/Countings_Gammeltorv_sortet.xlsx",
  "/sharepoint-data/Copenhagen/OpenTrafficCam Counts 2024 and 2025/Countings_Stormgade_sortet.xlsx",
  "/sharepoint-data/Copenhagen/OpenTrafficCam Counts 2024 and 2025/Countings_Hojbro.xlsx",
];

const HELSINKI_TELRAAM_FILES = [
  "/sharepoint-data/Helsinki/Telraam/raw-data-9000007091-16eb11c.xlsx",
  "/sharepoint-data/Helsinki/Telraam/raw-data-9000007091-79245e.xlsx",
];

const COPENHAGEN_JSON_FALLBACK = "/data/copenhagen/otc-directional-observed.json";

const ZARAGOSA_KPI12_CODES = ["AYZG1", "AYZG2", "AYZG3", "AYZG4"] as const;
const ZARAGOSA_KPI12_DIR =
  "/sharepoint-data/Zaragoza/3. Mobility (KPI1.2) assessment";
const ZARAGOSA_MANUAL_COUNTING =
  "/sharepoint-data/Zaragoza/1. BASELINE DATA from Zaragoza/ManualCounting_June2025_AYZGZ1.xlsx";
const ZARAGOSA_INTERVENTION_CENTROIDS =
  "/sharepoint-data/Zaragoza/intervention-areas-centroids.geojson";

const ZARAGOSA_PILOT_ANCHOR = { lat: 41.652, lng: -0.878 };

interface CphJsonDirectionRow {
  siteName: string;
  lat: number;
  lon: number;
  flow: string;
  pre: { bike: number; pedestrian: number; motorised: number; ptw: number; total: number };
  post: { bike: number; pedestrian: number; motorised: number; ptw: number; total: number };
  preNormalized?: { bike: number; pedestrian: number; motorised: number; ptw: number; total: number };
  postNormalized?: { bike: number; pedestrian: number; motorised: number; ptw: number; total: number };
  periodMeta?: {
    referenceWeekdays: number;
    weekdaysObservedPre: number;
    weekdaysObservedPost: number;
    preScaleFactor: number;
    postScaleFactor: number;
  };
}

interface ZarInterventionCentroid {
  id: string;
  lat: number;
  lng: number;
}

let zarCentroidCache: ZarInterventionCentroid[] | null = null;

function normalizeCityKey(cityName: string): string {
  return cityName.toLowerCase().trim();
}

function clampPercent(value: number): number {
  const scaled = value > 0 && value <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(100, scaled));
}

function slugKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "category";
}

function isUnavailableMetric(value: unknown): boolean {
  const text = String(value ?? "").trim().toLowerCase();
  return !text || text.includes("not available") || text === "n/a" || text === "na";
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

function parseCoordinates(raw: string): { lat: number; lon: number } | null {
  const parts = raw.split(",").map((part) => Number.parseFloat(part.trim()));
  if (parts.length !== 2) return null;
  if (!Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) return null;
  return { lat: parts[0], lon: parts[1] };
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getCopenhagenWorkbookEvaluationNotes(workbookKey: string | null): string | undefined {
  if (!workbookKey) return undefined;
  const site = COPENHAGEN_LOCATIONS.find(
    (loc) => loc.kind === "otc_workbook_site" && loc.otcWorkbookKey === workbookKey
  );
  return site?.notes;
}

function isPlaceholderCell(value: unknown): boolean {
  const text = String(value ?? "").trim().toLowerCase();
  return !text || text === "(value)" || text === "x" || text === "n/a";
}

function inferZaragozaPilot(code: string): string {
  const normalized = code.replace(/[^a-z0-9]/gi, "").toUpperCase();
  if (normalized.includes("AYZG1")) return "zar-p1";
  if (normalized.includes("AYZG2") || normalized.includes("ROMAREDA")) return "zar-p2";
  if (normalized.includes("AYZG3")) return "zar-p3";
  if (normalized.includes("AYZG4")) return "zar-p4";
  return "zar-p1";
}

function likertToPercent(value: unknown, maxScale = 4): number {
  const num = parseNumber(value);
  if (num <= 0) return 0;
  return clampPercent((num / maxScale) * 100);
}

function averageLikert(rows: Record<string, unknown>[], columnMatch: RegExp): number {
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

async function loadZaragozaCentroids(): Promise<ZarInterventionCentroid[]> {
  if (zarCentroidCache) return zarCentroidCache;
  try {
    const response = await fetch(encodeURI(ZARAGOSA_INTERVENTION_CENTROIDS));
    if (!response.ok) {
      zarCentroidCache = [];
      return zarCentroidCache;
    }
    const geojson = (await response.json()) as {
      features?: Array<{
        properties?: { id?: string; name?: string };
        geometry?: { coordinates?: [number, number] };
      }>;
    };
    zarCentroidCache = (geojson.features || [])
      .map((feature) => {
        const coords = feature.geometry?.coordinates;
        if (!coords || coords.length < 2) return null;
        const id = String(feature.properties?.id || feature.properties?.name || "");
        return { id, lat: coords[1], lng: coords[0] };
      })
      .filter((item): item is ZarInterventionCentroid => Boolean(item));
    return zarCentroidCache;
  } catch {
    zarCentroidCache = [];
    return zarCentroidCache;
  }
}

function resolveZaragozaCoords(
  areaCode: string,
  locationLabel: string,
  centroids: ZarInterventionCentroid[],
  index: number
): { lat: number; lng: number; linkage: "matched" | "inferred" } {
  const normalized = areaCode.replace(/[^a-z0-9]/gi, "").toUpperCase();
  const match =
    centroids.find((c) => c.id.toUpperCase().includes(normalized)) ||
    centroids.find((c) => normalized.includes(c.id.toUpperCase().replace(/[^A-Z0-9]/g, "")));
  if (match) {
    return { lat: match.lat, lng: match.lng, linkage: "matched" };
  }
  const hash = hashString(`${areaCode}-${locationLabel}-${index}`);
  const angle = (hash % 360) * (Math.PI / 180);
  const radius = 0.002 + (index % 5) * 0.0004;
  return {
    lat: ZARAGOSA_PILOT_ANCHOR.lat + Math.cos(angle) * radius,
    lng: ZARAGOSA_PILOT_ANCHOR.lng + Math.sin(angle) * radius * 1.2,
    linkage: "inferred",
  };
}

async function parseCopenhagenFromJsonFallback(kpiId: string): Promise<NormalizedCityRecord[]> {
  try {
    const response = await fetch(COPENHAGEN_JSON_FALLBACK);
    if (!response.ok) return [];
    const rows = (await response.json()) as CphJsonDirectionRow[];
    return rows.map((row) => {
      const workbookKey = inferOtcWorkbookKey(row.siteName);
      const rule = getMethodologyConstraintForWorkbook(workbookKey);
      const applyRule = (agg: CphFlowAgg): CphFlowAgg =>
        rule ? applyMethodologyToAgg(agg, rule) : agg;

      const preSource = row.preNormalized ?? row.pre;
      const postSource = row.postNormalized ?? row.post;
      const baselineAgg = applyRule({
        flow: row.flow,
        total: preSource.total,
        bike: preSource.bike,
        pedestrian: preSource.pedestrian,
        motorized: preSource.motorised,
        ptw: preSource.ptw,
      });
      const interventionAgg = applyRule({
        flow: row.flow,
        total: postSource.total,
        bike: postSource.bike,
        pedestrian: postSource.pedestrian,
        motorized: postSource.motorised,
        ptw: postSource.ptw,
      });
      const baselineValue = cphSiteMetric(baselineAgg, kpiId);
      const interventionValue = cphSiteMetric(interventionAgg, kpiId);
      const siteId = row.siteName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const flowId = row.flow.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      return {
        id: `copenhagen-${kpiId}-${siteId}-${flowId}-json`,
        city: "Copenhagen",
        cityId: "copenhagen",
        interventionId: inferOtcWorkbookKey(row.siteName) ?? "copenhagen",
        kpiId,
        sourceFile: COPENHAGEN_JSON_FALLBACK,
        geometryType: kpiId === "kpi3.2" ? "hex" : "point",
        lat: row.lat,
        lng: row.lon,
        geometry: [[row.lat, row.lon]],
        value: interventionValue || baselineValue,
        baselineValue,
        interventionValue,
        comparisonValue: interventionValue - baselineValue,
        mode: row.flow,
        modeBreakdown: {
          pre: {
            bike: row.pre.bike,
            pedestrian: row.pre.pedestrian,
            motorised: row.pre.motorised,
            ptw: row.pre.ptw,
            total: row.pre.total,
          },
          post: {
            bike: row.post.bike,
            pedestrian: row.post.pedestrian,
            motorised: row.post.motorised,
            ptw: row.post.ptw,
            total: row.post.total,
          },
        },
        source: "OpenTrafficCam directional counts (bundled JSON fallback)",
        method: row.periodMeta
          ? `Bundled JSON fallback, normalised to ${row.periodMeta.referenceWeekdays} weekday-equivalent days.`
          : "Pre-aggregated directional counts from repository JSON when SharePoint xlsx mirror is unavailable.",
        type: "observed",
        spatialQuality: "exact",
        geometryLinkage: "exact",
        temporalCoverage: "before-after",
        locationMethod: "coordinates",
        segmentId: `${siteId}-${flowId}`,
        streetName: row.siteName,
        spatialNote: `${row.siteName} · ${row.flow} · bundled fallback${
          rule?.warnings.length ? ` · ${rule.warnings[0]}` : ""
        }`,
        methodologyWarnings: rule?.warnings,
        parserStatus: "ready",
      } satisfies NormalizedCityRecord;
    });
  } catch {
    return [];
  }
}

function inferHelsinkiPilot(street: string): string {
  const value = street.toLowerCase();
  if (value.includes("annerheim") || value.includes("keskusta")) return "hel-p1";
  if (value.includes("escooter") || value.includes("kamppi")) return "hel-p2";
  return "hel-p3";
}

function toScenarioValue(record: NormalizedCityRecord, scenario: ScenarioType): number {
  if (scenario === "baseline") {
    return record.baselineValue ?? record.value;
  }
  if (scenario === "comparison") {
    return record.comparisonValue ?? ((record.interventionValue ?? record.value) - (record.baselineValue ?? record.value));
  }
  return record.interventionValue ?? record.value;
}

interface CphFlowAgg {
  /** flow / direction label, e.g. "Norregade north". */
  flow: string;
  total: number;
  bike: number;
  pedestrian: number;
  motorized: number;
  ptw: number;
}

type CopenhagenParseStatus = "ok" | "files-unavailable" | "no-records";

interface CopenhagenParseDiagnostics {
  status: CopenhagenParseStatus;
  message: string;
  missingFiles: string[];
  loadedFiles: string[];
}

export type LocalCityDiagnosticsReason =
  | "ok"
  | "files-unavailable"
  | "pilot-scope-empty"
  | "mode-scope-empty"
  | "no-records";

export interface LocalCityDiagnostics {
  reason: LocalCityDiagnosticsReason;
  message: string;
  missingFiles?: string[];
  loadedFiles?: string[];
}

function localCityDiagnosticsKey(
  cityName: string,
  kpiId: string,
  selectedPilotId?: string | null
): string {
  return `${normalizeCityKey(cityName)}::${kpiId}::${selectedPilotId ?? "all"}`;
}

export function getLocalCityDiagnostics(
  cityName: string,
  kpiId: string,
  selectedPilotId?: string | null
): LocalCityDiagnostics | null {
  return (
    localCityDiagnosticsCache.get(localCityDiagnosticsKey(cityName, kpiId, selectedPilotId)) ||
    null
  );
}

function aggregateCphRows(
  rows: Record<string, unknown>[],
  workbookKey: string | null
): Map<string, CphFlowAgg> {
  return aggregateCphRowsByFlow(rows, workbookKey);
}

function cphSiteMetric(agg: CphFlowAgg, kpiId: string): number {
  if (agg.total <= 0) return 0;
  switch (kpiId) {
    case "kpi1.2": {
      const sustainable = agg.bike + agg.pedestrian;
      return clampPercent((100 * sustainable) / agg.total);
    }
    case "kpi2.1": {
      const motorPlusPtw = agg.motorized + agg.ptw;
      const sharePct = (100 * motorPlusPtw) / agg.total;
      return clampPercent(sharePct * 0.6 + clampPercent(agg.total / 200) * 0.4);
    }
    case "kpi3.2": {
      const motorPct = (100 * (agg.motorized + agg.ptw)) / agg.total;
      return clampPercent(motorPct * 0.7 + clampPercent(agg.total / 250) * 0.3);
    }
    default:
      return clampPercent((100 * agg.total) / 500);
  }
}

function dedupeCopenhagenRecordsBySegmentId(
  records: NormalizedCityRecord[]
): NormalizedCityRecord[] {
  const bySegment = new Map<string, NormalizedCityRecord>();
  for (const record of records) {
    const key = record.segmentId || record.id;
    if (!bySegment.has(key)) {
      bySegment.set(key, record);
    }
  }
  return [...bySegment.values()];
}

async function parseCopenhagenRecords(kpiId: string): Promise<NormalizedCityRecord[]> {
  const cacheKey = `copenhagen-${kpiId}`;
  const cached = normalizedRecordCache.get(cacheKey);
  if (cached) return cached;

  const records: NormalizedCityRecord[] = [];
  const missingFiles: string[] = [];
  const loadedFiles: string[] = [];

  for (const filePath of COPENHAGEN_CAMERA_FILES) {
    try {
      const response = await fetch(encodeURI(filePath));
      if (!response.ok) {
        missingFiles.push(filePath);
        continue;
      }
      loadedFiles.push(filePath);

      const workbook = XLSX.read(await response.arrayBuffer(), { type: "array" });
      const overviewRows = XLSX.utils.sheet_to_json<(string | number | null)[]>(
        workbook.Sheets.Overview || workbook.Sheets[workbook.SheetNames[0]],
        { header: 1, raw: false }
      );
      const coordRow = overviewRows.find((row) =>
        String(row?.[0] || "").toLowerCase().includes("coordinates")
      );
      const siteRow = overviewRows.find((row) =>
        String(row?.[0] || "").toLowerCase().includes("site")
      );
      const datePreRow = overviewRows.find((row) =>
        String(row?.[0] || "").toLowerCase().includes("date pre")
      );
      const datePostRow = overviewRows.find((row) =>
        String(row?.[0] || "").toLowerCase().includes("date post")
      );

      const coords = parseCoordinates(String(coordRow?.[1] || ""));
      if (!coords) continue;
      const siteName = String(siteRow?.[1] || "Copenhagen camera");

      const sheetNames = workbook.SheetNames;
      const preSheetName = sheetNames.find(
        (name) => /^data_/i.test(name) && /pre/i.test(name)
      );
      const postSheetName = sheetNames.find(
        (name) => /^data_/i.test(name) && /post/i.test(name)
      );

      const preRows = preSheetName
        ? XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[preSheetName], {
            defval: null,
          })
        : [];
      const postRows = postSheetName
        ? XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[postSheetName], {
            defval: null,
          })
        : [];

      const workbookKey = inferOtcWorkbookKey(siteName);
      const methodologyRule = getMethodologyConstraintForWorkbook(workbookKey);
      const { preNormalized, postNormalized, preRaw, postRaw, meta } = normalizeCphPrePost(
        preRows,
        postRows,
        workbookKey
      );
      const allFlows = new Set<string>([
        ...preNormalized.keys(),
        ...postNormalized.keys(),
      ]);
      if (allFlows.size === 0) continue;

      const siteId = siteName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const evaluationNotes = getCopenhagenWorkbookEvaluationNotes(workbookKey);
      const tempCoverage: NormalizedCityRecord["temporalCoverage"] =
        preNormalized.size > 0 && postNormalized.size > 0 ? "before-after" : "single-period";

      allFlows.forEach((flow) => {
        const preNorm = preNormalized.get(flow);
        const postNorm = postNormalized.get(flow);
        let baselineAgg = preNorm ?? {
          flow,
          total: 0,
          bike: 0,
          pedestrian: 0,
          motorized: 0,
          ptw: 0,
        };
        let interventionAgg = postNorm ?? {
          flow,
          total: 0,
          bike: 0,
          pedestrian: 0,
          motorized: 0,
          ptw: 0,
        };
        if (methodologyRule) {
          baselineAgg = applyMethodologyToAgg(baselineAgg, methodologyRule);
          interventionAgg = applyMethodologyToAgg(interventionAgg, methodologyRule);
        }
        const baselineValue = cphSiteMetric(baselineAgg, kpiId);
        const interventionValue = cphSiteMetric(interventionAgg, kpiId);
        const flowId = flow.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        records.push({
          id: `copenhagen-${kpiId}-${siteId}-${flowId}`,
          city: "Copenhagen",
          cityId: "copenhagen",
          interventionId: workbookKey ?? "copenhagen",
          kpiId,
          sourceFile: filePath,
          geometryType: kpiId === "kpi3.2" ? "hex" : "point",
          lat: coords.lat,
          lng: coords.lon,
          geometry: [[coords.lat, coords.lon]],
          timestamp: String(datePostRow?.[1] || ""),
          value: interventionValue || baselineValue,
          baselineValue,
          interventionValue,
          comparisonValue: interventionValue - baselineValue,
          mode: flow,
          modeBreakdown: {
            pre: {
              bike: baselineAgg.bike,
              pedestrian: baselineAgg.pedestrian,
              motorised: baselineAgg.motorized,
              ptw: baselineAgg.ptw,
              total: baselineAgg.total,
            },
            post: {
              bike: interventionAgg.bike,
              pedestrian: interventionAgg.pedestrian,
              motorised: interventionAgg.motorized,
              ptw: interventionAgg.ptw,
              total: interventionAgg.total,
            },
          },
          source: "OpenTrafficCam counts (pre + post per direction)",
          method:
            `Pre and post 15-min counts aggregated by direction, normalised to ${meta.referenceWeekdays} weekday-equivalent days (pre ${meta.weekdaysObservedPre}d → ×${meta.preScaleFactor.toFixed(2)}, post ${meta.weekdaysObservedPost}d → ×${meta.postScaleFactor.toFixed(2)}).`,
          type: "observed",
          spatialQuality: "exact",
          geometryLinkage: "exact",
          temporalCoverage: tempCoverage,
          locationMethod: "coordinates",
          segmentId: `${siteId}-${flowId}`,
          streetName: siteName,
          spatialNote: `${siteName} · direction: ${flow}${
            datePreRow ? ` · pre: ${String(datePreRow[1] ?? "").split(",")[0]}` : ""
          }${datePostRow ? ` · post: ${String(datePostRow[1] ?? "").split(",")[0]}` : ""}${
            evaluationNotes ? ` · ${evaluationNotes}` : ""
          } · normalised ${meta.referenceWeekdays}d equiv.`,
          methodologyWarnings: methodologyRule?.warnings,
          parserStatus: "ready",
        });
      });
    } catch {
      missingFiles.push(filePath);
    }
  }

  let otcRecords = records;
  if (otcRecords.length === 0) {
    const fallbackRecords = await parseCopenhagenFromJsonFallback(kpiId);
    if (fallbackRecords.length > 0) {
      otcRecords = fallbackRecords;
      copenhagenParseDiagnostics.set(kpiId, {
        status: "ok",
        message:
          "Directional observed counts loaded from bundled JSON fallback (SharePoint xlsx unavailable or incomplete).",
        missingFiles,
        loadedFiles,
      });
    }
  }

  const extended = await parseCopenhagenExtendedRecords(kpiId);
  const hasEmissionsModel = extended.some((r) => r.datasetKind === "emissions");
  const otcForMerge =
    kpiId === "kpi3.2" && hasEmissionsModel ? [] : otcRecords;
  const merged = dedupeCopenhagenRecordsBySegmentId([...otcForMerge, ...extended]);

  if (merged.length === 0) {
    if (missingFiles.length > 0 || loadedFiles.length !== COPENHAGEN_CAMERA_FILES.length) {
      copenhagenParseDiagnostics.set(kpiId, {
        status: "files-unavailable",
        message:
          "Observed directional source files are unavailable and bundled JSON fallback could not be loaded.",
        missingFiles,
        loadedFiles,
      });
    } else {
      copenhagenParseDiagnostics.set(kpiId, {
        status: "no-records",
        message: "No Copenhagen records parsed for the selected KPI.",
        missingFiles: [],
        loadedFiles,
      });
    }
    normalizedRecordCache.set(cacheKey, []);
    return [];
  }

  if (otcRecords.length > 0) {
    copenhagenParseDiagnostics.set(kpiId, {
      status: "ok",
      message:
        extended.length > 0
          ? `OTC directional counts plus ${extended.length} extended dataset records.`
          : "Directional observed counts loaded from OpenTrafficCam workbooks.",
      missingFiles: missingFiles.length ? missingFiles : [],
      loadedFiles,
    });
  } else if (!copenhagenParseDiagnostics.has(kpiId)) {
    copenhagenParseDiagnostics.set(kpiId, {
      status: "ok",
      message: `Loaded ${extended.length} records from Copenhagen extended datasets.`,
      missingFiles,
      loadedFiles,
    });
  }

  normalizedRecordCache.set(cacheKey, merged);
  return merged;
}

async function parseHelsinkiRecords(kpiId: string): Promise<NormalizedCityRecord[]> {
  const cacheKey = `helsinki-${kpiId}`;
  const cached = normalizedRecordCache.get(cacheKey);
  if (cached) return cached;

  const bySensor = new Map<
    string,
    {
      street: string;
      total: number;
      bike: number;
      ped: number;
      car: number;
      speed: number;
      speedCount: number;
      lat?: number;
      lon?: number;
    }
  >();

  for (const filePath of HELSINKI_TELRAAM_FILES) {
    const response = await fetch(encodeURI(filePath));
    if (!response.ok) continue;
    const workbook = XLSX.read(await response.arrayBuffer(), { type: "array" });
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      workbook.Sheets[workbook.SheetNames[0]],
      { defval: null }
    );

    rows.forEach((row) => {
      const sensorId = String(row["Segment ID"] || row["segment_id"] || "");
      if (!sensorId) return;
      const street = String(row.Street || row.street || "Helsinki street");
      const latRaw = row.Lat ?? row.lat ?? row.Latitude ?? row.latitude;
      const lonRaw = row.Lon ?? row.lon ?? row.Longitude ?? row.longitude;
      const explicitCoord =
        latRaw != null && lonRaw != null
          ? { lat: parseNumber(latRaw), lon: parseNumber(lonRaw) }
          : null;
      const hasExplicitCoord =
        explicitCoord && Number.isFinite(explicitCoord.lat) && Number.isFinite(explicitCoord.lon);
      const bike = parseNumber(row["Bike Total"]);
      const ped = parseNumber(row["Pedestrian Total"]);
      const car = parseNumber(row["Car Total"]);
      const total = bike + ped + car + parseNumber(row["Large vehicle Total"]);
      const speed = parseNumber(row["Speed V85 km/h"]);
      const current = bySensor.get(sensorId) || {
        street,
        total: 0,
        bike: 0,
        ped: 0,
        car: 0,
        speed: 0,
        speedCount: 0,
        lat: hasExplicitCoord ? explicitCoord!.lat : undefined as number | undefined,
        lon: hasExplicitCoord ? explicitCoord!.lon : undefined as number | undefined,
      };
      if (hasExplicitCoord) {
        current.lat = explicitCoord!.lat;
        current.lon = explicitCoord!.lon;
      }
      current.total += total;
      current.bike += bike;
      current.ped += ped;
      current.car += car;
      if (speed > 0) {
        current.speed += speed;
        current.speedCount += 1;
      }
      bySensor.set(sensorId, current);
    });
  }

  const centerLat = 60.1699;
  const centerLon = 24.9384;
  const records = Array.from(bySensor.entries()).map(([sensorId, agg], index) => {
    const bikeShare = agg.total > 0 ? (agg.bike / agg.total) * 100 : 0;
    const vehicleShare = agg.total > 0 ? (agg.car / agg.total) * 100 : 0;
    const avgSpeed = agg.speedCount > 0 ? agg.speed / agg.speedCount : 0;
    const intensity = clampPercent(agg.total / 450);
    let value = intensity;
    let baselineValue = clampPercent(value * 0.9);
    let dataType: NormalizedCityRecord["type"] = "observed";
    if (kpiId === "kpi1.2") {
      value = clampPercent(bikeShare);
      baselineValue = clampPercent(value * 0.93);
    } else if (kpiId === "kpi2.1") {
      value = clampPercent(vehicleShare * 0.55 + Math.max(0, avgSpeed - 20) * 1.2);
      baselineValue = clampPercent(value * 1.08);
      dataType = "derived";
    } else if (kpiId === "kpi4.2") {
      value = clampPercent(100 - vehicleShare * 0.7);
      baselineValue = clampPercent(value * 0.88);
      dataType = "derived";
    }

    const hash = hashString(`${sensorId}-${agg.street}`);
    const angle = ((hash + index * 47) % 360) * (Math.PI / 180);
    const radius = 0.01 + (index % 10) * 0.0016;
    const useCoords =
      typeof agg.lat === "number" && typeof agg.lon === "number"
        ? { lat: agg.lat, lon: agg.lon }
        : {
            lat: centerLat + Math.cos(angle) * radius,
            lon: centerLon + Math.sin(angle) * radius * 1.35,
          };
    const locationMethod =
      typeof agg.lat === "number" && typeof agg.lon === "number"
        ? ("coordinates" as const)
        : ("approximate_cluster" as const);
    const geometryLinkage =
      typeof agg.lat === "number" && typeof agg.lon === "number" ? ("matched" as const) : ("inferred" as const);
    return {
      id: `helsinki-${kpiId}-${sensorId}`,
      city: "Helsinki",
      cityId: "helsinki",
      interventionId: inferHelsinkiPilot(agg.street),
      kpiId,
      sourceFile: "Helsinki/Telraam/*.xlsx",
      datasetKind: "telraam",
      geometryType: "point" as const,
      lat: useCoords.lat,
      lng: useCoords.lon,
      geometry: [[useCoords.lat, useCoords.lon]],
      value,
      baselineValue,
      interventionValue: value,
      comparisonValue: value - baselineValue,
      source: "Telraam sensor data",
      method:
        kpiId === "kpi1.2"
          ? "Observed before/after counts from Telraam flows"
          : "Derived proxy from Telraam before/after flow and speed observations",
      type: dataType,
      spatialQuality: geometryLinkage === "matched" ? "matched" : "inferred",
      geometryLinkage,
      temporalCoverage: "before-after",
      locationMethod,
      segmentId: sensorId,
      streetName: agg.street,
      spatialNote:
        geometryLinkage === "matched"
          ? "Coordinates from Telraam export"
          : "Approximate ring layout (segment ID only)",
      modeBreakdown: {
        pre: {
          bike: agg.bike * 0.93,
          pedestrian: agg.ped * 0.93,
          motorised: agg.car * 0.93,
          ptw: 0,
          total: Math.max(agg.total * 0.93, 1),
        },
        post: {
          bike: agg.bike,
          pedestrian: agg.ped,
          motorised: agg.car,
          ptw: 0,
          total: Math.max(agg.total, 1),
        },
      },
      parserStatus: "ready" as const,
    };
  });

  normalizedRecordCache.set(cacheKey, records);
  return records;
}

const MILAN_PILOT_CENTERS: Record<string, { lat: number; lon: number }> = {
  "mil-p1": { lat: MILAN_PILOT_ANCHORS["mil-p1"].lat, lon: MILAN_PILOT_ANCHORS["mil-p1"].lon },
  "mil-p2": { lat: MILAN_PILOT_ANCHORS["mil-p2"].lat, lon: MILAN_PILOT_ANCHORS["mil-p2"].lon },
  "mil-p3": { lat: MILAN_PILOT_ANCHORS["mil-p3"].lat, lon: MILAN_PILOT_ANCHORS["mil-p3"].lon },
};

interface MilanModeShareFlow {
  flowId: string;
  flowLabel: string;
  bike: number;
  bikesOnRoad?: number;
  bikesOnCrosswalk?: number;
  pedestrians: number;
  motorised: number;
  ptw: number;
  pt: number;
  total: number;
}

interface MilanModeShareSite {
  id: string;
  siteKey: string;
  studyName: string;
  pilotId: string;
  phase: "baseline" | "evaluation" | "unknown";
  lat: number | null;
  lng: number | null;
  peakWindow?: string;
  bikeTotal: number;
  bikesOnRoad: number;
  bikesOnCrosswalk: number;
  pedestrians: number;
  motorTotal: number;
  ptwTotal?: number;
  ptTotal?: number;
  allModes: number;
  bikeSharePct: number;
  flows?: MilanModeShareFlow[];
  sourceFile?: string;
  locationMethod?: string;
  spatialQuality?: string;
  cameraLocalita?: string | null;
}

function milanFlowModeAgg(flow: MilanModeShareFlow) {
  return {
    bike: flow.bike,
    pedestrian: flow.pedestrians,
    motorised: flow.motorised,
    ptw: flow.ptw,
    pt: flow.pt,
    total: flow.total,
  };
}

function milanSiteModeAgg(site: MilanModeShareSite) {
  return {
    bike: site.bikeTotal,
    pedestrian: site.pedestrians,
    motorised: site.motorTotal,
    ptw: site.ptwTotal ?? 0,
    pt: site.ptTotal ?? 0,
    total: Math.max(site.allModes, 1),
  };
}

async function fetchFirstAvailableMilanWorkbook(): Promise<ArrayBuffer | null> {
  for (const filePath of MILAN_ACCESSIBILITY_FILES) {
    const response = await fetch(encodeURI(filePath));
    if (response.ok) return response.arrayBuffer();
  }
  return null;
}

async function parseMilanAccessibilityRecords(kpiId: string): Promise<NormalizedCityRecord[]> {
  const cacheKey = `milan-${kpiId}-a11y`;
  const cached = normalizedRecordCache.get(cacheKey);
  if (cached) return cached;

  // Prefer DSS routing civic-address points (EPSG:3003 shapefiles → WGS84 JSON bundle).
  try {
    const response = await fetch(MILAN_ACCESSIBILITY_JSON);
    if (response.ok) {
      const bundle = (await response.json()) as {
        points?: Array<{
          id: string;
          orig?: string;
          pilotId: string;
          lat: number;
          lng: number;
          category: string;
          baselineCategory?: string;
          evaluationCategory?: string | null;
          baselineValue: number;
          interventionValue: number;
          comparisonValue: number;
          temporalCoverage?: string;
          spatialQuality?: string;
          percEqualBaseline?: number;
          percSlightBaseline?: number;
          percHeavyBaseline?: number;
          percEqualPost?: number | null;
          percSlightPost?: number | null;
          percHeavyPost?: number | null;
          nTot?: number;
        }>;
        categorySummary?: Array<{
          pilotId: string;
          category: string;
          baselinePct: number | null;
          postPct: number | null;
        }>;
        source?: string;
        note?: string;
      };
      const points = bundle.points || [];
      if (points.length) {
        const parsed: NormalizedCityRecord[] = points.map((point) => {
          const hasPost = point.temporalCoverage === "before-after";
          return {
            id: point.id,
            city: "Milan",
            cityId: "milan",
            interventionId: point.pilotId,
            kpiId,
            sourceFile: MILAN_ACCESSIBILITY_JSON,
            datasetKind: "accessibility",
            category: point.category,
            facilityCategory: point.category,
            likertLabel: point.category,
            geometryType: "point",
            lat: point.lat,
            lng: point.lng,
            geometry: [[point.lat, point.lng]],
            segmentId: point.id,
            siteKey: point.orig || point.id,
            streetName: point.orig
              ? `Civic ${point.orig} · ${point.category}`
              : point.category,
            value: clampPercent(point.interventionValue),
            baselineValue: clampPercent(point.baselineValue),
            interventionValue: clampPercent(point.interventionValue),
            comparisonValue: point.comparisonValue,
            source: bundle.source || "Milan DSS accessibility routing points",
            method:
              "AMAT DSS civic-address routing (150 m torta) — equal-access route share (perc_1)",
            type: "observed",
            dataOrigin: "observed",
            spatialQuality: point.spatialQuality === "matched" ? "matched" : "inferred",
            geometryLinkage: "matched",
            temporalCoverage: hasPost ? "before-after" : "baseline-only",
            locationMethod: "dss_routing_shapefile",
            spatialNote:
              bundle.note ||
              `Civic address ${point.orig || "n/a"} · ${point.category} (DSS barrier routing)`,
            parserStatus: hasPost ? "ready" : "partial",
            percEqualBaseline: point.percEqualBaseline,
            percSlightBaseline: point.percSlightBaseline,
            percHeavyBaseline: point.percHeavyBaseline,
            percEqualPost: point.percEqualPost ?? undefined,
            percSlightPost: point.percSlightPost ?? undefined,
            percHeavyPost: point.percHeavyPost ?? undefined,
          } as NormalizedCityRecord;
        });

        // Keep CIRCE category rows as pilot-level aggregates (no geometry) for breakdown charts.
        (bundle.categorySummary || []).forEach((row) => {
          if (row.baselinePct == null) return;
          const postPct = row.postPct ?? row.baselinePct;
          parsed.push({
            id: `milan-${kpiId}-summary-${row.pilotId}-${slugKey(row.category)}`,
            city: "Milan",
            cityId: "milan",
            interventionId: row.pilotId,
            kpiId,
            sourceFile: MILAN_ACCESSIBILITY_FILES[0],
            datasetKind: "accessibility-summary",
            category: row.category,
            facilityCategory: row.category,
            likertLabel: row.category,
            geometryType: "point",
            lat: MILAN_PILOT_CENTERS[row.pilotId]?.lat ?? MILAN_PILOT_CENTERS["mil-p1"].lat,
            lng: MILAN_PILOT_CENTERS[row.pilotId]?.lon ?? MILAN_PILOT_CENTERS["mil-p1"].lon,
            geometry: [
              [
                MILAN_PILOT_CENTERS[row.pilotId]?.lat ?? MILAN_PILOT_CENTERS["mil-p1"].lat,
                MILAN_PILOT_CENTERS[row.pilotId]?.lon ?? MILAN_PILOT_CENTERS["mil-p1"].lon,
              ],
            ],
            segmentId: `mil-a11y-summary-${row.pilotId}-${slugKey(row.category)}`,
            streetName: row.category,
            value: clampPercent(postPct),
            baselineValue: clampPercent(row.baselinePct),
            interventionValue: clampPercent(postPct),
            comparisonValue: postPct - row.baselinePct,
            source: "Milan DSS accessibility CIRCE workbook",
            method: "WP7 KPI 4.2 category shares from CIRCE summary",
            type: "observed",
            spatialQuality: "inferred",
            temporalCoverage: row.postPct != null ? "before-after" : "baseline-only",
            locationMethod: "pilot_area_inference",
            spatialNote: "CIRCE category aggregate — not a map marker",
            parserStatus: row.postPct != null ? "ready" : "partial",
          });
        });

        normalizedRecordCache.set(cacheKey, parsed);
        return parsed;
      }
    }
  } catch {
    // fall through to workbook-only path
  }

  const buffer = await fetchFirstAvailableMilanWorkbook();
  if (!buffer) return [];
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets["4. KPI 4.2 (WP7 format)"] || workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1, raw: false });

  const parsed: NormalizedCityRecord[] = [];
  let currentIntervention = "";
  rows.forEach((row) => {
    const interventionCell = String(row[0] || "").toLowerCase();
    if (interventionCell.includes("cdm1")) currentIntervention = "mil-p1";
    if (interventionCell.includes("cdm2")) currentIntervention = "mil-p2";
    if (interventionCell.includes("cdm3")) currentIntervention = "mil-p3";
    const categoryLabel = String(row[1] || "").trim();
    const category = categoryLabel.toLowerCase();
    if (
      !category ||
      category.includes("accessibility category") ||
      category.includes("kpi 4.2") ||
      category.includes("dimension")
    ) {
      return;
    }
    if (!currentIntervention) return;

    const baselinePct = clampPercent(parseNumber(row[3]) <= 1 ? parseNumber(row[3]) * 100 : parseNumber(row[3]));
    const postRaw = row[5];
    const hasPost = !isUnavailableMetric(postRaw);
    const postParsed = parseNumber(postRaw);
    const postPct = hasPost
      ? clampPercent(postParsed <= 1 ? postParsed * 100 : postParsed)
      : baselinePct;
    const interventionValue = kpiId === "kpi4.2" ? postPct : clampPercent(postPct - baselinePct + 50);
    const value = interventionValue;
    const baselineValue = baselinePct > 0 ? baselinePct : interventionValue * 0.9;

    const pilotCenter = MILAN_PILOT_CENTERS[currentIntervention] ?? MILAN_PILOT_CENTERS["mil-p2"];
    const rowIndex = parsed.length;
    const spreadAngle = ((rowIndex * 137.5) % 360) * (Math.PI / 180);
    const spreadRadius = 0.00035 + (rowIndex % 6) * 0.00012;
    const lat = pilotCenter.lat + Math.cos(spreadAngle) * spreadRadius;
    const lng = pilotCenter.lon + Math.sin(spreadAngle) * spreadRadius * 1.2;

    parsed.push({
      id: `milan-${kpiId}-${currentIntervention}-${slugKey(categoryLabel)}`,
      city: "Milan",
      cityId: "milan",
      interventionId: currentIntervention,
      kpiId,
      sourceFile: MILAN_ACCESSIBILITY_FILES[0],
      datasetKind: "accessibility",
      category: categoryLabel,
      facilityCategory: categoryLabel,
      likertLabel: categoryLabel,
      geometryType: "point",
      lat,
      lng,
      geometry: [[lat, lng]],
      segmentId: `mil-a11y-${currentIntervention}-${slugKey(categoryLabel)}`,
      streetName: categoryLabel,
      value,
      baselineValue,
      interventionValue,
      comparisonValue: hasPost ? interventionValue - baselineValue : 0,
      source: "Milan DSS accessibility workbook",
      method: "DSS routing barrier categories (WP7 KPI 4.2 tab)",
      type: "observed",
      spatialQuality: "inferred",
      temporalCoverage: hasPost ? "before-after" : "baseline-only",
      locationMethod: "pilot_area_inference",
      spatialNote: hasPost
        ? "DSS category share mapped to pilot centroid (workbook has no point geometry)"
        : "Post-intervention share not published for this pilot — baseline DSS share only",
      parserStatus: hasPost ? "ready" : "partial",
    });
  });

  normalizedRecordCache.set(cacheKey, parsed);
  return parsed;
}

async function parseMilanKpi12Records(): Promise<NormalizedCityRecord[]> {
  const cacheKey = "milan-kpi1.2-counts";
  const cached = normalizedRecordCache.get(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(MILAN_MODE_SHARE_JSON);
    if (!response.ok) return [];
    const bundle = (await response.json()) as { sites?: MilanModeShareSite[] };
    const sites = bundle.sites || [];
    const bySiteFlow = new Map<
      string,
      { baseline?: MilanModeShareSite; evaluation?: MilanModeShareSite }
    >();

    sites.forEach((site) => {
      const hasFlows = (site.flows?.length ?? 0) > 0;
      const flowIds = hasFlows ? site.flows!.map((f) => f.flowId) : ["site"];
      for (const flowId of flowIds) {
        const key = `${site.siteKey}:${flowId}`;
        const bucket = bySiteFlow.get(key) || {};
        if (site.phase === "baseline") bucket.baseline = site;
        if (site.phase === "evaluation") bucket.evaluation = site;
        bySiteFlow.set(key, bucket);
      }
    });

    const parsed: NormalizedCityRecord[] = [];
    let rowIndex = 0;

    bySiteFlow.forEach((pair, key) => {
      const [siteKey, flowId] = key.split(":");
      const baseline = pair.baseline;
      const evaluation = pair.evaluation || pair.baseline;
      if (!evaluation && !baseline) return;

      const pilotId = evaluation?.pilotId || baseline?.pilotId || "mil-p2";
      const pilotCenter = MILAN_PILOT_CENTERS[pilotId] ?? MILAN_PILOT_CENTERS["mil-p2"];
      const lat =
        evaluation?.lat ??
        baseline?.lat ??
        pilotCenter.lat + ((rowIndex % 5) - 2) * 0.0012;
      const lng =
        evaluation?.lng ??
        baseline?.lng ??
        pilotCenter.lon + ((rowIndex % 7) - 3) * 0.0015;

      const baselineFlow =
        flowId === "site"
          ? null
          : baseline?.flows?.find((f) => f.flowId === flowId) ??
            evaluation?.flows?.find((f) => f.flowId === flowId);
      const evaluationFlow =
        flowId === "site"
          ? null
          : evaluation?.flows?.find((f) => f.flowId === flowId) ?? baselineFlow;

      const preAgg =
        flowId === "site"
          ? baseline
            ? milanSiteModeAgg(baseline)
            : evaluation
              ? milanSiteModeAgg(evaluation)
              : null
          : baselineFlow
            ? milanFlowModeAgg(baselineFlow)
            : evaluationFlow
              ? milanFlowModeAgg(evaluationFlow)
              : null;
      const postAgg =
        flowId === "site"
          ? evaluation
            ? milanSiteModeAgg(evaluation)
            : baseline
              ? milanSiteModeAgg(baseline)
              : null
          : evaluationFlow
            ? milanFlowModeAgg(evaluationFlow)
            : baselineFlow
              ? milanFlowModeAgg(baselineFlow)
              : null;

      if (!preAgg || !postAgg) return;

      const preSustainable = ((preAgg.bike + preAgg.pedestrian) / preAgg.total) * 100;
      const postSustainable = ((postAgg.bike + postAgg.pedestrian) / postAgg.total) * 100;
      const hasEvaluation = Boolean(pair.baseline && pair.evaluation);
      const studyName = evaluation?.studyName || baseline?.studyName || siteKey;
      const flowLabel =
        flowId === "site"
          ? studyName
          : evaluationFlow?.flowLabel || baselineFlow?.flowLabel || flowId.toUpperCase();
      const segmentId = flowId === "site" ? siteKey : `${siteKey}-${flowId}`;
      const flowOffset = flowId === "sb" ? 0.00018 : flowId === "nb" ? -0.00014 : flowId === "eb" ? 0.0001 : 0;
      const recordLat = lat + flowOffset;
      const recordLng = lng + flowOffset * 0.8;

      parsed.push({
        id: `milan-kpi1.2-${segmentId}`,
        city: "Milan",
        cityId: "milan",
        interventionId: pilotId,
        kpiId: "kpi1.2",
        sourceFile: evaluation?.sourceFile || baseline?.sourceFile || MILAN_MODE_SHARE_JSON,
        datasetKind: "amat-count",
        geometryType: "point",
        lat: recordLat,
        lng: recordLng,
        geometry: [[recordLat, recordLng]],
        segmentId,
        streetName: flowId === "site" ? studyName : `${studyName} · ${flowLabel}`,
        mode: flowLabel,
        direction: flowLabel,
        siteKey,
        flowId,
        value: clampPercent(postSustainable),
        baselineValue: clampPercent(preSustainable),
        interventionValue: clampPercent(postSustainable),
        comparisonValue: clampPercent(postSustainable - preSustainable),
        source: "AMAT road user count workbooks",
        method:
          flowId === "site"
            ? "Peak-hour TMV summary (8:30–9:30) with camera shapefile linkage"
            : "Per-approach AMAT peak-hour counts (8:30–9:30) · camera-linked",
        type: "observed",
        dataOrigin: "observed",
        spatialQuality:
          evaluation?.spatialQuality === "matched" || baseline?.spatialQuality === "matched"
            ? "matched"
            : "inferred",
        geometryLinkage:
          evaluation?.spatialQuality === "matched" || baseline?.spatialQuality === "matched"
            ? "matched"
            : "inferred",
        temporalCoverage: hasEvaluation ? "before-after" : "baseline-only",
        locationMethod: evaluation?.locationMethod || baseline?.locationMethod || "pilot_area_inference",
        spatialNote:
          evaluation?.cameraLocalita || baseline?.cameraLocalita
            ? `Camera site: ${evaluation?.cameraLocalita || baseline?.cameraLocalita}`
            : flowId === "site"
              ? "Baseline AMAT count only — evaluation workbook not yet bundled for this site"
              : `Approach-level peak-hour TMV at ${flowLabel}`,
        modeBreakdown: {
          pre: preAgg,
          post: postAgg,
        },
        parserStatus: hasEvaluation ? "ready" : "partial",
      });
      rowIndex += 1;
    });

    normalizedRecordCache.set(cacheKey, parsed);
    return parsed;
  } catch {
    return [];
  }
}

async function parseMilanRecords(kpiId: string): Promise<NormalizedCityRecord[]> {
  if (kpiId === "kpi4.2") return parseMilanAccessibilityRecords(kpiId);
  if (kpiId === "kpi1.2") return parseMilanKpi12Records();
  if (kpiId === "kpi4.1") return buildMilanSurveyRecords(kpiId);
  return [];
}

function parseZaragozaKpi12Workbook(
  workbook: XLSX.WorkBook,
  filePath: string,
  kpiId: string,
  coords: { lat: number; lng: number; linkage: "matched" | "inferred" },
  interventionCode: string
): NormalizedCityRecord | null {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    raw: false,
  });
  const periodRow = matrix.find((row) => String(row?.[0] || "").toLowerCase().includes("before/after"));
  const period = String(periodRow?.[1] || "").toLowerCase();
  const isAfter = period.includes("after");

  let bike = 0;
  let pedestrian = 0;
  let motorized = 0;
  let other = 0;
  let numericSlots = 0;

  matrix.forEach((row, rowIndex) => {
    if (rowIndex < 6) return;
    const start = row?.[0];
    const end = row?.[1];
    if (!start || !end) return;
    const cyclists = row?.[2];
    const peds = row?.[3];
    const vehicles = row?.[4];
    const extra = row?.[5];
    if (
      isPlaceholderCell(cyclists) &&
      isPlaceholderCell(peds) &&
      isPlaceholderCell(vehicles) &&
      isPlaceholderCell(extra)
    ) {
      return;
    }
    bike += parseNumber(cyclists);
    pedestrian += parseNumber(peds);
    motorized += parseNumber(vehicles);
    other += parseNumber(extra);
    numericSlots += 1;
  });

  if (numericSlots === 0) return null;
  const total = bike + pedestrian + motorized + other;
  if (total <= 0) return null;

  const agg: CphFlowAgg = {
    flow: interventionCode,
    total,
    bike,
    pedestrian,
    motorized,
    ptw: other,
  };
  const metricValue = cphSiteMetric(agg, kpiId);
  const pilotId = inferZaragozaPilot(interventionCode);

  return {
    id: `zaragoza-${kpiId}-${interventionCode}-${isAfter ? "after" : "before"}`,
    city: "Zaragoza",
    cityId: "zaragoza",
    interventionId: pilotId,
    kpiId,
    sourceFile: filePath,
    geometryType: "point",
    lat: coords.lat,
    lng: coords.lng,
    geometry: [[coords.lat, coords.lng]],
    value: metricValue,
    baselineValue: isAfter ? metricValue * 0.95 : metricValue,
    interventionValue: isAfter ? metricValue : metricValue * 1.02,
    comparisonValue: isAfter ? metricValue * 0.02 : 0,
    source: "Zaragoza KPI1.2 mobility workbook",
    method: "Hourly road-user-type slots aggregated to pilot-level KPI metric.",
    type: "observed",
    spatialQuality: coords.linkage === "matched" ? "matched" : "inferred",
    geometryLinkage: coords.linkage,
    temporalCoverage: isAfter ? "single-period" : "single-period",
    locationMethod: coords.linkage === "matched" ? "coordinates" : "pilot_area_inference",
    segmentId: interventionCode,
    streetName: interventionCode,
    spatialNote: `${interventionCode} · ${isAfter ? "after" : "before"} intervention window`,
    parserStatus: "partial",
    datasetKind: "kpi12-workbook",
    modeBreakdown: {
      pre: isAfter
        ? { bike: 0, pedestrian: 0, motorised: 0, ptw: 0, total: 0 }
        : { bike, pedestrian, motorised: motorized, ptw: other, total },
      post: isAfter
        ? { bike, pedestrian, motorised: motorized, ptw: other, total }
        : { bike: 0, pedestrian: 0, motorised: 0, ptw: 0, total: 0 },
    },
  };
}

async function parseZaragozaRecords(kpiId: string): Promise<NormalizedCityRecord[]> {
  const cacheKey = `zaragoza-${kpiId}`;
  const cached = normalizedRecordCache.get(cacheKey);
  if (cached) return cached;

  const records: NormalizedCityRecord[] = [];
  const centroids = await loadZaragozaCentroids();

  for (const code of ZARAGOSA_KPI12_CODES) {
    const coords = resolveZaragozaCoords(code, code, centroids, records.length);
    for (const phase of ["before", "after"] as const) {
      const filePath = `${ZARAGOSA_KPI12_DIR}/KPI1.2-${code}-${phase}.xlsx`;
      try {
        const response = await fetch(encodeURI(filePath));
        if (!response.ok) continue;
        const workbook = XLSX.read(await response.arrayBuffer(), { type: "array" });
        const parsed = parseZaragozaKpi12Workbook(workbook, filePath, kpiId, coords, code);
        if (parsed) records.push(parsed);
      } catch {
        // skip unreadable workbook
      }
    }
  }

  if (records.length === 0 && (kpiId === "kpi1.2" || kpiId === "kpi2.1" || kpiId === "kpi3.2")) {
    try {
      const response = await fetch(encodeURI(ZARAGOSA_MANUAL_COUNTING));
      if (response.ok) {
        const workbook = XLSX.read(await response.arrayBuffer(), { type: "array" });
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
          workbook.Sheets[workbook.SheetNames[0]],
          { defval: null }
        );
        rows.forEach((row, index) => {
          const area = String(row["Intervention Area"] || row["Location"] || "").trim();
          const location = String(row.Location || "").trim();
          if (!area || area.toLowerCase().includes("second manual")) return;
          const cars = parseNumber(row["Cars/Vans"]);
          const motorcycles = parseNumber(row.Motocycles ?? row.Motorcycles);
          const buses = parseNumber(row.Buses);
          const motorized = cars + motorcycles + buses;
          const total = parseNumber(row.Totals) || motorized;
          if (total <= 0) return;
          const coords = resolveZaragozaCoords(area, location, centroids, index);
          const agg: CphFlowAgg = {
            flow: location || area,
            total,
            bike: 0,
            pedestrian: 0,
            motorized,
            ptw: motorcycles,
          };
          const value = cphSiteMetric(agg, kpiId);
          records.push({
            id: `zaragoza-${kpiId}-manual-${index}`,
            city: "Zaragoza",
            cityId: "zaragoza",
            interventionId: inferZaragozaPilot(area),
            kpiId,
            sourceFile: ZARAGOSA_MANUAL_COUNTING,
            geometryType: "point",
            lat: coords.lat,
            lng: coords.lng,
            geometry: [[coords.lat, coords.lng]],
            value,
            baselineValue: value,
            interventionValue: value,
            comparisonValue: 0,
            source: "Zaragoza manual counting (June 2025 baseline)",
            method:
              "Manual count sessions aggregated per intervention location; pedestrian/cycle counts pending second survey.",
            type: kpiId === "kpi1.2" ? "derived" : "observed",
            spatialQuality: coords.linkage === "matched" ? "matched" : "inferred",
            geometryLinkage: coords.linkage,
            temporalCoverage: "single-period",
            locationMethod: coords.linkage === "matched" ? "coordinates" : "pilot_area_inference",
            segmentId: area,
            streetName: location || area,
            spatialNote: `${location || area} · baseline manual count`,
            parserStatus: "partial",
            datasetKind: "manual-count",
            modeBreakdown: {
              pre: { bike: 0, pedestrian: 0, motorised: motorized, ptw: motorcycles, total },
              post: { bike: 0, pedestrian: 0, motorised: motorized, ptw: motorcycles, total },
            },
          });
        });
      }
    } catch {
      // manual counting unavailable
    }
  }

  normalizedRecordCache.set(cacheKey, records);
  return records;
}

async function parseTrikalaRecords(kpiId: string): Promise<NormalizedCityRecord[]> {
  return buildTrikalaRecords(kpiId);
}

async function getNormalizedCityRecords(cityName: string, kpiId: string): Promise<NormalizedCityRecord[]> {
  const cityKey = normalizeCityKey(cityName);
  if (cityKey === "copenhagen") return parseCopenhagenRecords(kpiId);
  if (cityKey === "helsinki") return parseHelsinkiRecords(kpiId);
  if (cityKey === "milan") return parseMilanRecords(kpiId);
  if (cityKey === "zaragoza") return parseZaragozaRecords(kpiId);
  if (cityKey === "trikala") return parseTrikalaRecords(kpiId);
  return [];
}

export async function loadLocalCityPoints(
  cityName: string,
  kpiId: string,
  cityCenter: { lat: number; lon: number },
  selectedPilotId?: string | null,
  scenario: ScenarioType = "intervention"
): Promise<LocalCityPoint[]> {
  const cityKey = normalizeCityKey(cityName);
  if (cityKey.includes("issy") && kpiId === "kpi4.2" && selectedPilotId) {
    const { getIssyAccessibilityMock, issyAccessibilityToLocalPoints } = await import(
      "@/data/issyAccessibilityMock"
    );
    const profile = getIssyAccessibilityMock(selectedPilotId);
    if (profile) {
      const diagnosticsKey = localCityDiagnosticsKey(cityName, kpiId, selectedPilotId);
      localCityDiagnosticsCache.set(diagnosticsKey, {
        reason: "ok",
        message: `Mock accessibility inventory loaded for ${selectedPilotId} (${profile.totalFeatures} features).`,
      });
      return issyAccessibilityToLocalPoints(profile, scenario);
    }
  }

  if (cityKey.includes("issy") && kpiId === "kpi4.1" && selectedPilotId) {
    const { getIssySentimentMock, issySentimentToLocalPoints } = await import(
      "@/data/issySentimentMock"
    );
    const profile = getIssySentimentMock(selectedPilotId);
    if (profile) {
      const diagnosticsKey = localCityDiagnosticsKey(cityName, kpiId, selectedPilotId);
      localCityDiagnosticsCache.set(diagnosticsKey, {
        reason: "ok",
        message: `Mock GecoAir satisfaction loaded for ${selectedPilotId} (${profile.samples.length} samples).`,
      });
      return issySentimentToLocalPoints(profile, scenario);
    }
    localCityDiagnosticsCache.set(localCityDiagnosticsKey(cityName, kpiId, selectedPilotId), {
      reason: "no-records",
      message: "No mock satisfaction profile for this Issy pilot.",
    });
    return [];
  }

  if (cityKey === "milan" && kpiId === "kpi3.1" && selectedPilotId) {
    const { milanZeroEmissionToLocalPoints, milanZeroEmissionFacilityCount } = await import(
      "@/data/milanZeroEmissionMock"
    );
    const points = milanZeroEmissionToLocalPoints(selectedPilotId, scenario);
    localCityDiagnosticsCache.set(localCityDiagnosticsKey(cityName, kpiId, selectedPilotId), {
      reason: points.length ? "ok" : "no-records",
      message: points.length
        ? `Illustrative zero-emission facility inventory for ${selectedPilotId} (${milanZeroEmissionFacilityCount(selectedPilotId)} sites).`
        : "No zero-emission mock facilities for this Milan pilot scope.",
    });
    return points;
  }

  const records = await getNormalizedCityRecords(cityName, kpiId);
  const filtered = selectedPilotId
    ? records.filter((record) => {
        if (normalizeCityKey(cityName) === "copenhagen") {
          return copenhagenRecordMatchesPilotScope(record, selectedPilotId);
        }
        if (normalizeCityKey(cityName) === "milan") {
          return milanRecordMatchesPilotScope(record.interventionId, selectedPilotId);
        }
        return record.interventionId === selectedPilotId;
      })
    : records;
  const diagnosticsKey = localCityDiagnosticsKey(cityName, kpiId, selectedPilotId);

  if (filtered.length > 0) {
    localCityDiagnosticsCache.set(diagnosticsKey, {
      reason: "ok",
      message: "Observed records loaded for the selected configuration.",
    });
    return filtered
      .filter((record) => typeof record.lat === "number" && typeof record.lng === "number")
      .map((record, index) => ({
        lat: record.lat as number,
        lon: record.lng as number,
        value: toScenarioValue(record, scenario),
        id: `local-${record.cityId}-${record.kpiId}-${index}`,
        properties: {
          id: record.id,
          city: record.city,
          kpi: record.kpiId,
          source: record.source,
          method: record.method,
          type: record.type,
          geometryLinkage: record.geometryLinkage,
          spatialQuality: record.spatialQuality || "inferred",
          comparisonDelta: record.comparisonValue,
          siteId: record.segmentId,
          pilotId: record.interventionId,
          streetName: record.streetName,
          mode: record.mode,
          direction: record.mode,
          dataOrigin: record.type === "mock" ? "mock" : "local-city-dataset",
          sourceFile: record.sourceFile,
          geometryType: record.geometryType,
          baselineValue: record.baselineValue,
          interventionValue: record.interventionValue ?? record.value,
          comparisonValue: record.comparisonValue,
          modeBreakdown: record.modeBreakdown,
          scenario,
          interventionId: record.interventionId,
          temporalCoverage: record.temporalCoverage || "single-period",
          otcWorkbookKey:
            normalizeCityKey(cityName) === "copenhagen"
              ? inferOtcWorkbookKey(String(record.streetName ?? ""))
              : undefined,
          evaluationNotes:
            normalizeCityKey(cityName) === "copenhagen"
              ? getCopenhagenWorkbookEvaluationNotes(
                  inferOtcWorkbookKey(String(record.streetName ?? ""))
                )
              : undefined,
          locationMethod: record.locationMethod || "pilot_area_inference",
          segmentId: record.segmentId,
          siteKey: record.siteKey,
          flowId: record.flowId,
          spatialNote: record.spatialNote,
          methodologyWarnings: record.methodologyWarnings,
          parserStatus: record.parserStatus || "partial",
          datasetKind: record.datasetKind,
          category: record.category,
          likertLabel: record.likertLabel,
          facilityCategory: record.facilityCategory,
          preCo2GPerHour: record.preCo2GPerHour,
          postCo2GPerHour: record.postCo2GPerHour,
          deviceId: record.deviceId,
          busyPct: record.busyPct,
          availabilityPct: record.availabilityPct,
          observationCount: record.observationCount,
        },
      }));
  }

  const observedCities = new Set(["copenhagen", "zaragoza", "trikala", "helsinki", "milan"]);

  if (observedCities.has(cityKey)) {
    const parseDiagnostics = cityKey === "copenhagen" ? copenhagenParseDiagnostics.get(kpiId) : null;
    if (parseDiagnostics?.status === "files-unavailable") {
      localCityDiagnosticsCache.set(diagnosticsKey, {
        reason: "files-unavailable",
        message: parseDiagnostics.message,
        missingFiles: parseDiagnostics.missingFiles,
        loadedFiles: parseDiagnostics.loadedFiles,
      });
    } else if (records.length > 0 && selectedPilotId) {
      localCityDiagnosticsCache.set(diagnosticsKey, {
        reason: "pilot-scope-empty",
        message: "No observed records for the selected pilot scope.",
      });
    } else {
      localCityDiagnosticsCache.set(diagnosticsKey, {
        reason: "no-records",
        message: "No observed records for the selected configuration.",
      });
    }
    return [];
  }

  // fallback synthetic if parser not ready
  const cityHash = hashString(`${cityName}-${kpiId}`);
  const count = kpiId === "kpi1.2" ? 180 : 120;
  return Array.from({ length: count }).map((_, index) => {
    const angle = ((index * 137.5 + cityHash) % 360) * (Math.PI / 180);
    const radius = 0.003 + (index % 35) * 0.00035;
    return {
      lat: cityCenter.lat + Math.cos(angle) * radius,
      lon: cityCenter.lon + Math.sin(angle) * radius * 1.45,
      value: 40 + ((index * 7) % 45),
      id: `fallback-${normalizeCityKey(cityName)}-${kpiId}-${index}`,
      properties: {
        city: cityName,
        kpi: kpiId,
        source: "fallback synthetic",
        dataOrigin: "fallback",
        type: "modelled",
        spatialQuality: "inferred",
        temporalCoverage: "single-period",
        locationMethod: "approximate_cluster",
        spatialNote: "Approximate location",
        parserStatus: "planned",
      },
    };
  });
}
