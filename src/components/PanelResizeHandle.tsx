import { cn } from "@/lib/utils";
import type { PanelResizeSide } from "@/hooks/use-resizable-panel-width";

interface PanelResizeHandleProps {
  side: PanelResizeSide;
  onResizeStart: (clientX: number) => void;
  isResizing?: boolean;
}

/** Drag handle on the inner edge of a fixed side panel (left panel → right edge, right panel → left edge). */
export function PanelResizeHandle({ side, onResizeStart, isResizing }: PanelResizeHandleProps) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize panel"
      title="Drag to resize panel"
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onResizeStart(e.clientX);
      }}
      className={cn(
        "absolute top-0 bottom-0 z-[80] w-3 cursor-col-resize touch-none select-none group",
        side === "left" ? "right-0 translate-x-1/2" : "left-0 -translate-x-1/2",
        isResizing && "bg-cyan-400/15"
      )}
    >
      <div
        className={cn(
          "absolute inset-y-10 left-1/2 w-1 -translate-x-1/2 rounded-full transition-colors",
          isResizing ? "bg-cyan-300/80" : "bg-white/20 group-hover:bg-cyan-400/55"
        )}
      />
    </div>
  );
}
