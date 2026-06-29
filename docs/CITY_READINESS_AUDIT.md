# City Readiness & UX Consistency Audit

**Date:** 2026-06-25  
**Scope:** Lighthouse cities on the ELABORATOR map (Issy, Copenhagen, Helsinki, Milan, Zaragoza, Trikala)  
**Focus:** Platform QA and observatory UX consistency — not new dataset ingestion.

---

## Executive summary

| City | Observatory shell | Data confidence | Stakeholder-ready? |
|------|-------------------|-----------------|------------------|
| **Issy-les-Moulineaux** | Unified (`SegmentIntelligencePanel`) | High (live API + OD CSV) | Yes — reference implementation |
| **Copenhagen** | Unified (was `CityObservatoryPanel`) | High for KPI 1.2 directional counts | Yes for KPI 1.2 / 2.1 / 3.2; KPI 4.2 explicit gap |
| **Helsinki** | Unified | Medium–High (Telraam + GeoJSON layers) | Partial — Telraam lacks export coordinates |
| **Milan** | Unified | Medium (segment parsers; SharePoint mirror external to June drop) | Partial — depends on hosted Milan tree |
| **Zaragoza** | Unified | Low–Medium (manual counts; KPI workbooks templated) | Partial — before/after KPI 1.2 placeholders |
| **Trikala** | Unified | Low–Medium (survey aggregates at pilot anchor) | Partial — no intervention geometry in drop |

**Unification status (2026-06-25):** All cities now route through a single observatory shell (`SegmentIntelligencePanel`) with identical tab structure: Overview · Data · Before/After · KPI Analysis · Methodology. City-specific content is supplied via registry + `CityObservatoryTabContent` (non-Issy) or Issy junction analytics (Issy).

**Data integration reference:** SharePoint June 2026 maturity, KPI sources, and per-pilot intervention geometry are documented in the in-app Data Catalogue at `/data-catalogue#sharepoint-integration` and `/data-catalogue#intervention-geometry`.

---

## Part 1 — City Readiness Audit

### Issy-les-Moulineaux

| Dimension | Status | Notes |
|-----------|--------|-------|
| **Intervention geometry** | Ready | Junction schematic + traficissy segment arms; ISSY1 OD zones for KPI 1.2 |
| **Monitoring locations** | Ready | Live traficissy API segments; bundled ISSY1 baseline/post CSV |
| **Baseline availability** | Active | Nov 2024 baseline CSV; API historical context |
| **Post availability** | Active | Nov 2025 post CSV; live API snapshot |
| **KPI readiness** | 6/6 ready or partial | KPI 1.2 from OD CSV; KPI 2.1 from API; KPI 3.x/4.x linked |
| **Observatory readiness** | Ready | Full unified shell; junction API + registry merge |
| **Confidence** | **High** | Observed API + CSV; provenance labels in Data tab |
| **Partner dependencies** | traficissy API uptime; OD CSV refresh for next reporting window |

**Observatory type:** Corridor Observatory  
**Component:** `SegmentIntelligencePanel` (reference)

---

### Copenhagen

| Dimension | Status | Notes |
|-----------|--------|-------|
| **Intervention geometry** | Ready | 4 OTC camera sites, exact coordinates (xlsx or JSON fallback) |
| **Monitoring locations** | Ready | 8 directional points (4 sites × 2 flows) after SharePoint extract |
| **Baseline availability** | Active | Pre-intervention counts in `Countings_*_sortet.xlsx` or bundled JSON |
| **Post availability** | Active | Post-intervention counts in same workbooks |
| **KPI readiness** | KPI 1.2 ready; 2.1/3.2 partial; 4.2 missing | Directional mode breakdown supports mobility/safety/env proxies |
| **Observatory readiness** | Ready | Unified shell; camera direction list in KPI Analysis tab |
| **Confidence** | **High** for KPI 1.2 | Observed OTC counts; explicit kpi4.2 unavailable message |
| **Partner dependencies** | SharePoint mirror on production host; optional second counting round not required for demo |

**Observatory type:** Camera Observatory  
**Pilots:** cph-p1 (Norreport), cph-p2 (Vandkunsten), cph-p3 (Gammeltorv/Stormgade)

---

### Helsinki

| Dimension | Status | Notes |
|-----------|--------|-------|
| **Intervention geometry** | Partial | hel-p1: 2,663 dangerous-location points (GeoJSON); hel-p2: 509 eScooter points; hel-p3: Telraam cluster only |
| **Monitoring locations** | Partial | 2 Telraam xlsx files; segment ID without lat/lng in export |
| **Baseline availability** | Partial | Telraam time series; dangerous-locations survey snapshot |
| **Post availability** | Unclear | Telraam before/after window not explicit in export |
| **KPI readiness** | KPI 1.2/2.1 partial; 4.2 partial | Derived proxies from Telraam where coords inferred |
| **Observatory readiness** | Ready (shell) | Unified shell; GeoJSON overlay on map for p1/p2 |
| **Confidence** | **Medium** | Observed GeoJSON layers; Telraam coords approximate |
| **Partner dependencies** | FVH/Safety Sense partner feed; Mobilysis trajectories (deferred); intervention location gpkg from duplicate zip |

**Observatory type:** Intervention Observatory  
**Pilots:** hel-p1 Safety Sense, hel-p2 eScooter parking, hel-p3 citywide Telraam

---

### Milan

| Dimension | Status | Notes |
|-----------|--------|-------|
| **Intervention geometry** | Partial | AMAT speed segments + camera shapefiles (separate SharePoint tree, not in June 2026 drop) |
| **Monitoring locations** | Partial | Segment parsers active when `public/sharepoint-data/Milan/` hosted |
| **Baseline availability** | Partial | AMAT counts; RETE environmental windows |
| **Post availability** | Partial | DSS accessibility workbook for KPI 4.2 |
| **KPI readiness** | Mixed partial | KPI 2.1 strongest (speed segments); KPI 3.2 hour-band dependent |
| **Observatory readiness** | Ready (shell) | Unified shell; map uses milan segment hooks |
| **Confidence** | **Medium** | Observed where SharePoint mirror present; otherwise registry mock |
| **Partner dependencies** | AMAT shapefile tree hosting; CIRCE accessibility workbook refresh |

**Observatory type:** Street Segment Observatory  
**Pilots:** mil-p1 LTZ, mil-p2 cycling corridor, mil-p3 transit priority

---

### Zaragoza

| Dimension | Status | Notes |
|-----------|--------|-------|
| **Intervention geometry** | Partial | 5 intervention area centroids from shapefile; polygons not rendered in observatory |
| **Monitoring locations** | Partial | 3 manual count locations (June 2025); KPI 1.2 workbooks contain `(value)` placeholders |
| **Baseline availability** | Active | Manual counting baseline (motor vehicles only; ped/bike marked pending) |
| **Post availability** | Missing | KPI 1.2 after workbooks unfilled; no post manual count in drop |
| **KPI readiness** | KPI 1.2/2.1/3.2 partial | Parser uses manual counts when workbook empty |
| **Observatory readiness** | Ready (shell) | Unified shell; inferred geometry at intervention centroids |
| **Confidence** | **Low–Medium** | Observed motor counts; sustainable mode share incomplete |
| **Partner dependencies** | Partner to fill KPI 1.2 hourly slots; second manual count (Sep 2025); post-intervention shapefiles |

**Observatory type:** Area Observatory  
**Pilot:** zar-p1 active mobility corridor

---

### Trikala

| Dimension | Status | Notes |
|-----------|--------|-------|
| **Intervention geometry** | Missing | No reliable coordinates in SharePoint inventory |
| **Monitoring locations** | Inferred | Smart-crossing + women mobility surveys at pilot anchor only |
| **Baseline availability** | Active | Survey xlsx (2024–2025 responses) |
| **Post availability** | Missing | No post-intervention monitoring feed in drop |
| **KPI readiness** | KPI 2.1/4.1/4.2 partial from surveys; KPI 1.2 derived proxy | 143+ smart-crossing responses |
| **Observatory readiness** | Ready (shell) | Unified shell; explicit missing-geometry notices |
| **Confidence** | **Low–Medium** | Survey-derived; not spatially linked |
| **Partner dependencies** | Intervention geometry delivery; post-intervention sensor or repeat survey |

**Observatory type:** Area Observatory  
**Pilot:** tri-p1 smart mobility area

---

## Part 2 — UX Consistency Audit

### Intervention-first flow

| Check | Issy | Copenhagen | Helsinki | Milan | Zaragoza | Trikala |
|-------|------|------------|----------|-------|----------|---------|
| Pilot select → observatory auto-open | Manual/focus | Yes | Yes | Yes | Yes | Yes |
| Intervention boundary on map | Yes | Yes | Yes | Yes | Yes | Yes |
| Observatory opens from segment click | Yes | Yes | Yes | Yes | Yes | Yes |
| `canOpenObservatory` gate | Yes | Yes | Yes | Yes | Yes | Yes |

**Result:** Pass — all cities use the same access gate and pilot-first navigation.

---

### Pilot profile completeness

Each pilot must expose: title, summary, objectives, expected impacts, trust (dataAvailability), availability (methodologyNotes).

| City | Pilots | Title | Summary | Objectives | Impacts | Trust/availability |
|------|--------|-------|---------|------------|---------|-------------------|
| Issy | 3 | Via `issyPilotProfiles` | Yes | Yes | Yes | Yes (analyticalIdentity) |
| Copenhagen | 3 | `copenhagenPilotProfiles` | Yes | Yes | Yes | Yes |
| Helsinki | 3 | `helsinkiPilotProfiles` | Yes | Yes | Yes | Yes |
| Milan | 3 | `milanPilotProfiles` | Yes | Yes | Yes | Yes |
| Zaragoza | 1 | `zaragozaPilotProfiles` | Yes | Yes | Yes | Yes |
| Trikala | 1 | `trikalaPilotProfiles` | Yes | Yes | Yes | Yes |

**Result:** Pass — all pilots have required profile fields in city pilot registries.

---

### Observatory structure (unified shell)

| Element | Before unification | After unification (2026-06-25) |
|---------|-------------------|------------------------------|
| Component | Issy: `SegmentIntelligencePanel`; others: `CityObservatoryPanel` | **All: `SegmentIntelligencePanel`** |
| Shell layout | Issy full-height slide-over; cities floating card | **All full-height Issy shell** |
| Tabs | Issy KPI-specific (4); cities 5 generic | **All 5 unified tabs** |
| Header badges | Issy only | **All: Observed/Derived/Modelled/Mock + KPI + Confidence + Coords** |
| Mini schematic | Issy junction SVG | **All: junction registry schematic** |
| Performance bar | Issy only | **All cities** |
| Export footer | Issy only | Issy export; cities footer with provenance |

| Tab | Required | Implemented |
|-----|----------|-------------|
| Overview | Yes | Yes — pilot summary + objectives (cities); Issy KPI views |
| Data | Yes | Yes — availability + source tags |
| Before/After | Yes | Yes — temporal scope + Copenhagen direction charts |
| KPI Analysis | Yes | Yes — summary + camera directions (Copenhagen) |
| Methodology | Yes | Yes — meaning, calculation, limitations, sources |

**Result:** Pass — structural parity achieved. Issy retains richer KPI-specific visualizations inside unified tabs.

---

### KPI explanation completeness

| Requirement | Data Catalogue | In-observatory Methodology tab |
|-------------|--------------|-------------------------------|
| Meaning | `cityKpiMethodology.ts` | Yes |
| Calculation | Yes | Yes |
| Limitations | Yes | Yes |
| Sources | Yes | Yes with `SourceTag` on KPI values |

**Gap:** Issy still has deeper `ISSY_KPI_METHODOLOGY` in Data Catalogue; in-observatory Methodology tab now uses `getCityKpiMethodology` for all cities including Issy.

---

### Quality rules

| Rule | Status | Notes |
|------|--------|-------|
| No generic empty states | Partial | Missing-data notices are explicit; mock registry still used when no observed points |
| No synthetic geometry as observed | Partial | `ensureCityCoverage` disabled for Copenhagen/Zaragoza/Trikala when observed points exist; junction registry mock labelled |
| No KPI value without source label | Pass | `SourceTag` + footer provenance on all observatory KPI displays |

---

## Part 3 — Observatory component map (post-unification)

| City | Active component | Legacy / unused |
|------|------------------|-----------------|
| Issy-les-Moulineaux | `SegmentIntelligencePanel` | — |
| Copenhagen | `SegmentIntelligencePanel` + `CityObservatoryTabContent` | `CopenhagenObservatoryPanel` (orphaned) |
| Helsinki | `SegmentIntelligencePanel` + `CityObservatoryTabContent` | `HelsinkiObservatoryPanel` (orphaned) |
| Milan | `SegmentIntelligencePanel` + `CityObservatoryTabContent` | — |
| Zaragoza | `SegmentIntelligencePanel` + `CityObservatoryTabContent` | — |
| Trikala | `SegmentIntelligencePanel` + `CityObservatoryTabContent` | — |
| All cities (deprecated alias) | — | `CityObservatoryPanel` → re-exports unified shell |

---

## Part 4 — Remaining gaps by city

### Issy
- None blocking stakeholder demo for supported KPIs.
- Optional: surface `ISSY_KPI_METHODOLOGY` steps inside Methodology tab (currently uses generic city methodology).

### Copenhagen
- KPI 4.2 not supported by camera counts (explicit message in observatory).
- Production must host SharePoint extract or rely on bundled JSON fallback.

### Helsinki
- Telraam export lacks coordinates — map uses approximate cluster.
- hel-p3 intervention geometry still pending.
- Mobilysis / LiDAR archives not in dashboard scope.

### Milan
- June 2026 SharePoint drop excluded Milan — production must host separate `public/sharepoint-data/Milan/` tree.
- Segment join quality varies by pilot.

### Zaragoza
- KPI 1.2 workbook cells are placeholders — motor-only manual counts used.
- Post-intervention data not in drop.
- Intervention polygons not rendered (centroids only).

### Trikala
- No intervention geometry — all survey KPIs at pilot anchor.
- No post-intervention monitoring feed.
- KPI 1.2 is survey-derived proxy only.

---

## Part 5 — Recommended tasks before stakeholder review

### P0 — Must do
1. **Host SharePoint mirror on production** for Copenhagen, Helsinki, Zaragoza, Trikala (`docs/SHAREPOINT_DATA_SETUP.md`).
2. **Smoke-test observatory** on each city: verify 5 tabs render, source labels present, no synthetic padding over observed points.
3. **Remove or archive dead panels** (`CopenhagenObservatoryPanel.tsx`, `HelsinkiObservatoryPanel.tsx`) to prevent future routing regression.

### P1 — Should do
4. **Zaragoza:** Partner fills KPI 1.2 hourly workbook values; schedule second manual count for ped/bike.
5. **Helsinki:** Request Telraam export with lat/lng or segment→geometry lookup table.
6. **Milan:** Confirm SharePoint Milan tree on production; verify KPI 2.1 segment observatory with live data.
7. **Trikala:** Add intervention polygon when partner delivers geometry; link post survey wave.

### P2 — Nice to have
8. Export button for non-Issy cities (currently Issy-only `exportObservatoryReport`).
9. Replace junction registry mock metrics with observed aggregates when `useLocalCityData` returns points (partially done via `buildCityObservatoryView`).
10. Data Catalogue workflow health check in stakeholder walkthrough deck.

---

## Appendix — KPI readiness matrix summary

Derived from `kpiReadinessMatrix.ts` + dataset registry (2026-06-25):

| City | Ready | Partial | Missing |
|------|-------|---------|---------|
| Issy-les-Moulineaux | 5 | 1 | 0 |
| Copenhagen | 1 | 2 | 3 |
| Helsinki | 0 | 4 | 2 |
| Milan | 0 | 5 | 1 |
| Zaragoza | 1 | 3 | 2 |
| Trikala | 0 | 4 | 2 |

*Exact counts per KPI available in Data Catalogue → KPI readiness matrix.*

---

## Files touched in observatory unification

| File | Change |
|------|--------|
| `src/components/SegmentIntelligencePanel.tsx` | Unified shell for all cities; status badge; confidence; city tab routing |
| `src/components/CityObservatoryTabContent.tsx` | City-specific tab bodies (Overview/Data/Before-After/KPI/Methodology) |
| `src/lib/observatoryCityContent.ts` | `buildCityObservatoryView`, shell titles, data classification |
| `src/lib/observatoryRegistry.ts` | Unified 5-tab config for all cities |
| `src/pages/Map.tsx` | Single panel route; observed view enrichment |
| `src/components/CityObservatoryPanel.tsx` | Deprecated re-export |

---

## Observatory graphics registry (2026-06-29)

Per-city, per-KPI graphics are resolved via `observatoryGraphicsRegistry.ts` and rendered through `ObservatoryGraphicSlot` in the unified shell.

### Lookup key

`(observatoryType, kpiId, tabZone)` with optional `pilotId` override.

- **observatoryType:** `corridor` (Issy) · `camera` (Copenhagen) · `intervention` (Helsinki) · `street-segment` (Milan) · `area` (Zaragoza/Trikala)
- **tabZone:** `header` (schematic strip) · `overview` · `beforeAfter` · `kpiAnalysis`
- **Data honesty:** every graphic shows `SourceTag` + `dataClass` label; mock data renders an amber disclaimer

### Default chart matrix

| observatoryType | kpi1.2 | kpi2.1 | kpi3.1 | kpi3.2 | kpi4.1 | kpi4.2 |
|-----------------|--------|--------|--------|--------|--------|--------|
| corridor (Issy) | modeShareBars | junctionPressure | facilityInventory | climateField | sentimentGauge | accessibilityBars |
| camera (Copenhagen) | directionModeBreakdown | flowPressure | — | motorIntensity | — | — |
| intervention (Helsinki) | telraamModeBars | safetyDensity | — | envProxy | surveyLikert | accessLikert |
| street-segment (Milan) | segmentModeShare | speedProfile | facilityStrip | reteBand | sentiment | dssBars |
| area (Zaragoza/Trikala) | manualCountBars | motorPressure | — | proxyDelta | likertRadar | accessLikert |

### Header schematics

| observatoryType | Schematic component |
|-----------------|----------------------|
| corridor | `JunctionSchematic` |
| camera | `CameraCorridorSchematic` |
| intervention | `InterventionPointsSchematic` |
| street-segment | `StreetSegmentSchematic` |
| area | `AreaPolygonSchematic` |

### New files

| File | Role |
|------|------|
| `src/lib/observatoryGraphicTypes.ts` | Shared types for graphics payloads |
| `src/lib/observatoryGraphicsRegistry.ts` | Matrix + `resolveObservatoryGraphic` + `kpiStatusCaption` |
| `src/lib/observatoryGraphicData.ts` | Builds chart/schematic payloads from junction view + local points |
| `src/components/observatory/ObservatoryGraphicSlot.tsx` | Orchestrator (registry → adapter → component) |
| `src/components/observatory/schematics/*` | City-type header schematics |
| `src/components/observatory/charts/*` | Shared KPI charts |
