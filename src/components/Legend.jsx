/**
 * Legend Component
 * Minimalist 3D gradient bar showing value ranges
 */

import React from 'react';
import { motion } from 'framer-motion';

const Legend = ({ selectedVariable, minValue, maxValue }) => {
  const legends = {
    market_value: {
      title: 'Market Value',
      unit: '£',
      gradient: 'linear-gradient(90deg, rgba(0,100,255,0.8), rgba(0,243,255,1))',
      textColor: 'text-neon-cyan'
    },
    rental_yield: {
      title: 'Rental Yield',
      unit: '£/mo',
      gradient: 'linear-gradient(90deg, rgba(255,140,0,0.8), rgba(255,184,0,1))',
      textColor: 'text-neon-amber'
    },
    crime_density: {
      title: 'Crime Incidents',
      unit: '',
      gradient: 'linear-gradient(90deg, rgba(255,0,0,0.8), rgba(255,0,60,1))',
      textColor: 'text-blood-red'
    },
    infrastructure: {
      title: 'Infrastructure Score',
      unit: '',
      gradient: 'linear-gradient(90deg, rgba(0,200,150,0.8), rgba(0,243,210,1))',
      textColor: 'text-neon-cyan'
    }
  };

  const config = legends[selectedVariable] || legends.market_value;

  const formatValue = (value) => {
    if (!value) return 'N/A';
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
    return value.toString();
  };

  return (
    <motion.div
      initial={{ y: 50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.3, duration: 0.5 }}
      className="fixed bottom-8 right-8 w-80 glass-panel rounded-xl p-4 shadow-2xl z-10"
    >
      {/* Title */}
      <div className={`${config.textColor} font-semibold text-sm mb-3`}>
        {config.title}
      </div>

      {/* Gradient Bar */}
      <div className="relative h-8 rounded-lg overflow-hidden" style={{ background: config.gradient }}>
        {/* 3D effect overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-black/30" />
        
        {/* Shine effect */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
          animate={{
            x: ['-100%', '200%']
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            repeatDelay: 1,
            ease: 'easeInOut'
          }}
        />
      </div>

      {/* Value Labels */}
      <div className="flex justify-between mt-2">
        <span className="text-white text-xs">
          {config.unit}{formatValue(minValue)}
        </span>
        <span className="text-gray-400 text-xs">Low → High</span>
        <span className="text-white text-xs font-bold">
          {config.unit}{formatValue(maxValue)}
        </span>
      </div>

      {/* Additional Info */}
      <div className="mt-3 pt-3 border-t border-white/10">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400">Intensity</span>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="w-2 h-4 rounded-sm"
                style={{
                  background: config.gradient,
                  opacity: i * 0.2
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default Legend;
