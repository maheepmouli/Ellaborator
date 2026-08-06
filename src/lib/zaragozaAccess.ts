/** Partner-restricted Zaragoza access (client gate for UI + visuals).
 * Unlock is in-memory only: refresh or leaving Zaragoza locks again.
 */

export const ZARAGOZA_PASSWORD = "ElaboratorDataVisTool";

const LEGACY_STORAGE_KEY = "elaborator-zaragoza-unlocked";
export const ZARAGOZA_UNLOCK_EVENT = "elaborator-zaragoza-unlock";
export const ZARAGOZA_LOCK_EVENT = "elaborator-zaragoza-lock";

/** Ephemeral unlock — cleared on refresh and when lockZaragoza() runs. */
let zaragozaUnlockedInMemory = false;

function clearLegacyStorage(): void {
  try {
    sessionStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

clearLegacyStorage();

export function isZaragozaCityName(city: string | null | undefined): boolean {
  return (city ?? "").toLowerCase().includes("zaragoza");
}

export function isZaragozaPilotId(pilotId: string | null | undefined): boolean {
  const id = (pilotId ?? "").toLowerCase();
  return id.startsWith("zar-") || id.includes("zaragoza");
}

export function isZaragozaUnlocked(): boolean {
  return zaragozaUnlockedInMemory;
}

export function unlockZaragoza(): void {
  zaragozaUnlockedInMemory = true;
  clearLegacyStorage();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ZARAGOZA_UNLOCK_EVENT));
  }
}

/** Re-lock Zaragoza (e.g. after leaving the city or ending the view). */
export function lockZaragoza(): void {
  if (!zaragozaUnlockedInMemory) return;
  zaragozaUnlockedInMemory = false;
  clearLegacyStorage();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ZARAGOZA_LOCK_EVENT));
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
