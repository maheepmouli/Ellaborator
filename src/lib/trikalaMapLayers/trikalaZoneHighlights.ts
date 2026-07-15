import L from "leaflet";
import type { TrikalaLocation } from "@/data/trikalaLocationRegistry";

const ENV_ZONE_RADIUS_M = 95;
const SATISFACTION_ZONE_RADIUS_M = 115;

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
  markersOut: L.Marker[]
): void {
  if (selectedKpi !== "kpi4.1") return;

  if (selectedPilotId === "tri-p2") {
    locations
      .filter((l) => l.kind === "park_and_ride" && isVisible(l, selectedKpi))
      .forEach((loc) => {
        const zone = L.circle([loc.lat, loc.lng], {
          radius: 105,
          color: ZONE.satisfaction.stroke,
          weight: 2.5,
          opacity: 0.76,
          fillColor: ZONE.satisfaction.fill,
          fillOpacity: 0.2,
          interactive: false,
          className: "tri-satisfaction-zone",
        }).addTo(map);
        circlesOut.push(zone);
        addZoneTag(map, loc.lat, loc.lng, loc.name, "User satisfaction", "satisfaction", markersOut);
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

  const zone = L.circle([center.lat, center.lng], {
    radius: SATISFACTION_ZONE_RADIUS_M,
    color: ZONE.satisfaction.stroke,
    weight: 2.5,
    opacity: 0.74,
    fillColor: ZONE.satisfaction.fill,
    fillOpacity: 0.18,
    interactive: false,
    className: "tri-satisfaction-zone",
  }).addTo(map);
  circlesOut.push(zone);
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

/** Accessibility labels at smart-crossing / bike corridor (KPI 4.2) — markers only, no zone halos. */
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

    const tagLabel =
      loc.kind === "smart_crossing_site" ? "Smart crossing" : tagKey;
    addZoneTag(
      map,
      loc.lat,
      loc.lng,
      tagLabel,
      "Accessibility zone",
      "accessibility",
      markersOut,
      0.00032
    );
  });
}
