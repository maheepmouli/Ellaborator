import type { CityPilotProfile } from "@/data/cityPilotProfiles";
import type { TrikalaPilotId } from "@/lib/trikalaMapConfig";

export type { TrikalaPilotId };

export const TRIKALA_PILOT_PROFILES: Record<TrikalaPilotId, CityPilotProfile> = {
  "tri-p1": {
    id: "tri-p1",
    city: "Trikala",
    title: "Smart crossing — Military School",
    interventionSummary:
      "Smart crossing at Vasili Tsitsani / Military School corridor — baseline and post-intervention survey waves (n≈143) with traffic-signal nodes and corridor air-quality sensors from partner My Maps.",
    objectives: [
      "Measure perceived crossing safety before and after smart-crossing deployment.",
      "Monitor corridor accessibility for school routes and vulnerable users.",
      "Link survey Likert deltas to observed crossing infrastructure geometry.",
    ],
    expectedImpacts: [
      "Improved crossing safety and cyclist visibility at the Military School junction.",
      "Reduced perceived risk on Asklipiou × Stratigou Sarafi approaches.",
    ],
    geometryType: "line",
    dataAvailability:
      "Partner My Maps coordinates + 6 SharePoint survey workbooks (baseline + post). Post-intervention sensor time-series pending.",
    methodologyNotes:
      "Real baseline vs post Likert deltas from paired smart-crossing surveys. Map layers use partner KML geodata (crossing site, TZAMI, traffic lights, corridor sensors).",
    observatoryType: "street-segment",
  },
  "tri-p2": {
    id: "tri-p2",
    city: "Trikala",
    title: "Park & Ride stations",
    interventionSummary:
      "Second ELABORATOR intervention — SMY, DEH, and GiSeMi Park & Ride hubs with municipal parking context. Partner polygon geodata integrated; structured post-intervention survey workbook still pending.",
    objectives: [
      "Surface intermodal shift potential at peripheral P+R hubs.",
      "Map parking supply and bike-station connectivity around P+R sites.",
      "Prepare observatory for post-intervention mode-share tracking when partner data arrives.",
    ],
    expectedImpacts: [
      "Increased park-and-ride uptake reducing inner-city car trips.",
      "Better visibility of multimodal access at SMY, DEH, and GiSeMi.",
    ],
    geometryType: "polygon",
    dataAvailability:
      "Partner My Maps polygon geodata for 3 P+R sites. SharePoint P+R survey folder empty in June 2026 drop.",
    methodologyNotes:
      "Infrastructure-only pilot until post-intervention counts arrive (expected end of June per partner). Municipal parking nodes shown as context layer.",
    observatoryType: "area",
  },
  "tri-p3": {
    id: "tri-p3",
    city: "Trikala",
    title: "Redesigned bike lanes",
    interventionSummary:
      "Bike lane safety redesign monitored through baseline and post surveys (n≈310 baseline) plus 30 partner bike-lane sensor nodes and 7 municipal bike stations from My Maps.",
    objectives: [
      "Track bike-lane safety, encroachment factors, and night-cycling perceptions.",
      "Visualise sensor fleet coverage across redesigned corridors.",
      "Connect infrastructure quality (KPI 4.2) to perceived safety (KPI 2.1).",
    ],
    expectedImpacts: [
      "Reduced lane encroachment and higher night-cycling confidence.",
      "Evidence-backed bike network narrative for stakeholder review.",
    ],
    geometryType: "line",
    dataAvailability:
      "Partner My Maps point geodata (30 bike-lane sensors, 7 bike stations) + paired bike safety survey workbooks.",
    methodologyNotes:
      "Survey aggregates joined to bike-lane sensor registry. Women mobility and SMARTA app surveys remain city-wide context on Pilot 1 observatory.",
    observatoryType: "corridor",
  },
};
