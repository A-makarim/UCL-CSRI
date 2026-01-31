/**
 * MapEngine Component
 * Mapbox GL JS v3 with 3D Globe projection
 * Point-based heatmap with glow effects
 */

import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

const MapEngine = ({ geoData, selectedVariable, blend = 0, onMapLoad }) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  const lastStats = useRef(null);

  // London coordinates (default view)
  const LONDON_CENTER = [-0.1276, 51.5074];
  const DEFAULT_ZOOM = 0.8; // Fully zoomed out to see whole globe

  // Color schemes for different variables
  const colorSchemes = {
    market_value: {
      color: '#00F3FF', // Neon Cyan
      heatmapColors: [
        'interpolate',
        ['linear'],
        ['heatmap-density'],
        0, 'rgba(0, 0, 0, 0)',
        0.2, 'rgba(0, 100, 255, 0.5)',
        0.4, 'rgba(0, 150, 255, 0.6)',
        0.6, 'rgba(0, 200, 255, 0.7)',
        0.8, 'rgba(0, 243, 255, 0.8)',
        1, 'rgba(0, 243, 255, 1)'
      ]
    },
    rental_yield: {
      color: '#FFB800', // Neon Amber
      heatmapColors: [
        'interpolate',
        ['linear'],
        ['heatmap-density'],
        0, 'rgba(0, 0, 0, 0)',
        0.2, 'rgba(255, 140, 0, 0.5)',
        0.4, 'rgba(255, 160, 0, 0.6)',
        0.6, 'rgba(255, 180, 0, 0.7)',
        0.8, 'rgba(255, 184, 0, 0.8)',
        1, 'rgba(255, 184, 0, 1)'
      ]
    },
    crime_density: {
      color: '#FF003C', // Blood Red
      heatmapColors: [
        'interpolate',
        ['linear'],
        ['heatmap-density'],
        0, 'rgba(0, 0, 0, 0)',
        0.2, 'rgba(255, 0, 0, 0.5)',
        0.4, 'rgba(255, 0, 40, 0.6)',
        0.6, 'rgba(255, 0, 50, 0.7)',
        0.8, 'rgba(255, 0, 60, 0.8)',
        1, 'rgba(255, 0, 60, 1)'
      ]
    },
    infrastructure: {
      color: '#00F3FF',
      heatmapColors: [
        'interpolate',
        ['linear'],
        ['heatmap-density'],
        0, 'rgba(0, 0, 0, 0)',
        0.2, 'rgba(0, 200, 150, 0.5)',
        0.4, 'rgba(0, 220, 170, 0.6)',
        0.6, 'rgba(0, 240, 190, 0.7)',
        0.8, 'rgba(0, 243, 200, 0.8)',
        1, 'rgba(0, 243, 210, 1)'
      ]
    }
  };

  // Initialize map
  useEffect(() => {
    if (map.current) return; // Initialize only once

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

  // Update heatmap when data changes
  useEffect(() => {
    if (!map.current || !mapLoaded || !geoData) return;

    const featureCount = geoData.features?.length || 0;
    if (featureCount === 0) return;

    const scheme = colorSchemes?.[selectedVariable] || colorSchemes.market_value;

    const sourceId = 'heatmap-source';
    const layerId = 'heatmap-layer';
    const rainbowPointsId = 'heatmap-rainbow-points';

    const values = geoData.features?.map(f => Number(f.properties.value)).filter(v => Number.isFinite(v)) || [];
    if (values.length === 0) return;

    const minValueNew = Math.min(...values);
    const maxValueNew = Math.max(...values);

    const minValue = lastStats.current
      ? Math.min(lastStats.current.minValue, minValueNew)
      : minValueNew;
    const maxValue = lastStats.current
      ? Math.max(lastStats.current.maxValue, maxValueNew)
      : maxValueNew;

    const valueRange = Math.max(1, maxValue - minValue);
    lastStats.current = { minValue: minValueNew, maxValue: maxValueNew };

    const blendClamped = Math.max(0, Math.min(1, Number(blend) || 0));
    const alpha = [
      'case',
      ['==', ['to-number', ['get', 'group']], 0],
      ['-', 1, blendClamped],
      blendClamped
    ];

    const heatmapWeightBase = [
      'interpolate',
      ['linear'],
      ['/', ['-', ['to-number', ['get', 'value']], minValue], valueRange],
      0, 0.2,
      0.5, 0.7,
      1, 1
    ];

    const heatmapPaint = {
      'heatmap-weight': ['*', heatmapWeightBase, alpha],
      'heatmap-intensity': [
        'interpolate',
        ['linear'],
        ['zoom'],
        0, 0.18,
        3, 0.28,
        6, 0.55,
        9, 0.85,
        12, 1.35
      ],
      'heatmap-color': scheme.heatmapColors,
      'heatmap-radius': [
        'interpolate',
        ['linear'],
        ['zoom'],
        0, 8,
        3, 15,
        6, 25,
        9, 40,
        12, 60
      ],
      'heatmap-opacity': [
        'interpolate',
        ['linear'],
        ['zoom'],
        0, 0.28,
        6, 0.5,
        12, 0.55,
        15, 0.25
      ]
    };

    const rainbowPointsPaint = {
      'circle-radius': [
        'interpolate',
        ['linear'],
        ['zoom'],
        10, 4,
        13, 8,
        15, 12
      ],
      'circle-color': [
        'interpolate',
        ['linear'],
        ['/', ['-', ['to-number', ['get', 'value']], minValue], valueRange],
        0, '#0000FF',
        0.2, '#0080FF',
        0.35, '#00FFFF',
        0.5, '#00FF00',
        0.65, '#FFFF00',
        0.8, '#FF8000',
        1, '#FF0000'
      ],
      'circle-blur': 0.8,
      'circle-opacity': [
        '*',
        [
          'interpolate',
          ['linear'],
          ['zoom'],
          10, 0.18,
          13, 0.32,
          15, 0.45
        ],
        alpha
      ],
      'circle-stroke-width': 1,
      'circle-stroke-color': '#ffffff',
      'circle-stroke-opacity': 0.35
    };

    if (!map.current.getSource(sourceId)) {
      map.current.addSource(sourceId, {
        type: 'geojson',
        data: geoData
      });
    } else {
      map.current.getSource(sourceId).setData(geoData);
    }

    if (!map.current.getLayer(layerId)) {
      map.current.addLayer({
        id: layerId,
        type: 'heatmap',
        source: sourceId,
        maxzoom: 15,
        paint: heatmapPaint
      });
    } else {
      Object.entries(heatmapPaint).forEach(([key, value]) => {
        map.current.setPaintProperty(layerId, key, value);
      });
    }

    if (!map.current.getLayer(rainbowPointsId)) {
      map.current.addLayer({
        id: rainbowPointsId,
        type: 'circle',
        source: sourceId,
        minzoom: 10,
        paint: rainbowPointsPaint
      });
    } else {
      Object.entries(rainbowPointsPaint).forEach(([key, value]) => {
        map.current.setPaintProperty(rainbowPointsId, key, value);
      });
    }
  }, [geoData, selectedVariable, mapLoaded, blend]);

  return (
    <div
      ref={mapContainer}
      className="w-full h-full"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
    />
  );
};

export default MapEngine;