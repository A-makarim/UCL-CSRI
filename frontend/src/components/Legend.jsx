import React from "react";

export default function Legend() {
  return (
    <div className="legend">
      <div className="legend-item">
        <span className="swatch cool"></span>
        <span>Cooling</span>
      </div>
      <div className="legend-item">
        <span className="swatch warm"></span>
        <span>Warming</span>
      </div>
      <div className="legend-item">
        <span className="swatch hot"></span>
        <span>Hotspots</span>
      </div>
    </div>
  );
}
