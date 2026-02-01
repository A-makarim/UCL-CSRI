/**
 * Sidebar Component
 * Glassmorphic floating panel with variable selection
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const Sidebar = ({ selectedVariable, onVariableChange, areaStats, onViewModeChange, viewMode = 'forecast' }) => {
  const [isCollapsed, setIsCollapsed] = useState(true); // Start collapsed
  const variables = [
    {
      id: 'market_value',
      name: 'Market Value',
      icon: '💰',
      color: 'neon-cyan',
      description: 'Average property prices'
    },
    {
      id: 'rental_yield',
      name: 'Rental Yield',
      icon: '🏠',
      color: 'neon-amber',
      description: 'Monthly rental income'
    },
    {
      id: 'crime_density',
      name: 'Crime Density',
      icon: '🚨',
      color: 'blood-red',
      description: 'Safety incidents'
    },
    {
      id: 'infrastructure',
      name: 'Infrastructure',
      icon: '🚇',
      color: 'neon-cyan',
      description: 'Schools & transport'
    }
  ];

  const viewModes = [
    {
      id: 'forecast',
      name: 'Market Forecast',
      icon: '📈',
      color: 'neon-cyan',
      description: 'Predictive analysis'
    },
    {
      id: 'sale_listings',
      name: 'Sale Listings',
      icon: '🏡',
      color: 'neon-cyan',
      description: '42K properties for sale'
    },
    {
      id: 'rent_listings',
      name: 'Rent Listings',
      icon: '🔑',
      color: 'neon-amber',
      description: '26K rental properties'
    }
  ];

  return (
    <>
      {/* Toggle Button - Always Visible */}
      <motion.button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="fixed left-6 top-6 z-30 glass-panel rounded-full p-3 hover:bg-white/10 transition-colors"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        <svg
          className="w-6 h-6 text-neon-cyan"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          {isCollapsed ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          )}
        </svg>
      </motion.button>

      {/* Sidebar Panel - Completely Hidden When Collapsed */}
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ x: -400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -400, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="fixed left-20 top-6 bottom-6 w-80 glass-panel rounded-2xl shadow-2xl overflow-hidden flex flex-col z-20"
          >
      {/* Header */}
      <div className="p-6 border-b border-white/10">
        <h1 className="text-2xl font-bold text-white mb-1">
          ScanSan <span className="text-neon-cyan">Viewer</span>
        </h1>
        <p className="text-gray-400 text-sm">Geospatial Market Intelligence</p>
      </div>

      {/* View Mode Section */}
      <div className="flex-1 overflow-y-auto p-4">
        <h2 className="text-white text-sm font-semibold mb-3 px-2">View Mode</h2>
        
        <div className="space-y-2 mb-6">
          {viewModes.map((mode) => (
            <motion.button
              key={mode.id}
              onClick={() => onViewModeChange(mode.id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`w-full p-4 rounded-xl transition-all duration-200 ${
                viewMode === mode.id
                  ? `bg-${mode.color}/20 border-2 border-${mode.color} shadow-lg shadow-${mode.color}/50`
                  : 'bg-white/5 border-2 border-transparent hover:bg-white/10'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{mode.icon}</span>
                <div className="flex-1 text-left">
                  <div className={`font-semibold ${
                    viewMode === mode.id ? `text-${mode.color}` : 'text-white'
                  }`}>
                    {mode.name}
                  </div>
                  <div className="text-gray-400 text-xs mt-1">
                    {mode.description}
                  </div>
                </div>
              </div>
            </motion.button>
          ))}
        </div>

        {/* Variables Section - only show for forecast mode */}
        {viewMode === 'forecast' && (
          <>
            <h2 className="text-white text-sm font-semibold mb-3 px-2 mt-4">Select Variable</h2>
            
            <div className="space-y-2">
              {variables.map((variable) => (
                <motion.button
                  key={variable.id}
                  onClick={() => onVariableChange(variable.id)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`w-full p-4 rounded-xl transition-all duration-200 ${
                    selectedVariable === variable.id
                      ? `bg-${variable.color}/20 border-2 border-${variable.color}`
                      : 'bg-white/5 border-2 border-transparent hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{variable.icon}</span>
                    <div className="flex-1 text-left">
                      <div className={`font-semibold ${
                        selectedVariable === variable.id ? `text-${variable.color}` : 'text-white'
                      }`}>
                        {variable.name}
                      </div>
                      <div className="text-gray-400 text-xs mt-1">
                        {variable.description}
                      </div>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          </>
        )}

        {/* Stats Section */}
        {areaStats && (
          <div className="mt-6 p-4 bg-white/5 rounded-xl">
            <h3 className="text-white text-sm font-semibold mb-3">Current Stats</h3>
            <div className="space-y-2">
              {areaStats.areas && (
                <div className="flex justify-between">
                  <span className="text-gray-400 text-xs">Areas Loaded</span>
                  <span className="text-white text-xs font-bold">{areaStats.areas}</span>
                </div>
              )}
              {areaStats.avgValue && (
                <div className="flex justify-between">
                  <span className="text-gray-400 text-xs">Avg Value</span>
                  <span className="text-neon-cyan text-xs font-bold">
                    £{areaStats.avgValue.toLocaleString()}
                  </span>
                </div>
              )}
              {areaStats.trend && (
                <div className="flex justify-between">
                  <span className="text-gray-400 text-xs">Trend</span>
                  <span className={`text-xs font-bold ${
                    areaStats.trend > 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {areaStats.trend > 0 ? '+' : ''}{areaStats.trend}%
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-white/10">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Powered by ScanSan API</span>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span>Live</span>
          </div>
        </div>
      </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Sidebar;
