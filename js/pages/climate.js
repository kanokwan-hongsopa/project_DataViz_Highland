/**
 * climate.js — Page 2 (Q2): แนวโน้มและฤดูกาล (Seasonal & Monthly Climate Trends - Q1, Q2, Q3)
 * Highland Climate & Hotspot Intelligence Platform (2022–2023)
 */

import { getState, setState, DEFAULT_MONTHS_COMPARE, ALL_MONTHS } from '../state.js';
import { getDb } from '../data-loader.js';
import {
  filterStationMonthRecords,
  filterHiiRecords,
  getAvailableStations
} from '../filters.js';
import {
  calculateMean,
  calculateFairHrdiYoY,
  calculateFairHiiYoY,
  formatNum,
  formatInt,
  formatSignedDelta
} from '../calculations.js';
import {
  renderLineChart,
  renderBarChart,
  THAI_MONTH_NAMES,
  YEAR_COLORS
} from '../charts.js';

export const METRIC_CONFIG = {
  temp: { label: 'อุณหภูมิเฉลี่ย', unit: '°C', decimals: 1 },
  temp_min: { label: 'อุณหภูมิต่ำสุด', unit: '°C', decimals: 1 },
  temp_max: { label: 'อุณหภูมิสูงสุด', unit: '°C', decimals: 1 },
  rainfall: { label: 'ปริมาณน้ำฝนสถานี (HRDI)', unit: 'มม.', decimals: 1 },
  humidity: { label: 'ความชื้นสัมพัทธ์', unit: '%', decimals: 1 },
  wind_speed: { label: 'ความเร็วลม', unit: 'ม./วินาที', decimals: 2 }
};

/**
 * Initialize or update Page 2 (Q2): Seasonal & Monthly Climate Trends
 */
export function renderClimatePage() {
  const state = getState();
  const db = getDb();

  const metric = state.metric || 'temp';
  const metricCfg = METRIC_CONFIG[metric] || METRIC_CONFIG.temp;

  // Filter HRDI records (respects weatherSource, province, district, tambon, stationId, selectedMonths)
  const hrdi2022 = filterStationMonthRecords(db.hrdiStationMonth, state, 2022);
  const hrdi2023 = filterStationMonthRecords(db.hrdiStationMonth, state, 2023);
  const hrdiAll = filterStationMonthRecords(db.hrdiStationMonth, state);

  // Filter HII provincial rainfall records for seasonal rainfall comparison
  const hii2022 = filterHiiRecords(db.hiiProvinceMonth, state, 2022);
  const hii2023 = filterHiiRecords(db.hiiProvinceMonth, state, 2023);
  const hiiAll = filterHiiRecords(db.hiiProvinceMonth, state);

  // 1. Render Summary Cards
  renderClimateSummaryCards(state, hrdi2022, hrdi2023, hrdiAll, hii2022, hii2023, hiiAll, metric, metricCfg);

  // 2. Render Monthly Time Series (Q1) with Click-to-Filter Month
  renderClimateTimeSeries(state, metric, metricCfg);

  // 3. Render Station Ranking Bar Chart (Q2) with Click-to-Select Station
  renderClimateStationRanking(state, hrdiAll, metric, metricCfg);

  // 4. Render Seasonal Rainfall & Climate Pattern Chart (Q1 & Q3)
  renderSeasonalPatternChart(state);

  // 5. Render Station x Month Heatmap Grid (Q2)
  renderClimateHeatmap(state, metric, metricCfg);

  // 6. Update Question Titles & Dynamic Key Insights (Q2)
  renderClimateInsights(state, hrdi2022, hrdi2023, hrdiAll, metric, metricCfg);
}

function renderClimateInsights(state, hrdi2022, hrdi2023, hrdiAll, metric, metricCfg) {
  const tsTitle = document.getElementById('climate-timeseries-title');
  if (tsTitle) {
    tsTitle.textContent = `${metricCfg.label}รายเดือนเปลี่ยนไปอย่างไร?`;
  }
  const stTitle = document.getElementById('climate-station-rank-title');
  if (stTitle) {
    stTitle.textContent = `สถานีตรวจวัดไหนมี${metricCfg.label}สูงที่สุด?`;
  }

  const insightEl = document.getElementById('insight-q2');
  if (!insightEl) return;

  const stats = calculateMean(hrdiAll, metric);
  if (stats.count === 0) {
    insightEl.textContent = 'ไม่พบข้อมูลสถานีตรวจวัดภายใต้เงื่อนไขตัวกรองที่เลือก';
    return;
  }

  // Find peak month across filtered records
  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const monthMeans = months.map(m => ({
    month: m,
    mean: calculateMean(hrdiAll.filter(r => r.month === m), metric).mean
  })).filter(d => d.mean !== null).sort((a, b) => b.mean - a.mean);

  const topMonth = monthMeans[0];
  const lowMonth = monthMeans[monthMeans.length - 1];
  const scopeTxt = state.province ? `จ.${state.province}` : 'พื้นที่ศึกษา 9 จังหวัด';

  if (topMonth && lowMonth) {
    insightEl.textContent = `ใน${scopeTxt} ค่า${metricCfg.label}เฉลี่ยอยู่ที่ ${formatNum(stats.mean, metricCfg.decimals)} ${metricCfg.unit} โดยสูงสุดในเดือน${THAI_MONTH_NAMES[topMonth.month - 1]} (${formatNum(topMonth.mean, metricCfg.decimals)} ${metricCfg.unit}) และต่ำสุดในเดือน${THAI_MONTH_NAMES[lowMonth.month - 1]} (${formatNum(lowMonth.mean, metricCfg.decimals)} ${metricCfg.unit})`;
  } else {
    insightEl.textContent = `ใน${scopeTxt} ค่า${metricCfg.label}เฉลี่ยอยู่ที่ ${formatNum(stats.mean, metricCfg.decimals)} ${metricCfg.unit} (จาก ${stats.count} ระเบียนตรวจวัดจริง)`;
  }
}

/**
 * Render Summary Metric Cards on Climate Page
 */
function renderClimateSummaryCards(state, hrdi2022, hrdi2023, hrdiAll, hii2022, hii2023, hiiAll, metric, metricCfg) {
  const stats = calculateMean(hrdiAll, metric);
  const matchedStations = getAvailableStations(state.province, state.district, state.tambon, state.weatherSource);

  const valEl = document.getElementById('climate-metric-mean-val');
  const unitEl = document.getElementById('climate-metric-unit');
  const subEl = document.getElementById('climate-metric-sub');
  const minMaxEl = document.getElementById('climate-metric-minmax');
  const hiiSummaryEl = document.getElementById('climate-hii-rain-summary');

  if (valEl) valEl.textContent = formatNum(stats.mean, metricCfg.decimals);
  if (unitEl) unitEl.textContent = metricCfg.unit;
  if (minMaxEl) {
    minMaxEl.textContent = stats.count > 0
      ? `ต่ำสุด ${formatNum(stats.min, metricCfg.decimals)} ${metricCfg.unit} / สูงสุด ${formatNum(stats.max, metricCfg.decimals)} ${metricCfg.unit} (${matchedStations.length} สถานี · ${state.weatherSource === 'all' ? 'ทุกแหล่ง' : state.weatherSource})`
      : 'ไม่พบข้อมูลตามตัวกรองที่เลือก';
  }

  if (subEl) {
    if (state.yearMode === 'compare') {
      const yoy = calculateFairHrdiYoY(hrdi2022, hrdi2023, metric);
      if (yoy.nPairs > 0 && yoy.diff !== null) {
        const deltaClass = yoy.diff > 0 ? 'positive' : yoy.diff < 0 ? 'negative' : 'neutral';
        const pctStr = yoy.pctChange !== null ? ` (${formatSignedDelta(yoy.pctChange, 1, '%')})` : '';
        subEl.innerHTML = `
          <span class="kpi-delta ${deltaClass}">YoY ${formatSignedDelta(yoy.diff, metricCfg.decimals, metricCfg.unit)}${pctStr}</span>
          <span>(${yoy.nPairs} คู่สถานี-เดือนตรงกัน)</span>
        `;
      } else {
        subEl.textContent = `N/A (${yoy.note})`;
      }
    } else {
      subEl.textContent = `คำนวณจาก ${formatInt(stats.count)} ระเบียนตรวจวัดจริง (ปี ${state.yearMode})`;
    }
  }

  if (hiiSummaryEl) {
    const hiiStats = calculateMean(hiiAll, 'hii_avg_rain');
    if (state.yearMode === 'compare') {
      const hiiYoy = calculateFairHiiYoY(hii2022, hii2023);
      const diffTxt = hiiYoy.diff !== null ? formatSignedDelta(hiiYoy.diff, 1, 'มม.') : 'N/A';
      hiiSummaryEl.textContent = `ฝนเฉลี่ยระดับจังหวัด (HII): ${formatNum(hiiStats.mean, 1)} มม./เดือน (YoY ${diffTxt} จาก ${hiiYoy.nPairs} คู่จังหวัด-เดือน)`;
    } else {
      hiiSummaryEl.textContent = `ฝนเฉลี่ยระดับจังหวัด (HII ปี ${state.yearMode}): ${formatNum(hiiStats.mean, 1)} มม./เดือน (${hiiStats.count} ระเบียนจังหวัด-เดือน)`;
    }
  }
}

/**
 * Render Monthly Climate Time Series (Q1)
 */
function renderClimateTimeSeries(state, metric, metricCfg) {
  const db = getDb();
  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const labels = months.map(m => THAI_MONTH_NAMES[m - 1]);
  const selectedSet = new Set(state.selectedMonths);

  // Query 12 months for current geographic & weatherSource filter so full annual curve is shown
  const stateAllMonths = { ...state, selectedMonths: ALL_MONTHS };
  const hrdi2022Full = filterStationMonthRecords(db.hrdiStationMonth, stateAllMonths, 2022);
  const hrdi2023Full = filterStationMonthRecords(db.hrdiStationMonth, stateAllMonths, 2023);

  const vals2022 = months.map(m => calculateMean(hrdi2022Full.filter(r => r.month === m), metric).mean);
  const vals2023 = months.map(m => calculateMean(hrdi2023Full.filter(r => r.month === m), metric).mean);

  const pointRadii = months.map(m => selectedSet.has(m) ? 5.5 : 3);
  const datasets = [];

  if (state.yearMode === '2022' || state.yearMode === 'compare') {
    datasets.push({
      label: `ปี 2022 (${metricCfg.label})`,
      data: vals2022,
      borderColor: YEAR_COLORS.y2022,
      backgroundColor: YEAR_COLORS.y2022Bg,
      pointBackgroundColor: months.map(m => selectedSet.has(m) ? YEAR_COLORS.y2022 : '#FFFFFF'),
      pointBorderColor: YEAR_COLORS.y2022,
      borderWidth: 2.5,
      tension: 0.3,
      spanGaps: false,
      pointRadius: pointRadii
    });
  }

  if (state.yearMode === '2023' || state.yearMode === 'compare') {
    datasets.push({
      label: `ปี 2023 (${metricCfg.label})`,
      data: vals2023,
      borderColor: YEAR_COLORS.y2023,
      backgroundColor: YEAR_COLORS.y2023Bg,
      pointBackgroundColor: months.map(m => selectedSet.has(m) ? YEAR_COLORS.y2023 : '#FFFFFF'),
      pointBorderColor: YEAR_COLORS.y2023,
      borderWidth: 2.5,
      tension: 0.3,
      spanGaps: false,
      pointRadius: pointRadii
    });
  }

  renderLineChart('climate-time-series-chart', {
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
          label: (context) => ` ${context.dataset.label}: ${context.parsed.y !== null ? context.parsed.y.toFixed(metricCfg.decimals) + ' ' + metricCfg.unit : 'ไม่มีข้อมูลตรวจวัด (ต.ค.–ธ.ค. 2023)'}`
        }
      }
    },
    scales: {
      y: {
        title: {
          display: true,
          text: `${metricCfg.label} (${metricCfg.unit})`
        }
      }
    }
  });
}

/**
 * Render Seasonal Pattern & Rainfall Comparison Chart (Summer Mar–May, Rainy Jun–Oct, Winter Nov–Feb) (Q1 & Q3)
 */
function renderSeasonalPatternChart(state) {
  const canvas = document.getElementById('climate-seasonal-chart');
  if (!canvas) return;

  const db = getDb();
  const stateAllMonths = { ...state, selectedMonths: ALL_MONTHS };
  const hrdi22 = filterStationMonthRecords(db.hrdiStationMonth, stateAllMonths, 2022);
  const hrdi23 = filterStationMonthRecords(db.hrdiStationMonth, stateAllMonths, 2023);
  const hii22 = filterHiiRecords(db.hiiProvinceMonth, stateAllMonths, 2022);
  const hii23 = filterHiiRecords(db.hiiProvinceMonth, stateAllMonths, 2023);

  const seasons = [
    { name: 'ฤดูหนาว (พ.ย.–ก.พ.)', months: [1, 2, 11, 12] },
    { name: 'ฤดูร้อน (มี.ค.–พ.ค.)', months: [3, 4, 5] },
    { name: 'ฤดูฝน (มิ.ย.–ต.ค.)', months: [6, 7, 8, 9, 10] }
  ];

  const metric = state.metric || 'temp';
  const metricCfg = METRIC_CONFIG[metric] || METRIC_CONFIG.temp;

  const s2022 = seasons.map(s => calculateMean(hrdi22.filter(r => s.months.includes(r.month)), metric).mean);
  const s2023 = seasons.map(s => calculateMean(hrdi23.filter(r => s.months.includes(r.month)), metric).mean);

  const datasets = [];
  if (state.yearMode === '2022' || state.yearMode === 'compare') {
    datasets.push({
      label: `ปี 2022 — ${metricCfg.label} (HRDI)`,
      data: s2022,
      backgroundColor: YEAR_COLORS.y2022,
      borderRadius: 6
    });
  }
  if (state.yearMode === '2023' || state.yearMode === 'compare') {
    datasets.push({
      label: `ปี 2023 — ${metricCfg.label} (HRDI ม.ค.–ก.ย.)`,
      data: s2023,
      backgroundColor: YEAR_COLORS.y2023,
      borderRadius: 6
    });
  }

  // If metric is rainfall, also overlay HII seasonal provincial averages as a distinct reference bar series
  if (metric === 'rainfall') {
    if (state.yearMode === '2022' || state.yearMode === 'compare') {
      datasets.push({
        label: 'ปี 2022 — ฝนระดับจังหวัด (HII)',
        data: seasons.map(s => calculateMean(hii22.filter(r => s.months.includes(r.month)), 'hii_avg_rain').mean),
        backgroundColor: '#38BDF8',
        borderRadius: 6
      });
    }
    if (state.yearMode === '2023' || state.yearMode === 'compare') {
      datasets.push({
        label: 'ปี 2023 — ฝนระดับจังหวัด (HII)',
        data: seasons.map(s => calculateMean(hii23.filter(r => s.months.includes(r.month)), 'hii_avg_rain').mean),
        backgroundColor: '#1D4ED8',
        borderRadius: 6
      });
    }
  }

  renderBarChart('climate-seasonal-chart', {
    labels: seasons.map(s => s.name),
    datasets
  }, {
    showValueLabels: true,
    valueLabelFormatter: (v) => formatNum(v, 1),
    onClick: (evt, elements) => {
      if (elements && elements.length > 0) {
        const idx = elements[0].index;
        const targetMonths = seasons[idx]?.months;
        if (targetMonths) {
          setState({ selectedMonths: [...targetMonths].sort((a, b) => a - b) });
        }
      }
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${ctx.dataset.label}: ${formatNum(ctx.parsed.y, metricCfg.decimals)} ${metricCfg.unit}`
        }
      }
    },
    scales: {
      y: {
        title: { display: true, text: `${metricCfg.label} (${metricCfg.unit}) — คลิกฤดูกาลเพื่อกรองเดือน` }
      }
    }
  });
}

/**
 * Render Station Ranking Bar Chart (Q2)
 */
function renderClimateStationRanking(state, hrdiAll, metric, metricCfg) {
  const stationMap = new Map();
  for (const r of hrdiAll) {
    if (!stationMap.has(r.station_id)) {
      stationMap.set(r.station_id, {
        id: r.station_id,
        name: r.station_name,
        province: r.province,
        district: r.district,
        tambon: r.tambon,
        source_type: r.source_type,
        records: []
      });
    }
    stationMap.get(r.station_id).records.push(r);
  }

  const stationStats = [];
  for (const [, item] of stationMap.entries()) {
    const st = calculateMean(item.records, metric);
    if (st.mean !== null) {
      stationStats.push({
        ...item,
        mean: st.mean,
        count: st.count
      });
    }
  }

  stationStats.sort((a, b) => b.mean - a.mean);
  const displayList = stationStats.slice(0, 15);
  const labels = displayList.map((s, idx) => `${idx + 1}. ${s.name} (${s.province})`);
  const data = displayList.map(s => s.mean);

  renderBarChart('climate-station-ranking-chart', {
    labels,
    datasets: [{
      label: `${metricCfg.label} (${metricCfg.unit})`,
      data,
      backgroundColor: displayList.map(s => state.stationId === s.id ? '#D97706' : '#0B96B5'),
      borderRadius: 5
    }]
  }, {
    indexAxis: 'y',
    showValueLabels: true,
    valueLabelFormatter: (v) => formatNum(v, metricCfg.decimals),
    onClick: (evt, elements) => {
      if (elements && elements.length > 0) {
        const idx = elements[0].index;
        const targetStation = displayList[idx];
        if (targetStation) {
          const isSame = state.stationId === targetStation.id;
          setState({
            stationId: isSame ? null : targetStation.id,
            province: targetStation.province,
            district: isSame ? state.district : targetStation.district,
            tambon: isSame ? state.tambon : targetStation.tambon
          });
        }
      }
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: (context) => {
            const st = displayList[context.dataIndex];
            return ` ${metricCfg.label}: ${context.parsed.x.toFixed(metricCfg.decimals)} ${metricCfg.unit} (${st?.source_type || 'HRDI'}, N=${st?.count || 0})`;
          }
        }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: `${metricCfg.label} (${metricCfg.unit}) — คลิกแท่งเพื่อเลือกสถานี`
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
  const targetYear = state.yearMode === 'compare' ? 2023 : Number(state.yearMode);

  const stations = getAvailableStations(state.province, state.district, state.tambon, state.weatherSource);

  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const recordMap = new Map();
  for (const r of db.hrdiStationMonth) {
    if (r.year === targetYear) {
      recordMap.set(`${r.station_id}_${r.month}`, r[metric]);
    }
  }

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

  let tableHtml = `
    <div class="matrix-meta-bar">
      <span>ตารางสถานี × เดือน ปี <strong>${targetYear}</strong> (${stations.length} สถานี · แหล่งข้อมูล: <strong>${state.weatherSource === 'all' ? 'ทุกแหล่ง' : state.weatherSource}</strong>)</span>
      <span>หมายเหตุ: เดือนที่ไม่มีข้อมูลตรวจวัด (ต.ค.–ธ.ค. 2023) แสดงด้วย <strong>"—"</strong> (ไม่แทนค่าด้วย 0)</span>
    </div>
    <table class="matrix-table">
      <thead>
        <tr>
          <th style="min-width: 190px; text-align: left; padding-left: 10px;">สถานีตรวจวัด (คลิกเพื่อเลือก)</th>
          <th>แหล่งข้อมูล</th>
          <th>จังหวัด</th>
          ${months.map(m => `<th class="${state.selectedMonths.includes(m) ? 'th-month-active' : ''}">${THAI_MONTH_NAMES[m - 1]}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
  `;

  if (stations.length === 0) {
    tableHtml += `
      <tr>
        <td colspan="15" style="text-align:center; padding: 1.5rem; color: #43627A;">ไม่พบข้อมูลตามตัวกรองที่เลือก</td>
      </tr>
    `;
  }

  for (const s of stations) {
    const isSelected = state.stationId === s.station_id;
    const shortSource = s.source_type === 'HRDI Weather Station' ? 'HRDI Sensor' : 'OpenWeatherMap';
    tableHtml += `
      <tr class="${isSelected ? 'matrix-row-selected' : ''}">
        <td class="station-col" style="cursor: pointer;" onclick="window.selectStation('${s.station_id}', '${s.province}', '${s.district || ''}', '${s.tambon || ''}')">
          ${escapeHtml(s.station_name)}
        </td>
        <td style="font-size: 0.72rem; color: #0B96B5; font-weight: 600;">${shortSource}</td>
        <td style="color: #43627A; font-size: 0.76rem; font-weight: 600;">${escapeHtml(s.province)}</td>
    `;

    for (const m of months) {
      const val = recordMap.get(`${s.station_id}_${m}`);
      if (val !== undefined && val !== null && !Number.isNaN(Number(val))) {
        const num = Number(val);
        const ratio = maxVal > minVal ? (num - minVal) / (maxVal - minVal) : 0.5;
        const bgAlpha = 0.14 + ratio * 0.68;
        const textColor = ratio > 0.62 ? '#FFFFFF' : '#102E47';
        tableHtml += `
          <td style="background-color: rgba(11, 150, 181, ${bgAlpha.toFixed(2)}); color: ${textColor}; font-weight: 600;" title="${s.station_name} เดือน ${THAI_MONTH_NAMES[m - 1]} ${targetYear}: ${num.toFixed(metricCfg.decimals)} ${metricCfg.unit}">
            ${num.toFixed(metricCfg.decimals)}
          </td>
        `;
      } else {
        tableHtml += `<td class="matrix-cell-missing" title="ไม่มีข้อมูลสังเกตจริง (Missing Data)">—</td>`;
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
