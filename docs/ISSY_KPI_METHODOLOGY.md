# Issy-les-Moulineaux — KPI methodology (synthetic / current integration)

This document describes how ELABORATOR currently computes Issy KPIs, which datasets feed each view, and known limitations. It aligns with Valeria’s data-transparency review (zone OD vs segment API).

## A. Data sources

| Source | What it provides | Geometry | Role in app |
|--------|------------------|----------|-------------|
| **traficissy API** | Road segment traffic: segment ID, line geometry, speed (`vitesse_km_h`), congestion index (`indice_de_congestion`) | Segment (exact) | Observed segment-level traffic; junction approach arms; KPI 2.1 and segment context for other KPIs |
| **Bicycle counting API** | Hourly counts at sensor stations | Point (exact) | Observed cycling activity; supplementary to mode share |
| **Cycling infrastructure API** | Facility / network features | Segment / point (exact) | Observed infrastructure for KPI 3.1 |
| **ISSY1 baseline/post CSV** | `vehicle_category`, `zone_in`, `zone_out`, `hour`, `day_category`, `avg_traffic` | Zone OD (matched centroids) | Observed zone-to-zone flow — **not** per-street measurement |

Bundled CSV paths (demo): `/public/data/issy/ISSY1_baseline_traffic_data_november_2024.csv`, `ISSY1_post_intervention_traffic_data_november_2025.csv`.

## B. KPI 1.2 — Mobility Mode Share

**Primary source (city / pilot view):** ISSY1 baseline + post CSV (observed OD flow).

1. Parse CSV rows into zone-pair features.
2. Aggregate `avg_traffic` by `vehicle_category` (mapped to ELABORATOR mode buckets).
3. Mode share = category total ÷ all categories total (per period).
4. Compare baseline vs post-intervention; change = post share − baseline share (**percentage points**).
5. **Spatial representation:** zone-to-zone flow arcs between zone centroids — **not** street-level measurement.

**Junction study view (arms):**

- Arms use **traficissy** segment geometry and live speed/congestion only.
- Line colour / index on arms is **traffic context**, not CSV mode share assigned to each street.
- Observatory must not claim CSV `zone_in` / `zone_out` values are measured on each arm.

## C. KPI 2.1 — Road User Safety

**Source:** traficissy segment data (observed).

**Current proxy (derived):**

```
safetyPressure = 100 − (speed_km_h / referenceSpeed) × 100
```

`referenceSpeed` = 60 km/h (configurable assumption).

Higher value ⇒ higher pressure / lower speed condition. This is a **derived proxy**, not an official iRAP or crash-based safety score.

## D. KPI 3.2 — Climate and Environmental Impact

Where no direct CO₂ or air-quality raster is linked for Issy:

**Proxy (derived / modelled):**

```
environmentalPressure ≈ congestion_index × 100
```

(or equivalent normalized traffic pressure from segment API).

Label as **derived proxy**. Do not present as measured CO₂ reduction unless emissions inventory data is integrated.

Pilot 3 (GecoAir) narrative is citizen / app-driven; map hex field remains proxy unless GecoAir feeds are wired in.

## E. KPI 3.1 — Zero-Emission Facilities and Services

**Source:** cycling infrastructure API when available (observed).

Points / segments with API geometry render on map; otherwise partial or unavailable.

## F. KPI 4.1 — User Satisfaction

No observed Issy satisfaction survey integrated in the current build.

Treat headline values as **mock / demo** or unavailable until survey data is linked.

## G. KPI 4.2 — Accessibility and Security

Derived from infrastructure proximity / isochrone-style logic where shown.

Label **derived** unless a direct accessibility audit dataset is linked (e.g. Milan-style workbooks).

## H. Data transparency rules

| Label | Meaning |
|-------|---------|
| **observed** | Directly from API or CSV without formula beyond aggregation |
| **derived** | Calculated from observed inputs (proxies, baselines, comparisons) |
| **modelled** | Estimated from assumptions or structural formulas |
| **mock** | Demo placeholder without city dataset |

## UI contract (Issy)

- CSV → “Observed OD flow data” + OD disclaimer.
- traficissy → “Observed segment data”.
- Safety / climate junction metrics → “Derived proxy”.
- Junction schematic → “Visualized movement direction / derived representation”.

See `src/lib/issyDataTransparency.ts` for in-app copy constants.
