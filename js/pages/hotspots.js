/**
 * hotspots.js — Page 4: สำรวจจุดความร้อน (Hotspot Explorer - Q5)
 * Highland Climate & Hotspot Intelligence Platform (2022–2023)
 */

import { getState, setState } from '../state.js';
import {
  getDb,
  loadHotspotsForWindow
} from '../data-loader.js';
import {
  getFilteredHotspotCount,
  filterRawHotspotEvents
} from '../filters.js';
import {
  calculateHotspotYoY,
  formatInt
} from '../calculations.js';
import {
  initLeafletMap,
  renderHotspotLayer,
  HIGHLAND_CENTER,
  HIGHLAND_ZOOM
} from '../maps.js';
import {
  renderLineChart,
  renderBarChart,
  renderDoughnutChart,
  THAI_MONTH_NAMES
} from '../charts.js';

let hotspotMap = null;
let currentHotspotLayer = null;

/**
 * Initialize or update Page 4: Hotspot Explorer
 */
export async function renderHotspotsPage() {
  const state = getState();

  const count2022 = getFilteredHotspotCount(state, 2022);
  const count2023 = getFilteredHotspotCount(state, 2023);
  const totalCount = state.yearMode === '2022' ? count2022
    : state.yearMode === '2023' ? count2023
    : count2022 + count2023;

  renderHotspotKpis(state, count2022, count2023, totalCount);

  // 1. Render Monthly Temporal Distribution (Q5)
  renderHotspotTemporalChart(state);

  // 2. Render Land Use Distribution
  renderHotspotLanduseChart(state);

  // 3. Render Elevation & Project Distribution
  renderHotspotElevationAndProjectCharts(state);

  // 4. Render District Drilldown Ranking
  renderHotspotDistrictRanking(state);

  // 5. Render Hotspot Map with Lazy-loaded Partitions
  await renderHotspotsPointMap(state);
}

/**
 * Render Hotspot Summary KPI Cards
 */
function renderHotspotKpis(state, count2022, count2023, totalCount) {
  const totalValEl = document.getElementById('hotspots-total-kpi-val');
  const totalSubEl = document.getElementById('hotspots-total-kpi-sub');

  if (totalValEl) totalValEl.textContent = formatInt(totalCount);
  if (totalSubEl) {
    if (state.yearMode === 'compare') {
      const yoy = calculateHotspotYoY(count2022, count2023);
      const sign = yoy.diff > 0 ? '+' : '';
      const cls = yoy.diff > 0 ? 'positive' : yoy.diff < 0 ? 'negative' : 'neutral';
      totalSubEl.innerHTML = `
        <span class="kpi-delta ${cls}">YoY ${sign}${formatInt(yoy.diff)} (${yoy.pctChange ? (yoy.diff > 0 ? '+' : '') + yoy.pctChange.toFixed(1) + '%' : 'N/A'})</span>
        <span>(2022: ${formatInt(count2022)} | 2023: ${formatInt(count2023)})</span>
      `;
    } else {
      totalSubEl.textContent = `รายการตรวจพบปี ${state.yearMode} (ช่วงเดือนที่เลือก)`;
    }
  }
}

/**
 * Render Monthly Temporal Distribution Chart (Q5)
 */
function renderHotspotTemporalChart(state) {
  const db = getDb();
  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const labels = months.map(m => THAI_MONTH_NAMES[m - 1]);

  const counts2022 = months.map(m => db.hotspotProvinceMonth.reduce((sum, r) => {
    if (r.year === 2022 && r.month === m && (!state.province || r.province === state.province)) {
      return sum + (r.count || 0);
    }
    return sum;
  }, 0));

  const counts2023 = months.map(m => db.hotspotProvinceMonth.reduce((sum, r) => {
    if (r.year === 2023 && r.month === m && (!state.province || r.province === state.province)) {
      return sum + (r.count || 0);
    }
    return sum;
  }, 0));

  const datasets = [];

  if (state.yearMode === '2022' || state.yearMode === 'compare') {
    datasets.push({
      label: 'ปี 2022 (รายการ)',
      data: counts2022,
      borderColor: '#f59e0b',
      backgroundColor: 'rgba(245, 158, 11, 0.15)',
      tension: 0.3,
      fill: true,
      pointRadius: 4
    });
  }

  if (state.yearMode === '2023' || state.yearMode === 'compare') {
    datasets.push({
      label: 'ปี 2023 (รายการ)',
      data: counts2023,
      borderColor: '#ef4444',
      backgroundColor: 'rgba(239, 68, 68, 0.15)',
      tension: 0.3,
      fill: true,
      pointRadius: 4
    });
  }

  renderLineChart('hotspots-monthly-chart', {
    labels,
    datasets
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
        title: { display: true, text: 'จำนวนรายการตรวจพบดาวเทียม', color: '#94a3b8', font: { size: 11 } }
      }
    }
  });
}

/**
 * Render Land Use Breakdown (Doughnut Chart)
 */
function renderHotspotLanduseChart(state) {
  const db = getDb();
  const yearFilter = state.yearMode === 'compare' ? [2022, 2023] : [Number(state.yearMode)];
  const selectedMonths = new Set(state.selectedMonths);

  const landuseMap = new Map();
  for (const r of db.hotspotByLanduse) {
    if (!yearFilter.includes(r.year)) continue;
    if (!selectedMonths.has(r.month)) continue;
    if (state.province && r.province !== state.province) continue;

    const lu = r.landuse || 'ไม่ระบุ';
    landuseMap.set(lu, (landuseMap.get(lu) || 0) + (r.count || 0));
  }

  const sortedList = Array.from(landuseMap.entries()).sort((a, b) => b[1] - a[1]);
  const labels = sortedList.map(item => item[0]);
  const data = sortedList.map(item => item[1]);

  const palette = [
    '#059669', '#0d9488', '#0284c7', '#f59e0b',
    '#ef4444', '#8b5cf6', '#64748b', '#d97706'
  ];

  renderDoughnutChart('hotspots-landuse-chart', {
    labels,
    datasets: [{
      data,
      backgroundColor: palette.slice(0, labels.length)
    }]
  }, {
    plugins: {
      tooltip: {
        callbacks: {
          label: (context) => ` ${context.label}: ${formatInt(context.parsed)} รายการ`
        }
      }
    }
  });
}

/**
 * Render Elevation & Project Distribution
 */
function renderHotspotElevationAndProjectCharts(state) {
  const db = getDb();
  const yearFilter = state.yearMode === 'compare' ? [2022, 2023] : [Number(state.yearMode)];
  const selectedMonths = new Set(state.selectedMonths);

  let highElevCount = 0;
  let lowElevCount = 0;
  for (const r of db.hotspotByElevation) {
    if (!yearFilter.includes(r.year)) continue;
    if (!selectedMonths.has(r.month)) continue;
    if (state.province && r.province !== state.province) continue;

    if (r.elevation_category === 'สูงกว่า 500 เมตร') {
      highElevCount += r.count || 0;
    } else {
      lowElevCount += r.count || 0;
    }
  }

  renderDoughnutChart('hotspots-elevation-chart', {
    labels: ['สูงกว่า 500 ม. (พื้นที่สูง)', 'ต่ำกว่า 500 ม.'],
    datasets: [{
      data: [highElevCount, lowElevCount],
      backgroundColor: ['#0d9488', '#475569']
    }]
  }, {
    plugins: {
      tooltip: {
        callbacks: {
          label: (context) => ` ${context.label}: ${formatInt(context.parsed)} รายการ`
        }
      }
    }
  });

  let inProjectCount = 0;
  let outsideProjectCount = 0;
  for (const r of db.hotspotByProject) {
    if (!yearFilter.includes(r.year)) continue;
    if (!selectedMonths.has(r.month)) continue;
    if (state.province && r.province !== state.province) continue;

    if (r.project_category === 'นอกพื้นที่ดำเนินงาน') {
      outsideProjectCount += r.count || 0;
    } else {
      inProjectCount += r.count || 0;
    }
  }

  renderDoughnutChart('hotspots-project-chart', {
    labels: ['นอกพื้นที่โครงการ', 'ในพื้นที่โครงการ HRDI'],
    datasets: [{
      data: [outsideProjectCount, inProjectCount],
      backgroundColor: ['#f59e0b', '#06b6d4']
    }]
  }, {
    plugins: {
      tooltip: {
        callbacks: {
          label: (context) => ` ${context.label}: ${formatInt(context.parsed)} รายการ`
        }
      }
    }
  });
}

/**
 * Render District Drilldown Ranking (Top 12 Districts)
 */
function renderHotspotDistrictRanking(state) {
  const db = getDb();
  const yearFilter = state.yearMode === 'compare' ? [2022, 2023] : [Number(state.yearMode)];
  const selectedMonths = new Set(state.selectedMonths);

  const districtMap = new Map();
  for (const r of db.hotspotDistrictMonth) {
    if (!yearFilter.includes(r.year)) continue;
    if (!selectedMonths.has(r.month)) continue;
    if (state.province && r.province !== state.province) continue;

    const key = `${r.district} (${r.province})`;
    districtMap.set(key, (districtMap.get(key) || 0) + (r.count || 0));
  }

  const sorted = Array.from(districtMap.entries()).sort((a, b) => b[1] - a[1]);
  const topList = sorted.slice(0, 12);
  const labels = topList.map((item, i) => `${i + 1}. ${item[0]}`);
  const data = topList.map(item => item[1]);

  renderBarChart('hotspots-district-ranking-chart', {
    labels,
    datasets: [{
      label: 'จำนวนรายการตรวจพบจุดความร้อน',
      data,
      backgroundColor: '#ef4444',
      borderRadius: 4
    }]
  }, {
    indexAxis: 'y',
    onClick: (evt, elements) => {
      if (elements && elements.length > 0) {
        const idx = elements[0].index;
        const rawLabel = labels[idx];
        const match = rawLabel.match(/^\d+\.\s*(.*)\s\((.*)\)$/);
        if (match) {
          const districtName = match[1];
          const provinceName = match[2];
          setState({ province: provinceName, district: districtName });
        }
      }
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: (context) => ` ${formatInt(context.parsed.x)} รายการ`
        }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'จำนวนรายการตรวจพบดาวเทียม (คลิกเพื่อเลือกอำเภอ)',
          color: '#94a3b8',
          font: { size: 11 }
        }
      }
    }
  });
}

/**
 * Render Hotspot Point/Cluster Map with Lazy Partition Loading
 */
async function renderHotspotsPointMap(state) {
  if (!hotspotMap) {
    hotspotMap = initLeafletMap('hotspots-map-container');
  }
  if (!hotspotMap) return;

  const statusEl = document.getElementById('hotspots-map-loading-indicator');
  if (statusEl) statusEl.style.display = 'block';

  try {
    const yearsToLoad = state.yearMode === 'compare' ? [2022, 2023] : [Number(state.yearMode)];
    const rawEvents = await loadHotspotsForWindow(yearsToLoad, state.selectedMonths);
    const filteredEvents = filterRawHotspotEvents(rawEvents, state);

    if (currentHotspotLayer) {
      hotspotMap.removeLayer(currentHotspotLayer);
    }
    currentHotspotLayer = renderHotspotLayer(hotspotMap, filteredEvents);

    const countStatusEl = document.getElementById('hotspots-map-count-badge');
    if (countStatusEl) {
      countStatusEl.textContent = `แสดง ${formatInt(filteredEvents.length)} จุดความร้อนบนแผนที่`;
    }
  } catch (err) {
    console.error('Error loading hotspot points for map:', err);
  } finally {
    if (statusEl) statusEl.style.display = 'none';
  }
}
