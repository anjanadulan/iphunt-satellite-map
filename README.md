# Orbital — IP & GPS Satellite Map Tracker (OpenFreeMap Edition)

Orbital is a premium, high-fidelity web application designed to track exact physical locations (via browser GPS/Wi-Fi) and query geographic/network details of any public IP address or domain name. Built on top of **OpenFreeMap** and **MapLibre GL JS**, the application is entirely free, open-source, and does not require any API keys or registration. The interface is styled in an elegant burgundy (`#6D1F2F`) and silver-gray (`#D9D9D9`) dark theme.

---

## Key Features

* **No Watermarks / Free Hosting**: Uses OpenFreeMap vector styles and tiles, removing all API restrictions or "Developer Use Only" overlays.
* **Exact Location Tracking**: Queries the browser's Geolocation API to find your precise coordinates (represented on the map by a pulsing silver-gray dot with a detailed satellite zoom level of `17`).
* **Dual-Marker Visualization**: Keeps your physical GPS blue dot visible on the map while plotting searched targets (remote IPs/domains) with a pulsing burgundy target beacon.
* **Domain DNS Resolution**: Directly resolves domain names (e.g., `github.com`) to A-records using Google's public **DNS-over-HTTPS (DoH)** API before querying geo-coordinates.
* **Failover Geolocation API**: Intercepts queries through `ipapi.co` to fetch ASN and ISP names, automatically falling back to `freeipapi.com` in case of rate-limiting (429 errors).
* **Map Bounds & Zoom Restrictions**: Constrained boundaries keep the map within latitude bounds (`-85°` to `85°`) and minimum zoom level (`2`), preventing grey/white background patches at the poles or infinite world tiling.
* **Dynamic Layer Blending**: Integrates Esri World Imagery raster tiles and overlays OpenFreeMap vector street/country/city labels on top of the satellite imagery (Hybrid view).

---

## Tech Stack

* **Structure**: Semantic HTML5
* **Styling**: Modern responsive CSS3 (CSS Variables, Flexbox, Grid, Backdrop Filters)
* **Logic**: Vanilla ES6 JavaScript
* **Mapping Engine**: MapLibre GL JS (WebGL-based vector mapping)
* **Map Styles**: OpenFreeMap Dark Style & Esri World Imagery

---

## Getting Started

### 1. Run Locally
Because the app fetches coordinates from public APIs and makes external HTTPS requests, it must be launched via a local web server (to avoid browser CORS policy blocking).

**Using Python:**
```bash
python -m http.server 8000
```
**Using Node.js:**
```bash
npx http-server -p 8000
```

Once running, navigate to `http://localhost:8000/` in your browser.

### 2. Location Access
Upon launching, click **Allow** when prompted for location permissions to enable the exact blue dot tracking feature.

---

## File Structure

```text
├── index.html   # Main dashboard layout
├── style.css    # Color variables, glassmorphic layout, MapLibre overrides, and animations
├── app.js       # Geolocation, MapLibre GL init, layer blending, and logic
└── README.md    # Documentation
```
