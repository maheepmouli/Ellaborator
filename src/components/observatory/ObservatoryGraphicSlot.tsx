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
import { SurveyPieChart } from "@/components/observatory/charts/SurveyPieChart";
import { SentimentGaugeChart } from "@/components/observatory/charts/SentimentGaugeChart";
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
  zone: ObservatoryGraphicZone,
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
      return (
        <ModeShareBarChart
          payload={payload}
          compact={compact}
          onSelectMode={(mode) => {
            const match = payload.cameraDirections?.find(
              (d) => d.direction === mode || d.direction.startsWith(mode.slice(0, 12))
            );
            if (match) onSelectDirectionId?.(match.id);
          }}
        />
      );
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
      return (
        <ClimateComparisonChart
          payload={payload}
          compact={compact}
          showSegmentMap={zone === "header"}
        />
      );
    case "surveyPie":
    case "surveyLikert":
      return <SurveyPieChart payload={payload} compact={compact} />;
    case "accessLikert":
    case "likertRadar":
      return payload.surveyDistribution?.after?.length ? (
        <SurveyPieChart payload={payload} compact={compact} />
      ) : (
        <LikertDistributionChart payload={payload} compact={compact} />
      );
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
      return <SentimentGaugeChart payload={payload} compact={compact} />;
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
  /** Force a specific graphic (e.g. overview before/after for every KPI). */
  graphicOverride?: ObservatoryGraphicId;
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
  graphicOverride,
  headerMode,
}: ObservatoryGraphicSlotProps) {
  const observatoryType = resolveObservatoryType(cityName, pilotId);
  const spec = graphicOverride
    ? ({ graphicId: graphicOverride, kind: "chart", variant: "compact" } as const)
    : resolveObservatoryGraphic(
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
      return buildMilanJunctionClimateMockPoints(
        junctions,
        milanPilotId,
        milanSpeedForObservatory.records
      );
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
            milanSpeedRecords: isMilan ? milanSpeedForObservatory?.records : undefined,
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
      milanSpeedForObservatory?.records,
      milanJunctionMockPoints,
    ]
  );

  const pilot = getPilotById(cityName, pilotId);
  const missingNotice = getKpiMissingDataNotice(cityName, selectedKpi, pilot);
  // Header strip uses the large schematic — freed space after removing repetitive chips.
  const compact = zone === "header" && !headerMode;
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

  const graphic = renderGraphic(spec.graphicId, payload, compact, zone, onSelectDirectionId);

  if (headerMode) {
    const isGauge = spec.graphicId === "sentimentGauge" || spec.graphicId === "sentiment";
    const isCompactSpeed =
      spec.graphicId === "streetSegmentSchematic" || spec.graphicId === "speedProfile";
    // Helsinki FVH2 facilities: never show junction SensorDot schematic in the header.
    const hideSensorSchematic =
      cityName === "Helsinki" &&
      pilotId === "hel-p2" &&
      selectedKpi === "kpi3.1" &&
      (spec.graphicId === "junctionSchematic" || spec.graphicId === "interventionPointsSchematic");
    if (hideSensorSchematic) {
      return (
        <div className="flex justify-center items-center w-full min-h-0 py-1">
          {renderGraphic("facilityInventory", payload, true, zone, onSelectDirectionId)}
        </div>
      );
    }
    return (
      <div
        className={`flex justify-center items-center w-full ${
          isGauge ? "min-h-[200px] py-1" : isCompactSpeed ? "min-h-0 py-1" : "min-h-[320px]"
        }`}
      >
        {graphic}
      </div>
    );
  }

  const captions = kpiStatusCaption(
    observatoryType,
    selectedKpi,
    payload.dataClass,
    cityName,
    payload.sourceLabel,
    pilotId
  );

  return (
    <div className="space-y-2 mb-3">
      {graphic}
      <div className="flex flex-wrap items-center gap-2">
        <SourceTag label={payload.sourceLabel} />
        <span className="text-[9px] text-white/40">{dataClassLabel(payload.dataClass)}</span>
      </div>
      {zone === "overview" && (
        <div
          className={obsGlassCardClass(true)}
          style={obsGlassCardStyle()}
        >
          <p className="text-[11px] font-semibold text-white/70 mb-2">Evidence for this view</p>
          <ul className="list-disc pl-4 space-y-1 text-[10px] text-white/65 leading-relaxed">
            <li>{captions.primary}</li>
            <li>{captions.secondary}</li>
            <li>{captions.tertiary}</li>
          </ul>
        </div>
      )}
      {payload.dataClass === "mock" && <MockDisclaimer />}
      {showTrikalaPilot2Illustrative && (
        <IllustrativeDisclaimer text="Illustrative bike uptake from park-and-ride facilities (Evaluation Plan KPI 1.2) — partner occupancy survey pending." />
      )}
      {missingNotice && payload.dataClass !== "observed" && (
        <p className="text-[10px] text-amber-100/85 leading-relaxed">{missingNotice}</p>
      )}
    </div>
  );
}

export { kpiStatusCaption };
