import React from "react";
import ControlCard from "./ControlCard.jsx";
import InsightGrid from "./InsightGrid.jsx";
import Legend from "./Legend.jsx";

export default function SidePanel({
  dateLabel,
  trendLabel,
  dataNote,
  index,
  maxIndex,
  startYear,
  endYear,
  playing,
  projection,
  mode,
  intensityValue,
  volatilityValue,
  horizonValue,
  onIndexChange,
  onPlayToggle,
  onProjectionToggle,
  onModeToggle
}) {
  return (
    <section className="panel">
      <div className="brand">
        <div className="badge">UCL-CSRI · Demo</div>
        <h1>HouseHeat</h1>
        <p className="tagline">
          A “weather app” for home values — flowing price heatmaps across time and
          into the future.
        </p>
        {dataNote ? <p className="data-note">{dataNote}</p> : null}
      </div>

      <ControlCard
        dateLabel={dateLabel}
        trendLabel={trendLabel}
        index={index}
        maxIndex={maxIndex}
        startYear={startYear}
        endYear={endYear}
        playing={playing}
        projection={projection}
        mode={mode}
        onIndexChange={onIndexChange}
        onPlayToggle={onPlayToggle}
        onProjectionToggle={onProjectionToggle}
        onModeToggle={onModeToggle}
      />

      <InsightGrid
        intensityValue={intensityValue}
        volatilityValue={volatilityValue}
        horizonValue={horizonValue}
      />

      <Legend />
    </section>
  );
}
