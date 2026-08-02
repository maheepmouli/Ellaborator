import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ChevronRight,
  ChevronLeft,
  MapPinned,
  GitCompare,
  ClipboardCheck,
  Building2,
} from "lucide-react";
import { Button } from "./ui/button";
import { MAP_TOUR_STANDARD, type MapTourArcStep } from "@/data/storyConfig";

function stepIcon(icon: MapTourArcStep["icon"]) {
  const cls = "h-8 w-8";
  switch (icon) {
    case "problem":
      return <Building2 className={cls} />;
    case "explore":
      return <MapPinned className={cls} />;
    case "compare":
      return <GitCompare className={cls} />;
    case "quality":
      return <ClipboardCheck className={cls} />;
    default:
      return <MapPinned className={cls} />;
  }
}

interface MapTourProps {
  isOpen: boolean;
  onClose: () => void;
  /** Optional city label for contextual tip */
  optionalCityName?: string;
}

const MapTour = ({ isOpen, onClose, optionalCityName }: MapTourProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const tourSteps = MAP_TOUR_STANDARD;
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

  if (!isOpen || !step) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] pointer-events-none"
      >
        <div className="absolute inset-0 bg-purple/40 backdrop-blur-sm pointer-events-auto" onClick={onClose} />

        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          className={`absolute pointer-events-auto ${
            step.position === "center"
              ? "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
              : step.position === "left"
                ? "top-1/2 left-[420px] -translate-y-1/2 max-lg:left-[min(380px,calc(100vw-340px))]"
                : "top-28 right-[min(96px,calc(100vw-300px))]"
          }`}
        >
          <div className="w-80 bg-card/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-violet/30 overflow-hidden">
            <div className="bg-gradient-to-r from-violet to-blue p-4 relative">
              <button
                onClick={onClose}
                className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-primary-foreground/20 transition-colors"
                aria-label="Close tour"
              >
                <X className="h-4 w-4 text-primary-foreground" />
              </button>

              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-foreground/20 rounded-xl text-primary-foreground">
                  {stepIcon(step.icon)}
                </div>
                <div className="pr-10">
                  <p className="text-xs font-medium text-primary-foreground/70 uppercase tracking-wider">
                    Step {currentStep + 1} of {tourSteps.length}
                  </p>
                  <h3 className="text-lg font-bold text-primary-foreground">{step.title}</h3>
                </div>
              </div>
            </div>

            <div className="p-4">
              <p className="text-sm text-foreground leading-relaxed mb-4">{step.description}</p>

              <div className="flex justify-center gap-2 mb-4">
                {tourSteps.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCurrentStep(idx)}
                    aria-label={`Go to step ${idx + 1}`}
                    className={`w-2 h-2 rounded-full transition-all ${
                      idx === currentStep ? "bg-violet w-6" : idx < currentStep ? "bg-green" : "bg-border-color"
                    }`}
                  />
                ))}
              </div>

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
                  {currentStep === tourSteps.length - 1 ? "Start exploring" : "Next"}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {optionalCityName && optionalCityName.length > 0 && (
              <div className="px-4 pb-2">
                <p className="text-[10px] text-muted-foreground leading-snug">
                  Viewing {optionalCityName}: stay on the selected pilot and check MOCK vs observed before exporting.
                </p>
              </div>
            )}

            <div className="px-4 pb-3 text-center">
              <button
                type="button"
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
