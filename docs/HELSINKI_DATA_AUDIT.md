# Helsinki Data Audit

## Scope

Helsinki Living Lab (Forum Virium Helsinki) lighthouse package ingested from SharePoint June 2026:

- Canonical zip: `public/Sharepoint_Datasets_06_2026/Helsinki-20260625T113855Z-3-001.zip`
- Build: `npm run build-helsinki-data` → `public/data/helsinki/`
- Runtime paths: `src/lib/helsinkiDataPaths.ts`

City objectives (Evaluation Plan, 12 May 2025): better near-miss/unreported safety data; orderly shared e-scooter parking; safer VRU crossings (esp. Raide-Jokeri); align with Helsinki Traffic Safety Program 2022–2026.

## Pilots

| App id | FVH | Title | Observatory type |
|--------|-----|-------|------------------|
| `hel-p1` | FVH1 | Accident & Near-Miss Data Collection | `intervention` |
| `hel-p2` | FVH2 | E-Scooter Parking Optimisation | `intervention` |
| `hel-p3` | FVH3 | Intersection Safety at Viikki | `intervention` |

## Delivered vs pending matrix

### FVH1 — Accident / near-miss (`hel-p1`)

| Asset | Status | Output |
|-------|--------|--------|
| Dangerous locations GPKG (2,663 points) | **Delivered** | `dangerous-locations.geojson` |
| Conflicts / near-miss GPKG (3,202 points) | **Delivered** | `conflicts.geojson` |
| Citywide safety-attitude survey (`yleiset.xlsx`) | **Delivered** | `dangerous-locations-survey-insights.json` |
| Intervention area polygon (`HelsinkiArea`) | **Delivered** | `intervention-locations.geojson` |
| See.Sense connected-bike near-miss feed | **Pending** | Not in SharePoint drop |
| ViaNova AI risk-scoring output | **Pending** | Not in SharePoint drop |

**KPIs:** 2.1 (primary), 1.2 (support), 3.2 (attitude survey).

### FVH2 — E-scooter parking (`hel-p2`)

| Asset | Status | Output |
|-------|--------|--------|
| Field observations (509 points, 5 categories) | **Delivered** | `escooter-observations.geojson` |
| Kallio summer-streets site polygon | **Delivered** | `intervention-locations.geojson` (`KallioSite`) |
| Kallio thesis + summer-streets before PDF | Methodology only | Referenced in `evidence-manifest.json` |
| 20 Bluetooth parking sensors (Tripla/Redi/Kallio/centre) | **Pending** | Described in meeting notes; not delivered |
| Operator geofencing / parking APIs | **Pending** | Not in SharePoint drop |

**KPIs:** 3.1 (primary), 4.2 (sidewalk obstruction), 1.2 (support).

### FVH3 — Viikki intersection (`hel-p3`)

| Asset | Status | Output |
|-------|--------|--------|
| Telraam Koetilantie (2024-06 → 2025-09, ~445 days) | **Delivered** | `telraam-koetilantie.json` (fixed Viikki lat/lng) |
| Viikki UX survey (50 completed responses) | **Delivered** | `viikki-ux-survey.json` — **61.5% overall satisfaction, below ≥75% KPI 4.1 target** |
| Mobilysis gate counts (2024-10-03 AM) | **Delivered** | `mobilysis-viikki-gates.json` |
| HSL tram line 15 day sample (2025-06-09) | **Delivered** | `hsl-tram15-sample.json` (downsampled corridor) |
| Innotrafik alarm-duration charts (5 PNGs) | **Delivered as media** | Paths in `evidence-manifest.json` |
| Viikki intervention point | **Delivered** | `intervention-locations.geojson` (`ViikkiIntersection`) |
| Innotrafik raw alarm-event table | **Pending** | Charts only |
| Lidar OS-1-128 `.pcap` (~647 MB) | **Excluded** | Metadata only (not shipped to browser) |
| Full Mobilysis trajectory CSVs | **Excluded** | Gate aggregates only |
| Formal expansion plan (KPI 1.1 ≥1 plan) | **Pending** | Surfaced as “Data pending” in observatory |

**KPIs:** 1.1 (expansion pending), 1.2 (Telraam), 2.1 (Mobilysis / safety), 4.1 (UX ≥75%), 4.2 (accessibility).

## Map + observatory wiring

| KPI | Map layer | Observatory evidence |
|-----|-----------|----------------------|
| 1.1 | Viikki intervention context | Expansion-plan pending cards |
| 1.2 | Telraam + HSL corridor + Mobilysis gates | Sustainable mode-share cards |
| 2.1 | Dangerous/conflict clouds + Viikki + Mobilysis | Hazard / conflict / VRU counts |
| 3.1 | eScooter category points (Kallio) | Category inventory + sensors pending |
| 3.2 | (citywide survey aggregate) | Safety-attitude % |
| 4.1 | Viikki UX survey marker (colour vs 75%) | Satisfaction % vs target |
| 4.2 | UX marker + eScooter obstruction emphasis | Accessibility challenge % + obstruction flags |

Key files:

- Build: `scripts/build-helsinki-data.mjs`, `scripts/convert-helsinki-geodata.py`
- Parsers: `src/services/localCityData.ts` (`parseHelsinkiRecords`)
- Map: `src/lib/helsinkiMapLayers/*`, `src/components/HeroMap.tsx`
- Observatory: `src/lib/helsinkiObservatoryView.ts`, `src/lib/observatoryGraphicData.ts`
- Profiles: `src/data/helsinkiPilotProfiles.ts`, `src/data/pilotDefinitions.ts`

## Baseline / post readiness

- **Baseline:** Available for FVH1 survey clouds, FVH2 Kallio observations, FVH3 Telraam + Mobilysis + UX.
- **Post-intervention:** Partial — warning system UX is post-install; parking sensors and expansion plan still pending partner delivery.
- **Geometry:** Authoritative GPKG polygons/points reprojected EPSG:3067 → WGS84.

## Rebuild

```bash
npm run build-helsinki-data
```

Requires Python + geopandas for GPKG conversion. Raw SharePoint extracts land under gitignored `public/sharepoint-data/Helsinki/`; browser-safe aggregates commit under `public/data/helsinki/`.
