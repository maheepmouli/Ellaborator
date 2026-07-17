import type { MilanPilotId } from "@/data/milanPilotProfiles";

/** Observed AMAT corridor / camera geography (from SharePoint build artefacts). */
export const MILAN_PILOT_ANCHORS: Record<
  MilanPilotId,
  { lat: number; lon: number; radiusDeg: number }
> = {
  "mil-p1": { lat: 45.461, lon: 9.168, radiusDeg: 0.055 },
  "mil-p2": { lat: 45.47, lon: 9.142, radiusDeg: 0.05 },
  /** Union viewport for Pilot 1 + Pilot 2 when mil-p3 is selected. */
  "mil-p3": { lat: 45.4655, lon: 9.155, radiusDeg: 0.085 },
};

export function milanMapZoom(): number {
  return 14;
}

export function isMilanCityName(city: string): boolean {
  return city.toLowerCase().includes("milan");
}
