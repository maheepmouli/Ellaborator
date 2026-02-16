// Traffic API Types for Issy-les-Moulineaux traffic data

export interface TrafficSegment {
  id: string;
  segment: string;
  type: "Radial" | "Tangentiel";
  noeud_amont: string;
  noeud_aval: string;
  geo_shape: {
    type: "Feature";
    geometry: {
      coordinates: [number, number][];
      type: "LineString";
    };
    properties: Record<string, unknown>;
  };
  date_et_heure_de_comptage_utc: string;
  distance_metres: number;
  vitesse_km_h: number;
  temps_perdu_secondes: number;
  indice_de_congestion: number;
  geo_point_2d: {
    lon: number;
    lat: number;
  };
}

export interface TrafficAPIResponse {
  total_count: number;
  results: TrafficSegment[];
}

export interface TrafficAPIParams {
  limit?: number;
  offset?: number;
  where?: string;
  select?: string;
  order_by?: string;
  refine?: Record<string, string>;
  exclude?: Record<string, string>;
  lang?: string;
  timezone?: string;
}
