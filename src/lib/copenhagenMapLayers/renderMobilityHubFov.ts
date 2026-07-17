import L from "leaflet";
import { buildFovWedgePolygon } from "./copenhagenFlowGeometry";
import type { CopenhagenObservedPoint } from "./renderCopenhagenMapLayers";

export function primaryBearingFromFlows(flows: CopenhagenObservedPoint[]): number {
  const bearings = flows
    .map((flow) => flow.properties?.flowBearing)
    .filter((bearing): bearing is number => typeof bearing === "number");
  if (!bearings.length) return 0;
  if (bearings.length === 1) return bearings[0];

  let sinSum = 0;
  let cosSum = 0;
  bearings.forEach((bearing) => {
    const rad = (bearing * Math.PI) / 180;
    sinSum += Math.sin(rad);
    cosSum += Math.cos(rad);
  });
  return ((Math.atan2(sinSum, cosSum) * 180) / Math.PI + 360) % 360;
}

/** Copenhagen-style camera FOV wedge at a mobility hub. */
export function renderMobilityHubFovCone(
  map: L.Map,
  hubLat: number,
  hubLon: number,
  flows: CopenhagenObservedPoint[],
  polygonsOut: L.Polygon[],
  options?: {
    selected?: boolean;
    ringScale?: number;
    bearingDeg?: number;
  }
): void {
  if (!flows.length) return;

  const ringScale = options?.ringScale ?? 1;
  const flowCount = flows.length;
  const bearing = options?.bearingDeg ?? primaryBearingFromFlows(flows);
  const selected = options?.selected ?? false;

  const ring = buildFovWedgePolygon(hubLat, hubLon, bearing, {
    radiusM: (flowCount > 2 ? 58 : 72) * ringScale,
    sweepDeg: flowCount > 2 ? 118 : flowCount > 1 ? 68 : 54,
  });

  const cone = L.polygon(ring, {
    color: selected ? "#00ffff" : "#63ccff",
    weight: selected ? 1.8 : 1,
    opacity: selected ? 0.85 : 0.45,
    fillColor: selected ? "#00ffff" : "#63ccff",
    fillOpacity: selected ? 0.22 : 0.12,
    interactive: false,
    bubblingMouseEvents: true,
  }).addTo(map);
  polygonsOut.push(cone);
}
