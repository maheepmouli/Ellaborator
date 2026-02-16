// Bicycle Counting API Types for Issy-les-Moulineaux

export interface BicycleCountingRecord {
  id_compteur: string;
  nom_compteur: string;
  id: string;
  name: string;
  sum_counts: number;
  date: string; // ISO date string
  installation_date: string;
  url_photos_n1?: string;
  coordinates: {
    lon: number;
    lat: number;
  };
  counter: string;
  photos?: string;
  test_lien_vers_photos_du_site_de_comptage_?: string;
  id_photo_1?: string;
  url_sites?: string;
  type_dimage?: string;
  mois_annee_comptage?: string;
}

export interface BicycleCountingAPIResponse {
  total_count: number;
  results: BicycleCountingRecord[];
}

export interface BicycleCountingAPIParams {
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
