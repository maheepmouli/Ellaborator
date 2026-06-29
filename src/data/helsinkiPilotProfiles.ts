import type { CityPilotProfile } from "@/data/cityPilotProfiles";

export type HelsinkiPilotId = "hel-p1" | "hel-p2" | "hel-p3";

export const HELSINKI_PILOT_PROFILES: Record<HelsinkiPilotId, CityPilotProfile> = {
  "hel-p1": {
    id: "hel-p1",
    city: "Helsinki",
    title: "Safety Sense Helsinki",
    interventionSummary:
      "Safety Sense corridor monitoring with intervention-first visualization and explicit pending links for partner datasets.",
    objectives: [
      "Map intervention geometry and monitoring points first.",
      "Track safety pressure before/after when FVH data is linked.",
    ],
    expectedImpacts: [
      "Better visibility of high-risk intervention zones.",
      "Faster pilot-level prioritization for follow-up measures.",
    ],
    geometryType: "point",
    dataAvailability: "Dangerous locations survey GeoJSON linked from SharePoint extract.",
    methodologyNotes:
      "Observed dangerous-location points are rendered from converted SharePoint GeoJSON (DangerousLocations_hki layer).",
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
    title: "E-scooter parking intervention",
    interventionSummary:
      "Intervention-level monitoring at two official e-scooter parking sites with direct coordinates.",
    objectives: [
      "Reduce unsafe parking and improve sidewalk accessibility.",
      "Track behavior shifts at monitored intervention locations.",
    ],
    expectedImpacts: [
      "Improved micromobility order near key corridors.",
      "Clearer before/after intervention evidence at site level.",
    ],
    geometryType: "point",
    dataAvailability: "Coordinates available; baseline/post monitoring feed partially linked.",
    methodologyNotes:
      "Use official site coordinates as authoritative intervention markers and compare observed directional trends once post dataset is complete.",
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
    title: "Citywide active mobility behavior",
    interventionSummary:
      "Pilot-level intervention observatory combining Telraam and partner mobility observations with explicit data gaps.",
    objectives: [
      "Assess intervention impact on active mobility behavior.",
      "Compare monitored intervention zones with contextual city activity.",
    ],
    expectedImpacts: [
      "Consistent intervention reporting across Helsinki pilots.",
      "Transparent readiness and trust communication for decision makers.",
    ],
    geometryType: "mixed",
    dataAvailability: "Partial observed data; intervention geometry ingestion pending.",
    methodologyNotes:
      "Prioritize intervention geometries and show explicit missing states where post-intervention records are not yet linked.",
    observatoryType: "intervention",
  },
};
