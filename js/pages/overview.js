/**
 * overview.js — Page 1 (Q1): ภาพรวม (Overview - Q1, Q2, Q5, Q9)
 * Highland Climate & Hotspot Dashboard (2022–2023)
 */

import { getState, setState, DEFAULT_MONTHS_COMPARE, ALL_MONTHS } from '../state.js';
import { getDb } from '../data-loader.js';
import {
  filterStationMonthRecords,
  filterHiiRecords,
  getFilteredHotspotCount,
  getHotspotMonthlySeries,
  getHotspotByProvinceBreakdown,
  getActiveProvinceCoverage,
  getAvailableStations,
  STUDY_PROVINCES
} from '../filters.js';
import {
  calculateMean,
  calculateQuartiles,
  calculateFairHrdiYoY,
  calculateFairHiiYoY,
  calculateHotspotYoY,
  formatNum,
  formatInt,
  formatSignedDelta
} from '../calculations.js';
import {
  initLeafletMap,
  renderThailandProvinceMap,
  renderStationMarkersWithRadius,
  computeProvinceMapStats,
  HIGHLAND_CENTER,
  HIGHLAND_ZOOM
} from '../maps.js';
import {
  renderLineChart,
  renderBarChart,
  renderBoxPlotChart,
  THAI_MONTH_NAMES,
  YEAR_COLORS
} from '../charts.js';

let overviewMap = null;
let currentGeoLayer = null;
let currentStationLayer = null;

const QUESTION_TITLES_Q1 = {
  temp: {
    map: 'พื้นที่ไหนมีอุณหภูมิสูงหรือต่ำกว่ากัน?',
    mapCompare: 'จังหวัดไหนมีอุณหภูมิเพิ่มขึ้นหรือลดลงในปี 2023?',
    trend: 'อุณหภูมิรายเดือนปี 2022 กับ 2023 ต่างกันอย่างไร?',
    ranking: 'จังหวัดไหนมีอุณหภูมิเฉลี่ยสูงที่สุด?',
    dist: 'อุณหภูมิในแต่ละพื้นที่ต่างกันแค่ไหน?'
  },
  humidity: {
    map: 'พื้นที่ไหนมีความชื้นสัมพัทธ์สูงหรือต่ำกว่ากัน?',
    mapCompare: 'จังหวัดไหนมีความชื้นเพิ่มขึ้นหรือลดลงในปี 2023?',
    trend: 'ความชื้นสัมพัทธ์รายเดือนเปลี่ยนไปอย่างไร?',
    ranking: 'จังหวัดไหนมีความชื้นสัมพัทธ์สูงที่สุด?',
    dist: 'ความชื้นสัมพัทธ์ในแต่ละพื้นที่ต่างกันแค่ไหน?'
  },
  rainfall: {
    map: 'พื้นที่ไหนมีฝนตกมากหรือน้อยกว่ากัน?',
    mapCompare: 'จังหวัดไหนมีปริมาณฝนเพิ่มขึ้นหรือลดลงในปี 2023?',
    trend: 'ฝนตกมากช่วงเดือนไหน และสองปีต่างกันอย่างไร?',
    ranking: 'จังหวัดไหนมีปริมาณฝนเฉลี่ยมากที่สุด?',
    dist: 'ปริมาณฝนในแต่ละพื้นที่ต่างกันแค่ไหน?'
  },
  hotspots: {
    map: 'จุดความร้อนกระจุกตัวอยู่ในจังหวัดไหน?',
    mapCompare: 'จังหวัดไหนมีจุดความร้อนเพิ่มขึ้นหรือลดลงในปี 2023?',
    trend: 'จุดความร้อนเกิดมากช่วงเดือนไหน?',
    ranking: 'จังหวัดไหนพบจุดความร้อนมากที่สุด?',
    dist: 'อุณหภูมิในแต่ละพื้นที่ต่างกันแค่ไหน?'
  }
};

/**
 * Initialize or update Page 1 (Q1): Overview
 */
export function renderOverviewPage() {
  const state = getState();
  const db = getDb();

  // Filter HRDI station-month records (respects weatherSource, province, district, tambon, stationId, selectedMonths)
  const hrdi2022 = filterStationMonthRecords(db.hrdiStationMonth, state, 2022);
  const hrdi2023 = filterStationMonthRecords(db.hrdiStationMonth, state, 2023);
  const hrdiAll = filterStationMonthRecords(db.hrdiStationMonth, state);

  // Filter HII provincial rainfall records
  const hii2022 = filterHiiRecords(db.hiiProvinceMonth, state, 2022);
  const hii2023 = filterHiiRecords(db.hiiProvinceMonth, state, 2023);
  const hiiAll = filterHiiRecords(db.hiiProvinceMonth, state);

  // Multidimensional Hotspot totals (strictly applies all active filters with AND)
  const hotspots2022 = getFilteredHotspotCount(state, 2022);
  const hotspots2023 = getFilteredHotspotCount(state, 2023);
  const hotspotTotal = state.yearMode === '2022' ? hotspots2022
    : state.yearMode === '2023' ? hotspots2023
    : hotspots2022 + hotspots2023;

  // Update dynamic question titles on Q1
  updateOverviewQuestionTitles(state);

  // 1. Render 5 Clean KPI Cards with (i) popover details
  renderOverviewKpis(state, hrdi2022, hrdi2023, hrdiAll, hii2022, hii2023, hiiAll, hotspots2022, hotspots2023, hotspotTotal);

  // 2. Render Pure GeoJSON Choropleth Map (No external tiles / No API Key required)
  renderOverviewMap(state);

  // 3. Render Province Docked Detail Panel (if province selected)
  renderProvinceDockedPanel(state, hrdiAll, hiiAll, hotspotTotal);

  // 4. Render Monthly Trend Chart with Metric Tabs & Click-to-Filter Month
  renderOverviewMonthlyTrends(state);

  // 5. Render Province Ranking Horizontal Bar Chart with Click-to-Filter Province & End Value Labels
  renderOverviewProvinceRanking(state);

  // 6. Render Box Plot Distribution Chart (Min, Q1, Median, Q3, Max, Mean, N)
  renderOverviewDistributionChart(state, hrdiAll);

  // 7. Render Dynamic Key Insights (สิ่งที่น่าสนใจ)
  renderOverviewKeyInsights(state, hrdi2022, hrdi2023, hrdiAll, hotspots2022, hotspots2023, hotspotTotal);
}

/**
 * Update question-style chart titles based on selected metric and yearMode
 */
function updateOverviewQuestionTitles(state) {
  const m = state.overviewMetricTab || 'temp';
  const cfg = QUESTION_TITLES_Q1[m] || QUESTION_TITLES_Q1.temp;

  const mapTitleEl = document.getElementById('overview-map-title');
  if (mapTitleEl) {
    mapTitleEl.textContent = state.yearMode === 'compare' ? cfg.mapCompare : cfg.map;
  }

  const trendTitleEl = document.getElementById('overview-trend-title');
  if (trendTitleEl) trendTitleEl.textContent = cfg.trend;

  const rankTitleEl = document.getElementById('overview-ranking-title');
  if (rankTitleEl) rankTitleEl.textContent = cfg.ranking;

  const distTitleEl = document.getElementById('overview-distribution-title');
  if (distTitleEl) distTitleEl.textContent = cfg.dist;
}

/**
 * Render 5 Clean KPI Cards:
 * Card shows only Icon, Name, Main Value, Unit, and concise YoY change.
 * Sample size N, dataset name, and technical details go into the (i) popover.
 */
function renderOverviewKpis(state, hrdi2022, hrdi2023, hrdiAll, hii2022, hii2023, hiiAll, hotspots2022, hotspots2023, hotspotTotal) {
  const matchedStations = getAvailableStations(state.province, state.district, state.tambon, state.weatherSource);
  const sourceLabel = state.weatherSource === 'all'
    ? `ทุกแหล่ง (${matchedStations.length} สถานี)`
    : `${state.weatherSource} (${matchedStations.length} สถานี)`;

  // 1. Mean Temperature (HRDI)
  const tempStats = calculateMean(hrdiAll, 'temp');
  const kpiTempVal = document.getElementById('kpi-temp-val');
  const kpiTempSub = document.getElementById('kpi-temp-sub');
  const kpiTempDetail = document.getElementById('kpi-temp-meta-detail');
  if (kpiTempVal) kpiTempVal.textContent = formatNum(tempStats.mean, 1);
  if (kpiTempSub) {
    if (state.yearMode === 'compare') {
      const yoy = calculateFairHrdiYoY(hrdi2022, hrdi2023, 'temp');
      if (yoy.nPairs > 0 && yoy.diff !== null) {
        const cls = yoy.diff > 0 ? 'positive' : yoy.diff < 0 ? 'negative' : 'neutral';
        kpiTempSub.innerHTML = `<span class="kpi-delta ${cls}">${formatSignedDelta(yoy.diff, 1, '°C')}</span> เทียบกับปี 2022`;
      } else {
        kpiTempSub.textContent = 'ไม่มีคู่เดือนที่ตรงกัน';
      }
      if (kpiTempDetail) {
        kpiTempDetail.textContent = `จำนวนตัวอย่าง N = ${tempStats.count} ระเบียน (${yoy.nPairs} คู่สถานี-เดือนตรงกัน) · ${sourceLabel} · ชุดข้อมูล: hrdi_station_month.json`;
      }
    } else {
      kpiTempSub.textContent = tempStats.count > 0 ? `ค่าเฉลี่ยปี ${state.yearMode}` : 'ไม่พบข้อมูล';
      if (kpiTempDetail) {
        kpiTempDetail.textContent = `จำนวนตัวอย่าง N = ${tempStats.count} ระเบียน · ${sourceLabel} · ชุดข้อมูล: hrdi_station_month.json`;
      }
    }
  }

  // 2. Mean Humidity (HRDI)
  const humStats = calculateMean(hrdiAll, 'humidity');
  const kpiHumVal = document.getElementById('kpi-humidity-val');
  const kpiHumSub = document.getElementById('kpi-humidity-sub');
  const kpiHumDetail = document.getElementById('kpi-humidity-meta-detail');
  if (kpiHumVal) kpiHumVal.textContent = formatNum(humStats.mean, 1);
  if (kpiHumSub) {
    if (state.yearMode === 'compare') {
      const yoy = calculateFairHrdiYoY(hrdi2022, hrdi2023, 'humidity');
      if (yoy.nPairs > 0 && yoy.diff !== null) {
        const cls = yoy.diff > 0 ? 'negative' : yoy.diff < 0 ? 'positive' : 'neutral';
        kpiHumSub.innerHTML = `<span class="kpi-delta ${cls}">${formatSignedDelta(yoy.diff, 1, '%')}</span> เทียบกับปี 2022`;
      } else {
        kpiHumSub.textContent = 'ไม่มีคู่เดือนที่ตรงกัน';
      }
      if (kpiHumDetail) {
        kpiHumDetail.textContent = `จำนวนตัวอย่าง N = ${humStats.count} ระเบียน (${yoy.nPairs} คู่สถานี-เดือน) · ${sourceLabel} · ชุดข้อมูล: hrdi_station_month.json`;
      }
    } else {
      kpiHumSub.textContent = humStats.count > 0 ? `ค่าเฉลี่ยปี ${state.yearMode}` : 'ไม่พบข้อมูล';
      if (kpiHumDetail) {
        kpiHumDetail.textContent = `จำนวนตัวอย่าง N = ${humStats.count} ระเบียน · ${sourceLabel} · ชุดข้อมูล: hrdi_station_month.json`;
      }
    }
  }

  // 3. Mean Rainfall (HRDI or HII)
  const useHii = state.rainfallSource === 'hii';
  const rainStats = useHii ? calculateMean(hiiAll, 'hii_avg_rain') : calculateMean(hrdiAll, 'rainfall');
  const kpiRainVal = document.getElementById('kpi-rainfall-val');
  const kpiRainSub = document.getElementById('kpi-rainfall-sub');
  const kpiRainTitle = document.getElementById('kpi-rainfall-title');
  const kpiRainDetail = document.getElementById('kpi-rainfall-meta-detail');
  if (kpiRainTitle) {
    kpiRainTitle.textContent = useHii ? 'ปริมาณน้ำฝน (จังหวัด HII)' : 'ปริมาณน้ำฝนเฉลี่ย';
  }
  if (kpiRainVal) kpiRainVal.textContent = formatNum(rainStats.mean, 1);
  if (kpiRainSub) {
    if (state.yearMode === 'compare') {
      const yoy = useHii ? calculateFairHiiYoY(hii2022, hii2023) : calculateFairHrdiYoY(hrdi2022, hrdi2023, 'rainfall');
      if (yoy.nPairs > 0 && yoy.diff !== null) {
        const cls = yoy.diff > 0 ? 'negative' : yoy.diff < 0 ? 'positive' : 'neutral';
        const pctStr = yoy.pctChange !== null ? ` (${formatSignedDelta(yoy.pctChange, 1, '%')})` : '';
        kpiRainSub.innerHTML = `<span class="kpi-delta ${cls}">${formatSignedDelta(yoy.diff, 1, 'มม.')}</span>${pctStr} vs 2022`;
      } else {
        kpiRainSub.textContent = 'ไม่มีคู่เดือนที่ตรงกัน';
      }
      if (kpiRainDetail) {
        kpiRainDetail.textContent = useHii
          ? `จำนวนตัวอย่าง N = ${rainStats.count} ระเบียนจังหวัด-เดือน (${yoy.nPairs} คู่ปี) · ชุดข้อมูล: hii_province_month.json`
          : `จำนวนตัวอย่าง N = ${rainStats.count} ระเบียนสถานี-เดือน (${yoy.nPairs} คู่ปี) · ชุดข้อมูล: hrdi_station_month.json`;
      }
    } else {
      kpiRainSub.textContent = rainStats.count > 0
        ? (useHii ? `เฉลี่ยจังหวัด ปี ${state.yearMode}` : `เฉลี่ยสถานี ปี ${state.yearMode}`)
        : 'ไม่พบข้อมูล';
      if (kpiRainDetail) {
        kpiRainDetail.textContent = `จำนวนตัวอย่าง N = ${rainStats.count} ระเบียน · ชุดข้อมูล: ${useHii ? 'hii_province_month.json' : 'hrdi_station_month.json'}`;
      }
    }
  }

  // 4. Satellite Hotspot Detections (VIIRS)
  const kpiHsVal = document.getElementById('kpi-hotspots-val');
  const kpiHsSub = document.getElementById('kpi-hotspots-sub');
  const kpiHsDetail = document.getElementById('kpi-hotspots-meta-detail');
  if (kpiHsVal) kpiHsVal.textContent = formatInt(hotspotTotal);
  if (kpiHsSub) {
    if (state.yearMode === 'compare') {
      const yoy = calculateHotspotYoY(hotspots2022, hotspots2023);
      const cls = yoy.diff > 0 ? 'positive' : yoy.diff < 0 ? 'negative' : 'neutral';
      const pctText = yoy.pctChange !== null ? ` (${formatSignedDelta(yoy.pctChange, 1, '%')})` : '';
      kpiHsSub.innerHTML = `<span class="kpi-delta ${cls}">${formatSignedDelta(yoy.diff, 0)} จุด</span>${pctText} vs 2022`;
    } else {
      kpiHsSub.textContent = `ดาวเทียม VIIRS ปี ${state.yearMode}`;
    }
  }
  if (kpiHsDetail) {
    kpiHsDetail.textContent = `ปี 2022: ${formatInt(hotspots2022)} จุด · ปี 2023: ${formatInt(hotspots2023)} จุด · ชุดข้อมูล: hotspot_multidim_index.json`;
  }

  // 5. Active Provinces with Data in Scope
  const cov = getActiveProvinceCoverage(state, hrdiAll);
  const kpiProvVal = document.getElementById('kpi-provinces-val');
  const kpiProvSub = document.getElementById('kpi-provinces-sub');
  if (kpiProvVal) {
    kpiProvVal.textContent = `${cov.activeProvinceCount}`;
  }
  if (kpiProvSub) {
    kpiProvSub.textContent = state.province ? `เลือก จ.${state.province}` : `จากพื้นที่ศึกษา ${cov.studyProvinceTotal || 9} จังหวัด`;
  }

  // Highlight active metric KPI card
  document.querySelectorAll('.kpi-card[data-kpi-metric]').forEach(card => {
    const m = card.getAttribute('data-kpi-metric');
    card.classList.toggle('kpi-card-active', m === state.overviewMetricTab);
  });
}

/**
 * Render Pure GeoJSON Choropleth Map (No external basemap tiles / No API Key required)
 * Supports 3 Year Modes: ปี 2022 | ปี 2023 | เปรียบเทียบ (2023 − 2022 Difference Choropleth)
 */
function renderOverviewMap(state) {
  if (!overviewMap) {
    overviewMap = initLeafletMap('overview-map-container');
  }
  if (!overviewMap) return;

  // Clear previous layers
  if (currentGeoLayer) overviewMap.removeLayer(currentGeoLayer);
  if (currentStationLayer) {
    overviewMap.removeLayer(currentStationLayer);
    currentStationLayer = null;
  }

  const activeMapMetric = state.swipeMetric || state.overviewMetricTab || 'temp';

  // Update Map Mode Banner text
  const modeBanner = document.getElementById('overview-map-mode-banner');
  if (modeBanner) {
    if (state.yearMode === 'compare') {
      modeBanner.textContent = 'โหมดเปรียบเทียบ: สีแผนที่แสดงผลต่าง ปี 2023 เทียบกับ ปี 2022';
    } else {
      modeBanner.textContent = `แสดงข้อมูลรายจังหวัด ปี ${state.yearMode} · คลิกจังหวัดเพื่อกรอง`;
    }
  }

  // Render 77-province GeoJSON Choropleth + Legend
  currentGeoLayer = renderThailandProvinceMap(overviewMap, {
    metric: activeMapMetric,
    legendContainerId: 'overview-map-container',
    onSelectProvince: (nextProv) => {
      setState({ province: nextProv });
    }
  });

  // Render station markers only when toggled on OR when a specific station is selected
  const shouldShowStations = Boolean(state.showMapStations || state.stationId);
  const btnToggleStations = document.getElementById('btn-toggle-map-stations');
  if (btnToggleStations) {
    btnToggleStations.classList.toggle('active', shouldShowStations);
  }

  if (shouldShowStations) {
    const visibleStations = getAvailableStations(state.province, state.district, state.tambon, state.weatherSource);
    currentStationLayer = renderStationMarkersWithRadius(
      overviewMap,
      visibleStations,
      state.stationId,
      (st) => {
        const nextStationId = state.stationId === st.station_id ? null : st.station_id;
        setState({
          stationId: nextStationId,
          province: st.province,
          district: nextStationId ? st.district : state.district,
          tambon: nextStationId ? st.tambon : state.tambon
        });
      }
    );
  }

  // Zoom to province if selected, otherwise show study area
  if (state.province) {
    const provStations = getAvailableStations(state.province, null, null, 'all');
    if (provStations.length > 0) {
      const bounds = L.latLngBounds(provStations.map(s => [s.lat, s.lon]));
      overviewMap.fitBounds(bounds, { padding: [45, 45], maxZoom: 9 });
    }
  } else {
    overviewMap.setView(HIGHLAND_CENTER, HIGHLAND_ZOOM);
  }
}

/**
 * Render Province Detail Panel docked on the map.
 * When in Compare mode, clearly shows 2022 value, 2023 value, difference, unit, and % change (or reason if omitted).
 */
function renderProvinceDockedPanel(state, hrdiAll, hiiAll, hotspotTotal) {
  const panel = document.getElementById('overview-province-docked-panel');
  if (!panel) return;

  if (!state.province) {
    panel.classList.remove('active');
    return;
  }

  const prov = state.province;
  const activeMapMetric = state.swipeMetric || state.overviewMetricTab || 'temp';
  const mapStats = computeProvinceMapStats(state, activeMapMetric);
  const pStat = mapStats.get ? mapStats.get(prov) : mapStats[prov];

  const stations = getAvailableStations(prov, state.district, state.tambon, state.weatherSource);
  const tempStats = calculateMean(hrdiAll, 'temp');
  const rainStats = calculateMean(hrdiAll, 'rainfall');
  const humStats = calculateMean(hrdiAll, 'humidity');
  const hiiStats = calculateMean(hiiAll, 'hii_avg_rain');

  let compareSectionHtml = '';
  if (pStat && state.yearMode === 'compare') {
    const fmt = (v) => v === null || v === undefined ? 'ไม่มีข้อมูล' : (pStat.decimals === 0 ? formatInt(v) : formatNum(v, pStat.decimals));
    const diffStr = pStat.diffVal !== null && pStat.diffVal !== undefined
      ? `${pStat.diffVal > 0 ? '+' : ''}${pStat.decimals === 0 ? formatInt(pStat.diffVal) : formatNum(pStat.diffVal, pStat.decimals)} ${pStat.unit}`
      : 'ไม่มีข้อมูลเปรียบเทียบ';
    const pctLine = pStat.pctChange !== null && pStat.pctChange !== undefined
      ? `(${pStat.pctChange > 0 ? '+' : ''}${pStat.pctChange.toFixed(1)}%)`
      : (pStat.pctNote ? `<span style="font-size:0.72rem; color:#43627A;">(${pStat.pctNote})</span>` : '');

    compareSectionHtml = `
      <div class="docked-compare-box">
        <div class="docked-compare-title">เปรียบเทียบ ${pStat.metricLabel}</div>
        <div class="docked-metric-row"><span>ค่าปี 2022:</span><strong>${fmt(pStat.val2022)} ${pStat.unit}</strong></div>
        <div class="docked-metric-row"><span>ค่าปี 2023:</span><strong>${fmt(pStat.val2023)} ${pStat.unit}</strong></div>
        <div class="docked-metric-row"><span>ผลต่าง (2023 − 2022):</span><strong style="color:#0B96B5;">${diffStr} ${pctLine}</strong></div>
      </div>
    `;
  }

  panel.innerHTML = `
    <div class="docked-panel-header">
      <div>
        <span class="docked-panel-kicker">จังหวัดที่เลือก</span>
        <h3 class="docked-panel-title">จังหวัด${prov}</h3>
      </div>
      <button type="button" class="panel-close-btn" onclick="window.clearProvinceSelection()" title="ยกเลิกการเลือกจังหวัด">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </div>

    ${compareSectionHtml}

    <div class="docked-panel-metrics">
      <div class="docked-metric-row">
        <span>สถานีตรวจวัด:</span>
        <strong>${stations.length} สถานี</strong>
      </div>
      <div class="docked-metric-row">
        <span>อุณหภูมิเฉลี่ย:</span>
        <strong>${formatNum(tempStats.mean, 1)} °C</strong>
      </div>
      <div class="docked-metric-row">
        <span>ความชื้นสัมพัทธ์:</span>
        <strong>${formatNum(humStats.mean, 1)} %</strong>
      </div>
      <div class="docked-metric-row">
        <span>ฝนเฉลี่ยสถานี (HRDI):</span>
        <strong>${formatNum(rainStats.mean, 1)} มม.</strong>
      </div>
      <div class="docked-metric-row">
        <span>ฝนเฉลี่ยจังหวัด (HII):</span>
        <strong>${formatNum(hiiStats.mean, 1)} มม.</strong>
      </div>
      <div class="docked-metric-row">
        <span>จุดความร้อนดาวเทียม:</span>
        <strong class="text-hotspot">${formatInt(hotspotTotal)} จุด</strong>
      </div>
    </div>

    <div class="docked-station-list-wrap">
      <div class="docked-station-list-label">คลิกเลือกสถานีในจังหวัด (${stations.length} แห่ง):</div>
      <div class="docked-station-list">
        ${stations.length > 0 ? stations.map(s => `
          <button type="button" class="docked-station-btn ${state.stationId === s.station_id ? 'active' : ''}" onclick="window.selectStation('${s.station_id}', '${s.province}', '${s.district || ''}', '${s.tambon || ''}')">
            <span>${s.station_name}</span>
            <small>${s.source_type === 'HRDI Weather Station' ? 'HRDI' : 'OWM'}</small>
          </button>
        `).join('') : '<div class="docked-empty-note">ไม่มีสถานีของแหล่งข้อมูลนี้ในจังหวัดที่เลือก</div>'}
      </div>
    </div>

    <button type="button" class="docked-reset-prov-btn" onclick="window.clearProvinceSelection()">
      ย้อนกลับภาพรวม 9 จังหวัด
    </button>
  `;

  panel.classList.add('active');
}

/**
 * Render Monthly Trends with Metric Selector Tabs & Click-to-Filter Month
 */
function renderOverviewMonthlyTrends(state) {
  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const labels = months.map(m => THAI_MONTH_NAMES[m - 1]);
  const currentMetric = state.overviewMetricTab || 'temp';
  const selectedSet = new Set(state.selectedMonths);

  const db = getDb();
  const stateAllMonths = { ...state, selectedMonths: ALL_MONTHS };
  const hrdi2022Full = filterStationMonthRecords(db.hrdiStationMonth, stateAllMonths, 2022);
  const hrdi2023Full = filterStationMonthRecords(db.hrdiStationMonth, stateAllMonths, 2023);

  let vals2022 = [];
  let vals2023 = [];
  let unitText = '°C';
  let metricLabel = 'อุณหภูมิเฉลี่ย';

  if (currentMetric === 'temp') {
    metricLabel = 'อุณหภูมิเฉลี่ยสถานี';
    unitText = '°C';
    vals2022 = months.map(m => calculateMean(hrdi2022Full.filter(r => r.month === m), 'temp').mean);
    vals2023 = months.map(m => calculateMean(hrdi2023Full.filter(r => r.month === m), 'temp').mean);
  } else if (currentMetric === 'humidity') {
    metricLabel = 'ความชื้นสัมพัทธ์สถานี';
    unitText = '%';
    vals2022 = months.map(m => calculateMean(hrdi2022Full.filter(r => r.month === m), 'humidity').mean);
    vals2023 = months.map(m => calculateMean(hrdi2023Full.filter(r => r.month === m), 'humidity').mean);
  } else if (currentMetric === 'rainfall') {
    if (state.rainfallSource === 'hii') {
      metricLabel = 'ปริมาณน้ำฝนจังหวัด (HII)';
      unitText = 'มม.';
      const hii22 = filterHiiRecords(db.hiiProvinceMonth, stateAllMonths, 2022);
      const hii23 = filterHiiRecords(db.hiiProvinceMonth, stateAllMonths, 2023);
      vals2022 = months.map(m => calculateMean(hii22.filter(r => r.month === m), 'hii_avg_rain').mean);
      vals2023 = months.map(m => calculateMean(hii23.filter(r => r.month === m), 'hii_avg_rain').mean);
    } else {
      metricLabel = 'ปริมาณน้ำฝนสถานี (HRDI)';
      unitText = 'มม.';
      vals2022 = months.map(m => calculateMean(hrdi2022Full.filter(r => r.month === m), 'rainfall').mean);
      vals2023 = months.map(m => calculateMean(hrdi2023Full.filter(r => r.month === m), 'rainfall').mean);
    }
  } else if (currentMetric === 'hotspots') {
    metricLabel = 'จุดความร้อนดาวเทียม VIIRS';
    unitText = 'จุด';
    vals2022 = getHotspotMonthlySeries(state, 2022, false);
    vals2023 = getHotspotMonthlySeries(state, 2023, false);
  }

  const scopeNoteEl = document.getElementById('overview-trend-scope-note');
  if (scopeNoteEl) {
    const mNames = state.selectedMonths.map(m => THAI_MONTH_NAMES[m - 1]).join(', ');
    scopeNoteEl.textContent = `ช่วงเดือนที่เลือก: ${state.selectedMonths.length === 12 ? 'ทั้งปี (12 เดือน)' : mNames} · คลิกจุดเดือนเพื่อกรองเฉพาะเดือน`;
  }

  const pointRadii = months.map(m => selectedSet.has(m) ? 5.5 : 3);
  const datasets = [];

  if (state.yearMode === '2022' || state.yearMode === 'compare') {
    datasets.push({
      label: `ปี 2022 (${metricLabel})`,
      data: vals2022,
      borderColor: YEAR_COLORS.y2022,
      backgroundColor: YEAR_COLORS.y2022Bg,
      pointBackgroundColor: months.map(m => selectedSet.has(m) ? YEAR_COLORS.y2022 : '#FFFFFF'),
      pointBorderColor: YEAR_COLORS.y2022,
      pointBorderWidth: 2,
      pointRadius: pointRadii,
      pointHoverRadius: 7,
      borderWidth: 2.5,
      tension: 0.32,
      fill: state.yearMode === '2022',
      spanGaps: false
    });
  }
  if (state.yearMode === '2023' || state.yearMode === 'compare') {
    datasets.push({
      label: `ปี 2023 (${metricLabel})`,
      data: vals2023,
      borderColor: YEAR_COLORS.y2023,
      backgroundColor: YEAR_COLORS.y2023Bg,
      pointBackgroundColor: months.map(m => selectedSet.has(m) ? YEAR_COLORS.y2023 : '#FFFFFF'),
      pointBorderColor: YEAR_COLORS.y2023,
      pointBorderWidth: 2,
      pointRadius: pointRadii,
      pointHoverRadius: 7,
      borderWidth: 2.5,
      tension: 0.32,
      fill: state.yearMode === '2023',
      spanGaps: false
    });
  }

  renderLineChart('overview-monthly-trend-chart', {
    labels,
    datasets
  }, {
    onClick: (evt, elements) => {
      if (elements && elements.length > 0) {
        const curState = getState();
        const clickedMonth = elements[0].index + 1;
        const isOnlyThisMonth = curState.selectedMonths.length === 1 && curState.selectedMonths[0] === clickedMonth;
        if (isOnlyThisMonth) {
          setState({
            selectedMonths: curState.yearMode === 'compare' ? [...DEFAULT_MONTHS_COMPARE] : [...ALL_MONTHS]
          });
        } else {
          setState({ selectedMonths: [clickedMonth] });
        }
      }
    },
    plugins: {
      tooltip: {
        callbacks: {
          title: (items) => {
            if (!items || !items.length) return '';
            const m = items[0].dataIndex + 1;
            const inKpi = selectedSet.has(m) ? 'อยู่ในช่วงกรองปัจจุบัน' : 'นอกช่วงกรองปัจจุบัน (คลิกเพื่อเลือก)';
            return `เดือน${THAI_MONTH_NAMES[m - 1]} (${inKpi})`;
          },
          label: (ctx) => {
            const val = ctx.parsed.y;
            if (val === null || val === undefined || Number.isNaN(Number(val))) {
              return ` ${ctx.dataset.label}: ไม่มีข้อมูลตรวจวัด`;
            }
            const formatted = currentMetric === 'hotspots' ? formatInt(val) : formatNum(val, 1);
            return ` ${ctx.dataset.label}: ${formatted} ${unitText}`;
          }
        }
      }
    },
    scales: {
      y: {
        title: { display: true, text: `${metricLabel} (${unitText})` }
      }
    }
  });
}

/**
 * Render Province Ranking Horizontal Bar Chart
 */
function renderOverviewProvinceRanking(state) {
  const db = getDb();
  const currentMetric = state.overviewMetricTab || 'temp';

  let provData = [];
  let unitText = 'จุด';
  let axisLabel = 'จำนวนจุดความร้อน (คลิกแท่งจังหวัดเพื่อกรอง)';
  let decimals = 0;

  if (currentMetric === 'hotspots') {
    const hsList = getHotspotByProvinceBreakdown(state, true);
    provData = hsList.map(d => ({
      province: d.province,
      val2022: d.count2022,
      val2023: d.count2023,
      sortVal: d.total
    }));
    unitText = 'จุด';
    axisLabel = 'จำนวนจุดความร้อนดาวเทียม (จุด)';
    decimals = 0;
  } else {
    const stateNoProv = { ...state, province: null, district: null, tambon: null, stationId: null };
    const rows22 = filterStationMonthRecords(db.hrdiStationMonth, stateNoProv, 2022);
    const rows23 = filterStationMonthRecords(db.hrdiStationMonth, stateNoProv, 2023);
    const rowsAll = filterStationMonthRecords(db.hrdiStationMonth, stateNoProv);

    const field = currentMetric === 'humidity' ? 'humidity' : currentMetric === 'rainfall' ? 'rainfall' : 'temp';
    unitText = currentMetric === 'humidity' ? '%' : currentMetric === 'rainfall' ? 'มม.' : '°C';
    const titlePrefix = currentMetric === 'humidity' ? 'ความชื้นสัมพัทธ์' : currentMetric === 'rainfall' ? 'ปริมาณน้ำฝน' : 'อุณหภูมิเฉลี่ย';
    axisLabel = `${titlePrefix} (${unitText})`;
    decimals = 1;

    provData = STUDY_PROVINCES.map(prov => {
      const m22 = calculateMean(rows22.filter(r => r.province === prov), field).mean;
      const m23 = calculateMean(rows23.filter(r => r.province === prov), field).mean;
      const mAll = calculateMean(rowsAll.filter(r => r.province === prov), field).mean;
      return {
        province: prov,
        val2022: m22,
        val2023: m23,
        sortVal: state.yearMode === '2022' ? m22 : state.yearMode === '2023' ? m23 : mAll
      };
    }).filter(d => d.sortVal !== null && d.sortVal !== undefined);
  }

  provData.sort((a, b) => (b.sortVal ?? -Infinity) - (a.sortVal ?? -Infinity));

  const rankSubEl = document.getElementById('overview-ranking-subtitle');
  if (rankSubEl) {
    if (state.province) {
      const rankIdx = provData.findIndex(d => d.province === state.province);
      const rankText = rankIdx !== -1 ? `อันดับที่ ${rankIdx + 1} จาก ${provData.length} จังหวัด` : 'ไม่มีข้อมูลในแหล่งที่เลือก';
      rankSubEl.textContent = `เน้นจังหวัด${state.province} (${rankText}) — คลิกซ้ำเพื่อกลับภาพรวม`;
    } else {
      rankSubEl.textContent = `เรียงตามค่าจริง (${unitText}) · คลิกที่แท่งจังหวัดเพื่อกรอง`;
    }
  }

  const labels = provData.map((d, i) => `${i + 1}. ${d.province}`);
  const datasets = [];

  const getBarColor = (prov, baseColor, highlightColor) => {
    if (!state.province) return baseColor;
    return prov === state.province ? highlightColor : 'rgba(148, 163, 184, 0.38)';
  };

  if (state.yearMode === '2022' || state.yearMode === 'compare') {
    datasets.push({
      label: 'ปี 2022',
      data: provData.map(d => d.val2022),
      backgroundColor: provData.map(d => getBarColor(d.province, YEAR_COLORS.y2022, '#D97706')),
      borderRadius: 4
    });
  }
  if (state.yearMode === '2023' || state.yearMode === 'compare') {
    datasets.push({
      label: 'ปี 2023',
      data: provData.map(d => d.val2023),
      backgroundColor: provData.map(d => getBarColor(d.province, YEAR_COLORS.y2023, '#0B96B5')),
      borderRadius: 4
    });
  }

  renderBarChart('overview-province-ranking-chart', {
    labels,
    datasets
  }, {
    indexAxis: 'y',
    showValueLabels: true,
    valueLabelFormatter: (val) => decimals === 0 ? formatInt(val) : formatNum(val, 1),
    onClick: (evt, elements) => {
      if (elements && elements.length > 0) {
        const idx = elements[0].index;
        const clickedProv = provData[idx]?.province;
        if (clickedProv) {
          setState({ province: state.province === clickedProv ? null : clickedProv });
        }
      }
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: (context) => {
            const v = context.parsed.x;
            const formatted = decimals === 0 ? formatInt(v) : formatNum(v, 1);
            return ` ${context.dataset.label}: ${formatted} ${unitText}`;
          }
        }
      }
    },
    scales: {
      x: {
        title: { display: true, text: axisLabel }
      }
    }
  });
}

/**
 * Render Statistical Box Plot Distribution Chart (Min, Q1, Median, Q3, Max, Mean, N)
 */
function renderOverviewDistributionChart(state, hrdiAll) {
  const db = getDb();
  const activeTabMetric = state.overviewMetricTab === 'hotspots' ? 'temp' : (state.overviewMetricTab || 'temp');
  const field = activeTabMetric === 'humidity' ? 'humidity' : activeTabMetric === 'rainfall' ? 'rainfall' : 'temp';
  const unit = field === 'humidity' ? '%' : field === 'rainfall' ? 'มม.' : '°C';
  const metricLabel = field === 'humidity' ? 'ความชื้นสัมพัทธ์' : field === 'rainfall' ? 'ปริมาณน้ำฝนสถานี' : 'อุณหภูมิเฉลี่ย';

  const distSubEl = document.getElementById('overview-distribution-subtitle');

  if (state.province) {
    const stationsInProv = getAvailableStations(state.province, state.district, state.tambon, state.weatherSource);
    const boxStats = stationsInProv.map(s => {
      const stRecords = hrdiAll.filter(r => r.station_id === s.station_id);
      const q = calculateQuartiles(stRecords, field);
      const shortName = s.station_name.replace(/^สถานี/, '').trim().slice(0, 14);
      return {
        label: shortName,
        key: s.station_id,
        type: 'station',
        province: s.province,
        district: s.district,
        tambon: s.tambon,
        ...q,
        isSelected: state.stationId === s.station_id
      };
    }).filter(b => b.count > 0);

    if (distSubEl) {
      distSubEl.textContent = `ช่วงค่าต่ำสุด–สูงสุดและค่ากลางของสถานีใน จ.${state.province} (${unit}) — คลิกเพื่อเลือกสถานี`;
    }

    renderBoxPlotChart('overview-distribution-chart', boxStats, {
      unit,
      metricLabel,
      decimals: 1,
      onSelectGroup: (item) => {
        setState({
          stationId: state.stationId === item.key ? null : item.key,
          province: item.province,
          district: item.district,
          tambon: item.tambon
        });
      }
    });
  } else {
    const stateAllProv = { ...state, province: null, district: null, tambon: null, stationId: null };
    const rows = filterStationMonthRecords(db.hrdiStationMonth, stateAllProv);

    const boxStats = STUDY_PROVINCES.map(prov => {
      const provRecords = rows.filter(r => r.province === prov);
      const q = calculateQuartiles(provRecords, field);
      return {
        label: prov,
        key: prov,
        type: 'province',
        ...q,
        isSelected: state.province === prov
      };
    }).filter(b => b.count > 0);

    if (distSubEl) {
      distSubEl.textContent = `ช่วงค่าต่ำสุด–สูงสุดและค่ากลางรายจังหวัด (${unit}) — คลิกเพื่อกรองจังหวัด`;
    }

    renderBoxPlotChart('overview-distribution-chart', boxStats, {
      unit,
      metricLabel,
      decimals: 1,
      onSelectGroup: (item) => {
        setState({ province: state.province === item.key ? null : item.key });
      }
    });
  }
}

/**
 * Compute and render dynamic 1-2 sentence Key Insights (สิ่งที่น่าสนใจ) from real filtered data
 */
function renderOverviewKeyInsights(state, hrdi2022, hrdi2023, hrdiAll, hotspots2022, hotspots2023, hotspotTotal) {
  const insightEl = document.getElementById('insight-q1');
  if (!insightEl) return;

  const db = getDb();
  const scopeText = state.province ? `ในจังหวัด${state.province}` : 'ในพื้นที่ศึกษา 9 จังหวัด';

  // Find top hotspot province or month
  const hsByProv = getHotspotByProvinceBreakdown(state, false);
  const topHsProv = hsByProv[0];

  // Find highest temperature province in current filter
  const tempByProv = STUDY_PROVINCES.map(p => ({
    province: p,
    mean: calculateMean(hrdiAll.filter(r => r.province === p), 'temp').mean
  })).filter(d => d.mean !== null).sort((a, b) => b.mean - a.mean);

  const topTemp = tempByProv[0];
  const tempYoY = calculateFairHrdiYoY(hrdi2022, hrdi2023, 'temp');
  const hsYoY = calculateHotspotYoY(hotspots2022, hotspots2023);

  const parts = [];
  if (topTemp) {
    if (state.province) {
      parts.push(`ข้อมูล${scopeText}มีอุณหภูมิเฉลี่ย ${formatNum(topTemp.mean, 1)} °C${state.yearMode === 'compare' && tempYoY.diff !== null ? ` (เปลี่ยนไป ${formatSignedDelta(tempYoY.diff, 1, '°C')} ในปี 2023)` : ''}`);
    } else {
      parts.push(`จังหวัดที่มีอุณหภูมิเฉลี่ยสูงสุดคือ จ.${topTemp.province} (${formatNum(topTemp.mean, 1)} °C)${state.yearMode === 'compare' && tempYoY.diff !== null ? ` โดยภาพรวมปี 2023 เปลี่ยนแปลง ${formatSignedDelta(tempYoY.diff, 1, '°C')} จากปี 2022` : ''}`);
    }
  }

  if (hotspotTotal > 0) {
    if (state.yearMode === 'compare' && hsYoY.pctChange !== null) {
      parts.push(`ส่วนจุดความร้อนพบทั้งหมด ${formatInt(hotspotTotal)} จุด (ปี 2023 เปลี่ยนแปลง ${formatSignedDelta(hsYoY.pctChange, 1, '%')} จากปี 2022${!state.province && topHsProv ? ` และพบมากที่สุดใน จ.${topHsProv.province} ${formatInt(topHsProv.total)} จุด` : ''})`);
    } else {
      parts.push(`และตรวจพบจุดความร้อนรวม ${formatInt(hotspotTotal)} จุด${!state.province && topHsProv ? ` โดยกระจุกตัวสูงสุดที่ จ.${topHsProv.province} (${formatInt(topHsProv.total)} จุด)` : ''}`);
    }
  } else {
    parts.push('ไม่พบจุดความร้อนภายใต้เงื่อนไขตัวกรองที่เลือก');
  }

  insightEl.textContent = parts.join(' · ');
}
