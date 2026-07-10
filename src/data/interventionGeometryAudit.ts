import {
  PILOT_GEOMETRY_REGISTRY,
  type GeometryRegime,
  type GeometryRenderEligibility,
} from "@/lib/pilotGeometryContract";

export type InterventionGeometryType =
  | "Point"
  | "Intersection"
  | "Junction"
  | "Street segment"
  | "Corridor"
  | "Polygon"
  | "Area"
  | "Network";

export type DashboardFirstMode =
  | "corridor-first"
  | "camera-first"
  | "segment-first"
  | "area-first"
  | "point-first"
  | "network-first";

export type GeometryConfidence = "high" | "medium" | "low";

export interface PilotGeometryRow {
  city: string;
  pilotId: string;
  pilotLabel: string;
  intervention: string;
  geometryType: InterventionGeometryType;
  geometryAvailable: string;
  recommendedDashboard: string;
  dashboardFirstMode: DashboardFirstMode;
  confidence: GeometryConfidence;
  confidenceRationale: string;
  currentImplementationGap?: string;
}

export interface CityDashboardFirstSummary {
  city: string;
  mode: DashboardFirstMode;
  userUnderstanding: string;
}

export const ELABORATOR_SPATIAL_STANDARD = [
  "One pilot maps to one smallest meaningful monitoring geometry.",
  "Do not default to city-wide or Issy-style junction unless data supports it.",
  "Observatory schematic and map highlight must match the geometry type.",
] as const;

const REGIME_TO_GEOMETRY_TYPE: Record<GeometryRegime, InterventionGeometryType> = {
  point: "Point",
  segment: "Street segment",
  area: "Area",
  hybrid_network: "Network",
  camera_directional: "Corridor",
  corridor: "Corridor",
};

const REGIME_TO_DASHBOARD_MODE: Record<GeometryRegime, DashboardFirstMode> = {
  point: "point-first",
  segment: "segment-first",
  area: "area-first",
  hybrid_network: "network-first",
  camera_directional: "camera-first",
  corridor: "corridor-first",
};

function confidenceFromEligibility(
  eligibility: GeometryRenderEligibility,
  truthStatus: string
): GeometryConfidence {
  if (eligibility === "dashboard_only" || truthStatus === "inferred") return "low";
  if (eligibility === "render_with_uncertainty") return "medium";
  return "high";
}

const PILOT_GEOMETRY_ROW_METADATA: PilotGeometryRow[] = [
  {
    city: "Issy-les-Moulineaux",
    pilotId: "issy-p1",
    pilotLabel: "P1",
    intervention: "Luminous bicycle markings",
    geometryType: "Corridor",
    geometryAvailable:
      "traficissy segment at Voltaire junction; OD CSV at city zoom; junction config in junctionConfigs.ts",
    recommendedDashboard: "Single monitored corridor at Voltaire junction",
    dashboardFirstMode: "corridor-first",
    confidence: "high",
    confidenceRationale: "Live traficissy API plus bundled OD CSV.",
  },
  {
    city: "Issy-les-Moulineaux",
    pilotId: "issy-p2",
    pilotLabel: "P2",
    intervention: "Mobility observatory",
    geometryType: "Corridor",
    geometryAvailable: "Stalingrad junction segment context; bicycle and infrastructure APIs",
    recommendedDashboard: "Single flagship corridor at Stalingrad junction",
    dashboardFirstMode: "corridor-first",
    confidence: "high",
    confidenceRationale: "Flagship corridor with observed segment feeds.",
  },
  {
    city: "Issy-les-Moulineaux",
    pilotId: "issy-p3",
    pilotLabel: "P3",
    intervention: "GecoAir citizen app",
    geometryType: "Corridor",
    geometryAvailable: "Junction anchor plus derived climate hex buffer (~280 m)",
    recommendedDashboard: "Monitored corridor plus environmental influence field",
    dashboardFirstMode: "corridor-first",
    confidence: "medium",
    confidenceRationale: "Climate indicators are derived proxies, not measured CO₂.",
  },
  {
    city: "Copenhagen",
    pilotId: "cph-p1",
    pilotLabel: "P1",
    intervention: "Parking reallocation in streets",
    geometryType: "Corridor",
    geometryAvailable:
      "OTC Norreport workbook: exact GPS, pre/post counts per flow direction",
    recommendedDashboard: "Norreport camera site plus monitored approach directions",
    dashboardFirstMode: "camera-first",
    confidence: "high",
    confidenceRationale: "Observed directional OpenTrafficCam counts.",
    currentImplementationGap:
      "junctionConfigs mock names Andersens junction; observed data is Norreport/Norregade.",
  },
  {
    city: "Copenhagen",
    pilotId: "cph-p2",
    pilotLabel: "P2",
    intervention: "Enhanced bicycle parking",
    geometryType: "Corridor",
    geometryAvailable: "OTC Vandkunsten workbook with directional counts",
    recommendedDashboard: "Vandkunsten camera plus approach directions",
    dashboardFirstMode: "camera-first",
    confidence: "high",
    confidenceRationale: "Observed camera-direction counts.",
    currentImplementationGap: "Observatory junction schematic does not match camera geometry.",
  },
  {
    city: "Copenhagen",
    pilotId: "cph-p3",
    pilotLabel: "P3",
    intervention: "Traffic flow and near-encounter",
    geometryType: "Point",
    geometryAvailable: "Gammeltorv and Stormgade OTC workbooks",
    recommendedDashboard: "Two camera locations, each with directional counts",
    dashboardFirstMode: "camera-first",
    confidence: "high",
    confidenceRationale: "Two observed camera sites with direction-level data.",
    currentImplementationGap: "Registry junction config is fictional; map uses camera points.",
  },
  {
    city: "Helsinki",
    pilotId: "hel-p1",
    pilotLabel: "P1",
    intervention: "Safety Sense / dangerous locations",
    geometryType: "Point",
    geometryAvailable:
      "DangerousLocationsSurvey GPKG to GeoJSON point cloud; not a junction polygon",
    recommendedDashboard: "Dangerous-location survey point cluster",
    dashboardFirstMode: "point-first",
    confidence: "medium",
    confidenceRationale: "Geometry exists but is survey points, not a single intersection.",
    currentImplementationGap:
      "junctionConfigs implies Mannerheimintie corridor; profile is point-based survey.",
  },
  {
    city: "Helsinki",
    pilotId: "hel-p2",
    pilotLabel: "P2",
    intervention: "E-scooter parking intervention",
    geometryType: "Point",
    geometryAvailable:
      "Two official site coordinates; eScooter observations GeoJSON",
    recommendedDashboard: "Two parking sites plus eScooter observation cloud",
    dashboardFirstMode: "point-first",
    confidence: "high",
    confidenceRationale: "Exact intervention coordinates in pilot profile.",
    currentImplementationGap: "Telraam ring layout may dilute site focus for P2.",
  },
  {
    city: "Helsinki",
    pilotId: "hel-p3",
    pilotLabel: "P3",
    intervention: "Citywide active mobility behaviour",
    geometryType: "Network",
    geometryAvailable: "Telraam segment exports; coords often missing, inferred ring layout",
    recommendedDashboard: "Telraam sensor network — multiple street segments",
    dashboardFirstMode: "network-first",
    confidence: "low",
    confidenceRationale: "No single intervention geometry; network-level monitoring.",
    currentImplementationGap: "UI may collapse to one junction anchor instead of network view.",
  },
  {
    city: "Milan",
    pilotId: "mil-p1",
    pilotLabel: "P1",
    intervention: "Neighbourhood low-traffic zone",
    geometryType: "Street segment",
    geometryAvailable: "AMAT Olympic itineraries speed shapefile network (external Milan tree)",
    recommendedDashboard: "Highlighted LTZ segment network",
    dashboardFirstMode: "segment-first",
    confidence: "medium",
    confidenceRationale: "Segment polylines when SharePoint Milan mirror is hosted.",
    currentImplementationGap: "Milan not in June 2026 drop; registry mock when mirror absent.",
  },
  {
    city: "Milan",
    pilotId: "mil-p2",
    pilotLabel: "P2",
    intervention: "Protected cycling corridor",
    geometryType: "Street segment",
    geometryAvailable: "West axis / Asse Ovest AMAT shapefiles",
    recommendedDashboard: "Primary monitored segment (west axis / Via Marghera)",
    dashboardFirstMode: "segment-first",
    confidence: "medium",
    confidenceRationale: "Observed segment geometry when Milan tree present.",
    currentImplementationGap: "Junction schematic misrepresents segment intervention.",
  },
  {
    city: "Milan",
    pilotId: "mil-p3",
    pilotLabel: "P3",
    intervention: "Transit-priority reallocation",
    geometryType: "Street segment",
    geometryAvailable: "Partial segment and survey data; mil-p3 speed SHP not published",
    recommendedDashboard: "Transit-priority segment corridor when shapefiles linked",
    dashboardFirstMode: "segment-first",
    confidence: "low",
    confidenceRationale: "HeroMap avoids synthetic segments for mil-p3.",
    currentImplementationGap: "Limited segment publish; registry fallback.",
  },
  {
    city: "Zaragoza",
    pilotId: "zar-p1",
    pilotLabel: "P1",
    intervention: "Tactical urbanism (four areas)",
    geometryType: "Polygon",
    geometryAvailable:
      "Intervention areas shapefile to centroids; manual counts; KPI1.2 workbooks often templated",
    recommendedDashboard: "Four intervention polygons AYZG1–4 plus count sites",
    dashboardFirstMode: "area-first",
    confidence: "medium",
    confidenceRationale: "Polygons and manual counts; hourly KPI sheets incomplete.",
    currentImplementationGap: "Single pilot ID but four sub-areas in data.",
  },
  {
    city: "Trikala",
    pilotId: "tri-p1",
    pilotLabel: "P1",
    intervention: "Smart crossing school",
    geometryType: "Intersection",
    geometryAvailable: "Partner My Maps — crossing site + corridor signals",
    recommendedDashboard: "Smart-crossing junction at Military School with survey pulse rings",
    dashboardFirstMode: "point-first",
    confidence: "medium",
    confidenceRationale: "Observed crossing coordinates; survey aggregates at pilot anchor.",
    currentImplementationGap: "Post-intervention sensor time-series pending (expected end of June).",
  },
  {
    city: "Trikala",
    pilotId: "tri-p2",
    pilotLabel: "P2",
    intervention: "Park and ride stations",
    geometryType: "Area polygons",
    geometryAvailable: "Partner My Maps — SMY, DEH, GiSeMi P+R polygons",
    recommendedDashboard: "P+R hub polygons with parking and bike-station context",
    dashboardFirstMode: "area-first",
    confidence: "medium",
    confidenceRationale: "Observed polygon geodata; structured post-intervention survey pending.",
    currentImplementationGap: "SharePoint P+R survey folder empty; monitoring expected end of June.",
  },
  {
    city: "Trikala",
    pilotId: "tri-p3",
    pilotLabel: "P3",
    intervention: "Redesigned bike lanes",
    geometryType: "Corridor sensors",
    geometryAvailable: "Partner My Maps — 30 bike-lane sensors + 7 bike stations",
    recommendedDashboard: "Sensor fleet overlay with paired bike safety survey aggregates",
    dashboardFirstMode: "segment-first",
    confidence: "medium",
    confidenceRationale: "Observed sensor nodes; paired baseline/post survey workbooks integrated.",
    currentImplementationGap: "Post-intervention operational counts pending end of June.",
  },
];

export const PILOT_GEOMETRY_ROWS: PilotGeometryRow[] = PILOT_GEOMETRY_ROW_METADATA.map((row) => {
  const registry = PILOT_GEOMETRY_REGISTRY[row.pilotId];
  if (!registry) return row;
  return {
    ...row,
    geometryType: REGIME_TO_GEOMETRY_TYPE[registry.regime],
    dashboardFirstMode: REGIME_TO_DASHBOARD_MODE[registry.regime],
    confidence: confidenceFromEligibility(
      registry.renderEligibility,
      registry.geometryTruth.status
    ),
    confidenceRationale:
      registry.renderEligibility === "dashboard_only"
        ? "Dashboard-only — survey context without mapped intervention geometry."
        : registry.renderEligibility === "render_with_uncertainty"
          ? `Regime ${registry.regime} with ${registry.geometryTruth.status} truth — capped map interaction.`
          : row.confidenceRationale,
  };
});

export const CITY_DASHBOARD_FIRST_SUMMARY: CityDashboardFirstSummary[] = [
  {
    city: "Issy-les-Moulineaux",
    mode: "corridor-first",
    userUnderstanding: "One monitored intervention corridor at a known junction.",
  },
  {
    city: "Copenhagen",
    mode: "camera-first",
    userUnderstanding:
      "A camera monitoring a corridor — metrics are per direction, not city modal share.",
  },
  {
    city: "Helsinki",
    mode: "point-first",
    userUnderstanding:
      "P1/P2: survey or site points; P3: citywide sensor network — not one junction.",
  },
  {
    city: "Milan",
    mode: "segment-first",
    userUnderstanding: "A monitored street segment or network — speeds and counts along lines.",
  },
  {
    city: "Zaragoza",
    mode: "area-first",
    userUnderstanding: "An intervention area (possibly several polygons), not a single intersection.",
  },
  {
    city: "Trikala",
    mode: "point-first",
    userUnderstanding: "A smart-crossing intervention; evidence is survey-based at pilot level.",
  },
];

export const GEOMETRY_FINAL_RECOMMENDATION =
  "When opening a pilot, the user should immediately see the smallest geometry the datasets actually monitor — corridor, camera directions, segments, polygons, or points — with honest labels when geometry is inferred or registry mock.";
