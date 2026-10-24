/**
 * climate.js — Page 2: Highland Climate (Q1, Q2)
 * Highland Climate & Hotspot Interactive Dashboard (2022–2023)
 */

import { getState, setState } from '../state.js';
import { getDb, getStations } from '../data-loader.js';
import { filterStationMonthRecords } from '../filters.js';
import {
  calculateMean,
  calculateFairHrdiYoY,
  formatNum,
  formatInt
} from '../calculations.js';
import {
  renderLineChart,
  renderBarChart,
  THAI_MONTH_NAMES
} from '../charts.js';

export const METRIC_CONFIG = {
  temp: { label: 'อุณหภูมิเฉลี่ย', unit: '°C', decimals: 1, minColor: '#3b82f6', maxColor: '#ef4444' },
  temp_min: { label: 'อุณหภูมิต่ำสุด', unit: '°C', decimals: 1, minColor: '#1d4ed8', maxColor: '#f97316' },
  temp_max: { label: 'อุณหภูมิสูงสุด', unit: '°C', decimals: 1, minColor: '#60a5fa', maxColor: '#b91c1c' },
  rainfall: { label: 'ปริมาณน้ำฝน', unit: 'มม.', decimals: 1, minColor: '#e0f2fe', maxColor: '#0284c7' },
  humidity: { label: 'ความชื้นสัมพัทธ์', unit: '%', decimals: 1, minColor: '#fef3c7', maxColor: '#0d9488' },
  wind_speed: { label: 'ความเร็วลม', unit: 'ม./วินาที', decimals: 2, minColor: '#f1f5f9', maxColor: '#64748b' }
};

/**
 * Initialize or update Page 2: Highland Climate
 */
export function renderClimatePage() {
  const state = getState();
  const db = getDb();

  const metric = state.metric || 'temp';
  const metricCfg = METRIC_CONFIG[metric] || METRIC_CONFIG.temp;

  // Filter HRDI records
  const hrdi2022 = filterStationMonthRecords(db.hrdiStationMonth, state, 2022);
  const hrdi2023 = filterStationMonthRecords(db.hrdiStationMonth, state, 2023);
  const hrdiAll = filterStationMonthRecords(db.hrdiStationMonth, state);

  // 1. Render Summary Cards
  renderClimateSummaryCards(state, hrdi2022, hrdi2023, hrdiAll, metric, metricCfg);

  // 2. Render Monthly Time Series (Q1)
  renderClimateTimeSeries(state, hrdi2022, hrdi2023, metric, metricCfg);

  // 3. Render Station Ranking Bar Chart (Q2)
  renderClimateStationRanking(state, hrdiAll, metric, metricCfg);

  // 4. Render Station x Month Heatmap Grid (Q2)
  renderClimateHeatmap(state, metric, metricCfg);
}

/**
 * Render Summary Metric Cards on Climate Page
 */
function renderClimateSummaryCards(state, hrdi2022, hrdi2023, hrdiAll, metric, metricCfg) {
  const stats = calculateMean(hrdiAll, metric);

  const valEl = document.getElementById('climate-metric-mean-val');
  const unitEl = document.getElementById('climate-metric-unit');
  const subEl = document.getElementById('climate-metric-sub');
  const minMaxEl = document.getElementById('climate-metric-minmax');

  if (valEl) valEl.textContent = formatNum(stats.mean, metricCfg.decimals);
  if (unitEl) unitEl.textContent = metricCfg.unit;
  if (minMaxEl) {
    minMaxEl.textContent = stats.count > 0
      ? `ต่ำสุด ${formatNum(stats.min, metricCfg.decimals)} ${metricCfg.unit} / สูงสุด ${formatNum(stats.max, metricCfg.decimals)} ${metricCfg.unit}`
      : 'ไม่มีข้อมูล';
  }

  if (subEl) {
    if (state.yearMode === 'compare') {
      const yoy = calculateFairHrdiYoY(hrdi2022, hrdi2023, metric);
      if (yoy.nPairs > 0) {
        const sign = yoy.diff > 0 ? '+' : '';
        const deltaClass = yoy.diff > 0 ? 'positive' : yoy.diff < 0 ? 'negative' : 'neutral';
        subEl.innerHTML = `
          <span class="kpi-delta ${deltaClass}">YoY ${sign}${yoy.diff.toFixed(metricCfg.decimals)} ${metricCfg.unit} (${yoy.pctChange ? (yoy.diff > 0 ? '+' : '') + yoy.pctChange.toFixed(1) + '%' : 'N/A'})</span>
          <span>(N = ${yoy.nPairs} คู่สถานีตรงกัน)</span>
        `;
      } else {
        subEl.textContent = yoy.note;
      }
    } else {
      subEl.textContent = `จาก ${stats.count} รายการสังเกตจริง (ปี ${state.yearMode})`;
    }
  }
}

/**
 * Render Monthly Climate Time Series (Q1)
 */
function renderClimateTimeSeries(state, hrdi2022, hrdi2023, metric, metricCfg) {
  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const labels = months.map(m => THAI_MONTH_NAMES[m - 1]);

  const vals2022 = months.map(m => {
    const list = hrdi2022.filter(r => r.month === m);
    return calculateMean(list, metric).mean;
  });

  const vals2023 = months.map(m => {
    const list = hrdi2023.filter(r => r.month === m);
    return calculateMean(list, metric).mean;
  });

  const datasets = [];

  if (state.yearMode === '2022' || state.yearMode === 'compare') {
    datasets.push({
      label: `ปี 2022 (${metricCfg.label})`,
      data: vals2022,
      borderColor: '#2563eb',
      backgroundColor: 'rgba(37, 99, 235, 0.1)',
      tension: 0.3,
      spanGaps: false,
      pointRadius: 4
    });
  }

  if (state.yearMode === '2023' || state.yearMode === 'compare') {
    datasets.push({
      label: `ปี 2023 (${metricCfg.label})`,
      data: vals2023,
      borderColor: '#0d9488',
      backgroundColor: 'rgba(13, 148, 136, 0.1)',
      tension: 0.3,
      spanGaps: false,
      pointRadius: 4
    });
  }

  renderLineChart('climate-time-series-chart', {
    labels,
    datasets
  }, {
    plugins: {
      tooltip: {
        callbacks: {
          label: (context) => ` ${context.dataset.label}: ${context.parsed.y !== null ? context.parsed.y.toFixed(metricCfg.decimals) + ' ' + metricCfg.unit : 'ไม่มีข้อมูล'}`
        }
      }
    },
    scales: {
      y: {
        title: {
          display: true,
          text: `${metricCfg.label} (${metricCfg.unit})`,
          font: { size: 11 }
        }
      }
    }
  });
}

/**
 * Render Station Ranking Bar Chart (Q2)
 */
function renderClimateStationRanking(state, hrdiAll, metric, metricCfg) {
  // Group records by station_id
  const stationMap = new Map();
  for (const r of hrdiAll) {
    if (!stationMap.has(r.station_id)) {
      stationMap.set(r.station_id, {
        name: r.station_name,
        province: r.province,
        records: []
      });
    }
    stationMap.get(r.station_id).records.push(r);
  }

  const stationStats = [];
  for (const [id, item] of stationMap.entries()) {
    const st = calculateMean(item.records, metric);
    if (st.mean !== null) {
      stationStats.push({
        id,
        name: item.name,
        province: item.province,
        mean: st.mean,
        count: st.count
      });
    }
  }

  // Sort descending by mean
  stationStats.sort((a, b) => b.mean - a.mean);

  // Take top 15 for readable bar chart or all if filtered
  const displayList = stationStats.slice(0, 15);
  const labels = displayList.map(s => `${s.name} (${s.province})`);
  const data = displayList.map(s => s.mean);

  renderBarChart('climate-station-ranking-chart', {
    labels,
    datasets: [{
      label: `${metricCfg.label} (${metricCfg.unit})`,
      data,
      backgroundColor: '#0d9488',
      borderRadius: 4
    }]
  }, {
    indexAxis: 'y',
    onClick: (evt, elements) => {
      if (elements && elements.length > 0) {
        const idx = elements[0].index;
        const targetStation = displayList[idx];
        setState({ stationId: targetStation.id, province: targetStation.province });
      }
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: (context) => ` ${metricCfg.label}: ${context.parsed.x.toFixed(metricCfg.decimals)} ${metricCfg.unit}`
        }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: `${metricCfg.label} (${metricCfg.unit}) — คลิกแท่งเพื่อเลือกสถานี`,
          font: { size: 11 }
        }
      }
    }
  });
}

/**
 * Render Station x Month Matrix Heatmap (Q2)
 */
function renderClimateHeatmap(state, metric, metricCfg) {
  const container = document.getElementById('climate-heatmap-container');
  if (!container) return;

  const db = getDb();
  const targetYear = state.yearMode === 'compare' ? 2022 : Number(state.yearMode);

  // Filter stations based on province/district selection
  const stations = db.stations.filter(s => {
    if (state.province && s.province !== state.province) return false;
    if (state.district && s.district !== state.district) return false;
    return true;
  });

  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  // Map station-month records for fast lookup
  const recordMap = new Map();
  for (const r of db.hrdiStationMonth) {
    if (r.year === targetYear) {
      recordMap.set(`${r.station_id}_${r.month}`, r[metric]);
    }
  }

  // Find overall min and max for heatmap color scaling
  let minVal = Infinity;
  let maxVal = -Infinity;
  for (const s of stations) {
    for (const m of months) {
      const val = recordMap.get(`${s.station_id}_${m}`);
      if (val !== undefined && val !== null && !Number.isNaN(Number(val))) {
        const num = Number(val);
        if (num < minVal) minVal = num;
        if (num > maxVal) maxVal = num;
      }
    }
  }

  // Construct table HTML
  let tableHtml = `
    <div style="margin-bottom: 0.5rem; font-size: 0.8rem; color: #64748b;">
      แสดงข้อมูลปี <strong>${targetYear}</strong> (${stations.length} สถานี) | Missing แสดงผลด้วย "—" ไม่แทนค่าด้วยศูนย์
    </div>
    <table class="matrix-table">
      <thead>
        <tr>
          <th style="min-width: 180px; text-align: left; padding-left: 8px;">สถานีตรวจวัด</th>
          <th>จังหวัด</th>
          ${months.map(m => `<th>${THAI_MONTH_NAMES[m - 1]}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
  `;

  for (const s of stations) {
    const isSelected = state.stationId === s.station_id;
    tableHtml += `
      <tr style="${isSelected ? 'background: #f0fdfa; font-weight: 700;' : ''}">
        <td class="station-col" style="cursor: pointer;" onclick="window.selectStation('${s.station_id}', '${s.province}')">
          📍 ${escapeHtml(s.station_name)}
        </td>
        <td style="color: #64748b; font-size: 0.75rem;">${escapeHtml(s.province)}</td>
    `;

    for (const m of months) {
      const val = recordMap.get(`${s.station_id}_${m}`);
      if (val !== undefined && val !== null && !Number.isNaN(Number(val))) {
        const num = Number(val);
        // Normalized color interpolation (0 to 1)
        const ratio = maxVal > minVal ? (num - minVal) / (maxVal - minVal) : 0.5;
        // Teal gradient: rgba(13, 148, 136, alpha)
        const bgAlpha = 0.12 + ratio * 0.7;
        const textColor = ratio > 0.65 ? '#ffffff' : '#0f172a';
        tableHtml += `
          <td style="background-color: rgba(13, 148, 136, ${bgAlpha.toFixed(2)}); color: ${textColor};" title="${s.station_name} เดือน ${THAI_MONTH_NAMES[m - 1]}: ${num.toFixed(metricCfg.decimals)} ${metricCfg.unit}">
            ${num.toFixed(metricCfg.decimals)}
          </td>
        `;
      } else {
        tableHtml += `<td style="color: #cbd5e1; background: #fafafa;" title="ไม่มีข้อมูลสังเกตจริง">—</td>`;
      }
    }

    tableHtml += `</tr>`;
  }

  tableHtml += `</tbody></table>`;
  container.innerHTML = tableHtml;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
