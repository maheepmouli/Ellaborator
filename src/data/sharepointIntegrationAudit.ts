export type IntegrationStatus = "integrated" | "external" | "not_integrated";
export type RuntimeStatus =
  | "primary"
  | "bundled_preferred"
  | "partial_fallback"
  | "survey_derived"
  | "mock_registry";
export type ConfidenceLevel = "high" | "medium" | "low";
export type PipelineStageValue = "yes" | "no" | "partial" | "n/a";

export interface CityIntegrationRow {
  city: string;
  integrationStatus: IntegrationStatus;
  runtimeStatus: RuntimeStatus;
  confidence: ConfidenceLevel;
  notes: string;
}

export interface KpiSourceRow {
  city: string;
  kpi1_2: string;
  kpi2_1: string;
  kpi3_1: string;
  kpi3_2: string;
  kpi4_1: string;
  kpi4_2: string;
}

export interface DropPipelineRow {
  id: string;
  label: string;
  available: PipelineStageValue;
  extracted: PipelineStageValue;
  parsed: PipelineStageValue;
  displayed: PipelineStageValue;
  manifestLabels?: string[];
  notes?: string;
}

export interface ExtractedFileRow {
  label: string;
  publicPath: string;
  sourceZip: string;
  parser: string;
}

export const MILAN_EXTERNAL_CALLOUT =
  "Milan is not included in the June 2026 SharePoint drop. The app expects a separate public/sharepoint-data/Milan/ tree; without it, Milan uses registry mock data.";

export const INTEGRATION_COVERAGE = {
  lighthouseIntegrated: [
    "Copenhagen",
    "Helsinki",
    "Issy-les-Moulineaux",
    "Zaragoza",
    "Trikala",
  ] as const,
  lighthouseExternal: ["Milan"] as const,
  followerNotIntegrated: ["Lund", "Krusevac", "Velenje", "Liberec", "Ioannina"] as const,
  inventoryNotParsed: ["Data available in Sharepoint.xlsx"] as const,
};

export const CITY_INTEGRATION_ROWS: CityIntegrationRow[] = [
  {
    city: "Copenhagen",
    integrationStatus: "integrated",
    runtimeStatus: "primary",
    confidence: "high",
    notes: "OpenTrafficCam directional counts; bundled JSON fallback when mirror missing.",
  },
  {
    city: "Helsinki",
    integrationStatus: "integrated",
    runtimeStatus: "primary",
    confidence: "medium",
    notes: "Telraam xlsx + GeoJSON layers; segment coords often inferred.",
  },
  {
    city: "Issy-les-Moulineaux",
    integrationStatus: "integrated",
    runtimeStatus: "bundled_preferred",
    confidence: "high",
    notes: "Bundled OD CSV preferred; SharePoint mirror optional. Live traficissy API.",
  },
  {
    city: "Zaragoza",
    integrationStatus: "integrated",
    runtimeStatus: "partial_fallback",
    confidence: "medium",
    notes: "KPI1.2 workbooks often templated; manual June 2025 counts used as fallback.",
  },
  {
    city: "Trikala",
    integrationStatus: "integrated",
    runtimeStatus: "survey_derived",
    confidence: "medium",
    notes: "Likert survey aggregates at pilot anchor; Smart Citizen Kit fleet for KPI 3.2; media/docs in /data/trikala/.",
  },
  {
    city: "Milan",
    integrationStatus: "external",
    runtimeStatus: "mock_registry",
    confidence: "low",
    notes: "Requires separate SharePoint Milan tree; not in June 2026 drop.",
  },
];

export const KPI_SOURCE_MATRIX: KpiSourceRow[] = [
  {
    city: "Copenhagen",
    kpi1_2: "OTC counts",
    kpi2_1: "Flow pressure",
    kpi3_1: "—",
    kpi3_2: "Motor intensity",
    kpi4_1: "—",
    kpi4_2: "—",
  },
  {
    city: "Helsinki",
    kpi1_2: "Telraam",
    kpi2_1: "Safety proxy",
    kpi3_1: "—",
    kpi3_2: "Env proxy",
    kpi4_1: "—",
    kpi4_2: "Accessibility",
  },
  {
    city: "Issy-les-Moulineaux",
    kpi1_2: "OD CSV + API",
    kpi2_1: "traficissy",
    kpi3_1: "Facilities API",
    kpi3_2: "Corridor proxy",
    kpi4_1: "—",
    kpi4_2: "—",
  },
  {
    city: "Zaragoza",
    kpi1_2: "Manual counts",
    kpi2_1: "Manual counts",
    kpi3_1: "—",
    kpi3_2: "Proxy",
    kpi4_1: "—",
    kpi4_2: "—",
  },
  {
    city: "Trikala",
    kpi1_2: "—",
    kpi2_1: "Survey",
    kpi3_1: "—",
    kpi3_2: "Smart Citizen Kit",
    kpi4_1: "Survey",
    kpi4_2: "Survey",
  },
  {
    city: "Milan",
    kpi1_2: "Camera SHP",
    kpi2_1: "Speed segments",
    kpi3_1: "—",
    kpi3_2: "RETE bands",
    kpi4_1: "Survey fallback",
    kpi4_2: "DSS xlsx",
  },
];

export const DROP_PIPELINE_ROWS: DropPipelineRow[] = [
  {
    id: "cph-lighthouse",
    label: "Copenhagen Lighthouse zip",
    available: "yes",
    extracted: "yes",
    parsed: "yes",
    displayed: "yes",
    manifestLabels: [
      "cph-otc-norreport",
      "cph-otc-vandkunsten",
      "cph-otc-gammeltorv",
      "cph-otc-stormgade",
      "cph-otc-hojbro",
      "cph-telraam-summary",
      "cph-telraam-vestergade",
      "cph-telraam-vognmagergade",
      "cph-telraam-rosenborggade",
      "cph-telraam-studiestraede",
      "cph-manual-counts-geo",
      "cph-manual-counts-2025-bulk",
      "cph-manual-zones-2023",
      "cph-manual-zones-detail",
      "cph-parking-overview",
      "cph-parking-shapefile",
      "cph-tube-counts",
      "cph-survey-acceptability-before",
      "cph-survey-acceptability-after",
      "cph-survey-safety-perception",
      "cph-irap-counts",
      "cph-platomo-geo",
      "cph-media-gallery",
      "cph-partner-docs",
    ],
  },
  {
    id: "hel-lighthouse",
    label: "Helsinki Lighthouse zip",
    available: "yes",
    extracted: "yes",
    parsed: "yes",
    displayed: "yes",
    manifestLabels: [
      "hel-telraam-1",
      "hel-telraam-2",
      "hel-dangerous-locations-gpkg",
      "hel-escooter-nested-zip",
    ],
    notes: "GeoJSON derivatives require npm run convert-helsinki-gpkg",
  },
  {
    id: "hel-20260625",
    label: "Helsinki-20260625T113855Z zip",
    available: "yes",
    extracted: "no",
    parsed: "no",
    displayed: "no",
    notes: "Present in drop folder; not wired to extract script or parsers.",
  },
  {
    id: "issy-lighthouse",
    label: "Issy (Paris) Lighthouse zip",
    available: "yes",
    extracted: "partial",
    parsed: "yes",
    displayed: "yes",
    manifestLabels: ["issy-baseline-csv", "issy-post-csv"],
    notes: "Bundled /data/issy CSV preferred at runtime.",
  },
  {
    id: "zar-lighthouse",
    label: "Zaragoza Lighthouse zip",
    available: "yes",
    extracted: "yes",
    parsed: "partial",
    displayed: "yes",
    manifestLabels: [
      "zar-kpi12-ayzg1-before",
      "zar-kpi12-ayzg1-after",
      "zar-kpi12-ayzg2-before",
      "zar-kpi12-ayzg2-after",
      "zar-kpi12-ayzg3-before",
      "zar-kpi12-ayzg3-after",
      "zar-kpi12-ayzg4-before",
      "zar-kpi12-ayzg4-after",
      "zar-manual-counting",
      "zar-intervention-areas-zip",
      "zar-intervention-areas-shapefile",
    ],
    notes: "KPI1.2 workbooks may contain (value) placeholders.",
  },
  {
    id: "tri-lighthouse",
    label: "Trikala Lighthouse zip",
    available: "yes",
    extracted: "yes",
    parsed: "yes",
    displayed: "yes",
    manifestLabels: [
      "tri-smart-crossing-survey",
      "tri-women-mobility-survey",
      "tri-bike-lane-baseline",
      "tri-smart-crossing-post",
      "tri-bike-lane-post",
      "tri-smarta-app-post",
      "tri-environmental-sensors",
      "tri-meeting-attendance",
      "tri-media-gallery",
      "tri-docs-bundle",
    ],
    notes: "50 files in zip; 8 xlsx + 13 images + 19 PDFs + docx/pptx; Park & Ride folder empty.",
  },
  {
    id: "follower-cities",
    label: "Lund / Krusevac / Velenje / Liberec / Ioannina follower zips",
    available: "yes",
    extracted: "no",
    parsed: "no",
    displayed: "no",
  },
  {
    id: "inventory-xlsx",
    label: "Data available in Sharepoint.xlsx",
    available: "yes",
    extracted: "no",
    parsed: "no",
    displayed: "no",
    notes: "Human inventory spreadsheet only.",
  },
];

export const EXTRACTED_FILE_APPENDIX: ExtractedFileRow[] = [
  {
    label: "cph-otc-norreport",
    publicPath:
      "/sharepoint-data/Copenhagen/OpenTrafficCam Counts 2024 and 2025/Countings_Norreport_sortet.xlsx",
    sourceZip: "Copenhagen Lighthouse",
    parser: "localCityData.parseCopenhagenRecords",
  },
  {
    label: "cph-otc-vandkunsten",
    publicPath:
      "/sharepoint-data/Copenhagen/OpenTrafficCam Counts 2024 and 2025/Countings_Vandkunsten_sortet.xlsx",
    sourceZip: "Copenhagen Lighthouse",
    parser: "localCityData.parseCopenhagenRecords",
  },
  {
    label: "cph-otc-gammeltorv",
    publicPath:
      "/sharepoint-data/Copenhagen/OpenTrafficCam Counts 2024 and 2025/Countings_Gammeltorv_sortet.xlsx",
    sourceZip: "Copenhagen Lighthouse",
    parser: "localCityData.parseCopenhagenRecords",
  },
  {
    label: "cph-otc-stormgade",
    publicPath:
      "/sharepoint-data/Copenhagen/OpenTrafficCam Counts 2024 and 2025/Countings_Stormgade_sortet.xlsx",
    sourceZip: "Copenhagen Lighthouse",
    parser: "localCityData.parseCopenhagenRecords",
  },
  {
    label: "cph-otc-hojbro",
    publicPath:
      "/sharepoint-data/Copenhagen/OpenTrafficCam Counts 2024 and 2025/Countings_Hojbro.xlsx",
    sourceZip: "Copenhagen Lighthouse",
    parser: "localCityData.parseCopenhagenRecords",
  },
  {
    label: "cph-telraam-summary",
    publicPath:
      "/sharepoint-data/Copenhagen/Telraam/Telraam counts Medieval City Copenhagen 2024 and 2025.xlsx",
    sourceZip: "Copenhagen Lighthouse",
    parser: "copenhagenExtendedParsers.parseCopenhagenExtendedRecords",
  },
  {
    label: "cph-manual-geo",
    publicPath: "/sharepoint-data/Copenhagen/Manual counts/manual_counts_geo.csv",
    sourceZip: "Copenhagen Lighthouse",
    parser: "build-copenhagen-data.mjs → manual-counts.json",
  },
  {
    label: "cph-manual-counts-2025",
    publicPath: "/sharepoint-data/Copenhagen/Manual counts/2025/",
    sourceZip: "Copenhagen Lighthouse",
    parser: "build-copenhagen-data.mjs → manual-counts.json",
  },
  {
    label: "cph-parking-inventory",
    publicPath:
      "/sharepoint-data/Copenhagen/Technical drawing - Medieval City/I100275 parking overview.xlsx",
    sourceZip: "Copenhagen Lighthouse",
    parser: "copenhagenExtendedParsers.parkingRecords",
  },
  {
    label: "cph-parking-shapefile",
    publicPath:
      "/sharepoint-data/Copenhagen/Technical drawing - Medieval City/parking-shp/",
    sourceZip: "Copenhagen Lighthouse",
    parser: "build-copenhagen-data.mjs → parking-polygons.geojson",
  },
  {
    label: "cph-tube-counts",
    publicPath: "/sharepoint-data/Copenhagen/Tube count bicyclist Apr 2024.xlsx",
    sourceZip: "Copenhagen Lighthouse",
    parser: "copenhagenExtendedParsers.tubeRecords",
  },
  {
    label: "cph-survey-acceptability",
    publicPath: "/sharepoint-data/Copenhagen/Surveys/",
    sourceZip: "Copenhagen Lighthouse",
    parser: "build-copenhagen-data.mjs → surveys.json",
  },
  {
    label: "cph-survey-safety",
    publicPath: "/sharepoint-data/Copenhagen/Surveys/Traffic safety perception.xlsx",
    sourceZip: "Copenhagen Lighthouse",
    parser: "build-copenhagen-data.mjs → surveys.json",
  },
  {
    label: "cph-irap-counts",
    publicPath: "/sharepoint-data/Copenhagen/iRAP/iRAP counts 2024 and 2025.xlsx",
    sourceZip: "Copenhagen Lighthouse",
    parser: "copenhagenExtendedParsers.irapRecords",
  },
  {
    label: "cph-bundled-fallback",
    publicPath: "/data/copenhagen/",
    sourceZip: "Derived",
    parser: "npm run build-copenhagen-data",
  },
  {
    label: "hel-telraam-1",
    publicPath: "/sharepoint-data/Helsinki/Telraam/raw-data-9000007091-16eb11c.xlsx",
    sourceZip: "Helsinki Lighthouse",
    parser: "localCityData.parseHelsinkiRecords",
  },
  {
    label: "hel-telraam-2",
    publicPath: "/sharepoint-data/Helsinki/Telraam/raw-data-9000007091-79245e.xlsx",
    sourceZip: "Helsinki Lighthouse",
    parser: "localCityData.parseHelsinkiRecords",
  },
  {
    label: "hel-dangerous-locations-gpkg",
    publicPath: "/sharepoint-data/Helsinki/DangerousLocationsSurvey_ENG_EPSG3067.gpkg",
    sourceZip: "Helsinki Lighthouse",
    parser: "convert-geospatial.py → dangerous-locations.geojson",
  },
  {
    label: "hel-escooter-nested-zip",
    publicPath: "/sharepoint-data/Helsinki/Helsinki_eScooter_Observations.zip",
    sourceZip: "Helsinki Lighthouse",
    parser: "convert-geospatial.py → escooter-observations.geojson",
  },
  {
    label: "hel-dangerous-locations-geojson",
    publicPath: "/sharepoint-data/Helsinki/dangerous-locations.geojson",
    sourceZip: "Derived",
    parser: "helsinkiGeoLayers.loadHelsinkiGeoSample",
  },
  {
    label: "hel-escooter-geojson",
    publicPath: "/sharepoint-data/Helsinki/escooter-observations.geojson",
    sourceZip: "Derived",
    parser: "helsinkiGeoLayers.loadHelsinkiGeoSample",
  },
  {
    label: "issy-baseline-csv",
    publicPath:
      "/sharepoint-data/Issy-20260427T130625Z-3-001/Issy/1. BASELINE DATA from Issy/ISSY1 - detailed traffic data/ISSY1_baseline_traffic_data_november_2024.csv",
    sourceZip: "Issy Lighthouse",
    parser: "issyFlowData (bundled /data/issy preferred)",
  },
  {
    label: "issy-post-csv",
    publicPath:
      "/sharepoint-data/Issy-20260427T130625Z-3-001/Issy/2. POST IMPLEMENTATION DATA from Issy/ISSY1 - detailed traffic_data/ISSY1_post_intervention_traffic_data_november_2025.csv",
    sourceZip: "Issy Lighthouse",
    parser: "issyFlowData (bundled /data/issy preferred)",
  },
  {
    label: "zar-intervention-centroids",
    publicPath: "/sharepoint-data/Zaragoza/intervention-areas-centroids.geojson",
    sourceZip: "Derived from Intervention areas shapefile",
    parser: "localCityData.loadZaragozaCentroids",
  },
  {
    label: "tri-smart-crossing-survey",
    publicPath:
      "/sharepoint-data/Trikala/baseline data of the smart crossing on line survey_english.xlsx",
    sourceZip: "Trikala Lighthouse",
    parser: "localCityData.parseTrikalaRecords",
  },
  {
    label: "tri-women-mobility-survey",
    publicPath:
      "/sharepoint-data/Trikala/ELABORATOR_ Women Mobility Questionnaire (Responses).xlsx",
    sourceZip: "Trikala Lighthouse",
    parser: "localCityData.parseTrikalaRecords",
  },
  {
    label: "tri-bike-lane-baseline",
    publicPath:
      "/sharepoint-data/Trikala/baseline data on bike safety from the on line syrvey_english.xlsx",
    sourceZip: "Trikala Lighthouse",
    parser: "trikalaSurveyParser.buildTrikalaRecords",
  },
  {
    label: "tri-smart-crossing-post",
    publicPath:
      "/sharepoint-data/Trikala/post/Post Intervention _ELABORATOR_ Smart crossing_raw data eng.xlsx",
    sourceZip: "Trikala Lighthouse",
    parser: "trikalaSurveyParser.buildTrikalaRecords",
  },
  {
    label: "tri-bike-lane-post",
    publicPath:
      "/sharepoint-data/Trikala/post/Post Intervention_ELABORATOR_Cycling Safety_Raw dataEnglish_headers.xlsx",
    sourceZip: "Trikala Lighthouse",
    parser: "trikalaSurveyParser.buildTrikalaRecords",
  },
  {
    label: "tri-smarta-app-post",
    publicPath: "/sharepoint-data/Trikala/post/Survey of SMARTA app_row data.xlsx",
    sourceZip: "Trikala Lighthouse",
    parser: "trikalaSurveyParser.buildTrikalaRecords",
  },
  {
    label: "tri-environmental-sensors",
    publicPath: "/sharepoint-data/Trikala/smart_citizen_kit_environmental_metrics.xlsx",
    sourceZip: "Trikala Lighthouse",
    parser: "trikalaEnvironmentalParser.buildTrikalaEnvironmentalRecords",
  },
  {
    label: "tri-meeting-attendance",
    publicPath: "/sharepoint-data/Trikala/Meeting attendance_ETrikala_230525.xlsx",
    sourceZip: "Trikala Lighthouse",
    parser: "administrative (not KPI-mapped)",
  },
  {
    label: "tri-media-gallery",
    publicPath: "/sharepoint-data/Trikala/media/",
    sourceZip: "Trikala Lighthouse bulk",
    parser: "build-trikala-bundle → /data/trikala/media/",
  },
  {
    label: "tri-docs-bundle",
    publicPath: "/sharepoint-data/Trikala/docs/",
    sourceZip: "Trikala Lighthouse bulk",
    parser: "build-trikala-bundle → /data/trikala/docs/",
  },
];

export const SHAREPOINT_LIGHTHOUSE_INTEGRATED_COUNT = 5;

export function resolveExtractedStage(
  row: DropPipelineRow,
  manifestLabels: Set<string>
): PipelineStageValue {
  if (row.extracted === "no" || row.extracted === "n/a") return row.extracted;
  if (!row.manifestLabels?.length) return row.extracted;
  const found = row.manifestLabels.filter((l) => manifestLabels.has(l)).length;
  if (found === 0) return "no";
  if (found < row.manifestLabels.length) return "partial";
  return "yes";
}
