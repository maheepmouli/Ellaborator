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
export const CPH_LINE_DEFAULT_WEIGHT = 4;
export const CPH_LINE_DEFAULT_OPACITY = 0.62;
export const CPH_LINE_FOCUSED_WEIGHT = 5;
export const CPH_LINE_FOCUSED_OPACITY = 1.0;
export const CPH_LINE_DIRECTIONAL_DASH = "1, 8";
export const CPH_LINE_FOCUS_DIM = 0.28;
export const CPH_PARKING_LOD_ZOOM = 14;

/** Boost polyline pixel weight when the map is zoomed out so corridors stay visible. */
export function copenhagenZoomLineBoost(zoom: number): number {
  if (zoom >= 17) return 1;
  if (zoom >= 15) return 1.18;
  if (zoom >= 13) return 1.38;
  return 1.55;
}

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

function defaultIntensityColor(value: number): string {
  const t = Math.max(0, Math.min(100, value));
  if (t < 33) return "#6EE7B7";
  if (t < 66) return "#38bdf8";
  if (t < 85) return "#FBBF24";
  return "#F97316";
}

/** Map scenario + observed values to the shared ELABORATOR point-intensity palette. */
export function resolveCopenhagenIntensityColor(options: {
  scenario: "baseline" | "intervention" | "comparison";
  baselineValue: number;
  interventionValue: number;
  comparisonValue: number;
  getValueColor?: (value: number, safetyKpi: boolean) => string;
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

  const colorFn =
    typeof getValueColor === "function"
      ? getValueColor
      : (value: number) => defaultIntensityColor(value);

  if (scenario === "baseline") {
    return colorFn(baselineValue, safetyKpi);
  }
  if (scenario === "intervention") {
    return colorFn(interventionValue, safetyKpi);
  }
  const magnitude = Math.min(100, Math.abs(comparisonValue) * 4);
  return colorFn(magnitude, safetyKpi);
}

/** Slight radius boost for higher intensity (0–100 scale). */
export function copenhagenMarkerRadius(intensityValue: number, isSelected: boolean): number {
  const base = isSelected ? 7 : 4.5;
  const boost = Math.min(3, (Math.max(0, intensityValue) / 100) * 3);
  return base + boost;
}

/** Line weight scales with observed flow intensity (0–100). */
export function copenhagenFlowLineWeight(intensityValue: number, isSelected: boolean): number {
  if (isSelected) return CPH_LINE_FOCUSED_WEIGHT + 1;
  const t = Math.max(0, Math.min(100, intensityValue));
  return CPH_LINE_DEFAULT_WEIGHT + (t / 100) * 4.5;
}

/** Line opacity scales with flow intensity; dimmed spokes stay readable. */
export function copenhagenFlowLineOpacity(
  intensityValue: number,
  isSelected: boolean,
  dimmed = false
): number {
  if (isSelected) return CPH_LINE_FOCUSED_OPACITY;
  const t = Math.max(0, Math.min(100, intensityValue));
  const base = CPH_LINE_DEFAULT_OPACITY + (t / 100) * 0.28;
  return dimmed ? base * CPH_LINE_FOCUS_DIM * 1.35 : base;
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
  const radius = copenhagenMarkerRadius(intensityValue, isSelected);
  const t = Math.max(0, Math.min(100, intensityValue));
  const opacityScale = dimmed ? 0.55 : 1;

  return {
    radius: isSelected ? radius + 1.5 : Math.max(5.5, radius * 0.9),
    fillColor: isSelected ? CPH_LINE_FOCUS_COLOR : intensityColor,
    fillOpacity: (isSelected ? 0.95 : 0.62 + (t / 100) * 0.3) * opacityScale,
    color: isSelected ? "#ffffff" : intensityColor,
    weight: isSelected ? 2.4 : 1.6,
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
