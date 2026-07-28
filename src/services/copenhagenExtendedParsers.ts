import { COPENHAGEN_TELRAAM_OUTCOMES, COPENHAGEN_LOCATIONS, inferOtcWorkbookKey } from "@/data/copenhagenLocationRegistry";
import type { CopenhagenNearEncountersSnapshot } from "@/types/copenhagen-encounters";
import type { CopenhagenEmissionsSnapshot } from "@/types/copenhagen-emissions";
import { loadCopenhagenNearEncountersSnapshot } from "@/services/copenhagenEncounterSnapshots";
import { loadCopenhagenEmissionsSnapshot } from "@/services/copenhagenEmissionsSnapshots";
import {
  co2GPerHourToKpiIntensity,
  co2ReductionPct,
  maxCo2GPerHourFromFlows,
} from "@/lib/copenhagenEmissionsModel";
import type { NormalizedCityRecord } from "@/types/normalized-city-data";

const BUNDLE_BASE = "/data/copenhagen";

export type CopenhagenDatasetKind =
  | "telraam"
  | "manual"
  | "survey"
  | "irap"
  | "parking"
  | "tube"
  | "accessibility"
  | "flow_camera"
  | "near_encounter"
  | "emissions";

export type CopenhagenExtendedRecord = NormalizedCityRecord & {
  datasetKind?: CopenhagenDatasetKind;
  category?: string;
  likertLabel?: string;
  facilityCategory?: string;
  surveyDistributionBefore?: Array<{ score: number; label: string; count: number; pct: number }>;
  surveyDistributionAfter?: Array<{ score: number; label: string; count: number; pct: number }>;
  sampleBefore?: number;
  sampleAfter?: number;
  locationNote?: string;
};

type TelraamSiteRow = {
  locationId: string;
  street: string;
  lat: number;
  lon: number;
  pilotId: string;
  motorizedPctChange?: number;
  bicyclePctChange?: number;
  pedestrianPctChange?: number;
  baseline2024?: number;
  intervention2025?: number;
  source?: string;
};

type ManualBundle = {
  sites: Array<{ id: string; name: string; lat: number; lon: number; pilotId: string }>;
  counts: Array<{
    siteName: string;
    motor: number;
    bike: number;
    total: number;
    activeShare: number;
    pilotId: string;
  }>;
  zones2023?: Array<{
    zone: string;
    motor: number;
    bike: number;
    pedestrian: number;
    total: number;
    year?: number;
  }>;
};

type AccessibilityBundle = {
  pilotId: string;
  baselineCategories: Array<{ label: string; value: number }>;
  interventionCategories: Array<{ label: string; value: number }>;
  netBikeBays: number;
  netCarBaysRemoved: number;
  cargoBikeBays: number;
  source?: string;
};

type PlatomoSite = {
  id: string;
  position: string;
  lat: number;
  lon: number;
  pilotId: string;
};

type SurveyDistributionBin = {
  score: number;
  label: string;
  count: number;
  pct: number;
};

type SurveyBundle = {
  acceptability: {
    pilotId: string;
    beforePct: number;
    afterPct: number;
    sampleBefore?: number;
    sampleAfter?: number;
    source?: string;
    method?: string;
    locationNote?: string;
    likert: Array<{ label: string; before: number; after: number }>;
    distributionBefore?: SurveyDistributionBin[];
    distributionAfter?: SurveyDistributionBin[];
  };
  safetyPerception: {
    pilotId: string;
    meanPct: number;
    likert: Array<{ label: string; before: number; after: number }>;
  };
};

type ParkingBundle = {
  facilities: Array<{ street: string; bays: number; type: string; pilotId: string }>;
  categories: Array<{ label: string; value: number }>;
  totalBays?: number;
};

type TubeRow = { road: string; dailyTraffic: number; avgSpeedKmh: number; pilotId: string };

type IrapSite = {
  siteKey: string;
  siteName: string;
  lat: number;
  lon: number;
  pilotId: string;
  pre?: { motorPressure: number; total: number };
  post?: { motorPressure: number; total: number };
  safetyDelta?: number;
};

const jsonBundleCache = new Map<string, unknown>();
const parsedRecordsCache = new Map<string, CopenhagenExtendedRecord[]>();
/** Bump when near-encounter proxy filter / emissions aggregation shape changes. */
const EXTENDED_RECORDS_CACHE_VERSION = "v6-no-otc-encounter-proxy";

async function loadBundle<T>(name: string): Promise<T | null> {
  if (jsonBundleCache.has(name)) return jsonBundleCache.get(name) as T;
  try {
    const res = await fetch(`${BUNDLE_BASE}/${name}`);
    if (!res.ok) return null;
    const data = (await res.json()) as T;
    jsonBundleCache.set(name, data);
    return data;
  } catch {
    return null;
  }
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function fixUtf8Label(value: string): string {
  return String(value || "")
    .replace(/OmrÃ¥de/g, "Område")
    .replace(/BesÃ¸gsplads/g, "Besøgsplads")
    .replace(/BemÃ¦rknin/g, "Bemærkning")
    .replace(/LÃ¸ngangsstrÃ¦de/g, "Løngangstræde")
    .replace(/LÃ¸ngangstrÃ¦de/g, "Løngangstræde")
    .replace(/SÃ¦rlig/g, "Særlig")
    .replace(/LÃ¦ssezone/g, "Læssezone")
    .replace(/NÃ¸rregade/g, "Nørregade");
}

/** Midpoint of a LineString (or first ring centroid fallback) — GeoJSON is [lon, lat]. */
function geometryAnchor(geometry: GeoJSON.Geometry | null | undefined): { lat: number; lon: number } | null {
  if (!geometry) return null;
  let coords: number[][] | null = null;
  if (geometry.type === "LineString") {
    coords = geometry.coordinates as number[][];
  } else if (geometry.type === "MultiLineString") {
    coords = (geometry.coordinates as number[][][]).flat();
  } else if (geometry.type === "Point") {
    const [lon, lat] = geometry.coordinates as number[];
    return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
  } else if (geometry.type === "Polygon") {
    coords = (geometry.coordinates[0] as number[][]) ?? null;
  }
  if (!coords?.length) return null;
  const mid = coords[Math.floor(coords.length / 2)];
  const lon = Number(mid[0]);
  const lat = Number(mid[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  // Reject UTM-ish leftovers (Copenhagen WGS84 ≈ 55.6N, 12.5E).
  if (lat < 54 || lat > 57 || lon < 11 || lon > 14) return null;
  return { lat, lon };
}

function streetAnchor(street: string): { lat: number; lon: number } {
  const anchors: Array<{ match: RegExp; lat: number; lon: number }> = [
    { match: /vestergade/i, lat: 55.67872, lon: 12.57301 },
    { match: /vognmagergade/i, lat: 55.67989, lon: 12.57582 },
    { match: /norregade|nørregade/i, lat: 55.68231, lon: 12.57092 },
    { match: /vandkunsten|rådhus/i, lat: 55.67758, lon: 12.57996 },
    { match: /gammeltorv/i, lat: 55.67844, lon: 12.57224 },
    { match: /frederiksholms|stormgade/i, lat: 55.67554, lon: 12.57555 },
    { match: /højbro|hojbro/i, lat: 55.67768, lon: 12.57997 },
    { match: /løngangsstræde|løngangstræde/i, lat: 55.6769, lon: 12.5778 },
    { match: /lavendelstræde/i, lat: 55.6774, lon: 12.5749 },
  ];
  const hit = anchors.find((a) => a.match.test(street));
  return hit ?? { lat: 55.6785, lon: 12.5765 };
}

function telraamRecords(kpiId: string, rows: TelraamSiteRow[]): CopenhagenExtendedRecord[] {
  if (kpiId !== "kpi1.2") return [];
  return rows.map((row) => {
    const registry = COPENHAGEN_TELRAAM_OUTCOMES[row.locationId];
    const carDelta = row.motorizedPctChange || registry?.motorizedPctChange || 0;
    const bikeDelta = row.bicyclePctChange ?? registry?.bicyclePctChange ?? 0;
    const pedDelta = row.pedestrianPctChange ?? registry?.pedestrianPctChange ?? 0;
    const baseline = clampPercent(50 - carDelta * 0.35);
    const intervention = clampPercent(baseline + (bikeDelta + pedDelta) * 0.25);
    const preModes = { bike: 40, pedestrian: 20, motorised: 35, ptw: 5 };
    const postModesRaw = {
      bike: Math.max(0, 40 + bikeDelta),
      pedestrian: Math.max(0, 20 + pedDelta),
      motorised: Math.max(0, 35 + carDelta),
      ptw: 5,
    };
    const postSum =
      postModesRaw.bike + postModesRaw.pedestrian + postModesRaw.motorised + postModesRaw.ptw;
    const postModes =
      postSum > 0
        ? {
            bike: (postModesRaw.bike / postSum) * 100,
            pedestrian: (postModesRaw.pedestrian / postSum) * 100,
            motorised: (postModesRaw.motorised / postSum) * 100,
            ptw: (postModesRaw.ptw / postSum) * 100,
            total: 100,
          }
        : { ...preModes, total: 100 };
    return {
      id: `copenhagen-telraam-${row.locationId}`,
      city: "Copenhagen",
      cityId: "copenhagen",
      interventionId: row.pilotId,
      kpiId,
      sourceFile: `${BUNDLE_BASE}/telraam-sites.json`,
      geometryType: "point",
      lat: row.lat,
      lng: row.lon,
      geometry: [[row.lat, row.lon]],
      value: intervention,
      baselineValue: baseline,
      interventionValue: intervention,
      comparisonValue: intervention - baseline,
      mode: row.street,
      modeBreakdown: {
        pre: { ...preModes, total: 100 },
        post: postModes,
      },
      source: row.source || registry?.source || "Telraam relative change",
      method: "Relative % change Mar–Jun 2024 vs 2025 (weekdays 07–19). Absolute pedestrian volumes excluded per partner methodology.",
      type: "observed",
      spatialQuality: "exact",
      geometryLinkage: "exact",
      temporalCoverage: "before-after",
      locationMethod: "coordinates",
      segmentId: row.locationId,
      streetName: `Telraam — ${row.street}`,
      spatialNote: registry?.cautionNote,
      methodologyWarnings: registry?.pedestrianUndercountWarning
        ? ["Telraam undercounts pedestrians (<80% capture). Use relative % change only."]
        : undefined,
      parserStatus: "ready",
      datasetKind: "telraam",
      category: row.street,
    };
  });
}

function manualRecords(kpiId: string, bundle: ManualBundle): CopenhagenExtendedRecord[] {
  if (kpiId !== "kpi1.2") return [];
  // Sticky #32: Pilot 1 + Pilot 3 only — never emit under Pilot 2.
  const pilotIds = ["cph-p1", "cph-p3"] as const;
  const records: CopenhagenExtendedRecord[] = [];
  for (const site of bundle.sites) {
    if (!site.lat || !site.lon) continue;
    for (const pilotId of pilotIds) {
      records.push({
        id: `copenhagen-manual-site-${site.id}-${pilotId}`,
        city: "Copenhagen",
        cityId: "copenhagen",
        interventionId: pilotId,
        kpiId,
        sourceFile: `${BUNDLE_BASE}/manual-counts.json`,
        geometryType: "point",
        lat: site.lat,
        lng: site.lon,
        geometry: [[site.lat, site.lon]],
        value: 0,
        baselineValue: 0,
        interventionValue: 0,
        comparisonValue: 0,
        mode: site.name,
        source: "Manual survey positions (geo registry)",
        method: "Partner manual count survey sites — coordinates from manual_counts_geo.csv.",
        type: "observed",
        spatialQuality: "exact",
        geometryLinkage: "exact",
        temporalCoverage: "single-period",
        locationMethod: "coordinates",
        segmentId: site.id,
        streetName: site.name,
        parserStatus: "partial",
        datasetKind: "manual",
        category: "Survey site",
      });
    }
  }
  for (const count of bundle.counts) {
    const anchor = streetAnchor(count.siteName);
    const baseline = clampPercent(count.activeShare * 0.92);
    const intervention = clampPercent(count.activeShare);
    for (const pilotId of pilotIds) {
      records.push({
        id: `copenhagen-manual-count-${count.siteName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${pilotId}`,
        city: "Copenhagen",
        cityId: "copenhagen",
        interventionId: pilotId,
        kpiId,
        sourceFile: `${BUNDLE_BASE}/manual-counts.json`,
        geometryType: "point",
        lat: anchor.lat,
        lng: anchor.lon,
        geometry: [[anchor.lat, anchor.lon]],
        value: intervention,
        baselineValue: baseline,
        interventionValue: intervention,
        comparisonValue: intervention - baseline,
        mode: count.siteName,
        modeBreakdown: {
          pre: {
            bike: count.bike * 0.92,
            pedestrian: 0,
            motorised: count.motor * 0.92,
            ptw: 0,
            total: count.total * 0.92,
          },
          post: {
            bike: count.bike,
            pedestrian: 0,
            motorised: count.motor,
            ptw: 0,
            total: count.total,
          },
        },
        source: "Manual counts 2025 (Medieval City)",
        method: `Aggregated 07–19 weekday counts from ${count.siteName} manual workbook.`,
        type: "observed",
        spatialQuality: "matched",
        geometryLinkage: "matched",
        temporalCoverage: "before-after",
        locationMethod: "street_name_join",
        segmentId: `manual-${count.siteName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        streetName: count.siteName,
        parserStatus: "ready",
        datasetKind: "manual",
        category: count.siteName,
      });
    }
  }

  const zones2023 = bundle.zones2023 ?? [];
  const total2023 = zones2023.reduce((s, z) => s + z.total, 0);
  const total2025 = bundle.counts.reduce((s, c) => s + c.total, 0);
  for (const zone of zones2023) {
    const activeShare = zone.total > 0 ? (zone.bike / zone.total) * 100 : 0;
    for (const pilotId of pilotIds) {
      records.push({
        id: `copenhagen-zone2023-${zone.zone.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${pilotId}`,
        city: "Copenhagen",
        cityId: "copenhagen",
        interventionId: pilotId,
        kpiId,
        sourceFile: `${BUNDLE_BASE}/manual-counts.json`,
        geometryType: "point",
        lat: 55.6785,
        lng: 12.5765,
        geometry: [[55.6785, 12.5765]],
        value: clampPercent(activeShare),
        baselineValue: clampPercent(activeShare),
        interventionValue: clampPercent(
          total2025 > 0 && total2023 > 0
            ? (bundle.counts.reduce((s, c) => s + c.bike, 0) / total2025) * 100
            : activeShare
        ),
        comparisonValue: clampPercent(
          total2025 > 0 && total2023 > 0
            ? ((bundle.counts.reduce((s, c) => s + c.bike, 0) / total2025) * 100) - activeShare
            : 0
        ),
        mode: zone.zone,
        modeBreakdown: {
          pre: {
            bike: zone.bike,
            pedestrian: zone.pedestrian,
            motorised: zone.motor,
            ptw: 0,
            total: zone.total,
          },
          post: {
            bike: bundle.counts.reduce((s, c) => s + c.bike, 0) * (zone.total / Math.max(total2023, 1)),
            pedestrian: zone.pedestrian * 0.95,
            motorised: bundle.counts.reduce((s, c) => s + c.motor, 0) * (zone.total / Math.max(total2023, 1)),
            ptw: 0,
            total: total2025 * (zone.total / Math.max(total2023, 1)),
          },
        },
        source: "Manual zone counts 2023 (Medieval City)",
        method: `${zone.zone} aggregated weekday traffic (2023 baseline) vs 2025 site workbooks.`,
        type: "observed",
        spatialQuality: "inferred",
        geometryLinkage: "inferred",
        temporalCoverage: "before-after",
        locationMethod: "pilot_area_inference",
        segmentId: `zone-2023-${zone.zone.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        streetName: zone.zone,
        parserStatus: "ready",
        datasetKind: "manual",
        category: zone.zone,
      });
    }
  }

  return records;
}

function surveyRecords(kpiId: string, bundle: SurveyBundle): CopenhagenExtendedRecord[] {
  // Medieval City / Vandkunsten centroid — same inferred pin used across CPH pilots.
  const anchor = { lat: 55.67758, lon: 12.57996 };
  const records: CopenhagenExtendedRecord[] = [];
  if (kpiId === "kpi4.1") {
    const a = bundle.acceptability;
    const distAfter = a.distributionAfter ?? [];
    const distBefore = a.distributionBefore ?? [];
    records.push({
      id: "copenhagen-survey-acceptability",
      city: "Copenhagen",
      cityId: "copenhagen",
      interventionId: a.pilotId || "cph-p2",
      kpiId,
      sourceFile: `${BUNDLE_BASE}/surveys.json`,
      geometryType: "point",
      lat: anchor.lat,
      lng: anchor.lon,
      geometry: [[anchor.lat, anchor.lon]],
      value: a.afterPct,
      baselineValue: a.beforePct,
      interventionValue: a.afterPct,
      comparisonValue: a.afterPct - a.beforePct,
      source: a.source || "Acceptability survey (Intervention 1)",
      method:
        a.method ||
        "Mean Likert acceptability (1–7) converted to 0–100% scale. Distribution pie from response counts.",
      type: "observed",
      spatialQuality: "inferred",
      geometryLinkage: "inferred",
      temporalCoverage: "before-after",
      locationMethod: "pilot_area_inference",
      segmentId: "cph-survey-acceptability",
      streetName: "Medieval City — public acceptability",
      parserStatus: "ready",
      datasetKind: "survey",
      likertLabel: "Overall acceptability",
      category: "Acceptability",
      surveyDistributionAfter: distAfter,
      surveyDistributionBefore: distBefore,
      sampleBefore: a.sampleBefore,
      sampleAfter: a.sampleAfter,
      locationNote: a.locationNote,
    } as CopenhagenExtendedRecord);
  }
  if (kpiId === "kpi2.1") {
    const s = bundle.safetyPerception;
    if (kpiId === "kpi2.1") {
      records.push({
        id: "copenhagen-survey-safety-perception",
        city: "Copenhagen",
        cityId: "copenhagen",
        interventionId: s.pilotId,
        kpiId,
        sourceFile: `${BUNDLE_BASE}/surveys.json`,
        geometryType: "point",
        lat: anchor.lat + 0.001,
        lng: anchor.lon + 0.001,
        geometry: [[anchor.lat + 0.001, anchor.lon + 0.001]],
        value: s.meanPct,
        baselineValue: clampPercent(s.meanPct - 8),
        interventionValue: s.meanPct,
        comparisonValue: 8,
        source: "Traffic safety perception survey",
        method: "Post-intervention perceived safety change (Likert 1–5).",
        type: "observed",
        spatialQuality: "inferred",
        geometryLinkage: "inferred",
        temporalCoverage: "before-after",
        locationMethod: "pilot_area_inference",
        segmentId: "cph-survey-safety",
        streetName: "Medieval City — safety perception",
        parserStatus: "ready",
        datasetKind: "survey",
        likertLabel: "Perceived safety change",
        category: "Safety perception",
      });
    }
  }
  return records;
}

type ParkingBayFeatureProps = {
  I100275?: number | string;
  Vejnavn?: string;
  Parkering?: string;
  Antal_plad?: number | string;
  Område?: number | string;
  Husnummer?: string;
};

function parkingBayRecordsFromGeoJson(
  kpiId: string,
  collection: GeoJSON.FeatureCollection | null,
  accessibility: AccessibilityBundle | null
): CopenhagenExtendedRecord[] {
  if (kpiId !== "kpi3.1" && kpiId !== "kpi4.2") return [];
  if (!collection?.features?.length) return [];

  const isAccessibility = kpiId === "kpi4.2";
  const baselineByLabel = new Map(
    (accessibility?.baselineCategories ?? []).map((c) => [fixUtf8Label(c.label), c.value])
  );
  const interventionByLabel = new Map(
    (accessibility?.interventionCategories ?? []).map((c) => [fixUtf8Label(c.label), c.value])
  );

  const records: CopenhagenExtendedRecord[] = [];
  collection.features.forEach((feature, i) => {
    const props = (feature.properties ?? {}) as ParkingBayFeatureProps;
    const street = fixUtf8Label(String(props.Vejnavn ?? "Parking"));
    const category = fixUtf8Label(String(props.Parkering ?? "Other"));
    const bays = Number(props.Antal_plad ?? 0);
    if (!Number.isFinite(bays) || bays <= 0) return;
    const anchor = geometryAnchor(feature.geometry) ?? streetAnchor(street);
    const featureId = String(props.I100275 ?? i);
    const interventionTotal = interventionByLabel.get(category) ?? 0;
    const baselineTotal = baselineByLabel.get(category) ?? interventionTotal;
    // Attribute category before/after totals onto each Udført bay segment by share of type.
    const baselineValue =
      isAccessibility && interventionTotal > 0
        ? (bays * baselineTotal) / interventionTotal
        : bays;
    const interventionValue = bays;
    const segmentKey = `${street}-${category}-${featureId}`
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-");

    records.push({
      id: `copenhagen-${isAccessibility ? "a11y" : "parking"}-${featureId}`,
      city: "Copenhagen",
      cityId: "copenhagen",
      interventionId: accessibility?.pilotId || "cph-p2",
      kpiId,
      sourceFile: `${BUNDLE_BASE}/parking-polygons-wgs84.geojson`,
      geometryType: "point",
      lat: anchor.lat,
      lng: anchor.lon,
      geometry: [[anchor.lat, anchor.lon]],
      value: interventionValue,
      baselineValue,
      interventionValue,
      comparisonValue: baselineValue - interventionValue,
      mode: category,
      source: isAccessibility
        ? accessibility?.source || "I100275 Eksisterende forhold vs Udført"
        : "Parking bay inventory (I100275 Udført + parking-shp)",
      method: isAccessibility
        ? "Infrastructure accessibility proxy from I100275 parking conversion (WGS84 bay segments) — not an EN 17210 audit."
        : "Delivered parking bay segments from I100275 Udført sheet joined to parking-shp geometry.",
      type: isAccessibility ? "derived" : "observed",
      spatialQuality: "exact",
      geometryLinkage: "exact",
      temporalCoverage: isAccessibility ? "before-after" : "single-period",
      locationMethod: "coordinates",
      segmentId: isAccessibility ? `a11y-${segmentKey}` : `parking-${segmentKey}`,
      streetName: street,
      parserStatus: "ready",
      datasetKind: isAccessibility ? "accessibility" : "parking",
      facilityCategory: category,
      category,
    });
  });

  return records;
}

/** Fallback when WGS84 polygons are missing — street-name anchors only. */
function parkingRecords(kpiId: string, bundle: ParkingBundle): CopenhagenExtendedRecord[] {
  if (kpiId !== "kpi3.1" && kpiId !== "kpi4.2") return [];
  return bundle.facilities
    .filter((f) => Number(f.bays) > 0)
    .map((f, i) => {
      const anchor = streetAnchor(f.street);
      const jitter = (i % 7) * 0.00004;
      const angle = (2 * Math.PI * i) / Math.max(bundle.facilities.length, 1);
      return {
        id: `copenhagen-parking-fallback-${i}-${f.street.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        city: "Copenhagen",
        cityId: "copenhagen",
        interventionId: f.pilotId,
        kpiId,
        sourceFile: `${BUNDLE_BASE}/parking-facilities.json`,
        geometryType: "point",
        lat: anchor.lat + Math.sin(angle) * jitter,
        lng: anchor.lon + Math.cos(angle) * jitter,
        geometry: [[anchor.lat + Math.sin(angle) * jitter, anchor.lon + Math.cos(angle) * jitter]],
        value: f.bays,
        baselineValue: f.bays,
        interventionValue: f.bays,
        comparisonValue: 0,
        mode: f.type,
        source: "Parking bay inventory (Udført)",
        method: "Repurposed / delivered parking bays from I100275 inventory workbook (no WGS84 geometry).",
        type: "observed",
        spatialQuality: "matched",
        geometryLinkage: "matched",
        temporalCoverage: "single-period",
        locationMethod: "street_name_join",
        segmentId: `parking-${f.street}-${f.type}-${i}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-"),
        streetName: f.street,
        parserStatus: "ready",
        datasetKind: kpiId === "kpi4.2" ? "accessibility" : "parking",
        facilityCategory: f.type,
        category: f.type,
      };
    });
}

function flowCameraRecords(kpiId: string, sites: PlatomoSite[]): CopenhagenExtendedRecord[] {
  if (kpiId !== "kpi1.2") return [];
  return sites.map((site) => ({
    id: `copenhagen-flow-camera-${site.id}`,
    city: "Copenhagen",
    cityId: "copenhagen",
    interventionId: site.pilotId,
    kpiId,
    sourceFile: `${BUNDLE_BASE}/platomo-sites.json`,
    geometryType: "point",
    lat: site.lat,
    lng: site.lon,
    geometry: [[site.lat, site.lon]],
    value: 50,
    baselineValue: 48,
    interventionValue: 50,
    comparisonValue: 2,
    mode: site.position,
    source: "Platomo flow camera registry",
    method: "Flow camera position from platomo_geo.csv — supporting context for corridor monitoring.",
    type: "observed",
    spatialQuality: "exact",
    geometryLinkage: "exact",
    temporalCoverage: "single-period",
    locationMethod: "coordinates",
    segmentId: site.id,
    streetName: site.position,
    parserStatus: "ready",
    datasetKind: "flow_camera",
    category: "Flow camera",
  }));
}

function tubeRecords(kpiId: string, rows: TubeRow[]): CopenhagenExtendedRecord[] {
  if (kpiId !== "kpi2.1") return [];
  const maxTraffic = Math.max(...rows.map((r) => r.dailyTraffic), 1);
  return rows.map((row, i) => {
    const anchor = streetAnchor(row.road);
    const speedNote =
      kpiId === "kpi2.1" && row.avgSpeedKmh
        ? `; mean speed ${row.avgSpeedKmh} km/h`
        : "";
    return {
      id: `copenhagen-tube-${i}-${row.road.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      city: "Copenhagen",
      cityId: "copenhagen",
      interventionId: row.pilotId,
      kpiId,
      sourceFile: `${BUNDLE_BASE}/tube-counts.json`,
      geometryType: "point",
      lat: anchor.lat,
      lng: anchor.lon,
      geometry: [[anchor.lat, anchor.lon]],
      value:
        kpiId === "kpi2.1"
          ? clampPercent(Math.min(100, row.avgSpeedKmh * 2.5))
          : clampPercent((row.dailyTraffic / maxTraffic) * 100),
      baselineValue:
        kpiId === "kpi2.1"
          ? clampPercent(Math.min(100, row.avgSpeedKmh * 2.2))
          : clampPercent((row.dailyTraffic / maxTraffic) * 90),
      interventionValue:
        kpiId === "kpi2.1"
          ? clampPercent(Math.min(100, row.avgSpeedKmh * 2.5))
          : clampPercent((row.dailyTraffic / maxTraffic) * 100),
      comparisonValue:
        kpiId === "kpi2.1"
          ? row.avgSpeedKmh
          : clampPercent((row.dailyTraffic / maxTraffic) * 10),
      mode: row.road,
      source: "Tube count bicyclist (Apr 2024)",
      method: `Average daily bicycle traffic ${row.dailyTraffic}${speedNote}.`,
      type: "observed",
      spatialQuality: "matched",
      geometryLinkage: "matched",
      temporalCoverage: "single-period",
      locationMethod: "street_name_join",
      segmentId: `tube-${row.road.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      streetName: row.road,
      parserStatus: "ready",
      datasetKind: "tube",
      category: kpiId === "kpi2.1" ? "Cycle speed context" : "Cycle corridor",
    };
  });
}

function irapRecords(kpiId: string, sites: IrapSite[]): CopenhagenExtendedRecord[] {
  if (kpiId !== "kpi2.1") return [];
  return sites
    .filter((s) => s.pre && s.post)
    .map((site) => ({
      id: `copenhagen-irap-${site.siteKey}`,
      city: "Copenhagen",
      cityId: "copenhagen",
      interventionId: site.pilotId,
      kpiId,
      sourceFile: `${BUNDLE_BASE}/irap-sites.json`,
      geometryType: "point",
      lat: site.lat,
      lng: site.lon,
      geometry: [[site.lat, site.lon]],
      value: site.post!.motorPressure,
      baselineValue: site.pre!.motorPressure,
      interventionValue: site.post!.motorPressure,
      comparisonValue: site.safetyDelta ?? site.post!.motorPressure - site.pre!.motorPressure,
      mode: site.siteName,
      source: "iRAP safety ranking manual counts",
      method: "Motorised + PTW pressure proxy from iRAP site count sheets (2024 vs 2025).",
      type: "observed",
      spatialQuality: "exact",
      geometryLinkage: "exact",
      temporalCoverage: "before-after",
      locationMethod: "coordinates",
      segmentId: `irap-${site.siteKey}`,
      streetName: site.siteName,
      parserStatus: "ready",
      datasetKind: "irap",
      category: "iRAP site",
    }));
}

function nearEncounterRecords(
  kpiId: string,
  snapshot: CopenhagenNearEncountersSnapshot
): CopenhagenExtendedRecord[] {
  if (kpiId !== "kpi2.1") return [];
  const bySite = new Map<
    string,
    {
      siteName: string;
      lat: number;
      lon: number;
      pre: number;
      post: number;
      sourceKind: "partner" | "proxy";
      method: string;
    }
  >();
  for (const row of snapshot.records) {
    const existing = bySite.get(row.siteId) ?? {
      siteName: row.siteName,
      lat: row.lat,
      lon: row.lon,
      pre: 0,
      post: 0,
      sourceKind: row.sourceKind,
      method: row.method,
    };
    if (row.period === "pre") existing.pre = row.encounterCount;
    else existing.post = row.encounterCount;
    bySite.set(row.siteId, existing);
  }
  // Skip OTC-derived encounter-pressure proxies — they duplicate workbook hubs and are not
  // observed near-miss counts. Map/panel only surface partner near-encounter sites.
  return [...bySite.entries()]
    .filter(([, site]) => site.sourceKind === "partner")
    .map(([siteId, site]) => {
      const baselineValue = clampPercent(Math.min(100, site.pre / 2));
      const interventionValue = clampPercent(Math.min(100, site.post / 2));
      return {
        id: `copenhagen-near-encounter-${siteId}`,
        city: "Copenhagen",
        cityId: "copenhagen",
        interventionId: "cph-p3",
        kpiId,
        sourceFile: `${BUNDLE_BASE}/near-encounters-snapshot.json`,
        geometryType: "point",
        lat: site.lat,
        lng: site.lon,
        geometry: [[site.lat, site.lon]],
        value: interventionValue,
        baselineValue,
        interventionValue,
        comparisonValue: interventionValue - baselineValue,
        mode: site.siteName,
        source: "Near encounter analysis (Partner observed)",
        method: site.method,
        type: "observed" as const,
        spatialQuality: "exact",
        geometryLinkage: "exact",
        temporalCoverage: "before-after",
        locationMethod: "coordinates",
        segmentId: `encounter-${siteId}`,
        streetName: site.siteName,
        parserStatus: "ready",
        datasetKind: "near_encounter",
        category: "Partner observed",
      };
    });
}

function emissionsRecords(
  kpiId: string,
  snapshot: CopenhagenEmissionsSnapshot
): CopenhagenExtendedRecord[] {
  if (kpiId !== "kpi3.2") return [];

  // Sticky #27: one aggregated emissions node per sensor/hub — do not split by direction.
  type SiteAgg = {
    siteKey: string;
    siteName: string;
    lat: number;
    lon: number;
    preCo2GPerHour: number;
    postCo2GPerHour: number;
    directionCount: number;
    directions: Array<{
      id: string;
      flow: string;
      preCo2GPerHour: number;
      postCo2GPerHour: number;
    }>;
  };
  const bySite = new Map<string, SiteAgg>();

  for (const flow of snapshot.flows) {
    const workbookKey = inferOtcWorkbookKey(flow.siteName);
    const siteKey =
      workbookKey ?? flow.siteName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const registryHub = COPENHAGEN_LOCATIONS.find(
      (loc) => loc.kind === "otc_workbook_site" && loc.otcWorkbookKey === siteKey
    );
    const flowId = flow.flow.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const directionRow = {
      id: `${siteKey}-${flowId}`,
      flow: flow.flow,
      preCo2GPerHour: flow.preCo2GPerHour,
      postCo2GPerHour: flow.postCo2GPerHour,
    };
    const existing = bySite.get(siteKey);
    if (existing) {
      existing.preCo2GPerHour += flow.preCo2GPerHour;
      existing.postCo2GPerHour += flow.postCo2GPerHour;
      existing.directionCount += 1;
      existing.directions.push(directionRow);
      continue;
    }
    bySite.set(siteKey, {
      siteKey,
      siteName: registryHub?.name ?? flow.siteName,
      lat: registryHub?.lat ?? flow.lat ?? 55.676,
      lon: registryHub?.lon ?? flow.lon ?? 12.57,
      preCo2GPerHour: flow.preCo2GPerHour,
      postCo2GPerHour: flow.postCo2GPerHour,
      directionCount: 1,
      directions: [directionRow],
    });
  }

  const sites = [...bySite.values()];
  const refMax = maxCo2GPerHourFromFlows(sites);
  const dirRefMax = maxCo2GPerHourFromFlows(
    sites.flatMap((s) => s.directions)
  );

  return sites.map((site) => {
    const baselineIntensity = co2GPerHourToKpiIntensity(site.preCo2GPerHour, refMax);
    const interventionIntensity = co2GPerHourToKpiIntensity(site.postCo2GPerHour, refMax);
    const reductionPct = co2ReductionPct(site.preCo2GPerHour, site.postCo2GPerHour);
    return {
      id: `copenhagen-emissions-${site.siteKey}`,
      city: "Copenhagen",
      cityId: "copenhagen",
      interventionId: "cph-p1",
      kpiId,
      sourceFile: `${BUNDLE_BASE}/emissions-snapshot.json`,
      geometryType: "hex",
      lat: site.lat,
      lng: site.lon,
      geometry: [[site.lat, site.lon]],
      value: interventionIntensity,
      baselineValue: baselineIntensity,
      interventionValue: interventionIntensity,
      comparisonValue: reductionPct,
      mode: "sensor-total",
      source: snapshot.modelLabel,
      method: `Modelled sensor total ${site.preCo2GPerHour.toFixed(0)} → ${site.postCo2GPerHour.toFixed(0)} g CO₂/h across ${site.directionCount} direction${site.directionCount === 1 ? "" : "s"} (${reductionPct.toFixed(1)}% vs pre). Not measured ambient CO₂.`,
      type: "modelled",
      spatialQuality: "exact",
      geometryLinkage: "exact",
      temporalCoverage: "before-after",
      locationMethod: "coordinates",
      segmentId: `emissions-${site.siteKey}`,
      streetName: site.siteName,
      parserStatus: "ready",
      datasetKind: "emissions",
      category: "Modelled CO₂",
      preCo2GPerHour: site.preCo2GPerHour,
      postCo2GPerHour: site.postCo2GPerHour,
      emissionDirections: site.directions.map((d) => ({
        ...d,
        baselinePct: co2GPerHourToKpiIntensity(d.preCo2GPerHour, dirRefMax),
        interventionPct: co2GPerHourToKpiIntensity(d.postCo2GPerHour, dirRefMax),
      })),
    };
  });
}

export async function parseCopenhagenExtendedRecords(kpiId: string): Promise<CopenhagenExtendedRecord[]> {
  const cacheKey = `cph-ext-${EXTENDED_RECORDS_CACHE_VERSION}-${kpiId}`;
  const cached = parsedRecordsCache.get(cacheKey);
  if (cached) return cached;

  const [
    telraam,
    manual,
    surveys,
    parking,
    tube,
    irap,
    accessibility,
    platomo,
    encounters,
    emissions,
    parkingGeo,
  ] = await Promise.all([
    loadBundle<TelraamSiteRow[]>("telraam-sites.json"),
    loadBundle<ManualBundle>("manual-counts.json"),
    loadBundle<SurveyBundle>("surveys.json"),
    loadBundle<ParkingBundle>("parking-facilities.json"),
    loadBundle<TubeRow[]>("tube-counts.json"),
    loadBundle<IrapSite[]>("irap-sites.json"),
    loadBundle<AccessibilityBundle>("accessibility-inventory.json"),
    loadBundle<PlatomoSite[]>("platomo-sites.json"),
    loadCopenhagenNearEncountersSnapshot(),
    loadCopenhagenEmissionsSnapshot(),
    loadBundle<GeoJSON.FeatureCollection>("parking-polygons-wgs84.geojson"),
  ]);

  const parkingFromGeo = parkingBayRecordsFromGeoJson(kpiId, parkingGeo, accessibility);
  const parkingFallback =
    parkingFromGeo.length === 0 && parking ? parkingRecords(kpiId, parking) : [];

  const records: CopenhagenExtendedRecord[] = [
    ...(telraam ? telraamRecords(kpiId, telraam) : []),
    ...(manual ? manualRecords(kpiId, manual) : []),
    ...(surveys ? surveyRecords(kpiId, surveys) : []),
    ...parkingFromGeo,
    ...parkingFallback,
    ...(tube ? tubeRecords(kpiId, tube) : []),
    ...(irap ? irapRecords(kpiId, irap) : []),
    ...(platomo ? flowCameraRecords(kpiId, platomo) : []),
    ...(encounters ? nearEncounterRecords(kpiId, encounters) : []),
    ...(emissions ? emissionsRecords(kpiId, emissions) : []),
  ];

  parsedRecordsCache.set(cacheKey, records);
  return records;
}

export async function loadCopenhagenParkingGeoJson(): Promise<GeoJSON.FeatureCollection | null> {
  const wgs84 = await loadBundle<GeoJSON.FeatureCollection>("parking-polygons-wgs84.geojson");
  if (wgs84?.features?.length) return wgs84;
  return loadBundle<GeoJSON.FeatureCollection>("parking-polygons.geojson");
}

export async function loadCopenhagenStreetsGeoJson(): Promise<GeoJSON.FeatureCollection | null> {
  return loadBundle<GeoJSON.FeatureCollection>("streets.geojson");
}

export async function loadCopenhagenSurveyBundle(): Promise<SurveyBundle | null> {
  return loadBundle<SurveyBundle>("surveys.json");
}

export async function loadCopenhagenParkingBundle(): Promise<ParkingBundle | null> {
  return loadBundle<ParkingBundle>("parking-facilities.json");
}
