# SharePoint Data Setup

For integration maturity, KPI mapping, drop pipeline status, and per-pilot intervention geometry, see **Data Catalogue → SharePoint June 2026** at `/data-catalogue#sharepoint-integration` and `/data-catalogue#intervention-geometry`.

The June 2026 SharePoint drop (~4.2 GB, 11 city archives) is **not committed to Git**. Dashboard parsers read a local mirror under `public/sharepoint-data/` (gitignored).

## Local development

1. Place the zip archives in `public/Sharepoint_Datasets_06_2026/` (already present if you received the drop).
2. Extract dashboard-critical files:

   ```bash
   npm run extract-sharepoint
   ```

3. Convert geospatial assets to browser-readable GeoJSON (requires Python + geopandas):

   ```bash
   pip install geopandas
   npm run convert-helsinki-gpkg
   ```

4. Restart the dev server:

   ```bash
   npm run dev
   ```

5. Verify health in **Data Catalogue → Workflow health** — the SharePoint manifest check should report extracted files with zero errors.

## What gets extracted

| City | Key files | Parser |
|------|-----------|--------|
| Copenhagen | 4× `Countings_*_sortet.xlsx` | `localCityData.ts` → fallback JSON if mirror missing |
| Helsinki | Telraam xlsx, dangerous-locations + eScooter GeoJSON | `localCityData.ts` + `helsinkiGeoLayers.ts` |
| Issy | ISSY1 baseline/post CSV (optional mirror) | `issyFlowData.ts` (bundled CSV fallback) |
| Zaragoza | KPI1.2 workbooks, manual counting, intervention centroids | `parseZaragozaRecords` |
| Trikala | Smart-crossing + women mobility surveys | `parseTrikalaRecords` |
| Milan | Not in June drop — separate SharePoint tree | `milanSegmentData.ts` |

Manifest written to: `public/sharepoint-data/_manifest.json`

## Production hosting

Because `public/sharepoint-data/` is gitignored:

- **Render / static host**: upload the extracted tree to the same origin under `/sharepoint-data/`, or attach a persistent disk and run `extract-sharepoint` on deploy when zips are available on the build server.
- **CI**: optional extract step if archives are stored outside Git (S3, artifact store).
- **Health**: the app probes `_manifest.json` and per-city sample files via `useWorkflowHealth`.

## Copenhagen demo without extraction

If SharePoint files are unavailable, Copenhagen KPI 1.2 still renders from the bundled fallback:

`public/data/copenhagen/otc-directional-observed.json`

## Notes

- Zaragoza KPI1.2 workbooks may contain template `(value)` placeholders; the parser uses June 2025 manual motor-vehicle counts until real hourly data is entered.
- Trikala surveys have no reliable coordinates in the inventory — KPI values aggregate at the pilot anchor with `geometryQuality: inferred`.
- Helsinki Telraam exports lack lat/lng columns; segment points use approximate cluster layout unless GeoJSON layers are shown for pilots 1–2.
