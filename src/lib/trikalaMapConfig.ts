/** Default street-level zoom when flying to a Trikala pilot (user can zoom 14–19). */
export const TRIKALA_DEFAULT_MAP_ZOOM = 17;
export const TRIKALA_MIN_MAP_ZOOM = 14;
export const TRIKALA_MAX_MAP_ZOOM = 19;

/** @deprecated Use TRIKALA_DEFAULT_MAP_ZOOM */
export const TRIKALA_LOCKED_MAP_ZOOM = TRIKALA_DEFAULT_MAP_ZOOM;

/** City-level fallback anchor (junction centroid). */
export const TRIKALA_MAP_ANCHOR = { lat: 39.555, lng: 21.767 } as const;

export type TrikalaPilotId = "tri-p1" | "tri-p2" | "tri-p3";

/** Partner My Maps geodata — one anchor per ELABORATOR pilot. */
export const TRIKALA_PILOT_ANCHORS: Record<
  TrikalaPilotId,
  { lat: number; lng: number; label: string }
> = {
  "tri-p1": {
    lat: 39.5540151,
    lng: 21.7759437,
    label: "Smart crossing — Military School",
  },
  "tri-p2": {
    lat: 39.5596772,
    lng: 21.7690805,
    label: "Park & Ride stations (SMY · DEH · GiSeMi)",
  },
  "tri-p3": {
    lat: 39.5555671,
    lng: 21.765602,
    label: "Redesigned bike lanes",
  },
};

/** Partner Google My Maps — women workshop participatory route layers (ehbc dark chrome). */
export const TRIKALA_WORKSHOP_MAP_EMBED_URL =
  "https://www.google.com/maps/d/embed?mid=1ka243QkLKE2l0RjGcAtum9YF1BbgP0Y&ehbc=2E312F";

export function isTrikalaCityName(city: string | null | undefined): boolean {
  return !!city?.toLowerCase().includes("trikala");
}

export function isTrikalaPilotId(pilotId: string | null | undefined): pilotId is TrikalaPilotId {
  return pilotId === "tri-p1" || pilotId === "tri-p2" || pilotId === "tri-p3";
}

export function trikalaMapZoom(): number {
  return TRIKALA_DEFAULT_MAP_ZOOM;
}

export function getTrikalaPilotAnchor(
  pilotId: string | null | undefined
): { lat: number; lng: number } {
  if (isTrikalaPilotId(pilotId)) return TRIKALA_PILOT_ANCHORS[pilotId];
  return TRIKALA_MAP_ANCHOR;
}
