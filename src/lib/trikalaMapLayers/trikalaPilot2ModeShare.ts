import type { CopenhagenObservedPoint } from "@/lib/copenhagenMapLayers/renderCopenhagenMapLayers";
import type { TrikalaLocation } from "@/data/trikalaLocationRegistry";
import type { ModeShareRow } from "@/lib/observatoryGraphicTypes";

export const TRI_P2_PARK_RIDE_HUB_IDS = [
  "tri-loc-smy",
  "tri-loc-deh",
  "tri-loc-gisemi",
] as const;

/** MOCK bike-uptake mix per P+R hub — pending partner occupancy survey (Evaluation Plan KPI 1.2). */
const PARK_RIDE_MODE_SHARE: Record<string, ModeShareRow[]> = {
  "tri-loc-smy": [
    { mode: "Pedestrian", before: 26.5, after: 29.0 },
    { mode: "Cycle", before: 34.0, after: 39.5 },
    { mode: "Car", before: 28.5, after: 22.0 },
    { mode: "Public Transport", before: 8.5, after: 8.0 },
    { mode: "PTW", before: 2.5, after: 1.5 },
  ],
  "tri-loc-deh": [
    { mode: "Pedestrian", before: 24.0, after: 26.5 },
    { mode: "Cycle", before: 31.5, after: 37.0 },
    { mode: "Car", before: 32.0, after: 25.0 },
    { mode: "Public Transport", before: 10.5, after: 10.0 },
    { mode: "PTW", before: 2.0, after: 1.5 },
  ],
  "tri-loc-gisemi": [
    { mode: "Pedestrian", before: 22.0, after: 25.0 },
    { mode: "Cycle", before: 28.5, after: 34.5 },
    { mode: "Car", before: 36.5, after: 28.0 },
    { mode: "Public Transport", before: 11.0, after: 11.0 },
    { mode: "PTW", before: 2.0, after: 1.5 },
  ],
};

const PARK_RIDE_COORDS: Record<string, { lat: number; lng: number }> = {
  "tri-loc-smy": { lat: 39.55377222, lng: 21.77565618 },
  "tri-loc-deh": { lat: 39.55849962, lng: 21.77339372 },
  "tri-loc-gisemi": { lat: 39.56675984, lng: 21.75819154 },
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function nearestParkRideHubId(lat: number, lng: number): string {
  let best = TRI_P2_PARK_RIDE_HUB_IDS[0];
  let bestDist = Number.POSITIVE_INFINITY;
  TRI_P2_PARK_RIDE_HUB_IDS.forEach((hubId) => {
    const hub = PARK_RIDE_COORDS[hubId];
    const d = (hub.lat - lat) ** 2 + (hub.lng - lng) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = hubId;
    }
  });
  return best;
}

function jitterFromId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) % 7;
  }
  return hash - 3;
}

export function resolveTrikalaPilot2HubId(
  selectionId: string | null | undefined
): string | null {
  if (!selectionId) return null;
  const normalized = selectionId
    .replace(/^tri-p2-flow-/, "")
    .replace(/-(active|car)$/, "");
  if (PARK_RIDE_MODE_SHARE[normalized]) return normalized;
  if (normalized.startsWith("tri-loc-")) return normalized;
  return null;
}

export function modeShareFromTrikalaPilot2Location(
  locationId: string,
  location?: Pick<TrikalaLocation, "lat" | "lng" | "kind"> | null
): ModeShareRow[] {
  const parkRideRows = PARK_RIDE_MODE_SHARE[locationId];
  if (parkRideRows) return parkRideRows.map((r) => ({ ...r }));

  const parentHub = location
    ? nearestParkRideHubId(location.lat, location.lng)
    : "tri-loc-deh";
  const base = PARK_RIDE_MODE_SHARE[parentHub] ?? PARK_RIDE_MODE_SHARE["tri-loc-deh"];
  const jitter = jitterFromId(locationId);

  return base.map((row) => {
    const carBias = row.mode === "Car" ? jitter * 0.6 : -jitter * 0.15;
    const afterBias = row.mode === "Car" ? jitter * 0.4 - 0.8 : -jitter * 0.1;
    return {
      mode: row.mode,
      before: round1(Math.max(0, Math.min(100, row.before + carBias))),
      after: round1(Math.max(0, Math.min(100, row.after + afterBias))),
    };
  });
}

export function modeShareFromTrikalaPilot2Aggregate(): ModeShareRow[] {
  const modes = ["Pedestrian", "Cycle", "Car", "Public Transport", "PTW"] as const;
  return modes.map((mode) => {
    const rows = TRI_P2_PARK_RIDE_HUB_IDS.map((id) => PARK_RIDE_MODE_SHARE[id]);
    const before =
      rows.reduce((sum, hub) => sum + (hub.find((r) => r.mode === mode)?.before ?? 0), 0) /
      rows.length;
    const after =
      rows.reduce((sum, hub) => sum + (hub.find((r) => r.mode === mode)?.after ?? 0), 0) /
      rows.length;
    return { mode, before: round1(before), after: round1(after) };
  });
}

function sustainableShare(rows: ModeShareRow[], phase: "before" | "after"): number {
  const pedestrian = rows.find((r) => r.mode === "Pedestrian")?.[phase] ?? 0;
  const cycle = rows.find((r) => r.mode === "Cycle")?.[phase] ?? 0;
  const pt = rows.find((r) => r.mode === "Public Transport")?.[phase] ?? 0;
  return round1(pedestrian + cycle + pt);
}

function carShare(rows: ModeShareRow[], phase: "before" | "after"): number {
  const car = rows.find((r) => r.mode === "Car")?.[phase] ?? 0;
  const ptw = rows.find((r) => r.mode === "PTW")?.[phase] ?? 0;
  return round1(car + ptw);
}

/** Two-spoke mini radar at each P+R hub (visible at district zoom). */
export function buildTrikalaPilot2HubLocalFlows(
  site: TrikalaLocation,
  siteIndex: number
): CopenhagenObservedPoint[] {
  const rows = modeShareFromTrikalaPilot2Location(site.id, site);
  const activeBefore = sustainableShare(rows, "before");
  const activeAfter = sustainableShare(rows, "after");
  const carBefore = carShare(rows, "before");
  const carAfter = carShare(rows, "after");
  const inboundBearing = (25 + siteIndex * 38) % 360;
  const outboundBearing = (inboundBearing + 180) % 360;

  return [
    {
      lat: site.lat,
      lon: site.lng,
      id: `tri-p2-flow-${site.id}-active`,
      value: activeBefore,
      properties: {
        segmentId: site.id,
        streetName: site.name,
        direction: `${site.name} — sustainable north approach`,
        mode: "Active mobility",
        baselineValue: activeBefore,
        interventionValue: activeAfter,
        comparisonValue: activeAfter - activeBefore,
        subSegment: site.name,
        flowIndex: 0,
        flowBearing: inboundBearing,
        dataOrigin: "local-city-dataset",
      },
    },
    {
      lat: site.lat,
      lon: site.lng,
      id: `tri-p2-flow-${site.id}-car`,
      value: carBefore,
      properties: {
        segmentId: site.id,
        streetName: site.name,
        direction: `${site.name} — private car south return`,
        mode: "Private car",
        baselineValue: carBefore,
        interventionValue: carAfter,
        comparisonValue: carAfter - carBefore,
        subSegment: site.name,
        flowIndex: 1,
        flowBearing: outboundBearing,
        dataOrigin: "local-city-dataset",
      },
    },
  ];
}
