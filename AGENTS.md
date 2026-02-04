# Agent Notes — Current Data Pipeline

## Datasets
- **PPD transactions** — Source:
  `https://www.gov.uk/government/collections/price-paid-data` — Local: `PPD/` (`PPD/YYYY.csv`)
- **Code‑Point Open** — Source:
  `https://www.ordnancesurvey.co.uk/products/code-point-open` — Local: `codepo_gb/Data/CSV/`
- **GB postcodes boundaries** — Source:
  `https://longair.net/uk-postcodes/` — Local: `gb-postcodes-v5/` (`areas/`, `districts/`, `sectors/`)
Note: `scripts/build_geojson.py` expects `gb-postcodes/gb-postcodes-v5/` unless you update the path.

## Generated Data (`scripts/build_geojson.py`)
- `data/postcode_points/` → `points_YYYY-MM.geojson` + `index.json`
- `data/polygons/` → `areas.geojson`, `districts.geojson`, `sectors.geojson` (static)
- `data/stats/` → `area_YYYY-MM.json`, `district_YYYY-MM.json`, `sector_YYYY-MM.json`, `ranges.json`, `index.json`

## Frontend Behavior
- Polygons are loaded **once** from `data/polygons/`.
- Monthly stats from `data/stats/` recolor polygons per month.
- Monthly dots from `data/postcode_points/` load per month.
So yes: polygons are static; only monthly stats/dots change.

## Color Scale
- Colors encode **median price** (blue → teal → green → yellow → orange).
- Legend uses min/max from `data/stats/ranges.json`.

## Performance
- Cache JSON by URL.
- Prefer `setData(...)` to update sources without recreating layers.
