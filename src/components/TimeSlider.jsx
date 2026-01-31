/**
 * TimeSlider Component - 2018-2024 Timeline
 * Ultra sleek slider for 7-year span with auto-play
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';

const TimeSlider = ({ activeMonth, onMonthChange, minMonth = 1, maxMonth = 84, startYear = 2018, endYear = 2024 }) => {
  const sliderRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const animationFrame = useRef(null);
  const playRaf = useRef(null);
  const lastTick = useRef(null);
  const playValue = useRef(activeMonth);
  const activeMonthRef = useRef(activeMonth);

  const years = [];
  for (let y = startYear; y <= endYear; y++) {
    years.push(y);
  }

  useEffect(() => {
    activeMonthRef.current = activeMonth;
    // Keep playback in sync with user scrubs / external changes
    playValue.current = activeMonth;
  }, [activeMonth]);

  // Debounced update using requestAnimationFrame
  const updateMonth = (clientX) => {
    if (!sliderRef.current) return;

    const rect = sliderRef.current.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const newMonth = minMonth + percentage * (maxMonth - minMonth);

    if (animationFrame.current) {
      cancelAnimationFrame(animationFrame.current);
    }

    animationFrame.current = requestAnimationFrame(() => {
      onMonthChange(newMonth);
    });
  };

  const stopPlaying = useCallback(() => {
    setIsPlaying(false);

    if (playRaf.current) {
      cancelAnimationFrame(playRaf.current);
      playRaf.current = null;
    }
    lastTick.current = null;
  }, []);

  const handleMouseDown = (e) => {
    setIsDragging(true);
    stopPlaying();
    updateMonth(e.clientX);
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      updateMonth(e.clientX);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    if (animationFrame.current) {
      cancelAnimationFrame(animationFrame.current);
    }
  };

  // Smooth playback (Apple Weather style): continuous timeline, no pauses
  useEffect(() => {
    if (!isPlaying) return;

    const monthsPerSecond = 1.4; // tune feel here

    // Start from current position
    playValue.current = activeMonthRef.current;
    lastTick.current = null;

    const tick = (now) => {
      if (lastTick.current == null) lastTick.current = now;
      const dt = Math.min(0.05, (now - lastTick.current) / 1000);
      lastTick.current = now;

      // Throttle to ~30fps to keep React updates light
      if (!tick._acc) tick._acc = 0;
      tick._acc += dt;
      if (tick._acc < 1 / 30) {
        playRaf.current = requestAnimationFrame(tick);
        return;
      }
      tick._acc = 0;

      const range = maxMonth - minMonth;
      const next = playValue.current + monthsPerSecond * dt;

      // Wrap smoothly
      let wrapped = next;
      if (wrapped > maxMonth) wrapped = minMonth + ((wrapped - minMonth) % (range || 1));
      if (wrapped < minMonth) wrapped = maxMonth;

      playValue.current = wrapped;
      onMonthChange(wrapped);
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
  }, [isPlaying, maxMonth, minMonth, onMonthChange]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Calculate position percentage
  const percentage = ((activeMonth - minMonth) / (maxMonth - minMonth)) * 100;

  // Convert month index to year and month
  const getCurrentYearMonth = (monthIdx) => {
    const year = startYear + Math.floor((monthIdx - 1) / 12);
    const month = ((monthIdx - 1) % 12) + 1;
    return { year, month };
  };

  const { year: displayYear, month: displayMonth } = getCurrentYearMonth(Math.round(activeMonth));

  const togglePlay = () => {
    setIsPlaying((prev) => !prev);
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 w-full px-12 pb-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative"
      >
        {/* Ultra Sleek Slider */}
        <div className="relative pt-4">
          <div className="flex items-center gap-3">
            {/* Tiny play/pause button (aligned with bar) */}
            <button
              type="button"
              aria-label={isPlaying ? 'Pause timeline' : 'Play timeline'}
              onClick={togglePlay}
              onMouseDown={(e) => e.stopPropagation()}
              className="z-10 h-7 w-7 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 backdrop-blur-sm flex items-center justify-center transition"
            >
              <span className="text-white/80 text-xs leading-none select-none">
                {isPlaying ? '❚❚' : '▶'}
              </span>
            </button>

            {/* Background Track */}
            <div
              ref={sliderRef}
              className="relative h-1 bg-white/10 rounded-full cursor-pointer overflow-hidden backdrop-blur-sm flex-1"
              onMouseDown={handleMouseDown}
            >
              {/* Progress Fill */}
              <motion.div
                className="absolute h-full rounded-full bg-gradient-to-r from-cyan-400 to-cyan-300"
                style={{ width: `${percentage}%` }}
                initial={{ width: 0 }}
                animate={{ width: `${percentage}%` }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
              />

            </div>
          </div>

          {/* Year Marks (aligned under bar) */}
          <div className="flex items-start gap-3 mt-3">
            <div className="h-7 w-7" />
            <div className="relative h-8 flex-1">
              {years.map((year) => {
                const yearStartMonth = (year - startYear) * 12 + 1;
                const yearPercentage = ((yearStartMonth - minMonth) / (maxMonth - minMonth)) * 100;
                const isActive = year === displayYear;

                return (
                  <div
                    key={year}
                    className="absolute transform -translate-x-1/2"
                    style={{ left: `${yearPercentage}%` }}
                  >
                    {/* Tick Mark */}
                    <div className={`h-3 w-px mx-auto ${
                      isActive ? 'bg-cyan-400' : 'bg-white/30'
                    }`} />

                    {/* Year Label */}
                    <div className={`text-center mt-1.5 text-sm font-light tracking-wider transition-all ${
                      isActive
                        ? 'text-cyan-400 font-semibold'
                        : 'text-white/50'
                    }`}>
                      {year}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default TimeSlider;
