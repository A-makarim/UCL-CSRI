/**
 * MapEngine Component
 * Mapbox GL JS v3 with 3D Globe projection
 * Polygons + dots + heatmap overlays
 */

import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { fetchLiveListing, fetchLiveListings, fetchTransactions } from '../services/localData';

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

const PROPERTY_TYPE_LABELS = {
  D: 'Detached',
  S: 'Semi-detached',
  T: 'Terraced',
  F: 'Flat',
  O: 'Other'
};

const OLD_NEW_LABELS = {
  Y: 'New',
  N: 'Existing'
};

const DURATION_LABELS = {
  F: 'Freehold',
  L: 'Leasehold'
};

const escapeHtml = (value) => {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const MapEngine = ({
  polygonData,
  polygonStats,
  polygonRange,
  polygonIdKey,
  activeMonth,
  pointData,
  liveData,
  showPolygons,
  showDots,
  showHeatmap,
  showLive,
  onMapLoad,
  onUpdateStateChange,
  onRequestAgentSummary
}) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const mapLoadedRef = useRef(false);
  const hoverPopupRef = useRef(null);
  const clickPopupRef = useRef(null);
  const listenersAttachedRef = useRef(false);
  const liveListenersAttachedRef = useRef(false);
  const polygonKeyRef = useRef(null);
  const activeMonthRef = useRef(activeMonth);
  const polygonModeRef = useRef(polygonIdKey);
  const agentRequestRef = useRef(onRequestAgentSummary);
  const clickSeqRef = useRef(0);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    activeMonthRef.current = activeMonth;
  }, [activeMonth]);

  useEffect(() => {
    polygonModeRef.current = polygonIdKey;
  }, [polygonIdKey]);

  useEffect(() => {
    agentRequestRef.current = onRequestAgentSummary;
  }, [onRequestAgentSummary]);

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
    const polygonSourceId = 'polygon-source';
    const polygonFillId = 'polygon-fill';
    const polygonOutlineId = 'polygon-outline';
    const pointSourceId = 'point-source';
    const heatmapLayerId = 'point-heatmap';
    const dotLayerId = 'point-dots';
    const liveSourceId = 'live-source';
    const liveClusterLayerId = 'live-clusters';
    const liveClusterCountId = 'live-cluster-count';
    const livePointLayerId = 'live-points';

    const range = polygonRange || { min: 0, max: 1 };
    const pointRange = getPointRange(pointData);

    const polygonOpacity = 1;
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
      !mapInstance.getSource(polygonSourceId) || polygonKeyRef.current !== polygonIdKey;

    if (needsPolygonSourceReset) {
      if (mapInstance.getLayer(polygonFillId)) mapInstance.removeLayer(polygonFillId);
      if (mapInstance.getLayer(polygonOutlineId)) mapInstance.removeLayer(polygonOutlineId);
      if (mapInstance.getSource(polygonSourceId)) mapInstance.removeSource(polygonSourceId);

      mapInstance.addSource(polygonSourceId, {
        type: 'geojson',
        data: polygonData || EMPTY_GEOJSON,
        promoteId: polygonIdKey || undefined
      });
      polygonKeyRef.current = polygonIdKey;
    } else {
      mapInstance.getSource(polygonSourceId).setData(polygonData || EMPTY_GEOJSON);
    }

    if (!mapInstance.getLayer(polygonFillId)) {
      mapInstance.addLayer({
        id: polygonFillId,
        type: 'fill',
        source: polygonSourceId,
        paint: {
          'fill-color': buildPolygonColor,
          'fill-opacity': polygonOpacity
        }
      });
    } else {
      mapInstance.setPaintProperty(polygonFillId, 'fill-color', buildPolygonColor);
      mapInstance.setPaintProperty(polygonFillId, 'fill-opacity', polygonOpacity);
    }

    if (!mapInstance.getLayer(polygonOutlineId)) {
      mapInstance.addLayer({
        id: polygonOutlineId,
        type: 'line',
        source: polygonSourceId,
        paint: {
          'line-color': 'rgba(255,255,255,0.25)',
          'line-width': 0.6
        }
      });
    }

    if (polygonStats) {
      const entries = Object.entries(polygonStats);
      if (onUpdateStateChange) onUpdateStateChange(true);

      entries.forEach(([code, stats]) => {
        mapInstance.setFeatureState(
          { source: polygonSourceId, id: code },
          {
            median_price: stats?.median_price ?? null,
            mean_price: stats?.mean_price ?? null,
            sales: stats?.sales ?? 0
          }
        );
      });

      if (onUpdateStateChange) onUpdateStateChange(false);
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
    mapInstance.setLayoutProperty(polygonFillId, 'visibility', showPolygons ? 'visible' : 'none');
    mapInstance.setLayoutProperty(polygonOutlineId, 'visibility', showPolygons ? 'visible' : 'none');

    // Live listings overlay (separate from monthly PPD/predictions)
    if (liveData) {
      if (!mapInstance.getSource(liveSourceId)) {
        mapInstance.addSource(liveSourceId, {
          type: 'geojson',
          data: liveData,
          cluster: true,
          clusterRadius: 55,
          clusterMaxZoom: 12
        });
      } else {
        mapInstance.getSource(liveSourceId).setData(liveData);
      }

      if (!mapInstance.getLayer(liveClusterLayerId)) {
        mapInstance.addLayer({
          id: liveClusterLayerId,
          type: 'circle',
          source: liveSourceId,
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': 'rgba(56, 189, 248, 0.35)',
            'circle-stroke-color': 'rgba(56, 189, 248, 0.8)',
            'circle-stroke-width': 1,
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['get', 'point_count'],
              10, 14,
              100, 22,
              500, 30,
              1500, 40
            ]
          }
        });
      }

      if (!mapInstance.getLayer(liveClusterCountId)) {
        mapInstance.addLayer({
          id: liveClusterCountId,
          type: 'symbol',
          source: liveSourceId,
          filter: ['has', 'point_count'],
          layout: {
            'text-field': ['get', 'point_count_abbreviated'],
            'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
            'text-size': 12
          },
          paint: {
            'text-color': 'rgba(255,255,255,0.9)'
          }
        });
      }

      if (!mapInstance.getLayer(livePointLayerId)) {
        mapInstance.addLayer({
          id: livePointLayerId,
          type: 'circle',
          source: liveSourceId,
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],
              6, 2.5,
              11, 4,
              14, 7
            ],
            'circle-color': [
              'match',
              ['get', 'kind'],
              'rent', 'rgba(251, 146, 60, 0.85)',
              'rgba(56, 189, 248, 0.9)'
            ],
            'circle-opacity': 0.8,
            'circle-blur': 0.15,
            'circle-stroke-width': 0.6,
            'circle-stroke-color': 'rgba(255,255,255,0.35)'
          }
        });
      }

      mapInstance.setLayoutProperty(liveClusterLayerId, 'visibility', showLive ? 'visible' : 'none');
      mapInstance.setLayoutProperty(liveClusterCountId, 'visibility', showLive ? 'visible' : 'none');
      mapInstance.setLayoutProperty(livePointLayerId, 'visibility', showLive ? 'visible' : 'none');
    }

    if (!listenersAttachedRef.current) {
      if (!hoverPopupRef.current) {
        hoverPopupRef.current = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 12 });
      }
      if (!clickPopupRef.current) {
        clickPopupRef.current = new mapboxgl.Popup({ closeButton: true, closeOnClick: true, offset: 12 });
      }

      const buildSummaryHtml = (title, median, meanPrice, sales, subtitle) => {
        const safeTitle = escapeHtml(title);
        const safeSubtitle = subtitle ? `<div class="popup-sub">${escapeHtml(subtitle)}</div>` : '';
        const meanLine = Number.isFinite(meanPrice)
          ? `<div>Mean: ${formatPrice(meanPrice)}</div>`
          : '';
        return `
          <div class="popup-title">${safeTitle}</div>
          ${safeSubtitle}
          <div class="popup-metrics">
            <div>Median: ${formatPrice(median)}</div>
            ${meanLine}
            <div>Sales: ${Number.isFinite(sales) ? sales : 0}</div>
          </div>
        `;
      };

      const renderTransactionRow = (tx) => {
        const price = formatPrice(Number(tx.price));
        const propertyType = PROPERTY_TYPE_LABELS[tx.property_type] || tx.property_type || '';
        const tenure = DURATION_LABELS[tx.duration] || tx.duration || '';
        const buildType = OLD_NEW_LABELS[tx.old_new] || tx.old_new || '';
        const addressLine = [tx.paon, tx.saon, tx.street].filter(Boolean).join(' ');
        const localityLine = [tx.locality, tx.town_city, tx.county].filter(Boolean).join(', ');
        const address = [addressLine, localityLine].filter(Boolean).join(', ');
        const meta = [tx.date, tx.postcode, propertyType, tenure, buildType].filter(Boolean).join(' • ');
        return `
          <div class="popup-row">
            <div class="popup-price">${escapeHtml(price)}</div>
            <div class="popup-meta">${escapeHtml(meta)}</div>
            ${address ? `<div class="popup-address">${escapeHtml(address)}</div>` : ''}
          </div>
        `;
      };

      const buildTransactionsHtml = (details, { totalOverride } = {}) => {
        if (!details || !Array.isArray(details.transactions)) {
          return '<div class="popup-empty">No transactions found.</div>';
        }
        const total = Number(details.total) || 0;
        const shown = Number(details.shown) || details.transactions.length;
        const note = Number.isFinite(totalOverride)
          ? `Sample transactions (showing ${shown} of ${totalOverride} sales)`
          : (total > shown ? `Showing ${shown} of ${total} sales` : `${total} sales`);
        const rows = details.transactions.map(renderTransactionRow).join('');
        return `
          <div class="popup-note">${escapeHtml(note)}</div>
          <div class="popup-list">${rows || '<div class="popup-empty">No transactions found.</div>'}</div>
        `;
      };

      const buildNoTransactionsHtml = (reason) => {
        const msg = reason || 'No transactions available.';
        return `
          <div class="popup-section">
            <div class="popup-note">${escapeHtml(msg)}</div>
          </div>
        `;
      };

      const renderListingRow = (listing) => {
        const kind = listing?._kind || listing?.kind || '';
        const price = kind === 'rent'
          ? formatPrice(Number(listing?.rent_pcm))
          : formatPrice(Number(listing?.sale_price));
        const beds = listing?.bedrooms ? `${listing.bedrooms} bd` : '';
        const address = listing?.street_address || listing?.address || '';
        const url = listing?.listing_url || listing?.url || '';
        return `
          <div class="popup-row">
            <div class="popup-price">${escapeHtml(price)} ${beds ? `<span class="popup-tag">${escapeHtml(beds)}</span>` : ''}</div>
            ${address ? `<div class="popup-meta">${escapeHtml(address)}</div>` : ''}
            ${url ? `<div class="popup-address"><a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">Open listing</a></div>` : ''}
          </div>
        `;
      };

      const buildLiveHtml = (payload) => {
        const total = Number(payload?.total) || 0;
        const shown = (payload?.listings || []).length;
        const summary = payload?.summary || {};
        const sale = summary.sale || {};
        const rent = summary.rent || {};
        const rows = (payload?.listings || []).map(renderListingRow).join('');
        return `
          <div class="popup-section">
            <div class="popup-note">Live listings (${total} total, showing ${shown})</div>
            <div class="popup-metrics">
              <div>Sale median: ${formatPrice(Number(sale.median))}</div>
              <div>Rent median: ${formatPrice(Number(rent.median))}</div>
            </div>
            <div class="popup-list">${rows || '<div class="popup-empty">No listings found.</div>'}</div>
          </div>
        `;
      };


      const handlePointHover = (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        if (clickPopupRef.current?.isOpen()) return;
        const { postcode, sales, median_price, mean_price } = feature.properties || {};
        hoverPopupRef.current
          .setLngLat(event.lngLat)
          .setHTML(
            buildSummaryHtml(
              postcode || 'Postcode',
              Number(median_price),
              Number(mean_price),
              Number.isFinite(Number(sales)) ? Number(sales) : 0
            )
          )
          .addTo(mapInstance);
      };

      const handlePolygonHover = (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        if (clickPopupRef.current?.isOpen()) return;
        const props = feature.properties || {};
        const label = props.area || props.district || props.sector || 'Area';
        const state = mapInstance.getFeatureState({ source: polygonSourceId, id: feature.id });
        const median = Number(state?.median_price);
        const meanPrice = Number(state?.mean_price);
        const sales = Number.isFinite(state?.sales) ? state.sales : 0;
        hoverPopupRef.current
          .setLngLat(event.lngLat)
          .setHTML(
            buildSummaryHtml(label, median, meanPrice, sales)
          )
          .addTo(mapInstance);
      };

      const handlePointClick = async (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        const { postcode, sales, median_price, mean_price } = feature.properties || {};
        const month = activeMonthRef.current;
        const header = `${postcode || 'Postcode'}${month ? ` • ${month}` : ''}`;
        const summaryHtml = buildSummaryHtml(
          header,
          Number(median_price),
          Number(mean_price),
          Number.isFinite(Number(sales)) ? Number(sales) : 0
        );
        const seq = ++clickSeqRef.current;

        clickPopupRef.current
          .setLngLat(event.lngLat)
          .setHTML(`${summaryHtml}<div class="popup-loading">Loading transactions…</div>`)
          .addTo(mapInstance);

        if (!month || !postcode) {
          clickPopupRef.current.setHTML(
            `${summaryHtml}<div class="popup-empty">No month selected.</div>`
          );
          return;
        }

        // Predictions are model outputs; we do not have underlying Land Registry transactions to display.
        if (month >= '2026-01') {
          let html = `${summaryHtml}${buildNoTransactionsHtml(
            'Predicted month: no underlying Land Registry transactions for this view.'
          )}`;
          if (showLive) {
            try {
              const livePayload = await fetchLiveListings({
                mode: 'postcode',
                code: postcode,
                kind: 'all',
                limit: 8
              });
              html += buildLiveHtml(livePayload);
            } catch {
              // ignore live failures
            }
          }
          clickPopupRef.current.setHTML(html);
          if (agentRequestRef.current) {
            agentRequestRef.current({
              selectionType: 'ppd',
              title: postcode || 'Postcode',
              mode: 'postcode',
              code: postcode,
              month,
              median_price: Number(median_price),
              mean_price: Number(mean_price),
              sales: Number(sales),
              context: {
                selection: {
                  type: 'postcode',
                  title: postcode || 'Postcode',
                  mode: 'postcode',
                  code: postcode,
                  month,
                  median_price: Number(median_price),
                  mean_price: Number(mean_price),
                  sales: Number(sales)
                }
              }
            });
          }
          return;
        }

        let livePayload = null;
        try {
          const details = await fetchTransactions({
            month,
            mode: 'postcode',
            code: postcode,
            limit: 200
          });
          if (seq !== clickSeqRef.current) return;
          let html = `${summaryHtml}${buildTransactionsHtml(details, { totalOverride: Number(sales) })}`;
          if (showLive) {
            try {
              livePayload = await fetchLiveListings({
                mode: 'postcode',
                code: postcode,
                kind: 'all',
                limit: 8
              });
              if (seq === clickSeqRef.current) {
                html += buildLiveHtml(livePayload);
              }
            } catch {
              // ignore live failures
            }
          }
          clickPopupRef.current.setHTML(html);
        } catch (error) {
          if (seq !== clickSeqRef.current) return;
          clickPopupRef.current.setHTML(
            `${summaryHtml}<div class="popup-empty">Failed to load transactions.</div>`
          );
        }

        if (agentRequestRef.current && month) {
          agentRequestRef.current({
            selectionType: 'ppd',
            title: postcode || 'Postcode',
            mode: 'postcode',
            code: postcode,
            month,
            median_price: Number(median_price),
            mean_price: Number(mean_price),
            sales: Number(sales),
            context: {
              selection: {
                type: 'postcode',
                title: postcode || 'Postcode',
                mode: 'postcode',
                code: postcode,
                month,
                median_price: Number(median_price),
                mean_price: Number(mean_price),
                sales: Number(sales)
              },
              live: livePayload
            }
          });
        }
      };

      const handlePolygonClick = async (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        const props = feature.properties || {};
        const label = props.area || props.district || props.sector || 'Area';
        const state = mapInstance.getFeatureState({ source: polygonSourceId, id: feature.id });
        const median = Number(state?.median_price);
        const meanPrice = Number(state?.mean_price);
        const sales = Number.isFinite(state?.sales) ? state.sales : 0;
        const month = activeMonthRef.current;
        const header = `${label}${month ? ` • ${month}` : ''}`;
        const summaryHtml = buildSummaryHtml(header, median, meanPrice, sales);
        const seq = ++clickSeqRef.current;
        let transactionsHtml = '<div class="popup-loading">Loading transactions…</div>';

        clickPopupRef.current
          .setLngLat(event.lngLat)
          .setHTML(`${summaryHtml}${transactionsHtml}`)
          .addTo(mapInstance);

        const mode = polygonModeRef.current;
        if (!month || !mode || !feature.id) {
          clickPopupRef.current.setHTML(
            `${summaryHtml}<div class="popup-empty">No month selected.</div>`
          );
          return;
        }

        // Predictions are model outputs; we do not have underlying Land Registry transactions to display.
        if (month >= '2026-01') {
          let html = `${summaryHtml}${buildNoTransactionsHtml(
            'Predicted month: no underlying Land Registry transactions for this view.'
          )}`;
          if (showLive) {
            try {
              const livePayload = await fetchLiveListings({
                mode,
                code: String(feature.id),
                kind: 'all',
                limit: 8
              });
              html += buildLiveHtml(livePayload);
            } catch {
              // ignore live failures
            }
          }
          clickPopupRef.current.setHTML(html);
          if (agentRequestRef.current) {
            agentRequestRef.current({
              selectionType: 'ppd',
              title: label,
              mode,
              code: String(feature.id),
              month,
              median_price: median,
              mean_price: meanPrice,
              sales,
              context: {
                selection: {
                  type: mode,
                  title: label,
                  mode,
                  code: String(feature.id),
                  month,
                  median_price: median,
                  mean_price: meanPrice,
                  sales
                }
              }
            });
          }
          return;
        }

        let livePayload = null;
        try {
          const details = await fetchTransactions({
            month,
            mode,
            code: String(feature.id),
            limit: 200
          });
          if (seq !== clickSeqRef.current) return;
          transactionsHtml = buildTransactionsHtml(details, { totalOverride: sales });
          let html = `${summaryHtml}${transactionsHtml}`;
          if (showLive) {
            try {
              livePayload = await fetchLiveListings({
                mode,
                code: String(feature.id),
                kind: 'all',
                limit: 8
              });
              if (seq === clickSeqRef.current) {
                html += buildLiveHtml(livePayload);
              }
            } catch {
              // ignore live failures
            }
          }
          clickPopupRef.current.setHTML(html);
        } catch (error) {
          if (seq !== clickSeqRef.current) return;
          transactionsHtml = '<div class="popup-empty">Failed to load transactions.</div>';
          clickPopupRef.current.setHTML(`${summaryHtml}${transactionsHtml}`);
        }

        if (agentRequestRef.current && month) {
          agentRequestRef.current({
            selectionType: 'ppd',
            title: label,
            mode,
            code: String(feature.id),
            month,
            median_price: median,
            mean_price: meanPrice,
            sales,
            context: {
              selection: {
                type: mode,
                title: label,
                mode,
                code: String(feature.id),
                month,
                median_price: median,
                mean_price: meanPrice,
                sales
              },
              live: livePayload
            }
          });
        }
      };

      const setCursor = () => {
        mapInstance.getCanvas().style.cursor = 'pointer';
      };
      const resetCursor = () => {
        mapInstance.getCanvas().style.cursor = '';
      };

      mapInstance.on('mousemove', dotLayerId, handlePointHover);
      mapInstance.on('mousemove', polygonFillId, handlePolygonHover);
      mapInstance.on('click', dotLayerId, handlePointClick);
      mapInstance.on('click', polygonFillId, handlePolygonClick);
      mapInstance.on('mouseenter', dotLayerId, setCursor);
      mapInstance.on('mouseleave', dotLayerId, resetCursor);
      mapInstance.on('mouseenter', polygonFillId, setCursor);
      mapInstance.on('mouseleave', polygonFillId, resetCursor);
      mapInstance.on('mouseleave', dotLayerId, () => hoverPopupRef.current?.remove());
      mapInstance.on('mouseleave', polygonFillId, () => hoverPopupRef.current?.remove());

      listenersAttachedRef.current = true;
    }

    // Live listeners are attached lazily (only when the live layers exist).
    // Note: handlers must be defined in this scope (not inside the PPD listeners block),
    // otherwise toggling Live can throw and blank the map.
    const ensurePopups = () => {
      if (!hoverPopupRef.current) {
        hoverPopupRef.current = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 12 });
      }
      if (!clickPopupRef.current) {
        clickPopupRef.current = new mapboxgl.Popup({ closeButton: true, closeOnClick: true, offset: 12 });
      }
    };

    const handleLiveHover = (event) => {
      const feature = event.features?.[0];
      if (!feature) return;
      if (clickPopupRef.current?.isOpen()) return;
      ensurePopups();
      const props = feature.properties || {};
      const kind = props.kind || 'sale';
      const price = Number(props.price);
      const title = `${props.district || 'London'} • ${kind === 'rent' ? 'Rent' : 'Sale'}`;
      const subtitle = props.address ? String(props.address) : '';
      const extra = props.approximate ? 'Approximate location' : '';
      hoverPopupRef.current
        .setLngLat(event.lngLat)
        .setHTML(
          `
            <div class="popup-title">${escapeHtml(title)}</div>
            ${subtitle ? `<div class="popup-sub">${escapeHtml(subtitle)}</div>` : ''}
            <div class="popup-metrics">
              <div>Price: ${formatPrice(price)}</div>
              ${props.bedrooms ? `<div>Bedrooms: ${escapeHtml(props.bedrooms)}</div>` : ''}
              ${extra ? `<div class="popup-note">${escapeHtml(extra)}</div>` : ''}
            </div>
          `
        )
        .addTo(mapInstance);
    };

    const handleLiveClusterClick = (event) => {
      const feature = event.features?.[0];
      if (!feature) return;
      const clusterId = feature.properties?.cluster_id;
      const source = mapInstance.getSource(liveSourceId);
      if (!source || clusterId === undefined) return;
      source.getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err) return;
        mapInstance.easeTo({ center: feature.geometry.coordinates, zoom, duration: 900 });
      });
    };

    const handleLiveClick = async (event) => {
      const feature = event.features?.[0];
      if (!feature) return;
      ensurePopups();
      const props = feature.properties || {};
      const id = feature.id || props.id;
      const kind = props.kind || 'sale';
      const price = Number(props.price);
      const title = `${props.district || 'London'} • ${kind === 'rent' ? 'Rent' : 'Sale'}`;

      const seq = ++clickSeqRef.current;
      clickPopupRef.current
        .setLngLat(event.lngLat)
        .setHTML(
          `
            <div class="popup-title">${escapeHtml(title)}</div>
            ${props.address ? `<div class="popup-sub">${escapeHtml(props.address)}</div>` : ''}
            <div class="popup-metrics">
              <div>Price: ${formatPrice(price)}</div>
              ${props.bedrooms ? `<div>Bedrooms: ${escapeHtml(props.bedrooms)}</div>` : ''}
              ${props.approximate ? `<div class="popup-note">Approximate location</div>` : ''}
            </div>
            <div class="popup-loading">Loading listing details…</div>
          `
        )
        .addTo(mapInstance);

      let details = null;
      if (id) {
        try {
          const res = await fetchLiveListing({ id: String(id) });
          details = res?.listing || null;
        } catch {
          details = null;
        }
      }
      if (seq !== clickSeqRef.current) return;

      const url = props.url || details?.listing_url || '';
      const district = String(props.district || details?.area_code_district || '').toUpperCase();
      const askBtn = id
        ? `<button class="popup-cta" data-ask-live="1" data-id="${escapeHtml(String(id))}">Ask AI about this listing</button>`
        : '';

      const body = details
        ? `
          <div class="popup-section">
            <div class="popup-note">Listing details</div>
            <div class="popup-list">
              <div class="popup-row">
                <div class="popup-meta">${escapeHtml(details.street_address || '')}</div>
                <div class="popup-address">${escapeHtml(details.area_code_district || district || '')}</div>
              </div>
              <div class="popup-row">
                <div class="popup-meta">Bathrooms: ${escapeHtml(details.bathrooms ?? '—')}</div>
                <div class="popup-meta">Living rooms: ${escapeHtml(details.living_rooms ?? '—')}</div>
              </div>
              <div class="popup-row">
                <div class="popup-meta">Size: ${escapeHtml(details.property_size ?? '—')} ${escapeHtml(details.property_size_metric ?? '')}</div>
              </div>
            </div>
          </div>
        `
        : `<div class="popup-empty">No extra details available.</div>`;

      clickPopupRef.current.setHTML(
        `
          <div class="popup-title">${escapeHtml(title)}</div>
          ${props.address ? `<div class="popup-sub">${escapeHtml(props.address)}</div>` : ''}
          <div class="popup-metrics">
            <div>Price: ${formatPrice(price)}</div>
            ${props.bedrooms ? `<div>Bedrooms: ${escapeHtml(props.bedrooms)}</div>` : ''}
          </div>
          ${url ? `<div class="popup-note"><a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">Open listing</a></div>` : ''}
          ${askBtn}
          ${body}
        `
      );

      // 1) Wire the CTA to the AgentPanel (defensive: wait a tick for Mapbox to mount HTML).
      requestAnimationFrame(() => {
        const el = clickPopupRef.current?.getElement();
        const btn = el?.querySelector('button[data-ask-live="1"]');
        if (!btn) return;
        btn.addEventListener(
          'click',
          async () => {
            if (!agentRequestRef.current) return;
            let live = null;
            try {
              live = district
                ? await fetchLiveListings({ mode: 'district', code: district, kind: 'all', limit: 12 })
                : null;
            } catch {
              live = null;
            }
            agentRequestRef.current({
              selectionType: 'live',
              title: district || 'Listing',
              kind,
              code: district || '',
              listingId: String(id || ''),
              listing: details,
              price,
              bedrooms: props.bedrooms,
              context: {
                selection: {
                  type: 'live_listing',
                  title: props.address || title,
                  kind,
                  code: district || '',
                  price,
                  bedrooms: props.bedrooms,
                  url
                },
                live
              }
            });
          },
          { once: true }
        );
      });

      // 2) Auto-send a summary request on click (same behavior as polygons/dots).
      if (agentRequestRef.current) {
        let live = null;
        try {
          live = district
            ? await fetchLiveListings({ mode: 'district', code: district, kind: 'all', limit: 12 })
            : null;
        } catch {
          live = null;
        }
        if (seq === clickSeqRef.current) {
          agentRequestRef.current({
            selectionType: 'live',
            title: district || 'Listing',
            kind,
            code: district || '',
            listingId: String(id || ''),
            listing: details,
            price,
            bedrooms: props.bedrooms,
            context: {
              selection: {
                type: 'live_listing',
                title: props.address || title,
                kind,
                code: district || '',
                price,
                bedrooms: props.bedrooms,
                url
              },
              live
            }
          });
        }
      }
    };

    if (!liveListenersAttachedRef.current && liveData && mapInstance.getLayer(livePointLayerId)) {
      const setCursor = () => {
        mapInstance.getCanvas().style.cursor = 'pointer';
      };
      const resetCursor = () => {
        mapInstance.getCanvas().style.cursor = '';
      };

      mapInstance.on('mousemove', livePointLayerId, handleLiveHover);
      mapInstance.on('click', livePointLayerId, handleLiveClick);
      if (mapInstance.getLayer(liveClusterLayerId)) {
        mapInstance.on('click', liveClusterLayerId, handleLiveClusterClick);
      }
      mapInstance.on('mouseenter', livePointLayerId, setCursor);
      mapInstance.on('mouseleave', livePointLayerId, resetCursor);
      if (mapInstance.getLayer(liveClusterLayerId)) {
        mapInstance.on('mouseenter', liveClusterLayerId, setCursor);
        mapInstance.on('mouseleave', liveClusterLayerId, resetCursor);
      }
      mapInstance.on('mouseleave', livePointLayerId, () => hoverPopupRef.current?.remove());
      liveListenersAttachedRef.current = true;
    }
  }, [polygonData, polygonStats, polygonRange, polygonIdKey, pointData, liveData, showPolygons, showDots, showHeatmap, showLive, mapLoaded, onUpdateStateChange]);

  return (
    <div
      ref={mapContainer}
      className="w-full h-full"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
    />
  );
};

export default MapEngine;
