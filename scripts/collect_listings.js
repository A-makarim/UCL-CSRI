/*
  ScanSan London Listings Collector
  ================================
  STEP 1: Discover all valid London area codes
  STEP 2: Build request queue (sale + rent listings + summary)
  STEP 3: Rate-limited execution (10 sec interval)
  STEP 4: Normalize & deduplicate data
  STEP 5: Save structured JSON database
  
  Database: outputs/london_listings.json
*/

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const API_KEY = process.env.SCANSAN_API_KEY || '5cc86a4c-daf0-456f-85da-489720867777';
const BASE_URL = 'https://api.scansan.com/v1';

const MASTER_OUTPUT = path.resolve('outputs', 'london_listings.json');
const AREA_CODES_CACHE = path.resolve('outputs', 'area_codes_master.json');
const PROGRESS_FILE = path.resolve('outputs', 'listings_progress.json');

const INTERVAL_MS = 10_000; // 10 seconds
const RUN_HOURS = 24; // Run for 24 hours - continuous collection

// London boroughs and districts to discover
const LONDON_SEARCH_TERMS = [
  // Major borough names
  'Westminster', 'Camden', 'Islington', 'Hackney', 'Tower Hamlets',
  'Greenwich', 'Lewisham', 'Southwark', 'Lambeth', 'Wandsworth',
  'Hammersmith', 'Kensington', 'Chelsea', 'Fulham', 'Richmond',
  'Kingston', 'Merton', 'Sutton', 'Croydon', 'Bromley',
  'Bexley', 'Newham', 'Redbridge', 'Barking', 'Havering',
  'Waltham Forest', 'Haringey', 'Enfield', 'Barnet', 'Brent',
  'Ealing', 'Hounslow', 'Hillingdon', 'Harrow',
  
  // Postcode districts (comprehensive)
  'W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W9', 'W10', 'W11', 'W12', 'W13', 'W14',
  'SW1', 'SW2', 'SW3', 'SW4', 'SW5', 'SW6', 'SW7', 'SW8', 'SW9', 'SW10', 'SW11', 'SW12', 
  'SW13', 'SW14', 'SW15', 'SW16', 'SW17', 'SW18', 'SW19', 'SW20',
  'NW1', 'NW2', 'NW3', 'NW4', 'NW5', 'NW6', 'NW7', 'NW8', 'NW9', 'NW10', 'NW11',
  'N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7', 'N8', 'N9', 'N10', 'N11', 'N12', 'N13', 'N14',
  'E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9', 'E10', 'E11', 'E12', 'E13', 'E14', 'E15', 'E16', 'E17', 'E18', 'E20',
  'SE1', 'SE2', 'SE3', 'SE4', 'SE5', 'SE6', 'SE7', 'SE8', 'SE9', 'SE10', 'SE11', 'SE12', 
  'SE13', 'SE14', 'SE15', 'SE16', 'SE17', 'SE18', 'SE19', 'SE20', 'SE21', 'SE22', 'SE23', 'SE24', 'SE25', 'SE26', 'SE27', 'SE28',
  'EC1', 'EC2', 'EC3', 'EC4',
  'WC1', 'WC2'
];

// ============================================================================
// UTILITIES
// ============================================================================

function loadJSON(filePath, defaultValue = {}) {
  if (!fs.existsSync(filePath)) return defaultValue;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return defaultValue;
  }
}

function saveJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function hash(data) {
  return crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

async function apiRequest(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  try {
    const res = await fetch(url, {
      headers: {
        'X-Auth-Token': API_KEY,
        'Accept': 'application/json',
        ...options.headers
      }
    });

    const contentType = res.headers.get('content-type') || '';
    
    if (res.status === 429) {
      return { status: 429, error: 'Rate limited', data: null };
    }
    
    if (res.status === 404) {
      return { status: 404, error: 'Not found', data: null };
    }

    if (!res.ok) {
      const text = await res.text();
      return { status: res.status, error: text.slice(0, 200), data: null };
    }

    const data = contentType.includes('application/json') ? await res.json() : await res.text();
    
    // Check if API returned NOT_FOUND in the response body
    if (data && typeof data === 'object' && data.code === 'NOT_FOUND') {
      return { status: 404, error: 'Not found', data: null };
    }
    
    return { status: 200, data, error: null };
  } catch (err) {
    return { status: 0, error: err.message, data: null };
  }
}

async function searchAreaCodes(searchTerm) {
  return await apiRequest(`/area_codes/search?area_name=${encodeURIComponent(searchTerm)}`);
}

async function getSaleListings(areaCode) {
  return await apiRequest(`/area_codes/${encodeURIComponent(areaCode)}/sale/listings`);
}

async function getRentListings(areaCode) {
  return await apiRequest(`/area_codes/${encodeURIComponent(areaCode)}/rent/listings`);
}

async function getAreaSummary(areaCode) {
  return await apiRequest(`/area_codes/${encodeURIComponent(areaCode)}/summary`);
}

// ============================================================================
// STEP 1: DISCOVER AREA CODES
// ============================================================================

async function discoverAreaCodes() {
  console.log('\n🔍 STEP 1: Using Known London District Codes...\n');
  
  // Use known district codes directly (search API has limited borough support)
  const knownDistricts = [
    'W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W9', 'W10', 'W11', 'W12', 'W13', 'W14',
    'SW1', 'SW2', 'SW3', 'SW4', 'SW5', 'SW6', 'SW7', 'SW8', 'SW9', 'SW10', 'SW11', 'SW12', 
    'SW13', 'SW14', 'SW15', 'SW16', 'SW17', 'SW18', 'SW19', 'SW20',
    'NW1', 'NW2', 'NW3', 'NW4', 'NW5', 'NW6', 'NW7', 'NW8', 'NW9', 'NW10', 'NW11',
    'N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7', 'N8', 'N9', 'N10', 'N11', 'N12', 'N13', 'N14', 'N15', 'N16', 'N17', 'N18', 'N19', 'N20', 'N21', 'N22',
    'E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9', 'E10', 'E11', 'E12', 'E13', 'E14', 'E15', 'E16', 'E17', 'E18', 'E20',
    'SE1', 'SE2', 'SE3', 'SE4', 'SE5', 'SE6', 'SE7', 'SE8', 'SE9', 'SE10', 'SE11', 'SE12', 
    'SE13', 'SE14', 'SE15', 'SE16', 'SE17', 'SE18', 'SE19', 'SE20', 'SE21', 'SE22', 'SE23', 'SE24', 'SE25', 'SE26', 'SE27', 'SE28',
    'EC1', 'EC2', 'EC3', 'EC4',
    'WC1', 'WC2'
  ];
  
  const areaMaster = {};
  knownDistricts.forEach(code => {
    const prefix = code.match(/^[A-Z]+/)?.[0] || 'OTHER';
    if (!areaMaster[prefix]) areaMaster[prefix] = [];
    areaMaster[prefix].push(code);
  });
  
  console.log(`   Total district codes: ${knownDistricts.length}`);
  Object.keys(areaMaster).forEach(prefix => {
    console.log(`   ${prefix}: ${areaMaster[prefix].length} codes`);
  });
  
  saveJSON(AREA_CODES_CACHE, { 
    discoveredAt: new Date().toISOString(),
    totalCodes: knownDistricts.length,
    prefixes: areaMaster,
    allCodes: knownDistricts,
    note: 'Using comprehensive London district codes'
  });
  
  console.log(`\n✅ District codes ready!\n`);
  
  return knownDistricts;
}

// ============================================================================
// STEP 2: BUILD REQUEST QUEUE
// ============================================================================

function buildRequestQueue(areaCodes) {
  console.log('\n📋 STEP 2: Building Request Queue...\n');
  
  const queue = [];
  
  // For each area code, we want:
  // 1. Summary (counts, price ranges)
  // 2. Sale listings
  // 3. Rent listings
  
  areaCodes.forEach(code => {
    queue.push({ area: code, endpoint: 'summary', priority: 1 });
    queue.push({ area: code, endpoint: 'sale_listings', priority: 2 });
    queue.push({ area: code, endpoint: 'rent_listings', priority: 2 });
  });
  
  console.log(`   Total requests queued: ${queue.length}`);
  console.log(`   Estimated time: ${Math.ceil(queue.length * INTERVAL_MS / 1000 / 60)} minutes\n`);
  
  return queue;
}

// ============================================================================
// STEP 3: RATE-LIMITED WORKER
// ============================================================================

async function processQueue(queue, database, progress) {
  console.log('\n⚙️  STEP 3: Processing Queue with Rate Limiting...\n');
  
  const startTime = Date.now();
  const endTime = startTime + RUN_HOURS * 60 * 60 * 1000;
  
  let processed = progress.processed || 0;
  let successful = progress.successful || 0;
  let rateLimited = 0;
  let notFound = 0;
  
  console.log(`⏰ Will run until: ${new Date(endTime).toLocaleTimeString()}`);
  console.log(`📍 Resuming from request #${processed + 1}\n`);
  
  while (processed < queue.length && Date.now() < endTime) {
    try {
      const task = queue[processed];
      const { area, endpoint } = task;
      
      console.log(`[${processed + 1}/${queue.length}] ${area} → ${endpoint}`);
      
      // Initialize area in database
      if (!database.areas[area]) {
        database.areas[area] = {
          areaCode: area,
          summary: null,
          saleListings: [],
          rentListings: [],
          lastUpdated: null
        };
      }
      
      // Fetch data based on endpoint
      let result;
      switch (endpoint) {
        case 'summary':
          result = await getAreaSummary(area);
          break;
        case 'sale_listings':
          result = await getSaleListings(area);
          break;
        case 'rent_listings':
          result = await getRentListings(area);
          break;
      }
      
      // Handle response
      if (result.status === 200 && result.data) {
        const oldHash = hash(database.areas[area][endpoint === 'summary' ? 'summary' : endpoint === 'sale_listings' ? 'saleListings' : 'rentListings']);
        
        // Extract data
        let newData;
        if (endpoint === 'summary') {
          newData = result.data?.data?.[0] || result.data?.data || result.data || null;
          database.areas[area].summary = newData;
        } else if (endpoint === 'sale_listings') {
          newData = result.data?.data?.sale_listings || [];
          database.areas[area].saleListings = newData;
        } else if (endpoint === 'rent_listings') {
          newData = result.data?.data?.rent_listings || [];
          database.areas[area].rentListings = newData;
        }
        
        const newHash = hash(newData);
        
        if (oldHash !== newHash) {
          database.areas[area].lastUpdated = new Date().toISOString();
          database.meta.lastUpdated = new Date().toISOString();
          saveJSON(MASTER_OUTPUT, database);
          console.log(`   ✅ Saved (${endpoint})`);
        } else {
          console.log(`   ⏭️  No changes`);
        }
        
        successful++;
        
      } else if (result.status === 429) {
        console.log(`   ⏸️  Rate limited - will retry`);
        rateLimited++;
        await sleep(20000); // Wait 20s extra
        continue; // Don't increment processed
        
      } else if (result.status === 404) {
        console.log(`   ❌ Not found (skipping)`);
        notFound++;
        
      } else {
        console.log(`   ⚠️  Error ${result.status}: ${result.error}`);
      }
      
      processed++;
      
      // Save progress
      progress.processed = processed;
      progress.successful = successful;
      progress.rateLimited = rateLimited;
      progress.notFound = notFound;
      progress.lastProcessedAt = new Date().toISOString();
      saveJSON(PROGRESS_FILE, progress);
      
      // Wait before next request
      await sleep(INTERVAL_MS);
      
    } catch (err) {
      console.log(`   💥 Exception: ${err.message}`);
      console.error(err);
      processed++; // Skip this one
      await sleep(INTERVAL_MS);
    }
  }
  
  // Final summary
  console.log(`\n========================================`);
  console.log(`📊 COLLECTION COMPLETE`);
  console.log(`========================================`);
  console.log(`Processed: ${processed}/${queue.length}`);
  console.log(`Successful: ${successful}`);
  console.log(`Rate Limited: ${rateLimited}`);
  console.log(`Not Found: ${notFound}`);
  console.log(`Database: ${MASTER_OUTPUT}`);
  console.log(`========================================\n`);
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  🏙️  SCANSAN LONDON LISTINGS COLLECTOR                    ║');
  console.log('║                                                            ║');
  console.log('║  Systematic data collection for entire London             ║');
  console.log('║  Rate-limited, resumable, deduplicated                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('\n');
  
  // Initialize or load database
  let database = loadJSON(MASTER_OUTPUT, {
    meta: {
      createdAt: new Date().toISOString(),
      lastUpdated: null,
      source: 'ScanSan API',
      intervalSeconds: INTERVAL_MS / 1000
    },
    areas: {}
  });
  
  // Save initial database
  saveJSON(MASTER_OUTPUT, database);
  console.log(`💾 Database initialized at: ${MASTER_OUTPUT}\n`);
  
  // Load or initialize progress
  let progress = loadJSON(PROGRESS_FILE, {
    startedAt: new Date().toISOString(),
    processed: 0,
    successful: 0,
    rateLimited: 0,
    notFound: 0
  });
  
  // STEP 1: Discover area codes (skip if already cached)
  let areaCodes;
  const cachedAreaCodes = loadJSON(AREA_CODES_CACHE, null);
  
  if (cachedAreaCodes && cachedAreaCodes.allCodes) {
    console.log('✅ Using cached area codes from previous discovery\n');
    areaCodes = cachedAreaCodes.allCodes;
    console.log(`   Total codes: ${areaCodes.length}\n`);
  } else {
    areaCodes = await discoverAreaCodes();
  }
  
  // STEP 2: Build queue (skip already processed if resuming)
  const fullQueue = buildRequestQueue(areaCodes);
  const remainingQueue = fullQueue.slice(progress.processed);
  
  if (remainingQueue.length === 0) {
    console.log('✅ All requests already processed! Starting fresh...\n');
    progress.processed = 0;
    progress.successful = 0;
    progress.rateLimited = 0;
    progress.notFound = 0;
  }
  
  // STEP 3: Process queue
  await processQueue(fullQueue, database, progress);
  
  // Mark completion
  database.meta.completedAt = new Date().toISOString();
  saveJSON(MASTER_OUTPUT, database);
  
  console.log('🎉 All done!\n');
  process.exit(0);
}

// ============================================================================
// RUN
// ============================================================================

main().catch(err => {
  console.error('\n❌ Fatal error:', err);
  process.exit(1);
});
