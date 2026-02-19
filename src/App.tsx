import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Map from "./pages/Map";
import NotFound from "./pages/NotFound";
import CityDetail from "./pages/CityDetail";
import KPIs from "./pages/KPIs";
import DataCatalogue from "./pages/DataCatalogue";
import About from "./pages/About";
import Compare from "./pages/Compare";
import ModeShare from "./pages/kpi/ModeShare";
import FSIReduction from "./pages/kpi/FSIReduction";
import CO2Reduction from "./pages/kpi/CO2Reduction";
import Accessibility from "./pages/kpi/Accessibility";
import Satisfaction from "./pages/kpi/Satisfaction";
import SafetyStars from "./pages/kpi/SafetyStars";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/map" replace />} />
          <Route path="/map" element={<Map />} />
          <Route path="/about" element={<About />} />
          <Route path="/kpis" element={<KPIs />} />
          <Route path="/data-catalogue" element={<DataCatalogue />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/city/:cityId" element={<CityDetail />} />
          <Route path="/kpi/mode-share" element={<ModeShare />} />
          <Route path="/kpi/fsi-reduction" element={<FSIReduction />} />
          <Route path="/kpi/co2-reduction" element={<CO2Reduction />} />
          <Route path="/kpi/accessibility" element={<Accessibility />} />
          <Route path="/kpi/satisfaction" element={<Satisfaction />} />
          <Route path="/kpi/safety-stars" element={<SafetyStars />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
