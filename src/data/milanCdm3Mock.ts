import { MILAN_PILOT_ANCHORS } from "@/lib/milanMapConfig";
import type { LocalCityPoint } from "@/services/localCityData";
import type { ScenarioType } from "@/types/normalized-city-data";

export const MILAN_CDM3_MOCK_DISCLAIMER =
  "Illustrative CDM3 Decision Support System dataset for dashboard demonstration — structured like OSM barrier mapping and DSS pre/post evaluation along West Axis and Olympic Routes. Not a certified field audit.";

export type MilanCdm3ActivityStatus = "done" | "active" | "planned";

export interface MilanCdm3Activity {
  id: string;
  number: number;
  title: string;
  description: string;
  status: MilanCdm3ActivityStatus;
}

export interface MilanCdm3CorridorNode {
  id: string;
  label: string;
  lat: number;
  lon: number;
  corridorGroup: "West Axis" | "Olympic Routes";
}

export type MilanCdm3BarrierCategory =
  | "Step-free access"
  | "Tactile paving continuity"
  | "Crossing width ≥ 2.4 m"
  | "Obstacle-free footway"
  | "Accessible PT stop"
  | "Rest area / seating"
  | "Adequate lighting"
  | "Contrasting edge strips";

export interface MilanCdm3BarrierFeature {
  id: string;
  nodeId: string;
  category: MilanCdm3BarrierCategory;
  osmTag: string;
  baselineScore: number;
  interventionScore: number;
  starRatingBaseline: number;
  starRatingIntervention: number;
  status: "mapped" | "improved" | "planned";
}

export interface MilanCdm3ModeShareSite {
  id: string;
  nodeId: string;
  label: string;
  lat: number;
  lon: number;
  baselineSustainablePct: number;
  interventionSustainablePct: number;
  modeBreakdown: {
    pre: { bike: number; pedestrian: number; motorised: number; ptw: number; pt: number; total: number };
    post: { bike: number; pedestrian: number; motorised: number; ptw: number; pt: number; total: number };
  };
}

export interface MilanCdm3SurveySample {
  id: string;
  nodeId: string;
  theme: string;
  baselineScore: number;
  interventionScore: number;
  lat: number;
  lon: number;
}

export interface MilanCdm3ExpectedOutcomes {
  sustainableModeShareBaselinePct: number;
  sustainableModeShareInterventionPct: number;
  safetyStarBaseline: number;
  safetyStarIntervention: number;
  accessibilityIndexBaseline: number;
  accessibilityIndexIntervention: number;
  co2ProxyBaselineKgDay: number;
  co2ProxyInterventionKgDay: number;
}

export interface MilanCdm3PilotMock {
  pilotId: "mil-p3";
  title: string;
  interventionSummary: string;
  activities: MilanCdm3Activity[];
  expectedOutcomes: MilanCdm3ExpectedOutcomes;
  corridorNodes: MilanCdm3CorridorNode[];
  barrierFeatures: MilanCdm3BarrierFeature[];
  modeShareSites: MilanCdm3ModeShareSite[];
  surveySamples: MilanCdm3SurveySample[];
  disclaimer: string;
  methodology: string;
  confidencePct: number;
}

function seededUnit(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return (hash % 1000) / 1000;
}

const CDM3_CORRIDOR_NODES: MilanCdm3CorridorNode[] = [
  {
    id: "west-buenos-aires",
    label: "Corso Buenos Aires · DSS priority segment",
    lat: 45.4778,
    lon: 9.2102,
    corridorGroup: "West Axis",
  },
  {
    id: "west-plinio",
    label: "West Axis · Via Plinio crossing",
    lat: 45.4682,
    lon: 9.2148,
    corridorGroup: "West Axis",
  },
  {
    id: "west-selinunte",
    label: "West Axis · Piazzale Selinunte",
    lat: 45.4625,
    lon: 9.222,
    corridorGroup: "West Axis",
  },
  {
    id: "olympic-olona",
    label: "Olympic Route · Viale Olona",
    lat: 45.4615,
    lon: 9.1685,
    corridorGroup: "Olympic Routes",
  },
  {
    id: "olympic-domodossola",
    label: "Olympic Route · Via Domodossola",
    lat: 45.471,
    lon: 9.175,
    corridorGroup: "Olympic Routes",
  },
  {
    id: "olympic-sempione",
    label: "Olympic Route · Parco Sempione approach",
    lat: 45.4735,
    lon: 9.172,
    corridorGroup: "Olympic Routes",
  },
];

const BARRIER_SLOTS: Array<{
  nodeId: string;
  category: MilanCdm3BarrierCategory;
  osmTag: string;
  status: MilanCdm3BarrierFeature["status"];
}> = [
  { nodeId: "west-buenos-aires", category: "Step-free access", osmTag: "highway=elevator", status: "improved" },
  { nodeId: "west-buenos-aires", category: "Tactile paving continuity", osmTag: "tactile_paving=yes", status: "improved" },
  { nodeId: "west-plinio", category: "Crossing width ≥ 2.4 m", osmTag: "crossing=marked", status: "mapped" },
  { nodeId: "west-plinio", category: "Obstacle-free footway", osmTag: "footway=accessibility", status: "improved" },
  { nodeId: "west-selinunte", category: "Accessible PT stop", osmTag: "public_transport=platform", status: "planned" },
  { nodeId: "olympic-olona", category: "Rest area / seating", osmTag: "amenity=bench", status: "improved" },
  { nodeId: "olympic-domodossola", category: "Adequate lighting", osmTag: "lit=yes", status: "mapped" },
  { nodeId: "olympic-sempione", category: "Contrasting edge strips", osmTag: "barrier=kerb", status: "improved" },
];

function buildBarrierFeatures(): MilanCdm3BarrierFeature[] {
  return BARRIER_SLOTS.map((slot, index) => {
    const seed = `mil-p3-a11y-${slot.nodeId}-${slot.category}`;
    const u = seededUnit(seed);
    const baselineScore = Math.round(52 + u * 22 + index * 1.2);
    const interventionScore = Math.min(96, Math.round(baselineScore + 6 + u * 12));
    const starRatingBaseline = Math.round((2.4 + u * 0.8) * 10) / 10;
    const starRatingIntervention = Math.min(5, Math.round((starRatingBaseline + 0.5 + u * 0.6) * 10) / 10);
    return {
      id: `mil-p3-barrier-${index + 1}`,
      nodeId: slot.nodeId,
      category: slot.category,
      osmTag: slot.osmTag,
      baselineScore,
      interventionScore,
      starRatingBaseline,
      starRatingIntervention,
      status: slot.status,
    };
  });
}

function nodeById(nodeId: string): MilanCdm3CorridorNode {
  return CDM3_CORRIDOR_NODES.find((n) => n.id === nodeId) ?? CDM3_CORRIDOR_NODES[0];
}

function buildModeShareSites(): MilanCdm3ModeShareSite[] {
  const siteNodes = CDM3_CORRIDOR_NODES.slice(0, 4);
  return siteNodes.map((node, index) => {
    const u = seededUnit(`mil-p3-ms-${node.id}`);
    const preBike = Math.round(80 + u * 40 + index * 8);
    const prePed = Math.round(120 + u * 60 + index * 12);
    const preMotor = Math.round(920 - index * 35 - u * 40);
    const prePt = Math.round(180 + u * 30);
    const preTotal = preBike + prePed + preMotor + prePt;
    const postBike = Math.round(preBike * (1.12 + u * 0.08));
    const postPed = Math.round(prePed * (1.08 + u * 0.06));
    const postMotor = Math.round(preMotor * (0.88 - u * 0.04));
    const postPt = Math.round(prePt * (1.05 + u * 0.04));
    const postTotal = postBike + postPed + postMotor + postPt;
    const baselineSustainablePct = ((preBike + prePed) / preTotal) * 100;
    const interventionSustainablePct = ((postBike + postPed) / postTotal) * 100;
    return {
      id: `mil-p3-count-${node.id}`,
      nodeId: node.id,
      label: node.label,
      lat: node.lat + (index % 2 === 0 ? 0.00012 : -0.0001),
      lon: node.lon + (index % 2 === 0 ? -0.00008 : 0.00011),
      baselineSustainablePct: Math.round(baselineSustainablePct * 10) / 10,
      interventionSustainablePct: Math.round(interventionSustainablePct * 10) / 10,
      modeBreakdown: {
        pre: {
          bike: preBike,
          pedestrian: prePed,
          motorised: preMotor,
          ptw: Math.round(preMotor * 0.08),
          pt: prePt,
          total: preTotal,
        },
        post: {
          bike: postBike,
          pedestrian: postPed,
          motorised: postMotor,
          ptw: Math.round(postMotor * 0.07),
          pt: postPt,
          total: postTotal,
        },
      },
    };
  });
}

function buildSurveySamples(): MilanCdm3SurveySample[] {
  const themes = [
    "DSS usability (Activity 5)",
    "Barrier mapping clarity (Activity 1)",
    "Pre/post evaluation trust (Activity 4)",
    "Stakeholder prioritisation (Activity 2)",
  ];
  return themes.map((theme, index) => {
    const node = CDM3_CORRIDOR_NODES[index % CDM3_CORRIDOR_NODES.length];
    const u = seededUnit(`mil-p3-survey-${index}`);
    return {
      id: `mil-p3-survey-${index + 1}`,
      nodeId: node.id,
      theme,
      baselineScore: Math.round((3.1 + u * 0.5) * 10) / 10,
      interventionScore: Math.round((3.6 + u * 0.55) * 10) / 10,
      lat: node.lat + 0.00015 * (index - 1),
      lon: node.lon - 0.00012 * index,
    };
  });
}

const MILAN_CDM3_PROFILE: MilanCdm3PilotMock = {
  pilotId: "mil-p3",
  title: "CDM3 — Decision Support System for accessibility in public spaces",
  interventionSummary:
    "Digital DSS supporting planning and prioritisation of accessibility improvements along West Axis and Olympic Routes — mapping OSM barriers, evaluating pre/post intervention accessibility, and disseminating replicable methods.",
  activities: [
    {
      id: "cdm3-a1",
      number: 1,
      title: "OSM barrier & mobility infrastructure mapping",
      description:
        "Map architectural barriers and mobility infrastructure using OpenStreetMap tags linked to the DSS walk graph.",
      status: "done",
    },
    {
      id: "cdm3-a2",
      number: 2,
      title: "DSS decision-support tool",
      description:
        "Integrate mapped barrier data into a prioritisation engine for accessibility interventions in public space.",
      status: "done",
    },
    {
      id: "cdm3-a3",
      number: 3,
      title: "Use cases & KPI alignment",
      description:
        "Define DSS use cases and KPI 4.2 / safety / mode-share indicators for Olympic Routes and West Axis corridors.",
      status: "active",
    },
    {
      id: "cdm3-a4",
      number: 4,
      title: "Pre/post accessibility evaluation",
      description:
        "Apply DSS to compare baseline vs post-intervention accessibility scores along monitored corridor nodes.",
      status: "active",
    },
    {
      id: "cdm3-a5",
      number: 5,
      title: "Web interface study",
      description:
        "Preliminary user-friendly web interface for planners to explore barrier layers and intervention scenarios.",
      status: "planned",
    },
    {
      id: "cdm3-a6",
      number: 6,
      title: "Dissemination",
      description:
        "Share mapping methods and DSS outcomes through conferences, publications, and professional networks.",
      status: "planned",
    },
  ],
  expectedOutcomes: {
    sustainableModeShareBaselinePct: 24.6,
    sustainableModeShareInterventionPct: 29.8,
    safetyStarBaseline: 3.1,
    safetyStarIntervention: 3.8,
    accessibilityIndexBaseline: 61,
    accessibilityIndexIntervention: 74,
    co2ProxyBaselineKgDay: 248,
    co2ProxyInterventionKgDay: 214,
  },
  corridorNodes: CDM3_CORRIDOR_NODES,
  barrierFeatures: buildBarrierFeatures(),
  modeShareSites: buildModeShareSites(),
  surveySamples: buildSurveySamples(),
  disclaimer: MILAN_CDM3_MOCK_DISCLAIMER,
  methodology:
    "Six corridor nodes on West Axis and Olympic Routes · eight OSM-aligned barrier categories · walk_graph.shp geometry context · illustrative pre/post scores aligned with CDM3 WP7 KPI 4.2 format.",
  confidencePct: 58,
};

export function getMilanCdm3Mock(): MilanCdm3PilotMock {
  return MILAN_CDM3_PROFILE;
}

export function milanCdm3AggregateAccessibility(
  profile: MilanCdm3PilotMock,
  scenario: ScenarioType
): { baseline: number; intervention: number; change: number } {
  const baseline =
    profile.barrierFeatures.reduce((s, f) => s + f.baselineScore, 0) / profile.barrierFeatures.length;
  const intervention =
    profile.barrierFeatures.reduce((s, f) => s + f.interventionScore, 0) / profile.barrierFeatures.length;
  if (scenario === "baseline") return { baseline, intervention: baseline, change: 0 };
  if (scenario === "comparison") return { baseline, intervention, change: intervention - baseline };
  return { baseline, intervention, change: intervention - baseline };
}

export function milanCdm3ToLocalPoints(
  profile: MilanCdm3PilotMock,
  kpiId: string,
  scenario: ScenarioType = "intervention"
): LocalCityPoint[] {
  const useBaseline = scenario === "baseline";

  if (kpiId === "kpi4.2") {
    return profile.barrierFeatures.map((feature) => {
      const node = nodeById(feature.nodeId);
      const baselineValue = feature.baselineScore;
      const interventionValue = feature.interventionScore;
      const value = useBaseline ? baselineValue : interventionValue;
      return {
        lat: node.lat,
        lon: node.lon,
        value,
        id: feature.id,
        properties: {
          type: "mock",
          dataOrigin: "mock",
          datasetKind: "accessibility",
          parserStatus: "illustrative",
          interventionId: profile.pilotId,
          pilotId: profile.pilotId,
          segmentId: feature.nodeId,
          siteKey: feature.nodeId,
          junctionId: feature.nodeId,
          junctionLabel: node.label,
          streetName: `${node.label} · ${feature.category}`,
          facilityCategory: feature.category,
          category: feature.category,
          likertLabel: feature.category,
          baselineValue,
          interventionValue,
          comparisonValue: interventionValue - baselineValue,
          source: "CDM3 DSS · OSM barrier mapping (illustrative)",
          method: `Activity 1 OSM tag: ${feature.osmTag} · ${feature.status}`,
          spatialNote: `${node.corridorGroup} · ${MILAN_CDM3_MOCK_DISCLAIMER}`,
          temporalCoverage: "illustrative pre/post",
          spatialQuality: "walk_graph_corridor",
          locationMethod: "dss_corridor_node",
          geometryLinkage: "inferred",
          cdm3Activity: "Activity 1–4",
          osmTag: feature.osmTag,
          barrierStatus: feature.status,
          starRatingBaseline: feature.starRatingBaseline,
          starRatingIntervention: feature.starRatingIntervention,
        },
      };
    });
  }

  if (kpiId === "kpi1.2") {
    return profile.modeShareSites.map((site) => {
      const baselineValue = site.baselineSustainablePct;
      const interventionValue = site.interventionSustainablePct;
      const value = useBaseline ? baselineValue : interventionValue;
      return {
        lat: site.lat,
        lon: site.lon,
        value,
        id: site.id,
        properties: {
          type: "mock",
          dataOrigin: "mock",
          datasetKind: "amat-count",
          parserStatus: "illustrative",
          interventionId: profile.pilotId,
          pilotId: profile.pilotId,
          segmentId: site.id,
          siteKey: site.nodeId,
          streetName: site.label,
          baselineValue,
          interventionValue,
          comparisonValue: interventionValue - baselineValue,
          modeBreakdown: site.modeBreakdown,
          source: "CDM3 corridor mode-share proxy (illustrative)",
          method: "Activity 4 pre/post evaluation · active mobility share",
          spatialNote: MILAN_CDM3_MOCK_DISCLAIMER,
          temporalCoverage: "illustrative before-after",
          spatialQuality: "walk_graph_corridor",
          locationMethod: "dss_corridor_node",
          geometryLinkage: "inferred",
        },
      };
    });
  }

  if (kpiId === "kpi2.1") {
    return profile.corridorNodes.map((node, index) => {
      const feature = profile.barrierFeatures[index % profile.barrierFeatures.length];
      const baselineValue = feature.starRatingBaseline * 20;
      const interventionValue = feature.starRatingIntervention * 20;
      const value = useBaseline ? baselineValue : interventionValue;
      return {
        lat: node.lat,
        lon: node.lon,
        value,
        id: `mil-p3-safety-${node.id}`,
        properties: {
          type: "mock",
          dataOrigin: "mock",
          datasetKind: "safety-audit",
          parserStatus: "illustrative",
          interventionId: profile.pilotId,
          pilotId: profile.pilotId,
          segmentId: node.id,
          streetName: node.label,
          baselineValue,
          interventionValue,
          comparisonValue: interventionValue - baselineValue,
          source: "CDM3 iRAP-style corridor safety proxy (illustrative)",
          method: "Activity 4 · target ≥3-star safety rating along DSS corridors",
          spatialNote: `${node.corridorGroup} · ${MILAN_CDM3_MOCK_DISCLAIMER}`,
          temporalCoverage: "illustrative before-after",
          spatialQuality: "walk_graph_corridor",
          locationMethod: "dss_corridor_node",
          geometryLinkage: "inferred",
          starRatingBaseline: feature.starRatingBaseline,
          starRatingIntervention: feature.starRatingIntervention,
        },
      };
    });
  }

  if (kpiId === "kpi3.2") {
    return profile.corridorNodes.map((node, index) => {
      const u = seededUnit(`mil-p3-env-${node.id}`);
      const baselineValue = Math.round(38 + u * 18 + index * 2.5);
      const interventionValue = Math.round(baselineValue * (0.82 + u * 0.08));
      const value = useBaseline ? baselineValue : interventionValue;
      return {
        lat: node.lat,
        lon: node.lon,
        value,
        id: `mil-p3-climate-${node.id}`,
        properties: {
          type: "mock",
          dataOrigin: "mock",
          datasetKind: "emissions",
          parserStatus: "illustrative",
          interventionId: profile.pilotId,
          pilotId: profile.pilotId,
          segmentId: node.id,
          streetName: node.label,
          baselineValue,
          interventionValue,
          comparisonValue: interventionValue - baselineValue,
          preCo2GPerHour: Math.round(baselineValue * 10),
          postCo2GPerHour: Math.round(interventionValue * 10),
          source: "CDM3 walkability emissions proxy (illustrative)",
          method: "Activity 4 · corridor-level environmental pressure index",
          spatialNote: MILAN_CDM3_MOCK_DISCLAIMER,
          temporalCoverage: "illustrative before-after",
          spatialQuality: "walk_graph_corridor",
          locationMethod: "dss_corridor_node",
          geometryLinkage: "inferred",
        },
      };
    });
  }

  if (kpiId === "kpi4.1") {
    return profile.surveySamples.map((sample) => {
      const baselineValue = sample.baselineScore * 20;
      const interventionValue = sample.interventionScore * 20;
      const value = useBaseline ? baselineValue : interventionValue;
      return {
        lat: sample.lat,
        lon: sample.lon,
        value,
        id: sample.id,
        properties: {
          type: "mock",
          dataOrigin: "mock",
          datasetKind: "survey",
          parserStatus: "illustrative",
          interventionId: profile.pilotId,
          pilotId: profile.pilotId,
          segmentId: sample.nodeId,
          streetName: sample.theme,
          likertLabel: sample.theme,
          baselineValue,
          interventionValue,
          comparisonValue: interventionValue - baselineValue,
          source: "CDM3 stakeholder survey proxy (illustrative)",
          method: "Activity 5 web interface study · satisfaction Likert scale",
          spatialNote: MILAN_CDM3_MOCK_DISCLAIMER,
          temporalCoverage: "illustrative before-after",
          spatialQuality: "walk_graph_corridor",
          locationMethod: "dss_corridor_node",
          geometryLinkage: "inferred",
        },
      };
    });
  }

  return [];
}

export function milanCdm3PilotAnchor(): { lat: number; lon: number } {
  const anchor = MILAN_PILOT_ANCHORS["mil-p3"];
  return { lat: anchor.lat, lon: anchor.lon };
}
