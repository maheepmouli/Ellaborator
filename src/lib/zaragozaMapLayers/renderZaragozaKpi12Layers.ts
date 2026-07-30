import L from "leaflet";
import type { LocalCityPoint } from "@/services/localCityData";
import { renderHubRipplePulseOverlay } from "@/lib/copenhagenMapLayers/copenhagenTrafficPulse";
import { bindCopenhagenMapTooltip } from "@/lib/copenhagenMapLayers/copenhagenMapTooltips";
import { scheduleLeafletLayerRepaint } from "@/lib/leafletMapSync";
import {
  wireCircleMarkerSegment,
  wireMarkerSegment,
  type SegmentInteractionHandlers,
} from "@/lib/wireMapSegmentInteraction";

const ZARAGOZA_PULSE_MIN_ZOOM = 11;
/** Match blue outbound hub ring size — keep all Zaragoza mode-share ripples equal. */
const ZARAGOZA_HUB_RING_SCALE = 1;

/** Only records that are real mode-share monitoring sites (not every survey pin). */
const MODE_SHARE_KINDS = new Set([
  "school-monitoring",
  "manual-count",
  "comparativa",
  "survey",
]);

type ModeKey = "pedestrian" | "cycle" | "publicTransport" | "car" | "ptw" | "mixed";

const MODE_META: Record<ModeKey, { label: string; color: string; sustainable: boolean }> = {
  pedestrian: { label: "Pedestrian-led", color: "#38bdf8", sustainable: true },
  cycle: { label: "Cycle-led", color: "#22c55e", sustainable: true },
  publicTransport: { label: "PT-led", color: "#a78bfa", sustainable: true },
  car: { label: "Motor-led", color: "#f97316", sustainable: false },
  ptw: { label: "PTW-led", color: "#fbbf24", sustainable: false },
  mixed: { label: "Mode share site", color: "#96C2EF", sustainable: true },
};

export interface ZaragozaModeShareHub {
  id: string;
  lat: number;
  lon: number;
  mode: ModeKey;
  sharePct: number;
  label: string;
  source: string;
  primary: boolean;
  datasetKind: string;
}

function resolvePilotId(selectedPilotId?: string | null): string {
  if (
    selectedPilotId === "zar-p1" ||
    selectedPilotId === "zar-p2" ||
    selectedPilotId === "zar-p3"
  ) {
    return selectedPilotId;
  }
  return "zar-p1";
}

function siteModeFromPoint(point: LocalCityPoint): { mode: ModeKey; sharePct: number } {
  const mb = point.properties?.modeBreakdown as
    | {
        pre?: {
          bike?: number;
          pedestrian?: number;
          motorised?: number;
          ptw?: number;
        };
      }
    | undefined;
  const pre = mb?.pre;
  if (pre) {
    const bike = Number(pre.bike) || 0;
    const ped = Number(pre.pedestrian) || 0;
    const motor = Number(pre.motorised) || 0;
    const ptw = Number(pre.ptw) || 0;
    const total = bike + ped + motor + ptw;
    if (total > 0) {
      const sustainable = ((bike + ped) / total) * 100;
      const ranked: Array<{ mode: ModeKey; n: number }> = [
        { mode: "pedestrian", n: ped },
        { mode: "cycle", n: bike },
        { mode: "car", n: motor },
        { mode: "ptw", n: ptw },
      ].sort((a, b) => b.n - a.n);
      return { mode: ranked[0]?.n ? ranked[0].mode : "mixed", sharePct: sustainable };
    }
  }
  const value = Number(point.properties?.value ?? point.value) || 0;
  return {
    mode: value >= 40 ? "mixed" : "car",
    sharePct: value,
  };
}

function siteKey(point: LocalCityPoint): string {
  const props = point.properties ?? {};
  return String(
    props.segmentId ??
      props.streetName ??
      props.id ??
      point.id ??
      `${point.lat.toFixed(5)},${point.lon.toFixed(5)}`
  );
}

/**
 * One pulse hub per observed Zaragoza mode-share site.
 * Does not invent satellite dots from mode percentages.
 */
export function buildZaragozaModeShareHubs(
  points: LocalCityPoint[],
  selectedPilotId?: string | null
): ZaragozaModeShareHub[] {
  const pilotId = resolvePilotId(selectedPilotId);
  const scoped = points.filter((p) => {
    const pid = String(p.properties?.pilotId ?? p.properties?.interventionId ?? "");
    return !pid || pid === pilotId;
  });
  const sourcePoints = scoped.length ? scoped : points;

  const candidates = sourcePoints.filter((p) => {
    const kind = String(p.properties?.datasetKind ?? "");
    if (!MODE_SHARE_KINDS.has(kind)) return false;
    // Survey: keep the mode-share aggregate / usual-mode records, skip grade-only pins.
    if (kind === "survey") {
      const hasModes = Boolean(p.properties?.modeBreakdown);
      const id = String(p.properties?.id ?? p.id ?? "");
      return hasModes || /survey-modes|usual.?mode/i.test(id);
    }
    return true;
  });

  // Deduplicate by site identity (manual-count rows often share the same street label).
  const bySite = new Map<string, LocalCityPoint>();
  candidates.forEach((point) => {
    const key = siteKey(point);
    const existing = bySite.get(key);
    if (!existing) {
      bySite.set(key, point);
      return;
    }
    // Prefer school monitoring over motor-only manual when labels collide.
    const preferNew =
      String(point.properties?.datasetKind) === "school-monitoring" &&
      String(existing.properties?.datasetKind) !== "school-monitoring";
    if (preferNew) bySite.set(key, point);
  });

  const unique = [...bySite.values()];
  if (!unique.length) return [];

  // Fan only when several distinct sites share an identical lat/lng (pilot centroid snap).
  const coordGroups = new Map<string, LocalCityPoint[]>();
  unique.forEach((point) => {
    const ck = `${point.lat.toFixed(5)}_${point.lon.toFixed(5)}`;
    const list = coordGroups.get(ck) ?? [];
    list.push(point);
    coordGroups.set(ck, list);
  });

  const hubs: ZaragozaModeShareHub[] = [];
  coordGroups.forEach((group) => {
    group.forEach((point, index) => {
      const { mode, sharePct } = siteModeFromPoint(point);
      const props = point.properties ?? {};
      const label = String(
        props.streetName ?? props.segmentId ?? props.category ?? "Mode share site"
      );
      // Small offset only when multiple real sites collapsed onto one coordinate.
      const angle = (index / Math.max(group.length, 1)) * Math.PI * 2;
      const fan = group.length > 1 ? 0.00018 : 0;
      hubs.push({
        id: String(props.segmentId ?? props.id ?? point.id),
        lat: point.lat + Math.sin(angle) * fan,
        lon: point.lon + Math.cos(angle) * fan,
        mode,
        sharePct,
        label,
        source: String(props.source ?? props.datasetKind ?? "Zaragoza baseline"),
        primary: hubs.length === 0,
        datasetKind: String(props.datasetKind ?? "site"),
      });
    });
  });

  return hubs;
}

function hubCenterIcon(selected: boolean, color: string): L.DivIcon {
  const size = selected ? 16 : 12;
  const half = size / 2;
  return L.divIcon({
    className: "milan-hub-center-wrap",
    html: `<button type="button" class="milan-hub-center${
      selected ? " milan-hub-center--selected" : ""
    }" style="background:${color};box-shadow:0 0 0 2px rgba(255,255,255,0.85),0 0 14px ${color};" aria-label="Open observatory"></button>`,
    iconSize: [size, size],
    iconAnchor: [half, half],
  });
}

export interface RenderZaragozaKpi12LayersOptions {
  map: L.Map;
  points: LocalCityPoint[];
  selectedPilotId?: string | null;
  activeMapSegmentId?: string | null;
  scenario?: "baseline" | "intervention" | "comparison";
  segmentInteractionEnabled: boolean;
  segmentHandlers: SegmentInteractionHandlers;
  markersOut: L.Marker[];
  circlesOut: L.CircleMarker[];
  wireCircleMarker?: typeof wireCircleMarkerSegment;
}

export function renderZaragozaKpi12Layers(options: RenderZaragozaKpi12LayersOptions): number {
  const {
    map,
    points,
    selectedPilotId,
    activeMapSegmentId,
    segmentInteractionEnabled,
    segmentHandlers,
    markersOut,
    circlesOut,
    wireCircleMarker,
  } = options;

  const hubs = buildZaragozaModeShareHubs(points, selectedPilotId);
  if (!hubs.length) return 0;

  hubs.forEach((hub) => {
    const meta = MODE_META[hub.mode];
    const selected = Boolean(activeMapSegmentId && activeMapSegmentId === hub.id);
    const inboundDominant = meta.sustainable;

    renderHubRipplePulseOverlay(
      map,
      hub.lat,
      hub.lon,
      inboundDominant,
      markersOut,
      circlesOut,
      {
        showAnchorDot: false,
        minZoom: ZARAGOZA_PULSE_MIN_ZOOM,
        ringScale: ZARAGOZA_HUB_RING_SCALE,
        interaction:
          segmentInteractionEnabled && wireCircleMarker
            ? {
                segmentId: hub.id,
                segmentName: hub.label,
                segmentHandlers,
                selectedSegmentId: activeMapSegmentId,
                wireCircleMarker,
              }
            : undefined,
      }
    );

    const center = L.marker([hub.lat, hub.lon], {
      icon: hubCenterIcon(selected, meta.color),
      interactive: true,
      keyboard: true,
      zIndexOffset: hub.primary ? 2400 : 2100,
      title: hub.label,
    }).addTo(map);

    bindCopenhagenMapTooltip(
      center,
      `${hub.label} · ${hub.sharePct.toFixed(0)}% sustainable`
    );
    center.bindPopup(`
      <div style="font-family:'DM Sans',sans-serif;padding:8px;min-width:200px;">
        <p style="font-size:10px;color:#8578C3;margin:0 0 4px 0;text-transform:uppercase;">Observed mode-share site</p>
        <p style="font-size:14px;font-weight:700;color:#2F1B6D;margin:0 0 6px 0;">${hub.label}</p>
        <p style="font-size:18px;font-weight:700;color:#2F1B6D;margin:0 0 4px 0;">${hub.sharePct.toFixed(1)}% sustainable</p>
        <p style="font-size:10px;color:#96C2EF;margin:2px 0;">${hub.source}</p>
        <p style="font-size:10px;color:#96C2EF;margin:2px 0;">Dataset: ${hub.datasetKind} · one hub per monitored site</p>
      </div>
    `);

    if (segmentInteractionEnabled) {
      wireMarkerSegment(
        center,
        {
          segmentId: hub.id,
          segmentName: hub.label,
          speed: null,
          congestion: null,
        },
        segmentHandlers
      );
    }
    markersOut.push(center);
  });

  scheduleLeafletLayerRepaint(map, markersOut, circlesOut);
  return hubs.length;
}
