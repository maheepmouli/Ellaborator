import L from "leaflet";

export type InfluenceFieldOptions = {
  /** Centre [lat, lng] */
  center: [number, number];
  /** Outer radius in metres */
  radiusMeters: number;
  /** Issy P2 flagship — slightly stronger visibility */
  flagship?: boolean;
};

/**
 * Soft analytical influence field — concentric fades instead of dashed purple rings.
 */
export function renderInfluenceField(
  map: L.Map,
  layersOut: L.Circle[],
  options: InfluenceFieldOptions
): void {
  const { center, radiusMeters, flagship = false } = options;
  const rings = [
    { scale: 1, fill: flagship ? 0.09 : 0.06, stroke: 0 },
    { scale: 0.72, fill: flagship ? 0.07 : 0.045, stroke: 0 },
    { scale: 0.48, fill: flagship ? 0.05 : 0.03, stroke: 0 },
    { scale: 0.28, fill: flagship ? 0.035 : 0.02, stroke: 0 },
  ];

  rings.forEach((ring) => {
    const circle = L.circle(center, {
      radius: radiusMeters * ring.scale,
      color: "transparent",
      weight: 0,
      fillColor: flagship ? "#8b5cf6" : "#657df5",
      fillOpacity: ring.fill,
      interactive: false,
    }).addTo(map);
    layersOut.push(circle);
  });
}
