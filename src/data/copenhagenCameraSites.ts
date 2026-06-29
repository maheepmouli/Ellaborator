export type CopenhagenPilotId = "cph-p1" | "cph-p2" | "cph-p3";

export type CopenhagenCameraSite = {
  id: string;
  siteName: string;
  lat: number;
  lon: number;
  pilotId: CopenhagenPilotId;
};

/** Observed OpenTrafficCam camera coordinates (SharePoint Overview sheets / bundled JSON). */
export const COPENHAGEN_CAMERA_SITES: CopenhagenCameraSite[] = [
  {
    id: "norreport",
    siteName: "Norregade / Nørre Voldgade",
    lat: 55.682312,
    lon: 12.570922,
    pilotId: "cph-p1",
  },
  {
    id: "vandkunsten",
    siteName: "Vandkunsten / Rådhusstræde",
    lat: 55.677575,
    lon: 12.579961,
    pilotId: "cph-p2",
  },
  {
    id: "gammeltorv",
    siteName: "Gammeltorv / Vestergade",
    lat: 55.678437,
    lon: 12.572236,
    pilotId: "cph-p3",
  },
  {
    id: "stormgade",
    siteName: "Frederiksholmskanal / Stormgade",
    lat: 55.675535,
    lon: 12.575545,
    pilotId: "cph-p3",
  },
];

export const COPENHAGEN_CAMERA_KPIS = new Set(["kpi1.2", "kpi2.1", "kpi3.2"]);

export function isCopenhagenCameraKpi(kpiId: string): boolean {
  return COPENHAGEN_CAMERA_KPIS.has(kpiId);
}

export function getCopenhagenSitesForPilot(pilotId: string): CopenhagenCameraSite[] {
  return COPENHAGEN_CAMERA_SITES.filter((site) => site.pilotId === pilotId);
}

export function getCopenhagenCameraIdsForPilot(pilotId: string | null | undefined): Set<string> | null {
  if (!pilotId?.startsWith("cph-")) return null;
  return new Set(getCopenhagenSitesForPilot(pilotId).map((site) => site.id));
}

export function getCopenhagenPilotMapFocus(
  pilotId: string
): { lat: number; lon: number; zoom: number } | null {
  const sites = getCopenhagenSitesForPilot(pilotId);
  if (!sites.length) return null;
  const lat = sites.reduce((sum, site) => sum + site.lat, 0) / sites.length;
  const lon = sites.reduce((sum, site) => sum + site.lon, 0) / sites.length;
  return { lat, lon, zoom: sites.length > 1 ? 16 : 17 };
}

export function getCopenhagenPilotZoneAnchor(pilotId: string): {
  lat: number;
  lon: number;
  radiusDeg: number;
} | null {
  const sites = getCopenhagenSitesForPilot(pilotId);
  if (!sites.length) return null;
  const lat = sites.reduce((sum, site) => sum + site.lat, 0) / sites.length;
  const lon = sites.reduce((sum, site) => sum + site.lon, 0) / sites.length;
  const maxDist = sites.reduce((max, site) => {
    const dLat = site.lat - lat;
    const dLon = site.lon - lon;
    return Math.max(max, Math.sqrt(dLat * dLat + dLon * dLon));
  }, 0);
  return {
    lat,
    lon,
    radiusDeg: Math.max(0.008, maxDist + 0.004),
  };
}
