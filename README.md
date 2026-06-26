# Orbital — IP & GPS Satellite Map Tracker

Orbital is a premium, high-fidelity web application designed to track exact physical locations (via browser GPS/Wi-Fi) and query geographic/network details of any public IP address or domain name. Built on top of the official **Google Maps JavaScript API**, it features a fully customized dark glassmorphism dashboard styled in an elegant burgundy (`#6D1F2F`) and silver-gray (`#D9D9D9`) theme.

---

## Key Features

* **Exact Location Tracking**: Queries the browser's Geolocation API to find your precise coordinates (represented on Google Maps by a pulsing blue dot with a detailed street/satellite zoom level of `17`).
* **Dual-Marker Visualization**: Keeps your physical GPS blue dot visible on the map while plotting searched targets (remote IPs/domains) with a pulsing cyan/burgundy target beacon.
* **Domain DNS Resolution**: Directly resolves domain names (e.g., `github.com`) to A-records using Google's public **DNS-over-HTTPS (DoH)** API before querying geo-coordinates.
* **Failover Geolocation API**: Intercepts queries through `ipapi.co` to fetch ASN and ISP names, automatically falling back to `freeipapi.com` in case of rate-limiting (429 errors).
* **API Key Manager**: Built-in modal dialog allows users to paste and save their Google Maps API Key. Keys are securely stored in the browser's `localStorage`.
* **Map Bounds & Zoom Restrictions**: Constrained boundaries keep the map within latitude bounds (`-85°` to `85°`) and minimum zoom level (`2`), preventing grey/white background patches at the poles or infinite world tiling.

---

## Tech Stack

* **Structure**: Semantic HTML5
* **Styling**: Modern responsive CSS3 (CSS Variables, Flexbox, Grid, Backdrop Filters)
* **Logic**: Vanilla ES6 JavaScript
* **Mapping Engine**: Google Maps JavaScript API (with custom HTML overlays extending `google.maps.OverlayView`)

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
Upon launching, click **Allow** when prompted for location permissions to enable the exact Google Maps blue dot tracking feature.

### 3. Add Google Maps API Key
To remove the default developer watermarks:
1. Click the **API Config** cog icon on the top right of the dashboard card.
2. Enter a valid Google Maps API Key.
3. Click **Save & Reload**.

---

## File Structure

```text
├── index.html   # Main dashboard layout
├── style.css    # Color variables, glassmorphic layout, and pulse animations
├── app.js       # Geolocation, overlay marker binding, and Google Maps API loading
└── README.md    # Documentation
```
