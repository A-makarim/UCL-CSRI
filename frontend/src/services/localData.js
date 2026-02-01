const cache = new Map();

const DATA_BASE = import.meta.env.VITE_DATA_BASE || '/data';

const fetchJson = async (url) => {
  if (cache.has(url)) {
    return cache.get(url);
  }
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }
  const data = await res.json();
  cache.set(url, data);
  return data;
};

export const loadIndex = (dir) => fetchJson(`${DATA_BASE}/${dir}/index.json`);

export const loadGeoForMonth = (dir, prefix, month) =>
  fetchJson(`${DATA_BASE}/${dir}/${prefix}_${month}.geojson`);

export const loadStatsForMonth = (prefix, month) =>
  fetchJson(`${DATA_BASE}/stats/${prefix}_${month}.json`);

export const loadPolygons = (mode) =>
  fetchJson(`${DATA_BASE}/polygons/${mode}.geojson`);

export const loadRanges = () =>
  fetchJson(`${DATA_BASE}/stats/ranges.json`);
