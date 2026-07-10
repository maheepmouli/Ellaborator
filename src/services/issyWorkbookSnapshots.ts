import type {
  IssyClasseurEmissionsSnapshot,
  IssyWinticsBaselineSnapshot,
} from "@/types/issy-workbooks";

const SP_MIRROR = "/sharepoint-data/Issy-20260625T113904Z-3-001/Issy";

const WINTICS_URLS = [
  "/data/issy/wintics-baseline-snapshot.json",
  `${SP_MIRROR}/snapshots/wintics-baseline-snapshot.json`,
] as const;

const CLASSEUR_URLS = [
  "/data/issy/classeur-emissions-snapshot.json",
  `${SP_MIRROR}/snapshots/classeur-emissions-snapshot.json`,
] as const;

const cache = new Map<string, unknown>();

async function fetchFirstOk<T>(urls: readonly string[]): Promise<T | null> {
  for (const url of urls) {
    const cached = cache.get(url);
    if (cached) return cached as T;
    try {
      const response = await fetch(encodeURI(url));
      if (!response.ok) continue;
      const data = (await response.json()) as T;
      cache.set(url, data);
      return data;
    } catch {
      /* try next mirror */
    }
  }
  return null;
}

export async function loadIssyWinticsBaselineSnapshot(): Promise<IssyWinticsBaselineSnapshot | null> {
  return fetchFirstOk<IssyWinticsBaselineSnapshot>(WINTICS_URLS);
}

export async function loadIssyClasseurEmissionsSnapshot(): Promise<IssyClasseurEmissionsSnapshot | null> {
  return fetchFirstOk<IssyClasseurEmissionsSnapshot>(CLASSEUR_URLS);
}

export function clearIssyWorkbookSnapshotCache(): void {
  for (const url of [...WINTICS_URLS, ...CLASSEUR_URLS]) {
    cache.delete(url);
  }
}
