export interface CopenhagenEmissionFlowRecord {
  siteName: string;
  lat?: number;
  lon?: number;
  flow: string;
  preCo2GPerHour: number;
  postCo2GPerHour: number;
  preBreakdown: Record<string, number>;
  postBreakdown: Record<string, number>;
}

export interface CopenhagenEmissionsSnapshot {
  generatedAt: string;
  sourceFiles: string[];
  modelLabel: string;
  flows: CopenhagenEmissionFlowRecord[];
  emissionFactorsGCo2PerVehicleHour: Record<string, number>;
  notes: string[];
}
