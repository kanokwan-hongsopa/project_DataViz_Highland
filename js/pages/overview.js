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
  clearStationMarkersLayer,
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
import {
  animateKpiValue,
  prefersReducedMotion
} from '../animations.js';

let overviewMap = null;
let currentGeoLayer = null;
let currentStationLayer = null;
let lastMapZoomKey = null;
let lastPannedStationId = null;

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

  // 3B. Render Interactive Station Detail Panel & Dedicated Station Charts (2022 vs 2023)
  renderStationDetailPanel(state);
  renderStationDetailCharts(state);

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
  if (kpiTempVal) {
    animateKpiValue(kpiTempVal, tempStats.mean, { decimals: 1, duration: 920, fallback: 'N/A' });
  }
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
        kpiTempDetail.textContent = `จำนวนตัวอย่าง N = ${tempStats.count} แถวข้อมูล (${yoy.nPairs} คู่สถานี-เดือนตรงกัน) · ${sourceLabel} · ชุดข้อมูล: hrdi_station_month.json`;
      }
    } else {
      kpiTempSub.textContent = tempStats.count > 0 ? `ค่าเฉลี่ยปี ${state.yearMode}` : 'ไม่พบข้อมูล';
      if (kpiTempDetail) {
        kpiTempDetail.textContent = `จำนวนตัวอย่าง N = ${tempStats.count} แถวข้อมูล · ${sourceLabel} · ชุดข้อมูล: hrdi_station_month.json`;
      }
    }
  }

  // 2. Mean Humidity (HRDI)
  const humStats = calculateMean(hrdiAll, 'humidity');
  const kpiHumVal = document.getElementById('kpi-humidity-val');
  const kpiHumSub = document.getElementById('kpi-humidity-sub');
  const kpiHumDetail = document.getElementById('kpi-humidity-meta-detail');
  if (kpiHumVal) {
    animateKpiValue(kpiHumVal, humStats.mean, { decimals: 1, duration: 920, fallback: 'N/A' });
  }
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
        kpiHumDetail.textContent = `จำนวนตัวอย่าง N = ${humStats.count} แถวข้อมูล (${yoy.nPairs} คู่สถานี-เดือน) · ${sourceLabel} · ชุดข้อมูล: hrdi_station_month.json`;
      }
    } else {
      kpiHumSub.textContent = humStats.count > 0 ? `ค่าเฉลี่ยปี ${state.yearMode}` : 'ไม่พบข้อมูล';
      if (kpiHumDetail) {
        kpiHumDetail.textContent = `จำนวนตัวอย่าง N = ${humStats.count} แถวข้อมูล · ${sourceLabel} · ชุดข้อมูล: hrdi_station_month.json`;
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
  if (kpiRainVal) {
    animateKpiValue(kpiRainVal, rainStats.mean, { decimals: 1, duration: 940, fallback: 'N/A' });
  }
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
          ? `จำนวนตัวอย่าง N = ${rainStats.count} แถวข้อมูลระดับจังหวัด (${yoy.nPairs} คู่ปี) · ชุดข้อมูล: hii_province_month.json`
          : `จำนวนตัวอย่าง N = ${rainStats.count} แถวข้อมูลระดับสถานี (${yoy.nPairs} คู่ปี) · ชุดข้อมูล: hrdi_station_month.json`;
      }
    } else {
      kpiRainSub.textContent = rainStats.count > 0
        ? (useHii ? `เฉลี่ยจังหวัด ปี ${state.yearMode}` : `เฉลี่ยสถานี ปี ${state.yearMode}`)
        : 'ไม่พบข้อมูล';
      if (kpiRainDetail) {
        kpiRainDetail.textContent = `จำนวนตัวอย่าง N = ${rainStats.count} แถวข้อมูล · ชุดข้อมูล: ${useHii ? 'hii_province_month.json' : 'hrdi_station_month.json'}`;
      }
    }
  }

  // 4. Satellite Hotspot Detections (VIIRS)
  const kpiHsVal = document.getElementById('kpi-hotspots-val');
  const kpiHsSub = document.getElementById('kpi-hotspots-sub');
  const kpiHsDetail = document.getElementById('kpi-hotspots-meta-detail');
  if (kpiHsVal) {
    animateKpiValue(kpiHsVal, hotspotTotal, { decimals: 0, duration: 960, fallback: '0' });
  }
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
  const kpiProvFill = document.getElementById('kpi-prov-progress-fill');
  const kpiProvPct = document.getElementById('kpi-prov-progress-pct');
  if (kpiProvVal) {
    animateKpiValue(kpiProvVal, cov.activeProvinceCount, { decimals: 0, duration: 820, fallback: '0' });
  }
  if (kpiProvFill && kpiProvPct) {
    const totalStudy = cov.studyProvinceTotal || 9;
    const pct = Math.round((cov.activeProvinceCount / totalStudy) * 100);
    kpiProvFill.style.width = `${pct}%`;
    kpiProvPct.textContent = `${pct}%`;
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
 * Updates GeoJSON styles & Station Markers IN-PLACE without recreating layers,
 * and uses smooth flyToBounds / flyTo animations when changing province scope.
 */
function renderOverviewMap(state) {
  if (!overviewMap) {
    overviewMap = initLeafletMap('overview-map-container');
  }
  if (!overviewMap) return;

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

  // Render or smoothly update 77-province GeoJSON Choropleth + Legend in-place
  currentGeoLayer = renderThailandProvinceMap(overviewMap, {
    metric: activeMapMetric,
    legendContainerId: 'overview-map-container',
    onSelectProvince: (nextProv) => {
      setState({ province: nextProv });
    }
  });

  // Render or smoothly update station markers in-place when toggled on OR when a station is previewed/selected
  const activeStationId = state.previewStationId || state.stationId;
  const shouldShowStations = Boolean(state.showMapStations || activeStationId);
  const btnToggleStations = document.getElementById('btn-toggle-map-stations');
  if (btnToggleStations) {
    btnToggleStations.classList.toggle('active', shouldShowStations);
  }

  if (shouldShowStations) {
    const visibleStations = getAvailableStations(null, null, null, state.weatherSource);
    currentStationLayer = renderStationMarkersWithRadius(
      overviewMap,
      visibleStations,
      activeStationId,
      (st) => {
        setState({
          previewStationId: st.station_id,
          showMapStations: true
        });
      }
    );
  } else {
    clearStationMarkersLayer(overviewMap);
    currentStationLayer = null;
  }

  // Smoothly animate map zoom when province filter changes, preserving zoom on station marker clicks
  const isFirstZoom = lastMapZoomKey === null;
  const nextZoomKey = `${state.province || 'ALL'}`;
  const reducedMotion = prefersReducedMotion();

  if (nextZoomKey !== lastMapZoomKey) {
    lastMapZoomKey = nextZoomKey;
    if (state.province) {
      const provStations = getAvailableStations(state.province, null, null, 'all');
      if (provStations.length > 0) {
        const bounds = L.latLngBounds(provStations.map(s => [s.lat, s.lon]));
        if (isFirstZoom || reducedMotion) {
          overviewMap.fitBounds(bounds, { padding: [45, 45], maxZoom: 8.6, animate: false });
        } else {
          overviewMap.flyToBounds(bounds, { padding: [45, 45], maxZoom: 8.6, duration: 0.72 });
        }
      }
    } else {
      if (isFirstZoom || reducedMotion) {
        overviewMap.setView(HIGHLAND_CENTER, HIGHLAND_ZOOM, { animate: false });
      } else {
        overviewMap.flyTo(HIGHLAND_CENTER, HIGHLAND_ZOOM, { duration: 0.72 });
      }
    }
  } else if (activeStationId && activeStationId !== lastPannedStationId) {
    lastPannedStationId = activeStationId;
    const db = getDb();
    const st = db.stations.find(s => s.station_id === activeStationId);
    if (st && overviewMap.getBounds) {
      const safeBounds = overviewMap.getBounds().pad(-0.12);
      if (!safeBounds.contains([st.lat, st.lon])) {
        overviewMap.panTo([st.lat, st.lon], {
          animate: !reducedMotion,
          duration: 0.5
        });
      }
    }
  } else if (!activeStationId) {
    lastPannedStationId = null;
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

  // Keep DOM content populated for tests/province inspection, but hide floating overlay when Station Detail Panel is active
  if (state.previewStationId || state.stationId) {
    panel.classList.remove('active');
  } else {
    panel.classList.add('active');
  }
}

/**
 * Calculate approximate Haversine distance in km between two coordinates
 */
function calcDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

let currentPhotoReqId = 0;

/**
 * Retrieve station photo record from registry if present
 */
function getStationPhotoRecord(st, stationCode) {
  const db = getDb();
  if (!db || !db.stationPhotos) return null;
  const photos = db.stationPhotos.stations || db.stationPhotos;
  if (photos[st.station_id]) return photos[st.station_id];
  for (const key of Object.keys(photos)) {
    const r = photos[key];
    if (r && (r.station_id === st.station_id || r.station_code === stationCode || key.startsWith(stationCode + '|'))) {
      return r;
    }
  }
  return null;
}

/**
 * Update station photo slot dynamically with race-condition prevention:
 * - If verified photo exists in registry, renders verified image with shimmer and verified badge.
 * - If no verified photo, renders a tailored 2.5D dynamic station identity graphic card with
 *   transparent "ไม่มีภาพถ่ายสถานีที่ยืนยันได้" status badge and province contour styling.
 */
function updateStationPhotoSlot(st, stationCode) {
  const slot = document.getElementById('station-detail-photo-slot');
  if (!slot) return;

  const reqId = ++currentPhotoReqId;
  window.__currentPhotoReqId = reqId;

  const photoRecord = getStationPhotoRecord(st, stationCode);
  const isHrdi = String(st.source_type || '').includes('HRDI');

  const PROV_PALETTE = {
    'เชียงใหม่': '#16A9B3',
    'เชียงราย': '#0284C7',
    'แม่ฮ่องสอน': '#059669',
    'น่าน': '#D97706',
    'ตาก': '#7C3AED',
    'พิษณุโลก': '#DB2777',
    'เพชรบูรณ์': '#EA580C',
    'กำแพงเพชร': '#4B5563',
    'กาญจนบุรี': '#0D9488'
  };
  const provColor = PROV_PALETTE[st.province] || '#16A9B3';

  if (photoRecord && photoRecord.has_verified_photo) {
    slot.innerHTML = `
      <div class="station-thumb-frame verified-frame">
        <div class="station-thumb-skeleton"></div>
        <img 
          src="${photoRecord.image_path}" 
          alt="${photoRecord.alt_text || photoRecord.caption}" 
          class="station-thumb-img" 
          onload="if (${reqId} === window.__currentPhotoReqId) this.classList.add('visible');"
          onerror="this.style.display='none';"
        />
        <span class="station-photo-verified-pill">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;margin-right:3px;"><polyline points="20 6 9 17 4 12"></polyline></svg>
          ภาพถ่ายสถานียืนยันแล้ว
        </span>
      </div>
      <div class="station-photo-meta-bar">
        <span class="photo-caption-title">${photoRecord.caption}</span>
        <span class="photo-credit-sub">${photoRecord.source_name} · ${photoRecord.photo_credit} (${photoRecord.license})</span>
      </div>
    `;
  } else {
    slot.innerHTML = `
      <div class="station-dynamic-identity-card" style="border-left: 4px solid ${provColor};">
        <div class="sdi-header-row">
          <div class="sdi-brand-badge">
            <svg class="sdi-mountain-svg" viewBox="0 0 48 32" fill="none" stroke="${provColor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 28L18 8L26 20L34 11L44 28H4Z" fill="${provColor}15"/>
              <path d="M18 8L22 14L15 17L18 8Z" fill="${provColor}30"/>
              <path d="M34 11L37 16L32 18L34 11Z" fill="${provColor}30"/>
              <circle cx="39" cy="6" r="3" fill="#F5A269"/>
            </svg>
            <div class="sdi-code-box">
              <span class="sdi-code-text">${stationCode}</span>
              <span class="sdi-source-tag ${isHrdi ? 'hrdi' : 'owm'}">${isHrdi ? 'HRDI Station' : 'OWM Grid'}</span>
            </div>
          </div>
          <span class="sdi-status-badge">
            <span class="sdi-unverified-dot"></span>
            <span>ไม่มีภาพถ่ายสถานีที่ยืนยันได้</span>
          </span>
        </div>
        <div class="sdi-body-row">
          <div class="sdi-station-name">${st.station_name}</div>
          <div class="sdi-geo-meta">ต.${st.tambon || '-'} อ.${st.district || '-'} จ.${st.province}</div>
          <div class="sdi-coords-row">
            <span>📍 พิกัด: ${Number(st.lat).toFixed(4)}°N, ${Number(st.lon).toFixed(4)}°E</span>
          </div>
        </div>
      </div>
    `;
  }
}

/**
 * Render Interactive Station Detail Panel (Right column next to Map)
 * Matches Reference Image (Ice Blue Glassmorphism + Weather Station Thumbnail + 4 KPI Row + YoY Table)
 * with Smooth Slide/Fade Enter, In-Place KPI Count-Up Animations, and Smooth Station Switching.
 */
function renderStationDetailPanel(state) {
  const panel = document.getElementById('station-detail-panel');
  if (!panel) return;

  const db = getDb();
  const activeStationId = state.previewStationId || state.stationId;
  const st = activeStationId ? db.stations.find(s => s.station_id === activeStationId) : null;

  if (!st) {
    panel.dataset.renderedStationId = '';
    panel.classList.remove('station-panel-entering', 'station-panel-switching', 'station-panel-exiting');
    const scopeStations = getAvailableStations(state.province, state.district, state.tambon, state.weatherSource);
    const hrdiStations = scopeStations.filter(s => s.source_type === 'HRDI Weather Station');
    const owmStations = scopeStations.filter(s => s.source_type !== 'HRDI Weather Station');

    panel.innerHTML = `
      <div class="station-panel-empty">
        <div class="station-empty-top-badge">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
          <span>รายละเอียดสถานีตรวจวัด · ${scopeStations.length} สถานีในขอบเขต</span>
        </div>

        <h3 class="station-empty-title">คลิกจุดสถานีบนแผนที่เพื่อดูรายละเอียด</h3>
        <p class="station-empty-desc">
          สำรวจข้อมูลจริงระดับสถานีตรวจวัด (อุณหภูมิ ความชื้น ปริมาณน้ำฝน ความเร็วลม และตารางเปรียบเทียบปี 2022 กับ 2023) แล้วกดปุ่ม <strong>"ดูข้อมูลสถานีนี้"</strong> เพื่อเชื่อมโยงกราฟและ KPI ทั้ง Dashboard
        </p>

        <div class="station-empty-actions">
          <button type="button" id="btn-panel-toggle-stations" class="btn-station-primary-action" onclick="window.toggleMapStationsLayer()">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
            <span>${state.showMapStations ? 'จุดสถานีแสดงอยู่บนแผนที่แล้ว (คลิกจุดสถานีบนแผนที่)' : 'เปิดแสดงจุดสถานีตรวจวัดบนแผนที่ (50 แห่ง)'}</span>
          </button>
        </div>

        <div class="station-quick-pick-section">
          <div class="station-quick-pick-header">
            <span>หรือคลิกเลือกสถานีตรวจวัดโดยตรง (${scopeStations.length} สถานี):</span>
            <small>HRDI ${hrdiStations.length} · OWM ${owmStations.length}</small>
          </div>
          <div class="station-quick-pick-list">
            ${scopeStations.map(s => {
              const code = (s.station_id || '').split('|')[0];
              const isHrdi = s.source_type === 'HRDI Weather Station';
              return `
                <button type="button" class="station-quick-item" data-station-pick="${s.station_id}" onclick="window.previewStation('${s.station_id}')">
                  <div class="sq-left">
                    <span class="sq-code ${isHrdi ? 'hrdi' : 'owm'}">${code}</span>
                    <span class="sq-name">${s.station_name}</span>
                  </div>
                  <span class="sq-meta">จ.${s.province} · อ.${s.district || '-'}</span>
                </button>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
    return;
  }

  // Active Station Found: Compute 100% real metrics from stationMonthDashboard
  const stationCode = (st.station_id || '').split('|')[0] || st.station_id;
  const isApplied = state.stationId === st.station_id;
  const isHrdiSource = st.source_type === 'HRDI Weather Station';
  const prevRenderedStationId = panel.dataset.renderedStationId || '';

  const allStationRows = (db.stationMonthDashboard || db.hrdiStationMonth).filter(
    r => r.station_id === st.station_id && r.data_present !== false
  );
  const rowsSelectedMonths = allStationRows.filter(r => state.selectedMonths.includes(Number(r.month)));
  const rows2022 = rowsSelectedMonths.filter(r => Number(r.year) === 2022);
  const rows2023 = rowsSelectedMonths.filter(r => Number(r.year) === 2023);
  const activeRows = state.yearMode === '2022' ? rows2022
    : state.yearMode === '2023' ? rows2023
    : rowsSelectedMonths;

  const tempMean = calculateMean(activeRows, 'temp');
  const humMean = calculateMean(activeRows, 'humidity');
  const rainMean = calculateMean(activeRows, 'rainfall');
  const windMean = calculateMean(activeRows, 'wind_speed');

  const tempMins = activeRows.map(r => r.temp_min).filter(v => v !== null && v !== undefined && !Number.isNaN(Number(v)));
  const tempMaxs = activeRows.map(r => r.temp_max).filter(v => v !== null && v !== undefined && !Number.isNaN(Number(v)));
  const minTempVal = tempMins.length > 0 ? Math.min(...tempMins) : null;
  const maxTempVal = tempMaxs.length > 0 ? Math.max(...tempMaxs) : null;

  const rainSum = activeRows.reduce((acc, r) => acc + (r.rainfall !== null && r.rainfall !== undefined ? Number(r.rainfall) : 0), 0);
  const hs10kmSum = activeRows.reduce((acc, r) => acc + (Number(r.hotspots_within_10km) || 0), 0);

  // Fair YoY Comparison (2022 vs 2023) for this station across matched months in state.selectedMonths
  const matchedMonths = rows2022
    .filter(r22 => rows2023.some(r23 => Number(r23.month) === Number(r22.month)))
    .map(r => Number(r.month))
    .sort((a, b) => a - b);

  const yoyTemp = calculateFairHrdiYoY(rows2022, rows2023, 'temp');
  const yoyHum = calculateFairHrdiYoY(rows2022, rows2023, 'humidity');
  const yoyRain = calculateFairHrdiYoY(rows2022, rows2023, 'rainfall');
  const yoyWind = calculateFairHrdiYoY(rows2022, rows2023, 'wind_speed');

  const hs22Matched = rows2022.filter(r => matchedMonths.includes(Number(r.month))).reduce((s, r) => s + (Number(r.hotspots_within_10km) || 0), 0);
  const hs23Matched = rows2023.filter(r => matchedMonths.includes(Number(r.month))).reduce((s, r) => s + (Number(r.hotspots_within_10km) || 0), 0);
  const hsDiff = matchedMonths.length > 0 ? (hs23Matched - hs22Matched) : null;

  const fmtVal = (v, dec = 1) =>
    v === null || v === undefined || Number.isNaN(Number(v))
      ? 'ไม่มีข้อมูล'
      : `${dec === 0 ? formatInt(v) : formatNum(v, dec)}`;

  const fmtDiff = (yoyObj, dec = 1) => {
    if (!yoyObj || yoyObj.nPairs === 0 || yoyObj.diff === null) {
      return '<span class="st-na-note">N/A</span>';
    }
    const cls = yoyObj.diff > 0 ? 'pos' : yoyObj.diff < 0 ? 'neg' : 'neu';
    return `<strong class="st-diff-val ${cls}">${formatSignedDelta(yoyObj.diff, dec, '')}</strong>`;
  };

  // Find 3 closest stations so nearby markers can also be switched with 1 click
  const nearbyStations = db.stations
    .filter(other => other.station_id !== st.station_id && (state.weatherSource === 'all' || other.source_type === state.weatherSource))
    .map(other => ({
      ...other,
      code: (other.station_id || '').split('|')[0],
      distKm: calcDistanceKm(st.lat, st.lon, other.lat, other.lon)
    }))
    .sort((a, b) => a.distKm - b.distKm)
    .slice(0, 3);

  const periodText = state.yearMode === 'compare'
    ? 'ปี 2022–2023'
    : `ปี ${state.yearMode}`;

  const matchedMonthLabel = matchedMonths.length > 0
    ? `เปรียบเทียบ ${matchedMonths.length} คู่เดือนที่มีข้อมูลจริง (${matchedMonths.map(m => THAI_MONTH_NAMES[m - 1]).join(', ')})`
    : 'ไม่มีเดือนที่มีข้อมูลครบทั้งสองปีในช่วงที่เลือก (N/A)';

  // Ensure the skeleton of .station-detail-content exists so we can update in-place and animate KPIs smoothly
  if (!panel.querySelector('.station-detail-content')) {
    panel.innerHTML = `
      <div class="station-detail-content">
        <!-- TOP PANEL TITLE BAR (Matches Reference Image) -->
        <div class="station-panel-top-bar">
          <div class="station-panel-top-title">
            <span class="st-top-pin-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            </span>
            <span>รายละเอียดสถานีตรวจวัด</span>
            <span class="station-mode-status-pill" id="station-detail-status"></span>
          </div>
          <button type="button" id="btn-close-station-panel" class="panel-close-btn" onclick="window.closeStationDetailPanel()" title="ปิดรายละเอียดสถานี" aria-label="ปิดรายละเอียดสถานี">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <!-- STATION IDENTITY CARD WITH DYNAMIC PHOTO / 2.5D GRAPHIC -->
        <div class="station-identity-card">
          <div id="station-detail-photo-slot" class="station-detail-photo-slot"></div>
          <div class="station-identity-main">
            <div class="station-title-row">
              <span class="station-code-badge" style="display:none;">รหัสสถานี: <strong id="station-detail-code"></strong></span>
              <h3 class="station-detail-title">
                <span id="station-detail-code-inline" class="st-code-prefix"></span>
                <span> — </span>
                <span id="station-detail-name"></span>
                <span class="station-active-dot" aria-hidden="true"></span>
              </h3>
            </div>
            <div class="station-identity-meta-grid">
              <div class="station-identity-meta-left">
                <div class="station-meta-line">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#25D9F5" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                  <span id="station-detail-location"></span>
                </div>
                <div class="station-meta-line">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                  <strong id="station-detail-coords-val"></strong>
                  <span id="station-detail-records-note" class="st-records-inline"></span>
                </div>

              </div>
              <span class="station-source-badge" id="station-detail-source"></span>
            </div>
          </div>
        </div>

        <!-- 4 HORIZONTAL STATION KPI MINI-CARDS (Matches Reference Image) -->
        <div class="station-kpi-grid">
          <div class="station-kpi-mini-card">
            <div class="st-kpi-top">
              <span class="st-kpi-icon temp">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"></path></svg>
              </span>
              <span class="st-kpi-label">อุณหภูมิเฉลี่ย</span>
            </div>
            <div class="st-kpi-main">
              <strong id="station-kpi-temp-val">—</strong>
              <span class="st-kpi-unit" id="station-kpi-temp-unit">°C</span>
            </div>
            <div class="st-kpi-sub" id="station-kpi-temp-sub"></div>
          </div>

          <div class="station-kpi-mini-card">
            <div class="st-kpi-top">
              <span class="st-kpi-icon hum">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path></svg>
              </span>
              <span class="st-kpi-label">ความชื้นสัมพัทธ์</span>
            </div>
            <div class="st-kpi-main">
              <strong id="station-kpi-hum-val">—</strong>
              <span class="st-kpi-unit" id="station-kpi-hum-unit">%</span>
            </div>
            <div class="st-kpi-sub" id="station-kpi-hum-sub"></div>
          </div>

          <div class="station-kpi-mini-card">
            <div class="st-kpi-top">
              <span class="st-kpi-icon rain">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"></path><path d="M16 14v6"></path><path d="M8 14v6"></path><path d="M12 16v6"></path></svg>
              </span>
              <span class="st-kpi-label">ปริมาณฝน</span>
            </div>
            <div class="st-kpi-main">
              <strong id="station-kpi-rain-val">—</strong>
              <span class="st-kpi-unit" id="station-kpi-rain-unit">มม.</span>
            </div>
            <div class="st-kpi-sub" id="station-kpi-rain-sub"></div>
          </div>

          <div class="station-kpi-mini-card">
            <div class="st-kpi-top">
              <span class="st-kpi-icon wind">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"></path><path d="M9.6 4.6A2 2 0 1 1 11 8H2"></path><path d="M12.6 19.4A2 2 0 1 0 14 16H2"></path></svg>
              </span>
              <span class="st-kpi-label">ความเร็วลม</span>
            </div>
            <div class="st-kpi-main">
              <strong id="station-kpi-wind-val">—</strong>
              <span class="st-kpi-unit" id="station-kpi-wind-unit">m/s</span>
            </div>
            <div class="st-kpi-sub" id="station-kpi-wind-sub"></div>
          </div>
        </div>

        <!-- 2022 VS 2023 COMPARISON TABLE (Matches Reference Image) -->
        <div class="station-compare-box">
          <div class="station-compare-header">
            <strong>เปรียบเทียบปี 2022 กับ 2023 <span class="st-compare-sub-inline">(เฉพาะเดือนที่มีข้อมูลทั้งสองปี)</span></strong>
          </div>

          <table class="station-compare-table" id="station-yoy-compare-table">
            <thead>
              <tr>
                <th>ตัวชี้วัด</th>
                <th>ปี 2022</th>
                <th>ปี 2023</th>
                <th>ผลต่าง</th>
                <th>หน่วย</th>
              </tr>
            </thead>
            <tbody id="station-yoy-compare-tbody"></tbody>
          </table>

          <div class="station-compare-footer-note" id="station-compare-pair-note"></div>
        </div>

        <!-- NEARBY STATIONS QUICK SWITCHER -->
        <div id="station-nearby-container"></div>

        <!-- ACTION BUTTONS -->
        <div class="station-detail-actions">
          <button type="button" id="btn-apply-station-filter" class="btn-station-primary-action">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
            <span id="btn-apply-station-label">ดูข้อมูลสถานีนี้ (ตั้งเป็นตัวกรองสถานี) →</span>
          </button>

          <button type="button" id="btn-clear-station-filter" class="btn-station-secondary-action" onclick="window.clearStationFilter()">
            <span>✕ ยกเลิกการเลือกสถานี</span>
          </button>
        </div>
      </div>
    `;
  }

  // Apply smooth entrance or station-switch animation class when station changes
  if (!prevRenderedStationId) {
    panel.classList.remove('station-panel-switching', 'station-panel-exiting');
    panel.classList.add('station-panel-entering');
  } else if (prevRenderedStationId !== st.station_id) {
    panel.classList.remove('station-panel-entering', 'station-panel-exiting');
    panel.classList.remove('station-panel-switching');
    // Force reflow so switching animation replays cleanly
    void panel.offsetWidth;
    panel.classList.add('station-panel-switching');
  }
  panel.dataset.renderedStationId = st.station_id;

  // Populate identity fields in-place
  const codeEl = document.getElementById('station-detail-code');
  const codeInlineEl = document.getElementById('station-detail-code-inline');
  const nameEl = document.getElementById('station-detail-name');
  const locEl = document.getElementById('station-detail-location');
  const coordsEl = document.getElementById('station-detail-coords-val');
  const recNoteEl = document.getElementById('station-detail-records-note');
  const srcEl = document.getElementById('station-detail-source');
  const statusEl = document.getElementById('station-detail-status');

  if (codeEl) codeEl.textContent = stationCode;
  if (codeInlineEl) codeInlineEl.textContent = stationCode;
  if (nameEl) nameEl.textContent = st.station_name;
  if (locEl) locEl.textContent = `ต.${st.tambon || '-'} อ.${st.district || '-'} จ.${st.province}`;
  if (coordsEl) coordsEl.textContent = `${Number(st.lat).toFixed(5)}, ${Number(st.lon).toFixed(5)}`;
  if (recNoteEl) recNoteEl.textContent = `· ${activeRows.length} เดือน (${periodText})`;
  if (srcEl) {
    srcEl.textContent = st.source_type || 'OpenWeatherMap';
    srcEl.className = `station-source-badge ${isHrdiSource ? 'hrdi' : 'owm'}`;
  }
  if (statusEl) {
    statusEl.textContent = isApplied ? 'กำลังกรองข้อมูลสถานีนี้' : 'ดูตัวอย่างสถานี';
    statusEl.className = `station-mode-status-pill ${isApplied ? 'applied' : 'preview'}`;
  }

  // Update Dynamic Station Photo Slot or 2.5D Fallback Identity Card
  updateStationPhotoSlot(st, stationCode);

  // Animate the 4 Station KPI Mini-Cards with requestAnimationFrame + easeOutCubic!
  const kpiTempUnit = document.getElementById('station-kpi-temp-unit');
  const kpiTempSub = document.getElementById('station-kpi-temp-sub');
  if (kpiTempUnit) kpiTempUnit.textContent = tempMean.mean !== null ? '°C' : '';
  animateKpiValue('station-kpi-temp-val', tempMean.mean, { decimals: 1, duration: 880, fallback: 'ไม่มีข้อมูล' });
  if (kpiTempSub) {
    kpiTempSub.textContent = minTempVal !== null && maxTempVal !== null
      ? `ต่ำสุด ${formatNum(minTempVal, 1)} – สูงสุด ${formatNum(maxTempVal, 1)} °C`
      : `(${periodText})`;
  }

  const kpiHumUnit = document.getElementById('station-kpi-hum-unit');
  const kpiHumSub = document.getElementById('station-kpi-hum-sub');
  if (kpiHumUnit) kpiHumUnit.textContent = humMean.mean !== null ? '%' : '';
  animateKpiValue('station-kpi-hum-val', humMean.mean, { decimals: 1, duration: 880, fallback: 'ไม่มีข้อมูล' });
  if (kpiHumSub) {
    kpiHumSub.textContent = `(${periodText} · ${humMean.count} เดือน)`;
  }

  const kpiRainUnit = document.getElementById('station-kpi-rain-unit');
  const kpiRainSub = document.getElementById('station-kpi-rain-sub');
  if (kpiRainUnit) kpiRainUnit.textContent = rainMean.mean !== null ? 'มม.' : '';
  animateKpiValue('station-kpi-rain-val', rainMean.mean, { decimals: 1, duration: 900, fallback: 'ไม่มีข้อมูล' });
  if (kpiRainSub) {
    kpiRainSub.textContent = `สะสม ${formatNum(rainSum, 1)} มม.`;
  }

  const kpiWindUnit = document.getElementById('station-kpi-wind-unit');
  const kpiWindSub = document.getElementById('station-kpi-wind-sub');
  if (kpiWindUnit) kpiWindUnit.textContent = windMean.mean !== null ? 'm/s' : '';
  animateKpiValue('station-kpi-wind-val', windMean.mean, { decimals: 1, duration: 880, fallback: 'ไม่มีข้อมูล' });
  if (kpiWindSub) {
    kpiWindSub.innerHTML = `จุดความร้อน 10 กม.: <strong>${formatInt(hs10kmSum)} จุด</strong>`;
  }

  // Update 2022 vs 2023 Comparison Table in-place
  const tbodyEl = document.getElementById('station-yoy-compare-tbody');
  if (tbodyEl) {
    tbodyEl.innerHTML = `
      <tr>
        <td>อุณหภูมิเฉลี่ย</td>
        <td>${fmtVal(yoyTemp.val2022, 1)}</td>
        <td>${fmtVal(yoyTemp.val2023, 1)}</td>
        <td>${fmtDiff(yoyTemp, 1)}</td>
        <td class="st-unit-col">°C</td>
      </tr>
      <tr>
        <td>ความชื้นสัมพัทธ์</td>
        <td>${fmtVal(yoyHum.val2022, 1)}</td>
        <td>${fmtVal(yoyHum.val2023, 1)}</td>
        <td>${fmtDiff(yoyHum, 1)}</td>
        <td class="st-unit-col">%</td>
      </tr>
      <tr>
        <td>ปริมาณฝน</td>
        <td>${fmtVal(yoyRain.val2022, 1)}</td>
        <td>${fmtVal(yoyRain.val2023, 1)}</td>
        <td>${fmtDiff(yoyRain, 1)}</td>
        <td class="st-unit-col">มม.</td>
      </tr>
      <tr>
        <td>ความเร็วลมเฉลี่ย</td>
        <td>${fmtVal(yoyWind.val2022, 1)}</td>
        <td>${fmtVal(yoyWind.val2023, 1)}</td>
        <td>${fmtDiff(yoyWind, 1)}</td>
        <td class="st-unit-col">ม./วิ</td>
      </tr>
      <tr>
        <td>จุดความร้อนรัศมี 10 กม.</td>
        <td>${matchedMonths.length > 0 ? formatInt(hs22Matched) : 'ไม่มีข้อมูล'}</td>
        <td>${matchedMonths.length > 0 ? formatInt(hs23Matched) : 'ไม่มีข้อมูล'}</td>
        <td>${hsDiff !== null ? `<strong class="st-diff-val ${hsDiff > 0 ? 'pos' : hsDiff < 0 ? 'neg' : 'neu'}">${formatSignedDelta(hsDiff, 0, '')}</strong>` : '<span class="st-na-note">N/A</span>'}</td>
        <td class="st-unit-col">จุด</td>
      </tr>
    `;
  }

  const pairNoteEl = document.getElementById('station-compare-pair-note');
  if (pairNoteEl) {
    pairNoteEl.textContent = `จำนวนเดือนที่ใช้เปรียบเทียบ: ${matchedMonthLabel}`;
  }

  // Update Nearby Stations Quick Switcher
  const nearbyContainer = document.getElementById('station-nearby-container');
  if (nearbyContainer) {
    nearbyContainer.innerHTML = nearbyStations.length > 0 ? `
      <div class="station-nearby-bar">
        <span class="nearby-label">สลับไปสถานีใกล้เคียง:</span>
        <div class="nearby-pills">
          ${nearbyStations.map(ns => `
            <button type="button" class="nearby-station-pill" data-nearby-station="${ns.station_id}" onclick="window.previewStation('${ns.station_id}')">
              [${ns.code}] ${ns.station_name} (${ns.distKm.toFixed(1)} กม.)
            </button>
          `).join('')}
        </div>
      </div>
    ` : '';
  }

  // Update Apply Button state
  const applyBtn = document.getElementById('btn-apply-station-filter');
  const applyLbl = document.getElementById('btn-apply-station-label');
  if (applyBtn) {
    applyBtn.classList.toggle('is-applied', isApplied);
    applyBtn.setAttribute('onclick', `window.applyStationFilter('${st.station_id}')`);
  }
  if (applyLbl) {
    applyLbl.textContent = isApplied
      ? 'กำลังแสดงข้อมูลสถานีนี้ (ดูกราฟสถานีด้านล่าง)'
      : 'ดูข้อมูลสถานีนี้ (ตั้งเป็นตัวกรองสถานี) →';
  }
}

/**
 * Render Dedicated Station Charts Section (#station-charts-section) & 12-Month Record Table
 */
function renderStationDetailCharts(state) {
  const emptyBox = document.getElementById('station-charts-empty-state');
  const activeBody = document.getElementById('station-charts-active-body');
  const codeBadge = document.getElementById('station-charts-code-badge');
  const titleEl = document.getElementById('station-charts-title');
  const subtitleEl = document.getElementById('station-charts-subtitle');
  const takeawayEl = document.getElementById('station-chart-takeaway');
  const tableContainer = document.getElementById('station-monthly-records-table-container');

  if (!emptyBox || !activeBody) return;

  const db = getDb();
  const activeStationId = state.previewStationId || state.stationId;
  const st = activeStationId ? db.stations.find(s => s.station_id === activeStationId) : null;

  // Sync metric pill active state
  const currentStMetric = state.stationChartMetric || 'temp';
  document.querySelectorAll('.station-chart-metric-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-station-metric') === currentStMetric);
  });

  if (!st) {
    emptyBox.style.display = 'block';
    activeBody.style.display = 'none';
    if (codeBadge) codeBadge.textContent = 'ยังไม่ได้เลือกสถานี';
    if (titleEl) titleEl.textContent = 'กราฟแนวโน้มรายเดือนและเปรียบเทียบปี 2022–2023 รายสถานี';
    if (subtitleEl) subtitleEl.textContent = 'คลิกจุดสถานีบนแผนที่ด้านบนเพื่อดูกราฟแนวโน้มรายเดือนและเปรียบเทียบปี 2022 กับ 2023 ของสถานีนั้น';
    return;
  }

  emptyBox.style.display = 'none';
  activeBody.style.display = 'block';

  const stationCode = (st.station_id || '').split('|')[0] || st.station_id;
  if (codeBadge) codeBadge.textContent = `รหัส ${stationCode} · ${st.source_type}`;
  if (titleEl) titleEl.textContent = `กราฟข้อมูลรายเดือนและเปรียบเทียบปี: ${st.station_name}`;
  if (subtitleEl) {
    subtitleEl.textContent = `จ.${st.province} · อ.${st.district || '-'} · ต.${st.tambon || '-'} · พิกัด ${Number(st.lat).toFixed(4)}, ${Number(st.lon).toFixed(4)} · เดือนที่ไม่มีข้อมูลจะเว้นว่างไว้ (ไม่แทนค่าด้วย 0)`;
  }

  const metricCfgMap = {
    temp: { field: 'temp', label: 'อุณหภูมิเฉลี่ย', unit: '°C', dec: 1 },
    humidity: { field: 'humidity', label: 'ความชื้นสัมพัทธ์', unit: '%', dec: 1 },
    rainfall: { field: 'rainfall', label: 'ปริมาณน้ำฝนสถานี', unit: 'มม.', dec: 1 },
    wind_speed: { field: 'wind_speed', label: 'ความเร็วลมเฉลี่ย', unit: 'ม./วิ', dec: 1 }
  };
  const mCfg = metricCfgMap[currentStMetric] || metricCfgMap.temp;

  const lineHeading = document.getElementById('station-line-chart-heading');
  const barHeading = document.getElementById('station-bar-chart-heading');
  if (lineHeading) lineHeading.textContent = `แนวโน้ม${mCfg.label}รายเดือนของ${st.station_name} (${mCfg.unit})`;
  if (barHeading) barHeading.textContent = `เปรียบเทียบ${mCfg.label} ปี 2022 กับ 2023 รายเดือน (${mCfg.unit})`;

  const stRows = (db.stationMonthDashboard || db.hrdiStationMonth).filter(
    r => r.station_id === st.station_id && r.data_present !== false
  );
  const rows22 = stRows.filter(r => Number(r.year) === 2022);
  const rows23 = stRows.filter(r => Number(r.year) === 2023);

  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const labels = months.map(m => THAI_MONTH_NAMES[m - 1]);

  const series2022 = months.map(m => {
    const rec = rows22.find(r => Number(r.month) === m);
    return rec && rec[mCfg.field] !== null && rec[mCfg.field] !== undefined ? Number(rec[mCfg.field]) : null;
  });
  const series2023 = months.map(m => {
    const rec = rows23.find(r => Number(r.month) === m);
    return rec && rec[mCfg.field] !== null && rec[mCfg.field] !== undefined ? Number(rec[mCfg.field]) : null;
  });

  // 1. Station Monthly Trend Line Chart (2022 Orange vs 2023 Cyan)
  renderLineChart('station-detail-trend-chart', {
    labels,
    datasets: [
      {
        label: `ปี 2022 (${mCfg.label})`,
        data: series2022,
        borderColor: YEAR_COLORS.y2022,
        backgroundColor: YEAR_COLORS.y2022Bg,
        pointBackgroundColor: YEAR_COLORS.y2022,
        pointBorderColor: '#FFFFFF',
        pointBorderWidth: 1.8,
        pointRadius: 4.5,
        pointHoverRadius: 6.5,
        borderWidth: 2.6,
        tension: 0.3,
        spanGaps: false
      },
      {
        label: `ปี 2023 (${mCfg.label})`,
        data: series2023,
        borderColor: YEAR_COLORS.y2023,
        backgroundColor: YEAR_COLORS.y2023Bg,
        pointBackgroundColor: YEAR_COLORS.y2023,
        pointBorderColor: '#FFFFFF',
        pointBorderWidth: 1.8,
        pointRadius: 4.5,
        pointHoverRadius: 6.5,
        borderWidth: 2.6,
        tension: 0.3,
        spanGaps: false
      }
    ]
  }, {
    plugins: {
      tooltip: {
        callbacks: {
          title: (items) => items.length ? `${st.station_name} · เดือน${items[0].label}` : '',
          label: (ctx) => {
            const v = ctx.parsed.y;
            if (v === null || v === undefined || Number.isNaN(Number(v))) {
              return ` ${ctx.dataset.label}: ไม่มีข้อมูลตรวจวัด`;
            }
            return ` ${ctx.dataset.label}: ${formatNum(v, mCfg.dec)} ${mCfg.unit}`;
          }
        }
      }
    },
    scales: {
      y: {
        title: { display: true, text: `${mCfg.label} (${mCfg.unit})` }
      }
    }
  });

  // 2. Station 2022 vs 2023 Side-by-Side Monthly Comparison Bar Chart
  renderBarChart('station-detail-compare-chart', {
    labels,
    datasets: [
      {
        label: `ปี 2022 (${mCfg.unit})`,
        data: series2022,
        backgroundColor: YEAR_COLORS.y2022,
        borderRadius: 4
      },
      {
        label: `ปี 2023 (${mCfg.unit})`,
        data: series2023,
        backgroundColor: YEAR_COLORS.y2023,
        borderRadius: 4
      }
    ]
  }, {
    plugins: {
      tooltip: {
        callbacks: {
          title: (items) => items.length ? `${st.station_name} · เดือน${items[0].label}` : '',
          label: (ctx) => {
            const v = ctx.parsed.y;
            if (v === null || v === undefined || Number.isNaN(Number(v))) {
              return ` ${ctx.dataset.label}: ไม่มีข้อมูลตรวจวัด`;
            }
            return ` ${ctx.dataset.label}: ${formatNum(v, mCfg.dec)} ${mCfg.unit}`;
          }
        }
      }
    },
    scales: {
      y: {
        title: { display: true, text: `${mCfg.label} (${mCfg.unit})` }
      }
    }
  });

  // 2B. Companion 3rd Chart in the 3-column Station Analytics Grid (matches Reference Image)
  const secMetricKey = currentStMetric === 'humidity' ? 'temp' : 'humidity';
  const secCfg = metricCfgMap[secMetricKey];
  const secHeading = document.getElementById('station-secondary-chart-heading');
  if (secHeading) {
    secHeading.textContent = `${secCfg.label}รายเดือน ปี 2022 กับ 2023 (${secCfg.unit})`;
  }
  const sec2022 = months.map(m => {
    const rec = rows22.find(r => Number(r.month) === m);
    return rec && rec[secCfg.field] !== null && rec[secCfg.field] !== undefined ? Number(rec[secCfg.field]) : null;
  });
  const sec2023 = months.map(m => {
    const rec = rows23.find(r => Number(r.month) === m);
    return rec && rec[secCfg.field] !== null && rec[secCfg.field] !== undefined ? Number(rec[secCfg.field]) : null;
  });

  renderLineChart('station-detail-secondary-chart', {
    labels,
    datasets: [
      {
        label: `ปี 2022 (${secCfg.label})`,
        data: sec2022,
        borderColor: YEAR_COLORS.y2022,
        backgroundColor: YEAR_COLORS.y2022Bg,
        pointBackgroundColor: YEAR_COLORS.y2022,
        pointBorderColor: '#FFFFFF',
        pointBorderWidth: 1.6,
        pointRadius: 4,
        pointHoverRadius: 6,
        borderWidth: 2.4,
        tension: 0.3,
        fill: true,
        spanGaps: false
      },
      {
        label: `ปี 2023 (${secCfg.label})`,
        data: sec2023,
        borderColor: YEAR_COLORS.y2023,
        backgroundColor: YEAR_COLORS.y2023Bg,
        pointBackgroundColor: YEAR_COLORS.y2023,
        pointBorderColor: '#FFFFFF',
        pointBorderWidth: 1.6,
        pointRadius: 4,
        pointHoverRadius: 6,
        borderWidth: 2.4,
        tension: 0.3,
        fill: true,
        spanGaps: false
      }
    ]
  }, {
    plugins: {
      tooltip: {
        callbacks: {
          title: (items) => items.length ? `${st.station_name} · เดือน${items[0].label}` : '',
          label: (ctx) => {
            const v = ctx.parsed.y;
            if (v === null || v === undefined || Number.isNaN(Number(v))) {
              return ` ${ctx.dataset.label}: ไม่มีข้อมูลตรวจวัด`;
            }
            return ` ${ctx.dataset.label}: ${formatNum(v, secCfg.dec)} ${secCfg.unit}`;
          }
        }
      }
    },
    scales: {
      y: {
        title: { display: true, text: `${secCfg.label} (${secCfg.unit})` }
      }
    }
  });

  // 3. Plain-language takeaway for the selected station
  if (takeawayEl) {
    const yoy = calculateFairHrdiYoY(
      rows22.filter(r => state.selectedMonths.includes(Number(r.month))),
      rows23.filter(r => state.selectedMonths.includes(Number(r.month))),
      mCfg.field
    );
    if (yoy.nPairs > 0 && yoy.diff !== null) {
      const dir = yoy.diff > 0 ? 'เพิ่มขึ้น' : yoy.diff < 0 ? 'ลดลง' : 'ไม่เปลี่ยนแปลง';
      takeawayEl.innerHTML = `<strong>สรุปข้อมูลจริงของ${st.station_name} (${stationCode}):</strong> ในช่วงคู่เดือนที่ตรงกัน ${yoy.nPairs} เดือน ค่า${mCfg.label}ปี 2022 เฉลี่ยอยู่ที่ <strong>${formatNum(yoy.val2022, 1)} ${mCfg.unit}</strong> และปี 2023 เฉลี่ยอยู่ที่ <strong>${formatNum(yoy.val2023, 1)} ${mCfg.unit}</strong> (${dir} <strong>${formatSignedDelta(yoy.diff, 1, mCfg.unit)}</strong>)`;
    } else {
      takeawayEl.innerHTML = `<strong>สรุปข้อมูลจริงของ${st.station_name} (${stationCode}):</strong> ไม่มีคู่เดือนที่มีข้อมูลครบทั้งปี 2022 และ 2023 ในช่วงเดือนที่เลือก จึงไม่คำนวณผลต่างข้ามปี`;
    }
  }

  // 4. Populate Section 3 Expandable 12-Month Table for the selected station
  if (tableContainer) {
    tableContainer.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>เดือน</th>
            <th class="num">อุณหภูมิ 2022 (°C)</th>
            <th class="num">อุณหภูมิ 2023 (°C)</th>
            <th class="num">ความชื้น 2022 (%)</th>
            <th class="num">ความชื้น 2023 (%)</th>
            <th class="num">ฝนสถานี 2022 (มม.)</th>
            <th class="num">ฝนสถานี 2023 (มม.)</th>
            <th class="num">ลม 2022 (ม./วิ)</th>
            <th class="num">ลม 2023 (ม./วิ)</th>
            <th class="num">จุดความร้อน 10 กม. (2022 / 2023)</th>
          </tr>
        </thead>
        <tbody>
          ${months.map(m => {
            const r22 = rows22.find(r => Number(r.month) === m);
            const r23 = rows23.find(r => Number(r.month) === m);
            const cell = (rec, f, d = 1) =>
              rec && rec[f] !== null && rec[f] !== undefined
                ? formatNum(rec[f], d)
                : '<span style="color:#94A3B8;">ไม่มีข้อมูล</span>';
            const hs22Str = r22 && r22.hotspots_within_10km !== undefined ? formatInt(r22.hotspots_within_10km) : '—';
            const hs23Str = r23 && r23.hotspots_within_10km !== undefined ? formatInt(r23.hotspots_within_10km) : '—';
            return `
              <tr>
                <td><strong>${THAI_MONTH_NAMES[m - 1]}</strong></td>
                <td class="num">${cell(r22, 'temp', 1)}</td>
                <td class="num">${cell(r23, 'temp', 1)}</td>
                <td class="num">${cell(r22, 'humidity', 1)}</td>
                <td class="num">${cell(r23, 'humidity', 1)}</td>
                <td class="num">${cell(r22, 'rainfall', 1)}</td>
                <td class="num">${cell(r23, 'rainfall', 1)}</td>
                <td class="num">${cell(r22, 'wind_speed', 1)}</td>
                <td class="num">${cell(r23, 'wind_speed', 1)}</td>
                <td class="num">${hs22Str} / ${hs23Str}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }
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
