# Deployment Instructions

## ⚠️ IMPORTANT: Large Files Warning

Your project has large data files that exceed Vercel's 250MB deployment limit:
- CSV files (2018-2025.csv, bulk predictions)
- outputs/sales_2018_2030_monthly.json
- outputs/london_listings_geocoded.json

**You need to host these files externally before deploying to Vercel.**

## Options for Large Files:

### Option 1: GitHub LFS + CDN (Recommended)
```bash
# Install Git LFS
git lfs install

# Track large files
git lfs track "*.csv"
git lfs track "outputs/*.json"

# Commit .gitattributes
git add .gitattributes
git commit -m "Add Git LFS tracking"

# Use jsDelivr CDN to serve from GitHub
# Files will be at: https://cdn.jsdelivr.net/gh/A-makarim/UCL-CSRI@main/outputs/file.json
```

### Option 2: AWS S3 / CloudFlare R2
Upload files to S3 and update fetch URLs in code.

### Option 3: Vercel Blob Storage
```bash
npm install @vercel/blob
# Upload files to Vercel Blob, get URLs
```

## Deploy to Vercel

### 1. Install Vercel CLI
```bash
npm install -g vercel
```

### 2. Login to Vercel
```bash
vercel login
```

### 3. Set Environment Variables
In Vercel dashboard, add:
- `VITE_MAPBOX_TOKEN` - Your Mapbox token
- `VITE_SCANSAN_API_KEY` - Your Scansan API key
- `PERPLEXITY_API_KEY` - Your Perplexity API key

### 4. Deploy
```bash
vercel
```

For production:
```bash
vercel --prod
```

## What Changed for Vercel:

✅ Created `/api` folder with serverless functions:
  - `api/ask-ai.js` - AI chat endpoint
  - `api/scrape-images.js` - Image scraping endpoint

✅ Created `vercel.json` configuration

✅ Updated frontend API calls from `http://localhost:3002/api/*` to `/api/*`

✅ Created root `package.json` for deployment

## Local Development (Still Works):

Backend server:
```bash
cd e:\projects\UCL-CSRI
node server.cjs
```

Frontend:
```bash
cd frontend
npm run dev
```

## Next Steps:

1. **Handle large data files** (see options above)
2. **Test locally** - `vercel dev` to test serverless functions
3. **Add environment variables** in Vercel dashboard
4. **Deploy** with `vercel --prod`
