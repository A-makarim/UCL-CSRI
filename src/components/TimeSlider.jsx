/**
 * TimeSlider Component - Monthly 2025 Timeline
 * Ultra sleek slider for Jan-Dec 2025 with auto-play
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';

const TimeSlider = ({ activeMonth, onMonthChange, minMonth = 1, maxMonth = 12, year = 2025 }) => {
  const sliderRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const animationFrame = useRef(null);
  const playRaf = useRef(null);
  const lastTick = useRef(null);
  const playValue = useRef(activeMonth);
  const activeMonthRef = useRef(activeMonth);

  const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

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

  const displayMonth = Math.max(minMonth, Math.min(maxMonth, Math.round(activeMonth)));

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

            {/* Indicator Dot */}
            <motion.div
              className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 pointer-events-none"
              style={{ left: `${percentage}%` }}
              animate={{ 
                scale: isDragging ? 1.5 : 1,
              }}
              transition={{ duration: 0.15 }}
            >
              <div 
                className="w-3 h-3 rounded-full bg-cyan-400 shadow-lg"
                style={{
                  boxShadow: '0 0 20px rgba(34, 211, 238, 0.8)'
                }}
              />
            </motion.div>
            </div>
          </div>

          {/* Month Marks (aligned under bar) */}
          <div className="flex items-start gap-3 mt-3">
            <div className="h-7 w-7" />
            <div className="relative h-6 flex-1">
              {monthNames.map((month, index) => {
                const monthNum = index + 1;
                const monthPercentage = ((monthNum - minMonth) / (maxMonth - minMonth)) * 100;
                const isActive = monthNum === displayMonth;

                return (
                  <div
                    key={monthNum}
                    className="absolute transform -translate-x-1/2"
                    style={{ left: `${monthPercentage}%` }}
                  >
                    {/* Tick Mark */}
                    <div className={`h-2 w-px mx-auto ${
                      isActive ? 'bg-cyan-400' : 'bg-white/20'
                    }`} />

                    {/* Month Label */}
                    <div className={`text-center mt-1 text-xs font-light tracking-wide transition-all ${
                      isActive
                        ? 'text-cyan-400 font-medium'
                        : 'text-white/40'
                    }`}>
                      {month}
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
