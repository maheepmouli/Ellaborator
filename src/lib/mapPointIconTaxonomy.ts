export type MapPointIconKey =
  | "cycleParking"
  | "charging"
  | "sharedMobility"
  | "pedestrian"
  | "sensor"
  | "parking"
  | "accessibility"
  | "generic";

export interface MapPointIconSpec {
  key: MapPointIconKey;
  label: string;
  symbol: string;
  accent: string;
  glow: string;
}

const ICON_SPEC: Record<MapPointIconKey, MapPointIconSpec> = {
  cycleParking: { key: "cycleParking", label: "Cycle parking", symbol: "P", accent: "#00ffff", glow: "#22d3ee" },
  charging: { key: "charging", label: "Charging / sensor", symbol: "C", accent: "#ffb300", glow: "#f59e0b" },
  sharedMobility: { key: "sharedMobility", label: "Shared mobility", symbol: "S", accent: "#2ecc71", glow: "#10b981" },
  pedestrian: { key: "pedestrian", label: "Pedestrian", symbol: "W", accent: "#7f5af0", glow: "#6d28d9" },
  sensor: { key: "sensor", label: "Sensor", symbol: "M", accent: "#ffb300", glow: "#f59e0b" },
  parking: { key: "parking", label: "Parking", symbol: "P", accent: "#60a5fa", glow: "#3b82f6" },
  accessibility: { key: "accessibility", label: "Accessibility", symbol: "A", accent: "#22c55e", glow: "#16a34a" },
  generic: { key: "generic", label: "Point", symbol: "•", accent: "#cbd5e1", glow: "#94a3b8" },
};

function normalized(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function categoryFromText(text: string): MapPointIconKey | null {
  if (!text) return null;
  if (
    text.includes("cycle parking") ||
    text.includes("bike parking") ||
    text.includes("parking vélo") ||
    text.includes("stationnement vélo") ||
    text.includes("arceau") ||
    text.includes("bike_lane_sensor") ||
    text.includes("bike_station")
  ) return "cycleParking";
  if (
    text.includes("sensor") ||
    text.includes("camera") ||
    text.includes("counter") ||
    text.includes("telemetry") ||
    text.includes("bike_lane_sensor")
  ) {
    return text.includes("cycle") || text.includes("bike") || text.includes("vélo")
      ? "cycleParking"
      : "sensor";
  }
  if (
    text.includes("charging") ||
    text.includes("charge") ||
    text.includes("recharge") ||
    text.includes("borne") ||
    text.includes("air_quality_sensor")
  ) {
    return text.includes("cycle") || text.includes("bike") || text.includes("vélo")
      ? "cycleParking"
      : "charging";
  }
  if (
    text.includes("shared") ||
    text.includes("scooter") ||
    text.includes("bike share") ||
    text.includes("mobility") ||
    text.includes("park_and_ride") ||
    text.includes("parking_station")
  ) return "sharedMobility";
  if (
    text.includes("pedestrian") ||
    text.includes("walk") ||
    text.includes("foot") ||
    text.includes("piéton") ||
    text.includes("pieton") ||
    text.includes("crossing") ||
    text.includes("traffic signal")
  ) return "pedestrian";
  if (text.includes("access")) return "accessibility";
  if (text.includes("parking")) return "parking";
  return null;
}

export function resolveMapPointIconSpec(input: {
  facilityCategory?: unknown;
  category?: unknown;
  datasetKind?: unknown;
  type?: unknown;
  kind?: unknown;
}): MapPointIconSpec {
  const fields = [
    normalized(input.facilityCategory),
    normalized(input.category),
    normalized(input.datasetKind),
    normalized(input.type),
    normalized(input.kind),
  ];
  for (const field of fields) {
    try {
      const key = categoryFromText(field);
      if (key) return ICON_SPEC[key];
    } catch {
      /* degrade safely */
    }
  }
  return ICON_SPEC.generic;
}
