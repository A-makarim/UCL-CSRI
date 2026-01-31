/*
  ScanSan data collector
  - Tries every 10 seconds
  - Runs for 5 minutes
  - Rotates area codes (avoids same request within run)
  - Saves only when new data differs
  - Writes JSON to outputs/scansan_cache.json
*/

import fs from 'fs';
import path from 'path';

const API_KEY = process.env.SCANSAN_API_KEY || '5cc86a4c-daf0-456f-85da-489720867777';
const BASE_URL = 'https://api.scansan.com/v1';

const OUTPUT_PATH = path.resolve('outputs', 'scansan_cache.json');
const RUN_MINUTES = 5;
const INTERVAL_MS = 10_000;

// Wide list of area codes to avoid repeating during 5-minute window
const AREA_CODES = [
  'W1','W2','W3','W4','W5','W6','W7','W8','W9','W10','W11','W12','W14',
  'SW1','SW3','SW5','SW6','SW7','SW10','SW11','SW15',
  'NW1','NW3','NW5','NW6','NW8','NW10',
  'E1','E2','E8','E14','E20',
  'SE1','SE10','SE11','SE24','SE25'
];

function loadCache() {
  if (!fs.existsSync(OUTPUT_PATH)) {
    return { meta: { createdAt: new Date().toISOString() }, data: {} };
  }
  try {
    return JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
  } catch {
    return { meta: { createdAt: new Date().toISOString() }, data: {} };
  }
}

function saveCache(cache) {
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(cache, null, 2));
}

async function fetchGrowth(areaCode) {
  const url = `${BASE_URL}/district/${areaCode}/growth`;
  const res = await fetch(url, {
    headers: {
      'X-Auth-Token': API_KEY,
      'Accept': 'application/json'
    }
  });

  const contentType = res.headers.get('content-type') || '';
  if (res.status === 429) {
    return { status: 429, error: 'Rate limited', contentType };
  }

  if (!res.ok) {
    const text = await res.text();
    return { status: res.status, error: text.slice(0, 200), contentType };
  }

  const data = contentType.includes('application/json') ? await res.json() : await res.text();
  return { status: res.status, data, contentType };
}

async function run() {
  console.log('🚀 ScanSan Data Collector Starting...');
  console.log(`   Duration: ${RUN_MINUTES} minutes`);
  console.log(`   Interval: ${INTERVAL_MS/1000} seconds`);
  console.log(`   Area codes: ${AREA_CODES.length}`);
  console.log(`   Output: ${OUTPUT_PATH}\n`);
  
  const cache = loadCache();
  cache.meta.lastRunStartedAt = new Date().toISOString();
  console.log('✅ Cache initialized\n');

  let idx = 0;
  let tick = 0;

  const endTime = Date.now() + RUN_MINUTES * 60_000;
  console.log(`⏰ Will run until: ${new Date(endTime).toLocaleTimeString()}\n`);

  const interval = setInterval(async () => {
    if (Date.now() > endTime) {
      console.log(`\n⏱️  Time's up! Collected data for ${tick} requests`);
      cache.meta.lastRunCompletedAt = new Date().toISOString();
      saveCache(cache);
      clearInterval(interval);
      console.log('✅ Data collection complete!');
      process.exit(0);
      return;
    }

    const areaCode = AREA_CODES[idx % AREA_CODES.length];
    idx += 1;
    tick += 1;
    
    console.log(`[${tick}] Fetching ${areaCode}...`);

    const result = await fetchGrowth(areaCode);

    if (result.status === 200 && result.data) {
      console.log(`    ✅ Success for ${areaCode}`);
      const current = cache.data[areaCode];
      const nextPayload = {
        fetchedAt: new Date().toISOString(),
        data: result.data
      };

      const currentString = current ? JSON.stringify(current.data) : null;
      const nextString = JSON.stringify(result.data);

      if (currentString !== nextString) {
        cache.data[areaCode] = nextPayload;
        cache.meta.lastUpdatedAt = new Date().toISOString();
        saveCache(cache);
        console.log(`    💾 Saved new data for ${areaCode}`);
      } else {
        console.log(`    ⏭️  No changes for ${areaCode}`);
      }
    } else {
      console.log(`    ❌ Error for ${areaCode}: ${result.status} - ${result.error}`);
      cache.meta.lastError = {
        at: new Date().toISOString(),
        areaCode,
        status: result.status,
        error: result.error,
        contentType: result.contentType
      };
      saveCache(cache);
    }
  }, INTERVAL_MS);
}

run();
