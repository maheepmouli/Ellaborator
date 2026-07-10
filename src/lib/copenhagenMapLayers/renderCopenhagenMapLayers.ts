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
  hubForWorkbook,
} from "./copenhagenFlowGeometry";
import {
  resolveCopenhagenIntensityColor,
} from "./copenhagenFlowStyles";
import type { SegmentInteractionHandlers } from "@/lib/wireMapSegmentInteraction";
import { wireMarkerSegment } from "@/lib/wireMapSegmentInteraction";
import { spreadOverlappingPositions } from "@/lib/copenhagenMarkerLayout";
import { createMapPointDivIcon } from "@/lib/mapPointIcons";
import { resolveMapPointIconSpec } from "@/lib/mapPointIconTaxonomy";
import {
  buildParkingPopupHtml,
  parkingSegmentDetailFromProps,
  renderCopenhagenParkingPolygons,
  renderCopenhagenStreetUnderlay,
  resolveParkingCategoryColor,
} from "./copenhagenParkingLayerStyles";
import { renderCopenhagenRadarFlowLayout } from "./copenhagenRadarFlowLayout";
import { bindCopenhagenMapTooltip } from "./copenhagenMapTooltips";
import { renderCopenhagenTrafficPulseOverlay } from "./copenhagenTrafficPulse";

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

function cameraMarkerHtml(
  loc: CopenhagenLocation,
  isSelected: boolean,
  accentColor = "#64748b",
  dimmed = false
): string {
  const dimStyle = dimmed ? "opacity:0.32;filter:saturate(0.55);" : "";
  if (loc.kind === "telraam_counter") {
    return `<div class="cph-telraam-marker ${isSelected ? "is-selected" : ""}" style="${dimStyle}">
      <span class="cph-telraam-ping" style="background:${accentColor}33"></span>
      <span class="cph-telraam-core" style="background:${isSelected ? "#00ffff" : accentColor}"></span>
    </div>`;
  }
  if (loc.kind === "intelligent_camera") {
    return `<div class="cph-camera-marker ${isSelected ? "is-selected" : ""}" style="${dimStyle}">
      <span class="cph-camera-ring" style="border-color:${isSelected ? "#00ffff" : accentColor}"></span>
      <span class="cph-camera-core" style="background:${isSelected ? "#00ffff" : accentColor}"></span>
    </div>`;
  }
  if (loc.kind === "otc_workbook_site") {
    return `<div class="cph-workbook-ring ${isSelected ? "is-selected" : ""}" style="${dimStyle}"></div>`;
  }
  if (loc.kind === "flow_camera") {
    return `<div class="cph-flow-camera-marker ${isSelected ? "is-selected" : ""}" style="${dimStyle}">
      <span class="cph-flow-camera-ring" style="border-color:${isSelected ? "#00ffff" : accentColor}"></span>
      <span class="cph-flow-camera-core" style="background:${isSelected ? "#00ffff" : "#f59e0b"}"></span>
    </div>`;
  }
  return "";
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
  handlers: SegmentInteractionHandlers,
  selectedSegmentId: string | null | undefined,
  wireCircleMarker: RenderCopenhagenMapLayersOptions["wireCircleMarker"],
  flowsByWorkbook: Map<string, CopenhagenObservedPoint[]>,
  scenario: "baseline" | "intervention" | "comparison",
  getValueColor: (value: number, safetyKpi: boolean) => string,
  selectedKpi: string
): CopenhagenLocation[] {
  const locations = getLocationsForPilot(pilotId).filter((loc) => {
    if (loc.kind === "flow_camera") return selectedKpi === "kpi1.2";
    if (loc.kind === "intelligent_camera" && loc.otcWorkbookKey === "vandkunsten") {
      return loc.id === "wb-vandkunsten";
    }
    return (
      loc.kind === "telraam_counter" ||
      loc.kind === "intelligent_camera" ||
      loc.kind === "otc_workbook_site"
    );
  });

  const hasFocus = Boolean(selectedSegmentId);

  const markerLayout = spreadOverlappingPositions(
    locations.map((loc) => ({ id: loc.id, lat: loc.lat, lon: loc.lon })),
    map.getZoom()
  );

  locations.forEach((loc) => {
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
    const dimmed = hasFocus && !isSelected;

    if (loc.kind === "flow_camera") {
      const marker = L.marker([markerLat, markerLon], {
        icon: L.divIcon({
          className: "cph-flow-camera-icon",
          html: cameraMarkerHtml(loc, isSelected, "#f59e0b", dimmed),
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        }),
        zIndexOffset: isSelected ? 1150 : 1050,
      }).addTo(map);
      marker.bindTooltip(loc.name, { direction: "top", opacity: 0.9, className: "tri-segment-tooltip" });
      wireMarkerSegment(marker, { segmentId, segmentName: loc.name, speed: null, congestion: null }, handlers);
      const hit = L.circleMarker([markerLat, markerLon], {
        radius: 12,
        fillOpacity: 0,
        opacity: 0,
        weight: 0,
      }).addTo(map);
      bindCopenhagenMapTooltip(hit, loc.name);
      wireCircleMarker(
        hit,
        { segmentId, segmentName: loc.name, speed: null, congestion: null },
        handlers,
        { baseRadius: 12, highlightRadius: 14, selectedSegmentId }
      );
      markersOut.push(marker);
      return;
    }

    if (loc.kind === "intelligent_camera" || loc.kind === "telraam_counter") {
      const workbookKey = loc.otcWorkbookKey;
      const workbookFlows = workbookKey ? flowsByWorkbook.get(workbookKey) ?? [] : [];
      const { color: accentColor } = aggregateWorkbookIntensity(
        workbookFlows,
        scenario,
        getValueColor,
        selectedKpi === "kpi2.1"
      );
      const sensorColor =
        loc.kind === "telraam_counter" && !workbookFlows.length ? "#38BDF8" : accentColor;

      const marker = L.marker([markerLat, markerLon], {
        icon: L.divIcon({
          className: "cph-sensor-icon",
          html: cameraMarkerHtml(loc, isSelected, sensorColor, dimmed),
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }),
        zIndexOffset: isSelected ? 1200 : loc.kind === "telraam_counter" ? 1100 : 1000,
      }).addTo(map);
      bindCopenhagenMapTooltip(marker, loc.name);
      wireMarkerSegment(marker, { segmentId, segmentName: loc.name, speed: null, congestion: null }, handlers);
      const hit = L.circleMarker([markerLat, markerLon], {
        radius: 14,
        fillOpacity: 0,
        opacity: 0,
        weight: 0,
      }).addTo(map);
      bindCopenhagenMapTooltip(hit, loc.name);
      wireCircleMarker(
        hit,
        { segmentId, segmentName: loc.name, speed: null, congestion: null },
        handlers,
        {
          baseRadius: 14,
          highlightRadius: 16,
          selectedSegmentId,
        }
      );
      markersOut.push(marker);
      return;
    }

    if (isSite) {
      const marker = L.marker([markerLat, markerLon], {
        icon: L.divIcon({
          className: "cph-workbook-site-icon",
          html: cameraMarkerHtml(loc, isSelected, "#c4b5fd", dimmed),
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        }),
        zIndexOffset: isSelected ? 1180 : 1080,
      }).addTo(map);
      bindCopenhagenMapTooltip(marker, loc.name);
      wireMarkerSegment(marker, { segmentId, segmentName: loc.name, speed: null, congestion: null }, handlers);
      const hit = L.circleMarker([markerLat, markerLon], {
        radius: 16,
        fillOpacity: 0,
        opacity: 0,
        weight: 0,
      }).addTo(map);
      bindCopenhagenMapTooltip(hit, loc.name);
      wireCircleMarker(
        hit,
        { segmentId, segmentName: loc.name, speed: null, congestion: null },
        handlers,
        {
          baseRadius: 16,
          highlightRadius: 18,
          selectedSegmentId,
        }
      );
      markersOut.push(marker);
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
    const bearing =
      workbookKey === "vandkunsten"
        ? 168
        : workbookKey === "gammeltorv"
          ? 45
          : workbookKey === "norreport"
            ? 355
            : workbookKey === "stormgade"
              ? 120
              : workbookKey === "hojbro"
                ? 10
                : 0;
    const ring = buildFovWedgePolygon(hub.lat, hub.lon, bearing, {
      radiusM: cams.length > 1 ? 58 : 72,
      sweepDeg: cams.length > 1 ? 68 : 54,
    });
    const cone = L.polygon(ring, {
      color: siteSelected ? "#00ffff" : "#63ccff",
      weight: siteSelected ? 1.8 : 1,
      opacity: siteSelected ? 0.85 : 0.45,
      fillColor: siteSelected ? "#00ffff" : "#63ccff",
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
    parkingGeoJson,
    streetsGeoJson,
  } = options;

  if (showPilotField) {
    renderCopenhagenPilotInfluenceField(map, pilotId, circlesInfluenceOut);
  }

  if ((selectedKpi === "kpi3.1" || selectedKpi === "kpi4.2") && streetsGeoJson?.features?.length) {
    renderCopenhagenStreetUnderlay(map, streetsGeoJson, polylinesOut);
  }

  const flowsByWorkbook = new Map<string, CopenhagenObservedPoint[]>();
  observedPoints.forEach((point) => {
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
    segmentHandlers,
    selectedSegmentId,
    wireCircleMarker,
    flowsByWorkbook,
    scenario,
    getValueColor,
    selectedKpi
  );

  renderCameraFovCones(map, registryLocations, polygonsOut, selectedSegmentId);

  const cameras = registryLocations.filter(
    (l) => l.kind === "intelligent_camera" || l.kind === "otc_workbook_site"
  );

  const svgRenderer = L.svg({ padding: 0.8 });
  const useRadarFlowLayout =
    !["kpi3.1", "kpi4.2"].includes(selectedKpi) && observedPoints.length > 0;

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
        }
      );
      return;
    }
  });

  if ((selectedKpi === "kpi3.1" || selectedKpi === "kpi4.2") && parkingGeoJson?.features?.length) {
    renderCopenhagenParkingPolygons(
      map,
      parkingGeoJson,
      polylinesOut,
      selectedKpi,
      segmentHandlers,
      selectedSegmentId,
      map.getZoom()
    );
  }

  if (selectedKpi === "kpi3.1") {
    const parkingPoints = observedPoints.filter((p) => p.properties?.datasetKind === "parking");
    const parkingLayout = spreadOverlappingPositions(
      parkingPoints.map((point) => ({
        id: String(point.properties?.segmentId ?? point.id),
        lat: point.lat,
        lon: point.lon,
      })),
      map.getZoom()
    );
    parkingPoints.forEach((point) => {
        const pointId = String(point.properties?.segmentId ?? point.id);
        const [markerLat, markerLon] = parkingLayout.get(pointId) ?? [point.lat, point.lon];
        const bays = Number(point.value ?? 0);
        const category = String(point.properties?.facilityCategory ?? "Parking");
        const accent = resolveParkingCategoryColor(category);
        const { segmentId, segmentName } = parkingSegmentDetailFromProps(
          {
            streetName: point.properties?.streetName,
            facilityCategory: category,
            bays,
          },
          selectedKpi
        );
        const iconSpec = resolveMapPointIconSpec({
          facilityCategory: category,
          category,
          datasetKind: point.properties?.datasetKind,
        });
        const marker = L.marker([markerLat, markerLon], {
          icon: createMapPointDivIcon(iconSpec, `${iconSpec.label} · ${String(point.properties?.streetName ?? "Copenhagen")}`),
        }).addTo(map);
        wireMarkerSegment(
          marker,
          { segmentId, segmentName, speed: null, congestion: null },
          segmentHandlers
        );
        marker.bindPopup(
          buildParkingPopupHtml({
            Vejnavn: point.properties?.streetName,
            Parkering: category,
            Antal_plad: bays,
          }),
          { className: "cph-parking-popup", maxWidth: 300, closeButton: false }
        );
        const hit = L.circleMarker([markerLat, markerLon], {
          radius: 14,
          fillOpacity: 0,
          opacity: 0,
          weight: 0,
        }).addTo(map);
        wireCircleMarker(
          hit,
          { segmentId, segmentName, speed: null, congestion: null },
          segmentHandlers,
          {
            baseRadius: 14,
            highlightRadius: 16,
            selectedSegmentId,
            baseStyle: { fillColor: accent, color: accent },
            highlightStyle: {
              fillColor: "#00ffff",
              fillOpacity: 0.95,
              color: "#ffffff",
              weight: 2.2,
              opacity: 1,
            },
          }
        );
        markersOut.push(marker);
      });
  }

  if (selectedKpi === "kpi4.2") {
    const hasParkingPolygons = Boolean(parkingGeoJson?.features?.length);
    if (!hasParkingPolygons) {
    const accessibilityPoints = observedPoints.filter(
      (p) => p.properties?.datasetKind === "accessibility"
    );
    const accessibilityLayout = spreadOverlappingPositions(
      accessibilityPoints.map((point) => ({
        id: String(point.properties?.segmentId ?? point.id),
        lat: point.lat,
        lon: point.lon,
      })),
      map.getZoom()
    );
    accessibilityPoints.forEach((point) => {
        const pointId = String(point.properties?.segmentId ?? point.id);
        const [markerLat, markerLon] = accessibilityLayout.get(pointId) ?? [point.lat, point.lon];
        const delta = Number(point.properties?.comparisonValue ?? 0);
        const category = String(point.properties?.facilityCategory ?? point.properties?.category ?? "Accessibility");
        const segmentId = String(point.properties?.segmentId ?? point.id);
        const segmentName = String(point.properties?.streetName ?? category);
        const iconSpec = resolveMapPointIconSpec({
          facilityCategory: category,
          category,
          datasetKind: point.properties?.datasetKind,
        });
        const marker = L.marker([markerLat, markerLon], {
          icon: createMapPointDivIcon(iconSpec, `${iconSpec.label} · ${segmentName}`),
        }).addTo(map);
        wireMarkerSegment(
          marker,
          { segmentId, segmentName, speed: null, congestion: null },
          segmentHandlers
        );
        marker.bindTooltip(
          `${segmentName} · before ${Number(point.properties?.baselineValue ?? 0)} → after ${Number(point.properties?.interventionValue ?? point.value ?? 0)} bays`,
          { direction: "top", opacity: 0.92 }
        );
        const hit = L.circleMarker([markerLat, markerLon], {
          radius: 14,
          fillOpacity: 0,
          opacity: 0,
          weight: 0,
        }).addTo(map);
        wireCircleMarker(
          hit,
          { segmentId, segmentName, speed: null, congestion: null },
          segmentHandlers,
          {
            baseRadius: 14,
            highlightRadius: 16,
            selectedSegmentId,
          }
        );
        markersOut.push(marker);
      });
    }
  }

  circlesOut.forEach((layer) => layer.bringToFront());
  markersOut.forEach((m) => {
    if (m.bringToFront) m.bringToFront();
  });
}
