import type * as L from "leaflet";
import { CPH_DIRECTION_PAIR_COLORS } from "./copenhagenFlowGeometry";

export interface CopenhagenFlowStyle {
  color: string;
  weight: number;
  opacity: number;
  dashArray?: string;
  className?: string;
}

/** Shared GIS line tokens for Copenhagen corridor / parking layers. */
export const CPH_LINE_FOCUS_COLOR = "#00ffff";
export const CPH_LINE_DEFAULT_WEIGHT = 2.5;
export const CPH_LINE_DEFAULT_OPACITY = 0.3;
export const CPH_LINE_FOCUSED_WEIGHT = 5;
export const CPH_LINE_FOCUSED_OPACITY = 1.0;
export const CPH_LINE_DIRECTIONAL_DASH = "1, 8";
export const CPH_LINE_FOCUS_DIM = 0.28;
export const CPH_PARKING_LOD_ZOOM = 14;

export const CPH_LINE_BASE: Pick<CopenhagenFlowStyle, "weight" | "opacity"> & {
  lineCap: "round";
  lineJoin: "round";
} = {
  lineCap: "round",
  lineJoin: "round",
  weight: CPH_LINE_DEFAULT_WEIGHT,
  opacity: CPH_LINE_DEFAULT_OPACITY,
};

export const CPH_LINE_FOCUSED: CopenhagenFlowStyle = {
  color: CPH_LINE_FOCUS_COLOR,
  weight: CPH_LINE_FOCUSED_WEIGHT,
  opacity: CPH_LINE_FOCUSED_OPACITY,
};

/** Map scenario + observed values to the shared ELABORATOR point-intensity palette. */
export function resolveCopenhagenIntensityColor(options: {
  scenario: "baseline" | "intervention" | "comparison";
  baselineValue: number;
  interventionValue: number;
  comparisonValue: number;
  getValueColor: (value: number, safetyKpi: boolean) => string;
  safetyKpi?: boolean;
}): string {
  const {
    scenario,
    baselineValue,
    interventionValue,
    comparisonValue,
    getValueColor,
    safetyKpi = false,
  } = options;

  if (scenario === "baseline") {
    return getValueColor(baselineValue, safetyKpi);
  }
  if (scenario === "intervention") {
    return getValueColor(interventionValue, safetyKpi);
  }
  const magnitude = Math.min(100, Math.abs(comparisonValue) * 4);
  return getValueColor(magnitude, safetyKpi);
}

/** Slight radius boost for higher intensity (0–100 scale). */
export function copenhagenMarkerRadius(intensityValue: number, isSelected: boolean): number {
  const base = isSelected ? 6 : 4;
  const boost = Math.min(2.5, (Math.max(0, intensityValue) / 100) * 2.5);
  return base + boost;
}

export function getCopenhagenFlowStyle(options: {
  isSelected: boolean;
  comparisonValue?: number;
  scenario: string;
  baseColor: string;
}): CopenhagenFlowStyle {
  const { isSelected, comparisonValue = 0, scenario, baseColor } = options;
  const favorable = scenario === "comparison" ? comparisonValue >= 0 : true;

  if (isSelected) {
    return { ...CPH_LINE_FOCUSED };
  }

  if (scenario === "comparison") {
    return {
      color: favorable ? "#2ecc71" : "#ff6b6b",
      weight: CPH_LINE_DEFAULT_WEIGHT,
      opacity: 0.35,
    };
  }

  if (scenario === "baseline") {
    return {
      color: baseColor,
      weight: CPH_LINE_DEFAULT_WEIGHT,
      opacity: 0.45,
      dashArray: CPH_LINE_DIRECTIONAL_DASH,
    };
  }

  return {
    color: baseColor,
    weight: CPH_LINE_DEFAULT_WEIGHT,
    opacity: CPH_LINE_DEFAULT_OPACITY,
  };
}

export function getCopenhagenDirectionArmStyle(options: {
  pairSlot: 0 | 1;
  isSelected: boolean;
  scenario: string;
  dimmed?: boolean;
}): CopenhagenFlowStyle {
  const { pairSlot, isSelected, scenario, dimmed = false } = options;
  if (isSelected) {
    return { ...CPH_LINE_FOCUSED };
  }

  const color = CPH_DIRECTION_PAIR_COLORS[pairSlot];
  const base: CopenhagenFlowStyle =
    scenario === "baseline"
      ? {
          color,
          weight: CPH_LINE_DEFAULT_WEIGHT,
          opacity: 0.45,
          dashArray: CPH_LINE_DIRECTIONAL_DASH,
        }
      : {
          color,
          weight: CPH_LINE_DEFAULT_WEIGHT,
          opacity: CPH_LINE_DEFAULT_OPACITY,
        };

  if (!dimmed) return base;
  return {
    ...base,
    opacity: (base.opacity ?? CPH_LINE_DEFAULT_OPACITY) * CPH_LINE_FOCUS_DIM,
  };
}

export function getCopenhagenEndpointMarkerStyle(
  isSelected: boolean,
  intensityColor: string,
  intensityValue = 50,
  dimmed = false
): {
  radius: number;
  fillColor: string;
  fillOpacity: number;
  color: string;
  weight: number;
  hidden?: boolean;
} {
  if (!isSelected) {
    return {
      radius: 0,
      fillColor: intensityColor,
      fillOpacity: 0,
      color: intensityColor,
      weight: 0,
      hidden: true,
    };
  }

  const radius = copenhagenMarkerRadius(intensityValue, true);
  return {
    radius,
    fillColor: CPH_LINE_FOCUS_COLOR,
    fillOpacity: 0.95,
    color: "#ffffff",
    weight: 2.2,
    hidden: false,
  };
}

export function getCopenhagenParkingLineStyles(color: string, selectedKpi: string): {
  glow: L.PathOptions;
  core: L.PathOptions;
  highlight: L.PathOptions;
} {
  const fillOpacity = selectedKpi === "kpi4.2" ? 0.12 : 0.1;
  const core: L.PathOptions = {
    color,
    weight: 2,
    opacity: 0.35,
    fillOpacity,
    fillColor: color,
    lineCap: "round",
    lineJoin: "round",
  };
  return {
    glow: {
      color,
      weight: 4,
      opacity: 0.22,
      fillOpacity: 0,
      lineCap: "round",
      lineJoin: "round",
      interactive: false,
    },
    core,
    highlight: {
      color: CPH_LINE_FOCUS_COLOR,
      weight: 6,
      opacity: CPH_LINE_FOCUSED_OPACITY,
      fillOpacity: Math.min(0.35, fillOpacity + 0.15),
      fillColor: color,
      lineCap: "round",
      lineJoin: "round",
    },
  };
}
