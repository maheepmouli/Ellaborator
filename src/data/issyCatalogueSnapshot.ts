export interface IssyCatalogueFile {
  id: string;
  file: string;
  title: string;
  format: string;
  integrationStatus: string;
  pilotIds: string[];
  linkedKpis: string[];
  sheets: string[];
  notes?: string;
  publicPath: string | null;
  parserStatus?: string;
  geometry?: string;
}

export interface IssyDataReadinessRow {
  theme: string;
  kpi: string;
  dataRequired: string;
  pilot1Data: string | null;
  pilot1Status: string | null;
  pilot2Data: string | null;
  pilot2Status: string | null;
  pilot3Data: string | null;
  pilot3Status: string | null;
}

export interface IssyKpi31ZeroEmission {
  sharePointFile: boolean;
  requirementsStatus: string;
  runtimeSource: string;
  runtimeSourceLabel: string;
  primaryPilot: string;
  notes: string;
}

export interface IssyCatalogueSnapshot {
  generatedAt: string;
  sourceDrop: string;
  zipFileCount: number;
  extractedFileCount: number;
  dataReadinessMatrix: IssyDataReadinessRow[];
  files: IssyCatalogueFile[];
  kpi31ZeroEmission?: IssyKpi31ZeroEmission;
  gaps: string[];
}

const BUNDLE_PATH = "/data/issy/catalogue-snapshot.json";

let cache: IssyCatalogueSnapshot | null = null;

export async function loadIssyCatalogueSnapshot(): Promise<IssyCatalogueSnapshot | null> {
  if (cache) return cache;
  try {
    const res = await fetch(BUNDLE_PATH);
    if (!res.ok) return null;
    cache = (await res.json()) as IssyCatalogueSnapshot;
    return cache;
  } catch {
    return null;
  }
}

export function statusBadgeClass(status: string | null | undefined): string {
  const s = (status ?? "").toLowerCase();
  if (s === "completed") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
  if (s === "in progress") return "bg-amber-500/15 text-amber-300 border-amber-500/30";
  if (s === "not started" || s === "?" || !s) return "bg-white/5 text-white/45 border-white/10";
  return "bg-white/8 text-white/60 border-white/15";
}
