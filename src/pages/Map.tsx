import { useRef, useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import Header from "@/components/Header";
import HeroMap from "@/components/HeroMap";
import InsightPanel from "@/components/InsightPanel";
import MapControls from "@/components/MapControls";
import MapTour from "@/components/MapTour";
import DataSummaryPanel from "@/components/ScenarioPanel";

type ViewLevel = "europe" | "city" | "detail";
type SegmentContext = {
  segmentName: string;
  speed: number | null;
  congestion: number | null;
};

const Map = () => {
  // Start with the tour open when the map first loads
  const [showTour, setShowTour] = useState(true);
  const [selectedCity, setSelectedCity] = useState("Milan");
  const [selectedKpi, setSelectedKpi] = useState("kpi1.2");
  const [filterRange, setFilterRange] = useState<[number, number]>([0, 100]);
  const [selectedModeTypes, setSelectedModeTypes] = useState<string[]>([
    "Pedestrian",
    "Cycle",
    "Public Transport",
    "Private Car",
    "PTW",
  ]);
  const [mapRef, setMapRef] = useState<any>(null);
  const [viewLevel, setViewLevel] = useState<ViewLevel>("europe");
  const [scenario, setScenario] = useState<"baseline" | "intervention" | "comparison">("intervention");
  const [isDataSummaryOpen, setIsDataSummaryOpen] = useState(false);
  const [mapContext, setMapContext] = useState<SegmentContext | null>(null);
  const [showInterventionLayer, setShowInterventionLayer] = useState(false);
  const resetToEuropeRef = useRef<null | (() => void)>(null);

  const handleTourClose = () => {
    setShowTour(false);
  };

  const handleZoomIn = useCallback(() => {
    mapRef?.zoomIn();
  }, [mapRef]);

  const handleZoomOut = useCallback(() => {
    mapRef?.zoomOut();
  }, [mapRef]);

  const handleViewLevelChange = (level: ViewLevel) => {
    setViewLevel(level);
    if (level === "europe") {
      setSelectedCity("");
    }
  };

  const handleCitySelect = (city: string) => {
    setSelectedCity(city);
  };

  // Determine if panel should be visible (only at city level)
  const showPanel = viewLevel === "city" && selectedCity;

  return (
    <div className="h-screen w-screen overflow-hidden bg-background relative">
      {/* Map Tour Popup */}
      <MapTour
        isOpen={showTour}
        onClose={handleTourClose}
      />

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
          onSegmentFocus={setMapContext}
          showInterventionLayer={showInterventionLayer}
        />
      </motion.div>

      {/* Left Insight Panel - Only visible at city zoom level */}
      {!showTour && showPanel && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <InsightPanel
            selectedCity={selectedCity}
            selectedKpi={selectedKpi}
            onCityChange={setSelectedCity}
            onKpiChange={setSelectedKpi}
            onRangeChange={setFilterRange}
            onModeTypesChange={setSelectedModeTypes}
            scenario={scenario}
            onScenarioChange={setScenario}
            onOpenDataSummary={() => setIsDataSummaryOpen(true)}
            mapContext={mapContext}
            showInterventionLayer={showInterventionLayer}
            onInterventionLayerChange={setShowInterventionLayer}
          />
        </motion.div>
      )}

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
          onClose={() => setIsDataSummaryOpen(false)}
        />
      )}

      {/* Bottom Attribution */}
      <div
        className={`absolute left-4 bottom-4 z-20 text-[10px] text-primary-foreground/80 bg-purple/70 backdrop-blur-xl px-3 py-1.5 rounded-lg border border-primary-foreground/10 transition-opacity ${
          showTour ? "opacity-0" : "opacity-100"
        }`}
      >
        2024 data: ELABORATOR Consortium · © OpenStreetMap contributors
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

export default Map;
