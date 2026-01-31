/**
 * Process 2025 Sales Data with Coordinates
 * Merges yearsold.csv with Code-Point Open postcode coordinates
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

async function loadPostcodeMap() {
  console.log('📍 Loading postcode coordinates...');
  const postcodeMap = new Map();
  
  // Read all CSV files in codepo_gb/Data/CSV/
  const csvDir = path.join(__dirname, '../codepo_gb/Data/CSV');
  const files = fs.readdirSync(csvDir).filter(f => f.endsWith('.csv'));
  
  let totalLoaded = 0;
  
  for (const file of files) {
    const filePath = path.join(csvDir, file);
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      // Parse: "E1 0AA",10,535267,181084,"E92000001","E19000003","E18000007","","E09000030","E05009332"
      const match = line.match(/"([^"]+)",\d+,(\d+),(\d+),/);
      if (match) {
        const [, postcode, easting, northing] = match;
        const { lat, lng } = OSGridToLatLng(parseInt(easting), parseInt(northing));
        postcodeMap.set(postcode.replace(/\s+/g, ''), { lat, lng, postcode });
        totalLoaded++;
      }
    }
  }
  
  console.log(`   ✓ Loaded ${totalLoaded.toLocaleString()} postcodes`);
  return postcodeMap;
}

async function processSalesData(postcodeMap) {
  console.log('\n💰 Processing 2025 sales data...');
  
  const dataByMonth = {};
  const months = ['2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06', 
                  '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12'];
  
  months.forEach(m => dataByMonth[m] = []);
  
  let totalRecords = 0;
  let matchedRecords = 0;
  let unmatchedRecords = 0;
  
  const fileStream = fs.createReadStream(path.join(__dirname, '../yearsold.csv'));
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  console.log('   Processing records...');
  
  for await (const line of rl) {
    totalRecords++;
    
    // Parse CSV line
    const match = line.match(/"([^"]+)","(\d+)","([^"]+)","([^"]+)","([^"]+)","([^"]+)","([^"]+)","([^"]*)","([^"]*)","([^"]*)","([^"]*)","([^"]*)","([^"]*)","([^"]*)","([^"]*)","([^"]*)"/);
    
    if (!match) continue;
    
    const [, id, price, date, postcode, propType, oldNew, duration, paon, saon, street, locality, town, district, county, ppdCat, recordStatus] = match;
    
    const month = date.substring(0, 7);
    if (!months.includes(month)) continue;
    
    // Look up coordinates
    const cleanPostcode = postcode.replace(/\s+/g, '');
    const coords = postcodeMap.get(cleanPostcode);
    
    if (coords) {
      matchedRecords++;
      dataByMonth[month].push({
        price: parseInt(price),
        date: date,
        postcode: postcode,
        lat: coords.lat,
        lng: coords.lng,
        propType: propType,
        address: [paon, saon, street, locality, town].filter(Boolean).join(', '),
        district: district,
        county: county
      });
    } else {
      unmatchedRecords++;
    }
    
    if (totalRecords % 50000 === 0) {
      console.log(`   Processed ${totalRecords.toLocaleString()} records (${matchedRecords.toLocaleString()} matched)...`);
    }
  }
  
  console.log(`\n   ✓ Total records: ${totalRecords.toLocaleString()}`);
  console.log(`   ✓ Matched with coordinates: ${matchedRecords.toLocaleString()} (${(matchedRecords/totalRecords*100).toFixed(1)}%)`);
  console.log(`   ✗ Unmatched: ${unmatchedRecords.toLocaleString()}`);
  
  return dataByMonth;
}

async function main() {
  const startTime = Date.now();
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  PROCESSING 2025 PROPERTY SALES DATA');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  try {
    // Load postcode coordinates
    const postcodeMap = await loadPostcodeMap();
    
    // Process sales data
    const dataByMonth = await processSalesData(postcodeMap);
    
    // Calculate statistics
    console.log('\n📊 Monthly Statistics:');
    const months = Object.keys(dataByMonth).sort();
    let grandTotal = 0;
    
    months.forEach(month => {
      const count = dataByMonth[month].length;
      grandTotal += count;
      const avgPrice = dataByMonth[month].reduce((sum, p) => sum + p.price, 0) / count;
      console.log(`   ${month}: ${count.toLocaleString().padStart(7)} sales (avg £${Math.round(avgPrice).toLocaleString()})`);
    });
    
    console.log(`\n   TOTAL: ${grandTotal.toLocaleString()} sales with coordinates`);
    
    // Save output
    const output = {
      meta: {
        createdAt: new Date().toISOString(),
        source: 'HM Land Registry Price Paid Data 2025',
        postcodeSource: 'Ordnance Survey Code-Point Open',
        totalSales: grandTotal,
        months: months,
        processingTimeSeconds: ((Date.now() - startTime) / 1000).toFixed(1)
      },
      months: dataByMonth
    };
    
    const outputPath = path.join(__dirname, '../outputs/sales_2025_monthly.json');
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    
    console.log(`\n✅ Saved to: ${outputPath}`);
    console.log(`   File size: ${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(1)} MB`);
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n⏱️  Total time: ${elapsed}s`);
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  READY FOR VISUALIZATION!');
    console.log('  Timeline: January - December 2025');
    console.log('  Slide through months to see changing properties');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
