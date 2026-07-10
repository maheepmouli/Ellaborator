import { destination, point } from "@turf/turf";

/** Asklipiou runs east–west through the junction anchor (Stratigou Sarafi is north–south). */
const ASKLIPIOU_BEARING_DEG = 90;
const CROSSING_HALF_LENGTH_M = 48;

export function destinationLatLng(
  lat: number,
  lon: number,
  bearingDeg: number,
  distanceMeters: number
): [number, number] {
  const dest = destination(point([lon, lat]), distanceMeters / 1000, bearingDeg, {
    units: "kilometers",
  });
  const [lng, latOut] = dest.geometry.coordinates;
  return [latOut, lng];
}

/** Short EW micro-vector across Asklipiou at the smart-crossing junction anchor. */
export function buildSmartCrossingPolyline(
  anchor: { lat: number; lng: number },
  end?: { lat: number; lng: number }
): [number, number][] {
  if (end && (Math.abs(end.lat - anchor.lat) > 0.00005 || Math.abs(end.lng - anchor.lng) > 0.00005)) {
    return [
      [anchor.lat, anchor.lng],
      [end.lat, end.lng],
    ];
  }
  const west = destinationLatLng(anchor.lat, anchor.lng, ASKLIPIOU_BEARING_DEG + 180, CROSSING_HALF_LENGTH_M);
  const east = destinationLatLng(anchor.lat, anchor.lng, ASKLIPIOU_BEARING_DEG, CROSSING_HALF_LENGTH_M);
  return [west, [anchor.lat, anchor.lng], east];
}

const BASE_RING_RADII_M = [40, 70, 100, 130] as const;

export function segmentRingRadiiMeters(responseCount: number): number[] {
  const scale = 0.75 + Math.min(0.35, (responseCount / 80) * 0.35);
  return BASE_RING_RADII_M.map((r) => Math.round(r * scale));
}

export function jitterSurveyPosition(
  lat: number,
  lon: number,
  index: number,
  total: number,
  segmentKey?: string
): [number, number] {
  const segHash = segmentKey
    ? segmentKey.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0)
    : index * 17;
  const baseAngle = ((segHash % 360) * Math.PI) / 180;
  const ring = 1 + (index % 4);
  const offsetDeg = 0.00034 * ring;
  const angle = baseAngle + (index / Math.max(total, 1)) * 0.55;
  return [lat + Math.sin(angle) * offsetDeg, lon + Math.cos(angle) * offsetDeg];
}
