/**
 * Legend copy + colors aligned with visualization logic in HeroMap.tsx
 * so the sidebar legend matches what's drawn (points vs lines vs flows).
 */

import { resolveSpatialSystem } from "@/lib/spatialLayerRegistry";
import { CLIMATE_ZONE_ITEMS, ISSY_FLOW_MODE_ITEMS, SAFETY_SEGMENT_RAMP, SEGMENT_PRESSURE_ITEMS } from "@/lib/issyMapLegendItems";
import {
  CPH_ACCESSIBILITY_ITEMS,
  CPH_CAMERA_REGISTRY_ITEMS,
  CPH_EMISSIONS_ITEMS,
  CPH_FACILITY_ITEMS,
  CPH_RADAR_CORRIDOR_ITEMS,
  CPH_SAFETY_SUPPLEMENT_ITEMS,
  CPH_SURVEY_ITEMS,
} from "@/lib/copenhagenMapLayers/copenhagenLegendItems";

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

/** Facility taxonomy neon badges (KPI 3.1 point layers). */
export const ISSY_FACILITY_TAXONOMY_ITEMS: MapLegendItem[] = [
  { label: "Cycle parking", color: "#00ffff" },
  { label: "Mobility count point", color: "#94a3b8" },
  { label: "Shared mobility", color: "#2ecc71" },
  { label: "Pedestrian", color: "#7f5af0" },
];

/** Issy junction study — camera hub, vector arms, glowing corridors (KPI 2.1 / 3.1). */
export const ISSY_JUNCTION_ARM_LEGEND_ITEMS: MapLegendItem[] = [
  { label: "Camera / junction hub", color: "#00ffff" },
  { label: "Directional flow arm", color: "#63ccff" },
  { label: "Monitored corridor", color: "#f59e0b" },
  { label: "Context street", color: "#64748b" },
  ...ISSY_FACILITY_TAXONOMY_ITEMS,
];

/** Facility line types (KPI 3.1 corridor colours). */
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
  options?: { issyJunctionStudy?: boolean; milanIllustrativeLayer?: boolean }
): MapLegendSpec {
  const isIssy = city.toLowerCase().includes("issy");
  const isMilan = city.toLowerCase().includes("milan");
  const isCopenhagen = city.toLowerCase().includes("copenhagen");
  const isHelsinki = city.toLowerCase().includes("helsinki");
  const isZaragoza = city.toLowerCase().includes("zaragoza");
  const isTrikala = city.toLowerCase().includes("trikala");
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
          hint: "City view — observed zone-to-zone OD arcs (CSV). Not per-street measurement.",
        };
      case "segments":
        return kpiId === "kpi1.2" || kpiId === "kpi2.1"
          ? {
              marker: "line",
              items: ISSY_JUNCTION_ARM_LEGEND_ITEMS,
              hint:
                kpiId === "kpi1.2"
                  ? "Junction study — dual-pass glowing corridors and directional flow arms from the camera hub; OD mode share uses bundled CSV in city view only."
                  : "",
            }
          : {
              marker: "line",
              items: SAFETY_SEGMENT_RAMP,
              hint: "Junction study — observed segment data + derived safety pressure on the monitored intervention corridor.",
            };
      case "facility-points":
        return {
          marker: "point",
          items: ISSY_FACILITY_TAXONOMY_ITEMS,
          hint: "Junction study — neon taxonomy badges for zero-emission facility points; dual-pass glow on cycling corridors.",
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

  if (isCopenhagen && kpiId === "kpi1.2") {
    return {
      marker: "line",
      items: [...CPH_RADAR_CORRIDOR_ITEMS, ...CPH_CAMERA_REGISTRY_ITEMS],
      hint: "Glowing street corridors coloured by flow rate with bidirectional arrows; radar spokes at camera hubs; registry markers at OTC sites.",
    };
  }

  if (isCopenhagen && kpiId === "kpi2.1") {
    return {
      marker: "line",
      items: [...CPH_RADAR_CORRIDOR_ITEMS, ...CPH_SAFETY_SUPPLEMENT_ITEMS, { label: "Workbook hub site", color: "#c4b5fd" }],
      hint: "Flow-rate corridors and radar spokes; supplementary iRAP, near-encounter, and tube-speed markers only (camera clutter hidden).",
    };
  }

  if (isCopenhagen && kpiId === "kpi3.2") {
    return {
      marker: "point",
      items: CPH_EMISSIONS_ITEMS,
      hint: "Modelled COPERT-lite emissions nodes (C badge) at OTC flow locations — intensity ramp shows relative pressure; not measured ambient CO₂.",
    };
  }

  if (isCopenhagen && kpiId === "kpi3.1") {
    return {
      marker: "point",
      items: CPH_FACILITY_ITEMS,
      hint: "Parking bay inventory polygons and category logo markers for zero-emission facility deployment.",
    };
  }

  if (isCopenhagen && kpiId === "kpi4.1") {
    return {
      marker: "point",
      items: CPH_SURVEY_ITEMS,
      hint: "Citizen survey logo markers (W) at pilot-area anchors — hover to open acceptability and safety perception in the observatory.",
    };
  }

  if (isCopenhagen && kpiId === "kpi4.2") {
    return {
      marker: "polygonRamp",
      items: CPH_ACCESSIBILITY_ITEMS,
      hint: "Parking conversion polygons plus category markers (cycle, cargo, car removed) — infrastructure accessibility proxy, not an EN 17210 audit.",
    };
  }

  if (isHelsinki && kpiId === "kpi2.1") {
    return {
      marker: "point",
      items: [
        { label: "Hazard survey points (low)", color: "#ddd6fe" },
        { label: "Hazard survey points (high)", color: "#7c3aed" },
        { label: "Viikki anchor", color: "#2ecc71" },
      ],
      hint: "Dangerous-location cloud from Helsinki GeoJSON with a fixed Viikki intervention anchor marker.",
    };
  }

  if (isZaragoza) {
    return {
      marker: "polygon",
      items: [
        { label: "Active pilot area", color: "#2ecc71" },
        { label: "Context intervention area", color: "#64748b" },
      ],
      hint: "Intervention polygons from Zaragoza GeoJSON; active pilot highlighted and non-active areas shown as contextual outlines.",
    };
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
          hint: "Observed OD flow data — zone-to-zone arcs between zone centroids (not street-level measurement).",
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
          items: ISSY_FACILITY_TAXONOMY_ITEMS,
          hint: "Discrete cycling & zero-emission facilities — neon taxonomy badges on bundled SharePoint snapshot geometry.",
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
    if (options?.milanIllustrativeLayer) {
      return {
        marker: "point",
        items: [
          { label: "Climate proxy (C)", color: "#f59e0b" },
          { label: "Higher pressure", color: "#ef4444" },
          { label: "Lower pressure", color: "#22c55e" },
        ],
        hint: "Illustrative zero-emission / climate proxy at 6–8 mode-share junction hubs — RETE segments unavailable for this pilot. Dim lines = KPI 2.1 safety network.",
      };
    }
    return {
      marker: "line",
      items: SEGMENT_PRESSURE_ITEMS,
      hint: "Network segments: bands are relative within the loaded RETE window.",
    };
  }
  if (isMilan && kpiId === "kpi4.2") {
    if (options?.milanIllustrativeLayer) {
      return {
        marker: "point",
        items: [
          { label: "Accessibility (A)", color: "#22c55e" },
          { label: "Equal access score", color: "#63ccff" },
        ],
        hint: "Illustrative accessibility proxy at 6–8 mode-share junction hubs — DSS workbook has no pilot-scoped rows. Dim lines = KPI 2.1 safety network.",
      };
    }
    return {
      marker: "point",
      items: [
        { label: "DSS category", color: "#63ccff" },
        { label: "Equal access %", color: "#22c55e" },
      ],
      hint: "DSS accessibility workbook categories mapped to pilot centroid (no point geometry in source file).",
    };
  }
  if (isMilan && kpiId === "kpi1.2") {
    return {
      marker: "point",
      items: [
        { label: "Inbound approach (N/E)", color: "#ef4444" },
        { label: "Outbound approach (S/W)", color: "#38bdf8" },
        { label: "Hub pulse", color: "#a78bfa" },
      ],
      hint: "Illustrative Copenhagen-style radar at 6–8 KPI 2.1 junctions (mock mode-share). Dim lines = road safety network.",
    };
  }

  // Trikala — semantic point icons + KPI zone halos
  if (isTrikala) {
    if (kpiId === "kpi3.2") {
      return {
        marker: "point",
        items: [
          { label: "Air quality sensor (M)", color: "#ffb300" },
          { label: "Zero-emission zone", color: "#ffe082" },
          { label: "Fleet coverage (anchor)", color: "#96c2ef" },
        ],
        hint: "Amber halos = environmental monitoring zones; lightning-badge icons = Smart Citizen nodes from partner My Maps.",
      };
    }
    if (kpiId === "kpi4.1") {
      return {
        marker: "polygonRamp",
        items: SATISFACTION_FIELD_ITEMS,
        hint: "Green satisfaction halos at partner map sites; P icons = Park & Ride hub polygons (SMY, DEH, GiSeMi on Pilot 2).",
      };
    }
    if (kpiId === "kpi3.1") {
      return {
        marker: "point",
        items: [
          { label: "Park & Ride / bike hub (S)", color: "#2ecc71" },
          { label: "Municipal parking (P)", color: "#7f5af0" },
          { label: "Survey segment (W)", color: "#00ffff" },
        ],
        hint: "Emerald shared-mobility badges = P+R & bike stations; mode-share bars use women mobility survey (self-reported).",
      };
    }
    if (kpiId === "kpi1.2") {
      return {
        marker: "line",
        items: [
          ...CPH_RADAR_CORRIDOR_ITEMS,
          { label: "Survey anchor (W)", color: "#00ffff" },
          { label: "P+R hub (Pilot 2)", color: "#2ecc71" },
        ],
        hint: "Copenhagen-style flow corridors: colour = mode-share intensity, bidirectional arrows on spokes. Pilot 1: women mobility survey segments; Pilot 2: illustrative P+R hubs (SMY · DEH · GiSeMi).",
      };
    }
    if (kpiId === "kpi2.1" || kpiId === "kpi4.2") {
      return {
        marker: "point",
        items: [
          { label: "Crossing / safety (W)", color: "#ffb300" },
          { label: "Bike-lane sensor (M)", color: "#00ffff" },
          { label: "Accessibility (A)", color: "#22c55e" },
          { label: "Traffic signal", color: "#63ccff" },
        ],
        hint:
          kpiId === "kpi4.2"
            ? "Accessibility (A) badges on bike-lane sensors for KPI 4.2; safety (M/W) icons for KPI 2.1 — Pilot 3 uses distinct icons per KPI."
            : "Safety icons on crossing corridor; dashed cyan line = Military School smart crossing vector.",
      };
    }
    return {
      marker: "point",
      items: [
        { label: "Mobility segments", color: "#00ffff" },
        { label: "Infrastructure", color: "#2ecc71" },
        { label: "Safety / crossing", color: "#ffb300" },
      ],
      hint: "Survey rings at pilot anchor; partner infrastructure shown per active KPI.",
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
