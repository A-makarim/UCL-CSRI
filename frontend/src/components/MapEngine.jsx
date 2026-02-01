/**
 * MapEngine Component
 * Mapbox GL JS v3 with 3D Globe projection
 * Polygons + dots + heatmap overlays
 */

import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

const LONDON_CENTER = [-0.1276, 51.5074];
const DEFAULT_ZOOM = 0.8;

const EMPTY_GEOJSON = { type: 'FeatureCollection', features: [] };

const getPointRange = (geoData) => {
  const values = (geoData?.features || [])
    .map((f) => Number(f?.properties?.median_price))
    .filter((v) => Number.isFinite(v));
  if (!values.length) return { min: 0, max: 1 };
  const sorted = [...values].sort((a, b) => a - b);
  const q = (p) => {
    const idx = Math.max(0, Math.min(sorted.length - 1, Math.round(p * (sorted.length - 1))));
    return sorted[idx];
  };
  const min = q(0.1);
  const max = q(0.9);
  if (min === max) {
    return { min, max: min + 1 };
  }
  return { min, max };
};

const formatPrice = (value) => {
  if (!Number.isFinite(value)) return '—';
  if (value >= 1_000_000) return `£${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `£${Math.round(value / 1_000)}K`;
  return `£${Math.round(value).toLocaleString()}`;
};

const MapEngine = ({
  polygonData,
  polygonStats,
  polygonRange,
  polygonIdKey,
  pointData,
  showPolygons,
  showDots,
  showHeatmap,
  onMapLoad,
  onUpdateStateChange
}) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const mapLoadedRef = useRef(false);
  const popupRef = useRef(null);
  const listenersAttachedRef = useRef(false);
  const polygonKeyRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const prevStatsRef = useRef(null);
  const blendRef = useRef(1);
  const blendRafRef = useRef(null);

  useEffect(() => {
    if (map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: LONDON_CENTER,
      zoom: DEFAULT_ZOOM,
      pitch: 0,
      bearing: 0,
      projection: 'globe',
      antialias: true
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.current.on('style.load', () => {
      map.current.setFog({
        color: 'rgb(0, 0, 0)',
        'high-color': 'rgb(20, 20, 30)',
        'horizon-blend': 0.1,
        'space-color': 'rgb(0, 0, 0)',
        'star-intensity': 0.5
      });
    });

    map.current.on('load', () => {
      mapLoadedRef.current = true;
      setMapLoaded(true);
      if (onMapLoad) onMapLoad(map.current);
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [onMapLoad]);

  useEffect(() => {
    if (!map.current || !mapLoadedRef.current) return;

    const mapInstance = map.current;
    const polygonPrevSourceId = 'polygon-source-prev';
    const polygonNextSourceId = 'polygon-source-next';
    const polygonFillPrevId = 'polygon-fill-prev';
    const polygonFillNextId = 'polygon-fill-next';
    const polygonOutlineId = 'polygon-outline';
    const pointSourceId = 'point-source';
    const heatmapLayerId = 'point-heatmap';
    const dotLayerId = 'point-dots';

    const range = polygonRange || { min: 0, max: 1 };
    const pointRange = getPointRange(pointData);

    const polygonOpacity = showHeatmap ? 0.6 : 0.78;
    const buildPolygonColor = [
      'case',
      ['==', ['feature-state', 'sales'], null],
      '#1d1f24',
      ['<=', ['feature-state', 'sales'], 0],
      '#1d1f24',
      [
        'interpolate',
        ['linear'],
        ['feature-state', 'median_price'],
        range.min, '#16243a',
        range.min + (range.max - range.min) * 0.25, '#1b6f7a',
        range.min + (range.max - range.min) * 0.5, '#4ab869',
        range.min + (range.max - range.min) * 0.75, '#e2c35b',
        range.max, '#f05b4c'
      ]
    ];

    const pointColor = [
      'interpolate',
      ['linear'],
      ['coalesce', ['get', 'median_price'], 0],
      pointRange.min, '#16243a',
      pointRange.min + (pointRange.max - pointRange.min) * 0.25, '#1b6f7a',
      pointRange.min + (pointRange.max - pointRange.min) * 0.5, '#4ab869',
      pointRange.min + (pointRange.max - pointRange.min) * 0.75, '#e2c35b',
      pointRange.max, '#f05b4c'
    ];

    const needsPolygonSourceReset =
      !mapInstance.getSource(polygonPrevSourceId) ||
      !mapInstance.getSource(polygonNextSourceId) ||
      polygonKeyRef.current !== polygonIdKey;

    if (needsPolygonSourceReset) {
      if (mapInstance.getLayer(polygonFillPrevId)) mapInstance.removeLayer(polygonFillPrevId);
      if (mapInstance.getLayer(polygonFillNextId)) mapInstance.removeLayer(polygonFillNextId);
      if (mapInstance.getLayer(polygonOutlineId)) mapInstance.removeLayer(polygonOutlineId);
      if (mapInstance.getSource(polygonPrevSourceId)) mapInstance.removeSource(polygonPrevSourceId);
      if (mapInstance.getSource(polygonNextSourceId)) mapInstance.removeSource(polygonNextSourceId);

      mapInstance.addSource(polygonPrevSourceId, {
        type: 'geojson',
        data: polygonData || EMPTY_GEOJSON,
        promoteId: polygonIdKey || undefined
      });
      mapInstance.addSource(polygonNextSourceId, {
        type: 'geojson',
        data: polygonData || EMPTY_GEOJSON,
        promoteId: polygonIdKey || undefined
      });
      polygonKeyRef.current = polygonIdKey;
      prevStatsRef.current = null;
    } else {
      mapInstance.getSource(polygonPrevSourceId).setData(polygonData || EMPTY_GEOJSON);
      mapInstance.getSource(polygonNextSourceId).setData(polygonData || EMPTY_GEOJSON);
    }

    const prevOpacity = polygonOpacity * (1 - blendRef.current);
    const nextOpacity = polygonOpacity * blendRef.current;

    if (!mapInstance.getLayer(polygonFillPrevId)) {
      mapInstance.addLayer({
        id: polygonFillPrevId,
        type: 'fill',
        source: polygonPrevSourceId,
        paint: {
          'fill-color': buildPolygonColor,
          'fill-opacity': prevOpacity
        }
      });
    } else {
      mapInstance.setPaintProperty(polygonFillPrevId, 'fill-color', buildPolygonColor);
      mapInstance.setPaintProperty(polygonFillPrevId, 'fill-opacity', prevOpacity);
    }

    if (!mapInstance.getLayer(polygonFillNextId)) {
      mapInstance.addLayer({
        id: polygonFillNextId,
        type: 'fill',
        source: polygonNextSourceId,
        paint: {
          'fill-color': buildPolygonColor,
          'fill-opacity': nextOpacity
        }
      });
    } else {
      mapInstance.setPaintProperty(polygonFillNextId, 'fill-color', buildPolygonColor);
      mapInstance.setPaintProperty(polygonFillNextId, 'fill-opacity', nextOpacity);
    }

    if (!mapInstance.getLayer(polygonOutlineId)) {
      mapInstance.addLayer({
        id: polygonOutlineId,
        type: 'line',
        source: polygonNextSourceId,
        paint: {
          'line-color': 'rgba(255,255,255,0.25)',
          'line-width': 0.6
        }
      });
    }

    if (polygonStats) {
      const entries = Object.entries(polygonStats);
      const previous = prevStatsRef.current || polygonStats;
      const hadPrevious = prevStatsRef.current != null;

      if (blendRafRef.current) {
        cancelAnimationFrame(blendRafRef.current);
        blendRafRef.current = null;
      }

      if (onUpdateStateChange) onUpdateStateChange(true);

      entries.forEach(([code, stats]) => {
        const prev = previous?.[code] || stats;
        mapInstance.setFeatureState(
          { source: polygonPrevSourceId, id: code },
          {
            median_price: prev?.median_price ?? null,
            mean_price: prev?.mean_price ?? null,
            sales: prev?.sales ?? 0
          }
        );
        mapInstance.setFeatureState(
          { source: polygonNextSourceId, id: code },
          {
            median_price: stats?.median_price ?? null,
            mean_price: stats?.mean_price ?? null,
            sales: stats?.sales ?? 0
          }
        );
      });

      const startCrossfade = () => {
        const start = performance.now();
        const duration = 900;
        const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
        const step = (now) => {
          const linear = Math.min(1, (now - start) / duration);
          const t = easeInOut(linear);
          blendRef.current = t;
          const prevOpacity = polygonOpacity * (1 - t);
          const nextOpacity = polygonOpacity * t;
          mapInstance.setPaintProperty(polygonFillPrevId, 'fill-opacity', prevOpacity);
          mapInstance.setPaintProperty(polygonFillNextId, 'fill-opacity', nextOpacity);
          if (linear < 1) {
            blendRafRef.current = requestAnimationFrame(step);
          } else {
            prevStatsRef.current = polygonStats;
            if (onUpdateStateChange) onUpdateStateChange(false);
          }
        };
        blendRafRef.current = requestAnimationFrame(step);
      };

      if (hadPrevious) {
        startCrossfade();
      } else {
        blendRef.current = 1;
        mapInstance.setPaintProperty(polygonFillPrevId, 'fill-opacity', 0);
        mapInstance.setPaintProperty(polygonFillNextId, 'fill-opacity', polygonOpacity);
        prevStatsRef.current = polygonStats;
        if (onUpdateStateChange) onUpdateStateChange(false);
      }
    } else if (onUpdateStateChange) {
      onUpdateStateChange(false);
    }

    if (!mapInstance.getSource(pointSourceId)) {
      mapInstance.addSource(pointSourceId, {
        type: 'geojson',
        data: pointData || EMPTY_GEOJSON
      });
    } else {
      mapInstance.getSource(pointSourceId).setData(pointData || EMPTY_GEOJSON);
    }

    if (!mapInstance.getLayer(heatmapLayerId)) {
      mapInstance.addLayer({
        id: heatmapLayerId,
        type: 'heatmap',
        source: pointSourceId,
        maxzoom: 12,
        paint: {
          'heatmap-weight': [
            'interpolate',
            ['linear'],
            ['coalesce', ['get', 'median_price'], 0],
            pointRange.min, 0,
            pointRange.max, 1
          ],
          'heatmap-intensity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            0, 0.1,
            6, 0.6,
            10, 1.2
          ],
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0, 'rgba(0,0,0,0)',
            0.2, 'rgba(11,26,74,0.5)',
            0.4, 'rgba(18,178,178,0.7)',
            0.6, 'rgba(142,227,94,0.8)',
            0.8, 'rgba(245,207,88,0.9)',
            1, 'rgba(255,91,58,1)'
          ],
          'heatmap-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            0, 8,
            5, 18,
            9, 30,
            12, 48
          ],
          'heatmap-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            0, 0.2,
            6, 0.45,
            12, 0.65
          ]
        }
      });
    }

    if (!mapInstance.getLayer(dotLayerId)) {
      mapInstance.addLayer({
        id: dotLayerId,
        type: 'circle',
        source: pointSourceId,
        minzoom: 6,
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            6, ['+', 1, ['sqrt', ['coalesce', ['get', 'sales'], 1]]],
            10, ['+', 2, ['*', 0.8, ['sqrt', ['coalesce', ['get', 'sales'], 1]]]],
            14, ['+', 3, ['*', 1.2, ['sqrt', ['coalesce', ['get', 'sales'], 1]]]]
          ],
          'circle-color': pointColor,
          'circle-opacity': 0.6,
          'circle-stroke-width': 0.6,
          'circle-stroke-color': 'rgba(255,255,255,0.35)'
        }
      });
    } else {
      mapInstance.setPaintProperty(dotLayerId, 'circle-color', pointColor);
    }

    mapInstance.setLayoutProperty(heatmapLayerId, 'visibility', showHeatmap ? 'visible' : 'none');
    mapInstance.setLayoutProperty(dotLayerId, 'visibility', showDots ? 'visible' : 'none');
    mapInstance.setLayoutProperty(polygonFillPrevId, 'visibility', showPolygons ? 'visible' : 'none');
    mapInstance.setLayoutProperty(polygonFillNextId, 'visibility', showPolygons ? 'visible' : 'none');
    mapInstance.setLayoutProperty(polygonOutlineId, 'visibility', showPolygons ? 'visible' : 'none');

    if (!listenersAttachedRef.current) {
      if (!popupRef.current) {
        popupRef.current = new mapboxgl.Popup({ closeButton: true, closeOnClick: true });
      }

      const handlePointHover = (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        const { postcode, sales, median_price } = feature.properties || {};
        popupRef.current
          .setLngLat(event.lngLat)
          .setHTML(
            `<div style="font-size:12px">
              <div style="font-weight:600">${postcode || 'Postcode'}</div>
              <div>Median: ${formatPrice(Number(median_price))}</div>
              <div>Sales: ${sales || 0}</div>
            </div>`
          )
          .addTo(mapInstance);
      };

      const handlePolygonHover = (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        const props = feature.properties || {};
        const label = props.area || props.district || props.sector || 'Area';
        const state = mapInstance.getFeatureState({ source: polygonNextSourceId, id: feature.id });
        const median = Number(state?.median_next);
        const meanPrice = Number(state?.mean_next);
        const sales = Number.isFinite(state?.sales_next) ? state.sales_next : 0;
        popupRef.current
          .setLngLat(event.lngLat)
          .setHTML(
            `<div style="font-size:12px">
              <div style="font-weight:600">${label}</div>
              <div>Median: ${formatPrice(median)}</div>
              ${Number.isFinite(meanPrice) ? `<div>Mean: ${formatPrice(meanPrice)}</div>` : ''}
              <div>Sales: ${sales}</div>
            </div>`
          )
          .addTo(mapInstance);
      };

      const setCursor = () => {
        mapInstance.getCanvas().style.cursor = 'pointer';
      };
      const resetCursor = () => {
        mapInstance.getCanvas().style.cursor = '';
      };

      mapInstance.on('mousemove', dotLayerId, handlePointHover);
      mapInstance.on('mousemove', polygonFillNextId, handlePolygonHover);
      mapInstance.on('mouseenter', dotLayerId, setCursor);
      mapInstance.on('mouseleave', dotLayerId, resetCursor);
      mapInstance.on('mouseenter', polygonFillNextId, setCursor);
      mapInstance.on('mouseleave', polygonFillNextId, resetCursor);
      mapInstance.on('mouseleave', dotLayerId, () => popupRef.current.remove());
      mapInstance.on('mouseleave', polygonFillNextId, () => popupRef.current.remove());

      listenersAttachedRef.current = true;
    }
  }, [polygonData, polygonStats, polygonRange, polygonIdKey, pointData, showPolygons, showDots, showHeatmap, mapLoaded, onUpdateStateChange]);

  return (
    <div
      ref={mapContainer}
      className="w-full h-full"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
    />
  );
};

export default MapEngine;
