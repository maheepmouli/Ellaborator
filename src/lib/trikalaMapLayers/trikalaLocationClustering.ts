import type { TrikalaLocation } from "@/data/trikalaLocationRegistry";

/** Strip trailing " 1", " 2", … so paired sensors render as one map point. */
export function trikalaSensorGroupKey(name: string): string {
  return name.replace(/\s+\d+$/u, "").trim();
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Merge numbered bike-lane sensor duplicates (e.g. ΒΟΥΒΗΣ 1 + 2, GiSeMi 1–4)
 * into a single centroid marker per corridor cluster.
 */
export function clusterTrikalaBikeLaneSensors(locations: TrikalaLocation[]): TrikalaLocation[] {
  const others: TrikalaLocation[] = [];
  const sensorGroups = new Map<string, TrikalaLocation[]>();

  locations.forEach((loc) => {
    if (loc.kind !== "bike_lane_sensor") {
      others.push(loc);
      return;
    }
    const key = trikalaSensorGroupKey(loc.name);
    const bucket = sensorGroups.get(key) ?? [];
    bucket.push(loc);
    sensorGroups.set(key, bucket);
  });

  const mergedSensors: TrikalaLocation[] = [];
  sensorGroups.forEach((group, groupName) => {
    if (group.length === 1) {
      mergedSensors.push(group[0]);
      return;
    }
    const lead = group[0];
    mergedSensors.push({
      ...lead,
      id: `${lead.id}-cluster`,
      name: groupName,
      lat: average(group.map((loc) => loc.lat)),
      lng: average(group.map((loc) => loc.lng)),
    });
  });

  return [...others, ...mergedSensors];
}
