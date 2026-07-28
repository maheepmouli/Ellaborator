import L from "leaflet";
import {
  fetchHelsinkiJson,
  HELSINKI_VIIKKI_ANCHOR,
  HELSINKI_VIIKKI_UX_SURVEY_JSON,
  type HelsinkiUxSurvey,
} from "@/lib/helsinkiDataPaths";
import { wireCircleMarkerSegment, type SegmentInteractionHandlers } from "@/lib/wireMapSegmentInteraction";
import { scheduleLeafletLayerRepaint } from "@/lib/leafletMapSync";
import { fitHelsinkiKpiView } from "@/lib/helsinkiMapLayers/helsinkiKpiMapFit";
import {
  mapScenarioDisplayValue,
  type MapScenario,
} from "@/lib/mapScenarioValue";

export interface RenderHelsinkiUxSurveyLayerOptions {
  map: L.Map;
  scenario?: MapScenario;
  selectedPilotId?: string | null;
  segmentInteractionEnabled: boolean;
  segmentHandlers: SegmentInteractionHandlers;
  circlesOut: L.CircleMarker[];
  markersOut: L.Marker[];
  circlesInfluenceOut?: L.Circle[];
  /** When false, skip viewport fit (e.g. FVH2 KPI 4.2 lets e-scooter sample own the zoom). */
  fitMap?: boolean;
}

/** FVH3 Viikki UX survey hub (KPI 4.1 / 4.2) — single on-site marker, peer-style. */
export function renderHelsinkiUxSurveyLayer(
  options: RenderHelsinkiUxSurveyLayerOptions
): Promise<void> {
  const {
    map,
    scenario = "baseline",
    segmentInteractionEnabled,
    segmentHandlers,
    circlesOut,
    markersOut,
    fitMap = true,
  } = options;

  return fetchHelsinkiJson<HelsinkiUxSurvey>(HELSINKI_VIIKKI_UX_SURVEY_JSON).then((ux) => {
    if (!ux) return;

    // No soft influence disc for KPI 4.1 — survey is the single crossing point only.
    const baseline = ux.overallSatisfiedPct;
    const intervention = Math.min(100, baseline + (100 - baseline) * 0.18);
    const display = mapScenarioDisplayValue(scenario, baseline, intervention, {
      kind: "benefit",
      singlePeriodShift: 0.18,
    });
    const meets = display >= ux.kpi41Target;
    const color = meets ? "#2ecc71" : display >= 55 ? "#38bdf8" : "#f87171";

    const marker = L.circleMarker([HELSINKI_VIIKKI_ANCHOR.lat, HELSINKI_VIIKKI_ANCHOR.lng], {
      radius: 11,
      fillColor: color,
      fillOpacity: 0.88,
      color: "#ffffff",
      weight: 2.2,
      opacity: 0.98,
    }).addTo(map);

    const questionRows = ux.satisfactionByQuestion
      .slice(0, 4)
      .map(
        (q) =>
          `<p style="font-size:9px;color:#96C2EF;margin:1px 0;">${q.satisfiedPct ?? "—"}% · ${q.question}</p>`
      )
      .join("");

    marker.bindPopup(`
      <div style="font-family:'DM Sans',sans-serif;padding:8px;min-width:240px;">
        <p style="font-size:10px;color:#8578C3;margin:0 0 4px 0;text-transform:uppercase;">Viikki UX survey (FVH3) · ${scenario}</p>
        <p style="font-size:18px;font-weight:700;color:#2F1B6D;margin:0 0 4px 0;">${display.toFixed(1)}% satisfied</p>
        <p style="font-size:10px;color:${color};font-weight:700;margin:0 0 6px 0;">${meets ? "Meets" : "Below"} the ≥75% KPI 4.1 target</p>
        <p style="font-size:10px;color:#96C2EF;margin:2px 0;">Observed ${baseline.toFixed(1)}% · outlook ${intervention.toFixed(1)}%</p>
        <p style="font-size:10px;color:#96C2EF;margin:2px 0;">${ux.totalResponses} completed responses · on-site only</p>
        <div style="margin-top:6px;border-top:1px solid rgba(101,125,245,0.2);padding-top:4px;">
          ${questionRows}
        </div>
        ${
          ux.accessibilityChallengePct != null
            ? `<p style="font-size:9px;color:#96C2EF;margin:6px 0 0 0;">${ux.accessibilityChallengePct}% self-report a visual, hearing, or mobility challenge (KPI 4.2)</p>`
            : ""
        }
      </div>
    `);

    if (segmentInteractionEnabled) {
      wireCircleMarkerSegment(
        marker,
        {
          segmentId: "hel-viikki-ux-survey",
          segmentName: "Viikki UX survey",
          speed: null,
          congestion: null,
        },
        segmentHandlers,
        { baseRadius: 11 }
      );
    }

    circlesOut.push(marker);
    if (fitMap) {
      const viikki = L.latLng(HELSINKI_VIIKKI_ANCHOR.lat, HELSINKI_VIIKKI_ANCHOR.lng);
      const nearViikki = map.distance(map.getCenter(), viikki) < 2500;
      if (!nearViikki) {
        fitHelsinkiKpiView(
          map,
          [{ lat: HELSINKI_VIIKKI_ANCHOR.lat, lon: HELSINKI_VIIKKI_ANCHOR.lng }],
          "viikki"
        );
      }
    }
    scheduleLeafletLayerRepaint(map, markersOut);
  });
}
