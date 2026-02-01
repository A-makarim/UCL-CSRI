import React from 'react';
import { motion } from 'framer-motion';

const formatPrice = (value) => {
  if (!Number.isFinite(value)) return '—';
  if (value >= 1_000_000) return `£${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `£${(value / 1_000).toFixed(0)}K`;
  return `£${Math.round(value).toLocaleString()}`;
};

const PriceLegend = ({ minValue, maxValue }) => (
  <motion.div
    initial={{ y: -8, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    transition={{ duration: 0.35 }}
    className="pointer-events-none absolute right-6 top-6 w-72 rounded-xl border border-white/10 bg-black/60 p-3 backdrop-blur-md"
  >
    <div className="text-xs uppercase tracking-[0.3em] text-white/50">
      Median Price
    </div>
    <div className="mt-2 h-2 w-full rounded-full bg-gradient-to-r from-[#0b1a4a] via-[#12b2b2] via-[#8ee35e] to-[#ff5b3a]" />
    <div className="mt-2 flex items-center justify-between text-xs text-white/70">
      <span>{formatPrice(minValue)}</span>
      <span className="text-white/40">Low → High</span>
      <span>{formatPrice(maxValue)}</span>
    </div>
  </motion.div>
);

export default PriceLegend;
