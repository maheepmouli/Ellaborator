import L from "leaflet";
import { bindCopenhagenMapTooltip } from "@/lib/copenhagenMapLayers/copenhagenMapTooltips";
import { scheduleLeafletLayerRepaint } from "@/lib/leafletMapSync";
import { MILAN_PILOT_ANCHORS } from "@/lib/milanMapConfig";
import {
  mapScenarioDisplayValue,
  type MapScenario,
} from "@/lib/mapScenarioValue";
import type { LocalCityPoint } from "@/services/localCityData";
import {
  wireCircleMarkerSegment,
  type SegmentInteractionHandlers,
} from "@/lib/wireMapSegmentInteraction";

export interface RenderMilanKpi11LayersOptions {
  map: L.Map;
  points: LocalCityPoint[];
  scenario?: MapScenario;
  activeMapSegmentId?: string | null;
  segmentInteractionEnabled: boolean;
  segmentHandlers: SegmentInteractionHandlers;
  circlesOut: Array<L.CircleMarker | L.Circle>;
  markersOut: L.Marker[];
  fitMap?: (coords: Array<[number, number]>) => void;
}

function expansionColor(score: number): string {
  if (score >= 70) return "#2ecc71";
  if (score >= 45) return "#38bdf8";
  return "#f59e0b";
}

/**
 * KPI 1.1 (CDM3 / mil-p3) — expansion readiness hub from the Intervention Evaluation Plan.
 */
export function renderMilanKpi11Layers(options: RenderMilanKpi11LayersOptions): number {
  const {
    map,
    points,
    scenario = "baseline",
    activeMapSegmentId,
    segmentInteractionEnabled,
    segmentHandlers,
    circlesOut,
    markersOut,
    fitMap,
  } = options;

  const expansion =
    points.find((p) => p.properties?.datasetKind === "expansion-plan") ??
    points[0];
  const anchor = MILAN_PILOT_ANCHORS["mil-p3"];
  const lat = expansion?.lat ?? anchor.lat;
  const lon = expansion?.lon ?? anchor.lon;
  const baseline = Number(expansion?.properties?.baselineValue ?? expansion?.value ?? 35);
  const intervention = Number(
    expansion?.properties?.interventionValue ?? expansion?.value ?? 72
  );
  const display = mapScenarioDisplayValue(scenario, baseline, intervention, {
    kind: "benefit",
    singlePeriodShift: 0.18,
  });
  const color = expansionColor(display);
  const segmentId = String(
    expansion?.properties?.segmentId ?? "mil-p3-expansion-hub"
  );
  const selected = activeMapSegmentId === segmentId;

  const field = L.circle([lat, lon], {
    radius: 900,
    color: "#94a3b8",
    weight: 1,
    opacity: 0.45,
    fillColor: color,
    fillOpacity: 0.08,
    interactive: false,
  }).addTo(map);
  circlesOut.push(field);

  const hub = L.circleMarker([lat, lon], {
    radius: selected ? 13 : 11,
    fillColor: color,
    fillOpacity: 0.9,
    color: "#ffffff",
    weight: 2.2,
    opacity: 0.98,
  }).addTo(map);

  bindCopenhagenMapTooltip(hub, "CDM3 expansion readiness (KPI 1.1)");
  hub.bindPopup(`
    <div style="font-family:'DM Sans',sans-serif;padding:8px;min-width:230px;">
      <p style="font-size:10px;color:#8578C3;margin:0 0 4px 0;text-transform:uppercase;">CDM3 · KPI 1.1 · ${scenario}</p>
      <p style="font-size:14px;font-weight:700;color:#2F1B6D;margin:0 0 6px 0;">DSS expansion readiness hub</p>
      <p style="font-size:18px;font-weight:700;color:${color};margin:4px 0;">Readiness ${display.toFixed(0)}</p>
      <p style="font-size:10px;color:#96C2EF;margin:2px 0;">Formal expansion plan: ≥1 (Evaluation Plan)</p>
      <p style="font-size:10px;color:#96C2EF;margin:2px 0;">DSS dissemination &amp; replication readiness</p>
      <p style="font-size:9px;color:#96C2EF;margin:6px 0 0 0;">Baseline ${baseline.toFixed(0)} → Intervention ${intervention.toFixed(0)}</p>
    </div>
  `);

  if (segmentInteractionEnabled) {
    wireCircleMarkerSegment(
      hub,
      {
        segmentId,
        segmentName: "CDM3 expansion readiness",
        speed: null,
        congestion: display,
      },
      segmentHandlers,
      { baseRadius: 11, selectedSegmentId: activeMapSegmentId }
    );
  }
  circlesOut.push(hub);

  fitMap?.([[lat, lon]]);
  scheduleLeafletLayerRepaint(map, markersOut);
  return 1;
}
