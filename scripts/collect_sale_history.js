/**
 * LONDON HISTORICAL MARKET DATA COLLECTOR
 * 
 * Collects comprehensive historical and current market data for ML training:
 * 
 * 1. GROWTH DATA (2019-2025):
 *    - Endpoint: /v1/district/{district}/growth
 *    - Returns: yearly avg/median prices with % changes
 *    - Purpose: Train ML models on price trends over time
 * 
 * 2. SALES DEMAND DATA (current):
 *    - Endpoint: /v1/district/{district}/sale/demand
 *    - Returns: current market statistics, inventory, days on market
 * 
 * 3. RENTAL DEMAND DATA (current):
 *    - Endpoint: /v1/district/{district}/rent/demand
 *    - Returns: current rental market statistics
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_BASE = 'https://api.scansan.com';
const API_TOKEN = '5cc86a4c-daf0-456f-85da-489720867777';
const OUTPUT_DIR = path.join(__dirname, '..', 'outputs');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'london_historical_data.json');

const RATE_LIMIT_DELAY = 200; // 200ms between requests
const SAVE_INTERVAL = 10; // Save every 10 districts

// All 120 London districts
const DISTRICTS = [
  'W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W9', 'W10', 'W11', 'W12', 'W13', 'W14',
  'SW1', 'SW2', 'SW3', 'SW4', 'SW5', 'SW6', 'SW7', 'SW8', 'SW9', 'SW10',
  'SW11', 'SW12', 'SW13', 'SW14', 'SW15', 'SW16', 'SW17', 'SW18', 'SW19', 'SW20',
  'NW1', 'NW2', 'NW3', 'NW4', 'NW5', 'NW6', 'NW7', 'NW8', 'NW9', 'NW10', 'NW11',
  'N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7', 'N8', 'N9', 'N10',
  'N11', 'N12', 'N13', 'N14', 'N15', 'N16', 'N17', 'N18', 'N19', 'N20', 'N21', 'N22',
  'E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9', 'E10',
  'E11', 'E12', 'E13', 'E14', 'E15', 'E16', 'E17', 'E18', 'E20',
  'SE1', 'SE2', 'SE3', 'SE4', 'SE5', 'SE6', 'SE7', 'SE8', 'SE9', 'SE10',
  'SE11', 'SE12', 'SE13', 'SE14', 'SE15', 'SE16', 'SE17', 'SE18', 'SE19', 'SE20',
  'SE21', 'SE22', 'SE23', 'SE24', 'SE25', 'SE26', 'SE27', 'SE28',
  'EC1', 'EC2', 'EC3', 'EC4',
  'WC1', 'WC2'
];

const stats = {
  districtsProcessed: 0,
  districtsWithGrowth: 0,
  districtsWithSales: 0,
  districtsWithRent: 0,
  totalYearlyDataPoints: 0,
  errors: 0,
  startTime: Date.now()
};

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 'X-Auth-Token': API_TOKEN }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error('Parse error'));
          }
        } else if (res.statusCode === 404) {
          resolve(null);
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    }).on('error', reject);
  });
}

async function getDistrictGrowth(district) {
  try {
    const url = `${API_BASE}/v1/district/${district}/growth`;
    const response = await makeRequest(url);
    
    if (!response || !response.data) {
      return null;
    }

    return response.data;
  } catch (error) {
    stats.errors++;
    return null;
  }
}

async function getSalesDemand(district) {
  try {
    const url = `${API_BASE}/v1/district/${district}/sale/demand`;
    const response = await makeRequest(url);
    
    if (!response || !response.data) {
      return null;
    }

    return response.data;
  } catch (error) {
    stats.errors++;
    return null;
  }
}

async function getRentDemand(district) {
  try {
    const url = `${API_BASE}/v1/district/${district}/rent/demand`;
    const response = await makeRequest(url);
    
    if (!response || !response.data) {
      return null;
    }

    return response.data;
  } catch (error) {
    stats.errors++;
    return null;
  }
}

function saveData(data) {
  try {
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Save failed:', error.message);
  }
}

function loadData() {
  try {
    if (fs.existsSync(OUTPUT_FILE)) {
      return JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
    }
  } catch (error) {}
  
  return {
    meta: {
      createdAt: new Date().toISOString(),
      source: 'ScanSan API - Historical Market Data',
      description: 'Historical price growth (2019-2025) and current market demand data for ML training',
      dataTypes: [
        'District growth: yearly avg/median prices with % changes',
        'Sales demand: current market statistics',
        'Rental demand: current rental market statistics'
      ]
    },
    districts: {}
  };
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function collect() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  LONDON HISTORICAL MARKET DATA COLLECTOR');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Collecting 2019-2025 price trends + current demand');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const data = loadData();
  let saveCounter = 0;

  for (const district of DISTRICTS) {
    console.log(`\n📍 ${district}:`);

    // Skip if already collected
    if (data.districts[district]) {
      console.log('  ✓ Already collected, skipping');
      stats.districtsProcessed++;
      continue;
    }

    // Initialize district data
    data.districts[district] = {
      district,
      collectedAt: new Date().toISOString(),
      growth: null,
      salesDemand: null,
      rentDemand: null
    };

    // 1. Get growth data (historical prices 2019-2025)
    const growth = await getDistrictGrowth(district);
    await sleep(RATE_LIMIT_DELAY);

    if (growth && growth.yearly_data && growth.yearly_data.length > 0) {
      data.districts[district].growth = growth;
      stats.districtsWithGrowth++;
      stats.totalYearlyDataPoints += growth.yearly_data.length;
      console.log(`  ✓ Growth: ${growth.yearly_data.length} years (${growth.yearly_data[0].year_month}-${growth.yearly_data[growth.yearly_data.length-1].year_month})`);
    } else {
      console.log('  - No growth data');
    }

    // 2. Get current sales demand
    const salesDemand = await getSalesDemand(district);
    await sleep(RATE_LIMIT_DELAY);

    if (salesDemand && salesDemand.sale_demand) {
      data.districts[district].salesDemand = salesDemand;
      stats.districtsWithSales++;
      const demand = salesDemand.sale_demand[0];
      console.log(`  ✓ Sales: ${demand.total_properties_for_sale} properties, £${demand.median_price.toLocaleString()} median`);
    } else {
      console.log('  - No sales demand data');
    }

    // 3. Get current rent demand
    const rentDemand = await getRentDemand(district);
    await sleep(RATE_LIMIT_DELAY);

    if (rentDemand && rentDemand.rental_demand) {
      data.districts[district].rentDemand = rentDemand;
      stats.districtsWithRent++;
      const demand = rentDemand.rental_demand[0];
      console.log(`  ✓ Rent: ${demand.total_properties_for_rent} properties, £${demand.median_rent_pcm.toLocaleString()}/mo median`);
    } else {
      console.log('  - No rent demand data');
    }

    stats.districtsProcessed++;
    saveCounter++;

    // Save progress
    if (saveCounter >= SAVE_INTERVAL) {
      data.meta.lastUpdated = new Date().toISOString();
      data.meta.stats = { ...stats };
      saveData(data);
      console.log(`\n  💾 Progress saved (${stats.districtsProcessed}/${DISTRICTS.length} districts)`);
      saveCounter = 0;
    }
  }

  // Final save
  data.meta.completedAt = new Date().toISOString();
  data.meta.stats = stats;
  saveData(data);

  const elapsed = ((Date.now() - stats.startTime) / 1000 / 60).toFixed(1);
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  COLLECTION COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Districts processed:  ${stats.districtsProcessed}/${DISTRICTS.length}`);
  console.log(`With growth data:     ${stats.districtsWithGrowth}`);
  console.log(`With sales demand:    ${stats.districtsWithSales}`);
  console.log(`With rent demand:     ${stats.districtsWithRent}`);
  console.log(`Yearly data points:   ${stats.totalYearlyDataPoints} (2019-2025)`);
  console.log(`Errors:               ${stats.errors}`);
  console.log(`Time:                 ${elapsed} min`);
  console.log(`\n📁 ${OUTPUT_FILE}\n`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  USE FOR ML TRAINING:');
  console.log('  - Historical prices per district (2019-2025)');
  console.log('  - Year-over-year growth percentages');
  console.log('  - Current market demand indicators');
  console.log('  - Perfect for predicting future prices!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

collect().catch(error => {
  console.error('\n❌', error.message);
  process.exit(1);
});
