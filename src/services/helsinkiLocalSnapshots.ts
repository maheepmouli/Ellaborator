import {
  HELSINKI_CONFLICTS_GEOJSON,
  HELSINKI_DANGEROUS_LOCATIONS_GEOJSON,
  HELSINKI_DANGEROUS_LOCATIONS_SURVEY_INSIGHTS_JSON,
  HELSINKI_ESCOOTER_OBSERVATIONS_GEOJSON,
  HELSINKI_EVIDENCE_MANIFEST_JSON,
  HELSINKI_HSL_TRAM15_SAMPLE_JSON,
  HELSINKI_INNOTRAFIK_ALARM_SUMMARY_JSON,
  HELSINKI_INTERVENTION_LOCATIONS_GEOJSON,
  HELSINKI_MOBILYSIS_VIIKKI_GATES_JSON,
  HELSINKI_TELRAAM_KOETILANTIE_JSON,
  HELSINKI_TELRAAM_SENSORS_JSON,
  HELSINKI_VIIKKI_UX_SURVEY_JSON,
  type HelsinkiDangerousLocationsSurveyInsights,
  type HelsinkiEvidenceManifest,
  type HelsinkiHslTram15Sample,
  type HelsinkiInnotrafikAlarmSummary,
  type HelsinkiMobilysisGates,
  type HelsinkiTelraamKoetilantie,
  type HelsinkiTelraamSensorsBundle,
  type HelsinkiUxSurvey,
} from "@/lib/helsinkiDataPaths";
import type { HelsinkiInterventionLocationsGeoJson } from "@/services/staticGeoData";

const SP_MIRROR = "/sharepoint-data/Helsinki";

const cache = new Map<string, unknown>();

async function fetchFirstOk<T>(urls: readonly string[]): Promise<T | null> {
  for (const url of urls) {
    const cached = cache.get(url);
    if (cached !== undefined) return cached as T | null;
    try {
      const response = await fetch(encodeURI(url));
      if (!response.ok) continue;
      const data = (await response.json()) as T;
      cache.set(url, data);
      return data;
    } catch {
      /* try next mirror */
    }
  }
  cache.set(urls[0], null);
  return null;
}

async function fetchGeoJson<T>(urls: readonly string[]): Promise<T | null> {
  return fetchFirstOk<T>(urls);
}

function withMirror(primary: string): readonly string[] {
  const file = primary.split("/").pop();
  if (!file) return [primary];
  return [primary, `${SP_MIRROR}/${file}`];
}

export async function loadHelsinkiTelraamSnapshot(): Promise<HelsinkiTelraamKoetilantie | null> {
  return fetchFirstOk<HelsinkiTelraamKoetilantie>(withMirror(HELSINKI_TELRAAM_KOETILANTIE_JSON));
}

export async function loadHelsinkiTelraamSensorsSnapshot(): Promise<HelsinkiTelraamSensorsBundle | null> {
  return fetchFirstOk<HelsinkiTelraamSensorsBundle>(withMirror(HELSINKI_TELRAAM_SENSORS_JSON));
}

export async function loadHelsinkiMobilysisSnapshot(): Promise<HelsinkiMobilysisGates | null> {
  return fetchFirstOk<HelsinkiMobilysisGates>(withMirror(HELSINKI_MOBILYSIS_VIIKKI_GATES_JSON));
}

export async function loadHelsinkiUxSurveySnapshot(): Promise<HelsinkiUxSurvey | null> {
  return fetchFirstOk<HelsinkiUxSurvey>(withMirror(HELSINKI_VIIKKI_UX_SURVEY_JSON));
}

export async function loadHelsinkiHslTramSnapshot(): Promise<HelsinkiHslTram15Sample | null> {
  return fetchFirstOk<HelsinkiHslTram15Sample>(withMirror(HELSINKI_HSL_TRAM15_SAMPLE_JSON));
}

export async function loadHelsinkiInnotrafikSummarySnapshot(): Promise<HelsinkiInnotrafikAlarmSummary | null> {
  return fetchFirstOk<HelsinkiInnotrafikAlarmSummary>(withMirror(HELSINKI_INNOTRAFIK_ALARM_SUMMARY_JSON));
}

export async function loadHelsinkiSafetyAttitudeSnapshot(): Promise<HelsinkiDangerousLocationsSurveyInsights | null> {
  return fetchFirstOk<HelsinkiDangerousLocationsSurveyInsights>(
    withMirror(HELSINKI_DANGEROUS_LOCATIONS_SURVEY_INSIGHTS_JSON)
  );
}

export async function loadHelsinkiEvidenceManifestSnapshot(): Promise<HelsinkiEvidenceManifest | null> {
  return fetchFirstOk<HelsinkiEvidenceManifest>(withMirror(HELSINKI_EVIDENCE_MANIFEST_JSON));
}

export async function loadHelsinkiInterventionLocationsSnapshot(): Promise<HelsinkiInterventionLocationsGeoJson | null> {
  return fetchGeoJson<HelsinkiInterventionLocationsGeoJson>(
    withMirror(HELSINKI_INTERVENTION_LOCATIONS_GEOJSON)
  );
}

export async function loadHelsinkiDangerousLocationsSnapshot(): Promise<GeoJSON.FeatureCollection | null> {
  return fetchGeoJson<GeoJSON.FeatureCollection>(withMirror(HELSINKI_DANGEROUS_LOCATIONS_GEOJSON));
}

export async function loadHelsinkiConflictsSnapshot(): Promise<GeoJSON.FeatureCollection | null> {
  return fetchGeoJson<GeoJSON.FeatureCollection>(withMirror(HELSINKI_CONFLICTS_GEOJSON));
}

export async function loadHelsinkiEscooterObservationsSnapshot(): Promise<GeoJSON.FeatureCollection | null> {
  return fetchGeoJson<GeoJSON.FeatureCollection>(withMirror(HELSINKI_ESCOOTER_OBSERVATIONS_GEOJSON));
}

export function clearHelsinkiLocalSnapshotCache(): void {
  cache.clear();
}
