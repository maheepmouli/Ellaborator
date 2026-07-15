import L from "leaflet";
import type { TrikalaLocation } from "@/data/trikalaLocationRegistry";

/** ~350 m padding around each P+R hub when framing mode-share radar (KPI 1.2). */
const HUB_BUFFER_LAT = 0.0032;
const HUB_BUFFER_LNG = 0.0042;

/** Partner My Maps P+R hub centres (tri-p2). */
export const TRIKALA_P2_PARK_RIDE_HUBS = [
  { id: "tri-loc-smy", name: "SMY", lat: 39.55377222, lng: 21.77565618 },
  { id: "tri-loc-deh", name: "DEH", lat: 39.55849962, lng: 21.77339372 },
  { id: "tri-loc-gisemi", name: "GiSeMi", lat: 39.56675984, lng: 21.75819154 },
] as const;

function extendHubCenterBounds(
  bounds: L.LatLngBounds,
  lat: number,
  lng: number
): void {
  bounds.extend([lat - HUB_BUFFER_LAT, lng - HUB_BUFFER_LNG]);
  bounds.extend([lat + HUB_BUFFER_LAT, lng + HUB_BUFFER_LNG]);
}

export function collectTriParkRideHubBounds(
  locations: TrikalaLocation[],
  selectedKpi?: string,
  mode: "hub-centers" | "polygons" = "hub-centers"
): L.LatLngBounds | null {
  let hubs = locations.filter((l) => l.kind === "park_and_ride");
  if (selectedKpi) {
    hubs = hubs.filter(
      (l) => l.mapVisible !== false && l.linkedKpis.includes(selectedKpi)
    );
  }

  const bounds = L.latLngBounds([]);
  if (!hubs.length && mode === "hub-centers") {
    TRIKALA_P2_PARK_RIDE_HUBS.forEach((hub) =>
      extendHubCenterBounds(bounds, hub.lat, hub.lng)
    );
    return bounds.isValid() ? bounds : null;
  }
  if (!hubs.length) return null;

  if (mode === "hub-centers") {
    hubs.forEach((hub) => extendHubCenterBounds(bounds, hub.lat, hub.lng));
  } else {
    hubs.forEach((hub) => {
      if (hub.ring?.length) {
        hub.ring.forEach(([lat, lng]) => bounds.extend([lat, lng]));
      }
      bounds.extend([hub.lat, hub.lng]);
    });
  }
  return bounds.isValid() ? bounds : null;
}

export function triParkRideBoundsTuple(
  locations: TrikalaLocation[],
  selectedKpi?: string
): [[number, number], [number, number]] | null {
  const mode = selectedKpi === "kpi1.2" ? "hub-centers" : "polygons";
  const bounds = collectTriParkRideHubBounds(locations, selectedKpi, mode);
  if (!bounds) return null;
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  return [[sw.lat, sw.lng], [ne.lat, ne.lng]];
}

/** Fit map to P+R hubs — hub centres for KPI 1.2 (not full radar geometry). */
export function fitTriParkRideHubBounds(
  map: L.Map,
  locations: TrikalaLocation[],
  selectedKpi?: string
): void {
  const mode = selectedKpi === "kpi1.2" ? "hub-centers" : "polygons";
  const bounds = collectTriParkRideHubBounds(locations, selectedKpi, mode);
  if (!bounds) return;

  map.fitBounds(bounds, {
    padding: [80, 80],
    maxZoom: selectedKpi === "kpi1.2" ? 17 : 16,
    animate: true,
    duration: 0.55,
  });
}

export function getTrikalaPilot2FitBounds(
  kpiId?: string
): [[number, number], [number, number]] {
  const bounds = L.latLngBounds([]);
  const mode = kpiId === "kpi1.2" ? "hub-centers" : "polygons";
  if (mode === "hub-centers") {
    TRIKALA_P2_PARK_RIDE_HUBS.forEach((hub) =>
      extendHubCenterBounds(bounds, hub.lat, hub.lng)
    );
  }
  if (!bounds.isValid()) {
    return [
      [39.553, 21.758],
      [39.567, 21.776],
    ];
  }
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  return [[sw.lat, sw.lng], [ne.lat, ne.lng]];
}
