import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Database } from "lucide-react";
import { getPilotById } from "@/data/pilotDefinitions";
import { useMilanEnvironmentSegments, useMilanSpeedSegments } from "@/hooks/use-milan-segment-data";
import {
  buildMilanJunctionAccessibilityMockPoints,
  buildMilanJunctionClimateMockPoints,
  buildMilanJunctionModeShareMockPoints,
  milanHasObservedAccessibilityData,
  milanHasObservedClimateData,
  milanHasObservedModeShareData,
  milanJunctionAnchorsForPilot,
} from "@/lib/milanMapLayers";
import { useLocalCityData } from "@/hooks/use-local-city-data";
import { getKpiMissingDataNotice } from "@/lib/kpiMissingDataMessage";
import { dataClassLabel } from "@/lib/observatoryCityContent";
import {
  buildObservatoryGraphicPayload,
  getCityCenter,
} from "@/lib/observatoryGraphicData";
import {
  kpiStatusCaption,
  resolveObservatoryGraphic,
  resolveObservatoryType,
} from "@/lib/observatoryGraphicsRegistry";
import type { ObservatoryGraphicZone } from "@/lib/observatoryGraphicTypes";
import type { ObservatoryGraphicId } from "@/lib/observatoryGraphicTypes";
import type { JunctionStudyView } from "@/lib/issyJunctionAnalytics";
import type { MapScenario } from "@/context/MapIntelligenceContext";
import { OBS_C, obsGlassCardClass, obsGlassCardStyle } from "@/components/observatory/observatoryStyles";
import { JunctionSchematic } from "@/components/observatory/schematics/JunctionSchematic";
import { CameraCorridorSchematic } from "@/components/observatory/schematics/CameraCorridorSchematic";
import { StreetSegmentSchematic } from "@/components/observatory/schematics/StreetSegmentSchematic";
import { InterventionPointsSchematic } from "@/components/observatory/schematics/InterventionPointsSchematic";
import { AreaPolygonSchematic } from "@/components/observatory/schematics/AreaPolygonSchematic";
import { ModeShareBarChart } from "@/components/observatory/charts/ModeShareBarChart";
import { PrePostTrendChart } from "@/components/observatory/charts/PrePostTrendChart";
import { SafetyPressureChart } from "@/components/observatory/charts/SafetyPressureChart";
import { FacilityCategoryChart } from "@/components/observatory/charts/FacilityCategoryChart";
import { ClimateComparisonChart } from "@/components/observatory/charts/ClimateComparisonChart";
import { LikertDistributionChart } from "@/components/observatory/charts/LikertDistributionChart";
import { DirectionBreakdownPanel } from "@/components/observatory/charts/DirectionBreakdownPanel";
import { StatCardsChart } from "@/components/observatory/charts/StatCardsChart";
import { getTrikalaSegmentInsights, getTrikalaWomenMobilityModeShareRows } from "@/services/trikalaSurveyParser";
import { loadTrikalaLocationsBundle } from "@/data/trikalaLocationRegistry";

function SourceTag({ label }: { label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] text-white/70"
      style={{ borderColor: OBS_C.border, background: "rgba(255,255,255,0.04)" }}
    >
      <Database className="h-2.5 w-2.5" />
      {label}
    </span>
  );
}

function MockDisclaimer() {
  return (
    <div
      className="rounded-lg border px-2.5 py-2 text-[10px] text-amber-100/90 leading-relaxed"
      style={{ borderColor: "rgba(245,158,11,0.35)", background: "rgba(245,158,11,0.08)" }}
    >
      Registry mock data — link observed datasets to replace illustrative values.
    </div>
  );
}

function IllustrativeDisclaimer({ text }: { text: string }) {
  return (
    <div
      className="rounded-lg border px-2.5 py-2 text-[10px] text-amber-100/90 leading-relaxed"
      style={{ borderColor: "rgba(245,158,11,0.35)", background: "rgba(245,158,11,0.08)" }}
    >
      {text}
    </div>
  );
}

function renderGraphic(
  graphicId: ObservatoryGraphicId,
  payload: ReturnType<typeof buildObservatoryGraphicPayload>,
  compact: boolean,
  onSelectDirectionId?: (id: string) => void
) {
  if (!payload) return null;
  const expanded = !compact;

  switch (graphicId) {
    case "junctionSchematic":
      return <JunctionSchematic payload={payload} expanded={expanded} />;
    case "cameraCorridorSchematic":
      return (
        <CameraCorridorSchematic
          payload={payload}
          expanded={expanded}
          onSelectDirection={onSelectDirectionId}
        />
      );
    case "streetSegmentSchematic":
      return <StreetSegmentSchematic payload={payload} expanded={expanded} />;
    case "interventionPointsSchematic":
      return <InterventionPointsSchematic payload={payload} expanded={expanded} />;
    case "areaPolygonSchematic":
      return <AreaPolygonSchematic payload={payload} expanded={expanded} />;

    case "modeShareBars":
    case "telraamModeBars":
    case "segmentModeShare":
    case "manualCountBars":
      return <ModeShareBarChart payload={payload} compact={compact} />;
    case "prePostTrend":
      return <PrePostTrendChart payload={payload} compact={compact} />;
    case "junctionPressure":
    case "flowPressure":
    case "safetyDensity":
    case "speedProfile":
    case "motorPressure":
      return <SafetyPressureChart payload={payload} compact={compact} />;
    case "facilityInventory":
    case "facilityStrip":
      return <FacilityCategoryChart payload={payload} compact={compact} />;
    case "climateField":
    case "climateComparison":
    case "motorIntensity":
    case "envProxy":
    case "reteBand":
    case "proxyDelta":
      return <ClimateComparisonChart payload={payload} compact={compact} />;
    case "surveyLikert":
    case "accessLikert":
    case "likertRadar":
      return <LikertDistributionChart payload={payload} compact={compact} />;
    case "directionModeBreakdown":
    case "directionBreakdown":
      return (
        <DirectionBreakdownPanel
          payload={payload}
          compact={compact}
          onSelectDirection={onSelectDirectionId}
        />
      );
    case "sentimentGauge":
    case "sentiment":
    case "dssBars":
    case "accessibilityBars":
      return payload.likert?.length && payload.kpiId === "kpi4.2" ? (
        <LikertDistributionChart payload={payload} compact={compact} />
      ) : (
        <StatCardsChart payload={payload} compact={compact} />
      );
    default:
      return <StatCardsChart payload={payload} compact={compact} />;
  }
}

export interface ObservatoryGraphicSlotProps {
  zone: ObservatoryGraphicZone;
  cityName: string;
  pilotId?: string | null;
  selectedKpi: string;
  view: JunctionStudyView;
  scenario: MapScenario;
  selectedModeTypes?: string[];
  selectedDirectionId?: string | null;
  onSelectDirectionId?: (id: string) => void;
  selectedSegmentId?: string | null;
  /** Header strip mode — renders schematic only with caption export */
  headerMode?: boolean;
  onCaptionsReady?: (captions: { primary: string; secondary: string; tertiary: string }) => void;
}

export function ObservatoryGraphicSlot({
  zone,
  cityName,
  pilotId,
  selectedKpi,
  view,
  scenario,
  selectedModeTypes = [],
  selectedDirectionId,
  onSelectDirectionId,
  selectedSegmentId,
  headerMode,
}: ObservatoryGraphicSlotProps) {
  const observatoryType = resolveObservatoryType(cityName, pilotId);
  const spec = resolveObservatoryGraphic(
    observatoryType,
    selectedKpi,
    zone,
    pilotId,
    selectedSegmentId
  );
  const cityCenter = useMemo(() => getCityCenter(cityName), [cityName]);
  const isTrikala = cityName.toLowerCase().includes("trikala");
  const isMilan = cityName === "Milan";
  const milanPilotId =
    pilotId === "mil-p1" || pilotId === "mil-p2" || pilotId === "mil-p3"
      ? pilotId
      : "mil-p2";
  const { data: milanSpeedForObservatory } = useMilanSpeedSegments(
    milanPilotId,
    isMilan &&
      (selectedKpi === "kpi2.1" ||
        selectedKpi === "kpi1.2" ||
        selectedKpi === "kpi3.2" ||
        selectedKpi === "kpi4.2")
  );
  const { data: milanEnvForObservatory } = useMilanEnvironmentSegments(
    "08-09",
    isMilan && selectedKpi === "kpi3.2",
    milanPilotId
  );
  const { data: localPoints = [] } = useLocalCityData(
    cityName,
    selectedKpi,
    cityCenter,
    pilotId,
    scenario
  );
  const milanJunctionMockPoints = useMemo(() => {
    if (!isMilan || !milanSpeedForObservatory?.records?.length) return [];
    const junctions = milanJunctionAnchorsForPilot(milanSpeedForObservatory.records);
    if (!junctions.length) return [];

    if (selectedKpi === "kpi1.2") {
      if (!milanHasObservedModeShareData(localPoints, milanPilotId)) {
        return buildMilanJunctionModeShareMockPoints(junctions, milanPilotId);
      }
      return [];
    }
    if (selectedKpi === "kpi3.2" && !milanHasObservedClimateData(milanEnvForObservatory)) {
      return buildMilanJunctionClimateMockPoints(junctions, milanPilotId);
    }
    if (
      selectedKpi === "kpi4.2" &&
      !milanHasObservedAccessibilityData(localPoints, milanPilotId)
    ) {
      return buildMilanJunctionAccessibilityMockPoints(junctions, milanPilotId);
    }
    return [];
  }, [
    isMilan,
    selectedKpi,
    milanSpeedForObservatory,
    milanEnvForObservatory,
    localPoints,
    milanPilotId,
  ]);
  const { data: trikalaSegmentInsights = [] } = useQuery({
    queryKey: ["trikala-segment-insights", pilotId],
    queryFn: getTrikalaSegmentInsights,
    enabled: isTrikala && selectedKpi === "kpi1.2",
    staleTime: 120_000,
  });
  const { data: trikalaWomenMobilityModeShare = [] } = useQuery({
    queryKey: ["trikala-women-mobility-mode-share-obs", pilotId, selectedSegmentId],
    queryFn: () => getTrikalaWomenMobilityModeShareRows(selectedSegmentId),
    enabled: isTrikala && selectedKpi === "kpi1.2" && pilotId !== "tri-p2",
    staleTime: 120_000,
  });
  const { data: trikalaLocationsBundle } = useQuery({
    queryKey: ["trikala-locations-bundle-observatory"],
    queryFn: loadTrikalaLocationsBundle,
    enabled: isTrikala,
    staleTime: 600_000,
  });
  const points = isMilan && milanJunctionMockPoints.length ? milanJunctionMockPoints : localPoints;

  const payload = useMemo(
    () =>
      spec
        ? buildObservatoryGraphicPayload({
            cityName,
            pilotId,
            selectedKpi,
            zone,
            view,
            scenario,
            points,
            selectedModeTypes,
            selectedDirectionId,
            selectedSegmentId,
            spec,
            trikalaSegmentInsights: isTrikala ? trikalaSegmentInsights : undefined,
            trikalaLocations: isTrikala ? trikalaLocationsBundle?.locations : undefined,
            trikalaSensorJoins: isTrikala ? trikalaLocationsBundle?.sensorJoins : undefined,
            trikalaWomenMobilityModeShare:
              isTrikala && pilotId !== "tri-p2" ? trikalaWomenMobilityModeShare : undefined,
            milanSegmentStats: isMilan ? milanSpeedForObservatory?.stats : undefined,
          })
        : null,
    [
      spec,
      cityName,
      pilotId,
      selectedKpi,
      zone,
      view,
      scenario,
      points,
      selectedModeTypes,
      selectedDirectionId,
      selectedSegmentId,
      trikalaSegmentInsights,
      trikalaWomenMobilityModeShare,
      trikalaLocationsBundle?.locations,
      trikalaLocationsBundle?.sensorJoins,
      milanSpeedForObservatory?.stats,
      milanJunctionMockPoints,
    ]
  );

  const pilot = getPilotById(cityName, pilotId);
  const missingNotice = getKpiMissingDataNotice(cityName, selectedKpi, pilot);
  const compact = zone === "header" || spec?.variant === "compact";
  const showTrikalaPilot2Illustrative =
    isTrikala &&
    pilotId === "tri-p2" &&
    selectedKpi === "kpi1.2" &&
    zone !== "header" &&
    (spec?.graphicId === "modeShareBars" || spec?.graphicId === "segmentModeShare");

  if (!spec || !payload) return null;

  if (spec.emptyState && payload.dataClass === "mock" && zone !== "header") {
    return (
      <div className="space-y-2 mb-3">
        <div className={obsGlassCardClass()} style={obsGlassCardStyle()}>
          <p className="text-[11px] text-white/70 leading-relaxed">{spec.emptyState}</p>
          {missingNotice && (
            <p className="text-[10px] text-amber-100/85 mt-2">{missingNotice}</p>
          )}
        </div>
        <SourceTag label={payload.sourceLabel} />
      </div>
    );
  }

  const graphic = renderGraphic(spec.graphicId, payload, compact, onSelectDirectionId);

  if (headerMode) {
    const captions = kpiStatusCaption(
      observatoryType,
      selectedKpi,
      payload.dataClass,
      cityName,
      payload.sourceLabel
    );
    return (
      <div className="flex items-center gap-3 w-full">
        {graphic}
        <div className="flex-1 space-y-2" data-observatory-captions>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: OBS_C.cyan }} />
            <span className="text-white/55">{captions.primary}</span>
          </div>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: OBS_C.lime }} />
            <span className="text-white/55">{captions.secondary}</span>
          </div>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: OBS_C.lavender }} />
            <span className="text-white/55">{captions.tertiary}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 mb-3">
      {graphic}
      <div className="flex flex-wrap items-center gap-2">
        <SourceTag label={payload.sourceLabel} />
        <span className="text-[9px] text-white/40">{dataClassLabel(payload.dataClass)}</span>
      </div>
      {payload.dataClass === "mock" && <MockDisclaimer />}
      {showTrikalaPilot2Illustrative && (
        <IllustrativeDisclaimer text="Illustrative intermodal proxy per P+R hub — partner occupancy survey pending (June 2026 drop)." />
      )}
      {missingNotice && payload.dataClass !== "observed" && (
        <p className="text-[10px] text-amber-100/85 leading-relaxed">{missingNotice}</p>
      )}
    </div>
  );
}

export { kpiStatusCaption };
