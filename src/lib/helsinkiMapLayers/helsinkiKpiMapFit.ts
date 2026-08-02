import L from "leaflet";
import {
  HELSINKI_KALLIO_ANCHOR,
  HELSINKI_VIIKKI_ANCHOR,
} from "@/lib/helsinkiDataPaths";

export type HelsinkiKpiFitKind =
  | "city-hubs"
  | "kallio"
  | "viikki"
  | "climate-city"
  | "safety-city"
  | "safety-viikki";

const HELSINKI_KPI_FIT: Record<
  HelsinkiKpiFitKind,
  { maxZoom: number; pad: number; fallbackZoom: number }
> = {
  /** FVH1 multi-hub mode-share / hazard clusters across central Helsinki. */
  "city-hubs": { maxZoom: 14, pad: 0.22, fallbackZoom: 12 },
  /** FVH2 Kallio parking / accessibility sample. */
  kallio: { maxZoom: 15, pad: 0.28, fallbackZoom: 14 },
  /** FVH3 single Viikki crossing hub. */
  viikki: { maxZoom: 17, pad: 0.35, fallbackZoom: 16 },
  /** KPI 3.2 citywide colour-rated climate points. */
  "climate-city": { maxZoom: 13, pad: 0.18, fallbackZoom: 11 },
  /** KPI 2.1 FVH1 multi-hub safety pressure. */
  "safety-city": { maxZoom: 14, pad: 0.22, fallbackZoom: 12 },
  /** KPI 2.1 FVH3 Viikki + nearby context hubs. */
  "safety-viikki": { maxZoom: 15, pad: 0.35, fallbackZoom: 14 },
};

/** One auto-fit per pilot+KPI cycle — selection/hover re-renders must not yank the viewport. */
let helsinkiFitCycleKey: string | null = null;
let helsinkiFittedThisCycle = false;

/** Call at the start of each Helsinki map render so fit runs once per pilot/KPI. */
export function beginHelsinkiMapFitCycle(pilotId: string | null | undefined, kpiId: string): void {
  const key = `${pilotId ?? "hel-p1"}|${kpiId}`;
  if (helsinkiFitCycleKey !== key) {
    helsinkiFitCycleKey = key;
    helsinkiFittedThisCycle = false;
  }
}

/** Resolve fit kind from Helsinki pilot + KPI. */
export function helsinkiKpiFitKind(
  kpiId: string,
  pilotId?: string | null
): HelsinkiKpiFitKind {
  const pilot = pilotId ?? "hel-p1";
  if (kpiId === "kpi3.2") return "climate-city";
  if (kpiId === "kpi3.1") return "kallio";
  if (kpiId === "kpi4.1") return "viikki";
  if (kpiId === "kpi4.2") return pilot === "hel-p2" ? "kallio" : "viikki";
  if (kpiId === "kpi1.1") return "viikki";
  if (kpiId === "kpi2.1") return pilot === "hel-p3" ? "safety-viikki" : "safety-city";
  if (kpiId === "kpi1.2") {
    if (pilot === "hel-p3") return "viikki";
    if (pilot === "hel-p2") return "kallio";
    return "city-hubs";
  }
  return "city-hubs";
}

function fallbackAnchor(kind: HelsinkiKpiFitKind): { lat: number; lng: number } {
  if (kind === "kallio") return HELSINKI_KALLIO_ANCHOR;
  if (kind === "viikki" || kind === "safety-viikki") return HELSINKI_VIIKKI_ANCHOR;
  return { lat: 60.171, lng: 24.941 };
}

/**
 * Fit Helsinki map to KPI geometry. Prefer this over HeroMap autoFit —
 * influence circles would otherwise yank the viewport out.
 * Always allows street-level zoom afterward (map maxZoom is set by HeroMap).
 * Skips repeat fits within the same pilot+KPI cycle so wheel zoom stays usable.
 */
export function fitHelsinkiKpiView(
  map: L.Map,
  points: Array<{ lat: number; lon?: number; lng?: number }>,
  kind: HelsinkiKpiFitKind,
  options?: { force?: boolean }
): void {
  if (helsinkiFittedThisCycle && !options?.force) return;
  helsinkiFittedThisCycle = true;

  const cfg = HELSINKI_KPI_FIT[kind];
  const coords = points
    .map((p) => {
      const lon = p.lon ?? p.lng;
      if (!Number.isFinite(p.lat) || !Number.isFinite(lon)) return null;
      return [p.lat, lon!] as [number, number];
    })
    .filter((c): c is [number, number] => c != null);

  // Ensure the map can zoom past hub-fit (inferred-linkage bug previously locked maxZoom at 12).
  if (typeof map.getMaxZoom === "function" && map.getMaxZoom() < 17) {
    map.setMaxZoom(18);
  }
  if (typeof map.getMinZoom === "function" && map.getMinZoom() > 4) {
    map.setMinZoom(4);
  }

  if (coords.length === 0) {
    const anchor = fallbackAnchor(kind);
    map.setView([anchor.lat, anchor.lng], cfg.fallbackZoom, { animate: false });
    return;
  }

  if (coords.length === 1) {
    map.setView(coords[0], Math.max(cfg.fallbackZoom, 13), { animate: false });
    return;
  }

  const bounds = L.latLngBounds(coords);
  if (!bounds.isValid()) {
    const anchor = fallbackAnchor(kind);
    map.setView([anchor.lat, anchor.lng], cfg.fallbackZoom, { animate: false });
    return;
  }

  map.fitBounds(bounds.pad(cfg.pad), {
    animate: false,
    maxZoom: cfg.maxZoom,
    padding: [72, 72],
  });
}
