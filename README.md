# UCL-CSRI Real Estate Visualization Platform

🌍 Interactive 3D globe visualization of UK property market data (2018-2030) with AI-powered analysis.

## 🚀 Quick Start

### Local Development

```bash
# 1. Install dependencies
npm install
cd frontend && npm install

# 2. Configure environment
cp .env.example frontend/.env
# Edit frontend/.env with your API keys

# 3. Start servers
# Terminal 1 - Backend (port 3002)
node server.cjs

# Terminal 2 - Frontend (port 3000)
cd frontend
npm run dev
```

Visit http://localhost:3000

## 📊 Features

- **42,121 Live Property Listings** - Real-time market data with AI analysis
- **Historical Timeline** - 156 months of sales data (2018-2030)
- **3 Render Modes**:
  - 🔥 Continuous (Heatmap)
  - 🗺️ Polygon (Area/District/Sector)
  - 📍 Points (Individual properties)
- **AI Property Analysis** - Perplexity-powered insights
- **Image Scraping** - Automatic property photo extraction
- **Smooth Animations** - GPU-accelerated month-to-month blending

## 🏗️ Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | Vite + React + Mapbox GL JS v3 |
| Backend | Express.js + Perplexity AI |
| Data Storage | Cloudflare R2 (3.7 GB) |
| Deployment | Render.com |
| Styling | Tailwind CSS |

## 📁 Project Structure

```
UCL-CSRI/
├── frontend/          # React app
│   ├── src/
│   │   ├── App.jsx               # Main orchestrator
│   │   └── components/           # MapEngine, TimeSlider, AIChatPanel
│   ├── public/                   # Static assets
│   └── .env                      # API keys
├── server.cjs         # Express API
├── scripts/           # Data processing
├── outputs/           # Generated data (gitignored)
├── public/            # Shared static files
└── AGENT.md           # 📖 **Technical Documentation**
```

## 📖 Documentation

See [**AGENT.md**](AGENT.md) for:
- Complete function documentation
- Data pipeline explanations
- Deployment guide
- Troubleshooting

## 🔧 Environment Variables

### Frontend (`frontend/.env`)
```env
VITE_MAPBOX_TOKEN=your_mapbox_token_here
VITE_API_URL=http://localhost:3002
VITE_DATA_BASE_URL=https://your-data-bucket.s3.region.amazonaws.com
```

## 🐛 Recent Fixes

### ✅ Popup Date Issue (Fixed)
- **Problem**: Popups showed original CSV date instead of timeline position
- **Solution**: Added `timelineDate` property to all features

### ✅ Project Organization (Completed)
- Removed obsolete files (`AGENTS.md`, `VERCEL_DEPLOY.md`, test files)
- Deleted old `src/` and `api/` folders (superseded by `frontend/`)
- Created comprehensive `AGENT.md` documentation

## 🌐 Deployment

### Cloudflare R2 Setup
```bash
wrangler login
wrangler r2 object put ucl-csri-data/outputs/london_listings_geocoded.json --file outputs/london_listings_geocoded.json
```

See [RENDER_DEPLOY.md](RENDER_DEPLOY.md) for full deployment instructions.

## 📝 License

UCL CSRI Research Project

---

**Built by**: Abdul Azeem Makarim  
**Institution**: University College London  
**Last Updated**: February 1, 2026
