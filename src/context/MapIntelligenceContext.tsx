import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type MapScenario = "baseline" | "intervention" | "comparison";

export type TimeWindowKind = "issyDay" | "milanEnv" | "scenario";

export type MapIntelligenceState = {
  city: string;
  pilotId: string | null;
  kpiId: string;
  segmentId: string | null;
  mode: string | null;
  scenario: MapScenario;
  timeWindow: { kind: TimeWindowKind; value: string };
  modeTypes: string[];
  filterRange: [number, number];
  focusMode: boolean;
};

type MapIntelligenceContextValue = MapIntelligenceState & {
  setCity: (city: string) => void;
  setPilotId: (pilotId: string | null) => void;
  setKpiId: (kpiId: string) => void;
  setSegmentId: (segmentId: string | null) => void;
  setMode: (mode: string | null) => void;
  setScenario: (scenario: MapScenario) => void;
  setTimeWindow: (kind: TimeWindowKind, value: string) => void;
  setModeTypes: (modes: string[]) => void;
  setFilterRange: (range: [number, number]) => void;
  setFocusMode: (on: boolean) => void;
  patchSelection: (patch: Partial<Pick<MapIntelligenceState, "segmentId" | "mode" | "kpiId" | "pilotId" | "city">>) => void;
};

const defaultModes = ["Pedestrian", "Cycle", "Public Transport", "Private Car", "PTW"];

const MapIntelligenceContext = createContext<MapIntelligenceContextValue | null>(null);

export function MapIntelligenceProvider({
  children,
  initialCity = "",
  initialKpi = "kpi1.2",
}: {
  children: ReactNode;
  initialCity?: string;
  initialKpi?: string;
}) {
  const [city, setCity] = useState(initialCity);
  const [pilotId, setPilotId] = useState<string | null>(null);
  const [kpiId, setKpiId] = useState(initialKpi);
  const [segmentId, setSegmentId] = useState<string | null>(null);
  const [mode, setMode] = useState<string | null>(null);
  const [scenario, setScenario] = useState<MapScenario>("intervention");
  const [timeWindow, setTimeWindowState] = useState<{ kind: TimeWindowKind; value: string }>({
    kind: "scenario",
    value: "intervention",
  });
  const [modeTypes, setModeTypes] = useState<string[]>(defaultModes);
  const [filterRange, setFilterRange] = useState<[number, number]>([0, 100]);
  const [focusMode, setFocusMode] = useState(false);

  const setTimeWindow = useCallback((kind: TimeWindowKind, value: string) => {
    setTimeWindowState({ kind, value });
  }, []);

  const patchSelection = useCallback(
    (patch: Partial<Pick<MapIntelligenceState, "segmentId" | "mode" | "kpiId" | "pilotId" | "city">>) => {
      if (patch.city !== undefined) setCity(patch.city);
      if (patch.pilotId !== undefined) setPilotId(patch.pilotId);
      if (patch.kpiId !== undefined) setKpiId(patch.kpiId);
      if (patch.segmentId !== undefined) {
        setSegmentId(patch.segmentId);
        setFocusMode(!!patch.segmentId);
      }
      if (patch.mode !== undefined) setMode(patch.mode);
    },
    []
  );

  const value = useMemo<MapIntelligenceContextValue>(
    () => ({
      city,
      pilotId,
      kpiId,
      segmentId,
      mode,
      scenario,
      timeWindow,
      modeTypes,
      filterRange,
      focusMode,
      setCity,
      setPilotId,
      setKpiId,
      setSegmentId,
      setMode,
      setScenario,
      setTimeWindow,
      setModeTypes,
      setFilterRange,
      setFocusMode,
      patchSelection,
    }),
    [
      city,
      pilotId,
      kpiId,
      segmentId,
      mode,
      scenario,
      timeWindow,
      modeTypes,
      filterRange,
      focusMode,
      setTimeWindow,
      patchSelection,
    ]
  );

  return (
    <MapIntelligenceContext.Provider value={value}>{children}</MapIntelligenceContext.Provider>
  );
}

export function useMapIntelligence(): MapIntelligenceContextValue {
  const ctx = useContext(MapIntelligenceContext);
  if (!ctx) {
    throw new Error("useMapIntelligence must be used within MapIntelligenceProvider");
  }
  return ctx;
}

export function useMapIntelligenceOptional(): MapIntelligenceContextValue | null {
  return useContext(MapIntelligenceContext);
}
