/** Fixed street-level zoom for Trikala survey canvas (Asklipiou × Stratigou Sarafi). */
export const TRIKALA_LOCKED_MAP_ZOOM = 17;

export const TRIKALA_MAP_ANCHOR = { lat: 39.555, lng: 21.767 } as const;

export function isTrikalaCityName(city: string | null | undefined): boolean {
  return !!city?.toLowerCase().includes("trikala");
}

export function isTrikalaPilotId(pilotId: string | null | undefined): boolean {
  return pilotId?.startsWith("tri-") ?? false;
}

export function trikalaMapZoom(): number {
  return TRIKALA_LOCKED_MAP_ZOOM;
}
