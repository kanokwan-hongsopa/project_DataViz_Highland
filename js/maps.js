/**
 * maps.js — Clean Interactive GeoJSON Choropleth Map (Zero External Tile API Keys)
 * Supports 77 Thai Provinces Context + 9 Study Provinces Choropleth (2022 | 2023 | Compare Diff)
 * Highland Climate & Hotspot Dashboard (2022–2023)
 */

import { getState, setState } from './state.js';
import { getDb, getThailandGeoJson } from './data-loader.js';
import {
  filterStationMonthRecords,
  getHotspotByProvinceBreakdown
} from './filters.js';
import { calculateMean, formatNum, formatInt, formatSignedDelta } from './calculations.js';

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

  if (container._leaflet_id && container._leaflet_map) {
    try {
      container._leaflet_map.remove();
    } catch (e) {
      console.warn('Error removing map instance:', e);
    }
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
    ...options
  });

  // 1. Zoom In / Zoom Out Control (top-left)
  L.control.zoom({
    position: 'topleft',
    zoomInTitle: 'ขยายแผนที่ (Zoom In)',
    zoomOutTitle: 'ย่อแผนที่ (Zoom Out)'
  }).addTo(map);

  // 2. Dedicated Reset View Control (restores map zoom/center without clearing filters)
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
        map.setView(defaultCenter, defaultZoom, { animate: true });
      });
      return btn;
    }
  });
  map.addControl(new ResetViewControl());

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
        title: 'ผลต่างอุณหภูมิ (ปี 2023 เทียบกับ 2022)',
        unit: '°C',
        bins: [
          { label: 'ลดลง (< −0.2 °C)', color: '#0EA5E9' },
          { label: 'ใกล้เคียงเดิม (±0.2 °C)', color: '#94A3B8' },
          { label: 'เพิ่มขึ้นเล็กน้อย (+0.2 ถึง +0.8 °C)', color: '#FB923C' },
          { label: 'เพิ่มขึ้นชัดเจน (> +0.8 °C)', color: '#F43F5E' }
        ],
        getColor(diff) {
          if (diff === null || diff === undefined || Number.isNaN(Number(diff))) return '#CBD5E1';
          if (diff > 0.8) return '#F43F5E';
          if (diff > 0.2) return '#FB923C';
          if (diff < -0.2) return '#0EA5E9';
          return '#94A3B8';
        }
      };
    }
    if (metricType === 'humidity') {
      return {
        title: 'ผลต่างความชื้นสัมพัทธ์ (ปี 2023 เทียบกับ 2022)',
        unit: '%',
        bins: [
          { label: 'แห้งลง (< −2.0 %)', color: '#F97316' },
          { label: 'ใกล้เคียงเดิม (±2.0 %)', color: '#94A3B8' },
          { label: 'ชื้นขึ้น (> +2.0 %)', color: '#0EA5E9' }
        ],
        getColor(diff) {
          if (diff === null || diff === undefined || Number.isNaN(Number(diff))) return '#CBD5E1';
          if (diff > 2.0) return '#0EA5E9';
          if (diff < -2.0) return '#F97316';
          return '#94A3B8';
        }
      };
    }
    if (metricType === 'rainfall') {
      return {
        title: 'ผลต่างปริมาณฝนเฉลี่ย (ปี 2023 เทียบกับ 2022)',
        unit: 'มม.',
        bins: [
          { label: 'ฝนลดลงมาก (< −30 มม.)', color: '#F97316' },
          { label: 'ฝนลดลง (−5 ถึง −30 มม.)', color: '#FBBF24' },
          { label: 'ใกล้เคียงเดิม (±5 มม.)', color: '#94A3B8' },
          { label: 'ฝนเพิ่มขึ้น (> +5 มม.)', color: '#0284C7' }
        ],
        getColor(diff) {
          if (diff === null || diff === undefined || Number.isNaN(Number(diff))) return '#CBD5E1';
          if (diff > 5) return '#0284C7';
          if (diff < -30) return '#F97316';
          if (diff < -5) return '#FBBF24';
          return '#94A3B8';
        }
      };
    }
    // Compare mode: hotspots
    return {
      title: 'ผลต่างจุดความร้อน (ปี 2023 เทียบกับ 2022)',
      unit: 'จุด',
      bins: [
        { label: 'ลดลง (< −50 จุด)', color: '#10B981' },
        { label: 'ใกล้เคียงเดิม (±50 จุด)', color: '#94A3B8' },
        { label: 'เพิ่มขึ้น (+51 ถึง +3,000 จุด)', color: '#FB923C' },
        { label: 'เพิ่มขึ้นมาก (> +3,000 จุด)', color: '#E11D48' }
      ],
      getColor(diff) {
        if (diff === null || diff === undefined || Number.isNaN(Number(diff))) return '#CBD5E1';
        if (diff > 3000) return '#E11D48';
        if (diff > 50) return '#FB923C';
        if (diff < -50) return '#10B981';
        return '#94A3B8';
      }
    };
  }

  // Single-year scales
  if (metricType === 'temp') {
    return {
      title: 'อุณหภูมิเฉลี่ย (°C)',
      unit: '°C',
      bins: [
        { max: 22, label: '≤ 22 °C', color: '#38BDF8' },
        { max: 24, label: '22–24 °C', color: '#2DD4BF' },
        { max: 26, label: '24–26 °C', color: '#FBBF24' },
        { max: Infinity, label: '> 26 °C', color: '#F43F5E' }
      ],
      getColor(val) {
        if (val === null || val === undefined || Number.isNaN(Number(val))) return '#CBD5E1';
        if (val > 26) return '#F43F5E';
        if (val > 24) return '#FBBF24';
        if (val > 22) return '#2DD4BF';
        return '#38BDF8';
      }
    };
  }
  if (metricType === 'humidity') {
    return {
      title: 'ความชื้นสัมพัทธ์ (%)',
      unit: '%',
      bins: [
        { max: 65, label: '≤ 65 %', color: '#99F6E4' },
        { max: 75, label: '65–75 %', color: '#2DD4BF' },
        { max: 82, label: '75–82 %', color: '#0B96B5' },
        { max: Infinity, label: '> 82 %', color: '#1D4ED8' }
      ],
      getColor(val) {
        if (val === null || val === undefined || Number.isNaN(Number(val))) return '#CBD5E1';
        if (val > 82) return '#1D4ED8';
        if (val > 75) return '#0B96B5';
        if (val > 65) return '#2DD4BF';
        return '#99F6E4';
      }
    };
  }
  if (metricType === 'rainfall') {
    return {
      title: 'ปริมาณฝนเฉลี่ย (มม./เดือน)',
      unit: 'มม.',
      bins: [
        { max: 50, label: '≤ 50 มม.', color: '#BAE6FD' },
        { max: 110, label: '50–110 มม.', color: '#38BDF8' },
        { max: 170, label: '110–170 มม.', color: '#0284C7' },
        { max: Infinity, label: '> 170 มม.', color: '#1E3A8A' }
      ],
      getColor(val) {
        if (val === null || val === undefined || Number.isNaN(Number(val))) return '#CBD5E1';
        if (val > 170) return '#1E3A8A';
        if (val > 110) return '#0284C7';
        if (val > 50) return '#38BDF8';
        return '#BAE6FD';
      }
    };
  }
  return {
    title: 'จุดความร้อนสะสม (จุด)',
    unit: 'จุด',
    bins: [
      { max: 500, label: '≤ 500 จุด', color: '#FDE047' },
      { max: 2000, label: '501–2,000', color: '#FBBF24' },
      { max: 5000, label: '2,001–5,000', color: '#FB923C' },
      { max: Infinity, label: '> 5,000 จุด', color: '#E11D48' }
    ],
    getColor(val) {
      if (val === null || val === undefined || Number.isNaN(Number(val))) return '#CBD5E1';
      if (val > 5000) return '#E11D48';
      if (val > 2000) return '#FB923C';
      if (val > 500) return '#FBBF24';
      return '#FDE047';
    }
  };
}

/**
 * Update or render compact Choropleth Legend inside a map container
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
        ? `ช่วงผลต่างจริง: ${formatSignedDelta(minVal, decimals)} ถึง ${formatSignedDelta(maxVal, decimals)} ${scale.unit}`
        : `ช่วงค่าจริง: ${ decimals === 0 ? formatInt(minVal) : formatNum(minVal, 1) } – ${ decimals === 0 ? formatInt(maxVal) : formatNum(maxVal, 1) } ${scale.unit}`)
    : 'ไม่มีข้อมูลในช่วงที่เลือก';

  legendEl.innerHTML = `
    <div class="legend-title">${scale.title} <span class="legend-range-inline">(${rangeText})</span></div>
    <div class="legend-scale-row">
      ${scale.bins.map(b => `
        <span class="legend-step">
          <span class="legend-swatch" style="background:${b.color};"></span>
          <span>${b.label}</span>
        </span>
      `).join('')}
      <span class="legend-step">
        <span class="legend-swatch" style="background:#CBD5E1;"></span>
        <span>นอกพื้นที่ศึกษา (68 จ.)</span>
      </span>
    </div>
  `;
}

/**
 * Compute per-province statistics for 2022, 2023, and Fair Compare Diff
 */
export function computeProvinceMapStats(state, metric = 'temp') {
  const db = getDb();
  const provStats = new Map();

  // For fair comparison in compare mode on HRDI metrics, only use months <= 9 that exist in both years
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
    // Percentage change: only valid for ratio-scale metrics (rainfall, hotspots) where base > 0
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
 * Render the 77-province Thailand GeoJSON Choropleth Map (No API Key Tiles, Clean Hover & Click)
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
  const group = L.layerGroup();

  const geoLayer = L.geoJSON(geojson, {
    style: (feature) => {
      const isStudy = isStudyProvince(feature);
      const provName = getFeatureProvinceName(feature);
      const isSelected = state.province === provName;

      if (!isStudy) {
        return {
          fillColor: '#CBD5E1',
          fillOpacity: 0.55,
          color: '#94A3B8',
          weight: 0.7,
          className: 'province-non-study'
        };
      }

      const stat = provStats.get(provName);
      const colorVal = isCompareMode ? stat?.diffVal : stat?.displayVal;
      const baseColor = scaleConfig.getColor(colorVal);
      const dimmedByOtherSelection = state.province && !isSelected;

      return {
        fillColor: baseColor,
        fillOpacity: isSelected ? 0.94 : (dimmedByOtherSelection ? 0.42 : 0.84),
        color: isSelected ? '#081B2D' : '#FFFFFF',
        weight: isSelected ? 2.8 : 1.4,
        className: 'province-study-interactive'
      };
    },
    onEachFeature: (feature, layer) => {
      const isStudy = isStudyProvince(feature);
      const provName = getFeatureProvinceName(feature);

      if (!isStudy) {
        layer.options.interactive = false;
        return;
      }

      const stat = provStats.get(provName);
      const isSelected = state.province === provName;
      const decimals = metric === 'hotspots' ? 0 : 1;
      const fmtVal = (v) => v === null || v === undefined ? 'N/A' : (decimals === 0 ? formatInt(v) : formatNum(v, 1));

      let tooltipHtml = '';
      if (isCompareMode) {
        const diffStr = stat?.diffVal !== null && stat?.diffVal !== undefined
          ? `${formatSignedDelta(stat.diffVal, decimals)} ${stat.unit}`
          : 'N/A';
        const pctStr = stat?.pctChange !== null && stat?.pctChange !== undefined
          ? ` (${formatSignedDelta(stat.pctChange, 1, '%')})`
          : (stat?.pctNote ? `<br><span style="font-size:0.7rem;color:#64748B;">* ${stat.pctNote}</span>` : '');

        tooltipHtml = `
          <div class="clean-map-tooltip">
            <div class="tt-title">จ.${provName} <span class="tt-hint">${isSelected ? '(คลิกซ้ำเพื่อยกเลิก)' : '(คลิกเพื่อดูเจาะลึก)'}</span></div>
            <div class="tt-row"><span>ปี 2022:</span> <strong>${fmtVal(stat?.val2022)} ${stat?.unit || ''}</strong></div>
            <div class="tt-row"><span>ปี 2023:</span> <strong>${fmtVal(stat?.val2023)} ${stat?.unit || ''}</strong></div>
            <div class="tt-row tt-diff"><span>ผลต่าง:</span> <strong>${diffStr}${pctStr}</strong></div>
          </div>
        `;
      } else {
        tooltipHtml = `
          <div class="clean-map-tooltip">
            <div class="tt-title">จ.${provName} <span class="tt-hint">${isSelected ? '(คลิกซ้ำเพื่อยกเลิก)' : '(คลิกเพื่อดูเจาะลึก)'}</span></div>
            <div class="tt-row"><span>ค่าปี ${state.yearMode}:</span> <strong>${fmtVal(stat?.displayVal)} ${stat?.unit || ''}</strong></div>
            <div class="tt-row"><span>สถานีตรวจวัด:</span> <strong>${stat?.stationsCount || 0} สถานี</strong></div>
          </div>
        `;
      }

      layer.bindTooltip(tooltipHtml, {
        sticky: true,
        className: 'custom-map-tooltip'
      });

      layer.on({
        mouseover: (e) => {
          const l = e.target;
          l.setStyle({
            fillOpacity: 0.95,
            weight: 2.6,
            color: '#081B2D'
          });
          if (l.bringToFront) l.bringToFront();
        },
        mouseout: (e) => {
          geoLayer.resetStyle(e.target);
        },
        click: (e) => {
          L.DomEvent.stopPropagation(e);
          const nextProv = state.province === provName ? null : provName;
          if (typeof onSelectProvince === 'function') {
            onSelectProvince(nextProv);
          } else {
            setState({ province: nextProv });
          }
        }
      });
    }
  });

  group.addLayer(geoLayer);
  group.addTo(map);

  if (legendContainerId) {
    renderMapChoroplethLegend(legendContainerId, metric, provStats, isCompareMode);
  }

  return group;
}

/**
 * Render weather station markers with optional geodesic 10 km circle for selected station
 */
export function renderStationMarkers(map, stations, options = {}) {
  if (!map || !stations) return null;

  const {
    selectedStationId = null,
    selectedProvince = null,
    onSelectStation = null,
    stationStatsMap = new Map()
  } = options;

  const layerGroup = L.layerGroup();

  for (const st of stations) {
    const isSelected = st.station_id === selectedStationId;
    const isInSelectedProv = !selectedProvince || st.province === selectedProvince;
    const stat = stationStatsMap.get(st.station_id);
    const isHrdiField = st.source_type === 'HRDI Weather Station';

    if (isSelected) {
      const radiusCircle = L.circle([st.lat, st.lon], {
        radius: 10000,
        color: '#0B96B5',
        weight: 2.0,
        dashArray: '5, 5',
        fillColor: '#19C5D8',
        fillOpacity: 0.14,
        interactive: false
      });
      layerGroup.addLayer(radiusCircle);
    }

    const marker = L.circleMarker([st.lat, st.lon], {
      radius: isSelected ? 8.5 : (isInSelectedProv ? 5.8 : 4.2),
      fillColor: isSelected ? '#F97316' : (isHrdiField ? '#10B981' : '#081B2D'),
      color: '#FFFFFF',
      weight: isSelected ? 2.4 : 1.5,
      opacity: isInSelectedProv ? 1 : 0.45,
      fillOpacity: isSelected ? 0.98 : (isInSelectedProv ? 0.88 : 0.35)
    });

    const hotspot10kmText = stat && stat.hotspots10km !== undefined
      ? `<div class="tt-row"><span>จุดความร้อนในรัศมี 10 กม.:</span> <strong>${formatInt(stat.hotspots10km)} จุด</strong></div>`
      : '';

    marker.bindTooltip(`
      <div class="clean-map-tooltip">
        <div class="tt-title">สถานี${st.station_name}</div>
        <div class="tt-row"><span>ที่ตั้ง:</span> <strong>จ.${st.province} · อ.${st.district || '-'}</strong></div>
        <div class="tt-row"><span>แหล่งข้อมูล:</span> <strong>${st.source_type || 'OpenWeatherMap'}</strong></div>
        ${stat && stat.meanTemp !== null ? `<div class="tt-row"><span>อุณหภูมิเฉลี่ย:</span> <strong>${formatNum(stat.meanTemp, 1)} °C</strong></div>` : ''}
        ${stat && stat.meanRain !== null ? `<div class="tt-row"><span>ฝนสถานีเฉลี่ย:</span> <strong>${formatNum(stat.meanRain, 1)} มม.</strong></div>` : ''}
        ${hotspot10kmText}
      </div>
    `, { direction: 'top', offset: [0, -6] });

    marker.on('click', (e) => {
      L.DomEvent.stopPropagation(e);
      if (typeof onSelectStation === 'function') {
        onSelectStation(st);
      }
    });

    layerGroup.addLayer(marker);
  }

  layerGroup.addTo(map);
  return layerGroup;
}

/**
 * Convenience wrapper for rendering station markers with 10 km radius on the Overview Map
 */
export function renderStationMarkersWithRadius(map, stations, selectedStationId = null, onSelectStation = null) {
  const state = getState();
  return renderStationMarkers(map, stations, {
    selectedStationId,
    selectedProvince: state.province,
    onSelectStation
  });
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
