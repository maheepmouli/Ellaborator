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
      description:
        "The project aims to enhance road and public space design using Universal Design principles in Downtown Olympic Routes, with a particular focus on improving accessibility and safety for vulnerable groups, especially people with visual impairments.",
      interventionType: "Universal design — Olympic routes",
      goal: "Improve accessibility and safety for vulnerable groups along Olympic routes.",
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
      description:
        "The project aims to enhance accessibility, improve pedestrian and cyclist safety, and promote sustainable mobility through a temporary intervention that demonstrates the area's potential and helps unlock opportunities for its long-term redevelopment.",
      interventionType: "Tactical urban intervention — stadium area",
      goal: "Demonstrate safer, more accessible mobility around the stadium corridor.",
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
      title: "Architectural Barriers Assessment",
      description:
        "The intervention aims to develop an advanced system for assessing architectural barriers in public spaces, with a particular focus on improving accessibility for people with disabilities.",
      interventionType: "Barrier assessment & accessibility DSS",
      goal: "Map and assess architectural barriers to improve accessibility in public space.",
      scale: "district",
      lat: 45.4655,
      lng: 9.155,
      // Milan Intervention Evaluation Plan · CDM3 (Decision Support System) only.
      supportedKpis: ["kpi1.1", "kpi4.1", "kpi4.2"],
      datasets: ["Expansion plan readiness", "Satisfaction survey", "Accessibility DSS"],
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
        "In December 2024, a light-emitting pavement marking system was installed in Issy-les-Moulineaux to enhance safety on shared-mobility lanes. The system activates LED panels embedded in the pavement when cyclists approach and the traffic light is green.",
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
      description:
        "Testing new solutions for collecting, visualising and analysing accident-related information from dangerous-location and near-miss citizen surveys.",
      interventionType: "Safety Sense monitoring",
      goal: "Collect dangerous-location evidence and connect it to intervention-level safety and mobility outcomes.",
      scale: "street",
      lat: 60.171,
      lng: 24.941,
      supportedKpis: ["kpi1.2", "kpi2.1", "kpi3.2"],
      datasets: [
        "Dangerous-locations survey (2,663 citizen submissions)",
        "Near-miss / conflict survey (3,202 citizen submissions)",
        "Citywide safety-attitude survey",
      ],
      dataCompleteness: "partial",
      datasetType: "observed",
    },
    {
      id: "hel-p2",
      cityId: "helsinki",
      name: "Pilot 2",
      title: "E-Scooter Parking Optimisation (FVH2)",
      description:
        "Relocation of parking locations for shared mobility services to designated parking areas and geofencing.",
      interventionType: "Geofencing and parking zones",
      goal: "Optimize e-scooter parking behavior while preserving pedestrian access.",
      scale: "district",
      lat: 60.184075,
      lng: 24.950656,
      supportedKpis: ["kpi1.2", "kpi3.1", "kpi4.2"],
      datasets: [
        "e-scooter parking observation study (509 field observations, 5 categories)",
        "Kallio summer-streets intervention site",
      ],
      dataCompleteness: "partial",
      datasetType: "observed",
    },
    {
      id: "hel-p3",
      cityId: "helsinki",
      name: "Pilot 3",
      title: "Intersection Safety at Viikki (FVH3)",
      description:
        "Enhances safety at intersections, particularly those involving the Raide-Jokeri Light Rail line, by testing real-time warning systems for pedestrians and cyclists, and collecting data on interactions.",
      interventionType: "Intersection safety monitoring",
      goal: "Improve multimodal safety performance at the Viikki intervention crossing.",
      scale: "city",
      lat: 60.224599,
      lng: 25.017236,
      // No KPI 1.1 — no formal expansion-plan artifact (and no usable approximation),
      // consistent with FVH1/FVH2 and other non-CDM3 pilots.
      supportedKpis: ["kpi1.2", "kpi2.1", "kpi4.1", "kpi4.2"],
      datasets: [
        "Telraam Koetilantie counts (445 days, 2024-06 to 2025-09)",
        "Viikki UX survey (50 responses vs \u226575% KPI 4.1 target)",
        "Mobilysis gate counts (2024-10-03 AM survey)",
        "HSL tram line 15 position sample",
        "Innotrafik warning-system alarm-duration charts",
      ],
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
        "A smart pedestrian crossing will be installed outside the Military School in Trikala, using sensors and LED lighting to alert drivers when pedestrians are approaching.",
      interventionType: "Smart crossing",
      goal: "Improve school-route crossing safety with sensor-triggered driver alerts.",
      scale: "street",
      lat: 39.5540151,
      lng: 21.7759437,
      supportedKpis: ["kpi2.1", "kpi4.1", "kpi4.2"],
      datasets: [
        "Smart crossing survey (baseline + post)",
        "Women mobility questionnaire",
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
        "Three park-and-ride stations will be installed: one at the Mill of Matsopoulos and two smaller stations near key tourist attractions in the city center. Each station will include bike and e-scooter docking facilities, a fleet of 30 new bicycles, 60 biometric sensors, and fleet management software.",
      interventionType: "Park & Ride",
      goal: "Enable intermodal shift via peripheral and city-centre park-and-ride hubs.",
      scale: "district",
      lat: 39.5596772,
      lng: 21.7690805,
      supportedKpis: ["kpi1.2", "kpi3.1", "kpi4.1"],
      datasets: ["Partner My Maps P+R polygons", "Bike / micromobility docking at P+R hubs"],
      dataCompleteness: "limited",
      datasetType: "observed",
    },
    {
      id: "tri-p3",
      cityId: "trikala",
      name: "Pilot 3",
      title: "Redesigned bike lanes",
      description:
        "The project will improve cycling infrastructure by redesigning existing bike lanes and implementing a sensor-based monitoring system to enhance safety and efficiency. A total of 60 sensors will monitor bicycle usage and traffic patterns, while 10 additional sensors will detect illegal parking in bike lanes and provide real-time alerts. The intervention places particular emphasis on addressing safety concerns for female cyclists, creating a safer and more inclusive cycling environment.",
      interventionType: "Cycling infrastructure",
      goal: "Raise bike-lane safety and inclusiveness, with emphasis on female cyclists.",
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
    {
      id: "tri-p4",
      cityId: "trikala",
      name: "Pilot 4",
      title: "SMARTA2 app expansion",
      description:
        "The SMARTA2 app, which facilitates access to sustainable transport options, will be expanded to include additional mobility modes and new user engagement features.",
      interventionType: "Digital mobility services",
      goal: "Expand sustainable-mode access and engagement through the SMARTA2 app.",
      scale: "city",
      lat: 39.555,
      lng: 21.767,
      supportedKpis: ["kpi1.2", "kpi3.2", "kpi4.1"],
      datasets: ["SMARTA app survey", "Smart Citizen Kit fleet"],
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
