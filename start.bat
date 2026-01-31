@echo off
echo Starting ScanSan Geospatial Viewer...
echo.
echo Opening at http://localhost:3000
echo Press Ctrl+C to stop the server
echo.

REM Check if .env has Mapbox token
findstr /C:"YOUR_MAPBOX_TOKEN_HERE" .env >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo.
    echo WARNING: Mapbox token not configured in .env
    echo The map may not load properly!
    echo.
    timeout /t 3 >nul
)

call npm run dev
