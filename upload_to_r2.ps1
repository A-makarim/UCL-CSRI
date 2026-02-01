# Upload UCL-CSRI data to Cloudflare R2
# Instructions: Install Wrangler CLI first: npm install -g wrangler

# Login to Cloudflare
Write-Host "Step 1: Authenticate with Cloudflare..." -ForegroundColor Green
wrangler login

# Upload outputs folder
Write-Host "`nStep 2: Uploading outputs/ folder..." -ForegroundColor Green
Get-ChildItem "e:\projects\UCL-CSRI\outputs" -File | ForEach-Object {
    $fileName = $_.Name
    Write-Host "  Uploading $fileName..."
    wrangler r2 object put "ucl-csri-data/outputs/$fileName" --file $_.FullName
}

# Upload public/data folder (polygon stats and geojson)
Write-Host "`nStep 3: Uploading public/data/ folder..." -ForegroundColor Green
Get-ChildItem "e:\projects\UCL-CSRI\public\data" -Recurse -File | ForEach-Object {
    $relativePath = $_.FullName.Replace("e:\projects\UCL-CSRI\public\data\", "").Replace("\", "/")
    Write-Host "  Uploading data/$relativePath..."
    wrangler r2 object put "ucl-csri-data/data/$relativePath" --file $_.FullName
}

Write-Host "`nUpload complete!" -ForegroundColor Green
Write-Host "Your R2 public URL: https://pub-xxxxx.r2.dev" -ForegroundColor Cyan
Write-Host "Replace xxxxx with your actual subdomain from R2 settings" -ForegroundColor Yellow
