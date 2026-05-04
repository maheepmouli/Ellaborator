import * as turf from "@turf/turf";
import type { AllGeoJSON } from "@turf/helpers";

/** Geodesic buffer around lng/lat (Turf spike — reusable for QA / intervention rings). */
export function kmBufferAround(lng: number, lat: number, radiusKm: number): AllGeoJSON {
  return turf.buffer(turf.point([lng, lat]), radiusKm, { units: "kilometers", steps: 64 });
}
