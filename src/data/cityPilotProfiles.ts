export type ObservatoryType =
  | "corridor"
  | "camera"
  | "intervention"
  | "street-segment"
  | "area";

export type InterventionGeometryType = "point" | "line" | "polygon" | "mixed" | "none";

export interface InterventionMarker {
  id: string;
  lat: number;
  lng: number;
  title: string;
  interventionType: string;
  dataAvailability: string;
  baselineStatus: string;
  postStatus: string;
  isPlaceholder?: boolean;
}

export interface CityPilotProfile {
  id: string;
  city: string;
  title: string;
  interventionSummary: string;
  objectives: string[];
  expectedImpacts: string[];
  geometryType: InterventionGeometryType;
  dataAvailability: string;
  methodologyNotes: string;
  observatoryType: ObservatoryType;
  interventionMarkers?: InterventionMarker[];
}

import {
  COPENHAGEN_PILOT_PROFILES,
  type CopenhagenPilotId,
} from "@/data/copenhagenPilotProfiles";
import {
  HELSINKI_PILOT_PROFILES,
  type HelsinkiPilotId,
} from "@/data/helsinkiPilotProfiles";
import { MILAN_PILOT_PROFILES, type MilanPilotId } from "@/data/milanPilotProfiles";
import {
  TRIKALA_PILOT_PROFILES,
  type TrikalaPilotId,
} from "@/data/trikalaPilotProfiles";
import {
  ZARAGOZA_PILOT_PROFILES,
  type ZaragozaPilotId,
} from "@/data/zaragozaPilotProfiles";
import {
  ISSY_CITY_PILOT_PROFILES,
} from "@/data/issyCityPilotProfiles";
import type { IssyPilotId } from "@/data/issyPilotProfiles";

type CityPilotProfileMap =
  & Record<CopenhagenPilotId, CityPilotProfile>
  & Record<HelsinkiPilotId, CityPilotProfile>
  & Record<MilanPilotId, CityPilotProfile>
  & Record<ZaragozaPilotId, CityPilotProfile>
  & Record<TrikalaPilotId, CityPilotProfile>
  & Record<IssyPilotId, CityPilotProfile>;

export const CITY_PILOT_PROFILES: CityPilotProfileMap = {
  ...COPENHAGEN_PILOT_PROFILES,
  ...HELSINKI_PILOT_PROFILES,
  ...MILAN_PILOT_PROFILES,
  ...ZARAGOZA_PILOT_PROFILES,
  ...TRIKALA_PILOT_PROFILES,
  ...ISSY_CITY_PILOT_PROFILES,
};

export function getCityPilotProfile(
  pilotId: string | null | undefined
): CityPilotProfile | null {
  if (!pilotId) return null;
  return CITY_PILOT_PROFILES[pilotId as keyof typeof CITY_PILOT_PROFILES] ?? null;
}
