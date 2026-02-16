import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import Header from "@/components/Header";
import HeroMap from "@/components/HeroMap";
import InsightPanel from "@/components/InsightPanel";
import MapControls from "@/components/MapControls";
import MapTour from "@/components/MapTour";
import ScenarioPanel from "@/components/ScenarioPanel";

type ViewLevel = "europe" | "city" | "detail";

const Map = () => {
  const [showTour, setShowTour] = useState(false);
  const [selectedCity, setSelectedCity] = useState("Milan");
  const [selectedKpi, setSelectedKpi] = useState("kpi1.2");
  const [filterRange, setFilterRange] = useState<[number, number]>([0, 100]);
  const [mapRef, setMapRef] = useState<any>(null);
  const [viewLevel, setViewLevel] = useState<ViewLevel>("europe");
  const [activeScenario, setActiveScenario] = useState<"baseline" | "intervention" | "comparison" | null>(null);

  // Show tour on first map visit
  useEffect(() => {
    const hasSeenTour = localStorage.getItem("elaborator-map-tour-seen");
    if (!hasSeenTour) {
      setShowTour(true);
    }
  }, []);

  const handleTourClose = () => {
    setShowTour(false);
    localStorage.setItem("elaborator-map-tour-seen", "true");
  };

  const handleZoomIn = useCallback(() => {
    mapRef?.zoomIn();
  }, [mapRef]);

  const handleZoomOut = useCallback(() => {
    mapRef?.zoomOut();
  }, [mapRef]);

  const handleScenarioSelect = (scenario: "baseline" | "intervention" | "comparison") => {
    setActiveScenario(activeScenario === scenario ? null : scenario);
  };

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
      <Header />

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
          selectedCity={selectedCity}
          selectedKpi={selectedKpi}
          filterRange={filterRange}
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
            onScenarioSelect={handleScenarioSelect}
            activeScenario={activeScenario}
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

      {/* Scenario Bottom Panel */}
      {!showTour && activeScenario && showPanel && (
        <ScenarioPanel
          scenario={activeScenario}
          selectedCity={selectedCity}
          selectedKpi={selectedKpi}
          onClose={() => setActiveScenario(null)}
        />
      )}

      {/* Bottom Attribution */}
      <div
        className={`absolute bottom-4 left-4 z-20 text-[10px] text-primary-foreground/80 bg-purple/70 backdrop-blur-xl px-3 py-1.5 rounded-lg border border-primary-foreground/10 transition-opacity ${
          showTour || activeScenario ? "opacity-0" : "opacity-100"
        }`}
      >
        2024 data: ELABORATOR Consortium · © OpenStreetMap contributors
      </div>

      {/* How to Use Button */}
      {!showTour && !activeScenario && (
        <div className="absolute bottom-4 right-4 z-20">
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
