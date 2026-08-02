import type { CityPilotProfile } from "@/data/cityPilotProfiles";

export type ZaragozaPilotId = "zar-p1" | "zar-p2" | "zar-p3";

export const ZARAGOZA_PILOT_PROFILES: Record<ZaragozaPilotId, CityPilotProfile> = {
  "zar-p1": {
    id: "zar-p1",
    city: "Zaragoza",
    title: "AYZG1 Tactical urbanism around schools",
    interventionSummary:
      "Pedestrianisation of the section of Pedro III El Grande Street, Creation of a new stay and play area, A new cycle crossing, Associated traffic reorganisation",
    objectives: [
      "Improve active mobility and safety near school corridors.",
      "Repurpose school-front parking into recreational space and organised drop-off.",
    ],
    expectedImpacts: [
      "Safer school-peak pedestrian and cycle conditions.",
      "Lower motor conflict intensity at drop-off windows.",
    ],
    geometryType: "polygon",
    dataAvailability:
      "Baseline ready: school monitoring (Oct 2025), June 2025 manual motor counts, Nanoenvi air quality. Post-implementation folder still empty.",
    methodologyNotes:
      "Area observatory with manualCountBars / motorPressure / proxyDelta. Ped/bike in June manual sheet marked pending autumn recount — Oct school sheets supply peak ped/bike.",
    observatoryType: "area",
  },
  "zar-p2": {
    id: "zar-p2",
    city: "Zaragoza",
    title: "AYZG2 Pedestrian areas around La Romareda",
    interventionSummary:
      "Temporary street interventions around the stadium redevelopment area to inform the design of a long-term street regeneration project through co-creation.",
    objectives: [
      "Improve pedestrian access and safety around the stadium neighbourhood.",
      "Feed co-creation feedback into the parallel street redevelopment project.",
    ],
    expectedImpacts: [
      "Stronger walking priority and safer crossings.",
      "Survey-derived accessibility and satisfaction baselines for before/after.",
    ],
    geometryType: "polygon",
    dataAvailability:
      "Baseline ready: Romareda traffic Comparativa, road-safety citizen survey, barriers/expectations survey, reformado design GIS. Post-implementation empty.",
    methodologyNotes:
      "Use AYZGZ2 polygon + optional Romareda reformado overlay. Survey x/y points drive KPI 4.2 map pins.",
    observatoryType: "area",
  },
  "zar-p3": {
    id: "zar-p3",
    city: "Zaragoza",
    title: "AYZG3 Traffic management — Miguel Servet Hospital",
    interventionSummary:
      "Testing proposed traffic safety improvements around the hospital based on a previous traffic study.",
    objectives: [
      "Reduce operational conflicts on hospital access routes.",
      "Improve safety and accessibility for patients and staff.",
    ],
    expectedImpacts: [
      "Clearer access routing and fewer peak conflicts.",
      "Expansion narrative via tram illuminated/audible signals (OneToOne KPI 1.1 note).",
    ],
    geometryType: "polygon",
    dataAvailability:
      "Quantitative baseline thin — hospital themes appear in citizen/barrier surveys; no hospital speed/count sensors yet. Post-implementation empty. In-scope KPIs: 2.1 + 4.2 only (Evaluation Plan May 2025).",
    methodologyNotes:
      "Area schematic + mock/derived quantitative series until partner sensors/counts arrive. Keep survey-derived qualitative provenance for hospital access (4.2).",
    observatoryType: "area",
  },
};

/** WGS84 centroids from AYZGZ* intervention polygons (Romareda CAD stem excluded — bad CRS). */
export const ZARAGOZA_PILOT_COORDS: Record<ZaragozaPilotId, { lat: number; lng: number }> = {
  "zar-p1": { lat: 41.63636, lng: -0.90574 },
  "zar-p2": { lat: 41.63744, lng: -0.90305 },
  "zar-p3": { lat: 41.63301, lng: -0.90181 },
};

/** SW/NE corners from valid WGS84 AYZGZ polygons (projected Romareda CAD stem excluded). */
export const ZARAGOZA_PILOT_BOUNDS: Record<
  ZaragozaPilotId,
  [[number, number], [number, number]]
> = {
  "zar-p1": [
    [41.63496, -0.90674],
    [41.63766, -0.90479],
  ],
  "zar-p2": [
    [41.63616, -0.90432],
    [41.63922, -0.90116],
  ],
  "zar-p3": [
    [41.63133, -0.90359],
    [41.63493, -0.89964],
  ],
};

export function getZaragozaPilotLatLngBounds(
  pilotId: string | null | undefined
): [[number, number], [number, number]] | null {
  if (!pilotId || !(pilotId in ZARAGOZA_PILOT_BOUNDS)) return null;
  return ZARAGOZA_PILOT_BOUNDS[pilotId as ZaragozaPilotId];
}

/** AYZG4 bike/VMP parking was cancelled — never expose as a selectable Zaragoza pilot. */
export function isZaragozaPilotRemoved(pilotId: string | null | undefined): boolean {
  return pilotId === "zar-p4";
}
