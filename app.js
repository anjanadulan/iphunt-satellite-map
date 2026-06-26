// ==========================================
// CONFIGURATION & INITIAL STATE
// ==========================================

let map = null;
let targetMarker = null; // MapLibre Marker for tracked target
let userGPSMarker = null; // MapLibre Marker for device GPS pulsing blue dot
let currentCoords = [20, 0]; // Active focused coordinates [lat, lon]
let userGPSCoords = null; // Cached GPS coordinates [lat, lon]
let activeLayerKey = 'hybrid'; // Default style key
let mapStyleLoaded = false;

// Queuing states (MapLibre loading is async)
let queuedGPSCoords = null;
let queuedTargetCoords = null;
let queuedTargetLabel = '';
let queuedTargetShouldCenter = false;
let queuedFlyTo = null;

// DOM Cache Elements
const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');
const locateMeBtn = document.getElementById('locate-me-btn');
const detailsSection = document.getElementById('details-section');
const ipDisplay = document.getElementById('ip-display');
const countryFlag = document.getElementById('country-flag');
const locationDisplay = document.getElementById('location-display');
const postalDisplay = document.getElementById('postal-display');
const coordsDisplay = document.getElementById('coords-display');
const ispDisplay = document.getElementById('isp-display');
const asnDisplay = document.getElementById('asn-display');
const timezoneDisplay = document.getElementById('timezone-display');
const localtimeDisplay = document.getElementById('localtime-display');
const orgDisplay = document.getElementById('org-display');
const flyToBtn = document.getElementById('fly-to-btn');
const copyIpBtn = document.getElementById('copy-ip-btn');
const errorToast = document.getElementById('error-toast');
const errorMessage = document.getElementById('error-message');
const locationSourceBadge = document.getElementById('location-source-badge');

// Layer buttons
const layerSatelliteBtn = document.getElementById('layer-satellite-btn');
const layerHybridBtn = document.getElementById('layer-hybrid-btn');
const layerStreetBtn = document.getElementById('layer-street-btn');

// ==========================================
// INLINE MAP STYLE DEFINITIONS
// ==========================================
// Self-contained style objects bypass external sprite/font CORS issues & ad-blockers.
const mapStyles = {
  satellite: {
    version: 8,
    sources: {
      'esri-satellite': {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        attribution: 'Tiles &copy; Esri'
      }
    },
    layers: [
      {
        id: 'satellite',
        type: 'raster',
        source: 'esri-satellite'
      }
    ]
  },
  hybrid: {
    version: 8,
    sources: {
      'esri-satellite': {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        attribution: 'Tiles &copy; Esri'
      },
      'cartodb-labels': {
        type: 'raster',
        tiles: [
          'https://a.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}.png',
          'https://b.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}.png',
          'https://c.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}.png'
        ],
        tileSize: 256,
        attribution: '&copy; CartoDB / OSM'
      }
    },
    layers: [
      {
        id: 'satellite',
        type: 'raster',
        source: 'esri-satellite'
      },
      {
        id: 'labels',
        type: 'raster',
        source: 'cartodb-labels'
      }
    ]
  },
  street: {
    version: 8,
    sources: {
      'osm-streets': {
        type: 'raster',
        tiles: [
          'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
          'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
          'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
        ],
        tileSize: 256,
        attribution: '&copy; OpenStreetMap'
      }
    },
    layers: [
      {
        id: 'streets',
        type: 'raster',
        source: 'osm-streets'
      }
    ]
  }
};

// ==========================================
// MAP INITIALIZATION
// ==========================================

function initMap() {
  try {
    // Initialize MapLibre Map with Hybrid style object directly
    map = new maplibregl.Map({
      container: 'map',
      style: mapStyles[activeLayerKey],
      center: [0, 20], // starting position [lng, lat]
      zoom: 2.5,
      minZoom: 2,
      maxZoom: 19,
      maxBounds: [[-180, -85], [180, 85]], // Prevent vertical polar whitespace panning
      attributionControl: false
    });

    // Add navigation controls (Zoom, Compass) in top-right
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

    // Load additional layers once style has loaded
    map.on('load', () => {
      mapStyleLoaded = true;
      flushQueuedActions();
    });

    // Error logging to dashboard to make errors user-debuggable
    map.on('error', (e) => {
      console.error('MapLibre rendering error:', e);
      showError(`Map Render Error: ${e.error ? (e.error.message || e.error) : 'Tile loading failed'}`);
    });

    window.addEventListener('error', (e) => {
      console.error('JavaScript error:', e);
      // Ignore generic extension errors and CORS-masked third-party errors
      if (!e.message || e.message === 'Script error.' || !e.filename || e.filename.includes('extension') || e.filename.includes('chrome')) {
        return;
      }
      showError(`JS Error: ${e.message}`);
    });

  } catch (error) {
    console.error('Map initialization failed:', error);
    showError(`Map Init Failed: ${error.message}`);
  }

  // Acquire GPS and fetch IP details
  acquireGPSLocation(true);
  fetchGeoIP('', false);
}

function flushQueuedActions() {
  if (queuedGPSCoords) {
    updateUserGPSMarker(queuedGPSCoords[0], queuedGPSCoords[1]);
  }
  if (queuedTargetCoords) {
    updateTargetMarker(queuedTargetCoords[0], queuedTargetCoords[1], queuedTargetLabel, queuedTargetShouldCenter);
  }
  if (queuedFlyTo) {
    map.flyTo({
      center: [queuedFlyTo.coords[1], queuedFlyTo.coords[0]],
      zoom: queuedFlyTo.zoom,
      essential: true,
      duration: 2500
    });
    queuedFlyTo = null;
  }
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

function showError(message) {
  errorMessage.textContent = message;
  errorToast.classList.add('show');
  
  setTimeout(() => {
    errorToast.classList.remove('show');
  }, 6000);
}

function isDomain(input) {
  return /[a-zA-Z]/.test(input);
}

function formatUTCOffset(offsetStr) {
  if (!offsetStr) return 'UTC+00:00';
  if (/^[+-]\d{4}$/.test(offsetStr)) {
    return `UTC${offsetStr.substring(0, 3)}:${offsetStr.substring(3)}`;
  }
  if (offsetStr.startsWith('UTC') || offsetStr.startsWith('GMT')) {
    return offsetStr;
  }
  return `UTC${offsetStr.startsWith('+') || offsetStr.startsWith('-') ? offsetStr : '+' + offsetStr}`;
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    const originalSvg = copyIpBtn.innerHTML;
    copyIpBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#6D1F2F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    `;
    setTimeout(() => {
      copyIpBtn.innerHTML = originalSvg;
    }, 2000);
  }).catch(err => {
    console.error('Could not copy text: ', err);
  });
}

// ==========================================
// GPS EXACT LOCATION TRACKER
// ==========================================

function acquireGPSLocation(shouldCenter = true) {
  if (!navigator.geolocation) {
    console.warn('Geolocation not supported.');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      userGPSCoords = [lat, lon];
      
      updateUserGPSMarker(lat, lon);
      
      if (shouldCenter) {
        currentCoords = [lat, lon];
        
        locationSourceBadge.textContent = 'EXACT GPS';
        locationSourceBadge.className = 'source-badge gps-badge';
        coordsDisplay.textContent = `${lat.toFixed(6)}°, ${lon.toFixed(6)}°`;
        
        flyToLocation(17); // zoom level 17 for street-level GPS view
      }
    },
    (error) => {
      console.warn(`GPS failed: ${error.message}. Falls back to IP.`);
      if (shouldCenter && (!currentCoords || (currentCoords[0] === 20 && currentCoords[1] === 0))) {
        fetchGeoIP('');
      }
    },
    {
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 0
    }
  );
}

function updateUserGPSMarker(lat, lon) {
  if (!map) return;
  
  if (!mapStyleLoaded) {
    queuedGPSCoords = [lat, lon];
    return;
  }

  const lngLat = [lon, lat]; // MapLibre uses [lng, lat]

  if (userGPSMarker) {
    userGPSMarker.setLngLat(lngLat);
  } else {
    const el = document.createElement('div');
    el.className = 'blue-dot-marker';
    el.innerHTML = '<div class="blue-dot-pulse"></div><div class="blue-dot-core"></div>';

    const popup = new maplibregl.Popup({ offset: 15, closeButton: false })
      .setHTML(`
        <div style="font-family: var(--font-family); color: #D9D9D9; font-size:12px; font-weight:600; padding:2px;">
          <div style="color: #962c41; font-size:9px; letter-spacing:0.5px; text-transform:uppercase; margin-bottom:2px;">Your Exact Location</div>
          <div>Accuracy verified via browser GPS/Wi-Fi</div>
        </div>
      `);

    userGPSMarker = new maplibregl.Marker({ element: el })
      .setLngLat(lngLat)
      .setPopup(popup)
      .addTo(map);
  }
}

// ==========================================
// DNS & IP GEO-LOCATION RESOLVER
// ==========================================

async function resolveDomain(domain) {
  let cleanDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
  
  try {
    const response = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(cleanDomain)}&type=A`);
    if (!response.ok) throw new Error('DNS Query failed');
    
    const dnsData = await response.json();
    if (dnsData.Status !== 0 || !dnsData.Answer || dnsData.Answer.length === 0) {
      throw new Error('No DNS records found for this domain');
    }
    
    const aRecord = dnsData.Answer.find(record => record.type === 1);
    if (!aRecord) throw new Error('No IP Address found for this domain');
    
    return aRecord.data;
  } catch (error) {
    throw new Error(`DNS Resolution failed: ${error.message}`);
  }
}

async function fetchGeoIP(ipAddress = '', isManualSearch = false) {
  detailsSection.classList.add('loading');
  
  const queryIp = ipAddress.trim();
  const url = queryIp ? `https://ipapi.co/${queryIp}/json/` : 'https://ipapi.co/json/';
  
  try {
    let response = await fetch(url);
    let data;
    
    if (response.ok) {
      data = await response.json();
    }
    
    if (!response.ok || (data && data.error)) {
      console.warn('ipapi.co failed. Falling back...');
      const fallbackUrl = queryIp ? `https://freeipapi.com/api/json/${queryIp}` : 'https://freeipapi.com/api/json';
      const fallbackResponse = await fetch(fallbackUrl);
      
      if (!fallbackResponse.ok) {
        throw new Error('Both Geo IP services failed.');
      }
      
      const fallbackData = await fallbackResponse.json();
      data = translateFallbackData(fallbackData);
    }
    
    updateUI(data, isManualSearch);
  } catch (error) {
    console.error(error);
    showError(error.message || 'Failed to locate target IP.');
  } finally {
    detailsSection.classList.remove('loading');
  }
}

function translateFallbackData(fd) {
  const timezoneName = fd.timeZones && fd.timeZones.length > 0 ? fd.timeZones[0] : 'UTC';
  return {
    ip: fd.ipAddress || '0.0.0.0',
    city: fd.cityName || 'Unknown',
    region: fd.regionName || 'Unknown',
    country_name: fd.countryName || 'Unknown',
    country_code: fd.countryCode || 'UN',
    postal: fd.zipCode || 'N/A',
    latitude: fd.latitude || 0,
    longitude: fd.longitude || 0,
    timezone: timezoneName,
    utc_offset: fd.timeZone || '+0000',
    org: 'N/A (Fallback API)',
    asn: 'N/A',
    country_flag_fallback: true
  };
}

// ==========================================
// UI UPDATE ENGINE
// ==========================================

function updateUI(data, isManualSearch = false) {
  if (!data) return;

  const lat = parseFloat(data.latitude);
  const lon = parseFloat(data.longitude);
  
  if (isNaN(lat) || isNaN(lon)) {
    showError('Coordinates are invalid.');
    return;
  }

  // 1. Text displays
  ipDisplay.textContent = data.ip || 'Unknown';
  
  const city = data.city || '';
  const region = data.region || '';
  const country = data.country_name || '';
  const locationStr = [city, region, country].filter(Boolean).join(', ');
  locationDisplay.textContent = locationStr || 'Unknown Location';
  
  postalDisplay.textContent = `Postal Code: ${data.postal || 'N/A'}`;
  
  ispDisplay.textContent = data.org || data.asn || 'Unknown Network';
  asnDisplay.textContent = `ASN: ${data.asn || 'N/A'}`;
  orgDisplay.textContent = data.org || 'N/A';
  
  const offset = formatUTCOffset(data.utc_offset);
  timezoneDisplay.textContent = offset;
  
  if (data.timezone) {
    try {
      const localTimeStr = new Date().toLocaleTimeString('en-US', {
        timeZone: data.timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      localtimeDisplay.textContent = `Local Time: ${localTimeStr}`;
    } catch (e) {
      localtimeDisplay.textContent = 'Local Time: --:--';
    }
  } else {
    localtimeDisplay.textContent = 'Local Time: --:--';
  }

  // 2. Flag
  const countryCode = data.country_code ? data.country_code.toLowerCase() : 'un';
  countryFlag.src = `https://flagcdn.com/w80/${countryCode}.png`;
  countryFlag.onerror = () => {
    countryFlag.src = 'https://flagcdn.com/w80/un.png';
  };

  // 3. Location Modes (GPS vs IP)
  if (isManualSearch || !userGPSCoords) {
    currentCoords = [lat, lon];
    coordsDisplay.textContent = `${lat.toFixed(6)}°, ${lon.toFixed(6)}°`;
    locationSourceBadge.textContent = 'IP ESTIMATE';
    locationSourceBadge.className = 'source-badge ip-badge';
    
    updateTargetMarker(lat, lon, locationStr || data.ip, true);
  } else {
    updateTargetMarker(lat, lon, locationStr || data.ip, false);
  }
}

function updateTargetMarker(lat, lon, label, shouldCenter = true) {
  if (!map) return;
  
  if (!mapStyleLoaded) {
    queuedTargetCoords = [lat, lon];
    queuedTargetLabel = label;
    queuedTargetShouldCenter = shouldCenter;
    return;
  }

  const lngLat = [lon, lat];

  if (targetMarker) {
    targetMarker.setLngLat(lngLat);
  } else {
    const el = document.createElement('div');
    el.className = 'custom-gps-marker';
    el.innerHTML = '<div class="marker-pulse"></div><div class="marker-dot"></div>';
    
    targetMarker = new maplibregl.Marker({ element: el })
      .setLngLat(lngLat)
      .addTo(map);
  }
  
  const popup = new maplibregl.Popup({ offset: 15, closeButton: false })
    .setHTML(`
      <div style="font-family: var(--font-family); color: #D9D9D9; font-size:12px; font-weight:600; padding:2px;">
        <div style="color: var(--text-secondary); font-size:9px; letter-spacing:0.5px; text-transform:uppercase; margin-bottom:2px;">Tracked IP Target</div>
        <div style="font-size: 13px; color: #962c41;">${label}</div>
      </div>
    `);

  targetMarker.setPopup(popup);

  if (shouldCenter) {
    targetMarker.togglePopup(); // Open the popup automatically
    flyToLocation(14); // Zoom 14 for IP search
  }
}

function flyToLocation(zoomLevel = 14) {
  if (!map) return;
  
  if (!mapStyleLoaded) {
    queuedFlyTo = { coords: [...currentCoords], zoom: zoomLevel };
    return;
  }

  map.flyTo({
    center: [currentCoords[1], currentCoords[0]],
    zoom: zoomLevel,
    essential: true,
    duration: 2500
  });
}

// ==========================================
// EVENT HANDLERS & BINDINGS
// ==========================================

function switchLayer(layerKey) {
  if (!map) return;

  activeLayerKey = layerKey;
  
  // Directly swap the self-contained style object!
  map.setStyle(mapStyles[layerKey]);

  [layerSatelliteBtn, layerHybridBtn, layerStreetBtn].forEach(btn => {
    btn.classList.remove('active');
  });

  document.getElementById(`layer-${layerKey}-btn`).classList.add('active');
}

// Submit Search
searchForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const query = searchInput.value.trim();
  if (!query) return;

  try {
    let ipToFetch = query;
    if (isDomain(query)) {
      detailsSection.classList.add('loading');
      ipToFetch = await resolveDomain(query);
    }
    await fetchGeoIP(ipToFetch, true);
  } catch (error) {
    console.error(error);
    showError(error.message);
    detailsSection.classList.remove('loading');
  }
});

// Locate Me
locateMeBtn.addEventListener('click', () => {
  searchInput.value = '';
  userGPSCoords = null;
  acquireGPSLocation(true);
  fetchGeoIP('', false);
});

// Fly to Target
flyToBtn.addEventListener('click', (e) => {
  e.preventDefault();
  const isGPSFocused = userGPSCoords && currentCoords[0] === userGPSCoords[0] && currentCoords[1] === userGPSCoords[1];
  flyToLocation(isGPSFocused ? 17 : 14);
});

// Copy IP
copyIpBtn.addEventListener('click', () => {
  const ipText = ipDisplay.textContent;
  if (ipText && ipText !== '0.0.0.0' && ipText !== 'Scanning...') {
    copyToClipboard(ipText);
  }
});

// Layer buttons click listeners
layerSatelliteBtn.addEventListener('click', () => switchLayer('satellite'));
layerHybridBtn.addEventListener('click', () => switchLayer('hybrid'));
layerStreetBtn.addEventListener('click', () => switchLayer('street'));

// ==========================================
// APP INITIALIZATION
// ==========================================

window.addEventListener('DOMContentLoaded', () => {
  initMap();
});
