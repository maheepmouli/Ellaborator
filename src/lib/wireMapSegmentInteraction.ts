import type * as L from "leaflet";

export type SegmentInteractionDetail = {
  segmentId: string;
  segmentName: string;
  speed?: number | null;
  congestion?: number | null;
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

/** Wire hover / click on circle markers (camera sites, intervention points). */
export function wireCircleMarkerSegment(
  layer: L.CircleMarker,
  detail: SegmentInteractionDetail,
  handlers: SegmentInteractionHandlers,
  options?: {
    baseRadius?: number;
    highlightRadius?: number;
    selectedSegmentId?: string | null;
    baseStyle?: L.PathOptions;
    highlightStyle?: L.PathOptions;
  }
) {
  const baseR = options?.baseRadius ?? 7;
  const hiR = options?.highlightRadius ?? baseR + 1.8;
  const isSelected = options?.selectedSegmentId === detail.segmentId;
  const baseStyle = options?.baseStyle ?? {};
  const highlightStyle = options?.highlightStyle ?? {
    weight: 2.2,
    opacity: 1,
    fillOpacity: 0.92,
  };
  const restoredStyle: L.PathOptions = {
    weight: isSelected ? 2.1 : 1.2,
    opacity: isSelected ? 1 : 0.45,
    fillOpacity: isSelected ? 0.92 : 0.34,
    ...baseStyle,
  };

  layer.on("mouseover", () => {
    layer.setRadius(isSelected ? hiR : hiR);
    layer.setStyle({ ...restoredStyle, ...highlightStyle });
    emitHover(detail, handlers);
  });
  layer.on("mouseout", () => {
    layer.setRadius(isSelected ? baseR + 1.2 : baseR);
    layer.setStyle(restoredStyle);
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
