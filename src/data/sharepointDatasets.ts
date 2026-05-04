export interface SharepointDataset {
  city: string;
  sourceFolder: string;
  fileCount: number;
  sampleFile: string;
}

export const SHAREPOINT_CITY_DATASETS: SharepointDataset[] = [
  {
    city: "Copenhagen",
    sourceFolder: "/sharepoint-data/Copenhagen",
    fileCount: 7,
    sampleFile:
      "/sharepoint-data/Copenhagen/OpenTrafficCam Counts 2024 and 2025/OTC Combined counts ELABORATOR.xlsx",
  },
  {
    city: "Helsinki",
    sourceFolder: "/sharepoint-data/Helsinki",
    fileCount: 3,
    sampleFile: "/sharepoint-data/Helsinki/Telraam/raw-data-9000007091-16eb11c.xlsx",
  },
  {
    city: "Issy",
    sourceFolder: "/sharepoint-data/Issy-20260427T130625Z-3-001/Issy",
    fileCount: 14,
    sampleFile:
      "/sharepoint-data/Issy-20260427T130625Z-3-001/Issy/2. POST IMPLEMENTATION DATA from Issy/ISSY1 - detailed traffic_data/ISSY1_post_intervention_traffic_data_november_2025.csv",
  },
  {
    city: "Milan",
    sourceFolder: "/sharepoint-data/Milan",
    fileCount: 175,
    sampleFile:
      "/sharepoint-data/Milan/8. Data - accessibility features/Milan_Accessibility_Features_DSS_Analysis_CIRCE.xlsx",
  },
];
