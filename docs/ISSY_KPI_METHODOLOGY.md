# Issy-les-Moulineaux — KPI methodology (synthetic / current integration)

This document describes how ELABORATOR currently computes Issy KPIs, which datasets feed each view, and known limitations. It aligns with Valeria’s data-transparency review (zone OD vs segment API).

**In-app mirror:** Data Catalogue → [Issy KPI derivation](https://ellaborator.vercel.app/data-catalogue#issy-kpi-methodology) (content sourced from `src/data/issyKpiMethodology.ts`).

## A. Data sources

| Source | What it provides | Geometry | Role in app |
|--------|------------------|----------|-------------|
| **traficissy API** | Road segment traffic: segment ID, line geometry, speed (`vitesse_km_h`), congestion index (`indice_de_congestion`) | Segment (exact) | Observed segment-level traffic; junction approach arms; KPI 2.1 and segment context for other KPIs |
| **Bicycle counting API** | Hourly counts at sensor stations | Point (exact) | Observed cycling activity; supplementary to mode share |
| **Cycling infrastructure API** | Facility / network features | Segment / point (exact) | Observed infrastructure for KPI 3.1 |
| **KPI 3.1 SharePoint** | — | — | **No ZEM facility workbook** in June 2026 zip; requirements matrix marks all pilots NA. App uses live API only (Pilot 2). |
| **ISSY1 baseline/post CSV** | `vehicle_category`, `zone_in`, `zone_out`, `hour`, `day_category`, `avg_traffic` | Zone OD (matched centroids) | Observed zone-to-zone flow — **not** per-street measurement |
| **Wintics baseline xlsx** | Speed (mean, 85th %ile), flows, modal share % by time band at LL site | Point (camera) | **Pilot 1 site counts** — catalogued, not yet parsed in map layers. **Not interchangeable with zone OD.** |
| **Classeur.xlsx (ASIF)** | Modelled CO₂ from traffic flows + fleet emission factors | Segment (~50 m corridor) | **Pilot 1 / 3 emissions context** — planned parser; replaces congestion proxy when wired |
| **Pre-intervention requirements xlsx** | KPI × intervention data readiness matrix | None | Data Catalogue readiness table |
| **Partner docs / media** | Evaluation plan, FLOWELL synthesis PDF, engagement transcripts, site photo | Mixed | Evidence manifest & catalogue links — no KPI parsing |

Bundled CSV paths (demo): `/public/data/issy/ISSY1_baseline_traffic_data_november_2024.csv`, `ISSY1_post_intervention_traffic_data_november_2025.csv`.

SharePoint mirror (June 2026): `public/sharepoint-data/Issy-20260625T113904Z-3-001/Issy/` — see Data Catalogue → Issy SharePoint file inventory.

### Wintics vs zone OD (important)

- **Wintics** (`baseline_evaluation_data_light_emitting_marking_solution.xlsx`): single-camera measurement at the living-lab junction (Pilot 1). Example baseline cyclist modal share ~20.5% at site.
- **ISSY1 OD CSV**: city-wide zones 1–6, hourly directional flows. Powers KPI 1.2 city view and sidebar aggregates.
- Do **not** assign Wintics site shares to junction arms or zone OD arcs, or vice versa.

## B. KPI 1.2 — Mobility Mode Share

**Data type:** observed (OD CSV)  
**Primary source:** ISSY1 baseline + post CSV  
**Direction:** OD flow data is primary; **mode share is derived from OD volumes**, not the reverse.

### Steps

1. Parse CSV rows into zone-pair features.
2. **Each row is directional** — one record describes movement from `zone_in` to `zone_out` for one `vehicle_category`. The reverse direction (`zone_out` → `zone_in`) is only present if a separate row exists in the CSV.
3. Aggregate `avg_traffic` by `(zone_in, zone_out, vehicle_category)` (optional `day_category` filter). **Reverse pairs are never inferred.**
4. Map `vehicle_category` → ELABORATOR mode buckets (`src/lib/travelModeMapLink.ts`).
5. Sum volumes across all zone pairs per mode for baseline and post periods.
6. Compute mode share % and sustainable share (pedestrian + cycle + public transport).
7. Compare baseline vs post-intervention; change = post − baseline (**percentage points**).
8. Map: **one OD arc per CSV row** between zone centroids — never split across multiple streets or assigned to junction arms.

### Directional OD rules (Valeria, 2026-05-24)

- OD flow is **directional**. Each row in the CSV represents one direction only.
- **Reverse flows are not inferred** unless a reverse row is present in the dataset.
- One OD relation is **never split into multiple street arms** or street-level directions.
- **Junction arms use traficissy API only.** No OD CSV mode share is assigned to street arms.
- At junction zoom with KPI 1.2 selected, the OD mode share is shown only as **zone-level context** — never as an arm-level measurement.

### Formulas

```
flow(z_in, z_out, cat) = Σ avg_traffic

V_m = Σ flow over all zone pairs for mode m

Share_m (%) = 100 × V_m / Σ_all V

S = Share_Pedestrian + Share_Cycle + Share_PublicTransport

ΔS = S_post − S_baseline   (percentage points)
```

**Fallback:** if CSV fails to load, sidebar may use CITY_DATA mock (e.g. 45% headline).

### Junction study view (arms)

- Arms use **traficissy** segment geometry and live speed/congestion only.
- Line colour / index on arms is **traffic context**, not CSV mode share assigned to each street.
- Observatory must not claim CSV `zone_in` / `zone_out` values are measured on each arm.

## C. KPI 2.1 — Road User Safety

**Data type:** derived proxy  
**Source:** traficissy segment data (observed inputs)

### Formula

```
safetyPressure = max(0, 100 − (vitesse_km_h / 60) × 100)
```

`referenceSpeed` = 60 km/h (configurable assumption).

Higher value ⇒ higher pressure / lower speed condition. Junction study aggregates pressure across approach-arm segments.

**Sidebar:** star / radar values may still use CITY_DATA demo until iRAP or crash-based scores are integrated. This is a **derived proxy**, not an official iRAP or crash-based safety score.

## D. KPI 3.2 — Climate and Environmental Impact

**Data type:** derived proxy (+ mock time series on sidebar)

### Segment / map

```
environmentalPressure = city time-series intensity(year)   // one value for Issy
```

Map shows a **city-wide** halo + hub (not a spatial hex grid). Hex cells were a visual proxy only.

### Sidebar chart

```
intensity(year) = clamp(timeSeries[year].value, 0, 120)
```

Optional ASIF / Classeur workbook contributes a city total CO₂ rate when loaded — still one municipal reading.

Label as **derived proxy** (or **modelled** when ASIF is active). Do not present as measured CO₂ reduction unless emissions inventory data is integrated.

Pilot 3 (GecoAir) narrative is citizen / app-driven; map remains a city-level proxy unless GecoAir feeds are wired in.

## E. KPI 3.1 — Zero-Emission Facilities and Services

**Data type:** observed (when API loads)

**Primary source:** cycling infrastructure API (`issy-cycling-infra-api`). **No SharePoint file** in the June 2026 Issy Lighthouse drop — the pre-intervention requirements workbook lists KPI 3.1 (ZEM deployment) as NA for all three pilots.

**Primary pilot:** Pilot 2 (mobility observatory).

```
N_type = count(features where facility_type = type)
mainValue = Σ N_type   (or CITY_DATA mock if API partial)
```

Points / segments with API geometry render on map; otherwise partial or unavailable.

## F. KPI 4.1 — User Satisfaction

**Data type:** mock

No observed Issy satisfaction survey integrated in the current build.

```
N/A — placeholder until survey dataset linked
```

Treat headline values as **mock / demo** or unavailable until survey data is linked.

## G. KPI 4.2 — Accessibility and Security

**Data type:** derived / demo

No Issy-specific accessibility audit workbook (unlike Milan). Map may use inferred proximity layers; sidebar uses CITY_DATA feature counts.

```
N/A — no Issy audit file in current integration
```

Label **derived** unless a direct accessibility audit dataset is linked (e.g. Milan-style workbooks). Not EN 17210 field audit.

## H. Data transparency rules

| Label | Meaning |
|-------|---------|
| **observed** | Directly from API or CSV without formula beyond aggregation |
| **derived** | Calculated from observed inputs (proxies, baselines, comparisons) |
| **modelled** | Estimated from assumptions or structural formulas |
| **mock** | Demo placeholder without city dataset |

## UI contract (Issy)

- CSV → “Observed OD flow data” + OD disclaimer.
- traficissy → “Observed segment data” (KPI 2.1 / 3.2 map layers use derived formulas on observed fields).
- Safety / climate junction metrics → “Derived proxy”.
- Junction schematic → “Visualized movement direction / derived representation”.

See `src/lib/issyDataTransparency.ts` for in-app copy constants.  
See `src/data/issyKpiMethodology.ts` and `src/components/IssyKpiMethodologySection.tsx` for Data Catalogue cards.
