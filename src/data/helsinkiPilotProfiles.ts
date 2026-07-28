import type { CityPilotProfile } from "@/data/cityPilotProfiles";

export type HelsinkiPilotId = "hel-p1" | "hel-p2" | "hel-p3";

export const HELSINKI_PILOT_PROFILES: Record<HelsinkiPilotId, CityPilotProfile> = {
  "hel-p1": {
    id: "hel-p1",
    city: "Helsinki",
    title: "Accident & Near-Miss Data Collection (FVH1)",
    interventionSummary:
      "Testing new solutions for collecting, visualising and analysing accident-related information.",
    objectives: [
      "Collect dangerous-location and near-miss evidence at intervention scope.",
      "Track road-user safety pressure from the linked citizen-survey observations.",
    ],
    expectedImpacts: [
      "Higher visibility of high-risk intervention zones.",
      "Faster prioritization of follow-up safety measures.",
    ],
    geometryType: "point",
    dataAvailability:
      "2,663 dangerous-location and 3,202 near-miss/conflict citizen submissions are ingested from the SharePoint GPKG. No pilot-scoped mode-share sensor feed is present in the current data drop for FVH1; See.Sense connected-bike and ViaNova AI risk-scoring feeds are also absent.",
    methodologyNotes:
      "Road-user safety evidence is drawn from the dangerous-location and near-miss/conflict survey layers. The map shows the densest ~8 dangerous-location neighbourhood clusters, while full survey counts remain in the observatory. Telraam Koetilantie belongs to FVH3 and is not reused for FVH1.",
    observatoryType: "intervention",
    interventionMarkers: [
      {
        id: "hel-p1-survey-hub",
        lat: 60.171,
        lng: 24.941,
        title: "Dangerous-locations survey hub",
        interventionType: "Safety monitoring intervention",
        dataAvailability: "Multi-hub ripple clusters on map · full counts in observatory",
        baselineStatus: "Available",
        postStatus: "Survey snapshot",
      },
    ],
  },
  "hel-p2": {
    id: "hel-p2",
    city: "Helsinki",
    title: "E-Scooter Parking Optimisation (FVH2)",
    interventionSummary:
      "Relocation of parking locations for shared mobility services to designated parking areas and geofencing.",
    objectives: [
      "Reduce unsafe parking and improve sidewalk accessibility.",
      "Track parking behavior shifts at monitored intervention locations.",
    ],
    expectedImpacts: [
      "Improved micromobility parking order near key corridors.",
      "Clearer intervention evidence at site level.",
    ],
    geometryType: "point",
    dataAvailability:
      "509 field observations (5 parking categories) from the Kallio summer-streets observation study; the 20 planned e-scooter parking sensors described in the Evaluation Plan were not delivered in this data drop (observation study only).",
    methodologyNotes:
      "Category-level counts (pavement / street / cycleway / outside-zone / bikes) and obstruction/hazard flags are aggregated from the eScooter Observations GPKG layers. KPI 3.1 map dots are field observations (not live sensors); After shows a denser sample of the same single-period study. The 20 planned parking sensors were not delivered.",
    observatoryType: "intervention",
    interventionMarkers: [
      {
        id: "hel-p2-kallio",
        lat: 60.184,
        lng: 24.951,
        title: "Kallio summer-streets observation site",
        interventionType: "E-scooter parking intervention",
        dataAvailability: "Observed GeoJSON (509 field points · map samples ~50)",
        baselineStatus: "Available",
        postStatus: "Parking sensors pending",
      },
    ],
  },
  "hel-p3": {
    id: "hel-p3",
    city: "Helsinki",
    title: "Intersection Safety at Viikki (FVH3)",
    interventionSummary:
      "Enhances safety at intersections, particularly those involving the Raide-Jokeri Light Rail line, by testing real-time warning systems for pedestrians and cyclists, and collecting data on interactions.",
    objectives: [
      "Assess multimodal safety at the Viikki intervention crossing.",
      "Compare baseline and post safety context with linked sensor systems.",
    ],
    expectedImpacts: [
      "Improved evidence for intervention safety decisions at Viikki.",
      "Transparent readiness communication for linked sensor feeds.",
    ],
    geometryType: "mixed",
    dataAvailability:
      "Telraam counts (445 days), a 50-response UX survey (61.5% overall satisfaction vs the \u226575% KPI 4.1 target), Mobilysis gate counts, an HSL tram line 15 position sample, and Innotrafik alarm-duration evidence charts are delivered; the raw Innotrafik alarm-event table and the lidar .pcap capture (~647MB) are not shipped to the browser bundle.",
    methodologyNotes:
      "Telraam is fixed to the Viikintie-Koetilantie crossing anchor rather than an inferred ring layout; UX satisfaction is averaged across the four warning-system questions in the survey; Mobilysis gate counts are AM-window aggregates, not raw trajectories.",
    observatoryType: "intervention",
    interventionMarkers: [
      {
        id: "hel-p3-viikki",
        lat: 60.224599,
        lng: 25.017236,
        title: "Viikintie-Koetilantie tramway crossing",
        interventionType: "Intersection safety monitoring",
        dataAvailability: "Telraam + UX survey + Mobilysis + HSL sample",
        baselineStatus: "Available",
        postStatus: "Warning system pilot active",
      },
    ],
  },
};
