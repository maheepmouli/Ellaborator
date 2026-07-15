import type { MapLegendItem } from "@/lib/mapLayerLegend";
import {
  CPH_INBOUND_COLOR,
  CPH_OUTBOUND_COLOR,
} from "./copenhagenFlowGeometry";

/** Radar corridor colours shared by KPI 1.2 and 2.1. */
export const CPH_RADAR_CORRIDOR_ITEMS: MapLegendItem[] = [
  { label: "Lower flow rate", color: "#6EE7B7" },
  { label: "Medium flow rate", color: "#38bdf8" },
  { label: "Higher flow rate", color: "#F97316" },
  { label: "Inbound corridor", color: CPH_INBOUND_COLOR },
  { label: "Outbound corridor", color: CPH_OUTBOUND_COLOR },
];

export const CPH_CAMERA_REGISTRY_ITEMS: MapLegendItem[] = [
  { label: "OpenTrafficCam site", color: "#00ffff" },
  { label: "Telraam counter", color: "#38bdf8" },
  { label: "Platomo flow camera", color: "#f59e0b" },
  { label: "Workbook aggregation site", color: "#c4b5fd" },
  { label: "Camera FOV cone (visual)", color: "#63ccff" },
];

export const CPH_EMISSIONS_ITEMS: MapLegendItem[] = [
  { label: "Modelled emissions node (C)", color: "#f59e0b" },
  { label: "Lower intensity", color: "#6EE7B7" },
  { label: "Medium", color: "#FBBF24" },
  { label: "Higher intensity", color: "#F97316" },
  { label: "Street context", color: "#64748b" },
];

export const CPH_FACILITY_ITEMS: MapLegendItem[] = [
  { label: "Cycle parking bays", color: "#00ffff" },
  { label: "Cargo bike parking", color: "#2ecc71" },
  { label: "Car bay removed", color: "#f43f5e" },
  { label: "Parking polygon", color: "#60a5fa" },
];

export const CPH_ACCESSIBILITY_ITEMS: MapLegendItem[] = [
  { label: "Accessibility hub (A)", color: "#22c55e" },
  { label: "Lower access score", color: "#D3E3FF" },
  { label: "Higher access score", color: "#10B981" },
  { label: "Parking conversion proxy", color: "#96C2EF" },
];

export const CPH_SURVEY_ITEMS: MapLegendItem[] = [
  { label: "Citizen survey (W)", color: "#7f5af0" },
  { label: "Acceptability response", color: "#b0edba" },
  { label: "Safety perception", color: "#63ccff" },
];

export const CPH_SAFETY_SUPPLEMENT_ITEMS: MapLegendItem[] = [
  { label: "iRAP site (M)", color: "#ffb300" },
  { label: "Near encounter node", color: "#f43f5e" },
  { label: "Tube speed corridor", color: "#00ffff" },
];
