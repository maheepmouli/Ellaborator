export type IssyWorkbookModeKey =
  | "motorcycles"
  | "buses"
  | "trucks"
  | "pedestrians"
  | "scooters"
  | "cyclists"
  | "cars"
  | "lcv";

export type IssyModeRecord = Partial<Record<IssyWorkbookModeKey, number>>;

export interface IssyWinticsTimeBand {
  id: string;
  label: string;
  meanSpeedKmh: number | null;
  p85SpeedKmh: number | null;
  trafficFlowPerHour: IssyModeRecord;
  modalSharePct: IssyModeRecord;
}

export interface IssyWinticsBaselineSnapshot {
  generatedAt: string;
  sourceFile: string;
  datasetId: string;
  locationLabel: string;
  period: string;
  notes: string[];
  overall: {
    meanSpeedKmh: number | null;
    p85SpeedKmh: number | null;
    trafficFlowPerHour: IssyModeRecord;
    modalSharePct: IssyModeRecord;
  };
  timeBands: IssyWinticsTimeBand[];
}

export interface IssyClasseurEmissionsSnapshot {
  generatedAt: string;
  sourceFile: string;
  datasetId: string;
  modelLabel: string;
  corridorLengthKm: number;
  corridorLengthM: number;
  trafficFlowPerHour: IssyModeRecord;
  emissionFactorsGCo2PerVkm: IssyModeRecord;
  emissionsGCo2PerHour: IssyModeRecord;
  totalBaselineCo2G: number;
  fleetMix: Record<string, Record<string, number>>;
  notes: string[];
}
