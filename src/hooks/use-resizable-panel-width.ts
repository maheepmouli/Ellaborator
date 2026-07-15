import { useCallback, useEffect, useRef, useState } from "react";

export type PanelResizeSide = "left" | "right";

export interface ResizablePanelWidthOptions {
  storageKey: string;
  defaultWidth: number;
  minWidth: number;
  /** Absolute cap in px; combined with maxViewportFraction. */
  maxWidthCap: number;
  /** Max width as fraction of viewport (e.g. 0.45 = 45vw). */
  maxViewportFraction: number;
  side: PanelResizeSide;
}

function readStoredWidth(key: string, fallback: number): number {
  if (typeof window === "undefined") return fallback;
  const stored = localStorage.getItem(key);
  const parsed = stored ? Number(stored) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function computeMaxWidth(cap: number, fraction: number): number {
  if (typeof window === "undefined") return cap;
  return Math.min(cap, Math.round(window.innerWidth * fraction));
}

export function useResizablePanelWidth({
  storageKey,
  defaultWidth,
  minWidth,
  maxWidthCap,
  maxViewportFraction,
  side,
}: ResizablePanelWidthOptions) {
  const [maxWidth, setMaxWidth] = useState(() =>
    computeMaxWidth(maxWidthCap, maxViewportFraction)
  );
  const [width, setWidth] = useState(() => {
    const stored = readStoredWidth(storageKey, defaultWidth);
    const max = computeMaxWidth(maxWidthCap, maxViewportFraction);
    return Math.min(max, Math.max(minWidth, stored));
  });
  const [isResizing, setIsResizing] = useState(false);
  const widthRef = useRef(width);
  widthRef.current = width;

  const clamp = useCallback(
    (w: number) => Math.min(maxWidth, Math.max(minWidth, Math.round(w))),
    [minWidth, maxWidth]
  );

  useEffect(() => {
    const onResize = () => {
      const nextMax = computeMaxWidth(maxWidthCap, maxViewportFraction);
      setMaxWidth(nextMax);
      setWidth((w) => Math.min(nextMax, Math.max(minWidth, w)));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [maxWidthCap, maxViewportFraction, minWidth]);

  const persist = useCallback(
    (w: number) => {
      localStorage.setItem(storageKey, String(w));
      window.dispatchEvent(new CustomEvent("elab-panel-width-change"));
    },
    [storageKey]
  );

  const setPreset = useCallback(
    (w: number) => {
      const next = clamp(w);
      setWidth(next);
      persist(next);
    },
    [clamp, persist]
  );

  const startResize = useCallback(
    (clientX: number) => {
      setIsResizing(true);
      const startX = clientX;
      const startWidth = widthRef.current;

      const onMove = (e: PointerEvent) => {
        const delta = side === "left" ? e.clientX - startX : startX - e.clientX;
        setWidth(clamp(startWidth + delta));
        window.dispatchEvent(new CustomEvent("elab-panel-width-change"));
      };

      const onUp = () => {
        setIsResizing(false);
        persist(widthRef.current);
        document.body.style.removeProperty("cursor");
        document.body.style.removeProperty("user-select");
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [clamp, persist, side]
  );

  return { width, maxWidth, isResizing, startResize, setPreset };
}
