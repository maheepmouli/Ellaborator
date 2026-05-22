import { haversineMeters } from "@/lib/issyPilot2Junction";
import { climateHexColor } from "@/lib/issyMapRouting";

export interface ClimateHexCell {
  id: string;
  lat: number;
  lon: number;
  intensity: number;
  /** Hex radius in metres (Leaflet circle). */
  radiusM: number;
}

/**
 * Flat-top hex grid around a centre — H3-style field without extra deps.
 */
export function buildClimateHexGrid(
  centerLat: number,
  centerLon: number,
  options: {
    cellSizeM?: number;
    rings?: number;
    baseIntensity?: number;
    seed?: number;
  } = {}
): ClimateHexCell[] {
  const cellSizeM = options.cellSizeM ?? 58;
  const rings = options.rings ?? 6;
  const base = options.baseIntensity ?? 50;
  const seed = options.seed ?? 42;

  const cells: ClimateHexCell[] = [];
  const latDegPerM = 1 / 111_320;
  const lonDegPerM = 1 / (111_320 * Math.cos((centerLat * Math.PI) / 180));
  const rowStep = cellSizeM * 1.5 * latDegPerM;
  const colStep = cellSizeM * Math.sqrt(3) * lonDegPerM;

  for (let q = -rings; q <= rings; q++) {
    const rMin = Math.max(-rings, -q - rings);
    const rMax = Math.min(rings, -q + rings);
    for (let r = rMin; r <= rMax; r++) {
      const lat = centerLat + q * rowStep + r * rowStep * 0.5;
      const lon = centerLon + r * colStep;
      const dist = haversineMeters(centerLat, centerLon, lat, lon);
      const noise =
        Math.sin((q + seed) * 1.7) * 12 + Math.cos((r + seed) * 2.1) * 10;
      const distFalloff = Math.max(0, 1 - dist / (rings * cellSizeM * 1.35));
      const intensity = Math.min(100, Math.max(8, base * distFalloff + noise + 18));

      cells.push({
        id: `hex-${q}-${r}`,
        lat,
        lon,
        intensity,
        radiusM: cellSizeM * 0.92,
      });
    }
  }
  return cells;
}

export function climateHexStyle(intensity: number) {
  const color = climateHexColor(intensity);
  return {
    fillColor: color,
    fillOpacity: 0.22 + (intensity / 100) * 0.28,
    color,
    weight: 1.2,
    opacity: 0.75,
  };
}
