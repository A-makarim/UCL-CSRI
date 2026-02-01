/**
 * GeoJSON Builder
 * Maps ScanSan API area codes to physical coordinates
 * Uses UK postcode/district boundary data
 */

// London area codes with approximate center coordinates
// In production, fetch from communities-uk/postcodes or OS Open Data
export const LONDON_AREA_CODES = {
  // West London
  'W1': { lat: 51.5154, lng: -0.1410, name: 'West End' },
  'W2': { lat: 51.5156, lng: -0.1785, name: 'Paddington' },
  'W3': { lat: 51.5132, lng: -0.2625, name: 'Acton' },
  'W4': { lat: 51.4927, lng: -0.2663, name: 'Chiswick' },
  'W5': { lat: 51.5141, lng: -0.3070, name: 'Ealing' },
  'W6': { lat: 51.4927, lng: -0.2290, name: 'Hammersmith' },
  'W7': { lat: 51.5108, lng: -0.3389, name: 'Hanwell' },
  'W8': { lat: 51.5020, lng: -0.1947, name: 'Kensington' },
  'W9': { lat: 51.5259, lng: -0.1872, name: 'Maida Vale' },
  'W10': { lat: 51.5219, lng: -0.2111, name: 'North Kensington' },
  'W11': { lat: 51.5116, lng: -0.2032, name: 'Notting Hill' },
  'W12': { lat: 51.5080, lng: -0.2358, name: 'Shepherds Bush' },
  'W14': { lat: 51.4958, lng: -0.2128, name: 'West Kensington' },
  
  // South West London
  'SW1': { lat: 51.4975, lng: -0.1357, name: 'Westminster' },
  'SW3': { lat: 51.4892, lng: -0.1681, name: 'Chelsea' },
  'SW5': { lat: 51.4908, lng: -0.1930, name: 'Earl\'s Court' },
  'SW6': { lat: 51.4788, lng: -0.1977, name: 'Fulham' },
  'SW7': { lat: 51.4945, lng: -0.1763, name: 'South Kensington' },
  'SW10': { lat: 51.4849, lng: -0.1830, name: 'West Brompton' },
  'SW11': { lat: 51.4678, lng: -0.1703, name: 'Battersea' },
  'SW15': { lat: 51.4577, lng: -0.2188, name: 'Putney' },
  
  // North West London
  'NW1': { lat: 51.5368, lng: -0.1458, name: 'Camden Town' },
  'NW3': { lat: 51.5501, lng: -0.1650, name: 'Hampstead' },
  'NW5': { lat: 51.5534, lng: -0.1449, name: 'Kentish Town' },
  'NW6': { lat: 51.5416, lng: -0.1941, name: 'Kilburn' },
  'NW8': { lat: 51.5341, lng: -0.1715, name: 'St John\'s Wood' },
  'NW10': { lat: 51.5364, lng: -0.2426, name: 'Willesden' },
  
  // East London
  'E1': { lat: 51.5176, lng: -0.0656, name: 'Whitechapel' },
  'E2': { lat: 51.5307, lng: -0.0632, name: 'Bethnal Green' },
  'E8': { lat: 51.5456, lng: -0.0586, name: 'Hackney' },
  'E14': { lat: 51.5074, lng: -0.0118, name: 'Canary Wharf' },
  'E20': { lat: 51.5434, lng: -0.0116, name: 'Stratford' },
  
  // South East London
  'SE1': { lat: 51.5023, lng: -0.0923, name: 'Southwark' },
  'SE10': { lat: 51.4834, lng: 0.0064, name: 'Greenwich' },
  'SE11': { lat: 51.4924, lng: -0.1137, name: 'Kennington' },
  'SE24': { lat: 51.4590, lng: -0.1096, name: 'Herne Hill' },
  'SE25': { lat: 51.4010, lng: -0.0923, name: 'South Norwood' },
};

// Generate random points around a center for point-based heatmap
export function generatePointsAroundCenter(center, count = 50, radiusKm = 1) {
  const points = [];
  const radiusInDeg = radiusKm / 111.0; // Rough conversion: 1 degree ≈ 111 km
  
  for (let i = 0; i < count; i++) {
    // Random distance and angle
    const distance = Math.random() * radiusInDeg;
    const angle = Math.random() * 2 * Math.PI;
    
    const lat = center.lat + (distance * Math.cos(angle));
    const lng = center.lng + (distance * Math.sin(angle));
    
    points.push({ lat, lng });
  }
  
  return points;
}

/**
 * Build GeoJSON feature collection from ScanSan data
 * Creates point features with property values for heatmap
 */
export function buildGeoJSONFromData(areaCode, forecast, selectedYear) {
  const center = LONDON_AREA_CODES[areaCode];
  
  if (!center) {
    console.warn(`No coordinates found for area code: ${areaCode}`);
    return null;
  }

  // Get value for selected year
  const yearData = forecast.historical.concat(forecast.future).find(d => d.year === selectedYear);
  
  if (!yearData) {
    console.warn(`No data for year ${selectedYear}`);
    return null;
  }

  if (!Number.isFinite(yearData.value)) {
    console.warn(`Invalid value for ${areaCode} in ${selectedYear}:`, yearData.value);
    return null;
  }

  // Generate points around the center
  // Point density can represent property density
  const points = generatePointsAroundCenter(center, 30, 0.5);
  
  // Create GeoJSON features
  const features = points.map((point, index) => {
    // Add some variation to values (±15%)
    const variation = 0.85 + (Math.random() * 0.3);
    const adjustedValue = Number(yearData.value) * variation;
    
    return {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [point.lng, point.lat]
      },
      properties: {
        areaCode,
        year: selectedYear,
        value: Number.isFinite(adjustedValue) ? Math.round(adjustedValue) : null,
        isPrediction: yearData.isPrediction,
        confidence: yearData.confidence || 1.0,
        index
      }
    };
  });

  return {
    type: 'FeatureCollection',
    features
  };
}

/**
 * Build GeoJSON for multiple area codes
 */
export function buildMultiAreaGeoJSON(dataMap, selectedYear) {
  console.log('🗺️ Building GeoJSON:', { 
    areaCount: Object.keys(dataMap).length, 
    selectedYear,
    areas: Object.keys(dataMap)
  });
  
  const allFeatures = [];
  
  for (const [areaCode, forecast] of Object.entries(dataMap)) {
    const geoJSON = buildGeoJSONFromData(areaCode, forecast, selectedYear);
    if (geoJSON) {
      allFeatures.push(...geoJSON.features);
      console.log(`  ✅ ${areaCode}: ${geoJSON.features.length} points`);
    } else {
      console.warn(`  ⚠️ ${areaCode}: No GeoJSON generated`);
    }
  }
  
  console.log(`📍 Total features: ${allFeatures.length}`);
  
  return {
    type: 'FeatureCollection',
    features: allFeatures
  };
}

/**
 * Fetch UK postcode boundaries from public API
 * (Example - replace with actual GeoJSON source)
 */
export async function fetchPostcodeBoundaries(areaCode) {
  // TODO: Integrate with communities-uk/postcodes or OS Open Data
  // For now, return mock polygon
  const center = LONDON_AREA_CODES[areaCode];
  
  if (!center) return null;
  
  // Create a simple square polygon around the center
  const offset = 0.01; // ~1km
  
  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [center.lng - offset, center.lat - offset],
        [center.lng + offset, center.lat - offset],
        [center.lng + offset, center.lat + offset],
        [center.lng - offset, center.lat + offset],
        [center.lng - offset, center.lat - offset]
      ]]
    },
    properties: {
      areaCode,
      name: center.name
    }
  };
}

export default {
  LONDON_AREA_CODES,
  generatePointsAroundCenter,
  buildGeoJSONFromData,
  buildMultiAreaGeoJSON,
  fetchPostcodeBoundaries
};
