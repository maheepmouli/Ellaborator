import type { CityPilotProfile } from "@/data/cityPilotProfiles";

export type HelsinkiPilotId = "hel-p1" | "hel-p2" | "hel-p3";

export const HELSINKI_PILOT_PROFILES: Record<HelsinkiPilotId, CityPilotProfile> = {
  "hel-p1": {
    id: "hel-p1",
    city: "Helsinki",
    title: "Accident & Near-Miss Data Collection (FVH1)",
    interventionSummary:
      "Safety Sense dangerous-locations and near-miss evidence collection for intervention-level safety monitoring.",
    objectives: [
      "Collect dangerous-location and near-miss evidence at intervention scope.",
      "Track safety pressure and active-mobility context with linked observations.",
    ],
    expectedImpacts: [
      "Higher visibility of high-risk intervention zones.",
      "Faster prioritization of follow-up safety measures.",
    ],
    geometryType: "point",
    dataAvailability: "Dangerous-locations survey and near-miss evidence linked from partner extracts.",
    methodologyNotes:
      "Observed dangerous-location points are rendered from converted partner GeoJSON and contextual support counts.",
    observatoryType: "intervention",
    interventionMarkers: [
      {
        id: "hel-p1-dangerous-locations-layer",
        lat: 60.171,
        lng: 24.941,
        title: "Dangerous locations survey (map layer)",
        interventionType: "Safety monitoring intervention",
        dataAvailability: "Observed GeoJSON",
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
      "Geofencing and parking-zone optimization pilot for e-scooter curbside order and accessibility.",
    objectives: [
      "Reduce unsafe parking and improve sidewalk accessibility.",
      "Track parking behavior shifts at monitored intervention locations.",
    ],
    expectedImpacts: [
      "Improved micromobility parking order near key corridors.",
      "Clearer intervention evidence at site level.",
    ],
    geometryType: "point",
    dataAvailability: "Intervention coordinates available; geofencing and parking observations partially linked.",
    methodologyNotes:
      "Use official intervention coordinates and compare observed parking behavior once post datasets are complete.",
    observatoryType: "intervention",
    interventionMarkers: [
      {
        id: "hel-p2-site-a",
        lat: 60.166009,
        lng: 24.938293,
        title: "Site A",
        interventionType: "E-scooter parking intervention",
        dataAvailability: "Observed location",
        baselineStatus: "Available",
        postStatus: "Pending/partial",
      },
      {
        id: "hel-p2-site-b",
        lat: 60.190069,
        lng: 24.96075,
        title: "Site B",
        interventionType: "E-scooter parking intervention",
        dataAvailability: "Observed location",
        baselineStatus: "Available",
        postStatus: "Pending/partial",
      },
    ],
  },
  "hel-p3": {
    id: "hel-p3",
    city: "Helsinki",
    title: "Intersection Safety at Viikki (FVH3)",
    interventionSummary:
      "Raide-Jokeri crossing safety pilot at Viikki combining lidar, Telraam, and Innotrafik warning-system monitoring.",
    objectives: [
      "Assess multimodal safety at the Viikki intervention crossing.",
      "Compare baseline and post safety context with linked sensor systems.",
    ],
    expectedImpacts: [
      "Improved evidence for intervention safety decisions at Viikki.",
      "Transparent readiness communication for linked sensor feeds.",
    ],
    geometryType: "mixed",
    dataAvailability: "Partial observed data from lidar/Telraam/Innotrafik sources; additional links pending.",
    methodologyNotes:
      "Prioritize intervention crossing geometry and show explicit missing states where post records are not yet linked.",
    observatoryType: "intervention",
  },
};
