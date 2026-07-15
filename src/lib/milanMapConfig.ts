import type { MilanPilotId } from "@/data/milanPilotProfiles";

/** Observed AMAT corridor / camera geography (from SharePoint build artefacts). */
export const MILAN_PILOT_ANCHORS: Record<
  MilanPilotId,
  { lat: number; lon: number; radiusDeg: number }
> = {
  "mil-p1": { lat: 45.461, lon: 9.168, radiusDeg: 0.055 },
  "mil-p2": { lat: 45.47, lon: 9.142, radiusDeg: 0.05 },
  "mil-p3": { lat: 45.468, lon: 9.18, radiusDeg: 0.08 },
};

export function milanMapZoom(): number {
  return 14;
}

export function isMilanCityName(city: string): boolean {
  return city.toLowerCase().includes("milan");
}
