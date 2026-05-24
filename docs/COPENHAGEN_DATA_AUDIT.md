# Copenhagen Data Audit — OpenTrafficCam (OTC) Counts

**Status:** parser `ready` · readiness `ready` for KPI 1.2 and KPI 2.1
**Source:** SharePoint folder `Copenhagen/OpenTrafficCam Counts 2024 and 2025/`
**Last audit:** 2026-05-24 (Valeria feedback)

---

## 1. Workbooks audited

| File | Site | Coordinates (machine-readable) |
| --- | --- | --- |
| `Countings_Norreport_sortet.xlsx` | Norregade / Nørre Voldgade | `55.682312, 12.570922` |
| `Countings_Vandkunsten_sortet.xlsx` | Vandkunsten / Rådhusstræde | `55.677575, 12.579961` |
| `Countings_Gammeltorv_sortet.xlsx` | Gammeltorv / Vestergade | `55.678437, 12.572236` |
| `Countings_Stormgade_sortet.xlsx` | Frederiksholmskanal / Stormgade | `55.675535, 12.575545` |

Combined-counts files (`OTC Combined counts ELABORATOR.xlsx`,
`ELABORATOR Counts OTC combined Noerreport Noerregade to WP7.xlsx`,
`ELABORATOR Counts OTC combined Vandkunsten to WP7.xlsx`) are aggregated outputs and
are **not** used by the parser; we read the per-site `Countings_*_sortet.xlsx`
workbooks directly so that direction and 15-min granularity are preserved.

## 2. Sheet structure (consistent across all four sites)

- `Overview` — site name, Google Maps link, **coordinates** (lat, lon, comma-separated),
  `Date Pre`, `Date Post`, comments.
- `Data_<site>_Pre` — raw 15-min rows: `start time`, `start occurrence date`,
  `start occurrence time`, `end time`, `end occurrence date`, `end occurrence time`,
  **`classification`** (vehicle category), **`flow`** (direction label), **`count`**.
- `Data_<site>_Post` — same shape as Pre, post-intervention period.
- `pivot pre <year>` / `pivot post <year>` — Excel pivot tables (Danish headers
  `Sum af count`, `Kolonnemærkater`, `Rækkemærkater`). Useful for cross-checks but
  not consumed by the parser.

Stormgade additionally has a sheet `Pre and post Frholms kanal` which is currently
ignored; it appears to be a manual cross-tab and not raw counts.

## 3. Machine-readable fields

| Field | Available? | Source |
| --- | --- | --- |
| Camera/site name | Yes | Overview row "Site" |
| Coordinates (lat, lon) | **Yes — exact** | Overview row "Coordinates" |
| Direction | **Yes** | `flow` column in Data_<site>_Pre / Data_<site>_Post (e.g. "Norregade north", "Norregade south") |
| Pre/post periods | **Yes** | Overview rows "Date Pre" / "Date Post" + separate Pre/Post sheets |
| Vehicle category | **Yes** | `classification` column — bicyclist, bicyclist_with_trailer, bus, car, car_with_trailer, cargo_bike_driver, delivery_van, delivery_van_with_trailer, motorcyclist, other, pedestrian, private_van, scooter_driver, train, truck |
| Per-15-min counts | **Yes** | `count` column with `start time` / `end time` |

## 4. Parser behaviour (`src/services/localCityData.ts`)

1. Read each per-site workbook over `fetch()` (cached per KPI).
2. Parse `Overview` → site name + coordinates + date ranges.
3. Aggregate `Data_<site>_Pre` and `Data_<site>_Post` rows by **`(flow direction, classification)`**.
4. Map classifications to ELABORATOR-compatible buckets:
   - **bike** = `bicyclist*`, `cargo_bike_driver`
   - **pedestrian** = `pedestrian`
   - **PTW** = `motorcyclist`, `scooter_driver`
   - **motorised** = `car*`, `bus`, `truck`, `van*`, `train`
5. Emit one `NormalizedCityRecord` per `(camera, direction)` with:
   - exact lat/lon, observed data type, `temporalCoverage: "before-after"`,
   - `baselineValue` = KPI metric over Pre counts (sustainable share for KPI 1.2),
   - `interventionValue` = KPI metric over Post counts,
   - `comparisonValue` = intervention − baseline.

This yields **2 records per camera × 4 cameras = 8 sensor points** with directional
arrows on the map; the synthetic fallback in `HeroMap.tsx`
(`ensureCityCoverage` → `coverage-fallback`) is **hard-disabled for Copenhagen**
so generated points are never added.

## 5. KPI mapping

| KPI | Computed from per-(camera, direction) aggregates |
| --- | --- |
| **KPI 1.2** Mobility mode share | `(bike + pedestrian) / total` × 100, clamped 0-100 |
| **KPI 2.1** Safety pressure | weighted mix of motorised+PTW share and per-direction intensity proxy |
| **KPI 3.2** Environmental pressure | motorised share weighted by intensity proxy |

KPI 1.2 (the priority for Valeria's review) is now **directly observed** — no
synthetic baseline ratio. Pre counts drive baseline, Post counts drive
intervention, and Δ is the real before/after change at each camera/direction.

## 6. Map representation

Map popups for Copenhagen camera points now show:

- Camera/site name (e.g. "Norregade / Nørre Voldgade")
- Direction (e.g. "Norregade north")
- Baseline / Intervention values + Δ
- Source = OpenTrafficCam Excel · Data type = observed
- Date Pre + Date Post day from the Overview sheet

Trust badges: `Exact` · `Observed` · `Per direction` · `Pre + Post`.

## 7. Remaining gaps

- **ELABORATOR mode lexicon.** The current bucket mapping covers the dominant
  classes; cross-validation against the official ELABORATOR mode taxonomy is still
  needed for edge categories (e.g. `delivery_van_with_trailer`, `train`).
- **Time-of-day / weekday normalisation.** Pre vs Post periods have different
  length and day-of-week mix. We currently sum totals over the whole period;
  a 7-day-equivalent normalisation across all four cameras is the next step.
- **Pivot sheet cross-check.** Danish-header pivot sheets are not currently
  parsed; they could be used as an integrity check on the raw aggregation.
- **Camera-view artefacts** noted in the Overview comments (e.g. Stormgade pre/post
  camera mounts differ, Vandkunsten backlight 19:00-20:30) are not yet surfaced in
  the UI.

## 8. Registry summary

```ts
{
  id: "cph-otc-counts",
  geometryQuality: "exact",
  spatialLinkageMethod: "direct-coordinates",
  temporalCoverage: "2024–2025",
  beforeAfterStatus: "both",
  parserStatus: "ready",       // was "partial" before this audit
  linkedKpis: ["kpi1.2", "kpi2.1"],
}
```

Because readiness is derived from the registry, Copenhagen KPI 1.2 and KPI 2.1
both move from **partial → ready** automatically in the Data Catalogue readiness
matrix.

## 9. Map render contract (KPI 1.2)

- Render exactly **8 camera-direction points** (4 cameras × 2 `flow` directions),
  with **no clustering** of camera directions.
- Never render coverage-expanded / synthetic fallback points for Copenhagen.
- Render direction arrows for each point; bearing is inferred from the direction
  label (north/east/south/west tokens).
- Render real street context from
  `public/data/copenhagen/streets.geojson` (generated once from OSM Overpass and
  committed to the repo).
- Mode filter is applied per point using parsed mode breakdown (`pre` / `post`):
  bike, pedestrian, motorised, PTW; comparison mode shows post-pre delta.
- KPI 1.2 Copenhagen path exits after point+street rendering, so no hex/area
  fallback layers are shown for this KPI/city combination.

## 10. Connected local corridors + observatory behavior

- Street geometry is rendered from real OSM centerlines, clipped locally around
  camera sites (`~80–250 m` spans via the generated GeoJSON clip process).
- Directional tints are applied on those real centerlines using observed
  OpenTrafficCam direction-level activity values.
- Selection behavior:
  - selected directional corridor brightens (line weight + opacity),
  - non-selected local corridors dim slightly,
  - no synthetic fan-out and no city-scale corridor exaggeration.
- Copenhagen observatory panel terminology is mobility-specific:
  - directional mobility counts
  - active mobility share
  - corridor activity
  - observed camera direction
  - OpenTrafficCam observed dataset

### KPI4.2 policy (Copenhagen)

- Accessibility values are **not fabricated** when no observed accessibility
  dataset is available.
- Copenhagen KPI4.2 now returns no observed local records and the observatory
  shows an explicit empty-state explaining:
  1. which observed datasets are currently available, and
  2. which additional observed accessibility datasets are required for KPI4.2.
