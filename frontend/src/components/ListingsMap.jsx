import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// All 120 London district centers with coordinates
const DISTRICT_CENTERS = {
  W1: [-0.1419, 51.5074], W2: [-0.1813, 51.5154], W3: [-0.2576, 51.5146], 
  W4: [-0.2539, 51.4927], W5: [-0.2986, 51.5085], W6: [-0.2294, 51.4927],
  W7: [-0.3380, 51.5106], W8: [-0.1937, 51.5014], W9: [-0.2044, 51.5326],
  W10: [-0.2241, 51.5250], W11: [-0.2094, 51.5139], W12: [-0.2306, 51.5155],
  W13: [-0.3064, 51.5074], W14: [-0.2137, 51.4939],
  SW1: [-0.1419, 51.4975], SW2: [-0.1628, 51.4530], SW3: [-0.1628, 51.4905],
  SW4: [-0.1425, 51.4595], SW5: [-0.1930, 51.4838], SW6: [-0.1903, 51.4710],
  SW7: [-0.1756, 51.4945], SW8: [-0.1244, 51.4831], SW9: [-0.1118, 51.4652],
  SW10: [-0.1820, 51.4833], SW11: [-0.1657, 51.4640], SW12: [-0.1723, 51.4343],
  SW13: [-0.2537, 51.4472], SW14: [-0.2206, 51.4221], SW15: [-0.2185, 51.4514],
  SW16: [-0.1233, 51.4158], SW17: [-0.1720, 51.4159], SW18: [-0.1923, 51.4506],
  SW19: [-0.2064, 51.4220], SW20: [-0.1969, 51.4062],
  NW1: [-0.1420, 51.5352], NW2: [-0.2145, 51.5611], NW3: [-0.1778, 51.5439],
  NW4: [-0.2394, 51.5860], NW5: [-0.1470, 51.5535], NW6: [-0.1935, 51.5447],
  NW7: [-0.2104, 51.6084], NW8: [-0.1833, 51.5342], NW9: [-0.2798, 51.5993],
  NW10: [-0.2408, 51.5435], NW11: [-0.2178, 51.5779],
  N1: [-0.1028, 51.5409], N2: [-0.1468, 51.5753], N3: [-0.1606, 51.5984],
  N4: [-0.1095, 51.5690], N5: [-0.0962, 51.5619], N6: [-0.1418, 51.5586],
  N7: [-0.1153, 51.5540], N8: [-0.1274, 51.5905], N9: [-0.1159, 51.6169],
  N10: [-0.1430, 51.5921], N11: [-0.1290, 51.6080], N12: [-0.1501, 51.6171],
  N13: [-0.1092, 51.6133], N14: [-0.1515, 51.6349], N15: [-0.0864, 51.5837],
  N16: [-0.0894, 51.5584], N17: [-0.0720, 51.5942], N18: [-0.0579, 51.6041],
  N19: [-0.1265, 51.5652], N20: [-0.1651, 51.6169], N21: [-0.1014, 51.6495],
  N22: [-0.1187, 51.5989],
  E1: [-0.0714, 51.5143], E2: [-0.0680, 51.5289], E3: [-0.0427, 51.5301],
  E4: [-0.0195, 51.5970], E5: [-0.0374, 51.5590], E6: [0.0470, 51.5414],
  E7: [0.0167, 51.5593], E8: [-0.0537, 51.5433], E9: [-0.0104, 51.5432],
  E10: [-0.0154, 51.5681], E11: [-0.0099, 51.5587], E12: [0.0459, 51.5166],
  E13: [0.0305, 51.5209], E14: [0.0198, 51.5047], E15: [-0.0045, 51.5408],
  E16: [0.0613, 51.5099], E17: [0.0117, 51.5872], E18: [0.0096, 51.5703],
  E20: [0.0071, 51.5484],
  SE1: [-0.0883, 51.5045], SE2: [0.0544, 51.4622], SE3: [0.0130, 51.4646],
  SE4: [-0.0294, 51.4545], SE5: [-0.0864, 51.4729], SE6: [-0.0196, 51.4454],
  SE7: [0.0048, 51.4886], SE8: [-0.0272, 51.4826], SE9: [0.0462, 51.4411],
  SE10: [0.0117, 51.4827], SE11: [-0.0952, 51.4931], SE12: [0.0213, 51.4228],
  SE13: [-0.0228, 51.4349], SE14: [-0.0461, 51.4752], SE15: [-0.0676, 51.4730],
  SE16: [-0.0527, 51.4935], SE17: [-0.0990, 51.4888], SE18: [0.0960, 51.4915],
  SE19: [-0.0818, 51.4197], SE20: [-0.0596, 51.4141], SE21: [-0.0868, 51.4438],
  SE22: [-0.0694, 51.4524], SE23: [-0.0425, 51.4415], SE24: [-0.1004, 51.4560],
  SE25: [-0.0896, 51.4020], SE26: [-0.0556, 51.4234], SE27: [-0.1050, 51.4328],
  SE28: [0.1270, 51.4896],
  EC1: [-0.1008, 51.5236], EC2: [-0.0915, 51.5176], EC3: [-0.0834, 51.5133],
  EC4: [-0.1058, 51.5143],
  WC1: [-0.1270, 51.5200], WC2: [-0.1209, 51.5132]
};

// Calculate distance between two coordinates in kilometers
const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

const ListingsMap = ({ listingsData, viewMode = 'sale' }) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [selectedDistricts, setSelectedDistricts] = useState([]);
  const [loadingDistricts, setLoadingDistricts] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-0.1276, 51.5074],
      zoom: 10.5,
      pitch: 45
    });

    map.current.on('load', () => {
      setMapLoaded(true);
    });

    // Add click handler to load districts
    map.current.on('click', (e) => {
      const clickLng = e.lngLat.lng;
      const clickLat = e.lngLat.lat;
      
      setLoadingDistricts(true);
      
      // Find all districts within 3km radius
      const RADIUS_KM = 3;
      const nearbyDistricts = [];
      
      Object.entries(DISTRICT_CENTERS).forEach(([code, [lng, lat]]) => {
        const distance = getDistance(clickLat, clickLng, lat, lng);
        if (distance <= RADIUS_KM) {
          nearbyDistricts.push(code);
        }
      });
      
      // Add to selected districts (accumulative)
      if (nearbyDistricts.length > 0) {
        setSelectedDistricts(prev => {
          const newSet = new Set([...prev, ...nearbyDistricts]);
          return Array.from(newSet);
        });
      }
      
      setTimeout(() => setLoadingDistricts(false), 300);
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Render listings for selected districts only
  useEffect(() => {
    if (!map.current || !mapLoaded || !listingsData) return;
    
    // Only show properties if districts are selected
    if (selectedDistricts.length === 0) {
      // Remove all layers if no districts selected
      ['listings-heatmap', 'listings-clusters', 'listings-cluster-count', 'listings-points', 'selected-areas'].forEach(layerId => {
        if (map.current.getLayer(layerId)) {
          map.current.removeLayer(layerId);
        }
      });
      ['listings', 'selected-areas'].forEach(sourceId => {
        if (map.current.getSource(sourceId)) {
          map.current.removeSource(sourceId);
        }
      });
      return;
    }

    // Remove existing layers
    ['listings-heatmap', 'listings-clusters', 'listings-cluster-count', 'listings-points'].forEach(layerId => {
      if (map.current.getLayer(layerId)) {
        map.current.removeLayer(layerId);
      }
    });

    if (map.current.getSource('listings')) {
      map.current.removeSource('listings');
    }

    // Create GeoJSON features for selected districts only (NO SAMPLING - show all)
    const features = [];
    const areas = listingsData.areas || {};

    selectedDistricts.forEach(areaCode => {
      const data = areas[areaCode];
      if (!data) return;
      
      const listings = viewMode === 'sale' ? data.saleListings : data.rentListings;
      const center = DISTRICT_CENTERS[areaCode];
      
      if (!listings || listings.length === 0) return;

      // Show ALL properties (no sampling)
      listings.forEach((listing, idx) => {
        let coordinates;
        
        // Use actual geocoded coordinates if available
        if (listing.latitude && listing.longitude) {
          coordinates = [listing.longitude, listing.latitude];
        } else if (center) {
          // Fallback: distribute around district center for properties without coordinates
          const offset = 0.005;
          const angle = (idx / listings.length) * 2 * Math.PI;
          const radius = Math.random() * offset;
          coordinates = [
            center[0] + Math.cos(angle) * radius,
            center[1] + Math.sin(angle) * radius
          ];
        } else {
          // Skip if no coordinates and no center
          return;
        }
        
        features.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates
          },
          properties: {
            areaCode,
            price: viewMode === 'sale' ? listing.sale_price : listing.rent_pcm,
            bedrooms: listing.bedrooms || 0,
            address: listing.street_address,
            url: listing.listing_url
          }
        });
      });
    });

    console.log(`Loaded ${features.length} properties from ${selectedDistricts.length} districts:`, selectedDistricts.join(', '));

    if (features.length === 0) return;

    // Add source WITHOUT clustering (show individual points)
    map.current.addSource('listings', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features
      }
    });

    // Individual glowing points for each property
    const pointColor = viewMode === 'sale' ? '#00ffff' : '#ffa500';
    
    map.current.addLayer({
      id: 'listings-points',
      type: 'circle',
      source: 'listings',
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          10, 4,
          15, 8
        ],
        'circle-color': pointColor,
        'circle-opacity': 0.8,
        'circle-blur': 0.3,
        'circle-stroke-width': 2,
        'circle-stroke-color': pointColor,
        'circle-stroke-opacity': 0.6
      }
    });

    // Add heatmap layer for overview
    map.current.addLayer({
      id: 'listings-heatmap',
      type: 'heatmap',
      source: 'listings',
      maxzoom: 13,
      paint: {
        'heatmap-weight': [
          'interpolate',
          ['linear'],
          ['get', 'price'],
          100000, 0.1,
          5000000, 1
        ],
        'heatmap-intensity': [
          'interpolate',
          ['linear'],
          ['zoom'],
          0, 0.5,
          12, 1.2
        ],
        'heatmap-color': [
          'interpolate',
          ['linear'],
          ['heatmap-density'],
          0, 'rgba(0,0,0,0)',
          0.2, viewMode === 'sale' ? 'rgb(0,100,200)' : 'rgb(200,100,0)',
          0.4, viewMode === 'sale' ? 'rgb(0,150,255)' : 'rgb(255,150,0)',
          0.6, viewMode === 'sale' ? 'rgb(0,200,255)' : 'rgb(255,180,0)',
          0.8, viewMode === 'sale' ? 'rgb(0,255,255)' : 'rgb(255,200,0)',
          1, viewMode === 'sale' ? 'rgb(100,255,255)' : 'rgb(255,220,100)'
        ],
        'heatmap-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          0, 15,
          12, 30
        ],
        'heatmap-opacity': 0.7
      }
    }, 'listings-points');

    // Add popup on click
    map.current.on('click', 'listings-points', (e) => {
      const coordinates = e.features[0].geometry.coordinates.slice();
      const props = e.features[0].properties;
      
      const popup = new mapboxgl.Popup()
        .setLngLat(coordinates)
        .setHTML(`
          <div style="color: black; padding: 8px;">
            <strong>${props.address}</strong><br>
            ${viewMode === 'sale' ? 'Price' : 'Rent'}: £${props.price?.toLocaleString() || 'N/A'}${viewMode === 'rent' ? '/month' : ''}<br>
            Bedrooms: ${props.bedrooms}<br>
            Area: ${props.areaCode}<br>
            <a href="${props.url}" target="_blank" style="color: blue;">View on Zoopla</a>
          </div>
        `)
        .addTo(map.current);
    });

    // Change cursor on hover
    map.current.on('mouseenter', 'listings-points', () => {
      map.current.getCanvas().style.cursor = 'pointer';
    });

    map.current.on('mouseleave', 'listings-points', () => {
      map.current.getCanvas().style.cursor = '';
    });

  }, [mapLoaded, listingsData, viewMode, selectedDistricts]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full rounded-xl overflow-hidden shadow-2xl" />
      
      {/* Loading indicator */}
      {loadingDistricts && (
        <div className="absolute top-4 right-4 bg-black/80 text-neon-cyan px-4 py-2 rounded-lg">
          Loading areas...
        </div>
      )}
      
      {/* Selected districts info */}
      {selectedDistricts.length > 0 && (
        <div className="absolute bottom-4 left-4 right-4 bg-black/90 text-white px-4 py-3 rounded-lg backdrop-blur-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="text-neon-cyan font-semibold">
              {selectedDistricts.length} Area{selectedDistricts.length !== 1 ? 's' : ''} Selected
            </div>
            <button
              onClick={() => setSelectedDistricts([])}
              className="text-sm text-red-400 hover:text-red-300 transition-colors"
            >
              Clear All
            </button>
          </div>
          <div className="text-xs text-gray-400 flex flex-wrap gap-1">
            {selectedDistricts.slice(0, 20).map(code => (
              <span key={code} className="bg-white/10 px-2 py-1 rounded">
                {code}
              </span>
            ))}
            {selectedDistricts.length > 20 && (
              <span className="text-gray-500">+{selectedDistricts.length - 20} more</span>
            )}
          </div>
        </div>
      )}
      
      {/* Instructions overlay when no areas selected */}
      {selectedDistricts.length === 0 && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black/90 text-white px-8 py-6 rounded-xl backdrop-blur-sm text-center max-w-md">
          <div className="text-3xl mb-4">🗺️</div>
          <h3 className="text-xl font-bold mb-2 text-neon-cyan">Click Anywhere on the Map</h3>
          <p className="text-gray-400 text-sm">
            Click any location to load properties within 3km radius. Selected areas will accumulate as you explore.
          </p>
        </div>
      )}
    </div>
  );
};

export default ListingsMap;
