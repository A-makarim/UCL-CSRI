/**
 * Main App Component
 * Polygons + dots + heatmap with monthly slider
 */

import React, { useEffect, useMemo, useState } from 'react';
import MapEngine from './components/MapEngine';
import AgentPanel from './components/AgentPanel';
import BottomBar from './components/BottomBar';
import PriceLegend from './components/PriceLegend';
import { loadGeoForMonth, loadIndex, loadLiveListingsGeo, loadPolygons, loadRanges, loadStatsForMonth } from './services/localData';

const MODE_CONFIG = {
  area: { polygonFile: 'areas', statsPrefix: 'area' },
  district: { polygonFile: 'districts', statsPrefix: 'district' },
  sector: { polygonFile: 'sectors', statsPrefix: 'sector' }
};

const getDatasetForMonth = (month) => {
  // Option A: historical <= 2025-12, predicted >= 2026-01
  if (!month || typeof month !== 'string') return 'historical';
  return month >= '2026-01' ? 'predicted' : 'historical';
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
  const [showLive, setShowLive] = useState(false);
  const [polygonData, setPolygonData] = useState(null);
  const [polygonStats, setPolygonStats] = useState(null);
  const [pointData, setPointData] = useState(null);
  const [liveData, setLiveData] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [polygonRanges, setPolygonRanges] = useState(null);
  const [agentRequest, setAgentRequest] = useState(null);

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
        const [
          histStatsIndex,
          histPointIndex,
          predStatsIndex,
          predPointIndex,
          histRanges,
          predRanges
        ] = await Promise.all([
          loadIndex('historical', 'stats').catch(() => ({ months: [] })),
          loadIndex('historical', 'postcode_points').catch(() => ({ months: [] })),
          loadIndex('predicted', 'stats').catch(() => ({ months: [] })),
          loadIndex('predicted', 'postcode_points').catch(() => ({ months: [] })),
          loadRanges('historical').catch(() => null),
          loadRanges('predicted').catch(() => null)
        ]);

        if (cancelled) return;

        const histMonths = (histStatsIndex?.months?.length ? histStatsIndex.months : histPointIndex?.months) || [];
        const predMonths = (predStatsIndex?.months?.length ? predStatsIndex.months : predPointIndex?.months) || [];
        const list = Array.from(new Set([...histMonths, ...predMonths])).sort();

        setMonths(list);
        setActiveMonthIndex(list.length ? 0 : 0);
        setPolygonRanges({
          historical: histRanges,
          predicted: predRanges
        });
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
    const dataset = getDatasetForMonth(month);
    const { statsPrefix } = MODE_CONFIG[polygonMode];

    const loadMonthData = async () => {
      setLoading(true);
      try {
        const [stats, points] = await Promise.all([
          loadStatsForMonth(dataset, statsPrefix, month),
          showDots || showHeatmap
            ? loadGeoForMonth(dataset, 'postcode_points', 'points', month)
            : Promise.resolve(null)
        ]);

        if (cancelled) return;
        setPolygonStats(stats);
        setPointData(points);

        const prefetch = (idx) => {
          if (idx < 0 || idx >= months.length) return;
          const m = months[idx];
          const ds = getDatasetForMonth(m);
          loadStatsForMonth(ds, statsPrefix, m).catch(() => {});
          if (showDots || showHeatmap) {
            loadGeoForMonth(ds, 'postcode_points', 'points', m).catch(() => {});
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
    if (!showLive) return;
    let cancelled = false;
    loadLiveListingsGeo()
      .then((geo) => {
        if (!cancelled) setLiveData(geo);
      })
      .catch((err) => {
        console.error('Failed to load live listings geojson:', err);
        if (!cancelled) setLiveData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [showLive]);

  useEffect(() => {
    let cancelled = false;

    const loadPolys = async () => {
      try {
        const { polygonFile } = MODE_CONFIG[polygonMode];
        setPolygonStats(null);
        const polygons = await loadPolygons(polygonFile);
        if (!cancelled) {
          setPolygonData(polygons);
          const count = polygons?.features?.length || 0;
          if (count === 0) {
            // No boundary dataset available; fall back to points/heatmap so the map isn't blank.
            setShowPolygons(false);
            setShowDots(true);
          }
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
    const month = months[activeMonthIndex];
    const dataset = getDatasetForMonth(month);
    if (polygonRanges?.[dataset]?.[polygonMode]) return polygonRanges[dataset][polygonMode];
    return getStatsRange(polygonStats);
  }, [polygonRanges, polygonMode, polygonStats, months, activeMonthIndex]);

  const legendRange = useMemo(() => {
    return showPolygons ? polygonRange : getPointRange(pointData);
  }, [polygonRange, pointData, showPolygons]);

  const handleToggleLive = () => {
    setShowLive((prev) => {
      const next = !prev;
      if (next && months.length) {
        // Jump the timeline to "now" when enabling Live.
        // Prefer current month if present (predicted data likely covers it), else last available month.
        const now = new Date();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const current = `${now.getFullYear()}-${m}`;
        const idx = months.indexOf(current);
        setActiveMonthIndex(idx >= 0 ? idx : months.length - 1);
      }
      return next;
    });
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      <MapEngine
        polygonData={polygonData}
        polygonStats={polygonStats}
        polygonRange={polygonRange}
        polygonIdKey={MODE_CONFIG[polygonMode].statsPrefix}
        activeMonth={months[activeMonthIndex]}
        pointData={pointData}
        liveData={liveData}
        showPolygons={showPolygons}
        showDots={showDots}
        showHeatmap={showHeatmap}
        showLive={showLive}
        onMapLoad={setMapInstance}
        onUpdateStateChange={setIsUpdating}
        onRequestAgentSummary={(payload) =>
          setAgentRequest({ id: `${Date.now()}-${Math.random()}`, ...payload })
        }
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
          showLive={showLive}
          onToggleLive={handleToggleLive}
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
          showHeatmap,
          showLive
        }}
        request={agentRequest}
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
