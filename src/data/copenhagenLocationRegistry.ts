export type CopenhagenPilotId = "cph-p1" | "cph-p2" | "cph-p3";

export type CopenhagenLocationKind =
  | "intelligent_camera"
  | "otc_workbook_site"
  | "telraam_counter"
  | "manual_survey_site"
  | "flow_camera";

export type TrafficDirection =
  | "north"
  | "south"
  | "east"
  | "west"
  | "towards_stormgade"
  | "towards_vandkunsten"
  | "towards_strøget"
  | "towards_norreport";

export interface CopenhagenEvaluationRules {
  excludeFridays?: boolean;
  weekdaySampleCount?: number;
  excludedModesByDirection?: Partial<Record<TrafficDirection, string[]>>;
  restrictedDirections?: TrafficDirection[];
  seasonalMismatchWarning?: boolean;
  separateCarsVansTrucks?: boolean;
}

export interface CopenhagenLocation {
  id: string;
  kind: CopenhagenLocationKind;
  name: string;
  lat: number;
  lon: number;
  pilotIds: CopenhagenPilotId[];
  linkedDatasetIds: string[];
  /** OTC workbook key used by parser / streets.geojson (norreport, vandkunsten, gammeltorv, stormgade). */
  otcWorkbookKey?: string;
  /** When false, location exists in registry but is omitted from default map layer. */
  mapVisible?: boolean;
  monitoredDirections?: TrafficDirection[];
  evaluationRules?: CopenhagenEvaluationRules;
  notes?: string;
}

/** Partner-reported Telraam relative changes (Vestergade 5 pilot headline). */
export interface CopenhagenTelraamOutcome {
  motorizedPctChange: number;
  bicyclePctChange: number;
  pedestrianPctChange?: number;
  period: string;
  source: string;
  pedestrianUndercountWarning: boolean;
  cautionNote?: string;
}

const SURVEY_SITES: Array<{ id: string; name: string; lat: number; lon: number }> = [
  { id: "survey-farvergade-nord", name: "FARVERGADE nord", lat: 55.67593, lon: 12.572713 },
  { id: "survey-frederiksborgg", name: "FREDERIKSBORGG", lat: 55.683151, lon: 12.573098 },
  { id: "survey-norregade-sydost", name: "NØRREGADE sydøst", lat: 55.682256, lon: 12.570781 },
  { id: "survey-stroget-vest", name: "STRØGET VEST", lat: 55.676602, lon: 12.569856 },
  { id: "survey-vestergade-nord", name: "VESTERGADE nord", lat: 55.676798, lon: 12.568904 },
  { id: "survey-longangstraede", name: "LØNGANGSTRÆDE", lat: 55.675243, lon: 12.572428 },
  { id: "survey-studiestraede-os", name: "STUDIESTRÆDE øst", lat: 55.678011, lon: 12.567532 },
  { id: "survey-fiolstraede-44", name: "FIOLSTRÆDE 44", lat: 55.682607, lon: 12.571851 },
  { id: "survey-hojbro", name: "HØJBRO", lat: 55.6776844, lon: 12.5799719 },
  { id: "survey-landemaerket", name: "LANDEMÆRKET", lat: 55.682807, lon: 12.5776048 },
  { id: "survey-hovedvagtsgade", name: "HOVEDVAGTSGADE", lat: 55.680853, lon: 12.584115 },
  { id: "survey-gronne-gade-syd", name: "GRØNNEGADE syd", lat: 55.681818, lon: 12.583492 },
  { id: "survey-store-regnegade-1", name: "STORE REGNEGADE", lat: 55.682094, lon: 12.582528 },
  { id: "survey-larslejsstraede", name: "LARSLEJSSTRÆDE", lat: 55.679738, lon: 12.569634 },
  { id: "survey-frederiksholms-1", name: "FREDERIKSHOLMS", lat: 55.675016, lon: 12.576016 },
  { id: "survey-ny-kongensgade", name: "NY KONGENSGADE", lat: 55.673517, lon: 12.575975 },
  { id: "survey-stroget-ost", name: "STRØGET ØST", lat: 55.680151, lon: 12.583829 },
  { id: "survey-rigsdagsgaarden", name: "RIGSDAGSGÅRDEN", lat: 55.675611, lon: 12.581432 },
  { id: "survey-teglgaardstraede", name: "TEGLGÅRDSTRÆDE", lat: 55.679766, lon: 12.567937 },
  { id: "survey-norregade-40", name: "NØRREGADE 40", lat: 55.682278, lon: 12.571108 },
  { id: "survey-frederiksholms-k", name: "FREDRIKSHOLMS K", lat: 55.673238, lon: 12.579503 },
  { id: "survey-rosenborggade-1", name: "ROSENBORGGADE", lat: 55.684086, lon: 12.57477 },
  { id: "survey-sjaeleboderne-4", name: "SJÆLEBODERNE 4", lat: 55.68262, lon: 12.579861 },
  { id: "survey-montergade-19", name: "MØNTERGADE 19", lat: 55.682207, lon: 12.579844 },
  { id: "survey-christian-ix-gade-1", name: "CHRISTIAN IX's GADE", lat: 55.6820492, lon: 12.5810183 },
  { id: "survey-ny-adelgade", name: "NY ADELGADE", lat: 55.681236, lon: 12.584196 },
  { id: "survey-lille-kongensga", name: "LILLE KONGENSGADE", lat: 55.679738, lon: 12.584526 },
  { id: "survey-ny-vestergade-n", name: "NY VESTERGADE nord", lat: 55.6741, lon: 12.574626 },
  { id: "survey-sankt-peders-st-1", name: "SANKT PEDERS STRÆDE", lat: 55.678827, lon: 12.567178 },
  { id: "survey-tornebuskegade", name: "TORNEBUSKEGADE", lat: 55.683885, lon: 12.573778 },
  { id: "survey-lonporten-2", name: "LØNPORTEN 2", lat: 55.682801, lon: 12.578848 },
  { id: "survey-christian-ix-gade-2", name: "CHRISTIAN IX's GADE (2)", lat: 55.682284, lon: 12.580682 },
  { id: "survey-gronne-gade-36", name: "GRØNNEGADE 36", lat: 55.681541, lon: 12.583502 },
  { id: "survey-bremerholm-nord", name: "BREMERHOLM nord", lat: 55.677481, lon: 12.584427 },
  { id: "survey-bremerholm-39", name: "BREMERHOLM 39", lat: 55.677481, lon: 12.584427 },
  { id: "survey-bryghuspladsen", name: "BRYGHUSPLADSEN", lat: 55.672351, lon: 12.578205 },
  { id: "survey-frederiksholms-2", name: "FREDERIKSHOLMS (kanal 6)", lat: 55.6757756, lon: 12.5755308 },
  { id: "survey-nikolajgade-25", name: "NIKOLAJGADE 25", lat: 55.677482, lon: 12.583481 },
  { id: "survey-ved-stranden-25", name: "VED STRANDEN 25", lat: 55.676936, lon: 12.582456 },
  { id: "survey-lavendelstraede", name: "LAVENDELSTRÆDE", lat: 55.676115, lon: 12.571017 },
  { id: "survey-christiansborg", name: "CHRISTIANSBORG", lat: 55.67634, lon: 12.580714 },
  { id: "survey-store-regnegade-2", name: "STORE REGNEGADE (2)", lat: 55.6817056, lon: 12.582115 },
  { id: "survey-knabrostraede-8", name: "KNABROSTRÆDE 8", lat: 55.677995, lon: 12.574162 },
  { id: "survey-rosenborggade-2", name: "ROSENBORGGADE (2)", lat: 55.683858, lon: 12.574384 },
  { id: "survey-sankt-peders-st-2", name: "SANKT PEDERS STRÆDE (2)", lat: 55.679095, lon: 12.568499 },
  { id: "survey-studiestraede-47", name: "STUDIESTRÆDE 47", lat: 55.67781, lon: 12.567492 },
  { id: "survey-vestergade-5", name: "VESTERGADE 5", lat: 55.677906, lon: 12.571005 },
  { id: "survey-vognmagergade", name: "VOGNMAGERGADE", lat: 55.682486, lon: 12.57885 },
];

const INTELLIGENT_CAMERAS: CopenhagenLocation[] = [
  {
    id: "ic-gammeltorv",
    kind: "intelligent_camera",
    name: "Gammeltorv",
    lat: 55.67844,
    lon: 12.57216,
    pilotIds: ["cph-p1", "cph-p3"],
    linkedDatasetIds: ["cph-otc-counts"],
    otcWorkbookKey: "gammeltorv",
    mapVisible: true,
  },
  {
    id: "ic-norreport",
    kind: "intelligent_camera",
    name: "Norreport",
    lat: 55.68235,
    lon: 12.571037,
    pilotIds: ["cph-p1", "cph-p3"],
    linkedDatasetIds: ["cph-otc-counts", "cph-manual-counts"],
    otcWorkbookKey: "norreport",
    mapVisible: true,
  },
  {
    id: "ic-vandkunsten-1",
    kind: "intelligent_camera",
    name: "Vandkunsten (camera 1)",
    lat: 55.676102,
    lon: 12.574599,
    pilotIds: ["cph-p2", "cph-p3"],
    linkedDatasetIds: ["cph-otc-counts"],
    otcWorkbookKey: "vandkunsten",
    mapVisible: true,
  },
  {
    id: "ic-vandkunsten-2",
    kind: "intelligent_camera",
    name: "Vandkunsten (camera 2)",
    lat: 55.675961,
    lon: 12.574234,
    pilotIds: ["cph-p2", "cph-p3"],
    linkedDatasetIds: ["cph-otc-counts"],
    otcWorkbookKey: "vandkunsten",
    mapVisible: true,
  },
  {
    id: "ic-vandkunsten-3",
    kind: "intelligent_camera",
    name: "Vandkunsten (camera 3)",
    lat: 55.675949,
    lon: 12.573609,
    pilotIds: ["cph-p2", "cph-p3"],
    linkedDatasetIds: ["cph-otc-counts"],
    otcWorkbookKey: "vandkunsten",
    mapVisible: true,
  },
  {
    id: "ic-vandkunsten-4",
    kind: "intelligent_camera",
    name: "Vandkunsten (camera 4)",
    lat: 55.676213,
    lon: 12.574165,
    pilotIds: ["cph-p2", "cph-p3"],
    linkedDatasetIds: ["cph-otc-counts"],
    otcWorkbookKey: "vandkunsten",
    mapVisible: true,
  },
  {
    id: "ic-hojbro",
    kind: "intelligent_camera",
    name: "Vindebrogade / Højbro",
    lat: 55.67747552,
    lon: 12.57977486,
    pilotIds: ["cph-p1", "cph-p3"],
    linkedDatasetIds: ["cph-otc-counts", "cph-manual-counts"],
    otcWorkbookKey: "hojbro",
    mapVisible: true,
    evaluationRules: {
      excludeFridays: true,
      seasonalMismatchWarning: true,
    },
    notes:
      "Manual and OTC counts available. Do not use OTC pedestrian counts on west side of bridge. Autumn 2023 pre vs May 2025 post seasonal bias.",
  },
  {
    id: "ic-stormgade",
    kind: "intelligent_camera",
    name: "Stormgade / Frederiksholms Kanal",
    lat: 55.67550335,
    lon: 12.57547259,
    pilotIds: ["cph-p1", "cph-p3"],
    linkedDatasetIds: ["cph-otc-counts", "cph-manual-counts"],
    otcWorkbookKey: "stormgade",
    mapVisible: true,
  },
];

const OTC_WORKBOOK_SITES: CopenhagenLocation[] = [
  {
    id: "wb-norreport",
    kind: "otc_workbook_site",
    name: "Norregade / Nørre Voldgade",
    lat: 55.682312,
    lon: 12.570922,
    pilotIds: ["cph-p1", "cph-p3"],
    linkedDatasetIds: ["cph-otc-counts"],
    otcWorkbookKey: "norreport",
    mapVisible: true,
    monitoredDirections: ["north", "south"],
    evaluationRules: {
      excludeFridays: true,
      weekdaySampleCount: 3,
      excludedModesByDirection: {
        south: ["pedestrian", "bicycle"],
      },
      separateCarsVansTrucks: true,
    },
    notes:
      "Use vehicle counts both directions; bikes/pedestrians south only with caution (sun cover 2025, road works spring 2025). Manual counts at Nørregade 49 available.",
  },
  {
    id: "wb-vandkunsten",
    kind: "otc_workbook_site",
    name: "Vandkunsten / Rådhusstræde",
    lat: 55.677575,
    lon: 12.579961,
    pilotIds: ["cph-p2", "cph-p3"],
    linkedDatasetIds: ["cph-otc-counts"],
    otcWorkbookKey: "vandkunsten",
    mapVisible: true,
    monitoredDirections: ["east", "west"],
    evaluationRules: {
      excludeFridays: true,
      weekdaySampleCount: 3,
    },
    notes:
      "Workbook aggregation endpoint — distinct from four physical Vandkunsten cameras. Construction bias for cars possible; Platomo verification ongoing.",
  },
  {
    id: "wb-gammeltorv",
    kind: "otc_workbook_site",
    name: "Gammeltorv / Vestergade",
    lat: 55.678437,
    lon: 12.572236,
    pilotIds: ["cph-p1", "cph-p3"],
    linkedDatasetIds: ["cph-otc-counts"],
    otcWorkbookKey: "gammeltorv",
    mapVisible: true,
    monitoredDirections: ["north", "south", "east", "west"],
    evaluationRules: {
      excludeFridays: true,
      weekdaySampleCount: 3,
    },
    notes:
      "Large bicycle count drop 2024→2025 under partner review; ratio stable intraday on 29 May 2025.",
  },
  {
    id: "wb-stormgade",
    kind: "otc_workbook_site",
    name: "Frederiksholmskanal / Stormgade",
    lat: 55.675535,
    lon: 12.575545,
    pilotIds: ["cph-p1", "cph-p3"],
    linkedDatasetIds: ["cph-otc-counts", "cph-manual-counts"],
    otcWorkbookKey: "stormgade",
    mapVisible: true,
    monitoredDirections: ["towards_stormgade", "towards_vandkunsten"],
    evaluationRules: {
      excludeFridays: true,
      weekdaySampleCount: 3,
      excludedModesByDirection: {
        towards_stormgade: ["pedestrian"],
        towards_vandkunsten: ["pedestrian"],
      },
      seasonalMismatchWarning: true,
      separateCarsVansTrucks: true,
    },
    notes:
      "Pre pedestrians excluded (scaffold 2023). Bike counts may reflect wide-lens change 2025 or season (Oct vs May). Consider excluding bikes from evaluation.",
  },
  {
    id: "wb-hojbro",
    kind: "otc_workbook_site",
    name: "Højbro / Vindebrogade",
    lat: 55.67747552,
    lon: 12.57977486,
    pilotIds: ["cph-p1", "cph-p3"],
    linkedDatasetIds: ["cph-otc-counts", "cph-manual-counts"],
    otcWorkbookKey: "hojbro",
    mapVisible: true,
    monitoredDirections: ["north", "south"],
    evaluationRules: {
      excludeFridays: true,
      weekdaySampleCount: 3,
      seasonalMismatchWarning: true,
    },
    notes:
      "Prefer manual counts for absolute active mobility where OTC has west-side pedestrian blind spots. Autumn 2023 pre vs May 2025 post seasonal bias.",
  },
];

const TELRAAM_COUNTERS: CopenhagenLocation[] = [
  {
    id: "telraam-vestergade-5",
    kind: "telraam_counter",
    name: "Telraam — Vestergade 5",
    lat: 55.677906,
    lon: 12.571005,
    pilotIds: ["cph-p1"],
    linkedDatasetIds: ["cph-telraam"],
    mapVisible: true,
    notes: "Partner headline site: -16% motorized, +3% bicycle, +14% pedestrian (relative change only; pedestrians undercounted).",
  },
  {
    id: "telraam-vognmagergade-8",
    kind: "telraam_counter",
    name: "Telraam — Vognmagergade 8",
    lat: 55.682486,
    lon: 12.57885,
    pilotIds: ["cph-p1"],
    linkedDatasetIds: ["cph-telraam"],
    mapVisible: true,
    notes: "High ped/bike increase may reflect KVUC building activity; use with caution.",
  },
  {
    id: "telraam-rosenborggade-15",
    kind: "telraam_counter",
    name: "Telraam — Rosenborggade 15",
    lat: 55.684086,
    lon: 12.57477,
    pilotIds: ["cph-p1"],
    linkedDatasetIds: ["cph-telraam"],
    mapVisible: true,
    notes: "Exclude pedestrian counts; Telraam undercounts pedestrians (<80% capture).",
  },
  {
    id: "telraam-studiestraede-47b",
    kind: "telraam_counter",
    name: "Telraam — Studiestræde 47B",
    lat: 55.67781,
    lon: 12.567492,
    pilotIds: ["cph-p1"],
    linkedDatasetIds: ["cph-telraam"],
    mapVisible: true,
    notes: "Exclude pedestrian counts for certainty; relative change only if used.",
  },
];

const FLOW_CAMERAS: CopenhagenLocation[] = [
  {
    id: "platomo-1",
    kind: "flow_camera",
    name: "Platomo — Frederiksholmskanal",
    lat: 55.675535,
    lon: 12.575545,
    pilotIds: ["cph-p1"],
    linkedDatasetIds: ["cph-flow-cameras", "cph-platomo"],
    mapVisible: true,
  },
  {
    id: "platomo-2",
    kind: "flow_camera",
    name: "Platomo — Stormgade",
    lat: 55.675535,
    lon: 12.575545,
    pilotIds: ["cph-p1"],
    linkedDatasetIds: ["cph-flow-cameras", "cph-platomo"],
    mapVisible: true,
  },
  {
    id: "platomo-3",
    kind: "flow_camera",
    name: "Platomo — Gammeltorv",
    lat: 55.678437,
    lon: 12.572236,
    pilotIds: ["cph-p1"],
    linkedDatasetIds: ["cph-flow-cameras", "cph-platomo"],
    mapVisible: true,
  },
  {
    id: "platomo-4",
    kind: "flow_camera",
    name: "Platomo — Skindergade",
    lat: 55.678437,
    lon: 12.572236,
    pilotIds: ["cph-p1"],
    linkedDatasetIds: ["cph-flow-cameras", "cph-platomo"],
    mapVisible: true,
  },
  {
    id: "platomo-5",
    kind: "flow_camera",
    name: "Platomo — Hojbro",
    lat: 55.677575,
    lon: 12.579961,
    pilotIds: ["cph-p1"],
    linkedDatasetIds: ["cph-flow-cameras", "cph-platomo"],
    mapVisible: true,
  },
  {
    id: "platomo-6",
    kind: "flow_camera",
    name: "Platomo — Norreport",
    lat: 55.682312,
    lon: 12.570922,
    pilotIds: ["cph-p1"],
    linkedDatasetIds: ["cph-flow-cameras", "cph-platomo"],
    mapVisible: true,
  },
];

const MANUAL_SURVEY_SITES: CopenhagenLocation[] = SURVEY_SITES.map((site) => ({
  id: site.id,
  kind: "manual_survey_site" as const,
  name: site.name,
  lat: site.lat,
  lon: site.lon,
  pilotIds: ["cph-p1", "cph-p3"] as CopenhagenPilotId[],
  linkedDatasetIds: ["cph-manual-counts"],
  mapVisible: false,
}));

export const COPENHAGEN_LOCATIONS: CopenhagenLocation[] = [
  ...INTELLIGENT_CAMERAS,
  ...OTC_WORKBOOK_SITES,
  ...TELRAAM_COUNTERS,
  ...FLOW_CAMERAS,
  ...MANUAL_SURVEY_SITES,
];

export const COPENHAGEN_TELRAAM_OUTCOMES: Record<string, CopenhagenTelraamOutcome> = {
  "telraam-vestergade-5": {
    motorizedPctChange: -16,
    bicyclePctChange: 3,
    pedestrianPctChange: 14,
    period: "Weekdays 07:00–19:00, Mar–Jun 2024 vs Mar–Jun 2025",
    source: "Telraam Vestergade 5 (partner-reported, Maria Risom Nov 2025)",
    pedestrianUndercountWarning: true,
  },
  "telraam-vognmagergade-8": {
    motorizedPctChange: -20,
    bicyclePctChange: 107,
    period: "Weekdays 07:00–19:00, Mar–Jun 2024 vs Mar–Jun 2025",
    source: "Telraam Vognmagergade 8 (partner summary workbook)",
    pedestrianUndercountWarning: true,
    cautionNote:
      "Large bicycle increase may partly reflect KVUC building activity; interpret relative change with caution.",
  },
  "telraam-rosenborggade-15": {
    motorizedPctChange: -15,
    bicyclePctChange: -3,
    period: "Weekdays 07:00–19:00, Mar–Jun 2024 vs Mar–Jun 2025",
    source: "Telraam Rosenborggade 15 (partner summary workbook)",
    pedestrianUndercountWarning: true,
    cautionNote: "Exclude absolute pedestrian volumes; Telraam undercounts pedestrians (<80% capture).",
  },
  "telraam-studiestraede-47b": {
    motorizedPctChange: -10,
    bicyclePctChange: 5,
    pedestrianPctChange: 6,
    period: "Weekdays 07:00–19:00, Mar–Jun 2024 vs Mar–Jun 2025",
    source: "Telraam Studiestræde 47B (partner summary workbook)",
    pedestrianUndercountWarning: true,
    cautionNote: "Pedestrian relative change shown for context only; hardware undercounts absolute volumes.",
  },
};

/** @deprecated Use COPENHAGEN_TELRAAM_OUTCOMES["telraam-vestergade-5"] */
export const COPENHAGEN_TELRAAM_VESTERGADE_OUTCOME: CopenhagenTelraamOutcome =
  COPENHAGEN_TELRAAM_OUTCOMES["telraam-vestergade-5"];

export function getTelraamOutcomeForLocation(
  locationId: string | null | undefined
): CopenhagenTelraamOutcome | undefined {
  if (!locationId) return undefined;
  return COPENHAGEN_TELRAAM_OUTCOMES[locationId];
}

export function getOtcEvaluationRulesForWorkbook(
  workbookKey: string | null | undefined
): CopenhagenEvaluationRules | undefined {
  if (!workbookKey) return undefined;
  const site = OTC_WORKBOOK_SITES.find((loc) => loc.otcWorkbookKey === workbookKey);
  return site?.evaluationRules;
}

/** Partner methodology constraints (Maria Risom traffic analysis rules). */
export interface MethodologyConstraint {
  excludePedestrians?: boolean;
  excludeBicycles?: boolean;
  directionalExclusions?: {
    direction: TrafficDirection;
    modes: string[];
  }[];
  warnings: string[];
}

export const COPENHAGEN_METHODOLOGY_RULES: Record<string, MethodologyConstraint> = {
  stormgade: {
    excludePedestrians: true,
    excludeBicycles: true,
    warnings: [
      "Pedestrian counts excluded: 2023 baseline incomplete due to sidewalk scaffolding.",
      "Bicycle counts excluded from evaluation: 2025 lens hardware modification and seasonal variation (Oct vs. May) distort pre/post comparison.",
      "Motorcycle counts omitted to prevent misclassification with bicycles.",
    ],
  },
  norreport: {
    directionalExclusions: [
      {
        direction: "north",
        modes: ["pedestrian", "bicycle"],
      },
    ],
    warnings: [
      "Northbound active mobility data hidden: Eastern side sun-cover partially blinded the camera sensor on sunny days in 2025.",
      "Southbound active mobility drop under investigation: Sidewalk construction in Spring 2025 restricted southbound pedestrian traffic.",
    ],
  },
  hojbro: {
    excludePedestrians: true,
    warnings: [
      "OTC Pedestrian data disabled: Sensor failed to detect pedestrians on the western side of the bridge.",
      "Seasonal Variation Warning: Baseline captured in Autumn 2023 vs. Post-intervention in May 2025. Cross-reference with Manual Counts layer if required.",
      "External Variable: Heavy construction at Kirkestræde throughout Winter/Spring 2025 may impact private vehicle routing.",
    ],
  },
  vandkunsten: {
    warnings: [
      "Data Warning: Local intersection construction has caused irregular vehicle circulation loops and wrong-way driving patterns.",
    ],
  },
  "vestergade-5": {
    excludePedestrians: true,
    warnings: [
      "Telraam hardware undercounts absolute pedestrian volumes by over 20%. Only relative percentage changes should be evaluated.",
    ],
  },
};

const METHODOLOGY_KEY_ALIASES: Record<string, string> = {
  "frederiksholms-kanal": "stormgade",
  "ic-stormgade": "stormgade",
  "wb-stormgade": "stormgade",
  "ic-hojbro": "hojbro",
  "wb-hojbro": "hojbro",
  "wb-norreport": "norreport",
  "ic-norreport": "norreport",
  "wb-vandkunsten": "vandkunsten",
  "telraam-vestergade-5": "vestergade-5",
};

export function getMethodologyConstraint(lookupId: string): MethodologyConstraint | undefined {
  const normalized = lookupId.toLowerCase().replace(/^(loc:|site:)/, "");
  const canonical = METHODOLOGY_KEY_ALIASES[normalized] ?? normalized;
  return COPENHAGEN_METHODOLOGY_RULES[canonical];
}

export function resolveMethodologyConstraint(input: {
  selectionId?: string | null;
  siteName?: string;
  locationId?: string;
}): MethodologyConstraint | undefined {
  const { selectionId, siteName, locationId } = input;

  if (locationId) {
    const fromLoc = getMethodologyConstraint(locationId);
    if (fromLoc) return fromLoc;
    const loc = getLocationById(locationId);
    if (loc?.otcWorkbookKey) {
      const fromWb = getMethodologyConstraint(loc.otcWorkbookKey);
      if (fromWb) return fromWb;
    }
  }

  if (selectionId) {
    const stripped = selectionId.replace(/^(loc:|site:)/, "");
    const fromId = getMethodologyConstraint(stripped);
    if (fromId) return fromId;
    if (selectionId.startsWith("site:")) {
      const fromSite = getMethodologyConstraint(stripped);
      if (fromSite) return fromSite;
    }
    if (selectionId.startsWith("loc:")) {
      const loc = getLocationById(stripped);
      if (loc) {
        if (loc.kind === "telraam_counter") {
          const fromAlias = getMethodologyConstraint(loc.id);
          if (fromAlias) return fromAlias;
          return {
            excludePedestrians: true,
            warnings: loc.notes ? [loc.notes] : ["Telraam relative change only."],
          };
        }
        if (loc.id === "ic-hojbro") {
          return getMethodologyConstraint("hojbro");
        }
        if (loc.otcWorkbookKey) {
          return getMethodologyConstraint(loc.otcWorkbookKey);
        }
      }
    }
  }

  if (siteName) {
    const workbookKey = inferOtcWorkbookKey(siteName);
    if (workbookKey) {
      return getMethodologyConstraint(workbookKey);
    }
  }

  return undefined;
}

export function getLocationsForPilot(
  pilotId: string | null | undefined,
  options?: { includeHiddenSurveySites?: boolean }
): CopenhagenLocation[] {
  if (!pilotId?.startsWith("cph-")) return [];
  return COPENHAGEN_LOCATIONS.filter((loc) => {
    if (!loc.pilotIds.includes(pilotId as CopenhagenPilotId)) return false;
    if (loc.kind === "manual_survey_site" && !options?.includeHiddenSurveySites) {
      return loc.mapVisible === true;
    }
    return loc.mapVisible !== false;
  });
}

export function getOtcWorkbookKeysForPilot(pilotId: string | null | undefined): Set<string> {
  const keys = new Set<string>();
  getLocationsForPilot(pilotId).forEach((loc) => {
    if (loc.otcWorkbookKey) keys.add(loc.otcWorkbookKey);
  });
  return keys;
}

/** Map OTC parser site name / street label to workbook key. */
export function inferOtcWorkbookKey(siteName: string): string | null {
  const value = siteName.toLowerCase();
  if (value.includes("norregade") || value.includes("norreport") || value.includes("nørre")) {
    return "norreport";
  }
  if (value.includes("vandkunsten") || value.includes("rådhus") || value.includes("radhuus")) {
    return "vandkunsten";
  }
  if (value.includes("gammeltorv") || value.includes("vestergade")) {
    return "gammeltorv";
  }
  if (value.includes("frederiksholms") || value.includes("stormgade")) {
    return "stormgade";
  }
  if (value.includes("hojbro") || value.includes("højbro") || value.includes("vindebrogade")) {
    return "hojbro";
  }
  return null;
}

export function otcRecordMatchesPilotScope(
  siteName: string,
  pilotId: string | null | undefined
): boolean {
  if (!pilotId?.startsWith("cph-")) return true;
  const workbookKey = inferOtcWorkbookKey(siteName);
  if (!workbookKey) return false;
  return getOtcWorkbookKeysForPilot(pilotId).has(workbookKey);
}

/** Pilot scope for any Copenhagen normalized record (OTC, Telraam, surveys, parking, etc.). */
export function copenhagenRecordMatchesPilotScope(
  record: { interventionId?: string; streetName?: string },
  pilotId: string | null | undefined
): boolean {
  if (!pilotId?.startsWith("cph-")) return true;
  if (record.interventionId === pilotId) return true;
  const siteName = record.streetName ?? "";
  if (siteName && otcRecordMatchesPilotScope(siteName, pilotId)) return true;
  return false;
}

export function getLocationById(id: string): CopenhagenLocation | undefined {
  return COPENHAGEN_LOCATIONS.find((loc) => loc.id === id);
}

export type CopenhagenLatLngBounds = [[number, number], [number, number]];

function copenhagenPilotBoundsSites(pilotId: string): CopenhagenLocation[] {
  return getLocationsForPilot(pilotId).filter((loc) => {
    if (loc.mapVisible === false) return false;
    if (loc.kind === "manual_survey_site") return false;
    if (pilotId === "cph-p2") {
      const workbookKey = loc.otcWorkbookKey ?? inferOtcWorkbookKey(loc.name);
      return workbookKey === "vandkunsten" || loc.id.includes("vandkunsten");
    }
    return true;
  });
}

export function getCopenhagenPilotLatLngBounds(pilotId: string): CopenhagenLatLngBounds | null {
  const sites = copenhagenPilotBoundsSites(pilotId);
  if (!sites.length) return null;

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  sites.forEach((site) => {
    minLat = Math.min(minLat, site.lat);
    maxLat = Math.max(maxLat, site.lat);
    minLon = Math.min(minLon, site.lon);
    maxLon = Math.max(maxLon, site.lon);
  });

  const spanLat = Math.max(0.0004, maxLat - minLat);
  const spanLon = Math.max(0.0004, maxLon - minLon);
  const padLat =
    pilotId === "cph-p2"
      ? Math.max(0.001, spanLat * 0.42)
      : pilotId === "cph-p3"
        ? Math.max(0.0018, spanLat * 0.24)
        : Math.max(0.0022, spanLat * 0.28);
  const padLon =
    pilotId === "cph-p2"
      ? Math.max(0.0014, spanLon * 0.42)
      : pilotId === "cph-p3"
        ? Math.max(0.0022, spanLon * 0.24)
        : Math.max(0.0028, spanLon * 0.28);

  return [
    [minLat - padLat, minLon - padLon],
    [maxLat + padLat, maxLon + padLon],
  ];
}

export function getCopenhagenPilotMapFocusFromRegistry(
  pilotId: string
): { lat: number; lon: number; zoom: number } | null {
  const bounds = getCopenhagenPilotLatLngBounds(pilotId);
  if (!bounds) return null;
  const [[minLat, minLon], [maxLat, maxLon]] = bounds;
  const lat = (minLat + maxLat) / 2;
  const lon = (minLon + maxLon) / 2;
  const zoom =
    pilotId === "cph-p2" ? 17 : pilotId === "cph-p3" ? 16 : pilotId === "cph-p1" ? 15 : 16;
  return { lat, lon, zoom };
}

export function getCopenhagenPilotZoneAnchorFromRegistry(pilotId: string): {
  lat: number;
  lon: number;
  radiusDeg: number;
} | null {
  const sites = getLocationsForPilot(pilotId).filter(
    (loc) => loc.kind !== "manual_survey_site"
  );
  if (!sites.length) return null;
  const lat = sites.reduce((sum, site) => sum + site.lat, 0) / sites.length;
  const lon = sites.reduce((sum, site) => sum + site.lon, 0) / sites.length;
  const maxDist = sites.reduce((max, site) => {
    const dLat = site.lat - lat;
    const dLon = site.lon - lon;
    return Math.max(max, Math.sqrt(dLat * dLat + dLon * dLon));
  }, 0);
  return {
    lat,
    lon,
    radiusDeg: Math.max(0.008, maxDist + 0.004),
  };
}
