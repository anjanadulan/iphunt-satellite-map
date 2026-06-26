// ==========================================
// CONFIGURATION & INITIAL STATE
// ==========================================

let map;
let targetMarker = null; // Custom HTMLMarker for searched target
let userGPSMarker = null; // Custom HTMLMarker for device GPS blue dot
let currentCoords = [20, 0]; // Currently focused [lat, lon]
let userGPSCoords = null; // Cached GPS coordinates
let activeLayerKey = 'hybrid'; // Default style
let infoWindow = null; // Google Maps InfoWindow

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

// Modal Elements
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const apiKeyInput = document.getElementById('api-key-input');
const saveKeyBtn = document.getElementById('save-key-btn');
const resetKeyBtn = document.getElementById('reset-key-btn');

// Layer buttons
const layerSatelliteBtn = document.getElementById('layer-satellite-btn');
const layerHybridBtn = document.getElementById('layer-hybrid-btn');
const layerStreetBtn = document.getElementById('layer-street-btn');

// ==========================================
// DYNAMIC GOOGLE MAPS LOADER
// ==========================================

function loadGoogleMapsAPI() {
  const savedKey = localStorage.getItem('gmaps_api_key') || '';
  apiKeyInput.value = savedKey;
  
  // Inject Google Maps script dynamically
  const script = document.createElement('script');
  script.src = `https://maps.googleapis.com/maps/api/js?key=${savedKey}&callback=initMap`;
  script.async = true;
  script.defer = true;
  
  script.onerror = () => {
    showError('Failed to load Google Maps script. Check your internet connection.');
  };
  
  document.head.appendChild(script);
}

// ==========================================
// CUSTOM HTMLMARKER OVERLAY
// ==========================================

let HTMLMarker;

function defineCustomHTMLMarkerClass() {
  // We define it inside a function so google.maps namespace is ready
  HTMLMarker = class extends google.maps.OverlayView {
    constructor(latlng, html, className) {
      super();
      this.latlng = new google.maps.LatLng(latlng[0], latlng[1]);
      this.html = html;
      this.className = className;
      this.div = null;
    }

    onAdd() {
      this.div = document.createElement('div');
      this.div.className = this.className;
      this.div.innerHTML = this.html;
      this.div.style.position = 'absolute';
      this.div.style.cursor = 'pointer';

      // Click event
      this.div.addEventListener('click', () => {
        if (this.onClick) this.onClick();
      });

      const panes = this.getPanes();
      panes.overlayMouseTarget.appendChild(this.div);
    }

    draw() {
      if (!this.div) return;
      const projection = this.getProjection();
      if (!projection) return;

      const position = projection.fromLatLngToDivPixel(this.latlng);
      if (position) {
        this.div.style.left = position.x + 'px';
        this.div.style.top = position.y + 'px';
      }
    }

    onRemove() {
      if (this.div) {
        this.div.parentNode.removeChild(this.div);
        this.div = null;
      }
    }

    setLatLng(latlng) {
      this.latlng = new google.maps.LatLng(latlng[0], latlng[1]);
      this.draw();
    }
  };
}

// ==========================================
// MAP INITIALIZATION
// ==========================================

window.initMap = function() {
  // Define custom marker class once google namespace exists
  defineCustomHTMLMarkerClass();

  // Create InfoWindow once
  infoWindow = new google.maps.InfoWindow({
    pixelOffset: new google.maps.Size(0, -10)
  });

  const defaultCenter = new google.maps.LatLng(20, 0);
  
  // Initialize Google Map with bounds restrictions to prevent grey/whitespace panning
  map = new google.maps.Map(document.getElementById('map'), {
    center: defaultCenter,
    zoom: 2.5,
    minZoom: 2, // Prevent zooming out into infinite grey space
    mapTypeId: 'hybrid', // default satellite hybrid view
    disableDefaultUI: true, // cleaner glassmorphic UI overlay
    zoomControl: true,
    zoomControlOptions: {
      position: google.maps.ControlPosition.RIGHT_TOP
    },
    restriction: {
      latLngBounds: {
        north: 85,
        south: -85,
        west: -180,
        east: 180
      },
      strictBounds: true
    },
    styles: [
      {
        featureType: "all",
        elementType: "labels.text.fill",
        textColor: "#ffffff"
      }
    ]
  });

  // 1. Try to acquire exact device GPS location
  acquireGPSLocation(true);
  
  // 2. Fetch IP details in parallel
  fetchGeoIP('', false);
};

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

function showError(message) {
  errorMessage.textContent = message;
  errorToast.classList.add('show');
  
  setTimeout(() => {
    errorToast.classList.remove('show');
  }, 5000);
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
  if (!map || !HTMLMarker) return;

  if (userGPSMarker) {
    userGPSMarker.setLatLng([lat, lon]);
  } else {
    userGPSMarker = new HTMLMarker([lat, lon], '<div class="blue-dot-pulse"></div><div class="blue-dot-core"></div>', 'blue-dot-marker');
    userGPSMarker.setMap(map);
    
    userGPSMarker.onClick = () => {
      infoWindow.setContent(`
        <div style="font-family: var(--font-family); color: #fff; font-size:12px; font-weight:600; padding:2px;">
          <div style="color: #962c41; font-size:9px; letter-spacing:0.5px; text-transform:uppercase;">Your Exact Location</div>
          <div style="margin-top:4px;">Accuracy verified via browser GPS/Wi-Fi</div>
        </div>
      `);
      infoWindow.setPosition(new google.maps.LatLng(lat, lon));
      infoWindow.open(map);
    };
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
  if (!map || !HTMLMarker) return;
  
  if (targetMarker) {
    targetMarker.setLatLng([lat, lon]);
  } else {
    targetMarker = new HTMLMarker([lat, lon], '<div class="marker-pulse"></div><div class="marker-dot"></div>', 'custom-gps-marker');
    targetMarker.setMap(map);
    
    targetMarker.onClick = () => {
      infoWindow.setContent(`
        <div style="font-family: var(--font-family); color: #fff; font-size:12px; font-weight:600; padding:2px;">
          <div style="color: var(--text-secondary); font-size:9px; letter-spacing:0.5px; text-transform:uppercase;">Tracked IP Target</div>
          <div style="margin-top:4px; font-size: 13px; color: var(--accent-color);">${label}</div>
        </div>
      `);
      infoWindow.setPosition(new google.maps.LatLng(lat, lon));
      infoWindow.open(map);
    };
  }

  if (shouldCenter) {
    infoWindow.setContent(`
      <div style="font-family: var(--font-family); color: #fff; font-size:12px; font-weight:600; padding:2px;">
        <div style="color: var(--text-secondary); font-size:9px; letter-spacing:0.5px; text-transform:uppercase;">Tracked IP Target</div>
        <div style="margin-top:4px; font-size: 13px; color: var(--accent-color);">${label}</div>
      </div>
    `);
    infoWindow.setPosition(new google.maps.LatLng(lat, lon));
    infoWindow.open(map);
    
    flyToLocation(14); // Zoom 14 for IP search
  }
}

function flyToLocation(zoomLevel = 14) {
  if (!map) return;
  
  const targetLatLng = new google.maps.LatLng(currentCoords[0], currentCoords[1]);
  map.panTo(targetLatLng);
  map.setZoom(zoomLevel);
}

// ==========================================
// EVENT HANDLERS & BINDINGS
// ==========================================

function switchLayer(layerKey) {
  if (!map) return;

  activeLayerKey = layerKey;
  
  if (layerKey === 'satellite') {
    map.setMapTypeId('satellite');
  } else if (layerKey === 'hybrid') {
    map.setMapTypeId('hybrid');
  } else {
    map.setMapTypeId('roadmap');
  }

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

// Settings Modal controls
settingsBtn.addEventListener('click', () => {
  settingsModal.classList.add('show');
});

closeModalBtn.addEventListener('click', () => {
  settingsModal.classList.remove('show');
});

settingsModal.addEventListener('click', (e) => {
  if (e.target === settingsModal) {
    settingsModal.classList.remove('show');
  }
});

saveKeyBtn.addEventListener('click', () => {
  const key = apiKeyInput.value.trim();
  localStorage.setItem('gmaps_api_key', key);
  location.reload();
});

resetKeyBtn.addEventListener('click', () => {
  localStorage.removeItem('gmaps_api_key');
  apiKeyInput.value = '';
  location.reload();
});

// Layer buttons click listeners
layerSatelliteBtn.addEventListener('click', () => switchLayer('satellite'));
layerHybridBtn.addEventListener('click', () => switchLayer('hybrid'));
layerStreetBtn.addEventListener('click', () => switchLayer('street'));

// ==========================================
// APP INITIALIZATION
// ==========================================

window.addEventListener('DOMContentLoaded', () => {
  loadGoogleMapsAPI();
});
