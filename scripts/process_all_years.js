/**
 * Process 2018-2024 Sales Data with Coordinates
 * Efficiently processes all years and creates monthly samples
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ordnance Survey National Grid to Lat/Lng conversion
function OSGridToLatLng(easting, northing) {
  const a = 6377563.396;
  const b = 6356256.910;
  const F0 = 0.9996012717;
  const lat0 = 49 * Math.PI / 180;
  const lon0 = -2 * Math.PI / 180;
  const N0 = -100000;
  const E0 = 400000;
  const e2 = 1 - (b * b) / (a * a);
  const n = (a - b) / (a + b);
  const n2 = n * n;
  const n3 = n * n * n;

  let lat = lat0;
  let M = 0;
  do {
    lat = (northing - N0 - M) / (a * F0) + lat;
    const Ma = (1 + n + (5 / 4) * n2 + (5 / 4) * n3) * (lat - lat0);
    const Mb = (3 * n + 3 * n * n + (21 / 8) * n3) * Math.sin(lat - lat0) * Math.cos(lat + lat0);
    const Mc = ((15 / 8) * n2 + (15 / 8) * n3) * Math.sin(2 * (lat - lat0)) * Math.cos(2 * (lat + lat0));
    const Md = (35 / 24) * n3 * Math.sin(3 * (lat - lat0)) * Math.cos(3 * (lat + lat0));
    M = b * F0 * (Ma - Mb + Mc - Md);
  } while (northing - N0 - M >= 0.00001);

  const cosLat = Math.cos(lat);
  const sinLat = Math.sin(lat);
  const nu = a * F0 / Math.sqrt(1 - e2 * sinLat * sinLat);
  const rho = a * F0 * (1 - e2) / Math.pow(1 - e2 * sinLat * sinLat, 1.5);
  const eta2 = nu / rho - 1;

  const tanLat = Math.tan(lat);
  const tan2lat = tanLat * tanLat;
  const tan4lat = tan2lat * tan2lat;
  const tan6lat = tan4lat * tan2lat;
  const secLat = 1 / cosLat;
  const nu3 = nu * nu * nu;
  const nu5 = nu3 * nu * nu;
  const nu7 = nu5 * nu * nu;
  const VII = tanLat / (2 * rho * nu);
  const VIII = tanLat / (24 * rho * nu3) * (5 + 3 * tan2lat + eta2 - 9 * tan2lat * eta2);
  const IX = tanLat / (720 * rho * nu5) * (61 + 90 * tan2lat + 45 * tan4lat);
  const X = secLat / nu;
  const XI = secLat / (6 * nu3) * (nu / rho + 2 * tan2lat);
  const XII = secLat / (120 * nu5) * (5 + 28 * tan2lat + 24 * tan4lat);
  const XIIA = secLat / (5040 * nu7) * (61 + 662 * tan2lat + 1320 * tan4lat + 720 * tan6lat);

  const dE = easting - E0;
  const dE2 = dE * dE;
  const dE3 = dE2 * dE;
  const dE4 = dE2 * dE2;
  const dE5 = dE3 * dE2;
  const dE6 = dE4 * dE2;
  const dE7 = dE5 * dE2;

  lat = lat - VII * dE2 + VIII * dE4 - IX * dE6;
  const lon = lon0 + X * dE - XI * dE3 + XII * dE5 - XIIA * dE7;

  return {
    lat: lat * 180 / Math.PI,
    lng: lon * 180 / Math.PI
  };
}

console.log('🗺️  MULTI-YEAR PROPERTY SALES PROCESSOR');
console.log('━'.repeat(60));

// Load postcode coordinates
console.log('\n📍 Loading UK postcode coordinates...');
const postcodeMap = new Map();
const codePointDir = path.join(__dirname, '../codepo_gb/Data/CSV');
const csvFiles = fs.readdirSync(codePointDir).filter(f => f.endsWith('.csv'));

for (const file of csvFiles) {
  const filePath = path.join(codePointDir, file);
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  for (const line of lines) {
    if (!line.trim()) continue;
    const parts = line.split(',');
    if (parts.length >= 3) {
      const postcode = parts[0].replace(/"/g, '').trim();
      const easting = parseInt(parts[2]);
      const northing = parseInt(parts[3]);
      if (!isNaN(easting) && !isNaN(northing)) {
        const { lat, lng } = OSGridToLatLng(easting, northing);
        postcodeMap.set(postcode, { lat, lng });
      }
    }
  }
}
console.log(`✓ Loaded ${postcodeMap.size.toLocaleString()} postcodes`);

// Process each year
const YEARS = [2018, 2019, 2020, 2021, 2022, 2023, 2024];
const SAMPLES_PER_MONTH = 3000; // Keep consistent sampling
const allMonthlyData = {};

for (const year of YEARS) {
  const csvPath = path.join(__dirname, `../${year}.csv`);
  
  if (!fs.existsSync(csvPath)) {
    console.log(`⚠️  Skipping ${year} - file not found`);
    continue;
  }

  console.log(`\n📊 Processing ${year}...`);
  const yearData = {};
  let processed = 0;
  let geocoded = 0;

  const fileStream = fs.createReadStream(csvPath);
  const rl = readline.createInterface({ input: fileStream });

  for await (const line of rl) {
    if (!line.trim()) continue;
    processed++;

    const match = line.match(/^\{[^}]+\},(\d+),(\d{4}-\d{2}-\d{2})[^,]*,"([^"]+)","([^"]+)"/);
    if (!match) continue;

    const price = parseInt(match[1]);
    const date = match[2];
    const postcode = match[3].trim();
    const propType = match[4];

    if (price < 1000 || price > 100000000) continue;

    const coords = postcodeMap.get(postcode);
    if (!coords) continue;

    geocoded++;
    const month = date.substring(0, 7); // "YYYY-MM"
    
    if (!yearData[month]) yearData[month] = [];
    yearData[month].push({
      price,
      date,
      postcode,
      propType,
      lat: coords.lat,
      lng: coords.lng,
      district: postcode.split(' ')[0]
    });

    if (processed % 50000 === 0) {
      process.stdout.write(`\r   Processed: ${processed.toLocaleString()} | Geocoded: ${geocoded.toLocaleString()}`);
    }
  }

  console.log(`\r   ✓ Processed: ${processed.toLocaleString()} | Geocoded: ${geocoded.toLocaleString()}`);

  // Sample each month and add to combined data
  for (const [month, sales] of Object.entries(yearData)) {
    const shuffled = sales.sort(() => Math.random() - 0.5);
    const sampled = shuffled.slice(0, SAMPLES_PER_MONTH);
    allMonthlyData[month] = sampled;
    console.log(`   ${month}: ${sales.length.toLocaleString()} sales → ${sampled.length} samples`);
  }
}

// Save combined data
const outputPath = path.join(__dirname, '../public/outputs/sales_2018_2024_monthly.json');
const outputDir = path.dirname(outputPath);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const output = {
  meta: {
    createdAt: new Date().toISOString(),
    years: YEARS,
    samplesPerMonth: SAMPLES_PER_MONTH,
    totalMonths: Object.keys(allMonthlyData).length,
    totalSamples: Object.values(allMonthlyData).reduce((sum, arr) => sum + arr.length, 0)
  },
  months: allMonthlyData
};

fs.writeFileSync(outputPath, JSON.stringify(output));
const sizeMB = (fs.statSync(outputPath).size / (1024 * 1024)).toFixed(1);

console.log('\n━'.repeat(60));
console.log('✅ PROCESSING COMPLETE!');
console.log(`\n📁 Output: ${sizeMB} MB`);
console.log(`📅 Months: ${output.meta.totalMonths}`);
console.log(`📊 Samples: ${output.meta.totalSamples.toLocaleString()}`);
console.log(`\n💾 File: public/outputs/sales_2018_2024_monthly.json`);
