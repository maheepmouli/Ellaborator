/**
 * Legend copy + colors aligned with visualization logic in HeroMap.tsx
 * so the sidebar legend matches what's drawn (points vs lines vs flows).
 */

import { resolveSpatialSystem } from "@/lib/spatialLayerRegistry";
import { CLIMATE_ZONE_ITEMS, ISSY_FLOW_MODE_ITEMS, SAFETY_SEGMENT_RAMP, SEGMENT_PRESSURE_ITEMS } from "@/lib/issyMapLegendItems";
import { buildMilanSpeedLegendItems } from "@/lib/milanMapLayers";
import type { MilanSegmentRecord } from "@/services/milanSegmentData";
import {
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
  /** Optional footer note under the swatches — omit when it only restates the markers */
  hint?: string;
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
  options?: {
    issyJunctionStudy?: boolean;
    milanIllustrativeLayer?: boolean;
    pilotId?: string | null;
    milanSpeedRecords?: MilanSegmentRecord[];
  }
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
      case "points":
        if (kpiId === "kpi3.2") {
          return {
            marker: "point",
            items: CLIMATE_ZONE_ITEMS,
            hint: "One city-wide climate intensity for Issy (year time series). Halo colour = pressure — not a hex grid.",
          };
        }
        if (kpiId === "kpi1.2" || kpiId === "kpi2.1") {
          if (kpiId === "kpi1.2" && options?.pilotId === "issy-p2") {
            return {
              marker: "point",
              items: [
                { label: "≥50% sustainable", color: "#22c55e" },
                { label: "40–50%", color: "#84cc16" },
                { label: "30–40%", color: "#f59e0b" },
                { label: "<30%", color: "#ef4444" },
              ],
              hint: "Pilot 2 city scale — sustainable mobility % at ISSY1 OD zone centroids (observed CSV). Dot size ≈ zone activity.",
            };
          }
          return {
            marker: "point",
            items: [
              { label: "Aggregated hub (ripple)", color: "#ef4444" },
              { label: "Camera FOV", color: "#96C2EF" },
              { label: "Camera / junction hub", color: "#00ffff" },
            ],
            hint:
              kpiId === "kpi1.2"
                ? "Mode share uses ripple hubs only (same as Copenhagen) — no street segments on the map."
                : "Road safety uses the same hub aggregation as Copenhagen (no flow spokes). Corridor detail stays in the observatory.",
          };
        }
        if (spatial === "flows") {
          return {
            marker: "line",
            items: ISSY_FLOW_MODE_ITEMS,
            hint: "City view — observed zone-to-zone OD arcs (CSV). Not per-street measurement.",
          };
        }
        break;
      case "segments":
        return {
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
              ? "City-wide climate intensity (intervention) — one reading for Issy."
              : "City-wide climate intensity — one reading for Issy (year time series).",
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
      marker: "point",
      items: [
        { label: "Camera hub (pulse rings)", color: "#38bdf8" },
        { label: "Hub intensity rings", color: "#ef4444" },
        ...CPH_CAMERA_REGISTRY_ITEMS,
      ],
    };
  }

  if (isCopenhagen && kpiId === "kpi2.1") {
    return {
      marker: "point",
      items: [
        { label: "Aggregated hub (ripple)", color: "#ef4444" },
        { label: "Camera FOV", color: "#96C2EF" },
        ...CPH_SAFETY_SUPPLEMENT_ITEMS,
        { label: "Workbook hub site", color: "#c4b5fd" },
      ],
      hint: "Road safety uses the same hub aggregation (no flow spokes). Named directional links appear in the observatory diagram.",
    };
  }

  if (isCopenhagen && kpiId === "kpi3.2") {
    return {
      marker: "ramp",
      items: CPH_EMISSIONS_ITEMS,
      hint: "One point per OTC sensor (directions summed). Colour = modelled pressure index 0–100 — not measured ambient CO₂.",
    };
  }

  if (isCopenhagen && kpiId === "kpi3.1") {
    return {
      marker: "point",
      items: CPH_FACILITY_ITEMS,
    };
  }

  if (isCopenhagen && kpiId === "kpi4.1") {
    return {
      marker: "point",
      items: [
        { label: "MOCK satisfaction (mode-share site)", color: "#7f5af0" },
        { label: "Pilot area (inferred)", color: "rgba(255,255,255,0.35)" },
      ],
      hint: "MOCK — satisfaction pins reuse KPI 1.2 OTC / mode-share corridor sites. Not live survey geodata.",
    };
  }

  if (isCopenhagen && kpiId === "kpi4.2") {
    return {
      marker: "point",
      items: [
        { label: "MOCK accessibility (mode-share site)", color: "#22d3ee" },
        { label: "Pilot area (inferred)", color: "rgba(255,255,255,0.35)" },
      ],
      hint: "MOCK — accessibility/security pins reuse KPI 1.2 OTC / mode-share corridor sites. Survey-style placeholder, not EN 17210.",
    };
  }

  if (isHelsinki && kpiId === "kpi1.1") {
    return {
      marker: "point",
      items: [
        { label: "Viikki warning-system hub", color: "#38bdf8" },
        { label: "Pilot influence field", color: "#94a3b8" },
      ],
      hint: "Single Viikki hub with expansion-plan status in the observatory (KPI 1.1 ≥1 plan pending).",
    };
  }

  if (isHelsinki && kpiId === "kpi1.2") {
    // Do not default missing pilotId to hel-p1 — that mislabels FVH3 as hazard hubs.
    const pilot = options?.pilotId;
    if (pilot === "hel-p2") {
      return {
        marker: "point",
        items: [
          { label: "Primary parking cluster", color: "#38bdf8" },
          { label: "Parking observation clusters", color: "#0ea5e9" },
        ],
        hint: "FVH2: 509 Kallio field observations grouped into ~8 parking clusters. No mode-share sensor — counts are from the observation study.",
      };
    }
    if (pilot === "hel-p3") {
      return {
        marker: "point",
        items: [
          { label: "Telraam (mode-share counts)", color: "#ef4444" },
          { label: "Camera / Mobilysis (FOV)", color: "#f97316" },
          { label: "HSL tram corridor (line 15)", color: "#8578C3" },
        ],
        hint: "FVH3 Viikki: Telraam (red) for sustainable mode share, Mobilysis camera (orange FOV) for gate counts. Tram is context only.",
      };
    }
    return {
      marker: "point",
      items: [
        { label: "Sampled dangerous-location reports", color: "#ef4444" },
        { label: "Primary hazard cluster", color: "#38bdf8" },
        { label: "Hazard density cluster hubs", color: "#ef4444" },
      ],
      hint: "FVH1: ~220 sampled survey points + 8 density hubs. No pilot-scoped mode-share sensor in this data drop.",
    };
  }

  if (isHelsinki && kpiId === "kpi2.1") {
    const isViikkiPilot = options?.pilotId === "hel-p3";
    if (isViikkiPilot) {
      return {
        marker: "point",
        items: [
          { label: "Viikki UX safety survey (site)", color: "#f97316" },
          { label: "HSL tram / Innotrafik context", color: "#8578C3" },
        ],
        hint: "FVH3: 50-response on-site UX survey at the Viikki light-rail crossing only (not citywide FVH1 hazard GPKGs). Zoom freely to street level.",
      };
    }
    return {
      marker: "point",
      items: [
        { label: "Sampled dangerous locations", color: "#ef4444" },
        { label: "Sampled near-miss / conflicts", color: "#f97316" },
        { label: "Safety cluster hub", color: "#2ecc71" },
      ],
      hint: "FVH1 paints sampled hazard + conflict clouds under city safety clusters (2,663 + 3,202 records). Zoom freely to street level.",
    };
  }

  if (isHelsinki && kpiId === "kpi3.2") {
    return {
      marker: "ramp",
      items: [
        { label: "Lower pressure", color: "#6EE7B7" },
        { label: "Medium", color: "#FBBF24" },
        { label: "Raised", color: "#F97316" },
        { label: "Higher pressure", color: "#E02020" },
      ],
      hint:
        options?.pilotId === "hel-p3"
          ? "Colour-rated points only (no ripples). Viikki warning-system context may include Telraam motor-intensity proxy. Not ambient CO₂."
          : "Colour-rated illustrative pressure points only. These are proxy samples, not direct emissions measurements or live mobility sensors.",
    };
  }

  if (isHelsinki && kpiId === "kpi3.1") {
    return {
      marker: "point",
      items: [
        { label: "On street / cycleway", color: "#38bdf8" },
        { label: "On pavement", color: "#f97316" },
        { label: "Bike not in racks", color: "#2ecc71" },
        { label: "Outside parking zone", color: "#ef4444" },
      ],
      hint:
        scenario === "baseline"
          ? "Baseline sample of Kallio parking observations (thinner set). After shows a denser sample of the same single-period study — not live sensors."
          : "Kallio e-scooter parking observations by category. Dots are field observations, not live parking sensors (20 planned sensors were not delivered).",
    };
  }

  if (isHelsinki && (kpiId === "kpi4.1" || kpiId === "kpi4.2")) {
    if (options?.pilotId === "hel-p2" && kpiId === "kpi4.2") {
      return {
        marker: "point",
        items: [
          { label: "On street / cycleway", color: "#38bdf8" },
          { label: "On pavement", color: "#f97316" },
          { label: "Bike not in racks", color: "#2ecc71" },
          { label: "Outside parking zone", color: "#ef4444" },
        ],
        hint: "Kallio e-scooter field observations from the five GPKG layers (pavement, street, cycleway, outside zone, bikes). Not live sensors — Viikki UX belongs to FVH3.",
      };
    }
    return {
      marker: "point",
      items:
        kpiId === "kpi4.1"
          ? [{ label: "Viikki UX survey hub (site)", color: "#96c2ef" }]
          : [
              { label: "Viikki UX survey hub", color: "#96c2ef" },
              { label: "Accessibility challenge share", color: "#38bdf8" },
            ],
      hint:
        kpiId === "kpi4.1"
          ? "Single on-site UX satisfaction hub at the Viikki crossing (n=50) vs the ≥75% KPI 4.1 target — not area-spread points."
          : "Viikki UX accessibility self-report (visual / hearing / mobility challenge).",
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
    const items =
      options?.milanSpeedRecords?.length
        ? buildMilanSpeedLegendItems(options.milanSpeedRecords)
        : SEGMENT_PRESSURE_ITEMS;
    return {
      marker: "line",
      items,
      hint: options?.milanSpeedRecords?.length
        ? "AMAT network.shp corridor (Maggio 2025): colour = observed speed band; grey = network geometry without a Maggio reading."
        : "Road segments: colour shows relative speed / risk band (higher = more pressure).",
    };
  }
  if (isMilan && kpiId === "kpi3.2") {
    if (options?.milanIllustrativeLayer) {
      return {
        marker: "point",
        items: [
          { label: "Lower pressure", color: "#22C55E" },
          { label: "Mid pressure", color: "#FBBF24" },
          { label: "Higher pressure", color: "#F97316" },
        ],
        hint: "Illustrative climate pressure (filled circles) along AMAT network.shp — RETE env segments unavailable. Dim grey lines = intervention corridor.",
      };
    }
    return {
      marker: "line",
      items: [
        { label: "Lower pressure", color: "#22C55E" },
        { label: "Mid", color: "#FBBF24" },
        { label: "Higher pressure", color: "#F97316" },
      ],
      hint: "RETE network segments: colour = relative environmental pressure within the loaded window.",
    };
  }
  if (isMilan && kpiId === "kpi4.2") {
    if (options?.milanIllustrativeLayer) {
      return {
        marker: "point",
        items: [
          { label: "Equal access", color: "#22c55e" },
          { label: "Slightly penalised", color: "#fbbf24" },
          { label: "Heavily penalised", color: "#f87171" },
        ],
        hint: "Illustrative accessibility proxy (filled dots) along intervention corridor — DSS workbook rows unavailable for this pilot.",
      };
    }
    return {
      marker: "point",
      items: [
        { label: "Equal access", color: "#22c55e" },
        { label: "Slightly penalised", color: "#fbbf24" },
        { label: "Heavily penalised", color: "#f87171" },
      ],
      hint: "AMAT DSS civic-address points — filled dots coloured by barrier category (equal / slight / heavy). Pilot 1 includes before/after where posted.",
    };
  }
  if (isMilan && kpiId === "kpi3.1") {
    return {
      marker: "point",
      items: [
        { label: "Cycle parking", color: "#2ecc71" },
        { label: "EV charging", color: "#38bdf8" },
        { label: "Mobility hub / pedestrian", color: "#a78bfa" },
      ],
      hint: "Illustrative zero-emission facility inventory (KPI 3.1) — taxonomy badges placed along AMAT network.shp; dim grey lines = intervention corridor underlay.",
    };
  }
  if (isMilan && kpiId === "kpi1.1") {
    return {
      marker: "point",
      items: [
        { label: "CDM3 expansion hub", color: "#38bdf8" },
        { label: "Pilot influence field", color: "#94a3b8" },
      ],
      hint: "Pilot 3 expansion readiness from the Milan Intervention Evaluation Plan (KPI 1.1 ≥1 plan).",
    };
  }

  if (isMilan && kpiId === "kpi1.2") {
    return {
      marker: "point",
      items: [{ label: "AMAT count site", color: "#38bdf8" }],
      hint: "AMAT road-user count sites (not cameras). Click a hub for sensor-level mode share in the observatory.",
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
        hint: "Amber halos = environmental monitoring zones; lightning-badge icons = Smart Citizen nodes (Pilot 4 · partner My Maps).",
      };
    }
    if (kpiId === "kpi4.1") {
      const pilotId = options?.pilotId;
      if (pilotId === "tri-p2") {
        return {
          marker: "point",
          items: [{ label: "Park and ride station", color: "#22c55e" }],
          hint: "Mock satisfaction — coloured dots mark SMY · DEH · GiSeMi. No P+R user survey is linked yet.",
        };
      }
      return {
        marker: "polygonRamp",
        items: SATISFACTION_FIELD_ITEMS,
        hint:
          pilotId === "tri-p1"
            ? "Green satisfaction halo at the Military School smart crossing; survey Likert (condition, maintenance, accessibility) in the observatory."
            : "Green satisfaction halos at partner map sites; P icons = Park & Ride hub polygons (SMY, DEH, GiSeMi on Pilot 2).",
      };
    }
    if (kpiId === "kpi3.1") {
      const pilotId = options?.pilotId;
      if (pilotId === "tri-p2") {
        return {
          marker: "point",
          items: [
            { label: "Park & Ride hub (installed)", color: "#00ffff" },
            { label: "P+R site polygon", color: "#2ecc71" },
          ],
          hint: "KPI 3.1 counts the three installed P+R hubs (SMY · DEH · GiSeMi) — baseline 0 (map empty) → intervention 3. Municipal car parks omitted.",
        };
      }
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
      const pilotId = options?.pilotId;
      if (pilotId === "tri-p2") {
        return {
          marker: "point",
          items: [
            { label: "Park & Ride hub (bike uptake)", color: "#00ffff" },
            { label: "Bike / docking station", color: "#2ecc71" },
            { label: "P+R site polygon", color: "#2ecc71" },
          ],
          hint: "KPI 1.2 · bike uptake from park-and-ride facilities (Intervention Evaluation Plan). SMY · DEH · GiSeMi hubs only — municipal car parks omitted; partner occupancy survey pending.",
        };
      }
      if (pilotId === "tri-p4") {
        return {
          marker: "point",
          items: [
            { label: "SMARTA / survey aggregate", color: "#2ecc71" },
            { label: "Women mobility segment", color: "#00ffff" },
          ],
          hint: "Pilot 4 · SMARTA2 app expansion — mode-share from survey aggregates at the pilot anchor (no CV FOV radar on this pilot).",
        };
      }
      return {
        marker: "point",
        items: [
          { label: "Aggregated hub (ripple)", color: "#38bdf8" },
          { label: "Camera FOV", color: "#96C2EF" },
          { label: "Survey / P+R hub", color: "#2ecc71" },
        ],
        hint: "Flows aggregated at mobility hubs (ripple + FOV). No map spokes — directional detail stays in the observatory.",
      };
    }
    if (kpiId === "kpi2.1" || kpiId === "kpi4.2") {
      const pilotId = options?.pilotId;
      if (pilotId === "tri-p3") {
        return {
          marker: "point",
          items:
            kpiId === "kpi2.1"
              ? [
                  { label: "Bike-lane sensor", color: "#00ffff" },
                  { label: "Higher occupancy stress", color: "#f59e0b" },
                  { label: "Lower occupancy stress", color: "#22c55e" },
                ]
              : [
                  { label: "Bike-lane sensor (geography)", color: "#00ffff" },
                  { label: "Survey Likert (observatory)", color: "#22c55e" },
                ],
          hint:
            kpiId === "kpi2.1"
              ? "Pilot 3 LoRa bike-lane sensors — icon tint = occupancy stress; mock speed derived from FREE/BUSY. Toggle Baseline vs Intervention to see constructed pre-redesign offset."
              : "Pilot 3 KPI 4.2 — map pins are bike-lane sensor locations; scores come from the online bike-safety survey (baseline + post SharePoint xlsx), not LoRa availability.",
        };
      }
      if (pilotId === "tri-p1") {
        return {
          marker: "point",
          items:
            kpiId === "kpi4.2"
              ? [{ label: "Smart crossing (accessibility)", color: "#22c55e" }]
              : [
                  { label: "Smart crossing / safety", color: "#7f5af0" },
                  { label: "Crossing vector", color: "#00ffff" },
                ],
          hint:
            kpiId === "kpi4.2"
              ? "Accessibility badge at the Military School smart crossing — survey Likert in the observatory."
              : "Safety / crossing icon at Military School; dashed cyan line = smart crossing vector. Survey dimensions in the observatory.",
        };
      }
      return {
        marker: "point",
        items: [
          { label: "Crossing / safety (W)", color: "#7f5af0" },
          { label: "Bike-lane sensor (M)", color: "#00ffff" },
          { label: "Accessibility (A)", color: "#22c55e" },
          { label: "Traffic signal", color: "#00ffff" },
        ],
        hint:
          kpiId === "kpi4.2"
            ? "Accessibility (A) badges on bike-lane sensors for KPI 4.2; safety icons for KPI 2.1 — Pilot 3 uses distinct icons per KPI."
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
