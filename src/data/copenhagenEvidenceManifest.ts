export type CopenhagenEvidenceType = "image" | "pdf" | "narrative";

export interface CopenhagenEvidenceFallback {
  type: "narrative";
  text: string;
}

export interface CopenhagenEvidenceEntry {
  id: string;
  pilotId: "cph-p1" | "cph-p2" | "cph-p3";
  title: string;
  type: CopenhagenEvidenceType;
  path?: string;
  linkedDatasetIds: string[];
  linkedMethods: string[];
  caption?: string;
  fallback?: CopenhagenEvidenceFallback;
}

const BUNDLE_BASE = "/data/copenhagen";

let manifestCache: CopenhagenEvidenceEntry[] | null = null;

export async function loadCopenhagenEvidenceManifest(): Promise<CopenhagenEvidenceEntry[]> {
  if (manifestCache) return manifestCache;
  try {
    const res = await fetch(`${BUNDLE_BASE}/evidence-manifest.json`);
    if (!res.ok) return [];
    const data = (await res.json()) as CopenhagenEvidenceEntry[];
    manifestCache = data;
    return data;
  } catch {
    return [];
  }
}

export function filterEvidenceByPilot(
  entries: CopenhagenEvidenceEntry[],
  pilotId: string | null | undefined
): CopenhagenEvidenceEntry[] {
  if (!pilotId?.startsWith("cph-")) return entries;
  return entries.filter((e) => e.pilotId === pilotId);
}
