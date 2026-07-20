import type { CopenhagenObservedPoint } from "@/lib/copenhagenMapLayers/renderCopenhagenMapLayers";
import type { HelsinkiTelraamKoetilantie } from "@/lib/helsinkiDataPaths";

const MODE_FLOW_SPECS = [
  { mode: "Bike", direction: "bike outbound", bearing: 40 },
  { mode: "Pedestrian", direction: "pedestrian inbound", bearing: 130 },
  { mode: "Car", direction: "car outbound", bearing: 220 },
  { mode: "Heavy", direction: "heavy inbound", bearing: 310 },
] as const;

/**
 * Telraam mode-share → Copenhagen-style hub flow points for ripple / radar layout.
 * Same value used for baseline and intervention (single monitoring window).
 */
export function buildHelsinkiTelraamModeShareFlows(
  telraam: HelsinkiTelraamKoetilantie,
  hubLat: number,
  hubLon: number
): CopenhagenObservedPoint[] {
  const { modeShare, totals, sensorId, street } = telraam;
  const shares = [
    modeShare.bikePct,
    modeShare.pedestrianPct,
    modeShare.carPct,
    modeShare.heavyPct,
  ];

  return MODE_FLOW_SPECS.map((spec, index) => {
    const pct = shares[index] ?? 0;
    return {
      lat: hubLat,
      lon: hubLon,
      id: `hel-telraam-${sensorId}-${spec.mode.toLowerCase()}`,
      value: pct,
      properties: {
        datasetKind: "telraam",
        direction: spec.direction,
        mode: spec.mode,
        flowBearing: spec.bearing,
        baselineValue: pct,
        interventionValue: pct,
        comparisonValue: 0,
        streetName: street,
        segmentId: `hel-telraam-${sensorId}`,
        source: telraam.source,
        observationCount: telraam.dailyAggregates.length,
        countTotal: totals.all,
        parserStatus: "ready",
        dataOrigin: "observed",
      },
    };
  });
}
