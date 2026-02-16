import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MousePointer2, Filter, ZoomIn, ChevronRight, ChevronLeft } from "lucide-react";
import { Button } from "./ui/button";

interface TourStep {
  icon: React.ReactNode;
  title: string;
  description: string;
  position: "center" | "left" | "right" | "bottom";
}

const tourSteps: TourStep[] = [
  {
    icon: <MousePointer2 className="h-8 w-8" />,
    title: "Click City Markers",
    description: "Click on any city bubble to zoom in and see detailed intervention data. Each bubble shows the KPI value for that city.",
    position: "center",
  },
  {
    icon: <Filter className="h-8 w-8" />,
    title: "Select KPIs & Cities",
    description: "Use the left panel to select different KPIs from the dropdown and choose cities to analyze.",
    position: "left",
  },
  {
    icon: <ZoomIn className="h-8 w-8" />,
    title: "Analyze Scenarios",
    description: "Click Baseline, Intervention, or Comparison buttons to open detailed analysis panels with interactive charts and KPI comparisons.",
    position: "center",
  },
];

interface MapTourProps {
  isOpen: boolean;
  onClose: () => void;
}

const MapTour = ({ isOpen, onClose }: MapTourProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const step = tourSteps[currentStep];

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
    }
  }, [isOpen]);

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] pointer-events-none"
      >
        {/* Backdrop with cutout effect */}
        <div className="absolute inset-0 bg-purple/40 backdrop-blur-sm pointer-events-auto" onClick={onClose} />

        {/* Tour Card */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          className={`absolute pointer-events-auto ${
            step.position === "center" ? "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" :
            step.position === "left" ? "top-1/2 left-[420px] -translate-y-1/2" :
            step.position === "right" ? "top-32 right-24" :
            "bottom-32 left-1/2 -translate-x-1/2"
          }`}
        >
          <div className="w-80 bg-card/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-violet/30 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-violet to-blue p-4 relative">
              <button
                onClick={onClose}
                className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-primary-foreground/20 transition-colors"
              >
                <X className="h-4 w-4 text-primary-foreground" />
              </button>
              
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-foreground/20 rounded-xl text-primary-foreground">
                  {step.icon}
                </div>
                <div>
                  <p className="text-xs font-medium text-primary-foreground/70 uppercase tracking-wider">
                    Step {currentStep + 1} of {tourSteps.length}
                  </p>
                  <h3 className="text-lg font-bold text-primary-foreground">{step.title}</h3>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-4">
              <p className="text-sm text-foreground leading-relaxed mb-4">
                {step.description}
              </p>

              {/* Progress dots */}
              <div className="flex justify-center gap-2 mb-4">
                {tourSteps.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentStep(idx)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      idx === currentStep
                        ? "bg-violet w-6"
                        : idx < currentStep
                        ? "bg-green"
                        : "bg-border-color"
                    }`}
                  />
                ))}
              </div>

              {/* Navigation */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBack}
                  disabled={currentStep === 0}
                  className="flex-1 gap-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </Button>
                <Button
                  size="sm"
                  onClick={handleNext}
                  className="flex-1 gap-1 bg-violet hover:bg-violet/90 text-primary-foreground"
                >
                  {currentStep === tourSteps.length - 1 ? "Start Exploring" : "Next"}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Skip link */}
            <div className="px-4 pb-3 text-center">
              <button
                onClick={onClose}
                className="text-xs text-muted-foreground hover:text-violet transition-colors"
              >
                Skip tour
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default MapTour;
