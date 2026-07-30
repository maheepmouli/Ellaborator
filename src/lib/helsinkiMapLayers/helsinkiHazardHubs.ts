/**
 * Grid-cluster Helsinki point GeoJSON into Milan-style presentation hubs.
 */
export type HelsinkiHazardHub = {
  id: string;
  lat: number;
  lon: number;
  count: number;
  label: string;
  /** Top locationType / incident tallies inside this cell (for observatory charts). */
  categories?: Array<{ label: string; count: number }>;
};

const DEFAULT_CELL_DEG = 0.01; // ~1.1 km north–south at Helsinki latitude
const DEFAULT_LIMIT = 8;

type HubFeature = {
  geometry?: { type?: string; coordinates?: unknown } | null;
  properties?: Record<string, unknown> | null;
};

export function clusterHelsinkiPointHubs(
  features: HubFeature[],
  options?: {
    cellDeg?: number;
    limit?: number;
    idPrefix?: string;
    labelPrefix?: string;
    /** Property used for per-hub category tallies (e.g. locationType, incidentType). */
    categoryProperty?: string;
  }
): HelsinkiHazardHub[] {
  const cellDeg = options?.cellDeg ?? DEFAULT_CELL_DEG;
  const limit = options?.limit ?? DEFAULT_LIMIT;
  const idPrefix = options?.idPrefix ?? "hel-hub";
  const labelPrefix = options?.labelPrefix ?? "Survey cluster";
  const categoryProperty = options?.categoryProperty;

  const cells = new Map<
    string,
    {
      latSum: number;
      lonSum: number;
      count: number;
      row: number;
      col: number;
      categories: Map<string, number>;
    }
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
    const categoryLabel = categoryProperty
      ? String(feature.properties?.[categoryProperty] || "Other").trim() || "Other"
      : null;
    if (existing) {
      existing.latSum += lat;
      existing.lonSum += lon;
      existing.count += 1;
      if (categoryLabel) {
        existing.categories.set(categoryLabel, (existing.categories.get(categoryLabel) || 0) + 1);
      }
    } else {
      const categories = new Map<string, number>();
      if (categoryLabel) categories.set(categoryLabel, 1);
      cells.set(key, { latSum: lat, lonSum: lon, count: 1, row, col, categories });
    }
  });

  return [...cells.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((cell, index) => {
      const lat = cell.latSum / cell.count;
      const lon = cell.lonSum / cell.count;
      const categories = [...cell.categories.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([label, count]) => ({ label, count }));
      return {
        id: `${idPrefix}-${index + 1}`,
        lat,
        lon,
        count: cell.count,
        label: `${labelPrefix} ${index + 1}`,
        categories: categories.length ? categories : undefined,
      };
    });
}

/** KPI 1.2 FVH1 — densest cell becomes hel-dangerous-locations; peers use -cluster-N. */
export function finalizeHelsinkiFvh1ModeShareHubs(
  hubs: HelsinkiHazardHub[],
  primaryId = "hel-dangerous-locations",
  primaryLabel = "FVH1 densest hazard cluster"
): HelsinkiHazardHub[] {
  if (!hubs.length) {
    return [
      {
        id: primaryId,
        lat: 60.171,
        lon: 24.941,
        count: 0,
        label: primaryLabel,
      },
    ];
  }
  const ranked = [...hubs].sort((a, b) => b.count - a.count);
  const primary = { ...ranked[0], id: primaryId, label: primaryLabel };
  const rest = ranked.slice(1).map((hub, index) => ({
    ...hub,
    id: `${primaryId}-cluster-${index + 2}`,
  }));
  return [primary, ...rest];
}

/** KPI 2.1 FVH1 — densest cell becomes hel-dangerous-locations; peers keep hel-safety-hub-N. */
export function finalizeHelsinkiFvh1SafetyHubs(hubs: HelsinkiHazardHub[]): HelsinkiHazardHub[] {
  if (!hubs.length) {
    return [
      {
        id: "hel-dangerous-locations",
        lat: 60.171,
        lon: 24.941,
        count: 0,
        label: "FVH1 survey safety hub",
      },
    ];
  }
  return hubs.map((hub, index) => ({
    ...hub,
    id: index === 0 ? "hel-dangerous-locations" : hub.id,
    label:
      index === 0 ? `Primary safety pressure · ${hub.count} hazard reports` : hub.label,
  }));
}
