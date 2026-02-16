// Cycling Infrastructure API Types for Issy-les-Moulineaux

export interface CyclingInfrastructureRecord {
  id_circapaisee: string;
  localisation: string;
  code_insee: string;
  commune: string;
  type_amgt_cycl: string; // e.g., "Bande cyclable", "Aucun aménagement", "Pictogrammes seuls"
  dbl_sens_cycl: string; // e.g., "Autorisé", "Interdit", "Non concerné"
  sens_circ_amgt: string | null; // e.g., "1 sens"
  pos_amgt_cycl: string | null; // e.g., "Côté pair", "Non concerné"
  situ_amgt_cycl: string | null; // e.g., "Sur la chaussée", "Non concerné"
  sens_circ_cycl: string | null; // e.g., "Double sens", "Sens unique"
  comp_loc: string | null; // Complementary location info
  statut_circ: string; // e.g., "Zone 30", "Voie limitée à 30 km/h"
  annee_statut: string | null;
  circ_motorisee: string; // e.g., "Oui"
  sens_circ_mot: string | null; // e.g., "Sens unique", "Double sens"
  annee_cycl: string | null;
  statut_voie: string; // e.g., "Voie communale", "Route départementale"
  longueur_m: number;
  comp_statut: string | null;
  etat: string; // e.g., "Existant"
  annee: string | null;
  geo_shape: {
    type: "Feature";
    geometry: {
      coordinates: [number, number][];
      type: "LineString";
    };
    properties: Record<string, unknown>;
  };
  geo_point_2d: {
    lon: number;
    lat: number;
  };
}

export interface CyclingInfrastructureAPIResponse {
  total_count: number;
  results: CyclingInfrastructureRecord[];
}

export interface CyclingInfrastructureAPIParams {
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
