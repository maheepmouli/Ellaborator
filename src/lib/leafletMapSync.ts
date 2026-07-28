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
export function nudgeLeafletMarkers(map: LeafletMap, markers: Marker[] | null | undefined = []): void {
  // Mid-zoom setPosition fights Leaflet's marker pane transform → diagonal ghost trails.
  if (isLeafletMapAnimating(map)) return;
  if (!Array.isArray(markers) || markers.length === 0) {
    map.invalidateSize({ pan: false });
    return;
  }
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

/** Circle markers share a paint-sync issue after zoom — redraw only (never DomUtil.setPosition on SVG paths). */
export function nudgeLeafletCircleMarkers(
  map: LeafletMap,
  circles: CircleMarker[] | null | undefined = []
): void {
  if (!Array.isArray(circles) || circles.length === 0) {
    map.invalidateSize({ pan: false });
    return;
  }
  for (const circle of circles) {
    const latLng = circle.getLatLng();
    if (!latLng) continue;
    const internal = circle as CircleMarker & {
      redraw?: () => void;
    };
    // SVG CircleMarkers live inside a transformed overlay SVG. Applying
    // L.DomUtil.setPosition on `_path` double-transforms them so points drift on zoom.
    circle.setLatLng(latLng);
    internal.redraw?.();
  }
  map.invalidateSize({ pan: false });
}

export function nudgeLeafletMapLayers(
  map: LeafletMap,
  markers: Marker[] | null | undefined = [],
  circles: CircleMarker[] | null | undefined = []
): void {
  const safeMarkers = Array.isArray(markers) ? markers : [];
  const safeCircles = Array.isArray(circles) ? circles : [];
  nudgeLeafletMarkers(map, safeMarkers);
  if (safeCircles.length) nudgeLeafletCircleMarkers(map, safeCircles);
}

/** Run nudge twice on the next frames — divIcon markers often miss the first paint after flyTo. */
export function scheduleLeafletLayerRepaint(
  map: LeafletMap,
  markers: Marker[] | null | undefined = [],
  circles: CircleMarker[] | null | undefined = []
): void {
  const safeMarkers = Array.isArray(markers) ? markers : [];
  const safeCircles = Array.isArray(circles) ? circles : [];
  const run = () => {
    nudgeLeafletMapLayers(map, safeMarkers, safeCircles);
    requestAnimationFrame(() => {
      nudgeLeafletMapLayers(map, safeMarkers, safeCircles);
      requestAnimationFrame(() => nudgeLeafletMapLayers(map, safeMarkers, safeCircles));
    });
  };
  if (isLeafletMapAnimating(map)) {
    map.once("moveend", run);
    return;
  }
  run();
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
    // Point layers use zoomStable fan-out — re-layout on zoom tiers caused trails.
    if (
      kpi === "kpi3.1" ||
      kpi === "kpi3.2" ||
      kpi === "kpi4.1" ||
      kpi === "kpi4.2" ||
      kpi === "kpi2.1"
    ) {
      return false;
    }
  }
  if (cityName?.toLowerCase().includes("issy")) {
    if (kpi === "kpi3.2" || kpi === "kpi4.1" || kpi === "kpi4.2") return false;
  }
  if (cityName?.toLowerCase().includes("helsinki")) {
    // Colour-rated / single-hub layers must not re-layout / re-fit on zoom tiers.
    if (
      kpi === "kpi1.1" ||
      kpi === "kpi3.1" ||
      kpi === "kpi3.2" ||
      kpi === "kpi4.1" ||
      kpi === "kpi4.2"
    ) {
      return false;
    }
  }
  if (cityName?.toLowerCase().includes("milan")) {
    // Resize CSS hub pulse to geographic ring diameter when zoom tier changes.
    return kpi === "kpi1.2";
  }
  return true;
}
