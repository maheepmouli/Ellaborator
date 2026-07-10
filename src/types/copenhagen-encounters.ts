export interface CopenhagenNearEncounterRecord {
  id: string;
  siteId: string;
  siteName: string;
  lat: number;
  lon: number;
  pilotId: "cph-p3";
  period: "pre" | "post";
  encounterCount: number;
  exposureBins?: number;
  sourceKind: "partner" | "proxy";
  method: string;
}

export interface CopenhagenNearEncountersSnapshot {
  generatedAt: string;
  sourceFiles: string[];
  records: CopenhagenNearEncounterRecord[];
  notes: string[];
}
