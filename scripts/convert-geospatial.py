#!/usr/bin/env python3
"""Convert SharePoint geospatial assets to GeoJSON for browser use."""
import json
import sys
import tempfile
import zipfile
from pathlib import Path

import geopandas as gpd
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
SP = ROOT / "public" / "sharepoint-data"


def convert_zaragoza_centroids() -> int:
    zar_dir = SP / "Zaragoza/1. BASELINE DATA from Zaragoza/Intervention areas 1"
    if not zar_dir.exists():
        print("SKIP Zaragoza shapefiles (directory missing)")
        return 0
    features = []
    for shp in sorted(zar_dir.glob("*.shp")):
        gdf = gpd.read_file(shp)
        if gdf.crs and gdf.crs.to_epsg() != 4326:
            gdf = gdf.to_crs(4326)
        cent = gdf.geometry.unary_union.centroid
        features.append(
            {
                "type": "Feature",
                "properties": {"id": shp.stem, "name": shp.stem},
                "geometry": {"type": "Point", "coordinates": [cent.x, cent.y]},
            }
        )
    out = SP / "Zaragoza/intervention-areas-centroids.geojson"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(
        json.dumps({"type": "FeatureCollection", "features": features}, indent=2),
        encoding="utf-8",
    )
    print(f"OK Zaragoza centroids: {len(features)} -> {out.relative_to(ROOT)}")
    return len(features)


def convert_helsinki_dangerous() -> int:
    gpkg = SP / "Helsinki/DangerousLocationsSurvey_ENG_EPSG3067.gpkg"
    if not gpkg.exists():
        print("SKIP Helsinki dangerous locations gpkg (missing)")
        return 0
    gdf = gpd.read_file(gpkg, layer="DangerousLocations_hki")
    if gdf.crs and gdf.crs.to_epsg() != 4326:
        gdf = gdf.to_crs(4326)
    out = SP / "Helsinki/dangerous-locations.geojson"
    gdf.to_file(out, driver="GeoJSON")
    print(f"OK Helsinki dangerous locations: {len(gdf)} -> {out.relative_to(ROOT)}")
    return len(gdf)


def convert_helsinki_escooter() -> int:
    esc = SP / "Helsinki/Helsinki_eScooter_Observations.zip"
    if not esc.exists():
        print("SKIP Helsinki eScooter zip (missing)")
        return 0
    with tempfile.TemporaryDirectory() as td:
        with zipfile.ZipFile(esc) as zf:
            zf.extractall(td)
        frames = []
        for g in Path(td).rglob("*.gpkg"):
            df = gpd.read_file(g)
            if df.crs and df.crs.to_epsg() != 4326:
                df = df.to_crs(4326)
            frames.append(df)
        if not frames:
            print("SKIP Helsinki eScooter (no gpkg inside zip)")
            return 0
        merged = gpd.GeoDataFrame(pd.concat(frames, ignore_index=True), crs=frames[0].crs)
        out = SP / "Helsinki/escooter-observations.geojson"
        merged.to_file(out, driver="GeoJSON")
        print(f"OK Helsinki eScooter: {len(merged)} -> {out.relative_to(ROOT)}")
        return len(merged)


def main() -> int:
    if not SP.exists():
        print("Missing public/sharepoint-data/. Run: npm run extract-sharepoint", file=sys.stderr)
        return 1
    convert_zaragoza_centroids()
    convert_helsinki_dangerous()
    convert_helsinki_escooter()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
