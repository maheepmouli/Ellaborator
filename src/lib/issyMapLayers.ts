import L from "leaflet";
import type { CityKPIData } from "@/data/kpiDefinitions";
import { generateHexbinData } from "@/data/kpiDefinitions";
import { buildClimateHexGrid, climateHexStyle } from "@/lib/issyClimateHexGrid";
import {
  COMPARISON_FAVOURABLE_COLOR,
  COMPARISON_OTHER_COLOR,
  type MapScenario,
} from "@/lib/junctionScenarioValues";
import { satisfactionFieldColor } from "@/lib/issyMapRouting";
import { resolveKpi32ScenarioIntensities } from "@/lib/kpi32YearIntensity";
import type { BicycleCountingRecord } from "@/types/bicycle-counting";
import type { CyclingInfrastructureRecord } from "@/types/cycling-infrastructure";
import { infrastructureChartLabelMatchesFeature } from "@/lib/infrastructureChartMapLink";
import { isParkingStyleFacility, lineLatLngs as facilityLineLatLngs } from "@/lib/issyFacilityMap";
import { resolveMapPointIconSpec, type MapPointIconSpec } from "@/lib/mapPointIconTaxonomy";
import { addJunctionFieldPointMarker } from "@/lib/junctionSampleMarkers";
import { createMapPointDivIcon, addNeonPointMarker } from "@/lib/mapPointIcons";
import { getSegmentHighlight } from "@/lib/segmentHighlight";
import {
  wirePolylineSegment,
  wireCircleMarkerSegment,
  type SegmentInteractionDetail,
  type SegmentInteractionHandlers,
} from "@/lib/wireMapSegmentInteraction";
import { pickNearestJunctionSegmentId } from "@/lib/renderIssyJunctionArms";
import { allocateClasseurCo2ToHexGrid } from "@/lib/issyClasseurEmissions";
import { ISSY_CLIMATE_CITY_ID, issyClimateHexSegmentId } from "@/lib/issyClimateHexObservatory";
import type { IssyClasseurEmissionsSnapshot } from "@/types/issy-workbooks";
import type { IssyAccessibilityPilotMock } from "@/data/issyAccessibilityMock";
import {
  ISSY_ACCESSIBILITY_MOCK_DISCLAIMER,
  issyAccessibilityFeaturesForScenario,
} from "@/data/issyAccessibilityMock";
import type { ScenarioType } from "@/types/normalized-city-data";
import type { IssySentimentPilotMock } from "@/data/issySentimentMock";
import { ISSY_SENTIMENT_MOCK_DISCLAIMER } from "@/data/issySentimentMock";
import { dataSourceTrustLabel } from "@/lib/issyDataTransparency";
import { provenanceBadgesHtml } from "@/lib/dataProvenance";
import {
  type IssyZoneModeSharePoint,
} from "@/lib/issyFlowAggregates";
import { renderHubRipplePulseOverlay } from "@/lib/copenhagenMapLayers/copenhagenTrafficPulse";

/** Neon tokens for KPI 3.1 dark-map styling */
const FACILITY_LINE_GLOW = "#2ecc71";
const FACILITY_LINE_CORE = "#6EE7B7";
const FACILITY_HUB_FILL = "#00ffff";
const FACILITY_LINE_MINT = "#34d399";
const FACILITY_LINE_AZURE = "#22d3ee";

export type IssyLayerRefs = {
  circles: Array<L.CircleMarker | L.Circle>;
  markers: L.Marker[];
  polylines: L.Polyline[];
  polygons: L.Polygon[];
};

function getValueColor(value: number, isSafety = false, infrastructureType?: string): string {
  if (infrastructureType) {
    const type = infrastructureType.toLowerCase();
    if (type.includes("bande") || type.includes("lane")) return "#10B981";
    if (type.includes("symbole")) return "#38BDF8";
    if (type.includes("piste")) return "#10B981";
    if (type.includes("verte")) return "#22C55E";
    if (type.includes("double")) return "#3B82F6";
    return "#96C2EF";
  }
  if (isSafety) {
    if (value >= 80) return "#2F1B6D";
    if (value >= 60) return "#657DF5";
    if (value >= 40) return "#8578C3";
    return "#D3E3FF";
  }
  if (value >= 80) return "#10B981";
  if (value >= 60) return "#38BDF8";
  if (value >= 40) return "#96C2EF";
  return "#D3E3FF";
}

/** KPI 3.2 — hex environmental field (climate-only map layer). */
function climateHexSegmentDetail(
  cellId: string,
  displayIntensity: number,
  baselineIntensity: number,
  delta: number
): SegmentInteractionDetail {
  return {
    segmentId: issyClimateHexSegmentId(cellId),
    segmentName: `Climate hex · ${displayIntensity.toFixed(0)}% pressure`,
    speed: null,
    congestion: displayIntensity / 100,
    properties: {
      cellId,
      displayIntensity,
      baselineIntensity,
      delta,
      datasetKind: "climate-hex",
    },
  };
}

function wireClimateHexCell(
  hex: L.Circle,
  detail: SegmentInteractionDetail,
  handlers: SegmentInteractionHandlers | undefined,
  baseStyle: { fillColor: string; fillOpacity: number; color: string; weight: number },
  options?: { selectedSegmentId?: string | null }
): void {
  if (!handlers) return;
  const isSelected = options?.selectedSegmentId === detail.segmentId;
  const dim =
    options?.selectedSegmentId && !isSelected ? 0.45 : 1;

  const applyBase = () => {
    hex.setStyle({
      fillColor: baseStyle.fillColor,
      fillOpacity: baseStyle.fillOpacity * dim,
      color: baseStyle.color,
      weight: isSelected ? baseStyle.weight + 1 : baseStyle.weight,
      opacity: dim < 1 ? 0.35 : 0.55,
    });
  };
  applyBase();

  hex.on("mouseover", () => {
    hex.setStyle({
      fillColor: baseStyle.fillColor,
      fillOpacity: Math.min(0.62, baseStyle.fillOpacity + 0.22),
      color: "#ffffff",
      weight: baseStyle.weight + 1.5,
      opacity: 1,
    });
    hex.bringToFront();
    handlers.onSegmentHover?.(detail);
    handlers.onSegmentFocus?.({
      segmentName: detail.segmentName,
      speed: detail.speed ?? null,
      congestion: detail.congestion ?? null,
    });
  });
  hex.on("mouseout", () => {
    applyBase();
    handlers.onSegmentHover?.(null);
  });
  hex.on("click", () => {
    handlers.onJunctionSegmentClick?.(detail);
    handlers.onSegmentFocus?.({
      segmentName: detail.segmentName,
      speed: detail.speed ?? null,
      congestion: detail.congestion ?? null,
    });
  });
}

export function renderIssyClimateHexField(
  map: L.Map,
  centerLat: number,
  centerLon: number,
  refs: IssyLayerRefs,
  options: {
    rings?: number;
    cellSizeM?: number;
    kpiRow?: CityKPIData;
    kpi32Year?: string | null;
    filterRange?: [number, number];
    scenario?: MapScenario;
    segmentHandlers?: SegmentInteractionHandlers;
    selectedSegmentId?: string | null;
    classeur?: IssyClasseurEmissionsSnapshot | null;
  } = {}
): number {
  const scenario = options.scenario ?? "intervention";
  const { baseline: seriesBaseline, intervention: seriesIntervention } =
    resolveKpi32ScenarioIntensities(options.kpiRow, options.kpi32Year ?? null);
  const interventionBase = seriesIntervention;
  const cells = buildClimateHexGrid(centerLat, centerLon, {
    rings: options.rings ?? 7,
    cellSizeM: options.cellSizeM ?? 58,
    baseIntensity: interventionBase,
  });
  const classeurAlloc = options.classeur
    ? allocateClasseurCo2ToHexGrid(cells, centerLat, centerLon, options.classeur, {
        kpiRow: options.kpiRow,
        kpi32Year: options.kpi32Year,
        scenario,
      })
    : null;

  let rendered = 0;
  cells.forEach((cell, idx) => {
    const alloc = classeurAlloc?.[idx];
    const intervention = alloc?.intensityPct ?? cell.intensity;
    const baseline = alloc
      ? Math.min(
          100,
          (alloc.baselineCo2GPerHour / (options.classeur!.totalBaselineCo2G * 0.55)) * 100
        )
      : Math.min(
          100,
          cell.intensity * (seriesBaseline / Math.max(seriesIntervention, 1))
        );
    const delta = alloc
      ? intervention - baseline
      : intervention - baseline;
    const displayIntensity =
      scenario === "baseline"
        ? baseline
        : scenario === "intervention"
          ? intervention
          : Math.abs(delta);

    if (options.filterRange) {
      const [lo, hi] = options.filterRange;
      if (displayIntensity < lo || displayIntensity > hi) return;
    }

    let style: { fillColor: string; fillOpacity: number; color: string; weight: number };
    if (scenario === "comparison") {
      const favourable = delta < 0;
      const color = favourable ? COMPARISON_FAVOURABLE_COLOR : COMPARISON_OTHER_COLOR;
      style = {
        fillColor: color,
        fillOpacity: Math.min(0.55, 0.28 + Math.abs(delta) / 120),
        color,
        weight: 1.5,
      };
    } else {
      style = climateHexStyle(displayIntensity);
    }

    const hex = L.circle([cell.lat, cell.lon], {
      radius: cell.radiusM,
      ...style,
      interactive: true,
    }).addTo(map);

    const usesClasseur = !!alloc;
    const displayCo2G = alloc?.displayCo2GPerHour;
    const scenarioNote =
      scenario === "comparison"
        ? usesClasseur && alloc
          ? `<p style="font-size:10px;color:#96C2EF;margin:2px 0">Baseline: ${Math.round(alloc.baselineCo2GPerHour)} g CO₂/h</p>
             <p style="font-size:10px;color:#96C2EF;margin:2px 0">Scenario: ${Math.round(alloc.interventionCo2GPerHour)} g CO₂/h</p>
             <p style="font-size:12px;font-weight:700;color:${delta < 0 ? COMPARISON_FAVOURABLE_COLOR : COMPARISON_OTHER_COLOR};margin:4px 0">
               Δ ${Math.round(alloc.interventionCo2GPerHour - alloc.baselineCo2GPerHour)} g CO₂/h
             </p>`
          : `<p style="font-size:10px;color:#96C2EF;margin:2px 0">Baseline: ${baseline.toFixed(1)}%</p>
             <p style="font-size:10px;color:#96C2EF;margin:2px 0">Intervention: ${intervention.toFixed(1)}%</p>
             <p style="font-size:12px;font-weight:700;color:${delta < 0 ? COMPARISON_FAVOURABLE_COLOR : COMPARISON_OTHER_COLOR};margin:4px 0">
               Δ ${delta >= 0 ? "+" : ""}${delta.toFixed(1)}
             </p>`
        : usesClasseur && displayCo2G != null
          ? `<p style="font-size:16px;font-weight:bold;color:#2F1B6D;margin:0">${Math.round(displayCo2G)} g CO₂/h</p>
             <p style="font-size:10px;color:#8578C3;margin:4px 0 0">ASIF model · ${options.classeur!.corridorLengthM} m corridor</p>`
          : `<p style="font-size:16px;font-weight:bold;color:#2F1B6D;margin:0">${displayIntensity.toFixed(1)}%</p>`;

    hex.bindPopup(`
      <div style="font-family:'DM Sans',sans-serif;padding:8px;min-width:160px">
        <p style="font-size:11px;color:#8578C3;margin:0 0 4px;text-transform:uppercase">${usesClasseur ? "Modelled CO₂ (ASIF)" : "Environmental pressure"}</p>
        ${scenarioNote}
        ${options.kpi32Year ? `<p style="font-size:10px;color:#A78BFA;margin-top:4px">Chart period ${options.kpi32Year}</p>` : ""}
        <p style="font-size:10px;color:#96C2EF;margin-top:4px">Hex cell · ${usesClasseur ? "Classeur workbook" : scenario === "baseline" ? "derived baseline" : scenario === "comparison" ? "comparison" : "intervention"}</p>
        <p style="font-size:10px;color:#96C2EF;margin-top:6px;font-weight:600">Hover for observatory</p>
      </div>
    `);
    wireClimateHexCell(
      hex,
      climateHexSegmentDetail(cell.id, displayIntensity, baseline, delta),
      options.segmentHandlers,
      style,
      { selectedSegmentId: options.selectedSegmentId }
    );
    refs.circles.push(hex);
    rendered++;
  });
  return rendered;
}

/**
 * KPI 3.2 — one city-wide climate reading (halo + hub).
 * Not a spatial hex field: partners supply a city intensity / optional ASIF total.
 */
export function renderIssyCityClimateReading(
  map: L.Map,
  cityLat: number,
  cityLon: number,
  refs: IssyLayerRefs,
  options: {
    kpiRow?: CityKPIData;
    kpi32Year?: string | null;
    filterRange?: [number, number];
    scenario?: MapScenario;
    segmentHandlers?: SegmentInteractionHandlers;
    selectedSegmentId?: string | null;
    classeur?: IssyClasseurEmissionsSnapshot | null;
  } = {}
): number {
  const scenario = options.scenario ?? "intervention";
  const { baseline, intervention } = resolveKpi32ScenarioIntensities(
    options.kpiRow,
    options.kpi32Year ?? null
  );
  const delta = intervention - baseline;
  const displayIntensity =
    scenario === "baseline"
      ? baseline
      : scenario === "comparison"
        ? Math.abs(delta)
        : intervention;

  if (options.filterRange) {
    const [lo, hi] = options.filterRange;
    if (displayIntensity < lo || displayIntensity > hi) return 0;
  }

  const style =
    scenario === "comparison"
      ? {
          fillColor: delta < 0 ? COMPARISON_FAVOURABLE_COLOR : COMPARISON_OTHER_COLOR,
          fillOpacity: 0.28,
          color: delta < 0 ? COMPARISON_FAVOURABLE_COLOR : COMPARISON_OTHER_COLOR,
          weight: 2,
        }
      : scenario === "intervention"
        ? {
            // Match observatory Intervention bar / legend "Medium" — not residual-intensity red.
            fillColor: "#FBBF24",
            fillOpacity: 0.3,
            color: "#FBBF24",
            weight: 1.5,
          }
        : climateHexStyle(displayIntensity);

  const usesClasseur = !!options.classeur;
  const detail: SegmentInteractionDetail = {
    segmentId: ISSY_CLIMATE_CITY_ID,
    segmentName: usesClasseur
      ? `Issy city climate · ${Math.round(options.classeur!.totalBaselineCo2G)} g CO₂/h`
      : `Issy city climate · ${displayIntensity.toFixed(0)}% pressure`,
    speed: null,
    congestion: displayIntensity / 100,
    properties: {
      displayIntensity,
      baselineIntensity: baseline,
      delta,
      datasetKind: "climate-city",
      cityWide: true,
    },
  };

  const halo = L.circle([cityLat, cityLon], {
    radius: 1400,
    fillColor: style.fillColor,
    fillOpacity: Math.min(0.32, style.fillOpacity + 0.08),
    color: style.color,
    weight: 1.5,
    opacity: 0.55,
    interactive: true,
  }).addTo(map);

  const hub = L.circleMarker([cityLat, cityLon], {
    radius: 14,
    fillColor: style.fillColor,
    fillOpacity: 0.95,
    color: "#ffffff",
    weight: 2,
    opacity: 1,
    interactive: true,
  }).addTo(map);

  const popupHtml = `
    <div style="font-family:'DM Sans',sans-serif;padding:8px;min-width:170px">
      <p style="font-size:11px;color:#8578C3;margin:0 0 4px;text-transform:uppercase">City-wide climate</p>
      <p style="font-size:16px;font-weight:bold;color:#2F1B6D;margin:0">${
        usesClasseur
          ? `${Math.round(options.classeur!.totalBaselineCo2G)} g CO₂/h`
          : `${displayIntensity.toFixed(1)}% pressure`
      }</p>
      ${
        options.kpi32Year
          ? `<p style="font-size:10px;color:#A78BFA;margin-top:4px">Chart period ${options.kpi32Year}</p>`
          : ""
      }
      <p style="font-size:10px;color:#96C2EF;margin-top:4px">${
        usesClasseur ? "ASIF model · city total" : "One reading for all of Issy · derived proxy"
      }</p>
      <p style="font-size:10px;color:#96C2EF;margin-top:6px;font-weight:600">Click for observatory</p>
    </div>`;

  halo.bindPopup(popupHtml);
  hub.bindPopup(popupHtml);

  const wireCity = (layer: L.Circle | L.CircleMarker) => {
    const handlers = options.segmentHandlers;
    if (!handlers) return;
    const isSelected =
      !options.selectedSegmentId || options.selectedSegmentId === ISSY_CLIMATE_CITY_ID;
    layer.setStyle?.({
      // circleMarker uses setStyle too
      opacity: isSelected ? 1 : 0.55,
    } as L.PathOptions);

    layer.on("mouseover", () => {
      handlers.onSegmentHover?.(detail);
      handlers.onSegmentFocus?.({
        segmentName: detail.segmentName,
        speed: null,
        congestion: detail.congestion ?? null,
      });
    });
    layer.on("mouseout", () => {
      handlers.onSegmentHover?.(null);
    });
    layer.on("click", () => {
      handlers.onJunctionSegmentClick?.(detail);
      handlers.onSegmentFocus?.({
        segmentName: detail.segmentName,
        speed: null,
        congestion: detail.congestion ?? null,
      });
    });
  };

  wireCity(halo);
  wireCity(hub);
  refs.circles.push(halo);
  refs.circles.push(hub);
  return 1;
}

/** KPI 4.1 — mock survey samples on corridor arms (GecoAir placeholder). */
export function renderIssySentimentField(
  map: L.Map,
  cityData: { lat: number; lon: number; kpiData: Record<string, CityKPIData | undefined> },
  refs: IssyLayerRefs,
  options: {
    localPoints?: Array<{ lat: number; lon: number; value: number; id?: string }>;
    filterRange?: [number, number];
    segmentHandlers?: SegmentInteractionHandlers;
    selectedSegmentId?: string | null;
    mockProfile?: IssySentimentPilotMock | null;
  } = {}
): void {
  const mockBadge = provenanceBadgesHtml([dataSourceTrustLabel("mock"), "KPI 4.1"]);
  const profile = options.mockProfile;
  const points =
    profile && profile.samples.length > 0
      ? profile.samples.map((sample, index) => ({
          lat: sample.lat,
          lon: sample.lon,
          value: options.localPoints?.[index]?.value ?? sample.satisfactionScore,
          id: sample.id,
          label: sample.label,
          dimension: sample.dimension,
          segmentId: sample.segmentId,
          armLabel: sample.armLabel,
          responseWindow: sample.responseWindow,
          isMock: true,
        }))
      : (options.localPoints && options.localPoints.length > 0
          ? options.localPoints
          : generateHexbinData(cityData, "kpi4.1", 48)
        ).map((point, index) => ({
          ...point,
          id: point.id ?? `sentiment-fallback-${index}`,
          label: `Survey sample ${index + 1}`,
          dimension: undefined,
          segmentId: pickNearestJunctionSegmentId(point.lat, point.lon),
          armLabel: undefined,
          responseWindow: undefined,
          isMock: false,
        }));

  points.forEach((point, i) => {
    if (options.filterRange) {
      const [lo, hi] = options.filterRange;
      if (point.value < lo || point.value > hi) return;
    }
    const color = satisfactionFieldColor(point.value);
    const hoverDetail = {
      segmentId: point.segmentId,
      segmentName: point.label,
      speed: null as number | null,
      congestion: null as number | null,
    };
    const mockNote = point.isMock
      ? `<p style="font-size:9px;color:#A78BFA;margin-top:6px;line-height:1.35">${ISSY_SENTIMENT_MOCK_DISCLAIMER}</p>`
      : "";
    const popupHtml = `
      <div style="font-family:'DM Sans',sans-serif;padding:8px;min-width:150px">
        ${point.isMock ? `<div style="margin-bottom:6px">${mockBadge}</div>` : ""}
        <p style="font-size:10px;color:#8578C3">${point.isMock ? "Mock survey sample" : `Survey point ${i + 1}`}</p>
        <p style="font-size:14px;font-weight:bold;color:#2F1B6D">${point.label}</p>
        ${point.dimension ? `<p style="font-size:10px;color:#96C2EF;margin-top:4px">${point.dimension}</p>` : ""}
        ${point.armLabel ? `<p style="font-size:10px;color:#96C2EF">${point.armLabel}</p>` : ""}
        ${point.responseWindow ? `<p style="font-size:10px;color:#96C2EF">${point.responseWindow}</p>` : ""}
        ${mockNote}
      </div>
    `;

    if (point.isMock) {
      const highlight = getSegmentHighlight(point.value, 55, 78, "safety");
      const layers = addJunctionFieldPointMarker(
        map,
        point.lat,
        point.lon,
        { ...highlight, color },
        hoverDetail,
        options.segmentHandlers,
        {
          hitRadius: 10,
          selectedSegmentId: options.selectedSegmentId,
          popupHtml,
          tooltip: point.label,
        }
      );
      refs.markers.push(layers.visual);
      refs.circles.push(layers.hit);
      return;
    }

    const blob = L.circle([point.lat, point.lon], {
      radius: 70 + (point.value / 100) * 35,
      fillColor: color,
      fillOpacity: point.isMock ? 0.1 : 0.14,
      color,
      weight: 1,
      opacity: point.isMock ? 0.35 : 0.45,
      interactive: false,
    }).addTo(map);
    blob.bindPopup(`
      <div style="font-family:'DM Sans',sans-serif;padding:8px;min-width:170px">
        ${point.isMock ? `<div style="margin-bottom:6px">${mockBadge}</div>` : ""}
        <p style="font-size:11px;color:#8578C3;margin:0 0 4px">${point.isMock ? "Mock survey zone" : "User satisfaction zone"}</p>
        <p style="font-size:16px;font-weight:bold;color:#2F1B6D;margin:0">${point.label}</p>
        ${point.dimension ? `<p style="font-size:10px;color:#96C2EF;margin-top:4px">${point.dimension}</p>` : ""}
        ${point.armLabel ? `<p style="font-size:10px;color:#96C2EF">${point.armLabel}</p>` : ""}
        ${point.responseWindow ? `<p style="font-size:10px;color:#96C2EF">${point.responseWindow}</p>` : ""}
        ${mockNote}
      </div>
    `);
    refs.circles.push(blob);

    const blobHit = L.circleMarker([point.lat, point.lon], {
      radius: 14,
      fillOpacity: 0,
      opacity: 0,
      weight: 0,
      interactive: true,
    }).addTo(map);
    if (options.segmentHandlers) {
      wireCircleMarkerSegment(blobHit, hoverDetail, options.segmentHandlers, {
        baseRadius: 14,
        highlightRadius: 17,
        selectedSegmentId: options.selectedSegmentId,
      });
    }
    refs.circles.push(blobHit);

    const pin = L.circleMarker([point.lat, point.lon], {
      radius: 5,
      fillColor: color,
      fillOpacity: 0.85,
      color: "#ffffff",
      weight: 1.5,
      interactive: true,
    }).addTo(map);
    pin.bindPopup(`
      <div style="font-family:'DM Sans',sans-serif;padding:8px;min-width:150px">
        ${point.isMock ? `<div style="margin-bottom:6px">${mockBadge}</div>` : ""}
        <p style="font-size:10px;color:#8578C3">${point.isMock ? "Mock survey sample" : `Survey point ${i + 1}`}</p>
        <p style="font-size:14px;font-weight:bold;color:#2F1B6D">${point.label}</p>
        ${point.dimension ? `<p style="font-size:10px;color:#96C2EF;margin-top:4px">${point.dimension}</p>` : ""}
        ${mockNote}
      </div>
    `);
    if (options.segmentHandlers) {
      wireCircleMarkerSegment(pin, hoverDetail, options.segmentHandlers, {
        baseRadius: 5,
        highlightRadius: 8,
        selectedSegmentId: options.selectedSegmentId,
      });
    }
    refs.circles.push(pin);
  });
}

/** KPI 4.2 — pilot mock assets on mode-share junction arms only. */
export function renderIssyAccessibilityField(
  map: L.Map,
  _centerLat: number,
  _centerLon: number,
  refs: IssyLayerRefs,
  _kpiValue = 55,
  options: {
    filterRange?: [number, number];
    segmentHandlers?: SegmentInteractionHandlers;
    selectedSegmentId?: string | null;
    mockProfile?: IssyAccessibilityPilotMock | null;
    scenario?: ScenarioType;
  } = {}
): void {
  const profile = options.mockProfile;
  const mockBadge = provenanceBadgesHtml([dataSourceTrustLabel("mock"), "KPI 4.2"]);
  const features = profile
    ? issyAccessibilityFeaturesForScenario(profile, options.scenario ?? "intervention")
    : [];
  features.forEach((feature) => {
    if (options.filterRange) {
      const [lo, hi] = options.filterRange;
      if (feature.qualityScore < lo || feature.qualityScore > hi) return;
    }
    const detail = {
      segmentId: feature.segmentId,
      segmentName: feature.label,
      speed: null as number | null,
      congestion: null as number | null,
    };
    const popup = `
      <div style="font-family:'DM Sans',sans-serif;padding:8px;min-width:170px">
        <div style="margin-bottom:6px">${mockBadge}</div>
        <p style="font-size:11px;color:#8578C3">${feature.category}</p>
        <p style="font-size:14px;font-weight:bold;color:#E8F8F5">${feature.label}</p>
        <p style="font-size:10px;color:#96C2EF">${feature.armLabel}</p>
        <p style="font-size:10px;color:#96C2EF">Status: ${feature.status.replace("-", " ")}</p>
        <p style="font-size:9px;color:#A78BFA;margin-top:6px;line-height:1.35">${ISSY_ACCESSIBILITY_MOCK_DISCLAIMER}</p>
      </div>
    `;
    const highlight = getSegmentHighlight(feature.qualityScore, 45, 75, "safety");
    const layers = addJunctionFieldPointMarker(
      map,
      feature.lat,
      feature.lon,
      highlight,
      detail,
      options.segmentHandlers,
      {
        hitRadius: 11,
        selectedSegmentId: options.selectedSegmentId,
        popupHtml: popup,
        tooltip: `${feature.category} · ${feature.armLabel} (mock)`,
      }
    );
    refs.markers.push(layers.visual);
    refs.circles.push(layers.hit);
  });
}

function facilityPopupHtml(props: {
  type_amgt_cycl: string;
  localisation?: string;
  longueur_m?: number;
  geometryLabel: string;
  qualityScore?: number;
}): string {
  return `
    <div style="font-family:'DM Sans',sans-serif;padding:8px;min-width:150px">
      <p style="font-size:11px;color:#8578C3">Zero-emission facility</p>
      <p style="font-size:15px;font-weight:bold;color:#E8F8F5">${props.type_amgt_cycl || "Infrastructure"}</p>
      ${props.localisation ? `<p style="font-size:10px;color:#96C2EF">${props.localisation}</p>` : ""}
      ${props.longueur_m != null ? `<p style="font-size:10px;color:#6EE7B7">${props.longueur_m.toFixed(0)} m · ${props.geometryLabel}</p>` : `<p style="font-size:10px;color:#6EE7B7">${props.geometryLabel}</p>`}
      ${props.qualityScore != null ? `<p style="font-size:10px;color:#7dd3fc">Observatory score: ${props.qualityScore.toFixed(0)}/100</p>` : ""}
    </div>
  `;
}

function facilityLinePalette(type: string): { glow: string; core: string; accent: string } {
  const label = type.toLowerCase();
  if (label.includes("piste")) {
    return { glow: FACILITY_LINE_GLOW, core: FACILITY_LINE_CORE, accent: FACILITY_LINE_MINT };
  }
  if (label.includes("bande") || label.includes("lane")) {
    return { glow: "#38bdf8", core: FACILITY_LINE_AZURE, accent: "#93c5fd" };
  }
  if (label.includes("double")) {
    return { glow: "#6366f1", core: "#818cf8", accent: "#a5b4fc" };
  }
  return { glow: FACILITY_LINE_GLOW, core: FACILITY_LINE_CORE, accent: FACILITY_LINE_AZURE };
}

function facilityObservatoryScore(row: CyclingInfrastructureRecord): number {
  const type = row.type_amgt_cycl.toLowerCase();
  const lengthScore = Math.min(45, Math.max(0, (row.longueur_m ?? 0) / 6));
  const facilityBonus =
    type.includes("piste") ? 38 : type.includes("bande") || type.includes("lane") ? 30 : type.includes("double") ? 24 : 18;
  const statusBonus = row.etat?.toLowerCase().includes("existant") ? 12 : 5;
  return Math.min(100, Math.max(10, lengthScore + facilityBonus + statusBonus));
}

/**
 * KPI 3.1 Issy needs deterministic icon classes even when API type labels vary.
 * Fallback defaults to shared mobility instead of generic dot markers.
 */
function resolveIssyFacilityIcon(typeLabel: string): MapPointIconSpec {
  const normalized = typeLabel.toLowerCase();
  if (
    normalized.includes("stationnement") ||
    normalized.includes("parking") ||
    normalized.includes("arceau")
  ) {
    return resolveMapPointIconSpec({ facilityCategory: "cycle parking" });
  }
  if (
    normalized.includes("borne") ||
    normalized.includes("charge") ||
    normalized.includes("recharge")
  ) {
    return resolveMapPointIconSpec({ facilityCategory: "charging" });
  }
  if (
    normalized.includes("pieton") ||
    normalized.includes("piéton") ||
    normalized.includes("walk") ||
    normalized.includes("pedestrian") ||
    normalized.includes("pictogram")
  ) {
    return resolveMapPointIconSpec({ facilityCategory: "pedestrian" });
  }
  if (
    normalized.includes("piste") ||
    normalized.includes("bande") ||
    normalized.includes("cycl")
  ) {
    return resolveMapPointIconSpec({ facilityCategory: "shared mobility" });
  }
  return resolveMapPointIconSpec({ facilityCategory: "shared mobility" });
}

export interface IssyFacilityRenderStats {
  pointCount: number;
  lineCount: number;
}

/** KPI 3.1 — facility points + cycling corridor linestrings (dual-pass glow). */
export function renderIssyFacilityLayers(
  map: L.Map,
  records: CyclingInfrastructureRecord[],
  refs: IssyLayerRefs,
  options: {
    filterRange?: [number, number];
    categoryFocus?: string | null;
    segmentHandlers?: SegmentInteractionHandlers;
    /** Junction study: plain survey dots instead of neon facility badges. */
    fieldSurveyMarkers?: boolean;
  } = {}
): IssyFacilityRenderStats {
  const stats: IssyFacilityRenderStats = { pointCount: 0, lineCount: 0 };
  const drawnLineIds = new Set<string>();

  records.forEach((row) => {
    const props = {
      type_amgt_cycl: row.type_amgt_cycl,
      localisation: row.localisation,
      longueur_m: row.longueur_m,
    };
    const observatoryScore = facilityObservatoryScore(row);
    const palette = facilityLinePalette(props.type_amgt_cycl || "");
    if (
      options.categoryFocus &&
      !infrastructureChartLabelMatchesFeature(props, options.categoryFocus)
    ) {
      return;
    }

    const value = 55;
    if (options.filterRange) {
      const [lo, hi] = options.filterRange;
      if (value < lo || value > hi) return;
    }

    const latLngs = facilityLineLatLngs(row);
    if (latLngs.length >= 2 && !drawnLineIds.has(row.id_circapaisee)) {
      drawnLineIds.add(row.id_circapaisee);
      const glow = L.polyline(latLngs, {
        color: palette.glow,
        weight: 12,
        opacity: 0.22,
        lineCap: "round",
        lineJoin: "round",
        interactive: false,
      }).addTo(map);
      const aura = L.polyline(latLngs, {
        color: palette.accent,
        weight: 7,
        opacity: 0.2,
        lineCap: "round",
        lineJoin: "round",
        interactive: false,
      }).addTo(map);
      const core = L.polyline(latLngs, {
        color: palette.core,
        weight: 3.5,
        opacity: 0.95,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);
      const popup = facilityPopupHtml({
        ...props,
        geometryLabel: "Cycling corridor",
        qualityScore: observatoryScore,
      });
      glow.bindPopup(popup);
      aura.bindPopup(popup);
      core.bindPopup(popup);
      if (options.segmentHandlers) {
        wirePolylineSegment(
          core,
          {
            segmentId: `infra:${row.id_circapaisee}:line`,
            segmentName: props.localisation || props.type_amgt_cycl || "Cycling corridor",
            congestion: observatoryScore / 100,
          },
          options.segmentHandlers,
          {
            baseStyle: {
              color: palette.core,
              weight: 3.5,
              opacity: 0.95,
            },
            highlightStyle: {
              color: FACILITY_HUB_FILL,
              weight: 6,
              opacity: 1,
            },
          }
        );
      }
      refs.polylines.push(glow, aura, core);
      stats.lineCount += 1;
    }

    const pt = row.geo_point_2d;
    if (!pt) return;

    const isHub = isParkingStyleFacility(row);
    const lineColor = getValueColor(value, false, props.type_amgt_cycl);
    const fill = isHub ? FACILITY_HUB_FILL : lineColor;
    const iconSpec = resolveIssyFacilityIcon(props.type_amgt_cycl || "");
    const segmentDetail = {
      segmentId: `infra:${row.id_circapaisee}:point`,
      segmentName: `${iconSpec.label} · ${props.localisation || props.type_amgt_cycl || "Facility node"}`,
      congestion: observatoryScore / 100,
    };
    const popup = facilityPopupHtml({
      ...props,
      geometryLabel: isHub ? "Parking / hub node" : "Facility centroid",
      qualityScore: observatoryScore,
    });
    if (options.fieldSurveyMarkers) {
      const highlight = getSegmentHighlight(observatoryScore, 40, 72, "safety");
      const layers = addJunctionFieldPointMarker(
        map,
        pt.lat,
        pt.lon,
        highlight,
        segmentDetail,
        options.segmentHandlers,
        {
          hitRadius: isHub ? 12 : 10,
          zIndexOffset: isHub ? 800 : 760,
          popupHtml: popup,
          tooltip: `${iconSpec.label} · ${props.localisation ?? props.type_amgt_cycl}`,
        }
      );
      refs.markers.push(layers.visual);
      refs.circles.push(layers.hit);
      stats.pointCount += 1;
      return;
    }
    const { visual: marker, hit: hitTarget } = addNeonPointMarker(
      map,
      pt.lat,
      pt.lon,
      iconSpec,
      segmentDetail,
      options.segmentHandlers,
      {
        title: `${iconSpec.label} · ${props.localisation ?? props.type_amgt_cycl}`,
        hitRadius: isHub ? 14 : 12,
        popupHtml: popup,
        zIndexOffset: isHub ? 920 : 880,
      }
    );
    if (isHub) {
      const ring = L.circleMarker([pt.lat, pt.lon], {
        radius: (options.categoryFocus ? 9 : 8) + 4,
        fillColor: FACILITY_HUB_FILL,
        fillOpacity: 0.12,
        color: FACILITY_HUB_FILL,
        weight: 1,
        opacity: 0.45,
        interactive: false,
      }).addTo(map);
      refs.circles.push(ring);
    }
    refs.markers.push(marker);
    refs.circles.push(hitTarget);
    stats.pointCount += 1;
  });

  return stats;
}

/** @deprecated Use renderIssyFacilityLayers */
export function renderIssyFacilityPoints(
  map: L.Map,
  records: CyclingInfrastructureRecord[],
  refs: IssyLayerRefs,
  options: {
    filterRange?: [number, number];
    categoryFocus?: string | null;
  } = {}
): number {
  const { pointCount, lineCount } = renderIssyFacilityLayers(map, records, refs, options);
  return pointCount + lineCount;
}

/** KPI 1.2 — movement observation nodes (bike counters / proxies). */
export function renderIssyMovementNodes(
  map: L.Map,
  records: BicycleCountingRecord[],
  refs: IssyLayerRefs,
  options: {
    filterRange?: [number, number];
    segmentHandlers?: SegmentInteractionHandlers;
  } = {}
): number {
  let n = 0;
  records.forEach((row) => {
    const v = row.sum_counts ?? 0;
    const intensity = Math.min(100, v / 4);
    if (options.filterRange) {
      const [lo, hi] = options.filterRange;
      if (intensity < lo || intensity > hi) return;
    }
    const iconSpec = resolveMapPointIconSpec({ category: "cycle parking", type: "bicycle counter" });
    const { visual, hit } = addNeonPointMarker(
      map,
      row.coordinates.lat,
      row.coordinates.lon,
      iconSpec,
      {
        segmentId: `bike-counter:${row.counter ?? n}`,
        segmentName: `Movement node · ${v} passages`,
        congestion: intensity / 100,
      },
      options.segmentHandlers,
      {
        hitRadius: 11,
        popupHtml: `
      <div style="font-family:'DM Sans',sans-serif;padding:6px">
        <p style="font-size:10px;color:#8578C3">Movement node</p>
        <p style="font-size:14px;font-weight:bold;color:#2F1B6D">${v} passages</p>
      </div>
    `,
      }
    );
    refs.markers.push(visual);
    refs.circles.push(hit);
    n++;
  });
  return n;
}

/** Issy Pilot 2 — city-wide sustainable mobility hubs (Copenhagen ripple style, no FOV). */
export function renderIssyCityModeShareZones(
  map: L.Map,
  zonePoints: IssyZoneModeSharePoint[],
  refs: IssyLayerRefs,
  options: {
    scenario?: MapScenario;
    segmentHandlers?: SegmentInteractionHandlers;
    selectedSegmentId?: string | null;
    filterRange?: [number, number];
  } = {}
): void {
  const scenario = options.scenario ?? "intervention";

  zonePoints.forEach((zone) => {
    const displayPct =
      scenario === "baseline"
        ? zone.baselineSustainablePct
        : scenario === "comparison"
          ? Math.abs(zone.deltaPp)
          : zone.interventionSustainablePct;
    if (options.filterRange) {
      const [lo, hi] = options.filterRange;
      const comparePct =
        scenario === "comparison" ? zone.interventionSustainablePct : displayPct;
      if (comparePct < lo || comparePct > hi) return;
    }

    const sustainablePct =
      scenario === "baseline" ? zone.baselineSustainablePct : zone.interventionSustainablePct;
    // Match Copenhagen hub palette: red = pressured / low sustainable, blue = healthier share.
    const isLowSustainable = sustainablePct < 35;
    const segmentId = `issy-zone-${zone.zone}`;
    const segmentName = `${zone.label} · ${
      scenario === "comparison"
        ? `${zone.deltaPp >= 0 ? "+" : ""}${zone.deltaPp.toFixed(1)} pp`
        : `${displayPct.toFixed(1)}% sustainable`
    }`;

    renderHubRipplePulseOverlay(
      map,
      zone.lat,
      zone.lon,
      isLowSustainable,
      refs.markers,
      refs.circles as L.CircleMarker[],
      {
        showAnchorDot: true,
        ringScale: 0.65,
        minZoom: 11,
        interaction: options.segmentHandlers
          ? {
              segmentId,
              segmentName,
              segmentHandlers: options.segmentHandlers,
              selectedSegmentId: options.selectedSegmentId,
              wireCircleMarker: wireCircleMarkerSegment,
            }
          : undefined,
      }
    );

    // Tooltip on the hub center just added (last circle in refs).
    const hub = refs.circles[refs.circles.length - 1];
    if (hub && "bindTooltip" in hub) {
      hub.bindTooltip(segmentName, {
        direction: "top",
        opacity: 1,
        className: "tri-segment-tooltip",
      });
    }
  });
}
