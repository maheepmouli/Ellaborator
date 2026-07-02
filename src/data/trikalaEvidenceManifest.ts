import { buildTrikalaInsightBlocks } from "@/data/trikalaSurveyInsights";
import { getTrikalaSegmentInsights } from "@/services/trikalaSurveyParser";

export type TrikalaEvidenceType = "image" | "pdf" | "narrative" | "insight";

export interface TrikalaEvidenceFallback {
  type: "narrative";
  text: string;
}

export interface TrikalaEvidenceEntry {
  id: string;
  pilotId: "tri-p1";
  title: string;
  type: TrikalaEvidenceType;
  path?: string;
  metric?: string;
  linkedDatasetIds: string[];
  linkedMethods: string[];
  caption?: string;
  fallback?: TrikalaEvidenceFallback;
}

const BUNDLE_BASE = "/data/trikala";

let manifestCache: TrikalaEvidenceEntry[] | null = null;

function insightBlocksToEntries(
  blocks: ReturnType<typeof buildTrikalaInsightBlocks>
): TrikalaEvidenceEntry[] {
  return blocks.map((block) => ({
    id: `insight-${block.id}`,
    pilotId: "tri-p1" as const,
    title: block.title,
    type: "insight" as const,
    metric: block.metric,
    linkedDatasetIds: block.sourceDatasetIds,
    linkedMethods: ["Survey aggregation", block.segment ?? "all"],
    fallback: {
      type: "narrative" as const,
      text: block.narrative,
    },
    caption: block.narrative,
  }));
}

export async function loadTrikalaEvidenceManifest(): Promise<TrikalaEvidenceEntry[]> {
  if (manifestCache) return manifestCache;

  let staticEntries: TrikalaEvidenceEntry[] = [];
  try {
    const res = await fetch(`${BUNDLE_BASE}/evidence-manifest.json`);
    if (res.ok) {
      staticEntries = (await res.json()) as TrikalaEvidenceEntry[];
    }
  } catch {
    staticEntries = [];
  }

  try {
    const insights = await getTrikalaSegmentInsights();
    const liveBlocks = buildTrikalaInsightBlocks(insights);
    const liveEntries = insightBlocksToEntries(liveBlocks);
    const staticIds = new Set(staticEntries.map((e) => e.id));
    const merged = [
      ...staticEntries,
      ...liveEntries.filter((e) => !staticIds.has(e.id)),
    ];
    manifestCache = merged;
    return merged;
  } catch {
    manifestCache = staticEntries;
    return staticEntries;
  }
}

export function filterTrikalaEvidenceByPilot(
  entries: TrikalaEvidenceEntry[],
  pilotId: string | null | undefined
): TrikalaEvidenceEntry[] {
  if (!pilotId?.startsWith("tri-")) return entries;
  return entries.filter((e) => e.pilotId === pilotId);
}
