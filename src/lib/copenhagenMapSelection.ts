import {
  getLocationById,
  inferOtcWorkbookKey,
  type CopenhagenLocation,
} from "@/data/copenhagenLocationRegistry";

export const CPH_LOCATION_PREFIX = "loc:";
export const CPH_SITE_PREFIX = "site:";

export function copenhagenLocationSegmentId(locationId: string): string {
  return `${CPH_LOCATION_PREFIX}${locationId}`;
}

export function copenhagenSiteSegmentId(workbookKey: string): string {
  return `${CPH_SITE_PREFIX}${workbookKey}`;
}

export function parseCopenhagenMapSelection(segmentId: string | null | undefined): {
  kind: "location" | "site" | "direction" | null;
  locationId?: string;
  workbookKey?: string;
  directionSegmentId?: string;
} {
  if (!segmentId) return { kind: null };
  if (segmentId.startsWith(CPH_LOCATION_PREFIX)) {
    return {
      kind: "location",
      locationId: segmentId.slice(CPH_LOCATION_PREFIX.length),
    };
  }
  if (segmentId.startsWith(CPH_SITE_PREFIX)) {
    return {
      kind: "site",
      workbookKey: segmentId.slice(CPH_SITE_PREFIX.length),
    };
  }
  return { kind: "direction", directionSegmentId: segmentId };
}

export function getCopenhagenLocationFromSelection(
  segmentId: string | null | undefined
): CopenhagenLocation | undefined {
  const parsed = parseCopenhagenMapSelection(segmentId);
  if (parsed.kind === "location" && parsed.locationId) {
    return getLocationById(parsed.locationId);
  }
  return undefined;
}

export function directionMatchesSiteSelection(
  directionSegmentId: string,
  siteName: string,
  selectedSegmentId: string | null | undefined
): boolean {
  if (!selectedSegmentId) return true;
  if (selectedSegmentId === directionSegmentId) return true;
  const parsed = parseCopenhagenMapSelection(selectedSegmentId);
  if (parsed.kind === "site" && parsed.workbookKey) {
    return inferOtcWorkbookKey(siteName) === parsed.workbookKey;
  }
  if (parsed.kind === "location" && parsed.locationId) {
    const loc = getLocationById(parsed.locationId);
    if (loc?.otcWorkbookKey) {
      return inferOtcWorkbookKey(siteName) === loc.otcWorkbookKey;
    }
  }
  return false;
}

/** True when map/pilot context is Copenhagen (camera-directional geometry). */
export function isCopenhagenObservatoryContext(
  city: string,
  pilotId?: string | null
): boolean {
  if (pilotId?.startsWith("cph-")) return true;
  return city.toLowerCase().includes("copenhagen");
}
