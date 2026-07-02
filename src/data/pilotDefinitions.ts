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
      description:
        "Medieval City parking reallocation to prioritize walking and cycling and repurpose 6,250 m² of street space.",
      interventionType: "Public space reallocation",
      goal: "Reduce car traffic and increase active mode share across monitored corridors.",
      scale: "district",
      lat: 55.6795,
      lng: 12.5735,
      supportedKpis: ["kpi1.1", "kpi1.2", "kpi3.2", "kpi4.1"],
      datasets: [
        "OpenTrafficCam counts",
        "Flow cameras",
        "Manual counts",
        "Telraam",
        "Travel surveys",
      ],
      dataCompleteness: "partial",
      datasetType: "observed",
    },
    {
      id: "cph-p2",
      cityId: "copenhagen",
      name: "Pilot 2",
      title: "Enhanced bicycle parking",
      description:
        "1,080 new bicycle parking spaces including 80 cargo-bike spaces across a 1,250 m² rack footprint at Vandkunsten.",
      interventionType: "Cycling infrastructure",
      goal: "Increase bicycle parking capacity while improving pedestrian accessibility.",
      scale: "street",
      lat: 55.676056,
      lng: 12.574152,
      supportedKpis: ["kpi3.1", "kpi4.2"],
      datasets: [
        "Bicycle parking inventory",
        "Bicycle parking photos",
        "Interviews",
        "OpenTrafficCam (context)",
      ],
      dataCompleteness: "partial",
      datasetType: "observed",
    },
    {
      id: "cph-p3",
      cityId: "copenhagen",
      name: "Pilot 3",
      title: "Traffic flow and near encounter",
      description:
        "Safety-oriented flow monitoring at Rådhusstræde, Vandkunsten, Gammeltorv, and Nørregade/Nørreport.",
      interventionType: "Traffic operations and safety monitoring",
      goal: "Reduce unsafe near encounters and support calmer street design.",
      scale: "district",
      lat: 55.6778,
      lng: 12.5748,
      supportedKpis: ["kpi2.1", "kpi3.1"],
      datasets: [
        "OpenTrafficCam counts",
        "Near encounters",
        "iRAP Star Rating",
        "Speed measurements",
      ],
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
      title: "Luminous and interactive road markings for bicycles",
      description:
        "Light-emitting pavement markings improve cyclist visibility and alert drivers when cyclists approach intersections.",
      interventionType: "Luminous bicycle markings",
      goal: "Improve cyclist visibility and reduce conflicts at junctions through interactive pavement signals.",
      scale: "street",
      lat: 48.829725,
      lng: 2.261046,
      supportedKpis: ["kpi1.2", "kpi2.1"],
      datasets: ["Zone-to-zone OD flow CSV", "Traffic segment API (traficissy)"],
      dataCompleteness: "partial",
      datasetType: "observed",
    },
    {
      id: "issy-p2",
      cityId: "issy-les-moulineaux",
      name: "Pilot 2",
      title: "Mobility observatory",
      description:
        "The Mobility Observatory supports the city of Issy-les-Moulineaux with a dynamic mobility decision-making tool. It integrates car flow, logistics flow, cycling flow, and modal split indicators to support safety, carbon footprint, and inclusiveness decisions.",
      interventionType: "Mobility observatory",
      goal: "Monitor modal split and flows to support data-driven mobility decisions.",
      scale: "city",
      lat: 48.829725,
      lng: 2.261046,
      supportedKpis: ["kpi1.2", "kpi3.1"],
      datasets: ["Bicycle counting API", "Cycling infrastructure API", "Traffic segment API"],
      dataCompleteness: "complete",
      datasetType: "observed",
    },
    {
      id: "issy-p3",
      cityId: "issy-les-moulineaux",
      name: "Pilot 3",
      title: "GecoAir app",
      description:
        "This intervention tests the GecoAir app, which helps citizens understand and reduce air pollution. Data from the app supports the mobility observatory and helps Issy-les-Moulineaux track climate-related mobility impacts.",
      interventionType: "GecoAir citizen app",
      goal: "Raise air-pollution awareness and link citizen engagement to mobility observatory indicators.",
      scale: "city",
      lat: 48.829725,
      lng: 2.261046,
      supportedKpis: ["kpi1.2", "kpi2.1", "kpi3.2"],
      datasets: ["Traffic segment API", "Derived environmental proxies"],
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
  trikala: [
    {
      id: "tri-p1",
      cityId: "trikala",
      name: "Pilot 1",
      title: "Smart mobility area intervention",
      description:
        "Area-focused intervention integrating safer active mobility routing and digital monitoring workflows.",
      interventionType: "Area-level mobility intervention",
      goal: "Improve intervention-area mobility performance with transparent KPI readiness and trust.",
      scale: "district",
      lat: 39.555,
      lng: 21.767,
      supportedKpis: ["kpi1.2", "kpi2.1", "kpi3.1", "kpi3.2", "kpi4.1", "kpi4.2"],
      datasets: ["Pilot KPI dataset", "Partner monitoring feeds (pending)"],
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
