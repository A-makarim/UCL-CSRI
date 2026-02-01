/**
 * Main App Component
 * Orchestrates all components and manages state
 * Default View: London (2019-2035 timeline)
 */

import React, { useState, useEffect } from 'react';
import MapEngine from './components/MapEngine';
import TimeSlider from './components/TimeSlider';
import LoadingScreen from './components/LoadingScreen';
import DataService from './services/DataService';
import apiClient from './services/apiClient';
import PredictiveForecaster from './services/PredictiveForecaster';
import { buildMultiAreaGeoJSON, LONDON_AREA_CODES } from './services/GeoJSONBuilder';

function App() {
  // State management
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('Initializing...');
  
  const [activeMonth, setActiveMonth] = useState(1); // January 2025 (1-12)
  const [salesData2025, setSalesData2025] = useState(null);
  const [selectedVariable, setSelectedVariable] = useState('market_value');
  const [viewMode, setViewMode] = useState('forecast'); // 'forecast', 'sale_listings', 'rent_listings'
  const [geoData, setGeoData] = useState(null);
  const [forecasts, setForecasts] = useState({});
  const [areaStats, setAreaStats] = useState(null);
  const [listingsData, setListingsData] = useState(null);
  const [apiStatus, setApiStatus] = useState({
    baseURL: apiClient?.defaults?.baseURL,
    tokenPresent: !!import.meta.env.VITE_SCANSAN_API_KEY,
    lastCheck: null,
    lastError: null,
    lastStatus: null
  });

  // London area codes to load (subset for performance)
  const DEFAULT_AREAS = ['W1', 'W2', 'W6', 'W8', 'W11', 'SW1', 'SW3', 'SW7', 'NW1', 'NW3', 'E1', 'E14', 'SE1'];

  /**
   * Initialize app - fetch data and generate forecasts
   */
  useEffect(() => {
    const initializeApp = async () => {
      try {
        setLoadingMessage('Fetching market data from ScanSan API...');
        setLoadingProgress(10);

        const forecastData = {};
        const totalAreas = DEFAULT_AREAS.length;

        // API diagnostic (browser-side)
        try {
          const diag = await apiClient.diagnose('/district/W6/growth');
          setApiStatus((prev) => ({
            ...prev,
            lastCheck: new Date().toISOString(),
            lastStatus: diag?.status ?? null,
            lastError: diag?.success ? null : diag?.error
          }));
        } catch (error) {
          setApiStatus((prev) => ({
            ...prev,
            lastCheck: new Date().toISOString(),
            lastStatus: error?.response?.status ?? null,
            lastError: error?.message ?? 'API diagnostic failed'
          }));
        }

        let successCount = 0;
        // Fetch data for each area
        for (let i = 0; i < DEFAULT_AREAS.length; i++) {
          const areaCode = DEFAULT_AREAS[i];
          setLoadingMessage(`Loading ${areaCode} (${i + 1}/${totalAreas})...`);
          setLoadingProgress(10 + (i / totalAreas) * 60);

          try {
            const marketData = await DataService.getMarketValue(areaCode);
            
            if (marketData && marketData.timeseries.length > 0) {
              // Generate forecast (historical: 2019-2025, future: 2026-2035)
              const forecast = PredictiveForecaster.generateForecast(
                marketData.timeseries,
                10 // 10 years future prediction
              );
              
              forecastData[areaCode] = forecast;
              successCount += 1;
              console.log(`✅ ${areaCode}: ${forecast.historical.length} historical + ${forecast.future.length} predicted`);
            }
          } catch (error) {
            console.error(`Failed to load ${areaCode}:`, error.message);
          }

          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log('✅ Forecast data ready:', {
          areaCount: Object.keys(forecastData).length,
          sampleArea: Object.keys(forecastData)[0],
          sampleForecast: forecastData[Object.keys(forecastData)[0]]
        });
        // Fallback: ensure at least one area to visualize
        if (successCount === 0) {
          console.warn('⚠️ No areas loaded. Attempting fallback for W6...');
          try {
            const fallbackData = await DataService.getMarketValue('W6');
            if (fallbackData?.timeseries?.length > 0) {
              const fallbackForecast = PredictiveForecaster.generateForecast(
                fallbackData.timeseries,
                10
              );
              forecastData['W6'] = fallbackForecast;
              successCount = 1;
              console.log('✅ Fallback W6 loaded');
            }
          } catch (fallbackError) {
            console.error('❌ Fallback W6 failed:', fallbackError.message);
          }
        }

        console.log('📈 Areas loaded:', successCount);
        setForecasts(forecastData);
        setLoadingMessage('Generating geospatial layers...');
        setLoadingProgress(80);

        // Generate initial GeoJSON
        console.log('🎨 Generating initial GeoJSON for year:', activeYear);
        const initialGeoJSON = buildMultiAreaGeoJSON(forecastData, activeYear);
        console.log('📊 GeoJSON generated:', {
          type: initialGeoJSON.type,
          featureCount: initialGeoJSON.features?.length,
          sampleFeature: initialGeoJSON.features?.[0]
        });
        setGeoData(initialGeoJSON);
        if (typeof window !== 'undefined') {
          window.__GEO_DATA__ = initialGeoJSON;
          window.__FORECASTS__ = forecastData;
        }

        // Calculate stats
        calculateStats(forecastData, activeYear);

        setLoadingProgress(100);
        setLoadingMessage('Ready!');

        setTimeout(() => setLoading(false), 500);

      } catch (error) {
        console.error('Initialization failed:', error);
        setLoadingMessage(`Error: ${error.message}`);
        setTimeout(() => setLoading(false), 2000);
      }
    };

    initializeApp();
  }, []);

  /**
   * Load listings data from JSON file
   */
  useEffect(() => {
    const loadListings = async () => {
      try {
        // Try to load geocoded version first, fallback to original
        let response;
        try {
          response = await fetch('/outputs/london_listings_geocoded.json');
          if (!response.ok) throw new Error('Geocoded file not found');
          console.log('📍 Loading geocoded listings...');
        } catch {
          console.log('⚠️ Geocoded file not found, loading original...');
          response = await fetch('/outputs/london_listings.json');
        }
        
        const data = await response.json();
        setListingsData(data);
        
        // Count geocoded properties
        let totalGeocoded = 0;
        let totalProperties = 0;
        Object.values(data.areas || {}).forEach(area => {
          ['saleListings', 'rentListings'].forEach(type => {
            (area[type] || []).forEach(listing => {
              totalProperties++;
              if (listing.latitude && listing.longitude) totalGeocoded++;
            });
          });
        });
        
        console.log('✅ Listings loaded:', {
          areas: Object.keys(data.areas || {}).length,
          totalProperties,
          geocoded: totalGeocoded,
          geocodedPercent: ((totalGeocoded / totalProperties) * 100).toFixed(1) + '%'
        });
      } catch (error) {
        console.error('Failed to load listings:', error);
      }
    };
    loadListings();
  }, []);

  /**
   * Update GeoJSON when year changes
   */
  useEffect(() => {
    if (Object.keys(forecasts).length === 0) return;

    console.log('🔄 Year changed to:', activeYear);
    const newGeoJSON = buildMultiAreaGeoJSON(forecasts, activeYear);
    setGeoData(newGeoJSON);
    if (typeof window !== 'undefined') {
      window.__GEO_DATA__ = newGeoJSON;
    }
    calculateStats(forecasts, activeYear);

  }, [activeYear, forecasts]);

  /**
   * Calculate statistics for current view
   */
  const calculateStats = (forecastData, year) => {
    const values = [];
    
    for (const forecast of Object.values(forecastData)) {
      const allData = [...forecast.historical, ...forecast.future];
      const yearData = allData.find(d => d.year === year);
      if (yearData) {
        values.push(yearData.value);
      }
    }

    if (values.length === 0) return;

    const avgValue = values.reduce((sum, v) => sum + v, 0) / values.length;
    
    // Calculate trend (compare to previous year)
    const prevYearValues = [];
    for (const forecast of Object.values(forecastData)) {
      const allData = [...forecast.historical, ...forecast.future];
      const prevYearData = allData.find(d => d.year === year - 1);
      if (prevYearData) {
        prevYearValues.push(prevYearData.value);
      }
    }

    let trend = 0;
    if (prevYearValues.length > 0) {
      const prevAvg = prevYearValues.reduce((sum, v) => sum + v, 0) / prevYearValues.length;
      trend = ((avgValue - prevAvg) / prevAvg * 100).toFixed(1);
    }

    setAreaStats({
      areas: Object.keys(forecastData).length,
      avgValue: Math.round(avgValue),
      trend: parseFloat(trend),
      minValue: Math.min(...values),
      maxValue: Math.max(...values)
    });
  };

  /**
   * Handle view mode change (forecast vs listings)
   */
  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    console.log(`View mode changed to: ${mode}`);
  };

  /**
   * Handle year change from slider
   */
  const handleYearChange = (year) => {
    setActiveYear(year);
  };

  /**
   * Handle variable change from sidebar
   */
  const handleVariableChange = (variable) => {
    setSelectedVariable(variable);
    // TODO: Fetch different data based on variable
    // For now, we only have market_value data
    console.log(`Variable changed to: ${variable}`);
  };

  // Loading screen
  if (loading) {
    return <LoadingScreen progress={loadingProgress} message={loadingMessage} />;
  }

  // Main render
  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      {/* 3D Globe - Full Screen */}
      <MapEngine
        geoData={geoData}
        selectedVariable="price"
        activeMonth={activeMonth}
      />
      
      {/* Sleek Time Slider at Bottom */}
      <TimeSlider
        activeMonth={activeMonth}
        onMonthChange={handleMonthChange}
        minMonth={1}
        maxMonth={12}
      />
    </div>
  );
}

export default App;
