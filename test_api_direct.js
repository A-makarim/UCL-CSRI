// Test API directly
const BASE_URL = 'https://api.scansan.com';
const API_KEY = '5cc86a4c-daf0-456f-85da-489720867777';

async function test() {
  console.log('Testing W1 sale listings...\n');
  
  const url = `${BASE_URL}/v1/area_codes/W1/sale/listings`;
  const res = await fetch(url, {
    headers: {
      'X-Auth-Token': API_KEY,
      'Accept': 'application/json'
    }
  });
  
  console.log('Status:', res.status);
  console.log('OK:', res.ok);
  
  const data = await res.json();
  console.log('\nResponse keys:', Object.keys(data));
  console.log('Has data:', !!data.data);
  console.log('Has sale_listings:', !!data.data?.sale_listings);
  console.log('Sale listings count:', data.data?.sale_listings?.length);
  console.log('\nFirst listing:', data.data?.sale_listings?.[0]);
  
  console.log('\n\n=== Testing extraction paths ===');
  console.log('data.data.sale_listings exists?', !!data.data?.sale_listings);
  console.log('data.sale_listings exists?', !!data.sale_listings);
}

test().catch(console.error);
