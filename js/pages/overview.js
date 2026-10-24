/**
 * overview.js — Page 1: ภาพรวมพื้นที่ศึกษา (Overview - Q1, Q5, Q9)
 * Highland Climate & Hotspot Intelligence Platform (2022–2023)
 */

import { getState, setState } from '../state.js';
import { getDb, getThailandGeoJson } from '../data-loader.js';
import {
  filterStationMonthRecords,
  filterHiiRecords,
  getFilteredHotspotCount,
  STUDY_PROVINCES
} from '../filters.js';
import {
  calculateMean,
  calculateFairHrdiYoY,
  calculateHotspotYoY,
  formatNum,
  formatInt
} from '../calculations.js';
import {
  initLeafletMap,
  renderThailandProvinceMap,
  renderStationMarkersWithRadius,
  setupMapSwipeComparison,
  THAILAND_CENTER,
  THAILAND_ZOOM,
  HIGHLAND_CENTER,
  HIGHLAND_ZOOM
} from '../maps.js';
import {
  renderLineChart,
  renderBarChart,
  THAI_MONTH_NAMES
} from '../charts.js';

let overviewMap = null;
let currentGeoLayer = null;
let currentStationLayer = null;
let currentSwipeCtrl = null;

/**
 * Initialize or update Page 1: Overview
 */
export function renderOverviewPage() {
  const state = getState();
  const db = getDb();

  // Filter HRDI records
  const hrdi2022 = filterStationMonthRecords(db.stationMonthDashboard, state, 2022);
  const hrdi2023 = filterStationMonthRecords(db.stationMonthDashboard, state, 2023);
  const hrdiAll = filterStationMonthRecords(db.stationMonthDashboard, state);

  // Hotspot totals
  const hotspots2022 = getFilteredHotspotCount(state, 2022);
  const hotspots2023 = getFilteredHotspotCount(state, 2023);
  const hotspotTotal = state.yearMode === '2022' ? hotspots2022
    : state.yearMode === '2023' ? hotspots2023
    : hotspots2022 + hotspots2023;

  // 1. Render 5 KPI Cards (Matching Reference Screenshot)
  renderOverviewKpis(state, hrdi2022, hrdi2023, hrdiAll, hotspots2022, hotspots2023, hotspotTotal);

  // 2. Render Full 77-Province Thailand Map with 9 Study Provinces & Swipe
  renderOverviewMap(state);

  // 3. Render Province Docked Detail Panel (if province selected)
  renderProvinceDockedPanel(state);

  // 4. Render Monthly Trend Chart with Metric Switcher (Q1 / Q5)
  renderOverviewMonthlyTrends(state, hrdi2022, hrdi2023);

  // 5. Render Province Ranking Horizontal Bar Chart (Q5)
  renderOverviewProvinceRanking(state);

  // 6. Render Data Distribution Chart (Q2 / Reference bottom-right card)
  renderOverviewDistributionChart(state);
}

/**
 * Render 5 KPI Cards matching reference design
 */
function renderOverviewKpis(state, hrdi2022, hrdi2023, hrdiAll, hotspots2022, hotspots2023, hotspotTotal) {
  const db = getDb();

  // 1. Mean Temperature
  const tempStats = calculateMean(hrdiAll, 'temp');
  const kpiTempVal = document.getElementById('kpi-temp-val');
  const kpiTempSub = document.getElementById('kpi-temp-sub');
  if (kpiTempVal) kpiTempVal.textContent = formatNum(tempStats.mean, 1);
  if (kpiTempSub) {
    if (state.yearMode === 'compare') {
      const yoy = calculateFairHrdiYoY(hrdi2022, hrdi2023, 'temp');
      const sign = yoy.diff > 0 ? '+' : '';
      const cls = yoy.diff > 0 ? 'positive' : yoy.diff < 0 ? 'negative' : 'neutral';
      kpiTempSub.innerHTML = `<span class="kpi-delta ${cls}">${sign}${yoy.diff ? yoy.diff.toFixed(1) : 'N/A'} °C</span> vs 2022 (${yoy.nPairs} คู่สถานี)`;
    } else {
      kpiTempSub.textContent = `คำนวณจาก ${tempStats.count} ค่าตรวจวัดจริง`;
    }
  }

  // 2. Mean Humidity
  const humStats = calculateMean(hrdiAll, 'humidity');
  const kpiHumVal = document.getElementById('kpi-humidity-val');
  const kpiHumSub = document.getElementById('kpi-humidity-sub');
  if (kpiHumVal) kpiHumVal.textContent = formatNum(humStats.mean, 1);
  if (kpiHumSub) {
    if (state.yearMode === 'compare') {
      const yoy = calculateFairHrdiYoY(hrdi2022, hrdi2023, 'humidity');
      const sign = yoy.diff > 0 ? '+' : '';
      const cls = yoy.diff > 0 ? 'negative' : yoy.diff < 0 ? 'positive' : 'neutral';
      kpiHumSub.innerHTML = `<span class="kpi-delta ${cls}">${sign}${yoy.diff ? yoy.diff.toFixed(1) : 'N/A'} %</span> vs 2022`;
    } else {
      kpiHumSub.textContent = 'ความชื้นสัมพัทธ์เฉลี่ย';
    }
  }

  // 3. Mean Rainfall
  const rainStats = calculateMean(hrdiAll, 'rainfall');
  const kpiRainVal = document.getElementById('kpi-rainfall-val');
  const kpiRainSub = document.getElementById('kpi-rainfall-sub');
  if (kpiRainVal) kpiRainVal.textContent = formatNum(rainStats.mean, 1);
  if (kpiRainSub) {
    if (state.yearMode === 'compare') {
      const yoy = calculateFairHrdiYoY(hrdi2022, hrdi2023, 'rainfall');
      const sign = yoy.diff > 0 ? '+' : '';
      const cls = yoy.diff > 0 ? 'negative' : yoy.diff < 0 ? 'positive' : 'neutral';
      kpiRainSub.innerHTML = `<span class="kpi-delta ${cls}">${sign}${yoy.diff ? yoy.diff.toFixed(1) : 'N/A'} มม.</span> vs 2022`;
    } else {
      kpiRainSub.textContent = 'เฉลี่ยต่อสถานีที่รายงาน';
    }
  }

  // 4. Hotspots Total
  const kpiHsVal = document.getElementById('kpi-hotspots-val');
  const kpiHsSub = document.getElementById('kpi-hotspots-sub');
  if (kpiHsVal) kpiHsVal.textContent = formatInt(hotspotTotal);
  if (kpiHsSub) {
    if (state.yearMode === 'compare') {
      const yoy = calculateHotspotYoY(hotspots2022, hotspots2023);
      const sign = yoy.diff > 0 ? '+' : '';
      const cls = yoy.diff > 0 ? 'positive' : yoy.diff < 0 ? 'negative' : 'neutral';
      kpiHsSub.innerHTML = `<span class="kpi-delta ${cls}">${sign}${formatInt(yoy.diff)}</span> (${yoy.pctChange ? (yoy.diff > 0 ? '+' : '') + yoy.pctChange.toFixed(1) + '%' : 'N/A'})`;
    } else {
      kpiHsSub.textContent = 'รายการตรวจพบดาวเทียม VIIRS';
    }
  }

  // 5. Provinces Count
  const kpiProvVal = document.getElementById('kpi-provinces-val');
  const kpiProvSub = document.getElementById('kpi-provinces-sub');
  if (kpiProvVal) {
    kpiProvVal.textContent = state.province ? '1' : '9';
  }
  if (kpiProvSub) {
    kpiProvSub.textContent = state.province ? `จังหวัด${state.province}` : 'จังหวัดพื้นที่ศึกษา';
  }
}

/**
 * Render Interactive Full 77-Province Thailand Map with Swipe Comparison
 */
function renderOverviewMap(state) {
  if (!overviewMap) {
    overviewMap = initLeafletMap('overview-map-container');
  }
  if (!overviewMap) return;

  const db = getDb();

  // Clear previous layers
  if (currentGeoLayer) overviewMap.removeLayer(currentGeoLayer);
  if (currentStationLayer) overviewMap.removeLayer(currentStationLayer);
  if (currentSwipeCtrl) {
    currentSwipeCtrl.destroy();
    currentSwipeCtrl = null;
  }

  // Determine if in swipe comparison mode
  const isSwipeMode = state.yearMode === 'compare' && !state.province;
  const swipeContainer = document.getElementById('overview-map-swipe-badges');
  if (swipeContainer) {
    swipeContainer.style.display = isSwipeMode ? 'flex' : 'none';
  }

  // Render 77-province GeoJSON base
  currentGeoLayer = renderThailandProvinceMap(overviewMap, {
    metric: state.swipeMetric || 'temp',
    onSelectProvince: (provName) => {
      setState({ province: provName });
    }
  });

  // Filter stations based on province/district selection
  const visibleStations = db.stations.filter(s => {
    if (state.province && s.province !== state.province) return false;
    if (state.district && s.district !== state.district) return false;
    return true;
  });

  // Render station pins with 10 km radius circle
  currentStationLayer = renderStationMarkersWithRadius(
    overviewMap,
    visibleStations,
    state.stationId,
    (st) => {
      setState({ stationId: st.station_id, province: st.province, district: st.district });
    }
  );

  // Setup Before/After Swipe Divider if in Compare mode
  if (isSwipeMode) {
    const leftPane = overviewMap.createPane('leftPane');
    const rightPane = overviewMap.createPane('rightPane');
    leftPane.style.zIndex = 450;
    rightPane.style.zIndex = 450;

    const layer2022 = renderThailandProvinceMap(overviewMap, {
      metric: state.swipeMetric || 'temp',
      year: 2022,
      pane: 'leftPane'
    });

    const layer2023 = renderThailandProvinceMap(overviewMap, {
      metric: state.swipeMetric || 'temp',
      year: 2023,
      pane: 'rightPane'
    });

    currentSwipeCtrl = setupMapSwipeComparison('overview-map-container', overviewMap, layer2022, layer2023);
  }

  // Zoom to province if selected
  if (state.province) {
    const provStations = db.stations.filter(s => s.province === state.province);
    if (provStations.length > 0) {
      const bounds = L.latLngBounds(provStations.map(s => [s.lat, s.lon]));
      overviewMap.fitBounds(bounds, { padding: [40, 40], maxZoom: 10 });
    }
  } else {
    overviewMap.setView(HIGHLAND_CENTER, HIGHLAND_ZOOM);
  }
}

/**
 * Render Province Detail Panel docked on the map
 */
function renderProvinceDockedPanel(state) {
  const panel = document.getElementById('overview-province-docked-panel');
  if (!panel) return;

  if (!state.province) {
    panel.classList.remove('active');
    return;
  }

  const db = getDb();
  const prov = state.province;
  const stations = db.stations.filter(s => s.province === prov);

  const hrdiRows = db.hrdiStationMonth.filter(r =>
    r.province === prov &&
    (state.yearMode === 'compare' ? [2022, 2023] : [Number(state.yearMode)]).includes(r.year) &&
    state.selectedMonths.includes(r.month)
  );
  const tempStats = calculateMean(hrdiRows, 'temp');
  const rainStats = calculateMean(hrdiRows, 'rainfall');
  const humStats = calculateMean(hrdiRows, 'humidity');

  const hiiRows = db.hiiProvinceMonth.filter(r =>
    r.province === prov &&
    (state.yearMode === 'compare' ? [2022, 2023] : [Number(state.yearMode)]).includes(r.year) &&
    state.selectedMonths.includes(r.month)
  );
  const hiiStats = calculateMean(hiiRows, 'hii_avg_rain');

  const hsCount = db.hotspotProvinceMonth.reduce((sum, r) => {
    if (
      r.province === prov &&
      (state.yearMode === 'compare' ? [2022, 2023] : [Number(state.yearMode)]).includes(r.year) &&
      state.selectedMonths.includes(r.month)
    ) {
      return sum + (r.count || 0);
    }
    return sum;
  }, 0);

  panel.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.5rem; margin-bottom: 0.75rem;">
      <div>
        <span style="font-size: 0.72rem; color: #22d3ee; font-weight: 700; text-transform: uppercase;">พื้นที่ศึกษา</span>
        <h3 style="font-size: 1.1rem; color: #ffffff; margin-top: 2px;">จังหวัด${prov}</h3>
      </div>
      <button class="panel-close-btn" onclick="window.clearProvinceSelection()" title="ปิดหน้าต่าง">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </div>

    <div style="font-size: 0.8rem; line-height: 1.5; color: #cbd5e1; margin-bottom: 0.75rem;">
      <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
        <span>สถานีตรวจวัด HRDI:</span>
        <strong style="color: #22d3ee;">${stations.length} สถานี</strong>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
        <span>อุณหภูมิเฉลี่ย:</span>
        <strong>${formatNum(tempStats.mean, 1)} °C</strong>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
        <span>ความชื้นสัมพัทธ์:</span>
        <strong>${formatNum(humStats.mean, 1)} %</strong>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
        <span>ฝนสถานี HRDI:</span>
        <strong>${formatNum(rainStats.mean, 1)} มม.</strong>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
        <span>ฝนจังหวัด HII:</span>
        <strong style="color: #7dd3fc;">${formatNum(hiiStats.mean, 1)} มม.</strong>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
        <span>จุดความร้อนดาวเทียม:</span>
        <strong style="color: #f87171;">${formatInt(hsCount)} รายการ</strong>
      </div>
    </div>

    <div style="margin-bottom: 0.75rem;">
      <div style="font-size: 0.76rem; font-weight: 700; color: #94a3b8; margin-bottom: 0.35rem;">รายชื่อสถานีในจังหวัด (${stations.length} แห่ง):</div>
      <div style="max-height: 120px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px;">
        ${stations.map(s => `
          <button onclick="window.selectStation('${s.station_id}', '${s.province}')" style="
            text-align: left;
            padding: 4px 8px;
            background: ${state.stationId === s.station_id ? 'rgba(6, 182, 212, 0.3)' : 'rgba(255,255,255,0.06)'};
            border: 1px solid ${state.stationId === s.station_id ? '#22d3ee' : 'rgba(255,255,255,0.1)'};
            border-radius: 4px;
            color: #ffffff;
            font-size: 0.74rem;
            cursor: pointer;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          ">
            ${s.station_name}
          </button>
        `).join('')}
      </div>
    </div>

    <button onclick="window.clearProvinceSelection()" style="
      width: 100%;
      padding: 6px;
      background: rgba(6, 182, 212, 0.2);
      border: 1px solid rgba(6, 182, 212, 0.4);
      color: #22d3ee;
      font-weight: 700;
      font-size: 0.78rem;
      border-radius: 4px;
      cursor: pointer;
      margin-top: auto;
    ">
      ย้อนกลับภาพรวม 9 จังหวัด
    </button>
  `;

  panel.classList.add('active');
}

/**
 * Render Monthly Trends with Metric Selector Tabs (Q1 & Q5)
 */
function renderOverviewMonthlyTrends(state, hrdi2022, hrdi2023) {
  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const labels = months.map(m => THAI_MONTH_NAMES[m - 1]);
  const currentMetric = state.overviewMetricTab || 'temp';

  const db = getDb();
  let vals2022 = [];
  let vals2023 = [];
  let unitText = '°C';
  let metricLabel = 'อุณหภูมิ';

  if (currentMetric === 'temp') {
    metricLabel = 'อุณหภูมิเฉลี่ย';
    unitText = '°C';
    vals2022 = months.map(m => calculateMean(hrdi2022.filter(r => r.month === m), 'temp').mean);
    vals2023 = months.map(m => calculateMean(hrdi2023.filter(r => r.month === m), 'temp').mean);
  } else if (currentMetric === 'humidity') {
    metricLabel = 'ความชื้นสัมพัทธ์';
    unitText = '%';
    vals2022 = months.map(m => calculateMean(hrdi2022.filter(r => r.month === m), 'humidity').mean);
    vals2023 = months.map(m => calculateMean(hrdi2023.filter(r => r.month === m), 'humidity').mean);
  } else if (currentMetric === 'rainfall') {
    metricLabel = 'ปริมาณน้ำฝน';
    unitText = 'มม.';
    vals2022 = months.map(m => calculateMean(hrdi2022.filter(r => r.month === m), 'rainfall').mean);
    vals2023 = months.map(m => calculateMean(hrdi2023.filter(r => r.month === m), 'rainfall').mean);
  } else if (currentMetric === 'hotspots') {
    metricLabel = 'จุดความร้อนดาวเทียม';
    unitText = 'รายการ';
    vals2022 = months.map(m => db.hotspotProvinceMonth.reduce((sum, r) => {
      if (r.year === 2022 && r.month === m && (!state.province || r.province === state.province)) {
        return sum + (r.count || 0);
      }
      return sum;
    }, 0));
    vals2023 = months.map(m => db.hotspotProvinceMonth.reduce((sum, r) => {
      if (r.year === 2023 && r.month === m && (!state.province || r.province === state.province)) {
        return sum + (r.count || 0);
      }
      return sum;
    }, 0));
  }

  const datasets = [];
  if (state.yearMode === '2022' || state.yearMode === 'compare') {
    datasets.push({
      label: `2022 (${metricLabel})`,
      data: vals2022,
      borderColor: '#f59e0b',
      backgroundColor: 'rgba(245, 158, 11, 0.1)',
      borderWidth: 2,
      pointRadius: 4,
      tension: 0.3,
      spanGaps: false
    });
  }
  if (state.yearMode === '2023' || state.yearMode === 'compare') {
    datasets.push({
      label: `2023 (${metricLabel})`,
      data: vals2023,
      borderColor: '#06b6d4',
      backgroundColor: 'rgba(6, 182, 212, 0.1)',
      borderWidth: 2,
      pointRadius: 4,
      tension: 0.3,
      spanGaps: false
    });
  }

  renderLineChart('overview-monthly-trend-chart', {
    labels,
    datasets
  }, {
    plugins: {
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y !== null ? (currentMetric === 'hotspots' ? formatInt(ctx.parsed.y) : ctx.parsed.y.toFixed(1)) + ' ' + unitText : 'ไม่มีข้อมูล'}`
        }
      }
    },
    scales: {
      y: {
        title: { display: true, text: `${metricLabel} (${unitText})`, color: '#94a3b8', font: { size: 11 } }
      }
    }
  });
}

/**
 * Render Province Hotspot Ranking Bar Chart (Q5/Q9)
 */
function renderOverviewProvinceRanking(state) {
  const db = getDb();
  const selectedMonths = new Set(state.selectedMonths);

  const provData = STUDY_PROVINCES.map(prov => {
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

  const labels = provData.map((d, i) => `${i + 1}. ${d.province}`);
  const datasets = [];

  if (state.yearMode === '2022' || state.yearMode === 'compare') {
    datasets.push({
      label: '2022',
      data: provData.map(d => d.count2022),
      backgroundColor: '#f59e0b',
      borderRadius: 4
    });
  }
  if (state.yearMode === '2023' || state.yearMode === 'compare') {
    datasets.push({
      label: '2023',
      data: provData.map(d => d.count2023),
      backgroundColor: '#06b6d4',
      borderRadius: 4
    });
  }

  renderBarChart('overview-province-ranking-chart', {
    labels,
    datasets
  }, {
    indexAxis: 'y',
    onClick: (evt, elements) => {
      if (elements && elements.length > 0) {
        const idx = elements[0].index;
        const clickedProv = provData[idx].province;
        setState({ province: clickedProv });
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
        title: { display: true, text: 'จำนวนรายการตรวจพบดาวเทียม (คลิกเพื่อเลือกจังหวัด)', color: '#94a3b8', font: { size: 11 } }
      }
    }
  });
}

/**
 * Render Data Distribution Chart (Reference screenshot bottom-right card)
 */
function renderOverviewDistributionChart(state) {
  const db = getDb();
  const targetYear = state.yearMode === 'compare' ? 2022 : Number(state.yearMode);

  // Group stations by province and compute average temperature for each province
  const provStats = STUDY_PROVINCES.map(prov => {
    const list = db.hrdiStationMonth.filter(r =>
      r.province === prov && r.year === targetYear && state.selectedMonths.includes(r.month)
    );
    const meanTemp = calculateMean(list, 'temp').mean;
    const minTemp = calculateMean(list, 'temp_min').mean;
    const maxTemp = calculateMean(list, 'temp_max').mean;

    return {
      province: prov,
      meanTemp,
      minTemp,
      maxTemp
    };
  });

  const labels = provStats.map(p => p.province);

  renderBarChart('overview-distribution-chart', {
    labels,
    datasets: [
      {
        label: 'อุณหภูมิต่ำสุด (°C)',
        data: provStats.map(p => p.minTemp),
        backgroundColor: '#0284c7',
        borderRadius: 4
      },
      {
        label: 'อุณหภูมิเฉลี่ย (°C)',
        data: provStats.map(p => p.meanTemp),
        backgroundColor: '#06b6d4',
        borderRadius: 4
      },
      {
        label: 'อุณหภูมิสูงสุด (°C)',
        data: provStats.map(p => p.maxTemp),
        backgroundColor: '#f59e0b',
        borderRadius: 4
      }
    ]
  }, {
    plugins: {
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y !== null ? ctx.parsed.y.toFixed(1) + ' °C' : 'ไม่มีข้อมูล'}`
        }
      }
    },
    scales: {
      y: {
        title: { display: true, text: 'อุณหภูมิ (°C)', color: '#94a3b8', font: { size: 11 } }
      }
    }
  });
}
