/**
 * main.js — Application Entry Point, Navigation & Event Orchestration
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
  getAvailableStations
} from './filters.js';
import { THAI_MONTH_NAMES, FULL_THAI_MONTH_NAMES } from './charts.js';

// Page Renderers
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
    // 1. Load core datasets & Thailand 77 provinces GeoJSON
    await loadCoreData((percent, message) => {
      if (loadingText) loadingText.textContent = `${message} (${percent}%)`;
    });

    // 2. Setup global UI elements & filter controls
    setupNavigationTabs();
    setupYearFilter();
    setupMonthPicker();
    setupGeographicFilters();
    setupMetricFilter();
    setupHotspotFilters();
    setupResetButton();
    setupOverviewControls();
    setupGlobalWindowHelpers();

    // 3. Subscribe renderers to state changes
    subscribe((currentState, oldState, changedKeys) => {
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
      }, 300);
    }
  } catch (err) {
    console.error('Fatal initialization error:', err);
    if (loadingText) {
      loadingText.innerHTML = `
        <span style="color: #f87171; font-weight: 700;">เกิดข้อผิดพลาดในการโหลดข้อมูล</span><br>
        <span style="font-size: 0.8rem; color: #cbd5e1;">${err.message}</span><br>
        <button onclick="location.reload()" style="margin-top: 10px; padding: 6px 12px; background: #0d9488; color: #fff; border: none; border-radius: 4px; cursor: pointer;">ลองใหม่อีกครั้ง</button>
      `;
    }
  }
}

/**
 * Render the currently active page/tab
 */
function renderCurrentPage(state) {
  const activeTab = state.activeTab;

  const pages = document.querySelectorAll('.page-view');
  pages.forEach(p => p.classList.remove('active'));

  const activePageEl = document.getElementById(`page-${activeTab}`);
  if (activePageEl) activePageEl.classList.add('active');

  switch (activeTab) {
    case 'overview':
      renderOverviewPage();
      break;
    case 'climate':
      renderClimatePage();
      break;
    case 'rainfall':
      renderRainfallPage();
      break;
    case 'hotspots':
      renderHotspotsPage();
      break;
    case 'correlation':
      renderCorrelationPage();
      break;
  }
}

/**
 * Setup Top Navigation Tabs
 */
function setupNavigationTabs() {
  const tabButtons = document.querySelectorAll('.nav-tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      if (targetTab) {
        tabButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        setState({ activeTab: targetTab });
      }
    });
  });
}

/**
 * Setup Year Segmented Control
 */
function setupYearFilter() {
  const segmentBtns = document.querySelectorAll('.segment-btn');
  segmentBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const yearMode = btn.getAttribute('data-year');
      if (yearMode) {
        setState({ yearMode });
      }
    });
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
 * Setup Geographic Dropdowns (Dataset-Aware)
 */
function setupGeographicFilters() {
  const provSelect = document.getElementById('filter-province');
  const distSelect = document.getElementById('filter-district');
  const tambonSelect = document.getElementById('filter-tambon');
  const stationSelect = document.getElementById('filter-station');

  // Province dropdown (strictly 9 study provinces)
  if (provSelect) {
    const provinces = getAvailableProvinces();
    provSelect.innerHTML = '<option value="">ทุกจังหวัด (9 จังหวัดศึกษา)</option>';
    for (const p of provinces) {
      provSelect.innerHTML += `<option value="${p}">จังหวัด${p}</option>`;
    }
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
      setState({ stationId: val });
    });
  }
}

/**
 * Setup Metric Selector (for Climate page)
 */
function setupMetricFilter() {
  const metricSelect = document.getElementById('filter-climate-metric');
  if (metricSelect) {
    metricSelect.addEventListener('change', (e) => {
      setState({ metric: e.target.value });
    });
  }
}

/**
 * Setup Hotspot Category Filters
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
    const db = getDb();
    const set = new Set();
    for (const r of db.hotspotByLanduse) {
      if (r.landuse) set.add(r.landuse);
    }
    luSelect.innerHTML = '<option value="all">ทุกการใช้ประโยชน์ที่ดิน</option>';
    for (const lu of Array.from(set).sort()) {
      luSelect.innerHTML += `<option value="${lu}">${lu}</option>`;
    }
    luSelect.addEventListener('change', (e) => {
      setState({ landuse: e.target.value });
    });
  }
}

/**
 * Setup Overview Map Controls & Metric Tabs
 */
function setupOverviewControls() {
  // Swipe metric buttons
  const swipeBtns = document.querySelectorAll('.btn-swipe-metric');
  swipeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const metric = btn.getAttribute('data-metric');
      if (metric) {
        swipeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        setState({ swipeMetric: metric });
      }
    });
  });

  // Overview trend metric tab buttons
  const trendBtns = document.querySelectorAll('.trend-metric-tab-btn');
  trendBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const metric = btn.getAttribute('data-metric');
      if (metric) {
        trendBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        setState({ overviewMetricTab: metric });
      }
    });
  });
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
 * Update dropdown options dynamically based on active state (dataset-aware cascade)
 */
function updateFilterControls(state) {
  // Year segmented control buttons
  const segmentBtns = document.querySelectorAll('.segment-btn');
  segmentBtns.forEach(btn => {
    if (btn.getAttribute('data-year') === state.yearMode) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Month summary button label (no emojis)
  const btnMonthToggle = document.getElementById('btn-month-picker-toggle');
  if (btnMonthToggle) {
    if (state.selectedMonths.length === 12) {
      btnMonthToggle.textContent = 'ทุกเดือน (ม.ค. - ธ.ค.)';
    } else if (state.selectedMonths.length === DEFAULT_MONTHS_COMPARE.length && state.selectedMonths.every((m, i) => m === i + 1)) {
      btnMonthToggle.textContent = 'ม.ค. - ก.ย. (เปรียบเทียบยุติธรรม)';
    } else {
      btnMonthToggle.textContent = `เลือก ${state.selectedMonths.length} เดือน (${state.selectedMonths.map(m => THAI_MONTH_NAMES[m - 1]).join(', ')})`;
    }
  }

  // Month grid chip states
  const monthChips = document.querySelectorAll('.month-chip-btn');
  monthChips.forEach(chip => {
    const m = Number(chip.getAttribute('data-month'));
    if (state.selectedMonths.includes(m)) {
      chip.classList.add('selected');
    } else {
      chip.classList.remove('selected');
    }
  });

  // Province dropdown
  const provSelect = document.getElementById('filter-province');
  if (provSelect && provSelect.value !== (state.province || '')) {
    provSelect.value = state.province || '';
  }

  // Dataset-aware District dropdown
  const distSelect = document.getElementById('filter-district');
  if (distSelect) {
    const districts = getAvailableDistricts(state.province, state.activeTab);
    const currentVal = state.district;
    distSelect.innerHTML = '<option value="">ทุกอำเภอ</option>';
    for (const d of districts) {
      distSelect.innerHTML += `<option value="${d}" ${currentVal === d ? 'selected' : ''}>${d}</option>`;
    }
  }

  // Dataset-aware Tambon dropdown
  const tambonSelect = document.getElementById('filter-tambon');
  if (tambonSelect) {
    const tambons = getAvailableTambons(state.province, state.district, state.activeTab);
    const currentVal = state.tambon;
    tambonSelect.innerHTML = '<option value="">ทุกตำบล</option>';
    for (const t of tambons) {
      tambonSelect.innerHTML += `<option value="${t}" ${currentVal === t ? 'selected' : ''}>${t}</option>`;
    }
  }

  // Station dropdown
  const stationSelect = document.getElementById('filter-station');
  if (stationSelect) {
    const stations = getAvailableStations(state.province, state.district);
    const currentVal = state.stationId;
    stationSelect.innerHTML = `<option value="">ทุกสถานี (${stations.length} แห่ง)</option>`;
    for (const s of stations) {
      stationSelect.innerHTML += `<option value="${s.station_id}" ${currentVal === s.station_id ? 'selected' : ''}>${s.station_name} (${s.province})</option>`;
    }
  }

  // Climate metric select
  const metricSelect = document.getElementById('filter-climate-metric');
  if (metricSelect && metricSelect.value !== state.metric) {
    metricSelect.value = state.metric;
  }
}

/**
 * Render Breadcrumb Chips for active filters (No emojis)
 */
function renderActiveChips(state) {
  const container = document.getElementById('active-filter-chips');
  if (!container) return;

  const chips = [];

  const yearText = state.yearMode === 'compare' ? 'เปรียบเทียบ 2022–2023' : `ปี ${state.yearMode}`;
  chips.push({ label: yearText, removable: false });

  if (state.selectedMonths.length < 12) {
    const monthText = state.selectedMonths.map(m => THAI_MONTH_NAMES[m - 1]).join(', ');
    chips.push({
      label: `เดือน: ${monthText}`,
      removable: true,
      onRemove: () => setState({ selectedMonths: [...ALL_MONTHS] })
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
      label: `ความสูง: ${state.hotspotElevation === 'high' ? '>500 ม.' : '<=500 ม.'}`,
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
    chips.push({
      label: `โครงการ: ${state.hotspotProject}`,
      removable: true,
      onRemove: () => setState({ hotspotProject: 'all' })
    });
  }

  container.innerHTML = chips.map((c, i) => `
    <span class="filter-chip">
      ${c.label}
      ${c.removable ? `<span class="chip-remove" onclick="window.removeFilterChip(${i})" title="ลบตัวกรอง"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></span>` : ''}
    </span>
  `).join('');

  window._activeChipCallbacks = chips.map(c => c.onRemove);
}

/**
 * Register Global Window Helpers
 */
function setupGlobalWindowHelpers() {
  window.selectStation = (stationId, province) => {
    setState({ stationId, province });
  };

  window.clearProvinceSelection = () => {
    setState({ province: null, district: null, tambon: null, stationId: null });
  };

  window.toggleRainfallComparable = (checked) => {
    setState({ rainfallComparable: checked });
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
