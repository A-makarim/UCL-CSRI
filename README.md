# UCL-CSRI — UK Property Heatmap

Explore monthly price trends with polygon layers (area/district/sector), postcode dots, a smooth heatmap option, and an AI assistant for quick area insights.

## Setup
1) Frontend deps:
```
cd frontend
npm install
```

2) Environment:
- Set `VITE_MAPBOX_TOKEN` in `.env`
- Optional: `PERPLEXITY_API_KEY` for the AI assistant

## Run (dev)
1) Frontend:
```
cd frontend
npm run dev
```

2) Backend:
```
cd backend
python main.py
```

The map loads from the backend and uses data in `data/`.

## Data notes
- Source PPD CSVs live in `PPD/`
- Predictions (2026-2030) live in `predictions/`
- Live listings snapshot lives in `live/london_listings_geocoded.json` (gitignored; optional)
- Generated map layers and monthly stats live in `data/`:
  - `data/historical/...` (<= 2025)
  - `data/predicted/...` (2026-2030)
  - `data/live/listings/listings.geojson` (current listings points; built from the live snapshot)

## Build data
Generate `data/historical` + `data/predicted` (+ live listings if available):
```
python scripts/build_geojson.py
```

Important: polygon boundaries come from the longair GB postcodes dataset. Put it in either:
- `gb-postcodes-v5/` (with `areas/`, `districts/`, `sectors/`), or
- `gb-postcodes/gb-postcodes-v5/` (same structure)
