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
        "Medieval City parking reallocation monitored with OpenTrafficCam, Telraam, manual counts, and surveys.",
      interventionType: "Public space reallocation",
      goal: "Reduce car traffic and increase active mode share across monitored corridors.",
      scale: "district",
      lat: 55.6795,
      lng: 12.5735,
      supportedKpis: ["kpi1.2", "kpi3.2", "kpi4.1"],
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
        "Enhanced bicycle parking at Vandkunsten — bay inventory from I100275 before/after sheets on the map.",
      interventionType: "Cycling infrastructure",
      goal: "Increase bicycle parking capacity while improving pedestrian accessibility.",
      scale: "street",
      lat: 55.676056,
      lng: 12.574152,
      supportedKpis: ["kpi3.1", "kpi4.1", "kpi4.2"],
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
      supportedKpis: ["kpi1.2", "kpi2.1", "kpi3.1", "kpi4.1"],
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
      title: "Universal Design in Olympic Routes",
      description: "Universal-design adaptation along Olympic routes; post-intervention data missing in the current package.",
      interventionType: "Low-traffic neighbourhood",
      goal: "Reduce car dominance and improve safety for vulnerable users.",
      scale: "district",
      lat: 45.461,
      lng: 9.168,
      supportedKpis: ["kpi1.2", "kpi2.1", "kpi3.1", "kpi3.2", "kpi4.2"],
      datasets: ["AMAT counts", "Speed measurements", "CO2 network", "Camera shapefile", "Accessibility DSS"],
      dataCompleteness: "partial",
      datasetType: "derived",
    },
    {
      id: "mil-p2",
      cityId: "milan",
      name: "Pilot 2",
      title: "Tactical Intervention at Stadium",
      description: "Tactical intervention around the stadium area; baseline package is missing for this pilot.",
      interventionType: "Protected cycle infrastructure",
      goal: "Increase cycling share and reduce speed-related exposure.",
      scale: "street",
      lat: 45.47,
      lng: 9.142,
      supportedKpis: ["kpi1.2", "kpi2.1", "kpi3.1", "kpi3.2", "kpi4.2"],
      datasets: ["AMAT counts", "Speed measurements", "CO2 network", "Camera shapefile", "Accessibility inventory"],
      dataCompleteness: "partial",
      datasetType: "observed",
    },
    {
      id: "mil-p3",
      cityId: "milan",
      name: "Pilot 3",
      title: "Combined Olympic Routes & Stadium Corridor",
      description:
        "Union of Pilot 1 (Olympic routes universal design) and Pilot 2 (stadium tactical intervention) — same observed AMAT counts, speed segments, RETE environmental proxy, and DSS accessibility rows as both pilots together.",
      interventionType: "Pilot 1 + Pilot 2 combined",
      goal: "Evaluate mode share, safety, environmental pressure, and accessibility across both Milan intervention corridors in one view.",
      scale: "district",
      lat: 45.4655,
      lng: 9.155,
      supportedKpis: ["kpi1.2", "kpi2.1", "kpi3.1", "kpi3.2", "kpi4.2"],
      datasets: ["AMAT counts", "Speed measurements", "CO2 network", "Camera shapefile", "Accessibility DSS"],
      dataCompleteness: "partial",
      datasetType: "observed",
    },
  ],
  "issy-les-moulineaux": [
    {
      id: "issy-p1",
      cityId: "issy-les-moulineaux",
      name: "Pilot 1",
      title: "Light-Emitting Marking System (ISSY1)",
      description:
        "Flowell illuminated markings with Wintics camera OD flows at Pont d'Issy (ISSY1), using baseline Nov 2024 and post Nov 2025 CSV observations.",
      interventionType: "Flowell illuminated markings",
      goal: "Improve cyclist visibility and reduce conflicts at junctions through interactive pavement signals.",
      scale: "street",
      lat: 48.829725,
      lng: 2.261046,
      supportedKpis: ["kpi1.2", "kpi2.1", "kpi4.2"],
      datasets: ["ISSY1 baseline CSV (Nov 2024)", "ISSY1 post CSV (Nov 2025)", "Wintics OD flow export"],
      dataCompleteness: "complete",
      datasetType: "observed",
    },
    {
      id: "issy-p2",
      cityId: "issy-les-moulineaux",
      name: "Pilot 2",
      title: "Mobility Observatory (ISSY2)",
      description:
        "The Mobility Observatory supports the city of Issy-les-Moulineaux with a dynamic mobility decision-making tool. It integrates car flow, logistics flow, cycling flow, and modal split indicators to support safety, carbon footprint, and inclusiveness decisions.",
      interventionType: "Digital monitoring platform",
      goal: "Monitor modal split and flows to support data-driven mobility decisions.",
      scale: "city",
      lat: 48.829725,
      lng: 2.261046,
      supportedKpis: ["kpi1.2", "kpi4.2"],
      datasets: ["Mobility observatory platform export", "Traffic segment API"],
      dataCompleteness: "limited",
      datasetType: "observed",
    },
    {
      id: "issy-p3",
      cityId: "issy-les-moulineaux",
      name: "Pilot 3",
      title: "Geco Air Mobility Barometer (ISSY3)",
      description:
        "This intervention tests the GecoAir app, which helps citizens understand and reduce air pollution. Data from the app supports the mobility observatory and helps Issy-les-Moulineaux track climate-related mobility impacts.",
      interventionType: "Emissions-tracking app",
      goal: "Raise air-pollution awareness and link citizen engagement to mobility observatory indicators.",
      scale: "city",
      lat: 48.829725,
      lng: 2.261046,
      supportedKpis: ["kpi1.2", "kpi3.2", "kpi4.1", "kpi4.2"],
      datasets: ["Traffic segment API", "Derived environmental proxies", "ASIF emissions workbook (Classeur)"],
      dataCompleteness: "partial",
      datasetType: "derived",
    },
  ],
  helsinki: [
    {
      id: "hel-p1",
      cityId: "helsinki",
      name: "Pilot 1",
      title: "Accident & Near-Miss Data Collection (FVH1)",
      description: "Safety Sense Helsinki dangerous-locations and near-miss collection linked with intervention monitoring.",
      interventionType: "Safety Sense monitoring",
      goal: "Collect dangerous-location evidence and connect it to intervention-level safety and mobility outcomes.",
      scale: "street",
      lat: 60.171,
      lng: 24.941,
      supportedKpis: ["kpi1.2", "kpi2.1", "kpi3.2"],
      datasets: ["Safety Sense dangerous-locations survey", "Near-miss observations", "Telraam support counts"],
      dataCompleteness: "partial",
      datasetType: "observed",
    },
    {
      id: "hel-p2",
      cityId: "helsinki",
      name: "Pilot 2",
      title: "E-Scooter Parking Optimisation (FVH2)",
      description: "E-scooter geofencing and dedicated parking zones to improve sidewalk accessibility and curbside order.",
      interventionType: "Geofencing and parking zones",
      goal: "Optimize e-scooter parking behavior while preserving pedestrian access.",
      scale: "district",
      lat: 60.168,
      lng: 24.936,
      supportedKpis: ["kpi1.2", "kpi3.1", "kpi4.2"],
      datasets: ["e-scooter parking observations", "Geofencing zone inventory", "Telraam support counts"],
      dataCompleteness: "partial",
      datasetType: "observed",
    },
    {
      id: "hel-p3",
      cityId: "helsinki",
      name: "Pilot 3",
      title: "Intersection Safety at Viikki (FVH3)",
      description: "Raide-Jokeri light-rail crossing safety pilot at Viikki with lidar, Telraam, and Innotrafik warning systems.",
      interventionType: "Intersection safety monitoring",
      goal: "Improve multimodal safety performance at the Viikki intervention crossing.",
      scale: "city",
      lat: 60.224599,
      lng: 25.017236,
      supportedKpis: ["kpi1.2", "kpi2.1", "kpi4.1", "kpi4.2"],
      datasets: ["Lidar crossing observations", "Telraam counts", "Innotrafik warning-system logs"],
      dataCompleteness: "partial",
      datasetType: "observed",
    },
  ],
  zaragoza: [
    {
      id: "zar-p1",
      cityId: "zaragoza",
      name: "Pilot 1",
      title: "AYZG1 Tactical urbanism around schools",
      description: "Tactical urbanism around schools at Calle Asin y Palacios / Condes de Aragon.",
      interventionType: "Tactical urbanism",
      goal: "Improve safety and active mobility around school-adjacent corridors.",
      scale: "district",
      lat: 41.6363,
      lng: -0.9058,
      supportedKpis: ["kpi1.2", "kpi2.1", "kpi3.2", "kpi4.1", "kpi4.2"],
      datasets: ["Zaragoza pilot shapefile indicators"],
      dataCompleteness: "limited",
      datasetType: "derived",
    },
    {
      id: "zar-p2",
      cityId: "zaragoza",
      name: "Pilot 2",
      title: "AYZG2 Pedestrian areas around La Romareda",
      description: "Pedestrian-priority interventions around La Romareda area; final WGS84 coordinates pending Phase B extraction.",
      interventionType: "Pedestrian priority area",
      goal: "Improve walking access and safety around stadium-adjacent public space.",
      scale: "district",
      supportedKpis: ["kpi1.2", "kpi2.1", "kpi3.2", "kpi4.2"],
      datasets: ["Zaragoza pilot shapefile indicators"],
      dataCompleteness: "limited",
      datasetType: "derived",
    },
    {
      id: "zar-p3",
      cityId: "zaragoza",
      name: "Pilot 3",
      title: "AYZG3 Traffic management — Miguel Servet Hospital",
      description: "Traffic-management measures near Miguel Servet Hospital; final WGS84 coordinates pending Phase B extraction.",
      interventionType: "Traffic management",
      goal: "Reduce conflict and improve operational safety around hospital access routes.",
      scale: "district",
      supportedKpis: ["kpi2.1", "kpi4.2"],
      datasets: ["Zaragoza pilot shapefile indicators"],
      dataCompleteness: "limited",
      datasetType: "derived",
    },
    {
      id: "zar-p4",
      cityId: "zaragoza",
      name: "Pilot 4",
      title: "AYZG4 Safe shared bike/VMP parking",
      description: "Safe shared bike/VMP parking intervention; final WGS84 coordinates pending Phase B extraction.",
      interventionType: "Shared micromobility parking",
      goal: "Improve safe parking and reduce obstructions for shared bikes and VMPs.",
      scale: "district",
      supportedKpis: ["kpi1.2", "kpi3.1", "kpi4.1", "kpi4.2"],
      datasets: ["Zaragoza pilot shapefile indicators"],
      dataCompleteness: "limited",
      datasetType: "derived",
    },
  ],
  trikala: [
    {
      id: "tri-p1",
      cityId: "trikala",
      name: "Pilot 1",
      title: "Smart crossing school",
      description:
        "Smart crossing at Vasili Tsitsani / Military School — survey-backed safety KPIs with partner map geodata for crossing site and corridor signals.",
      interventionType: "Smart crossing",
      goal: "Improve school-route crossing safety and accessibility with measurable before/after survey deltas.",
      scale: "street",
      lat: 39.5540151,
      lng: 21.7759437,
      supportedKpis: ["kpi2.1", "kpi1.2", "kpi3.2", "kpi4.1", "kpi4.2"],
      datasets: [
        "Smart crossing survey (baseline + post)",
        "Women mobility questionnaire",
        "SMARTA app survey",
        "Smart Citizen Kit fleet",
      ],
      dataCompleteness: "partial",
      datasetType: "observed",
    },
    {
      id: "tri-p2",
      cityId: "trikala",
      name: "Pilot 2",
      title: "Park and ride stations",
      description:
        "SMY, DEH, and GiSeMi Park & Ride hubs — partner polygon geodata integrated; post-intervention monitoring expected end of June.",
      interventionType: "Park & Ride",
      goal: "Enable intermodal shift via peripheral P+R with mapped parking and bike-station context.",
      scale: "district",
      lat: 39.5596772,
      lng: 21.7690805,
      supportedKpis: ["kpi1.2", "kpi3.1", "kpi4.1"],
      datasets: ["Partner My Maps P+R polygons", "Municipal parking inventory"],
      dataCompleteness: "limited",
      datasetType: "observed",
    },
    {
      id: "tri-p3",
      cityId: "trikala",
      name: "Pilot 3",
      title: "Redesigned bike lanes",
      description:
        "City-wide bike lane redesign with 30 partner sensor nodes and paired cycling safety surveys (baseline n≈310, post n≈277).",
      interventionType: "Cycling infrastructure",
      goal: "Raise perceived bike-lane safety and infrastructure quality across redesigned corridors.",
      scale: "city",
      lat: 39.5555671,
      lng: 21.765602,
      supportedKpis: ["kpi2.1", "kpi4.2"],
      datasets: [
        "Bike lane safety survey (baseline + post)",
        "Bike-lane sensor registry",
        "Municipal bike stations",
      ],
      dataCompleteness: "partial",
      datasetType: "observed",
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
