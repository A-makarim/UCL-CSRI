/**
 * Main App Component
 * Polygons + dots + heatmap with monthly slider
 */

import React, { useEffect, useMemo, useState } from 'react';
import MapEngine from './components/MapEngine';
import AgentPanel from './components/AgentPanel';
import BottomBar from './components/BottomBar';
import PriceLegend from './components/PriceLegend';
import { loadGeoForMonth, loadIndex, loadPolygons, loadRanges, loadStatsForMonth } from './services/localData';

const MODE_CONFIG = {
  area: { polygonFile: 'areas', statsPrefix: 'area' },
  district: { polygonFile: 'districts', statsPrefix: 'district' },
  sector: { polygonFile: 'sectors', statsPrefix: 'sector' }
};

const getStatsRange = (stats) => {
  if (!stats) return { min: 0, max: 0 };
  const values = Object.values(stats)
    .map((v) => Number(v?.median_price))
    .filter((v) => Number.isFinite(v));
  if (!values.length) return { min: 0, max: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const pick = (p) => sorted[Math.max(0, Math.min(sorted.length - 1, Math.round(p * (sorted.length - 1))))];
  const min = pick(0.1);
  const max = pick(0.9);
  return { min, max: Math.max(max, min + 1) };
};

const getPointRange = (geoData) => {
  const values = (geoData?.features || [])
    .map((f) => Number(f?.properties?.median_price))
    .filter((v) => Number.isFinite(v));
  if (!values.length) return { min: 0, max: 0 };
  const min = Math.min(...values);
  const max = Math.max(...values);
  return { min, max: Math.max(max, min + 1) };
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
  const [polygonStats, setPolygonStats] = useState(null);
  const [pointData, setPointData] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [polygonRanges, setPolygonRanges] = useState(null);

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
        const [statsIndex, pointIndex, ranges] = await Promise.all([
          loadIndex('stats'),
          loadIndex('postcode_points'),
          loadRanges().catch(() => null)
        ]);

        if (cancelled) return;

        const list = statsIndex?.months?.length
          ? statsIndex.months
          : pointIndex?.months || [];

        setMonths(list);
        setActiveMonthIndex(list.length ? 0 : 0);
        setPolygonRanges(ranges);
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
    const { statsPrefix } = MODE_CONFIG[polygonMode];

    const loadMonthData = async () => {
      setLoading(true);
      try {
        const [stats, points] = await Promise.all([
          loadStatsForMonth(statsPrefix, month),
          showDots || showHeatmap
            ? loadGeoForMonth('postcode_points', 'points', month)
            : Promise.resolve(null)
        ]);

        if (cancelled) return;
        setPolygonStats(stats);
        setPointData(points);

        const prefetch = (idx) => {
          if (idx < 0 || idx >= months.length) return;
          const m = months[idx];
          loadStatsForMonth(statsPrefix, m).catch(() => {});
          if (showDots || showHeatmap) {
            loadGeoForMonth('postcode_points', 'points', m).catch(() => {});
          }
        };
        prefetch(activeMonthIndex - 1);
        prefetch(activeMonthIndex + 1);
      } catch (error) {
        console.error('Failed to load monthly data:', error);
        if (!cancelled) {
          setPolygonStats(null);
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
    let cancelled = false;

    const loadPolys = async () => {
      try {
        const { polygonFile } = MODE_CONFIG[polygonMode];
        setPolygonStats(null);
        const polygons = await loadPolygons(polygonFile);
        if (!cancelled) {
          setPolygonData(polygons);
        }
      } catch (error) {
        console.error('Failed to load polygons:', error);
        if (!cancelled) setPolygonData(null);
      }
    };

    loadPolys();

    return () => {
      cancelled = true;
    };
  }, [polygonMode]);

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

  const polygonRange = useMemo(() => {
    if (polygonRanges?.[polygonMode]) return polygonRanges[polygonMode];
    return getStatsRange(polygonStats);
  }, [polygonRanges, polygonMode, polygonStats]);

  const legendRange = useMemo(() => {
    return showPolygons ? polygonRange : getPointRange(pointData);
  }, [polygonRange, pointData, showPolygons]);

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      <MapEngine
        polygonData={polygonData}
        polygonStats={polygonStats}
        polygonRange={polygonRange}
        polygonIdKey={MODE_CONFIG[polygonMode].statsPrefix}
        activeMonth={months[activeMonthIndex]}
        pointData={pointData}
        showPolygons={showPolygons}
        showDots={showDots}
        showHeatmap={showHeatmap}
        onMapLoad={setMapInstance}
        onUpdateStateChange={setIsUpdating}
      />
      {months.length > 0 && (
        <BottomBar
          months={months}
          activeIndex={activeMonthIndex}
          onIndexChange={setActiveMonthIndex}
          isUpdating={isUpdating}
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
      <AgentPanel
        context={{
          month: months[activeMonthIndex],
          mode: polygonMode,
          showPolygons,
          showDots,
          showHeatmap
        }}
      />
      {loading && (
        <div className="absolute top-4 left-4 text-xs text-white/50">
          Loading data…
        </div>
      )}
    </div>
  );
}

export default App;
