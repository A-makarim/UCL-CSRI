/**
 * Geocode Listings Script
 * Adds latitude and longitude coordinates to each property in london_listings.json
 * Uses Mapbox Geocoding API with address + district code
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN;
const INPUT_FILE = path.join(__dirname, '../outputs/london_listings.json');
const OUTPUT_FILE = path.join(__dirname, '../outputs/london_listings_geocoded.json');
const RATE_LIMIT_DELAY = 200; // ms between requests (5 per second)
const BATCH_SIZE = 100; // Save progress every N properties
const MAX_PROPERTIES = 1000; // Set to number to limit for testing, null for all

// Load existing data
console.log('Loading london_listings.json...');
const data = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));

if (!MAPBOX_TOKEN) {
  throw new Error('MAPBOX_TOKEN is required. Set it in your shell before running this script.');
}

// Geocoding function using Mapbox API
async function geocodeAddress(address, districtCode) {
  try {
    // Clean up address
    const cleanAddress = address.replace(/["']/g, '').trim();
    
    // Build search query: "address, district, London, UK"
    const query = encodeURIComponent(`${cleanAddress}, ${districtCode}, London, UK`);
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${MAPBOX_TOKEN}&limit=1&country=GB&proximity=-0.1276,51.5074`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`Geocoding failed for "${cleanAddress}": ${response.status}`);
      return null;
    }
    
    const result = await response.json();
    
    if (result.features && result.features.length > 0) {
      const [lng, lat] = result.features[0].center;
      return { latitude: lat, longitude: lng };
    }
    
    return null;
  } catch (error) {
    console.error(`Error geocoding "${address}":`, error.message);
    return null;
  }
}

// Delay helper
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Main geocoding process
async function geocodeAllListings() {
  console.log('\n🗺️  Starting geocoding process...\n');
  
  let totalProcessed = 0;
  let totalGeocoded = 0;
  let totalFailed = 0;
  let totalSkipped = 0;
  
  const startTime = Date.now();
  
  for (const [areaCode, areaData] of Object.entries(data.areas)) {
    console.log(`\n📍 Processing area: ${areaCode}`);
    
    // Process sale listings
    if (areaData.saleListings && Array.isArray(areaData.saleListings)) {
      console.log(`  Sale listings: ${areaData.saleListings.length}`);
      
      for (let i = 0; i < areaData.saleListings.length; i++) {
        if (MAX_PROPERTIES && totalProcessed >= MAX_PROPERTIES) {
          console.log(`\n⚠️  Reached limit of ${MAX_PROPERTIES} properties`);
          break;
        }
        
        const listing = areaData.saleListings[i];
        
        // Skip if already has coordinates
        if (listing.latitude && listing.longitude) {
          totalSkipped++;
          continue;
        }
        
        // Geocode
        const coords = await geocodeAddress(listing.street_address, areaCode);
        
        if (coords) {
          listing.latitude = coords.latitude;
          listing.longitude = coords.longitude;
          totalGeocoded++;
          process.stdout.write(`    ✓ [${i+1}/${areaData.saleListings.length}] ${listing.street_address.substring(0, 40)}...\r`);
        } else {
          totalFailed++;
          console.log(`    ✗ Failed: ${listing.street_address.substring(0, 40)}`);
        }
        
        totalProcessed++;
        
        // Save progress periodically
        if (totalProcessed % BATCH_SIZE === 0) {
          fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2));
          const elapsed = Math.round((Date.now() - startTime) / 1000);
          console.log(`\n    💾 Progress saved: ${totalProcessed} processed, ${totalGeocoded} geocoded (${elapsed}s)`);
        }
        
        // Rate limiting
        await delay(RATE_LIMIT_DELAY);
      }
      
      if (MAX_PROPERTIES && totalProcessed >= MAX_PROPERTIES) break;
    }
    
    // Process rent listings
    if (areaData.rentListings && Array.isArray(areaData.rentListings)) {
      console.log(`  Rent listings: ${areaData.rentListings.length}`);
      
      for (let i = 0; i < areaData.rentListings.length; i++) {
        if (MAX_PROPERTIES && totalProcessed >= MAX_PROPERTIES) {
          console.log(`\n⚠️  Reached limit of ${MAX_PROPERTIES} properties`);
          break;
        }
        
        const listing = areaData.rentListings[i];
        
        // Skip if already has coordinates
        if (listing.latitude && listing.longitude) {
          totalSkipped++;
          continue;
        }
        
        // Geocode
        const coords = await geocodeAddress(listing.street_address, areaCode);
        
        if (coords) {
          listing.latitude = coords.latitude;
          listing.longitude = coords.longitude;
          totalGeocoded++;
          process.stdout.write(`    ✓ [${i+1}/${areaData.rentListings.length}] ${listing.street_address.substring(0, 40)}...\r`);
        } else {
          totalFailed++;
          console.log(`    ✗ Failed: ${listing.street_address.substring(0, 40)}`);
        }
        
        totalProcessed++;
        
        // Save progress periodically
        if (totalProcessed % BATCH_SIZE === 0) {
          fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2));
          const elapsed = Math.round((Date.now() - startTime) / 1000);
          console.log(`\n    💾 Progress saved: ${totalProcessed} processed, ${totalGeocoded} geocoded (${elapsed}s)`);
        }
        
        // Rate limiting
        await delay(RATE_LIMIT_DELAY);
      }
      
      if (MAX_PROPERTIES && totalProcessed >= MAX_PROPERTIES) break;
    }
    
    if (MAX_PROPERTIES && totalProcessed >= MAX_PROPERTIES) break;
  }
  
  // Update metadata
  data.meta.geocodedAt = new Date().toISOString();
  data.meta.geocodingStats = {
    totalProcessed,
    totalGeocoded,
    totalFailed,
    totalSkipped
  };
  
  // Final save
  console.log('\n\n💾 Saving final results...');
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2));
  
  const totalTime = Math.round((Date.now() - startTime) / 1000);
  
  console.log('\n✅ Geocoding complete!');
  console.log(`\n📊 Statistics:`);
  console.log(`   Total processed: ${totalProcessed}`);
  console.log(`   Successfully geocoded: ${totalGeocoded}`);
  console.log(`   Failed: ${totalFailed}`);
  console.log(`   Skipped (already had coords): ${totalSkipped}`);
  console.log(`   Time elapsed: ${totalTime}s`);
  console.log(`   Output file: ${OUTPUT_FILE}`);
  console.log(`\n🎯 Success rate: ${((totalGeocoded / (totalGeocoded + totalFailed)) * 100).toFixed(1)}%`);
}

// Run
geocodeAllListings().catch(console.error);
