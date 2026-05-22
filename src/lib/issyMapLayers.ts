import L from "leaflet";
import type { CityKPIData } from "@/data/kpiDefinitions";
import { generateHexbinData } from "@/data/kpiDefinitions";
import { buildClimateHexGrid, climateHexStyle } from "@/lib/issyClimateHexGrid";
import {
  COMPARISON_FAVOURABLE_COLOR,
  COMPARISON_OTHER_COLOR,
  type MapScenario,
} from "@/lib/junctionScenarioValues";
import { ISSY_MODE_COLORS, satisfactionFieldColor } from "@/lib/issyMapRouting";
import { generateIsochrones } from "@/services/areaGenerator";
import { getKpi32TimeSeriesIntensity } from "@/lib/kpi32YearIntensity";
import type { BicycleCountingRecord } from "@/types/bicycle-counting";
import type { CyclingInfrastructureRecord } from "@/types/cycling-infrastructure";
import { infrastructureChartLabelMatchesFeature } from "@/lib/infrastructureChartMapLink";

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

/** KPI 3.2 — hex environmental field. */
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
  } = {}
): number {
  const scenario = options.scenario ?? "intervention";
  const yearAnchor = getKpi32TimeSeriesIntensity(options.kpiRow, options.kpi32Year ?? null);
  const interventionBase = yearAnchor ?? options.kpiRow?.mainValue ?? 52;
  const cells = buildClimateHexGrid(centerLat, centerLon, {
    rings: options.rings ?? 7,
    cellSizeM: options.cellSizeM ?? 58,
    baseIntensity: interventionBase,
  });

  let rendered = 0;
  cells.forEach((cell, idx) => {
    const intervention = cell.intensity;
    const baseline = Math.min(100, intervention * (1.08 + (idx % 5) * 0.02));
    const delta = intervention - baseline;
    const displayIntensity =
      scenario === "baseline" ? baseline : scenario === "intervention" ? intervention : Math.abs(delta);

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

    const scenarioNote =
      scenario === "comparison"
        ? `<p style="font-size:10px;color:#96C2EF;margin:2px 0">Baseline: ${baseline.toFixed(1)}%</p>
           <p style="font-size:10px;color:#96C2EF;margin:2px 0">Intervention: ${intervention.toFixed(1)}%</p>
           <p style="font-size:12px;font-weight:700;color:${delta < 0 ? COMPARISON_FAVOURABLE_COLOR : COMPARISON_OTHER_COLOR};margin:4px 0">
             Δ ${delta >= 0 ? "+" : ""}${delta.toFixed(1)}
           </p>`
        : `<p style="font-size:16px;font-weight:bold;color:#2F1B6D;margin:0">${displayIntensity.toFixed(1)}%</p>`;

    hex.bindPopup(`
      <div style="font-family:'DM Sans',sans-serif;padding:8px;min-width:160px">
        <p style="font-size:11px;color:#8578C3;margin:0 0 4px;text-transform:uppercase">Environmental pressure</p>
        ${scenarioNote}
        ${options.kpi32Year ? `<p style="font-size:10px;color:#A78BFA;margin-top:4px">Chart year ${options.kpi32Year}</p>` : ""}
        <p style="font-size:10px;color:#96C2EF;margin-top:4px">Hex cell · ${scenario === "baseline" ? "derived baseline" : scenario === "comparison" ? "comparison" : "intervention"}</p>
      </div>
    `);
    refs.circles.push(hex);
    rendered++;
  });
  return rendered;
}

/** KPI 4.1 — soft sentiment blobs + survey points. */
export function renderIssySentimentField(
  map: L.Map,
  cityData: { lat: number; lon: number; kpiData: Record<string, CityKPIData | undefined> },
  refs: IssyLayerRefs,
  options: {
    localPoints?: Array<{ lat: number; lon: number; value: number }>;
    filterRange?: [number, number];
  } = {}
): void {
  const points =
    options.localPoints && options.localPoints.length > 0
      ? options.localPoints
      : generateHexbinData(cityData, "kpi4.1", 48);

  points.forEach((point, i) => {
    if (options.filterRange) {
      const [lo, hi] = options.filterRange;
      if (point.value < lo || point.value > hi) return;
    }
    const color = satisfactionFieldColor(point.value);
    const blob = L.circle([point.lat, point.lon], {
      radius: 95 + (point.value / 100) * 45,
      fillColor: color,
      fillOpacity: 0.14,
      color,
      weight: 1,
      opacity: 0.45,
      interactive: true,
    }).addTo(map);
    blob.bindPopup(`
      <div style="font-family:'DM Sans',sans-serif;padding:8px;min-width:150px">
        <p style="font-size:11px;color:#8578C3;margin:0 0 4px">User satisfaction zone</p>
        <p style="font-size:16px;font-weight:bold;color:#2F1B6D;margin:0">${point.value.toFixed(1)} / 100</p>
        <p style="font-size:10px;color:#96C2EF;margin-top:4px">Aggregated perception · soft field</p>
      </div>
    `);
    refs.circles.push(blob);

    const pin = L.circleMarker([point.lat, point.lon], {
      radius: 5,
      fillColor: color,
      fillOpacity: 0.85,
      color: "#ffffff",
      weight: 1.5,
    }).addTo(map);
    pin.bindPopup(`
      <div style="font-family:'DM Sans',sans-serif;padding:6px">
        <p style="font-size:10px;color:#8578C3">Survey point ${i + 1}</p>
        <p style="font-size:14px;font-weight:bold;color:#2F1B6D">${point.value.toFixed(1)}</p>
      </div>
    `);
    refs.circles.push(pin);
  });
}

/** KPI 4.2 — isochrone reach + access nodes. */
export function renderIssyAccessibilityField(
  map: L.Map,
  centerLat: number,
  centerLon: number,
  refs: IssyLayerRefs,
  kpiValue = 55,
  options: { filterRange?: [number, number] } = {}
): void {
  const areas = generateIsochrones(centerLat, centerLon, [5, 10, 15], kpiValue);

  areas.forEach((area) => {
    if (options.filterRange) {
      const [lo, hi] = options.filterRange;
      if (area.value < lo || area.value > hi) return;
    }
    const color = getValueColor(area.value);
    const polygon = L.polygon(area.coordinates, {
      fillColor: color,
      fillOpacity: 0.12 + (area.value / 100) * 0.18,
      color: "#22D3EE",
      weight: 2,
      opacity: 0.7,
      dashArray: area.properties?.radius && area.properties.radius > 3 ? "4 6" : undefined,
    }).addTo(map);
    polygon.bindPopup(`
      <div style="font-family:'DM Sans',sans-serif;padding:8px">
        <p style="font-size:11px;color:#8578C3">Accessibility reach</p>
        <p style="font-size:16px;font-weight:bold;color:#2F1B6D">${area.value.toFixed(1)} score</p>
        ${area.properties?.radius ? `<p style="font-size:10px;color:#96C2EF">~${area.properties.radius.toFixed(1)} km band</p>` : ""}
      </div>
    `);
    refs.polygons.push(polygon);
  });

  const hub = L.circleMarker([centerLat, centerLon], {
    radius: 8,
    fillColor: "#22D3EE",
    fillOpacity: 0.9,
    color: "#ffffff",
    weight: 2,
  }).addTo(map);
  hub.bindPopup(`<strong>Access hub</strong><br/>Junction / pilot anchor`);
  refs.circles.push(hub);
}

/** KPI 3.1 — facility points (glow POIs). */
export function renderIssyFacilityPoints(
  map: L.Map,
  records: CyclingInfrastructureRecord[],
  refs: IssyLayerRefs,
  options: {
    filterRange?: [number, number];
    categoryFocus?: string | null;
  } = {}
): number {
  let n = 0;
  records.forEach((row) => {
    const pt = row.geo_point_2d;
    if (!pt) return;
    const value = 55;
    if (options.filterRange) {
      const [lo, hi] = options.filterRange;
      if (value < lo || value > hi) return;
    }
    const props = {
      type_amgt_cycl: row.type_amgt_cycl,
      localisation: row.localisation,
      longueur_m: row.longueur_m,
    };
    if (
      options.categoryFocus &&
      !infrastructureChartLabelMatchesFeature(props, options.categoryFocus)
    ) {
      return;
    }
    const color = getValueColor(value, false, props.type_amgt_cycl);
    const marker = L.circleMarker([pt.lat, pt.lon], {
      radius: options.categoryFocus ? 9 : 7,
      fillColor: color,
      fillOpacity: 0.92,
      color: "#ffffff",
      weight: 2,
      opacity: 1,
    }).addTo(map);
    marker.bindPopup(`
      <div style="font-family:'DM Sans',sans-serif;padding:8px;min-width:150px">
        <p style="font-size:11px;color:#8578C3">Zero-emission facility</p>
        <p style="font-size:15px;font-weight:bold;color:#2F1B6D">${props.type_amgt_cycl || "Infrastructure"}</p>
        ${props.localisation ? `<p style="font-size:10px;color:#96C2EF">${props.localisation}</p>` : ""}
      </div>
    `);
    refs.circles.push(marker);
    n++;
  });
  return n;
}

/** KPI 1.2 — movement observation nodes (bike counters / proxies). */
export function renderIssyMovementNodes(
  map: L.Map,
  records: BicycleCountingRecord[],
  refs: IssyLayerRefs,
  options: { filterRange?: [number, number] } = {}
): number {
  let n = 0;
  records.forEach((row) => {
    const v = row.sum_counts ?? 0;
    const intensity = Math.min(100, v / 4);
    if (options.filterRange) {
      const [lo, hi] = options.filterRange;
      if (intensity < lo || intensity > hi) return;
    }
    const color = ISSY_MODE_COLORS.cycle;
    const size = Math.max(6, Math.min(14, 5 + intensity / 12));
    const dot = L.circleMarker([row.coordinates.lat, row.coordinates.lon], {
      radius: size,
      fillColor: color,
      fillOpacity: 0.88,
      color: "#ffffff",
      weight: 2,
      opacity: 1,
    }).addTo(map);
    dot.bindPopup(`
      <div style="font-family:'DM Sans',sans-serif;padding:6px">
        <p style="font-size:10px;color:#8578C3">Movement node</p>
        <p style="font-size:14px;font-weight:bold;color:#2F1B6D">${v} passages</p>
      </div>
    `);
    refs.circles.push(dot);
    n++;
  });
  return n;
}
