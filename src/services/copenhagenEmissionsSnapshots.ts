import type { CopenhagenEmissionsSnapshot } from "@/types/copenhagen-emissions";

const SNAPSHOT_URL = "/data/copenhagen/emissions-snapshot.json";

let cache: CopenhagenEmissionsSnapshot | null = null;
let loadPromise: Promise<CopenhagenEmissionsSnapshot | null> | null = null;

export async function loadCopenhagenEmissionsSnapshot(): Promise<CopenhagenEmissionsSnapshot | null> {
  if (cache) return cache;
  if (loadPromise) return loadPromise;
  loadPromise = fetch(SNAPSHOT_URL)
    .then((res) => (res.ok ? res.json() : null))
    .then((data: CopenhagenEmissionsSnapshot | null) => {
      cache = data;
      return data;
    })
    .catch(() => null);
  return loadPromise;
}

export function clearCopenhagenEmissionsSnapshotCache(): void {
  cache = null;
  loadPromise = null;
}
