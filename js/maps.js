/**
 * maps.js — Leaflet Map Initialization, Station Pins & Hotspot Layers
 * Highland Climate & Hotspot Interactive Dashboard (2022–2023)
 */

import { getState, setState } from './state.js';

// Default center of Northern/Western Highland study area
export const DEFAULT_CENTER = [17.5, 99.2];
export const DEFAULT_ZOOM = 7;

/**
 * Initialize a Leaflet map with standard tiles and attribution
 * @param {string} containerId DOM ID of container
 * @param {Object} options Leaflet map options
 * @returns {L.Map}
 */
export function initLeafletMap(containerId, options = {}) {
  if (typeof L === 'undefined') {
    console.error('Leaflet library is not loaded');
    return null;
  }

  const container = document.getElementById(containerId);
  if (!container) return null;

  // Clean up existing Leaflet map if attached to this container
  if (container._leaflet_id && container._leaflet_map) {
    try {
      container._leaflet_map.remove();
    } catch (e) {
      console.warn('Error removing previous map instance:', e);
    }
  }

  const map = L.map(containerId, {
    center: DEFAULT_CENTER,
    zoom: DEFAULT_ZOOM,
    minZoom: 5,
    maxZoom: 16,
    zoomControl: true,
    attributionControl: true,
    ...options
  });

  container._leaflet_map = map;

  // Primary Basemap: CartoDB Positron (light, clear for data viz)
  const positron = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  });

  // Secondary/Fallback Basemap: OpenStreetMap Standard
  const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19
  });

  positron.addTo(map);

  L.control.layers({
    'แผนที่สว่าง (CartoDB Light)': positron,
    'แผนที่ภูมิศาสตร์ (OSM)': osm
  }, null, { position: 'topright' }).addTo(map);

  return map;
}

/**
 * Render 50 HRDI station markers on the map
 * @param {L.Map} map 
 * @param {Array} stations Array of station objects
 * @param {string|null} selectedStationId Currently selected station ID
 * @param {Function} onSelectStation Callback on click
 * @returns {L.LayerGroup}
 */
export function renderStationMarkers(map, stations, selectedStationId = null, onSelectStation = null) {
  if (!map || !stations) return null;

  const layerGroup = L.layerGroup().addTo(map);

  for (const s of stations) {
    if (!s.lat || !s.lon) continue;

    const isSelected = selectedStationId === s.station_id;

    // Distinct SVG marker for station
    const markerHtml = `
      <div style="
        width: ${isSelected ? '24px' : '16px'};
        height: ${isSelected ? '24px' : '16px'};
        background-color: ${isSelected ? '#0d9488' : '#2563eb'};
        border: 2px solid #ffffff;
        border-radius: 50%;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        cursor: pointer;
        transition: transform 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="width: 6px; height: 6px; background: #ffffff; border-radius: 50%;"></div>
      </div>
    `;

    const icon = L.divIcon({
      html: markerHtml,
      className: 'custom-station-pin',
      iconSize: [isSelected ? 24 : 16, isSelected ? 24 : 16],
      iconAnchor: [isSelected ? 12 : 8, isSelected ? 12 : 8]
    });

    const marker = L.marker([s.lat, s.lon], { icon }).addTo(layerGroup);

    // Popup content with real station metadata
    const popupHtml = `
      <div style="font-family: var(--font-family); min-width: 200px;">
        <div style="font-weight: 700; color: #0f172a; margin-bottom: 4px; font-size: 0.9rem;">
          📍 ${escapeHtml(s.station_name)}
        </div>
        <div style="font-size: 0.78rem; color: #475569; line-height: 1.4;">
          <div><strong>จังหวัด:</strong> ${escapeHtml(s.province)}</div>
          <div><strong>อำเภอ:</strong> ${escapeHtml(s.district || '-')}</div>
          <div><strong>ตำบล:</strong> ${escapeHtml(s.tambon || '-')}</div>
          <div><strong>พิกัด:</strong> ${s.lat.toFixed(4)}, ${s.lon.toFixed(4)}</div>
          <div><strong>แหล่งตรวจวัด:</strong> ${escapeHtml(s.source_type || 'HRDI')}</div>
        </div>
        <div style="margin-top: 8px;">
          <button class="popup-btn-filter" style="
            background: #0d9488;
            color: #ffffff;
            border: none;
            padding: 4px 10px;
            border-radius: 4px;
            font-size: 0.75rem;
            cursor: pointer;
            font-weight: 600;
            width: 100%;
          ">กรองข้อมูลเฉพาะสถานีนี้</button>
        </div>
      </div>
    `;

    marker.bindPopup(popupHtml);

    marker.on('popupopen', () => {
      const btn = document.querySelector('.popup-btn-filter');
      if (btn) {
        btn.onclick = () => {
          if (onSelectStation) {
            onSelectStation(s);
          } else {
            setState({
              stationId: s.station_id,
              province: s.province,
              district: s.district
            });
          }
        };
      }
    });
  }

  return layerGroup;
}

/**
 * Render satellite hotspot detection markers / clusters
 * @param {L.Map} map 
 * @param {Array} events Normalized hotspot event records
 * @returns {L.Layer}
 */
export function renderHotspotLayer(map, events) {
  if (!map || !events) return null;

  // Use MarkerClusterGroup if plugin is available, otherwise CircleMarker group
  let clusterGroup;
  if (typeof L.markerClusterGroup === 'function') {
    clusterGroup = L.markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 40,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false
    });
  } else {
    clusterGroup = L.layerGroup();
  }

  // To prevent browser hang on huge numbers, cap point markers to 5,000 top events or viewport
  const maxRenderPoints = 5000;
  const renderList = events.length > maxRenderPoints ? events.slice(0, maxRenderPoints) : events;

  for (const e of renderList) {
    if (!e.lat || !e.lon) continue;

    // Hotspot circle marker
    const marker = L.circleMarker([e.lat, e.lon], {
      radius: e.highElevation500m ? 5 : 4,
      fillColor: e.highElevation500m ? '#e11d48' : '#f59e0b',
      color: '#ffffff',
      weight: 1,
      opacity: 0.9,
      fillOpacity: 0.8
    });

    const popupHtml = `
      <div style="font-family: var(--font-family); min-width: 220px; font-size: 0.8rem; line-height: 1.5;">
        <div style="font-weight: 700; color: #991b1b; border-bottom: 1px solid #fee2e2; padding-bottom: 4px; margin-bottom: 6px;">
          🔥 จุดความร้อนจากดาวเทียม
        </div>
        <div><strong>วันที่ตรวจพบ:</strong> ${escapeHtml(e.date)}</div>
        <div><strong>จังหวัด:</strong> ${escapeHtml(e.province)}</div>
        <div><strong>อำเภอ/ตำบล:</strong> ${escapeHtml(e.district)} / ${escapeHtml(e.tambon)}</div>
        ${e.village ? `<div><strong>หมู่บ้าน:</strong> ${escapeHtml(e.village)}</div>` : ''}
        <div><strong>ระดับความสูง:</strong> ${escapeHtml(e.elevationCategory)}</div>
        <div><strong>การใช้ประโยชน์ที่ดิน:</strong> ${escapeHtml(e.landuse)}</div>
        <div><strong>พื้นที่โครงการ:</strong> ${escapeHtml(e.projectCategory)}</div>
        ${e.frp !== null ? `<div><strong>ค่า FRP:</strong> ${e.frp.toFixed(2)} MW</div>` : ''}
        ${e.satellite ? `<div><strong>ดาวเทียม / ความเชื่อมั่น:</strong> ${escapeHtml(e.satellite)} (${escapeHtml(e.confidence)})</div>` : ''}
      </div>
    `;

    marker.bindPopup(popupHtml);
    clusterGroup.addLayer(marker);
  }

  clusterGroup.addTo(map);
  return clusterGroup;
}

/**
 * Utility: Safe HTML escape to prevent XSS in tooltips and popups
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
