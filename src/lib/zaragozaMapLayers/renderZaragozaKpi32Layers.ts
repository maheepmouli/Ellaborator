import L from "leaflet";
import type { LocalCityPoint } from "@/services/localCityData";
import { bindCopenhagenMapTooltip } from "@/lib/copenhagenMapLayers/copenhagenMapTooltips";
import { scheduleLeafletLayerRepaint } from "@/lib/leafletMapSync";
import {
  wireMarkerSegment,
  type SegmentInteractionHandlers,
} from "@/lib/wireMapSegmentInteraction";

function hubCenterIcon(selected: boolean, color: string): L.DivIcon {
  const size = selected ? 16 : 13;
  const half = size / 2;
  return L.divIcon({
    className: "milan-hub-center-wrap",
    html: `<button type="button" class="milan-hub-center${
      selected ? " milan-hub-center--selected" : ""
    }" style="background:${color};box-shadow:0 0 0 2px rgba(255,255,255,0.9),0 0 14px ${color};" aria-label="Open Zaragoza observatory"></button>`,
    iconSize: [size, size],
    iconAnchor: [half, half],
  });
}

function siteColor(kpiId: string): string {
  if (kpiId === "kpi4.1" || kpiId === "kpi4.2") return "#a78bfa";
  return "#34d399";
}

function siteKindFilter(kpiId: string, kind: string): boolean {
  if (kpiId === "kpi3.2") return kind === "air-quality";
  // Satisfaction / accessibility reuse Nanoenvi site pins (mock survey at AQ coords).
  if (kpiId === "kpi4.1" || kpiId === "kpi4.2") {
    return kind === "survey" || kind === "air-quality-site-mock";
  }
  return kind === "air-quality";
}

function siteTitle(kpiId: string): string {
  if (kpiId === "kpi4.1") return "Zaragoza satisfaction · KPI 4.1";
  if (kpiId === "kpi4.2") return "Zaragoza accessibility · KPI 4.2";
  return "Zaragoza climate · KPI 3.2";
}

function valueUnit(kpiId: string): string {
  if (kpiId === "kpi4.1") return "sat";
  if (kpiId === "kpi4.2") return "access";
  return "intensity";
}

export interface RenderZaragozaKpi32LayersOptions {
  map: L.Map;
  points: LocalCityPoint[];
  selectedKpi?: string;
  selectedPilotId?: string | null;
  activeMapSegmentId?: string | null;
  segmentInteractionEnabled: boolean;
  segmentHandlers: SegmentInteractionHandlers;
  markersOut: L.Marker[];
  circlesOut: L.CircleMarker[];
}

/**
 * Static sensor / mock survey dots at Nanoenvi sites — no ripple rings.
 * Used for climate (3.2) and the same pins for satisfaction (4.1) / accessibility (4.2).
 */
export function renderZaragozaKpi32Layers(options: RenderZaragozaKpi32LayersOptions): number {
  const {
    map,
    points,
    selectedKpi = "kpi3.2",
    selectedPilotId,
    activeMapSegmentId,
    segmentInteractionEnabled,
    segmentHandlers,
    markersOut,
    circlesOut,
  } = options;

  const color = siteColor(selectedKpi);
  const sites = points.filter((p) => {
    const kind = String(p.properties?.datasetKind ?? "");
    if (!siteKindFilter(selectedKpi, kind)) return false;
    const pid = String(p.properties?.pilotId ?? p.properties?.interventionId ?? "");
    return !selectedPilotId || !pid || pid === selectedPilotId;
  });
  if (!sites.length) return 0;

  sites.forEach((point) => {
    const props = point.properties ?? {};
    const segmentId = String(props.segmentId ?? point.id);
    const label = String(props.streetName ?? props.segmentId ?? "Site");
    const selected = Boolean(activeMapSegmentId && activeMapSegmentId === segmentId);
    const intensity = Number(props.value ?? point.value ?? 0);
    const baseline = Number(props.baselineValue ?? intensity);
    const intervention = Number(props.interventionValue ?? intensity);
    const unit = valueUnit(selectedKpi);

    const center = L.marker([point.lat, point.lon], {
      icon: hubCenterIcon(selected, color),
      interactive: true,
      keyboard: true,
      zIndexOffset: 2400,
      title: label,
    }).addTo(map);

    bindCopenhagenMapTooltip(
      center,
      `${label} · ${intensity.toFixed(0)} ${unit}`
    );
    center.bindPopup(`
      <div style="font-family:'DM Sans',sans-serif;padding:8px;min-width:200px;">
        <p style="font-size:10px;color:#8578C3;margin:0 0 4px 0;text-transform:uppercase;">${siteTitle(selectedKpi)}</p>
        <p style="font-size:14px;font-weight:700;color:#2F1B6D;margin:0 0 6px 0;">${label}</p>
        <p style="font-size:18px;font-weight:700;color:#2F1B6D;margin:0 0 4px 0;">${intensity.toFixed(1)} ${unit}</p>
        <p style="font-size:10px;color:#96C2EF;margin:2px 0;">Before ${baseline.toFixed(1)} → After ${intervention.toFixed(1)}</p>
        <p style="font-size:10px;color:#96C2EF;margin:2px 0;">${String(props.source ?? "Nanoenvi site")}</p>
        <p style="font-size:10px;color:#96C2EF;margin:2px 0;">Hover / click opens observatory</p>
      </div>
    `);

    if (segmentInteractionEnabled) {
      wireMarkerSegment(
        center,
        { segmentId, segmentName: label, speed: null, congestion: null },
        segmentHandlers
      );
    }
    markersOut.push(center);
  });

  scheduleLeafletLayerRepaint(map, markersOut, circlesOut);
  return sites.length;
}
