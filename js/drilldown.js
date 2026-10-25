/**
 * drilldown.js — Unified Breadcrumb and Drill-down Navigation System
 * Highland Climate & Hotspot Dashboard (2022–2023)
 */

import { getState, setState } from './state.js';
import { getDb } from './data-loader.js';

/**
 * Return to previous drill-down level without clearing year, month, or other settings
 */
export function drillUp() {
  const cur = getState();
  if (cur.stationId || cur.previewStationId) {
    setState({
      stationId: null,
      previewStationId: null
    });
  } else if (cur.district) {
    setState({ district: null, tambon: null });
  } else if (cur.province) {
    setState({
      province: null,
      district: null,
      tambon: null,
      stationId: null,
      previewStationId: null
    });
  }
}

/**
 * Clear all drill-down selections directly back to 9-province overview
 * Strictly preserves year, month, weatherSource, hotspot filters
 */
export function clearToOverview() {
  setState({
    province: null,
    district: null,
    tambon: null,
    stationId: null,
    previewStationId: null
  });
}

/**
 * Return to province level, clearing station/district selection
 */
export function clearToProvince() {
  setState({
    stationId: null,
    previewStationId: null,
    district: null,
    tambon: null
  });
}

/**
 * Find station display name from active stationId
 */
function resolveStationName(stationId) {
  if (!stationId) return null;
  const db = getDb();
  if (!db) return stationId;
  const stations = db.stations || [];
  const found = stations.find(s => s.station_id === stationId);
  if (found) {
    return found.station_name.replace(/^สถานี(ตรวจวัดสภาพอากาศ)?/, '').trim();
  }
  const hrdiRows = db.hrdiStationMonth || [];
  const foundRow = hrdiRows.find(r => r.station_id === stationId);
  if (foundRow) {
    return String(foundRow.station_name || stationId).replace(/^สถานี(ตรวจวัดสภาพอากาศ)?/, '').trim();
  }
  return stationId.split('|')[1] || stationId;
}

/**
 * Render dynamic breadcrumb and back button into a target container
 */
export function renderDrilldownBar(containerId, options = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const state = getState();
  const hasProvince = Boolean(state.province);
  const hasDistrict = Boolean(state.district);
  const hasStation = Boolean(state.stationId || state.previewStationId);
  const stationId = state.stationId || state.previewStationId;
  const stationName = resolveStationName(stationId);

  const overviewLabel = options.overviewLabel || 'ภาพรวม 9 จังหวัด';
  const showBackBtn = options.alwaysShowBackBtn || (hasProvince || hasDistrict || hasStation);
  const backText = options.backText || '← กลับสู่ภาพรวม';

  let crumbsHtml = '';

  // Level 0: 9 Provinces Overview
  if (hasProvince || hasDistrict || hasStation) {
    crumbsHtml += `
      <button type="button" class="crumb-btn" onclick="window.clearProvinceSelection()" title="ย้อนกลับไป${overviewLabel}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
        <span>${overviewLabel}</span>
      </button>
      <span class="crumb-sep" aria-hidden="true">›</span>
    `;
  } else {
    crumbsHtml += `
      <span class="crumb-current">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
        <span>${overviewLabel}</span>
      </span>
    `;
  }

  // Level 1: Province
  if (hasProvince) {
    if (hasDistrict || hasStation) {
      crumbsHtml += `
        <button type="button" class="crumb-btn" onclick="window.clearToProvince()" title="ย้อนกลับไประดับจังหวัด${state.province}">
          <span>จ.${state.province}</span>
        </button>
        <span class="crumb-sep" aria-hidden="true">›</span>
      `;
    } else {
      crumbsHtml += `
        <span class="crumb-current">
          <span>จ.${state.province}</span>
        </span>
      `;
    }
  }

  // Level 1.5: District (if active)
  if (hasDistrict) {
    if (hasStation) {
      crumbsHtml += `
        <button type="button" class="crumb-btn" onclick="window.clearStationFilter()" title="ระดับอำเภอ${state.district}">
          <span>อ.${state.district}</span>
        </button>
        <span class="crumb-sep" aria-hidden="true">›</span>
      `;
    } else {
      crumbsHtml += `
        <span class="crumb-current">
          <span>อ.${state.district}</span>
        </span>
      `;
    }
  }

  // Level 2: Station
  if (hasStation && stationName) {
    crumbsHtml += `
      <span class="crumb-current crumb-station" title="${stationName}">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"></circle>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
        <span>${stationName}</span>
      </span>
    `;
  }

  let backBtnHtml = '';
  if (showBackBtn && (hasProvince || hasDistrict || hasStation)) {
    backBtnHtml = `
      <button type="button" class="btn-card-drilldown-back" onclick="window.clearProvinceSelection()" title="ยกเลิกการเลือกและกลับสู่${overviewLabel}">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
        <span>${backText}</span>
      </button>
    `;
  }

  container.innerHTML = `
    <div class="drilldown-bar-inner">
      <nav class="drilldown-breadcrumbs" aria-label="ตำแหน่งข้อมูลปัจจุบัน">
        ${crumbsHtml}
      </nav>
      ${backBtnHtml}
    </div>
  `;
}

// Attach helpers to global window for HTML inline onclick handlers
if (typeof window !== 'undefined') {
  window.drillUp = drillUp;
  window.clearToOverview = clearToOverview;
  window.clearToProvince = clearToProvince;
  window.renderDrilldownBar = renderDrilldownBar;
}
