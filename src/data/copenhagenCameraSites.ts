import type { CopenhagenPilotId } from "@/data/copenhagenLocationRegistry";
import {
  getCopenhagenPilotLatLngBounds,
  getCopenhagenPilotMapFocusFromRegistry,
  getCopenhagenPilotZoneAnchorFromRegistry,
  getLocationsForPilot,
  getOtcWorkbookKeysForPilot,
  inferOtcWorkbookKey,
} from "@/data/copenhagenLocationRegistry";

export type { CopenhagenPilotId } from "@/data/copenhagenLocationRegistry";

/** @deprecated Use CopenhagenLocation from copenhagenLocationRegistry. Kept for backward compatibility. */
export type CopenhagenCameraSite = {
  id: string;
  siteName: string;
  lat: number;
  lon: number;
  pilotId: CopenhagenPilotId;
};

export const COPENHAGEN_CAMERA_KPIS = new Set([
  "kpi1.1",
  "kpi1.2",
  "kpi2.1",
  "kpi3.1",
  "kpi3.2",
  "kpi4.1",
  "kpi4.2",
]);

export function isCopenhagenCameraKpi(kpiId: string): boolean {
  return COPENHAGEN_CAMERA_KPIS.has(kpiId);
}

/** OTC workbook sites visible for the selected pilot (legacy shape). */
export function getCopenhagenSitesForPilot(pilotId: string): CopenhagenCameraSite[] {
  return getLocationsForPilot(pilotId)
    .filter((loc) => loc.otcWorkbookKey)
    .map((loc) => ({
      id: loc.otcWorkbookKey!,
      siteName: loc.name,
      lat: loc.lat,
      lon: loc.lon,
      pilotId: pilotId as CopenhagenPilotId,
    }));
}

/** Workbook keys in pilot scope — used to filter OTC rows and street corridors. */
export function getCopenhagenCameraIdsForPilot(
  pilotId: string | null | undefined
): Set<string> | null {
  if (!pilotId?.startsWith("cph-")) return null;
  return getOtcWorkbookKeysForPilot(pilotId);
}

export function getCopenhagenPilotMapFocus(
  pilotId: string
): { lat: number; lon: number; zoom: number } | null {
  return getCopenhagenPilotMapFocusFromRegistry(pilotId);
}

export { getCopenhagenPilotLatLngBounds };

export function getCopenhagenPilotZoneAnchor(pilotId: string): {
  lat: number;
  lon: number;
  radiusDeg: number;
} | null {
  return getCopenhagenPilotZoneAnchorFromRegistry(pilotId);
}

export { getLocationsForPilot, inferOtcWorkbookKey };
