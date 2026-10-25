/**
 * hotspots.js — Page 3 (Q3): จุดความร้อน (Hotspot Explorer - Q5)
 * Highland Climate & Hotspot Intelligence Platform (2022–2023)
 */

import { getState, setState, DEFAULT_MONTHS_COMPARE, ALL_MONTHS } from '../state.js';
import { loadHotspotsForWindow } from '../data-loader.js';
import {
  getFilteredHotspotCount,
  getHotspotMonthlySeries,
  getHotspotByLanduseBreakdown,
  getHotspotByElevationBreakdown,
  getHotspotByProjectBreakdown,
  getHotspotByDistrictBreakdown,
  filterRawHotspotEvents
} from '../filters.js';
import {
  calculateHotspotYoY,
  formatInt,
  formatSignedDelta
} from '../calculations.js';
import {
  initLeafletMap,
  renderThailandProvinceMap,
  renderHotspotLayer
} from '../maps.js';
import {
  renderLineChart,
  renderBarChart,
  renderDoughnutChart,
  THAI_MONTH_NAMES,
  YEAR_COLORS
} from '../charts.js';
import { animateKpiValue } from '../animations.js';
import { renderDrilldownBar } from '../drilldown.js';

let hotspotMap = null;
let currentBaseGeoLayer = null;
let currentHotspotLayer = null;
let currentHotspotMapRequestId = 0;

/**
 * Initialize or update Page 3 (Q3): Hotspot Explorer
 */
export async function renderHotspotsPage() {
  const state = getState();

  const count2022 = getFilteredHotspotCount(state, 2022);
  const count2023 = getFilteredHotspotCount(state, 2023);
  const totalCount = state.yearMode === '2022' ? count2022
    : state.yearMode === '2023' ? count2023
    : count2022 + count2023;

  renderHotspotKpis(state, count2022, count2023, totalCount);

  // 1. Render Monthly Temporal Distribution (Q5) — respects all active hotspot filters
  renderHotspotTemporalChart(state);

  // 2. Render Land Use Distribution (Interactive click-to-filter)
  renderHotspotLanduseChart(state);

  // 3. Render Elevation & Project Distribution (Interactive click-to-filter)
  renderHotspotElevationAndProjectCharts(state);

  // 4. Render District Drilldown Ranking (Interactive click-to-filter)
  renderHotspotDistrictRanking(state);
  renderDrilldownBar('hotspots-district-drilldown-bar');

  // 5. Render Dynamic Key Insights (Q3)
  renderHotspotInsights(state, count2022, count2023, totalCount);

  // 6. Render Hotspot Map with Lazy-loaded Partitions and Race-Condition Guard
  await renderHotspotsPointMap(state, totalCount);
}

function renderHotspotInsights(state, count2022, count2023, totalCount) {
  const insightEl = document.getElementById('insight-q3');
  if (!insightEl) return;

  if (totalCount === 0) {
    insightEl.textContent = 'ไม่พบจุดความร้อนภายใต้เงื่อนไขตัวกรองที่เลือก';
    return;
  }

  const distList = getHotspotByDistrictBreakdown(state, false);
  const luList = getHotspotByLanduseBreakdown(state, false);
  const elevBd = getHotspotByElevationBreakdown(state, false);

  const topDist = distList[0];
  const topLu = luList[0];
  const highPct = ((elevBd.highTotal / totalCount) * 100).toFixed(1);

  const parts = [`พบจุดความร้อนรวม ${formatInt(totalCount)} จุด โดยร้อยละ ${highPct} อยู่บนพื้นที่สูง (>500 เมตร)`];
  if (topDist) {
    parts.push(`อำเภอที่พบมากที่สุดคือ อ.${topDist.district} จ.${topDist.province} (${formatInt(topDist.total)} จุด)`);
  }
  if (topLu) {
    parts.push(`และส่วนใหญ่อยู่ในเขต${topLu.landuse} (${formatInt(topLu.total)} จุด)`);
  }
  insightEl.textContent = parts.join(' · ');
}

/**
 * Render Hotspot Summary KPI Cards
 */
function renderHotspotKpis(state, count2022, count2023, totalCount) {
  const totalValEl = document.getElementById('hotspots-total-kpi-val');
  const totalSubEl = document.getElementById('hotspots-total-kpi-sub');

  const elevBd = getHotspotByElevationBreakdown(state, false);
  const projBd = getHotspotByProjectBreakdown(state, false);

  const highValEl = document.getElementById('hotspots-high-elev-kpi-val');
  const projValEl = document.getElementById('hotspots-in-project-kpi-val');
  if (highValEl) {
    const pct = totalCount > 0 ? ((elevBd.highTotal / totalCount) * 100).toFixed(1) : '0.0';
    animateKpiValue(highValEl, elevBd.highTotal, { decimals: 0, duration: 900, suffix: ` (${pct}%)`, fallback: '0 (0.0%)' });
  }
  if (projValEl) {
    const pct = totalCount > 0 ? ((projBd.inTotal / totalCount) * 100).toFixed(1) : '0.0';
    animateKpiValue(projValEl, projBd.inTotal, { decimals: 0, duration: 900, suffix: ` (${pct}%)`, fallback: '0 (0.0%)' });
  }

  if (totalValEl) {
    animateKpiValue(totalValEl, totalCount, { decimals: 0, duration: 940, fallback: '0' });
  }
  if (totalSubEl) {
    if (state.yearMode === 'compare') {
      const yoy = calculateHotspotYoY(count2022, count2023);
      const cls = yoy.diff > 0 ? 'positive' : yoy.diff < 0 ? 'negative' : 'neutral';
      const pctTxt = yoy.pctChange !== null ? formatSignedDelta(yoy.pctChange, 1, '%') : 'ปีฐานเป็น 0';
      totalSubEl.innerHTML = `
        <span class="kpi-delta ${cls}">YoY ${formatSignedDelta(yoy.diff, 0)} รายการ (${pctTxt})</span>
        <span>(ปี 2022: ${formatInt(count2022)} | ปี 2023: ${formatInt(count2023)})</span>
      `;
    } else {
      totalSubEl.textContent = `จำนวนรายการตรวจพบจากดาวเทียม VIIRS ปี ${state.yearMode} (ตรงกันทุกกราฟและแผนที่)`;
    }
  }
}

/**
 * Render Monthly Temporal Distribution Chart (Q5)
 * Respects province, district, tambon, elevation, landuse, and project filters!
 */
function renderHotspotTemporalChart(state) {
  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const labels = months.map(m => THAI_MONTH_NAMES[m - 1]);
  const selectedSet = new Set(state.selectedMonths);

  const counts2022 = getHotspotMonthlySeries(state, 2022, false);
  const counts2023 = getHotspotMonthlySeries(state, 2023, false);

  const pointRadii = months.map(m => selectedSet.has(m) ? 5.5 : 3);
  const datasets = [];

  if (state.yearMode === '2022' || state.yearMode === 'compare') {
    datasets.push({
      label: 'ปี 2022 (รายการตรวจพบ)',
      data: counts2022,
      borderColor: YEAR_COLORS.y2022,
      backgroundColor: YEAR_COLORS.y2022Bg,
      pointBackgroundColor: months.map(m => selectedSet.has(m) ? YEAR_COLORS.y2022 : '#FFFFFF'),
      pointBorderColor: YEAR_COLORS.y2022,
      tension: 0.3,
      fill: true,
      pointRadius: pointRadii
    });
  }

  if (state.yearMode === '2023' || state.yearMode === 'compare') {
    datasets.push({
      label: 'ปี 2023 (รายการตรวจพบ)',
      data: counts2023,
      borderColor: '#FA714A',
      backgroundColor: 'rgba(250, 113, 74, 0.18)',
      pointBackgroundColor: months.map(m => selectedSet.has(m) ? '#FA714A' : '#FFFFFF'),
      pointBorderColor: '#FA714A',
      tension: 0.3,
      fill: true,
      pointRadius: pointRadii
    });
  }

  renderLineChart('hotspots-monthly-chart', {
    labels,
    datasets
  }, {
    onClick: (evt, elements) => {
      if (elements && elements.length > 0) {
        const clickedMonth = elements[0].index + 1;
        const isOnlyThisMonth = state.selectedMonths.length === 1 && state.selectedMonths[0] === clickedMonth;
        setState({
          selectedMonths: isOnlyThisMonth
            ? (state.yearMode === 'compare' ? [...DEFAULT_MONTHS_COMPARE] : [...ALL_MONTHS])
            : [clickedMonth]
        });
      }
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: (context) => ` ${context.dataset.label}: ${formatInt(context.parsed.y)} รายการ`
        }
      }
    },
    scales: {
      y: {
        title: { display: true, text: 'จำนวนรายการตรวจพบดาวเทียม (คลิกจุดเดือนเพื่อกรอง)' }
      }
    }
  });
}

/**
 * Render Land Use Breakdown (Doughnut Chart) — Multidimensional AND + Click-to-Filter
 */
function renderHotspotLanduseChart(state) {
  const list = getHotspotByLanduseBreakdown(state, false);
  const labels = list.map(item => item.landuse);
  const data = list.map(item => item.total);

  const palette = [
    '#0B96B5', '#168B68', '#168FD1', '#F59E0B',
    '#FA714A', '#6366F1', '#43627A', '#D97706'
  ];

  renderDoughnutChart('hotspots-landuse-chart', {
    labels,
    datasets: [{
      data,
      backgroundColor: palette.slice(0, labels.length),
      borderWidth: 2,
      borderColor: '#EAF8FE'
    }]
  }, {
    onClick: (evt, elements) => {
      if (elements && elements.length > 0) {
        const idx = elements[0].index;
        const clickedLu = labels[idx];
        if (clickedLu) {
          setState({ landuse: state.landuse === clickedLu ? 'all' : clickedLu });
        }
      }
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: (context) => ` ${context.label}: ${formatInt(context.parsed)} รายการ (คลิกเพื่อกรอง/ยกเลิก)`
        }
      }
    }
  });
}

/**
 * Render Elevation & Project Distribution — Multidimensional AND + Click-to-Filter
 */
function renderHotspotElevationAndProjectCharts(state) {
  const elev = getHotspotByElevationBreakdown(state, false);
  const elevLabels = ['สูงกว่า 500 ม. (พื้นที่สูง)', 'ไม่เกิน 500 ม. (พื้นที่ราบ/เชิงเขา)'];
  const elevKeys = ['high', 'low'];

  renderDoughnutChart('hotspots-elevation-chart', {
    labels: elevLabels,
    datasets: [{
      data: [elev.highTotal, elev.lowTotal],
      backgroundColor: ['#0B96B5', '#64748B'],
      borderWidth: 2,
      borderColor: '#EAF8FE'
    }]
  }, {
    onClick: (evt, elements) => {
      if (elements && elements.length > 0) {
        const idx = elements[0].index;
        const targetKey = elevKeys[idx];
        if (targetKey) {
          setState({ hotspotElevation: state.hotspotElevation === targetKey ? 'all' : targetKey });
        }
      }
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: (context) => ` ${context.label}: ${formatInt(context.parsed)} รายการ (คลิกเพื่อกรอง/ยกเลิก)`
        }
      }
    }
  });

  const proj = getHotspotByProjectBreakdown(state, false);
  const projLabels = ['นอกพื้นที่โครงการ HRDI', 'ในพื้นที่โครงการ HRDI'];
  const projKeys = ['outside', 'in_project'];

  renderDoughnutChart('hotspots-project-chart', {
    labels: projLabels,
    datasets: [{
      data: [proj.outTotal, proj.inTotal],
      backgroundColor: ['#E67E22', '#168B68'],
      borderWidth: 2,
      borderColor: '#EAF8FE'
    }]
  }, {
    onClick: (evt, elements) => {
      if (elements && elements.length > 0) {
        const idx = elements[0].index;
        const targetKey = projKeys[idx];
        if (targetKey) {
          setState({ hotspotProject: state.hotspotProject === targetKey ? 'all' : targetKey });
        }
      }
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: (context) => ` ${context.label}: ${formatInt(context.parsed)} รายการ (คลิกเพื่อกรอง/ยกเลิก)`
        }
      }
    }
  });
}

/**
 * Render District Drilldown Ranking (Top 12 Districts) — Multidimensional AND + Click-to-Filter
 */
function renderHotspotDistrictRanking(state) {
  const isAsc = state.districtRankOrder === 'asc';
  const list = getHotspotByDistrictBreakdown(state, false);
  const sortedList = [...list].sort((a, b) => isAsc ? (a.total - b.total) : (b.total - a.total));
  const topList = sortedList.slice(0, 12);
  const labels = topList.map((item, i) => `${i + 1}. อ.${item.district} (${item.province})`);
  const data = topList.map(item => item.total);

  const btnDesc = document.getElementById('btn-district-rank-desc');
  const btnAsc = document.getElementById('btn-district-rank-asc');
  if (btnDesc && btnAsc) {
    btnDesc.classList.toggle('active', !isAsc);
    btnAsc.classList.toggle('active', isAsc);
  }

  const titleEl = document.getElementById('hotspots-district-ranking-title');
  if (titleEl) {
    titleEl.textContent = isAsc
      ? 'อำเภอไหนพบจุดความร้อนน้อยที่สุด?'
      : 'อำเภอไหนพบจุดความร้อนมากที่สุด?';
  }

  const subEl = document.getElementById('hotspots-district-ranking-sub');
  if (subEl) {
    const dirTxt = isAsc ? 'น้อยไปมาก' : 'มากไปน้อย';
    subEl.textContent = `แสดง 12 อันดับ (${dirTxt}) · คลิกแท่งอำเภอเพื่อกรองจังหวัดและอำเภอ`;
  }

  renderBarChart('hotspots-district-ranking-chart', {
    labels,
    datasets: [{
      label: 'จำนวนรายการตรวจพบจุดความร้อน',
      data,
      districtItems: topList,
      backgroundColor: topList.map(d => (state.district === d.district && state.province === d.province) ? '#D97706' : '#FA714A'),
      borderRadius: 5
    }]
  }, {
    indexAxis: 'y',
    showValueLabels: true,
    valueLabelFormatter: (v) => formatInt(v),
    onClick: (evt, elements, chart) => {
      if (elements && elements.length > 0) {
        const idx = elements[0].index;
        const item = chart?.data?.datasets?.[0]?.districtItems?.[idx] || topList[idx];
        if (item) {
          const isSame = state.province === item.province && state.district === item.district;
          setState({
            province: item.province,
            district: isSame ? null : item.district
          });
        }
      }
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: (context) => ` ${formatInt(context.parsed.x)} รายการ (คลิกเพื่อกรองอำเภอ)`
        }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'จำนวนรายการตรวจพบดาวเทียม (คลิกแท่งเพื่อเลือกอำเภอ)'
        }
      }
    }
  });
}

/**
 * Render Selected Hotspot Event Detail Card when a Marker is clicked
 */
function updateSelectedHotspotDetailCard(e) {
  const detailEl = document.getElementById('hotspots-selected-event-detail');
  if (!detailEl || !e) return;
  detailEl.innerHTML = `
    <div class="selected-event-grid">
      <div><strong>รหัสจุดตรวจพบ:</strong> #${e.hotspot_id}</div>
      <div><strong>วันที่ตรวจพบ:</strong> ${e.date}</div>
      <div><strong>พิกัด (Lat, Lon):</strong> ${e.lat.toFixed(4)}, ${e.lon.toFixed(4)}</div>
      <div><strong>พื้นที่:</strong> จ.${e.province} · อ.${e.district} · ต.${e.tambon} ${e.village ? `(${e.village})` : ''}</div>
      <div><strong>ระดับความสูง:</strong> ${e.elevationCategory}</div>
      <div><strong>การใช้ประโยชน์ที่ดิน:</strong> ${e.landuse}</div>
      <div><strong>พื้นที่โครงการ HRDI:</strong> ${e.projectCategory}</div>
      <div><strong>พลังงานความร้อน (FRP):</strong> ${e.frp !== null ? `${e.frp.toFixed(2)} MW` : 'ไม่ระบุ'} · ดาวเทียม ${e.satellite} (${e.confidence})</div>
    </div>
  `;
}

/**
 * Render Hotspot Point/Cluster Map with Lazy Partition Loading & Async Race-Condition Token Guard
 */
async function renderHotspotsPointMap(state, exactTotalCount) {
  if (!hotspotMap) {
    hotspotMap = initLeafletMap('hotspots-map-container');
  }
  if (!hotspotMap) return;

  const reqId = ++currentHotspotMapRequestId;

  const countStatusEl = document.getElementById('hotspots-map-count-badge');
  if (countStatusEl && typeof exactTotalCount === 'number') {
    const cappedNote = exactTotalCount > 2500 ? ' (แสดงคลัสเตอร์สูงสุด 2,500 จุดเพื่อความลื่นไหล)' : '';
    countStatusEl.textContent = `พบ ${formatInt(exactTotalCount)} รายการตรวจพบตามตัวกรอง${cappedNote}`;
  }

  // Debounce rapid filter switches by 35ms so synchronous multi-filter clicks only render once
  await new Promise(resolve => setTimeout(resolve, 35));
  if (reqId !== currentHotspotMapRequestId || getState().activeTab !== 'hotspots') {
    return;
  }

  hotspotMap.invalidateSize();

  // Render province boundaries as context
  if (currentBaseGeoLayer) {
    hotspotMap.removeLayer(currentBaseGeoLayer);
  }
  currentBaseGeoLayer = renderThailandProvinceMap(hotspotMap, {
    metric: 'hotspots',
    showLabels: false,
    onSelectProvince: (nextProv) => {
      setState({ province: nextProv });
    }
  });

  const statusEl = document.getElementById('hotspots-map-loading-indicator');
  if (statusEl) statusEl.style.display = 'block';

  try {
    const yearsToLoad = state.yearMode === 'compare' ? [2022, 2023] : [Number(state.yearMode)];
    const rawEvents = await loadHotspotsForWindow(yearsToLoad, state.selectedMonths);

    // Discard stale async response if filters or active tab changed while loading (Test 17 safeguard)
    if (reqId !== currentHotspotMapRequestId || getState().activeTab !== 'hotspots') {
      return;
    }

    const filteredEvents = filterRawHotspotEvents(rawEvents, state);

    if (currentHotspotLayer) {
      hotspotMap.removeLayer(currentHotspotLayer);
    }
    currentHotspotLayer = renderHotspotLayer(hotspotMap, filteredEvents, (clickedEvent) => {
      updateSelectedHotspotDetailCard(clickedEvent);
    });

    if (countStatusEl) {
      const cappedNote = filteredEvents.length > 2500 ? ' (แสดงคลัสเตอร์สูงสุด 2,500 จุดเพื่อความลื่นไหล)' : '';
      countStatusEl.textContent = `พบ ${formatInt(filteredEvents.length)} รายการตรวจพบตามตัวกรอง${cappedNote}`;
    }

    if (filteredEvents.length > 0) {
      updateSelectedHotspotDetailCard(filteredEvents[0]);
    } else {
      const detailEl = document.getElementById('hotspots-selected-event-detail');
      if (detailEl) detailEl.textContent = 'ไม่พบจุดความร้อนตามตัวกรองที่เลือก';
    }
  } catch (err) {
    console.error('Error loading hotspot points for map:', err);
  } finally {
    if (reqId === currentHotspotMapRequestId && statusEl) {
      statusEl.style.display = 'none';
    }
  }
}
