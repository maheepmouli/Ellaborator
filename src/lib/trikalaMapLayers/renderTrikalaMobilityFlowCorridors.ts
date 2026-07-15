import type { CopenhagenObservedPoint } from "@/lib/copenhagenMapLayers/renderCopenhagenMapLayers";
import {
  buildStreetAlignedBezierPath,
  directionPairSlot,
  resolveFlowBearing,
} from "@/lib/copenhagenMapLayers/copenhagenFlowGeometry";
import { CPH_RADAR_OUTER_RING_M } from "@/lib/copenhagenMapLayers/copenhagenRadarFlowLayout";
import { renderFlowCorridorAlongPath } from "@/lib/copenhagenMapLayers/renderFlowCorridorAlongPath";
import type { SegmentInteractionHandlers } from "@/lib/wireMapSegmentInteraction";
import type L from "leaflet";

export interface RenderTrikalaMobilityFlowCorridorsOptions {
  map: L.Map;
  hubLat: number;
  hubLon: number;
  flows: CopenhagenObservedPoint[];
  scenario: "baseline" | "intervention" | "comparison";
  selectedSegmentId?: string | null;
  segmentHandlers: SegmentInteractionHandlers;
  polylinesOut: L.Polyline[];
  markersOut: L.Marker[];
  getValueColor?: (value: number, safetyKpi: boolean) => string;
  ringScale?: number;
}

/** Copenhagen-style glowing spokes along survey / P+R mobility flows. */
export function renderTrikalaMobilityFlowCorridors(
  options: RenderTrikalaMobilityFlowCorridorsOptions
): void {
  const {
    map,
    hubLat,
    hubLon,
    flows,
    scenario,
    selectedSegmentId,
    segmentHandlers,
    polylinesOut,
    markersOut,
    getValueColor,
    ringScale = 1,
  } = options;

  if (!flows.length) return;

  const armLenM = CPH_RADAR_OUTER_RING_M * ringScale * 1.35;

  flows.forEach((flow, flowIndex) => {
    const props = flow.properties ?? {};
    const direction = String(props.direction ?? props.mode ?? "");
    const segmentId = String(props.segmentId || props.id || flow.id);
    const segmentName = String(props.subSegment ?? props.streetName ?? segmentId);
    const baselineValue = Number(props.baselineValue ?? flow.value ?? 0);
    const interventionValue = Number(props.interventionValue ?? flow.value ?? 0);
    const comparisonValue =
      typeof props.comparisonValue === "number"
        ? Number(props.comparisonValue)
        : interventionValue - baselineValue;

    const bearing =
      typeof props.flowBearing === "number"
        ? props.flowBearing
        : resolveFlowBearing(String(props.streetName ?? ""), direction, flowIndex, flows.length);
    const pairSlot = directionPairSlot(direction, flowIndex);
    const path = buildStreetAlignedBezierPath(hubLat, hubLon, bearing, armLenM, pairSlot, 18);

    renderFlowCorridorAlongPath({
      map,
      latLngs: path,
      segmentId,
      segmentName: `${segmentName} · ${direction}`,
      scenario,
      baselineValue,
      interventionValue,
      comparisonValue,
      selectedSegmentId,
      segmentHandlers,
      polylinesOut,
      markersOut,
      getValueColor,
      flowDirection: direction,
      flowIndex,
    });
  });
}
