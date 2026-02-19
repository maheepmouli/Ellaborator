import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import Header from "@/components/Header";
import HeroMap from "@/components/HeroMap";
import InsightPanel from "@/components/InsightPanel";
import MapControls from "@/components/MapControls";
import MapTour from "@/components/MapTour";
import ComparisonPanel from "@/components/ComparisonPanel";

type ViewLevel = "europe" | "city" | "detail";

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
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);

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
          selectedModeTypes={selectedModeTypes}
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

      {/* Comparison Panel - Sidebar */}
      {!showTour && showPanel && (
        <ComparisonPanel
          selectedCity={selectedCity}
          selectedKpi={selectedKpi}
          isOpen={isComparisonOpen}
          onToggle={() => setIsComparisonOpen(!isComparisonOpen)}
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
        <div className={`absolute bottom-4 z-20 transition-all ${isComparisonOpen ? "right-[440px]" : "right-4"}`}>
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
