@echo off
echo ========================================
echo   ScanSan Geospatial Viewer - Setup
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed!
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

echo [1/4] Node.js found: 
node --version
echo.

REM Check if dependencies are installed
if not exist "node_modules\" (
    echo [2/4] Installing dependencies...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo ERROR: npm install failed!
        pause
        exit /b 1
    )
) else (
    echo [2/4] Dependencies already installed
)
echo.

REM Check if .env has Mapbox token
findstr /C:"YOUR_MAPBOX_TOKEN_HERE" .env >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [3/4] WARNING: Mapbox token not configured!
    echo.
    echo Please edit .env file and add your Mapbox token:
    echo   VITE_MAPBOX_TOKEN=pk.YOUR_TOKEN_HERE
    echo.
    echo Get a free token from: https://mapbox.com
    echo.
    set /p continue="Continue anyway? (y/n): "
    if /i not "%continue%"=="y" exit /b 0
) else (
    echo [3/4] Mapbox token configured
)
echo.

echo [4/4] Testing API connection...
node test_api.js
echo.

echo ========================================
echo   Setup Complete!
echo ========================================
echo.
echo To start the development server:
echo   npm run dev
echo.
echo The app will open at http://localhost:3000
echo.
pause
