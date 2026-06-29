export interface SharepointDataset {
  city: string;
  sourceFolder: string;
  fileCount: number;
  sampleFile: string;
  manifestProbe?: string;
}

export const SHAREPOINT_CITY_DATASETS: SharepointDataset[] = [
  {
    city: "Copenhagen",
    sourceFolder: "/sharepoint-data/Copenhagen",
    fileCount: 4,
    sampleFile:
      "/sharepoint-data/Copenhagen/OpenTrafficCam Counts 2024 and 2025/Countings_Norreport_sortet.xlsx",
    manifestProbe: "/sharepoint-data/_manifest.json",
  },
  {
    city: "Helsinki",
    sourceFolder: "/sharepoint-data/Helsinki",
    fileCount: 5,
    sampleFile: "/sharepoint-data/Helsinki/Telraam/raw-data-9000007091-16eb11c.xlsx",
    manifestProbe: "/sharepoint-data/_manifest.json",
  },
  {
    city: "Issy",
    sourceFolder:
      "/public/data/issy (bundled); full mirror at /sharepoint-data/Issy-20260427T130625Z-3-001/Issy",
    fileCount: 4,
    sampleFile: "/data/issy/ISSY1_post_intervention_traffic_data_november_2025.csv",
  },
  {
    city: "Milan",
    sourceFolder: "/sharepoint-data/Milan",
    fileCount: 175,
    sampleFile:
      "/sharepoint-data/Milan/8. Data - accessibility features/Milan_Accessibility_Features_DSS_Analysis_CIRCE.xlsx",
  },
  {
    city: "Zaragoza",
    sourceFolder: "/sharepoint-data/Zaragoza",
    fileCount: 11,
    sampleFile:
      "/sharepoint-data/Zaragoza/3. Mobility (KPI1.2) assessment/KPI1.2-AYZG1-before.xlsx",
    manifestProbe: "/sharepoint-data/_manifest.json",
  },
  {
    city: "Trikala",
    sourceFolder: "/sharepoint-data/Trikala",
    fileCount: 2,
    sampleFile:
      "/sharepoint-data/Trikala/baseline data of the smart crossing on line survey_english.xlsx",
    manifestProbe: "/sharepoint-data/_manifest.json",
  },
];

export interface SharepointManifestFile {
  label?: string;
  sourceZip?: string;
  sourceMember?: string;
  dest?: string;
  publicPath?: string;
  bytes?: number;
  status?: string;
}

export interface SharepointManifestFull {
  generatedAt?: string;
  sourceDrop?: string;
  files: SharepointManifestFile[];
  errors: Array<{ label?: string; error?: string }>;
}

export interface SharepointManifestSummary {
  generatedAt?: string;
  extracted?: number;
  errors?: number;
}

export async function fetchSharepointManifestFull(): Promise<SharepointManifestFull | null> {
  try {
    const response = await fetch("/sharepoint-data/_manifest.json");
    if (!response.ok) return null;
    const manifest = (await response.json()) as SharepointManifestFull;
    return {
      generatedAt: manifest.generatedAt,
      sourceDrop: manifest.sourceDrop,
      files: manifest.files ?? [],
      errors: manifest.errors ?? [],
    };
  } catch {
    return null;
  }
}

export async function fetchSharepointManifest(): Promise<SharepointManifestSummary | null> {
  const manifest = await fetchSharepointManifestFull();
  if (!manifest) return null;
  return {
    generatedAt: manifest.generatedAt,
    extracted: manifest.files.length,
    errors: manifest.errors.length,
  };
}
