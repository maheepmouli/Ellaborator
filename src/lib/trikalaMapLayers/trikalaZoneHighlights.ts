import L from "leaflet";
import type { TrikalaLocation } from "@/data/trikalaLocationRegistry";
import { CPH_OUTBOUND_COLOR } from "@/lib/copenhagenMapLayers/copenhagenFlowGeometry";
import {
  wireCircleMarkerSegment,
  type SegmentInteractionHandlers,
} from "@/lib/wireMapSegmentInteraction";

const ENV_ZONE_RADIUS_M = 95;

/** Muted zone palette — readable on dark basemap without neon blow-out. */
const ZONE = {
  env: { stroke: "#b8860b", fill: "#c9a227", tag: "#d4af37" },
  satisfaction: { stroke: "#2aa8b8", fill: "#1d8a96", tag: "#3bb8c8" },
  accessibility: { stroke: "#16a34a", fill: "#15803d", tag: "#22c55e" },
} as const;

function isVisible(loc: TrikalaLocation, selectedKpi: string): boolean {
  return loc.mapVisible !== false && loc.linkedKpis.includes(selectedKpi);
}

function zoneTagHtml(label: string, kpiTag: string, variant: keyof typeof ZONE): string {
  const c = ZONE[variant];
  return `<div class="tri-zone-tag tri-zone-tag--${variant}" style="--zone-neon:${c.tag}">
    <span class="tri-zone-tag-kpi">${kpiTag}</span>
    <span class="tri-zone-tag-label">${label}</span>
  </div>`;
}

function addZoneTag(
  map: L.Map,
  lat: number,
  lng: number,
  label: string,
  kpiTag: string,
  variant: keyof typeof ZONE,
  markersOut: L.Marker[],
  offsetLat = 0.00035
): void {
  const tag = L.marker([lat + offsetLat, lng], {
    icon: L.divIcon({
      className: "tri-zone-tag-host",
      html: zoneTagHtml(label, kpiTag, variant),
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    }),
    interactive: false,
    zIndexOffset: 650,
  }).addTo(map);
  markersOut.push(tag);
}

/** Soft monitoring halos around air-quality nodes (KPI 3.2). */
export function renderTrikalaEnvironmentalZones(
  map: L.Map,
  locations: TrikalaLocation[],
  selectedKpi: string,
  circlesOut: L.Circle[],
  markersOut: L.Marker[]
): void {
  if (selectedKpi !== "kpi3.2") return;

  locations
    .filter((l) => l.kind === "air_quality_sensor" && isVisible(l, selectedKpi))
    .forEach((loc) => {
      const outer = L.circle([loc.lat, loc.lng], {
        radius: ENV_ZONE_RADIUS_M,
        color: ZONE.env.stroke,
        weight: 2.5,
        opacity: 0.78,
        fillColor: ZONE.env.fill,
        fillOpacity: 0.22,
        interactive: false,
        className: "tri-env-zone-outer",
      }).addTo(map);
      const inner = L.circle([loc.lat, loc.lng], {
        radius: ENV_ZONE_RADIUS_M * 0.42,
        color: "rgba(255,255,255,0.55)",
        weight: 1.6,
        opacity: 0.55,
        fillColor: ZONE.env.fill,
        fillOpacity: 0.26,
        interactive: false,
        className: "tri-env-zone-inner",
      }).addTo(map);
      circlesOut.push(outer, inner);
      addZoneTag(map, loc.lat, loc.lng, loc.name, "Zero-emission zone", "env", markersOut);
    });
}

/** Satisfaction field at smart-crossing anchor (P1) or P+R hubs (P2). */
export function renderTrikalaSatisfactionZones(
  map: L.Map,
  anchor: { lat: number; lng: number },
  locations: TrikalaLocation[],
  selectedKpi: string,
  selectedPilotId: string | null | undefined,
  circlesOut: L.Circle[],
  markersOut: L.Marker[],
  options?: {
    segmentHandlers?: SegmentInteractionHandlers;
    selectedSegmentId?: string | null;
  }
): void {
  if (selectedKpi !== "kpi4.1") return;

  if (selectedPilotId === "tri-p2") {
    // Mock satisfaction — keep map simple: coloured dots + Park and ride labels (no KPI halo tags).
    locations
      .filter((l) => l.kind === "park_and_ride" && isVisible(l, selectedKpi))
      .forEach((loc) => {
        const pin = L.marker([loc.lat, loc.lng], {
          icon: L.divIcon({
            className: "tri-pr-hub-pin-host",
            html: `<div class="tri-pr-hub-pin">
              <span class="tri-pr-hub-dot" aria-hidden="true"></span>
              <span class="tri-pr-hub-text">
                <span class="tri-pr-hub-label-title">Park and ride</span>
                <span class="tri-pr-hub-label-name">${loc.name}</span>
              </span>
            </div>`,
            iconSize: [0, 0],
            iconAnchor: [0, 0],
          }),
          interactive: false,
          zIndexOffset: 700,
        }).addTo(map);
        markersOut.push(pin);
      });
    return;
  }

  if (selectedPilotId !== "tri-p1") return;

  const crossingSite = locations.find((l) => l.kind === "smart_crossing_site");
  const center = {
    lat: crossingSite?.lat ?? anchor.lat,
    lng: crossingSite?.lng ?? anchor.lng,
    label: crossingSite?.name ?? "Smart crossing",
  };

  const segmentId = "tri-p1-smart-crossing";
  const segmentName = "Smart crossing — Military School";
  const isSelected = options?.selectedSegmentId === segmentId;

  // User satisfaction: solid blue hub only — no CSS ripple (ripple is for road safety KPI 2.1).
  const hub = L.circleMarker([center.lat, center.lng], {
    radius: isSelected ? 10 : 8,
    fillColor: CPH_OUTBOUND_COLOR,
    color: "#ffffff",
    weight: 2.5,
    fillOpacity: 1,
    opacity: 1,
    interactive: Boolean(options?.segmentHandlers),
    className: "hub-ripple-center hub-ripple-center--interactive",
  }).addTo(map);

  if (options?.segmentHandlers) {
    wireCircleMarkerSegment(
      hub,
      { segmentId, segmentName, speed: null, congestion: null },
      options.segmentHandlers,
      {
        baseRadius: 8,
        highlightRadius: 12,
        selectedSegmentId: options.selectedSegmentId,
        baseStyle: {
          fillColor: CPH_OUTBOUND_COLOR,
          color: "#ffffff",
          weight: 2.5,
          fillOpacity: 1,
          opacity: 1,
        },
        highlightStyle: {
          fillColor: "#00ffff",
          color: "#ffffff",
          weight: 3,
          fillOpacity: 1,
          opacity: 1,
        },
      }
    );
  }

  circlesOut.push(hub as unknown as L.Circle);

  addZoneTag(
    map,
    center.lat,
    center.lng,
    center.label,
    "User satisfaction",
    "satisfaction",
    markersOut,
    0.0004
  );
}

/** Accessibility / corridor labels (KPI 4.2) — markers only, no zone halos. */
export function renderTrikalaAccessibilityZones(
  map: L.Map,
  locations: TrikalaLocation[],
  selectedKpi: string,
  _circlesOut: L.Circle[],
  markersOut: L.Marker[]
): void {
  if (selectedKpi !== "kpi4.2") return;

  const sites = locations.filter(
    (l) =>
      (l.kind === "smart_crossing_site" || l.kind === "bike_lane_sensor") &&
      isVisible(l, selectedKpi)
  );

  const seen = new Set<string>();
  sites.forEach((loc) => {
    const tagKey =
      loc.kind === "bike_lane_sensor"
        ? loc.name.replace(/\s+\d+$/u, "").trim()
        : loc.id;
    if (seen.has(tagKey)) return;
    seen.add(tagKey);

    // Bike-lane sensors are LoRa nodes — not accessibility zones. Smart crossing keeps A label.
    if (loc.kind === "bike_lane_sensor") {
      addZoneTag(
        map,
        loc.lat,
        loc.lng,
        tagKey,
        "Bike-lane sensor",
        "accessibility",
        markersOut,
        0.00032
      );
      return;
    }

    addZoneTag(
      map,
      loc.lat,
      loc.lng,
      "Smart crossing",
      "Accessibility",
      "accessibility",
      markersOut,
      0.00032
    );
  });
}
