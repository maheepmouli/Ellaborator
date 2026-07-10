import type { CopenhagenNearEncountersSnapshot } from "@/types/copenhagen-encounters";

const SNAPSHOT_URL = "/data/copenhagen/near-encounters-snapshot.json";

let cache: CopenhagenNearEncountersSnapshot | null = null;
let loadPromise: Promise<CopenhagenNearEncountersSnapshot | null> | null = null;

export async function loadCopenhagenNearEncountersSnapshot(): Promise<CopenhagenNearEncountersSnapshot | null> {
  if (cache) return cache;
  if (loadPromise) return loadPromise;
  loadPromise = fetch(SNAPSHOT_URL)
    .then((res) => (res.ok ? res.json() : null))
    .then((data: CopenhagenNearEncountersSnapshot | null) => {
      cache = data;
      return data;
    })
    .catch(() => null);
  return loadPromise;
}

export function clearCopenhagenEncounterSnapshotCache(): void {
  cache = null;
  loadPromise = null;
}
