/** Committed Helsinki Lighthouse data package (built by scripts/build-helsinki-data.mjs). */

export const HELSINKI_DATA_ROOT = "/data/helsinki";

export const HELSINKI_INTERVENTION_LOCATIONS_GEOJSON = `${HELSINKI_DATA_ROOT}/intervention-locations.geojson`;
export const HELSINKI_DANGEROUS_LOCATIONS_GEOJSON = `${HELSINKI_DATA_ROOT}/dangerous-locations.geojson`;
export const HELSINKI_CONFLICTS_GEOJSON = `${HELSINKI_DATA_ROOT}/conflicts.geojson`;
export const HELSINKI_ESCOOTER_OBSERVATIONS_GEOJSON = `${HELSINKI_DATA_ROOT}/escooter-observations.geojson`;

export const HELSINKI_TELRAAM_KOETILANTIE_JSON = `${HELSINKI_DATA_ROOT}/telraam-koetilantie.json`;
export const HELSINKI_TELRAAM_SENSORS_JSON = `${HELSINKI_DATA_ROOT}/telraam-sensors.json`;
export const HELSINKI_VIIKKI_UX_SURVEY_JSON = `${HELSINKI_DATA_ROOT}/viikki-ux-survey.json`;
export const HELSINKI_MOBILYSIS_VIIKKI_GATES_JSON = `${HELSINKI_DATA_ROOT}/mobilysis-viikki-gates.json`;
export const HELSINKI_HSL_TRAM15_SAMPLE_JSON = `${HELSINKI_DATA_ROOT}/hsl-tram15-sample.json`;
export const HELSINKI_INNOTRAFIK_ALARM_SUMMARY_JSON = `${HELSINKI_DATA_ROOT}/innotrafik-alarm-summary.json`;
export const HELSINKI_DANGEROUS_LOCATIONS_SURVEY_INSIGHTS_JSON = `${HELSINKI_DATA_ROOT}/dangerous-locations-survey-insights.json`;
export const HELSINKI_EVIDENCE_MANIFEST_JSON = `${HELSINKI_DATA_ROOT}/evidence-manifest.json`;

/** Fixed Viikintie-Koetilantie tramway crossing anchor (FVH3). */
export const HELSINKI_VIIKKI_ANCHOR = { lat: 60.224599, lng: 25.017236 } as const;
/** Kallio summer-streets e-scooter observation site anchor (FVH2). */
export const HELSINKI_KALLIO_ANCHOR = { lat: 60.184, lng: 24.951 } as const;

export interface HelsinkiTelraamDaily {
  date: string;
  pedestrian: number;
  bike: number;
  car: number;
  heavy: number;
  total: number;
  v85SpeedKmh: number | null;
}

export interface HelsinkiTelraamKoetilantie {
  sensorId: string;
  street: string;
  city: string;
  location: { lat: number; lng: number; note: string };
  periodStart: string | null;
  periodEnd: string | null;
  totals: { pedestrian: number; bike: number; car: number; heavy: number; all: number };
  modeShare: { pedestrianPct: number; bikePct: number; carPct: number; heavyPct: number };
  v85SpeedKmh: number | null;
  dailyAggregates: HelsinkiTelraamDaily[];
  source: string;
}

/** Per-workbook Telraam sensor stats (merged aggregate remains in telraam-koetilantie.json). */
export interface HelsinkiTelraamSensorRecord extends HelsinkiTelraamKoetilantie {
  sourceFile: string;
}

export interface HelsinkiTelraamSensorsBundle {
  merged: HelsinkiTelraamKoetilantie;
  sensors: HelsinkiTelraamSensorRecord[];
  note: string;
}

export interface HelsinkiUxSurvey {
  location: string;
  totalResponses: number;
  kpi41Target: number;
  overallSatisfiedPct: number;
  meetsKpi41Target: boolean | null;
  satisfactionByQuestion: { question: string; satisfiedPct: number | null }[];
  noticedWarningSystemPct: { signs: number | null; sound: number | null; lights: number | null };
  feltCrossingUnsafeBeforePct: number | null;
  accessibilityChallengePct: number | null;
  source: string;
}

export interface HelsinkiMobilysisGates {
  location: string;
  coordinates: { lat: number; lng: number };
  gateObservations: { mode: string; gate: string; totalCount: number; windows: number }[];
  modeTotals: Record<string, number>;
  note: string;
  source: string;
}

export interface HelsinkiDangerousLocationsSurveyInsights {
  title: string;
  totalRespondents: number;
  answeredGeneralSafetyQuestion: number;
  ratesTrafficSafetyPositivelyPct: number | null;
  ratesTrafficSafetyNegativelyPct: number | null;
  note: string;
  source: string;
}

export interface HelsinkiHslTram15Sample {
  line: string;
  sampleDate: string;
  source: string;
  totalPings: number;
  vehicleCount: number;
  hourlyPresence: { hour: number; pings: number; vehicles: number }[];
  corridorSample: GeoJSON.Feature<GeoJSON.LineString, { vehicleId: number; journeyId: number; pointCount: number }>;
  note: string;
}

export interface HelsinkiInnotrafikAlarmPeriod {
  label: string;
  startDate: string;
  endDate: string;
  /** Relative alarm intensity 0–100 when raw events unavailable (chart-derived proxy). */
  relativeIntensity: number | null;
  chartPath: string | null;
}

export interface HelsinkiInnotrafikAlarmSummary {
  location: string;
  coordinates: { lat: number; lng: number };
  periods: HelsinkiInnotrafikAlarmPeriod[];
  weekdayMinutePeaks: { weekday: string; minuteOfDay: number; relativeIntensity: number }[];
  medianDurationSec: number | null;
  note: string;
  source: string;
}

export interface HelsinkiEvidenceManifest {
  generatedAt: string;
  pilots: Record<string, { label: string; delivered: string[]; pending: string[] }>;
  media: { innotrafik: string[] };
  lidarSample: { sensorModel: string | null; serialNumber: string | null; note: string } | null;
  documentReferences: string[];
  extraction: unknown;
}

const jsonCache = new Map<string, Promise<unknown>>();

export function fetchHelsinkiJson<T>(url: string): Promise<T | null> {
  const cached = jsonCache.get(url);
  if (cached) return cached as Promise<T | null>;
  const request = fetch(encodeURI(url))
    .then((response) => (response.ok ? (response.json() as Promise<T>) : null))
    .catch(() => null);
  jsonCache.set(url, request);
  return request as Promise<T | null>;
}
