import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Eye, X } from "lucide-react";
import Header from "@/components/Header";
import HeroMap from "@/components/HeroMap";
import InsightPanel from "@/components/InsightPanel";
import MapControls from "@/components/MapControls";
import MapTour from "@/components/MapTour";
import DataSummaryPanel from "@/components/ScenarioPanel";
import SegmentIntelligencePanel from "@/components/SegmentIntelligencePanel";
import { getPilotsByCity, SelectedPilot, ViewState } from "@/data/pilotDefinitions";
import { CITY_DATA, ELABORATOR_KPIS } from "@/data/kpiDefinitions";
import { resolveMapLegend, type MapLegendMarker } from "@/lib/mapLayerLegend";
import { ISSY_P2_JUNCTION, isIssyStudyPilot } from "@/lib/issyPilot2Junction";
import { getKpi32TimeSeriesIntensity } from "@/lib/kpi32YearIntensity";
import { useLatestTrafficData } from "@/hooks/use-traffic-data";
import { pickDefaultSegment } from "@/lib/issyJunctionAnalytics";
import { getIssyPilotProfile } from "@/data/issyPilotProfiles";
import { canOpenObservatory } from "@/lib/observatoryAccess";
import type { MapSelectionState } from "@/types/mapSelection";
import { useMilanSpeedSegments } from "@/hooks/use-milan-segment-data";
import type { MapSegment } from "@/services/trafficApi";
import { TimeWindowChip } from "@/components/TimeWindowChip";
import { MapIntelligenceProvider, useMapIntelligence } from "@/context/MapIntelligenceContext";

/** Glyphs aligned with geometry: discs for points, short bars for polylines, squares for polygons, strips for ramps. */
function LegendSwatch({ marker, color }: { marker: Exclude<MapLegendMarker, "polygonRamp">; color: string }) {
  if (marker === "line") {
    return (
      <span
        className="inline-block h-2.5 w-[3.75rem] rounded-full shrink-0 shadow-[0_0_0_1px_rgba(255,255,255,0.12)]"
        style={{ backgroundColor: color }}
        aria-hidden
      />
    );
  }
  if (marker === "polygon") {
    return (
      <span
        className="inline-block h-3.5 w-3.5 rounded-sm shrink-0 border border-white/35 shadow-sm"
        style={{ backgroundColor: color }}
        aria-hidden
      />
    );
  }
  if (marker === "ramp") {
    return (
      <span
        className="inline-block h-3 flex-1 min-w-0 rounded-[3px]"
        style={{ backgroundColor: color }}
        aria-hidden
      />
    );
  }
  return (
    <span
      className="inline-block h-3.5 w-3.5 rounded-full shrink-0 border border-white/35 shadow-sm"
      style={{ backgroundColor: color }}
      aria-hidden
    />
  );
}

type SegmentContext = {
  segmentName: string;
  speed: number | null;
  congestion: number | null;
};

type DataQualitySummary = {
  recordsLabel: string;
  spatialQuality: string;
  dataType: string;
  temporalCoverage: string;
  confidence: "High" | "Medium" | "Low";
  provenanceType?: string;
  geometryLinkage?: string;
  spatialSystemHint?: string;
};

const MapContent = () => {
  const intel = useMapIntelligence();
  // Start with the tour open when the map first loads
  const [showTour, setShowTour] = useState(true);
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedPilot, setSelectedPilot] = useState<SelectedPilot | null>(null);
  const issyJunctionStudy = isIssyStudyPilot(selectedPilot?.id);
  const [selectedKpi, setSelectedKpi] = useState("kpi1.2");
  const [mapRef, setMapRef] = useState<any>(null);
  const [viewLevel, setViewLevel] = useState<ViewState>("EUROPE");
  const [isDataSummaryOpen, setIsDataSummaryOpen] = useState(false);
  const [isObservatoryOpen, setIsObservatoryOpen] = useState(false);
  const {
    scenario,
    setScenario,
    filterRange,
    setFilterRange,
    modeTypes: selectedModeTypes,
    setModeTypes: setSelectedModeTypes,
    segmentId: selectedJunctionSegmentId,
    setSegmentId: setSelectedJunctionSegmentId,
    focusMode,
    setFocusMode,
    patchSelection,
    setCity: setIntelCity,
    setPilotId: setIntelPilotId,
    setKpiId: setIntelKpiId,
    setTimeWindow,
  } = intel;
  const { data: issyJunctionTraffic } = useLatestTrafficData(
    selectedCity.toLowerCase().includes("issy") ? selectedCity : "",
    8
  );
  const [isLegendOpen, setIsLegendOpen] = useState(true);
  const [mapContext, setMapContext] = useState<SegmentContext | null>(null);
  /** Pilot map highlights intervention streets by default — no toggle in the sidebar. */
  const showInterventionLayer = true;
  const [dataQualitySummary, setDataQualitySummary] = useState<DataQualitySummary | null>(null);
  const [mapSelection, setMapSelection] = useState<MapSelectionState>({});
  /** Milan KPI 3.2 RETE hour band (discrete); independent of baseline/intervention scenario toggle. */
  const [milanEnvWindow, setMilanEnvWindow] = useState<"08-09" | "18-19">("08-09");
  /** Issy KPI 1.2 zone-flow CSV weekday vs weekend (React Query key shared with map). */
  const [issyFlowDayCategory, setIssyFlowDayCategory] = useState<"all" | "weekday" | "weekend">("all");
  /** Sidebar chart drills → animate map viewport to pilot anchors. */
  const pilotFlyNonceRef = useRef(0);
  const [pilotFlyToSignal, setPilotFlyToSignal] = useState<{
    nonce: number;
    lat: number;
    lng: number;
    zoom?: number;
  } | null>(null);
  /** KPI 3.1 chart selection → tighten infrastructure points on the map. */
  const [infrastructureMapFocus, setInfrastructureMapFocus] = useState<string | null>(null);
  /** KPI 3.2 trend chart — selected year drives map emission / climate intensity. */
  const [emissionsIntensityYear, setEmissionsIntensityYear] = useState<string | null>(null);
  const resetToEuropeRef = useRef<null | (() => void)>(null);

  const requestPilotMapFocus = useCallback((lat: number, lng: number, zoom?: number) => {
    pilotFlyNonceRef.current += 1;
    setPilotFlyToSignal({ nonce: pilotFlyNonceRef.current, lat, lng, zoom });
  }, []);

  useEffect(() => {
    setIntelCity(selectedCity);
  }, [selectedCity, setIntelCity]);

  useEffect(() => {
    setIntelKpiId(selectedKpi);
  }, [selectedKpi, setIntelKpiId]);

  useEffect(() => {
    setIntelPilotId(selectedPilot?.id ?? null);
  }, [selectedPilot?.id, setIntelPilotId]);

  useEffect(() => {
    setTimeWindow("scenario", scenario);
  }, [scenario, setTimeWindow]);

  useEffect(() => {
    if (selectedCity.toLowerCase().includes("issy") && selectedKpi === "kpi1.2") {
      setTimeWindow("issyDay", issyFlowDayCategory);
    }
  }, [issyFlowDayCategory, selectedCity, selectedKpi, setTimeWindow]);

  useEffect(() => {
    if (selectedCity === "Milan" && selectedKpi === "kpi3.2") {
      setTimeWindow("milanEnv", milanEnvWindow);
    }
  }, [milanEnvWindow, selectedCity, selectedKpi, setTimeWindow]);

  useEffect(() => {
    if (
      focusMode &&
      selectedJunctionSegmentId &&
      canOpenObservatory(selectedCity, selectedPilot?.id, selectedKpi)
    ) {
      setIsObservatoryOpen(true);
    }
  }, [focusMode, selectedJunctionSegmentId, selectedCity, selectedPilot?.id, selectedKpi]);

  useEffect(() => {
    setInfrastructureMapFocus(null);
    setEmissionsIntensityYear(null);
  }, [selectedKpi]);

  useEffect(() => {
    setInfrastructureMapFocus(null);
    setEmissionsIntensityYear(null);
    setIsObservatoryOpen(false);
    setSelectedJunctionSegmentId(null);
    setFocusMode(false);
  }, [selectedPilot?.id, setSelectedJunctionSegmentId, setFocusMode]);

  useEffect(() => {
    if (!selectedPilot?.id?.startsWith("issy-p")) return;
    const profile = getIssyPilotProfile(selectedPilot.id);
    if (profile && selectedPilot.supportedKpis.includes(profile.defaultKpi)) {
      setSelectedKpi(profile.defaultKpi);
    }
    requestPilotMapFocus(ISSY_P2_JUNCTION.lat, ISSY_P2_JUNCTION.lon, 17);
    const defaultSeg = pickDefaultSegment(issyJunctionTraffic?.results ?? []);
    if (defaultSeg) {
      patchSelection({ segmentId: defaultSeg.id });
    }
    setMapSelection({
      city: selectedCity,
      pilotId: selectedPilot.id,
      kpi: profile?.defaultKpi ?? selectedKpi,
      segmentId: defaultSeg?.id ?? null,
    });
  }, [selectedPilot?.id, requestPilotMapFocus, issyJunctionTraffic?.results, selectedCity, selectedPilot?.supportedKpis, patchSelection]);

  const milanPilotId =
    selectedPilot?.id === "mil-p1" || selectedPilot?.id === "mil-p2" || selectedPilot?.id === "mil-p3"
      ? selectedPilot.id
      : "mil-p2";
  const { data: milanSpeedForObservatory } = useMilanSpeedSegments(
    milanPilotId,
    selectedCity === "Milan" && selectedKpi === "kpi2.1"
  );

  const observatorySegments: MapSegment[] = useMemo(() => {
    if (selectedCity.toLowerCase().includes("issy") && issyJunctionTraffic?.results?.length) {
      return issyJunctionTraffic.results;
    }
    if (selectedCity === "Milan" && milanSpeedForObservatory?.records?.length) {
      return milanSpeedForObservatory.records.map((record) => ({
        id: record.id,
        coordinates: record.coordinates,
        value: record.value,
        properties: {
          segment: String(record.properties?.streetName || record.id),
          vitesse_km_h: Number(record.properties?.avgSpeed || 0),
          indice_de_congestion: Math.min(1, record.value / 100),
        },
      }));
    }
    return [];
  }, [selectedCity, issyJunctionTraffic?.results, milanSpeedForObservatory?.records]);

  const activeTimeWindowLabel = useMemo(() => {
    if (selectedCity.toLowerCase().includes("issy") && selectedKpi === "kpi1.2" && !issyJunctionStudy) {
      const day =
        issyFlowDayCategory === "weekday"
          ? "Weekday"
          : issyFlowDayCategory === "weekend"
            ? "Weekend"
            : "All days";
      return `${day} · ${scenario}`;
    }
    if (selectedCity === "Milan" && selectedKpi === "kpi3.2") {
      return milanEnvWindow === "08-09" ? "Morning 08–09" : "Evening 18–19";
    }
    if (scenario === "baseline") return "Baseline period";
    if (scenario === "comparison") return "Comparison";
    return "Intervention / observed";
  }, [selectedCity, selectedKpi, issyJunctionStudy, issyFlowDayCategory, scenario, milanEnvWindow]);
  // KPI panel appears only when a pilot is selected
  const showPanel = viewLevel === "PILOT_DATA" && selectedCity;
  const selectedKpiMeta = ELABORATOR_KPIS.find((kpi) => kpi.id === selectedKpi);
  const issyKpi32Intensity =
    selectedCity.toLowerCase().includes("issy") && selectedKpi === "kpi3.2"
      ? getKpi32TimeSeriesIntensity(
          CITY_DATA[selectedCity]?.kpiData["kpi3.2"],
          emissionsIntensityYear
        )
      : null;
  const mapLegendSpec = resolveMapLegend(selectedCity || "", selectedKpi, scenario, {
    issyJunctionStudy,
  });
  const pilotSupportsKpi = selectedPilot ? selectedPilot.supportedKpis.includes(selectedKpi) : true;
  const shouldShowLegend = !showTour && showPanel && pilotSupportsKpi;

  const handleTourClose = () => {
    setShowTour(false);
  };

  const handleZoomIn = useCallback(() => {
    mapRef?.zoomIn();
  }, [mapRef]);

  const handleZoomOut = useCallback(() => {
    mapRef?.zoomOut();
  }, [mapRef]);

  const handleViewLevelChange = (level: ViewState) => {
    setViewLevel(level);
    if (level === "EUROPE") {
      setSelectedCity("");
      setSelectedPilot(null);
    }
  };

  const handleCitySelect = (city: string) => {
    setSelectedCity(city);
    setIntelCity(city);
  };

  const handleSegmentHover = useCallback(
    (detail: { segmentId: string; segmentName: string }) => {
      patchSelection({ segmentId: detail.segmentId });
      setMapSelection((prev) => ({
        ...prev,
        segmentId: detail.segmentId,
        city: selectedCity,
        pilotId: selectedPilot?.id,
        kpi: selectedKpi,
      }));
    },
    [patchSelection, selectedCity, selectedPilot?.id, selectedKpi]
  );

  const handlePilotChange = (pilotId: string) => {
    const pilot = getPilotsByCity(selectedCity).find((p) => p.id === pilotId) || null;
    setSelectedPilot(pilot);
    const profile = getIssyPilotProfile(pilotId);
    if (profile && pilot?.supportedKpis.includes(profile.defaultKpi)) {
      setSelectedKpi(profile.defaultKpi);
    }
    setMapSelection((prev) => ({ ...prev, pilotId, kpi: profile?.defaultKpi ?? prev.kpi }));
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-background relative">
      {/* Map Tour Popup */}
      <MapTour isOpen={showTour} onClose={handleTourClose} optionalCityName={selectedCity} />

      {/* Simple Header with Logo only */}
      <Header
        onLogoClick={() => {
          // Close overlays and reset to “All Cities” view
          setIsDataSummaryOpen(false);
          resetToEuropeRef.current?.();
        }}
      />

      {/* Full-Screen Map */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="absolute inset-0 z-0"
      >
        <HeroMap
          onMapReady={setMapRef}
          onCitySelect={handleCitySelect}
          onViewLevelChange={handleViewLevelChange}
          onResetToEuropeReady={(fn) => {
            resetToEuropeRef.current = fn;
          }}
          selectedCity={selectedCity}
          selectedKpi={selectedKpi}
          scenario={scenario}
          filterRange={filterRange}
          selectedModeTypes={selectedModeTypes}
          onSegmentFocus={(ctx) => {
            setMapContext(ctx);
            setMapSelection((prev) => ({
              ...prev,
              city: selectedCity,
              pilotId: selectedPilot?.id,
              kpi: selectedKpi,
            }));
          }}
          focusMode={focusMode}
          onSegmentHover={handleSegmentHover}
          onJunctionSegmentClick={(detail) => {
            patchSelection({ segmentId: detail.segmentId });
            setMapSelection({
              segmentId: detail.segmentId,
              city: selectedCity,
              pilotId: selectedPilot?.id,
              kpi: selectedKpi,
            });
            if (canOpenObservatory(selectedCity, selectedPilot?.id, selectedKpi)) {
              setIsObservatoryOpen(true);
            }
          }}
          showInterventionLayer={showInterventionLayer}
          selectedPilotId={selectedPilot?.id}
          onPilotSelect={setSelectedPilot}
          onDataQualitySummaryChange={setDataQualitySummary}
          milanEnvironmentWindow={
            selectedCity === "Milan" && selectedKpi === "kpi3.2" ? milanEnvWindow : undefined
          }
          issyFlowDayCategory={
            selectedCity.toLowerCase().includes("issy") && selectedKpi === "kpi1.2"
              ? issyFlowDayCategory
              : undefined
          }
          pilotFlyToSignal={pilotFlyToSignal}
          infrastructureCategoryFocus={infrastructureMapFocus}
          kpi32SelectedYear={emissionsIntensityYear}
          selectedJunctionSegmentId={selectedJunctionSegmentId}
        />
      </motion.div>

      {!showTour && showPanel && (
        <div className="fixed left-1/2 -translate-x-1/2 top-[4.25rem] z-[58] pointer-events-none">
          <TimeWindowChip
            label={activeTimeWindowLabel}
            detail={dataQualitySummary?.temporalCoverage}
          />
        </div>
      )}

      {/* Left Insight Panel - Only visible at city zoom level */}
      {!showTour && showPanel && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <InsightPanel
            selectedCity={selectedCity}
            selectedPilotName={selectedPilot?.name}
            selectedPilotId={selectedPilot?.id}
            selectedKpi={selectedKpi}
            onCityChange={setSelectedCity}
            onPilotChange={handlePilotChange}
            onKpiChange={(kpi) => {
              setSelectedKpi(kpi);
              setIntelKpiId(kpi);
            }}
            selectedModeTypes={selectedModeTypes}
            onOpenObservatory={() => {
              if (canOpenObservatory(selectedCity, selectedPilot?.id, selectedKpi)) {
                setIsObservatoryOpen(true);
              }
            }}
            onRangeChange={setFilterRange}
            onModeTypesChange={setSelectedModeTypes}
            scenario={scenario}
            onScenarioChange={setScenario}
            onOpenDataSummary={() => setIsDataSummaryOpen(true)}
            mapContext={mapContext}
            dataQualitySummary={dataQualitySummary}
            mapSelection={mapSelection}
            milanEnvironmentWindow={milanEnvWindow}
            onMilanEnvironmentWindowChange={setMilanEnvWindow}
            issyFlowDayCategory={issyFlowDayCategory}
            onIssyFlowDayCategoryChange={setIssyFlowDayCategory}
            infrastructureMapFocus={infrastructureMapFocus}
            onInfrastructureMapFocus={setInfrastructureMapFocus}
            onRequestPilotMapFocus={requestPilotMapFocus}
            emissionsIntensityYear={emissionsIntensityYear}
            onEmissionsIntensityYearChange={setEmissionsIntensityYear}
          />
        </motion.div>
      )}

      {!showTour && viewLevel !== "EUROPE" && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 rounded-xl border border-white/30 bg-[linear-gradient(165deg,rgba(255,255,255,0.18)_0%,rgba(255,255,255,0.08)_45%,rgba(255,255,255,0.04)_100%)] backdrop-blur-xl shadow-[0_10px_30px_rgba(10,10,45,0.35)] px-2 py-1.5">
          <button
            onClick={() => {
              if (viewLevel === "PILOT_DATA") {
                setSelectedPilot(null);
                return;
              }
              resetToEuropeRef.current?.();
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/70 text-foreground border border-white/30 shadow-sm hover:bg-white/80 transition-colors whitespace-nowrap"
          >
            <ArrowLeft className="h-3.5 w-3.5 text-violet" />
            <span className="text-xs font-medium text-foreground">
              {viewLevel === "PILOT_DATA" ? "All Pilots" : "All Cities"}
            </span>
          </button>

          <div className="px-2.5 py-1.5 rounded-lg bg-violet/85 border border-violet/30 backdrop-blur-md shadow-sm whitespace-nowrap">
            <p className="text-xs font-medium text-primary-foreground">
              {selectedPilot ? `${selectedCity}, ${selectedPilot.name}` : selectedCity}
            </p>
          </div>
        </div>
      )}

      <AnimatePresence>
        {shouldShowLegend && (
          <>
            {isLegendOpen ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="fixed right-3 top-24 sm:right-4 sm:top-24 lg:right-4 lg:top-24 z-[65] w-[220px] sm:w-[240px] max-w-[calc(100vw-24px)]"
                style={{
                  background: "rgba(20, 20, 35, 0.82)",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                  border: "1px solid rgba(255,255,255,0.14)",
                  borderRadius: "16px",
                  padding: "14px 16px",
                  boxShadow: "0 10px 24px rgba(0,0,0,0.35)",
                }}
              >
                <button
                  onClick={() => setIsLegendOpen(false)}
                  className="absolute right-2 top-2 rounded p-1 text-white/65 hover:text-white/90 hover:bg-white/10 transition-colors"
                  aria-label="Hide legend"
                >
                  <X className="h-3.5 w-3.5" />
                </button>

                <div className="pr-6">
                  <p className="text-[13px] font-semibold text-white leading-tight">
                    {selectedKpiMeta?.shortName || "KPI Layer"}
                  </p>
                  <p className="mt-1 text-[11px] text-white/65">{selectedKpiMeta?.ref || selectedKpi}</p>
                </div>

                <div className="mt-3 space-y-2">
                  {(() => {
                    const items = mapLegendSpec.items;
                    const stripRamp =
                      mapLegendSpec.marker === "ramp" || mapLegendSpec.marker === "polygonRamp";
                    if (stripRamp) {
                      const isPolyStrip = mapLegendSpec.marker === "polygonRamp";
                      return (
                        <div>
                          <div className="flex items-center gap-px rounded overflow-hidden ring-1 ring-white/15">
                            {items.map((item, i) =>
                              isPolyStrip ? (
                                <span
                                  key={`strip-p-${i}`}
                                  className="inline-block h-3 flex-1 min-w-0 border-r border-white/10 last:border-r-0"
                                  style={{ backgroundColor: item.color }}
                                  aria-hidden
                                />
                              ) : (
                                <LegendSwatch key={`strip-${i}-${item.color}`} marker="ramp" color={item.color} />
                              )
                            )}
                          </div>
                          <div className="mt-1 flex justify-between gap-2 text-intel-meta text-white/78">
                            <span className="truncate text-left">{items[0]?.label || "Lower"}</span>
                            <span className="truncate text-right">{items[items.length - 1]?.label || "Higher"}</span>
                          </div>
                        </div>
                      );
                    }
                    const rowMarker =
                      mapLegendSpec.marker === "line" ||
                      mapLegendSpec.marker === "point" ||
                      mapLegendSpec.marker === "polygon"
                        ? mapLegendSpec.marker
                        : "point";
                    return items.map((item, i) => (
                      <div key={`legend-row-${i}-${item.color}`} className="flex items-center gap-2 min-w-0">
                        <LegendSwatch marker={rowMarker} color={item.color} />
                        {item.label ? (
                          <span className="text-intel-meta text-white/85 leading-tight flex-1 min-w-0">{item.label}</span>
                        ) : null}
                      </div>
                    ));
                  })()}
                </div>

                <div className="mt-3 flex items-start gap-2 text-intel-meta text-white/82 leading-tight">
                  <Eye className="mt-0.5 h-3.5 w-3.5 text-white/60 flex-shrink-0" />
                  <p>{mapLegendSpec.hint}</p>
                </div>
              </motion.div>
            ) : (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => setIsLegendOpen(true)}
                className="fixed right-3 top-24 sm:right-4 sm:top-24 lg:right-4 lg:top-24 z-[65] rounded-xl border border-white/20 bg-[rgba(20,20,35,0.82)] px-3 py-1.5 text-[11px] font-medium text-white/85 backdrop-blur-[12px] hover:text-white"
              >
                Show legend
              </motion.button>
            )}
          </>
        )}
      </AnimatePresence>

      {/* Right-Side Map Controls - Minimal zoom only */}
      {!showTour && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="hidden lg:block"
        >
          <MapControls
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
          />
        </motion.div>
      )}

      {/* Data Summary - Bottom expandable panel */}
      {!showTour && showPanel && isDataSummaryOpen && (
        <DataSummaryPanel
          scenario={scenario}
          selectedCity={selectedCity}
          selectedKpi={selectedKpi}
          selectedPilotName={selectedPilot?.name}
          selectedPilotId={selectedPilot?.id}
          onClose={() => setIsDataSummaryOpen(false)}
        />
      )}

      <SegmentIntelligencePanel
        isOpen={isObservatoryOpen}
        onClose={() => setIsObservatoryOpen(false)}
        pilotLabel={
          selectedPilot
            ? `${selectedCity} — ${selectedPilot.name}`
            : undefined
        }
        segments={observatorySegments}
        selectedSegmentId={selectedJunctionSegmentId}
        onSelectSegmentId={(id) => patchSelection({ segmentId: id })}
        selectedKpi={selectedKpi}
        scenario={scenario}
        city={selectedCity}
        pilotId={selectedPilot?.id}
        kpi32IntensityScale={
          issyKpi32Intensity != null ? issyKpi32Intensity / 100 : 1
        }
      />

      {/* Bottom Attribution */}
      <div
        className={`absolute left-4 bottom-4 z-20 text-[10px] text-primary-foreground/80 bg-purple/70 backdrop-blur-xl px-3 py-1.5 rounded-lg border border-primary-foreground/10 transition-opacity ${
          showTour ? "opacity-0" : "opacity-100"
        }`}
      >
        Data period: 2024 snapshot · ELABORATOR Consortium · © OpenStreetMap contributors
      </div>

      {/* How to Use Button */}
      {!showTour && (
        <div className="absolute bottom-4 right-4 z-20 transition-all">
          <button
            onClick={() => setShowTour(true)}
            className="text-xs font-medium text-primary-foreground bg-violet/80 backdrop-blur-xl px-4 py-2 rounded-lg border border-violet/30 hover:bg-violet transition-all shadow-lg"
          >
            How to Use
          </button>
        </div>
      )}
    </div>
  );
};

const Map = () => (
  <MapIntelligenceProvider>
    <MapContent />
  </MapIntelligenceProvider>
);

export default Map;
