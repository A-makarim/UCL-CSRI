/**
 * TimeSlider Component - Dynamic Monthly Timeline
 * Accepts an ordered array of YYYY-MM strings.
 */

import React, { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const formatMonth = (value) => {
  if (!value) return '';
  const [year, month] = value.split('-').map(Number);
  const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return `${monthNames[(month || 1) - 1]} ${year}`;
};

const TimeSlider = ({ months, activeIndex, onIndexChange, isUpdating }) => {
  const sliderRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const animationFrame = useRef(null);
  const playRaf = useRef(null);
  const lastTick = useRef(null);
  const playValue = useRef(activeIndex);
  const maxIndex = Math.max(0, (months?.length || 1) - 1);

  const updateIndex = (clientX, immediate = false) => {
    if (!sliderRef.current || maxIndex === 0) return;

    const rect = sliderRef.current.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const nextIndex = Math.round(percentage * maxIndex);

    if (immediate) {
      onIndexChange(nextIndex);
      return;
    }

    if (animationFrame.current) {
      cancelAnimationFrame(animationFrame.current);
    }

    animationFrame.current = requestAnimationFrame(() => {
      onIndexChange(nextIndex);
    });
  };

  const handlePointerDown = (e) => {
    if (e.target.setPointerCapture) {
      e.target.setPointerCapture(e.pointerId);
    }
    setIsDragging(true);
    setIsPlaying(false);
    updateIndex(e.clientX, true);
  };

  const handlePointerMove = (e) => {
    if (isDragging) {
      updateIndex(e.clientX, true);
    }
  };

  const handlePointerUp = (e) => {
    setIsDragging(false);
    if (e.target.releasePointerCapture) {
      e.target.releasePointerCapture(e.pointerId);
    }
    if (animationFrame.current) {
      cancelAnimationFrame(animationFrame.current);
    }
  };

  useEffect(() => {
    return () => {};
  }, [isDragging]);

  useEffect(() => {
    if (!isPlaying || maxIndex === 0) return;

    const monthsPerSecond = 0.6;
    lastTick.current = null;
    playValue.current = activeIndex;

    const tick = (now) => {
      if (lastTick.current == null) lastTick.current = now;
      const dt = Math.min(0.05, (now - lastTick.current) / 1000);
      lastTick.current = now;

      if (isUpdating) {
        playRaf.current = requestAnimationFrame(tick);
        return;
      }

      const next = playValue.current + monthsPerSecond * dt;
      let wrapped = next;
      if (wrapped > maxIndex) wrapped = 0 + ((wrapped - 0) % (maxIndex || 1));
      if (wrapped < 0) wrapped = maxIndex;

      playValue.current = wrapped;
      onIndexChange(Math.round(wrapped));
      playRaf.current = requestAnimationFrame(tick);
    };

    playRaf.current = requestAnimationFrame(tick);

    return () => {
      if (playRaf.current) {
        cancelAnimationFrame(playRaf.current);
        playRaf.current = null;
      }
      lastTick.current = null;
    };
  }, [isPlaying, maxIndex, activeIndex, onIndexChange, isUpdating]);

  const percentage = maxIndex === 0 ? 0 : (activeIndex / maxIndex) * 100;
  const displayLabel = formatMonth(months?.[activeIndex]);

  const yearPositions = [];
  const seen = new Set();
  (months || []).forEach((month, idx) => {
    const year = month?.split('-')[0];
    if (year && !seen.has(year)) {
      seen.add(year);
      yearPositions.push({ year, idx });
    }
  });

  const showMonthTicks = (months || []).length <= 24;
  const monthLabels = (months || []).map((value) => value?.split('-')[1]).map((m) => {
    const monthNames = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
    const idx = Math.max(0, Math.min(11, Number(m || 1) - 1));
    return monthNames[idx];
  });

  return (
    <div className="relative w-full">
      <div className="mb-2 text-center text-xs uppercase tracking-[0.4em] text-white/50">
        {displayLabel}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={isPlaying ? 'Pause timeline' : 'Play timeline'}
          onClick={() => setIsPlaying((prev) => !prev)}
          onMouseDown={(e) => e.stopPropagation()}
          className="h-8 w-8 rounded-full border border-white/15 bg-white/10 text-xs text-white/80 transition hover:bg-white/20"
        >
          {isPlaying ? '❚❚' : '▶'}
        </button>
        <div
          ref={sliderRef}
          className="relative h-3 flex-1 cursor-pointer overflow-hidden rounded-full bg-white/10"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <motion.div
            className="absolute h-full rounded-full bg-gradient-to-r from-cyan-400 to-cyan-300"
            style={{ width: `${percentage}%` }}
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.2 }}
          />
          <motion.div
            className="absolute top-1/2 h-6 w-6 -translate-y-1/2 -translate-x-1/2 rounded-full border border-white/30 bg-white/90 shadow-[0_0_14px_rgba(56,189,248,0.7)]"
            style={{ left: `${percentage}%` }}
            animate={{ scale: isDragging ? 1.2 : 1 }}
            transition={{ duration: 0.1 }}
          />
        </div>
      </div>
      <div className="relative mt-3 h-4 text-[10px] text-white/40">
        {yearPositions.map(({ year, idx }) => {
          const left = maxIndex === 0 ? 0 : (idx / maxIndex) * 100;
          return (
            <div key={year} className="absolute -translate-x-1/2" style={{ left: `${left}%` }}>
              <div className="h-2 w-px bg-white/20 mx-auto" />
              <div className="mt-1">{year}</div>
            </div>
          );
        })}
      </div>
      {showMonthTicks && (
        <div className="relative mt-2 h-3 text-[9px] text-white/35">
          {monthLabels.map((label, idx) => {
            const left = maxIndex === 0 ? 0 : (idx / maxIndex) * 100;
            return (
              <div key={`${label}-${idx}`} className="absolute -translate-x-1/2" style={{ left: `${left}%` }}>
                {label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TimeSlider;
