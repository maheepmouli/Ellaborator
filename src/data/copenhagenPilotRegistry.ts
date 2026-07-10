import type { CopenhagenPilotId } from "@/data/copenhagenLocationRegistry";

export type CopenhagenEvaluationFocus = "mobility" | "safety" | "infrastructure";

export type CopenhagenInterventionStatus = "completed" | "monitoring" | "planned";

export interface CopenhagenPilotObjective {
  primary: string;
  secondary: string[];
}

export interface CopenhagenPilotIntervention {
  summary: string;
  sites: string[];
  status: CopenhagenInterventionStatus;
}

export interface CopenhagenPilotEvaluation {
  focus: CopenhagenEvaluationFocus;
  methods: string[];
  datasets: string[];
  caveats: string[];
}

export interface CopenhagenPilotRecord {
  id: CopenhagenPilotId;
  code: string;
  title: string;
  partner: string;
  locationIds: string[];
  objective: CopenhagenPilotObjective;
  intervention: CopenhagenPilotIntervention;
  evaluation: CopenhagenPilotEvaluation;
  primaryKpis: string[];
  primaryDatasetIds: string[];
  geometryRegime: "camera_directional";
}

export const COPENHAGEN_PILOT_REGISTRY: Record<CopenhagenPilotId, CopenhagenPilotRecord> = {
  "cph-p1": {
    id: "cph-p1",
    code: "CPHK1",
    title: "Relocation of car parking in streets",
    partner: "Copenhagen Municipality / UCPH",
    locationIds: [
      "ic-norreport",
      "ic-gammeltorv",
      "ic-stormgade",
      "ic-hojbro",
      "wb-norreport",
      "wb-gammeltorv",
      "wb-stormgade",
      "telraam-vestergade-5",
      "telraam-vognmagergade-8",
      "telraam-rosenborggade-15",
      "telraam-studiestraede-47b",
    ],
    objective: {
      primary: "Reduce car traffic in the Medieval City and repurpose street space for walking and cycling.",
      secondary: [
        "Shift trips toward walking and cycling.",
        "Improve public realm through parking reallocation.",
      ],
    },
    intervention: {
      summary:
        "Relocation of on-street car parking across the Medieval City to create space for active mobility.",
      sites: [
        "Medieval City corridors",
        "Nørregade / Nørreport",
        "Frederiksholms Kanal / Stormgade",
        "Gammeltorv / Vestergade",
        "Højbro",
      ],
      status: "monitoring",
    },
    evaluation: {
      focus: "mobility",
      methods: [
        "OpenTrafficCam directional counts",
        "Flow cameras",
        "Manual traffic counts",
        "Telraam counters",
        "Travel surveys",
        "Car-user survey",
      ],
      datasets: [
        "cph-otc-counts",
        "cph-flow-cameras",
        "cph-manual-counts",
        "cph-telraam",
        "cph-travel-survey",
        "cph-car-user-survey",
      ],
      caveats: [
        "Exclude Fridays from OTC windows (3 full weekdays, aligned with manual counts).",
        "Separate cars, vans, and trucks — do not combine for parking-reallocation analysis.",
        "Account for directional bias and seasonal pre/post mismatch (e.g. May vs October).",
        "Telraam pedestrians are undercounted; use relative change only or exclude pedestrians.",
        "Exclude counts affected by scaffold, sun cover, or construction bias.",
      ],
    },
    primaryKpis: ["kpi1.2", "kpi3.2", "kpi4.1"],
    primaryDatasetIds: [
      "cph-otc-counts",
      "cph-flow-cameras",
      "cph-manual-counts",
      "cph-telraam",
      "cph-travel-survey",
      "cph-car-user-survey",
    ],
    geometryRegime: "camera_directional",
  },
  "cph-p2": {
    id: "cph-p2",
    code: "CPHK2",
    title: "Enhanced bicycle parking",
    partner: "Copenhagen Municipality / UCPH",
    locationIds: [
      "ic-vandkunsten-1",
      "ic-vandkunsten-2",
      "ic-vandkunsten-3",
      "ic-vandkunsten-4",
      "wb-vandkunsten",
    ],
    objective: {
      primary: "Increase bicycle parking capacity while improving pedestrian accessibility.",
      secondary: ["Support cargo-bike parking demand near intervention nodes."],
    },
    intervention: {
      summary: "Deployment of enhanced bicycle parking infrastructure around Vandkunsten.",
      sites: ["Vandkunsten / Rådhusstræde"],
      status: "completed",
    },
    evaluation: {
      focus: "infrastructure",
      methods: [
        "Bicycle parking counts",
        "Bicycle parking photos",
        "Interviews",
        "Explorative walks",
        "OpenTrafficCam at Vandkunsten (supporting context only)",
      ],
      datasets: [
        "cph-bike-parking-inventory",
        "cph-bike-parking-photos",
        "cph-interviews",
        "cph-explorative-walks",
        "cph-otc-counts",
      ],
      caveats: [
        "Dashboard emphasis is infrastructure deployment, not traffic reduction.",
        "OTC directional counts provide corridor context but are not the primary KPI evidence.",
      ],
    },
    primaryKpis: ["kpi3.1", "kpi4.1", "kpi4.2"],
    primaryDatasetIds: [
      "cph-bike-parking-inventory",
      "cph-bike-parking-photos",
      "cph-interviews",
      "cph-explorative-walks",
      "cph-otc-counts",
    ],
    geometryRegime: "camera_directional",
  },
  "cph-p3": {
    id: "cph-p3",
    code: "CPHK3",
    title: "Traffic flow adjustment / near encounters",
    partner: "Copenhagen Municipality / UCPH",
    locationIds: [
      "ic-gammeltorv",
      "ic-norreport",
      "ic-vandkunsten-1",
      "ic-vandkunsten-2",
      "ic-vandkunsten-3",
      "ic-vandkunsten-4",
      "ic-stormgade",
      "ic-hojbro",
      "wb-gammeltorv",
      "wb-norreport",
      "wb-vandkunsten",
      "wb-stormgade",
    ],
    objective: {
      primary: "Improve traffic flow and reduce unsafe near encounters in the Medieval City.",
      secondary: ["Support calmer street design through safety-oriented monitoring."],
    },
    intervention: {
      summary: "Traffic flow adjustments and near-encounter monitoring at key medieval-city junctions.",
      sites: ["Rådhusstræde", "Vandkunsten", "Gammeltorv", "Nørregade / Nørreport", "Højbro"],
      status: "monitoring",
    },
    evaluation: {
      focus: "safety",
      methods: [
        "OpenTrafficCam directional trajectories",
        "Near encounters analysis",
        "iRAP Star Rating",
        "Speed measurements",
        "Conflict analysis",
      ],
      datasets: [
        "cph-otc-counts",
        "cph-near-encounters",
        "cph-irap-ratings",
        "cph-speed-measurements",
        "cph-conflict-analysis",
      ],
      caveats: [
        "Dashboard emphasis is safety, not mobility mode-share reduction.",
        "Shared OTC sites with CPHK1 must not bleed evaluation framing across pilots.",
        "Apply site-specific mode and direction exclusions from partner counting notes.",
      ],
    },
    primaryKpis: ["kpi1.2", "kpi2.1", "kpi3.1", "kpi4.1"],
    primaryDatasetIds: [
      "cph-otc-counts",
      "cph-near-encounters",
      "cph-irap-ratings",
      "cph-speed-measurements",
      "cph-conflict-analysis",
    ],
    geometryRegime: "camera_directional",
  },
};

export function getCopenhagenPilotRecord(
  pilotId: string | null | undefined
): CopenhagenPilotRecord | null {
  if (!pilotId || !(pilotId in COPENHAGEN_PILOT_REGISTRY)) return null;
  return COPENHAGEN_PILOT_REGISTRY[pilotId as CopenhagenPilotId];
}

export function getCopenhagenObservatoryTitle(pilotId: string | null | undefined): string {
  const record = getCopenhagenPilotRecord(pilotId);
  if (!record) return "Copenhagen Intervention Observatory";
  switch (record.evaluation.focus) {
    case "mobility":
      return "Copenhagen Mobility Observatory";
    case "infrastructure":
      return "Copenhagen Infrastructure Observatory";
    case "safety":
      return "Copenhagen Safety Observatory";
    default:
      return "Copenhagen Intervention Observatory";
  }
}
