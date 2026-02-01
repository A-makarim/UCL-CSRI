import React from 'react';
import TimeSlider from './TimeSlider';

const modes = [
  { id: 'area', label: 'Areas' },
  { id: 'district', label: 'Districts' },
  { id: 'sector', label: 'Sectors' }
];

const ToggleButton = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.2em] transition ${
      active
        ? 'border-cyan-300/60 bg-cyan-300/10 text-cyan-200'
        : 'border-white/10 bg-white/5 text-white/50 hover:text-white/80'
    }`}
  >
    {children}
  </button>
);

const BottomBar = ({
  months,
  activeIndex,
  onIndexChange,
  mode,
  onModeChange,
  showPolygons,
  onTogglePolygons,
  showDots,
  onToggleDots,
  showHeatmap,
  onToggleHeatmap
}) => (
  <div className="absolute bottom-0 left-0 right-0 px-6 pb-6">
    <div className="rounded-2xl border border-white/10 bg-black/60 p-4 backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {modes.map((item) => (
            <ToggleButton
              key={item.id}
              active={mode === item.id}
              onClick={() => onModeChange(item.id)}
            >
              {item.label}
            </ToggleButton>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ToggleButton active={showPolygons} onClick={onTogglePolygons}>
            Polygons
          </ToggleButton>
          <ToggleButton active={showDots} onClick={onToggleDots}>
            Dots
          </ToggleButton>
          <ToggleButton active={showHeatmap} onClick={onToggleHeatmap}>
            Smooth Dots
          </ToggleButton>
        </div>
      </div>
      <div className="mt-4">
        <TimeSlider months={months} activeIndex={activeIndex} onIndexChange={onIndexChange} />
      </div>
    </div>
  </div>
);

export default BottomBar;
