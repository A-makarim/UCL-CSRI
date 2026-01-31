const cache = {
  index: new Map(),
  geo: new Map(),
  points: new Map()
};

const fetchJson = async (url) => {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

export const loadIndex = async (dir) => {
  if (cache.index.has(dir)) return cache.index.get(dir);
  const data = await fetchJson(`/data/${dir}/index.json`);
  cache.index.set(dir, data);
  return data;
};

export const loadGeoForMonth = async (dir, prefix, month) => {
  const key = `${dir}:${prefix}:${month}`;
  if (cache.geo.has(key)) return cache.geo.get(key);
  const data = await fetchJson(`/data/${dir}/${prefix}_${month}.geojson`);
  cache.geo.set(key, data);
  return data;
};

export const loadPostcodePoints = async (month) => {
  if (cache.points.has(month)) return cache.points.get(month);
  const data = await fetchJson(`/data/postcode_points/points_${month}.geojson`);
  cache.points.set(month, data);
  return data;
};
