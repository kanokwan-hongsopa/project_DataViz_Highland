/**
 * rainfall.js — Page 3: เปรียบเทียบฝน HRDI และ HII (Rainfall Comparison - Q3, Q4)
 * Highland Climate & Hotspot Intelligence Platform (2022–2023)
 */

import { getState, setState } from '../state.js';
import { getDb } from '../data-loader.js';
import {
  filterStationMonthRecords,
  filterHiiRecords,
  STUDY_PROVINCES
} from '../filters.js';
import {
  calculateMean,
  calculateFairHrdiYoY,
  calculateFairHiiYoY,
  formatNum
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

  const hrdi2022 = filterStationMonthRecords(db.hrdiStationMonth, state, 2022);
  const hrdi2023 = filterStationMonthRecords(db.hrdiStationMonth, state, 2023);
  const hrdiAll = filterStationMonthRecords(db.hrdiStationMonth, state);

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
 * Render Comparability Notice & Toggle Switch
 */
function renderComparabilityNotice(state) {
  const container = document.getElementById('rainfall-comparability-banner');
  if (!container) return;

  container.innerHTML = `
    <div class="notice-box ${state.rainfallComparable ? 'warning' : 'info'}" style="margin-bottom: 1.25rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
        <div>
          <strong style="color: #ffffff;">ข้อควรระวังเชิงระเบียบวิธีวิจัยและมาตราส่วนข้อมูล (Q3 & Q4):</strong><br>
          ข้อมูลฝน HRDI ตรวจวัดเฉพาะจุดบนสถานีพื้นที่สูง (Highland Station Point) ขณะที่ข้อมูลฝน HII เป็นค่าประมาณเฉลี่ยภาพรวมระดับจังหวัด (Area-weighted Provincial Average) 
          การคำนวณผลต่างเชิงตัวเลข (HRDI − HII) อาจมีความคลาดเคลื่อนทางกายภาพ จึงแนะนำให้สำรวจแนวโน้มรายเดือนร่วมกันเป็นกราฟคู่
        </div>
        <div style="display: flex; align-items: center; gap: 0.5rem; white-space: nowrap;">
          <label for="toggle-rainfall-comparable" style="font-size: 0.8rem; font-weight: 600; cursor: pointer; color: #cbd5e1;">
            เปิดการคำนวณผลต่างเชิงตัวเลข:
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
      borderColor: '#f59e0b',
      backgroundColor: 'rgba(245, 158, 11, 0.1)',
      borderWidth: 2,
      tension: 0.3,
      spanGaps: false,
      pointRadius: 4
    });

    datasets.push({
      label: 'ฝนจังหวัด HII 2022 (มม.)',
      data: hiiVals,
      borderColor: '#fcd34d',
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
      borderColor: '#06b6d4',
      backgroundColor: 'rgba(6, 182, 212, 0.1)',
      borderWidth: 2,
      tension: 0.3,
      spanGaps: false,
      pointRadius: 4
    });

    datasets.push({
      label: 'ฝนจังหวัด HII 2023 (มม.)',
      data: hiiVals,
      borderColor: '#a5f3fc',
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
        title: { display: true, text: 'ปริมาณน้ำฝน (มิลลิเมตร)', color: '#94a3b8', font: { size: 11 } }
      }
    }
  });
}

/**
 * Render Provincial Comparison Bar Chart (Q4)
 */
function renderProvincialRainfallComparison(state) {
  const db = getDb();
  const targetYear = state.yearMode === 'compare' ? 2022 : Number(state.yearMode);
  const selectedMonths = new Set(state.selectedMonths);

  const provData = STUDY_PROVINCES.map(prov => {
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

  if (state.rainfallComparable) {
    provData.sort((a, b) => (Math.abs(b.diff || 0)) - (Math.abs(a.diff || 0)));
  }

  const labels = provData.map(d => `${d.province} (${d.stationCount} สถานี)`);
  let datasets = [];

  if (state.rainfallComparable) {
    datasets = [{
      label: `ผลต่าง (HRDI สถานี − HII จังหวัด) ปี ${targetYear} (มม.)`,
      data: provData.map(d => d.diff),
      backgroundColor: provData.map(d => (d.diff >= 0 ? '#0d9488' : '#ef4444')),
      borderRadius: 4
    }];
  } else {
    datasets = [
      {
        label: `ฝนเฉลี่ยสถานี HRDI (${targetYear})`,
        data: provData.map(d => d.hrdiMean),
        backgroundColor: '#0d9488',
        borderRadius: 4
      },
      {
        label: `ฝนเฉลี่ยระดับจังหวัด HII (${targetYear})`,
        data: provData.map(d => d.hiiMean),
        backgroundColor: '#0284c7',
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
        const clickedProvince = STUDY_PROVINCES[idx];
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
          color: '#94a3b8',
          font: { size: 11 }
        }
      }
    }
  });
}
