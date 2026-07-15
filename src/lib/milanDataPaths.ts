/** SharePoint mirror paths for Milan AMAT / DSS datasets (June 2026 drop). */

export const MILAN_SHAREPOINT_ROOT = "/sharepoint-data/Milan";
export const MILAN_EX_ANTE = `${MILAN_SHAREPOINT_ROOT}/Eval data Ex ante`;

export const MILAN_ACCESSIBILITY_FILES = [
  `${MILAN_EX_ANTE}/8. Data - accessibility features/Milan_Accessibility_Features_DSS_Analysis_CIRCE.xlsx`,
  `${MILAN_SHAREPOINT_ROOT}/8. Data - accessibility features/Milan_Accessibility_Features_DSS_Analysis_CIRCE.xlsx`,
] as const;

export const MILAN_MODE_SHARE_JSON = "/data/milan/mode-share-counts.json";
export const MILAN_PILOT_CORRIDORS_JSON = "/data/milan/pilot-corridors.geojson";
export const MILAN_WALK_GRAPH_JSON = "/data/milan/walk-graph.geojson";
export const MILAN_SURVEY_JSON = "/data/milan/survey-insights.json";

export const MILAN_SPEED_SOURCES = {
  "mil-p1": {
    networkShp: `${MILAN_EX_ANTE}/4. Speed measurements/Pilot 1_Olimpic itineraries_AMAT/jobs_7882016_results_Itinerari_Olimpici_Maggio2025.shapefile/network.shp`,
    networkDbf: `${MILAN_EX_ANTE}/4. Speed measurements/Pilot 1_Olimpic itineraries_AMAT/jobs_7882016_results_Itinerari_Olimpici_Maggio2025.shapefile/network.dbf`,
    metricDbf: `${MILAN_EX_ANTE}/4. Speed measurements/Pilot 1_Olimpic itineraries_AMAT/jobs_7882016_results_Itinerari_Olimpici_Maggio2025.shapefile/Maggio 2025_0_8_00-9_00_0.dbf`,
    label: "Pilot 1 speed",
  },
  "mil-p2": {
    networkShp: `${MILAN_EX_ANTE}/4. Speed measurements/Pilot 2_west axis_AMAT/jobs_7735361_results_Asse_Ovest.shapefile/network.shp`,
    networkDbf: `${MILAN_EX_ANTE}/4. Speed measurements/Pilot 2_west axis_AMAT/jobs_7735361_results_Asse_Ovest.shapefile/network.dbf`,
    metricDbf: `${MILAN_EX_ANTE}/4. Speed measurements/Pilot 2_west axis_AMAT/jobs_7735361_results_Asse_Ovest.shapefile/Ottobre_2024_0_8_00-9_00_0.dbf`,
    label: "Pilot 2 speed",
  },
} as const;

/** Legacy flat paths (pre–Eval data Ex ante normalization). */
export const MILAN_SPEED_SOURCES_LEGACY = {
  "mil-p1": {
    networkShp: `${MILAN_SHAREPOINT_ROOT}/4. Speed measurements/Pilot 1_Olimpic itineraries_AMAT/jobs_7882016_results_Itinerari_Olimpici_Maggio2025.shapefile/network.shp`,
    networkDbf: `${MILAN_SHAREPOINT_ROOT}/4. Speed measurements/Pilot 1_Olimpic itineraries_AMAT/jobs_7882016_results_Itinerari_Olimpici_Maggio2025.shapefile/network.dbf`,
    metricDbf: `${MILAN_SHAREPOINT_ROOT}/4. Speed measurements/Pilot 1_Olimpic itineraries_AMAT/jobs_7882016_results_Itinerari_Olimpici_Maggio2025.shapefile/Maggio 2025_0_8_00-9_00_0.dbf`,
    label: "Pilot 1 speed",
  },
  "mil-p2": {
    networkShp: `${MILAN_SHAREPOINT_ROOT}/4. Speed measurements/Pilot 2_west axis_AMAT/jobs_7735361_results_Asse_Ovest.shapefile/network.shp`,
    networkDbf: `${MILAN_SHAREPOINT_ROOT}/4. Speed measurements/Pilot 2_west axis_AMAT/jobs_7735361_results_Asse_Ovest.shapefile/network.dbf`,
    metricDbf: `${MILAN_SHAREPOINT_ROOT}/4. Speed measurements/Pilot 2_west axis_AMAT/jobs_7735361_results_Asse_Ovest.shapefile/Ottobre_2024_0_8_00-9_00_0.dbf`,
    label: "Pilot 2 speed",
  },
} as const;

export const MILAN_ENVIRONMENT_SOURCES = {
  "08-09": {
    shp: `${MILAN_EX_ANTE}/6. CO2 and noise emissions/traffic_08-09_AMAT/RETE_H08_archi.shp`,
    dbf: `${MILAN_EX_ANTE}/6. CO2 and noise emissions/traffic_08-09_AMAT/RETE_H08_archi.dbf`,
    label: "08-09 AMAT",
  },
  "18-19": {
    shp: `${MILAN_EX_ANTE}/6. CO2 and noise emissions/traffic_18-19_AMAT/RETE_H18_archi.shp`,
    dbf: `${MILAN_EX_ANTE}/6. CO2 and noise emissions/traffic_18-19_AMAT/RETE_H18_archi.dbf`,
    label: "18-19 AMAT",
  },
} as const;

export const MILAN_ENVIRONMENT_SOURCES_LEGACY = {
  "08-09": {
    shp: `${MILAN_SHAREPOINT_ROOT}/6. CO2 and noise emissions/traffic_08-09_AMAT/RETE_H08_archi.shp`,
    dbf: `${MILAN_SHAREPOINT_ROOT}/6. CO2 and noise emissions/traffic_08-09_AMAT/RETE_H08_archi.dbf`,
    label: "08-09 AMAT",
  },
  "18-19": {
    shp: `${MILAN_SHAREPOINT_ROOT}/6. CO2 and noise emissions/traffic_18-19_AMAT/RETE_H18_archi.shp`,
    dbf: `${MILAN_SHAREPOINT_ROOT}/6. CO2 and noise emissions/traffic_18-19_AMAT/RETE_H18_archi.dbf`,
    label: "18-19 AMAT",
  },
} as const;

export const MILAN_CAMERA_NETWORK = {
  shp: `${MILAN_EX_ANTE}/3. Road user counts/evaluation_cameras.shp`,
  dbf: `${MILAN_EX_ANTE}/3. Road user counts/evaluation_cameras.dbf`,
} as const;

export const MILAN_CAMERA_NETWORK_LEGACY = {
  shp: `${MILAN_SHAREPOINT_ROOT}/3. Road user counts/evaluation_cameras.shp`,
  dbf: `${MILAN_SHAREPOINT_ROOT}/3. Road user counts/evaluation_cameras.dbf`,
} as const;

export const MILAN_WALK_GRAPH = {
  shp: `${MILAN_SHAREPOINT_ROOT}/DSS pedestrian tool graph/walk_graph.shp`,
  dbf: `${MILAN_SHAREPOINT_ROOT}/DSS pedestrian tool graph/walk_graph.dbf`,
  label: "DSS pedestrian walk graph",
} as const;

export const MILAN_SURVEY_ROOTS = [
  `${MILAN_EX_ANTE}/7. Survey results - Satisfaction LL`,
  `${MILAN_SHAREPOINT_ROOT}/7. Survey results - Satisfaction LL`,
] as const;

export const MILAN_EXPANSION_PLAN_FILES = [
  `${MILAN_EX_ANTE}/2. Plans to expand/Expansion_Plan_Milan.docx`,
  `${MILAN_SHAREPOINT_ROOT}/2. Plans to expand/Expansion_Plan_Milan.docx`,
] as const;

export const MILAN_PILOT_SHAPEFILES = {
  "mil-p1": {
    shp: `${MILAN_SHAREPOINT_ROOT}/1. Shape file/Pilot 1_AMAT/pilot01.shp`,
    dbf: `${MILAN_SHAREPOINT_ROOT}/1. Shape file/Pilot 1_AMAT/pilot01.dbf`,
    label: "Olympic itineraries corridor",
  },
  "mil-p2": {
    shp: `${MILAN_SHAREPOINT_ROOT}/1. Shape file/Pilot 2_AMAT/pilot02.shp`,
    dbf: `${MILAN_SHAREPOINT_ROOT}/1. Shape file/Pilot 2_AMAT/pilot02.dbf`,
    label: "West axis corridor",
  },
} as const;
