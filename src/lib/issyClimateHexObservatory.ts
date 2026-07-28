import type { CityKPIData } from "@/data/kpiDefinitions";
import type { JunctionConfig } from "@/data/junctionConfigs";
import { getKpiDefinition } from "@/config/kpiDefinitions";
import { getIssyPilotInterventionCopy } from "@/lib/issyDataTransparency";
import { buildClimateHexGrid } from "@/lib/issyClimateHexGrid";
import {
  allocateClasseurCo2ToHexGrid,
  classeurCo2ForCell,
} from "@/lib/issyClasseurEmissions";
import { ISSY_P2_JUNCTION } from "@/lib/issyPilot2Junction";
import { haversineMeters } from "@/lib/issyPilot2Junction";
import { getKpi32TimeSeriesIntensity, resolveKpi32ScenarioIntensities } from "@/lib/kpi32YearIntensity";
import { getSegmentHighlight, segmentMetricKindForKpi } from "@/lib/segmentHighlight";
import type { MapScenario } from "@/lib/junctionScenarioValues";
import type { JunctionStudyView } from "@/lib/issyJunctionAnalytics";
import type { IssyClasseurEmissionsSnapshot } from "@/types/issy-workbooks";

export const ISSY_CLIMATE_HEX_PREFIX = "issy-climate-hex:";
/** Single city-level climate selection (KPI 3.2) — not a spatial hex cell. */
export const ISSY_CLIMATE_CITY_ID = "issy-climate-city";

export function issyClimateHexSegmentId(cellId: string): string {
  return `${ISSY_CLIMATE_HEX_PREFIX}${cellId}`;
}

export function parseIssyClimateHexSegmentId(segmentId: string | null | undefined): string | null {
  if (!segmentId?.startsWith(ISSY_CLIMATE_HEX_PREFIX)) return null;
  return segmentId.slice(ISSY_CLIMATE_HEX_PREFIX.length);
}

export function isIssyClimateCitySegmentId(segmentId: string | null | undefined): boolean {
  return segmentId === ISSY_CLIMATE_CITY_ID;
}

export interface IssyClimateHexCellMetrics {
  cellId: string;
  lat: number;
  lon: number;
  interventionIntensity: number;
  baselineIntensity: number;
  displayIntensity: number;
  delta: number;
  distM: number;
  baselineCo2GPerHour?: number;
  interventionCo2GPerHour?: number;
  displayCo2GPerHour?: number;
  dataClass: "derived" | "modelled";
}

export function resolveIssyClimateHexCellMetrics(
  cellId: string,
  options: {
    centerLat?: number;
    centerLon?: number;
    rings?: number;
    cellSizeM?: number;
    kpiRow?: CityKPIData;
    kpi32Year?: string | null;
    scenario?: MapScenario;
    classeur?: IssyClasseurEmissionsSnapshot | null;
  } = {}
): IssyClimateHexCellMetrics | null {
  const centerLat = options.centerLat ?? ISSY_P2_JUNCTION.lat;
  const centerLon = options.centerLon ?? ISSY_P2_JUNCTION.lon;
  const rings = options.rings ?? 3;
  const cellSizeM = options.cellSizeM ?? 44;
  const scenario = options.scenario ?? "intervention";

  const cells = buildClimateHexGrid(centerLat, centerLon, {
    rings,
    cellSizeM,
    baseIntensity: getKpi32TimeSeriesIntensity(options.kpiRow, options.kpi32Year ?? null) ??
      options.kpiRow?.mainValue ??
      52,
  });

  const idx = cells.findIndex((c) => c.id === cellId);
  if (idx < 0) return null;
  const cell = cells[idx]!;

  if (options.classeur) {
    const allocations = allocateClasseurCo2ToHexGrid(cells, centerLat, centerLon, options.classeur, {
      kpiRow: options.kpiRow,
      kpi32Year: options.kpi32Year,
      scenario,
    });
    const alloc = classeurCo2ForCell(allocations, cellId);
    if (!alloc) return null;

    const baselineIntensity = Math.min(
      100,
      (alloc.baselineCo2GPerHour / (options.classeur.totalBaselineCo2G * 0.55)) * 100
    );
    const interventionIntensity = Math.min(
      100,
      (alloc.interventionCo2GPerHour / (options.classeur.totalBaselineCo2G * 0.55)) * 100
    );
    const displayIntensity = alloc.intensityPct;
    const delta = interventionIntensity - baselineIntensity;

    return {
      cellId: cell.id,
      lat: cell.lat,
      lon: cell.lon,
      interventionIntensity,
      baselineIntensity,
      displayIntensity,
      delta,
      distM: alloc.distM,
      baselineCo2GPerHour: alloc.baselineCo2GPerHour,
      interventionCo2GPerHour: alloc.interventionCo2GPerHour,
      displayCo2GPerHour: alloc.displayCo2GPerHour,
      dataClass: "modelled",
    };
  }

  const intervention = cell.intensity;
  const baseline = Math.min(100, intervention * (1.08 + (idx % 5) * 0.02));
  const delta = intervention - baseline;
  const displayIntensity =
    scenario === "baseline" ? baseline : scenario === "intervention" ? intervention : Math.abs(delta);

  return {
    cellId: cell.id,
    lat: cell.lat,
    lon: cell.lon,
    interventionIntensity: intervention,
    baselineIntensity: baseline,
    displayIntensity,
    delta,
    distM: haversineMeters(centerLat, centerLon, cell.lat, cell.lon),
    dataClass: "derived",
  };
}

function co2FromIntensity(intensity: number, distM: number): number {
  return Math.round(900 + distM * 0.8 + (intensity / 100) * 400);
}

function co2GPerHourToKgDay(gPerHour: number): number {
  return Math.round((gPerHour * 24) / 1000);
}

export function buildIssyClimateHexStudyView(
  cellId: string,
  config: JunctionConfig,
  options: {
    pilotLabel: string;
    pilotId?: string | null;
    scenario?: MapScenario;
    kpiRow?: CityKPIData;
    kpi32Year?: string | null;
    rings?: number;
    cellSizeM?: number;
    classeur?: IssyClasseurEmissionsSnapshot | null;
  }
): JunctionStudyView | null {
  const metrics = resolveIssyClimateHexCellMetrics(cellId, {
    rings: options.rings ?? 3,
    cellSizeM: options.cellSizeM ?? 44,
    kpiRow: options.kpiRow,
    kpi32Year: options.kpi32Year,
    scenario: options.scenario,
    classeur: options.classeur,
  });
  if (!metrics) return null;

  const scenario = options.scenario ?? "intervention";
  const interventionCopy = getIssyPilotInterventionCopy(options.pilotId);
  const kpiDef = getKpiDefinition("kpi3.2");
  const metric = segmentMetricKindForKpi("kpi3.2");
  const highlight = getSegmentHighlight(
    metrics.displayIntensity,
    metrics.displayIntensity * 0.85,
    metrics.displayIntensity * 1.15,
    metric
  );

  const interventionCong = metrics.interventionIntensity / 100;
  const baselineCong = metrics.baselineIntensity / 100;
  const interventionCo2 =
    metrics.interventionCo2GPerHour != null
      ? co2GPerHourToKgDay(metrics.interventionCo2GPerHour)
      : co2FromIntensity(metrics.interventionIntensity, metrics.distM);
  const baselineCo2 =
    metrics.baselineCo2GPerHour != null
      ? co2GPerHourToKgDay(metrics.baselineCo2GPerHour)
      : co2FromIntensity(metrics.baselineIntensity, metrics.distM);
  const interventionSpeed = Math.round(28 + (100 - metrics.interventionIntensity) * 0.12);
  const baselineSpeed = Math.round(interventionSpeed * 0.92);

  const usesClasseur = metrics.dataClass === "modelled" && options.classeur;
  const co2Label = usesClasseur
    ? `${Math.round(metrics.displayCo2GPerHour ?? 0)} g CO₂/h`
    : `${metrics.displayIntensity.toFixed(0)}% pressure`;
  const cellLabel = `Climate hex · ${co2Label}`;

  return {
    id: `issy-climate-${metrics.cellId}`,
    segmentApiId: issyClimateHexSegmentId(metrics.cellId),
    name: cellLabel,
    shortName: ISSY_P2_JUNCTION.shortName,
    armLabel: metrics.cellId.replace("hex-", "cell "),
    armId: "quai-paris",
    armColor: highlight.color,
    bandColor: highlight.color,
    kpiBand: highlight.band,
    kpiValue: usesClasseur
      ? Math.round(metrics.displayCo2GPerHour ?? 0)
      : Math.round(metrics.displayIntensity * 10) / 10,
    selectedKpi: "kpi3.2",
    kpiLabel: kpiDef?.name ?? "Climate and Environmental Impact",
    pilot: options.pilotLabel,
    interventionType: interventionCopy.title,
    coordinates: [metrics.lat, metrics.lon],
    monitoringPeriod: usesClasseur
      ? `ASIF model · ${options.classeur!.corridorLengthM} m corridor`
      : `Hex cell ${metrics.cellId} · derived environmental proxy`,
    sensors: 0,
    approachesCovered: 0,
    totalApproaches: 0,
    dataConfidence: usesClasseur ? 78 : 62,
    distanceMetres: Math.round(metrics.distM),
    dataSource: usesClasseur ? options.classeur!.datasetId : undefined,
    dataClass: metrics.dataClass,
    sourceLabel: usesClasseur
      ? "ASIF emissions model (Classeur.xlsx)"
      : "Derived climate hex field",
    streetNS: config.streetNS,
    streetEW: config.streetEW,
    baseline: {
      label: usesClasseur ? "Baseline (ASIF model)" : "Baseline (derived)",
      period: usesClasseur ? "Nov 2024 traffic inputs" : "Pre-intervention proxy",
      modeShare: {},
      dailyCycleCount: 0,
      peakCongestion: baselineCong,
      avgSpeedKmh: baselineSpeed,
      co2ProxyKgDay: baselineCo2,
      trendCycle: [],
      trendCar: [],
    },
    intervention: {
      label: scenario === "comparison" ? "Comparison" : usesClasseur ? "Scenario (ASIF scaled)" : "Intervention proxy",
      period: usesClasseur ? "KPI reduction factor applied" : "Current hex intensity",
      modeShare: {},
      dailyCycleCount: 0,
      peakCongestion: interventionCong,
      avgSpeedKmh: interventionSpeed,
      co2ProxyKgDay: interventionCo2,
      trendCycle: [],
      trendCar: [],
    },
    timeline: [],
  };
}

/**
 * City-wide KPI 3.2 reading — one intensity for all of Issy (year time series / optional ASIF total).
 * The map hex field was a visual proxy; partners only supply city-level climate context.
 */
export function buildIssyCityClimateStudyView(
  config: JunctionConfig,
  options: {
    pilotLabel: string;
    pilotId?: string | null;
    scenario?: MapScenario;
    kpiRow?: CityKPIData;
    kpi32Year?: string | null;
    classeur?: IssyClasseurEmissionsSnapshot | null;
    cityLat?: number;
    cityLon?: number;
  }
): JunctionStudyView {
  const scenario = options.scenario ?? "intervention";
  const interventionCopy = getIssyPilotInterventionCopy(options.pilotId);
  const kpiDef = getKpiDefinition("kpi3.2");
  const { baseline: baselineIntensity, intervention: interventionIntensity } =
    resolveKpi32ScenarioIntensities(options.kpiRow, options.kpi32Year ?? null);
  const usesClasseur = !!options.classeur;
  const displayIntensity =
    scenario === "baseline"
      ? baselineIntensity
      : scenario === "comparison"
        ? Math.abs(interventionIntensity - baselineIntensity)
        : interventionIntensity;

  const metric = segmentMetricKindForKpi("kpi3.2");
  const highlight = getSegmentHighlight(
    displayIntensity,
    displayIntensity * 0.85,
    displayIntensity * 1.15,
    metric
  );

  const baselineCo2 = usesClasseur
    ? co2GPerHourToKgDay(options.classeur!.totalBaselineCo2G)
    : co2FromIntensity(baselineIntensity, 0);
  const interventionCo2 = usesClasseur
    ? co2GPerHourToKgDay(
        options.classeur!.totalBaselineCo2G * (interventionIntensity / Math.max(baselineIntensity, 1))
      )
    : co2FromIntensity(interventionIntensity, 0);

  const lat = options.cityLat ?? 48.8247;
  const lon = options.cityLon ?? 2.27;

  return {
    id: ISSY_CLIMATE_CITY_ID,
    segmentApiId: ISSY_CLIMATE_CITY_ID,
    name: usesClasseur
      ? `Issy city climate · ${Math.round(options.classeur!.totalBaselineCo2G)} g CO₂/h`
      : `Issy city climate · ${displayIntensity.toFixed(0)}% pressure`,
    shortName: "Issy city climate",
    armLabel: "City-wide",
    armId: "west",
    armColor: highlight.color,
    bandColor: highlight.color,
    kpiBand: highlight.band,
    kpiValue: Math.round(displayIntensity * 10) / 10,
    selectedKpi: "kpi3.2",
    kpiLabel: kpiDef?.name ?? "Climate and Environmental Impact",
    pilot: options.pilotLabel,
    interventionType: interventionCopy.title,
    coordinates: [lat, lon],
    monitoringPeriod: usesClasseur
      ? `ASIF city model · chart year ${options.kpi32Year ?? "latest"}`
      : `City time series · chart year ${options.kpi32Year ?? "latest"}`,
    sensors: 0,
    approachesCovered: 1,
    totalApproaches: 1,
    dataConfidence: usesClasseur ? 78 : 70,
    dataSource: usesClasseur ? options.classeur!.datasetId : undefined,
    dataClass: usesClasseur ? "modelled" : "derived",
    sourceLabel: usesClasseur
      ? "ASIF emissions model (Classeur.xlsx) · city total"
      : "City KPI 3.2 time series · derived environmental pressure",
    streetNS: "Issy-les-Moulineaux",
    streetEW: "City-wide climate reading",
    baseline: {
      label: usesClasseur ? "Baseline (ASIF city)" : "Baseline (city series)",
      period: usesClasseur ? "Nov 2024 traffic inputs" : "Pre-intervention city proxy",
      modeShare: {},
      dailyCycleCount: 0,
      peakCongestion: baselineIntensity / 100,
      avgSpeedKmh: Math.round(28 + (100 - baselineIntensity) * 0.12),
      co2ProxyKgDay: baselineCo2,
      trendCycle: [],
      trendCar: [],
    },
    intervention: {
      label: scenario === "comparison" ? "Comparison" : usesClasseur ? "Scenario (ASIF scaled)" : "Intervention (city)",
      period: usesClasseur ? "KPI reduction factor applied" : "Current city intensity",
      modeShare: {},
      dailyCycleCount: 0,
      peakCongestion: interventionIntensity / 100,
      avgSpeedKmh: Math.round(28 + (100 - interventionIntensity) * 0.12),
      co2ProxyKgDay: interventionCo2,
      trendCycle: [],
      trendCar: [],
    },
    timeline: [
      { date: "2022–2025", event: "City climate / pressure time series", status: "done" },
      { date: "Pilot 3", event: "GecoAir citizen awareness (app narrative)", status: "active" },
    ],
  };
}
