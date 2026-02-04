#!/usr/bin/env python3
import csv
import hashlib
import json
import math
import os
from pathlib import Path
from typing import Dict, List, Tuple

ROOT = Path(__file__).resolve().parent.parent
PPD_DIR = ROOT / "PPD"
CODEPO_DIR = ROOT / "codepo_gb" / "Data" / "CSV"
GB_POSTCODES = ROOT / "gb-postcodes-v5"
GB_POSTCODES_FALLBACK = ROOT / "gb-postcodes" / "gb-postcodes-v5"
OUT_DIR = ROOT / "data"

# Keep polygons shared across datasets (boundaries don't change).
POLYGON_DIR = OUT_DIR / "polygons"

# Dataset namespaces
HIST_DIR = OUT_DIR / "historical"
PRED_DIR = OUT_DIR / "predicted"
LIVE_DIR = OUT_DIR / "live"

HIST_STATS_DIR = HIST_DIR / "stats"
HIST_POINTS_DIR = HIST_DIR / "postcode_points"
PRED_STATS_DIR = PRED_DIR / "stats"
PRED_POINTS_DIR = PRED_DIR / "postcode_points"
LIVE_LISTINGS_DIR = LIVE_DIR / "listings"

# Live listings input (ScanSan snapshot with optional geocoding pass).
LIVE_LISTINGS_INPUT = ROOT / "live" / "london_listings_geocoded.json"
LIVE_LISTINGS_INPUT_FALLBACK = ROOT / "london_listings_geocoded.json"


def osgrid_to_latlng(easting: int, northing: int) -> Tuple[float, float]:
    a = 6377563.396
    b = 6356256.910
    F0 = 0.9996012717
    lat0 = math.radians(49)
    lon0 = math.radians(-2)
    N0 = -100000
    E0 = 400000
    e2 = 1 - (b * b) / (a * a)
    n = (a - b) / (a + b)
    n2 = n * n
    n3 = n2 * n

    lat = lat0
    M = 0
    while True:
        lat = (northing - N0 - M) / (a * F0) + lat
        Ma = (1 + n + (5 / 4) * n2 + (5 / 4) * n3) * (lat - lat0)
        Mb = (3 * n + 3 * n * n + (21 / 8) * n3) * math.sin(lat - lat0) * math.cos(lat + lat0)
        Mc = ((15 / 8) * n2 + (15 / 8) * n3) * math.sin(2 * (lat - lat0)) * math.cos(2 * (lat + lat0))
        Md = (35 / 24) * n3 * math.sin(3 * (lat - lat0)) * math.cos(3 * (lat + lat0))
        M = b * F0 * (Ma - Mb + Mc - Md)
        if northing - N0 - M < 0.00001:
            break

    cos_lat = math.cos(lat)
    sin_lat = math.sin(lat)
    nu = a * F0 / math.sqrt(1 - e2 * sin_lat * sin_lat)
    rho = a * F0 * (1 - e2) / math.pow(1 - e2 * sin_lat * sin_lat, 1.5)
    eta2 = nu / rho - 1

    tan_lat = math.tan(lat)
    tan2 = tan_lat * tan_lat
    tan4 = tan2 * tan2
    tan6 = tan4 * tan2
    sec_lat = 1 / cos_lat
    nu3 = nu ** 3
    nu5 = nu3 * nu * nu
    nu7 = nu5 * nu * nu
    VII = tan_lat / (2 * rho * nu)
    VIII = tan_lat / (24 * rho * nu3) * (5 + 3 * tan2 + eta2 - 9 * tan2 * eta2)
    IX = tan_lat / (720 * rho * nu5) * (61 + 90 * tan2 + 45 * tan4)
    X = sec_lat / nu
    XI = sec_lat / (6 * nu3) * (nu / rho + 2 * tan2)
    XII = sec_lat / (120 * nu5) * (5 + 28 * tan2 + 24 * tan4)
    XIIA = sec_lat / (5040 * nu7) * (61 + 662 * tan2 + 1320 * tan4 + 720 * tan6)

    dE = easting - E0
    dE2 = dE * dE
    dE3 = dE2 * dE
    dE4 = dE2 * dE2
    dE5 = dE3 * dE2
    dE6 = dE4 * dE2
    dE7 = dE5 * dE2

    lat = lat - VII * dE2 + VIII * dE4 - IX * dE6
    lon = lon0 + X * dE - XI * dE3 + XII * dE5 - XIIA * dE7

    return (math.degrees(lat), math.degrees(lon))


def normalize_postcode(pc: str) -> str:
    return pc.replace(" ", "").upper()


def parse_codes(pc: str) -> Tuple[str, str, str]:
    pc = pc.strip().upper()
    if not pc:
        return "", "", ""
    parts = pc.split()
    outward = parts[0]
    inward = parts[1] if len(parts) > 1 else ""

    area = ""
    for ch in outward:
        if ch.isalpha():
            area += ch
        else:
            break

    district = outward
    sector = outward
    if inward:
        sector = f"{outward} {inward[0]}"
    return area, district, sector


def load_postcode_coords() -> Dict[str, Tuple[float, float, str]]:
    coords = {}
    for csv_file in CODEPO_DIR.glob("*.csv"):
        with csv_file.open("r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                # Example: "E1 0AA",10,535267,181084,"E92000001",...
                if line[0] != '"':
                    continue
                parts = line.split(",")
                if len(parts) < 4:
                    continue
                postcode = parts[0].replace('"', "")
                try:
                    easting = int(parts[2])
                    northing = int(parts[3])
                except ValueError:
                    continue
                lat, lng = osgrid_to_latlng(easting, northing)
                coords[normalize_postcode(postcode)] = (lat, lng, postcode)
    return coords


def load_polygons(folder: Path) -> Dict[str, dict]:
    polygons = {}
    for geojson in folder.rglob("*.geojson"):
        code = geojson.stem
        with geojson.open("r", encoding="utf-8") as f:
            polygons[code] = json.load(f)
    return polygons


def load_polygons_from_legacy_monthly(monthly_dir: Path, code_field: str) -> Dict[str, dict]:
    """
    Fallback when the gb-postcodes dataset isn't available locally.
    We reuse the geometry from an existing monthly GeoJSON in data/*_geojson/.
    """
    if not monthly_dir.exists():
        return {}
    candidates = sorted(monthly_dir.glob("*.geojson"))
    if not candidates:
        return {}
    sample_file = candidates[0]
    with sample_file.open("r", encoding="utf-8") as f:
        fc = json.load(f)
    out: Dict[str, dict] = {}
    for feature in fc.get("features", []):
        props = feature.get("properties") or {}
        code = props.get(code_field)
        geom = feature.get("geometry")
        if not code or not geom:
            continue
        out[str(code)] = {"type": "Feature", "geometry": geom, "properties": {code_field: str(code)}}
    return out


def ensure_dirs():
    # Legacy dirs (kept for older branches; safe no-op if unused)
    for sub in ["area_geojson", "district_geojson", "sector_geojson"]:
        (OUT_DIR / sub).mkdir(parents=True, exist_ok=True)

    # New dataset dirs
    for d in [
        HIST_STATS_DIR,
        HIST_POINTS_DIR,
        PRED_STATS_DIR,
        PRED_POINTS_DIR,
        (LIVE_DIR / "stats"),
        (LIVE_DIR / "postcode_points"),
        LIVE_LISTINGS_DIR,
    ]:
        d.mkdir(parents=True, exist_ok=True)
    POLYGON_DIR.mkdir(parents=True, exist_ok=True)


def write_index(months: List[str], folder: Path):
    with (folder / "index.json").open("w", encoding="utf-8") as f:
        json.dump({"months": months}, f)


def quantile_range(values: List[float]):
    if not values:
        return {"min": 0, "max": 1}
    values_sorted = sorted(values)

    def pick(p: float):
        idx = max(0, min(len(values_sorted) - 1, round(p * (len(values_sorted) - 1))))
        return values_sorted[idx]

    min_v = pick(0.1)
    max_v = pick(0.9)
    if min_v == max_v:
        max_v = min_v + 1
    return {"min": float(min_v), "max": float(max_v)}


def write_ranges(out_dir: Path, area_values: List[float], district_values: List[float], sector_values: List[float]):
    ranges = {
        "area": quantile_range(area_values),
        "district": quantile_range(district_values),
        "sector": quantile_range(sector_values),
    }
    (out_dir / "ranges.json").write_text(json.dumps(ranges))


def main():
    if not PPD_DIR.exists():
        raise SystemExit("PPD folder not found. Create PPD/ and add 2025.csv, 2024.csv, ...")

    ensure_dirs()

    print("Loading postcode coordinates...")
    coords = load_postcode_coords()
    print(f"  Loaded {len(coords):,} postcodes")

    print("Loading polygons...")
    area_polys = {}
    district_polys = {}
    sector_polys = {}

    polygons_root = None
    if GB_POSTCODES.exists():
        polygons_root = GB_POSTCODES
    elif GB_POSTCODES_FALLBACK.exists():
        polygons_root = GB_POSTCODES_FALLBACK

    if polygons_root:
        area_polys = load_polygons(polygons_root / "areas")
        district_polys = load_polygons(polygons_root / "districts")
        sector_polys = load_polygons(polygons_root / "sectors")

    # Fallback: reuse existing monthly polygon geometries if present.
    if not area_polys:
        area_polys = load_polygons_from_legacy_monthly(OUT_DIR / "area_geojson", "area")
    if not district_polys:
        district_polys = load_polygons_from_legacy_monthly(OUT_DIR / "district_geojson", "district")
    if not sector_polys:
        sector_polys = load_polygons_from_legacy_monthly(OUT_DIR / "sector_geojson", "sector")

    print(f"  Areas: {len(area_polys):,}  Districts: {len(district_polys):,}  Sectors: {len(sector_polys):,}")

    # Stats: {month: {code: [prices...]}}
    hist_months_set = set()
    pred_months_set = set()

    hist_pc_stats: Dict[str, Dict[str, List[int]]] = {}
    hist_area_stats: Dict[str, Dict[str, List[int]]] = {}
    hist_district_stats: Dict[str, Dict[str, List[int]]] = {}
    hist_sector_stats: Dict[str, Dict[str, List[int]]] = {}

    pred_pc_stats: Dict[str, Dict[str, List[int]]] = {}
    pred_area_stats: Dict[str, Dict[str, List[int]]] = {}
    pred_district_stats: Dict[str, Dict[str, List[int]]] = {}
    pred_sector_stats: Dict[str, Dict[str, List[int]]] = {}

    def add_price(stats: Dict[str, Dict[str, List[int]]], month: str, code: str, price: int):
        stats.setdefault(month, {}).setdefault(code, []).append(price)

    print("Processing historical PPD CSVs (<= 2025)...")
    for csv_file in sorted(PPD_DIR.glob("*.csv")):
        try:
            year = int(csv_file.stem)
        except ValueError:
            continue
        if year > 2025:
            continue
        print(f"  Reading {csv_file.name}")
        with csv_file.open("r", encoding="utf-8", errors="ignore") as f:
            reader = csv.reader(f)
            for row in reader:
                if len(row) < 4:
                    continue
                try:
                    price = int(row[1])
                except ValueError:
                    continue
                date = row[2]
                postcode = row[3]
                if not date or not postcode:
                    continue
                month = str(date)[:7]
                if len(month) != 7 or "-" not in month:
                    continue
                hist_months_set.add(month)

                norm_pc = normalize_postcode(postcode)
                add_price(hist_pc_stats, month, norm_pc, price)

                area, district, sector = parse_codes(postcode)
                if area:
                    add_price(hist_area_stats, month, area, price)
                if district:
                    add_price(hist_district_stats, month, district, price)
                if sector:
                    add_price(hist_sector_stats, month, sector, price)

    # Predictions: 2026-2030 predicted_price
    pred_dir = ROOT / "predictions"
    if pred_dir.exists():
        print("Processing predictions CSVs (2026-2030)...")
        for csv_file in sorted(pred_dir.glob("bulk_property_predictions_*.csv")):
            name = csv_file.stem
            year_str = name.split("_")[-1]
            try:
                year = int(year_str)
            except ValueError:
                continue
            if year < 2026 or year > 2030:
                continue
            print(f"  Reading {csv_file.name}")
            with csv_file.open("r", encoding="utf-8", errors="ignore") as f:
                reader = csv.reader(f)
                for row in reader:
                    # Expected columns: ... date_of_transfer, postcode, ... year, predicted_price
                    if len(row) < 18:
                        continue
                    date = row[2]
                    postcode = row[3]
                    if not date or not postcode:
                        continue

                    # date_of_transfer month/day is reused, but the *target year* is in the "year" column.
                    # Example: date_of_transfer="2025-10-16 00:00", year="2026" -> month="2026-10"
                    year_col = row[16]
                    try:
                        year_target = int(year_col)
                    except ValueError:
                        continue
                    month_part = str(date)[5:7]
                    if not month_part.isdigit():
                        continue
                    month = f"{year_target}-{month_part}"

                    try:
                        price = float(row[17])
                    except ValueError:
                        continue
                    price_int = int(round(price))
                    pred_months_set.add(month)

                    norm_pc = normalize_postcode(postcode)
                    add_price(pred_pc_stats, month, norm_pc, price_int)

                    area, district, sector = parse_codes(postcode)
                    if area:
                        add_price(pred_area_stats, month, area, price_int)
                    if district:
                        add_price(pred_district_stats, month, district, price_int)
                    if sector:
                        add_price(pred_sector_stats, month, sector, price_int)

    hist_months = sorted(hist_months_set)
    pred_months = sorted(pred_months_set)
    print(f"  Historical months: {len(hist_months)}")
    print(f"  Predicted months: {len(pred_months)}")

    def prices_to_stats(prices: List[int]) -> Tuple[float, float, int]:
        prices_sorted = sorted(prices)
        n = len(prices_sorted)
        if n == 0:
            return (None, None, 0)
        mid = n // 2
        if n % 2 == 1:
            median = float(prices_sorted[mid])
        else:
            median = (prices_sorted[mid - 1] + prices_sorted[mid]) / 2.0
        mean = sum(prices_sorted) / n
        return (median, mean, n)

    def build_polygon_features(polys: Dict[str, dict], key_name: str):
        features = []
        for code, poly in polys.items():
            # poly is either a FeatureCollection (gb-postcodes), or a Feature (legacy fallback).
            if isinstance(poly, dict) and poly.get("type") == "Feature":
                geometry = poly.get("geometry")
            else:
                geometry = poly["features"][0]["geometry"] if "features" in poly else poly["geometry"]
            feature = {
                "type": "Feature",
                "id": code,
                "geometry": geometry,
                "properties": {
                    key_name: code
                }
            }
            features.append(feature)
        return features

    def build_point_features(stats: Dict[str, Dict[str, List[int]]], month: str):
        features = []
        month_stats = stats.get(month, {})
        for code, prices in month_stats.items():
            coord = coords.get(code)
            if not coord:
                continue
            lat, lng, pc = coord
            median, mean, count = prices_to_stats(prices)
            feature = {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [lng, lat]},
                "properties": {
                    "postcode": pc,
                    "median_price": median,
                    "mean_price": mean,
                    "sales": count
                }
            }
            features.append(feature)
        return features

    print("Writing outputs...")

    # Static polygons (write once). Avoid overwriting existing polygons with empty sets.
    def maybe_write_polygons(filename: str, polys: Dict[str, dict], key: str):
        out_path = POLYGON_DIR / filename
        if not polys:
            # If we already have a non-empty polygons file, keep it.
            if out_path.exists():
                try:
                    existing = json.loads(out_path.read_text())
                    if len(existing.get("features", [])) > 0:
                        return
                except Exception:
                    pass
            return
        fc = {"type": "FeatureCollection", "features": build_polygon_features(polys, key)}
        out_path.write_text(json.dumps(fc))

    maybe_write_polygons("areas.geojson", area_polys, "area")
    maybe_write_polygons("districts.geojson", district_polys, "district")
    maybe_write_polygons("sectors.geojson", sector_polys, "sector")

    def geometry_bbox(geometry: dict):
        min_lng = 180.0
        min_lat = 90.0
        max_lng = -180.0
        max_lat = -90.0

        def walk_coords(obj):
            nonlocal min_lng, min_lat, max_lng, max_lat
            if isinstance(obj, (list, tuple)):
                if len(obj) == 2 and all(isinstance(v, (int, float)) for v in obj):
                    lng, lat = float(obj[0]), float(obj[1])
                    min_lng = min(min_lng, lng)
                    min_lat = min(min_lat, lat)
                    max_lng = max(max_lng, lng)
                    max_lat = max(max_lat, lat)
                else:
                    for it in obj:
                        walk_coords(it)

        try:
            walk_coords(geometry.get("coordinates"))
        except Exception:
            return None

        if min_lng > max_lng or min_lat > max_lat:
            return None
        return (min_lng, min_lat, max_lng, max_lat)

    def bbox_center(bbox):
        return ((bbox[0] + bbox[2]) / 2.0, (bbox[1] + bbox[3]) / 2.0)

    def deterministic_jitter(seed: str, lat: float, lng: float, radius_deg: float = 0.01):
        # Deterministic but "random-looking" offset. Used only for ungeocoded listings.
        h = hashlib.sha1(seed.encode("utf-8", errors="ignore")).digest()
        a = int.from_bytes(h[:8], "big") / (2**64 - 1)
        b = int.from_bytes(h[8:16], "big") / (2**64 - 1)
        angle = a * 2.0 * math.pi
        radius = math.sqrt(b) * radius_deg
        dlat = math.sin(angle) * radius
        dlng = math.cos(angle) * radius / max(0.25, math.cos(math.radians(lat)))
        return (lat + dlat, lng + dlng)

    def build_district_centers() -> Dict[str, Tuple[float, float]]:
        centers: Dict[str, Tuple[float, float]] = {}
        for code, poly in district_polys.items():
            try:
                geom = poly["features"][0]["geometry"]
            except Exception:
                continue
            bbox = geometry_bbox(geom)
            if not bbox:
                continue
            lng, lat = bbox_center(bbox)
            centers[str(code)] = (lat, lng)
        return centers

    def listing_id(kind: str, url: str) -> str:
        # Stable ID so frontend can query details from the backend.
        base = f"{kind}|{url}"
        return hashlib.sha1(base.encode("utf-8", errors="ignore")).hexdigest()[:16]

    def build_live_listings(district_centers: Dict[str, Tuple[float, float]]):
        src = LIVE_LISTINGS_INPUT if LIVE_LISTINGS_INPUT.exists() else LIVE_LISTINGS_INPUT_FALLBACK
        if not src.exists():
            return

        try:
            raw = json.loads(src.read_text(encoding="utf-8"))
        except Exception:
            return

        areas = raw.get("areas") or {}
        if not isinstance(areas, dict):
            return

        features = []
        total = 0
        geocoded = 0
        skipped_no_coords = 0

        def push(kind: str, district_code: str, listing: dict):
            nonlocal total, geocoded, skipped_no_coords
            total += 1
            if not isinstance(listing, dict):
                return
            url = str(listing.get("listing_url") or "")
            if not url:
                return
            lat = listing.get("latitude")
            lng = listing.get("longitude")
            if isinstance(lat, (int, float)) and isinstance(lng, (int, float)):
                geocoded += 1
            else:
                # Only plot real geocoded listings for Live.
                skipped_no_coords += 1
                return

            price = listing.get("sale_price") if kind == "sale" else listing.get("rent_pcm")
            bedrooms = listing.get("bedrooms")

            features.append(
                {
                    "type": "Feature",
                    "id": listing_id(kind, url),
                    "geometry": {"type": "Point", "coordinates": [float(lng), float(lat)]},
                    "properties": {
                        "kind": kind,
                        "district": district_code,
                        "price": price,
                        "bedrooms": bedrooms,
                        "address": listing.get("street_address"),
                        "url": url,
                        "approximate": False,
                    },
                }
            )

        for district_code, info in areas.items():
            if not isinstance(info, dict):
                continue
            for listing in info.get("saleListings") or []:
                push("sale", str(district_code), listing)
            for listing in info.get("rentListings") or []:
                push("rent", str(district_code), listing)

        out_fc = {"type": "FeatureCollection", "features": features}
        (LIVE_LISTINGS_DIR / "listings.geojson").write_text(json.dumps(out_fc))
        (LIVE_LISTINGS_DIR / "meta.json").write_text(
            json.dumps(
                {
                    "source": str(src),
                    "totalListings": total,
                    "pointFeatures": len(features),
                    "geocodedListings": geocoded,
                    "skippedNoCoords": skipped_no_coords,
                    "rawMeta": raw.get("meta"),
                }
            )
        )

    # Live listings overlay (independent of historical/predicted timeline).
    build_live_listings(build_district_centers())

    def union_codes(stats_by_month: Dict[str, Dict[str, List[int]]]) -> List[str]:
        codes = set()
        for month_map in stats_by_month.values():
            codes.update(month_map.keys())
        return sorted(codes)

    # Prefer polygon-derived code lists; otherwise derive from stats (so we still emit data).
    area_codes = sorted(set(area_polys.keys())) if area_polys else sorted(set(union_codes(hist_area_stats) + union_codes(pred_area_stats)))
    district_codes = sorted(set(district_polys.keys())) if district_polys else sorted(set(union_codes(hist_district_stats) + union_codes(pred_district_stats)))
    sector_codes = sorted(set(sector_polys.keys())) if sector_polys else sorted(set(union_codes(hist_sector_stats) + union_codes(pred_sector_stats)))

    def write_dataset(months: List[str], stats_dir: Path, points_dir: Path,
                      pc_stats: Dict[str, Dict[str, List[int]]],
                      area_stats: Dict[str, Dict[str, List[int]]],
                      district_stats: Dict[str, Dict[str, List[int]]],
                      sector_stats: Dict[str, Dict[str, List[int]]]):
        area_values: List[float] = []
        district_values: List[float] = []
        sector_values: List[float] = []

        def stats_for_month(stats: Dict[str, Dict[str, List[int]]], all_codes: List[str], collector: List[float], month: str):
            month_stats = stats.get(month, {})
            out = {}
            for code in all_codes:
                prices = month_stats.get(code, [])
                median, mean, count = prices_to_stats(prices)
                out[code] = {"median_price": median, "mean_price": mean, "sales": count}
                if count > 0 and median is not None:
                    collector.append(float(median))
            return out

        for month in months:
            (stats_dir / f"area_{month}.json").write_text(
                json.dumps(stats_for_month(area_stats, area_codes, area_values, month))
            )
            (stats_dir / f"district_{month}.json").write_text(
                json.dumps(stats_for_month(district_stats, district_codes, district_values, month))
            )
            (stats_dir / f"sector_{month}.json").write_text(
                json.dumps(stats_for_month(sector_stats, sector_codes, sector_values, month))
            )

            points_fc = {"type": "FeatureCollection", "features": build_point_features(pc_stats, month)}
            (points_dir / f"points_{month}.geojson").write_text(json.dumps(points_fc))

        write_index(months, stats_dir)
        write_index(months, points_dir)
        write_ranges(stats_dir, area_values, district_values, sector_values)

    # Write historical + predicted datasets into separate folders.
    if hist_months:
        write_dataset(hist_months, HIST_STATS_DIR, HIST_POINTS_DIR, hist_pc_stats, hist_area_stats, hist_district_stats, hist_sector_stats)
    if pred_months:
        write_dataset(pred_months, PRED_STATS_DIR, PRED_POINTS_DIR, pred_pc_stats, pred_area_stats, pred_district_stats, pred_sector_stats)

    print("Done.")


if __name__ == "__main__":
    main()
