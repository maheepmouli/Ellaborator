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

function renderParkAndRidePolygons(
  map: L.Map,
  locations: TrikalaLocation[],
  selectedKpi: string,
  selectedSegmentId: string | null | undefined,
  segmentHandlers: SegmentInteractionHandlers,
  polygonsOut: L.Polygon[],
  markersOut: L.Marker[],
  hideHubMarkers = false
): void {
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
  selectedSegmentId: string | null | undefined,
  segmentHandlers: SegmentInteractionHandlers,
  polylinesOut: L.Polyline[]
): void {
  if (selectedKpi !== "kpi2.1" && selectedKpi !== "kpi4.2") return;
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

  const triP1SafetyKpi =
    selectedPilotId === "tri-p1" && (selectedKpi === "kpi2.1" || selectedKpi === "kpi4.2");

  const zoom = map.getZoom();

  locations
    .filter((loc) => pointKinds.has(loc.kind) && isVisible(loc, selectedKpi))
    .filter((loc) => !(triP1SafetyKpi && loc.kind === "traffic_signal"))
    .forEach((loc) => {
      const useMobilityHub = triP1SafetyKpi && loc.kind === "smart_crossing_site";
      const spread = bikeLaneSpread.get(loc.id);
      const lat = useMobilityHub ? anchor.lat : spread ? spread[0] : loc.lat;
      const lng = useMobilityHub ? anchor.lng : spread ? spread[1] : loc.lng;
      const segmentId = useMobilityHub ? "tri-p1-smart-crossing" : loc.id;
      const isSelected = selectedSegmentId === segmentId;
      const observedBusy =
        loc.kind === "bike_lane_sensor" ? bikeLaneBusyPctByLocationId[loc.id] : undefined;
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
        speed: null as null,
        congestion: null as null,
      };
      const popupMetric =
        typeof observedBusy === "number"
          ? selectedKpi === "kpi4.2"
            ? `Observed lane availability ${Math.round(100 - observedBusy)}% (LoRa parking status)`
            : `Observed occupancy stress ${Math.round(observedBusy)}% (LoRa parking status)`
          : undefined;
      const popupHtml = infrastructurePopupHtml(
        loc.name,
        loc.kind,
        loc.folderPath.join(" › "),
        popupMetric
      );

      if (useBikeLaneHitMarkers && loc.kind === "bike_lane_sensor") {
        const hitMarker = L.marker([lat, lng], {
          icon: createMapPointDivIcon(iconSpec, segmentName),
          interactive: true,
          zIndexOffset: isSelected ? 1200 : 950,
          riseOnHover: true,
        }).addTo(map);
        hitMarker.bindPopup(popupHtml);
        hitMarker.bindTooltip(loc.name, {
          direction: "top",
          className: "tri-segment-tooltip",
          opacity: 0.94,
          offset: [0, -6],
        });
        wireMarkerSegment(hitMarker, segmentDetail, segmentHandlers);
        markersOut.push(hitMarker);
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

  renderTrikalaEnvironmentalZones(map, mapLocations, selectedKpi, circlesOut, markersOut);
  renderTrikalaSatisfactionZones(
    map,
    anchor,
    mapLocations,
    selectedKpi,
    selectedPilotId,
    circlesOut,
    markersOut
  );
  renderTrikalaAccessibilityZones(map, mapLocations, selectedKpi, circlesOut, markersOut);

  renderParkAndRidePolygons(
    map,
    mapLocations,
    selectedKpi,
    selectedSegmentId,
    segmentHandlers,
    polygonsOut,
    markersOut,
    hideParkRideHubMarkers
  );
  renderSmartCrossingFromRegistry(
    map,
    anchor,
    mapLocations,
    selectedKpi,
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
