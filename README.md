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
- Generated map layers and monthly stats live in `data/`
