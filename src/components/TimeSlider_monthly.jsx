/**
 * TimeSlider Component - Monthly 2025 Timeline
 * Ultra sleek slider for Jan-Dec 2025
 */

import React, { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const TimeSlider = ({ activeMonth, onMonthChange, minMonth = 1, maxMonth = 12, year = 2025 }) => {
  const sliderRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const animationFrame = useRef(null);

  const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

  // Debounced update using requestAnimationFrame
  const updateMonth = (clientX) => {
    if (!sliderRef.current) return;

    const rect = sliderRef.current.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const newMonth = Math.round(minMonth + percentage * (maxMonth - minMonth));

    if (animationFrame.current) {
      cancelAnimationFrame(animationFrame.current);
    }

    animationFrame.current = requestAnimationFrame(() => {
      if (newMonth !== activeMonth) {
        onMonthChange(newMonth);
      }
    });
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
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

  return (
    <div className="absolute bottom-0 left-0 right-0 w-full px-12 pb-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative"
      >
        {/* Month Display - Large Center */}
        <div className="absolute -top-16 left-1/2 transform -translate-x-1/2">
          <motion.div
            animate={{ scale: isDragging ? 1.05 : 1 }}
            className="text-center"
          >
            <div className="text-6xl font-thin tracking-wider text-cyan-400">
              {monthNames[activeMonth - 1]}
            </div>
            <div className="text-sm text-white/50 font-light tracking-widest mt-1">
              {year}
            </div>
          </motion.div>
        </div>

        {/* Ultra Sleek Slider */}
        <div className="relative pt-4">
          {/* Background Track */}
          <div
            ref={sliderRef}
            className="relative h-1 bg-white/10 rounded-full cursor-pointer overflow-hidden backdrop-blur-sm"
            onMouseDown={handleMouseDown}
          >
            {/* Progress Fill */}
            <motion.div
              className="absolute h-full rounded-full bg-gradient-to-r from-cyan-400 to-cyan-300"
              style={{ width: `${percentage}%` }}
              initial={{ width: 0 }}
              animate={{ width: `${percentage}%` }}
              transition={{ duration: 0.2 }}
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

          {/* Month Marks */}
          <div className="relative mt-3 h-6">
            {monthNames.map((month, index) => {
              const monthNum = index + 1;
              const monthPercentage = ((monthNum - minMonth) / (maxMonth - minMonth)) * 100;
              const isActive = monthNum === activeMonth;
              
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
      </motion.div>
    </div>
  );
};

export default TimeSlider;
