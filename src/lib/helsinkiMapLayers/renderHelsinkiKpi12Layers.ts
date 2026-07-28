import L from "leaflet";
import {
  fetchHelsinkiJson,
  HELSINKI_KALLIO_ANCHOR,
  HELSINKI_MOBILYSIS_VIIKKI_GATES_JSON,
  HELSINKI_TELRAAM_KOETILANTIE_JSON,
  HELSINKI_VIIKKI_ANCHOR,
  type HelsinkiMobilysisGates,
  type HelsinkiTelraamKoetilantie,
} from "@/lib/helsinkiDataPaths";
import {
  loadHelsinkiDangerousLocationsGeoJson,
  loadHelsinkiEscooterObservationsGeoJson,
} from "@/services/staticGeoData";
import { renderCopenhagenRadarFlowLayout } from "@/lib/copenhagenMapLayers/copenhagenRadarFlowLayout";
import { renderHubRipplePulseOverlay } from "@/lib/copenhagenMapLayers/copenhagenTrafficPulse";
import { renderMobilityHubFovCone } from "@/lib/copenhagenMapLayers/renderMobilityHubFov";
import { bindCopenhagenMapTooltip } from "@/lib/copenhagenMapLayers/copenhagenMapTooltips";
import type { CopenhagenObservedPoint } from "@/lib/copenhagenMapLayers/renderCopenhagenMapLayers";
import { scheduleLeafletLayerRepaint } from "@/lib/leafletMapSync";
import {
  wireCircleMarkerSegment,
  wireMarkerSegment,
  type SegmentInteractionHandlers,
} from "@/lib/wireMapSegmentInteraction";
import { buildHelsinkiTelraamModeShareFlows } from "@/lib/helsinkiMapLayers/helsinkiModeShareFlows";
import {
  clusterHelsinkiPointHubs,
  type HelsinkiHazardHub,
} from "@/lib/helsinkiMapLayers/helsinkiHazardHubs";
import { fitHelsinkiKpiView } from "@/lib/helsinkiMapLayers/helsinkiKpiMapFit";
import { renderHelsinkiSurveyPointUnderlay } from "@/lib/helsinkiMapLayers/helsinkiMapHelpers";

/** Match Milan hub pulse scale so ripples read at pilot / city zoom. */
const HELSINKI_HUB_RING_SCALE = 2.4;
const HELSINKI_SECONDARY_RING_SCALE = 1.7;
/** Show CSS ripple from city-fit zoom (default peer gate is 12). */
const HELSINKI_PULSE_MIN_ZOOM = 10;
/** Milan shows ~6–8 junction hubs — same presentation budget for FVH1 clusters. */
const HELSINKI_MODE_SHARE_HUB_LIMIT = 8;

const HELSINKI_FVH1_SURVEY_HUB = { lat: 60.171, lng: 24.941 } as const;

export interface RenderHelsinkiKpi12LayersOptions {
  map: L.Map;
  selectedPilotId?: string | null;
  activeMapSegmentId?: string | null;
  scenario?: "baseline" | "intervention" | "comparison";
  segmentInteractionEnabled: boolean;
  segmentHandlers: SegmentInteractionHandlers;
  getValueColor?: (value: number, safetyKpi: boolean) => string;
  circlesOut: L.CircleMarker[];
  polygonsOut: L.Polygon[];
  polylinesOut: L.Polyline[];
  markersOut: L.Marker[];
  wireCircleMarker?: typeof wireCircleMarkerSegment;
}

function intensityScalar(
  scenario: "baseline" | "intervention" | "comparison",
  baselineValue: number,
  interventionValue: number,
  comparisonValue: number
): number {
  if (scenario === "baseline") return baselineValue;
  if (scenario === "intervention") return interventionValue;
  return Math.min(100, Math.abs(comparisonValue) * 4);
}

function helsinkiHubCenterIcon(selected: boolean): L.DivIcon {
  const size = selected ? 18 : 14;
  const half = size / 2;
  return L.divIcon({
    className: "milan-hub-center-wrap",
    html: `<button type="button" class="milan-hub-center${selected ? " milan-hub-center--selected" : ""}" aria-label="Open observatory"></button>`,
    iconSize: [size, size],
    iconAnchor: [half, half],
  });
}

function drawModeShareRippleHub(options: {
  map: L.Map;
  hubLat: number;
  hubLon: number;
  segmentId: string;
  label: string;
  pilotTag: string;
  flows: CopenhagenObservedPoint[];
  telraam: HelsinkiTelraamKoetilantie | null;
  sustainablePct: number | null;
  isPrimary: boolean;
  hazardCount?: number;
  totalHazards?: number;
  clusterKind?: "hazard" | "parking";
  scenario: "baseline" | "intervention" | "comparison";
  activeMapSegmentId?: string | null;
  segmentInteractionEnabled: boolean;
  segmentHandlers: SegmentInteractionHandlers;
  getValueColor?: (value: number, safetyKpi: boolean) => string;
  circlesOut: L.CircleMarker[];
  polygonsOut: L.Polygon[];
  polylinesOut: L.Polyline[];
  markersOut: L.Marker[];
  wireCircleMarker: typeof wireCircleMarkerSegment;
}): void {
  const {
    map,
    hubLat,
    hubLon,
    segmentId,
    label,
    pilotTag,
    flows,
    telraam,
    sustainablePct,
    isPrimary,
    hazardCount,
    totalHazards,
    clusterKind = "hazard",
    scenario,
    activeMapSegmentId,
    segmentInteractionEnabled,
    segmentHandlers,
    getValueColor,
    circlesOut,
    polygonsOut,
    polylinesOut,
    markersOut,
    wireCircleMarker,
  } = options;

  const hubSelected = Boolean(activeMapSegmentId && activeMapSegmentId === segmentId);
  const ringScale = isPrimary ? HELSINKI_HUB_RING_SCALE : HELSINKI_SECONDARY_RING_SCALE;
  const sustainable =
    (telraam?.modeShare.bikePct ?? 0) + (telraam?.modeShare.pedestrianPct ?? 0);
  const carShare = telraam?.modeShare.carPct ?? 50;
  // Scenario-aware pulse: intervention leans greener (sustainable-dominant) when Telraam is single-period.
  const sustainableDisplay = intensityScalar(
    scenario,
    sustainable,
    Math.min(100, sustainable + (100 - sustainable) * 0.18),
    Math.min(100, Math.abs((sustainable + (100 - sustainable) * 0.18) - sustainable) * 4)
  );
  const inboundDominant = sustainableDisplay >= carShare;

  if (isPrimary) {
    renderMobilityHubFovCone(map, hubLat, hubLon, flows, polygonsOut, {
      selected: hubSelected,
      ringScale,
    });

    const svgRenderer = L.svg({ padding: 0.8 });
    renderCopenhagenRadarFlowLayout({
      map,
      hubLat,
      hubLon,
      flows,
      scenario,
      selectedSegmentId: activeMapSegmentId,
      segmentHandlers,
      polylinesOut,
      circlesOut,
      markersOut,
      svgRenderer,
      wireCircleMarker,
      intensityScalar,
      getValueColor,
      safetyKpi: false,
      ringScale,
      hideFlowEndpointMarkers: true,
      hideFlowSpokes: true,
      featureSelected: (id) => Boolean(activeMapSegmentId && activeMapSegmentId === id),
      buildPopup: (point) => {
        const props = point.properties ?? {};
        const mode = String(props.mode ?? props.direction ?? "mode");
        const pct = Number(props.baselineValue ?? point.value ?? 0);
        return `
          <div style="font-family:'DM Sans',sans-serif;padding:8px;min-width:200px;">
            <p style="font-size:10px;color:#8578C3;margin:0 0 4px 0;text-transform:uppercase;">${pilotTag}</p>
            <p style="font-size:14px;font-weight:700;color:#2F1B6D;margin:0 0 6px 0;">${mode}</p>
            <p style="font-size:18px;font-weight:700;color:#2F1B6D;margin:0 0 4px 0;">${pct.toFixed(1)}%</p>
            <p style="font-size:10px;color:#96C2EF;margin:2px 0;">Telraam ${telraam?.street ?? "Koetilantie"} · observed share</p>
          </div>
        `;
      },
    });
  }

  renderHubRipplePulseOverlay(map, hubLat, hubLon, inboundDominant, markersOut, circlesOut, {
    showAnchorDot: false,
    minZoom: HELSINKI_PULSE_MIN_ZOOM,
    ringScale,
  });

  const detail = {
    segmentId,
    segmentName: label,
    speed: null as null,
    congestion: null as null,
  };

  const centerMarker = L.marker([hubLat, hubLon], {
    icon: helsinkiHubCenterIcon(hubSelected),
    interactive: true,
    keyboard: true,
    zIndexOffset: isPrimary ? 2500 : 2200,
    title: label,
  }).addTo(map);

  bindCopenhagenMapTooltip(centerMarker, label);

  const hazardLine =
    hazardCount != null
      ? clusterKind === "parking"
        ? `<p style="font-size:10px;color:#96C2EF;margin:2px 0;">Parking observations in cluster: ${hazardCount.toLocaleString()}${
            totalHazards != null ? ` · study total ${totalHazards.toLocaleString()}` : ""
          }</p>`
        : `<p style="font-size:10px;color:#96C2EF;margin:2px 0;">Dangerous-location reports in cluster: ${hazardCount.toLocaleString()}${
            totalHazards != null ? ` · city total ${totalHazards.toLocaleString()}` : ""
          }</p>`
      : "";

  centerMarker.bindPopup(`
    <div style="font-family:'DM Sans',sans-serif;padding:8px;min-width:220px;">
      <p style="font-size:10px;color:#8578C3;margin:0 0 4px 0;text-transform:uppercase;">${pilotTag}</p>
      <p style="font-size:14px;font-weight:700;color:#2F1B6D;margin:0 0 6px 0;">${label}</p>
      ${hazardLine}
      ${
        isPrimary && sustainablePct != null && telraam
          ? `<p style="font-size:18px;font-weight:700;color:#2F1B6D;margin:6px 0 4px 0;">${sustainablePct.toFixed(1)}% sustainable</p>
             <p style="font-size:10px;color:#96C2EF;margin:2px 0;">Bike ${telraam.modeShare.bikePct}% · Ped ${telraam.modeShare.pedestrianPct}% · Car ${telraam.modeShare.carPct}%</p>
             <p style="font-size:10px;color:#96C2EF;margin:2px 0;">${telraam.dailyAggregates.length} daily aggregates · Telraam ${telraam.street}</p>`
          : isPrimary
            ? `<p style="font-size:10px;color:#96C2EF;margin:0;">No pilot-scoped mode-share sensor in the current data drop.</p>`
            : clusterKind === "parking"
              ? `<p style="font-size:10px;color:#96C2EF;margin:6px 0 0 0;">Parking observation cluster — field study only (no live sensor feed).</p>`
              : `<p style="font-size:10px;color:#96C2EF;margin:6px 0 0 0;">Survey cluster only — no pilot-scoped mode-share sensor linked.</p>`
      }
    </div>
  `);

  if (segmentInteractionEnabled) {
    wireMarkerSegment(centerMarker, detail, segmentHandlers);
  }
  markersOut.push(centerMarker);
}

function ensurePrimaryNearAnchor(
  hubs: HelsinkiHazardHub[],
  anchor: { lat: number; lng: number },
  primaryId: string,
  primaryLabel: string
): HelsinkiHazardHub[] {
  if (!hubs.length) {
    return [
      {
        id: primaryId,
        lat: anchor.lat,
        lon: anchor.lng,
        count: 0,
        label: primaryLabel,
      },
    ];
  }

  // Prefer densest cluster as primary; keep presentation count.
  const ranked = [...hubs].sort((a, b) => b.count - a.count);
  const primary = { ...ranked[0], id: primaryId, label: primaryLabel };
  const rest = ranked.slice(1).map((hub, index) => ({
    ...hub,
    id: `${primaryId}-cluster-${index + 2}`,
  }));
  return [primary, ...rest];
}


/** Site-diagram colours for FVH3 mode-share sensors. */
const FVH3_TELRAAM_COLOR = "#ef4444";
const FVH3_CAMERA_COLOR = "#f97316";
/** Approximate offsets from the Viikki crossing anchor (site diagram). */
const FVH3_TELRAAM_OFFSET = { dLat: -0.00028, dLng: -0.00055 };
const FVH3_CAMERA_OFFSET = { dLat: 0.00048, dLng: -0.00012 };
/** Camera FOV toward the crossing / roundabout (southeast). */
const FVH3_CAMERA_FOV_BEARING_DEG = 145;

function placeholderFlows(hubLat: number, hubLon: number): CopenhagenObservedPoint[] {
  return [
    {
      id: "hel-fvh3-placeholder-flow",
      lat: hubLat,
      lon: hubLon,
      value: 1,
      properties: { mode: "bike", direction: "bike", baselineValue: 14, flowBearing: 90 },
    },
  ];
}

function helsinkiSensorIcon(color: string, selected: boolean, kind: "telraam" | "camera"): L.DivIcon {
  const size = selected ? 20 : 16;
  const half = size / 2;
  const shape =
    kind === "camera"
      ? `<span style="display:block;width:${size - 4}px;height:${size - 4}px;border:2.5px solid ${color};border-radius:2px;background:rgba(15,23,42,0.85);box-shadow:0 0 0 1px rgba(255,255,255,0.35);"></span>`
      : `<span style="display:block;width:${size - 2}px;height:${size - 2}px;border-radius:50%;background:${color};box-shadow:0 0 0 2px #fff,0 0 10px ${color}99;"></span>`;
  return L.divIcon({
    className: "helsinki-fvh3-sensor-wrap",
    html: `<button type="button" aria-label="Open observatory" style="all:unset;cursor:pointer;display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;">${shape}</button>`,
    iconSize: [size, size],
    iconAnchor: [half, half],
  });
}

/**
 * FVH3 mode share — two monitoring sensors from the Viikki site diagram:
 * Telraam (red) for mode-share counts, Mobilysis camera (orange) with FOV.
 */
function renderHelsinkiFvh3ModeShareSensors(options: {
  map: L.Map;
  telraam: HelsinkiTelraamKoetilantie | null;
  mobilysis: HelsinkiMobilysisGates | null;
  scenario: "baseline" | "intervention" | "comparison";
  activeMapSegmentId?: string | null;
  segmentInteractionEnabled: boolean;
  segmentHandlers: SegmentInteractionHandlers;
  circlesOut: L.CircleMarker[];
  polygonsOut: L.Polygon[];
  polylinesOut: L.Polyline[];
  markersOut: L.Marker[];
  wireCircleMarker: typeof wireCircleMarkerSegment;
}): void {
  const {
    map,
    telraam,
    mobilysis,
    scenario,
    activeMapSegmentId,
    segmentInteractionEnabled,
    segmentHandlers,
    circlesOut,
    polygonsOut,
    polylinesOut,
    markersOut,
    wireCircleMarker,
  } = options;

  const telLat =
    (telraam?.location.lat ?? HELSINKI_VIIKKI_ANCHOR.lat) + FVH3_TELRAAM_OFFSET.dLat;
  const telLon =
    (telraam?.location.lng ?? HELSINKI_VIIKKI_ANCHOR.lng) + FVH3_TELRAAM_OFFSET.dLng;
  const camLat = HELSINKI_VIIKKI_ANCHOR.lat + FVH3_CAMERA_OFFSET.dLat;
  const camLon = HELSINKI_VIIKKI_ANCHOR.lng + FVH3_CAMERA_OFFSET.dLng;

  const sustainablePct = telraam
    ? telraam.modeShare.bikePct + telraam.modeShare.pedestrianPct
    : null;
  const flows = telraam
    ? buildHelsinkiTelraamModeShareFlows(telraam, telLat, telLon)
    : placeholderFlows(telLat, telLon);

  const telraamId = telraam?.sensorId ?? "hel-viikki-telraam";
  const telraamSelected = Boolean(activeMapSegmentId && activeMapSegmentId === telraamId);
  const cameraId = "hel-viikki-mobilysis-camera";
  const cameraSelected = Boolean(activeMapSegmentId && activeMapSegmentId === cameraId);

  // Geographic FOV only — no CSS pulse (pixel-sized ripples break when zooming out).
  renderMobilityHubFovCone(
    map,
    camLat,
    camLon,
    flows.length ? flows : placeholderFlows(camLat, camLon),
    polygonsOut,
    {
      selected: cameraSelected,
      ringScale: 1.8,
      bearingDeg: FVH3_CAMERA_FOV_BEARING_DEG,
    }
  );
  const fov = polygonsOut[polygonsOut.length - 1];
  if (fov) {
    fov.setStyle({
      color: cameraSelected ? "#fdba74" : FVH3_CAMERA_COLOR,
      fillColor: FVH3_CAMERA_COLOR,
      weight: cameraSelected ? 2 : 1.2,
      opacity: cameraSelected ? 0.9 : 0.65,
      fillOpacity: cameraSelected ? 0.22 : 0.14,
    });
  }

  const telraamMarker = L.marker([telLat, telLon], {
    icon: helsinkiSensorIcon(FVH3_TELRAAM_COLOR, telraamSelected, "telraam"),
    interactive: true,
    keyboard: true,
    zIndexOffset: 2600,
    title: "Telraam Koetilantie",
  }).addTo(map);
  bindCopenhagenMapTooltip(telraamMarker, "Telraam · mode-share counts");
  const sustainableDisplay =
    sustainablePct != null
      ? intensityScalar(
          scenario,
          sustainablePct,
          Math.min(100, sustainablePct + (100 - sustainablePct) * 0.18),
          Math.min(
            100,
            Math.abs(sustainablePct + (100 - sustainablePct) * 0.18 - sustainablePct) * 4
          )
        )
      : null;
  telraamMarker.bindPopup(`
    <div style="font-family:'DM Sans',sans-serif;padding:8px;min-width:220px;">
      <p style="font-size:10px;color:#ef4444;margin:0 0 4px 0;text-transform:uppercase;font-weight:700;">FVH3 · Telraam sensor</p>
      <p style="font-size:14px;font-weight:700;color:#2F1B6D;margin:0 0 6px 0;">${telraam?.street ?? "Koetilantie"} · ${telraamId}</p>
      ${
        sustainableDisplay != null && telraam
          ? `<p style="font-size:18px;font-weight:700;color:#2F1B6D;margin:0 0 4px 0;">${sustainableDisplay.toFixed(1)}% sustainable</p>
             <p style="font-size:10px;color:#96C2EF;margin:2px 0;">Bike ${telraam.modeShare.bikePct}% · Ped ${telraam.modeShare.pedestrianPct}% · Car ${telraam.modeShare.carPct}%</p>
             <p style="font-size:10px;color:#96C2EF;margin:2px 0;">${telraam.dailyAggregates.length} daily aggregates</p>`
          : `<p style="font-size:10px;color:#96C2EF;margin:0;">Telraam mode-share feed unavailable.</p>`
      }
    </div>
  `);
  if (segmentInteractionEnabled) {
    wireMarkerSegment(
      telraamMarker,
      {
        segmentId: telraamId,
        segmentName: `Telraam · ${telraam?.street ?? "Koetilantie"}`,
        speed: null,
        congestion: null,
        properties: {
          datasetKind: "telraam",
          sensorType: "telraam",
          lat: telLat,
          lon: telLon,
        },
      },
      segmentHandlers
    );
  }
  markersOut.push(telraamMarker);

  const gateTotal =
    mobilysis?.gateObservations.reduce((sum, gate) => sum + gate.totalCount, 0) ?? 0;
  const cameraMarker = L.marker([camLat, camLon], {
    icon: helsinkiSensorIcon(FVH3_CAMERA_COLOR, cameraSelected, "camera"),
    interactive: true,
    keyboard: true,
    zIndexOffset: 2550,
    title: "Mobilysis camera",
  }).addTo(map);
  bindCopenhagenMapTooltip(cameraMarker, "Camera · Mobilysis gate counts");
  cameraMarker.bindPopup(`
    <div style="font-family:'DM Sans',sans-serif;padding:8px;min-width:220px;">
      <p style="font-size:10px;color:#f97316;margin:0 0 4px 0;text-transform:uppercase;font-weight:700;">FVH3 · Camera sensor</p>
      <p style="font-size:14px;font-weight:700;color:#2F1B6D;margin:0 0 6px 0;">Mobilysis Viikki gates</p>
      <p style="font-size:10px;color:#96C2EF;margin:2px 0;">${gateTotal.toLocaleString()} gate crossings · 2024-10-03 AM survey</p>
      <p style="font-size:10px;color:#96C2EF;margin:2px 0;">Orange FOV faces the tramway crossing (site diagram).</p>
      <p style="font-size:9px;color:#64748b;margin:6px 0 0 0;">Mode-share KPI uses Telraam counts; camera supplies VRU/vehicle gate context.</p>
    </div>
  `);
  if (segmentInteractionEnabled) {
    wireMarkerSegment(
      cameraMarker,
      {
        segmentId: cameraId,
        segmentName: "Mobilysis camera · Viikki",
        speed: null,
        congestion: null,
        properties: {
          datasetKind: "mobilysis-gate",
          sensorType: "camera",
          lat: camLat,
          lon: camLon,
        },
      },
      segmentHandlers
    );
  }
  markersOut.push(cameraMarker);

  // Fit only when the viewport is not already on Viikki — never yank zoom after the user zooms out.
  const viikki = L.latLng(HELSINKI_VIIKKI_ANCHOR.lat, HELSINKI_VIIKKI_ANCHOR.lng);
  const nearViikki = map.distance(map.getCenter(), viikki) < 2500;
  if (!nearViikki) {
    fitHelsinkiKpiView(
      map,
      [
        { lat: telLat, lon: telLon },
        { lat: camLat, lon: camLon },
        { lat: HELSINKI_VIIKKI_ANCHOR.lat, lon: HELSINKI_VIIKKI_ANCHOR.lng },
      ],
      "viikki"
    );
  }

  scheduleLeafletLayerRepaint(map, markersOut);
}

/**
 * KPI 1.2 — Milan-style multi-hub ripples.
 * FVH1/FVH2: cluster survey / parking points into ~8 hubs (Milan junction budget),
 * without borrowing the Viikki Telraam sensor from FVH3.
 * FVH3: Telraam (red) + Mobilysis camera (orange) — site-diagram sensor pair.
 */
export function renderHelsinkiKpi12Layers(
  options: RenderHelsinkiKpi12LayersOptions
): Promise<void> {
  const {
    map,
    selectedPilotId,
    activeMapSegmentId,
    scenario = "baseline",
    segmentInteractionEnabled,
    segmentHandlers,
    getValueColor,
    circlesOut,
    polygonsOut,
    polylinesOut,
    markersOut,
    wireCircleMarker = wireCircleMarkerSegment,
  } = options;

  const pilotId = selectedPilotId ?? "hel-p1";

  const telraamPromise = fetchHelsinkiJson<HelsinkiTelraamKoetilantie>(
    HELSINKI_TELRAAM_KOETILANTIE_JSON
  );

  if (pilotId === "hel-p3") {
    return Promise.all([
      telraamPromise,
      fetchHelsinkiJson<HelsinkiMobilysisGates>(HELSINKI_MOBILYSIS_VIIKKI_GATES_JSON),
    ]).then(([telraam, mobilysis]) => {
      renderHelsinkiFvh3ModeShareSensors({
        map,
        telraam,
        mobilysis,
        scenario,
        activeMapSegmentId,
        segmentInteractionEnabled,
        segmentHandlers,
        circlesOut,
        polygonsOut,
        polylinesOut,
        markersOut,
        wireCircleMarker,
      });
    });
  }

  if (pilotId === "hel-p2") {
    return loadHelsinkiEscooterObservationsGeoJson().then((escooter) => {
      const hubs = ensurePrimaryNearAnchor(
        clusterHelsinkiPointHubs(escooter.features, {
          cellDeg: 0.006,
          limit: HELSINKI_MODE_SHARE_HUB_LIMIT,
          idPrefix: "hel-escooter-hub",
          labelPrefix: "Kallio parking cluster",
        }),
        HELSINKI_KALLIO_ANCHOR,
        "hel-kallio-mode-share",
        "Kallio parking cluster"
      );
      const totalPoints = escooter.features.length;

      hubs.forEach((hub, index) => {
        const isPrimary = index === 0;
        drawModeShareRippleHub({
          map,
          hubLat: hub.lat,
          hubLon: hub.lon,
          segmentId: hub.id,
          label: hub.label,
          pilotTag: "FVH2 · KPI 1.2",
          flows: [],
          telraam: null,
          sustainablePct: null,
          isPrimary,
          hazardCount: hub.count || undefined,
          totalHazards: totalPoints,
          clusterKind: "parking",
          scenario,
          activeMapSegmentId,
          segmentInteractionEnabled,
          segmentHandlers,
          getValueColor,
          circlesOut,
          polygonsOut,
          polylinesOut,
          markersOut,
          wireCircleMarker,
        });
      });
      if (hubs.length > 0) {
        fitHelsinkiKpiView(map, hubs, "kallio");
      }
      scheduleLeafletLayerRepaint(map, markersOut);
    });
  }

  // hel-p1 (default for Pilot 1): survey point cloud + multi-hub ripples
  return Promise.all([loadHelsinkiDangerousLocationsGeoJson()]).then(
    ([dangerous]) => {
      renderHelsinkiSurveyPointUnderlay({
        map,
        features: dangerous.features,
        kind: "hazard",
        maxPoints: 220,
        circlesOut,
        segmentInteractionEnabled,
        segmentHandlers,
        activeMapSegmentId,
      });

      const hubs = ensurePrimaryNearAnchor(
        clusterHelsinkiPointHubs(dangerous.features, {
          cellDeg: 0.01,
          limit: HELSINKI_MODE_SHARE_HUB_LIMIT,
          idPrefix: "hel-hazard-hub",
          labelPrefix: "Hazard density cluster",
        }),
        HELSINKI_FVH1_SURVEY_HUB,
        "hel-dangerous-locations",
        "FVH1 densest hazard cluster"
      );
      const totalHazards = dangerous.features.length;

      hubs.forEach((hub, index) => {
        const isPrimary = index === 0;
        drawModeShareRippleHub({
          map,
          hubLat: hub.lat,
          hubLon: hub.lon,
          segmentId: hub.id,
          label: hub.label,
          pilotTag: "FVH1 · KPI 1.2",
          flows: [],
          telraam: null,
          sustainablePct: null,
          isPrimary,
          hazardCount: hub.count || undefined,
          totalHazards,
          scenario,
          activeMapSegmentId,
          segmentInteractionEnabled,
          segmentHandlers,
          getValueColor,
          circlesOut,
          polygonsOut,
          polylinesOut,
          markersOut,
          wireCircleMarker,
        });
      });

      if (hubs.length > 0) {
        fitHelsinkiKpiView(map, hubs, "city-hubs");
      }
      scheduleLeafletLayerRepaint(map, markersOut);
    }
  );
}
