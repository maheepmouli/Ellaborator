const ALL_STANDARD_MODES = ["Pedestrian", "Cycle", "Public Transport", "Private Car", "PTW"];

export type ElaboratorModeShareMode = (typeof ALL_STANDARD_MODES)[number];

/** Map Issy CSV `vehicle_category` tokens to ELABORATOR mode-share buckets (van/truck → Private Car). */
export function mapIssyVehicleCategoryToElaboratorMode(category: string): ElaboratorModeShareMode {
  const c = category.toLowerCase();
  if (c.includes("person") || c.includes("pedestrian")) return "Pedestrian";
  if (c.includes("bicycle") || c.includes("cycl") || c.includes("bike")) return "Cycle";
  if (c.includes("bus") || c.includes("transit")) return "Public Transport";
  if (
    c.includes("motorcycle") ||
    c.includes("motor ") ||
    c.includes("moto") ||
    c.includes("trottinette") ||
    c.includes("scooter")
  ) {
    return "PTW";
  }
  if (c.includes("car") || c.includes("van") || c.includes("truck")) return "Private Car";
  return "Private Car";
}

/** True when the full standard mode set is selected (no narrowing). */
export function areAllTravelModesSelected(modes: string[] | undefined): boolean {
  if (!modes?.length) return false;
  return ALL_STANDARD_MODES.every((m) => modes.includes(m));
}

/** Maps KPI card travel-mode buckets to Issy zone-flow CSV `vehicleCategory` tokens. */
export function travelModeMatchesIssyVehicleCategory(mode: string, vehicleCategory: string): boolean {
  const c = vehicleCategory.toLowerCase();
  switch (mode) {
    case "Pedestrian":
      return c.includes("pedestrian") || c.includes("person");
    case "Cycle":
      return c.includes("bicycle") || c.includes("cycl") || c.includes("bike");
    case "Public Transport":
      return c.includes("bus") || c.includes("transit") || c.includes("pt");
    case "Private Car":
      return c.includes("car") && !c.includes("motorcycle") && !c.includes("motor");
    case "PTW":
      return (
        c.includes("motorcycle") ||
        c.includes("motor ") ||
        c.includes("moto") ||
        c.includes("trottinette") ||
        c.includes("scooter")
      );
    default:
      return true;
  }
}

/** Fuzzy match KPI infrastructure / accessibility breakdown labels against feature properties. */
export function infraOrA11yLabelMatchesFeature(propText: unknown, chartLabel: string): boolean {
  if (!chartLabel) return false;
  const hay = String(propText ?? "").toLowerCase().trim();
  const needle = chartLabel.toLowerCase().trim();
  if (!hay || !needle) return false;
  return hay.includes(needle) || needle.includes(hay);
}
