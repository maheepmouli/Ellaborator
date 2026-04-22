import { CITY_DATA, ELABORATOR_KPIS } from "@/data/kpiDefinitions";
import { CITY_PILOTS } from "@/data/pilotDefinitions";

export const MOCK_DATA_STRUCTURE = {
  cities: CITY_DATA.map((city) => ({
    id: city.city.toLowerCase().replace(/\s+/g, "-"),
    name: city.city,
    lat: city.lat,
    lng: city.lon,
  })),
  interventions: CITY_PILOTS,
  kpis: ELABORATOR_KPIS.map((kpi) => ({
    id: kpi.id,
    name: kpi.name,
    unit: kpi.unit,
  })),
  kpiValues: CITY_DATA.map((city) => ({
    city: city.city,
    values: city.kpiData,
  })),
};
