import type { TrikalaLocationKind } from "@/data/trikalaLocationRegistry";
import {
  resolveMapPointIconSpec,
  type MapPointIconSpec,
} from "@/lib/mapPointIconTaxonomy";

/** KPI- and asset-aware icon for partner My Maps infrastructure nodes. */
export function resolveTrikalaInfraIconSpec(
  kind: TrikalaLocationKind,
  selectedKpi: string
): MapPointIconSpec {
  switch (kind) {
    case "air_quality_sensor":
      return resolveMapPointIconSpec({ kind: "air_quality_sensor", category: "environmental sensor" });
    case "bike_lane_sensor": {
      // Always bike-lane sensor — never Accessibility (A) badges on LoRa nodes.
      const base = resolveMapPointIconSpec({ category: "bike lane sensor", kind: "bike_lane_sensor" });
      return {
        ...base,
        label: "Bike-lane sensor",
        symbol: "M",
        accent: "#00ffff",
        glow: "#22d3ee",
      };
    }
    case "bike_station":
      return resolveMapPointIconSpec({ facilityCategory: "cycle parking" });
    case "parking_station":
      return resolveMapPointIconSpec({ facilityCategory: "parking" });
    case "park_and_ride":
      // P+R framed as bike / micromobility hubs (not municipal car parks).
      return selectedKpi === "kpi1.2" || selectedKpi === "kpi3.1"
        ? resolveMapPointIconSpec({ facilityCategory: "cycle parking" })
        : resolveMapPointIconSpec({ kind: "park_and_ride" });
    case "smart_crossing_site":
      return selectedKpi === "kpi4.2"
        ? resolveMapPointIconSpec({ facilityCategory: "accessibility" })
        : resolveMapPointIconSpec({ category: "pedestrian crossing" });
    case "traffic_signal":
      return resolveMapPointIconSpec({ category: "traffic signal pedestrian" });
    default:
      return resolveMapPointIconSpec({ kind });
  }
}

/** Semantic icon for jittered survey aggregate markers at pilot anchor. */
export function resolveTrikalaSurveyIconSpec(
  segmentId: string,
  selectedKpi: string,
  props?: Record<string, unknown>
): MapPointIconSpec {
  const datasetKind = String(props?.datasetKind ?? "");
  const likert = String(props?.likertLabel ?? "").toLowerCase();

  if (datasetKind === "environmental-sensor" || datasetKind === "environmental-fleet") {
    return resolveMapPointIconSpec({ kind: "air_quality_sensor" });
  }
  if (segmentId.includes("women-mobility") || segmentId.includes("caregiver") || segmentId.includes("village")) {
    return resolveMapPointIconSpec({ category: "pedestrian women mobility" });
  }
  if (segmentId.includes("smarta-app")) {
    return resolveMapPointIconSpec({ facilityCategory: "shared mobility" });
  }
  if (segmentId.includes("smart-crossing")) {
    if (selectedKpi === "kpi4.2" || likert.includes("condition") || likert.includes("connectivity")) {
      return resolveMapPointIconSpec({ facilityCategory: "accessibility" });
    }
    return resolveMapPointIconSpec({ category: "pedestrian crossing" });
  }
  if (segmentId.includes("bike-lane") || segmentId.includes("tri-p3")) {
    return selectedKpi === "kpi4.2" || likert.includes("condition")
      ? resolveMapPointIconSpec({ facilityCategory: "accessibility" })
      : resolveMapPointIconSpec({ facilityCategory: "cycle parking" });
  }
  if (selectedKpi === "kpi4.1" || likert.includes("accessibility") || likert.includes("satisfaction")) {
    return resolveMapPointIconSpec({ facilityCategory: "accessibility" });
  }
  if (selectedKpi === "kpi2.1" || likert.includes("safety")) {
    return resolveMapPointIconSpec({ category: "pedestrian" });
  }
  return resolveMapPointIconSpec({ category: "survey aggregate" });
}
