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
  
  const [activeMonth, setActiveMonth] = useState(1); // January (1-12)
  const [salesData2025, setSalesData2025] = useState(null);
  const [geoData, setGeoData] = useState(null);
  const [areaStats, setAreaStats] = useState(null);

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
        
        // Build initial GeoJSON for January
        const buildGeoJSON = (monthData) => ({
          type: 'FeatureCollection',
          features: monthData.slice(0, 8000).map(sale => ({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [sale.lng, sale.lat]
            },
            properties: {
              price: sale.price,
              postcode: sale.postcode,
              address: sale.address,
              district: sale.district,
              propType: sale.propType,
              date: sale.date
            }
          }))
        });
        
        const janData = data.months['2025-01'];
        const geoJSON = buildGeoJSON(janData);
        
        console.log('🗺️ January 2025:', janData.length.toLocaleString(), 'sales');
        console.log('   Visualizing:', geoJSON.features.length.toLocaleString(), 'properties');
        
        setGeoData(geoJSON);
        
        // Calculate price statistics
        const prices = janData.map(s => s.price);
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

  // Handle month changes
  const handleMonthChange = (month) => {
    if (!salesData2025) return;
    
    setActiveMonth(month);
    
    const monthKey = `2025-${String(month).padStart(2, '0')}`;
    const monthData = salesData2025.months[monthKey];
    
    if (!monthData) return;
    
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    console.log(`📅 ${monthNames[month-1]} 2025: ${monthData.length.toLocaleString()} sales`);
    
    // Build GeoJSON for this month (limit to 8000 for smooth performance)
    const geoJSON = {
      type: 'FeatureCollection',
      features: monthData.slice(0, 8000).map(sale => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [sale.lng, sale.lat]
        },
        properties: {
          price: sale.price,
          postcode: sale.postcode,
          address: sale.address,
          district: sale.district,
          propType: sale.propType,
          date: sale.date
        }
      }))
    };
    
    setGeoData(geoJSON);
    
    // Update stats
    const prices = monthData.map(s => s.price);
    setAreaStats({
      minValue: Math.min(...prices),
      maxValue: Math.max(...prices),
      avgValue: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
    });
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
