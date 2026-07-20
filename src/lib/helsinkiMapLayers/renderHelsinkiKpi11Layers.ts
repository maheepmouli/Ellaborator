import L from "leaflet";
import {
  fetchHelsinkiJson,
  HELSINKI_MOBILYSIS_VIIKKI_GATES_JSON,
  HELSINKI_TELRAAM_KOETILANTIE_JSON,
  HELSINKI_VIIKKI_ANCHOR,
  type HelsinkiMobilysisGates,
  type HelsinkiTelraamKoetilantie,
} from "@/lib/helsinkiDataPaths";
import { bindCopenhagenMapTooltip } from "@/lib/copenhagenMapLayers/copenhagenMapTooltips";
import { scheduleLeafletLayerRepaint } from "@/lib/leafletMapSync";
import { renderHelsinkiPilotInfluence } from "@/lib/helsinkiMapLayers/helsinkiMapHelpers";
import { fitHelsinkiKpiView } from "@/lib/helsinkiMapLayers/helsinkiKpiMapFit";
import {
  mapScenarioDisplayValue,
  type MapScenario,
} from "@/lib/mapScenarioValue";
import {
  wireCircleMarkerSegment,
  type SegmentInteractionHandlers,
} from "@/lib/wireMapSegmentInteraction";

export interface RenderHelsinkiKpi11LayersOptions {
  map: L.Map;
  scenario?: MapScenario;
  selectedPilotId?: string | null;
  activeMapSegmentId?: string | null;
  segmentInteractionEnabled: boolean;
  segmentHandlers: SegmentInteractionHandlers;
  circlesOut: L.CircleMarker[];
  markersOut: L.Marker[];
  circlesInfluenceOut?: L.Circle[];
}

function expansionColor(score: number): string {
  if (score >= 70) return "#2ecc71";
  if (score >= 45) return "#38bdf8";
  return "#f59e0b";
}

/**
 * KPI 1.1 (FVH3) — Viikki warning-system expansion hub.
 * No structured expansion-plan artifact yet; map shows readiness proxy + Telraam / Mobilysis support.
 */
export function renderHelsinkiKpi11Layers(
  options: RenderHelsinkiKpi11LayersOptions
): Promise<void> {
  const {
    map,
    scenario = "baseline",
    selectedPilotId,
    activeMapSegmentId,
    segmentInteractionEnabled,
    segmentHandlers,
    circlesOut,
    markersOut,
    circlesInfluenceOut,
  } = options;

  if (circlesInfluenceOut) {
    renderHelsinkiPilotInfluence(map, selectedPilotId ?? "hel-p3", circlesInfluenceOut);
  }

  return Promise.all([
    fetchHelsinkiJson<HelsinkiTelraamKoetilantie>(HELSINKI_TELRAAM_KOETILANTIE_JSON),
    fetchHelsinkiJson<HelsinkiMobilysisGates>(HELSINKI_MOBILYSIS_VIIKKI_GATES_JSON),
  ]).then(([telraam, mobilysis]) => {
    // Readiness proxy: Telraam coverage days + Mobilysis gate activity (not a formal expansion plan count).
    const telraamDays = telraam?.dailyAggregates.length ?? 0;
    const gateTotal =
      mobilysis?.gateObservations.reduce((sum, gate) => sum + gate.totalCount, 0) ?? 0;
    const baselineScore = Math.min(100, telraamDays / 6 + Math.min(40, gateTotal / 80));
    const interventionScore = Math.min(100, baselineScore + 18);
    const display = mapScenarioDisplayValue(scenario, baselineScore, interventionScore, {
      kind: "benefit",
      singlePeriodShift: 0.18,
    });
    const color = expansionColor(display);
    const selected = activeMapSegmentId === "hel-viikki-expansion-hub";

    const hub = L.circleMarker([HELSINKI_VIIKKI_ANCHOR.lat, HELSINKI_VIIKKI_ANCHOR.lng], {
      radius: selected ? 13 : 11,
      fillColor: color,
      fillOpacity: 0.9,
      color: "#ffffff",
      weight: 2.2,
      opacity: 0.98,
    }).addTo(map);

    bindCopenhagenMapTooltip(hub, "Viikki expansion readiness (KPI 1.1)");
    hub.bindPopup(`
      <div style="font-family:'DM Sans',sans-serif;padding:8px;min-width:230px;">
        <p style="font-size:10px;color:#8578C3;margin:0 0 4px 0;text-transform:uppercase;">FVH3 · KPI 1.1 · ${scenario}</p>
        <p style="font-size:14px;font-weight:700;color:#2F1B6D;margin:0 0 6px 0;">Viikki warning-system expansion hub</p>
        <p style="font-size:18px;font-weight:700;color:${color};margin:4px 0;">Readiness ${display.toFixed(0)}</p>
        <p style="font-size:10px;color:#96C2EF;margin:2px 0;">Formal expansion plan: pending in SharePoint drop</p>
        <p style="font-size:10px;color:#96C2EF;margin:2px 0;">Telraam days ${telraamDays.toLocaleString()} · Mobilysis gate counts ${gateTotal.toLocaleString()}</p>
        <p style="font-size:9px;color:#96C2EF;margin:6px 0 0 0;">Baseline ${baselineScore.toFixed(0)} → Intervention ${interventionScore.toFixed(0)} (monitoring readiness proxy)</p>
      </div>
    `);

    if (segmentInteractionEnabled) {
      wireCircleMarkerSegment(
        hub,
        {
          segmentId: "hel-viikki-expansion-hub",
          segmentName: "Viikki expansion readiness",
          speed: null,
          congestion: display,
        },
        segmentHandlers,
        { baseRadius: 11, selectedSegmentId: activeMapSegmentId }
      );
    }
    circlesOut.push(hub);

    if (telraam) {
      const t = L.circleMarker([telraam.location.lat, telraam.location.lng], {
        radius: 6,
        fillColor: "#38bdf8",
        fillOpacity: 0.85,
        color: "#ffffff",
        weight: 1.4,
      }).addTo(map);
      bindCopenhagenMapTooltip(t, `Telraam ${telraam.street}`);
      t.bindPopup(`
        <div style="font-family:'DM Sans',sans-serif;padding:8px;min-width:180px;">
          <p style="font-size:10px;color:#8578C3;margin:0 0 4px 0;text-transform:uppercase;">Telraam support</p>
          <p style="font-size:14px;font-weight:700;color:#2F1B6D;margin:0;">${telraam.street}</p>
          <p style="font-size:10px;color:#96C2EF;margin:4px 0 0 0;">${telraamDays} daily aggregates</p>
        </div>
      `);
      if (segmentInteractionEnabled) {
        wireCircleMarkerSegment(
          t,
          {
            segmentId: telraam.sensorId,
            segmentName: `Telraam ${telraam.street}`,
            speed: null,
            congestion: null,
          },
          segmentHandlers,
          { baseRadius: 6, selectedSegmentId: activeMapSegmentId }
        );
      }
      circlesOut.push(t);
    }

    if (mobilysis) {
      const m = L.circleMarker([HELSINKI_VIIKKI_ANCHOR.lat + 0.00035, HELSINKI_VIIKKI_ANCHOR.lng - 0.00045], {
        radius: 6,
        fillColor: "#2ecc71",
        fillOpacity: 0.85,
        color: "#ffffff",
        weight: 1.4,
      }).addTo(map);
      bindCopenhagenMapTooltip(m, "Mobilysis VRU gates");
      m.bindPopup(`
        <div style="font-family:'DM Sans',sans-serif;padding:8px;min-width:180px;">
          <p style="font-size:10px;color:#8578C3;margin:0 0 4px 0;text-transform:uppercase;">Mobilysis support</p>
          <p style="font-size:14px;font-weight:700;color:#2F1B6D;margin:0;">Viikki gate survey</p>
          <p style="font-size:10px;color:#96C2EF;margin:4px 0 0 0;">${gateTotal.toLocaleString()} crossings · 2024-10-03 AM</p>
        </div>
      `);
      if (segmentInteractionEnabled) {
        wireCircleMarkerSegment(
          m,
          {
            segmentId: "hel-viikki-mobilysis",
            segmentName: "Mobilysis Viikki gates",
            speed: null,
            congestion: null,
          },
          segmentHandlers,
          { baseRadius: 6, selectedSegmentId: activeMapSegmentId }
        );
      }
      circlesOut.push(m);
    }

    fitHelsinkiKpiView(
      map,
      [
        { lat: HELSINKI_VIIKKI_ANCHOR.lat, lon: HELSINKI_VIIKKI_ANCHOR.lng },
        ...(telraam
          ? [{ lat: telraam.location.lat, lon: telraam.location.lng }]
          : []),
      ],
      "viikki"
    );
    scheduleLeafletLayerRepaint(map, markersOut);
  });
}
