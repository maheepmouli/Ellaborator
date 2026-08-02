import L from "leaflet";
import { loadHelsinkiDangerousLocationsGeoJson } from "@/services/staticGeoData";
import {
  fetchHelsinkiJson,
  HELSINKI_DANGEROUS_LOCATIONS_SURVEY_INSIGHTS_JSON,
  HELSINKI_TELRAAM_KOETILANTIE_JSON,
  type HelsinkiDangerousLocationsSurveyInsights,
  type HelsinkiTelraamKoetilantie,
} from "@/lib/helsinkiDataPaths";
import { bindCopenhagenMapTooltip } from "@/lib/copenhagenMapLayers/copenhagenMapTooltips";
import { fitHelsinkiKpiView } from "@/lib/helsinkiMapLayers/helsinkiKpiMapFit";
import {
  mapScenarioDisplayValue,
  type MapScenario,
} from "@/lib/mapScenarioValue";
import {
  wireCircleMarkerSegment,
  type SegmentInteractionHandlers,
} from "@/lib/wireMapSegmentInteraction";

const HELSINKI_CLIMATE_MAX_POINTS = 220;
const HELSINKI_CLIMATE_CELL_DEG = 0.008;
const HELSINKI_ATTITUDE_HUB = { lat: 60.1699, lng: 24.9384 } as const;

/** Matches CLIMATE_ZONE_ITEMS ramp — higher pressure = warmer. */
function climatePressureColor(score0to100: number): string {
  const t = Math.max(0, Math.min(100, score0to100)) / 100;
  if (t < 0.33) return "#6EE7B7";
  if (t < 0.55) return "#FBBF24";
  if (t < 0.78) return "#F97316";
  return "#E02020";
}

export interface RenderHelsinkiKpi32LayersOptions {
  map: L.Map;
  scenario?: MapScenario;
  selectedPilotId?: string | null;
  activeMapSegmentId?: string | null;
  segmentInteractionEnabled: boolean;
  segmentHandlers: SegmentInteractionHandlers;
  circlesOut: L.CircleMarker[];
  markersOut: L.Marker[];
}

type ClimatePoint = {
  id: string;
  lat: number;
  lon: number;
  label: string;
  baselineScore: number;
  interventionScore: number;
  note: string;
  radius: number;
};

function sampleEvenly<T>(items: T[], limit: number): T[] {
  if (items.length <= limit) return items;
  const step = items.length / limit;
  const out: T[] = [];
  for (let i = 0; i < limit; i += 1) {
    out.push(items[Math.floor(i * step)]!);
  }
  return out;
}

function drawClimatePoint(options: {
  map: L.Map;
  point: ClimatePoint;
  scenario: MapScenario;
  activeMapSegmentId?: string | null;
  segmentInteractionEnabled: boolean;
  segmentHandlers: SegmentInteractionHandlers;
  circlesOut: L.CircleMarker[];
}): void {
  const {
    map,
    point,
    scenario,
    activeMapSegmentId,
    segmentInteractionEnabled,
    segmentHandlers,
    circlesOut,
  } = options;

  const score = mapScenarioDisplayValue(
    scenario,
    point.baselineScore,
    point.interventionScore,
    { kind: "pressure", singlePeriodShift: 0.2 }
  );
  const color = climatePressureColor(score);
  const selected = Boolean(activeMapSegmentId && activeMapSegmentId === point.id);
  const radius = selected ? point.radius + 2 : point.radius;
  const delta = point.interventionScore - point.baselineScore;

  const marker = L.circleMarker([point.lat, point.lon], {
    radius,
    fillColor: color,
    fillOpacity: 0.78,
    color: selected ? "#ffffff" : "rgba(255,255,255,0.55)",
    weight: selected ? 2 : 0.7,
    opacity: 0.95,
  }).addTo(map);

  bindCopenhagenMapTooltip(marker, point.label);
  marker.bindPopup(`
    <div style="font-family:'DM Sans',sans-serif;padding:8px;min-width:200px;">
      <p style="font-size:10px;color:#8578C3;margin:0 0 4px 0;text-transform:uppercase;">FVH1 · KPI 3.2 climate · MOCK · ${scenario}</p>
      <p style="font-size:14px;font-weight:700;color:#2F1B6D;margin:0 0 6px 0;">${point.label}</p>
      <p style="font-size:18px;font-weight:700;color:${color};margin:4px 0;">Pressure ${score.toFixed(0)}</p>
      <p style="font-size:10px;color:#96C2EF;margin:2px 0;">Baseline ${point.baselineScore.toFixed(0)} → Intervention ${point.interventionScore.toFixed(0)} (Δ ${delta >= 0 ? "+" : ""}${delta.toFixed(0)})</p>
      <p style="font-size:10px;color:#96C2EF;margin:2px 0;">${point.note}</p>
    </div>
  `);

  if (segmentInteractionEnabled) {
    wireCircleMarkerSegment(
      marker,
      {
        segmentId: point.id,
        segmentName: point.label,
        speed: null,
        congestion: score,
        properties: { lat: point.lat, lon: point.lon, datasetKind: "safety-attitude-survey" },
      },
      segmentHandlers,
      {
        baseRadius: point.radius,
        selectedSegmentId: activeMapSegmentId,
      }
    );
  }

  circlesOut.push(marker);
}

/**
 * KPI 3.2 climate — mock colour-rated points (no hub ripples).
 * Colours follow Baseline / Intervention / Comparison scenario.
 */
export function renderHelsinkiKpi32Layers(
  options: RenderHelsinkiKpi32LayersOptions
): Promise<void> {
  const {
    map,
    scenario = "baseline",
    selectedPilotId,
    activeMapSegmentId,
    segmentInteractionEnabled,
    segmentHandlers,
    circlesOut,
  } = options;
  const pilotId = selectedPilotId ?? "hel-p1";

  return Promise.all([
    loadHelsinkiDangerousLocationsGeoJson(),
    fetchHelsinkiJson<HelsinkiDangerousLocationsSurveyInsights>(
      HELSINKI_DANGEROUS_LOCATIONS_SURVEY_INSIGHTS_JSON
    ),
    fetchHelsinkiJson<HelsinkiTelraamKoetilantie>(HELSINKI_TELRAAM_KOETILANTIE_JSON),
  ]).then(([dangerous, attitude, telraam]) => {
    const positivePct = attitude?.ratesTrafficSafetyPositivelyPct ?? 60;
    // Attitude-adjusted relief: higher positive climate → lower intervention pressure.
    const relief = Math.max(0.12, Math.min(0.28, positivePct / 250));

    const cellCounts = new Map<string, number>();
    const rawPoints: Array<{ lat: number; lon: number; cell: string }> = [];

    dangerous.features.forEach((feature) => {
      if (feature.geometry?.type !== "Point") return;
      const coordinates = feature.geometry.coordinates;
      if (!Array.isArray(coordinates) || coordinates.length < 2) return;
      const lon = Number(coordinates[0]);
      const lat = Number(coordinates[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
      const row = Math.round(lat / HELSINKI_CLIMATE_CELL_DEG);
      const col = Math.round(lon / HELSINKI_CLIMATE_CELL_DEG);
      const cell = `${row}_${col}`;
      cellCounts.set(cell, (cellCounts.get(cell) ?? 0) + 1);
      rawPoints.push({ lat, lon, cell });
    });

    const maxCell = Math.max(1, ...cellCounts.values());
    const sampled = sampleEvenly(rawPoints, HELSINKI_CLIMATE_MAX_POINTS);
    const climatePoints: ClimatePoint[] = sampled.map((pt, index) => {
      const density = cellCounts.get(pt.cell) ?? 1;
      const baselineScore = Number(((density / maxCell) * 100).toFixed(1));
      const interventionScore = Number((baselineScore * (1 - relief)).toFixed(1));
      return {
        id: `hel-climate-pt-${index + 1}`,
        lat: pt.lat,
        lon: pt.lon,
        label: `Climate-proxy sample point ${index + 1}`,
        baselineScore,
        interventionScore,
        note: `Mock climate pressure from local hazard density ${density} (not ambient CO₂ and not a direct mobility sensor).`,
        radius: 3.5 + (baselineScore / 100) * 2.5,
      };
    });

    if (pilotId === "hel-p3" && attitude) {
      const positive = attitude.ratesTrafficSafetyPositivelyPct ?? 0;
      const negative = attitude.ratesTrafficSafetyNegativelyPct ?? 0;
      const baselineScore = Math.max(
        0,
        Math.min(100, negative * 1.6 + (100 - positive) * 0.35)
      );
      const interventionScore = Math.max(0, baselineScore * (1 - relief));
      climatePoints.push({
        id: "hel-safety-attitude-survey",
        lat: HELSINKI_ATTITUDE_HUB.lat,
        lon: HELSINKI_ATTITUDE_HUB.lng,
        label: "Citywide safety-climate attitude",
        baselineScore,
        interventionScore,
        note: `${positive.toFixed(1)}% positive · ${negative.toFixed(1)}% negative · n=${attitude.totalRespondents.toLocaleString()}`,
        radius: 9,
      });
    }

    if (pilotId === "hel-p3" && telraam) {
      const carPct = telraam.modeShare.carPct;
      const sustainablePct = telraam.modeShare.bikePct + telraam.modeShare.pedestrianPct;
      climatePoints.push({
        id: telraam.sensorId,
        lat: telraam.location.lat,
        lon: telraam.location.lng,
        label: `Telraam ${telraam.street}`,
        baselineScore: Math.max(0, Math.min(100, carPct)),
        interventionScore: Math.max(0, Math.min(100, carPct * (1 - relief))),
        note: `Motor intensity ${carPct}% · sustainable ${sustainablePct.toFixed(1)}% (proxy)`,
        radius: 8,
      });
    }

    climatePoints.forEach((point) => {
      drawClimatePoint({
        map,
        point,
        scenario,
        activeMapSegmentId,
        segmentInteractionEnabled,
        segmentHandlers,
        circlesOut,
      });
    });

    fitHelsinkiKpiView(
      map,
      climatePoints.map((p) => ({ lat: p.lat, lon: p.lon })),
      "climate-city"
    );
  });
}
