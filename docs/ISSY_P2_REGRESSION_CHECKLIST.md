# Issy Pilot 2 (issy-p2) regression checklist

Run before any release that touches map routing, junction arms, traffic API, or observatory UI.

**Environment:** Map view → Issy-les-Moulineaux → Pilot 2 → junction study pilots (p1/p2/p3 use the same junction machinery).

## Visual / map

- [ ] Four approach arms render at Stalingrad (`48.829725, 2.261046`).
- [ ] Green junction anchor sits at the intersection centre (not on a single arm vertex).
- [ ] KPI **1.2** at junction shows **segment arms only** — no city-wide zone OD flow arcs.
- [ ] KPI **1.2** city view (non-junction context if applicable) still shows zone OD flows from CSV when selected.
- [ ] Scenario **baseline** / **intervention** / **comparison** change arm colour/weight; comparison shows ghost baseline geometry.

## Observatory

- [ ] Clicking an arm opens **Segment Intelligence** panel.
- [ ] Panel lists four junction segment IDs from live/API or cached traffic.
- [ ] Selected arm highlight syncs with map (`selectedJunctionSegmentId`).

## Data

- [ ] Live `traficissy` fetch returns rows for all four segment IDs (`ISSY_JUNCTION_ARMS` in `issyPilot2Junction.ts`).
- [ ] Map popups and sidebar **Data trust** show OBSERVED / confidence for active layer.

## Automated smoke

```bash
npm run build
```

Build must pass with no TypeScript errors.

## Sign-off

| Date | Tester | Pass |
|------|--------|------|
|      |        |      |
