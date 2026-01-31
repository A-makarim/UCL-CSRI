import React from "react";

export default function InsightGrid({ intensityValue, volatilityValue, horizonValue }) {
  return (
    <div className="insight-grid">
      <article className="insight">
        <span className="label">Heat intensity</span>
        <span className="big">{intensityValue}</span>
        <p>Weighted growth across London & commuter belts.</p>
      </article>
      <article className="insight">
        <span className="label">Volatility band</span>
        <span className="big">{volatilityValue}</span>
        <p>Stable pricing forecast with slow variability.</p>
      </article>
      <article className="insight">
        <span className="label">Forecast horizon</span>
        <span className="big">{horizonValue}</span>
        <p>Model extends to 2032 with macro overlays.</p>
      </article>
    </div>
  );
}
