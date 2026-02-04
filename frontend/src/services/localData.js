const cache = new Map();
const apiCache = new Map();

const DATA_BASE = import.meta.env.VITE_DATA_BASE || '/data';
const API_BASE = import.meta.env.VITE_API_BASE || '';

const fetchJsonTry = async (urls) => {
  let lastError = null;
  for (const url of urls) {
    try {
      return await fetchJson(url);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('Failed to fetch JSON');
};

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

// New structure: /data/{dataset}/{dir}/index.json
// Backwards-compatible fallback: /data/{dir}/index.json
export const loadIndex = (dataset, dir) =>
  fetchJsonTry([
    `${DATA_BASE}/${dataset}/${dir}/index.json`,
    `${DATA_BASE}/${dir}/index.json`
  ]);

export const loadGeoForMonth = (dataset, dir, prefix, month) =>
  fetchJsonTry([
    `${DATA_BASE}/${dataset}/${dir}/${prefix}_${month}.geojson`,
    `${DATA_BASE}/${dir}/${prefix}_${month}.geojson`
  ]);

export const loadStatsForMonth = (dataset, prefix, month) =>
  fetchJsonTry([
    `${DATA_BASE}/${dataset}/stats/${prefix}_${month}.json`,
    `${DATA_BASE}/stats/${prefix}_${month}.json`
  ]);

export const loadPolygons = (mode) =>
  fetchJson(`${DATA_BASE}/polygons/${mode}.geojson`);

export const loadRanges = (dataset) =>
  fetchJsonTry([
    `${DATA_BASE}/${dataset}/stats/ranges.json`,
    `${DATA_BASE}/stats/ranges.json`
  ]);

export const loadLiveListingsGeo = () =>
  fetchJson(`${DATA_BASE}/live/listings/listings.geojson`);

export const loadLiveListingsMeta = () =>
  fetchJson(`${DATA_BASE}/live/listings/meta.json`);

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

export const fetchLiveListings = async ({ mode, code, kind = 'sale', limit = 50, offset = 0 }) => {
  const params = new URLSearchParams({
    mode,
    code,
    kind: String(kind),
    limit: String(limit),
    offset: String(offset)
  });
  const url = `${API_BASE}/api/live/listings?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to fetch ${url}: ${res.status} ${errorText}`);
  }
  return res.json();
};

export const fetchLiveListing = async ({ id }) => {
  const params = new URLSearchParams({ id: String(id) });
  const url = `${API_BASE}/api/live/listing?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to fetch ${url}: ${res.status} ${errorText}`);
  }
  return res.json();
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
