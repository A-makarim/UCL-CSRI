/**
 * LoadingScreen Component
 * Cyber-black aesthetic loading animation
 */

import React from 'react';
import { motion } from 'framer-motion';

const LoadingScreen = ({ progress = 0, message = 'Loading...' }) => {
  return (
    <div className="fixed inset-0 bg-cyber-black flex items-center justify-center z-50">
      <div className="text-center">
        {/* Animated Logo */}
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.5, 1, 0.5]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
          className="mb-8"
        >
          <div className="text-6xl font-bold">
            <span className="text-white">Scan</span>
            <span className="text-neon-cyan">San</span>
          </div>
          <div className="text-neon-cyan text-sm mt-2">Geospatial Intelligence</div>
        </motion.div>

        {/* Loading Bar */}
        <div className="w-64 h-2 bg-gray-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-neon-cyan to-neon-amber"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* Loading Message */}
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="text-gray-400 text-sm mt-4"
        >
          {message}
        </motion.div>

        {/* Spinning Globe */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          className="mt-6 text-4xl"
        >
          🌍
        </motion.div>
      </div>
    </div>
  );
};

export default LoadingScreen;
