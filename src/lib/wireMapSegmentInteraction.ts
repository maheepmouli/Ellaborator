import type * as L from "leaflet";

export type SegmentInteractionDetail = {
  segmentId: string;
  segmentName: string;
  speed?: number | null;
  congestion?: number | null;
  properties?: Record<string, unknown>;
};

export type SegmentInteractionHandlers = {
  onSegmentHover?: (detail: SegmentInteractionDetail | null) => void;
  onSegmentFocus?: (ctx: {
    segmentName: string;
    speed: number | null;
    congestion: number | null;
  }) => void;
  onJunctionSegmentClick?: (detail: SegmentInteractionDetail) => void;
};

type PathStyle = L.PathOptions;

function emitFocus(
  detail: SegmentInteractionDetail,
  handlers: SegmentInteractionHandlers
) {
  handlers.onSegmentFocus?.({
    segmentName: detail.segmentName,
    speed: detail.speed ?? null,
    congestion: detail.congestion ?? null,
  });
}

function emitHover(detail: SegmentInteractionDetail, handlers: SegmentInteractionHandlers) {
  handlers.onSegmentHover?.(detail);
  emitFocus(detail, handlers);
}

function emitHoverEnd(handlers: SegmentInteractionHandlers) {
  handlers.onSegmentHover?.(null);
}

/** Wire hover / click on a Leaflet polyline with optional highlight styles. */
export function wirePolylineSegment(
  layer: L.Polyline,
  detail: SegmentInteractionDetail,
  handlers: SegmentInteractionHandlers,
  options?: {
    baseStyle?: PathStyle;
    highlightStyle?: PathStyle;
    selectedSegmentId?: string | null;
    focusDim?: number;
  }
) {
  const base = options?.baseStyle ?? {};
  const highlight = options?.highlightStyle ?? {
    weight: ((base.weight as number) ?? 4) + 2.5,
    opacity: 1,
  };
  const isSelected = options?.selectedSegmentId === detail.segmentId;
  const dim = options?.selectedSegmentId && !isSelected ? (options.focusDim ?? 0.28) : 1;

  if (dim < 1 && base.opacity != null) {
    layer.setStyle({ ...base, opacity: (base.opacity as number) * dim });
  }

  layer.on("mouseover", () => {
    layer.setStyle({ ...base, ...highlight, opacity: 1 });
    layer.bringToFront();
    emitHover(detail, handlers);
  });
  layer.on("mouseout", () => {
    const restored = { ...base };
    if (dim < 1 && base.opacity != null) {
      restored.opacity = (base.opacity as number) * dim;
    }
    layer.setStyle(restored);
    emitHoverEnd(handlers);
  });
  layer.on("click", () => {
    handlers.onJunctionSegmentClick?.(detail);
    emitFocus(detail, handlers);
  });
}

/** Wire hover / click on a Leaflet polygon (P+R hubs, intervention areas). */
export function wirePolygonSegment(
  layer: L.Polygon,
  detail: SegmentInteractionDetail,
  handlers: SegmentInteractionHandlers,
  options?: {
    baseStyle?: PathStyle;
    highlightStyle?: PathStyle;
    selectedSegmentId?: string | null;
    focusDim?: number;
    hoverClassName?: string;
  }
) {
  const base = options?.baseStyle ?? {};
  const highlight = options?.highlightStyle ?? {
    weight: ((base.weight as number) ?? 4) + 4,
    opacity: 0.85,
    fillOpacity: 0.35,
  };
  const hoverClass = options?.hoverClassName ?? "tri-infra-park-ride-poly--hover";
  const isSelected = options?.selectedSegmentId === detail.segmentId;
  const dim = options?.selectedSegmentId && !isSelected ? (options?.focusDim ?? 0.28) : 1;

  const applyBase = () => {
    const restored: PathStyle = { ...base };
    if (dim < 1) {
      if (base.opacity != null) restored.opacity = (base.opacity as number) * dim;
      if (base.fillOpacity != null) {
        restored.fillOpacity = (base.fillOpacity as number) * dim;
      }
    }
    layer.setStyle(restored);
    layer.getElement()?.classList.remove(hoverClass);
  };

  if (dim < 1) applyBase();

  layer.on("mouseover", () => {
    layer.setStyle({ ...base, ...highlight });
    layer.bringToFront();
    layer.getElement()?.classList.add(hoverClass);
    emitHover(detail, handlers);
  });
  layer.on("mouseout", () => {
    applyBase();
    emitHoverEnd(handlers);
  });
  layer.on("click", () => {
    handlers.onJunctionSegmentClick?.(detail);
    emitFocus(detail, handlers);
  });
}

export function wireMarkerSegment(
  marker: L.Marker,
  detail: SegmentInteractionDetail,
  handlers: SegmentInteractionHandlers
) {
  marker.on("mouseover", () => {
    marker.getElement()?.querySelector(".map-point-icon-badge")?.classList.add("map-point-icon-badge--hover");
    emitHover(detail, handlers);
  });
  marker.on("mouseout", () => {
    marker.getElement()?.querySelector(".map-point-icon-badge")?.classList.remove("map-point-icon-badge--hover");
    emitHoverEnd(handlers);
  });
  marker.on("click", () => {
    handlers.onJunctionSegmentClick?.(detail);
    emitFocus(detail, handlers);
  });
}

/** Wire hover / click on circle markers (camera sites, intervention points). */
export function wireCircleMarkerSegment(
  layer: L.CircleMarker,
  detail: SegmentInteractionDetail,
  handlers: SegmentInteractionHandlers,
  options?: {
    baseRadius?: number | (() => number);
    highlightRadius?: number | (() => number);
    selectedSegmentId?: string | null;
    baseStyle?: L.PathOptions;
    highlightStyle?: L.PathOptions;
  }
) {
  const resolveRadius = (value: number | (() => number) | undefined, fallback: number) =>
    typeof value === "function" ? value() : (value ?? fallback);

  const isSelected = () => options?.selectedSegmentId === detail.segmentId;
  const baseStyle = options?.baseStyle ?? {};
  const highlightStyle = options?.highlightStyle ?? {
    weight: 2.2,
    opacity: 1,
    fillOpacity: 0.92,
  };

  const getBaseRadius = () => resolveRadius(options?.baseRadius, 9);
  const getHighlightRadius = () => {
    const base = getBaseRadius();
    return resolveRadius(options?.highlightRadius, base * 1.5);
  };

  const restoredStyle = (): L.PathOptions => ({
    weight: isSelected() ? 3 : (baseStyle.weight as number) ?? 1.5,
    opacity: 1,
    fillOpacity: (baseStyle.fillOpacity as number) ?? 0.65,
    ...baseStyle,
  });

  layer.on("mouseover", () => {
    layer.setRadius(getHighlightRadius());
    layer.setStyle({ ...restoredStyle(), ...highlightStyle });
    emitHover(detail, handlers);
  });
  layer.on("mouseout", () => {
    layer.setRadius(isSelected() ? getHighlightRadius() : getBaseRadius());
    layer.setStyle(restoredStyle());
    emitHoverEnd(handlers);
  });
  layer.on("click", () => {
    handlers.onJunctionSegmentClick?.(detail);
    emitFocus(detail, handlers);
  });
}

export function segmentInteractionHandlers(
  onSegmentHover?: (detail: SegmentInteractionDetail | null) => void,
  onSegmentFocus?: SegmentInteractionHandlers["onSegmentFocus"],
  onJunctionSegmentClick?: SegmentInteractionHandlers["onJunctionSegmentClick"]
): SegmentInteractionHandlers {
  return { onSegmentHover, onSegmentFocus, onJunctionSegmentClick };
}
