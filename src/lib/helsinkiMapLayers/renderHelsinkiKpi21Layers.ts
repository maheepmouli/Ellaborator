import L from "leaflet";
import type { LocalCityPoint } from "@/services/localCityData";
import {
  loadHelsinkiConflictsGeoJson,
  loadHelsinkiDangerousLocationsGeoJson,
} from "@/services/staticGeoData";
import {
  fetchHelsinkiJson,
  HELSINKI_MOBILYSIS_VIIKKI_GATES_JSON,
  HELSINKI_VIIKKI_ANCHOR,
  type HelsinkiMobilysisGates,
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

function mobilysisPopupHtml(mobilysis: HelsinkiMobilysisGates | null): string {
  if (!mobilysis) return "";
  const vru = mobilysis.gateObservations
    .filter((gate) => gate.gate.includes("vru") || gate.mode === "vru")
    .reduce((sum, gate) => sum + gate.totalCount, 0);
  const pedestrian = mobilysis.gateObservations
    .filter((gate) => gate.mode === "pedestrian")
    .reduce((sum, gate) => sum + gate.totalCount, 0);
  const bike = mobilysis.gateObservations
    .filter((gate) => gate.mode === "bike" || gate.mode === "bicycle")
    .reduce((sum, gate) => sum + gate.totalCount, 0);
  const vehicle = mobilysis.gateObservations
    .filter((gate) => gate.mode === "vehicle")
    .reduce((sum, gate) => sum + gate.totalCount, 0);
  return `
    <p style="font-size:10px;color:#96C2EF;margin:6px 0 2px 0;font-weight:700;">Mobilysis gates (2024-10-03 AM)</p>
    <p style="font-size:10px;color:#96C2EF;margin:1px 0;">Vehicle ${vehicle} · Ped ${pedestrian} · Bike ${bike} · VRU ${vru}</p>
  `;
}

function drawSafetyRippleHub(options: {
  map: L.Map;
  hub: HelsinkiHazardHub;
  isPrimary: boolean;
  pilotTag: string;
  totalDangerous: number;
  totalConflicts: number;
  scenario: MapScenario;
  mobilysisHtml?: string;
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
    mobilysisHtml = "",
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
  // Higher cluster pressure → red (inbound) pulse tone.
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
      ${isPrimary ? mobilysisHtml : ""}
    </div>
  `);

  if (segmentInteractionEnabled) {
    wireMarkerSegment(centerMarker, detail, segmentHandlers);
  }
  markersOut.push(centerMarker);
}

/**
 * KPI 2.1 road safety — Milan-style multi-hub ripples from hazard density.
 * FVH1: ~8 densest dangerous-location neighbourhoods.
 * FVH3: Viikki safety hub (+ Mobilysis in primary popup) with city hazard clusters as context.
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

  return Promise.all([
    loadHelsinkiDangerousLocationsGeoJson(),
    loadHelsinkiConflictsGeoJson(),
    fetchHelsinkiJson<HelsinkiMobilysisGates>(HELSINKI_MOBILYSIS_VIIKKI_GATES_JSON),
  ]).then(([dangerousGeoJson, conflictsGeoJson, mobilysis]) => {
    const totalDangerous = dangerousGeoJson.features.length;
    const totalConflicts = conflictsGeoJson.features.length;
    const mobilysisHtml = mobilysisPopupHtml(mobilysis);

    if (pilotId === "hel-p3") {
      const viikkiHub: HelsinkiHazardHub = {
        id: "hel-viikki-anchor",
        lat: HELSINKI_VIIKKI_ANCHOR.lat,
        lon: HELSINKI_VIIKKI_ANCHOR.lng,
        count: Math.max(
          1,
          mobilysis?.gateObservations.reduce((sum, gate) => sum + gate.totalCount, 0) ?? 1
        ),
        label: "Viikki intersection safety hub",
      };

      const nearViikki = { lat: HELSINKI_VIIKKI_ANCHOR.lat, lng: HELSINKI_VIIKKI_ANCHOR.lng, radiusDeg: 0.03 };

      renderHelsinkiSurveyPointUnderlay({
        map,
        features: dangerousGeoJson.features,
        kind: "hazard",
        maxPoints: 80,
        circlesOut,
        near: nearViikki,
        segmentInteractionEnabled,
        segmentHandlers,
        activeMapSegmentId,
      });
      renderHelsinkiSurveyPointUnderlay({
        map,
        features: conflictsGeoJson.features,
        kind: "conflict",
        maxPoints: 60,
        circlesOut,
        near: nearViikki,
        segmentInteractionEnabled,
        segmentHandlers,
        activeMapSegmentId,
      });

      // Local hazard density hubs around Viikki (not citywide)
      const contextHubs = clusterHelsinkiPointHubs(
        dangerousGeoJson.features.filter((feature) => {
          const coords = feature.geometry?.coordinates;
          if (!Array.isArray(coords) || coords.length < 2) return false;
          return (
            Math.hypot(Number(coords[1]) - viikkiHub.lat, Number(coords[0]) - viikkiHub.lon) <= 0.035
          );
        }),
        {
          cellDeg: 0.008,
          limit: 5,
          idPrefix: "hel-safety-ctx",
          labelPrefix: "Viikki-area hazard cluster",
        }
      ).filter((hub) => Math.hypot(hub.lat - viikkiHub.lat, hub.lon - viikkiHub.lon) > 0.004);

      const hubs = [viikkiHub, ...contextHubs].slice(0, HELSINKI_SAFETY_HUB_LIMIT);
      hubs.forEach((hub, index) => {
        drawSafetyRippleHub({
          map,
          hub,
          isPrimary: index === 0,
          pilotTag: "FVH3 · KPI 2.1",
          totalDangerous,
          totalConflicts,
          scenario,
          mobilysisHtml: index === 0 ? mobilysisHtml : "",
          activeMapSegmentId,
          segmentInteractionEnabled,
          segmentHandlers,
          circlesOut,
          markersOut,
        });
      });

      if (hubs.length > 0) {
        fitHelsinkiKpiView(map, hubs, "safety-viikki");
      }
      scheduleLeafletLayerRepaint(map, markersOut);
      return;
    }

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
    });

    // Merge conflict density into labels when a conflict cell overlaps (same grid).
    const conflictHubs = clusterHelsinkiPointHubs(conflictsGeoJson.features, {
      cellDeg: 0.01,
      limit: 24,
      idPrefix: "hel-conflict",
      labelPrefix: "Conflict",
    });
    const enriched = hubs.map((hub, index) => {
      const nearestConflict = conflictHubs.find(
        (conflict) => Math.hypot(conflict.lat - hub.lat, conflict.lon - hub.lon) < 0.012
      );
      return {
        ...hub,
        id: index === 0 ? "hel-dangerous-locations" : hub.id,
        label:
          index === 0
            ? `Primary safety pressure · ${hub.count} hazard reports`
            : nearestConflict
              ? `${hub.label} · ~${nearestConflict.count} nearby conflicts`
              : hub.label,
        count: hub.count + (nearestConflict?.count ?? 0),
      };
    });

    const finalHubs =
      enriched.length > 0
        ? enriched
        : [
            {
              id: "hel-dangerous-locations",
              lat: 60.171,
              lon: 24.941,
              count: 0,
              label: "FVH1 survey safety hub",
            },
          ];

    finalHubs.forEach((hub, index) => {
      drawSafetyRippleHub({
        map,
        hub,
        isPrimary: index === 0,
        pilotTag: "FVH1 · KPI 2.1",
        totalDangerous,
        totalConflicts,
        scenario,
        mobilysisHtml: "",
        activeMapSegmentId,
        segmentInteractionEnabled,
        segmentHandlers,
        circlesOut,
        markersOut,
      });
    });

    if (finalHubs.length > 0) {
      fitHelsinkiKpiView(map, finalHubs, "safety-city");
    }
    scheduleLeafletLayerRepaint(map, markersOut);
  });
}
