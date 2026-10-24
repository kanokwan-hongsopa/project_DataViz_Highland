/**
 * maps.js — Interactive 77-Province Thailand Map, Station Radius & Before/After Swipe
 * Highland Climate & Hotspot Intelligence Platform (2022–2023)
 */

import { getState, setState } from './state.js';
import { getDb, getThailandGeoJson } from './data-loader.js';
import { calculateMean, formatNum, formatInt } from './calculations.js';

// Center of Thailand showing full 77 provinces
export const THAILAND_CENTER = [15.2, 100.5];
export const THAILAND_ZOOM = 6;

// Study area default center
export const HIGHLAND_CENTER = [17.5, 99.2];
export const HIGHLAND_ZOOM = 7;

export const STUDY_PROVINCES = [
  'กาญจนบุรี', 'กำแพงเพชร', 'ตาก', 'น่าน', 'พิษณุโลก',
  'เชียงราย', 'เชียงใหม่', 'เพชรบูรณ์', 'แม่ฮ่องสอน'
];

export const STUDY_PROVINCES_EN = [
  'kanchanaburi', 'kamphaeng phet', 'tak', 'nan', 'phitsanulok',
  'chiang rai', 'chiang mai', 'phetchabun', 'mae hong son'
];

/**
 * Check if a GeoJSON feature is one of the 9 study provinces
 */
export function isStudyProvince(feature) {
  if (!feature || !feature.properties) return false;
  const pTh = feature.properties.pro_th || '';
  const pEn = (feature.properties.pro_en || '').toLowerCase().trim();
  return STUDY_PROVINCES.includes(pTh) || STUDY_PROVINCES_EN.includes(pEn);
}

/**
 * Get standardized Thai province name from feature
 */
export function getFeatureProvinceName(feature) {
  if (!feature || !feature.properties) return '';
  const pTh = feature.properties.pro_th;
  if (pTh && STUDY_PROVINCES.includes(pTh)) return pTh;
  const pEn = (feature.properties.pro_en || '').toLowerCase().trim();
  const idx = STUDY_PROVINCES_EN.indexOf(pEn);
  if (idx !== -1) return STUDY_PROVINCES[idx];
  return pTh || feature.properties.pro_en || '';
}

/**
 * Initialize a Leaflet map with standard tiles
 * Completely free, no paid API keys required
 */
export function initLeafletMap(containerId, options = {}) {
  if (typeof L === 'undefined') {
    console.error('Leaflet is not loaded');
    return null;
  }

  const container = document.getElementById(containerId);
  if (!container) return null;

  if (container._leaflet_id && container._leaflet_map) {
    try {
      container._leaflet_map.remove();
    } catch (e) {
      console.warn('Error removing map instance:', e);
    }
  }

  const map = L.map(containerId, {
    center: HIGHLAND_CENTER,
    zoom: HIGHLAND_ZOOM,
    minZoom: 5,
    maxZoom: 16,
    zoomControl: false,
    attributionControl: true,
    ...options
  });

  // Position zoom control top-left
  L.control.zoom({ position: 'topleft' }).addTo(map);

  container._leaflet_map = map;

  // CartoDB Dark/Matter or Positron basemap for dark intelligence theme
  const darkTiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 19
  });

  const osmTiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19
  });

  darkTiles.addTo(map);

  return map;
}

/**
 * Render the full 77-province Thailand map with the 9 study provinces highlighted
 */
export function renderThailandProvinceMap(map, options = {}) {
  const geojson = getThailandGeoJson();
  if (!map || !geojson) return null;

  const state = getState();
  const db = getDb();
  const { onSelectProvince, metric = 'temp', year = null } = options;

  // Precalculate province statistics for choropleth styling
  const provStats = new Map();
  const targetYear = year || (state.yearMode === 'compare' ? 2022 : Number(state.yearMode));

  for (const prov of STUDY_PROVINCES) {
    const hrdiRows = db.hrdiStationMonth.filter(r =>
      r.province === prov && r.year === targetYear && state.selectedMonths.includes(r.month)
    );
    const meanTemp = calculateMean(hrdiRows, 'temp').mean;
    const meanRain = calculateMean(hrdiRows, 'rainfall').mean;
    const stations = db.stations.filter(s => s.province === prov);

    const hsCount = db.hotspotProvinceMonth.reduce((sum, r) => {
      if (r.province === prov && r.year === targetYear && state.selectedMonths.includes(r.month)) {
        return sum + (r.count || 0);
      }
      return sum;
    }, 0);

    provStats.set(prov, {
      province: prov,
      meanTemp,
      meanRain,
      stationsCount: stations.length,
      stations,
      hotspotCount: hsCount
    });
  }

  // Study province color scales
  const getChoroplethColor = (val, metricType) => {
    if (val === null || val === undefined) return '#0d9488';
    if (metricType === 'temp') {
      return val > 26 ? '#ef4444' : val > 24 ? '#f59e0b' : val > 22 ? '#06b6d4' : '#0d9488';
    } else if (metricType === 'rainfall') {
      return val > 150 ? '#0284c7' : val > 100 ? '#06b6d4' : val > 50 ? '#14b8a6' : '#99f6e4';
    } else {
      return val > 5000 ? '#b91c1c' : val > 2000 ? '#ea580c' : val > 500 ? '#f59e0b' : '#14b8a6';
    }
  };

  const geoLayer = L.geoJSON(geojson, {
    style: (feature) => {
      const isStudy = isStudyProvince(feature);
      const provName = getFeatureProvinceName(feature);
      const isSelected = state.province === provName;

      if (!isStudy) {
        // Non-study provinces: muted solid blue-grey, subtle outline, non-clickable
        return {
          fillColor: '#1e293b',
          fillOpacity: 0.55,
          color: '#334155',
          weight: 0.7,
          className: 'province-non-study'
        };
      }

      // Study provinces: elegant teal/cyan data-driven styling
      const stat = provStats.get(provName);
      const metricVal = metric === 'rainfall' ? stat?.meanRain
        : metric === 'hotspots' ? stat?.hotspotCount
        : stat?.meanTemp;

      const baseColor = getChoroplethColor(metricVal, metric);

      return {
        fillColor: isSelected ? '#06b6d4' : baseColor,
        fillOpacity: isSelected ? 0.85 : 0.65,
        color: isSelected ? '#ffffff' : '#38bdf8',
        weight: isSelected ? 2.5 : 1.2,
        dashArray: isSelected ? '' : '',
        className: 'province-study-interactive'
      };
    },
    onEachFeature: (feature, layer) => {
      const isStudy = isStudyProvince(feature);
      const provName = getFeatureProvinceName(feature);

      if (!isStudy) {
        // Non-study province: no tooltip, non-clickable
        layer.options.interactive = false;
        return;
      }

      // Study province: interactive tooltips and click handling
      const stat = provStats.get(provName);
      const tooltipContent = `
        <div style="font-family: var(--font-family); font-size: 0.82rem; padding: 2px;">
          <strong style="color: #0f172a; font-size: 0.9rem;">จังหวัด${provName}</strong><br>
          <span style="color: #0d9488; font-weight: 600;">สถานี HRDI: ${stat?.stationsCount || 0} สถานี</span><br>
          <span>อุณหภูมิเฉลี่ย: ${formatNum(stat?.meanTemp, 1)} °C</span><br>
          <span>ปริมาณฝนเฉลี่ย: ${formatNum(stat?.meanRain, 1)} มม.</span><br>
          <span>จุดความร้อนตรวจพบ: ${formatInt(stat?.hotspotCount)} รายการ</span>
        </div>
      `;

      layer.bindTooltip(tooltipContent, {
        sticky: true,
        className: 'custom-map-tooltip'
      });

      layer.on({
        mouseover: (e) => {
          const l = e.target;
          l.setStyle({
            fillOpacity: 0.9,
            weight: 2.2,
            color: '#38bdf8'
          });
          if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
            l.bringToFront();
          }
        },
        mouseout: (e) => {
          geoLayer.resetStyle(e.target);
        },
        click: () => {
          if (onSelectProvince) {
            onSelectProvince(provName, stat);
          } else {
            setState({ province: provName });
          }
        }
      });
    }
  }).addTo(map);

  return geoLayer;
}

/**
 * Render 50 HRDI Station Markers with real coordinates and accurate 10 km Radius Circle
 */
export function renderStationMarkersWithRadius(map, stations, selectedStationId = null, onSelectStation = null) {
  if (!map || !stations) return null;

  const layerGroup = L.layerGroup().addTo(map);

  for (const s of stations) {
    if (!s.lat || !s.lon) continue;

    const isSelected = selectedStationId === s.station_id;

    // Custom SVG marker pin
    const pinSize = isSelected ? 22 : 14;
    const markerHtml = `
      <div class="station-map-pin ${isSelected ? 'selected' : ''}" style="
        width: ${pinSize}px;
        height: ${pinSize}px;
        background: ${isSelected ? 'linear-gradient(135deg, #06b6d4, #0d9488)' : '#0284c7'};
        border: 2px solid #ffffff;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="width: ${isSelected ? '6px' : '4px'}; height: ${isSelected ? '6px' : '4px'}; background: #ffffff; border-radius: 50%;"></div>
      </div>
    `;

    const icon = L.divIcon({
      html: markerHtml,
      className: 'station-icon-wrapper',
      iconSize: [pinSize, pinSize],
      iconAnchor: [pinSize / 2, pinSize / 2]
    });

    const marker = L.marker([s.lat, s.lon], { icon }).addTo(layerGroup);

    // If this station is selected, draw geographically accurate 10 km radius circle
    if (isSelected) {
      const radiusCircle = L.circle([s.lat, s.lon], {
        radius: 10000, // 10,000 meters = 10 km geodesic radius
        color: '#06b6d4',
        weight: 1.5,
        fillColor: '#0d9488',
        fillOpacity: 0.15,
        dashArray: '4, 4'
      }).addTo(layerGroup);

      radiusCircle.bindTooltip('รัศมี 10 กิโลเมตรรอบสถานี HRDI', { permanent: false, sticky: true });
    }

    marker.bindPopup(`
      <div style="font-family: var(--font-family); min-width: 210px; font-size: 0.82rem; line-height: 1.5;">
        <strong style="font-size: 0.9rem; color: #0f172a;">${escapeHtml(s.station_name)}</strong>
        <div style="color: #64748b; margin-top: 3px;">
          <div>จังหวัด: <strong>${escapeHtml(s.province)}</strong></div>
          <div>อำเภอ: ${escapeHtml(s.district || '-')}</div>
          <div>ตำบล: ${escapeHtml(s.tambon || '-')}</div>
          <div>พิกัด: ${s.lat.toFixed(4)}, ${s.lon.toFixed(4)}</div>
          <div>แหล่งตรวจวัด: ${escapeHtml(s.source_type || 'HRDI')}</div>
        </div>
        <div style="margin-top: 8px;">
          <button id="btn-popup-select-station" style="
            width: 100%;
            padding: 5px 8px;
            background: #0d9488;
            color: #ffffff;
            border: none;
            border-radius: 4px;
            font-size: 0.75rem;
            font-weight: 600;
            cursor: pointer;
          ">กรองข้อมูลและแสดงรัศมี 10 กม.</button>
        </div>
      </div>
    `);

    marker.on('popupopen', () => {
      const btn = document.getElementById('btn-popup-select-station');
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
 * Setup Draggable Before/After Map Swipe Divider (2022 vs 2023)
 */
export function setupMapSwipeComparison(containerId, map, leftLayer, rightLayer) {
  const container = document.getElementById(containerId);
  if (!container || !map) return null;

  let existingDivider = container.querySelector('.map-swipe-divider');
  if (existingDivider) existingDivider.remove();

  const divider = document.createElement('div');
  divider.className = 'map-swipe-divider';
  divider.innerHTML = `
    <div class="swipe-handle">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="15 18 9 12 15 6"></polyline>
        <polyline points="9 18 3 12 9 6"></polyline>
      </svg>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="9 18 15 12 9 6"></polyline>
        <polyline points="15 18 21 12 15 6"></polyline>
      </svg>
    </div>
  `;
  container.appendChild(divider);

  let isDragging = false;
  let currentPercent = 50;

  function updateClip(percent) {
    currentPercent = Math.max(5, Math.min(95, percent));
    divider.style.left = `${currentPercent}%`;

    // Clip left layer (2022) to [0, currentPercent]
    if (leftLayer && leftLayer.getContainer) {
      const leftPane = leftLayer.getContainer();
      if (leftPane) {
        leftPane.style.clipPath = `polygon(0 0, ${currentPercent}% 0, ${currentPercent}% 100%, 0 100%)`;
      }
    }

    // Clip right layer (2023) to [currentPercent, 100]
    if (rightLayer && rightLayer.getContainer) {
      const rightPane = rightLayer.getContainer();
      if (rightPane) {
        rightPane.style.clipPath = `polygon(${currentPercent}% 0, 100% 0, 100% 100%, ${currentPercent}% 100%)`;
      }
    }
  }

  function onPointerMove(e) {
    if (!isDragging) return;
    const rect = container.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    if (!clientX) return;
    const percent = ((clientX - rect.left) / rect.width) * 100;
    updateClip(percent);
  }

  function onPointerUp() {
    isDragging = false;
    document.removeEventListener('mousemove', onPointerMove);
    document.removeEventListener('mouseup', onPointerUp);
    document.removeEventListener('touchmove', onPointerMove);
    document.removeEventListener('touchend', onPointerUp);
  }

  divider.addEventListener('mousedown', (e) => {
    isDragging = true;
    e.preventDefault();
    document.addEventListener('mousemove', onPointerMove);
    document.addEventListener('mouseup', onPointerUp);
  });

  divider.addEventListener('touchstart', (e) => {
    isDragging = true;
    document.addEventListener('touchmove', onPointerMove);
    document.addEventListener('touchend', onPointerUp);
  });

  updateClip(50);
  return { updateClip, destroy: () => divider.remove() };
}

/**
 * Render Hotspot layer with Clustering
 */
export function renderHotspotLayer(map, events) {
  if (!map || !events) return null;

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

  const maxRender = 4000;
  const list = events.length > maxRender ? events.slice(0, maxRender) : events;

  for (const e of list) {
    if (!e.lat || !e.lon) continue;

    const marker = L.circleMarker([e.lat, e.lon], {
      radius: e.highElevation500m ? 4.5 : 3.5,
      fillColor: e.highElevation500m ? '#e11d48' : '#f59e0b',
      color: '#ffffff',
      weight: 1,
      opacity: 0.9,
      fillOpacity: 0.85
    });

    marker.bindPopup(`
      <div style="font-family: var(--font-family); min-width: 200px; font-size: 0.8rem; line-height: 1.4;">
        <strong style="color: #b91c1c;">รายการตรวจพบจุดความร้อนดาวเทียม</strong><br>
        <span>วันที่: ${escapeHtml(e.date)}</span><br>
        <span>จังหวัด: ${escapeHtml(e.province)}</span><br>
        <span>อำเภอ/ตำบล: ${escapeHtml(e.district)} / ${escapeHtml(e.tambon)}</span><br>
        <span>ระดับความสูง: ${escapeHtml(e.elevationCategory)}</span><br>
        <span>การใช้ประโยชน์ที่ดิน: ${escapeHtml(e.landuse)}</span><br>
        <span>พื้นที่โครงการ: ${escapeHtml(e.projectCategory)}</span><br>
        ${e.frp ? `<span>FRP: ${e.frp.toFixed(2)} MW</span><br>` : ''}
        <span>ดาวเทียม: ${escapeHtml(e.satellite)} (${escapeHtml(e.confidence)})</span>
      </div>
    `);

    clusterGroup.addLayer(marker);
  }

  clusterGroup.addTo(map);
  return clusterGroup;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
