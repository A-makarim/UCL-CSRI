import React from "react";

const MODES = [
  { key: "area", label: "Area" },
  { key: "district", label: "District" },
  { key: "sector", label: "Sector" }
];

export default function BottomBar({
  dateLabel,
  startYear,
  endYear,
  months,
  index,
  onIndexChange,
  mode,
  onModeChange,
  showDots,
  onToggleDots,
  dataNote,
  minPrice,
  maxPrice
}) {
  return (
    <div className="slider-bar">
      <div className="slider-meta">
        <div>
          <span className="label">Month</span>
          <span className="value">{dateLabel}</span>
        </div>
        <div>
          <span className="label">Range</span>
          <span className="value">{startYear} — {endYear}</span>
        </div>
        <div className="mode-toggle">
          {MODES.map((item) => (
            <button
              key={item.key}
              className={`toggle ${mode === item.key ? "active" : ""}`}
              onClick={() => onModeChange(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <button
          className={`toggle dots-toggle ${showDots ? "active" : ""}`}
          onClick={onToggleDots}
        >
          Dots
        </button>
      </div>

      <input
        type="range"
        min="0"
        max={months.length ? months.length - 1 : 0}
        value={index}
        step="1"
        onChange={(event) => onIndexChange(Number(event.target.value))}
        disabled={!months.length}
      />

      <div className="legend-row">
        <div className="legend-bar"></div>
        <div className="legend-labels">
          <span>{minPrice ? minPrice.toLocaleString("en-GB") : "--"}</span>
          <span>{maxPrice ? maxPrice.toLocaleString("en-GB") : "--"}</span>
        </div>
      </div>

      <div className="slider-note">{dataNote}</div>
    </div>
  );
}
