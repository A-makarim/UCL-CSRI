# UCL-CSRI Real Estate Visualization Platform - Technical Documentation

## 🎯 Core Mechanics

### Overview
An interactive 3D globe visualization platform for UK property market data (2018-2030), featuring:
- **42,121 live property listings** with AI-powered analysis
- **Historical sales data** (2018-2025) with time-series animation
- **Predictive analytics** for future trends (2026-2030)
- **Multi-level geographic insights** (Area/District/Sector)

### Technology Stack
- **Frontend**: Vite + React + Mapbox GL JS v3
- **Backend**: Express.js + Perplexity AI + Cheerio (web scraping)
- **Data Storage**: Cloudflare R2 (3.7 GB JSON files)
- **Deployment**: Render.com (Free tier)

---

## 📂 Project Structure

```
UCL-CSRI/
├── frontend/                    # React application
│   ├── src/
│   │   ├── App.jsx             # Main orchestrator (data loading, timeline)
│   │   ├── components/
│   │   │   ├── MapEngine.jsx   # Mapbox GL renderer
│   │   │   ├── TimeSlider.jsx  # Timeline controls
│   │   │   └── AIChatPanel.jsx # AI analysis interface
│   │   ├── index.css           # Tailwind + custom styles
│   │   └── main.jsx            # React entry point
│   ├── public/                 # Static assets
│   ├── vite.config.js          # Build configuration
│   ├── package.json            # Dependencies
│   └── .env                    # Environment variables
│
├── scripts/                     # Data processing utilities
│   ├── build_polygon_stats.cjs # Generate monthly polygon statistics
│   └── process_listings.js     # Transform raw property data
│
├── outputs/                     # Generated data (gitignored)
│   ├── london_listings_geocoded.json      # 42,121 live properties (32 MB)
│   └── sales_2018_2030_monthly.json       # Historical + predictions
│
├── public/                      # Shared static files
│   └── data/
│       ├── polygon_stats/       # Area/District/Sector stats by month
│       ├── area_geojson/        # Area boundary polygons
│       ├── district_geojson/    # District boundary polygons
│       └── sector_geojson/      # Sector boundary polygons
│
├── server.cjs                   # Express API server
├── render.yaml                  # Deployment configuration
└── .gitignore                   # Excludes outputs/, data/, .env

```

---

## 🔧 Core Functions

### 1. Data Loading & Timeline Management (`App.jsx`)

#### `loadData()` (Lines 75-175)
**Purpose**: Load and prepare multi-year property sales data

**Process**:
1. Fetch `sales_2018_2030_monthly.json` (156 months of data)
2. Sample 4,000 properties per month for performance
3. Build GeoJSON FeatureCollections with properties:
   - `value`: Price (for heatmap intensity)
   - `group`: 0 or 1 (for blend animation)
   - `timelineDate`: Current timeline position (YYYY-MM)
   - `postcode`, `district`, `propType`: Metadata
4. Initialize at January 2018

**Key Logic**:
```javascript
const buildFeatures = (sales, group, timelineDate) =>
  sales.map((sale) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [sale.lng, sale.lat] },
    properties: {
      value: sale.price,
      group,
      timelineDate: timelineDate || sale.date  // Timeline overrides original date
    }
  }));
```

---

#### `handleMonthChange(monthValue)` (Lines 476-498)
**Purpose**: Update visualization when user moves timeline slider

**Parameters**:
- `monthValue`: Integer 1-156 (Jan 2018 = 1, Dec 2030 = 156)

**Process**:
1. Calculate base month and blend value (0-1 between months)
2. Convert month index to YYYY-MM format
3. Trigger data rebuild if base month changes
4. Update polygon blend for year transitions

**Math**:
```javascript
const year = 2018 + Math.floor((monthValue - 1) / 12);  // Year from index
const month = ((monthValue - 1) % 12) + 1;             // Month 1-12
const t = monthValue - Math.floor(monthValue);          // Fractional part for blend
```

---

#### `rebuildGeoForBaseMonth(baseMonth)` (Lines 242-340)
**Purpose**: Rebuild map layers with data for current and next month

**Why needed**: Enables smooth GPU-accelerated blending between months

**Process**:
1. Get data for `baseMonth` and `baseMonth + 1`
2. Create FeatureCollection with:
   - Group 0 features (current month) - opacity fades OUT
   - Group 1 features (next month) - opacity fades IN
3. Update points data based on render mode:
   - **Continuous**: Show all sampled points with smooth transitions
   - **Points**: Year-based blending (January snapshots only)
   - **Polygon**: Load GeoJSON boundaries

**Blending Logic** (in MapEngine):
```javascript
// Opacity interpolation
opacity: ['case',
  ['==', ['get', 'group'], 0], ['interpolate', ['linear'], blend, 0, 1, 1, 0],
  ['==', ['get', 'group'], 1], ['interpolate', ['linear'], blend, 0, 0, 1, 1],
  0.5
]
```

---

### 2. Live Property Management

#### `loadLiveListings()` (Lines 177-233)
**Purpose**: Load 42,121 current property listings for AI analysis

**Data Source**: `outputs/london_listings_geocoded.json`

**Structure**:
```json
{
  "areas": {
    "E09000001": {
      "name": "City of London",
      "saleListings": [
        {
          "sale_price": 850000,
          "bedrooms": 2,
          "bathrooms": 1,
          "latitude": 51.5134,
          "longitude": -0.0938,
          "listing_url": "https://www.zoopla.co.uk/for-sale/details/72067999/",
          "street_address": "1 Example Street, EC1A 1BB"
        }
      ]
    }
  }
}
```

**Process**:
1. Parse JSON with 33 London boroughs
2. Flatten all listings into single array
3. Add required properties:
   - `value: sale_price` (for heatmap)
   - `group: 0` (for blending)
   - `url`, `address`, `bedrooms`, `bathrooms`
4. Create GeoJSON FeatureCollection

**Usage**: Triggered when user clicks "Live" button in Points mode

---

### 3. Map Rendering (`MapEngine.jsx`)

#### `initializeMap()` (Lines 37-90)
**Purpose**: Create Mapbox GL instance with globe projection

**Configuration**:
```javascript
{
  projection: 'globe',           // 3D globe view
  center: [-3.5, 54.5],         // UK center
  zoom: 4,
  pitch: 35,                     // Tilt angle
  bearing: 0,                    // Rotation
  style: 'mapbox://styles/mapbox/dark-v11'
}
```

**Custom Controls**:
- Removes default logo, attribution, zoom buttons
- Scroll wheel zoom only

---

#### Property Click Handlers (Lines 220-285)

**`handlePointClick`** - Opens AI Chat Panel
```javascript
const handlePointClick = (event) => {
  const props = event.features[0].properties;
  
  if (props.url && propertyMode === 'live') {
    // Pass listing data to AI chat
    setSelectedAreaInfo({
      type: 'property',
      name: props.address,
      url: props.url,
      price: props.price,
      bedrooms: props.bedrooms,
      bathrooms: props.bathrooms
    });
    setAiChatOpen(true);
  }
};
```

**`handleHover`** - Shows popup on hover
- **Live mode**: Displays listing details (price, beds, baths, address)
- **Predicted mode**: Shows timeline date, postcode, property type

**Key Fix Applied**: 
```javascript
const date = props.timelineDate || props.date;  // Use timeline date, not original CSV date
```

---

### 4. Polygon Visualization

#### `loadPolygonData()` (Lines 380-470)
**Purpose**: Load and blend area/district/sector polygons by year

**Data Files**:
- `public/data/area_geojson/area_2025.geojson` (33 London boroughs)
- `public/data/district_geojson/district_2025.geojson` (hundreds)
- `public/data/sector_geojson/sector_2025.geojson` (thousands)

**Blending Process**:
1. Load GeoJSON for current year and next year
2. GPU blends fill colors based on `polygonBlend` (0-1)
3. Each polygon has `properties.avgPrice` for color mapping

**Shader Logic**:
```javascript
'fill-color': [
  'interpolate', ['linear'],
  ['get', 'avgPrice'],
  0, '#1a1a2e',        // Dark blue (low)
  500000, '#4f46e5',   // Purple (mid)
  2000000, '#ec4899'   // Pink (high)
]
```

---

### 5. AI Analysis (`AIChatPanel.jsx`)

#### `handleAskAI()` (Lines 118-168)
**Purpose**: Analyze property using Perplexity AI

**API Call**:
```javascript
POST http://localhost:3002/api/ask-ai
Body: {
  query: "Analyze 1 Example St, EC1A 1BB - £850k, 2 bed, 1 bath",
  propertyUrl: "https://www.zoopla.co.uk/for-sale/details/72067999/"
}
```

**Backend Processing** (`server.cjs` Lines 100-155):
1. Extract context from user query
2. Call Perplexity API with property details
3. Return markdown-formatted analysis:
   - Market comparison
   - Location insights
   - Investment potential
   - Price reasonability

---

#### `handleShowPictures()` (Lines 169-228)
**Purpose**: Scrape property images from Zoopla

**API Call**:
```javascript
POST http://localhost:3002/api/scrape-images
Body: { url: "https://www.zoopla.co.uk/for-sale/details/72067999/" }
```

**Backend Scraping** (`server.cjs` Lines 36-73):
1. Fetch HTML with Cheerio
2. Find all `<img>` tags (including lazy-loaded)
3. Extract `src`, `data-src`, `data-srcset` attributes
4. Convert to base64 for CORS-free display
5. Return max 8 images

**Selectors**:
```javascript
$('img, picture source').each((i, elem) => {
  const src = $(elem).attr('src') || 
              $(elem).attr('data-src') || 
              $(elem).attr('data-lazy');
  // Filter out icons, 1x1 pixels, etc.
});
```

---

## 🚀 Running the Project

### Local Development

**1. Prerequisites**
```bash
Node.js 18+
npm
```

**2. Environment Setup**
Create `frontend/.env`:
```env
VITE_MAPBOX_TOKEN=pk.eyJ1IjoiYWJkdWxh...
VITE_API_URL=http://localhost:3002
PERPLEXITY_API_KEY=pplx-YhNymO6...
```

**3. Install Dependencies**
```bash
# Root (backend)
npm install

# Frontend
cd frontend
npm install
```

**4. Start Servers**
```bash
# Terminal 1 - Backend (port 3002)
cd e:\projects\UCL-CSRI
node server.cjs

# Terminal 2 - Frontend (port 3000)
cd e:\projects\UCL-CSRI\frontend
npm run dev
```

**5. Access**
- Frontend: http://localhost:3000
- Backend API: http://localhost:3002

---

### Production Deployment (Render.com)

**1. Data Upload to Cloudflare R2**
```bash
# Authenticate
wrangler login

# Upload files
wrangler r2 object put ucl-csri-data/outputs/london_listings_geocoded.json --file outputs/london_listings_geocoded.json
wrangler r2 object put ucl-csri-data/outputs/sales_2018_2030_monthly.json --file outputs/sales_2018_2030_monthly.json

# Upload polygon data (repeat for area, district, sector)
wrangler r2 object put ucl-csri-data/data/polygon_stats/area/2025-01.json --file public/data/polygon_stats/area/2025-01.json
```

**2. Enable Public Access**
- Dashboard → R2 → ucl-csri-data → Settings
- Public Development URL → Enable
- Type "allow" to confirm

**3. Deploy to Render**
- Dashboard → New → Web Service
- Connect GitHub repo: A-makarim/UCL-CSRI
- **Backend**:
  - Name: `ucl-csri-backend`
  - Build: `npm install`
  - Start: `node server.cjs`
  - Env: `PERPLEXITY_API_KEY`, `NODE_ENV=production`
- **Frontend**:
  - Name: `ucl-csri-frontend`
  - Build: `cd frontend && npm install && npm run build`
  - Publish: `frontend/dist`
  - Env: `VITE_MAPBOX_TOKEN`, `VITE_API_URL=[backend_url]`

**4. Update Data URLs**
Replace all `/outputs/` and `/data/` paths with R2 URL:
```javascript
const response = await fetch('https://pub-b375582ef4bd48298aa679207e05c71b.r2.dev/outputs/sales_2018_2030_monthly.json');
```

---

## 🐛 Common Issues & Fixes

### Issue 1: Popup Shows Wrong Date
**Problem**: Popup displays original CSV date instead of timeline position

**Fix Applied**: Add `timelineDate` property to all features
```javascript
// App.jsx Line 277
const buildFeatures = (sales, group, timelineDate) => ({
  properties: {
    date: sale.date,              // Original
    timelineDate: timelineDate    // Current timeline
  }
});

// MapEngine.jsx Line 193
const date = props.timelineDate || props.date;  // Prefer timeline date
```

---

### Issue 2: All Points Showing Regardless of Timeline
**Problem**: Points mode doesn't filter by current year

**Root Cause**: `resolvePointsSales()` (Line 251) uses fallback logic that shows January data for all future years

**Intended Behavior**:
- **2018-2025**: Show actual historical data for selected month
- **2026-2030**: Always show January snapshot (no monthly granularity for predictions)

**Already Correct**: Points are sampled (2000 per year) to maintain performance

---

### Issue 3: R2 Bucket Returns 404
**Problem**: Public URL not accessible after upload

**Checklist**:
1. ✅ Bucket created: `ucl-csri-data`
2. ✅ Public Development URL enabled (Settings → Enable → Type "allow")
3. ✅ Files uploaded with correct paths
4. ⚠️ Wait 2-5 minutes for CDN propagation

**Test**:
```bash
curl https://pub-b375582ef4bd48298aa679207e05c71b.r2.dev/test.json
```

---

## 📊 Data Pipeline

### Historical Data (2018-2025)
1. **Source**: UK Land Registry Price Paid Data (CSV)
2. **Processing**: `scripts/process_all_years.js`
   - Geocode postcodes to lat/lng
   - Group by month (YYYY-MM)
   - Sample 4,000 properties per month
3. **Output**: `sales_2018_2030_monthly.json` (JSON)

### Live Listings (2026)
1. **Source**: Scansan API (proprietary)
2. **Collection**: `run_collector.bat` (API key required)
3. **Processing**: `scripts/process_listings.js`
   - Flatten nested borough structure
   - Add required GeoJSON properties
4. **Output**: `london_listings_geocoded.json` (32 MB)

### Polygon Boundaries
1. **Source**: ONS Open Geography Portal (GeoJSON)
2. **Processing**: `scripts/build_polygon_stats.cjs`
   - Calculate avg price per area/district/sector
   - Generate 12 monthly snapshots per level
3. **Output**: `public/data/polygon_stats/{level}/{YYYY-MM}.json`

---

## 🎨 Render Modes

### Continuous (Heatmap)
- **Visualization**: Smooth heatmap with color gradient
- **Data**: All sampled points (4,000 per month)
- **Blending**: GPU interpolation between adjacent months
- **Use Case**: Identifying price hotspots over time

### Polygon (Choropleth)
- **Visualization**: Colored area boundaries
- **Levels**: Area (33) → District (100+) → Sector (1000+)
- **Data**: Monthly average prices per polygon
- **Blending**: Year-to-year color transitions
- **Use Case**: Geographic price comparison

### Points (Scatter)
- **Visualization**: Individual property dots
- **Data**: 2,000 properties per year (sampled)
- **Modes**: 
  - **Predicted**: Historical + forecasted (2018-2030)
  - **Live**: Current market listings (42,121)
- **Use Case**: Granular property exploration + AI analysis

---

## 🔐 Security Notes

1. **API Keys**: Never commit `.env` files
2. **Git History**: `run_collector.bat` API key removed via filter-branch
3. **CORS**: Backend configured for production origins
4. **Rate Limiting**: R2 dev URL is rate-limited (use custom domain for production)

---

## 📝 TODOs

- [ ] Add custom Cloudflare domain to R2 bucket
- [ ] Implement server-side caching for AI responses
- [ ] Add user authentication for Live mode
- [ ] Optimize polygon GeoJSON file sizes (topojson)
- [ ] Add property type filters (detached, semi, terraced)
- [ ] Export data views as PNG/CSV

---

## 👥 Contributors

**Lead Developer**: Abdul Azeem Makarim  
**Institution**: University College London (UCL)  
**Project**: CSRI Real Estate Analytics Platform

**Built with**: Vite, React, Mapbox GL JS, Express.js, Perplexity AI, Cloudflare R2

---

*Last Updated: February 1, 2026*
