export type IssyPeriod = "baseline" | "post_intervention";
export type IssyDayCategory = "weekday" | "weekend";

export interface IssyTrafficRecord {
  cityId: "issy";
  interventionId: "issy1";
  period: IssyPeriod;
  vehicleCategory: string;
  zoneIn: number;
  zoneOut: number;
  hour: number;
  dayCategory: IssyDayCategory;
  avgTraffic: number;
  sourceFile: string;
  type: "observed";
}

export interface IssyFlowFeature {
  fromZone: number;
  toZone: number;
  vehicleCategory: string;
  baselineValue: number;
  interventionValue: number;
  change: number;
  changePercent: number;
}

export interface IssyZoneCentroid {
  zone: number;
  lat: number;
  lon: number;
  label: string;
  placeholder: true;
}

const BASELINE_CSV_PATH =
  "/sharepoint-data/Issy-20260427T130625Z-3-001/Issy/1. BASELINE DATA from Issy/ISSY1 - detailed traffic data/ISSY1_baseline_traffic_data_november_2024.csv";
const POST_CSV_PATH =
  "/sharepoint-data/Issy-20260427T130625Z-3-001/Issy/2. POST IMPLEMENTATION DATA from Issy/ISSY1 - detailed traffic_data/ISSY1_post_intervention_traffic_data_november_2025.csv";

const recordCache = new Map<string, IssyTrafficRecord[]>();
const flowCache = new Map<string, IssyFlowFeature[]>();

// Placeholder zone centroids around Issy-les-Moulineaux
const ISSY_ZONE_CENTROIDS: Record<number, IssyZoneCentroid> = {
  1: { zone: 1, lat: 48.8335, lon: 2.2555, label: "NW Issy", placeholder: true },
  2: { zone: 2, lat: 48.8332, lon: 2.277, label: "NE Issy", placeholder: true },
  3: { zone: 3, lat: 48.8247, lon: 2.27, label: "Central Issy", placeholder: true },
  4: { zone: 4, lat: 48.8165, lon: 2.269, label: "South Issy", placeholder: true },
  5: { zone: 5, lat: 48.8215, lon: 2.255, label: "SW Issy", placeholder: true },
  6: { zone: 6, lat: 48.8285, lon: 2.286, label: "SE Issy", placeholder: true },
};

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(",");
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header || `column_${index}`] = (values[index] || "").trim();
    });
    return row;
  });
}

function toNumber(value: string | undefined): number {
  if (!value) return 0;
  const parsed = Number.parseFloat(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

async function loadRecords(period: IssyPeriod): Promise<IssyTrafficRecord[]> {
  const key = `records-${period}`;
  const cached = recordCache.get(key);
  if (cached) return cached;

  const sourceFile = period === "baseline" ? BASELINE_CSV_PATH : POST_CSV_PATH;
  const response = await fetch(encodeURI(sourceFile));
  if (!response.ok) return [];
  const rows = parseCsv(await response.text());

  const records = rows
    .map((row) => {
      const day = (row.day_category || "").toLowerCase();
      const dayCategory: IssyDayCategory = day === "weekend" ? "weekend" : "weekday";
      return {
        cityId: "issy" as const,
        interventionId: "issy1" as const,
        period,
        vehicleCategory: (row.vehicle_category || "unknown").toLowerCase(),
        zoneIn: Math.round(toNumber(row.zone_in)),
        zoneOut: Math.round(toNumber(row.zone_out)),
        hour: Math.round(toNumber(row.hour)),
        dayCategory,
        avgTraffic: toNumber(row.avg_traffic),
        sourceFile,
        type: "observed" as const,
      };
    })
    .filter((r) => r.zoneIn > 0 && r.zoneOut > 0 && r.hour >= 0 && r.hour <= 23);

  recordCache.set(key, records);
  return records;
}

function aggregateFlows(records: IssyTrafficRecord[], dayCategory: "all" | IssyDayCategory): Map<string, number> {
  const map = new Map<string, number>();
  records.forEach((record) => {
    if (dayCategory !== "all" && record.dayCategory !== dayCategory) return;
    const key = `${record.zoneIn}-${record.zoneOut}-${record.vehicleCategory}`;
    const current = map.get(key) || 0;
    map.set(key, current + record.avgTraffic);
  });
  return map;
}

export async function getIssyFlowFeatures(dayCategory: "all" | IssyDayCategory = "all"): Promise<IssyFlowFeature[]> {
  const cacheKey = `flows-${dayCategory}`;
  const cached = flowCache.get(cacheKey);
  if (cached) return cached;

  const [baseline, post] = await Promise.all([loadRecords("baseline"), loadRecords("post_intervention")]);
  const baselineAgg = aggregateFlows(baseline, dayCategory);
  const postAgg = aggregateFlows(post, dayCategory);

  const keys = new Set<string>([...baselineAgg.keys(), ...postAgg.keys()]);
  const features: IssyFlowFeature[] = [];

  keys.forEach((key) => {
    const [fromRaw, toRaw, vehicleCategory] = key.split("-");
    const baselineValue = baselineAgg.get(key) || 0;
    const interventionValue = postAgg.get(key) || 0;
    const change = interventionValue - baselineValue;
    const changePercent = baselineValue > 0 ? (change / baselineValue) * 100 : interventionValue > 0 ? 100 : 0;
    features.push({
      fromZone: Number.parseInt(fromRaw, 10),
      toZone: Number.parseInt(toRaw, 10),
      vehicleCategory,
      baselineValue,
      interventionValue,
      change,
      changePercent,
    });
  });

  flowCache.set(cacheKey, features);
  return features;
}

export function getIssyZoneCentroids(): IssyZoneCentroid[] {
  return Object.values(ISSY_ZONE_CENTROIDS);
}

export function getIssyZoneCentroid(zone: number): IssyZoneCentroid | null {
  return ISSY_ZONE_CENTROIDS[zone] || null;
}
