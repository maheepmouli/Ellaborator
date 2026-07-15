/** Spread overlapping map markers at lower zoom levels (display-only offsets). */

export type SpreadOverlapOptions = {
  /**
   * Fixed geographic fan-out that looks the same when zooming (no zoom-tier jumps).
   * Use for icon KPIs where zoom-dependent spread caused layout drift.
   */
  zoomStable?: boolean;
};

export function spreadOverlappingPositions(
  coords: ReadonlyArray<{ id: string; lat: number; lon: number }>,
  zoom: number,
  options?: SpreadOverlapOptions
): Map<string, [number, number]> {
  const positions = new Map<string, [number, number]>();
  if (!coords.length) return positions;
  if (!options?.zoomStable && zoom >= 17) {
    coords.forEach((c) => positions.set(c.id, [c.lat, c.lon]));
    return positions;
  }

  const precision = options?.zoomStable ? 5 : zoom < 14 ? 3 : 4;
  const groups = new Map<string, Array<{ id: string; lat: number; lon: number }>>();
  coords.forEach((coord) => {
    const key = `${coord.lat.toFixed(precision)}|${coord.lon.toFixed(precision)}`;
    const group = groups.get(key) ?? [];
    group.push(coord);
    groups.set(key, group);
  });

  const minRadialDeg = options?.zoomStable
    ? 0.0002
    : zoom < 14
      ? 0.00042
      : zoom < 15
        ? 0.00032
        : 0.00022;
  const outwardScale = options?.zoomStable ? 2.2 : zoom < 14 ? 2.6 : 2.1;

  groups.forEach((group) => {
    if (group.length === 1) {
      positions.set(group[0].id, [group[0].lat, group[0].lon]);
      return;
    }

    let meanLat = 0;
    let meanLon = 0;
    for (const c of group) {
      meanLat += c.lat;
      meanLon += c.lon;
    }
    meanLat /= group.length;
    meanLon /= group.length;

    group.forEach((c, i) => {
      let dx = c.lon - meanLon;
      let dy = c.lat - meanLat;
      const dist = Math.hypot(dx, dy);
      let tx = dx;
      let ty = dy;

      if (dist < 1e-8) {
        const angle = (2 * Math.PI * i) / group.length - Math.PI / 2;
        tx = Math.cos(angle) * minRadialDeg;
        ty = Math.sin(angle) * minRadialDeg;
      } else {
        const target = Math.max(dist * outwardScale, minRadialDeg * 0.92);
        tx = (dx / dist) * target;
        ty = (dy / dist) * target;
      }

      positions.set(c.id, [meanLat + ty, meanLon + tx]);
    });
  });

  return positions;
}
