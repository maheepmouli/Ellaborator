/** Shared legend swatches for Issy + segment maps. */

export const SEGMENT_PRESSURE_ITEMS = [
  { label: "Lower", color: "#22C55E" },
  { label: "Mid", color: "#7B8AB8" },
  { label: "Higher", color: "#F97316" },
];

export const SAFETY_SEGMENT_RAMP = [
  { label: "Lower pressure", color: "#22D3EE" },
  { label: "Moderate", color: "#FBBF24" },
  { label: "High pressure", color: "#F97316" },
];

export const CLIMATE_ZONE_ITEMS = [
  { label: "Lower pressure", color: "#6EE7B7" },
  { label: "Medium", color: "#FBBF24" },
  { label: "Raised", color: "#F97316" },
  { label: "Higher pressure", color: "#E02020" },
];

/** ELABORATOR travel-mode palette for Issy KPI 1.2 (matches `ISSY_MODE_COLORS`). */
export const ISSY_FLOW_MODE_ITEMS = [
  { label: "Pedestrian", color: "#6EE7B7" },
  { label: "Cycle", color: "#22D3EE" },
  { label: "Public Transport", color: "#60A5FA" },
  { label: "Private Car", color: "#A78BFA" },
  { label: "PTW", color: "#C084FC" },
];

/** Map legend for Issy mode-share hubs (junction study + city view). */
export const ISSY_MODE_SHARE_HUB_ITEMS = [
  { label: "Mode-share hub (ripple)", color: "#38bdf8" },
  ...ISSY_FLOW_MODE_ITEMS,
];

export const ISSY_MODE_SHARE_HUB_HINT =
  "Mode-share hub at the study site — ripple marks sustainable mobility %. Observatory shows travel-mode mix (pedestrian / cycle / PT / car / PTW), not camera FOV or street segments.";
