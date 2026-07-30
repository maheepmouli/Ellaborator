import L from "leaflet";
import type { LocalCityPoint } from "@/services/localCityData";
import {
  loadHelsinkiConflictsGeoJson,
  loadHelsinkiDangerousLocationsGeoJson,
} from "@/services/staticGeoData";
import {
  fetchHelsinkiJson,
  HELSINKI_VIIKKI_ANCHOR,
  HELSINKI_VIIKKI_UX_SURVEY_JSON,
  type HelsinkiUxSurvey,
} from "@/lib/helsinkiDataPaths";
import { renderHubRipplePulseOverlay } from "@/lib/copenhagenMapLayers/copenhagenTrafficPulse";
import { bindCopenhagenMapTooltip } from "@/lib/copenhagenMapLayers/copenhagenMapTooltips";
import { scheduleLeafletLayerRepaint } from "@/lib/leafletMapSync";
import {
  wireCircleMarkerSegment,
  wireMarkerSegment,
  type SegmentInteractionHandlers,
} from "@/lib/wireMapSegmentInteraction";
import {
  clusterHelsinkiPointHubs,
  finalizeHelsinkiFvh1SafetyHubs,
  type HelsinkiHazardHub,
} from "@/lib/helsinkiMapLayers/helsinkiHazardHubs";
import { fitHelsinkiKpiView } from "@/lib/helsinkiMapLayers/helsinkiKpiMapFit";
import { renderHelsinkiSurveyPointUnderlay } from "@/lib/helsinkiMapLayers/helsinkiMapHelpers";
import { mapScenarioDisplayValue, type MapScenario } from "@/lib/mapScenarioValue";

/** Match Milan / Helsinki mode-share hub scale. */
const HELSINKI_SAFETY_RING_SCALE = 2.4;
const HELSINKI_SAFETY_SECONDARY_RING_SCALE = 1.7;
const HELSINKI_PULSE_MIN_ZOOM = 10;
const HELSINKI_SAFETY_HUB_LIMIT = 8;

const FVH3_UX_SEGMENT_ID = "hel-viikki-ux-survey";

export interface RenderHelsinkiKpi21LayersOptions {
  map: L.Map;
  localCityPoints?: LocalCityPoint[];
  filterRange: [number, number];
  scenario?: MapScenario;
  selectedPilotId?: string | null;
  activeMapSegmentId?: string | null;
  segmentInteractionEnabled: boolean;
  segmentHandlers: SegmentInteractionHandlers;
  circlesOut: L.CircleMarker[];
  polygonsOut: L.Polygon[];
  markersOut: L.Marker[];
  circlesInfluenceOut?: L.Circle[];
  getValueColor: (value: number, inverted?: boolean) => string;
  wireCircleMarker?: typeof wireCircleMarkerSegment;
}

function helsinkiSafetyHubIcon(selected: boolean): L.DivIcon {
  const size = selected ? 18 : 14;
  const half = size / 2;
  return L.divIcon({
    className: "milan-hub-center-wrap",
    html: `<button type="button" class="milan-hub-center${selected ? " milan-hub-center--selected" : ""}" aria-label="Open observatory"></button>`,
    iconSize: [size, size],
    iconAnchor: [half, half],
  });
}

function nearViikkiViewport(map: L.Map): boolean {
  const viikki = L.latLng(HELSINKI_VIIKKI_ANCHOR.lat, HELSINKI_VIIKKI_ANCHOR.lng);
  return map.distance(map.getCenter(), viikki) < 2500;
}

function drawSafetyRippleHub(options: {
  map: L.Map;
  hub: HelsinkiHazardHub;
  isPrimary: boolean;
  pilotTag: string;
  totalDangerous: number;
  totalConflicts: number;
  scenario: MapScenario;
  activeMapSegmentId?: string | null;
  segmentInteractionEnabled: boolean;
  segmentHandlers: SegmentInteractionHandlers;
  circlesOut: L.CircleMarker[];
  markersOut: L.Marker[];
}): void {
  const {
    map,
    hub,
    isPrimary,
    pilotTag,
    totalDangerous,
    totalConflicts,
    scenario,
    activeMapSegmentId,
    segmentInteractionEnabled,
    segmentHandlers,
    circlesOut,
    markersOut,
  } = options;

  const hubSelected = Boolean(activeMapSegmentId && activeMapSegmentId === hub.id);
  const ringScale = isPrimary ? HELSINKI_SAFETY_RING_SCALE : HELSINKI_SAFETY_SECONDARY_RING_SCALE;
  const baselinePressure = Math.min(100, hub.count);
  const interventionPressure = Math.min(100, hub.count * 0.82);
  const pressureScore = mapScenarioDisplayValue(scenario, baselinePressure, interventionPressure, {
    kind: "pressure",
    singlePeriodShift: 0.18,
  });
  const highPressure = pressureScore >= 65 || (isPrimary && scenario === "baseline");

  renderHubRipplePulseOverlay(map, hub.lat, hub.lon, highPressure, markersOut, circlesOut, {
    showAnchorDot: false,
    minZoom: HELSINKI_PULSE_MIN_ZOOM,
    ringScale,
  });

  const detail = {
    segmentId: hub.id,
    segmentName: hub.label,
    speed: null as null,
    congestion: null as null,
    properties: {
      lat: hub.lat,
      lon: hub.lon,
      observationCount: hub.count,
      hazardCategories: hub.categories,
      datasetKind: "dangerous-location",
    },
  };

  const centerMarker = L.marker([hub.lat, hub.lon], {
    icon: helsinkiSafetyHubIcon(hubSelected),
    interactive: true,
    keyboard: true,
    zIndexOffset: isPrimary ? 2500 : 2200,
    title: hub.label,
  }).addTo(map);

  bindCopenhagenMapTooltip(centerMarker, hub.label);
  centerMarker.bindPopup(`
    <div style="font-family:'DM Sans',sans-serif;padding:8px;min-width:220px;">
      <p style="font-size:10px;color:#8578C3;margin:0 0 4px 0;text-transform:uppercase;">${pilotTag} · ${scenario}</p>
      <p style="font-size:14px;font-weight:700;color:#2F1B6D;margin:0 0 6px 0;">${hub.label}</p>
      <p style="font-size:18px;font-weight:700;color:#2F1B6D;margin:0 0 4px 0;">${hub.count.toLocaleString()} reports</p>
      <p style="font-size:10px;color:#96C2EF;margin:2px 0;">Pressure score ${pressureScore.toFixed(0)}</p>
      <p style="font-size:10px;color:#96C2EF;margin:2px 0;">Dangerous locations (city): ${totalDangerous.toLocaleString()}</p>
      <p style="font-size:10px;color:#96C2EF;margin:2px 0;">Near-miss / conflicts (city): ${totalConflicts.toLocaleString()}</p>
    </div>
  `);

  if (segmentInteractionEnabled) {
    wireMarkerSegment(centerMarker, detail, segmentHandlers);
  }
  markersOut.push(centerMarker);
}

/**
 * FVH3 KPI 2.1 — Viikki site UX survey only (Helsinki_FVH3_Survey… pptx p.8).
 * Not the citywide FVH1 dangerous-location / conflict GPKGs.
 */
function renderFvh3ViikkiUxSafetyHub(options: {
  map: L.Map;
  ux: HelsinkiUxSurvey | null;
  scenario: MapScenario;
  activeMapSegmentId?: string | null;
  segmentInteractionEnabled: boolean;
  segmentHandlers: SegmentInteractionHandlers;
  circlesOut: L.CircleMarker[];
  markersOut: L.Marker[];
}): void {
  const {
    map,
    ux,
    scenario,
    activeMapSegmentId,
    segmentInteractionEnabled,
    segmentHandlers,
    circlesOut,
    markersOut,
  } = options;

  const unsafeBefore = ux?.feltCrossingUnsafeBeforePct ?? null;
  const safetyImpact =
    ux?.satisfactionByQuestion.find((q) =>
      /safety|impact/i.test(q.question)
    )?.satisfiedPct ?? null;
  const baseline = unsafeBefore ?? 48;
  // Lower “felt unsafe” / higher safety satisfaction is the intervention direction.
  const intervention =
    safetyImpact != null
      ? Math.max(0, 100 - safetyImpact)
      : Math.max(0, baseline * 0.82);
  const display = mapScenarioDisplayValue(scenario, baseline, intervention, {
    kind: "pressure",
    singlePeriodShift: 0.12,
  });
  const selected = Boolean(
    activeMapSegmentId &&
      (activeMapSegmentId === FVH3_UX_SEGMENT_ID || activeMapSegmentId.includes("viikki-ux"))
  );
  const color = display >= 55 ? "#f87171" : display >= 35 ? "#f97316" : "#2ecc71";

  const marker = L.circleMarker([HELSINKI_VIIKKI_ANCHOR.lat, HELSINKI_VIIKKI_ANCHOR.lng], {
    radius: selected ? 13 : 11,
    fillColor: color,
    fillOpacity: 0.9,
    color: "#ffffff",
    weight: selected ? 3 : 2.2,
    opacity: 0.98,
  }).addTo(map);

  bindCopenhagenMapTooltip(marker, "Viikki UX safety survey");
  marker.bindPopup(`
    <div style="font-family:'DM Sans',sans-serif;padding:8px;min-width:240px;">
      <p style="font-size:10px;color:#8578C3;margin:0 0 4px 0;text-transform:uppercase;">FVH3 · KPI 2.1 · site survey</p>
      <p style="font-size:14px;font-weight:700;color:#2F1B6D;margin:0 0 6px 0;">Viikki light-rail crossing</p>
      <p style="font-size:18px;font-weight:700;color:#2F1B6D;margin:0 0 4px 0;">${
        unsafeBefore != null ? `${unsafeBefore}%` : "—"
      } felt unsafe before</p>
      <p style="font-size:10px;color:#96C2EF;margin:2px 0;">${
        safetyImpact != null ? `${safetyImpact}% satisfied with safety impact` : "Safety-impact question pending"
      }</p>
      <p style="font-size:10px;color:#96C2EF;margin:2px 0;">${ux?.totalResponses ?? 50} responses · collected on-site (May–Aug 2025)</p>
      <p style="font-size:9px;color:#64748b;margin:6px 0 0 0;">Intersection-only UX survey — not the citywide FVH1 hazard GPKG.</p>
    </div>
  `);

  if (segmentInteractionEnabled) {
    wireCircleMarkerSegment(
      marker,
      {
        segmentId: FVH3_UX_SEGMENT_ID,
        segmentName: "Viikki UX safety survey",
        speed: null,
        congestion: null,
        properties: {
          datasetKind: "ux-survey",
          lat: HELSINKI_VIIKKI_ANCHOR.lat,
          lon: HELSINKI_VIIKKI_ANCHOR.lng,
        },
      },
      segmentHandlers,
      { baseRadius: selected ? 13 : 11 }
    );
  }

  circlesOut.push(marker);

  if (!nearViikkiViewport(map)) {
    fitHelsinkiKpiView(
      map,
      [{ lat: HELSINKI_VIIKKI_ANCHOR.lat, lon: HELSINKI_VIIKKI_ANCHOR.lng }],
      "viikki"
    );
  }
  scheduleLeafletLayerRepaint(map, markersOut);
}

/**
 * KPI 2.1 road safety.
 * FVH1: sampled dangerous-location + conflict clouds under ~8 pressure hubs.
 * FVH3: single Viikki intersection UX safety survey (pptx p.8) — not area-spread GPKGs.
 */
export function renderHelsinkiKpi21Layers(
  options: RenderHelsinkiKpi21LayersOptions
): Promise<void> {
  const {
    map,
    selectedPilotId,
    scenario = "baseline",
    activeMapSegmentId,
    segmentInteractionEnabled,
    segmentHandlers,
    circlesOut,
    markersOut,
  } = options;

  const pilotId = selectedPilotId ?? "hel-p1";

  if (pilotId === "hel-p3") {
    return fetchHelsinkiJson<HelsinkiUxSurvey>(HELSINKI_VIIKKI_UX_SURVEY_JSON).then((ux) => {
      renderFvh3ViikkiUxSafetyHub({
        map,
        ux,
        scenario,
        activeMapSegmentId,
        segmentInteractionEnabled,
        segmentHandlers,
        circlesOut,
        markersOut,
      });
    });
  }

  return Promise.all([
    loadHelsinkiDangerousLocationsGeoJson(),
    loadHelsinkiConflictsGeoJson(),
  ]).then(([dangerousGeoJson, conflictsGeoJson]) => {
    const totalDangerous = dangerousGeoJson.features.length;
    const totalConflicts = conflictsGeoJson.features.length;

    // FVH1 (and default): survey clouds + multi-hub ripples from dangerous-location density
    renderHelsinkiSurveyPointUnderlay({
      map,
      features: dangerousGeoJson.features,
      kind: "hazard",
      maxPoints: 200,
      circlesOut,
      segmentInteractionEnabled,
      segmentHandlers,
      activeMapSegmentId,
    });
    renderHelsinkiSurveyPointUnderlay({
      map,
      features: conflictsGeoJson.features,
      kind: "conflict",
      maxPoints: 160,
      circlesOut,
      segmentInteractionEnabled,
      segmentHandlers,
      activeMapSegmentId,
    });

    const hubs = clusterHelsinkiPointHubs(dangerousGeoJson.features, {
      cellDeg: 0.01,
      limit: HELSINKI_SAFETY_HUB_LIMIT,
      idPrefix: "hel-safety-hub",
      labelPrefix: "Road-safety pressure cluster",
      categoryProperty: "locationType",
    });

    const conflictHubs = clusterHelsinkiPointHubs(conflictsGeoJson.features, {
      cellDeg: 0.01,
      limit: 24,
      idPrefix: "hel-conflict",
      labelPrefix: "Conflict",
      categoryProperty: "incidentType",
    });
    const enriched = finalizeHelsinkiFvh1SafetyHubs(hubs).map((hub) => {
      const nearestConflict = conflictHubs.find(
        (conflict) => Math.hypot(conflict.lat - hub.lat, conflict.lon - hub.lon) < 0.012
      );
      return {
        ...hub,
        label:
          hub.id === "hel-dangerous-locations"
            ? hub.label
            : nearestConflict
              ? `${hub.label} · ~${nearestConflict.count} nearby conflicts`
              : hub.label,
        count: hub.count + (nearestConflict?.count ?? 0),
      };
    });

    const finalHubs = enriched;

    finalHubs.forEach((hub, index) => {
      drawSafetyRippleHub({
        map,
        hub,
        isPrimary: index === 0,
        pilotTag: "FVH1 · KPI 2.1",
        totalDangerous,
        totalConflicts,
        scenario,
        activeMapSegmentId,
        segmentInteractionEnabled,
        segmentHandlers,
        circlesOut,
        markersOut,
      });
    });

    if (finalHubs.length > 0) {
      const cityCenter = L.latLng(60.171, 24.941);
      const nearCity = map.distance(map.getCenter(), cityCenter) < 12000;
      if (!nearCity || map.getZoom() < 10) {
        fitHelsinkiKpiView(map, finalHubs, "safety-city");
      }
    }
    scheduleLeafletLayerRepaint(map, markersOut);
  });
}
