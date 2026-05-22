export type DataType = "observed" | "derived" | "modelled" | "mock";
export type GeometryType = "point" | "segment" | "polygon" | "hex" | "none";
export type GeometryQuality = "exact" | "matched" | "inferred" | "missing";
export type SpatialLinkageMethod =
  | "direct-coordinates"
  | "segment-join"
  | "polygon-assignment"
  | "inferred"
  | "none";
export type BeforeAfterStatus =
  | "before-only"
  | "after-only"
  | "both"
  | "ongoing"
  | "unclear";
export type ParserStatus = "ready" | "partial" | "planned" | "none";
export type RealDataStatus = "active" | "fallback" | "mock";
export type UpdateStatus = "static" | "periodic" | "live";
export type FileFormat =
  | "xlsx"
  | "csv"
  | "shapefile"
  | "geojson"
  | "api"
  | "json"
  | "mixed";

export interface DatasetMetadata {
  id: string;
  city: string;
  pilotIds: string[];
  title: string;
  source: string;
  fileFormat: FileFormat;
  dataType: DataType;
  geometryType: GeometryType;
  geometryQuality: GeometryQuality;
  spatialLinkageMethod: SpatialLinkageMethod;
  temporalCoverage: string;
  beforeAfterStatus: BeforeAfterStatus;
  linkedKpis: string[];
  interventionScale: "street" | "district" | "city";
  parserStatus: ParserStatus;
  realDataStatus: RealDataStatus;
  updateStatus: UpdateStatus;
  responsiblePartner?: string;
  notes?: string;
}

export const DATASET_REGISTRY: DatasetMetadata[] = [
  // ─── ISSY-LES-MOULINEAUX ──────────────────────────────────────────────────
  {
    id: "issy-traffic-api",
    city: "Issy-les-Moulineaux",
    pilotIds: ["issy-p1", "issy-p2", "issy-p3"],
    title: "Traffic Segment API (traficissy)",
    source: "traficissy.fr REST API",
    fileFormat: "api",
    dataType: "observed",
    geometryType: "segment",
    geometryQuality: "exact",
    spatialLinkageMethod: "direct-coordinates",
    temporalCoverage: "2024–ongoing",
    beforeAfterStatus: "ongoing",
    linkedKpis: ["kpi1.2", "kpi2.1", "kpi3.2"],
    interventionScale: "street",
    parserStatus: "ready",
    realDataStatus: "active",
    updateStatus: "live",
    responsiblePartner: "Issy-les-Moulineaux",
    notes:
      "Live segment speeds and congestion. Powers junction observatory arms (P2 flagship), safety lines, and climate intensity proxies at study zoom.",
  },
  {
    id: "issy-bike-counter-api",
    city: "Issy-les-Moulineaux",
    pilotIds: ["issy-p1", "issy-p2", "issy-p3"],
    title: "Bicycle Counting API",
    source: "City sensor network REST API",
    fileFormat: "api",
    dataType: "observed",
    geometryType: "point",
    geometryQuality: "exact",
    spatialLinkageMethod: "direct-coordinates",
    temporalCoverage: "2024–ongoing",
    beforeAfterStatus: "ongoing",
    linkedKpis: ["kpi1.2"],
    interventionScale: "street",
    parserStatus: "ready",
    realDataStatus: "active",
    updateStatus: "live",
    responsiblePartner: "Issy-les-Moulineaux",
    notes: "Hourly bike counts at sensor stations. Direct lat/lng in API response.",
  },
  {
    id: "issy-cycling-infra-api",
    city: "Issy-les-Moulineaux",
    pilotIds: ["issy-p2"],
    title: "Cycling Infrastructure API",
    source: "City cycling network REST API",
    fileFormat: "api",
    dataType: "observed",
    geometryType: "segment",
    geometryQuality: "exact",
    spatialLinkageMethod: "direct-coordinates",
    temporalCoverage: "2024",
    beforeAfterStatus: "after-only",
    linkedKpis: ["kpi3.1"],
    interventionScale: "street",
    parserStatus: "ready",
    realDataStatus: "active",
    updateStatus: "periodic",
    responsiblePartner: "Issy-les-Moulineaux",
  },
  {
    id: "issy-flow-baseline-csv",
    city: "Issy-les-Moulineaux",
    pilotIds: ["issy-p1", "issy-p2", "issy-p3"],
    title: "ISSY1 Zone-to-Zone Flow — Baseline",
    source: "Bundled: /public/data/issy/ISSY1_baseline_traffic_data_november_2024.csv (SharePoint mirror available)",
    fileFormat: "csv",
    dataType: "observed",
    geometryType: "segment",
    geometryQuality: "matched",
    spatialLinkageMethod: "segment-join",
    temporalCoverage: "Nov 2024",
    beforeAfterStatus: "before-only",
    linkedKpis: ["kpi1.2"],
    interventionScale: "district",
    parserStatus: "ready",
    realDataStatus: "active",
    updateStatus: "static",
    responsiblePartner: "Issy-les-Moulineaux",
    notes:
      "Zone OD matrix by vehicle category (weekday/weekend). Map: city-view flow arcs; sidebar mode-share when KPI 1.2 is active.",
  },
  {
    id: "issy-flow-post-csv",
    city: "Issy-les-Moulineaux",
    pilotIds: ["issy-p1", "issy-p2", "issy-p3"],
    title: "ISSY1 Zone-to-Zone Flow — Post-Intervention",
    source: "Bundled: /public/data/issy/ISSY1_post_intervention_traffic_data_november_2025.csv (SharePoint mirror available)",
    fileFormat: "csv",
    dataType: "observed",
    geometryType: "segment",
    geometryQuality: "matched",
    spatialLinkageMethod: "segment-join",
    temporalCoverage: "Nov 2025",
    beforeAfterStatus: "after-only",
    linkedKpis: ["kpi1.2"],
    interventionScale: "district",
    parserStatus: "ready",
    realDataStatus: "active",
    updateStatus: "static",
    responsiblePartner: "Issy-les-Moulineaux",
    notes: "Paired with baseline CSV for comparison scenario and Issy day-category filters.",
  },

  // ─── COPENHAGEN ──────────────────────────────────────────────────────────
  {
    id: "cph-otc-counts",
    city: "Copenhagen",
    pilotIds: ["cph-p1", "cph-p2", "cph-p3"],
    title: "OpenTrafficCam Counts 2024/2025",
    source: "SharePoint: Copenhagen/OTC Combined counts ELABORATOR.xlsx",
    fileFormat: "xlsx",
    dataType: "observed",
    geometryType: "point",
    geometryQuality: "exact",
    spatialLinkageMethod: "direct-coordinates",
    temporalCoverage: "2024–2025",
    beforeAfterStatus: "both",
    linkedKpis: ["kpi1.2", "kpi2.1"],
    interventionScale: "street",
    parserStatus: "partial",
    realDataStatus: "active",
    updateStatus: "static",
    responsiblePartner: "Copenhagen",
    notes:
      "Camera locations have exact coords. Category breakdown (ped/cycle/car) available. Before/after requires date-range splitting from the combined sheet.",
  },

  // ─── HELSINKI ─────────────────────────────────────────────────────────────
  {
    id: "hel-telraam",
    city: "Helsinki",
    pilotIds: ["hel-p1", "hel-p2", "hel-p3"],
    title: "Telraam Street-Level Counts",
    source: "SharePoint: Helsinki/Telraam/raw-data-*.xlsx",
    fileFormat: "xlsx",
    dataType: "observed",
    geometryType: "point",
    geometryQuality: "matched",
    spatialLinkageMethod: "direct-coordinates",
    temporalCoverage: "2024–2025",
    beforeAfterStatus: "unclear",
    linkedKpis: ["kpi1.2", "kpi2.1"],
    interventionScale: "street",
    parserStatus: "partial",
    realDataStatus: "active",
    updateStatus: "static",
    responsiblePartner: "Helsinki",
    notes:
      "Segment IDs need mapping to lat/lng. Before/after window not clearly defined in data.",
  },
  {
    id: "hel-escooter",
    city: "Helsinki",
    pilotIds: ["hel-p2", "hel-p3"],
    title: "eScooter Observations",
    source: "SharePoint: Helsinki/eScooter",
    fileFormat: "xlsx",
    dataType: "observed",
    geometryType: "point",
    geometryQuality: "inferred",
    spatialLinkageMethod: "inferred",
    temporalCoverage: "2024",
    beforeAfterStatus: "unclear",
    linkedKpis: ["kpi1.2", "kpi4.2"],
    interventionScale: "district",
    parserStatus: "planned",
    realDataStatus: "fallback",
    updateStatus: "static",
    responsiblePartner: "Helsinki",
    notes:
      "Trip origin/destination data; geometry needs cluster assignment. KPI linkage (mode share + accessibility) requires aggregation logic.",
  },

  // ─── MILAN ───────────────────────────────────────────────────────────────
  {
    id: "mil-amat-counts",
    city: "Milan",
    pilotIds: ["mil-p1", "mil-p2", "mil-p3"],
    title: "AMAT Road User Counts",
    source: "SharePoint: Milan/AMAT counts",
    fileFormat: "xlsx",
    dataType: "observed",
    geometryType: "point",
    geometryQuality: "exact",
    spatialLinkageMethod: "direct-coordinates",
    temporalCoverage: "2023–2024",
    beforeAfterStatus: "both",
    linkedKpis: ["kpi1.2", "kpi2.1"],
    interventionScale: "district",
    parserStatus: "partial",
    realDataStatus: "active",
    updateStatus: "static",
    responsiblePartner: "AMAT / Milan",
    notes: "Camera locations have coordinates. Mode breakdown available. Needs pilot ID linkage.",
  },
  {
    id: "mil-speed-shapefiles",
    city: "Milan",
    pilotIds: ["mil-p1", "mil-p2", "mil-p3"],
    title: "Speed Measurement Shapefiles",
    source: "SharePoint: Milan/Speed shapefiles",
    fileFormat: "shapefile",
    dataType: "observed",
    geometryType: "segment",
    geometryQuality: "exact",
    spatialLinkageMethod: "segment-join",
    temporalCoverage: "2023–2024",
    beforeAfterStatus: "both",
    linkedKpis: ["kpi2.1"],
    interventionScale: "street",
    parserStatus: "partial",
    realDataStatus: "active",
    updateStatus: "static",
    responsiblePartner: "AMAT / Milan",
    notes:
      "Shapefiles have geometry but speed values are in a separate attribute table. Join on segment ID required.",
  },
  {
    id: "mil-co2-network",
    city: "Milan",
    pilotIds: ["mil-p1", "mil-p2", "mil-p3"],
    title: "CO₂ & Noise Emissions Network",
    source: "SharePoint: Milan/RETE CO2 noise shapefiles",
    fileFormat: "shapefile",
    dataType: "derived",
    geometryType: "segment",
    geometryQuality: "exact",
    spatialLinkageMethod: "segment-join",
    temporalCoverage: "2023–2024",
    beforeAfterStatus: "both",
    linkedKpis: ["kpi3.2"],
    interventionScale: "district",
    parserStatus: "ready",
    realDataStatus: "active",
    updateStatus: "static",
    responsiblePartner: "AMAT / Milan",
    notes: "Network-level CO₂ and noise values per road segment. Two time windows: 08–09, 18–19.",
  },
  {
    id: "mil-camera-shapefile",
    city: "Milan",
    pilotIds: ["mil-p1", "mil-p2"],
    title: "Camera Location Shapefile",
    source: "SharePoint: Milan/Camera shapefile",
    fileFormat: "shapefile",
    dataType: "observed",
    geometryType: "point",
    geometryQuality: "exact",
    spatialLinkageMethod: "direct-coordinates",
    temporalCoverage: "2023–2024",
    beforeAfterStatus: "both",
    linkedKpis: ["kpi1.2", "kpi2.1"],
    interventionScale: "street",
    parserStatus: "partial",
    realDataStatus: "active",
    updateStatus: "static",
    responsiblePartner: "AMAT / Milan",
  },
  {
    id: "mil-accessibility-dss",
    city: "Milan",
    pilotIds: ["mil-p1", "mil-p2"],
    title: "Accessibility Features DSS Workbook",
    source: "SharePoint: Milan/8. Data - accessibility features/Milan_Accessibility_Features_DSS_Analysis_CIRCE.xlsx",
    fileFormat: "xlsx",
    dataType: "derived",
    geometryType: "point",
    geometryQuality: "matched",
    spatialLinkageMethod: "direct-coordinates",
    temporalCoverage: "2024",
    beforeAfterStatus: "after-only",
    linkedKpis: ["kpi4.2"],
    interventionScale: "district",
    parserStatus: "ready",
    realDataStatus: "active",
    updateStatus: "static",
    responsiblePartner: "CIRCE / Milan",
    notes: "Feature inventory with type + location. Ramps, tactile paving, audio signals, rest areas.",
  },
  {
    id: "mil-surveys",
    city: "Milan",
    pilotIds: ["mil-p3"],
    title: "User Satisfaction Surveys",
    source: "SharePoint: Milan/Survey results",
    fileFormat: "xlsx",
    dataType: "observed",
    geometryType: "none",
    geometryQuality: "missing",
    spatialLinkageMethod: "none",
    temporalCoverage: "2024",
    beforeAfterStatus: "both",
    linkedKpis: ["kpi4.1"],
    interventionScale: "city",
    parserStatus: "planned",
    realDataStatus: "fallback",
    updateStatus: "static",
    responsiblePartner: "Milan",
    notes:
      "Raw survey responses. Needs aggregation to satisfaction %. No spatial component — panel chart only.",
  },

  // ─── ZARAGOZA ────────────────────────────────────────────────────────────
  {
    id: "zar-mobility-indicators",
    city: "Zaragoza",
    pilotIds: ["zar-p1"],
    title: "City Mobility Indicators",
    source: "City-provided aggregate dataset",
    fileFormat: "mixed",
    dataType: "derived",
    geometryType: "none",
    geometryQuality: "missing",
    spatialLinkageMethod: "none",
    temporalCoverage: "2024",
    beforeAfterStatus: "unclear",
    linkedKpis: ["kpi1.2", "kpi2.1", "kpi3.1", "kpi3.2", "kpi4.1", "kpi4.2"],
    interventionScale: "city",
    parserStatus: "planned",
    realDataStatus: "mock",
    updateStatus: "static",
    responsiblePartner: "Zaragoza",
    notes: "Aggregate indicators only. No spatial geometry yet. Needs disaggregation to pilot level.",
  },
];

// ─── Lookup helpers ──────────────────────────────────────────────────────────

export function getDatasetsByCity(city: string): DatasetMetadata[] {
  return DATASET_REGISTRY.filter((d) => d.city === city);
}

export function getDatasetsByKpi(kpiId: string): DatasetMetadata[] {
  return DATASET_REGISTRY.filter((d) => d.linkedKpis.includes(kpiId));
}

export function getDatasetsByPilot(pilotId: string): DatasetMetadata[] {
  return DATASET_REGISTRY.filter((d) => d.pilotIds.includes(pilotId));
}

export const ALL_CITIES = [
  "Issy-les-Moulineaux",
  "Copenhagen",
  "Helsinki",
  "Milan",
  "Zaragoza",
] as const;
