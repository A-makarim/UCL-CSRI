/**
 * Main App Component - 2018-2030 Monthly Sales + Predictions Visualization
 */

import React, { useState, useEffect } from 'react';
import MapEngine from './components/MapEngine';
import TimeSlider from './components/TimeSlider';
import AIChatPanel from './components/AIChatPanel';

function App() {
  const START_YEAR = 2018;
  const END_YEAR = 2030;
  const TOTAL_MONTHS = (END_YEAR - START_YEAR + 1) * 12;
  const [loading, setLoading] = useState(false);
  
  const [activeMonth, setActiveMonth] = useState(1); // continuous in [1..TOTAL_MONTHS]
  const [baseMonthInt, setBaseMonthInt] = useState(1);
  const [monthBlend, setMonthBlend] = useState(0); // 0..1 between baseMonthInt and next
  const [pointsBlend, setPointsBlend] = useState(0); // Year-based blend for points
  const [salesData2025, setSalesData2025] = useState(null);
  const [geoData, setGeoData] = useState(null);
  const [areaStats, setAreaStats] = useState(null);
  const [pointsData, setPointsData] = useState(null);

  const [monthSamples, setMonthSamples] = useState(null);
  const [mapInstance, setMapInstance] = useState(null);

  const [renderMode, setRenderMode] = useState('continuous');
  const [polygonGeoData, setPolygonGeoData] = useState(null);
  const [polygonNextGeoData, setPolygonNextGeoData] = useState(null);
  const [polygonPointsData, setPolygonPointsData] = useState(null);
  const [polygonError, setPolygonError] = useState('');
  const [polygonMonths, setPolygonMonths] = useState([]);
  const [polygonLevel, setPolygonLevel] = useState('area');
  const [polygonBlend, setPolygonBlend] = useState(0);
  const [polygonStats, setPolygonStats] = useState(null);
  const [polygonStatsMonth, setPolygonStatsMonth] = useState('');
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [aiChatCollapsed, setAiChatCollapsed] = useState(false);
  const [selectedAreaInfo, setSelectedAreaInfo] = useState(null);
  const [propertyMode, setPropertyMode] = useState('predicted'); // 'predicted' or 'live'
  const [liveListings, setLiveListings] = useState(null);
  const [livePointsData, setLivePointsData] = useState(null);

  const polygonLevels = {
    area: { dir: 'area_geojson', prefix: 'area', label: 'Area' },
    district: { dir: 'district_geojson', prefix: 'district', label: 'District' },
    sector: { dir: 'sector_geojson', prefix: 'sector', label: 'Sector' }
  };

  const parseJsonResponse = async (response, label) => {
    const contentType = response.headers.get('content-type') || '';
    const raw = await response.text();
    if (!raw || raw.trim().startsWith('<')) {
      throw new Error(`Missing polygon data (${label})`);
    }
    if (!contentType.includes('json')) {
      throw new Error(`Unexpected response for ${label}`);
    }
    return JSON.parse(raw);
  };

  // Calculate current timeline date from activeMonth value
  const getCurrentTimelineDate = () => {
    const year = START_YEAR + Math.floor((activeMonth - 1) / 12);
    const month = Math.floor(((activeMonth - 1) % 12)) + 1;
    return `${year}-${String(month).padStart(2, '0')}`;
  };

  const [hasSearched, setHasSearched] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [targetLocation, setTargetLocation] = useState(null);
  const [isFocused, setIsFocused] = useState(false);
  const [barReady, setBarReady] = useState(false);
  const [showBarText, setShowBarText] = useState(false);
  const [isCollapsing, setIsCollapsing] = useState(false);

  // Load 2018-2030 sales + predictions data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        const response = await fetch('/outputs/sales_2018_2030_monthly.json');
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

        const buildFeatures = (sales, group, timelineDate) =>
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
              date: sale.date,
              timelineDate: timelineDate || sale.date
            }
          }));

        const janKey = '2018-01';
        const febKey = '2018-02';
        setBaseMonthInt(1);
        setMonthBlend(0);
        const geoJSON = {
          type: 'FeatureCollection',
          features: [
            ...buildFeatures(samples[janKey] || [], 0, janKey),
            ...buildFeatures(samples[febKey] || [], 1, febKey)
          ]
        };
        
        console.log('🗺️ January 2018 (blend-ready):', (data.months[janKey]?.length || 0).toLocaleString(), 'sales');
        console.log('   Visualizing:', geoJSON.features.length.toLocaleString(), 'properties');
        
        setGeoData(geoJSON);

        const pickRandom = (items, count) => {
          if (!items.length) return [];
          const picked = new Array(Math.min(count, items.length));
          const used = new Set();
          let i = 0;
          while (i < picked.length) {
            const idx = Math.floor(Math.random() * items.length);
            if (used.has(idx)) continue;
            used.add(idx);
            picked[i] = items[idx];
            i += 1;
          }
          return picked;
        };
        
        // Use year-based sampling for smoother transitions
        const year1Samples = pickRandom(samples[janKey] || [], 2000);
        const year2Samples = pickRandom(samples[febKey] || [], 2000);
        
        setPointsData({
          type: 'FeatureCollection',
          features: [
            ...buildFeatures(year1Samples, 0, janKey),
            ...buildFeatures(year2Samples, 1, febKey)
          ]
        });
        
        // Calculate price statistics
        const prices = (data.months[janKey] || []).map(s => s.price);
        setAreaStats({
          minValue: Math.min(...prices),
          maxValue: Math.max(...prices),
          avgValue: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
        });

        setLoading(false);
        
        console.log(`✨ Ready! Slide through ${START_YEAR}-${END_YEAR} (${TOTAL_MONTHS} months)`);
      } catch (error) {
        console.error('❌ Error loading data:', error);
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Load live listings data
  useEffect(() => {
    const loadLiveListings = async () => {
      try {
        const response = await fetch('/outputs/london_listings_geocoded.json');
        const data = await response.json();
        
        // Flatten all listings from all areas into a single array
        const allListings = [];
        Object.keys(data.areas).forEach(areaCode => {
          const areaListings = data.areas[areaCode].saleListings || [];
          areaListings.forEach(listing => {
            if (listing.latitude && listing.longitude) {
              allListings.push({
                ...listing,
                areaCode
              });
            }
          });
        });
        
        setLiveListings(allListings);
        
        // Build GeoJSON for live properties
        const liveFeatures = allListings.map(listing => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [listing.longitude, listing.latitude]
          },
          properties: {
            value: listing.sale_price, // MapEngine expects 'value' property for heatmap
            price: listing.sale_price,
            bedrooms: listing.bedrooms,
            bathrooms: listing.bathrooms,
            address: listing.street_address,
            url: listing.listing_url,
            areaCode: listing.area_code_district,
            propertySize: listing.property_size,
            sizeMetric: listing.property_size_metric,
            pricePerSqm: listing.price_per_sqm,
            group: 0 // Single group for live data (no blending needed)
          }
        }));
        
        setLivePointsData({
          type: 'FeatureCollection',
          features: liveFeatures
        });
        
        console.log(`🏠 Loaded ${allListings.length} live property listings`);
      } catch (error) {
        console.error('❌ Error loading live listings:', error);
      }
    };

    loadLiveListings();
  }, []);

  const getMonthKey = (monthIdx) => {
    const year = START_YEAR + Math.floor((monthIdx - 1) / 12);
    const month = ((monthIdx - 1) % 12) + 1;
    return `${year}-${String(month).padStart(2, '0')}`;
  };

  const rebuildGeoForBaseMonth = (baseMonth) => {
    if (!monthSamples || !salesData2025) return;

    const baseKey = getMonthKey(baseMonth);
    const nextMonth = Math.min(TOTAL_MONTHS, baseMonth + 1);
    const nextKey = getMonthKey(nextMonth);
    const baseSales = monthSamples[baseKey] || [];
    const nextSales = monthSamples[nextKey] || [];

    const resolvePointsSales = (monthKey) => {
      // For prediction years (2026+), always use January data to keep points fixed
      const year = parseInt(monthKey.substring(0, 4));
      if (year >= 2026) {
        const janKey = `${year}-01`;
        const janData = monthSamples[janKey] || [];
        if (janData.length) return janData;
      }
      
      // For historical years, use actual month data
      const direct = monthSamples[monthKey] || [];
      if (direct.length) return direct;
      
      // Fallback: find any month with same suffix from any year
      const monthSuffix = monthKey.slice(5);
      const fallbackKey = Object.keys(monthSamples).find(
        (key) => key.endsWith(`-${monthSuffix}`) && (monthSamples[key]?.length || 0) > 0
      );
      return fallbackKey ? monthSamples[fallbackKey] : [];
    };

    const buildFeatures = (sales, group, timelineDate) =>
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
          date: sale.date, // Original date from data
          timelineDate: timelineDate || sale.date // Current timeline date
        }
      }));

    setGeoData({
      type: 'FeatureCollection',
      features: [...buildFeatures(baseSales, 0, baseKey), ...buildFeatures(nextSales, 1, nextKey)]
    });

    const pickRandom = (items, count) => {
      if (!items.length) return [];
      const picked = new Array(Math.min(count, items.length));
      const used = new Set();
      let i = 0;
      while (i < picked.length) {
        const idx = Math.floor(Math.random() * items.length);
        if (used.has(idx)) continue;
        used.add(idx);
        picked[i] = items[idx];
        i += 1;
      }
      return picked;
    };
    if (renderMode === 'points') {
      // Year-based points blending
      const baseYear = START_YEAR + Math.floor((baseMonthInt - 1) / 12);
      const nextYear = Math.min(END_YEAR, baseYear + 1);
      
      const currentYearKey = `${baseYear}-01`;
      const nextYearKey = `${nextYear}-01`;
      
      const currentYearSales = monthSamples[currentYearKey] || [];
      const nextYearSales = monthSamples[nextYearKey] || [];
      
      const currentSampled = pickRandom(currentYearSales, 2000);
      const nextSampled = pickRandom(nextYearSales, 2000);
      
      setPointsData({
        type: 'FeatureCollection',
        features: [
          ...buildFeatures(currentSampled, 0, currentYearKey),
          ...buildFeatures(nextSampled, 1, nextYearKey)
        ]
      });
    } else if (renderMode === 'continuous') {
      const pointsSales = resolvePointsSales(baseKey);
      // Show ALL points instead of sampling to maintain consistency across years
      setPointsData({
        type: 'FeatureCollection',
        features: buildFeatures(pointsSales, 0, baseKey)
      });
    }

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

  useEffect(() => {
    if (renderMode === 'continuous') {
      setPolygonGeoData(null);
      setPolygonPointsData(null);
      setPolygonError('');
      setPolygonMonths([]);
      return;
    }

    const controller = new AbortController();

    const loadIndexes = async () => {
      try {
        const polygonConfig = polygonLevels[polygonLevel];
        const areaIndexRes = await fetch(`/data/${polygonConfig.dir}/index.json`, {
          cache: 'no-store',
          signal: controller.signal
        });
        if (!areaIndexRes.ok) {
          throw new Error(`Missing ${polygonConfig.label.toLowerCase()} polygon index`);
        }
        const areaIndex = await parseJsonResponse(areaIndexRes, `${polygonConfig.label.toLowerCase()} index`);
        const months = Array.isArray(areaIndex?.months) ? areaIndex.months : [];
        setPolygonMonths(months);

        setPolygonPointsData(null);
      } catch (error) {
        if (!controller.signal.aborted) {
          setPolygonMonths([]);
          setPolygonError(error?.message || 'Failed to load polygon index');
        }
      }
    };

    loadIndexes();

    return () => controller.abort();
  }, [renderMode, polygonLevel]);

  useEffect(() => {
    if (renderMode !== 'polygon') return;

    const controller = new AbortController();
    if (!polygonMonths.length) return;

    // Use base year for polygon data loading; blend handled in handleMonthChange
    const baseMonthIndex = Math.max(1, Math.min(TOTAL_MONTHS, baseMonthInt));
    const baseYear = START_YEAR + Math.floor((baseMonthIndex - 1) / 12);
    const yearCount = END_YEAR - START_YEAR + 1;
    const baseYearIndex = Math.max(0, Math.min(yearCount - 1, baseYear - START_YEAR));
    const nextYearIndex = Math.min(yearCount - 1, baseYearIndex + 1);

    const resolvePolygonMonthForYearIndex = (yearIndex) => {
      if (!polygonMonths.length) return null;
      const ratio = yearCount > 1 ? yearIndex / (yearCount - 1) : 0;
      const monthIndex = Math.max(0, Math.min(polygonMonths.length - 1, Math.round(ratio * (polygonMonths.length - 1))));
      return polygonMonths[monthIndex];
    };

    const currentMonthKey = resolvePolygonMonthForYearIndex(baseYearIndex);
    const nextPolygonKey = resolvePolygonMonthForYearIndex(nextYearIndex);

    const loadPolygonData = async () => {
      try {
        setPolygonError('');
        setPolygonStatsMonth(currentMonthKey || '');

        const polygonConfig = polygonLevels[polygonLevel];
        
        // Load current month
        const currentRes = await fetch(`/data/${polygonConfig.dir}/${polygonConfig.prefix}_${currentMonthKey}.geojson`, {
          cache: 'no-store',
          signal: controller.signal
        });
        if (!currentRes.ok) {
          throw new Error(`Missing ${polygonConfig.label.toLowerCase()} data (${currentMonthKey})`);
        }
        const currentJson = await parseJsonResponse(currentRes, `${polygonConfig.label.toLowerCase()} ${currentMonthKey}`);
        
        // Load next month
        const nextRes = await fetch(`/data/${polygonConfig.dir}/${polygonConfig.prefix}_${nextPolygonKey}.geojson`, {
          cache: 'no-store',
          signal: controller.signal
        });
        if (!nextRes.ok) {
          throw new Error(`Missing ${polygonConfig.label.toLowerCase()} data (${nextPolygonKey})`);
        }
        const nextJson = await parseJsonResponse(nextRes, `${polygonConfig.label.toLowerCase()} ${nextPolygonKey}`);
        
        setPolygonGeoData(currentJson);
        setPolygonNextGeoData(nextJson);

        if (currentMonthKey) {
          const statsRes = await fetch(`/data/polygon_stats/${polygonLevel}/${currentMonthKey}.json`, {
            cache: 'no-store',
            signal: controller.signal
          });
          if (statsRes.ok) {
            const statsJson = await parseJsonResponse(statsRes, `${polygonConfig.label.toLowerCase()} stats ${currentMonthKey}`);
            setPolygonStats(statsJson);
          } else {
            setPolygonStats(null);
          }
        } else {
          setPolygonStats(null);
        }

        setPolygonPointsData(null);
      } catch (error) {
        if (!controller.signal.aborted) {
          setPolygonGeoData(null);
          setPolygonNextGeoData(null);
          setPolygonPointsData(null);
          setPolygonStats(null);
          setPolygonError(error?.message || 'Failed to load polygon data');
        }
      }
    };

    loadPolygonData();

    return () => controller.abort();
  }, [renderMode, baseMonthInt, polygonMonths, polygonLevel]);

  // Handle timeline changes (continuous in [1..TOTAL_MONTHS])
  const handleMonthChange = (monthValue) => {
    if (!salesData2025 || !monthSamples) return;

    const clamped = Math.max(1, Math.min(TOTAL_MONTHS, monthValue));
    setActiveMonth(clamped);

    const baseMonth = Math.max(1, Math.min(TOTAL_MONTHS, Math.floor(clamped)));
    const t = clamped - baseMonth;

    const clampedBlend = Math.max(0, Math.min(1, t));
    setMonthBlend(clampedBlend);

    const yearFloat = START_YEAR + (clamped - 1) / 12;
    const currentYear = Math.floor(yearFloat);
    const yearBlend = Math.max(0, Math.min(1, yearFloat - currentYear));
    setPolygonBlend(yearBlend);
    setPointsBlend(yearBlend); // Points use year-based blending

    if (baseMonth !== baseMonthInt) {
      setBaseMonthInt(baseMonth);
      rebuildGeoForBaseMonth(baseMonth);
    }
  };

  useEffect(() => {
    if (!mapInstance || !targetLocation) return;

    const { center, bbox } = targetLocation;

    const timeout = setTimeout(() => {
      mapInstance.stop();
      mapInstance.easeTo({ pitch: 0, bearing: 0, duration: 500 });

      setTimeout(() => {
        if (bbox && bbox.length === 4) {
          mapInstance.fitBounds(
            [
              [bbox[0], bbox[1]],
              [bbox[2], bbox[3]]
            ],
            { padding: 60, duration: 2500, easing: (t) => t * (2 - t) }
          );
        } else {
          mapInstance.flyTo({ center, zoom: 6, duration: 2500, easing: (t) => t * (2 - t) });
        }
      }, 500);
    }, 800);

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
      <div className="absolute top-4 left-4 z-20">
        <div className="glass-panel rounded-2xl px-3 py-3 text-xs text-white/80 shadow-2xl">
          <div className="mb-2 text-[10px] uppercase tracking-[0.3em] text-white/40">
            Render
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setRenderMode('continuous')}
              className={`rounded-full px-3 py-1 transition ${
                renderMode === 'continuous'
                  ? 'bg-white/20 text-white'
                  : 'bg-white/5 text-white/60 hover:bg-white/10'
              }`}
            >
              Continuous
            </button>
            <button
              type="button"
              onClick={() => setRenderMode('polygon')}
              className={`rounded-full px-3 py-1 transition ${
                renderMode === 'polygon'
                  ? 'bg-white/20 text-white'
                  : 'bg-white/5 text-white/60 hover:bg-white/10'
              }`}
            >
              Polygon
            </button>
            <button
              type="button"
              onClick={() => setRenderMode('points')}
              className={`rounded-full px-3 py-1 transition ${
                renderMode === 'points'
                  ? 'bg-white/20 text-white'
                  : 'bg-white/5 text-white/60 hover:bg-white/10'
              }`}
            >
              Points
            </button>
          </div>
          {renderMode === 'polygon' && (
            <div className="mt-2 flex gap-2">
              {Object.entries(polygonLevels).map(([key, config]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPolygonLevel(key)}
                  className={`rounded-full px-3 py-1 transition ${
                    polygonLevel === key
                      ? 'bg-white/20 text-white'
                      : 'bg-white/5 text-white/60 hover:bg-white/10'
                  }`}
                >
                  {config.label}
                </button>
              ))}
            </div>
          )}
          {renderMode !== 'continuous' && polygonError && (
            <div className="mt-2 text-[10px] text-red-300">
              {polygonError}
            </div>
          )}
          {renderMode !== 'continuous' && !polygonError && polygonMonths.length > 0 && (
            <div className="mt-2 text-[10px] text-white/40">
              {polygonLevels[polygonLevel].label} range: {polygonMonths[0]} → {polygonMonths[polygonMonths.length - 1]}
            </div>
          )}
          {renderMode === 'points' && (
            <div className="mt-3 pt-3 border-t border-white/10">
              <div className="mb-2 text-[10px] uppercase tracking-[0.3em] text-white/40">
                Property Data
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPropertyMode('predicted');
                    if (activeMonth > 96) {
                      // Don't jump back if already before 2026
                    }
                  }}
                  className={`rounded-full px-3 py-1 transition ${
                    propertyMode === 'predicted'
                      ? 'bg-white/20 text-white'
                      : 'bg-white/5 text-white/60 hover:bg-white/10'
                  }`}
                >
                  Predicted
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPropertyMode('live');
                    // Jump to 2026 (month 97: Jan 2026)
                    setActiveMonth(97);
                    setBaseMonthInt(97);
                  }}
                  className={`rounded-full px-3 py-1 transition ${
                    propertyMode === 'live'
                      ? 'bg-white/20 text-white'
                      : 'bg-white/5 text-white/60 hover:bg-white/10'
                  }`}
                >
                  Live
                </button>
              </div>
              <div className="mt-2 text-[10px] text-white/40">
                {propertyMode === 'predicted' ? 'Historical & predictions' : '42,121 properties for sale'}
              </div>
            </div>
          )}
        </div>
      </div>
      <MapEngine
        geoData={propertyMode === 'live' ? livePointsData : geoData}
        pointsData={propertyMode === 'live' ? livePointsData : pointsData}
        selectedVariable="price"
        activeMonth={activeMonth}
        blend={monthBlend}
        pointsBlend={pointsBlend}
        onMapLoad={setMapInstance}
        renderMode={renderMode}
        propertyMode={propertyMode}
        polygonGeoData={polygonGeoData}
        polygonNextGeoData={polygonNextGeoData}
        polygonBlend={polygonBlend}
        polygonLevel={polygonLevel}
        polygonStats={polygonStats}
        polygonStatsMonth={polygonStatsMonth}
        polygonPointsData={polygonPointsData}
        currentTimelineDate={getCurrentTimelineDate()}
        onAIClick={(areaInfo) => {
          setSelectedAreaInfo(areaInfo);
          setAiChatOpen(true);
          setAiChatCollapsed(false);
        }}
      />
      {aiChatOpen && selectedAreaInfo && (
        <AIChatPanel
          areaInfo={selectedAreaInfo}
          onClose={() => {
            setAiChatOpen(false);
            setAiChatCollapsed(false);
          }}
          isCollapsed={aiChatCollapsed}
          onToggleCollapse={() => setAiChatCollapsed(!aiChatCollapsed)}
        />
      )}
      <div
        className={`absolute bottom-0 left-0 right-0 transition-all duration-700 ease-out ${
          hasSearched ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
        }`}
      >
        <TimeSlider
          activeMonth={activeMonth}
          onMonthChange={handleMonthChange}
          minMonth={1}
          maxMonth={TOTAL_MONTHS}
          startYear={START_YEAR}
          endYear={END_YEAR}
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
