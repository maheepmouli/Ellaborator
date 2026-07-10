import type { BicycleCountingAPIResponse } from "@/types/bicycle-counting";
import type { CyclingInfrastructureAPIResponse } from "@/types/cycling-infrastructure";
import type { TrafficAPIResponse } from "@/types/traffic";
import { dedupeTrafficBySegmentId } from "@/lib/issyPilot2Junction";

const SP_MIRROR = "/sharepoint-data/Issy-20260625T113904Z-3-001/Issy";

const TRAFFIC_JUNCTION_URLS = [
  "/data/issy/traficissy-junction-snapshot.json",
  `${SP_MIRROR}/snapshots/traficissy-junction-snapshot.json`,
] as const;

const TRAFFIC_NETWORK_URLS = [
  "/data/issy/traficissy-network-snapshot.json",
  `${SP_MIRROR}/snapshots/traficissy-network-snapshot.json`,
] as const;

const CYCLING_INFRA_URLS = [
  "/data/issy/cycling-infrastructure-snapshot.json",
  `${SP_MIRROR}/snapshots/cycling-infrastructure-snapshot.json`,
] as const;

const BICYCLE_COUNTING_URLS = [
  "/data/issy/bicycle-counting-snapshot.json",
  `${SP_MIRROR}/snapshots/bicycle-counting-snapshot.json`,
] as const;

const cache = new Map<string, unknown>();

async function fetchFirstOk<T>(urls: readonly string[]): Promise<T | null> {
  for (const url of urls) {
    const key = url;
    const cached = cache.get(key);
    if (cached) return cached as T;
    try {
      const response = await fetch(encodeURI(url));
      if (!response.ok) continue;
      const data = (await response.json()) as T;
      cache.set(key, data);
      return data;
    } catch {
      /* try next mirror */
    }
  }
  return null;
}

/** Latest observation per junction arm — bundled SharePoint snapshot only. */
export async function loadIssyJunctionTrafficSnapshot(): Promise<TrafficAPIResponse> {
  const data = await fetchFirstOk<TrafficAPIResponse>(TRAFFIC_JUNCTION_URLS);
  if (!data?.results?.length) {
    return { total_count: 0, results: [] };
  }
  const results = dedupeTrafficBySegmentId(data.results);
  return { total_count: results.length, results };
}

/** City-wide segment network — deduplicated latest row per segment id. */
export async function loadIssyTrafficNetworkSnapshot(): Promise<TrafficAPIResponse> {
  const data = await fetchFirstOk<TrafficAPIResponse>(TRAFFIC_NETWORK_URLS);
  if (!data?.results?.length) {
    return loadIssyJunctionTrafficSnapshot();
  }
  const results = dedupeTrafficBySegmentId(data.results);
  return { total_count: results.length, results };
}

export async function loadIssyCyclingInfrastructureSnapshot(): Promise<CyclingInfrastructureAPIResponse> {
  const data = await fetchFirstOk<CyclingInfrastructureAPIResponse>(CYCLING_INFRA_URLS);
  return data ?? { total_count: 0, results: [] };
}

export async function loadIssyBicycleCountingSnapshot(): Promise<BicycleCountingAPIResponse> {
  const data = await fetchFirstOk<BicycleCountingAPIResponse>(BICYCLE_COUNTING_URLS);
  return data ?? { total_count: 0, results: [] };
}

export function clearIssyLocalSnapshotCache(): void {
  cache.clear();
}
