/**
 * overview.js — Page 1: Overview Dashboard (Q1, Q5, Q9)
 * Highland Climate & Hotspot Interactive Dashboard (2022–2023)
 */

import { getState, setState } from '../state.js';
import { getDb, getStations } from '../data-loader.js';
import {
  filterStationMonthRecords,
  filterHiiRecords,
  getFilteredHotspotCount
} from '../filters.js';
import {
  calculateMean,
  calculateFairHrdiYoY,
  calculateHotspotYoY,
  formatNum,
  formatInt
} from '../calculations.js';
import { initLeafletMap, renderStationMarkers } from '../maps.js';
import {
  renderLineChart,
  renderBarChart,
  THAI_MONTH_NAMES
} from '../charts.js';

let overviewMap = null;
let stationLayer = null;

/**
 * Initialize or update Page 1: Overview
 */
export function renderOverviewPage() {
  const state = getState();
  const db = getDb();

  // 1. Filter HRDI station-month records
  const hrdi2022 = filterStationMonthRecords(db.stationMonthDashboard, state, 2022);
  const hrdi2023 = filterStationMonthRecords(db.stationMonthDashboard, state, 2023);
  const hrdiAll = filterStationMonthRecords(db.stationMonthDashboard, state);

  // 2. Hotspot totals
  const hotspots2022 = getFilteredHotspotCount(state, 2022);
  const hotspots2023 = getFilteredHotspotCount(state, 2023);
  const hotspotTotal = state.yearMode === '2022' ? hotspots2022
    : state.yearMode === '2023' ? hotspots2023
    : hotspots2022 + hotspots2023;

  // 3. Render KPI Cards
  renderOverviewKpis(state, hrdi2022, hrdi2023, hrdiAll, hotspots2022, hotspots2023, hotspotTotal);

  // 4. Render Overview Map with Station Pins
  renderOverviewMap(state);

  // 5. Render Trend Charts (Q1 & Q5)
  renderOverviewMonthlyTrends(state, hrdi2022, hrdi2023);

  // 6. Render Province Ranking Chart (Q5)
  renderOverviewProvinceRanking(state);
}

/**
 * Render the 6 KPI Cards on Overview Page
 */
function renderOverviewKpis(state, hrdi2022, hrdi2023, hrdiAll, hotspots2022, hotspots2023, hotspotTotal) {
  const db = getDb();
  const stations = db.stations.filter(s => {
    if (state.province && s.province !== state.province) return false;
    if (state.district && s.district !== state.district) return false;
    if (state.stationId && s.station_id !== state.stationId) return false;
    return true;
  });

  // Station count KPI
  const kpiStationsVal = document.getElementById('kpi-stations-val');
  const kpiStationsSub = document.getElementById('kpi-stations-sub');
  if (kpiStationsVal) kpiStationsVal.textContent = stations.length;
  if (kpiStationsSub) kpiStationsSub.textContent = `จากทั้งหมด 50 สถานี HRDI (${state.province || '9 จังหวัด'})`;

  // Observed records count KPI
  const kpiRecordsVal = document.getElementById('kpi-records-val');
  const kpiRecordsSub = document.getElementById('kpi-records-sub');
  if (kpiRecordsVal) kpiRecordsVal.textContent = formatInt(hrdiAll.length);
  if (kpiRecordsSub) {
    if (state.yearMode === 'compare') {
      kpiRecordsSub.textContent = `2022: ${hrdi2022.length} แถว | 2023: ${hrdi2023.length} แถว`;
    } else {
      kpiRecordsSub.textContent = `ปี ${state.yearMode} (ช่วงเดือนที่เลือก)`;
    }
  }

  // Mean Temperature KPI with fair paired YoY
  const kpiTempVal = document.getElementById('kpi-temp-val');
  const kpiTempSub = document.getElementById('kpi-temp-sub');
  const tempStats = calculateMean(hrdiAll, 'temp');
  if (kpiTempVal) {
    kpiTempVal.textContent = formatNum(tempStats.mean, 1);
  }
  if (kpiTempSub) {
    if (state.yearMode === 'compare') {
      const tempYoY = calculateFairHrdiYoY(hrdi2022, hrdi2023, 'temp');
      if (tempYoY.nPairs > 0) {
        const sign = tempYoY.diff > 0 ? '+' : '';
        const deltaClass = tempYoY.diff > 0 ? 'positive' : tempYoY.diff < 0 ? 'negative' : 'neutral';
        kpiTempSub.innerHTML = `
          <span class="kpi-delta ${deltaClass}">YoY ${sign}${tempYoY.diff.toFixed(1)}°C (${tempYoY.pctChange ? (tempYoY.diff > 0 ? '+' : '') + tempYoY.pctChange.toFixed(1) + '%' : 'N/A'})</span>
          <span>(N = ${tempYoY.nPairs} คู่สถานี)</span>
        `;
      } else {
        kpiTempSub.textContent = tempYoY.note;
      }
    } else {
      kpiTempSub.textContent = `คำนวณจาก ${tempStats.count} ค่าตรวจวัดจริง`;
    }
  }

  // Mean Monthly Station Rainfall KPI
  const kpiRainVal = document.getElementById('kpi-rain-val');
  const kpiRainSub = document.getElementById('kpi-rain-sub');
  const rainStats = calculateMean(hrdiAll, 'rainfall');
  if (kpiRainVal) {
    kpiRainVal.textContent = formatNum(rainStats.mean, 1);
  }
  if (kpiRainSub) {
    if (state.yearMode === 'compare') {
      const rainYoY = calculateFairHrdiYoY(hrdi2022, hrdi2023, 'rainfall');
      if (rainYoY.nPairs > 0) {
        const sign = rainYoY.diff > 0 ? '+' : '';
        const deltaClass = rainYoY.diff > 0 ? 'positive' : rainYoY.diff < 0 ? 'negative' : 'neutral';
        kpiRainSub.innerHTML = `
          <span class="kpi-delta ${deltaClass}">YoY ${sign}${rainYoY.diff.toFixed(1)} มม. (${rainYoY.pctChange ? (rainYoY.diff > 0 ? '+' : '') + rainYoY.pctChange.toFixed(1) + '%' : 'N/A'})</span>
          <span>(เฉลี่ยต่อสถานีที่รายงาน)</span>
        `;
      } else {
        kpiRainSub.textContent = rainYoY.note;
      }
    } else {
      kpiRainSub.textContent = `ค่าเฉลี่ยต่อสถานีที่รายงาน (${rainStats.count} รายการ)`;
    }
  }

  // Satellite Hotspot Detections KPI
  const kpiHotspotVal = document.getElementById('kpi-hotspot-val');
  const kpiHotspotSub = document.getElementById('kpi-hotspot-sub');
  if (kpiHotspotVal) {
    kpiHotspotVal.textContent = formatInt(hotspotTotal);
  }
  if (kpiHotspotSub) {
    if (state.yearMode === 'compare') {
      const hsYoY = calculateHotspotYoY(hotspots2022, hotspots2023);
      const sign = hsYoY.diff > 0 ? '+' : '';
      const deltaClass = hsYoY.diff > 0 ? 'positive' : hsYoY.diff < 0 ? 'negative' : 'neutral';
      kpiHotspotSub.innerHTML = `
        <span class="kpi-delta ${deltaClass}">YoY ${sign}${formatInt(hsYoY.diff)} จุด (${hsYoY.pctChange ? (hsYoY.diff > 0 ? '+' : '') + hsYoY.pctChange.toFixed(1) + '%' : 'N/A'})</span>
        <span>(รายการตรวจพบดาวเทียม)</span>
      `;
    } else {
      kpiHotspotSub.textContent = 'รายการตรวจพบดาวเทียม (ไม่นับเป็นเหตุไฟป่ายืนยัน)';
    }
  }

  // Provinces Represented KPI
  const kpiProvincesVal = document.getElementById('kpi-provinces-val');
  const kpiProvincesSub = document.getElementById('kpi-provinces-sub');
  const activeProvinces = new Set(hrdiAll.map(r => r.province));
  if (kpiProvincesVal) {
    kpiProvincesVal.textContent = state.province ? '1' : `${activeProvinces.size}/9`;
  }
  if (kpiProvincesSub) {
    kpiProvincesSub.textContent = state.province ? `จังหวัด${state.province}` : 'ครอบคลุม 9 จังหวัดพื้นที่สูง';
  }
}

/**
 * Render Overview Leaflet Map
 */
function renderOverviewMap(state) {
  if (!overviewMap) {
    overviewMap = initLeafletMap('overview-map-container');
  }
  if (!overviewMap) return;

  // Clear previous layer
  if (stationLayer) {
    overviewMap.removeLayer(stationLayer);
  }

  const db = getDb();
  stationLayer = renderStationMarkers(overviewMap, db.stations, state.stationId, (station) => {
    setState({
      stationId: station.station_id,
      province: station.province,
      district: station.district
    });
  });

  // Fit bounds if specific province or station selected
  if (state.stationId) {
    const s = db.stations.find(st => st.station_id === state.stationId);
    if (s && s.lat && s.lon) {
      overviewMap.setView([s.lat, s.lon], 11);
    }
  } else if (state.province) {
    const provStations = db.stations.filter(st => st.province === state.province);
    if (provStations.length > 0) {
      const bounds = L.latLngBounds(provStations.map(st => [st.lat, st.lon]));
      overviewMap.fitBounds(bounds, { padding: [40, 40], maxZoom: 10 });
    }
  }
}

/**
 * Render Monthly Trends for Overview (Q1 & Q5)
 */
function renderOverviewMonthlyTrends(state, hrdi2022, hrdi2023) {
  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const labels = months.map(m => THAI_MONTH_NAMES[m - 1]);

  // Aggregate monthly temp for 2022 and 2023
  const tempByMonth2022 = months.map(m => {
    const list = hrdi2022.filter(r => r.month === m);
    return calculateMean(list, 'temp').mean;
  });

  const tempByMonth2023 = months.map(m => {
    const list = hrdi2023.filter(r => r.month === m);
    return calculateMean(list, 'temp').mean;
  });

  // Aggregate monthly hotspots from db.hotspotProvinceMonth
  const db = getDb();
  const hsByMonth2022 = months.map(m => {
    return db.hotspotProvinceMonth.reduce((sum, r) => {
      if (r.year === 2022 && r.month === m) {
        if (!state.province || r.province === state.province) {
          return sum + (r.count || 0);
        }
      }
      return sum;
    }, 0);
  });

  const hsByMonth2023 = months.map(m => {
    return db.hotspotProvinceMonth.reduce((sum, r) => {
      if (r.year === 2023 && r.month === m) {
        if (!state.province || r.province === state.province) {
          return sum + (r.count || 0);
        }
      }
      return sum;
    }, 0);
  });

  // Chart 1: Temperature Trend (Q1)
  const datasetsTemp = [];
  if (state.yearMode === '2022' || state.yearMode === 'compare') {
    datasetsTemp.push({
      label: 'อุณหภูมิเฉลี่ย 2022 (°C)',
      data: tempByMonth2022,
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      tension: 0.3,
      spanGaps: false,
      pointRadius: 4
    });
  }
  if (state.yearMode === '2023' || state.yearMode === 'compare') {
    datasetsTemp.push({
      label: 'อุณหภูมิเฉลี่ย 2023 (°C)',
      data: tempByMonth2023,
      borderColor: '#0d9488',
      backgroundColor: 'rgba(13, 148, 136, 0.1)',
      tension: 0.3,
      spanGaps: false,
      pointRadius: 4
    });
  }

  renderLineChart('overview-temp-trend-chart', {
    labels,
    datasets: datasetsTemp
  }, {
    plugins: {
      tooltip: {
        callbacks: {
          label: (context) => ` ${context.dataset.label}: ${context.parsed.y !== null ? context.parsed.y.toFixed(1) + ' °C' : 'ไม่มีข้อมูล'}`
        }
      }
    },
    scales: {
      y: {
        title: { display: true, text: 'อุณหภูมิ (°C)', font: { size: 11 } }
      }
    }
  });

  // Chart 2: Hotspot Trend (Q5)
  const datasetsHs = [];
  if (state.yearMode === '2022' || state.yearMode === 'compare') {
    datasetsHs.push({
      label: 'จุดความร้อน 2022 (รายการ)',
      data: hsByMonth2022,
      borderColor: '#f59e0b',
      backgroundColor: 'rgba(245, 158, 11, 0.15)',
      tension: 0.3,
      spanGaps: false,
      pointRadius: 4,
      fill: true
    });
  }
  if (state.yearMode === '2023' || state.yearMode === 'compare') {
    datasetsHs.push({
      label: 'จุดความร้อน 2023 (รายการ)',
      data: hsByMonth2023,
      borderColor: '#e11d48',
      backgroundColor: 'rgba(225, 29, 72, 0.15)',
      tension: 0.3,
      spanGaps: false,
      pointRadius: 4,
      fill: true
    });
  }

  renderLineChart('overview-hotspot-trend-chart', {
    labels,
    datasets: datasetsHs
  }, {
    plugins: {
      tooltip: {
        callbacks: {
          label: (context) => ` ${context.dataset.label}: ${formatInt(context.parsed.y)} รายการ`
        }
      }
    },
    scales: {
      y: {
        title: { display: true, text: 'จำนวนรายการตรวจพบ', font: { size: 11 } }
      }
    }
  });
}

/**
 * Render Province Hotspot Ranking Bar Chart (Q5/Q9)
 */
function renderOverviewProvinceRanking(state) {
  const db = getDb();
  const provinces = db.config?.provinces || [
    'กาญจนบุรี', 'กำแพงเพชร', 'ตาก', 'น่าน', 'พิษณุโลก',
    'เชียงราย', 'เชียงใหม่', 'เพชรบูรณ์', 'แม่ฮ่องสอน'
  ];

  const selectedMonths = new Set(state.selectedMonths);

  // Compute total hotspots per province for 2022 and 2023
  const provData = provinces.map(prov => {
    let count2022 = 0;
    let count2023 = 0;

    for (const r of db.hotspotProvinceMonth) {
      if (r.province === prov && selectedMonths.has(r.month)) {
        if (r.year === 2022) count2022 += r.count || 0;
        if (r.year === 2023) count2023 += r.count || 0;
      }
    }

    return {
      province: prov,
      count2022,
      count2023,
      total: state.yearMode === '2022' ? count2022
        : state.yearMode === '2023' ? count2023
        : count2022 + count2023
    };
  });

  // Sort descending by total
  provData.sort((a, b) => b.total - a.total);

  const labels = provData.map(d => d.province);
  const datasets = [];

  if (state.yearMode === '2022' || state.yearMode === 'compare') {
    datasets.push({
      label: 'ปี 2022',
      data: provData.map(d => d.count2022),
      backgroundColor: '#3b82f6',
      borderRadius: 4
    });
  }
  if (state.yearMode === '2023' || state.yearMode === 'compare') {
    datasets.push({
      label: 'ปี 2023',
      data: provData.map(d => d.count2023),
      backgroundColor: '#e11d48',
      borderRadius: 4
    });
  }

  const chart = renderBarChart('overview-province-ranking-chart', {
    labels,
    datasets
  }, {
    indexAxis: 'y', // Horizontal bars
    onClick: (evt, elements) => {
      if (elements && elements.length > 0) {
        const idx = elements[0].index;
        const clickedProvince = labels[idx];
        setState({ province: clickedProvince });
      }
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: (context) => ` ${context.dataset.label}: ${formatInt(context.parsed.x)} รายการ`
        }
      }
    },
    scales: {
      x: {
        title: { display: true, text: 'จำนวนจุดความร้อนดาวเทียม (คลิกแท่งเพื่อกรอง)', font: { size: 11 } }
      }
    }
  });
}
