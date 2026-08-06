/** Partner-restricted Zaragoza access (client gate for UI + visuals). */

export const ZARAGOZA_PASSWORD = "ElaboratorDataVisTool";

const STORAGE_KEY = "elaborator-zaragoza-unlocked";
export const ZARAGOZA_UNLOCK_EVENT = "elaborator-zaragoza-unlock";

export function isZaragozaCityName(city: string | null | undefined): boolean {
  return (city ?? "").toLowerCase().includes("zaragoza");
}

export function isZaragozaPilotId(pilotId: string | null | undefined): boolean {
  const id = (pilotId ?? "").toLowerCase();
  return id.startsWith("zar-") || id.includes("zaragoza");
}

export function isZaragozaUnlocked(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function unlockZaragoza(): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* ignore quota / private mode */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ZARAGOZA_UNLOCK_EVENT));
  }
}

export function verifyZaragozaPassword(password: string): boolean {
  return password === ZARAGOZA_PASSWORD;
}

/** Whether Zaragoza city/pilot content may be shown. */
export function canViewZaragoza(): boolean {
  return isZaragozaUnlocked();
}

export function filterOutZaragozaCities<T extends string>(cities: readonly T[]): T[] {
  if (canViewZaragoza()) return [...cities];
  return cities.filter((c) => !isZaragozaCityName(c));
}
