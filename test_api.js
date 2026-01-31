/**
 * Diagnostic Test Script
 * Run this to verify API connectivity and data structure
 * 
 * Usage: node test_api.js
 */

const API_KEY = '5cc86a4c-daf0-456f-85da-489720867777';
const BASE_URL = 'https://api.scansan.com/v1';

async function testEndpoint(path, description) {
  console.log(`\n🧪 Testing: ${description}`);
  console.log(`   URL: ${BASE_URL}${path}`);
  
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      headers: {
        'X-Auth-Token': API_KEY,
        'Accept': 'application/json'
      }
    });

    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Content-Type: ${response.headers.get('content-type')}`);

    if (!response.ok) {
      const text = await response.text();
      console.log(`   ❌ Error Response: ${text.substring(0, 200)}`);
      return null;
    }

    const data = await response.json();
    console.log(`   ✅ Success!`);
    console.log(`   Data Keys:`, Object.keys(data));
    
    return data;

  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}`);
    return null;
  }
}

async function runDiagnostics() {
  console.log('═══════════════════════════════════════════════════');
  console.log('   ScanSan API Diagnostic Test');
  console.log('═══════════════════════════════════════════════════');
  console.log(`   API Key: ${API_KEY.substring(0, 8)}...`);
  console.log(`   Base URL: ${BASE_URL}`);
  
  // Test 1: Area Code Search
  const searchResult = await testEndpoint(
    '/area_codes/search?area_name=Hammersmith',
    'Area Code Search'
  );

  // Test 2: Market Growth (W6 - Hammersmith)
  const growthResult = await testEndpoint(
    '/district/W6/growth',
    'Market Growth Data (W6)'
  );

  if (growthResult) {
    console.log('\n📊 Growth Data Analysis:');
    const yearlyData = growthResult.data?.yearly_data || [];
    console.log(`   Years Available: ${yearlyData.length}`);
    
    if (yearlyData.length > 0) {
      const firstYear = yearlyData[0];
      const lastYear = yearlyData[yearlyData.length - 1];
      
      console.log(`   First Year: ${firstYear.year_month} - £${firstYear.avg_price.toLocaleString()}`);
      console.log(`   Last Year: ${lastYear.year_month} - £${lastYear.avg_price.toLocaleString()}`);
      
      // Calculate CAGR
      const years = parseInt(lastYear.year_month) - parseInt(firstYear.year_month);
      const cagr = Math.pow(lastYear.avg_price / firstYear.avg_price, 1/years) - 1;
      console.log(`   CAGR: ${(cagr * 100).toFixed(2)}%`);
    }
  }

  // Test 3: Area Summary (W6)
  await testEndpoint(
    '/area_codes/W6/summary',
    'Area Summary (W6)'
  );

  // Test 4: Rental Demand (may not be available)
  await testEndpoint(
    '/district/W6/rent/demand',
    'Rental Demand (W6) - Optional'
  );

  // Test 5: Crime Summary (may not be available)
  await testEndpoint(
    '/area_codes/W6/crime/summary',
    'Crime Summary (W6) - Optional'
  );

  console.log('\n═══════════════════════════════════════════════════');
  console.log('   Diagnostic Complete!');
  console.log('═══════════════════════════════════════════════════\n');
}

// Run diagnostics
runDiagnostics().catch(console.error);
