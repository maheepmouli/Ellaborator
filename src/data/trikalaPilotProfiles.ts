import type { CityPilotProfile } from "@/data/cityPilotProfiles";
import type { TrikalaPilotId } from "@/lib/trikalaMapConfig";

export type { TrikalaPilotId };

export const TRIKALA_PILOT_PROFILES: Record<TrikalaPilotId, CityPilotProfile> = {
  "tri-p1": {
    id: "tri-p1",
    city: "Trikala",
    title: "Smart crossing — Military School",
    interventionSummary:
      "A smart pedestrian crossing will be installed outside the Military School in Trikala, using sensors and LED lighting to alert drivers when pedestrians are approaching.",
    objectives: [
      "Alert drivers when pedestrians approach the Military School crossing.",
      "Improve school-route crossing safety with sensors and LED lighting.",
    ],
    expectedImpacts: [
      "Safer crossings for pedestrians and school users.",
      "Clearer visibility of approaching pedestrians for drivers.",
    ],
    geometryType: "line",
    dataAvailability:
      "Partner My Maps coordinates + smart-crossing survey workbooks (baseline + post).",
    methodologyNotes:
      "Intervention-focused pilot profile. Smart-crossing survey evidence remains in the observatory; citywide Smart Citizen air-quality sensors live under Pilot 4.",
    observatoryType: "intervention",
  },
  "tri-p2": {
    id: "tri-p2",
    city: "Trikala",
    title: "Park & Ride stations",
    interventionSummary:
      "Three park-and-ride stations will be installed: one at the Mill of Matsopoulos and two smaller stations near key tourist attractions in the city center. Each station will include bike and e-scooter docking facilities, a fleet of 30 new bicycles, 60 biometric sensors, and fleet management software.",
    objectives: [
      "Provide park-and-ride access at Matsopoulos Mill and central tourist sites.",
      "Support bike and e-scooter docking with shared fleet management.",
      "Track bike uptake from P+R facilities (% change in walking, cycling, micromobility).",
    ],
    expectedImpacts: [
      "Modal shift from private cars to cycling and walking near mobility hubs.",
      "Increased bike / micromobility use linked to the three P+R stations.",
    ],
    geometryType: "polygon",
    dataAvailability:
      "Partner My Maps P+R polygons (SMY · DEH · GiSeMi). KPI 3.1 counts the three installed hubs (0→3). KPI 1.2 mode share and KPI 4.1 satisfaction are MOCK until partner surveys arrive.",
    methodologyNotes:
      "Intervention Evaluation Plan: KPI 1.2 bike uptake from P+R is MOCK (illustrative mix). KPI 3.1 installed facilities = the three P+R hubs (observed GIS). KPI 4.1 has no P+R satisfaction survey — MOCK only; map shows Park and ride dots/labels.",
    observatoryType: "area",
  },
  "tri-p3": {
    id: "tri-p3",
    city: "Trikala",
    title: "Redesigned bike lanes",
    interventionSummary:
      "The project will improve cycling infrastructure by redesigning existing bike lanes and implementing a sensor-based monitoring system to enhance safety and efficiency. A total of 60 sensors will monitor bicycle usage and traffic patterns, while 10 additional sensors will detect illegal parking in bike lanes and provide real-time alerts. The intervention places particular emphasis on addressing safety concerns for female cyclists, creating a safer and more inclusive cycling environment.",
    objectives: [
      "Redesign bike lanes and monitor usage with a city sensor network.",
      "Detect illegal parking in bike lanes and alert in real time.",
      "Improve safety and inclusiveness for female cyclists.",
    ],
    expectedImpacts: [
      "Safer, better-monitored cycling corridors.",
      "Reduced lane encroachment and a more inclusive cycling environment.",
    ],
    geometryType: "line",
    dataAvailability:
      "Bike-lane sensor registry (map geography) plus online bike-safety survey workbooks for KPI 4.2. No radar speed feed — KPI 2.1 speed is mocked from LoRa FREE/BUSY occupancy.",
    methodologyNotes:
      "KPI 4.2 uses baseline + post online bike-safety survey (accessibility, condition, safety Likert). Map pins mark bike-lane sensor locations only. KPI 2.1 occupancy is observed; mock speed = 18×(1−busy%) km/h with a constructed pre-redesign baseline offset.",
    observatoryType: "corridor",
  },
  "tri-p4": {
    id: "tri-p4",
    city: "Trikala",
    title: "SMARTA2 app expansion",
    interventionSummary:
      "The SMARTA2 app, which facilitates access to sustainable transport options, will be expanded to include additional mobility modes and new user engagement features. Citywide Smart Citizen Kit nodes support climate / air-quality monitoring.",
    objectives: [
      "Expand SMARTA2 to cover additional sustainable mobility modes.",
      "Strengthen user engagement features in the app.",
      "Monitor environmental conditions via the Smart Citizen Kit fleet.",
    ],
    expectedImpacts: [
      "Easier access to sustainable transport options.",
      "Higher digital engagement with multimodal services.",
      "Transparent citywide air-quality monitoring coverage.",
    ],
    geometryType: "point",
    dataAvailability:
      "Pilot 4: SMARTA2 user satisfaction is observed. Mode share and climate remain MOCK until evaluation feeds are linked.",
    methodologyNotes:
      "KPI 4.1 user satisfaction = OBSERVED (SMARTA2 survey). KPI 1.2 mode share and KPI 3.2 climate = MOCK (geography only / illustrative figures).",
    observatoryType: "intervention",
  },
};
