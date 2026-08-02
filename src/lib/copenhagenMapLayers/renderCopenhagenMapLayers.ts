import L from "leaflet";
import {
  getLocationsForPilot,
  inferOtcWorkbookKey,
  type CopenhagenLocation,
} from "@/data/copenhagenLocationRegistry";
import {
  copenhagenLocationSegmentId,
  copenhagenSiteSegmentId,
  directionMatchesSiteSelection,
} from "@/lib/copenhagenMapSelection";
import { renderInfluenceField } from "@/lib/renderInfluenceField";
import { getCopenhagenPilotZoneAnchor } from "@/data/copenhagenCameraSites";
import {
  buildFovWedgePolygon,
  destinationLatLng,
  hubForWorkbook,
  workbookHubBearing,
} from "./copenhagenFlowGeometry";
import {
  resolveCopenhagenIntensityColor,
} from "./copenhagenFlowStyles";
import type { SegmentInteractionHandlers } from "@/lib/wireMapSegmentInteraction";
import { wireMarkerSegment, wirePolylineSegment } from "@/lib/wireMapSegmentInteraction";
import { spreadOverlappingPositions } from "@/lib/copenhagenMarkerLayout";
import { resolveMapPointIconSpec } from "@/lib/mapPointIconTaxonomy";
import { addNeonPointMarker } from "@/lib/mapPointIcons";
import {
  buildParkingPopupHtml,
  parkingSegmentDetailFromProps,
  renderCopenhagenStreetUnderlay,
  resolveParkingCategoryColor,
} from "./copenhagenParkingLayerStyles";
import { renderCopenhagenRadarFlowLayout } from "./copenhagenRadarFlowLayout";
import { bindCopenhagenMapTooltip } from "./copenhagenMapTooltips";
import {
  renderCopenhagenTrafficPulseOverlay,
  renderHubRipplePulseOverlay,
} from "./copenhagenTrafficPulse";
import {
  emissionsIntensityToColor,
  co2GPerHourToKpiIntensity,
  co2ReductionPct,
  maxCo2GPerHourFromFlows,
} from "@/lib/copenhagenEmissionsModel";
import { scheduleLeafletLayerRepaint } from "@/lib/leafletMapSync";

export interface CopenhagenObservedPoint {
  lat: number;
  lon: number;
  id: string;
  value: number;
  properties?: Record<string, unknown>;
}

export interface RenderCopenhagenMapLayersOptions {
  map: L.Map;
  pilotId: string | null | undefined;
  observedPoints: CopenhagenObservedPoint[];
  scenario: "baseline" | "intervention" | "comparison";
  selectedSegmentId?: string | null;
  segmentHandlers: SegmentInteractionHandlers;
  getValueColor: (value: number, safetyKpi: boolean) => string;
  selectedKpi: string;
  modeFilterLabel?: string;
  parkingGeoJson?: GeoJSON.FeatureCollection | null;
  streetsGeoJson?: GeoJSON.FeatureCollection | null;
  markersOut: L.Marker[];
  circlesOut: L.CircleMarker[];
  polylinesOut: L.Polyline[];
  polygonsOut: L.Polygon[];
  circlesInfluenceOut: L.Circle[];
  showPilotField?: boolean;
  wireCircleMarker: (
    marker: L.CircleMarker,
    meta: { segmentId: string; segmentName: string; speed: null; congestion: null },
    handlers: SegmentInteractionHandlers,
    opts: {
      baseRadius: number;
      highlightRadius?: number;
      selectedSegmentId?: string | null;
      baseStyle?: L.PathOptions;
      highlightStyle?: L.PathOptions;
    }
  ) => void;
}

function inferCameraId(siteName: string): string {
  return inferOtcWorkbookKey(siteName) ?? siteName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function featureSelected(
  selectedId: string | null | undefined,
  segmentId: string,
  cameraId: string,
  siteName: string
): boolean {
  if (!selectedId) return false;
  if (selectedId === segmentId) return true;
  if (selectedId === `corridor:${cameraId}`) return true;
  if (selectedId.includes(cameraId)) return true;
  return directionMatchesSiteSelection(segmentId, siteName, selectedId);
}

/** HTML divIcon dot — paints reliably after flyTo (Leaflet SVG circles often stay invisible until hover). */
function addCopenhagenMapDot(options: {
  map: L.Map;
  lat: number;
  lon: number;
  fillColor: string;
  strokeColor?: string;
  radius?: number;
  markersOut: L.Marker[];
  segmentHandlers: SegmentInteractionHandlers;
  detail: { segmentId: string; segmentName: string; speed: null; congestion: null };
  tooltip?: string;
  zIndexOffset?: number;
  selected?: boolean;
}): L.Marker {
  const radius = options.radius ?? 8;
  const size = Math.max(14, Math.round(radius * 2.25));
  const stroke = options.strokeColor ?? "#ffffff";
  const fill = options.fillColor;
  const html = `<div class="cph-map-dot${options.selected ? " is-selected" : ""}" style="width:${size}px;height:${size}px;border-radius:50%;background:${fill};border:2px solid ${stroke};box-shadow:0 1px 7px rgba(0,0,0,.5);"></div>`;
  const marker = L.marker([options.lat, options.lon], {
    // Avoid Leaflet zoom-pane transforms fighting manual setPosition nudges (marker trails).
    zoomAnimation: false,
    icon: L.divIcon({
      className: "cph-map-dot-wrap",
      html,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    }),
    zIndexOffset: options.zIndexOffset ?? (options.selected ? 1200 : 1100),
  }).addTo(options.map);
  if (options.tooltip) {
    bindCopenhagenMapTooltip(marker, options.tooltip);
  }
  wireMarkerSegment(marker, options.detail, options.segmentHandlers);
  options.markersOut.push(marker);
  return marker;
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

function aggregateWorkbookIntensity(
  flows: CopenhagenObservedPoint[],
  scenario: "baseline" | "intervention" | "comparison",
  getValueColor: (value: number, safetyKpi: boolean) => string,
  safetyKpi: boolean
): { color: string; value: number } {
  if (!flows.length) {
    return { color: "#64748b", value: 0 };
  }
  let baselineSum = 0;
  let interventionSum = 0;
  let comparisonSum = 0;
  flows.forEach((point) => {
    const props = point.properties ?? {};
    const baselineValue = Number(props.baselineValue ?? point.value ?? 0);
    const interventionValue = Number(props.interventionValue ?? point.value ?? 0);
    const comparisonValue =
      typeof props.comparisonValue === "number"
        ? Number(props.comparisonValue)
        : interventionValue - baselineValue;
    baselineSum += baselineValue;
    interventionSum += interventionValue;
    comparisonSum += comparisonValue;
  });
  const n = flows.length;
  const baselineValue = baselineSum / n;
  const interventionValue = interventionSum / n;
  const comparisonValue = comparisonSum / n;
  const value = intensityScalar(scenario, baselineValue, interventionValue, comparisonValue);
  const color = resolveCopenhagenIntensityColor({
    scenario,
    baselineValue,
    interventionValue,
    comparisonValue,
    getValueColor,
    safetyKpi,
  });
  return { color, value };
}

function renderRegistryMarkers(
  map: L.Map,
  pilotId: string | null | undefined,
  markersOut: L.Marker[],
  circlesOut: L.CircleMarker[],
  handlers: SegmentInteractionHandlers,
  selectedSegmentId: string | null | undefined,
  flowsByWorkbook: Map<string, CopenhagenObservedPoint[]>,
  scenario: "baseline" | "intervention" | "comparison",
  getValueColor: (value: number, safetyKpi: boolean) => string,
  selectedKpi: string,
  wireCircleMarker: RenderCopenhagenMapLayersOptions["wireCircleMarker"]
): CopenhagenLocation[] {
  if (selectedKpi === "kpi3.2") {
    return [];
  }

  // Facilities / accessibility / satisfaction: inventory or survey pins only — no OTC camera hubs.
  if (selectedKpi === "kpi3.1" || selectedKpi === "kpi4.2" || selectedKpi === "kpi4.1") {
    return [];
  }

  const iconOnlyKpi = selectedKpi === "kpi3.2" || selectedKpi === "kpi4.1";
  const aggregateHubKpi = selectedKpi === "kpi1.2" || selectedKpi === "kpi2.1";
  const locations = getLocationsForPilot(pilotId).filter((loc) => {
    if (iconOnlyKpi) return loc.kind === "otc_workbook_site";
    // OTC hubs + FOV cameras + Telraam counters (Medieval City — Pilot 1 + Pilot 3).
    if (aggregateHubKpi) {
      return (
        loc.kind === "otc_workbook_site" ||
        loc.kind === "intelligent_camera" ||
        loc.kind === "telraam_counter"
      );
    }
    if (loc.kind === "flow_camera") return selectedKpi === "kpi1.2";
    return (
      loc.kind === "telraam_counter" ||
      loc.kind === "intelligent_camera" ||
      loc.kind === "otc_workbook_site"
    );
  });

  const markerLayout = spreadOverlappingPositions(
    locations.map((loc) => ({ id: loc.id, lat: loc.lat, lon: loc.lon })),
    map.getZoom(),
    { zoomStable: true }
  );

  locations.forEach((loc) => {
    // Aggregated hub mode: OTC workbook hubs + Telraam dots.
    // Intelligent cameras stay for FOV only (not drawn as hubs).
    if (
      aggregateHubKpi &&
      loc.kind !== "otc_workbook_site" &&
      loc.kind !== "telraam_counter"
    ) {
      return;
    }
    // Pulse overlay owns the OTC hub marker when flows exist (avoids purple + blue/red doubles).
    if (
      aggregateHubKpi &&
      loc.kind === "otc_workbook_site" &&
      loc.otcWorkbookKey &&
      (flowsByWorkbook.get(loc.otcWorkbookKey)?.length ?? 0) > 0
    ) {
      return;
    }
    const [markerLat, markerLon] = markerLayout.get(loc.id) ?? [loc.lat, loc.lon];
    const isSite = loc.kind === "otc_workbook_site";
    const segmentId = isSite
      ? copenhagenSiteSegmentId(loc.otcWorkbookKey ?? loc.id)
      : copenhagenLocationSegmentId(loc.id);
    const isSelected = selectedSegmentId === segmentId || featureSelected(
      selectedSegmentId,
      segmentId,
      loc.otcWorkbookKey ?? loc.id,
      loc.name
    );

    if (loc.kind === "flow_camera") {
      addCopenhagenMapDot({
        map,
        lat: markerLat,
        lon: markerLon,
        fillColor: isSelected ? "#00ffff" : "#f59e0b",
        strokeColor: isSelected ? "#ffffff" : "#f59e0b",
        radius: isSelected ? 10 : 8,
        markersOut,
        segmentHandlers: handlers,
        detail: { segmentId, segmentName: loc.name, speed: null, congestion: null },
        tooltip: `${loc.name} · Platomo flow camera`,
        selected: isSelected,
      });
      return;
    }

    if (loc.kind === "telraam_counter") {
      // Same ripple language as OTC hubs — cyan for Telraam continuous counters.
      renderHubRipplePulseOverlay(map, markerLat, markerLon, true, markersOut, circlesOut, {
        ringColor: isSelected ? "#00ffff" : "#38BDF8",
        showAnchorDot: true,
        ringScale: 0.85,
        interaction: {
          segmentId,
          segmentName: loc.name,
          segmentHandlers: handlers,
          selectedSegmentId,
          wireCircleMarker,
        },
      });
      return;
    }

    if (loc.kind === "intelligent_camera") {
      const workbookKey = loc.otcWorkbookKey;
      const workbookFlows = workbookKey ? flowsByWorkbook.get(workbookKey) ?? [] : [];
      const { color: accentColor } = aggregateWorkbookIntensity(
        workbookFlows,
        scenario,
        getValueColor,
        selectedKpi === "kpi2.1"
      );

      addCopenhagenMapDot({
        map,
        lat: markerLat,
        lon: markerLon,
        fillColor: isSelected ? "#00ffff" : accentColor,
        strokeColor: "#ffffff",
        radius: isSelected ? 10 : 8,
        markersOut,
        segmentHandlers: handlers,
        detail: { segmentId, segmentName: loc.name, speed: null, congestion: null },
        tooltip: `${loc.name} · OpenTrafficCam camera`,
        selected: isSelected,
      });
      return;
    }

    if (isSite) {
      addCopenhagenMapDot({
        map,
        lat: markerLat,
        lon: markerLon,
        fillColor: isSelected ? "#00ffff" : "#c4b5fd",
        strokeColor: isSelected ? "#ffffff" : "#a78bfa",
        radius: isSelected ? 10 : 9,
        markersOut,
        segmentHandlers: handlers,
        detail: { segmentId, segmentName: loc.name, speed: null, congestion: null },
        tooltip: `${loc.name} · OpenTrafficCam workbook hub`,
        selected: isSelected,
      });
      return;
    }
  });

  return locations;
}

function renderCameraFovCones(
  map: L.Map,
  cameras: CopenhagenLocation[],
  polygonsOut: L.Polygon[],
  selectedSegmentId: string | null | undefined
): void {
  const intelligent = cameras.filter((l) => l.kind === "intelligent_camera");
  const byWorkbook = new Map<string, CopenhagenLocation[]>();
  intelligent.forEach((cam) => {
    const key = cam.otcWorkbookKey ?? cam.id;
    const list = byWorkbook.get(key) ?? [];
    list.push(cam);
    byWorkbook.set(key, list);
  });

  byWorkbook.forEach((cams, workbookKey) => {
    const hub = hubForWorkbook(workbookKey, cams, { lat: cams[0].lat, lon: cams[0].lon });
    const siteSelected =
      selectedSegmentId === copenhagenSiteSegmentId(workbookKey) ||
      cams.some((c) => selectedSegmentId === copenhagenLocationSegmentId(c.id));
    const bearing = workbookHubBearing(workbookKey);
    const ring = buildFovWedgePolygon(hub.lat, hub.lon, bearing, {
      radiusM: cams.length > 1 ? 58 : 72,
      sweepDeg: cams.length > 1 ? 68 : 54,
    });
    const cone = L.polygon(ring, {
      color: siteSelected ? "#00ffff" : "#96C2EF",
      weight: siteSelected ? 1.8 : 1,
      opacity: siteSelected ? 0.85 : 0.45,
      fillColor: siteSelected ? "#00ffff" : "#96C2EF",
      fillOpacity: siteSelected ? 0.22 : 0.12,
      interactive: false,
    }).addTo(map);
    polygonsOut.push(cone);
  });
}

export function renderCopenhagenPilotInfluenceField(
  map: L.Map,
  pilotId: string | null | undefined,
  circlesOut: L.Circle[]
): void {
  if (!pilotId?.startsWith("cph-")) return;
  const anchor = getCopenhagenPilotZoneAnchor(pilotId);
  if (!anchor) return;
  const radiusM = Math.max(320, anchor.radiusDeg * 111320);
  renderInfluenceField(map, circlesOut, {
    center: [anchor.lat, anchor.lon],
    radiusMeters: radiusM,
    tone: "neutral",
  });
  const outline = L.circle([anchor.lat, anchor.lon], {
    radius: radiusM,
    color: "rgba(255,255,255,0.22)",
    weight: 1.2,
    dashArray: "5 7",
    fillOpacity: 0,
    interactive: false,
  }).addTo(map);
  circlesOut.push(outline);
}

const KPI_ICON_DATASET_KINDS: Record<string, string[]> = {
  "kpi3.2": ["emissions"],
  "kpi4.1": ["survey"],
  "kpi4.2": ["accessibility"],
  "kpi2.1": ["irap", "near_encounter", "tube"],
};

/** Trikala-style smart-crossing half-length along the corridor (meters). */
const CPH_A11Y_CROSSING_HALF_M = 52;
const CPH_A11Y_CROSSING_COLOR = "#00ffff";

/**
 * KPI 4.2 — cyan dashed crossing vector only.
 * Sample dimension pins stay as satellites via renderCopenhagenIconPoints (no hub ripple).
 */
function renderCopenhagenAccessibilitySafetyCorridor(options: {
  map: L.Map;
  pilotId: string | null | undefined;
  observedPoints: CopenhagenObservedPoint[];
  selectedSegmentId?: string | null;
  segmentHandlers: SegmentInteractionHandlers;
  markersOut: L.Marker[];
  circlesOut: L.CircleMarker[];
  polylinesOut: L.Polyline[];
}): void {
  const {
    map,
    pilotId,
    observedPoints,
    selectedSegmentId,
    segmentHandlers,
    polylinesOut,
  } = options;

  const a11yPoints = observedPoints.filter(
    (p) => String(p.properties?.datasetKind ?? "") === "accessibility"
  );
  if (!a11yPoints.length) return;

  const hubLat = a11yPoints.reduce((s, p) => s + p.lat, 0) / a11yPoints.length;
  const hubLon = a11yPoints.reduce((s, p) => s + p.lon, 0) / a11yPoints.length;

  const streetHint = String(a11yPoints[0]?.properties?.streetName ?? "");
  const workbookKey =
    inferOtcWorkbookKey(streetHint) ||
    (pilotId === "cph-p2" ? "vandkunsten" : pilotId === "cph-p1" ? "gammeltorv" : "stormgade");
  const bearing = workbookHubBearing(workbookKey);

  const west = destinationLatLng(hubLat, hubLon, bearing + 180, CPH_A11Y_CROSSING_HALF_M);
  const east = destinationLatLng(hubLat, hubLon, bearing, CPH_A11Y_CROSSING_HALF_M);
  const vectorCoords: [number, number][] = [west, [hubLat, hubLon], east];

  const hubSegmentId = "cph-a11y-crossing-hub";
  const hubName = "Accessibility corridor · smart crossing";
  const hubDetail = {
    segmentId: hubSegmentId,
    segmentName: hubName,
    speed: null as null,
    congestion: null as null,
  };

  const core = L.polyline(vectorCoords, {
    color: CPH_A11Y_CROSSING_COLOR,
    weight: 1.5,
    opacity: 0.85,
    dashArray: "8 8",
    className: "tri-crossing-dash-animated",
    lineCap: "round",
  }).addTo(map);
  core.bindPopup(
    `<div style="font-family:'DM Sans',sans-serif;padding:8px;min-width:200px;">
      <p style="font-size:11px;color:#8578C3;margin:0 0 2px;text-transform:uppercase;">Crossing vector</p>
      <p style="font-size:10px;color:#96C2EF;margin:2px 0;">${hubName}</p>
      <p style="font-size:9px;color:#FBBF24;margin-top:6px;line-height:1.35;">MOCK — corridor vector on mode-share site geometry.</p>
    </div>`
  );
  wirePolylineSegment(core, hubDetail, segmentHandlers, {
    baseStyle: { color: CPH_A11Y_CROSSING_COLOR, weight: 1.5, opacity: 0.85 },
    highlightStyle: { weight: 3, opacity: 1, color: "#ffffff" },
    selectedSegmentId,
  });
  polylinesOut.push(core);
}

function buildEmissionsPopup(point: CopenhagenObservedPoint): string {
  const props = point.properties ?? {};
  const preG = Number(props.preCo2GPerHour ?? 0);
  const postG = Number(props.postCo2GPerHour ?? 0);
  const reduction = Number(props.comparisonValue ?? 0);
  const streetName = String(props.streetName ?? "Copenhagen");
  const flowCount = Number(props.flowCount ?? 1);
  return `
    <div style="font-family: 'DM Sans', sans-serif; padding: 8px; min-width: 210px;">
      <p style="font-size: 11px; color: #8578C3; margin: 0 0 2px 0; text-transform: uppercase;">Modelled emissions intensity</p>
      <p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">${streetName}</p>
      ${flowCount > 1 ? `<p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">${flowCount} directional flows at this site</p>` : ""}
      <p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Pre: ${preG.toLocaleString()} g CO₂/h</p>
      <p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Post: ${postG.toLocaleString()} g CO₂/h</p>
      <p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Reduction: ${reduction >= 0 ? "+" : ""}${reduction.toFixed(1)}%</p>
      <p style="font-size: 9px; color: #96C2EF; margin-top: 4px;">COPERT-lite model — not measured ambient CO₂</p>
    </div>
  `;
}

function buildSurveyPopup(point: CopenhagenObservedPoint): string {
  const props = point.properties ?? {};
  const isMock = props.dataOrigin === "mock" || props.type === "mock" || props.mockLabel === "MOCK";
  const label = String(props.likertLabel ?? props.category ?? "Survey response");
  const baseline = Number(props.baselineValue ?? 0);
  const intervention = Number(props.interventionValue ?? point.value ?? 0);
  const locationNote = String(props.locationNote ?? props.spatialNote ?? props.mockDisclaimer ?? "");
  const sampleAfter = Number(props.sampleAfter ?? 0);
  const dist = (props.surveyDistributionAfter as Array<{ score: number; pct: number }> | undefined) ?? [];
  const distHtml = dist.length
    ? `<p style="font-size: 9px; color: #B0EDBA; margin: 6px 0 2px 0;">After mix: ${dist
        .map((d) => `${d.score}=${Number(d.pct).toFixed(0)}%`)
        .join(" · ")}</p>`
    : "";
  const badge = isMock
    ? `<p style="font-size: 10px; font-weight: 700; letter-spacing: 0.06em; color: #FBBF24; margin: 0 0 4px 0;">MOCK</p>`
    : `<p style="font-size: 11px; color: #8578C3; margin: 0 0 2px 0; text-transform: uppercase;">Acceptability survey</p>`;
  return `
    <div style="font-family: 'DM Sans', sans-serif; padding: 8px; min-width: 220px;">
      ${badge}
      <p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">${label}</p>
      <p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Before: ${baseline.toFixed(1)}${isMock ? "" : "%"} · After: ${intervention.toFixed(1)}${isMock ? "" : "%"}</p>
      ${sampleAfter ? `<p style="font-size: 9px; color: #96C2EF; margin: 2px 0;">n≈${sampleAfter} (after)</p>` : ""}
      ${distHtml}
      <p style="font-size: 9px; color: #FBBF24; margin-top: 6px; line-height: 1.35;">${
        locationNote ||
        (isMock
          ? "MOCK pin on a KPI 1.2 mode-share corridor site."
          : "Location inferred — survey not tied to a specific street point.")
      }</p>
      <p style="font-size: 9px; color: #96C2EF; margin-top: 4px;">${String(props.source ?? "Partner survey")}</p>
    </div>
  `;
}

function renderCopenhagenParkingPointMarkers(options: {
  map: L.Map;
  observedPoints: CopenhagenObservedPoint[];
  selectedKpi: string;
  markersOut: L.Marker[];
  segmentHandlers: SegmentInteractionHandlers;
}): void {
  const { map, observedPoints, selectedKpi, markersOut, segmentHandlers } = options;
  const parkingPoints = observedPoints.filter((p) => {
    const kind = String(p.properties?.datasetKind ?? "");
    if (selectedKpi === "kpi4.2") return kind === "accessibility" || kind === "parking";
    return kind === "parking";
  });
  if (!parkingPoints.length) return;

  // Real WGS84 bay midpoints are already street-spread — only nudge true overlaps.
  const parkingLayout = spreadOverlappingPositions(
    parkingPoints.map((point) => ({
      id: String(point.properties?.segmentId ?? point.id),
      lat: point.lat,
      lon: point.lon,
    })),
    map.getZoom(),
    { zoomStable: true }
  );

  parkingPoints.forEach((point) => {
    const pointId = String(point.properties?.segmentId ?? point.id);
    const [markerLat, markerLon] = parkingLayout.get(pointId) ?? [point.lat, point.lon];
    const bays = Number(point.value ?? 0);
    const category = String(point.properties?.facilityCategory ?? "Parking");
    const accent = resolveParkingCategoryColor(category);
    const fromProps = parkingSegmentDetailFromProps(
      {
        streetName: point.properties?.streetName,
        facilityCategory: category,
        bays,
        Vejnavn: point.properties?.streetName,
        Parkering: category,
        Antal_plad: bays,
      },
      selectedKpi
    );
    const segmentId = String(point.properties?.segmentId ?? fromProps.segmentId);
    const segmentName = fromProps.segmentName;
    const baseline = Number(point.properties?.baselineValue ?? bays);
    const intervention = Number(point.properties?.interventionValue ?? bays);
    const tooltip =
      selectedKpi === "kpi4.2"
        ? `${String(point.properties?.streetName ?? "Copenhagen")} · ${category} · before ${baseline.toFixed(0)} → after ${intervention.toFixed(0)} bays`
        : `${category} · ${String(point.properties?.streetName ?? "Copenhagen")}`;
    addCopenhagenMapDot({
      map,
      lat: markerLat,
      lon: markerLon,
      fillColor: accent,
      strokeColor: "#ffffff",
      radius: selectedKpi === "kpi4.2" ? 7 : 8,
      markersOut,
      segmentHandlers,
      detail: { segmentId, segmentName, speed: null, congestion: null },
      tooltip,
    }).bindPopup(
      buildParkingPopupHtml({
        Vejnavn: point.properties?.streetName,
        Parkering: category,
        Antal_plad: bays,
      }),
      { className: "cph-parking-popup", maxWidth: 300, closeButton: false }
    );
  });
}

/** Sticky #27: collapse directional emissions rows into one marker per OTC sensor. */
function aggregateEmissionsPointsForMap(
  points: CopenhagenObservedPoint[]
): CopenhagenObservedPoint[] {
  type DirRow = {
    id: string;
    flow: string;
    preCo2GPerHour: number;
    postCo2GPerHour: number;
    baselinePct: number;
    interventionPct: number;
  };
  type Acc = {
    point: CopenhagenObservedPoint;
    pre: number;
    post: number;
    siteKey: string;
    directions: DirRow[];
  };
  const bySite = new Map<string, Acc>();

  for (const point of points) {
    const props = point.properties ?? {};
    const street = String(props.streetName ?? "");
    const segmentId = String(props.segmentId ?? point.id);
    const workbookFromSeg = (() => {
      if (!segmentId.startsWith("emissions-")) return null;
      const rest = segmentId.slice("emissions-".length).replace(/-/g, " ");
      return inferOtcWorkbookKey(rest);
    })();
    const key =
      inferOtcWorkbookKey(street) ??
      workbookFromSeg ??
      `${point.lat.toFixed(4)}|${point.lon.toFixed(4)}`;

    const pre = Number(props.preCo2GPerHour ?? 0);
    const post = Number(props.postCo2GPerHour ?? 0);
    const incomingDirs = (Array.isArray(props.emissionDirections)
      ? props.emissionDirections
      : []) as DirRow[];
    const existing = bySite.get(key);
    if (existing) {
      existing.pre += pre;
      existing.post += post;
      const seen = new Set(existing.directions.map((d) => d.id));
      for (const d of incomingDirs) {
        if (!seen.has(d.id)) existing.directions.push(d);
      }
      continue;
    }
    bySite.set(key, {
      siteKey: key,
      pre,
      post,
      directions: [...incomingDirs],
      point: {
        ...point,
        id: `emissions-agg-${key}`,
        properties: {
          ...props,
          segmentId: `emissions-${key}`,
          streetName: street.split("·")[0]?.trim() || street,
          mode: "sensor-total",
        },
      },
    });
  }

  const sites = [...bySite.values()];
  const refMax = maxCo2GPerHourFromFlows(
    sites.map((s) => ({ preCo2GPerHour: s.pre, postCo2GPerHour: s.post }))
  );

  return sites.map(({ point, pre, post, siteKey, directions }) => {
    const baselineIntensity = co2GPerHourToKpiIntensity(pre, refMax);
    const interventionIntensity = co2GPerHourToKpiIntensity(post, refMax);
    const reductionPct = co2ReductionPct(pre, post);
    return {
      ...point,
      value: interventionIntensity,
      properties: {
        ...point.properties,
        segmentId: `emissions-${siteKey}`,
        baselineValue: baselineIntensity,
        interventionValue: interventionIntensity,
        comparisonValue: reductionPct,
        preCo2GPerHour: pre,
        postCo2GPerHour: post,
        mode: "sensor-total",
        emissionDirections: directions,
      },
    };
  });
}

function renderCopenhagenIconPoints(options: {
  map: L.Map;
  observedPoints: CopenhagenObservedPoint[];
  datasetKinds: string[];
  selectedKpi: string;
  scenario: "baseline" | "intervention" | "comparison";
  selectedSegmentId?: string | null;
  segmentHandlers: SegmentInteractionHandlers;
  getValueColor: (value: number, safetyKpi: boolean) => string;
  markersOut: L.Marker[];
  circlesOut: L.CircleMarker[];
}): void {
  const {
    map,
    observedPoints,
    datasetKinds,
    selectedKpi,
    scenario,
    selectedSegmentId,
    segmentHandlers,
    getValueColor,
    markersOut,
    circlesOut,
  } = options;

  let points = observedPoints.filter((p) =>
    datasetKinds.includes(String(p.properties?.datasetKind ?? ""))
  );
  if (!points.length) return;

  const emissionsSites = selectedKpi === "kpi3.2" && datasetKinds.includes("emissions");
  if (emissionsSites) {
    points = aggregateEmissionsPointsForMap(points);
  }

  // Emissions: one hub pin — never fan-out overlapping direction rows.
  const layout = emissionsSites
    ? new Map(
        points.map((point) => {
          const id = String(point.properties?.segmentId ?? point.id);
          return [id, [point.lat, point.lon] as [number, number]];
        })
      )
    : spreadOverlappingPositions(
        points.map((point) => ({
          id: String(point.properties?.segmentId ?? point.id),
          lat: point.lat,
          lon: point.lon,
        })),
        map.getZoom(),
        { zoomStable: selectedKpi === "kpi4.1" || selectedKpi === "kpi4.2" || selectedKpi === "kpi2.1" }
      );

  points.forEach((point) => {
    const pointId = String(point.properties?.segmentId ?? point.id);
    const [markerLat, markerLon] = layout.get(pointId) ?? [point.lat, point.lon];
    const props = point.properties ?? {};
    const segmentId = pointId;
    const segmentName = String(props.streetName ?? props.category ?? "Copenhagen");
    const baselineValue = Number(props.baselineValue ?? 0);
    const interventionValue = Number(props.interventionValue ?? point.value ?? 0);
    const comparisonValue =
      typeof props.comparisonValue === "number"
        ? Number(props.comparisonValue)
        : interventionValue - baselineValue;
    const displayValue = intensityScalar(scenario, baselineValue, interventionValue, comparisonValue);
    const iconSpec = resolveMapPointIconSpec({
      facilityCategory: props.facilityCategory,
      category: props.category,
      datasetKind: props.datasetKind,
      type: props.type,
    });
    const datasetKind = String(props.datasetKind ?? "");
    const accent = emissionsSites
      ? emissionsIntensityToColor(displayValue)
      : datasetKind === "survey"
        ? "#7f5af0"
        : getValueColor(displayValue, selectedKpi === "kpi2.1");
    const selected = selectedSegmentId === segmentId;

    // Accessibility / security pins — icon badges (not plain dots).
    if (datasetKind === "accessibility") {
      const a11ySpec = resolveMapPointIconSpec({
        facilityCategory: props.facilityCategory ?? props.category,
        category: props.category,
        datasetKind: props.datasetKind,
        type: props.type,
      });
      const { visual, hit } = addNeonPointMarker(
        map,
        markerLat,
        markerLon,
        a11ySpec,
        { segmentId, segmentName, speed: null, congestion: null },
        segmentHandlers,
        {
          title: String(props.likertLabel ?? segmentName),
          hitRadius: selected ? 20 : 16,
          selectedSegmentId,
          tooltip: `${props.mockLabel === "MOCK" || props.dataOrigin === "mock" ? "[MOCK] " : ""}${String(props.likertLabel ?? segmentName)}`,
          popupHtml: buildSurveyPopup(point),
        }
      );
      markersOut.push(visual);
      circlesOut.push(hit);
      return;
    }

    const strokeColor =
      emissionsSites || datasetKind === "survey"
        ? "#ffffff"
        : iconSpec.accent;

    const dot = addCopenhagenMapDot({
      map,
      lat: markerLat,
      lon: markerLon,
      fillColor: accent,
      strokeColor,
      radius: emissionsSites ? 9 : 8,
      markersOut,
      segmentHandlers,
      detail: { segmentId, segmentName, speed: null, congestion: null },
      tooltip:
        datasetKind === "survey"
          ? `${props.mockLabel === "MOCK" || props.dataOrigin === "mock" ? "[MOCK] " : ""}${String(props.likertLabel ?? segmentName)}`
          : segmentName,
      selected,
    });

    if (datasetKind === "emissions") {
      dot.bindPopup(buildEmissionsPopup(point), {
        className: "cph-emissions-popup",
        maxWidth: 280,
        closeButton: false,
      });
    } else if (datasetKind === "survey") {
      dot.bindPopup(buildSurveyPopup(point), {
        className: "cph-survey-popup",
        maxWidth: 280,
        closeButton: false,
      });
    }
  });
}

function buildFlowPopup(options: {
  streetName: string;
  direction: string;
  baselineValue: number;
  interventionValue: number;
  comparisonValue: number;
  modeFilterLabel: string;
}): string {
  const { streetName, direction, baselineValue, interventionValue, comparisonValue, modeFilterLabel } =
    options;
  return `
    <div style="font-family: 'DM Sans', sans-serif; padding: 8px; min-width: 205px;">
      <p style="font-size: 11px; color: #8578C3; margin: 0 0 2px 0; text-transform: uppercase;">Directional mobility counts</p>
      <p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Camera/site: ${streetName}</p>
      <p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Observed camera direction: ${direction}</p>
      <p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Selected mode: ${modeFilterLabel}</p>
      <p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Before: ${baselineValue.toFixed(1)}%</p>
      <p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Intervention: ${interventionValue.toFixed(1)}%</p>
      <p style="font-size: 10px; color: #96C2EF; margin: 2px 0;">Comparison: ${comparisonValue >= 0 ? "+" : ""}${comparisonValue.toFixed(1)} pp</p>
      <p style="font-size: 9px; color: #96C2EF; margin-top: 4px;">Source: OpenTrafficCam Excel (observed)</p>
    </div>
  `;
}

export function renderCopenhagenMapLayers(options: RenderCopenhagenMapLayersOptions): void {
  const {
    map,
    pilotId,
    observedPoints,
    scenario,
    selectedSegmentId,
    segmentHandlers,
    getValueColor,
    selectedKpi,
    modeFilterLabel = "Active mobility (bike + pedestrian)",
    markersOut,
    circlesOut,
    polylinesOut,
    polygonsOut,
    circlesInfluenceOut,
    showPilotField,
    wireCircleMarker,
    parkingGeoJson: _parkingGeoJson,
    streetsGeoJson,
  } = options;

  if (showPilotField) {
    renderCopenhagenPilotInfluenceField(map, pilotId, circlesInfluenceOut);
  }

  // Street underlay — mode share / safety only (not facilities or accessibility).
  if (
    (selectedKpi === "kpi1.2" || selectedKpi === "kpi2.1") &&
    streetsGeoJson?.features?.length
  ) {
    renderCopenhagenStreetUnderlay(map, streetsGeoJson, polylinesOut);
  }

  const flowsByWorkbook = new Map<string, CopenhagenObservedPoint[]>();
  observedPoints.forEach((point) => {
    if (point.properties?.datasetKind === "emissions") return;
    const key = inferOtcWorkbookKey(String(point.properties?.streetName ?? ""));
    if (!key) return;
    const list = flowsByWorkbook.get(key) ?? [];
    list.push(point);
    flowsByWorkbook.set(key, list);
  });

  const registryLocations = renderRegistryMarkers(
    map,
    pilotId,
    markersOut,
    circlesOut,
    segmentHandlers,
    selectedSegmentId,
    flowsByWorkbook,
    scenario,
    getValueColor,
    selectedKpi,
    wireCircleMarker
  );

  // Camera FOV — mode share / road safety only (not facilities, climate, survey, a11y).
  if (selectedKpi === "kpi1.2" || selectedKpi === "kpi2.1") {
    renderCameraFovCones(map, registryLocations, polygonsOut, selectedSegmentId);
  }

  const useRadarFlowLayout =
    !["kpi3.1", "kpi3.2", "kpi4.1", "kpi4.2"].includes(selectedKpi) && observedPoints.length > 0;

  // Street corridor flow lines removed — partners want aggregated hub points only.
  // Directional named links are shown in the observatory panel diagram instead.

  const cameras = registryLocations.filter(
    (l) => l.kind === "intelligent_camera" || l.kind === "otc_workbook_site"
  );

  const svgRenderer = L.svg({ padding: 0.8 });

  flowsByWorkbook.forEach((flows, workbookKey) => {
    const workbookSite = registryLocations.find(
      (l) => l.kind === "otc_workbook_site" && l.otcWorkbookKey === workbookKey
    );
    const hub = hubForWorkbook(
      workbookKey,
      cameras.filter((c) => c.kind === "intelligent_camera"),
      {
        lat: workbookSite?.lat ?? flows[0]?.lat ?? 0,
        lon: workbookSite?.lon ?? flows[0]?.lon ?? 0,
      }
    );

    if (useRadarFlowLayout) {
      renderCopenhagenRadarFlowLayout({
        map,
        hubLat: hub.lat,
        hubLon: hub.lon,
        flows,
        scenario,
        selectedSegmentId,
        segmentHandlers,
        polylinesOut,
        circlesOut,
        svgRenderer,
        wireCircleMarker,
        intensityScalar,
        getValueColor,
        safetyKpi: selectedKpi === "kpi2.1",
        markersOut,
        hideFlowSpokes: true,
        hideFlowEndpointMarkers: true,
        featureSelected: (segmentId) => {
          const flow = flows.find(
            (f) => String(f.properties?.segmentId || f.properties?.id || f.id) === segmentId
          );
          const streetName = String(
            flow?.properties?.streetName ?? flows[0]?.properties?.streetName ?? ""
          );
          const cameraId = inferCameraId(streetName);
          return featureSelected(selectedSegmentId, segmentId, cameraId, streetName);
        },
        buildPopup: (point) => {
          const props = point.properties ?? {};
          return buildFlowPopup({
            streetName: String(props.streetName ?? "Copenhagen"),
            direction: String(props.direction ?? props.mode ?? "n/a"),
            baselineValue: Number(props.baselineValue ?? point.value ?? 0),
            interventionValue: Number(props.interventionValue ?? point.value ?? 0),
            comparisonValue:
              typeof props.comparisonValue === "number"
                ? Number(props.comparisonValue)
                : Number(props.interventionValue ?? point.value ?? 0) -
                  Number(props.baselineValue ?? point.value ?? 0),
            modeFilterLabel,
          });
        },
      });
      // Single hub marker: traffic-pulse center (workbook purple dots skipped when flows exist).
      renderCopenhagenTrafficPulseOverlay(
        map,
        hub.lat,
        hub.lon,
        flows,
        scenario,
        markersOut,
        circlesOut,
        workbookSite?.name ?? String(flows[0]?.properties?.streetName ?? workbookKey),
        {
          workbookKey,
          segmentHandlers,
          wireCircleMarker,
          selectedSegmentId,
          showAnchorDot: true,
        }
      );
      return;
    }
  });

  const iconKinds = KPI_ICON_DATASET_KINDS[selectedKpi];
  if (iconKinds?.length) {
    renderCopenhagenIconPoints({
      map,
      observedPoints,
      datasetKinds: iconKinds,
      selectedKpi,
      scenario,
      selectedSegmentId,
      segmentHandlers,
      getValueColor,
      markersOut,
      circlesOut,
    });
  }

  // KPI 4.2 — Trikala-style ripple hub + cyan crossing vector over sample pins.
  if (selectedKpi === "kpi4.2") {
    renderCopenhagenAccessibilitySafetyCorridor({
      map,
      pilotId,
      observedPoints,
      selectedSegmentId,
      segmentHandlers,
      markersOut,
      circlesOut,
      polylinesOut,
    });
  }

  // Parking bay inventory as WGS84 midpoints — facilities only (4.2 uses MOCK mode-share pins).
  if (selectedKpi === "kpi3.1") {
    renderCopenhagenParkingPointMarkers({
      map,
      observedPoints,
      selectedKpi,
      markersOut,
      segmentHandlers,
    });
  }

  circlesOut.forEach((layer) => layer.bringToFront());
  markersOut.forEach((m) => {
    if (m.bringToFront) m.bringToFront();
  });
  scheduleLeafletLayerRepaint(map, markersOut, circlesOut);
  window.setTimeout(() => scheduleLeafletLayerRepaint(map, markersOut, circlesOut), 120);
}
