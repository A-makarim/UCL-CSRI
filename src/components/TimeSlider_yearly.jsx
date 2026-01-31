/**
 * TimeSlider Component - Ultra Sleek Minimal Design
 * Smooth slider spanning 2019-2035
 * Historical: 2019-2025, Future: 2026-2035
 */

import React, { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const TimeSlider = ({ activeYear, onYearChange, minYear = 2019, maxYear = 2035 }) => {
  const sliderRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const animationFrame = useRef(null);

  const currentYear = 2025; // Last year of historical data

  // Debounced update using requestAnimationFrame
  const updateYear = (clientX) => {
    if (!sliderRef.current) return;

    const rect = sliderRef.current.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const newYear = Math.round(minYear + percentage * (maxYear - minYear));

    if (animationFrame.current) {
      cancelAnimationFrame(animationFrame.current);
    }

    animationFrame.current = requestAnimationFrame(() => {
      if (newYear !== activeYear) {
        onYearChange(newYear);
      }
    });
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    updateYear(e.clientX);
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      updateYear(e.clientX);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    if (animationFrame.current) {
      cancelAnimationFrame(animationFrame.current);
    }
  };

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
  const percentage = ((activeYear - minYear) / (maxYear - minYear)) * 100;
  const isPrediction = activeYear > currentYear;

  // Year marks (every 2 years for minimal look)
  const yearMarks = [];
  for (let year = minYear; year <= maxYear; year += 2) {
    yearMarks.push(year);
  }

  return (
    <div className="absolute bottom-0 left-0 right-0 w-full px-12 pb-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative"
      >
        {/* Year Display - Center Top */}
        <div className="absolute -top-16 left-1/2 transform -translate-x-1/2">
          <motion.div
            animate={{ scale: isDragging ? 1.05 : 1 }}
            className="text-center"
          >
            <div className={`text-6xl font-thin tracking-wider ${
              isPrediction ? 'text-amber-400' : 'text-cyan-400'
            }`}>
              {activeYear}
            </div>
            {isPrediction && (
              <div className="text-xs text-amber-400/70 font-light tracking-widest mt-1">
                PREDICTED
              </div>
            )}
          </motion.div>
        </div>

        {/* Sleek Slider Container */}
        <div className="relative pt-4">
          {/* Background Track - Ultra Thin */}
          <div
            ref={sliderRef}
            className="relative h-1 bg-white/10 rounded-full cursor-pointer overflow-hidden backdrop-blur-sm"
            onMouseDown={handleMouseDown}
          >
            {/* Progress Fill */}
            <motion.div
              className={`absolute h-full rounded-full ${
                isPrediction 
                  ? 'bg-gradient-to-r from-cyan-400 to-amber-400' 
                  : 'bg-cyan-400'
              }`}
              style={{ width: `${percentage}%` }}
              initial={{ width: 0 }}
              animate={{ width: `${percentage}%` }}
              transition={{ duration: 0.3 }}
            />

            {/* Active Position Indicator - Minimal Dot */}
            <motion.div
              className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 pointer-events-none"
              style={{ left: `${percentage}%` }}
              animate={{ 
                scale: isDragging ? 1.5 : 1,
              }}
              transition={{ duration: 0.2 }}
            >
              <div className={`w-3 h-3 rounded-full ${
                isPrediction ? 'bg-amber-400' : 'bg-cyan-400'
              } shadow-lg`} 
              style={{
                boxShadow: isPrediction 
                  ? '0 0 20px rgba(251, 191, 36, 0.8)' 
                  : '0 0 20px rgba(34, 211, 238, 0.8)'
              }}
              />
            </motion.div>
          </div>

          {/* Sleek Year Marks */}
          <div className="relative mt-3 h-6">
            {yearMarks.map((year) => {
              const yearPercentage = ((year - minYear) / (maxYear - minYear)) * 100;
              const isCurrentYear = year === currentYear;
              const isActive = year === activeYear;
              
              return (
                <div
                  key={year}
                  className="absolute transform -translate-x-1/2"
                  style={{ left: `${yearPercentage}%` }}
                >
                  {/* Tick Mark */}
                  <div className={`h-2 w-px mx-auto ${
                    isCurrentYear 
                      ? 'bg-white' 
                      : isActive
                      ? 'bg-cyan-400'
                      : 'bg-white/20'
                  }`} />
                  
                  {/* Year Label */}
                  <div className={`text-center mt-1 text-xs font-light tracking-wide transition-all ${
                    isCurrentYear
                      ? 'text-white font-medium'
                      : isActive
                      ? 'text-cyan-400'
                      : 'text-white/40'
                  }`}>
                    {year}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Current Year Divider Line */}
          <div
            className="absolute top-0 h-1 w-px bg-white/50"
            style={{ 
              left: `${((currentYear - minYear) / (maxYear - minYear)) * 100}%`,
              transform: 'translateX(-0.5px)'
            }}
          />
        </div>
      </motion.div>
    </div>
  );
};

export default TimeSlider;
