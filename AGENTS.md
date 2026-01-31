# Agent Notes — Data, Polygons, Colors, Frontend Behavior

This document explains:
- the datasets we use,
- how we generate polygons and dots,
- how the color scale works, and
- what the frontend map is doing.

This is written for the **main branch** that only shows **dots**, but includes the full process to build **polygons** if you later copy the `/data` folder across.

---

## 1) Datasets we use

### 1.1 Property transactions
**Source:** HM Land Registry Price Paid Data (PPD)  
**Local file:** `yearsold.csv`  
**Key fields (column order):**
1. `transaction_id`
2. `price`
3. `date_of_transfer` (YYYY-MM-DD)
4. `postcode`
5. `property_type`
6. `old_new`
7. `duration`
8. `paon`
9. `saon`
10. `street`
11. `locality`
12. `town_city`
13. `district`
14. `county`
15. `ppd_category`
16. `record_status`

We only need `price`, `date_of_transfer`, and `postcode`.

### 1.2 Postcode coordinates (centroids)
**Source:** Ordnance Survey Code‑Point Open  
**Local folder:** `codepo_gb/Data/CSV/`  
Each row has:
```
PC, PQ, EA, NO, CY, RH, LH, CC, DC, WC
```
We use:
- `PC` (postcode)
- `EA` (Eastings)
- `NO` (Northings)

We convert OSGB36 (EPSG:27700) Eastings/Northings → WGS84 lat/lon (EPSG:4326).

### 1.3 Postcode polygon boundaries
**Source:** longair.net GB postcodes dataset  
**Local folder:** `gb-postcodes/gb-postcodes-v5/`
Contains GeoJSON for:
- `areas/` (e.g., `SW.geojson`)
- `districts/` (e.g., `SW1A.geojson`)
- `sectors/` (e.g., `SW1A 1.geojson`)
- `units/` (full postcode units; huge)

---

## 2) Data products we generate in /data

> You said you will copy `/data` from another branch. This is what’s in it and how it’s built.

### 2.1 Monthly postcode points (dots)
**Folder:** `data/postcode_points/`  
**Files:** `points_YYYY-MM.geojson` + `index.json`  
**How it’s built:**
1. Read `yearsold.csv`.
2. Normalize `postcode` (uppercase, trim).
3. Convert `date_of_transfer` → `month` (`YYYY-MM`).
4. Group by `postcode + month` and compute:
   - `median_price`
   - `sales` (count of transactions)
5. Join postcodes to Code‑Point Open coordinates (Eastings/Northings → lat/lon).
6. Output one **point per postcode per month**:
   - geometry: point at postcode centroid
   - properties: `postcode`, `median_price`, `sales`

**Why dots are “true” points:**  
They are **postcode centroid locations**, not polygon centroids.  
Multiple postcodes appear inside each area/district/sector polygon.

### 2.2 Monthly polygon layers (areas/districts/sectors)
**Folders:**
- `data/area_geojson/`
- `data/district_geojson/`
- `data/sector_geojson/`

**Files:** `area_YYYY-MM.geojson`, `district_YYYY-MM.geojson`, `sector_YYYY-MM.geojson` + `index.json`

**How they’re built:**
1. Read `yearsold.csv`.
2. Parse postcode:
   - `area` = leading letters (e.g., SW)
   - `district` = outward code (e.g., SW1A)
   - `sector` = outward + first inward digit (e.g., SW1A 1)
3. Convert `date_of_transfer` → `month`.
4. Aggregate by `(area|district|sector, month)`:
   - `median_price`
   - `mean_price`
   - `sales`
5. Match each code to its polygon from `gb-postcodes` and output as GeoJSON.

---

## 3) How colors are derived

**Color meaning:** Colors encode **median price** for that polygon or point.

Color gradient (low → high):
- Deep blue (lower prices)
- Teal / aqua
- Green
- Yellow
- Orange / coral (higher prices)

**Legend:** The frontend shows a small gradient bar with the **min and max** median price for the currently loaded month.

---

## 4) Frontend behavior (current “dots-only” version)

### 4.1 What the map does
- Mapbox GL JS map
- Loads monthly postcode points from `/data/postcode_points/points_YYYY-MM.geojson`
- Renders each point as a circle
- Circle color = median price
- Circle size = scaled by `sales` (transaction count)

### 4.2 Monthly slider
Slider moves month-by-month:
1. On slider change, fetch corresponding `points_YYYY-MM.geojson`
2. Update the Mapbox source with new point data

### 4.3 UI controls (main branch)
- Slider at bottom
- Month label + range
- Legend gradient (min → max)

---

## 5) Frontend behavior (polygon + dots branch)

If you copy `/data` with polygons:
- **Area/District/Sector** toggle switches which polygon layer is loaded.
- **Dots** toggle overlays postcode points on top of polygons.
- Polygon fill color = median price (per polygon).
- Dots always use **postcode centroids** from Code‑Point Open.

---

## 6) Performance notes

- The monthly points dataset is large (many postcodes).
- To keep UI responsive:
  - Cache JSON responses by month
  - Avoid re-parsing large data on each slider move
  - Keep a single Mapbox source and just `setData(...)`

---

## 7) How to regenerate data (summary)

1. `yearsold.csv` → monthly aggregates (postcode/area/district/sector).
2. Code‑Point Open → postcode lat/lon.
3. gb-postcodes → polygons for area/district/sector.
4. Output:
   - `data/postcode_points`
   - `data/area_geojson`
   - `data/district_geojson`
   - `data/sector_geojson`

