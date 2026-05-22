/**
 * Legend copy + colors aligned with visualization logic in HeroMap.tsx
 * so the sidebar legend matches what's drawn (points vs lines vs flows).
 */

import { resolveSpatialSystem } from "@/lib/spatialLayerRegistry";
import { CLIMATE_ZONE_ITEMS, ISSY_FLOW_MODE_ITEMS, SAFETY_SEGMENT_RAMP, SEGMENT_PRESSURE_ITEMS } from "@/lib/issyMapLegendItems";

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

export { SEGMENT_PRESSURE_ITEMS, SAFETY_SEGMENT_RAMP, CLIMATE_ZONE_ITEMS, ISSY_FLOW_MODE_ITEMS };

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

/** Satisfaction soft field (KPI 4.1). */
export const SATISFACTION_FIELD_ITEMS: MapLegendItem[] = [
  { label: "Positive", color: "#6EE7B7" },
  { label: "Neutral", color: "#A78BFA" },
  { label: "Negative", color: "#FB923C" },
];

/** Facility types (KPI 3.1). */
export const FACILITY_TYPE_ITEMS: MapLegendItem[] = [
  { label: "Dedicated lane", color: "#10B981" },
  { label: "Symbols only", color: "#38BDF8" },
  { label: "Cycle path", color: "#10B981" },
  { label: "Greenway", color: "#22C55E" },
  { label: "Two-way cycle", color: "#3B82F6" },
  { label: "Other", color: "#96C2EF" },
];

export function resolveMapLegend(
  city: string,
  kpiId: string,
  scenario: "baseline" | "intervention" | "comparison",
  options?: { issyJunctionStudy?: boolean }
): MapLegendSpec {
  const isIssy = city.toLowerCase().includes("issy");
  const isMilan = city === "milan";
  const spatial = resolveSpatialSystem(city, kpiId, {
    junctionStudy: options?.issyJunctionStudy,
  });

  if (isIssy && options?.issyJunctionStudy && spatial) {
    if (scenario === "comparison") {
      return {
        marker: "line",
        items: [
          { label: "Favourable change", color: "#22C55E" },
          { label: "Other direction", color: "#8578C3" },
          { label: "Baseline reference", color: "#94a3b8" },
        ],
        hint: "Comparison — arm colour and weight show improvement vs derived baseline; soft influence field marks the ~280 m intersection buffer.",
      };
    }
    if (scenario === "baseline") {
      return {
        marker: "line",
        items: [{ label: "Derived baseline", color: "#94a3b8" }],
        hint: "Baseline — pre-intervention arm intensity (derived); influence field shows intersection buffer.",
      };
    }
    switch (spatial) {
      case "flows":
        return {
          marker: "line",
          items: ISSY_FLOW_MODE_ITEMS,
          hint: "Junction study — mode share on the four approach arms (intervention / observed).",
        };
      case "segments":
        return kpiId === "kpi1.2"
          ? {
              marker: "line",
              items: ISSY_FLOW_MODE_ITEMS,
              hint: "Junction study — mode share intensity on the four approach arms (intervention / observed).",
            }
          : {
              marker: "line",
              items: SAFETY_SEGMENT_RAMP,
              hint: "Junction study — segment pressure on the four approach arms (intervention / observed).",
            };
      case "facility-points":
        return {
          marker: "point",
          items: FACILITY_TYPE_ITEMS,
          hint: "Junction study — zero-emission facility points near the monitored intersection.",
        };
      case "climate-hex":
        return {
          marker: "point",
          items: CLIMATE_ZONE_ITEMS,
          hint:
            scenario === "intervention"
              ? "Junction study — environmental hex field (intervention intensity)."
              : "Junction study — environmental hex field around the intersection.",
        };
      case "sentiment-field":
        return {
          marker: "point",
          items: SATISFACTION_FIELD_ITEMS,
          hint: "Junction study — soft satisfaction blobs and survey points (human perception).",
        };
      case "accessibility":
        return {
          marker: "polygon",
          items: [
            { label: "Reach band", color: "#22D3EE" },
            { label: "Access hub", color: "#38BDF8" },
          ],
          hint: "Junction study — reachability isochrones and access hub at the intersection.",
        };
      default:
        break;
    }
  }

  if (isIssy && spatial) {
    switch (spatial) {
      case "flows":
        if (scenario === "comparison") {
          return {
            marker: "line",
            items: [
              { label: "Favourable change", color: "#22C55E" },
              { label: "Other direction", color: "#8578C3" },
            ],
            hint: "Zone-to-zone flows — thickness = volume; colour = mode or comparison direction.",
          };
        }
        return {
          marker: "line",
          items: ISSY_FLOW_MODE_ITEMS,
          hint: "Directional OD flows between zones; centroid markers show activity nodes.",
        };
      case "segments":
        return {
          marker: "line",
          items: SAFETY_SEGMENT_RAMP,
          hint: "Road segment lines — colour and weight show safety / congestion pressure on links.",
        };
      case "facility-points":
        return {
          marker: "point",
          items: FACILITY_TYPE_ITEMS,
          hint: "Discrete cycling & zero-emission facilities — clustered POIs, not road lines.",
        };
      case "climate-hex":
        return {
          marker: "point",
          items: CLIMATE_ZONE_ITEMS,
          hint: "Hexagonal environmental field — territorial emissions / pressure gradient (not segment lines).",
        };
      case "sentiment-field":
        return {
          marker: "point",
          items: SATISFACTION_FIELD_ITEMS,
          hint: "Soft sentiment zones and survey points — aggregated user satisfaction.",
        };
      case "accessibility":
        return {
          marker: "polygon",
          items: [
            { label: "Lower reach", color: "#D3E3FF" },
            { label: "", color: "#96C2EF" },
            { label: "Higher reach", color: "#22D3EE" },
          ],
          hint: "Isochrone reach bands and access hub — coverage and walkability, not traffic segments.",
        };
      default:
        break;
    }
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
    return {
      marker: "ramp",
      items: SAFETY_HOTSPOT_ITEMS,
      hint: "Circular markers: darker purple = higher grouped risk proxy; marker size reflects point density.",
    };
  }

  if (kpiId === "kpi3.2") {
    return {
      marker: "point",
      items: CLIMATE_ZONE_ITEMS,
      hint: "Filled circles show estimated environmental pressure; size reflects record density.",
    };
  }

  if (kpiId === "kpi3.1") {
    return {
      marker: "point",
      items: FACILITY_TYPE_ITEMS,
      hint: "Point colour follows facility type when present; size reflects relative weighting.",
    };
  }

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

  if (kpiId === "kpi4.1") {
    return {
      marker: "point",
      items: SATISFACTION_FIELD_ITEMS,
      hint: "Soft perception field — not engineering segment geometry.",
    };
  }

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
