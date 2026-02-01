// PASTE THESE COMMANDS INTO BROWSER CONSOLE (F12) ONE BY ONE
// Run these AFTER clicking the "Points" button

console.log('=== MAPBOX DEBUG DIAGNOSTICS ===');

// Get the map instance from window
const map = window.mapInstance || document.querySelector('[class*="mapboxgl-map"]')?.__map;
if (!map) {
  console.error('❌ Cannot find Mapbox map instance!');
} else {
  console.log('✅ Map instance found');
  
  // Check if rainbow points layer exists
  const rainbowLayer = map.getLayer('heatmap-rainbow-points');
  console.log('Rainbow points layer exists:', !!rainbowLayer);
  if (rainbowLayer) {
    console.log('  Layer type:', rainbowLayer.type);
    console.log('  Layer visibility:', map.getLayoutProperty('heatmap-rainbow-points', 'visibility'));
  }
  
  // Check if source exists
  const pointsSource = map.getSource('heatmap-points-source');
  console.log('Points source exists:', !!pointsSource);
  if (pointsSource) {
    const data = pointsSource._data;
    console.log('  Source data:', data);
    console.log('  Feature count:', data?.features?.length || 0);
    if (data?.features?.length > 0) {
      console.log('  First feature:', data.features[0]);
    }
  }
  
  // Check paint properties
  if (rainbowLayer) {
    console.log('Paint properties:');
    console.log('  circle-radius:', map.getPaintProperty('heatmap-rainbow-points', 'circle-radius'));
    console.log('  circle-color:', map.getPaintProperty('heatmap-rainbow-points', 'circle-color'));
    console.log('  circle-opacity:', map.getPaintProperty('heatmap-rainbow-points', 'circle-opacity'));
  }
  
  // List all layers
  console.log('All map layers:', map.getStyle().layers.map(l => l.id));
  
  // Check zoom level
  console.log('Current zoom:', map.getZoom());
}

console.log('=== END DIAGNOSTICS ===');
