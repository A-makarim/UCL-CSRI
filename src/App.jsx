/**
 * Main App Component - 2025 Monthly Sales Visualization
 * Timeline: January - December 2025
 */

import React, { useState, useEffect } from 'react';
import MapEngine from './components/MapEngine';
import TimeSlider from './components/TimeSlider';
import LoadingScreen from './components/LoadingScreen';

function App() {
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('Loading...');
  
  const [activeMonth, setActiveMonth] = useState(1); // continuous in [1..12]
  const [baseMonthInt, setBaseMonthInt] = useState(1);
  const [monthBlend, setMonthBlend] = useState(0); // 0..1 between baseMonthInt and next
  const [salesData2025, setSalesData2025] = useState(null);
  const [geoData, setGeoData] = useState(null);
  const [areaStats, setAreaStats] = useState(null);

  const [monthSamples, setMonthSamples] = useState(null);

  // Load 2025 sales data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoadingMessage('Loading 2025 property sales data...');
        setLoadingProgress(30);

        const response = await fetch('/outputs/sales_2025_monthly.json');
        const data = await response.json();
        
        console.log('📦 Loaded 2025 Sales:', data.meta.totalSales.toLocaleString(), 'properties');
        
        setSalesData2025(data);
        setLoadingProgress(70);

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

        const janKey = '2025-01';
        const febKey = '2025-02';
        setBaseMonthInt(1);
        setMonthBlend(0);
        const geoJSON = {
          type: 'FeatureCollection',
          features: [
            ...buildFeatures(samples[janKey] || [], 0),
            ...buildFeatures(samples[febKey] || [], 1)
          ]
        };
        
        console.log('🗺️ January 2025 (blend-ready):', (data.months[janKey]?.length || 0).toLocaleString(), 'sales');
        console.log('   Visualizing:', geoJSON.features.length.toLocaleString(), 'properties');
        
        setGeoData(geoJSON);
        
        // Calculate price statistics
        const prices = (data.months[janKey] || []).map(s => s.price);
        setAreaStats({
          minValue: Math.min(...prices),
          maxValue: Math.max(...prices),
          avgValue: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
        });

        setLoadingProgress(100);
        setLoading(false);
        
        console.log('✨ Ready! Slide through Jan-Dec 2025');
      } catch (error) {
        console.error('❌ Error loading data:', error);
        setLoadingMessage('Error loading data');
        setTimeout(() => setLoading(false), 2000);
      }
    };

    loadData();
  }, []);

  const rebuildGeoForBaseMonth = (baseMonth) => {
    if (!monthSamples || !salesData2025) return;

    const nextMonth = baseMonth === 12 ? 1 : baseMonth + 1;
    const baseKey = `2025-${String(baseMonth).padStart(2, '0')}`;
    const nextKey = `2025-${String(nextMonth).padStart(2, '0')}`;
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

  // Handle timeline changes (continuous in [1..12])
  const handleMonthChange = (monthValue) => {
    if (!salesData2025 || !monthSamples) return;

    const clamped = Math.max(1, Math.min(12, monthValue));
    setActiveMonth(clamped);

    const baseMonth = Math.max(1, Math.min(12, Math.floor(clamped)));
    const t = clamped - baseMonth;

    setMonthBlend(Math.max(0, Math.min(1, t)));

    if (baseMonth !== baseMonthInt) {
      setBaseMonthInt(baseMonth);
      rebuildGeoForBaseMonth(baseMonth);
    }
  };

  if (loading) {
    return <LoadingScreen progress={loadingProgress} message={loadingMessage} />;
  }

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      {/* 3D Globe - Full Screen */}
      <MapEngine
        geoData={geoData}
        selectedVariable="price"
        activeMonth={activeMonth}
        blend={monthBlend}
      />
      
      {/* Monthly Time Slider */}
      <TimeSlider
        activeMonth={activeMonth}
        onMonthChange={handleMonthChange}
        minMonth={1}
        maxMonth={12}
        year={2025}
      />
    </div>
  );
}

export default App;
