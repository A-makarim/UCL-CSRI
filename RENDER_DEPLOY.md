# Deploy to Render

Render is perfect for this project because it supports:
- ✅ Long-running Express.js backend
- ✅ Static site hosting for React frontend
- ✅ Free tier available
- ✅ Automatic deployments from GitHub
- ✅ No file size limits (unlike Vercel)

## Quick Deploy

### Option 1: Using Render Blueprint (Recommended)

1. **Push code to GitHub:**
```bash
cd e:\projects\UCL-CSRI
git add .
git commit -m "Add Render deployment config"
git push origin main
```

2. **Deploy on Render:**
   - Go to https://dashboard.render.com
   - Click "New" → "Blueprint"
   - Connect your GitHub repo: `A-makarim/UCL-CSRI`
   - Render will read `render.yaml` and create both services automatically

3. **Set Environment Variables:**
   In Render dashboard, add these for both services:
   
   **Backend Service:**
   - `PERPLEXITY_API_KEY` - Your Perplexity API key
   - `SCANSAN_API_KEY` - Your Scansan API key (optional)
   
   **Frontend Service:**
   - `VITE_MAPBOX_TOKEN` - Your Mapbox token
   - `VITE_API_URL` - Your backend URL (e.g., `https://ucl-csri-backend.onrender.com`)
   - `VITE_SCANSAN_API_KEY` - Your Scansan API key (optional)

4. **Update CORS:**
   Once deployed, update the backend's CORS origin in `server.cjs` to match your frontend URL.

### Option 2: Manual Setup

#### Deploy Backend:

1. Go to https://dashboard.render.com
2. Click "New" → "Web Service"
3. Connect GitHub repo
4. Configure:
   - **Name:** `ucl-csri-backend`
   - **Root Directory:** (leave empty)
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node server.cjs`
   - **Plan:** Free

5. Add environment variables (see above)

#### Deploy Frontend:

1. Click "New" → "Static Site"
2. Connect same GitHub repo
3. Configure:
   - **Name:** `ucl-csri-frontend`
   - **Root Directory:** `frontend`
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `dist`
   - **Plan:** Free

4. Add environment variables (see above)

## Important Configuration

### Update Frontend URLs

After backend is deployed, add to `frontend/.env`:
```
VITE_API_URL=https://your-backend-name.onrender.com
VITE_MAPBOX_TOKEN=your_mapbox_token
VITE_SCANSAN_API_KEY=your_scansan_key
VITE_SCANSAN_BASE_URL=/api/v1
```

### Update Backend CORS

In `server.cjs`, update the CORS origin to your frontend URL:
```javascript
origin: ['https://your-frontend-name.onrender.com']
```

## Testing Locally

Backend:
```bash
cd e:\projects\UCL-CSRI
node server.cjs
```

Frontend:
```bash
cd frontend
npm run dev
```

## Notes:

- ⚠️ **Free tier sleeps after 15 min of inactivity** - First request may be slow
- ✅ **Large files work fine** - No size limits like Vercel
- ✅ **Automatic deploys** - Push to GitHub triggers redeploy
- ✅ **Custom domains** available on paid plans

## Deployment Order:

1. Deploy backend first
2. Copy backend URL
3. Add backend URL to frontend env vars
4. Deploy frontend

Your app will be live at:
- Backend: `https://ucl-csri-backend.onrender.com`
- Frontend: `https://ucl-csri-frontend.onrender.com`
