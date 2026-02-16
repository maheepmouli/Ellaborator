import { Plus, Minus } from "lucide-react";

interface MapControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
}

const MapControls = ({ onZoomIn, onZoomOut }: MapControlsProps) => {
  return (
    <div className="absolute right-4 top-1/2 -translate-y-1/2 z-30 flex flex-col">
      <div className="flex flex-col bg-card/90 backdrop-blur-xl rounded-xl shadow-lg border border-border-color/50 overflow-hidden">
        <button
          onClick={onZoomIn}
          className="group p-3 text-foreground hover:bg-violet hover:text-primary-foreground transition-all duration-300 border-b border-border-color/30"
          aria-label="Zoom in"
        >
          <Plus className="h-4 w-4 group-hover:scale-110 transition-transform" />
        </button>
        
        <button
          onClick={onZoomOut}
          className="group p-3 text-foreground hover:bg-violet hover:text-primary-foreground transition-all duration-300"
          aria-label="Zoom out"
        >
          <Minus className="h-4 w-4 group-hover:scale-110 transition-transform" />
        </button>
      </div>
    </div>
  );
};

export default MapControls;
