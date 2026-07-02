# Copenhagen Lighthouse Zip — Full Inventory

**Zip:** `public/Sharepoint_Datasets_06_2026/Copenhagen Lighthouse-20260625T113853Z-3-001.zip`  
**Generated:** 2026-06-30 (`npm run inventory-copenhagen-zip`)  
**Machine-readable:** `docs/COPENHAGEN_ZIP_INVENTORY.json`

---

## Zip totals

| Type | Count |
| --- | --- |
| All files | 171 |
| Excel (`.xlsx`) | 100 |
| CSV | 2 |
| Images | 36 |
| PDFs | 12 |
| Shapefile sidecars | 3 |

---

## Top-level folder structure

| Folder | Files | Website role |
| --- | --- | --- |
| `1. BASELINE Data for Copenhagen/Manual Counts/` | 72 | CPHK1/CPHK3 cross-check; 48 survey positions (`manual_counts_geo.csv`) |
| `1. BASELINE Data for Copenhagen/iRap safety ranking system/` | 42 | CPHK3 KPI 2.1 — star ratings, photos, manual count inputs |
| `1. BASELINE Data for Copenhagen/OpenTrafficCam Counts 2024 and 2025/` | 12 | **Primary map + observatory** (directional pre/post) |
| `1. BASELINE Data for Copenhagen/Telraam/` | 7 | CPHK1 KPI 1.2 relative mode change at 4 streets |
| `1. BASELINE Data for Copenhagen/Technical drawing - Medieval City/` | 8 | CPHK2 KPI 3.1 — parking inventory shapefile + overview xlsx |
| `1. BASELINE Data for Copenhagen/Parking Shapefiles for T5_3 Simulation/` | 7 | Simulation context (PDFs/zips), not dashboard-critical |
| `2. POST IMPLEMENTATION Data from Copenhagen/` | 2 | CPHK1 KPI 4.1 acceptability + CPHK3 safety perception surveys |
| Root docs (`.docx`, `.pdf`) | 6 | Observatory narrative / methodology only |

---

## Street segments / directions to visualize (from OTC `flow` column)

These are **camera-directional arms**, not OSM corridor IDs. Each unique `flow` value becomes one clickable direction on the map and one arm in the camera corridor schematic.

### Wired today (4 `*_sortet.xlsx` — extracted + parsed)

| Workbook site | Flow labels in Excel | Count | Pilot(s) |
| --- | --- | --- | --- |
| **Gammeltorv / Vestergade** | `Gammeltorv north`, `Gammeltorv south`, `Vestergade east`, `Vestergade west` | **4** | cph-p3 |
| **Norreport** | `Norregade north`, `Norregade south` | 2 | cph-p1, cph-p3 |
| **Vandkunsten** | `Radhuusstraede North --> Radhuusstraede South`, `Radhuusstraede South --> Radhuusstraede North` | 2 | cph-p2, cph-p3 |
| **Stormgade** | `Frederiksholmskanal South`, `Frederiksholmskanal north`, `Stormgade east`, `Stormgade west` | **4** | cph-p3 |

**Total parsed directions when xlsx is live:** 12 (not 8 as in the bundled JSON fallback).

### In zip but not extracted yet

| File | Flows | Notes |
| --- | --- | --- |
| `Countings_Hojbro.xlsx` | `Hojbro north`, `Hojbro south` | Matches intelligent camera at Vindebrogade/Højbro; CPHK3 scope |

### Classifications (all OTC data sheets)

18 modes including `pedestrian`, `bicyclist`, `car`, `cargo_bike_driver`, `delivery_van`, `motorcyclist`, `scooter_driver`, etc. Parser rolls these into mobility / safety / environment KPI buckets.

---

## Observatory graphs (what the website renders)

Copenhagen uses **camera** observatory type (`SegmentIntelligencePanel`).

| Tab zone | KPI 1.2 | KPI 2.1 | KPI 3.2 |
| --- | --- | --- | --- |
| Header | `CameraCorridorSchematic` | same | same |
| Overview | `directionModeBreakdown` | `flowPressure` | `motorIntensity` |
| Before/After | `prePostTrend` + mode share | `flowPressure` | `motorIntensity` |
| KPI Analysis | direction list + deltas | `flowPressure` | `motorIntensity` |
| Methodology | Maria Risom rules per workbook | same | same |

**Data source today:** OTC `Data_*_Pre` / `Data_*_Post` sheets only.

---

## File-by-file guide — what helps with what

### A. OpenTrafficCam (highest priority — **integrated**)

| File | Sheets | Use on website |
| --- | --- | --- |
| `Countings_*_sortet.xlsx` (4 files) | `Overview`, `Data_*_Pre`, `Data_*_Post`, pivots | Map direction points, observatory pre/post charts, KPI 1.2/2.1/3.2 |
| `Countings_*.xlsx` (unsorted, 5 sites incl. Hojbro) | Same pattern | Backup; prefer `*_sortet` |
| `Marias Comparison/OTC Combined counts ELABORATOR.xlsx` | `Norreport Noerregade`, `Comparison Noerreport`, `Comparison Vandkunsten`, `Stormgade`, `Gammeltorv` | Partner QA / headline % — **do not parse** (loses direction granularity) |
| `Marias Comparison/ELABORATOR Counts OTC combined * to WP7.xlsx` | Aggregated | WP7 deliverable only |
| `cph_otc_surveysites.xlsx` | `in` (10 camera rows) | Validates `copenhagenLocationRegistry` intelligent camera list |

**Extract:** `npm run extract-sharepoint` → `public/sharepoint-data/Copenhagen/OpenTrafficCam Counts 2024 and 2025/`

### B. Geo reference CSVs (**ready to import**)

| File | Rows | Columns | Use |
| --- | --- | --- | --- |
| `manual_counts_geo.csv` | 48 | `position`, `lat`, `lon` | Manual survey site layer (toggle); aligns with registry |
| `platomo_geo.csv` | 6 | `position`, `lat`, `lon` | Platomo / flow camera positions |

### C. Telraam — CPHK1 (**next parser**)

| File | Sheets | Use |
| --- | --- | --- |
| `Telraam counts Medieval City Copenhagen 2024 and 2025.xlsx` | `Vognmagergade`, `Vestergade`, `Rosenborggade`, `Studiestræde` | Headline relative % change (e.g. Vestergade −16% cars) |
| `* SHEET.xlsx` (4 streets) | `raw data`, `typical data`, `process_EN`, `fiche_EN` | Hourly time series: ped/bike/car by direction, speed bins, segment id |

**Suggested charts:** `telraamModeBars` on KPI 1.2; counter markers on map at 4 Telraam sites.

### D. Manual counts — CPHK1 / CPHK3 (**next parser**)

| Pattern | Count | Use |
| --- | --- | --- |
| `Manual Counts/Manual counts 2023 Medeival City/*.xlsx` | ~50 | Baseline 2023 per-street counts |
| `Manual Counts/Manual Counts 2025 Medieval City/*.xlsx` | ~15 | Post / follow-up counts |
| `Medieval City manual counts traffic_2023_uploaded to ELABORATOR.xlsx` | `Område A-C` | District aggregate summary |
| `Middelalderbyen_trafik_ind_2023_rettet_20250402.xlsx` | `Område A-C`, `Andre tællesteder`, `Kort` | Traffic into Medieval City zones |

**Suggested charts:** `manualCountBars` at survey sites; methodology cross-check vs OTC.

### E. Surveys — KPI 4.1 / safety perception

| File | Rows | Use |
| --- | --- | --- |
| `Acceptability_Intervention1_BEFORE.xlsx` | ~1,358 | CPHK1 baseline acceptability |
| `Acceptability_Intervention1_AFTER.xlsx` | ~1,295 | CPHK1 post acceptability → `sentimentGauge` / likert |
| `Before_After_changes_traffic_safety.xlsx` | ~1,332 | CPHK3 perceived safety change |

### F. CPHK2 — Bicycle parking / infrastructure

| File | Sheets | Use |
| --- | --- | --- |
| `I100275_P-pladser_Oversigt.xlsx` | `Opslagsværk`, `Eksisterende forhold`, `Udbud`, `Udført`, `Formler` | Parking bay inventory → KPI 3.1 `facilityInventory` |
| `I100275_P-pladser_udført.shp` (+ sidecars) | Polygon/point geometry | Map layer for repurposed parking |
| `Tube count bicyclist Medieval City April 2024.xlsx` | `Ark1` | Avg daily bike traffic + speed by road |
| iRap folder photos (`.jpg`, `.png`) | — | Infrastructure evidence gallery |

### G. CPHK3 — Safety / iRAP

| File | Use |
| --- | --- |
| `iRap safety ranking system/Manual counts/iRap safety ranking Counts in 2024 and 2025 CPH.xlsx` | Star rating inputs |
| `iRap safety ranking system/Manual counts/*.xlsx` | Site-specific safety counts |
| Before/after intervention photos | Qualitative methodology tab |
| `.msg` / `.docx` assessment forms | Metadata only |

### H. Narrative / partner docs (no parser)

| File | Use |
| --- | --- |
| `Copenhagen Intervention Evaluation Plan_29052025.docx` | Pilot registry text |
| `KPI table_Baseline & Endline Data_CPH LL .docx` | Dataset ↔ KPI mapping |
| `Evaluering af omlægningen…februar 2026.pdf` | Expected outcomes narrative |
| `Marias_ELABORATOR Notes…docx` | Methodology caveats |

---

## Commands

```bash
# Extract dashboard-critical OTC workbooks (+ other cities)
npm run extract-sharepoint

# Regenerate this inventory (sheet names, OTC flows, key file headers)
npm run inventory-copenhagen-zip
```

After extract, restart `npm run dev` so parsers load from `/sharepoint-data/...`.

---

## Implementation status vs zip

| Dataset | In zip | Extracted | Parsed | Observatory graphic |
| --- | --- | --- | --- | --- |
| OTC `*_sortet.xlsx` | Yes | Yes | Yes | Camera schematic, direction breakdown, pre/post |
| OTC Hojbro | Yes | Yes | Yes | Camera schematic |
| Telraam | Yes | Yes | Yes | telraamModeBars |
| Manual counts 2025 + geo | Yes | Yes | Yes | manualCountBars |
| Manual zones 2023 | Yes | Yes | Yes | Zone aggregates in manualCountBars (2023→2025) |
| Surveys | Yes | Yes | Yes | sentimentGauge / likertRadar |
| Bike parking xlsx/shp | Yes | Yes | Yes | facilityInventory + WGS84 polygons on map |
| Accessibility proxy (I100275) | Yes | Yes | Yes (cph-p2) | accessibilityBars (derived) |
| Platomo flow cameras | Yes | Yes | Yes | Flow camera markers on kpi1.2 |
| Tube counts | Yes | Yes | Yes | Speed stat cards (cph-p3 kpi2.1) |
| iRAP | Yes | Yes | Yes | flowPressure / safety density |
| Partner photos / PDFs | Yes | Yes | Narrative panel | CopenhagenEvidencePanel |
| Travel / car-user surveys | PDF only | Partial | narrative-only | evidence-manifest |
| Near encounters / interviews | No xlsx | — | narrative-only | evidence-manifest |

---

## Key finding: Gammeltorv matches partner diagram

Real `Countings_Gammeltorv_sortet.xlsx` contains **four** flows:

- Gammeltorv north / south  
- Vestergade east / west  

This matches the partner camera-direction diagram (red triangle + four arrows). The bundled fallback JSON only includes two Vestergade flows — **use extracted xlsx in dev/prod** for full four-arm schematic.
