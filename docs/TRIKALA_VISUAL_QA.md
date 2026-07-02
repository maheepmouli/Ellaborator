# Trikala Visual QA — Sign-off

**Date:** 2026-07-01  
**Pilot:** `tri-p1` — Smart mobility area (Trikala)  
**Status:** ✅ Approved for production release package

---

## Design intent

Trikala survey data is **non-spatial** (Likert aggregates, no intervention geometry in the SharePoint drop). The map layer intentionally uses:

- Concentric **radial rings** at the pilot anchor to signal *generalized perception monitoring* (not street-precise geometry)
- **Distinct marker accents** per sub-segment (caregivers, village, urban, etc.)
- **Environmental sensor web** on KPI 3.2 (19 Smart Citizen Kit footprints, inferred positions)
- Top banner: *"Spatial uncertainty — geometry is contextual, not street-precise"*

This pattern aligns with Copenhagen's honest data-transparency approach while maintaining premium dark-mode aesthetics.

---

## Verified screens

| View | KPI | Pass criteria |
|------|-----|---------------|
| Survey rings + markers | 2.1 / 4.1 / 4.2 | Emerald/cyan concentric rings; segment markers with hover tooltips |
| Mode share bars | 1.2 | Baseline vs intervention pedestrian/cycling splits from Excel parsers |
| Environmental fleet | 3.2 | Distributed outdoor sensor points; fleet summary card |
| Radar chart (sidebar) | 2.1 | Pentagon radar on navy slate background (`#131a30`), not black box |
| Observatory evidence | Methodology | PDFs, SMARTA photos, workshop docs, sensor narrative |

---

## Polish pass (2026-07-01)

### Sub-segment marker differentiation
- Per-segment accent colors: Caregivers (cyan), Rural village (gold), Urban (emerald), Suburban (violet)
- Hover tooltips with segment name + metric label
- Segment-keyed jitter spreads western-cluster markers

### Radar / schematic background blend
- `.insight-chart-panel` background → `#131a30` gradient
- Recharts surface transparent
- `AreaPolygonSchematic` rect fill → `OBS_C.schematicBg` (`#131a30`)

---

## Data coverage

| Asset class | Count | Integration |
|-------------|-------|-------------|
| Survey xlsx | 8 | Parsed → map + observatory |
| Images | 13 | `/data/trikala/media/` + evidence manifest |
| Documents | 26 | `/data/trikala/docs/` + evidence manifest |
| Environmental sensors | 19 | KPI 3.2 fleet registry |
| Park & Ride (2nd intervention) | 0 | Narrative placeholder |
| Workshop audio (.m4a) | 1 | Narrative only |

---

## Production checklist

- [x] `npm run extract-sharepoint` — Trikala bulk extract (0 errors)
- [x] `npm run build-trikala-bundle` — committed `/data/trikala/` bundles
- [x] `npm run build` — production build passes
- [ ] Host `public/sharepoint-data/Trikala/` on production CDN (see `docs/SHAREPOINT_DATA_SETUP.md`)
- [ ] Smoke-test Trikala at zoom 14 for KPIs 1.2, 2.1, 3.2, 4.1, 4.2

---

## Sign-off

| Role | Name | Date |
|------|------|------|
| Implementation | ELABORATOR dashboard | 2026-07-01 |
| Visual QA | Stakeholder review (screens image_0a93ba–0a97d8) | 2026-07-01 |

**Verdict:** Layout makes complete sense. Ready for production deployment after SharePoint mirror hosting.
