# Copenhagen visual QA matrix

Sign-off checklist for gap-closure release. Run:

```bash
npm run extract-sharepoint
npm run build-copenhagen-data
npm run dev
```

Navigate: **Copenhagen** → each pilot → each KPI. Mark `[x]` when verified in browser.

## cph-p1 — Relocation of car parking

| KPI | Map | Observatory | Notes |
| --- | --- | --- | --- |
| kpi1.2 | [ ] Telraam + OTC directions render | [ ] telraamModeBars | [ ] Platomo flow-camera markers (6) |
| kpi2.1 | [ ] Radar / flow pressure | [ ] flowPressure | |
| kpi3.2 | [ ] Motor proxy field | [ ] motorIntensity | |
| kpi4.1 | [ ] Acceptability context | [ ] sentimentGauge | |
| kpi4.2 | [ ] Empty state (no fabricated audit) | [ ] accessibilityBars empty copy | Lists linked datasets |

## cph-p2 — Enhanced bicycle parking (Vandkunsten)

| KPI | Map | Observatory | Notes |
| --- | --- | --- | --- |
| kpi1.2 | [ ] OTC Vandkunsten context | [ ] | Supporting only |
| kpi2.1 | [ ] | [ ] | |
| kpi3.1 | [ ] Facility markers + WGS84 parking polygons | [ ] facilityInventory | Polygons ~55.67°N |
| kpi3.2 | [ ] | [ ] | |
| kpi4.1 | [ ] | [ ] | |
| kpi4.2 | [ ] Accessibility markers + parking polygons | [ ] accessibilityBars (derived proxy) | Method string visible |

## cph-p3 — Traffic flow / near encounters

| KPI | Map | Observatory | Notes |
| --- | --- | --- | --- |
| kpi1.2 | [ ] OTC corridors | [ ] | |
| kpi2.1 | [ ] iRAP + flow pressure | [ ] flowPressure + tube speed stat cards | |
| kpi3.2 | [ ] | [ ] | |
| kpi4.1 | [ ] | [ ] likertRadar safety | |
| kpi4.2 | [ ] Empty state | [ ] Empty + evidence narrative | Methodology tab: near encounters |

## Cross-cutting

| Check | Status |
| --- | --- |
| Mode share labels show 1 decimal (ModeShareBarChart) | [ ] |
| Methodology tab: CopenhagenEvidencePanel images + narrative blocks | [ ] |
| parking-polygons-wgs84.geojson coords in Copenhagen (not UTM) | [ ] |
| No EN 17210 claims on derived KPI 4.2 proxy | [ ] |

## Sign-off

| Role | Date | Result |
| --- | --- | --- |
| Build (`npm run build`) | 2026-06-30 | [x] Pass |
| Browser walk (3×6 matrix) | | [ ] Pending manual pass |

_Log failures below with pilot, KPI, and screenshot path._
