import L from "leaflet";
import { buildFovWedgePolygon } from "@/lib/copenhagenMapLayers/copenhagenFlowGeometry";
import { ISSY_P2_JUNCTION } from "@/lib/issyPilot2Junction";

/** Primary Wintics camera bearing at Pont d'Issy (toward Quai / Paris). */
const ISSY_CAMERA_BEARING_DEG = 355;

/** Single directional FOV wedge at the Pont d'Issy Wintics camera hub. */
export function renderIssyCameraFovCones(
  map: L.Map,
  polygonsOut: L.Polygon[],
  selectedSegmentId?: string | null
): void {
  const { lat, lon } = ISSY_P2_JUNCTION;
  const hubSelected =
    !!selectedSegmentId &&
    !selectedSegmentId.startsWith("issy-od:") &&
    !selectedSegmentId.includes("sentiment");

  const ring = buildFovWedgePolygon(lat, lon, ISSY_CAMERA_BEARING_DEG, {
    radiusM: 72,
    sweepDeg: 54,
  });
  const cone = L.polygon(ring, {
    color: hubSelected ? "#00ffff" : "#63ccff",
    weight: hubSelected ? 1.8 : 1.2,
    opacity: hubSelected ? 0.88 : 0.5,
    fillColor: hubSelected ? "#00ffff" : "#63ccff",
    fillOpacity: hubSelected ? 0.24 : 0.14,
    interactive: false,
  }).addTo(map);
  polygonsOut.push(cone);
}
