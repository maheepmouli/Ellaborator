import L from "leaflet";
import type { TrikalaLocation, TrikalaLocationKind } from "@/data/trikalaLocationRegistry";
import type { SegmentInteractionHandlers } from "@/lib/wireMapSegmentInteraction";
import { wireCircleMarkerSegment, wirePolygonSegment, wirePolylineSegment, wireMarkerSegment } from "@/lib/wireMapSegmentInteraction";
import { buildSmartCrossingPolyline } from "./trikalaMapGeometry";
import {
  applyInfraMarkerGlow,
  capacityScale,
  getInfraColorByKind,
  getInfraGlowByKind,
  infraCircleMarkerStyle,
  infraMarkerRadius,
  infrastructurePopupHtml,
  TRIKALA_INFRA_COLORS,
  TRIKALA_PULSE_KINDS,
} from "./trikalaInfrastructureStyles";
import { createMapPointDivIcon } from "@/lib/mapPointIcons";
import { resolveTrikalaInfraIconSpec } from "./trikalaPointIcons";
import { clusterTrikalaBikeLaneSensors } from "./trikalaLocationClustering";
import {
  renderTrikalaAccessibilityZones,
  renderTrikalaEnvironmentalZones,
  renderTrikalaSatisfactionZones,
} from "./trikalaZoneHighlights";
import { spreadOverlappingPositions } from "@/lib/copenhagenMarkerLayout";
import { scheduleLeafletLayerRepaint } from "@/lib/leafletMapSync";
import { renderHubRipplePulseOverlay } from "@/lib/copenhagenMapLayers/copenhagenTrafficPulse";
import { fitTriParkRideHubBounds, TRIKALA_P2_PARK_RIDE_HUBS } from "./trikalaParkRideBounds";

/** Show CSS ripples from city/pilot fit zoom (P+R hubs sit farther apart than street cameras). */
const TRIKALA_P2_MODE_SHARE_PULSE_MIN_ZOOM = 11;

export interface RenderTrikalaInfrastructureOptions {
  map: L.Map;
  anchor: { lat: number; lng: number };
  locations: TrikalaLocation[];
  selectedKpi: string;
  selectedPilotId?: string | null;
  selectedSegmentId?: string | null;
  segmentHandlers: SegmentInteractionHandlers;
  markersOut: L.Marker[];
  circlesOut: L.Circle[];
  polylinesOut: L.Polyline[];
  polygonsOut?: L.Polygon[];
  /** When Copenhagen-style mode-share radar renders hub markers, skip duplicate P+R pins. */
  hideParkRideHubMarkers?: boolean;
  /** Observed busy % keyed by tri-loc-* id (bike-lane LoRa sensors). */
  bikeLaneBusyPctByLocationId?: Record<string, number>;
  /** Baseline hides P+R hubs for KPI 3.1 (0 installed → 3). */
  scenario?: "baseline" | "intervention" | "comparison";
}

type InfraPointEntry = {
  core: L.CircleMarker;
  pulse?: L.CircleMarker;
  kind: TrikalaLocationKind;
  scale: number;
  segmentId: string;
};

let infraZoomRegistry: InfraPointEntry[] = [];
let infraZoomMapRef: L.Map | null = null;

function resetInfraZoomSync(map: L.Map): void {
  if (infraZoomMapRef) {
    infraZoomMapRef.off("zoomend", syncInfraMarkerRadii);
    infraZoomMapRef.off("zoom", syncInfraMarkerRadii);
  }
  infraZoomRegistry = [];
  infraZoomMapRef = map;
  map.on("zoom", syncInfraMarkerRadii);
  map.on("zoomend", syncInfraMarkerRadii);
}

function syncInfraMarkerRadii(): void {
  if (!infraZoomMapRef) return;
  const zoom = infraZoomMapRef.getZoom();
  infraZoomRegistry.forEach(({ core, pulse, kind, scale, segmentId }) => {
    const expanded = core.getElement()?.classList.contains("tri-infra-marker--hover") ?? false;
    const r = infraMarkerRadius(kind, zoom, scale, expanded);
    core.setRadius(r);
    if (pulse) {
      pulse.setRadius(r * 2.2);
    }
    void segmentId;
  });
}

function isVisible(loc: TrikalaLocation, selectedKpi: string): boolean {
  return loc.mapVisible !== false && loc.linkedKpis.includes(selectedKpi);
}

/**
 * Pilot 2 · KPI 1.2 — Copenhagen/Issy-style mode-share ripples at each P+R hub
 * (SMY · DEH · GiSeMi): blue hub point + CSS ripple, no icon badges.
 */
function renderTrikalaPilot2ModeShareRipples(
  map: L.Map,
  locations: TrikalaLocation[],
  selectedKpi: string,
  selectedSegmentId: string | null | undefined,
  segmentHandlers: SegmentInteractionHandlers,
  markersOut: L.Marker[],
  circlesOut: L.Circle[]
): void {
  let hubs = locations
    .filter((l) => l.kind === "park_and_ride" && isVisible(l, selectedKpi))
    .map((l) => ({ id: l.id, name: l.name, lat: l.lat, lng: l.lng }));

  if (!hubs.length) {
    hubs = TRIKALA_P2_PARK_RIDE_HUBS.map((h) => ({
      id: h.id,
      name: h.name,
      lat: h.lat,
      lng: h.lng,
    }));
  }

  const circleMarkers = circlesOut as unknown as L.CircleMarker[];

  hubs.forEach((hub) => {
    const segmentId = hub.id;
    const segmentName = `${hub.name} Park & Ride`;

    renderHubRipplePulseOverlay(
      map,
      hub.lat,
      hub.lng,
      false,
      markersOut,
      circleMarkers,
      {
        showAnchorDot: true,
        ringColor: "#38bdf8",
        minZoom: TRIKALA_P2_MODE_SHARE_PULSE_MIN_ZOOM,
        ringScale: 1,
        interaction: {
          segmentId,
          segmentName,
          segmentHandlers,
          selectedSegmentId,
          wireCircleMarker: wireCircleMarkerSegment,
        },
      }
    );

    const hubDot = circleMarkers[circleMarkers.length - 1];
    if (hubDot && "bindTooltip" in hubDot) {
      hubDot.bindPopup(
        infrastructurePopupHtml(
          hub.name,
          "park_and_ride",
          "Pilot 2 · KPI 1.2 bike uptake from P+R"
        )
      );
      hubDot.bindTooltip(hub.name, {
        direction: "top",
        className: "tri-segment-tooltip",
        opacity: 0.94,
        offset: [0, -8],
      });
    }
  });
}

function renderParkAndRidePolygons(
  map: L.Map,
  locations: TrikalaLocation[],
  selectedKpi: string,
  selectedPilotId: string | null | undefined,
  selectedSegmentId: string | null | undefined,
  segmentHandlers: SegmentInteractionHandlers,
  polygonsOut: L.Polygon[],
  markersOut: L.Marker[],
  hideHubMarkers = false,
  hideEntirely = false
): void {
  // Pilot 2 · KPI 4.1: satisfaction is mock — map uses simple dots/labels only (no P+R polygons).
  if (selectedPilotId === "tri-p2" && selectedKpi === "kpi4.1") return;
  if (hideEntirely) return;
  const color = TRIKALA_INFRA_COLORS.emerald;
  const baseStyle: L.PathOptions = {
    color,
    weight: 3,
    opacity: 0.78,
    fillColor: color,
    fillOpacity: 0.24,
    className: "tri-infra-park-ride-poly",
  };
  const highlightStyle: L.PathOptions = {
    weight: 4.5,
    opacity: 0.95,
    fillOpacity: 0.38,
    dashArray: "6 4",
  };

  locations
    .filter((l) => l.kind === "park_and_ride" && isVisible(l, selectedKpi) && l.ring?.length)
    .forEach((loc) => {
      const segmentId = loc.id;
      const segmentName = `${loc.name} Park & Ride`;
      const isSelected = selectedSegmentId === segmentId;

      const poly = L.polygon(loc.ring!, { ...baseStyle }).addTo(map);
      poly.bindPopup(infrastructurePopupHtml(loc.name, loc.kind, loc.folderPath.join(" › ")));
      poly.bindTooltip(segmentName, {
        direction: "top",
        className: "tri-segment-tooltip",
        opacity: 0.94,
      });

      wirePolygonSegment(
        poly,
        {
          segmentId,
          segmentName,
          speed: null,
          congestion: null,
        },
        segmentHandlers,
        {
          baseStyle,
          highlightStyle,
          selectedSegmentId,
          hoverClassName: "tri-infra-park-ride-poly--hover",
        }
      );

      polygonsOut.push(poly);

      if (hideHubMarkers) return;

      const iconSpec = resolveTrikalaInfraIconSpec("park_and_ride", selectedKpi);
      const hubMarker = L.marker([loc.lat, loc.lng], {
        icon: createMapPointDivIcon(iconSpec, `${iconSpec.label} · ${loc.name}`),
        zIndexOffset: isSelected ? 1100 : 900,
      }).addTo(map);
      hubMarker.bindTooltip(loc.name, { direction: "top", opacity: 0.94 });
      wireMarkerSegment(
        hubMarker,
        { segmentId, segmentName, speed: null, congestion: null },
        segmentHandlers
      );
      markersOut.push(hubMarker);
    });
}

function renderSmartCrossingFromRegistry(
  map: L.Map,
  anchor: { lat: number; lng: number },
  locations: TrikalaLocation[],
  selectedKpi: string,
  selectedPilotId: string | null | undefined,
  selectedSegmentId: string | null | undefined,
  segmentHandlers: SegmentInteractionHandlers,
  polylinesOut: L.Polyline[]
): void {
  // Military School corridor is Pilot 1 only — do not draw on Pilot 3 bike-lane views.
  if (selectedPilotId !== "tri-p1") return;
  if (selectedKpi !== "kpi2.1" && selectedKpi !== "kpi4.1" && selectedKpi !== "kpi4.2") return;
  const site = locations.find((l) => l.kind === "smart_crossing_site");
  const end = site ? { lat: site.lat, lng: site.lng } : anchor;
  const coords = buildSmartCrossingPolyline(anchor, end);
  const color = TRIKALA_INFRA_COLORS.cyan;

  const core = L.polyline(coords, {
    color,
    weight: 1.5,
    opacity: 0.85,
    dashArray: "8 8",
    className: "tri-crossing-dash-animated",
    lineCap: "round",
  }).addTo(map);
  core.bindPopup(
    infrastructurePopupHtml(
      site?.name ?? "Smart crossing corridor",
      "smart_crossing_site",
      site?.folderPath.join(" › ") ?? "Vasili Tsitsani · Military School"
    )
  );
  wirePolylineSegment(
    core,
    {
      segmentId: "tri-p1-smart-crossing",
      segmentName: site?.name ?? "Smart crossing",
      speed: null,
      congestion: null,
    },
    segmentHandlers,
    {
      baseStyle: { color, weight: 1.5, opacity: 0.85 },
      highlightStyle: { weight: 3, opacity: 1, color: "#ffffff" },
      selectedSegmentId,
    }
  );
  polylinesOut.push(core);
}

function renderInfrastructureMarkers(
  map: L.Map,
  locations: TrikalaLocation[],
  selectedKpi: string,
  selectedPilotId: string | null | undefined,
  anchor: { lat: number; lng: number },
  selectedSegmentId: string | null | undefined,
  segmentHandlers: SegmentInteractionHandlers,
  markersOut: L.Marker[],
  circlesOut: L.Circle[],
  bikeLaneBusyPctByLocationId: Record<string, number> = {},
  bikeLaneSpread: Map<string, [number, number]> = new Map(),
  useBikeLaneHitMarkers = false
): void {
  resetInfraZoomSync(map);

  const pointKinds = new Set([
    "smart_crossing_site",
    "traffic_signal",
    "air_quality_sensor",
    "bike_station",
    "parking_station",
    "bike_lane_sensor",
  ]);

  const triP1CrossingKpi =
    selectedPilotId === "tri-p1" &&
    (selectedKpi === "kpi2.1" || selectedKpi === "kpi4.1" || selectedKpi === "kpi4.2");
  // Pilot 2 story is P+R bike hubs — municipal car park pins add clutter without KPI signal.
  // On KPI 3.1 keep the map to the three P+R hubs so the dashboard count (0→3) matches.
  // On KPI 4.1 mock satisfaction uses dedicated dots — skip other point clutter.
  const hideMunicipalCarParking = selectedPilotId === "tri-p2";
  const hideBikeStationsForFacilityCount =
    selectedPilotId === "tri-p2" && (selectedKpi === "kpi3.1" || selectedKpi === "kpi4.1");
  // Pilot 3 · KPI 2.1 — only LoRa bike-lane sensors (plain dots); hide bike-station icons.
  const triP3SafetySensorsOnly = selectedPilotId === "tri-p3" && selectedKpi === "kpi2.1";
  // Pilot 4 · KPI 4.1 — survey plain points only; skip infra icon badges.
  const triP4SatisfactionSurveyOnly = selectedPilotId === "tri-p4" && selectedKpi === "kpi4.1";

  const zoom = map.getZoom();

  if (triP4SatisfactionSurveyOnly) {
    return;
  }

  locations
    .filter((loc) => pointKinds.has(loc.kind) && isVisible(loc, selectedKpi))
    .filter((loc) => !(triP1CrossingKpi && loc.kind === "traffic_signal"))
    .filter((loc) => !(hideMunicipalCarParking && loc.kind === "parking_station"))
    .filter((loc) => !(hideBikeStationsForFacilityCount && loc.kind === "bike_station"))
    .filter((loc) => !(triP3SafetySensorsOnly && loc.kind !== "bike_lane_sensor"))
    .forEach((loc) => {
      const useMobilityHub = triP1CrossingKpi && loc.kind === "smart_crossing_site";
      const spread = bikeLaneSpread.get(loc.id);
      const lat = useMobilityHub ? anchor.lat : spread ? spread[0] : loc.lat;
      const lng = useMobilityHub ? anchor.lng : spread ? spread[1] : loc.lng;
      const segmentId = useMobilityHub ? "tri-p1-smart-crossing" : loc.id;
      const isSelected = selectedSegmentId === segmentId;
      const observedBusy =
        loc.kind === "bike_lane_sensor" ? bikeLaneBusyPctByLocationId[loc.id] : undefined;
      const mockSpeedKmh =
        loc.kind === "bike_lane_sensor" && typeof observedBusy === "number"
          ? Math.round(18 * (1 - observedBusy / 100) * 10) / 10
          : null;
      const scale =
        loc.kind === "bike_lane_sensor" && typeof observedBusy === "number"
          ? capacityScale(Math.max(1, Math.round(observedBusy / 10)))
          : capacityScale(loc.capacity);
      const expanded = isSelected;
      const fill = getInfraColorByKind(loc.kind);
      const glow = getInfraGlowByKind(loc.kind);
      const iconSpec = resolveTrikalaInfraIconSpec(loc.kind, selectedKpi);
      const segmentName = useMobilityHub
        ? "Smart crossing — Military School"
        : `${iconSpec.label} · ${loc.name}`;
      const segmentDetail = {
        segmentId,
        segmentName,
        speed: mockSpeedKmh,
        congestion: typeof observedBusy === "number" ? observedBusy / 100 : null,
      };
      const popupMetric =
        typeof observedBusy === "number"
          ? selectedKpi === "kpi2.1"
            ? `Occupancy ${Math.round(observedBusy)}% · mock speed ${mockSpeedKmh} km/h`
            : `Observed occupancy stress ${Math.round(observedBusy)}% (LoRa parking status)`
          : selectedKpi === "kpi4.2" && loc.kind === "bike_lane_sensor"
            ? "Bike-lane sensor location · scores from online bike-safety survey"
            : undefined;
      const popupHtml = infrastructurePopupHtml(
        loc.name,
        loc.kind,
        loc.folderPath.join(" › "),
        popupMetric
      );

      // KPI 4.1 smart crossing: blue point from satisfaction zone (no ripple, no icon).
      if (useMobilityHub && selectedKpi === "kpi4.1") {
        return;
      }

      // KPI 2.1 smart crossing: Issy-style blue hub + CSS ripple (no pedestrian icon).
      if (useMobilityHub && selectedKpi === "kpi2.1") {
        renderHubRipplePulseOverlay(
          map,
          lat,
          lng,
          false,
          markersOut,
          circlesOut as unknown as L.CircleMarker[],
          {
            showAnchorDot: true,
            ringColor: "#38bdf8",
            ringScale: 1.25,
            minZoom: 11,
            interaction: {
              segmentId,
              segmentName,
              segmentHandlers,
              selectedSegmentId,
              wireCircleMarker: wireCircleMarkerSegment,
            },
          }
        );
        return;
      }

      if (useBikeLaneHitMarkers && loc.kind === "bike_lane_sensor") {
        const stressAccent =
          selectedKpi === "kpi2.1" && typeof observedBusy === "number"
            ? observedBusy >= 50
              ? "#f59e0b"
              : "#22c55e"
            : selectedKpi === "kpi4.2"
              ? "#22c55e"
              : "#00ffff";

        // Plain coloured points only — per-sensor CSS ripples overlap into visual noise on Pilot 3.
        const point = L.circleMarker([lat, lng], {
          radius: isSelected ? 9 : 7,
          fillColor: stressAccent,
          color: "#ffffff",
          weight: 2,
          fillOpacity: 0.95,
          opacity: 1,
          interactive: true,
        }).addTo(map);
        point.bindPopup(popupHtml);
        point.bindTooltip(loc.name, {
          direction: "top",
          className: "tri-segment-tooltip",
          opacity: 0.94,
          offset: [0, -6],
        });
        wireCircleMarkerSegment(point, segmentDetail, segmentHandlers, {
          baseRadius: 7,
          highlightRadius: 11,
          selectedSegmentId,
          baseStyle: {
            fillColor: stressAccent,
            color: "#ffffff",
            weight: 2,
            fillOpacity: 0.95,
            opacity: 1,
          },
        });
        circlesOut.push(point);
        return;
      }

      const baseStyle = infraCircleMarkerStyle(loc.kind, zoom, scale, expanded);

      let pulse: L.CircleMarker | undefined;
      if (TRIKALA_PULSE_KINDS.has(loc.kind) && loc.kind !== "bike_lane_sensor") {
        const pulseR = infraMarkerRadius(loc.kind, zoom, scale, false) * 2.2;
        pulse = L.circleMarker([lat, lng], {
          radius: pulseR,
          color: glow,
          weight: 1.2,
          opacity: 0.28,
          fillColor: fill,
          fillOpacity: 0.03,
          interactive: false,
          className: `tri-infra-pulse-ring tri-infra-pulse-ring--${loc.kind}`,
        }).addTo(map);
        circlesOut.push(pulse);
      }

      const core = L.circleMarker([lat, lng], {
        ...baseStyle,
        interactive: true,
      }).addTo(map);
      const iconMarker = L.marker([lat, lng], {
        icon: createMapPointDivIcon(iconSpec, segmentName),
        interactive: false,
        zIndexOffset: isSelected ? 900 : 700,
      }).addTo(map);

      applyInfraMarkerGlow(core, loc.kind);
      core.setStyle({
        className: `tri-infra-marker tri-infra-marker--${loc.kind}`,
        fillOpacity: 0,
        opacity: 0,
        weight: 0,
      });

      core.bindPopup(popupHtml);
      core.bindTooltip(loc.name, {
        direction: "top",
        className: "tri-segment-tooltip",
        opacity: 0.94,
        offset: [0, -6],
      });

      const baseRadius = () => infraMarkerRadius(loc.kind, map.getZoom(), scale, false);
      const highlightRadius = () => infraMarkerRadius(loc.kind, map.getZoom(), scale, true);

      wireCircleMarkerSegment(
        core,
        segmentDetail,
        segmentHandlers,
        {
          baseRadius,
          highlightRadius,
          selectedSegmentId,
          baseStyle: {
            color: glow,
            weight: isSelected ? 3 : loc.kind === "bike_station" ? 2 : 1.5,
            opacity: 1,
            fillColor: fill,
            fillOpacity:
              loc.kind === "parking_station" ? (isSelected ? 0.72 : 0.55) : isSelected ? 0.9 : 0.65,
            className: `tri-infra-marker tri-infra-marker--${loc.kind}`,
          },
          highlightStyle: {
            color: "#ffffff",
            weight: 3,
            opacity: 1,
            fillOpacity: loc.kind === "parking_station" ? 0.82 : 0.92,
          },
        }
      );

      core.on("mouseover", () => {
        core.getElement()?.classList.add("tri-infra-marker--hover");
      });
      core.on("mouseout", () => {
        core.getElement()?.classList.remove("tri-infra-marker--hover");
      });

      infraZoomRegistry.push({ core, pulse, kind: loc.kind, scale, segmentId });
      circlesOut.push(core);
      markersOut.push(iconMarker);
    });
}

export function renderTrikalaInfrastructureLayers(
  options: RenderTrikalaInfrastructureOptions
): void {
  const {
    map,
    anchor,
    locations,
    selectedKpi,
    selectedPilotId,
    selectedSegmentId,
    segmentHandlers,
    markersOut,
    circlesOut,
    polylinesOut,
    polygonsOut = [],
    hideParkRideHubMarkers = false,
    bikeLaneBusyPctByLocationId = {},
    scenario = "intervention",
  } = options;

  if (!locations.length) return;

  const clusterBikeLanes =
    selectedPilotId === "tri-p3" &&
    selectedKpi !== "kpi2.1" &&
    selectedKpi !== "kpi4.2";
  const mapLocations = clusterBikeLanes
    ? clusterTrikalaBikeLaneSensors(locations)
    : locations;

  const useBikeLaneHitMarkers =
    selectedPilotId === "tri-p3" &&
    (selectedKpi === "kpi2.1" || selectedKpi === "kpi4.2");
  const bikeLaneSpread = useBikeLaneHitMarkers
    ? spreadOverlappingPositions(
        mapLocations
          .filter(
            (l) =>
              l.kind === "bike_lane_sensor" &&
              l.mapVisible !== false &&
              l.linkedKpis.includes(selectedKpi)
          )
          .map((l) => ({ id: l.id, lat: l.lat, lon: l.lng })),
        map.getZoom(),
        { zoomStable: true }
      )
    : new Map<string, [number, number]>();

  // KPI 3.1: baseline = 0 hubs installed — hide P+R geometry so map matches left panel.
  const hideParkRideEntirely =
    selectedPilotId === "tri-p2" && selectedKpi === "kpi3.1" && scenario === "baseline";

  // Pilot 2 · KPI 1.2: mode-share ripple hubs (not static icons / site polygons).
  const usePilot2ModeShareRipples =
    selectedPilotId === "tri-p2" && selectedKpi === "kpi1.2" && !hideParkRideEntirely;

  renderTrikalaEnvironmentalZones(map, mapLocations, selectedKpi, circlesOut, markersOut);
  renderTrikalaSatisfactionZones(
    map,
    anchor,
    mapLocations,
    selectedKpi,
    selectedPilotId,
    circlesOut,
    markersOut,
    { segmentHandlers, selectedSegmentId }
  );
  renderTrikalaAccessibilityZones(map, mapLocations, selectedKpi, circlesOut, markersOut);

  if (usePilot2ModeShareRipples) {
    renderTrikalaPilot2ModeShareRipples(
      map,
      mapLocations,
      selectedKpi,
      selectedSegmentId,
      segmentHandlers,
      markersOut,
      circlesOut
    );
  } else {
    renderParkAndRidePolygons(
      map,
      mapLocations,
      selectedKpi,
      selectedPilotId,
      selectedSegmentId,
      segmentHandlers,
      polygonsOut,
      markersOut,
      hideParkRideHubMarkers,
      hideParkRideEntirely
    );
  }
  renderSmartCrossingFromRegistry(
    map,
    anchor,
    mapLocations,
    selectedKpi,
    selectedPilotId,
    selectedSegmentId,
    segmentHandlers,
    polylinesOut
  );
  renderInfrastructureMarkers(
    map,
    mapLocations,
    selectedKpi,
    selectedPilotId,
    anchor,
    selectedSegmentId,
    segmentHandlers,
    markersOut,
    circlesOut,
    bikeLaneBusyPctByLocationId,
    bikeLaneSpread,
    useBikeLaneHitMarkers
  );

  if (selectedPilotId === "tri-p2") {
    fitTriParkRideHubBounds(map, mapLocations, selectedKpi);
  }

  const circleMarkers = circlesOut.filter(
    (layer): layer is L.CircleMarker => typeof (layer as L.CircleMarker).setRadius === "function"
  );
  scheduleLeafletLayerRepaint(map, markersOut, circleMarkers);
  window.setTimeout(
    () => scheduleLeafletLayerRepaint(map, markersOut, circleMarkers),
    120
  );
}
