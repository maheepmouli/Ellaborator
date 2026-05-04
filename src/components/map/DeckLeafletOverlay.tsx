import { useCallback, useEffect, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import DeckGL from "@deck.gl/react";
import type { Layer } from "@deck.gl/core";

type ViewStateLite = {
  longitude: number;
  latitude: number;
  zoom: number;
  pitch: number;
  bearing: number;
};

type Props = {
  leafletMap: LeafletMap | null;
  /** Same-size wrapper as Leaflet pane (typically `relative` parent of map container). */
  parentRef: React.RefObject<HTMLDivElement | null>;
  layers: Layer[];
  enabled: boolean;
};

/**
 * WebGL overlay synced to Leaflet view (pointer-events none — map stays interactive).
 * Spike/production bridge for KPI-specific Deck layers without replacing Leaflet.
 */
export function DeckLeafletOverlay({ leafletMap, parentRef, layers, enabled }: Props) {
  const [viewState, setViewState] = useState<ViewStateLite>({
    longitude: 10,
    latitude: 50,
    zoom: 4,
    pitch: 0,
    bearing: 0,
  });
  const [dims, setDims] = useState({ width: 100, height: 100 });

  const sync = useCallback(() => {
    const map = leafletMap;
    const el = parentRef.current;
    if (!map || !el) return;
    const c = map.getCenter();
    setViewState({
      longitude: c.lng,
      latitude: c.lat,
      zoom: map.getZoom(),
      pitch: 0,
      bearing: 0,
    });
    const w = Math.max(1, el.clientWidth);
    const h = Math.max(1, el.clientHeight);
    setDims({ width: w, height: h });
  }, [leafletMap, parentRef]);

  useEffect(() => {
    if (!leafletMap || !enabled) return;

    sync();
    const map = leafletMap;
    const onMove = () => sync();

    map.on("move", onMove);
    map.on("zoom", onMove);
    map.on("zoomend", sync);
    map.on("resize", sync);

    const el = parentRef.current;
    const ro = el ? new ResizeObserver(sync) : null;
    if (el) ro?.observe(el);

    return () => {
      map.off("move", onMove);
      map.off("zoom", onMove);
      map.off("zoomend", sync);
      map.off("resize", sync);
      ro?.disconnect();
    };
  }, [leafletMap, enabled, sync, parentRef]);

  if (!enabled || !leafletMap || layers.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[400]" aria-hidden>
      <DeckGL
        width={dims.width}
        height={dims.height}
        viewState={viewState}
        controller={false}
        layers={layers}
        glOptions={{ stencil: false }}
      />
    </div>
  );
}
