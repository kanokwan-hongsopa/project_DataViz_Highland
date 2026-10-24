/**
 * main.js — Application Entry Point, Navigation & Event Orchestration
 * Highland Climate & Hotspot Interactive Dashboard (2022–2023)
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
    // 1. Load core JSON datasets
    await loadCoreData((percent, message) => {
      if (loadingText) loadingText.textContent = `${message} (${percent}%)`;
    });

    // 2. Setup global UI elements & filter dropdowns
    setupNavigationTabs();
    setupYearFilter();
    setupMonthPicker();
    setupGeographicFilters();
    setupMetricFilter();
    setupHotspotFilters();
    setupResetButton();
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

  // Toggle page visibility
  const pages = document.querySelectorAll('.page-view');
  pages.forEach(p => p.classList.remove('active'));

  const activePageEl = document.getElementById(`page-${activeTab}`);
  if (activePageEl) activePageEl.classList.add('active');

  // Trigger page-specific renderer
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

  // Toggle dropdown
  btnToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    modal.classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    if (!modal.contains(e.target) && e.target !== btnToggle) {
      modal.classList.remove('open');
    }
  });

  // Render 12 month buttons
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
          // Prevent deselecting all months
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

  // Quick action: Select All Months
  if (btnSelectAll) {
    btnSelectAll.addEventListener('click', () => {
      setState({ selectedMonths: [...ALL_MONTHS] });
    });
  }

  // Quick action: Select Fair Comparison (Jan–Sep)
  if (btnSelectFair) {
    btnSelectFair.addEventListener('click', () => {
      setState({ selectedMonths: [...DEFAULT_MONTHS_COMPARE] });
    });
  }
}

/**
 * Setup Geographic Dropdowns (Province, District, Tambon, Station)
 */
function setupGeographicFilters() {
  const provSelect = document.getElementById('filter-province');
  const distSelect = document.getElementById('filter-district');
  const tambonSelect = document.getElementById('filter-tambon');
  const stationSelect = document.getElementById('filter-station');

  // Province dropdown
  if (provSelect) {
    const provinces = getAvailableProvinces();
    provSelect.innerHTML = '<option value="">ทุกจังหวัด (9 จังหวัด)</option>';
    for (const p of provinces) {
      provSelect.innerHTML += `<option value="${p}">${p}</option>`;
    }
    provSelect.addEventListener('change', (e) => {
      const val = e.target.value || null;
      setState({ province: val });
    });
  }

  // District dropdown
  if (distSelect) {
    distSelect.addEventListener('change', (e) => {
      const val = e.target.value || null;
      setState({ district: val });
    });
  }

  // Tambon dropdown
  if (tambonSelect) {
    tambonSelect.addEventListener('change', (e) => {
      const val = e.target.value || null;
      setState({ tambon: val });
    });
  }

  // Station dropdown
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
 * Setup Reset All Filters Button
 */
function setupResetButton() {
  const btnReset = document.getElementById('btn-reset-filters');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      resetFilters();
    });
  }
}

/**
 * Update dropdown options dynamically based on active state (hierarchical cascade)
 */
function updateFilterControls(state) {
  // Year segmented buttons
  const segmentBtns = document.querySelectorAll('.segment-btn');
  segmentBtns.forEach(btn => {
    if (btn.getAttribute('data-year') === state.yearMode) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Month summary button label
  const btnMonthToggle = document.getElementById('btn-month-picker-toggle');
  if (btnMonthToggle) {
    if (state.selectedMonths.length === 12) {
      btnMonthToggle.innerHTML = '🗓️ ทุกเดือน (ม.ค. - ธ.ค.)';
    } else if (state.selectedMonths.length === DEFAULT_MONTHS_COMPARE.length && state.selectedMonths.every((m, i) => m === i + 1)) {
      btnMonthToggle.innerHTML = '🗓️ ม.ค. - ก.ย. (เปรียบเทียบยุติธรรม)';
    } else {
      btnMonthToggle.innerHTML = `🗓️ เลือก ${state.selectedMonths.length} เดือน (${state.selectedMonths.map(m => THAI_MONTH_NAMES[m - 1]).join(', ')})`;
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

  // Update District dropdown options
  const distSelect = document.getElementById('filter-district');
  if (distSelect) {
    const districts = getAvailableDistricts(state.province);
    const currentVal = state.district;
    distSelect.innerHTML = '<option value="">ทุกอำเภอ</option>';
    for (const d of districts) {
      distSelect.innerHTML += `<option value="${d}" ${currentVal === d ? 'selected' : ''}>${d}</option>`;
    }
  }

  // Update Tambon dropdown options
  const tambonSelect = document.getElementById('filter-tambon');
  if (tambonSelect) {
    const tambons = getAvailableTambons(state.province, state.district);
    const currentVal = state.tambon;
    tambonSelect.innerHTML = '<option value="">ทุกตำบล</option>';
    for (const t of tambons) {
      tambonSelect.innerHTML += `<option value="${t}" ${currentVal === t ? 'selected' : ''}>${t}</option>`;
    }
  }

  // Update Station dropdown options
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
 * Render Breadcrumb Chips for active filters
 */
function renderActiveChips(state) {
  const container = document.getElementById('active-filter-chips');
  if (!container) return;

  const chips = [];

  // Year chip
  const yearText = state.yearMode === 'compare' ? 'เปรียบเทียบ 2022–2023' : `ปี ${state.yearMode}`;
  chips.push({ label: yearText, removable: false });

  // Month chip
  if (state.selectedMonths.length < 12) {
    const monthText = state.selectedMonths.map(m => THAI_MONTH_NAMES[m - 1]).join(', ');
    chips.push({
      label: `เดือน: ${monthText}`,
      removable: true,
      onRemove: () => setState({ selectedMonths: [...ALL_MONTHS] })
    });
  }

  // Geographic chips
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

  // Hotspot category chips
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
      ${c.removable ? `<span class="chip-remove" onclick="window.removeFilterChip(${i})">✕</span>` : ''}
    </span>
  `).join('');

  // Register chip remove callbacks
  window._activeChipCallbacks = chips.map(c => c.onRemove);
}

/**
 * Register Global Window Helpers for inline HTML event handlers
 */
function setupGlobalWindowHelpers() {
  window.selectStation = (stationId, province) => {
    setState({ stationId, province });
  };

  window.selectProximityMethod = (method) => {
    setState({ proximityMethod: method });
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

// Start application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
