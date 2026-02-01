#!/usr/bin/env python3
import csv
import json
import math
import os
from pathlib import Path
from typing import Dict, List, Tuple

ROOT = Path(__file__).resolve().parent.parent
PPD_DIR = ROOT / "PPD"
CODEPO_DIR = ROOT / "codepo_gb" / "Data" / "CSV"
GB_POSTCODES = ROOT / "gb-postcodes" / "gb-postcodes-v5"
OUT_DIR = ROOT / "data"
POLYGON_DIR = OUT_DIR / "polygons"
STATS_DIR = OUT_DIR / "stats"


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


def ensure_dirs():
    for sub in ["postcode_points", "area_geojson", "district_geojson", "sector_geojson"]:
        (OUT_DIR / sub).mkdir(parents=True, exist_ok=True)
    POLYGON_DIR.mkdir(parents=True, exist_ok=True)
    STATS_DIR.mkdir(parents=True, exist_ok=True)


def write_index(months: List[str], folder: Path):
    with (folder / "index.json").open("w", encoding="utf-8") as f:
        json.dump({"months": months}, f)


def main():
    if not PPD_DIR.exists():
        raise SystemExit("PPD folder not found. Create PPD/ and add 2025.csv, 2024.csv, ...")

    ensure_dirs()

    print("Loading postcode coordinates...")
    coords = load_postcode_coords()
    print(f"  Loaded {len(coords):,} postcodes")

    print("Loading polygons...")
    area_polys = load_polygons(GB_POSTCODES / "areas")
    district_polys = load_polygons(GB_POSTCODES / "districts")
    sector_polys = load_polygons(GB_POSTCODES / "sectors")
    print(f"  Areas: {len(area_polys):,}  Districts: {len(district_polys):,}  Sectors: {len(sector_polys):,}")

    # Stats: {month: {code: [prices...]}} plus count/sum
    months_set = set()
    pc_stats: Dict[str, Dict[str, List[int]]] = {}
    area_stats: Dict[str, Dict[str, List[int]]] = {}
    district_stats: Dict[str, Dict[str, List[int]]] = {}
    sector_stats: Dict[str, Dict[str, List[int]]] = {}

    def add_price(stats: Dict[str, Dict[str, List[int]]], month: str, code: str, price: int):
        stats.setdefault(month, {}).setdefault(code, []).append(price)

    print("Processing PPD CSVs...")
    for csv_file in sorted(PPD_DIR.glob("*.csv")):
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
                month = date[:7]
                if len(month) != 7 or "-" not in month:
                    continue
                months_set.add(month)

                norm_pc = normalize_postcode(postcode)
                add_price(pc_stats, month, norm_pc, price)

                area, district, sector = parse_codes(postcode)
                if area:
                    add_price(area_stats, month, area, price)
                if district:
                    add_price(district_stats, month, district, price)
                if sector:
                    add_price(sector_stats, month, sector, price)

    months = sorted(months_set)
    print(f"  Months found: {len(months)}")

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

    # Static polygons (write once)
    area_fc = {"type": "FeatureCollection", "features": build_polygon_features(area_polys, "area")}
    district_fc = {"type": "FeatureCollection", "features": build_polygon_features(district_polys, "district")}
    sector_fc = {"type": "FeatureCollection", "features": build_polygon_features(sector_polys, "sector")}

    (POLYGON_DIR / "areas.geojson").write_text(json.dumps(area_fc))
    (POLYGON_DIR / "districts.geojson").write_text(json.dumps(district_fc))
    (POLYGON_DIR / "sectors.geojson").write_text(json.dumps(sector_fc))

    area_codes = list(area_polys.keys())
    district_codes = list(district_polys.keys())
    sector_codes = list(sector_polys.keys())

    area_values = []
    district_values = []
    sector_values = []

    for month in months:
        # Stats (small JSON maps)
        def stats_for_month(stats: Dict[str, Dict[str, List[int]]], all_codes: List[str], collector: List[float]):
            month_stats = stats.get(month, {})
            out = {}
            for code in all_codes:
                prices = month_stats.get(code, [])
                median, mean, count = prices_to_stats(prices)
                out[code] = {
                    "median_price": median,
                    "mean_price": mean,
                    "sales": count
                }
                if count > 0 and median is not None:
                    collector.append(float(median))
            return out

        (STATS_DIR / f"area_{month}.json").write_text(json.dumps(stats_for_month(area_stats, area_codes, area_values)))
        (STATS_DIR / f"district_{month}.json").write_text(json.dumps(stats_for_month(district_stats, district_codes, district_values)))
        (STATS_DIR / f"sector_{month}.json").write_text(json.dumps(stats_for_month(sector_stats, sector_codes, sector_values)))

        # Points (still per month)
        points_fc = {"type": "FeatureCollection", "features": build_point_features(pc_stats, month)}
        (OUT_DIR / "postcode_points" / f"points_{month}.geojson").write_text(json.dumps(points_fc))

    write_index(months, STATS_DIR)
    write_index(months, OUT_DIR / "postcode_points")

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
        return {"min": min_v, "max": max_v}

    ranges = {
        "area": quantile_range(area_values),
        "district": quantile_range(district_values),
        "sector": quantile_range(sector_values)
    }
    (STATS_DIR / "ranges.json").write_text(json.dumps(ranges))

    print("Done.")


if __name__ == "__main__":
    main()
