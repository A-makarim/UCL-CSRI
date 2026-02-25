# UCL-CSRI Real Estate Visualization Platform

An interactive visualization platform for exploring UK property market data across time, built as part of a UCL Centre for Spatial and Regional Inquiry research project. The platform combines a geographic map interface with AI-driven property analysis, covering 42,121 live listings and 156 months of historical sales data from 2018 through 2030.

## Overview

The platform lets users explore property price trends across England and Wales at multiple geographic resolutions — from broad postal areas down to individual street-level listings. A built-in AI assistant (powered by Perplexity) answers questions about specific areas or properties based on the underlying data, and an interactive timeline allows scrubbing through historical and projected market conditions month by month.

## Features
- **17 million properties** with geocoded coordinates, price history, and metadata
- **42,121 current listings** with geocoded coordinates, price history, and metadata
- **156-month timeline** spanning 2018 to 2030, with GPU-accelerated interpolation between months
- **Three render modes** selectable at runtime:
  - Heatmap — continuous density and price gradient across the map
  - Polygon — price averages aggregated by postal area, district, or sector
  - Points — individual property markers with popup detail cards
- **AI property analysis** — ask natural-language questions about any area or listing; responses are grounded in the loaded dataset
- **Automatic property image extraction** from listing sources
- **Self-contained frontend** — all map rendering runs client-side via Mapbox GL JS; the backend only handles AI proxy requests

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vite, React, Mapbox GL JS v3, Tailwind CSS |
| Backend | Node.js, Express.js |
| AI | Perplexity AI API |
| Data storage | Amazon S3 |

## Project Structure

```
UCL-CSRI/
├── frontend/
│   ├── src/
│   │   ├── App.jsx           # Top-level component and state orchestration
│   │   └── components/       # MapEngine, TimeSlider, AIChatPanel, and others
│   └── .env                  # Frontend environment variables (not committed)
├── server.cjs                # Express API server (AI proxy)
├── scripts/                  # Data processing and upload utilities
├── public/                   # Shared static assets
└── AGENT.md                  # Detailed technical documentation
```

## Getting Started

### Prerequisites

- Node.js 18 or later
- A Mapbox account with a public token
- A Perplexity API key
- Access to the hosted data bucket (Amazon S3) or a local copy of the data files

### Installation

```bash
# Install root dependencies
npm install

# Install frontend dependencies
cd frontend && npm install
```

### Configuration

Copy the example environment file and fill in your credentials:

```bash
cp .env.example frontend/.env
```

The following variables are required in `frontend/.env`:

```env
VITE_MAPBOX_TOKEN=your_mapbox_token_here
VITE_API_URL=http://localhost:3002
VITE_DATA_BASE_URL=https://your-bucket-url
```

`VITE_DATA_BASE_URL` should point to the root of the s3 bucket (or a local static server) where the processed data files are hosted. The frontend fetches GeoJSON and listing data from this URL at runtime.

### Running Locally

Start the backend and frontend in separate terminals:

```bash
# Terminal 1 — backend API server (port 3002)
node server.cjs

# Terminal 2 — frontend dev server (port 3000)
cd frontend
npm run dev
```

Open `http://localhost:3000` in your browser.

## Documentation

See [AGENT.md](AGENT.md) for a full technical reference, including component-level function documentation, the data pipeline used to process and geocode raw listing CSVs, and notes on the rendering architecture.

## License

UCL CSRI Research Project

---

**Author**: Abdul Azeem Makarim  
**Institution**: University College London  
**Last Updated**: February 2026
