export type ViewState = "EUROPE" | "CITY_INTERVENTIONS" | "PILOT_DATA";

export interface SelectedPilot {
  id: string;
  cityId: string;
  name: string;
  title: string;
  description: string;
  scale: "city" | "district" | "street";
  lat: number;
  lng: number;
}

export const CITY_PILOTS: Record<string, SelectedPilot[]> = {
  copenhagen: [
    {
      id: "cph-p1",
      cityId: "copenhagen",
      name: "Pilot 1",
      title: "Relocation of car parking in streets",
      description: "Selected corridors test parking relocation to prioritize active mobility and safer local access.",
      scale: "street",
      lat: 55.685,
      lng: 12.56,
    },
    {
      id: "cph-p2",
      cityId: "copenhagen",
      name: "Pilot 2",
      title: "Enhanced bicycle parking",
      description: "Pilot expands secure bicycle parking nodes near schools and mixed-use streets.",
      scale: "district",
      lat: 55.672,
      lng: 12.525,
    },
    {
      id: "cph-p3",
      cityId: "copenhagen",
      name: "Pilot 3",
      title: "Traffic flow and near encounter",
      description: "Pilot monitors urban flow and near-encounter conditions to support calmer street design.",
      scale: "city",
      lat: 55.67,
      lng: 12.60,
    },
  ],
  milan: [
    {
      id: "mil-p1",
      cityId: "milan",
      name: "Pilot 1",
      title: "Neighbourhood low-traffic zone",
      description: "Traffic calming around local services with priority crossings and public transport links.",
      scale: "district",
      lat: 45.476,
      lng: 9.195,
    },
    {
      id: "mil-p2",
      cityId: "milan",
      name: "Pilot 2",
      title: "Protected cycling corridor",
      description: "Segment-level protected cycle lanes connecting mobility hubs and schools.",
      scale: "street",
      lat: 45.458,
      lng: 9.175,
    },
    {
      id: "mil-p3",
      cityId: "milan",
      name: "Pilot 3",
      title: "Transit-priority reallocation",
      description: "Signal and lane priority interventions to reduce bus delay and improve reliability.",
      scale: "city",
      lat: 45.468,
      lng: 9.215,
    },
  ],
  "issy-les-moulineaux": [
    {
      id: "issy-p1",
      cityId: "issy-les-moulineaux",
      name: "Pilot 1",
      title: "School-area active mobility",
      description: "Pilot promotes safe school-area walking and cycling routes with traffic filtering.",
      scale: "district",
      lat: 48.826,
      lng: 2.267,
    },
    {
      id: "issy-p2",
      cityId: "issy-les-moulineaux",
      name: "Pilot 2",
      title: "Cycle lane continuity",
      description: "Intervention closes gaps in cycle infrastructure near key commuter streets.",
      scale: "street",
      lat: 48.821,
      lng: 2.279,
    },
    {
      id: "issy-p3",
      cityId: "issy-les-moulineaux",
      name: "Pilot 3",
      title: "Congestion-sensitive street tuning",
      description: "Signal timing and street operations tuned using congestion index observations.",
      scale: "city",
      lat: 48.831,
      lng: 2.274,
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
      scale: "district",
      lat: 0,
      lng: 0,
    },
  ];
}
