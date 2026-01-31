/**
 * PropertyNotifications Component
 * Shows compact popups only where the heatmap is visibly red
 */

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

// ============= CONFIGURABLE VARIABLES =============
const MAX_POPUPS = 3;                    // Maximum popups visible at once
const FADE_IN_TIME = 0.4;                // Seconds for fade in animation
const FADE_OUT_TIME = 0.4;               // Seconds for fade out animation
const STAY_TIME = 1.5;                   // Seconds popup stays visible
const POPUP_WIDTH = 85;                  // Popup width in pixels
const POPUP_HEIGHT = 50;                 // Popup height in pixels
const FONT_SIZE_LOCATION = 10;           // Font size for location name (px)
const FONT_SIZE_PRICE = 11;              // Font size for price (px)
const RED_COLOR_THRESHOLD = 150;         // Red channel minimum (0-255) for "visibly red"
const RED_DOMINANCE_RATIO = 1.5;         // Red must be this times brighter than green/blue
const MIN_ZOOM_LEVEL = 5;                // Minimum zoom to show popups
const MIN_DISTANCE_PX = 80;              // Minimum screen distance between popups
// ==================================================

const PropertyNotifications = ({ salesData2025, activeMonth, monthSamples, mapInstance }) => {
  const [activeNotifications, setActiveNotifications] = useState([]);
  const [screenPositions, setScreenPositions] = useState({});
  const notificationIdCounter = useRef(0);
  const lastUpdateMonth = useRef(null);

  useEffect(() => {
    if (!salesData2025 || !monthSamples || !mapInstance) return;

    const baseMonth = Math.floor(activeMonth);
    const currentZoom = mapInstance.getZoom();

    if (currentZoom < MIN_ZOOM_LEVEL) {
      setActiveNotifications([]);
      return;
    }

    if (lastUpdateMonth.current !== null && Math.abs(baseMonth - lastUpdateMonth.current) < 1) {
      return;
    }
    lastUpdateMonth.current = baseMonth;

    const startYear = salesData2025?.meta?.startYear ?? 2018;
    const year = startYear + Math.floor((baseMonth - 1) / 12);
    const month = ((baseMonth - 1) % 12) + 1;
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    const monthData = monthSamples[monthKey] || [];

    if (monthData.length === 0) {
      setActiveNotifications([]);
      return;
    }

    const bounds = mapInstance.getBounds();
    const visibleProps = monthData.filter(sale => {
      return sale.lng >= bounds.getWest() &&
             sale.lng <= bounds.getEast() &&
             sale.lat >= bounds.getSouth() &&
             sale.lat <= bounds.getNorth();
    });

    if (visibleProps.length === 0) {
      setActiveNotifications([]);
      return;
    }

    let canvas = null;
    let ctx = null;
    try {
      canvas = mapInstance.getCanvas();
      ctx = canvas?.getContext('2d', { willReadFrequently: true });
    } catch (error) {
      console.warn('Heatmap canvas not available:', error);
    }

    if (!canvas || !ctx) {
      setActiveNotifications([]);
      return;
    }

    const redAreaProps = [];

    for (const sale of visibleProps) {
      const point = mapInstance.project([sale.lng, sale.lat]);
      const x = Math.floor(point.x);
      const y = Math.floor(point.y);

      if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
        try {
          const pixelData = ctx.getImageData(x, y, 1, 1).data;
          const r = pixelData[0];
          const g = pixelData[1];
          const b = pixelData[2];

          const isRed = r >= RED_COLOR_THRESHOLD &&
                        r > g * RED_DOMINANCE_RATIO &&
                        r > b * RED_DOMINANCE_RATIO;

          if (isRed) {
            redAreaProps.push({
              ...sale,
              colorIntensity: r,
              notifId: notificationIdCounter.current++,
              screenX: point.x,
              screenY: point.y
            });
          }
        } catch {
          // Ignore pixel read errors
        }
      }
    }

    if (redAreaProps.length === 0) {
      setActiveNotifications([]);
      return;
    }

    const sortedRed = redAreaProps
      .sort((a, b) => {
        if (b.colorIntensity !== a.colorIntensity) {
          return b.colorIntensity - a.colorIntensity;
        }
        return b.price - a.price;
      });

    const spaced = [];
    for (const candidate of sortedRed) {
      if (spaced.length >= MAX_POPUPS) break;
      const tooClose = spaced.some(existing => {
        const dx = candidate.screenX - existing.screenX;
        const dy = candidate.screenY - existing.screenY;
        return Math.hypot(dx, dy) < MIN_DISTANCE_PX;
      });
      if (!tooClose) spaced.push(candidate);
    }

    if (spaced.length === 0) {
      setActiveNotifications([]);
      return;
    }

    setActiveNotifications(spaced);

    const timeout = setTimeout(() => {
      setActiveNotifications([]);
    }, STAY_TIME * 1000);

    return () => clearTimeout(timeout);
  }, [activeMonth, salesData2025, monthSamples, mapInstance]);

  useEffect(() => {
    if (!mapInstance || activeNotifications.length === 0) return;

    const updatePositions = () => {
      const newPositions = {};
      activeNotifications.forEach(notif => {
        const point = mapInstance.project([notif.lng, notif.lat]);
        newPositions[notif.notifId] = {
          x: point.x,
          y: point.y
        };
      });
      setScreenPositions(newPositions);
    };

    updatePositions();

    mapInstance.on('move', updatePositions);
    mapInstance.on('zoom', updatePositions);

    return () => {
      mapInstance.off('move', updatePositions);
      mapInstance.off('zoom', updatePositions);
    };
  }, [mapInstance, activeNotifications]);

  if (!mapInstance) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-40">
      <AnimatePresence mode="popLayout">
        {activeNotifications.map((notification) => {
          const position = screenPositions[notification.notifId];
          if (!position) return null;

          const priceK = notification.price / 1000;
          const priceDisplay = priceK >= 1000
            ? `£${(priceK / 1000).toFixed(1)}M`
            : `£${Math.round(priceK)}K`;

          const location = notification.district || notification.postcode || 'Unknown';

          return (
            <motion.div
              key={notification.notifId}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8, transition: { duration: FADE_OUT_TIME, ease: 'easeIn' } }}
              transition={{ duration: FADE_IN_TIME, ease: 'easeOut' }}
              style={{
                position: 'absolute',
                left: position.x,
                top: position.y,
                transform: 'translate(-50%, -100%)',
                marginTop: '-8px'
              }}
              className="pointer-events-none"
            >
              <div
                className="bg-gray-700/90 backdrop-blur-sm rounded-xl shadow-lg px-2.5 py-1.5 border border-gray-600/50"
                style={{
                  width: `${POPUP_WIDTH}px`,
                  minHeight: `${POPUP_HEIGHT}px`,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center'
                }}
              >
                <div
                  className="text-white font-medium leading-tight text-center truncate w-full"
                  style={{ fontSize: `${FONT_SIZE_LOCATION}px` }}
                >
                  {location}
                </div>

                <div
                  className="text-amber-400 font-bold leading-tight mt-0.5"
                  style={{ fontSize: `${FONT_SIZE_PRICE}px` }}
                >
                  {priceDisplay}
                </div>

                <div
                  className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-1.5 h-1.5 rotate-45 bg-gray-700 border-r border-b border-gray-600/50"
                />
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

export default PropertyNotifications;
