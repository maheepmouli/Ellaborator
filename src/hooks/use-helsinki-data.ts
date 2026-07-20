import { useQuery } from "@tanstack/react-query";
import {
  loadHelsinkiConflictsSnapshot,
  loadHelsinkiDangerousLocationsSnapshot,
  loadHelsinkiEscooterObservationsSnapshot,
  loadHelsinkiEvidenceManifestSnapshot,
  loadHelsinkiHslTramSnapshot,
  loadHelsinkiInnotrafikSummarySnapshot,
  loadHelsinkiInterventionLocationsSnapshot,
  loadHelsinkiMobilysisSnapshot,
  loadHelsinkiSafetyAttitudeSnapshot,
  loadHelsinkiTelraamSensorsSnapshot,
  loadHelsinkiTelraamSnapshot,
  loadHelsinkiUxSurveySnapshot,
} from "@/services/helsinkiLocalSnapshots";

function isHelsinkiCity(cityName: string): boolean {
  return cityName.toLowerCase().includes("helsinki");
}

function helsinkiPilotEnabled(pilotId: string | null | undefined, allowed: string[]): boolean {
  if (!pilotId) return true;
  return allowed.includes(pilotId);
}

export function useHelsinkiTelraam(cityName: string, pilotId?: string | null) {
  const enabled = isHelsinkiCity(cityName);
  return useQuery({
    queryKey: ["helsinki-telraam", cityName, pilotId],
    queryFn: () => loadHelsinkiTelraamSnapshot(),
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled,
  });
}

export function useHelsinkiTelraamSensors(cityName: string) {
  return useQuery({
    queryKey: ["helsinki-telraam-sensors", cityName],
    queryFn: () => loadHelsinkiTelraamSensorsSnapshot(),
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: isHelsinkiCity(cityName),
  });
}

export function useHelsinkiMobilysisGates(cityName: string, pilotId?: string | null) {
  return useQuery({
    queryKey: ["helsinki-mobilysis", cityName, pilotId],
    queryFn: () => loadHelsinkiMobilysisSnapshot(),
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: isHelsinkiCity(cityName) && helsinkiPilotEnabled(pilotId, ["hel-p3"]),
  });
}

export function useHelsinkiUxSurvey(cityName: string, pilotId?: string | null) {
  return useQuery({
    queryKey: ["helsinki-ux-survey", cityName, pilotId],
    queryFn: () => loadHelsinkiUxSurveySnapshot(),
    staleTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: isHelsinkiCity(cityName) && helsinkiPilotEnabled(pilotId, ["hel-p3"]),
  });
}

export function useHelsinkiHslTram(cityName: string, pilotId?: string | null) {
  return useQuery({
    queryKey: ["helsinki-hsl-tram", cityName, pilotId],
    queryFn: () => loadHelsinkiHslTramSnapshot(),
    staleTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: isHelsinkiCity(cityName) && helsinkiPilotEnabled(pilotId, ["hel-p3"]),
  });
}

export function useHelsinkiInnotrafikSummary(cityName: string, pilotId?: string | null) {
  return useQuery({
    queryKey: ["helsinki-innotrafik", cityName, pilotId],
    queryFn: () => loadHelsinkiInnotrafikSummarySnapshot(),
    staleTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: isHelsinkiCity(cityName) && helsinkiPilotEnabled(pilotId, ["hel-p3"]),
  });
}

export function useHelsinkiEscooterObservations(cityName: string, pilotId?: string | null) {
  return useQuery({
    queryKey: ["helsinki-escooter", cityName, pilotId],
    queryFn: () => loadHelsinkiEscooterObservationsSnapshot(),
    staleTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: isHelsinkiCity(cityName) && helsinkiPilotEnabled(pilotId, ["hel-p2"]),
  });
}

export function useHelsinkiSafetySurveyGeo(cityName: string, pilotId?: string | null) {
  return useQuery({
    queryKey: ["helsinki-safety-geo", cityName, pilotId],
    queryFn: async () => {
      const [dangerous, conflicts] = await Promise.all([
        loadHelsinkiDangerousLocationsSnapshot(),
        loadHelsinkiConflictsSnapshot(),
      ]);
      return { dangerous, conflicts };
    },
    staleTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: isHelsinkiCity(cityName) && helsinkiPilotEnabled(pilotId, ["hel-p1"]),
  });
}

export function useHelsinkiSafetyAttitude(cityName: string) {
  return useQuery({
    queryKey: ["helsinki-safety-attitude", cityName],
    queryFn: () => loadHelsinkiSafetyAttitudeSnapshot(),
    staleTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: isHelsinkiCity(cityName),
  });
}

export function useHelsinkiInterventionLocations(cityName: string) {
  return useQuery({
    queryKey: ["helsinki-intervention-locations", cityName],
    queryFn: () => loadHelsinkiInterventionLocationsSnapshot(),
    staleTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: isHelsinkiCity(cityName),
  });
}

export function useHelsinkiEvidenceManifest(cityName: string) {
  return useQuery({
    queryKey: ["helsinki-evidence-manifest", cityName],
    queryFn: () => loadHelsinkiEvidenceManifestSnapshot(),
    staleTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: isHelsinkiCity(cityName),
  });
}
