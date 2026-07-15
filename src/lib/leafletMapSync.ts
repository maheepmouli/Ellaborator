import type { Map as LeafletMap, Marker, CircleMarker } from "leaflet";
import L from "leaflet";

type AnimatingMap = LeafletMap & {
  _animatingZoom?: boolean;
  _panAnim?: { _inProgress?: boolean };
};

export function isLeafletMapAnimating(map: LeafletMap): boolean {
  const animating = map as AnimatingMap;
  return Boolean(animating._animatingZoom || animating._panAnim?._inProgress);
}

/** Run after fly/zoom transitions finish so Leaflet panes are in sync. */
export function whenLeafletMapSettled(map: LeafletMap, fn: () => void): () => void {
  let cancelled = false;
  const run = () => {
    if (cancelled) return;
    fn();
  };

  if (isLeafletMapAnimating(map)) {
    map.once("moveend", run);
  } else {
    requestAnimationFrame(() => {
      if (!cancelled) requestAnimationFrame(run);
    });
  }

  return () => {
    cancelled = true;
    map.off("moveend", run);
  };
}

/** Force divIcon markers to repaint (fixes invisible markers until the next pan). */
export function nudgeLeafletMarkers(map: LeafletMap, markers: Marker[]): void {
  for (const marker of markers) {
    const latLng = marker.getLatLng();
    if (!latLng) continue;
    const internal = marker as Marker & {
      _icon?: HTMLElement;
      _map?: LeafletMap;
    };
    if (internal._icon && internal._map) {
      const point = internal._map.latLngToLayerPoint(latLng);
      L.DomUtil.setPosition(internal._icon, point);
    } else {
      marker.setLatLng(latLng);
    }
  }
  map.invalidateSize({ pan: false });
}

/** CircleMarker uses pixel radius; L.Circle climate hex / zones use metres — only nudge pixel markers. */
function isPixelCircleMarker(circle: CircleMarker): boolean {
  const radius = circle.getRadius?.();
  return typeof radius === "number" && radius <= 24;
}

/** Circle markers share the same _leaflet_pos sync bug after zoom — nudge them too. */
export function nudgeLeafletCircleMarkers(map: LeafletMap, circles: CircleMarker[]): void {
  for (const circle of circles) {
    const latLng = circle.getLatLng();
    if (!latLng) continue;
    const internal = circle as CircleMarker & {
      _path?: SVGElement;
      _map?: LeafletMap;
      redraw?: () => void;
    };
    if (!isPixelCircleMarker(circle)) {
      internal.redraw?.();
      continue;
    }
    if (internal._path && internal._map) {
      const point = internal._map.latLngToLayerPoint(latLng);
      L.DomUtil.setPosition(internal._path, point);
      internal.redraw?.();
    } else {
      circle.setLatLng(latLng);
      internal.redraw?.();
    }
  }
  map.invalidateSize({ pan: false });
}

export function nudgeLeafletMapLayers(
  map: LeafletMap,
  markers: Marker[],
  circles: CircleMarker[] = []
): void {
  nudgeLeafletMarkers(map, markers);
  if (circles.length) nudgeLeafletCircleMarkers(map, circles);
}

/** Run nudge twice on the next frames — divIcon markers often miss the first paint after flyTo. */
export function scheduleLeafletLayerRepaint(
  map: LeafletMap,
  markers: Marker[],
  circles: CircleMarker[] = []
): void {
  nudgeLeafletMapLayers(map, markers, circles);
  requestAnimationFrame(() => {
    nudgeLeafletMapLayers(map, markers, circles);
    requestAnimationFrame(() => nudgeLeafletMapLayers(map, markers, circles));
  });
}

export function layoutZoomTier(zoom: number): number {
  if (zoom < 14) return 0;
  if (zoom < 17) return 1;
  return 2;
}

export function kpiUsesZoomDependentMarkerLayout(
  cityName: string | null | undefined,
  kpi: string
): boolean {
  if (cityName?.toLowerCase().includes("copenhagen")) {
    if (kpi === "kpi3.2" || kpi === "kpi4.1" || kpi === "kpi2.1") return false;
  }
  if (cityName?.toLowerCase().includes("issy")) {
    if (kpi === "kpi3.2" || kpi === "kpi4.1" || kpi === "kpi4.2") return false;
  }
  if (cityName?.toLowerCase().includes("milan")) {
    return false;
  }
  return true;
}
