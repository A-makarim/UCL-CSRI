const cache = new Map();
const apiCache = new Map();

const DATA_BASE = import.meta.env.VITE_DATA_BASE || '/data';
const API_BASE = import.meta.env.VITE_API_BASE || '';

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

export const fetchTransactions = async ({ month, mode, code, limit = 200 }) => {
  const params = new URLSearchParams({
    month,
    mode,
    code,
    limit: String(limit)
  });
  const url = `${API_BASE}/api/transactions?${params.toString()}`;
  if (apiCache.has(url)) {
    return apiCache.get(url);
  }
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }
  const data = await res.json();
  apiCache.set(url, data);
  return data;
};

export const askAgent = async ({ message, history = [], context = null }) => {
  const url = `${API_BASE}/api/ask`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history, context })
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to fetch ${url}: ${res.status} ${errorText}`);
  }
  return res.json();
};
