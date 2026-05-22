import type {
  CyclingInfrastructureAPIResponse,
  CyclingInfrastructureAPIParams,
} from "@/types/cycling-infrastructure";
import { getCyclingInfrastructureApiUrl } from "@/lib/api-config";
import {
  clampOpendataLimit,
  fetchOpendataPaginated,
} from "@/lib/issy-opendata";
import type { MapSegment } from "./trafficApi";

/**
 * Fetches cycling infrastructure data from the Issy-les-Moulineaux API
 */
export async function fetchCyclingInfrastructureData(
  params: CyclingInfrastructureAPIParams = {}
): Promise<CyclingInfrastructureAPIResponse> {
  const {
    limit: requestedLimit = 100,
    offset = 0,
    where,
    select,
    order_by,
    refine,
    exclude,
    lang,
    timezone = "Europe/Berlin",
  } = params;

  const limit = clampOpendataLimit(requestedLimit);

  const searchParams = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
    timezone,
  });

  if (where) searchParams.append("where", where);
  if (select) searchParams.append("select", select);
  if (order_by) searchParams.append("order_by", order_by);
  if (lang) searchParams.append("lang", lang);

  // Add refine parameters
  if (refine) {
    Object.entries(refine).forEach(([key, value]) => {
      searchParams.append(`refine.${key}`, value);
    });
  }

  // Add exclude parameters
  if (exclude) {
    Object.entries(exclude).forEach(([key, value]) => {
      searchParams.append(`exclude.${key}`, value);
    });
  }

  const url = `${getCyclingInfrastructureApiUrl()}?${searchParams.toString()}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Cycling infrastructure API error: ${response.status} ${response.statusText}`
      );
    }

    const data: CyclingInfrastructureAPIResponse = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching cycling infrastructure data:", error);
    return { total_count: 0, results: [] };
  }
}

export async function fetchCyclingInfrastructureDataPaginated(
  params: CyclingInfrastructureAPIParams = {},
  desiredLimit: number = 100
): Promise<CyclingInfrastructureAPIResponse> {
  const { limit: _ignored, offset: _offsetIgnored, ...rest } = params;
  return fetchOpendataPaginated(
    (limit, offset) => fetchCyclingInfrastructureData({ ...rest, limit, offset }),
    desiredLimit
  );
}

/**
 * Converts cycling infrastructure records to MapSegment format for visualization
 */
export function cyclingInfrastructureToSegments(
  records: CyclingInfrastructureAPIResponse["results"],
  kpiId?: string
): MapSegment[] {
  return records
    .filter((record) => {
      // Filter out records with no cycling infrastructure
      if (record.type_amgt_cycl === "Aucun aménagement") {
        return false;
      }
      return true;
    })
    .map((record) => {
      // Extract coordinates from geo_shape
      const coordinates: [number, number][] =
        record.geo_shape.geometry.coordinates.map((coord) => [coord[1], coord[0]]); // Note: API returns [lon, lat], Leaflet needs [lat, lon]

      // Calculate a value based on infrastructure type and length
      // This can be customized based on KPI requirements
      let value = 0;
      if (record.type_amgt_cycl === "Bande cyclable") {
        value = 80; // High value for dedicated bike lanes
      } else if (record.type_amgt_cycl === "Pictogrammes seuls") {
        value = 40; // Medium value for bike symbols only
      } else {
        value = 20; // Low value for other types
      }

      // Adjust value based on length (longer = better)
      const lengthFactor = Math.min(record.longueur_m / 100, 1); // Normalize to 0-1
      value = value * (0.7 + 0.3 * lengthFactor);

      return {
        id: record.id_circapaisee,
        coordinates,
        value,
        properties: {
          id: record.id_circapaisee,
          localisation: record.localisation,
          type_amgt_cycl: record.type_amgt_cycl,
          longueur_m: record.longueur_m,
          dbl_sens_cycl: record.dbl_sens_cycl,
          statut_circ: record.statut_circ,
          statut_voie: record.statut_voie,
        },
      };
    });
}

/**
 * Converts cycling infrastructure records to point-based hexbin data
 */
export function cyclingInfrastructureToHexbin(
  records: CyclingInfrastructureAPIResponse["results"],
  kpiId?: string
): Array<{ lat: number; lon: number; value: number; id: string; properties?: Record<string, any> }> {
  return records
    .filter((record) => {
      // Filter out records with no cycling infrastructure
      if (record.type_amgt_cycl === "Aucun aménagement") {
        return false;
      }
      return true;
    })
    .map((record) => {
      // Use geo_point_2d for point visualization
      const lat = record.geo_point_2d.lat;
      const lon = record.geo_point_2d.lon;

      // Calculate value based on infrastructure type
      let value = 0;
      if (record.type_amgt_cycl === "Bande cyclable") {
        value = 80;
      } else if (record.type_amgt_cycl === "Pictogrammes seuls") {
        value = 40;
      } else {
        value = 20;
      }

      // Adjust value based on length
      const lengthFactor = Math.min(record.longueur_m / 100, 1);
      value = value * (0.7 + 0.3 * lengthFactor);

      return {
        lat,
        lon,
        value,
        id: record.id_circapaisee,
        properties: {
          id: record.id_circapaisee,
          localisation: record.localisation,
          type_amgt_cycl: record.type_amgt_cycl,
          longueur_m: record.longueur_m,
          dbl_sens_cycl: record.dbl_sens_cycl,
          statut_circ: record.statut_circ,
        },
      };
    });
}
