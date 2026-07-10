#!/usr/bin/env python3
"""Prepare deployable geodata assets from SharePoint zip drops.

Stdlib only: sqlite3 + struct + zipfile + csv + json + math.
Outputs are written to public/data (committed/deployable), not sharepoint-data.
"""

from __future__ import annotations

import csv
import io
import json
import math
import sqlite3
import struct
import sys
import tempfile
import zipfile
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
DROP_DIR = REPO_ROOT / "public" / "Sharepoint_Datasets_06_2026"
OUT_DIR = REPO_ROOT / "public" / "data"


def _log(msg: str) -> None:
    print(msg)


def _fail(msg: str) -> None:
    raise RuntimeError(msg)


def _find_zip(pattern: str) -> Path:
    for p in sorted(DROP_DIR.glob("*.zip")):
        if pattern.lower() in p.name.lower():
            return p
    _fail(f"Missing source zip containing '{pattern}' in {DROP_DIR}")
    return Path()


def _normalize_header(value: str) -> str:
    return (
        value.strip()
        .lower()
        .replace("æ", "ae")
        .replace("ø", "oe")
        .replace("å", "aa")
        .replace("ä", "a")
        .replace("ö", "o")
        .replace("ü", "u")
        .replace("-", "_")
        .replace(" ", "_")
    )


def _sniff_csv(text: str) -> tuple[list[str], list[dict[str, str]]]:
    if not text.strip():
        return [], []
    sample = text[:4096]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;|\t")
    except csv.Error:
        # Default to semicolon first; many EU exports use this.
        dialect = csv.excel
        dialect.delimiter = ";"
    reader = csv.DictReader(io.StringIO(text), dialect=dialect)
    rows = [dict(r) for r in reader]
    return list(reader.fieldnames or []), rows


def _floatish(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, (float, int)):
        if math.isfinite(float(value)):
            return float(value)
        return None
    s = str(value).strip()
    if not s:
        return None
    # Keep only numeric-ish characters and decimal separators.
    s = "".join(ch for ch in s if ch.isdigit() or ch in ".,-+")
    if s.count(",") == 1 and s.count(".") == 0:
        s = s.replace(",", ".")
    elif s.count(",") > 1 and s.count(".") == 0:
        s = s.replace(",", "")
    elif s.count(",") >= 1 and s.count(".") >= 1:
        # If both appear, assume commas are thousand separators.
        s = s.replace(",", "")
    try:
        n = float(s)
    except ValueError:
        return None
    return n if math.isfinite(n) else None


def tm_inverse(
    x: float,
    y: float,
    lon_0_deg: float,
    k_0: float,
    x_0: float,
    y_0: float,
    a: float,
    f: float,
) -> tuple[float, float]:
    """Inverse Transverse Mercator -> WGS84 lon/lat (degrees)."""

    e2 = f * (2.0 - f)
    ep2 = e2 / (1.0 - e2)
    x_prime = x - x_0
    y_prime = y - y_0

    m = y_prime / k_0
    mu = m / (a * (1.0 - e2 / 4.0 - 3.0 * e2 * e2 / 64.0 - 5.0 * e2**3 / 256.0))

    e1 = (1.0 - math.sqrt(1.0 - e2)) / (1.0 + math.sqrt(1.0 - e2))
    j1 = 3.0 * e1 / 2.0 - 27.0 * e1**3 / 32.0
    j2 = 21.0 * e1**2 / 16.0 - 55.0 * e1**4 / 32.0
    j3 = 151.0 * e1**3 / 96.0
    j4 = 1097.0 * e1**4 / 512.0
    fp = mu + j1 * math.sin(2.0 * mu) + j2 * math.sin(4.0 * mu) + j3 * math.sin(6.0 * mu) + j4 * math.sin(8.0 * mu)

    sin_fp = math.sin(fp)
    cos_fp = math.cos(fp)
    tan_fp = math.tan(fp)

    c1 = ep2 * cos_fp * cos_fp
    t1 = tan_fp * tan_fp
    n1 = a / math.sqrt(1.0 - e2 * sin_fp * sin_fp)
    r1 = a * (1.0 - e2) / ((1.0 - e2 * sin_fp * sin_fp) ** 1.5)
    d = x_prime / (n1 * k_0)

    lat = fp - (n1 * tan_fp / r1) * (
        d * d / 2.0
        - (5.0 + 3.0 * t1 + 10.0 * c1 - 4.0 * c1 * c1 - 9.0 * ep2) * d**4 / 24.0
        + (61.0 + 90.0 * t1 + 298.0 * c1 + 45.0 * t1 * t1 - 252.0 * ep2 - 3.0 * c1 * c1) * d**6 / 720.0
    )
    lon0 = math.radians(lon_0_deg)
    lon = lon0 + (
        d
        - (1.0 + 2.0 * t1 + c1) * d**3 / 6.0
        + (5.0 - 2.0 * c1 + 28.0 * t1 - 3.0 * c1 * c1 + 8.0 * ep2 + 24.0 * t1 * t1) * d**5 / 120.0
    ) / cos_fp

    return math.degrees(lon), math.degrees(lat)


def reproject_epsg3067_to_wgs84(x: float, y: float) -> tuple[float, float]:
    # ETRS89 / TM35FIN (EPSG:3067)
    return tm_inverse(
        x=x,
        y=y,
        lon_0_deg=27.0,
        k_0=0.9996,
        x_0=500000.0,
        y_0=0.0,
        a=6378137.0,
        f=1.0 / 298.257222101,
    )


def reproject_utm30n_to_wgs84(x: float, y: float) -> tuple[float, float]:
    # UTM Zone 30N on WGS84-like ellipsoid assumptions for AYZG1 conversion.
    return tm_inverse(
        x=x,
        y=y,
        lon_0_deg=-3.0,
        k_0=0.9996,
        x_0=500000.0,
        y_0=0.0,
        a=6378137.0,
        f=1.0 / 298.257223563,
    )


def _read_coord_pair(data: bytes, offset: int, endian: str, extra_dims: int) -> tuple[list[float], int]:
    x, y = struct.unpack_from(endian + "dd", data, offset)
    offset += 16
    # Skip Z/M values if present.
    if extra_dims:
        offset += 8 * extra_dims
    return [x, y], offset


def _decode_wkb(data: bytes, offset: int = 0) -> tuple[dict[str, Any] | None, int]:
    if offset + 5 > len(data):
        return None, offset
    byte_order = data[offset]
    endian = "<" if byte_order == 1 else ">"
    offset += 1
    gtype = struct.unpack_from(endian + "I", data, offset)[0]
    offset += 4

    base = gtype % 1000
    dim_block = gtype // 1000
    extra_dims = 0
    if dim_block in (1, 2):
        extra_dims = 1
    elif dim_block in (3,):
        extra_dims = 2

    if base == 1:  # Point
        coords, offset = _read_coord_pair(data, offset, endian, extra_dims)
        return {"type": "Point", "coordinates": coords}, offset

    if base == 3:  # Polygon
        if offset + 4 > len(data):
            return None, offset
        num_rings = struct.unpack_from(endian + "I", data, offset)[0]
        offset += 4
        rings: list[list[list[float]]] = []
        for _ in range(num_rings):
            if offset + 4 > len(data):
                break
            num_pts = struct.unpack_from(endian + "I", data, offset)[0]
            offset += 4
            ring: list[list[float]] = []
            for _ in range(num_pts):
                if offset + 16 > len(data):
                    break
                pt, offset = _read_coord_pair(data, offset, endian, extra_dims)
                ring.append(pt)
            if ring:
                rings.append(ring)
        return {"type": "Polygon", "coordinates": rings}, offset

    if base == 6:  # MultiPolygon
        if offset + 4 > len(data):
            return None, offset
        num_polys = struct.unpack_from(endian + "I", data, offset)[0]
        offset += 4
        polys: list[list[list[list[float]]]] = []
        for _ in range(num_polys):
            geom, offset = _decode_wkb(data, offset)
            if geom and geom.get("type") == "Polygon":
                polys.append(geom["coordinates"])
        return {"type": "MultiPolygon", "coordinates": polys}, offset

    # Unsupported geometry; fail gracefully.
    return None, offset


def parse_gpkg_geom(blob: bytes) -> dict[str, Any] | None:
    """Decode GeoPackageBinary blob to a GeoJSON-like geometry dict."""
    if not blob or len(blob) < 8 or blob[0:2] != b"GP":
        return None
    flags = blob[3]
    is_empty = bool(flags & 0b00010000)
    if is_empty:
        return None
    envelope_code = (flags & 0b00001110) >> 1
    envelope_bytes = {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}.get(envelope_code, 0)
    wkb_offset = 8 + envelope_bytes
    geom, _ = _decode_wkb(blob, wkb_offset)
    return geom


def _reproject_geometry(
    geom: dict[str, Any],
    reproj_fn: Any | None,
) -> dict[str, Any]:
    if reproj_fn is None:
        return geom

    gtype = geom.get("type")
    if gtype == "Point":
        x, y = geom["coordinates"]
        lon, lat = reproj_fn(float(x), float(y))
        return {"type": "Point", "coordinates": [lon, lat]}
    if gtype == "Polygon":
        new_rings: list[list[list[float]]] = []
        for ring in geom.get("coordinates", []):
            new_ring: list[list[float]] = []
            for x, y in ring:
                lon, lat = reproj_fn(float(x), float(y))
                new_ring.append([lon, lat])
            if new_ring:
                new_rings.append(new_ring)
        return {"type": "Polygon", "coordinates": new_rings}
    if gtype == "MultiPolygon":
        new_polys: list[list[list[list[float]]]] = []
        for poly in geom.get("coordinates", []):
            new_poly: list[list[list[float]]] = []
            for ring in poly:
                new_ring: list[list[float]] = []
                for x, y in ring:
                    lon, lat = reproj_fn(float(x), float(y))
                    new_ring.append([lon, lat])
                if new_ring:
                    new_poly.append(new_ring)
            if new_poly:
                new_polys.append(new_poly)
        return {"type": "MultiPolygon", "coordinates": new_polys}
    return geom


def parse_shp_polygons(path: Path, reproj_fn: Any | None) -> list[dict[str, Any]]:
    """Parse Polygon* records from a .shp stream."""
    feats: list[dict[str, Any]] = []
    with path.open("rb") as fh:
        header = fh.read(100)
        if len(header) < 100:
            return feats
        file_code = struct.unpack(">I", header[0:4])[0]
        if file_code != 9994:
            _fail(f"Invalid shapefile header: {path}")

        while True:
            rec_header = fh.read(8)
            if len(rec_header) < 8:
                break
            _rec_no, content_words = struct.unpack(">II", rec_header)
            content = fh.read(content_words * 2)
            if len(content) < 4:
                continue
            shape_type = struct.unpack_from("<I", content, 0)[0]
            if shape_type == 0:
                continue
            # Polygon/PolygonZ/PolygonM
            if shape_type not in (5, 15, 25):
                continue
            if len(content) < 44:
                continue
            num_parts, num_points = struct.unpack_from("<II", content, 36)
            parts_offset = 44
            points_offset = parts_offset + 4 * num_parts
            if len(content) < points_offset + 16 * num_points:
                continue
            parts = list(struct.unpack_from("<" + "I" * num_parts, content, parts_offset))
            parts.append(num_points)
            points: list[list[float]] = []
            cursor = points_offset
            for _ in range(num_points):
                x, y = struct.unpack_from("<dd", content, cursor)
                cursor += 16
                if reproj_fn:
                    lon, lat = reproj_fn(x, y)
                    points.append([lon, lat])
                else:
                    points.append([x, y])
            rings: list[list[list[float]]] = []
            for i in range(num_parts):
                start = parts[i]
                end = parts[i + 1]
                ring = points[start:end]
                if ring:
                    rings.append(ring)
            if rings:
                feats.append({"type": "Polygon", "coordinates": rings})
    return feats


def _write_feature_collection(path: Path, features: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {"type": "FeatureCollection", "features": features}
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def build_copenhagen(cph_zip: Path) -> Path:
    _log("Building Copenhagen count sites…")
    features: list[dict[str, Any]] = []
    with zipfile.ZipFile(cph_zip, "r") as zf:
        members = zf.namelist()
        platomo_member = next((m for m in members if "platomo_geo" in m.lower() and m.lower().endswith(".csv")), None)
        manual_member = next((m for m in members if "manual_counts_geo" in m.lower() and m.lower().endswith(".csv")), None)
        if not platomo_member:
            _fail("platomo_geo.csv not found in Copenhagen zip")
        if not manual_member:
            _fail("manual_counts_geo.csv not found in Copenhagen zip")

        def _ingest(member: str, source: str) -> None:
            text = zf.read(member).decode("utf-8-sig", errors="replace")
            headers, rows = _sniff_csv(text)
            nh = [_normalize_header(h) for h in headers]
            name_idx = next((i for i, h in enumerate(nh) if h in ("position", "name", "site", "location")), 0)
            lat_idx = next((i for i, h in enumerate(nh) if h.startswith("lat")), 1 if len(headers) > 1 else 0)
            lon_idx = next((i for i, h in enumerate(nh) if h.startswith("lon")), 2 if len(headers) > 2 else 0)

            for row in rows:
                cols = [row.get(h, "") for h in headers]
                if not cols:
                    continue
                name = str(cols[name_idx]).strip() if name_idx < len(cols) else ""
                lat = _floatish(cols[lat_idx]) if lat_idx < len(cols) else None
                lon = _floatish(cols[lon_idx]) if lon_idx < len(cols) else None
                if name and lat is not None and lon is not None:
                    features.append(
                        {
                            "type": "Feature",
                            "properties": {"name": name, "source": source},
                            "geometry": {"type": "Point", "coordinates": [float(lon), float(lat)]},
                        }
                    )

        _ingest(platomo_member, "otc")
        _ingest(manual_member, "manual")

    features.sort(
        key=lambda f: (
            str(f["properties"].get("source", "")),
            str(f["properties"].get("name", "")),
            float(f["geometry"]["coordinates"][1]),
            float(f["geometry"]["coordinates"][0]),
        )
    )
    out = OUT_DIR / "copenhagen_count_sites.geojson"
    _write_feature_collection(out, features)
    _log(f"  wrote {len(features)} features -> {out.relative_to(REPO_ROOT)}")
    return out


def _extract_gpkg(zip_path: Path, name_hint: str) -> Path:
    with zipfile.ZipFile(zip_path, "r") as zf:
        member = next((m for m in zf.namelist() if name_hint.lower() in m.lower() and m.lower().endswith(".gpkg")), None)
        if not member:
            _fail(f"GPKG member not found for hint '{name_hint}' in {zip_path.name}")
        td = tempfile.mkdtemp(prefix="geodata-gpkg-")
        out = Path(td) / Path(member).name
        out.write_bytes(zf.read(member))
        return out


def _gpkg_feature_tables(conn: sqlite3.Connection) -> list[str]:
    cur = conn.cursor()
    cur.execute("SELECT table_name FROM gpkg_contents WHERE data_type='features' ORDER BY table_name")
    return [r[0] for r in cur.fetchall()]


def _gpkg_geom_column(conn: sqlite3.Connection, table: str) -> str:
    cur = conn.cursor()
    cur.execute("SELECT column_name FROM gpkg_geometry_columns WHERE table_name = ?", (table,))
    row = cur.fetchone()
    if not row:
        _fail(f"No geometry column registered for {table}")
    return str(row[0])


def _table_columns(conn: sqlite3.Connection, table: str) -> list[str]:
    cur = conn.cursor()
    cur.execute(f'PRAGMA table_info("{table}")')
    return [str(r[1]) for r in cur.fetchall()]


def _best_label_column(cols: list[str], geom_col: str) -> str | None:
    low = [c.lower() for c in cols if c != geom_col]
    prefs = ("name", "label", "title", "site", "location", "id")
    for p in prefs:
        for c in cols:
            if c == geom_col:
                continue
            if c.lower() == p:
                return c
    return None


def _read_gpkg_table(
    conn: sqlite3.Connection,
    table: str,
    reproj: Any | None,
    include_properties: bool = True,
    default_properties: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    geom_col = _gpkg_geom_column(conn, table)
    cols = _table_columns(conn, table)
    label_col = _best_label_column(cols, geom_col)

    selected_cols = [geom_col]
    if include_properties and label_col:
        selected_cols.append(label_col)
    sql_cols = ", ".join(f'"{c}"' for c in selected_cols)
    cur = conn.cursor()
    cur.execute(f'SELECT {sql_cols} FROM "{table}"')

    feats: list[dict[str, Any]] = []
    for row in cur.fetchall():
        geom_blob = row[0]
        geom = parse_gpkg_geom(geom_blob)
        if not geom:
            continue
        geom = _reproject_geometry(geom, reproj)
        props = dict(default_properties or {})
        if include_properties and label_col:
            label = row[1]
            if label not in (None, ""):
                props["name"] = str(label)
        feats.append({"type": "Feature", "properties": props, "geometry": geom})
    return feats


def build_helsinki_locations(hel_zip: Path) -> Path:
    _log("Building Helsinki intervention locations…")
    gpkg_path = _extract_gpkg(hel_zip, "Helsinki_Intervention_Locations")
    try:
        conn = sqlite3.connect(str(gpkg_path))
        try:
            feature_tables = set(_gpkg_feature_tables(conn))
            targets = ["ViikkiIntersection", "KallioSite", "HelsinkiArea"]
            features: list[dict[str, Any]] = []
            for table in targets:
                if table not in feature_tables:
                    _log(f"  warning: layer {table} not found in Helsinki intervention gpkg")
                    continue
                rows = _read_gpkg_table(
                    conn,
                    table,
                    reproj=reproject_epsg3067_to_wgs84,
                    include_properties=True,
                    default_properties={"layer": table, "source": "fvh_registry"},
                )
                features.extend(rows)
        finally:
            conn.close()
    finally:
        gpkg_path.unlink(missing_ok=True)
        gpkg_path.parent.rmdir()

    features.sort(key=lambda f: (str(f["properties"].get("layer", "")), str(f["properties"].get("name", ""))))
    out = OUT_DIR / "helsinki_intervention_locations.geojson"
    _write_feature_collection(out, features)
    _log(f"  wrote {len(features)} features -> {out.relative_to(REPO_ROOT)}")
    return out


def build_helsinki_dangerous(hel_zip: Path) -> Path:
    _log("Building Helsinki dangerous locations…")
    gpkg_path = _extract_gpkg(hel_zip, "DangerousLocationsSurvey_ENG_EPSG3067")
    try:
        conn = sqlite3.connect(str(gpkg_path))
        try:
            tables = _gpkg_feature_tables(conn)
            features: list[dict[str, Any]] = []
            for table in tables:
                rows = _read_gpkg_table(
                    conn,
                    table,
                    reproj=reproject_epsg3067_to_wgs84,
                    include_properties=False,
                    default_properties={"layer": table, "status": "active_hazard"},
                )
                features.extend(rows)
        finally:
            conn.close()
    finally:
        gpkg_path.unlink(missing_ok=True)
        gpkg_path.parent.rmdir()

    features.sort(key=lambda f: str(f["properties"].get("layer", "")))
    out = OUT_DIR / "helsinki_dangerous_locations.geojson"
    _write_feature_collection(out, features)
    _log(f"  wrote {len(features)} features -> {out.relative_to(REPO_ROOT)}")
    return out


def _pilot_from_stem(stem: str) -> str | None:
    s = stem.upper().replace("-", "").replace("_", "")
    if "AYZGZ1" in s or "AYZG1" in s:
        return "zar-p1"
    if "AYZGZ2" in s or "AYZG2" in s or "ROMAREDA" in s:
        return "zar-p2"
    if "AYZGZ3" in s or "AYZG3" in s:
        return "zar-p3"
    if "AYZGZ4" in s or "AYZG4" in s:
        return "zar-p4"
    return None


def build_zaragoza(zar_zip: Path) -> Path:
    _log("Building Zaragoza intervention areas…")
    with zipfile.ZipFile(zar_zip, "r") as outer:
        nested_member = next(
            (m for m in outer.namelist() if "intervention areas" in m.lower() and m.lower().endswith(".zip")),
            None,
        )
        if not nested_member:
            _fail("Nested 'Intervention areas' zip not found in Zaragoza source zip")
        nested_bytes = outer.read(nested_member)

    features: list[dict[str, Any]] = []
    with zipfile.ZipFile(io.BytesIO(nested_bytes), "r") as inner:
        shp_members = [m for m in inner.namelist() if m.lower().endswith(".shp")]
        if not shp_members:
            _fail("No .shp members found in nested Zaragoza intervention zip")
        for shp_member in sorted(shp_members):
            stem = Path(shp_member).stem
            pilot_id = _pilot_from_stem(stem)
            if not pilot_id:
                _log(f"  warning: skipping unmapped shapefile stem {stem}")
                continue
            reproj = reproject_utm30n_to_wgs84 if pilot_id == "zar-p1" else None
            with tempfile.TemporaryDirectory(prefix="geodata-shp-") as td:
                shp_path = Path(td) / "shape.shp"
                shp_path.write_bytes(inner.read(shp_member))
                geometries = parse_shp_polygons(shp_path, reproj)
            for geom in geometries:
                features.append(
                    {
                        "type": "Feature",
                        "properties": {"pilotId": pilot_id, "source_file": stem},
                        "geometry": geom,
                    }
                )

    features.sort(key=lambda f: (str(f["properties"].get("pilotId", "")), str(f["properties"].get("source_file", ""))))
    out = OUT_DIR / "zaragoza_intervention_areas.geojson"
    _write_feature_collection(out, features)
    _log(f"  wrote {len(features)} features -> {out.relative_to(REPO_ROOT)}")
    return out


def run() -> int:
    if not DROP_DIR.exists():
        print(f"Missing source drop directory: {DROP_DIR}", file=sys.stderr)
        return 1
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    cph_zip = _find_zip("Copenhagen")
    hel_zip = _find_zip("Helsinki")
    zar_zip = _find_zip("Zaragoza")

    outputs = [
        build_copenhagen(cph_zip),
        build_helsinki_locations(hel_zip),
        build_helsinki_dangerous(hel_zip),
        build_zaragoza(zar_zip),
    ]

    _log("Completed geodata preparation:")
    for p in outputs:
        _log(f"  - {p.relative_to(REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(run())

