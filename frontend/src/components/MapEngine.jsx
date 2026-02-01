/**
 * MapEngine Component
 * Mapbox GL JS v3 with 3D Globe projection
 * Point-based heatmap with glow effects
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

const EMPTY_GEOJSON = { type: 'FeatureCollection', features: [] };

const MapEngine = ({
  geoData,
  pointsData,
  selectedVariable,
  blend = 0,
  pointsBlend = 0,
  onMapLoad,
  renderMode = 'continuous',
  polygonGeoData,
  polygonNextGeoData,
  polygonBlend = 0,
  polygonLevel = 'area',
  polygonStats,
  polygonStatsMonth,
  polygonPointsData,
  onAIClick,
  propertyMode = 'predicted'
}) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const popupRef = useRef(null);
  const hoverBoundRef = useRef(false);

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

    // Remove zoom controls - user will use scroll wheel
    // map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

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
      window.mapInstance = map.current;
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [onMapLoad]);

  useEffect(() => {
    if (!map.current || !mapLoaded || hoverBoundRef.current) return;

    const handleMove = (event) => {
      const feature = event.features?.[0];
      if (!feature) return;

      const props = feature.properties || {};
      
      // Check if this is a live property listing
      const isLiveProperty = props.url && propertyMode === 'live';
      
      if (isLiveProperty) {
        // Live property popup with listing details
        const price = props.price
          ? Number(props.price).toLocaleString('en-GB', { style: 'currency', currency: 'GBP' })
          : 'n/a';
        const bedrooms = props.bedrooms || 'n/a';
        const bathrooms = props.bathrooms || 'n/a';
        const address = props.address || 'n/a';
        const size = props.propertySize && props.sizeMetric 
          ? `${props.propertySize} ${props.sizeMetric}` 
          : 'n/a';
        
        if (!popupRef.current) {
          popupRef.current = new mapboxgl.Popup({ closeButton: false, closeOnClick: false });
        }

        popupRef.current
          .setLngLat(event.lngLat)
          .setHTML(
            `<div style="font-family: system-ui, -apple-system, sans-serif; font-size: 10px;">
              <strong style="font-size: 11px; color: #10b981;">${address}</strong><br/>
              <span style="color: #64748b;">Price: ${price}</span><br/>
              <span style="color: #64748b;">Beds: ${bedrooms} | Baths: ${bathrooms}</span><br/>
              ${size !== 'n/a' ? `<span style="color: #64748b;">Size: ${size}</span><br/>` : ''}
              <span style="color: #8b5cf6; font-size: 9px;">🔗 Live listing - click for AI analysis</span>
            </div>`
          )
          .addTo(map.current);
      } else {
        // Predicted property popup (original style)
        const price = props.price
          ? Number(props.price).toLocaleString('en-GB', { style: 'currency', currency: 'GBP' })
          : props.value
            ? Number(props.value).toLocaleString('en-GB', { style: 'currency', currency: 'GBP' })
            : 'n/a';
        // Use timeline date if available, otherwise fall back to property date
        const date = props.timelineDate || props.date || 'n/a';
        const postcode = props.postcode || 'n/a';
        const district = props.district || 'n/a';
        const propType = props.propType || 'Property';

        if (!popupRef.current) {
          popupRef.current = new mapboxgl.Popup({ closeButton: false, closeOnClick: false });
        }

        popupRef.current
          .setLngLat(event.lngLat)
          .setHTML(
            `<div style="font-family: system-ui, -apple-system, sans-serif; font-size: 10px;">
              <strong style="font-size: 11px; color: #1e293b;">${postcode}</strong><br/>
              <span style="color: #64748b;">Price: ${price}</span><br/>
              <span style="color: #64748b;">Date: ${date}</span><br/>
              <span style="color: #64748b;">Type: ${propType}</span><br/>
              <span style="color: #64748b;">District: ${district}</span>
            </div>`
          )
          .addTo(map.current);
      }
    };

    const handleLeave = () => {
      if (popupRef.current) popupRef.current.remove();
    };

    const handlePointClick = (event) => {
      if (!onAIClick) return;
      
      const feature = event.features?.[0];
      if (!feature) return;

      const props = feature.properties || {};
      const isLiveProperty = props.url && propertyMode === 'live';
      
      if (isLiveProperty) {
        // Live property AI query with listing URL
        onAIClick({
          name: props.address || 'Property',
          mean: Number(props.price || 0),
          median: Number(props.price || 0),
          sales: 1,
          level: 'live-property',
          bedrooms: props.bedrooms,
          bathrooms: props.bathrooms,
          propertySize: props.propertySize,
          sizeMetric: props.sizeMetric,
          listingUrl: props.url,
          areaCode: props.areaCode
        });
      } else {
        // Predicted property AI query
        const price = props.price || props.value || 0;
        const postcode = props.postcode || 'Property';
        const district = props.district || 'Area';
        const propType = props.propType || 'Property';

        onAIClick({
          name: `${postcode} (${district})`,
          mean: Number(price),
          median: Number(price),
          sales: 1,
          level: 'property',
          propertyType: propType,
          postcode: postcode
        });
      }
    };

    map.current.on('mousemove', 'heatmap-rainbow-points', handleMove);
    map.current.on('mouseleave', 'heatmap-rainbow-points', handleLeave);
    map.current.on('click', 'heatmap-rainbow-points', handlePointClick);
    
    // Change cursor to pointer when hovering points
    map.current.on('mouseenter', 'heatmap-rainbow-points', () => {
      map.current.getCanvas().style.cursor = 'pointer';
    });
    
    hoverBoundRef.current = true;

    return () => {
      if (map.current) {
        map.current.off('mousemove', 'heatmap-rainbow-points', handleMove);
        map.current.off('mouseleave', 'heatmap-rainbow-points', handleLeave);
        map.current.off('click', 'heatmap-rainbow-points', handlePointClick);
        map.current.off('mouseenter', 'heatmap-rainbow-points');
      }
      if (popupRef.current) popupRef.current.remove();
      hoverBoundRef.current = false;
    };
  }, [mapLoaded, onAIClick, propertyMode]);

  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    if (renderMode === 'continuous') return;

    const idField = polygonStats?.idField || (polygonLevel === 'district' ? 'district' : polygonLevel === 'sector' ? 'sector' : 'area');

    const handlePolygonMove = (event) => {
      const feature = event.features?.[0];
      if (!feature) return;

      const props = feature.properties || {};
      const idValue = props[idField] || props.name || props.code || 'n/a';
      const stats = polygonStats?.stats?.[idValue] || props;

      const mean = Number(stats.mean_price || stats.mean || props.mean_price || 0);
      const median = Number(stats.median_price || stats.median || props.median_price || 0);
      const sales = Number(stats.sales || props.sales || 0);

      if (!popupRef.current) {
        popupRef.current = new mapboxgl.Popup({ closeButton: false, closeOnClick: false });
      }

      popupRef.current
        .setLngLat(event.lngLat)
        .setHTML(
          `<div style="font-family: system-ui, -apple-system, sans-serif; font-size: 10px;">
            <strong style="font-size: 11px; color: #1e293b;">${idValue}</strong><br/>
            <span style="color: #64748b;">Mean: ${mean ? mean.toLocaleString('en-GB', { style: 'currency', currency: 'GBP' }) : 'n/a'}</span><br/>
            <span style="color: #64748b;">Median: ${median ? median.toLocaleString('en-GB', { style: 'currency', currency: 'GBP' }) : 'n/a'}</span><br/>
            <span style="color: #64748b;">Sales: ${Number.isFinite(sales) ? sales.toLocaleString('en-GB') : 'n/a'}</span>
            ${polygonStatsMonth ? `<br/><span style="color: #94a3b8; font-size: 9px;">Month: ${polygonStatsMonth}</span>` : ''}
          </div>`
        )
        .addTo(map.current);
    };

    const handlePolygonClick = (event) => {
      if (!onAIClick) return;
      
      const feature = event.features?.[0];
      if (!feature) return;

      const props = feature.properties || {};
      const idValue = props[idField] || props.name || props.code || 'n/a';
      const stats = polygonStats?.stats?.[idValue] || props;

      const mean = Number(stats.mean_price || stats.mean || props.mean_price || 0);
      const median = Number(stats.median_price || stats.median || props.median_price || 0);
      const sales = Number(stats.sales || props.sales || 0);

      onAIClick({
        name: idValue,
        mean: mean,
        median: median,
        sales: sales,
        level: polygonLevel,
        month: polygonStatsMonth
      });
    };

    const handlePolygonLeave = () => {
      if (popupRef.current) popupRef.current.remove();
    };

    map.current.on('mousemove', 'polygon-fill', handlePolygonMove);
    map.current.on('mouseleave', 'polygon-fill', handlePolygonLeave);
    map.current.on('click', 'polygon-fill', handlePolygonClick);
    
    // Change cursor to pointer when hovering polygons
    map.current.on('mouseenter', 'polygon-fill', () => {
      map.current.getCanvas().style.cursor = 'pointer';
    });
    map.current.on('mouseleave', 'polygon-fill', () => {
      map.current.getCanvas().style.cursor = '';
    });

    return () => {
      if (map.current) {
        map.current.off('mousemove', 'polygon-fill', handlePolygonMove);
        map.current.off('mouseleave', 'polygon-fill', handlePolygonLeave);
        map.current.off('click', 'polygon-fill', handlePolygonClick);
        map.current.off('mouseenter', 'polygon-fill');
        map.current.off('mouseleave', 'polygon-fill');
      }
      if (popupRef.current) popupRef.current.remove();
    };
  }, [mapLoaded, renderMode, polygonLevel, polygonStats, polygonStatsMonth]);

  // Update heatmap when data changes
  useEffect(() => {
    if (!map.current || !mapLoaded || !geoData) return;

    const featureCount = geoData.features?.length || 0;
    if (featureCount === 0) return;

    const scheme = colorSchemes?.[selectedVariable] || colorSchemes.market_value;

    const sourceId = 'heatmap-source';
    const pointsSourceId = 'heatmap-points-source';
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

    const effectiveBlend = renderMode === 'polygon-points' ? 0 : blend;
    const blendClamped = Math.max(0, Math.min(1, Number(effectiveBlend) || 0));
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
        4, 3,
        10, 6,
        13, 10,
        15, 14
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
        'case',
        ['==', ['to-number', ['get', 'group']], 0],
        ['*', 0.85, ['-', 1, pointsBlend]],  // Group 0: fade out (0.85 -> 0)
        ['*', 0.85, pointsBlend]  // Group 1: fade in (0 -> 0.85)
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

    if (!map.current.getSource(pointsSourceId)) {
      map.current.addSource(pointsSourceId, {
        type: 'geojson',
        data: pointsData || EMPTY_GEOJSON
      });
    } else {
      map.current.getSource(pointsSourceId).setData(pointsData || EMPTY_GEOJSON);
    }

    if (!map.current.getLayer(rainbowPointsId)) {
      map.current.addLayer({
        id: rainbowPointsId,
        type: 'circle',
        source: pointsSourceId,
        paint: rainbowPointsPaint
      });
    } else {
      Object.entries(rainbowPointsPaint).forEach(([key, value]) => {
        map.current.setPaintProperty(rainbowPointsId, key, value);
      });
    }
  }, [geoData, pointsData, selectedVariable, mapLoaded, blend, pointsBlend, renderMode]);

  const polygonAreaData = useMemo(() => {
    if (!polygonGeoData && !polygonNextGeoData) return EMPTY_GEOJSON;
    const currentFeatures = (polygonGeoData?.features || []).map((feature) => ({
      ...feature,
      properties: { ...feature.properties, group: 0 }
    }));
    const nextFeatures = (polygonNextGeoData?.features || []).map((feature) => ({
      ...feature,
      properties: { ...feature.properties, group: 1 }
    }));
    return {
      type: 'FeatureCollection',
      features: [...currentFeatures, ...nextFeatures]
    };
  }, [polygonGeoData, polygonNextGeoData]);

  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const sourceId = 'polygon-areas';
    const pointsSourceId = 'polygon-points';
    const fillLayerId = 'polygon-fill';
    const outlineLayerId = 'polygon-outline';
    const pointsLayerId = 'polygon-dots';

    const pointsData = polygonPointsData || EMPTY_GEOJSON;

    if (!map.current.getSource(sourceId)) {
      map.current.addSource(sourceId, {
        type: 'geojson',
        data: polygonAreaData
      });
    } else {
      map.current.getSource(sourceId).setData(polygonAreaData);
    }

    if (!map.current.getSource(pointsSourceId)) {
      map.current.addSource(pointsSourceId, {
        type: 'geojson',
        data: pointsData
      });
    } else {
      map.current.getSource(pointsSourceId).setData(pointsData);
    }

    const baseFillPaint = {
      'fill-color': [
        'interpolate',
        ['linear'],
        ['coalesce', ['get', 'median_price'], 0],
        200000, 'rgb(24, 75, 125)',
        350000, 'rgb(33, 146, 175)',
        500000, 'rgb(84, 213, 178)',
        650000, 'rgb(182, 229, 121)',
        800000, 'rgb(255, 196, 111)',
        1000000, 'rgb(255, 120, 90)'
      ]
    };

    if (!map.current.getLayer(fillLayerId)) {
      map.current.addLayer({
        id: fillLayerId,
        type: 'fill',
        source: sourceId,
        paint: baseFillPaint
      });
    } else {
      Object.entries(baseFillPaint).forEach(([key, value]) => {
        map.current.setPaintProperty(fillLayerId, key, value);
      });
    }

    if (!map.current.getLayer(outlineLayerId)) {
      map.current.addLayer({
        id: outlineLayerId,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': 'rgba(255, 255, 255, 0.12)',
          'line-width': 0.8
        }
      });
    }

    if (!map.current.getLayer(pointsLayerId)) {
      map.current.addLayer({
        id: pointsLayerId,
        type: 'circle',
        source: pointsSourceId,
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['sqrt', ['coalesce', ['get', 'sales'], 0]],
            1, 3,
            10, 7,
            50, 12
          ],
          'circle-color': [
            'interpolate',
            ['linear'],
            ['coalesce', ['get', 'median_price'], 0],
            200000, 'rgba(33, 146, 175, 0.7)',
            500000, 'rgba(84, 213, 178, 0.8)',
            800000, 'rgba(255, 196, 111, 0.9)',
            1000000, 'rgba(255, 120, 90, 0.95)'
          ],
          'circle-stroke-width': 1,
          'circle-stroke-color': 'rgba(10, 15, 20, 0.7)',
          'circle-opacity': 0.85
        }
      });
    }

    const polygonVisible = renderMode === 'polygon' ? 'visible' : 'none';
    const pointsVisible = 'none';

    if (map.current.getLayer(fillLayerId)) {
      map.current.setLayoutProperty(fillLayerId, 'visibility', polygonVisible);
    }
    if (map.current.getLayer(outlineLayerId)) {
      map.current.setLayoutProperty(outlineLayerId, 'visibility', polygonVisible);
    }
    if (map.current.getLayer(pointsLayerId)) {
      map.current.setLayoutProperty(pointsLayerId, 'visibility', pointsVisible);
    }
  }, [mapLoaded, polygonAreaData, polygonPointsData, renderMode]);

  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    const fillLayerId = 'polygon-fill';

    const blendClamped = Math.max(0, Math.min(1, Number(polygonBlend) || 0));
    const alpha = [
      'case',
      ['==', ['to-number', ['get', 'group']], 0],
      ['-', 1, blendClamped],
      blendClamped
    ];

    if (map.current.getLayer(fillLayerId)) {
      map.current.setPaintProperty(fillLayerId, 'fill-opacity', ['*', 0.85, alpha]);
      map.current.setPaintProperty(fillLayerId, 'fill-opacity-transition', { duration: 200, delay: 0 });
    }
  }, [mapLoaded, polygonBlend]);

  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    const heatmapVisible = renderMode === 'continuous' ? 'visible' : 'none';
    const rainbowVisible = renderMode === 'points' ? 'visible' : 'none';
    const heatmapLayerId = 'heatmap-layer';
    const rainbowPointsId = 'heatmap-rainbow-points';

    if (map.current.getLayer(heatmapLayerId)) {
      map.current.setLayoutProperty(heatmapLayerId, 'visibility', heatmapVisible);
    }
    if (map.current.getLayer(rainbowPointsId)) {
      map.current.setLayoutProperty(rainbowPointsId, 'visibility', rainbowVisible);
    }
  }, [mapLoaded, renderMode]);

  return (
    <div
      ref={mapContainer}
      className="w-full h-full"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
    />
  );
};

export default MapEngine;