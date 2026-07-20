/**
 * Grid-cluster Helsinki point GeoJSON into Milan-style presentation hubs.
 */
export type HelsinkiHazardHub = {
  id: string;
  lat: number;
  lon: number;
  count: number;
  label: string;
};

const DEFAULT_CELL_DEG = 0.01; // ~1.1 km north–south at Helsinki latitude
const DEFAULT_LIMIT = 8;

export function clusterHelsinkiPointHubs(
  features: Array<{ geometry?: { type?: string; coordinates?: unknown } | null }>,
  options?: { cellDeg?: number; limit?: number; idPrefix?: string; labelPrefix?: string }
): HelsinkiHazardHub[] {
  const cellDeg = options?.cellDeg ?? DEFAULT_CELL_DEG;
  const limit = options?.limit ?? DEFAULT_LIMIT;
  const idPrefix = options?.idPrefix ?? "hel-hub";
  const labelPrefix = options?.labelPrefix ?? "Survey cluster";

  const cells = new Map<
    string,
    { latSum: number; lonSum: number; count: number; row: number; col: number }
  >();

  features.forEach((feature) => {
    if (feature.geometry?.type !== "Point") return;
    const coordinates = feature.geometry.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length < 2) return;
    const lon = Number(coordinates[0]);
    const lat = Number(coordinates[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    const row = Math.round(lat / cellDeg);
    const col = Math.round(lon / cellDeg);
    const key = `${row}_${col}`;
    const existing = cells.get(key);
    if (existing) {
      existing.latSum += lat;
      existing.lonSum += lon;
      existing.count += 1;
    } else {
      cells.set(key, { latSum: lat, lonSum: lon, count: 1, row, col });
    }
  });

  return [...cells.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((cell, index) => {
      const lat = cell.latSum / cell.count;
      const lon = cell.lonSum / cell.count;
      return {
        id: `${idPrefix}-${index + 1}`,
        lat,
        lon,
        count: cell.count,
        label: `${labelPrefix} ${index + 1}`,
      };
    });
}
