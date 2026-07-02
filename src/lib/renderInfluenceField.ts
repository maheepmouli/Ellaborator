import L from "leaflet";

export type InfluenceFieldOptions = {
  /** Centre [lat, lng] */
  center: [number, number];
  /** Outer radius in metres */
  radiusMeters: number;
  /** Issy P2 flagship — slightly stronger visibility */
  flagship?: boolean;
  /** Neutral gray tones for Copenhagen pilot zones */
  tone?: "default" | "neutral";
};

/**
 * Soft analytical influence field — concentric fades instead of dashed purple rings.
 */
export function renderInfluenceField(
  map: L.Map,
  layersOut: L.Circle[],
  options: InfluenceFieldOptions
): void {
  const { center, radiusMeters, flagship = false, tone = "default" } = options;
  const fillColor =
    tone === "neutral" ? "#94a3b8" : flagship ? "#8b5cf6" : "#657df5";
  const rings = [
    { scale: 1, fill: flagship ? 0.055 : 0.038, stroke: 0 },
    { scale: 0.72, fill: flagship ? 0.042 : 0.028, stroke: 0 },
    { scale: 0.48, fill: flagship ? 0.03 : 0.018, stroke: 0 },
    { scale: 0.28, fill: flagship ? 0.02 : 0.012, stroke: 0 },
  ];

  rings.forEach((ring) => {
    const circle = L.circle(center, {
      radius: radiusMeters * ring.scale,
      color: "transparent",
      weight: 0,
      fillColor,
      fillOpacity: ring.fill,
      interactive: false,
    }).addTo(map);
    layersOut.push(circle);
  });
}
