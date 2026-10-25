/**
 * maps.js — Clean Interactive GeoJSON Choropleth Map (Zero External Tile API Keys)
 * Supports In-Place Smooth Updates for 77 Thai Provinces + 9 Study Provinces & 50 Weather Stations
 * Highland Climate & Hotspot Dashboard (2022–2023)
 */

import { getState, setState } from './state.js';
import { getDb, getThailandGeoJson } from './data-loader.js';
import {
  filterStationMonthRecords,
  getHotspotByProvinceBreakdown
} from './filters.js';
import { calculateMean, formatNum, formatInt, formatSignedDelta } from './calculations.js';
import { prefersReducedMotion } from './animations.js';

export const THAILAND_CENTER = [15.2, 100.5];
export const THAILAND_ZOOM = 6;

export const HIGHLAND_CENTER = [17.35, 99.45];
export const HIGHLAND_ZOOM = 6.4;

export const STUDY_PROVINCES = [
  'กาญจนบุรี', 'กำแพงเพชร', 'ตาก', 'น่าน', 'พิษณุโลก',
  'เชียงราย', 'เชียงใหม่', 'เพชรบูรณ์', 'แม่ฮ่องสอน'
];

export const STUDY_PROVINCES_EN = [
  'kanchanaburi', 'kamphaeng phet', 'tak', 'nan', 'phitsanulok',
  'chiang rai', 'chiang mai', 'phetchabun', 'mae hong son'
];

// Visual label centroids for the 9 study provinces (matches reference map layout)
const PROVINCE_LABEL_COORDS = {
  'เชียงราย': [19.92, 99.88],
  'เชียงใหม่': [18.82, 98.92],
  'แม่ฮ่องสอน': [18.68, 97.92],
  'น่าน': [18.82, 100.82],
  'ตาก': [16.65, 98.85],
  'พิษณุโลก': [16.88, 100.38],
  'กำแพงเพชร': [16.22, 99.52],
  'เพชรบูรณ์': [16.15, 101.18],
  'กาญจนบุรี': [14.58, 99.18]
};

const mapRegistry = new Map();

/**
 * Invalidate size on all active Leaflet maps (call after tab switch or layout resize)
 */
export function invalidateAllMaps() {
  for (const [, map] of mapRegistry.entries()) {
    try {
      map.invalidateSize({ animate: false });
    } catch (e) {
      // ignore unmounted container
    }
  }
}

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
 * Get standardized Thai province name from GeoJSON feature
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
 * Initialize a pure GeoJSON Leaflet map WITHOUT any external Tile API that requires an API key
 */
export function initLeafletMap(containerId, options = {}) {
  if (typeof L === 'undefined') {
    console.error('Leaflet is not loaded');
    return null;
  }

  const container = document.getElementById(containerId);
  if (!container) return null;

  // Reuse existing map instance if already initialized on this container
  if (container._leaflet_id && container._leaflet_map) {
    return container._leaflet_map;
  }

  const defaultCenter = options.center || HIGHLAND_CENTER;
  const defaultZoom = options.zoom || HIGHLAND_ZOOM;

  const map = L.map(containerId, {
    center: defaultCenter,
    zoom: defaultZoom,
    minZoom: 5,
    maxZoom: 13,
    zoomControl: false,
    attributionControl: false,
    preferCanvas: false,
    zoomAnimation: true,
    fadeAnimation: true,
    markerZoomAnimation: true,
    ...options
  });

  // 1. Zoom In / Zoom Out Control (top-left)
  L.control.zoom({
    position: 'topleft',
    zoomInTitle: 'ขยายแผนที่ (Zoom In)',
    zoomOutTitle: 'ย่อแผนที่ (Zoom Out)'
  }).addTo(map);

  // 2. Dedicated Reset View Control (restores map zoom/center smoothly without clearing filters)
  const ResetViewControl = L.Control.extend({
    options: { position: 'topleft' },
    onAdd: function () {
      const btn = L.DomUtil.create('button', 'leaflet-bar leaflet-control leaflet-reset-view-btn');
      btn.type = 'button';
      btn.title = 'คืนมุมมองแผนที่เริ่มต้น (Reset View)';
      btn.setAttribute('aria-label', 'คืนมุมมองแผนที่เริ่มต้น');
      btn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
        <span>มุมมองเริ่มต้น</span>
      `;
      L.DomEvent.disableClickPropagation(btn);
      L.DomEvent.on(btn, 'click', (e) => {
        L.DomEvent.preventDefault(e);
        if (prefersReducedMotion()) {
          map.setView(defaultCenter, defaultZoom, { animate: false });
        } else {
          map.flyTo(defaultCenter, defaultZoom, { duration: 0.65 });
        }
      });
      return btn;
    }
  });
  map.addControl(new ResetViewControl());

  // 3. Dedicated panes so province labels and station markers layer cleanly
  if (!map.getPane('provinceLabelPane')) {
    const labelPane = map.createPane('provinceLabelPane');
    labelPane.style.zIndex = '610';
    labelPane.style.pointerEvents = 'none';
  }
  if (!map.getPane('stationPane')) {
    const stationPane = map.createPane('stationPane');
    stationPane.style.zIndex = '650';
  }
  if (!map.getPane('stationCalloutPane')) {
    const calloutPane = map.createPane('stationCalloutPane');
    calloutPane.style.zIndex = '680';
    calloutPane.style.pointerEvents = 'none';
  }

  // 4. Add Reference-Style Distance Scale Bar (bottom-right: 0 50 100 200 กม.)
  if (!container.querySelector('.map-scale-bar-box')) {
    const scaleBox = document.createElement('div');
    scaleBox.className = 'map-scale-bar-box';
    scaleBox.innerHTML = `
      <div class="scale-numbers"><span>0</span><span>50</span><span>100</span><span>200 กม.</span></div>
      <div class="scale-segments">
        <span class="seg dark"></span>
        <span class="seg light"></span>
        <span class="seg dark wide"></span>
      </div>
    `;
    container.appendChild(scaleBox);
  }

  container._leaflet_map = map;
  mapRegistry.set(containerId, map);

  return map;
}

/**
 * Get Choropleth color scale configuration for single-year values OR compare-mode differences
 */
export function getChoroplethScaleConfig(metricType, isCompareMode = false) {
  if (isCompareMode) {
    if (metricType === 'temp') {
      return {
        title: 'ผลต่างอุณหภูมิเฉลี่ย (°C)',
        subtitle: 'ปี 2023 เทียบกับ 2022',
        unit: '°C',
        bins: [
          { label: 'ลดลง (< −0.2 °C)', color: '#0EA5E9' },
          { label: 'ใกล้เคียงเดิม (±0.2 °C)', color: '#38BDF8' },
          { label: 'เพิ่มขึ้นเล็กน้อย (+0.2 ถึง +0.6 °C)', color: '#F59E0B' },
          { label: 'เพิ่มขึ้นชัดเจน (> +0.6 °C)', color: '#F97316' }
        ],
        getColor(diff) {
          if (diff === null || diff === undefined || Number.isNaN(Number(diff))) return '#64748B';
          if (diff > 0.6) return '#F97316';
          if (diff > 0.2) return '#F59E0B';
          if (diff < -0.2) return '#0EA5E9';
          return '#38BDF8';
        }
      };
    }
    if (metricType === 'humidity') {
      return {
        title: 'ผลต่างความชื้นสัมพัทธ์ (%)',
        subtitle: 'ปี 2023 เทียบกับ 2022',
        unit: '%',
        bins: [
          { label: 'แห้งลง (< −2.0 %)', color: '#F97316' },
          { label: 'ใกล้เคียงเดิม (±2.0 %)', color: '#38BDF8' },
          { label: 'ชื้นขึ้น (> +2.0 %)', color: '#0284C7' }
        ],
        getColor(diff) {
          if (diff === null || diff === undefined || Number.isNaN(Number(diff))) return '#64748B';
          if (diff > 2.0) return '#0284C7';
          if (diff < -2.0) return '#F97316';
          return '#38BDF8';
        }
      };
    }
    if (metricType === 'rainfall') {
      return {
        title: 'ผลต่างปริมาณฝนเฉลี่ย (มม.)',
        subtitle: 'ปี 2023 เทียบกับ 2022',
        unit: 'มม.',
        bins: [
          { label: 'ฝนลดลงมาก (< −30 มม.)', color: '#F97316' },
          { label: 'ฝนลดลง (−5 ถึง −30 มม.)', color: '#F59E0B' },
          { label: 'ใกล้เคียงเดิม (±5 มม.)', color: '#38BDF8' },
          { label: 'ฝนเพิ่มขึ้น (> +5 มม.)', color: '#0284C7' }
        ],
        getColor(diff) {
          if (diff === null || diff === undefined || Number.isNaN(Number(diff))) return '#64748B';
          if (diff > 5) return '#0284C7';
          if (diff < -30) return '#F97316';
          if (diff < -5) return '#F59E0B';
          return '#38BDF8';
        }
      };
    }
    // Compare mode: hotspots
    return {
      title: 'ผลต่างจุดความร้อน (จุด)',
      subtitle: 'ปี 2023 เทียบกับ 2022',
      unit: 'จุด',
      bins: [
        { label: 'ลดลง (< −50 จุด)', color: '#10B981' },
        { label: 'ใกล้เคียงเดิม (±50 จุด)', color: '#38BDF8' },
        { label: 'เพิ่มขึ้น (+51 ถึง +3,000 จุด)', color: '#F59E0B' },
        { label: 'เพิ่มขึ้นมาก (> +3,000 จุด)', color: '#EF4444' }
      ],
      getColor(diff) {
        if (diff === null || diff === undefined || Number.isNaN(Number(diff))) return '#64748B';
        if (diff > 3000) return '#EF4444';
        if (diff > 50) return '#F59E0B';
        if (diff < -50) return '#10B981';
        return '#38BDF8';
      }
    };
  }

  // Single-year scales
  if (metricType === 'temp') {
    return {
      title: 'อุณหภูมิเฉลี่ย (°C)',
      subtitle: 'ค่าตรวจวัดรายจังหวัด',
      unit: '°C',
      bins: [
        { max: 22, label: '≤ 22 °C', color: '#38BDF8' },
        { max: 24, label: '22–24 °C', color: '#2DD4BF' },
        { max: 26, label: '24–26 °C', color: '#F59E0B' },
        { max: Infinity, label: '> 26 °C', color: '#EF4444' }
      ],
      getColor(val) {
        if (val === null || val === undefined || Number.isNaN(Number(val))) return '#64748B';
        if (val > 26) return '#EF4444';
        if (val > 24) return '#F59E0B';
        if (val > 22) return '#2DD4BF';
        return '#38BDF8';
      }
    };
  }
  if (metricType === 'humidity') {
    return {
      title: 'ความชื้นสัมพัทธ์ (%)',
      subtitle: 'ค่าตรวจวัดรายจังหวัด',
      unit: '%',
      bins: [
        { max: 65, label: '≤ 65 %', color: '#99F6E4' },
        { max: 75, label: '65–75 %', color: '#2DD4BF' },
        { max: 82, label: '75–82 %', color: '#0EA5E9' },
        { max: Infinity, label: '> 82 %', color: '#0284C7' }
      ],
      getColor(val) {
        if (val === null || val === undefined || Number.isNaN(Number(val))) return '#64748B';
        if (val > 82) return '#0284C7';
        if (val > 75) return '#0EA5E9';
        if (val > 65) return '#2DD4BF';
        return '#99F6E4';
      }
    };
  }
  if (metricType === 'rainfall') {
    return {
      title: 'ปริมาณฝนเฉลี่ย (มม./เดือน)',
      subtitle: 'ค่าตรวจวัดรายจังหวัด',
      unit: 'มม.',
      bins: [
        { max: 50, label: '≤ 50 มม.', color: '#BAE6FD' },
        { max: 110, label: '50–110 มม.', color: '#38BDF8' },
        { max: 170, label: '110–170 มม.', color: '#0284C7' },
        { max: Infinity, label: '> 170 มม.', color: '#1D4ED8' }
      ],
      getColor(val) {
        if (val === null || diffIsNaN(val)) return '#64748B';
        if (val > 170) return '#1D4ED8';
        if (val > 110) return '#0284C7';
        if (val > 50) return '#38BDF8';
        return '#BAE6FD';
      }
    };
  }
  return {
    title: 'จุดความร้อนสะสม (จุด)',
    subtitle: 'ค่าตรวจพบรายจังหวัด',
    unit: 'จุด',
    bins: [
      { max: 500, label: '≤ 500 จุด', color: '#FDE047' },
      { max: 2000, label: '501–2,000', color: '#FBBF24' },
      { max: 5000, label: '2,001–5,000', color: '#F97316' },
      { max: Infinity, label: '> 5,000 จุด', color: '#EF4444' }
    ],
    getColor(val) {
      if (val === null || val === undefined || Number.isNaN(Number(val))) return '#64748B';
      if (val > 5000) return '#EF4444';
      if (val > 2000) return '#F97316';
      if (val > 500) return '#FBBF24';
      return '#FDE047';
    }
  };
}

function diffIsNaN(v) {
  return v === undefined || Number.isNaN(Number(v));
}

/**
 * Update or render vertical Frosted Glass Choropleth Legend inside a map container (matches reference image)
 */
export function renderMapChoroplethLegend(containerId, metricType, provStatsMap, isCompareMode = false) {
  const container = document.getElementById(containerId);
  if (!container) return;

  let legendEl = container.querySelector('.map-choropleth-legend');
  if (!legendEl) {
    legendEl = document.createElement('div');
    legendEl.className = 'map-choropleth-legend';
    container.appendChild(legendEl);
  }

  const scale = getChoroplethScaleConfig(metricType, isCompareMode);
  let minVal = Infinity;
  let maxVal = -Infinity;

  if (provStatsMap) {
    for (const [, st] of provStatsMap.entries()) {
      const v = isCompareMode ? st.diffVal : st.displayVal;
      if (v !== null && v !== undefined && !Number.isNaN(Number(v))) {
        if (v < minVal) minVal = v;
        if (v > maxVal) maxVal = v;
      }
    }
  }

  const decimals = metricType === 'hotspots' ? 0 : 1;
  const rangeText = Number.isFinite(minVal) && Number.isFinite(maxVal)
    ? (isCompareMode
        ? `${formatSignedDelta(minVal, decimals)} ถึง ${formatSignedDelta(maxVal, decimals)} ${scale.unit}`
        : `${decimals === 0 ? formatInt(minVal) : formatNum(minVal, 1)} – ${decimals === 0 ? formatInt(maxVal) : formatNum(maxVal, 1)} ${scale.unit}`)
    : 'ไม่มีข้อมูลในช่วงที่เลือก';

  legendEl.innerHTML = `
    <div class="legend-title">${scale.title}</div>
    <div class="legend-subtitle">${scale.subtitle} <span class="legend-range-inline">(${rangeText})</span></div>
    <div class="legend-scale-list">
      ${scale.bins.map(b => `
        <div class="legend-step">
          <span class="legend-swatch" style="background:${b.color};"></span>
          <span>${b.label}</span>
        </div>
      `).join('')}
      <div class="legend-step">
        <span class="legend-swatch" style="background:rgba(100, 116, 139, 0.65);"></span>
        <span>นอกพื้นที่ศึกษา (68 จ.)</span>
      </div>
    </div>
  `;
}

/**
 * Compute per-province statistics for 2022, 2023, and Fair Compare Diff
 */
export function computeProvinceMapStats(state, metric = 'temp') {
  const db = getDb();
  const provStats = new Map();

  const fairCompareMonths = state.selectedMonths.filter(m => m <= 9);
  const effectiveCompareMonths = fairCompareMonths.length > 0 ? fairCompareMonths : state.selectedMonths;

  const stateBase = { ...state, province: null, district: null, tambon: null, stationId: null };
  const stateFair = { ...stateBase, selectedMonths: effectiveCompareMonths };

  const hrdi2022 = filterStationMonthRecords(db.hrdiStationMonth, state.yearMode === 'compare' ? stateFair : stateBase, 2022);
  const hrdi2023 = filterStationMonthRecords(db.hrdiStationMonth, state.yearMode === 'compare' ? stateFair : stateBase, 2023);

  const hsBreakdown = getHotspotByProvinceBreakdown(stateBase, true);
  const hsByProv = new Map(hsBreakdown.map(h => [h.province, h]));

  for (const prov of STUDY_PROVINCES) {
    const rows22 = hrdi2022.filter(r => r.province === prov);
    const rows23 = hrdi2023.filter(r => r.province === prov);

    const temp22 = calculateMean(rows22, 'temp').mean;
    const temp23 = calculateMean(rows23, 'temp').mean;
    const hum22 = calculateMean(rows22, 'humidity').mean;
    const hum23 = calculateMean(rows23, 'humidity').mean;
    const rain22 = calculateMean(rows22, 'rainfall').mean;
    const rain23 = calculateMean(rows23, 'rainfall').mean;

    const hsObj = hsByProv.get(prov);
    const hs22 = hsObj?.count2022 ?? 0;
    const hs23 = hsObj?.count2023 ?? 0;

    let val2022 = null;
    let val2023 = null;
    let unit = '°C';
    let decimals = 1;
    let metricLabel = 'อุณหภูมิเฉลี่ย';

    if (metric === 'temp') {
      val2022 = temp22;
      val2023 = temp23;
      unit = '°C';
      decimals = 1;
      metricLabel = 'อุณหภูมิเฉลี่ย';
    } else if (metric === 'humidity') {
      val2022 = hum22;
      val2023 = hum23;
      unit = '%';
      decimals = 1;
      metricLabel = 'ความชื้นสัมพัทธ์';
    } else if (metric === 'rainfall') {
      val2022 = rain22;
      val2023 = rain23;
      unit = 'มม.';
      decimals = 1;
      metricLabel = 'ปริมาณน้ำฝนเฉลี่ย';
    } else {
      val2022 = hs22;
      val2023 = hs23;
      unit = 'จุด';
      decimals = 0;
      metricLabel = 'จุดความร้อน';
    }

    const diffVal = (val2022 !== null && val2023 !== null) ? (val2023 - val2022) : null;
    let pctChange = null;
    let pctNote = '';
    if (metric === 'temp') {
      pctNote = 'เปรียบเทียบด้วยผลต่าง °C โดยตรง';
    } else if (val2022 === null || val2023 === null) {
      pctNote = 'ไม่มีข้อมูลครบสองปีในช่วงที่เลือก';
    } else if (val2022 === 0) {
      pctNote = 'ไม่คำนวณ % เนื่องจากค่าปี 2022 เป็น 0';
    } else {
      pctChange = ((val2023 - val2022) / val2022) * 100;
    }

    const displayVal = state.yearMode === '2022' ? val2022
      : state.yearMode === '2023' ? val2023
      : diffVal;

    const stations = db.stations.filter(s => {
      if (s.province !== prov) return false;
      if (state.weatherSource && state.weatherSource !== 'all' && s.source_type !== state.weatherSource) return false;
      return true;
    });

    provStats.set(prov, {
      province: prov,
      val2022,
      val2023,
      diffVal,
      pctChange,
      pctNote,
      displayVal,
      unit,
      decimals,
      metricLabel,
      temp22,
      temp23,
      hum22,
      hum23,
      rain22,
      rain23,
      hs22,
      hs23,
      stationsCount: stations.length,
      stations
    });
  }

  return provStats;
}

/**
 * Helper to compute style and tooltip for a single province feature
 */
function buildProvinceStyle(feature, state, provStats, scaleConfig, isCompareMode) {
  const isStudy = isStudyProvince(feature);
  const provName = getFeatureProvinceName(feature);
  const isSelected = state.province === provName;

  if (!isStudy) {
    return {
      fillColor: '#0A2033',
      fillOpacity: 0.72,
      color: 'rgba(65, 193, 223, 0.20)',
      weight: 0.85,
      className: 'province-non-study'
    };
  }

  const stat = provStats.get(provName);
  const colorVal = isCompareMode ? stat?.diffVal : stat?.displayVal;
  const baseColor = scaleConfig.getColor(colorVal);
  const dimmedByOtherSelection = state.province && !isSelected;

  return {
    fillColor: baseColor,
    fillOpacity: isSelected ? 0.94 : (dimmedByOtherSelection ? 0.40 : 0.86),
    color: isSelected ? '#FFFFFF' : 'rgba(37, 217, 245, 0.75)',
    weight: isSelected ? 3.0 : 1.5,
    className: 'province-study-interactive'
  };
}

function buildProvinceTooltipHtml(provName, stat, state, metric, isCompareMode) {
  const isSelected = state.province === provName;
  const decimals = metric === 'hotspots' ? 0 : 1;
  const fmtVal = (v) => v === null || v === undefined ? 'N/A' : (decimals === 0 ? formatInt(v) : formatNum(v, 1));

  if (isCompareMode) {
    const diffStr = stat?.diffVal !== null && stat?.diffVal !== undefined
      ? `${formatSignedDelta(stat.diffVal, decimals)} ${stat.unit}`
      : 'N/A';
    const pctStr = stat?.pctChange !== null && stat?.pctChange !== undefined
      ? ` (${formatSignedDelta(stat.pctChange, 1, '%')})`
      : (stat?.pctNote ? `<br><span style="font-size:0.7rem;color:#64748B;">* ${stat.pctNote}</span>` : '');

    return `
      <div class="clean-map-tooltip">
        <div class="tt-title">จ.${provName} <span class="tt-hint">${isSelected ? '(คลิกซ้ำเพื่อยกเลิก)' : '(คลิกเพื่อดูเจาะลึก)'}</span></div>
        <div class="tt-row"><span>ปี 2022:</span> <strong>${fmtVal(stat?.val2022)} ${stat?.unit || ''}</strong></div>
        <div class="tt-row"><span>ปี 2023:</span> <strong>${fmtVal(stat?.val2023)} ${stat?.unit || ''}</strong></div>
        <div class="tt-row tt-diff"><span>ผลต่าง:</span> <strong>${diffStr}${pctStr}</strong></div>
      </div>
    `;
  }

  return `
    <div class="clean-map-tooltip">
      <div class="tt-title">จ.${provName} <span class="tt-hint">${isSelected ? '(คลิกซ้ำเพื่อยกเลิก)' : '(คลิกเพื่อดูเจาะลึก)'}</span></div>
      <div class="tt-row"><span>ค่าปี ${state.yearMode}:</span> <strong>${fmtVal(stat?.displayVal)} ${stat?.unit || ''}</strong></div>
      <div class="tt-row"><span>สถานีตรวจวัด:</span> <strong>${stat?.stationsCount || 0} สถานี</strong></div>
    </div>
  `;
}

/**
 * Render OR Smoothly Update in-place the 77-province Thailand GeoJSON Choropleth Map + 9 Province Name Pills
 */
export function renderThailandProvinceMap(map, options = {}) {
  const geojson = getThailandGeoJson();
  if (!map || !geojson) return null;

  const state = getState();
  const {
    onSelectProvince,
    metric = 'temp',
    legendContainerId = null
  } = options;

  const isCompareMode = state.yearMode === 'compare';
  const provStats = computeProvinceMapStats(state, metric);
  const scaleConfig = getChoroplethScaleConfig(metric, isCompareMode);

  // Store latest callback & state on map so in-place handlers always use current state
  map._latestProvinceSelectCallback = onSelectProvince;

  // If the GeoJSON layer already exists on this map, update styles & tooltips in-place (NO layer recreation!)
  if (map._provinceGeoLayer && map._provinceLayerGroup && map.hasLayer(map._provinceLayerGroup)) {
    map._provinceGeoLayer.eachLayer((layer) => {
      const feature = layer.feature;
      const isStudy = isStudyProvince(feature);
      const provName = getFeatureProvinceName(feature);
      const nextStyle = buildProvinceStyle(feature, state, provStats, scaleConfig, isCompareMode);
      layer.setStyle(nextStyle);

      if (isStudy) {
        const stat = provStats.get(provName);
        const tooltipHtml = buildProvinceTooltipHtml(provName, stat, state, metric, isCompareMode);
        if (layer.getTooltip()) {
          layer.setTooltipContent(tooltipHtml);
        }
      }
    });

    // Update active state on province pill labels
    if (map._provinceLabelMarkers) {
      for (const [pName, lblMarker] of map._provinceLabelMarkers.entries()) {
        const el = lblMarker.getElement();
        if (el) {
          const pill = el.querySelector('.map-province-label-pill');
          if (pill) {
            pill.classList.toggle('is-selected', state.province === pName);
          }
        }
      }
    }

    map._provinceGeoUpdateCount = (map._provinceGeoUpdateCount || 0) + 1;

    if (legendContainerId) {
      renderMapChoroplethLegend(legendContainerId, metric, provStats, isCompareMode);
    }
    return map._provinceLayerGroup;
  }

  // Initial creation of the GeoJSON layer + Province Name Pill Labels
  const group = L.layerGroup();
  const geoLayer = L.geoJSON(geojson, {
    style: (feature) => buildProvinceStyle(feature, state, provStats, scaleConfig, isCompareMode),
    onEachFeature: (feature, layer) => {
      const isStudy = isStudyProvince(feature);
      const provName = getFeatureProvinceName(feature);

      if (!isStudy) {
        layer.options.interactive = false;
        return;
      }

      const stat = provStats.get(provName);
      const tooltipHtml = buildProvinceTooltipHtml(provName, stat, state, metric, isCompareMode);

      layer.bindTooltip(tooltipHtml, {
        sticky: true,
        className: 'custom-map-tooltip'
      });

      layer.on({
        mouseover: (e) => {
          const l = e.target;
          l.setStyle({
            fillOpacity: 0.96,
            weight: 2.8,
            color: '#FFFFFF'
          });
          if (l.bringToFront) l.bringToFront();
        },
        mouseout: (e) => {
          const curState = getState();
          const curMetric = curState.swipeMetric || curState.overviewMetricTab || metric;
          const curCompare = curState.yearMode === 'compare';
          const curStats = computeProvinceMapStats(curState, curMetric);
          const curScale = getChoroplethScaleConfig(curMetric, curCompare);
          e.target.setStyle(buildProvinceStyle(feature, curState, curStats, curScale, curCompare));
        },
        click: (e) => {
          L.DomEvent.stopPropagation(e);
          const curState = getState();
          const nextProv = curState.province === provName ? null : provName;
          const cb = map._latestProvinceSelectCallback;
          if (typeof cb === 'function') {
            cb(nextProv);
          } else {
            setState({ province: nextProv });
          }
        }
      });
    }
  });

  group.addLayer(geoLayer);

  // Add floating Province Name Pill Labels for the 9 study provinces (matches reference image)
  const labelMarkers = new Map();
  const labelPane = map.getPane('provinceLabelPane') ? 'provinceLabelPane' : 'overlayPane';
  for (const provName of STUDY_PROVINCES) {
    const coords = PROVINCE_LABEL_COORDS[provName];
    if (!coords) continue;
    const icon = L.divIcon({
      className: 'map-province-label-wrapper',
      html: `<span class="map-province-label-pill ${state.province === provName ? 'is-selected' : ''}">${provName}</span>`,
      iconSize: [86, 24],
      iconAnchor: [43, 12]
    });
    const lblMarker = L.marker(coords, {
      pane: labelPane,
      icon,
      interactive: false,
      keyboard: false
    });
    group.addLayer(lblMarker);
    labelMarkers.set(provName, lblMarker);
  }

  group.addTo(map);
  map._provinceLayerGroup = group;
  map._provinceGeoLayer = geoLayer;
  map._provinceLabelMarkers = labelMarkers;
  map._provinceGeoUpdateCount = 0;

  if (legendContainerId) {
    renderMapChoroplethLegend(legendContainerId, metric, provStats, isCompareMode);
  }

  return group;
}

/**
 * Separate closely spaced station coordinates slightly for visual clarity & independent clicking
 * while preserving true lat/lon in station metadata.
 */
function computeSeparatedStationCoords(stations) {
  const coordsMap = new Map();
  const minDistDeg = 0.024;

  const visited = new Set();
  for (let i = 0; i < stations.length; i++) {
    const s1 = stations[i];
    if (visited.has(s1.station_id)) continue;

    const cluster = [s1];
    visited.add(s1.station_id);

    for (let j = i + 1; j < stations.length; j++) {
      const s2 = stations[j];
      if (visited.has(s2.station_id)) continue;
      const dLat = s1.lat - s2.lat;
      const dLon = s1.lon - s2.lon;
      const dist = Math.sqrt(dLat * dLat + dLon * dLon);
      if (dist < minDistDeg) {
        cluster.push(s2);
        visited.add(s2.station_id);
      }
    }

    if (cluster.length === 1) {
      coordsMap.set(s1.station_id, { lat: s1.lat, lon: s1.lon, isOffset: false });
    } else {
      const centerLat = cluster.reduce((sum, s) => sum + s.lat, 0) / cluster.length;
      const centerLon = cluster.reduce((sum, s) => sum + s.lon, 0) / cluster.length;
      const radiusDeg = 0.016;
      cluster.forEach((st, idx) => {
        const angle = (2 * Math.PI * idx) / cluster.length;
        coordsMap.set(st.station_id, {
          lat: centerLat + radiusDeg * Math.sin(angle),
          lon: centerLon + radiusDeg * Math.cos(angle),
          isOffset: true
        });
      });
    }
  }
  return coordsMap;
}

/**
 * Helper to update the selected station highlight ring, 10 km circle, and floating callout label
 */
function updateSelectedStationHighlightOverlay(map, highlightGroup, selectedSt, dispCoords, isApplied) {
  highlightGroup.clearLayers();
  if (!selectedSt || !dispCoords) return;

  const paneName = map.getPane('stationPane') ? 'stationPane' : 'overlayPane';
  const calloutPane = map.getPane('stationCalloutPane') ? 'stationCalloutPane' : paneName;
  const stationCode = (selectedSt.station_id || '').split('|')[0] || selectedSt.station_id;

  // 1. Geodesic 10 km radius circle around true station coordinate
  const radiusCircle = L.circle([selectedSt.lat, selectedSt.lon], {
    radius: 10000,
    color: '#10B981',
    weight: 2.0,
    dashArray: '5, 5',
    fillColor: '#10B981',
    fillOpacity: 0.14,
    interactive: false
  });
  highlightGroup.addLayer(radiusCircle);

  // 2. Outer Mint / Cyan Highlight Ring around selected marker (pulses gently once via CSS)
  const outerHighlightRing = L.circleMarker([dispCoords.lat, dispCoords.lon], {
    pane: paneName,
    radius: 16,
    fillColor: isApplied ? '#10B981' : '#00E5FF',
    fillOpacity: 0.32,
    color: '#FFFFFF',
    weight: 2.5,
    interactive: false,
    className: 'station-marker-highlight-ring'
  });
  highlightGroup.addLayer(outerHighlightRing);

  // 3. Floating Reference-Style White Callout Card below selected station marker (like CNX-03 in reference image)
  const calloutIcon = L.divIcon({
    className: 'station-selected-callout-wrapper',
    html: `
      <div class="station-selected-callout-box">
        <div class="callout-code">${stationCode}</div>
        <div class="callout-name">${selectedSt.station_name}</div>
      </div>
    `,
    iconSize: [180, 44],
    iconAnchor: [90, -14]
  });
  const calloutMarker = L.marker([dispCoords.lat, dispCoords.lon], {
    pane: calloutPane,
    icon: calloutIcon,
    interactive: false,
    keyboard: false
  });
  highlightGroup.addLayer(calloutMarker);
}

/**
 * Render OR Smoothly Update weather station markers in-place without recreating marker DOM elements
 */
export function renderStationMarkers(map, stations, options = {}) {
  if (!map || !stations) return null;

  const state = getState();
  const db = getDb();
  const {
    selectedStationId = null,
    appliedStationId = state.stationId,
    selectedProvince = null,
    onSelectStation = null,
    stationStatsMap = new Map()
  } = options;

  map._latestStationSelectCallback = onSelectStation;

  // Build quick per-station stats from real stationMonthDashboard
  const statsLookup = new Map(stationStatsMap);
  if (statsLookup.size === 0 && db.stationMonthDashboard && db.stationMonthDashboard.length > 0) {
    const filteredRows = filterStationMonthRecords(db.stationMonthDashboard, {
      ...state,
      province: null,
      district: null,
      tambon: null,
      stationId: null
    });
    for (const st of stations) {
      const stRows = filteredRows.filter(r => r.station_id === st.station_id);
      const meanTemp = calculateMean(stRows, 'temp').mean;
      const meanRain = calculateMean(stRows, 'rainfall').mean;
      const meanHum = calculateMean(stRows, 'humidity').mean;
      const hotspots10km = stRows.reduce((acc, r) => acc + (Number(r.hotspots_within_10km) || 0), 0);
      statsLookup.set(st.station_id, { meanTemp, meanRain, meanHum, hotspots10km });
    }
  }

  const displayCoords = computeSeparatedStationCoords(stations);
  const stationIdsSignature = stations.map(s => s.station_id).join('||');

  // Check if we can update the existing station markers layer IN-PLACE without recreating markers
  if (
    map._stationMasterGroup &&
    map.hasLayer(map._stationMasterGroup) &&
    map._stationIdsSignature === stationIdsSignature &&
    map._stationMarkerMap
  ) {
    for (const st of stations) {
      const marker = map._stationMarkerMap.get(st.station_id);
      if (!marker) continue;

      const isSelected = st.station_id === selectedStationId;
      const isInSelectedProv = !selectedProvince || st.province === selectedProvince;
      const isHrdiField = st.source_type === 'HRDI Weather Station';
      const stationCode = (st.station_id || '').split('|')[0] || st.station_id;
      const stat = statsLookup.get(st.station_id);

      marker.setRadius(isSelected ? 9.5 : (isInSelectedProv ? 6.6 : 5.0));
      marker.setStyle({
        fillColor: isSelected ? '#10B981' : (isHrdiField ? '#10B981' : '#0284C7'),
        color: '#FFFFFF',
        weight: isSelected ? 2.8 : 2.0,
        opacity: isInSelectedProv ? 1 : 0.6,
        fillOpacity: isSelected ? 1 : (isInSelectedProv ? 0.94 : 0.5)
      });

      const el = marker.getElement();
      if (el) {
        el.classList.toggle('station-marker-active', isSelected);
        el.setAttribute('data-station-id', st.station_id);
        el.setAttribute('data-station-code', stationCode);
        el.setAttribute('data-source-type', st.source_type || 'OpenWeatherMap');
      }

      const hotspot10kmText = stat && stat.hotspots10km !== undefined
        ? `<div class="tt-row"><span>จุดความร้อนในรัศมี 10 กม.:</span> <strong>${formatInt(stat.hotspots10km)} จุด</strong></div>`
        : '';

      if (marker.getTooltip()) {
        marker.setTooltipContent(`
          <div class="clean-map-tooltip">
            <div class="tt-title">[${stationCode}] ${st.station_name}</div>
            <div class="tt-row"><span>ที่ตั้ง:</span> <strong>จ.${st.province} · อ.${st.district || '-'} · ต.${st.tambon || '-'}</strong></div>
            <div class="tt-row"><span>แหล่งข้อมูล:</span> <strong>${st.source_type || 'OpenWeatherMap'}</strong></div>
            ${stat && stat.meanTemp !== null ? `<div class="tt-row"><span>อุณหภูมิเฉลี่ย:</span> <strong>${formatNum(stat.meanTemp, 1)} °C</strong></div>` : ''}
            ${stat && stat.meanHum !== null ? `<div class="tt-row"><span>ความชื้นเฉลี่ย:</span> <strong>${formatNum(stat.meanHum, 1)} %</strong></div>` : ''}
            ${stat && stat.meanRain !== null ? `<div class="tt-row"><span>ฝนสถานีเฉลี่ย:</span> <strong>${formatNum(stat.meanRain, 1)} มม.</strong></div>` : ''}
            ${hotspot10kmText}
            <div class="tt-row" style="margin-top:4px; color:#0B96B5; font-weight:700;"><span>คลิกจุดสถานีเพื่อเปิดดูรายละเอียด</span></div>
          </div>
        `);
      }
    }

    const selectedSt = selectedStationId ? stations.find(s => s.station_id === selectedStationId) : null;
    const selectedDisp = selectedSt ? (displayCoords.get(selectedSt.station_id) || { lat: selectedSt.lat, lon: selectedSt.lon }) : null;
    updateSelectedStationHighlightOverlay(
      map,
      map._stationHighlightGroup,
      selectedSt,
      selectedDisp,
      Boolean(selectedStationId && selectedStationId === appliedStationId)
    );

    map._stationMarkersUpdateCount = (map._stationMarkersUpdateCount || 0) + 1;
    return map._stationMasterGroup;
  }

  // Otherwise, remove previous station master group (if any) and create fresh marker instances
  if (map._stationMasterGroup) {
    try {
      map.removeLayer(map._stationMasterGroup);
    } catch (e) {
      // ignore
    }
  }

  const masterGroup = L.layerGroup();
  const highlightGroup = L.layerGroup();
  masterGroup.addLayer(highlightGroup);

  const markerMap = new Map();
  const paneName = map.getPane('stationPane') ? 'stationPane' : 'overlayPane';

  for (const st of stations) {
    const isSelected = st.station_id === selectedStationId;
    const isInSelectedProv = !selectedProvince || st.province === selectedProvince;
    const stat = statsLookup.get(st.station_id);
    const isHrdiField = st.source_type === 'HRDI Weather Station';
    const stationCode = (st.station_id || '').split('|')[0] || st.station_id;
    const disp = displayCoords.get(st.station_id) || { lat: st.lat, lon: st.lon, isOffset: false };

    if (disp.isOffset) {
      const leaderLine = L.polyline([[st.lat, st.lon], [disp.lat, disp.lon]], {
        pane: paneName,
        color: '#081B2D',
        weight: 1.2,
        dashArray: '2, 3',
        opacity: 0.65,
        interactive: false
      });
      masterGroup.addLayer(leaderLine);
    }

    const marker = L.circleMarker([disp.lat, disp.lon], {
      pane: paneName,
      radius: isSelected ? 9.5 : (isInSelectedProv ? 6.6 : 5.0),
      fillColor: isSelected ? '#10B981' : (isHrdiField ? '#10B981' : '#0284C7'),
      color: '#FFFFFF',
      weight: isSelected ? 2.8 : 2.0,
      opacity: isInSelectedProv ? 1 : 0.6,
      fillOpacity: isSelected ? 1 : (isInSelectedProv ? 0.94 : 0.5),
      className: `station-marker-point ${isSelected ? 'station-marker-active' : ''} ${isHrdiField ? 'station-marker-hrdi' : 'station-marker-owm'}`
    });

    marker._stationData = st;
    marker.on('add', () => {
      const el = marker.getElement();
      if (el) {
        el.setAttribute('data-station-id', st.station_id);
        el.setAttribute('data-station-code', stationCode);
        el.setAttribute('data-source-type', st.source_type || 'OpenWeatherMap');
      }
    });

    const hotspot10kmText = stat && stat.hotspots10km !== undefined
      ? `<div class="tt-row"><span>จุดความร้อนในรัศมี 10 กม.:</span> <strong>${formatInt(stat.hotspots10km)} จุด</strong></div>`
      : '';

    marker.bindTooltip(`
      <div class="clean-map-tooltip">
        <div class="tt-title">[${stationCode}] ${st.station_name}</div>
        <div class="tt-row"><span>ที่ตั้ง:</span> <strong>จ.${st.province} · อ.${st.district || '-'} · ต.${st.tambon || '-'}</strong></div>
        <div class="tt-row"><span>แหล่งข้อมูล:</span> <strong>${st.source_type || 'OpenWeatherMap'}</strong></div>
        ${stat && stat.meanTemp !== null ? `<div class="tt-row"><span>อุณหภูมิเฉลี่ย:</span> <strong>${formatNum(stat.meanTemp, 1)} °C</strong></div>` : ''}
        ${stat && stat.meanHum !== null ? `<div class="tt-row"><span>ความชื้นเฉลี่ย:</span> <strong>${formatNum(stat.meanHum, 1)} %</strong></div>` : ''}
        ${stat && stat.meanRain !== null ? `<div class="tt-row"><span>ฝนสถานีเฉลี่ย:</span> <strong>${formatNum(stat.meanRain, 1)} มม.</strong></div>` : ''}
        ${hotspot10kmText}
        <div class="tt-row" style="margin-top:4px; color:#0B96B5; font-weight:700;"><span>คลิกจุดสถานีเพื่อเปิดดูรายละเอียด</span></div>
      </div>
    `, { direction: 'top', offset: [0, -8] });

    marker.on('click', (e) => {
      L.DomEvent.stopPropagation(e);
      const cb = map._latestStationSelectCallback;
      if (typeof cb === 'function') {
        cb(st);
      }
    });

    masterGroup.addLayer(marker);
    markerMap.set(st.station_id, marker);
  }

  const selectedSt = selectedStationId ? stations.find(s => s.station_id === selectedStationId) : null;
  const selectedDisp = selectedSt ? (displayCoords.get(selectedSt.station_id) || { lat: selectedSt.lat, lon: selectedSt.lon }) : null;
  updateSelectedStationHighlightOverlay(
    map,
    highlightGroup,
    selectedSt,
    selectedDisp,
    Boolean(selectedStationId && selectedStationId === appliedStationId)
  );

  masterGroup.addTo(map);
  map._stationMasterGroup = masterGroup;
  map._stationHighlightGroup = highlightGroup;
  map._stationMarkerMap = markerMap;
  map._stationIdsSignature = stationIdsSignature;
  map._stationMarkersUpdateCount = 0;

  return masterGroup;
}

/**
 * Convenience wrapper for rendering station markers with 10 km radius on the Overview Map
 */
export function renderStationMarkersWithRadius(map, stations, selectedStationId = null, onSelectStation = null) {
  const state = getState();
  const activeStationId = selectedStationId || state.previewStationId || state.stationId;
  return renderStationMarkers(map, stations, {
    selectedStationId: activeStationId,
    appliedStationId: state.stationId,
    selectedProvince: state.province,
    onSelectStation
  });
}

/**
 * Clear station markers from the map cleanly when toggled off
 */
export function clearStationMarkersLayer(map) {
  if (!map) return;
  if (map._stationMasterGroup) {
    try {
      map.removeLayer(map._stationMasterGroup);
    } catch (e) {
      // ignore
    }
    map._stationMasterGroup = null;
    map._stationHighlightGroup = null;
    map._stationMarkerMap = null;
    map._stationIdsSignature = null;
  }
}

/**
 * Render Hotspot layer with Marker Clustering and Click Detail Callback
 */
export function renderHotspotLayer(map, events, onSelectHotspotEvent = null) {
  if (!map || !events) return null;

  const isCluster = typeof L.markerClusterGroup === 'function';
  const clusterGroup = isCluster
    ? L.markerClusterGroup({
        chunkedLoading: false,
        maxClusterRadius: 48,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false
      })
    : L.layerGroup();

  const maxRender = 1500;
  let list = events;
  if (events.length > maxRender) {
    const step = events.length / maxRender;
    list = [];
    for (let i = 0; i < maxRender; i++) {
      list.push(events[Math.floor(i * step)]);
    }
  }

  const markers = [];
  for (const e of list) {
    if (!e || !e.lat || !e.lon) continue;

    const marker = L.circleMarker([e.lat, e.lon], {
      radius: e.highElevation500m ? 4.8 : 3.8,
      fillColor: e.highElevation500m ? '#E11D48' : '#F59E0B',
      color: '#FFFFFF',
      weight: 1,
      opacity: 0.92,
      fillOpacity: 0.86
    });

    marker.on('click', () => {
      if (typeof onSelectHotspotEvent === 'function') {
        onSelectHotspotEvent(e);
      }
      if (!marker.getPopup || !marker.getPopup()) {
        marker.bindPopup(`
          <div class="clean-map-tooltip" style="min-width: 200px;">
            <div class="tt-title" style="color: #B91C1C;">จุดความร้อนวันที่ ${escapeHtml(e.date)}</div>
            <div class="tt-row"><span>พื้นที่:</span> <strong>จ.${escapeHtml(e.province)} · อ.${escapeHtml(e.district)}</strong></div>
            <div class="tt-row"><span>ตำบล:</span> <strong>${escapeHtml(e.tambon)}</strong></div>
            <div class="tt-row"><span>ความสูง:</span> <strong>${escapeHtml(e.elevationCategory)}</strong></div>
            <div class="tt-row"><span>ประเภทที่ดิน:</span> <strong>${escapeHtml(e.landuse)}</strong></div>
            <div class="tt-row"><span>เขตโครงการ:</span> <strong>${escapeHtml(e.projectCategory)}</strong></div>
          </div>
        `).openPopup();
      }
    });

    markers.push(marker);
  }

  if (isCluster && typeof clusterGroup.addLayers === 'function') {
    clusterGroup.addLayers(markers);
  } else {
    markers.forEach(m => clusterGroup.addLayer(m));
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
