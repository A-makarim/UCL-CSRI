/**
 * Main App Component - 2025 Monthly Sales Visualization
 * Timeline: January - December 2025
 */

import React, { useState, useEffect } from 'react';
import MapEngine from './components/MapEngine';
import TimeSlider from './components/TimeSlider';

function App() {
  const [loading, setLoading] = useState(false);
  
  const [activeMonth, setActiveMonth] = useState(1); // continuous in [1..84] for 2018-2024
  const [baseMonthInt, setBaseMonthInt] = useState(1);
  const [monthBlend, setMonthBlend] = useState(0); // 0..1 between baseMonthInt and next
  const [salesData2025, setSalesData2025] = useState(null);
  const [geoData, setGeoData] = useState(null);
  const [areaStats, setAreaStats] = useState(null);

  const [monthSamples, setMonthSamples] = useState(null);
  const [mapInstance, setMapInstance] = useState(null);

  const [hasSearched, setHasSearched] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [targetLocation, setTargetLocation] = useState(null);
  const [isFocused, setIsFocused] = useState(false);
  const [barReady, setBarReady] = useState(false);
  const [showBarText, setShowBarText] = useState(false);
  const [isCollapsing, setIsCollapsing] = useState(false);

  // Load 2018-2024 sales data
  useEffect(() => {
    if (!hasSearched) return;
    const loadData = async () => {
      try {
        setLoading(true);

        const response = await fetch('/outputs/sales_2018_2024_monthly.json');
        const data = await response.json();
        
        console.log('📦 Loaded Multi-Year Sales:', data.meta.totalSamples.toLocaleString(), 'samples');
        
        setSalesData2025(data);

        // Pre-sample a fixed number of points per month for smooth playback
        const SAMPLE_PER_MONTH = 4000;
        const samples = {};
        Object.keys(data.months).forEach((monthKey) => {
          samples[monthKey] = data.months[monthKey].slice(0, SAMPLE_PER_MONTH);
        });
        setMonthSamples(samples);

        const buildFeatures = (sales, group) =>
          sales.map((sale) => ({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [sale.lng, sale.lat]
            },
            properties: {
              value: sale.price, // MapEngine expects 'value' property
              group,
              price: sale.price,
              postcode: sale.postcode,
              address: sale.address,
              district: sale.district,
              propType: sale.propType,
              date: sale.date
            }
          }));

        const janKey = '2018-01';
        const febKey = '2018-02';
        setBaseMonthInt(1);
        setMonthBlend(0);
        const geoJSON = {
          type: 'FeatureCollection',
          features: [
            ...buildFeatures(samples[janKey] || [], 0),
            ...buildFeatures(samples[febKey] || [], 1)
          ]
        };
        
        console.log('🗺️ January 2018 (blend-ready):', (data.months[janKey]?.length || 0).toLocaleString(), 'sales');
        console.log('   Visualizing:', geoJSON.features.length.toLocaleString(), 'properties');
        
        setGeoData(geoJSON);
        
        // Calculate price statistics
        const prices = (data.months[janKey] || []).map(s => s.price);
        setAreaStats({
          minValue: Math.min(...prices),
          maxValue: Math.max(...prices),
          avgValue: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
        });

        setLoading(false);
        
        console.log('✨ Ready! Slide through 2018-2024 (84 months)');
      } catch (error) {
        console.error('❌ Error loading data:', error);
        setLoading(false);
      }
    };

    loadData();
  }, [hasSearched]);

  const rebuildGeoForBaseMonth = (baseMonth) => {
    if (!monthSamples || !salesData2025) return;

    // Convert month index (1-84) to year-month key
    const getMonthKey = (monthIdx) => {
      const year = 2018 + Math.floor((monthIdx - 1) / 12);
      const month = ((monthIdx - 1) % 12) + 1;
      return `${year}-${String(month).padStart(2, '0')}`;
    };

    const nextMonth = baseMonth === 84 ? 1 : baseMonth + 1;
    const baseKey = getMonthKey(baseMonth);
    const nextKey = getMonthKey(nextMonth);
    const baseSales = monthSamples[baseKey] || [];
    const nextSales = monthSamples[nextKey] || [];

    const buildFeatures = (sales, group) =>
      sales.map((sale) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [sale.lng, sale.lat]
        },
        properties: {
          value: sale.price,
          group,
          price: sale.price,
          postcode: sale.postcode,
          address: sale.address,
          district: sale.district,
          propType: sale.propType,
          date: sale.date
        }
      }));

    setGeoData({
      type: 'FeatureCollection',
      features: [...buildFeatures(baseSales, 0), ...buildFeatures(nextSales, 1)]
    });

    const baseMonthData = salesData2025.months[baseKey] || [];
    if (baseMonthData.length) {
      const prices = baseMonthData.map((s) => s.price);
      setAreaStats({
        minValue: Math.min(...prices),
        maxValue: Math.max(...prices),
        avgValue: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
      });
    }
  };

  // Handle timeline changes (continuous in [1..84] for 2018-2024)
  const handleMonthChange = (monthValue) => {
    if (!salesData2025 || !monthSamples) return;

    const clamped = Math.max(1, Math.min(84, monthValue));
    setActiveMonth(clamped);

    const baseMonth = Math.max(1, Math.min(84, Math.floor(clamped)));
    const t = clamped - baseMonth;

    setMonthBlend(Math.max(0, Math.min(1, t)));

    if (baseMonth !== baseMonthInt) {
      setBaseMonthInt(baseMonth);
      rebuildGeoForBaseMonth(baseMonth);
    }
  };

  useEffect(() => {
    if (!mapInstance || !targetLocation) return;

    const { center, bbox } = targetLocation;

    mapInstance.stop();
    mapInstance.jumpTo({
      center: [0, 20],
      zoom: 0.8,
      bearing: 0,
      pitch: 0
    });

    const timeout = setTimeout(() => {
      mapInstance.setPitch(0);
      if (bbox && bbox.length === 4) {
        mapInstance.fitBounds(
          [
            [bbox[0], bbox[1]],
            [bbox[2], bbox[3]]
          ],
          { padding: 60, duration: 2400, easing: (t) => t * (2 - t) }
        );
      } else {
        mapInstance.flyTo({ center, zoom: 6, duration: 2400, easing: (t) => t * (2 - t) });
      }
    }, 1800);

    return () => clearTimeout(timeout);
  }, [mapInstance, targetLocation]);

  const handleSearchSubmit = async (event) => {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    setIsSearching(true);
    setSearchError('');
    setIsCollapsing(true);

    try {
      const token = import.meta.env.VITE_MAPBOX_TOKEN;
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&limit=1`;
      const response = await fetch(url);
      const data = await response.json();

      if (!data?.features?.length) {
        setSearchError('No results found. Try a different place.');
        setIsSearching(false);
        return;
      }

      const feature = data.features[0];
      setTimeout(() => {
        setTargetLocation({ center: feature.center, bbox: feature.bbox || null });
        setHasSearched(true);
      }, 800);
    } catch (error) {
      console.error('Search error:', error);
      setSearchError('Search failed. Check your connection.');
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (hasSearched) return;
    const openTimer = setTimeout(() => setBarReady(true), 300);
    const textTimer = setTimeout(() => setShowBarText(true), 900);
    return () => {
      clearTimeout(openTimer);
      clearTimeout(textTimer);
    };
  }, [hasSearched]);

  if (!hasSearched) {
    return (
      <div className="relative w-full h-screen bg-black overflow-hidden flex items-center justify-center">
        <form
          onSubmit={handleSearchSubmit}
          className="w-full max-w-xl px-6"
        >
          <div
            className={`mx-auto flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-5 py-2 shadow-2xl backdrop-blur-md transition-all duration-700 origin-center ${
              isCollapsing
                ? 'scale-x-0 opacity-0'
                : isFocused
                  ? 'w-full'
                  : barReady
                    ? 'w-3/4'
                    : 'w-1/3'
            }`}
          >
            <span className={`text-white/60 text-sm transition-opacity duration-500 ${showBarText ? 'opacity-100' : 'opacity-0'}`}>
              Search
            </span>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Enter a city, postcode, or country"
              className={`flex-1 bg-transparent text-white placeholder-white/30 outline-none transition-opacity duration-500 ${showBarText ? 'opacity-100' : 'opacity-0'}`}
            />
            <button
              type="submit"
              disabled={isSearching}
              className={`rounded-full bg-white/10 px-4 py-1.5 text-sm text-white hover:bg-white/20 transition disabled:opacity-50 transition-opacity duration-500 ${showBarText ? 'opacity-100' : 'opacity-0'}`}
            >
              {isSearching ? 'Searching…' : 'Go'}
            </button>
          </div>
          {searchError && (
            <div className="mt-3 text-center text-sm text-red-300">
              {searchError}
            </div>
          )}
        </form>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      <MapEngine
        geoData={geoData}
        selectedVariable="price"
        activeMonth={activeMonth}
        blend={monthBlend}
        onMapLoad={setMapInstance}
      />
      <div
        className={`absolute bottom-0 left-0 right-0 transition-all duration-700 ease-out ${
          hasSearched ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
        }`}
      >
        <TimeSlider
          activeMonth={activeMonth}
          onMonthChange={handleMonthChange}
          minMonth={1}
          maxMonth={84}
          startYear={2018}
          endYear={2024}
        />
      </div>
      {loading && (
        <div className="absolute top-4 left-4 text-xs text-white/50">
          Loading data…
        </div>
      )}
    </div>
  );
}

export default App;
