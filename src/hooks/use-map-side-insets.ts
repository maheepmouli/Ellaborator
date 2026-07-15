import { useCallback, useEffect, useState } from "react";

const INSIGHT_WIDTH_KEY = "elab-insight-panel-width";
const OBSERVATORY_WIDTH_KEY = "elab-observatory-panel-width";
const PANEL_WIDTH_EVENT = "elab-panel-width-change";

function readInsets(showInsight: boolean, showObservatory: boolean) {
  const gap = 12;
  const insightW = Number(localStorage.getItem(INSIGHT_WIDTH_KEY)) || 340;
  const obsW = Number(localStorage.getItem(OBSERVATORY_WIDTH_KEY)) || 440;
  return {
    left: showInsight ? gap + insightW + gap : gap,
    right: showObservatory ? gap + obsW + gap : gap,
  };
}

/** Keeps bottom map chrome (legend) clear of resizable left/right panels. */
export function useMapSideInsets(showInsight: boolean, showObservatory: boolean) {
  const [insets, setInsets] = useState(() => readInsets(showInsight, showObservatory));

  const refresh = useCallback(() => {
    setInsets(readInsets(showInsight, showObservatory));
  }, [showInsight, showObservatory]);

  useEffect(() => {
    refresh();
    window.addEventListener("resize", refresh);
    window.addEventListener(PANEL_WIDTH_EVENT, refresh);
    return () => {
      window.removeEventListener("resize", refresh);
      window.removeEventListener(PANEL_WIDTH_EVENT, refresh);
    };
  }, [refresh]);

  return insets;
}
