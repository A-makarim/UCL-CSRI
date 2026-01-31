import React from "react";

export default function ControlCard({
  dateLabel,
  trendLabel,
  index,
  maxIndex,
  startYear,
  endYear,
  playing,
  projection,
  mode,
  onIndexChange,
  onPlayToggle,
  onProjectionToggle,
  onModeToggle
}) {
  return (
    <div className="control-card">
      <div className="control-header">
        <h2>Price Climate</h2>
        <span className="live-dot"></span>
      </div>

      <div className="meta">
        <div>
          <span className="label">Selected date</span>
          <span className="value">{dateLabel}</span>
        </div>
        <div>
          <span className="label">Market signal</span>
          <span className="value">{trendLabel}</span>
        </div>
      </div>

      <input
        type="range"
        min="0"
        max={maxIndex}
        value={index}
        step="1"
        onChange={(event) => onIndexChange(Number(event.target.value))}
      />
      <div className="timeline">
        <span>{startYear}</span>
        <span>{endYear}</span>
      </div>

      <div className="actions">
        <button className="primary" onClick={onPlayToggle}>
          {playing ? "Pause" : "Play"}
        </button>
        <button className="ghost" onClick={onProjectionToggle}>
          {projection === "globe" ? "Mercator" : "Globe"}
        </button>
        <button className="ghost" onClick={onModeToggle}>
          {mode === "future" ? "Historic" : "Future View"}
        </button>
      </div>
    </div>
  );
}
