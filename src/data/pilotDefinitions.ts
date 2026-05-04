export type ViewState = "EUROPE" | "CITY_INTERVENTIONS" | "PILOT_DATA";

export interface SelectedPilot {
  id: string;
  cityId: string;
  name: string;
  title: string;
  description: string;
  interventionType: string;
  goal: string;
  scale: "city" | "district" | "street";
  lat?: number;
  lng?: number;
  supportedKpis: string[];
  datasets: string[];
  dataCompleteness?: "complete" | "partial" | "limited";
  datasetType?: "observed" | "derived" | "modelled";
}

export const CITY_PILOTS: Record<string, SelectedPilot[]> = {
  copenhagen: [
    {
      id: "cph-p1",
      cityId: "copenhagen",
      name: "Pilot 1",
      title: "Relocation of car parking in streets",
      description: "Selected corridors test parking relocation to prioritize active mobility and safer local access.",
      interventionType: "Public space reallocation",
      goal: "Increase pedestrian and cycling space usage after parking relocation.",
      scale: "street",
      lat: 55.685,
      lng: 12.56,
      supportedKpis: ["kpi1.2", "kpi2.1", "kpi3.2"],
      datasets: ["OpenTrafficCam counts"],
      dataCompleteness: "partial",
      datasetType: "observed",
    },
    {
      id: "cph-p2",
      cityId: "copenhagen",
      name: "Pilot 2",
      title: "Enhanced bicycle parking",
      description: "Pilot expands secure bicycle parking nodes near schools and mixed-use streets.",
      interventionType: "Cycling infrastructure",
      goal: "Increase active mode share around bicycle parking nodes.",
      scale: "district",
      lat: 55.672,
      lng: 12.525,
      supportedKpis: ["kpi1.2", "kpi4.2"],
      datasets: ["OpenTrafficCam counts", "City bicycle parking inventory"],
      dataCompleteness: "partial",
      datasetType: "observed",
    },
    {
      id: "cph-p3",
      cityId: "copenhagen",
      name: "Pilot 3",
      title: "Traffic flow and near encounter",
      description: "Pilot monitors urban flow and near-encounter conditions to support calmer street design.",
      interventionType: "Traffic operations and safety monitoring",
      goal: "Reduce unsafe exposure by understanding flow pressure and conflicts.",
      scale: "city",
      lat: 55.67,
      lng: 12.60,
      supportedKpis: ["kpi1.2", "kpi2.1"],
      datasets: ["OpenTrafficCam counts"],
      dataCompleteness: "partial",
      datasetType: "derived",
    },
  ],
  milan: [
    {
      id: "mil-p1",
      cityId: "milan",
      name: "Pilot 1",
      title: "Neighbourhood low-traffic zone",
      description: "Traffic calming around local services with priority crossings and public transport links.",
      interventionType: "Low-traffic neighbourhood",
      goal: "Reduce car dominance and improve safety for vulnerable users.",
      scale: "district",
      lat: 45.476,
      lng: 9.195,
      supportedKpis: ["kpi1.2", "kpi2.1", "kpi3.2", "kpi4.2"],
      datasets: ["AMAT counts", "Speed measurements", "CO2 network", "Camera shapefile", "Accessibility DSS"],
      dataCompleteness: "complete",
      datasetType: "derived",
    },
    {
      id: "mil-p2",
      cityId: "milan",
      name: "Pilot 2",
      title: "Protected cycling corridor",
      description: "Segment-level protected cycle lanes connecting mobility hubs and schools.",
      interventionType: "Protected cycle infrastructure",
      goal: "Increase cycling share and reduce speed-related exposure.",
      scale: "street",
      lat: 45.458,
      lng: 9.175,
      supportedKpis: ["kpi1.2", "kpi2.1", "kpi3.1", "kpi3.2", "kpi4.2"],
      datasets: ["AMAT counts", "Speed measurements", "CO2 network", "Camera shapefile", "Accessibility inventory"],
      dataCompleteness: "complete",
      datasetType: "observed",
    },
    {
      id: "mil-p3",
      cityId: "milan",
      name: "Pilot 3",
      title: "Transit-priority reallocation",
      description: "Signal and lane priority interventions to reduce bus delay and improve reliability.",
      interventionType: "Transit priority and lane reallocation",
      goal: "Shift trips to public transport while reducing emissions and delay.",
      scale: "city",
      lat: 45.468,
      lng: 9.215,
      supportedKpis: ["kpi1.2", "kpi2.1", "kpi3.2", "kpi4.1"],
      datasets: ["AMAT counts", "Network speed data", "Survey results"],
      dataCompleteness: "partial",
      datasetType: "derived",
    },
  ],
  "issy-les-moulineaux": [
    {
      id: "issy-p1",
      cityId: "issy-les-moulineaux",
      name: "Pilot 1",
      title: "School-area active mobility",
      description: "Pilot promotes safe school-area walking and cycling routes with traffic filtering.",
      interventionType: "School street intervention",
      goal: "Shift local trips toward walking and cycling around schools.",
      scale: "district",
      lat: 48.826,
      lng: 2.267,
      supportedKpis: ["kpi1.2", "kpi2.1"],
      datasets: ["Zone-to-zone flow counts", "Traffic segment API"],
      dataCompleteness: "partial",
      datasetType: "observed",
    },
    {
      id: "issy-p2",
      cityId: "issy-les-moulineaux",
      name: "Pilot 2",
      title: "Cycle lane continuity",
      description: "Intervention closes gaps in cycle infrastructure near key commuter streets.",
      interventionType: "Cycle network continuity",
      goal: "Increase continuous cycling movement and reduce detours.",
      scale: "street",
      lat: 48.821,
      lng: 2.279,
      supportedKpis: ["kpi1.2", "kpi3.1"],
      datasets: ["Bicycle counting API", "Cycling infrastructure API"],
      dataCompleteness: "complete",
      datasetType: "observed",
    },
    {
      id: "issy-p3",
      cityId: "issy-les-moulineaux",
      name: "Pilot 3",
      title: "Congestion-sensitive street tuning",
      description: "Signal timing and street operations tuned using congestion index observations.",
      interventionType: "Signal timing optimization",
      goal: "Stabilize flow and reduce congestion-related safety pressure.",
      scale: "city",
      lat: 48.831,
      lng: 2.274,
      supportedKpis: ["kpi1.2", "kpi2.1", "kpi3.2"],
      datasets: ["Traffic API", "Derived congestion indicators"],
      dataCompleteness: "partial",
      datasetType: "derived",
    },
  ],
  helsinki: [
    {
      id: "hel-p1",
      cityId: "helsinki",
      name: "Pilot 1",
      title: "Sensor-based corridor monitoring",
      description: "Pilot uses Telraam observations to monitor street activity patterns before and after intervention.",
      interventionType: "Sensor-based behaviour monitoring",
      goal: "Understand movement shifts and safety pressure from observed corridor activity.",
      scale: "street",
      lat: 60.171,
      lng: 24.941,
      supportedKpis: ["kpi1.2", "kpi2.1"],
      datasets: ["Telraam counts"],
      dataCompleteness: "partial",
      datasetType: "observed",
    },
    {
      id: "hel-p2",
      cityId: "helsinki",
      name: "Pilot 2",
      title: "Micromobility accessibility pilot",
      description: "Pilot evaluates eScooter and active mobility usage to assess access improvements in dense areas.",
      interventionType: "Micromobility and accessibility",
      goal: "Measure whether micromobility improves access without increasing conflict.",
      scale: "district",
      lat: 60.168,
      lng: 24.936,
      supportedKpis: ["kpi1.2", "kpi4.2"],
      datasets: ["Telraam counts", "eScooter observations"],
      dataCompleteness: "partial",
      datasetType: "observed",
    },
    {
      id: "hel-p3",
      cityId: "helsinki",
      name: "Pilot 3",
      title: "Citywide active mobility behaviour",
      description: "Pilot aggregates sensor streams to compare baseline and intervention mobility behaviour citywide.",
      interventionType: "Behavioural mobility evaluation",
      goal: "Track citywide behaviour shifts linked to intervention areas.",
      scale: "city",
      lat: 60.1699,
      lng: 24.9384,
      supportedKpis: ["kpi1.2", "kpi2.1", "kpi4.2"],
      datasets: ["Telraam counts", "eScooter observations"],
      dataCompleteness: "partial",
      datasetType: "observed",
    },
  ],
  zaragoza: [
    {
      id: "zar-p1",
      cityId: "zaragoza",
      name: "Pilot 1",
      title: "Active mobility corridor upgrade",
      description: "Corridor measures for walking, cycling, and public transport quality of service across the inner ring.",
      interventionType: "Active travel corridor",
      goal: "Increase sustainable mode share and improve safety KPIs along the corridor.",
      scale: "district",
      lat: 41.652,
      lng: -0.878,
      supportedKpis: ["kpi1.2", "kpi2.1", "kpi3.1", "kpi3.2", "kpi4.1", "kpi4.2"],
      datasets: ["City mobility indicators"],
      dataCompleteness: "limited",
      datasetType: "derived",
    },
  ],
};

export function getPilotsByCity(cityName: string): SelectedPilot[] {
  return CITY_PILOTS[cityName.toLowerCase()] || [
    {
      id: `${cityName.toLowerCase().replace(/\s+/g, "-")}-p1`,
      cityId: cityName.toLowerCase().replace(/\s+/g, "-"),
      name: "Pilot 1",
      title: "Neighbourhood intervention",
      description: "Pilot intervention area prepared for KPI impact assessment.",
      interventionType: "Mobility intervention",
      goal: "Measure baseline-to-intervention KPI change for the selected area.",
      scale: "district",
      supportedKpis: ["kpi1.2", "kpi2.1", "kpi3.1", "kpi3.2", "kpi4.1", "kpi4.2"],
      datasets: ["Pilot dataset"],
      dataCompleteness: "limited",
      datasetType: "derived",
    },
  ];
}

export function getPilotById(cityName: string, pilotId?: string | null): SelectedPilot | null {
  if (!pilotId) return null;
  const pilots = getPilotsByCity(cityName);
  return pilots.find((pilot) => pilot.id === pilotId) || null;
}

/** Reverse lookup for narrative routes (e.g. /story/:pilotId). */
export function findPilotByIdGlobally(pilotId: string): { pilot: SelectedPilot; pilotsKey: keyof typeof CITY_PILOTS } | null {
  const entry = (Object.keys(CITY_PILOTS) as (keyof typeof CITY_PILOTS)[]).find((k) =>
    CITY_PILOTS[k]?.some((p) => p.id === pilotId)
  );
  if (!entry) return null;
  const pilot = CITY_PILOTS[entry].find((p) => p.id === pilotId);
  return pilot ? { pilot, pilotsKey: entry } : null;
}
