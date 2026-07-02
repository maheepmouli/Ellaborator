export interface CopenhagenFlowStyle {
  color: string;
  weight: number;
  opacity: number;
  dashArray?: string;
  className?: string;
}

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
  const base = isSelected ? 7.5 : 5;
  const boost = Math.min(3.2, (Math.max(0, intensityValue) / 100) * 3.2);
  return base + boost;
}

export function getCopenhagenFlowStyle(options: {
  isSelected: boolean;
  comparisonValue?: number;
  scenario: string;
  baseColor: string;
}): CopenhagenFlowStyle {
  const { isSelected, comparisonValue = 0, scenario, baseColor } = options;
  const favorable =
    scenario === "comparison" ? comparisonValue >= 0 : true;

  if (isSelected) {
    return {
      color: "#00ffff",
      weight: 5.5,
      opacity: 0.95,
      dashArray: "10 8",
      className: "cph-flow-arm-animated",
    };
  }

  if (scenario === "comparison") {
    return {
      color: favorable ? "#2ecc71" : "#ff6b6b",
      weight: 3.2,
      opacity: 0.72,
    };
  }

  return {
    color: baseColor,
    weight: 3,
    opacity: 0.58,
  };
}

export function getCopenhagenEndpointMarkerStyle(
  isSelected: boolean,
  intensityColor: string,
  intensityValue = 50
): {
  radius: number;
  fillColor: string;
  fillOpacity: number;
  color: string;
  weight: number;
} {
  const radius = copenhagenMarkerRadius(intensityValue, isSelected);
  if (isSelected) {
    return {
      radius,
      fillColor: "#00ffff",
      fillOpacity: 0.95,
      color: "#ffffff",
      weight: 2.2,
    };
  }
  return {
    radius,
    fillColor: intensityColor,
    fillOpacity: 0.82,
    color: "#E6E8FF",
    weight: 1.5,
  };
}
