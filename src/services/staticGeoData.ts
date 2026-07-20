import {
  HELSINKI_CONFLICTS_GEOJSON,
  HELSINKI_DANGEROUS_LOCATIONS_GEOJSON,
  HELSINKI_ESCOOTER_OBSERVATIONS_GEOJSON,
  HELSINKI_INTERVENTION_LOCATIONS_GEOJSON,
} from "@/lib/helsinkiDataPaths";

type JsonObject = Record<string, unknown>;

interface GeoJsonFeatureCollection<TProps extends JsonObject, TGeometry extends string> {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: TProps;
    geometry: {
      type: TGeometry;
      coordinates: unknown;
    };
  }>;
}

export interface CopenhagenCountSiteProperties {
  name: string;
  source: "otc" | "manual" | string;
}

export interface HelsinkiInterventionLocationProperties {
  pilotId?: string;
  name?: string;
}

export interface HelsinkiDangerousLocationProperties {
  layer?: string;
  status?: string;
  locationType?: string;
  greatestDangerTo?: string;
  submitted?: string;
}

export interface HelsinkiConflictProperties {
  layer?: string;
  status?: string;
  incidentType?: string;
  travelMode?: string;
  eventDescription?: string;
  locationDescription?: string;
  submitted?: string;
}

export interface HelsinkiEscooterObservationProperties {
  category?: string;
  vehicleCount?: number | null;
  obstructsOthers?: string | null;
  hazardToOthers?: string | null;
  submittedAt?: string | null;
}

export interface ZaragozaInterventionAreaProperties {
  pilotId: string;
  source_file?: string;
}

export type CopenhagenCountSitesGeoJson = GeoJsonFeatureCollection<
  CopenhagenCountSiteProperties,
  "Point"
>;
export type HelsinkiInterventionLocationsGeoJson = GeoJsonFeatureCollection<
  HelsinkiInterventionLocationProperties,
  "Point" | "Polygon" | "MultiPolygon"
>;
export type HelsinkiDangerousLocationsGeoJson = GeoJsonFeatureCollection<
  HelsinkiDangerousLocationProperties,
  "Point"
>;
export type HelsinkiConflictsGeoJson = GeoJsonFeatureCollection<
  HelsinkiConflictProperties,
  "Point"
>;
export type HelsinkiEscooterObservationsGeoJson = GeoJsonFeatureCollection<
  HelsinkiEscooterObservationProperties,
  "Point"
>;
export type ZaragozaInterventionAreasGeoJson = GeoJsonFeatureCollection<
  ZaragozaInterventionAreaProperties,
  "Polygon" | "MultiPolygon"
>;

const promiseCache = new Map<string, Promise<unknown>>();

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null;
}

function isPointCoordinates(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === "number" &&
    Number.isFinite(value[0]) &&
    typeof value[1] === "number" &&
    Number.isFinite(value[1])
  );
}

function isPointFeature<TProps extends JsonObject>(
  value: unknown,
  propertyGuard: (value: unknown) => value is TProps
): value is { type: "Feature"; properties: TProps; geometry: { type: "Point"; coordinates: [number, number] } } {
  if (!isObject(value) || value.type !== "Feature" || !isObject(value.geometry)) return false;
  if (value.geometry.type !== "Point" || !isPointCoordinates(value.geometry.coordinates)) return false;
  return propertyGuard(value.properties);
}

function isPolygonCoordinates(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  return value.every(
    (ring) =>
      Array.isArray(ring) &&
      ring.every(
        (coord) =>
          Array.isArray(coord) &&
          coord.length >= 2 &&
          typeof coord[0] === "number" &&
          Number.isFinite(coord[0]) &&
          typeof coord[1] === "number" &&
          Number.isFinite(coord[1])
      )
  );
}

function isMultiPolygonCoordinates(value: unknown): boolean {
  return Array.isArray(value) && value.every((polygon) => isPolygonCoordinates(polygon));
}

function isPolygonFeature<TProps extends JsonObject>(
  value: unknown,
  propertyGuard: (value: unknown) => value is TProps
): value is {
  type: "Feature";
  properties: TProps;
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: unknown };
} {
  if (!isObject(value) || value.type !== "Feature" || !isObject(value.geometry)) return false;
  if (value.geometry.type === "Polygon" && !isPolygonCoordinates(value.geometry.coordinates)) return false;
  if (value.geometry.type === "MultiPolygon" && !isMultiPolygonCoordinates(value.geometry.coordinates))
    return false;
  if (value.geometry.type !== "Polygon" && value.geometry.type !== "MultiPolygon") return false;
  return propertyGuard(value.properties);
}

function isHelsinkiInterventionFeature(
  value: unknown
): value is {
  type: "Feature";
  properties: HelsinkiInterventionLocationProperties;
  geometry: {
    type: "Point" | "Polygon" | "MultiPolygon";
    coordinates: unknown;
  };
} {
  return (
    isPointFeature(value, isHelsinkiInterventionProperties) ||
    isPolygonFeature(value, isHelsinkiInterventionProperties)
  );
}

function isFeatureCollection<TFeature>(
  value: unknown,
  featureGuard: (feature: unknown) => feature is TFeature
): value is { type: "FeatureCollection"; features: TFeature[] } {
  return (
    isObject(value) &&
    value.type === "FeatureCollection" &&
    Array.isArray(value.features) &&
    value.features.every((feature) => featureGuard(feature))
  );
}

function fetchJsonWithCache<T>(url: string, parser: (value: unknown) => T): Promise<T> {
  const cached = promiseCache.get(url);
  if (cached) return cached as Promise<T>;

  const request = fetch(url)
    .then((response) => {
      if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
      return response.json();
    })
    .then((json) => parser(json));

  promiseCache.set(url, request);
  return request;
}

function emptyCollection<TProps extends JsonObject, TGeometry extends string>(): GeoJsonFeatureCollection<TProps, TGeometry> {
  return { type: "FeatureCollection", features: [] };
}

const copenhagenUrl = "/data/copenhagen_count_sites.geojson";
const helsinkiInterventionsUrl = HELSINKI_INTERVENTION_LOCATIONS_GEOJSON;
const helsinkiDangerousUrl = HELSINKI_DANGEROUS_LOCATIONS_GEOJSON;
const helsinkiConflictsUrl = HELSINKI_CONFLICTS_GEOJSON;
const helsinkiEscooterUrl = HELSINKI_ESCOOTER_OBSERVATIONS_GEOJSON;
const zaragozaAreasUrl = "/data/zaragoza_intervention_areas.geojson";

function isCopenhagenProperties(value: unknown): value is CopenhagenCountSiteProperties {
  return isObject(value) && typeof value.name === "string" && typeof value.source === "string";
}

function isHelsinkiInterventionProperties(value: unknown): value is HelsinkiInterventionLocationProperties {
  if (!isObject(value)) return false;
  return (
    (typeof value.pilotId === "string" || typeof value.pilotId === "undefined") &&
    (typeof value.name === "string" || typeof value.name === "undefined")
  );
}

function isHelsinkiDangerousProperties(value: unknown): value is HelsinkiDangerousLocationProperties {
  if (!isObject(value)) return false;
  return (
    (typeof value.layer === "string" || typeof value.layer === "undefined") &&
    (typeof value.status === "string" || typeof value.status === "undefined")
  );
}

function isZaragozaProperties(value: unknown): value is ZaragozaInterventionAreaProperties {
  return isObject(value) && typeof value.pilotId === "string";
}

function isHelsinkiConflictProperties(value: unknown): value is HelsinkiConflictProperties {
  return isObject(value);
}

function isHelsinkiEscooterProperties(value: unknown): value is HelsinkiEscooterObservationProperties {
  return isObject(value);
}

export async function loadCopenhagenCountSitesGeoJson(): Promise<CopenhagenCountSitesGeoJson> {
  try {
    return await fetchJsonWithCache(copenhagenUrl, (json) => {
      if (!isFeatureCollection(json, (feature) => isPointFeature(feature, isCopenhagenProperties))) {
        throw new Error("Invalid Copenhagen count sites GeoJSON");
      }
      return json;
    });
  } catch {
    return emptyCollection<CopenhagenCountSiteProperties, "Point">();
  }
}

export async function loadHelsinkiInterventionLocationsGeoJson(): Promise<HelsinkiInterventionLocationsGeoJson> {
  try {
    return await fetchJsonWithCache(helsinkiInterventionsUrl, (json) => {
      if (!isFeatureCollection(json, isHelsinkiInterventionFeature)) {
        throw new Error("Invalid Helsinki intervention locations GeoJSON");
      }
      return json;
    });
  } catch {
    return emptyCollection<HelsinkiInterventionLocationProperties, "Point" | "Polygon" | "MultiPolygon">();
  }
}

export async function loadHelsinkiDangerousLocationsGeoJson(): Promise<HelsinkiDangerousLocationsGeoJson> {
  try {
    return await fetchJsonWithCache(helsinkiDangerousUrl, (json) => {
      if (!isFeatureCollection(json, (feature) => isPointFeature(feature, isHelsinkiDangerousProperties))) {
        throw new Error("Invalid Helsinki dangerous locations GeoJSON");
      }
      return json;
    });
  } catch {
    return emptyCollection<HelsinkiDangerousLocationProperties, "Point">();
  }
}

export async function loadHelsinkiConflictsGeoJson(): Promise<HelsinkiConflictsGeoJson> {
  try {
    return await fetchJsonWithCache(helsinkiConflictsUrl, (json) => {
      if (!isFeatureCollection(json, (feature) => isPointFeature(feature, isHelsinkiConflictProperties))) {
        throw new Error("Invalid Helsinki conflicts GeoJSON");
      }
      return json;
    });
  } catch {
    return emptyCollection<HelsinkiConflictProperties, "Point">();
  }
}

export async function loadHelsinkiEscooterObservationsGeoJson(): Promise<HelsinkiEscooterObservationsGeoJson> {
  try {
    return await fetchJsonWithCache(helsinkiEscooterUrl, (json) => {
      if (!isFeatureCollection(json, (feature) => isPointFeature(feature, isHelsinkiEscooterProperties))) {
        throw new Error("Invalid Helsinki eScooter observations GeoJSON");
      }
      return json;
    });
  } catch {
    return emptyCollection<HelsinkiEscooterObservationProperties, "Point">();
  }
}

export async function loadZaragozaInterventionAreasGeoJson(): Promise<ZaragozaInterventionAreasGeoJson> {
  try {
    return await fetchJsonWithCache(zaragozaAreasUrl, (json) => {
      if (!isFeatureCollection(json, (feature) => isPolygonFeature(feature, isZaragozaProperties))) {
        throw new Error("Invalid Zaragoza intervention areas GeoJSON");
      }
      return json;
    });
  } catch {
    return emptyCollection<ZaragozaInterventionAreaProperties, "Polygon" | "MultiPolygon">();
  }
}
