import React, { useEffect, useMemo, useState } from "react";
import Ambient from "./components/Ambient.jsx";
import BottomBar from "./components/BottomBar.jsx";
import MapView from "./components/MapView.jsx";
import { loadGeoForMonth, loadIndex, loadPostcodePoints } from "./lib/dataLoader.js";

const MODES = {
  area: { dir: "area_geojson", prefix: "area" },
  district: { dir: "district_geojson", prefix: "district" },
  sector: { dir: "sector_geojson", prefix: "sector" }
};

export default function App() {
  const [index, setIndex] = useState(0);
  const [projection] = useState("globe");
  const [months, setMonths] = useState([]);
  const [dataError, setDataError] = useState(null);
  const [geo, setGeo] = useState(null);
  const [points, setPoints] = useState(null);
  const [mode, setMode] = useState("area");
  const [showDots, setShowDots] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const { dir } = MODES[mode];
        const indexData = await loadIndex(dir);
        if (!cancelled) {
          const monthsList = indexData.months || [];
          setMonths(monthsList);
          setIndex(monthsList.length ? monthsList.length - 1 : 0);
          setGeo(null);
          setPoints(null);
          setDataError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setDataError(err.message || "Failed to load index.json");
          setMonths([]);
          setGeo(null);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [mode]);

  useEffect(() => {
    if (!months.length) return;
    let cancelled = false;

    const loadMonth = async () => {
      try {
        const { dir, prefix } = MODES[mode];
        const month = months[index];
        const geojson = await loadGeoForMonth(dir, prefix, month);
        if (!cancelled) setGeo(geojson);
      } catch (err) {
        if (!cancelled) setDataError(err.message || "Failed to load GeoJSON");
      }
    };

    loadMonth();
    return () => {
      cancelled = true;
    };
  }, [months, index, mode]);

  useEffect(() => {
    if (!showDots || !months.length) {
      setPoints(null);
      return;
    }
    let cancelled = false;

    const loadPoints = async () => {
      try {
        const month = months[index];
        const geojson = await loadPostcodePoints(month);
        if (!cancelled) setPoints(geojson);
      } catch (err) {
        if (!cancelled) setDataError(err.message || "Failed to load postcode points");
      }
    };

    loadPoints();
    return () => {
      cancelled = true;
    };
  }, [showDots, months, index]);

  const hasData = Boolean(geo && months.length);
  const currentMonthKey = months[index] || null;

  const dateLabel = useMemo(() => {
    if (!currentMonthKey) return "No data";
    const date = new Date(`${currentMonthKey}-01`);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleString("en-GB", { month: "short", year: "numeric" });
    }
    return currentMonthKey;
  }, [currentMonthKey]);

  const { minPrice, maxPrice } = useMemo(() => {
    if (!geo?.features?.length) return { minPrice: null, maxPrice: null };
    let min = Infinity;
    let max = -Infinity;
    geo.features.forEach((feature) => {
      const value = feature?.properties?.median_price;
      if (typeof value === "number" && !Number.isNaN(value)) {
        min = Math.min(min, value);
        max = Math.max(max, value);
      }
    });
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      return { minPrice: null, maxPrice: null };
    }
    return { minPrice: min, maxPrice: max };
  }, [geo]);

  const maxIndex = months.length ? months.length - 1 : 0;
  const startYear = months.length ? months[0].slice(0, 4) : "--";
  const endYear = months.length ? months[months.length - 1].slice(0, 4) : "--";

  const dataNote = hasData
    ? `${mode[0].toUpperCase()}${mode.slice(1)} polygons (gb-postcodes)`
    : dataError
      ? `Data missing: ${dataError}`
      : `Waiting for /data/${MODES[mode].dir}/index.json`;

  return (
    <div className="app">
      <Ambient />

      <div className="map-shell full">
        <MapView
          geo={geo || { type: "FeatureCollection", features: [] }}
          points={points || { type: "FeatureCollection", features: [] }}
          showDots={showDots}
          projection={projection}
        />

        <BottomBar
          dateLabel={dateLabel}
          startYear={startYear}
          endYear={endYear}
          months={months}
          index={index}
          onIndexChange={setIndex}
          mode={mode}
          onModeChange={setMode}
          showDots={showDots}
          onToggleDots={() => setShowDots((prev) => !prev)}
          dataNote={dataNote}
          minPrice={minPrice}
          maxPrice={maxPrice}
        />
      </div>
    </div>
  );
}
