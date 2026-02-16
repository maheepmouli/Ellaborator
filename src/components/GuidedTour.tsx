import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, X, Bike, Shield, Leaf, Users, MapPin, Building2 } from "lucide-react";
import { ELABORATOR_KPIS } from "@/data/kpiDefinitions";

interface TourStep {
  id: string;
  icon: React.ReactNode;
  category: string;
  title: string;
  description: string;
  kpiId?: string;
}

const tourSteps: TourStep[] = [
  {
    id: "welcome",
    icon: <Building2 className="h-10 w-10" />,
    category: "WELCOME",
    title: "Explore ELABORATOR Impact Data",
    description: "This interactive dashboard shows how sustainable mobility interventions are transforming European cities. Navigate through KPIs to see real impact.",
  },
  {
    id: "mode-share",
    icon: <Bike className="h-10 w-10" />,
    category: "KPI 1.2 · MODE SHARE",
    title: "How has sustainable mobility increased?",
    description: "Track the shift from private cars to walking, cycling, and public transport across all Living Lab cities.",
    kpiId: "kpi1.2",
  },
  {
    id: "safety",
    icon: <Shield className="h-10 w-10" />,
    category: "KPI 2.1 · SAFETY",
    title: "How safe are streets for all road users?",
    description: "Star ratings measure safety for pedestrians, cyclists, motorcyclists, and vehicle occupants using iRAP methodology.",
    kpiId: "kpi2.1",
  },
  {
    id: "infrastructure",
    icon: <MapPin className="h-10 w-10" />,
    category: "KPI 3.1 · GREEN INFRASTRUCTURE",
    title: "What zero-emission facilities exist?",
    description: "Count EV charging points, secure bike parking, intermodal hubs, and pedestrian-priority zones deployed.",
    kpiId: "kpi3.1",
  },
  {
    id: "emissions",
    icon: <Leaf className="h-10 w-10" />,
    category: "KPI 3.2 · CLIMATE TARGETS",
    title: "How much have emissions reduced?",
    description: "Monitor CO₂ reduction, air quality improvements, and noise pollution changes against city climate targets.",
    kpiId: "kpi3.2",
  },
  {
    id: "satisfaction",
    icon: <Users className="h-10 w-10" />,
    category: "KPI 4.1 & 4.2 · USER EXPERIENCE",
    title: "How satisfied are residents?",
    description: "User surveys measure satisfaction with physical accessibility, safety perception, and overall quality of mobility services.",
    kpiId: "kpi4.1",
  },
];

interface GuidedTourProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (selectedKpi: string) => void;
  onKpiSelect?: (kpiId: string) => void;
}

const GuidedTour = ({ isOpen, onClose, onComplete, onKpiSelect }: GuidedTourProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const step = tourSteps[currentStep];

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
      if (tourSteps[currentStep + 1].kpiId) {
        onKpiSelect?.(tourSteps[currentStep + 1].kpiId!);
      }
    } else {
      onComplete(step.kpiId || "kpi1.2");
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      if (tourSteps[currentStep - 1].kpiId) {
        onKpiSelect?.(tourSteps[currentStep - 1].kpiId!);
      }
    }
  };

  const handleSkipToKpi = (kpiId: string) => {
    onKpiSelect?.(kpiId);
    onComplete(kpiId);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center"
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={onClose} />

        {/* Panel */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          className="relative w-full max-w-md mx-4 bg-card rounded-2xl shadow-2xl overflow-hidden border border-border-color"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted transition-colors z-10"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>

          {/* Header with Icon */}
          <div className="bg-violet px-6 pt-8 pb-6">
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-blue/30 rounded-full text-primary-foreground">
                {step.icon}
              </div>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-light text-center mb-2">
              {step.category}
            </p>
            <h2 className="text-xl font-bold text-primary-foreground text-center leading-tight">
              {step.title}
            </h2>
          </div>

          {/* Progress dots */}
          <div className="flex justify-center gap-2 py-4 bg-violet">
            {tourSteps.map((_, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setCurrentStep(idx);
                  if (tourSteps[idx].kpiId) {
                    onKpiSelect?.(tourSteps[idx].kpiId!);
                  }
                }}
                className={`w-2 h-2 rounded-full transition-all ${
                  idx === currentStep
                    ? "bg-primary-foreground w-4"
                    : idx < currentStep
                    ? "bg-blue"
                    : "bg-primary-foreground/30"
                }`}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex gap-2 px-6 pb-2 bg-violet">
            <button
              onClick={handleBack}
              disabled={currentStep === 0}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentStep === 0
                  ? "text-primary-foreground/30 cursor-not-allowed"
                  : "text-primary-foreground hover:bg-primary-foreground/10"
              }`}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <button
              onClick={handleNext}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary-foreground text-violet rounded-lg text-sm font-bold hover:bg-primary-foreground/90 transition-colors"
            >
              {currentStep === tourSteps.length - 1 ? "Start Exploring" : "Next"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          {/* Description */}
          <div className="px-6 py-5 bg-card">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {step.description}
            </p>
          </div>

          {/* Quick Access - Only show on last step */}
          {currentStep === tourSteps.length - 1 && (
            <div className="px-6 pb-6 pt-2 bg-card border-t border-border-color">
              <p className="text-xs text-muted-foreground mb-3">Or jump directly to a KPI:</p>
              <div className="flex flex-wrap gap-2">
                {ELABORATOR_KPIS.map((kpi) => (
                  <button
                    key={kpi.id}
                    onClick={() => handleSkipToKpi(kpi.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-violet/20 rounded-full text-xs font-medium text-foreground transition-colors"
                  >
                    <span>{kpi.icon}</span>
                    <span>{kpi.shortName}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Skip tour link */}
          <div className="px-6 pb-4 text-center bg-card">
            <button
              onClick={() => onComplete("kpi1.2")}
              className="text-xs text-muted-foreground hover:text-violet transition-colors"
            >
              Skip tour and explore freely
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default GuidedTour;
