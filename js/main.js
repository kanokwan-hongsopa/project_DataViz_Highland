/**
 * main.js — Application Entry Point, Global Filter Bar, Cross-Filtering & Tab Orchestration
 * Highland Climate & Hotspot Intelligence Platform (2022–2023)
 */

import {
  getState,
  setState,
  subscribe,
  resetFilters,
  DEFAULT_MONTHS_COMPARE,
  ALL_MONTHS
} from './state.js';
import { loadCoreData, getDb } from './data-loader.js';
import {
  getAvailableProvinces,
  getAvailableDistricts,
  getAvailableTambons,
  getAvailableStations,
  getAvailableLanduses,
  getAvailableProjects,
  filterStationMonthRecords
} from './filters.js';
import { THAI_MONTH_NAMES, FULL_THAI_MONTH_NAMES, resizeAllCharts } from './charts.js';
import { invalidateAllMaps } from './maps.js';

// Page Renderers (Q1–Q5)
import { renderOverviewPage } from './pages/overview.js';
import { renderClimatePage } from './pages/climate.js';
import { renderRainfallPage } from './pages/rainfall.js';
import { renderHotspotsPage } from './pages/hotspots.js';
import { renderCorrelationPage } from './pages/correlation.js';

/**
 * Main application bootstrap
 */
async function initApp() {
  const loadingOverlay = document.getElementById('app-loading-overlay');
  const loadingText = document.getElementById('app-loading-text');

  try {
    // 1. Load core datasets, multidimensional hotspot index & Thailand 77 provinces GeoJSON
    await loadCoreData((percent, message) => {
      if (loadingText) loadingText.textContent = `${message} (${percent}%)`;
    });

    // 2. Setup global UI elements & filter controls
    setupNavigationTabs();
    setupYearFilter();
    setupMonthPicker();
    setupAdvancedFiltersToggle();
    setupGeographicFilters();
    setupWeatherSourceFilter();
    setupMetricFilter();
    setupHotspotFilters();
    setupResetButton();
    setupOverviewControls();
    setupInfoPopovers();
    setupGlobalWindowHelpers();

    // 3. Subscribe renderers to state changes
    subscribe((currentState) => {
      const sanitized = validateAndSanitizeCascadingState(currentState);
      if (sanitized) return; // setState was called with cleaned child filters
      updateFilterControls(currentState);
      renderActiveChips(currentState);
      renderCurrentPage(currentState);
    });

    // 4. Initial UI sync & first render
    const initialState = getState();
    updateFilterControls(initialState);
    renderActiveChips(initialState);
    renderCurrentPage(initialState);

    // Hide loading overlay
    if (loadingOverlay) {
      loadingOverlay.style.opacity = '0';
      setTimeout(() => {
        loadingOverlay.style.display = 'none';
        invalidateAllMaps();
        resizeAllCharts();
      }, 280);
    }
  } catch (err) {
    console.error('Fatal initialization error:', err);
    if (loadingText) {
      loadingText.innerHTML = `
        <span style="color: #E11D48; font-weight: 700;">เกิดข้อผิดพลาดในการโหลดข้อมูล</span><br>
        <span style="font-size: 0.82rem; color: #173A55;">${err.message}</span><br>
        <button type="button" onclick="location.reload()" style="margin-top: 10px; padding: 6px 14px; background: #0B96B5; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">ลองใหม่อีกครั้ง</button>
      `;
    }
  }
}

/**
 * Validate that active child filters (district, tambon, stationId) exist in current context/weatherSource.
 * Never silently retain invalid filter values!
 */
function validateAndSanitizeCascadingState(state) {
  const updates = {};
  const notices = [];

  const validDistricts = getAvailableDistricts(state.province, state.activeTab, state.weatherSource);
  if (state.district && !validDistricts.includes(state.district)) {
    notices.push(`ล้างตัวกรองอำเภอ "${state.district}" เนื่องจากไม่มีสถานีในบริบท/แหล่งข้อมูลที่เลือก`);
    updates.district = null;
    updates.tambon = null;
    updates.stationId = null;
  }

  const effDistrict = updates.district !== undefined ? updates.district : state.district;
  const validTambons = getAvailableTambons(state.province, effDistrict, state.activeTab, state.weatherSource);
  if (state.tambon && !validTambons.includes(state.tambon)) {
    notices.push(`ล้างตัวกรองตำบล "${state.tambon}" เนื่องจากไม่อยู่ในขอบเขตปัจจุบัน`);
    updates.tambon = null;
    updates.stationId = null;
  }

  const effTambon = updates.tambon !== undefined ? updates.tambon : state.tambon;
  const validStations = getAvailableStations(state.province, effDistrict, effTambon, state.weatherSource);
  if (state.stationId && !validStations.some(s => s.station_id === state.stationId)) {
    notices.push(`ล้างตัวกรองสถานี เนื่องจากไม่อยู่ในแหล่งข้อมูล/พื้นที่ที่เลือก`);
    updates.stationId = null;
  }

  const noticeEl = document.getElementById('filter-scope-notice');
  if (notices.length > 0 && noticeEl) {
    noticeEl.textContent = notices.join(' · ');
    noticeEl.style.display = 'inline-flex';
    clearTimeout(window._scopeNoticeTimer);
    window._scopeNoticeTimer = setTimeout(() => {
      noticeEl.style.display = 'none';
    }, 5000);
  }

  if (Object.keys(updates).length > 0) {
    setState(updates);
    return true;
  }
  return false;
}

/**
 * Render the currently active page/tab and resize maps/charts cleanly
 */
function renderCurrentPage(state) {
  const activeTab = state.activeTab;

  const pages = document.querySelectorAll('.page-view');
  pages.forEach(p => p.classList.remove('active'));

  const activePageEl = document.getElementById(`page-${activeTab}`);
  if (activePageEl) activePageEl.classList.add('active');

  // Sync top navigation tab active class
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === activeTab);
  });

  switch (activeTab) {
    case 'overview':
      renderOverviewPage();
      break;
    case 'climate':
      renderClimatePage();
      break;
    case 'hotspots':
      renderHotspotsPage();
      break;
    case 'correlation':
      renderCorrelationPage();
      break;
    case 'rainfall':
    case 'quality':
      renderRainfallPage();
      break;
  }

  // Ensure Leaflet maps and Chart.js canvases recalculate dimensions after tab visibility changes
  requestAnimationFrame(() => {
    invalidateAllMaps();
    resizeAllCharts();
  });
}

/**
 * Setup Top Navigation Tabs (Q1–Q5)
 */
function setupNavigationTabs() {
  const tabButtons = document.querySelectorAll('.nav-tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      if (targetTab) {
        setState({ activeTab: targetTab });
      }
    });
  });
}

/**
 * Setup Year Segmented Control (2022, 2023, Compare) — both Global Bar & Map Header
 */
function setupYearFilter() {
  const yearBtns = document.querySelectorAll('.segment-btn[data-year], .map-year-btn[data-year]');
  yearBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const yearMode = btn.getAttribute('data-year');
      if (yearMode) {
        setState({ yearMode });
      }
    });
  });
}

/**
 * Setup Collapsible Level-2 Advanced Filters Drawer (does NOT clear filters when collapsed)
 */
function setupAdvancedFiltersToggle() {
  const btnAdv = document.getElementById('btn-toggle-advanced-filters');
  if (!btnAdv) return;
  btnAdv.addEventListener('click', () => {
    const cur = getState().advancedFiltersOpen;
    setState({ advancedFiltersOpen: !cur });
  });
}

/**
 * Setup (i) Info Popover buttons across KPI cards and charts
 */
function setupInfoPopovers() {
  document.querySelectorAll('.info-popover-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const targetId = btn.getAttribute('data-popover-target');
      const targetBox = targetId ? document.getElementById(targetId) : null;
      if (!targetBox) return;

      const isOpen = targetBox.classList.contains('open');
      document.querySelectorAll('.info-popover-box.open').forEach(b => b.classList.remove('open'));
      if (!isOpen) {
        targetBox.classList.add('open');
      }
    });
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.info-popover-box') && !e.target.closest('.info-popover-btn')) {
      document.querySelectorAll('.info-popover-box.open').forEach(b => b.classList.remove('open'));
    }
  });
}

/**
 * Setup Month Selection Modal & Multi-select Chips
 */
function setupMonthPicker() {
  const btnToggle = document.getElementById('btn-month-picker-toggle');
  const modal = document.getElementById('month-picker-modal');
  const btnSelectAll = document.getElementById('btn-month-all');
  const btnSelectFair = document.getElementById('btn-month-fair');
  const monthGrid = document.getElementById('month-grid-container');

  if (!btnToggle || !modal) return;

  btnToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    modal.classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    if (!modal.contains(e.target) && e.target !== btnToggle) {
      modal.classList.remove('open');
    }
  });

  if (monthGrid) {
    monthGrid.innerHTML = '';
    for (let m = 1; m <= 12; m++) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'month-chip-btn';
      chip.setAttribute('data-month', m);
      chip.textContent = FULL_THAI_MONTH_NAMES[m - 1];
      chip.addEventListener('click', () => {
        const state = getState();
        const currentMonths = new Set(state.selectedMonths);
        if (currentMonths.has(m)) {
          if (currentMonths.size > 1) {
            currentMonths.delete(m);
          }
        } else {
          currentMonths.add(m);
        }
        setState({ selectedMonths: Array.from(currentMonths).sort((a, b) => a - b) });
      });
      monthGrid.appendChild(chip);
    }
  }

  if (btnSelectAll) {
    btnSelectAll.addEventListener('click', () => {
      setState({ selectedMonths: [...ALL_MONTHS] });
    });
  }

  if (btnSelectFair) {
    btnSelectFair.addEventListener('click', () => {
      setState({ selectedMonths: [...DEFAULT_MONTHS_COMPARE] });
    });
  }
}

/**
 * Setup Geographic Dropdowns (Province -> District -> Tambon -> Station)
 */
function setupGeographicFilters() {
  const provSelect = document.getElementById('filter-province');
  const distSelect = document.getElementById('filter-district');
  const tambonSelect = document.getElementById('filter-tambon');
  const stationSelect = document.getElementById('filter-station');

  if (provSelect) {
    const provinces = getAvailableProvinces();
    provSelect.innerHTML = [
      '<option value="">ทุกจังหวัด (9 จังหวัดศึกษา)</option>',
      ...provinces.map(p => `<option value="${p}">จังหวัด${p}</option>`)
    ].join('');
    provSelect.addEventListener('change', (e) => {
      const val = e.target.value || null;
      setState({ province: val });
    });
  }

  if (distSelect) {
    distSelect.addEventListener('change', (e) => {
      const val = e.target.value || null;
      setState({ district: val });
    });
  }

  if (tambonSelect) {
    tambonSelect.addEventListener('change', (e) => {
      const val = e.target.value || null;
      setState({ tambon: val });
    });
  }

  if (stationSelect) {
    stationSelect.addEventListener('change', (e) => {
      const val = e.target.value || null;
      if (!val) {
        setState({ stationId: null });
      } else {
        const db = getDb();
        const st = db.stations.find(s => s.station_id === val);
        if (st) {
          setState({
            stationId: st.station_id,
            province: st.province,
            district: st.district,
            tambon: st.tambon
          });
        } else {
          setState({ stationId: val });
        }
      }
    });
  }
}

/**
 * Setup Weather Source Filter (`source_type`: all | OpenWeatherMap | HRDI Weather Station)
 */
function setupWeatherSourceFilter() {
  const wsSelect = document.getElementById('filter-weather-source');
  if (wsSelect) {
    wsSelect.addEventListener('change', (e) => {
      setState({ weatherSource: e.target.value || 'all' });
    });
  }

  const rainSourceSelect = document.getElementById('filter-rainfall-source');
  if (rainSourceSelect) {
    rainSourceSelect.addEventListener('change', (e) => {
      setState({ rainfallSource: e.target.value || 'hrdi' });
    });
  }
}

/**
 * Setup Metric Selector (for Climate page & synchronized views)
 */
function setupMetricFilter() {
  const metricSelect = document.getElementById('filter-climate-metric');
  if (metricSelect) {
    metricSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      const updates = { metric: val };
      if (['temp', 'humidity', 'rainfall'].includes(val)) {
        updates.overviewMetricTab = val;
        updates.swipeMetric = val;
      }
      setState(updates);
    });
  }
}

/**
 * Setup Hotspot Category Filters (Elevation, Project, Land Use)
 */
function setupHotspotFilters() {
  const elevSelect = document.getElementById('filter-hotspot-elevation');
  const projSelect = document.getElementById('filter-hotspot-project');
  const luSelect = document.getElementById('filter-hotspot-landuse');

  if (elevSelect) {
    elevSelect.addEventListener('change', (e) => {
      setState({ hotspotElevation: e.target.value });
    });
  }

  if (projSelect) {
    projSelect.addEventListener('change', (e) => {
      setState({ hotspotProject: e.target.value });
    });
  }

  if (luSelect) {
    const landuses = getAvailableLanduses();
    luSelect.innerHTML = [
      '<option value="all">ทุกการใช้ประโยชน์ที่ดิน</option>',
      ...landuses.map(lu => `<option value="${lu}">${lu}</option>`)
    ].join('');
    luSelect.addEventListener('change', (e) => {
      setState({ landuse: e.target.value });
    });
  }
}

/**
 * Setup Overview Map Controls, Metric Tabs & Clickable KPI Cards
 */
function setupOverviewControls() {
  // Map Choropleth / Swipe metric buttons
  const swipeBtns = document.querySelectorAll('.btn-swipe-metric');
  swipeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const metric = btn.getAttribute('data-metric');
      if (metric) {
        setState({
          swipeMetric: metric,
          overviewMetricTab: metric,
          metric: metric === 'hotspots' ? getState().metric : metric
        });
      }
    });
  });

  // Overview monthly trend metric tab buttons
  const trendBtns = document.querySelectorAll('.trend-metric-tab-btn');
  trendBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const metric = btn.getAttribute('data-metric');
      if (metric) {
        setState({
          overviewMetricTab: metric,
          swipeMetric: metric,
          metric: metric === 'hotspots' ? getState().metric : metric
        });
      }
    });
  });

  // Clickable KPI Cards (Cards 1–4 switch active metric; Card 5 resets province filter)
  document.querySelectorAll('.kpi-card[data-kpi-metric]').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.info-popover-btn') || e.target.closest('.info-popover-box')) return;
      const metric = card.getAttribute('data-kpi-metric');
      if (metric) {
        setState({
          overviewMetricTab: metric,
          swipeMetric: metric,
          metric: metric === 'hotspots' ? getState().metric : metric
        });
      }
    });
  });

  // Toggle weather station markers on Overview Choropleth map
  const btnToggleStations = document.getElementById('btn-toggle-map-stations');
  if (btnToggleStations) {
    btnToggleStations.addEventListener('click', () => {
      const cur = getState();
      if (cur.stationId) {
        setState({ stationId: null, showMapStations: false });
      } else {
        setState({ showMapStations: !cur.showMapStations });
      }
    });
  }
}

/**
 * Setup Reset All Filters Button
 */
function setupResetButton() {
  const btnReset = document.getElementById('btn-reset-filters');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      resetFilters();
    });
  }

  const btnStudyOverview = document.getElementById('btn-quick-study-overview');
  if (btnStudyOverview) {
    btnStudyOverview.addEventListener('click', () => {
      setState({ province: null, district: null, tambon: null, stationId: null });
    });
  }
}

/**
 * Update all dropdown options & button active states dynamically based on active state
 */
function updateFilterControls(state) {
  const db = getDb();

  // 1. Year segmented control buttons (both Global Bar & Map Header)
  document.querySelectorAll('.segment-btn[data-year], .map-year-btn[data-year]').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-year') === state.yearMode);
  });

  // 1b. Collapsible Advanced Filters Drawer & Active Count Badge
  const advPanel = document.getElementById('advanced-filters-panel');
  const btnAdv = document.getElementById('btn-toggle-advanced-filters');
  const advBadge = document.getElementById('advanced-filter-count-badge');
  if (advPanel && btnAdv) {
    advPanel.classList.toggle('open', Boolean(state.advancedFiltersOpen));
    advPanel.setAttribute('aria-hidden', state.advancedFiltersOpen ? 'false' : 'true');
    btnAdv.setAttribute('aria-expanded', state.advancedFiltersOpen ? 'true' : 'false');
    btnAdv.classList.toggle('active', Boolean(state.advancedFiltersOpen));
  }
  if (advBadge) {
    let advCount = 0;
    if (state.district) advCount++;
    if (state.tambon) advCount++;
    if (state.stationId) advCount++;
    if (state.weatherSource && state.weatherSource !== 'all') advCount++;
    if (state.rainfallSource && state.rainfallSource !== 'hrdi') advCount++;
    if (state.hotspotElevation && state.hotspotElevation !== 'all') advCount++;
    if (state.landuse && state.landuse !== 'all') advCount++;
    if (state.hotspotProject && state.hotspotProject !== 'all') advCount++;

    advBadge.textContent = String(advCount);
    advBadge.style.display = advCount > 0 ? 'inline-flex' : 'none';
  }

  // 2. Month summary button label
  const btnMonthToggle = document.getElementById('btn-month-picker-toggle');
  if (btnMonthToggle) {
    if (state.selectedMonths.length === 12) {
      btnMonthToggle.textContent = 'ทุกเดือน (ม.ค. – ธ.ค.)';
    } else if (state.selectedMonths.length === DEFAULT_MONTHS_COMPARE.length && state.selectedMonths.every((m, i) => m === i + 1)) {
      btnMonthToggle.textContent = 'ม.ค. – ก.ย. (เปรียบเทียบ 9 เดือน)';
    } else {
      btnMonthToggle.textContent = `เลือก ${state.selectedMonths.length} เดือน (${state.selectedMonths.map(m => THAI_MONTH_NAMES[m - 1]).join(', ')})`;
    }
  }

  // Month grid chip states
  document.querySelectorAll('.month-chip-btn').forEach(chip => {
    const m = Number(chip.getAttribute('data-month'));
    chip.classList.toggle('selected', state.selectedMonths.includes(m));
  });

  // 3. Province dropdown
  const provSelect = document.getElementById('filter-province');
  if (provSelect && provSelect.value !== (state.province || '')) {
    provSelect.value = state.province || '';
  }

  // 4. Dataset-aware District dropdown (O(N) batch join instead of O(N^2) innerHTML +=)
  const distSelect = document.getElementById('filter-district');
  if (distSelect) {
    const districts = getAvailableDistricts(state.province, state.activeTab, state.weatherSource);
    const currentVal = state.district;
    distSelect.innerHTML = [
      `<option value="">ทุกอำเภอ (${districts.length})</option>`,
      ...districts.map(d => `<option value="${d}" ${currentVal === d ? 'selected' : ''}>${d}</option>`)
    ].join('');
  }

  // 5. Dataset-aware Tambon dropdown (O(N) batch join instead of O(N^2) innerHTML +=)
  const tambonSelect = document.getElementById('filter-tambon');
  if (tambonSelect) {
    const tambons = getAvailableTambons(state.province, state.district, state.activeTab, state.weatherSource);
    const currentVal = state.tambon;
    tambonSelect.innerHTML = [
      `<option value="">ทุกตำบล (${tambons.length})</option>`,
      ...tambons.map(t => `<option value="${t}" ${currentVal === t ? 'selected' : ''}>${t}</option>`)
    ].join('');
  }

  // 6. Station dropdown (filtered by province, district, tambon, AND weatherSource)
  const stationSelect = document.getElementById('filter-station');
  if (stationSelect) {
    const stations = getAvailableStations(state.province, state.district, state.tambon, state.weatherSource);
    const currentVal = state.stationId;
    stationSelect.innerHTML = [
      `<option value="">ทุกสถานี (${stations.length} แห่ง)</option>`,
      ...stations.map(s => {
        const srcTag = s.source_type === 'HRDI Weather Station' ? '[HRDI]' : '[OWM]';
        return `<option value="${s.station_id}" ${currentVal === s.station_id ? 'selected' : ''}>${s.station_name} (${s.province}) ${srcTag}</option>`;
      })
    ].join('');
  }

  // 7. Weather Source dropdown & Scope Summary Badge
  const wsSelect = document.getElementById('filter-weather-source');
  if (wsSelect && wsSelect.value !== state.weatherSource) {
    wsSelect.value = state.weatherSource;
  }

  const rainSourceSelect = document.getElementById('filter-rainfall-source');
  if (rainSourceSelect && rainSourceSelect.value !== state.rainfallSource) {
    rainSourceSelect.value = state.rainfallSource;
  }

  const wsBadge = document.getElementById('weather-source-scope-badge');
  if (wsBadge) {
    const activeStations = getAvailableStations(state.province, state.district, state.tambon, state.weatherSource);
    const activeRecords = filterStationMonthRecords(db.hrdiStationMonth, state);
    if (state.weatherSource === 'all') {
      wsBadge.textContent = `สถานีภูมิอากาศ: ${activeStations.length} แห่ง (${activeRecords.length} ระเบียน)`;
    } else {
      wsBadge.textContent = `กรองแหล่งสถานี: ${state.weatherSource} (${activeStations.length} สถานี, ${activeRecords.length} ระเบียน · ไม่กระทบค่า HII/Hotspot)`;
    }
  }

  const scopeNoticeEl = document.getElementById('filter-scope-notice');
  if (scopeNoticeEl) {
    if (state.stationId || state.district || state.tambon) {
      scopeNoticeEl.textContent = 'กำลังกรองระดับย่อย (อำเภอ/ตำบล/สถานี): ข้อมูลน้ำฝน HII แสดงที่ระดับจังหวัด';
      scopeNoticeEl.style.display = 'inline-flex';
    } else if (!window._scopeNoticeTimer) {
      scopeNoticeEl.style.display = 'none';
    }
  }

  // 8. Climate metric select & Overview metric tab buttons
  const metricSelect = document.getElementById('filter-climate-metric');
  if (metricSelect && metricSelect.value !== state.metric) {
    metricSelect.value = state.metric;
  }

  document.querySelectorAll('.btn-swipe-metric').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-metric') === state.swipeMetric);
  });

  document.querySelectorAll('.trend-metric-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-metric') === state.overviewMetricTab);
  });

  // 9. Hotspot Category Dropdowns (sync with chart clicks!)
  const elevSelect = document.getElementById('filter-hotspot-elevation');
  if (elevSelect && elevSelect.value !== state.hotspotElevation) {
    elevSelect.value = state.hotspotElevation;
  }

  const projSelect = document.getElementById('filter-hotspot-project');
  if (projSelect) {
    const projects = getAvailableProjects(state.province);
    const currentProj = state.hotspotProject;
    let html = `
      <option value="all" ${currentProj === 'all' ? 'selected' : ''}>ทุกพื้นที่ (ในและนอกโครงการ)</option>
      <option value="in_project" ${currentProj === 'in_project' ? 'selected' : ''}>เฉพาะในพื้นที่โครงการ HRDI</option>
      <option value="outside" ${currentProj === 'outside' ? 'selected' : ''}>เฉพาะนอกพื้นที่โครงการ</option>
    `;
    for (const p of projects) {
      html += `<option value="${p}" ${currentProj === p ? 'selected' : ''}>โครงการ: ${p}</option>`;
    }
    projSelect.innerHTML = html;
  }

  const luSelect = document.getElementById('filter-hotspot-landuse');
  if (luSelect && luSelect.value !== state.landuse) {
    luSelect.value = state.landuse;
  }
}

/**
 * Render Active Filter Chips with Individual Remove (×) Action
 */
function renderActiveChips(state) {
  const container = document.getElementById('active-filter-chips');
  if (!container) return;

  const chips = [];

  const yearText = state.yearMode === 'compare' ? 'โหมด: เปรียบเทียบ 2022–2023' : `โหมด: ปี ${state.yearMode}`;
  chips.push({ label: yearText, removable: false });

  if (state.selectedMonths.length < 12) {
    const monthText = state.selectedMonths.length === DEFAULT_MONTHS_COMPARE.length && state.selectedMonths.every((m, i) => m === i + 1)
      ? 'ม.ค.–ก.ย. (9 เดือน)'
      : state.selectedMonths.map(m => THAI_MONTH_NAMES[m - 1]).join(', ');
    chips.push({
      label: `เดือน: ${monthText}`,
      removable: true,
      onRemove: () => setState({ selectedMonths: [...ALL_MONTHS] })
    });
  } else {
    chips.push({ label: 'เดือน: ทั้งปี (ม.ค.–ธ.ค.)', removable: false });
  }

  if (state.weatherSource && state.weatherSource !== 'all') {
    chips.push({
      label: `แหล่งสถานี: ${state.weatherSource}`,
      removable: true,
      onRemove: () => setState({ weatherSource: 'all' })
    });
  }

  if (state.rainfallSource === 'hii') {
    chips.push({
      label: 'KPI ฝน: HII ระดับจังหวัด',
      removable: true,
      onRemove: () => setState({ rainfallSource: 'hrdi' })
    });
  }

  if (state.province) {
    chips.push({
      label: `จังหวัด: ${state.province}`,
      removable: true,
      onRemove: () => setState({ province: null })
    });
  }
  if (state.district) {
    chips.push({
      label: `อำเภอ: ${state.district}`,
      removable: true,
      onRemove: () => setState({ district: null })
    });
  }
  if (state.tambon) {
    chips.push({
      label: `ตำบล: ${state.tambon}`,
      removable: true,
      onRemove: () => setState({ tambon: null })
    });
  }
  if (state.stationId) {
    const db = getDb();
    const s = db.stations.find(st => st.station_id === state.stationId);
    chips.push({
      label: `สถานี: ${s ? s.station_name : state.stationId}`,
      removable: true,
      onRemove: () => setState({ stationId: null })
    });
  }

  if (state.hotspotElevation !== 'all') {
    chips.push({
      label: `ความสูงจุดความร้อน: ${state.hotspotElevation === 'high' ? '> 500 ม.' : '≤ 500 ม.'}`,
      removable: true,
      onRemove: () => setState({ hotspotElevation: 'all' })
    });
  }
  if (state.landuse !== 'all') {
    chips.push({
      label: `การใช้ที่ดิน: ${state.landuse}`,
      removable: true,
      onRemove: () => setState({ landuse: 'all' })
    });
  }
  if (state.hotspotProject !== 'all') {
    const pLabel = state.hotspotProject === 'in_project'
      ? 'ในพื้นที่โครงการ HRDI'
      : state.hotspotProject === 'outside'
        ? 'นอกพื้นที่โครงการ'
        : state.hotspotProject;
    chips.push({
      label: `โครงการ: ${pLabel}`,
      removable: true,
      onRemove: () => setState({ hotspotProject: 'all' })
    });
  }

  container.innerHTML = chips.map((c, i) => `
    <span class="filter-chip ${c.removable ? 'filter-chip-active' : 'filter-chip-base'}">
      <span>${c.label}</span>
      ${c.removable ? `<button type="button" class="chip-remove" onclick="window.removeFilterChip(${i})" title="ยกเลิกตัวกรองนี้"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>` : ''}
    </span>
  `).join('');

  window._activeChipCallbacks = chips.map(c => c.onRemove);
}

/**
 * Register Global Window Helpers
 */
function setupGlobalWindowHelpers() {
  window.selectStation = (stationId, province, district = null, tambon = null) => {
    const current = getState();
    if (current.stationId === stationId) {
      setState({ stationId: null });
    } else {
      const updates = { stationId, province };
      if (district) updates.district = district;
      if (tambon) updates.tambon = tambon;
      setState(updates);
    }
  };

  window.clearProvinceSelection = () => {
    setState({ province: null, district: null, tambon: null, stationId: null });
  };

  window.removeFilterChip = (index) => {
    if (window._activeChipCallbacks && window._activeChipCallbacks[index]) {
      window._activeChipCallbacks[index]();
    }
  };
}

// Start application
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
