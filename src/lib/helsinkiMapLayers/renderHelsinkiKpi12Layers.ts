import L from "leaflet";
import {
  fetchHelsinkiJson,
  HELSINKI_KALLIO_ANCHOR,
  HELSINKI_TELRAAM_KOETILANTIE_JSON,
  HELSINKI_VIIKKI_ANCHOR,
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

function placeholderFlows(hubLat: number, hubLon: number): CopenhagenObservedPoint[] {
  return [
    {
      lat: hubLat,
      lon: hubLon,
      id: "hel-mode-share-placeholder",
      value: 50,
      properties: {
        direction: "bike outbound",
        mode: "Bike",
        flowBearing: 40,
        baselineValue: 50,
        interventionValue: 50,
        comparisonValue: 0,
      },
    },
  ];
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
      ? `<p style="font-size:10px;color:#96C2EF;margin:2px 0;">Dangerous-location reports in cluster: ${hazardCount.toLocaleString()}${
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
            ? `<p style="font-size:10px;color:#96C2EF;margin:0;">Telraam package not loaded</p>`
            : `<p style="font-size:10px;color:#96C2EF;margin:6px 0 0 0;">Mode-share hub · click primary cluster for Telraam breakdown</p>`
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

/**
 * KPI 1.2 — Milan-style multi-hub ripples.
 * FVH1/FVH2: cluster survey / parking points into ~8 hubs (Milan junction budget).
 * FVH3: single Telraam Viikki hub (one sensor).
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
    return telraamPromise.then((telraam) => {
      const hubLat = telraam?.location.lat ?? HELSINKI_VIIKKI_ANCHOR.lat;
      const hubLon = telraam?.location.lng ?? HELSINKI_VIIKKI_ANCHOR.lng;
      const flows = telraam
        ? buildHelsinkiTelraamModeShareFlows(telraam, hubLat, hubLon)
        : placeholderFlows(hubLat, hubLon);
      const sustainablePct = telraam
        ? telraam.modeShare.bikePct + telraam.modeShare.pedestrianPct
        : null;

      drawModeShareRippleHub({
        map,
        hubLat,
        hubLon,
        segmentId: telraam?.sensorId ?? "hel-viikki-telraam",
        label: `Viikki · ${telraam?.street ?? "Koetilantie"} Telraam`,
        pilotTag: "FVH3 · KPI 1.2",
        flows,
        telraam,
        sustainablePct,
        isPrimary: true,
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
      fitHelsinkiKpiView(map, [{ lat: hubLat, lon: hubLon }], "viikki");
      scheduleLeafletLayerRepaint(map, markersOut);
    });
  }

  if (pilotId === "hel-p2") {
    return Promise.all([telraamPromise, loadHelsinkiEscooterObservationsGeoJson()]).then(
      ([telraam, escooter]) => {
        const hubs = ensurePrimaryNearAnchor(
          clusterHelsinkiPointHubs(escooter.features, {
            cellDeg: 0.006,
            limit: HELSINKI_MODE_SHARE_HUB_LIMIT,
            idPrefix: "hel-escooter-hub",
            labelPrefix: "Kallio parking cluster",
          }),
          HELSINKI_KALLIO_ANCHOR,
          "hel-kallio-mode-share",
          "Kallio · Telraam mode-share support"
        );
        const totalPoints = escooter.features.length;
        const sustainablePct = telraam
          ? telraam.modeShare.bikePct + telraam.modeShare.pedestrianPct
          : null;

        hubs.forEach((hub, index) => {
          const isPrimary = index === 0;
          const flows =
            isPrimary && telraam
              ? buildHelsinkiTelraamModeShareFlows(telraam, hub.lat, hub.lon)
              : placeholderFlows(hub.lat, hub.lon);
          drawModeShareRippleHub({
            map,
            hubLat: hub.lat,
            hubLon: hub.lon,
            segmentId: hub.id,
            label: hub.label,
            pilotTag: "FVH2 · KPI 1.2",
            flows,
            telraam,
            sustainablePct,
            isPrimary,
            hazardCount: hub.count || undefined,
            totalHazards: totalPoints,
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
      }
    );
  }

  // hel-p1 (default for Pilot 1): survey point cloud + multi-hub ripples
  return Promise.all([telraamPromise, loadHelsinkiDangerousLocationsGeoJson()]).then(
    ([telraam, dangerous]) => {
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
        "FVH1 densest hazard cluster · Telraam mode-share"
      );
      const totalHazards = dangerous.features.length;
      const sustainablePct = telraam
        ? telraam.modeShare.bikePct + telraam.modeShare.pedestrianPct
        : null;

      hubs.forEach((hub, index) => {
        const isPrimary = index === 0;
        const flows =
          isPrimary && telraam
            ? buildHelsinkiTelraamModeShareFlows(telraam, hub.lat, hub.lon)
            : placeholderFlows(hub.lat, hub.lon);
        drawModeShareRippleHub({
          map,
          hubLat: hub.lat,
          hubLon: hub.lon,
          segmentId: hub.id,
          label: hub.label,
          pilotTag: "FVH1 · KPI 1.2",
          flows,
          telraam,
          sustainablePct,
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
