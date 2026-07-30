import type { JunctionPeriodView } from "@/lib/issyJunctionAnalytics";
import { findPilotByIdGlobally } from "@/data/pilotDefinitions";

export interface JunctionTimelineEvent {
  date: string;
  event: string;
  status: "done" | "upcoming" | "active";
}

export interface JunctionConfig {
  id: string;
  pilotId: string;
  name: string;
  shortName: string;
  pilot: string;
  interventionType: string;
  coordinates: [number, number];
  monitoringPeriod: string;
  sensors: number;
  approachesCovered: number;
  totalApproaches: number;
  dataConfidence: number;
  streetNS: string;
  streetEW: string;
  segmentApiId: string;
  baseline: JunctionPeriodView;
  intervention: JunctionPeriodView;
  timeline: JunctionTimelineEvent[];
}

function trend(base: number, drift: number, variance = 3): number[] {
  return Array.from({ length: 9 }, (_, i) =>
    Math.round(base * (0.92 + (i / 9) * 0.1) + drift * (i - 4) + (i % 2 === 0 ? variance : -variance))
  );
}

function modeShare(opts: {
  pedestrian: number;
  cycle: number;
  pt: number;
  car: number;
  ptw?: number;
}): Record<string, number> {
  const ptw = opts.ptw ?? Math.max(2, 100 - opts.pedestrian - opts.cycle - opts.pt - opts.car);
  return {
    Pedestrian: opts.pedestrian,
    Cycle: opts.cycle,
    "Public Transport": opts.pt,
    Car: opts.car,
    PTW: ptw,
  };
}

function period(
  label: string,
  periodLabel: string,
  modes: Record<string, number>,
  cycleCount: number,
  congestion: number,
  speed: number,
  co2: number,
  cycleDrift: number,
  carDrift: number
): JunctionPeriodView {
  return {
    label,
    period: periodLabel,
    modeShare: modes,
    dailyCycleCount: cycleCount,
    peakCongestion: congestion,
    avgSpeedKmh: speed,
    co2ProxyKgDay: co2,
    trendCycle: trend(cycleCount, cycleDrift),
    trendCar: trend(co2 / 3, carDrift),
  };
}

function pilotLabel(pilotId: string): string {
  const found = findPilotByIdGlobally(pilotId);
  if (!found) return pilotId;
  const city =
    found.pilotsKey === "issy-les-moulineaux"
      ? "Issy-les-Moulineaux"
      : found.pilotsKey.charAt(0).toUpperCase() + found.pilotsKey.slice(1);
  return `${city} — ${found.pilot.name}`;
}

function coords(pilotId: string): [number, number] {
  const found = findPilotByIdGlobally(pilotId);
  return [found?.pilot.lat ?? 0, found?.pilot.lng ?? 0];
}

function interventionType(pilotId: string): string {
  return findPilotByIdGlobally(pilotId)?.pilot.interventionType ?? "Mobility intervention";
}

const ISSY_P1: JunctionConfig = {
  id: "issy-p1-junction",
  pilotId: "issy-p1",
  name: "Pont d'Issy × Quai du Président Roosevelt",
  shortName: "Pont d'Issy camera site",
  pilot: pilotLabel("issy-p1"),
  interventionType: interventionType("issy-p1"),
  coordinates: coords("issy-p1"),
  monitoringPeriod: "Nov 2024 — ongoing",
  sensors: 3,
  approachesCovered: 3,
  totalApproaches: 4,
  dataConfidence: 88,
  streetNS: "Quai du Président Roosevelt",
  streetEW: "Pont d'Issy",
  segmentApiId: "#ILM_92130_6148",
  baseline: period(
    "Baseline (OD CSV)",
    "Nov 2024",
    modeShare({ pedestrian: 16, cycle: 10, pt: 20, car: 48 }),
    198,
    0.34,
    21.8,
    204,
    -12,
    42
  ),
  intervention: period(
    "Post-intervention (OD CSV)",
    "Nov 2025",
    modeShare({ pedestrian: 18, cycle: 12, pt: 19, car: 45 }),
    224,
    0.26,
    23.6,
    188,
    10,
    -22
  ),
  timeline: [
    { date: "Nov 2024", event: "ISSY1 OD flow baseline (CSV)", status: "done" },
    { date: "Nov 2024", event: "Flowell luminous marking installation", status: "done" },
    { date: "Nov 2025", event: "ISSY1 OD flow post-intervention (CSV)", status: "done" },
    { date: "Q2 2025", event: "Visibility & conflict evaluation", status: "upcoming" },
  ],
};

const ISSY_P2: JunctionConfig = {
  id: "issy-p2-junction",
  pilotId: "issy-p2",
  name: "Issy mobility observatory — city monitoring canvas",
  shortName: "Mobility observatory",
  pilot: pilotLabel("issy-p2"),
  interventionType: interventionType("issy-p2"),
  coordinates: coords("issy-p2"),
  monitoringPeriod: "Jun 2024 — ongoing",
  sensors: 3,
  approachesCovered: 3,
  totalApproaches: 4,
  dataConfidence: 74,
  streetNS: "Quai du Président Roosevelt",
  streetEW: "Pont d'Issy",
  segmentApiId: "mock-issy-p2-observatory",
  baseline: period(
    "Baseline (derived)",
    "Jun – Aug 2024",
    modeShare({ pedestrian: 16, cycle: 10, pt: 20, car: 48 }),
    198,
    0.34,
    21.8,
    204,
    -12,
    42
  ),
  intervention: period(
    "Latest observation",
    "Live API snapshot",
    modeShare({ pedestrian: 18, cycle: 12, pt: 19, car: 45 }),
    224,
    0.26,
    23.6,
    188,
    10,
    -22
  ),
  timeline: [
    { date: "Jun 2024", event: "Observatory baseline monitoring", status: "done" },
    { date: "Nov 2024", event: "OD flow baseline (CSV)", status: "done" },
    { date: "Nov 2025", event: "OD flow post-intervention (CSV)", status: "done" },
    { date: "Q2 2025", event: "Decision-support evaluation", status: "upcoming" },
  ],
};

const ISSY_P3: JunctionConfig = {
  id: "issy-p3-junction",
  pilotId: "issy-p3",
  name: "Boulevard Gambetta × Rue de l'Égalité",
  shortName: "Gambetta junction",
  pilot: pilotLabel("issy-p3"),
  interventionType: interventionType("issy-p3"),
  coordinates: coords("issy-p3"),
  monitoringPeriod: "2024 — ongoing",
  sensors: 2,
  approachesCovered: 2,
  totalApproaches: 4,
  dataConfidence: 74,
  streetNS: "Boulevard Gambetta",
  streetEW: "Rue de l'Égalité",
  segmentApiId: "mock-issy-p3-corridor",
  baseline: period(
    "Baseline",
    "Jan – Jun 2024",
    modeShare({ pedestrian: 15, cycle: 9, pt: 21, car: 49 }),
    176,
    0.36,
    20.9,
    218,
    -8,
    38
  ),
  intervention: period(
    "Post-intervention",
    "Jul 2024 — ongoing",
    modeShare({ pedestrian: 17, cycle: 11, pt: 20, car: 46 }),
    192,
    0.28,
    22.3,
    196,
    9,
    -30
  ),
  timeline: [
    { date: "2024", event: "GecoAir app pilot launch", status: "done" },
    { date: "2024", event: "Mobility observatory integration", status: "done" },
    { date: "Nov 2025", event: "Post-intervention traffic snapshot", status: "done" },
    { date: "2025", event: "Citizen engagement evaluation", status: "upcoming" },
  ],
};

const CPH_P1: JunctionConfig = {
  id: "cph-p1-junction",
  pilotId: "cph-p1",
  name: "Frederiksholmskanal / Stormgade",
  shortName: "Stormgade camera hub",
  pilot: pilotLabel("cph-p1"),
  interventionType: interventionType("cph-p1"),
  coordinates: [55.675535, 12.575545],
  monitoringPeriod: "OpenTrafficCam · directional pre/post",
  sensors: 1,
  approachesCovered: 4,
  totalApproaches: 4,
  dataConfidence: 88,
  streetNS: "Frederiksholmskanal",
  streetEW: "Stormgade",
  segmentApiId: "stormgade",
  baseline: period(
    "Baseline",
    "Mar – May 2024",
    modeShare({ pedestrian: 24, cycle: 22, pt: 18, car: 32 }),
    412,
    0.28,
    26.4,
    142,
    -14,
    32
  ),
  intervention: period(
    "Post-intervention",
    "Jun 2024 — ongoing",
    modeShare({ pedestrian: 26, cycle: 30, pt: 17, car: 24 }),
    468,
    0.19,
    28.8,
    118,
    16,
    -26
  ),
  timeline: [
    { date: "Mar 2024", event: "Parking relocation baseline", status: "done" },
    { date: "Jun 2024", event: "Corridor reallocation deployed", status: "done" },
    { date: "Sep 2024", event: "Directional camera monitoring", status: "active" },
    { date: "Q1 2025", event: "Intervention evaluation report", status: "upcoming" },
  ],
};

const CPH_P2: JunctionConfig = {
  id: "cph-p2-junction",
  pilotId: "cph-p2",
  name: "Vandkunsten / Rådhusstræde",
  shortName: "Vandkunsten camera",
  pilot: pilotLabel("cph-p2"),
  interventionType: interventionType("cph-p2"),
  coordinates: [55.676056, 12.574152],
  monitoringPeriod: "OpenTrafficCam · directional pre/post",
  sensors: 4,
  approachesCovered: 2,
  totalApproaches: 2,
  dataConfidence: 86,
  streetNS: "Rådhusstræde",
  streetEW: "Vandkunsten",
  segmentApiId: "vandkunsten",
  baseline: period(
    "Baseline",
    "Apr – Jun 2024",
    modeShare({ pedestrian: 22, cycle: 21, pt: 19, car: 34 }),
    388,
    0.31,
    24.2,
    156,
    -12,
    36
  ),
  intervention: period(
    "Post-intervention",
    "Jul 2024 — ongoing",
    modeShare({ pedestrian: 24, cycle: 29, pt: 18, car: 26 }),
    442,
    0.21,
    26.6,
    128,
    14,
    -24
  ),
  timeline: [
    { date: "Apr 2024", event: "Bike parking baseline counts", status: "done" },
    { date: "Jul 2024", event: "Enhanced parking nodes installed", status: "done" },
    { date: "Oct 2024", event: "Directional monitoring active", status: "active" },
    { date: "Q2 2025", event: "Accessibility evaluation", status: "upcoming" },
  ],
};

const CPH_P3: JunctionConfig = {
  id: "cph-p3-junction",
  pilotId: "cph-p3",
  name: "Gammeltorv & Stormgade cameras",
  shortName: "City centre flow",
  pilot: pilotLabel("cph-p3"),
  interventionType: interventionType("cph-p3"),
  coordinates: [55.676986, 12.573891],
  monitoringPeriod: "OpenTrafficCam · directional pre/post",
  sensors: 2,
  approachesCovered: 4,
  totalApproaches: 4,
  dataConfidence: 85,
  streetNS: "Gammeltorv / Vestergade",
  streetEW: "Frederiksholmskanal / Stormgade",
  segmentApiId: "gammeltorv",
  baseline: period(
    "Baseline",
    "May – Jul 2024",
    modeShare({ pedestrian: 20, cycle: 23, pt: 20, car: 33 }),
    356,
    0.35,
    22.8,
    168,
    -10,
    40
  ),
  intervention: period(
    "Post-intervention",
    "Aug 2024 — ongoing",
    modeShare({ pedestrian: 22, cycle: 28, pt: 19, car: 28 }),
    398,
    0.24,
    25.4,
    144,
    12,
    -28
  ),
  timeline: [
    { date: "May 2024", event: "Flow pressure baseline", status: "done" },
    { date: "Aug 2024", event: "Near-encounter monitoring live", status: "done" },
    { date: "Nov 2024", event: "Calmer street design trial", status: "active" },
    { date: "Q3 2025", event: "Safety evaluation report", status: "upcoming" },
  ],
};

const HEL_P1: JunctionConfig = {
  id: "hel-p1-junction",
  pilotId: "hel-p1",
  name: "Mannerheimintie × Runeberginkatu",
  shortName: "Mannerheimintie corridor",
  pilot: pilotLabel("hel-p1"),
  interventionType: interventionType("hel-p1"),
  coordinates: coords("hel-p1"),
  monitoringPeriod: "Feb 2024 — ongoing",
  sensors: 2,
  approachesCovered: 2,
  totalApproaches: 4,
  dataConfidence: 76,
  streetNS: "Runeberginkatu",
  streetEW: "Mannerheimintie",
  segmentApiId: "mock-hel-p1-telraam",
  baseline: period(
    "Baseline",
    "Feb – Apr 2024",
    modeShare({ pedestrian: 28, cycle: 12, pt: 24, car: 32 }),
    186,
    0.32,
    24.6,
    172,
    -8,
    34
  ),
  intervention: period(
    "Post-intervention",
    "May 2024 — ongoing",
    modeShare({ pedestrian: 30, cycle: 17, pt: 23, car: 27 }),
    218,
    0.22,
    26.8,
    148,
    11,
    -26
  ),
  timeline: [
    { date: "Feb 2024", event: "Telraam baseline deployment", status: "done" },
    { date: "May 2024", event: "Sensor corridor activation", status: "done" },
    { date: "Aug 2024", event: "Post-intervention monitoring", status: "active" },
    { date: "Q1 2025", event: "Corridor evaluation report", status: "upcoming" },
  ],
};

const HEL_P2: JunctionConfig = {
  id: "hel-p2-junction",
  pilotId: "hel-p2",
  name: "Itäkeskustie × Itäväylä",
  shortName: "Itäkeskus hub",
  pilot: pilotLabel("hel-p2"),
  interventionType: interventionType("hel-p2"),
  coordinates: coords("hel-p2"),
  monitoringPeriod: "Mar 2024 — ongoing",
  sensors: 2,
  approachesCovered: 2,
  totalApproaches: 4,
  dataConfidence: 74,
  streetNS: "Itäväylä",
  streetEW: "Itäkeskustie",
  segmentApiId: "mock-hel-p2-telraam",
  baseline: period(
    "Baseline",
    "Mar – May 2024",
    modeShare({ pedestrian: 26, cycle: 11, pt: 25, car: 34 }),
    164,
    0.34,
    23.2,
    178,
    -9,
    36
  ),
  intervention: period(
    "Post-intervention",
    "Jun 2024 — ongoing",
    modeShare({ pedestrian: 28, cycle: 16, pt: 24, car: 29 }),
    196,
    0.23,
    25.6,
    152,
    10,
    -24
  ),
  timeline: [
    { date: "Mar 2024", event: "eScooter baseline survey", status: "done" },
    { date: "Jun 2024", event: "Micromobility hub pilot", status: "done" },
    { date: "Sep 2024", event: "Accessibility monitoring", status: "active" },
    { date: "Q2 2025", event: "Access evaluation report", status: "upcoming" },
  ],
};

const HEL_P3: JunctionConfig = {
  id: "hel-p3-junction",
  pilotId: "hel-p3",
  name: "Hämeentie × Fleminginkatu",
  shortName: "Hämeentie active mobility",
  pilot: pilotLabel("hel-p3"),
  interventionType: interventionType("hel-p3"),
  coordinates: coords("hel-p3"),
  monitoringPeriod: "Jan 2024 — ongoing",
  sensors: 3,
  approachesCovered: 3,
  totalApproaches: 4,
  dataConfidence: 77,
  streetNS: "Fleminginkatu",
  streetEW: "Hämeentie",
  segmentApiId: "mock-hel-p3-telraam",
  baseline: period(
    "Baseline",
    "Jan – Mar 2024",
    modeShare({ pedestrian: 27, cycle: 12, pt: 23, car: 34 }),
    172,
    0.33,
    23.8,
    174,
    -7,
    32
  ),
  intervention: period(
    "Post-intervention",
    "Apr 2024 — ongoing",
    modeShare({ pedestrian: 29, cycle: 19, pt: 22, car: 27 }),
    208,
    0.21,
    26.2,
    146,
    12,
    -22
  ),
  timeline: [
    { date: "Jan 2024", event: "Citywide behaviour baseline", status: "done" },
    { date: "Apr 2024", event: "Active mobility sensors live", status: "done" },
    { date: "Jul 2024", event: "Intervention-area monitoring", status: "active" },
    { date: "Q4 2025", event: "Behaviour shift evaluation", status: "upcoming" },
  ],
};

const MIL_P1: JunctionConfig = {
  id: "mil-p1-junction",
  pilotId: "mil-p1",
  name: "Via Novara × Via Vespri Siciliani",
  shortName: "Novara LTZ",
  pilot: pilotLabel("mil-p1"),
  interventionType: interventionType("mil-p1"),
  coordinates: coords("mil-p1"),
  monitoringPeriod: "Apr 2024 — ongoing",
  sensors: 2,
  approachesCovered: 2,
  totalApproaches: 4,
  dataConfidence: 81,
  streetNS: "Via Vespri Siciliani",
  streetEW: "Via Novara",
  segmentApiId: "mock-mil-p1-amat",
  baseline: period(
    "Baseline",
    "Apr – Jun 2024",
    modeShare({ pedestrian: 18, cycle: 8, pt: 14, car: 58 }),
    124,
    0.42,
    18.6,
    248,
    -6,
    44
  ),
  intervention: period(
    "Post-intervention",
    "Jul 2024 — ongoing",
    modeShare({ pedestrian: 20, cycle: 10, pt: 16, car: 52 }),
    138,
    0.32,
    20.4,
    218,
    8,
    -32
  ),
  timeline: [
    { date: "Apr 2024", event: "LTZ baseline AMAT counts", status: "done" },
    { date: "Jul 2024", event: "Low-traffic zone deployed", status: "done" },
    { date: "Oct 2024", event: "Speed & CO2 monitoring", status: "active" },
    { date: "Q1 2025", event: "Neighbourhood evaluation", status: "upcoming" },
  ],
};

const MIL_P2: JunctionConfig = {
  id: "mil-p2-junction",
  pilotId: "mil-p2",
  name: "Via Torino × Via Santa Croce",
  shortName: "Torino cycle corridor",
  pilot: pilotLabel("mil-p2"),
  interventionType: interventionType("mil-p2"),
  coordinates: coords("mil-p2"),
  monitoringPeriod: "May 2024 — ongoing",
  sensors: 2,
  approachesCovered: 2,
  totalApproaches: 4,
  dataConfidence: 83,
  streetNS: "Via Santa Croce",
  streetEW: "Via Torino",
  segmentApiId: "mock-mil-p2-amat",
  baseline: period(
    "Baseline",
    "May – Jul 2024",
    modeShare({ pedestrian: 16, cycle: 9, pt: 15, car: 57 }),
    132,
    0.40,
    19.2,
    236,
    -5,
    40
  ),
  intervention: period(
    "Post-intervention",
    "Aug 2024 — ongoing",
    modeShare({ pedestrian: 18, cycle: 14, pt: 14, car: 51 }),
    158,
    0.30,
    21.6,
    206,
    9,
    -28
  ),
  timeline: [
    { date: "May 2024", event: "Protected lane baseline", status: "done" },
    { date: "Aug 2024", event: "Cycle corridor opened", status: "done" },
    { date: "Nov 2024", event: "AMAT speed monitoring", status: "active" },
    { date: "Q2 2025", event: "Cycling share evaluation", status: "upcoming" },
  ],
};

const MIL_P3: JunctionConfig = {
  id: "mil-p3-junction",
  pilotId: "mil-p3",
  name: "Olympic Routes · Stadium corridor (combined)",
  shortName: "Pilot 1 + Pilot 2",
  pilot: pilotLabel("mil-p3"),
  interventionType: interventionType("mil-p3"),
  coordinates: coords("mil-p3"),
  monitoringPeriod: "Combined mil-p1 + mil-p2 observation window",
  sensors: 6,
  approachesCovered: 6,
  totalApproaches: 8,
  dataConfidence: 58,
  streetNS: "Via Plinio",
  streetEW: "Corso Buenos Aires",
  segmentApiId: "mock-mil-p3-cdm3",
  baseline: period(
    "Baseline",
    "Pre-intervention DSS audit",
    modeShare({ pedestrian: 14, cycle: 10, pt: 18, car: 58 }),
    112,
    0.48,
    16.2,
    268,
    -6,
    52
  ),
  intervention: period(
    "Post-intervention",
    "Combined mil-p1 + mil-p2 evaluation window",
    modeShare({ pedestrian: 17, cycle: 13, pt: 20, car: 50 }),
    124,
    0.36,
    19.4,
    228,
    9,
    -28
  ),
  timeline: [
    { date: "Q1 2024", event: "Activity 1 — OSM barrier mapping", status: "done" },
    { date: "Q2 2024", event: "Activity 2 — DSS tool integration", status: "done" },
    { date: "Q4 2024", event: "Activity 4 — West Axis pre/post evaluation", status: "active" },
    { date: "2025", event: "Activity 5 — Web interface study", status: "upcoming" },
  ],
};

const ZAR_P1: JunctionConfig = {
  id: "zar-p1-junction",
  pilotId: "zar-p1",
  name: "Kiss&Go schools — Azúa / Margarita Salas",
  shortName: "School corridors",
  pilot: pilotLabel("zar-p1"),
  interventionType: interventionType("zar-p1"),
  coordinates: coords("zar-p1"),
  monitoringPeriod: "Jun 2025 — Oct 2025 baseline",
  sensors: 3,
  approachesCovered: 2,
  totalApproaches: 4,
  dataConfidence: 78,
  streetNS: "C/ de Miguel Asín y Palacios",
  streetEW: "Condes de Aragón",
  segmentApiId: "AYZG1",
  baseline: period(
    "Baseline",
    "Jun – Oct 2025",
    modeShare({ pedestrian: 26, cycle: 15, pt: 20, car: 36 }),
    198,
    0.36,
    22.4,
    192,
    -8,
    36
  ),
  intervention: period(
    "Post-intervention",
    "Awaiting post folder",
    modeShare({ pedestrian: 28, cycle: 22, pt: 19, car: 28 }),
    236,
    0.24,
    25.2,
    164,
    12,
    -26
  ),
  timeline: [
    { date: "Jun 2025", event: "Manual motor counts (AYZGZ1)", status: "done" },
    { date: "Oct 2025", event: "School peak monitoring", status: "done" },
    { date: "2026", event: "Post-implementation monitoring", status: "upcoming" },
  ],
};

const ZAR_P2: JunctionConfig = {
  id: "zar-p2-junction",
  pilotId: "zar-p2",
  name: "La Romareda pedestrian area",
  shortName: "Romareda",
  pilot: pilotLabel("zar-p2"),
  interventionType: interventionType("zar-p2"),
  coordinates: coords("zar-p2"),
  monitoringPeriod: "2025 baseline — reformado design",
  sensors: 2,
  approachesCovered: 2,
  totalApproaches: 4,
  dataConfidence: 74,
  streetNS: "Calle Jerusalén",
  streetEW: "Eduardo Ibarra",
  segmentApiId: "AYZG2",
  baseline: period(
    "Baseline",
    "2025 Comparativa / survey",
    modeShare({ pedestrian: 32, cycle: 12, pt: 18, car: 38 }),
    160,
    0.34,
    24,
    210,
    -6,
    28
  ),
  intervention: period(
    "Post-intervention",
    "Awaiting post folder",
    modeShare({ pedestrian: 38, cycle: 14, pt: 18, car: 30 }),
    180,
    0.26,
    26,
    180,
    10,
    -22
  ),
  timeline: [
    { date: "2025", event: "Romareda Comparativa + citizen survey", status: "done" },
    { date: "2026–28", event: "Stadium-adjacent redesign", status: "active" },
  ],
};

const ZAR_P3: JunctionConfig = {
  id: "zar-p3-junction",
  pilotId: "zar-p3",
  name: "Miguel Servet Hospital access",
  shortName: "Hospital access",
  pilot: pilotLabel("zar-p3"),
  interventionType: interventionType("zar-p3"),
  coordinates: coords("zar-p3"),
  monitoringPeriod: "Baseline thin — survey themes",
  sensors: 1,
  approachesCovered: 1,
  totalApproaches: 4,
  dataConfidence: 58,
  streetNS: "Hospital access",
  streetEW: "Miguel Servet",
  segmentApiId: "AYZG3",
  baseline: period(
    "Baseline",
    "Survey themes",
    modeShare({ pedestrian: 22, cycle: 8, pt: 24, car: 46 }),
    120,
    0.42,
    20,
    230,
    -10,
    30
  ),
  intervention: period(
    "Post-intervention",
    "Awaiting deployment",
    modeShare({ pedestrian: 26, cycle: 10, pt: 26, car: 38 }),
    140,
    0.32,
    22,
    200,
    8,
    -20
  ),
  timeline: [
    { date: "2025", event: "Prior traffic study reference", status: "done" },
    { date: "2026", event: "Traffic-management measures", status: "upcoming" },
  ],
};

const TRI_P1: JunctionConfig = {
  id: "tri-p1-junction",
  pilotId: "tri-p1",
  name: "Vasili Tsitsani × Military School",
  shortName: "Smart crossing site",
  pilot: pilotLabel("tri-p1"),
  interventionType: interventionType("tri-p1"),
  coordinates: coords("tri-p1"),
  monitoringPeriod: "Apr 2024 — ongoing",
  sensors: 2,
  approachesCovered: 2,
  totalApproaches: 4,
  dataConfidence: 82,
  streetNS: "Vasili Tsitsani",
  streetEW: "Military School junction",
  segmentApiId: "tri-p1-smart-crossing",
  baseline: period(
    "Baseline",
    "Apr – Jun 2024",
    modeShare({ pedestrian: 24, cycle: 11, pt: 18, car: 42 }),
    142,
    0.38,
    21.6,
    198,
    -7,
    38
  ),
  intervention: period(
    "Post-intervention",
    "Jul 2024 — ongoing",
    modeShare({ pedestrian: 27, cycle: 16, pt: 17, car: 36 }),
    168,
    0.27,
    24.0,
    172,
    10,
    -24
  ),
  timeline: [
    { date: "Apr 2024", event: "Area intervention baseline", status: "done" },
    { date: "Jul 2024", event: "Smart mobility routing live", status: "done" },
    { date: "Oct 2024", event: "Digital monitoring workflow", status: "active" },
    { date: "Q1 2025", event: "Area performance evaluation", status: "upcoming" },
  ],
};

const TRI_P2: JunctionConfig = {
  id: "tri-p2-park-ride",
  pilotId: "tri-p2",
  name: "SMY · DEH · GiSeMi P+R",
  shortName: "Park & Ride hubs",
  pilot: pilotLabel("tri-p2"),
  interventionType: interventionType("tri-p2"),
  coordinates: coords("tri-p2"),
  monitoringPeriod: "Jun 2024 — ongoing",
  sensors: 3,
  approachesCovered: 3,
  totalApproaches: 3,
  dataConfidence: 62,
  streetNS: "Peripheral corridors",
  streetEW: "P+R network",
  segmentApiId: "mock-tri-p2-area",
  baseline: period(
    "Baseline",
    "Apr – Jun 2024",
    modeShare({ pedestrian: 8, cycle: 6, pt: 42, car: 44 }),
    96,
    0.41,
    18.2,
    210,
    -4,
    28
  ),
  intervention: period(
    "Post-intervention",
    "Jul 2024 — ongoing",
    modeShare({ pedestrian: 9, cycle: 8, pt: 44, car: 39 }),
    104,
    0.35,
    19.4,
    198,
    6,
    -18
  ),
  timeline: [
    { date: "Apr 2024", event: "P+R baseline inventory", status: "done" },
    { date: "Jul 2024", event: "Hub upgrades live", status: "done" },
    { date: "Jun 2025", event: "Post-intervention monitoring", status: "active" },
    { date: "Q3 2025", event: "Mode-shift evaluation", status: "upcoming" },
  ],
};

const TRI_P3: JunctionConfig = {
  id: "tri-p3-bike-lane",
  pilotId: "tri-p3",
  name: "Redesigned bike lane network",
  shortName: "Bike lane corridors",
  pilot: pilotLabel("tri-p3"),
  interventionType: interventionType("tri-p3"),
  coordinates: coords("tri-p3"),
  monitoringPeriod: "May 2024 — ongoing",
  sensors: 30,
  approachesCovered: 12,
  totalApproaches: 18,
  dataConfidence: 74,
  streetNS: "City bike corridors",
  streetEW: "Sensor network",
  segmentApiId: "mock-tri-p3-corridor",
  baseline: period(
    "Baseline",
    "Mar – May 2024",
    modeShare({ pedestrian: 14, cycle: 22, pt: 16, car: 48 }),
    118,
    0.44,
    20.8,
    165,
    -12,
    42
  ),
  intervention: period(
    "Post-intervention",
    "Jun 2024 — ongoing",
    modeShare({ pedestrian: 15, cycle: 28, pt: 15, car: 42 }),
    126,
    0.36,
    22.1,
    148,
    8,
    -32
  ),
  timeline: [
    { date: "Mar 2024", event: "Bike safety baseline survey", status: "done" },
    { date: "Jun 2024", event: "Lane redesign completed", status: "done" },
    { date: "Sep 2024", event: "Sensor fleet monitoring", status: "active" },
    { date: "Q2 2025", event: "Post-intervention survey wave", status: "upcoming" },
  ],
};

const TRI_P4: JunctionConfig = {
  id: "tri-p4-smarta2",
  pilotId: "tri-p4",
  name: "SMARTA2 app expansion",
  shortName: "SMARTA2 app",
  pilot: pilotLabel("tri-p4"),
  interventionType: interventionType("tri-p4"),
  coordinates: coords("tri-p4"),
  monitoringPeriod: "2024 — ongoing",
  sensors: 0,
  approachesCovered: 0,
  totalApproaches: 0,
  dataConfidence: 62,
  streetNS: "Digital services",
  streetEW: "City-wide access",
  segmentApiId: "tri-p1-smarta-app",
  baseline: period(
    "Baseline",
    "2024",
    modeShare({ pedestrian: 16, cycle: 18, pt: 22, car: 44 }),
    90,
    0.4,
    18,
    140,
    -8,
    20
  ),
  intervention: period(
    "Expanded app",
    "2025 — ongoing",
    modeShare({ pedestrian: 17, cycle: 20, pt: 24, car: 39 }),
    95,
    0.36,
    18.5,
    130,
    6,
    -18
  ),
  timeline: [
    { date: "2024", event: "SMARTA baseline deployment", status: "done" },
    { date: "2025", event: "SMARTA2 mode and engagement expansion", status: "active" },
  ],
};

const ALL_CONFIGS: JunctionConfig[] = [
  ISSY_P1,
  ISSY_P2,
  ISSY_P3,
  CPH_P1,
  CPH_P2,
  CPH_P3,
  HEL_P1,
  HEL_P2,
  HEL_P3,
  MIL_P1,
  MIL_P2,
  MIL_P3,
  ZAR_P1,
  ZAR_P2,
  ZAR_P3,
  TRI_P1,
  TRI_P2,
  TRI_P3,
  TRI_P4,
];

export const JUNCTION_REGISTRY: Record<string, JunctionConfig[]> = ALL_CONFIGS.reduce(
  (acc, config) => {
    if (!acc[config.pilotId]) acc[config.pilotId] = [];
    acc[config.pilotId].push(config);
    return acc;
  },
  {} as Record<string, JunctionConfig[]>
);

export function getJunctionConfigsForPilot(pilotId: string): JunctionConfig[] {
  return JUNCTION_REGISTRY[pilotId] ?? [];
}

export function hasJunctionConfig(pilotId: string | null | undefined): boolean {
  return !!pilotId && pilotId in JUNCTION_REGISTRY;
}

export function getPrimaryJunctionConfig(pilotId: string | null | undefined): JunctionConfig | null {
  if (!pilotId) return null;
  return JUNCTION_REGISTRY[pilotId]?.[0] ?? null;
}
