#!/usr/bin/env python3
"""Convert Helsinki SharePoint geospatial assets (gpkg + geoparquet) into
committed GeoJSON/JSON under public/data/helsinki/.

Run via `npm run build-helsinki-data` (invoked from scripts/build-helsinki-data.mjs)
or directly: `python scripts/convert-helsinki-geodata.py`.
"""
import json
import sys
from pathlib import Path

import geopandas as gpd
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
SP = ROOT / "public" / "sharepoint-data" / "Helsinki"
OUT = ROOT / "public" / "data" / "helsinki"


def to_wgs84(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """Reproject to EPSG:4326, respecting each layer's own (possibly already-4326) CRS."""
    if gdf.crs is None:
        return gdf
    if gdf.crs.to_epsg() != 4326:
        return gdf.to_crs(4326)
    return gdf


def write_geojson(gdf: gpd.GeoDataFrame, out_path: Path, drop_cols: list[str] | None = None) -> int:
    gdf = gdf.copy()
    for col in drop_cols or []:
        if col in gdf.columns:
            gdf = gdf.drop(columns=[col])
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(gdf.to_json(drop_id=True), encoding="utf-8")
    return len(gdf)


def convert_intervention_locations() -> int:
    gpkg = SP / "Helsinki_Intervention_Locations_EPSG3067.gpkg"
    if not gpkg.exists():
        print("SKIP intervention locations gpkg (missing)")
        return 0
    features = []
    layer_labels = {
        "HelsinkiArea": "Helsinki city-wide FVH1 survey area",
        "KallioSite": "Kallio summer-streets observation site (FVH2)",
        "ViikkiIntersection": "Viikintie-Koetilantie tramway crossing (FVH3)",
    }
    pilot_ids = {"HelsinkiArea": "hel-p1", "KallioSite": "hel-p2", "ViikkiIntersection": "hel-p3"}
    for layer in ("HelsinkiArea", "KallioSite", "ViikkiIntersection"):
        gdf = gpd.read_file(gpkg, layer=layer)
        gdf = to_wgs84(gdf)
        gdf["layer"] = layer
        gdf["name"] = layer_labels[layer]
        gdf["pilotId"] = pilot_ids[layer]
        gdf["source"] = "fvh_registry"
        features.append(gdf)
    merged = gpd.GeoDataFrame(pd.concat(features, ignore_index=True), crs="EPSG:4326")
    out = OUT / "intervention-locations.geojson"
    n = write_geojson(merged, out)
    print(f"OK intervention-locations: {n} -> {out.relative_to(ROOT)}")
    return n


INCIDENT_MODE_COL = "What mode of travel were you using? (Mandatory question)"
INCIDENT_TYPE_COL = "Type of incident? (Mandatory question)"
INCIDENT_EVENT_COL = "Which of the following options best describes the event? (Mandatory question)"
INCIDENT_LOCATION_COL = "Where did the incident occur? (Mandatory question)"
DANGER_LOCATION_TYPE_COL = "Please choose the option that best describes this location"
DANGER_GROUP_COL = "Which group does the location pose the greatest danger to?"


def convert_conflicts() -> int:
    gpkg = SP / "DangerousLocationsSurvey_ENG_EPSG3067.gpkg"
    if not gpkg.exists():
        print("SKIP conflicts gpkg (missing)")
        return 0
    gdf = gpd.read_file(gpkg, layer="Conflicts_hki")
    gdf = to_wgs84(gdf)
    keep = gdf[["Submitted", INCIDENT_TYPE_COL, INCIDENT_MODE_COL, INCIDENT_EVENT_COL, INCIDENT_LOCATION_COL, "geometry"]].copy()
    keep = keep.rename(
        columns={
            INCIDENT_TYPE_COL: "incidentType",
            INCIDENT_MODE_COL: "travelMode",
            INCIDENT_EVENT_COL: "eventDescription",
            INCIDENT_LOCATION_COL: "locationDescription",
            "Submitted": "submitted",
        }
    )
    keep["layer"] = "Conflicts_hki"
    keep["status"] = "reported_conflict"
    out = OUT / "conflicts.geojson"
    n = write_geojson(keep, out)
    print(f"OK conflicts: {n} -> {out.relative_to(ROOT)}")
    return n


def convert_dangerous_locations() -> int:
    gpkg = SP / "DangerousLocationsSurvey_ENG_EPSG3067.gpkg"
    if not gpkg.exists():
        print("SKIP dangerous locations gpkg (missing)")
        return 0
    gdf = gpd.read_file(gpkg, layer="DangerousLocations_hki")
    gdf = to_wgs84(gdf)
    keep = gdf[["Submitted", DANGER_LOCATION_TYPE_COL, DANGER_GROUP_COL, "geometry"]].copy()
    keep = keep.rename(
        columns={
            DANGER_LOCATION_TYPE_COL: "locationType",
            DANGER_GROUP_COL: "greatestDangerTo",
            "Submitted": "submitted",
        }
    )
    keep["layer"] = "DangerousLocations_hki"
    keep["status"] = "active_hazard"
    out = OUT / "dangerous-locations.geojson"
    n = write_geojson(keep, out)
    print(f"OK dangerous-locations: {n} -> {out.relative_to(ROOT)}")
    return n


ESCOOTER_CATEGORIES = {
    "eScooterOnPavement.gpkg": "on_pavement",
    "eScooterOnStreet.gpkg": "on_street",
    "eScooterOnCycleway.gpkg": "on_cycleway",
    "eScooterParkedOutsideParkingzone.gpkg": "outside_parking_zone",
    "Bike_not_in_racks.gpkg": "bike_not_in_racks",
}

# NB: source GPKG attribute names have mangled Finnish diacritics (GDAL encoding
# quirk turns ä/ö into "A"), e.g. "SAhkApotkulautojen mAArA" = "Sähköpotkulautojen määrä".
# Matched by exact string since the corruption is consistent across files.
ESCOOTER_COUNT_COL_CANDIDATES = [
    "SAhkApotkulautojen mAArA",
    "PyArien mAArA",
]
ESCOOTER_HAZARD_COL_CANDIDATES = [
    "PysAkAinti aiheutti vaaraa muille liikkujille",
    "PyArApysAkAinnistA aiheutui vaaraa muille liikkujille",
]
ESCOOTER_OBSTRUCTION_COL_CANDIDATES = [
    "PysAkAinti aiheutui haittaa muille liikkujille",
    "PyArApysAkAinnistA aiheutui haittaa muille liikkujille",
]


def _first_present(row_cols: list[str], candidates: list[str]) -> str | None:
    for c in candidates:
        if c in row_cols:
            return c
    return None


def convert_escooter_observations() -> int:
    esc_dir = SP / "escooter-src"
    if not esc_dir.exists():
        print("SKIP eScooter gpkgs (missing extract dir)")
        return 0
    frames = []
    for filename, category in ESCOOTER_CATEGORIES.items():
        path = esc_dir / filename
        if not path.exists():
            continue
        gdf = gpd.read_file(path)
        gdf = to_wgs84(gdf)
        cols = gdf.columns.tolist()
        count_col = _first_present(cols, ESCOOTER_COUNT_COL_CANDIDATES)
        hazard_col = _first_present(cols, ESCOOTER_HAZARD_COL_CANDIDATES)
        obstruction_col = _first_present(cols, ESCOOTER_OBSTRUCTION_COL_CANDIDATES)
        out_df = pd.DataFrame(
            {
                "category": category,
                "vehicleCount": pd.to_numeric(gdf[count_col], errors="coerce") if count_col else None,
                "obstructsOthers": gdf[obstruction_col].astype(str) if obstruction_col else None,
                "hazardToOthers": gdf[hazard_col].astype(str) if hazard_col else None,
                "submittedAt": gdf["Submitted Time"].astype(str) if "Submitted Time" in cols else None,
            }
        )
        out_gdf = gpd.GeoDataFrame(out_df, geometry=gdf.geometry.values, crs=gdf.crs)
        frames.append(out_gdf)
    if not frames:
        print("SKIP eScooter (no source gpkgs found)")
        return 0
    merged = gpd.GeoDataFrame(pd.concat(frames, ignore_index=True), crs="EPSG:4326")
    out = OUT / "escooter-observations.geojson"
    n = write_geojson(merged, out)
    print(f"OK escooter-observations: {n} -> {out.relative_to(ROOT)}")
    return n


def convert_hsl_tram_sample() -> int:
    parquet = SP / "hsl-tram15-2025-06-09.geoparquet"
    if not parquet.exists():
        print("SKIP HSL tram geoparquet (missing)")
        return 0
    gdf = gpd.read_parquet(parquet)
    if gdf.crs and gdf.crs.to_epsg() != 4326:
        gdf = gdf.to_crs(4326)
    gdf["ts"] = pd.to_datetime(gdf["ts"], utc=True)
    gdf["hour"] = gdf["ts"].dt.hour

    hourly = (
        gdf.groupby("hour")
        .agg(pings=("ts", "count"), vehicles=("veh", "nunique"))
        .reset_index()
        .to_dict(orient="records")
    )

    # Pick the single longest journey (by point count) as a representative corridor sample.
    journey_sizes = gdf.groupby(["veh", "jrn"]).size().sort_values(ascending=False)
    veh_id, jrn_id = journey_sizes.index[0]
    journey = gdf[(gdf["veh"] == veh_id) & (gdf["jrn"] == jrn_id)].sort_values("ts")
    step = max(1, len(journey) // 200)
    sampled = journey.iloc[::step]
    corridor = [[round(float(pt.x), 6), round(float(pt.y), 6)] for pt in sampled.geometry]

    payload = {
        "line": "15",
        "sampleDate": "2025-06-09",
        "source": "HSL real-time API vehicle positions (README HSL data.docx)",
        "totalPings": int(len(gdf)),
        "vehicleCount": int(gdf["veh"].nunique()),
        "hourlyPresence": hourly,
        "corridorSample": {
            "type": "Feature",
            "properties": {"vehicleId": int(veh_id), "journeyId": int(jrn_id), "pointCount": len(corridor)},
            "geometry": {"type": "LineString", "coordinates": corridor},
        },
        "note": "Downsampled from one full day of tram line 15 position pings; full geoparquet (~30MB) stays in public/sharepoint-data/Helsinki, not shipped to the client bundle.",
    }
    out = OUT / "hsl-tram15-sample.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"OK hsl-tram15-sample: {len(hourly)} hourly buckets, {len(corridor)} corridor pts -> {out.relative_to(ROOT)}")
    return len(hourly)


def main() -> int:
    if not SP.exists():
        print("Missing public/sharepoint-data/Helsinki/. Run build-helsinki-data first.", file=sys.stderr)
        return 1
    OUT.mkdir(parents=True, exist_ok=True)
    convert_intervention_locations()
    convert_conflicts()
    convert_dangerous_locations()
    convert_escooter_observations()
    convert_hsl_tram_sample()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
