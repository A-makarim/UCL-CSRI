/**
 * Main App Component
 * Polygons + dots + heatmap with monthly slider
 */

import React, { useEffect, useMemo, useState } from 'react';
import MapEngine from './components/MapEngine';
import BottomBar from './components/BottomBar';
import PriceLegend from './components/PriceLegend';
import { loadGeoForMonth, loadIndex } from './services/localData';

const MODE_CONFIG = {
  area: { dir: 'area_geojson', prefix: 'area' },
  district: { dir: 'district_geojson', prefix: 'district' },
  sector: { dir: 'sector_geojson', prefix: 'sector' }
};

const getRange = (geoData) => {
  const values = (geoData?.features || [])
    .map((f) => Number(f?.properties?.median_price))
    .filter((v) => Number.isFinite(v));
  if (!values.length) return { min: 0, max: 0 };
  return { min: Math.min(...values), max: Math.max(...values) };
};

function App() {
  const [loading, setLoading] = useState(false);
  const [mapInstance, setMapInstance] = useState(null);
  const [months, setMonths] = useState([]);
  const [activeMonthIndex, setActiveMonthIndex] = useState(0);
  const [polygonMode, setPolygonMode] = useState('area');
  const [showPolygons, setShowPolygons] = useState(true);
  const [showDots, setShowDots] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [polygonData, setPolygonData] = useState(null);
  const [pointData, setPointData] = useState(null);

  const [targetLocation, setTargetLocation] = useState({
    center: [-0.1276, 51.5074],
    bbox: null
  });

  useEffect(() => {
    if (!targetLocation) return;
    let cancelled = false;

    const loadIndexes = async () => {
      setLoading(true);
      try {
        const [polyIndex, pointIndex] = await Promise.all([
          loadIndex(MODE_CONFIG[polygonMode].dir),
          loadIndex('postcode_points')
        ]);

        if (cancelled) return;

        const list = polyIndex?.months?.length
          ? polyIndex.months
          : pointIndex?.months || [];

        setMonths(list);
        setActiveMonthIndex(list.length ? 0 : 0);
      } catch (error) {
        console.error('Failed to load month index:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadIndexes();

    return () => {
      cancelled = true;
    };
  }, [polygonMode, targetLocation]);

  useEffect(() => {
    if (!months.length) return;
    let cancelled = false;

    const month = months[activeMonthIndex];
    const { dir, prefix } = MODE_CONFIG[polygonMode];

    const loadMonthData = async () => {
      setLoading(true);
      try {
        const [polygons, points] = await Promise.all([
          showPolygons ? loadGeoForMonth(dir, prefix, month) : Promise.resolve(null),
          showDots || showHeatmap
            ? loadGeoForMonth('postcode_points', 'points', month)
            : Promise.resolve(null)
        ]);

        if (cancelled) return;
        setPolygonData(polygons);
        setPointData(points);

        const prefetch = (idx) => {
          if (idx < 0 || idx >= months.length) return;
          const m = months[idx];
          loadGeoForMonth(dir, prefix, m).catch(() => {});
          if (showDots || showHeatmap) {
            loadGeoForMonth('postcode_points', 'points', m).catch(() => {});
          }
        };
        prefetch(activeMonthIndex - 1);
        prefetch(activeMonthIndex + 1);
      } catch (error) {
        console.error('Failed to load monthly data:', error);
        if (!cancelled) {
          setPolygonData(null);
          setPointData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadMonthData();

    return () => {
      cancelled = true;
    };
  }, [months, activeMonthIndex, polygonMode, showPolygons, showDots, showHeatmap]);

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

  const legendRange = useMemo(() => {
    const source = showPolygons ? polygonData : pointData;
    return getRange(source);
  }, [polygonData, pointData, showPolygons]);

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      <MapEngine
        polygonData={polygonData}
        pointData={pointData}
        showPolygons={showPolygons}
        showDots={showDots}
        showHeatmap={showHeatmap}
        onMapLoad={setMapInstance}
      />
      {months.length > 0 && (
        <BottomBar
          months={months}
          activeIndex={activeMonthIndex}
          onIndexChange={setActiveMonthIndex}
          mode={polygonMode}
          onModeChange={setPolygonMode}
          showPolygons={showPolygons}
          onTogglePolygons={() => setShowPolygons((prev) => !prev)}
          showDots={showDots}
          onToggleDots={() => setShowDots((prev) => !prev)}
          showHeatmap={showHeatmap}
          onToggleHeatmap={() => setShowHeatmap((prev) => !prev)}
        />
      )}
      {(showPolygons || showDots || showHeatmap) && (
        <PriceLegend minValue={legendRange.min} maxValue={legendRange.max} />
      )}
      {loading && (
        <div className="absolute top-4 left-4 text-xs text-white/50">
          Loading data…
        </div>
      )}
    </div>
  );
}

export default App;
