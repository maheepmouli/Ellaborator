import type { IssyPilotId } from "@/data/issyPilotProfiles";

export type IssyEvidenceType = "image" | "pdf" | "narrative";

export interface IssyEvidenceEntry {
  id: string;
  pilotId: IssyPilotId;
  title: string;
  type: IssyEvidenceType;
  path?: string;
  linkedDatasetIds: string[];
  linkedMethods: string[];
  caption?: string;
  fallback?: { type: "narrative"; text: string };
}

const BUNDLE_BASE = "/data/issy";

let manifestCache: IssyEvidenceEntry[] | null = null;

export async function loadIssyEvidenceManifest(): Promise<IssyEvidenceEntry[]> {
  if (manifestCache) return manifestCache;
  try {
    const res = await fetch(`${BUNDLE_BASE}/evidence-manifest.json`);
    if (!res.ok) return [];
    manifestCache = (await res.json()) as IssyEvidenceEntry[];
    return manifestCache;
  } catch {
    return [];
  }
}

export function filterIssyEvidenceByPilot(
  entries: IssyEvidenceEntry[],
  pilotId: string | null | undefined
): IssyEvidenceEntry[] {
  if (!pilotId?.startsWith("issy-")) return entries;
  return entries.filter((e) => e.pilotId === pilotId);
}
