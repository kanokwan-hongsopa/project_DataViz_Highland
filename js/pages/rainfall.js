/**
 * rainfall.js — Page 3: Rainfall Comparison (Q3, Q4)
 * Highland Climate & Hotspot Interactive Dashboard (2022–2023)
 * 
 * Strict contracts:
 * - rainfallComparable guardrail toggle default: false
 * - Side-by-side trend comparison with clear aggregation notes
 * - Station rainfall is mean across reporting stations, never sum
 * - HII provincial rainfall is clearly labeled as province-level context
 */

import { getState, setState } from '../state.js';
import { getDb } from '../data-loader.js';
import {
  filterStationMonthRecords,
  filterHiiRecords
} from '../filters.js';
import {
  calculateMean,
  calculateFairHrdiYoY,
  calculateFairHiiYoY,
  formatNum,
  formatInt
} from '../calculations.js';
import {
  renderLineChart,
  renderBarChart,
  THAI_MONTH_NAMES
} from '../charts.js';

/**
 * Initialize or update Page 3: Rainfall Comparison
 */
export function renderRainfallPage() {
  const state = getState();
  const db = getDb();

  // Filter HRDI records
  const hrdi2022 = filterStationMonthRecords(db.hrdiStationMonth, state, 2022);
  const hrdi2023 = filterStationMonthRecords(db.hrdiStationMonth, state, 2023);
  const hrdiAll = filterStationMonthRecords(db.hrdiStationMonth, state);

  // Filter HII records
  const hii2022 = filterHiiRecords(db.hiiProvinceMonth, state, 2022);
  const hii2023 = filterHiiRecords(db.hiiProvinceMonth, state, 2023);
  const hiiAll = filterHiiRecords(db.hiiProvinceMonth, state);

  // 1. Render Summary Comparison Cards
  renderRainfallSummaryCards(state, hrdiAll, hiiAll, hrdi2022, hrdi2023, hii2022, hii2023);

  // 2. Render Comparability Gate Notice
  renderComparabilityNotice(state);

  // 3. Render Dual-Series Monthly Line Chart (Q3)
  renderDualRainfallTimeSeries(state, hrdi2022, hrdi2023, hii2022, hii2023);

  // 4. Render Provincial Comparison Chart (Q4)
  renderProvincialRainfallComparison(state);
}

/**
 * Render Summary Comparison Cards
 */
function renderRainfallSummaryCards(state, hrdiAll, hiiAll, hrdi2022, hrdi2023, hii2022, hii2023) {
  const hrdiStats = calculateMean(hrdiAll, 'rainfall');
  const hiiStats = calculateMean(hiiAll, 'hii_avg_rain');

  // HRDI KPI
  const hrdiValEl = document.getElementById('rainfall-hrdi-val');
  const hrdiSubEl = document.getElementById('rainfall-hrdi-sub');
  if (hrdiValEl) hrdiValEl.textContent = formatNum(hrdiStats.mean, 1);
  if (hrdiSubEl) {
    if (state.yearMode === 'compare') {
      const hrdiYoY = calculateFairHrdiYoY(hrdi2022, hrdi2023, 'rainfall');
      const sign = hrdiYoY.diff > 0 ? '+' : '';
      hrdiSubEl.textContent = hrdiYoY.nPairs > 0
        ? `YoY: ${sign}${formatNum(hrdiYoY.diff, 1)} มม. (N = ${hrdiYoY.nPairs} คู่สถานี)`
        : hrdiYoY.note;
    } else {
      hrdiSubEl.textContent = `เฉลี่ยจาก ${hrdiStats.count} ค่าตรวจวัดรายสถานี`;
    }
  }

  // HII KPI
  const hiiValEl = document.getElementById('rainfall-hii-val');
  const hiiSubEl = document.getElementById('rainfall-hii-sub');
  if (hiiValEl) hiiValEl.textContent = formatNum(hiiStats.mean, 1);
  if (hiiSubEl) {
    if (state.yearMode === 'compare') {
      const hiiYoY = calculateFairHiiYoY(hii2022, hii2023);
      const sign = hiiYoY.diff > 0 ? '+' : '';
      hiiSubEl.textContent = hiiYoY.nPairs > 0
        ? `YoY: ${sign}${formatNum(hiiYoY.diff, 1)} มม. (${hiiYoY.nPairs} คู่จังหวัด-เดือน)`
        : 'ไม่มีข้อมูลเปรียบเทียบ';
    } else {
      hiiSubEl.textContent = `เฉลี่ยระดับจังหวัด (${hiiStats.count} รายการ HII)`;
    }
  }
}

/**
 * Render the Comparability Notice & Toggle Switch
 */
function renderComparabilityNotice(state) {
  const container = document.getElementById('rainfall-comparability-banner');
  if (!container) return;

  container.innerHTML = `
    <div class="notice-box ${state.rainfallComparable ? 'warning' : 'info'}" style="margin-bottom: 1.25rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
        <div>
          <strong>📌 ข้อควรระวังเชิงระเบียบวิธีวิจัย (Methodological Notice — Q3 & Q4):</strong><br>
          ข้อมูลฝน HRDI รวบรวมจากเซนเซอร์ภาคพื้นดินเฉพาะจุดบนพื้นที่สูง (รายสถานี) ในขณะที่ข้อมูลฝน HII เป็นค่าประมาณเฉลี่ยพื้นที่ระดับจังหวัด (Area-weighted province rainfall) 
          การคำนวณผลต่างเชิงตัวเลขโดยตรง (HRDI − HII) อาจมีความคลาดเคลื่อนทางกายภาพ จึงแนะนำให้สำรวจแนวโน้มรายเดือนร่วมกันเป็นกราฟคู่
        </div>
        <div style="display: flex; align-items: center; gap: 0.5rem; white-space: nowrap;">
          <label for="toggle-rainfall-comparable" style="font-size: 0.8rem; font-weight: 600; cursor: pointer;">
            สวิตช์เปิดการคำนวณผลต่างเชิงตัวเลข:
          </label>
          <input type="checkbox" id="toggle-rainfall-comparable" ${state.rainfallComparable ? 'checked' : ''} style="cursor: pointer; width: 16px; height: 16px;" onchange="window.toggleRainfallComparable(this.checked)">
        </div>
      </div>
    </div>
  `;
}

/**
 * Render Dual-Series Monthly Time Series (Q3)
 */
function renderDualRainfallTimeSeries(state, hrdi2022, hrdi2023, hii2022, hii2023) {
  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const labels = months.map(m => THAI_MONTH_NAMES[m - 1]);

  const datasets = [];

  if (state.yearMode === '2022' || state.yearMode === 'compare') {
    const hrdiVals = months.map(m => calculateMean(hrdi2022.filter(r => r.month === m), 'rainfall').mean);
    const hiiVals = months.map(m => calculateMean(hii2022.filter(r => r.month === m), 'hii_avg_rain').mean);

    datasets.push({
      label: 'ฝนสถานี HRDI 2022 (มม.)',
      data: hrdiVals,
      borderColor: '#2563eb',
      backgroundColor: 'rgba(37, 99, 235, 0.1)',
      borderWidth: 2,
      tension: 0.3,
      spanGaps: false,
      pointRadius: 4
    });

    datasets.push({
      label: 'ฝนจังหวัด HII 2022 (มม.)',
      data: hiiVals,
      borderColor: '#93c5fd',
      borderDash: [5, 5],
      borderWidth: 2,
      tension: 0.3,
      spanGaps: false,
      pointRadius: 3
    });
  }

  if (state.yearMode === '2023' || state.yearMode === 'compare') {
    const hrdiVals = months.map(m => calculateMean(hrdi2023.filter(r => r.month === m), 'rainfall').mean);
    const hiiVals = months.map(m => calculateMean(hii2023.filter(r => r.month === m), 'hii_avg_rain').mean);

    datasets.push({
      label: 'ฝนสถานี HRDI 2023 (มม.)',
      data: hrdiVals,
      borderColor: '#0d9488',
      backgroundColor: 'rgba(13, 148, 136, 0.1)',
      borderWidth: 2,
      tension: 0.3,
      spanGaps: false,
      pointRadius: 4
    });

    datasets.push({
      label: 'ฝนจังหวัด HII 2023 (มม.)',
      data: hiiVals,
      borderColor: '#5eead4',
      borderDash: [5, 5],
      borderWidth: 2,
      tension: 0.3,
      spanGaps: false,
      pointRadius: 3
    });
  }

  renderLineChart('rainfall-dual-series-chart', {
    labels,
    datasets
  }, {
    plugins: {
      tooltip: {
        callbacks: {
          label: (context) => ` ${context.dataset.label}: ${context.parsed.y !== null ? context.parsed.y.toFixed(1) + ' มม.' : 'ไม่มีข้อมูล'}`
        }
      }
    },
    scales: {
      y: {
        title: { display: true, text: 'ปริมาณน้ำฝน (มิลลิเมตร)', font: { size: 11 } }
      }
    }
  });
}

/**
 * Render Provincial Comparison Bar Chart (Q4)
 */
function renderProvincialRainfallComparison(state) {
  const db = getDb();
  const provinces = db.config?.provinces || [
    'กาญจนบุรี', 'กำแพงเพชร', 'ตาก', 'น่าน', 'พิษณุโลก',
    'เชียงราย', 'เชียงใหม่', 'เพชรบูรณ์', 'แม่ฮ่องสอน'
  ];

  const targetYear = state.yearMode === 'compare' ? 2022 : Number(state.yearMode);
  const selectedMonths = new Set(state.selectedMonths);

  const provData = provinces.map(prov => {
    const hrdiList = db.hrdiStationMonth.filter(r =>
      r.province === prov && r.year === targetYear && selectedMonths.has(r.month)
    );
    const hrdiMean = calculateMean(hrdiList, 'rainfall').mean;

    const hiiList = db.hiiProvinceMonth.filter(r =>
      r.province === prov && r.year === targetYear && selectedMonths.has(r.month)
    );
    const hiiMean = calculateMean(hiiList, 'hii_avg_rain').mean;

    const diff = (hrdiMean !== null && hiiMean !== null) ? hrdiMean - hiiMean : null;

    return {
      province: prov,
      hrdiMean,
      hiiMean,
      diff,
      stationCount: new Set(hrdiList.map(r => r.station_id)).size
    };
  });

  // If rainfallComparable is toggled ON, sort by absolute difference; otherwise sort by province name
  if (state.rainfallComparable) {
    provData.sort((a, b) => (Math.abs(b.diff || 0)) - (Math.abs(a.diff || 0)));
  }

  const labels = provData.map(d => `${d.province} (${d.stationCount} สถานี)`);

  let datasets = [];

  if (state.rainfallComparable) {
    // Show Difference Chart when gate is explicitly opened
    datasets = [{
      label: `ผลต่างเชิงปริมาณ (HRDI สถานี − HII จังหวัด) ปี ${targetYear} (มม.)`,
      data: provData.map(d => d.diff),
      backgroundColor: provData.map(d => (d.diff >= 0 ? '#0d9488' : '#e11d48')),
      borderRadius: 4
    }];
  } else {
    // Default safe side-by-side comparison
    datasets = [
      {
        label: `ฝนเฉลี่ยสถานีพื้นที่สูง HRDI (${targetYear})`,
        data: provData.map(d => d.hrdiMean),
        backgroundColor: '#2563eb',
        borderRadius: 4
      },
      {
        label: `ฝนเฉลี่ยระดับจังหวัด HII (${targetYear})`,
        data: provData.map(d => d.hiiMean),
        backgroundColor: '#93c5fd',
        borderRadius: 4
      }
    ];
  }

  renderBarChart('rainfall-provincial-comparison-chart', {
    labels,
    datasets
  }, {
    onClick: (evt, elements) => {
      if (elements && elements.length > 0) {
        const idx = elements[0].index;
        const clickedProvince = provinces[idx];
        setState({ province: clickedProvince });
      }
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: (context) => ` ${context.dataset.label}: ${context.parsed.y !== null ? context.parsed.y.toFixed(1) + ' มม.' : 'ไม่มีข้อมูล'}`
        }
      }
    },
    scales: {
      y: {
        title: {
          display: true,
          text: state.rainfallComparable ? 'ผลต่าง (มม.)' : 'ปริมาณน้ำฝน (มม.)',
          font: { size: 11 }
        }
      }
    }
  });
}
