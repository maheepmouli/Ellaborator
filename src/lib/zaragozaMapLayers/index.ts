import type * as L from "leaflet";

export const ZARAGOZA_REFORMADO_POLYS_URL = "/data/zaragoza/romareda_reformado_polys.geojson";
/** CAD linework kept on disk but not rendered on the map. */
export const ZARAGOZA_REFORMADO_LINES_URL = "/data/zaragoza/romareda_reformado_lines.geojson";

type ZaragozaPointLike = {
  properties?: Record<string, unknown> | null;
};

/** Drop CAD stems with invalid geographic centroids (e.g. Romareda shapefile in projected CRS). */
export function filterValidZaragozaAreaFeatures<
  T extends { geometry?: { coordinates?: unknown }; properties?: Record<string, unknown> },
>(features: T[]): T[] {
  return features.filter((f) => {
    // AYZG4 cancelled — never draw on the map.
    const pilotId = String(f.properties?.pilotId ?? "");
    if (pilotId === "zar-p4") return false;
    const coords = f.geometry?.coordinates;
    if (!coords) return false;
    const flat: number[][] = [];
    const walk = (c: unknown) => {
      if (!Array.isArray(c)) return;
      if (typeof c[0] === "number" && typeof c[1] === "number") {
        flat.push(c as number[]);
        return;
      }
      c.forEach(walk);
    };
    walk(coords);
    if (!flat.length) return false;
    const lng = flat.reduce((s, p) => s + p[0], 0) / flat.length;
    const lat = flat.reduce((s, p) => s + p[1], 0) / flat.length;
    return Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  });
}

export function zaragozaPointColor(point: ZaragozaPointLike, kpiId: string): string {
  const kind = String(point.properties?.datasetKind ?? "");
  if (kind === "air-quality") return "#34d399";
  if (kind === "survey") return "#a78bfa";
  if (kind === "school-monitoring") return "#38bdf8";
  if (kind === "comparativa") return "#fbbf24";
  if (kind === "manual-count") return "#fb923c";
  if (kpiId === "kpi3.2") return "#34d399";
  if (kpiId === "kpi4.1" || kpiId === "kpi4.2") return "#a78bfa";
  if (kpiId === "kpi2.1") return "#f87171";
  return "#96C2EF";
}

export function zaragozaPointRadius(point: ZaragozaPointLike): number {
  const kind = String(point.properties?.datasetKind ?? "");
  if (kind === "survey") return 7;
  if (kind === "air-quality") return 10;
  if (kind === "school-monitoring") return 11;
  return 9;
}

export async function loadZaragozaReformadoOverlay(
  _map: L.Map,
  _Lns: typeof import("leaflet"),
  _selectedPilotId: string | null | undefined,
  _layerBucket: L.Layer[]
): Promise<void> {
  // Romareda reformado GPKG CAD (polys + lines) intentionally not drawn — cluttered street CAD.
  return;
}

export {
  renderZaragozaKpi12Layers,
  buildZaragozaModeShareHubs,
} from "./renderZaragozaKpi12Layers";
export { renderZaragozaKpi21Layers } from "./renderZaragozaKpi21Layers";
export { renderZaragozaKpi32Layers } from "./renderZaragozaKpi32Layers";
export {
  renderZaragozaKpi42Layers,
  filterZaragozaAccessibilityForScenario,
} from "./renderZaragozaKpi42Layers";
