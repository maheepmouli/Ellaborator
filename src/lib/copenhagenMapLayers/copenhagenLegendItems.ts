import type { MapLegendItem } from "@/lib/mapLayerLegend";
import {
  CPH_INBOUND_COLOR,
  CPH_OUTBOUND_COLOR,
} from "./copenhagenFlowGeometry";

/** Shared by KPI 1.2 mode share and KPI 2.1 road safety (all Copenhagen pilots). */
export const CPH_HUB_RIPPLE_ITEMS: MapLegendItem[] = [
  { label: "OTC hub — inbound-dominant (ripple)", color: "#ef4444" },
  { label: "OTC hub — outbound-dominant (ripple)", color: "#38bdf8" },
  { label: "Telraam counter (ripple)", color: "#38BDF8" },
  { label: "Camera field of view", color: "#96C2EF" },
];

export const CPH_HUB_RIPPLE_HINT =
  "OTC workbook hubs and Telraam counters both use pulse rings. Hub colour follows inbound (red) vs outbound (cyan) dominance. Mode share = observed OTC counts. Road safety = derived motor-pressure proxy (not direct crash counts).";

/** Radar corridor colours shared by KPI 1.2 and 2.1. */
export const CPH_RADAR_CORRIDOR_ITEMS: MapLegendItem[] = [
  { label: "Lower flow rate", color: "#6EE7B7" },
  { label: "Medium flow rate", color: "#38bdf8" },
  { label: "Higher flow rate", color: "#F97316" },
  { label: "Inbound corridor", color: CPH_INBOUND_COLOR },
  { label: "Outbound corridor", color: CPH_OUTBOUND_COLOR },
];

export const CPH_CAMERA_REGISTRY_ITEMS: MapLegendItem[] = [
  { label: "OTC camera hub", color: "#c4b5fd" },
  { label: "Telraam counter", color: "#38bdf8" },
  { label: "Platomo flow camera", color: "#f59e0b" },
  { label: "Camera field of view", color: "#96C2EF" },
];

/** Continuous intensity ramp — matches `emissionsIntensityToColor` stops (0–100 index). */
export const CPH_EMISSIONS_ITEMS: MapLegendItem[] = [
  { label: "0", color: "#22C55E" },
  { label: "20", color: "#10B981" },
  { label: "40", color: "#FBBF24" },
  { label: "60", color: "#F97316" },
  { label: "100", color: "#E02020" },
];

/** I100275 Udført bay types — matches map `resolveParkingCategoryColor`. */
export const CPH_FACILITY_ITEMS: MapLegendItem[] = [
  { label: "Almindelig", color: "#ff4d4d" },
  { label: "Erhverv", color: "#ffb300" },
  { label: "Besøgsplads", color: "#fbbf24" },
  { label: "Handicapplads", color: "#00d2ff" },
  { label: "Taxi", color: "#a78bfa" },
  { label: "El-bil / Delebil", color: "#38bdf8" },
];

export const CPH_ACCESSIBILITY_ITEMS: MapLegendItem[] = [
  { label: "Almindelig", color: "#ff4d4d" },
  { label: "Erhverv", color: "#ffb300" },
  { label: "Besøgsplads", color: "#fbbf24" },
  { label: "Handicapplads", color: "#00d2ff" },
  { label: "Taxi", color: "#a78bfa" },
  { label: "El-bil / Delebil", color: "#38bdf8" },
];

export const CPH_SURVEY_ITEMS: MapLegendItem[] = [
  { label: "Citizen survey (W)", color: "#7f5af0" },
  { label: "Acceptability response", color: "#b0edba" },
  { label: "Safety perception", color: "#63ccff" },
];

export const CPH_SAFETY_SUPPLEMENT_ITEMS: MapLegendItem[] = [
  { label: "iRAP site (M)", color: "#ffb300" },
  // Near-encounter nodes only when partner-observed (OTC proxy points omitted — not real conflicts).
  { label: "Tube speed corridor", color: "#00ffff" },
];
