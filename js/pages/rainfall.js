/**
 * rainfall.js — Page 5 (Q5): ข้อมูลและที่มา (Data Sources, Completeness, Stations by Province & Audit Table)
 * Highland Climate & Hotspot Dashboard (2022–2023)
 */

import { getState, setState } from '../state.js';
import { getDb } from '../data-loader.js';
import {
  filterStationMonthRecords,
  filterHiiRecords,
  getFilteredHotspotCount,
  getAvailableStations,
  STUDY_PROVINCES
} from '../filters.js';
import { formatInt } from '../calculations.js';
import {
  renderBarChart,
  YEAR_COLORS
} from '../charts.js';

/**
 * Render Tab Q5: Data Quality, Completeness, Stations by Province, Methodology & Provenance
 */
export function renderRainfallPage() {
  const state = getState();
  const db = getDb();

  const hrdi2022 = filterStationMonthRecords(db.hrdiStationMonth, state, 2022);
  const hrdi2023 = filterStationMonthRecords(db.hrdiStationMonth, state, 2023);
  const hrdiAll = filterStationMonthRecords(db.hrdiStationMonth, state);
  const hiiAll = filterHiiRecords(db.hiiProvinceMonth, state);
  const hotspotTotal = getFilteredHotspotCount(state);

  // 1. Update Summary Completeness KPIs
  renderQualitySummaryCards(state, hrdi2022, hrdi2023, hrdiAll, hiiAll, hotspotTotal);

  // 2. Render Province Record Completeness Bar Chart (2022 vs 2023)
  renderCompletenessByProvinceChart(state);

  // 3. Render Stations by Province Bar Chart (Interactive click-to-filter province)
  renderStationsByProvinceChart(state);

  // 4. Render Weather Source Distribution Chart (OpenWeatherMap vs HRDI Weather Station)
  renderWeatherSourceDistributionChart(state);

  // 5. Render Searchable & Expandable Station Metadata & Completeness Audit Table
  renderStationCompletenessTable(state);

  // 6. Render Dynamic Key Insights (Q5)
  const insightEl = document.getElementById('insight-q5');
  if (insightEl) {
    const matchedStations = getAvailableStations(state.province, state.district, state.tambon, state.weatherSource);
    const owmCount = matchedStations.filter(s => s.source_type === 'OpenWeatherMap').length;
    const hrdiSensorCount = matchedStations.filter(s => s.source_type === 'HRDI Weather Station').length;
    insightEl.textContent = `ขอบเขตที่เลือกมีสถานีตรวจวัด ${matchedStations.length} แห่ง (OpenWeatherMap ${owmCount} แห่ง และสถานีภาคสนาม HRDI ${hrdiSensorCount} แห่ง) รวมข้อมูลภูมิอากาศจริง ${formatInt(hrdiAll.length)} ระเบียน ข้อมูลฝนระดับจังหวัด HII ${formatInt(hiiAll.length)} ระเบียน และจุดความร้อนดาวเทียม ${formatInt(hotspotTotal)} รายการ`;
  }
}

/**
 * Update Summary Completeness Cards on Q5
 */
function renderQualitySummaryCards(state, hrdi2022, hrdi2023, hrdiAll, hiiAll, hotspotTotal) {
  const matchedStations = getAvailableStations(state.province, state.district, state.tambon, state.weatherSource);
  const owmCount = matchedStations.filter(s => s.source_type === 'OpenWeatherMap').length;
  const hrdiSensorCount = matchedStations.filter(s => s.source_type === 'HRDI Weather Station').length;

  const stVal = document.getElementById('q5-stations-val');
  const stSub = document.getElementById('q5-stations-sub');
  if (stVal) stVal.textContent = `${matchedStations.length} สถานี`;
  if (stSub) stSub.textContent = `OpenWeatherMap: ${owmCount} แห่ง · HRDI Weather Station: ${hrdiSensorCount} แห่ง`;

  const recVal = document.getElementById('q5-hrdi-records-val');
  const recSub = document.getElementById('q5-hrdi-records-sub');
  if (recVal) recVal.textContent = `${formatInt(hrdiAll.length)} ระเบียน`;
  if (recSub) recSub.textContent = `ปี 2022: ${formatInt(hrdi2022.length)} ระเบียน (ม.ค.–ธ.ค.) · ปี 2023: ${formatInt(hrdi2023.length)} ระเบียน (ม.ค.–ก.ย.)`;

  const hiiVal = document.getElementById('q5-hii-records-val');
  const hiiSub = document.getElementById('q5-hii-records-sub');
  if (hiiVal) hiiVal.textContent = `${formatInt(hiiAll.length)} ระเบียน`;
  if (hiiSub) hiiSub.textContent = `ข้อมูลฝนระดับจังหวัด HII (ครบ 12 เดือนทั้งปี 2022 และ 2023)`;

  const hsVal = document.getElementById('q5-hotspot-records-val');
  const hsSub = document.getElementById('q5-hotspot-records-sub');
  if (hsVal) hsVal.textContent = `${formatInt(hotspotTotal)} รายการ`;
  if (hsSub) hsSub.textContent = `จากทั้งหมด 106,036 รายการตรวจพบดาวเทียม VIIRS (24 พาร์ทิชันรายเดือน)`;
}

/**
 * Render Record Completeness by Province Bar Chart (2022 vs 2023)
 */
function renderCompletenessByProvinceChart(state) {
  const db = getDb();
  const stateNoProv = { ...state, province: null, district: null, tambon: null, stationId: null };
  const rows22 = filterStationMonthRecords(db.hrdiStationMonth, stateNoProv, 2022);
  const rows23 = filterStationMonthRecords(db.hrdiStationMonth, stateNoProv, 2023);

  const provStats = STUDY_PROVINCES.map(prov => ({
    province: prov,
    c2022: rows22.filter(r => r.province === prov).length,
    c2023: rows23.filter(r => r.province === prov).length
  }));

  renderBarChart('quality-completeness-chart', {
    labels: provStats.map(p => p.province),
    datasets: [
      {
        label: 'ระเบียนปี 2022 (ครบ 12 เดือน)',
        data: provStats.map(p => p.c2022),
        backgroundColor: YEAR_COLORS.y2022,
        borderRadius: 5
      },
      {
        label: 'ระเบียนปี 2023 (มีข้อมูล ม.ค.–ก.ย.)',
        data: provStats.map(p => p.c2023),
        backgroundColor: YEAR_COLORS.y2023,
        borderRadius: 5
      }
    ]
  }, {
    showValueLabels: true,
    onClick: (evt, elements) => {
      if (elements && elements.length > 0) {
        const idx = elements[0].index;
        const clickedProv = provStats[idx]?.province;
        if (clickedProv) {
          setState({ province: state.province === clickedProv ? null : clickedProv });
        }
      }
    },
    scales: {
      y: {
        title: { display: true, text: 'จำนวนระเบียนสถานี-เดือนที่มีข้อมูลจริง (คลิกจังหวัดเพื่อกรอง)' }
      }
    }
  });
}

/**
 * Render Number of Stations by Province Bar Chart (Section 3 of Q5)
 */
function renderStationsByProvinceChart(state) {
  const canvas = document.getElementById('quality-stations-by-province-chart');
  if (!canvas) return;

  const db = getDb();
  const provStationStats = STUDY_PROVINCES.map(prov => {
    const list = db.stations.filter(s => {
      if (s.province !== prov) return false;
      if (state.weatherSource && state.weatherSource !== 'all' && s.source_type !== state.weatherSource) return false;
      return true;
    });
    return {
      province: prov,
      count: list.length
    };
  }).sort((a, b) => b.count - a.count);

  renderBarChart('quality-stations-by-province-chart', {
    labels: provStationStats.map(p => p.province),
    datasets: [
      {
        label: 'จำนวนสถานีตรวจวัด (แห่ง)',
        data: provStationStats.map(p => p.count),
        backgroundColor: provStationStats.map(p => state.province === p.province ? '#D97706' : '#0B96B5'),
        borderRadius: 6
      }
    ]
  }, {
    indexAxis: 'y',
    showValueLabels: true,
    onClick: (evt, elements) => {
      if (elements && elements.length > 0) {
        const idx = elements[0].index;
        const clickedProv = provStationStats[idx]?.province;
        if (clickedProv) {
          setState({ province: state.province === clickedProv ? null : clickedProv });
        }
      }
    },
    scales: {
      x: {
        title: { display: true, text: 'จำนวนสถานีตรวจวัด (แห่ง) — คลิกจังหวัดเพื่อกรอง' }
      }
    }
  });
}

/**
 * Render Weather Source Breakdown Chart (OpenWeatherMap vs HRDI Weather Station)
 */
function renderWeatherSourceDistributionChart(state) {
  const db = getDb();
  const sources = ['OpenWeatherMap', 'HRDI Weather Station'];

  const stationCounts = sources.map(src =>
    db.stations.filter(s => (!state.province || s.province === state.province) && s.source_type === src).length
  );

  const recordCounts = sources.map(src =>
    db.hrdiStationMonth.filter(r =>
      (!state.province || r.province === state.province) &&
      state.selectedMonths.includes(r.month) &&
      (state.yearMode === 'compare' ? [2022, 2023] : [Number(state.yearMode)]).includes(r.year) &&
      r.source_type === src
    ).length
  );

  renderBarChart('quality-source-comparison-chart', {
    labels: ['OpenWeatherMap (ข้อมูล API พื้นที่สูง)', 'HRDI Weather Station (สถานีตรวจวัดภาคสนาม)'],
    datasets: [
      {
        label: 'จำนวนสถานีตรวจวัด (แห่ง)',
        data: stationCounts,
        backgroundColor: '#0B96B5',
        borderRadius: 6
      },
      {
        label: 'จำนวนระเบียนในช่วงเวลาที่เลือก (ระเบียน)',
        data: recordCounts,
        backgroundColor: '#168B68',
        borderRadius: 6
      }
    ]
  }, {
    showValueLabels: true,
    onClick: (evt, elements) => {
      if (elements && elements.length > 0) {
        const idx = elements[0].index;
        const targetSource = sources[idx];
        if (targetSource) {
          setState({ weatherSource: state.weatherSource === targetSource ? 'all' : targetSource });
        }
      }
    },
    scales: {
      y: {
        title: { display: true, text: 'จำนวน (คลิกที่แท่งเพื่อกรองแหล่งข้อมูล Weather Source)' }
      }
    }
  });
}

/**
 * Render Interactive, Searchable & Expandable Station Metadata & Completeness Table
 */
function renderStationCompletenessTable(state) {
  const container = document.getElementById('quality-station-table-container');
  if (!container) return;

  const db = getDb();
  let stations = getAvailableStations(state.province, state.district, state.tambon, state.weatherSource);

  const query = (state.searchQuery || '').trim().toLowerCase();
  if (query) {
    stations = stations.filter(s =>
      (s.station_name || '').toLowerCase().includes(query) ||
      (s.station_id || '').toLowerCase().includes(query) ||
      (s.province || '').toLowerCase().includes(query) ||
      (s.district || '').toLowerCase().includes(query) ||
      (s.tambon || '').toLowerCase().includes(query) ||
      (s.source_type || '').toLowerCase().includes(query)
    );
  }

  const isExpanded = Boolean(window._stationTableExpanded || query || state.province);
  const displayStations = isExpanded ? stations : stations.slice(0, 8);

  const btnToggle = document.getElementById('btn-toggle-station-table');
  if (btnToggle) {
    if (stations.length <= 8 || query || state.province) {
      btnToggle.style.display = 'none';
    } else {
      btnToggle.style.display = 'inline-flex';
      btnToggle.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
      btnToggle.innerHTML = `<span>${isExpanded ? 'ย่อตารางสถานี (แสดง 8 แห่งแรก)' : `แสดงครบทุกสถานี (${stations.length} แห่ง)`}</span>`;
    }
  }

  let html = `
    <div class="matrix-meta-bar">
      <span>แสดง <strong>${displayStations.length}</strong> จากทั้งหมด <strong>${stations.length}</strong> สถานีที่ตรงตามเงื่อนไข</span>
      <span>คลิกแถวของสถานีเพื่อกรองข้อมูลเฉพาะสถานีนั้น</span>
    </div>
    <table class="matrix-table">
      <thead>
        <tr>
          <th style="text-align:left; padding-left:10px;">รหัสและชื่อสถานี (คลิกเพื่อกรอง)</th>
          <th>แหล่งข้อมูล (source_type)</th>
          <th>จังหวัด</th>
          <th>อำเภอ / ตำบล</th>
          <th>พิกัด (Lat, Lon)</th>
          <th>ระเบียนปี 2022</th>
          <th>ระเบียนปี 2023 (ม.ค.–ก.ย.)</th>
          <th>รวมระเบียนที่มีจริง</th>
        </tr>
      </thead>
      <tbody>
  `;

  if (displayStations.length === 0) {
    html += `<tr><td colspan="8" style="text-align:center; padding: 1.5rem; color: #43627A;">ไม่พบสถานีตามคำค้นหาหรือตัวกรองที่เลือก</td></tr>`;
  }

  for (const s of displayStations) {
    const r22 = db.hrdiStationMonth.filter(r => r.station_id === s.station_id && r.year === 2022).length;
    const r23 = db.hrdiStationMonth.filter(r => r.station_id === s.station_id && r.year === 2023).length;
    const total = r22 + r23;
    const isSelected = state.stationId === s.station_id;

    html += `
      <tr class="${isSelected ? 'matrix-row-selected' : ''}" style="cursor:pointer;" onclick="window.selectStation('${s.station_id}', '${s.province}', '${s.district || ''}', '${s.tambon || ''}')">
        <td style="text-align:left; padding-left:10px; font-weight:700; color:#102E47;">
          ${escapeHtml(s.station_id)} — ${escapeHtml(s.station_name)}
        </td>
        <td>
          <span class="source-type-badge ${s.source_type === 'HRDI Weather Station' ? 'hrdi-sensor' : 'owm'}">
            ${escapeHtml(s.source_type)}
          </span>
        </td>
        <td style="font-weight:600;">${escapeHtml(s.province)}</td>
        <td>${escapeHtml(s.district || '-')} / ${escapeHtml(s.tambon || '-')}</td>
        <td style="font-family:monospace; font-size:0.78rem;">${s.lat.toFixed(4)}, ${s.lon.toFixed(4)}</td>
        <td><strong>${r22}</strong> / 12 เดือน</td>
        <td><strong>${r23}</strong> / 9 เดือน</td>
        <td><strong style="color:#0B96B5;">${total}</strong> ระเบียน</td>
      </tr>
    `;
  }

  html += `</tbody></table>`;
  container.innerHTML = html;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
