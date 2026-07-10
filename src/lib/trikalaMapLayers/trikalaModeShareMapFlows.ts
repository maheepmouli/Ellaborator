import type { CopenhagenObservedPoint } from "@/lib/copenhagenMapLayers/renderCopenhagenMapLayers";
import type { TrikalaSegmentInsight, TrikalaSegmentId } from "@/services/trikalaSurveyParser";
const FLOW_SEGMENTS: Array<{ segment: TrikalaSegmentId; segmentId: string }> = [
  { segment: "village", segmentId: "tri-p1-village" },
  { segment: "caregiver", segmentId: "tri-p1-caregiver" },
  { segment: "urban", segmentId: "tri-p1-urban" },
  { segment: "suburban", segmentId: "tri-p1-suburban" },
];

function interventionActivePct(active: number, segment: TrikalaSegmentId): number {
  const bump = segment === "urban" ? 2 : segment === "village" ? 0.5 : 1;
  return Math.min(100, Math.round((active + bump) * 10) / 10);
}

/** Survey-segment spokes for Copenhagen-style radar layout (KPI 1.2). */
export function buildTrikalaModeShareFlowPoints(
  insights: TrikalaSegmentInsight[],
  hub: { lat: number; lng: number }
): CopenhagenObservedPoint[] {
  const flows: CopenhagenObservedPoint[] = [];
  let flowIndex = 0;

  FLOW_SEGMENTS.forEach(({ segment, segmentId }) => {
    const insight = insights.find((i) => i.segment === segment);
    if (!insight || insight.responseCount <= 0 || !insight.activeModeSharePct) return;

    const active = insight.activeModeSharePct;
    const car = insight.carModeSharePct ?? Math.max(0, 100 - active);
    const activeAfter = interventionActivePct(active, segment);
    const carAfter = Math.max(0, Math.round((car - 1) * 10) / 10);
    const streetName = "Survey anchor";

    flows.push({
      lat: hub.lat,
      lon: hub.lng,
      id: `tri-flow-${segmentId}-active`,
      value: active,
      properties: {
        segmentId,
        streetName,
        direction: `${insight.label} approach`,
        mode: "Active mobility",
        baselineValue: active,
        interventionValue: activeAfter,
        comparisonValue: activeAfter - active,
        subSegment: insight.label,
        flowIndex,
        dataOrigin: "local-city-dataset",
      },
    });
    flowIndex += 1;

    flows.push({
      lat: hub.lat,
      lon: hub.lng,
      id: `tri-flow-${segmentId}-car`,
      value: car,
      properties: {
        segmentId: `${segmentId}-car`,
        streetName,
        direction: `${insight.label} return`,
        mode: "Private Car",
        baselineValue: car,
        interventionValue: carAfter,
        comparisonValue: carAfter - car,
        subSegment: insight.label,
        flowIndex,
        dataOrigin: "local-city-dataset",
      },
    });
    flowIndex += 1;
  });

  return flows;
}
