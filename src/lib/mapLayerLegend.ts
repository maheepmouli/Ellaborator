/**
 * Legend copy + colors aligned with visualization logic in HeroMap.tsx
 * so the sidebar legend matches what's drawn (points vs lines vs flows).
 */

export type MapLegendMarker = "point" | "line" | "polygon" | "ramp" | "polygonRamp";

export interface MapLegendItem {
  label: string;
  color: string;
}

export interface MapLegendSpec {
  /** How to render each colour swatch in the UI */
  marker: MapLegendMarker;
  items: MapLegendItem[];
  hint: string;
}

/** Issy traffic / Milan RETE segments — matches `getSegmentHighlight` */
export const SEGMENT_PRESSURE_ITEMS: MapLegendItem[] = [
  { label: "Lower", color: "#22C55E" },
  { label: "Mid", color: "#7B8AB8" },
  { label: "Higher", color: "#F97316" },
];

/** KPI2.1 safety hotspots / gradient “risk” points — matches `getValueColor(..., true)` */
export const SAFETY_HOTSPOT_ITEMS: MapLegendItem[] = [
  { label: "Lower risk", color: "#D3E3FF" },
  { label: "", color: "#96C2EF" },
  { label: "", color: "#8578C3" },
  { label: "", color: "#657DF5" },
  { label: "Higher risk", color: "#2F1B6D" },
];

/** KPI1.2 / generic point clusters — matches `getValueColor(..., false)` */
export const POINT_INTENSITY_ITEMS: MapLegendItem[] = [
  { label: "Lower", color: "#D3E3FF" },
  { label: "", color: "#8578C3" },
  { label: "", color: "#96C2EF" },
  { label: "", color: "#38BDF8" },
  { label: "Higher", color: "#10B981" },
];

/** KPI3.2 climate circles (aggregated heat) — matches HeroMap intensity ramp */
export const CLIMATE_ZONE_ITEMS: MapLegendItem[] = [
  { label: "Lower pressure", color: "#22C55E" },
  { label: "Medium", color: "#FBBF24" },
  { label: "Raised", color: "#F97316" },
  { label: "Higher pressure", color: "#E02020" },
];

/** Issy zone flows by mode — matches `modeColor` + polyline stroke */
export const ISSY_FLOW_MODE_ITEMS: MapLegendItem[] = [
  { label: "Bicycle", color: "#10B981" },
  { label: "Pedestrian", color: "#38BDF8" },
  { label: "Car", color: "#8578C3" },
  { label: "Bus / PT", color: "#657DF5" },
  { label: "Other", color: "#96C2EF" },
];

export function resolveMapLegend(
  city: string,
  kpiId: string,
  scenario: "baseline" | "intervention" | "comparison"
): MapLegendSpec {
  const ck = city.toLowerCase();
  const isIssy = ck.includes("issy");
  const isMilan = ck === "milan";

  // Issy KPI1.2 zone flows
  if (isIssy && kpiId === "kpi1.2") {
    if (scenario === "comparison") {
      return {
        marker: "line",
        items: [
          { label: "Favourable change", color: "#22C55E" },
          { label: "Other direction", color: "#8578C3" },
        ],
        hint: "Curved links compare baseline to post by mode; thickness reflects flow volume.",
      };
    }
    return {
      marker: "line",
      items: ISSY_FLOW_MODE_ITEMS,
      hint: "Line colour is travel mode; thickness reflects volume along the corridor.",
    };
  }

  // Milan road-network segments (speed / environment)
  if (isMilan && kpiId === "kpi2.1") {
    return {
      marker: "line",
      items: SEGMENT_PRESSURE_ITEMS,
      hint: "Road segments: colour shows relative speed / risk band (higher = more pressure).",
    };
  }
  if (isMilan && kpiId === "kpi3.2") {
    return {
      marker: "line",
      items: SEGMENT_PRESSURE_ITEMS,
      hint: "Network segments: bands are relative within the loaded RETE window.",
    };
  }

  // KPI2.1 default: safety hotspots as circle markers (purple risk ramp)
  if (kpiId === "kpi2.1") {
    if (isIssy) {
      return {
        marker: "line",
        items: SEGMENT_PRESSURE_ITEMS,
        hint: "Observed road segments when API data is available; band colours match highlighted polylines.",
      };
    }
    return {
      marker: "ramp",
      items: SAFETY_HOTSPOT_ITEMS,
      hint: "Circular markers: darker purple = higher grouped risk proxy; marker size reflects point density.",
    };
  }

  // KPI3.2: climate circles when not using Milan network
  if (kpiId === "kpi3.2") {
    return {
      marker: "point",
      items: CLIMATE_ZONE_ITEMS,
      hint: "Filled circles show estimated environmental pressure; size reflects record density.",
    };
  }

  // KPI3.1 infrastructure types (categorical)
  if (kpiId === "kpi3.1") {
    return {
      marker: "point",
      items: [
        { label: "Dedicated lane", color: "#10B981" },
        { label: "Symbols only", color: "#38BDF8" },
        { label: "Cycle path", color: "#10B981" },
        { label: "Greenway", color: "#22C55E" },
        { label: "Two-way cycle", color: "#3B82F6" },
        { label: "Other", color: "#96C2EF" },
      ],
      hint: "Point colour follows facility type when present; size reflects relative weighting.",
    };
  }

  // KPI4.2 accessibility polygons
  if (kpiId === "kpi4.2") {
    return {
      marker: "polygonRamp",
      items: [
        { label: "Lower score", color: "#D3E3FF" },
        { label: "", color: "#8578C3" },
        { label: "", color: "#96C2EF" },
        { label: "", color: "#38BDF8" },
        { label: "Higher score", color: "#10B981" },
      ],
      hint: "Filled polygons use the same green–blue ramp as the choropleth-style zones.",
    };
  }

  // KPI1.2 and other point KPIs
  if (kpiId === "kpi1.2") {
    return {
      marker: "ramp",
      items: POINT_INTENSITY_ITEMS,
      hint: "Point markers — brighter greens / blues show higher clustered values for the active mode filters.",
    };
  }

  return {
    marker: "ramp",
    items: POINT_INTENSITY_ITEMS,
    hint: "Point markers reflect relative KPI intensity on the map.",
  };
}
