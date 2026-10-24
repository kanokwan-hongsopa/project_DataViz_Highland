/**
 * correlation.js — Page 5: Climate × Hotspot (Q6, Q7, Q8)
 * Highland Climate & Hotspot Interactive Dashboard (2022–2023)
 * 
 * Strict contracts:
 * - Correlation does NOT imply causation; exploratory label required
 * - Proximity methods: '10km' buffer vs 'tambon' subdistrict
 * - Never sum station buffer counts into provincial totals
 * - Strict calendar-adjacent lag analysis (no gap bridging)
 */

import { getState, setState } from '../state.js';
import { getDb } from '../data-loader.js';
import { filterStationMonthRecords } from '../filters.js';
import {
  calculatePearsonR,
  calculateLaggedPairs,
  formatNum,
  formatInt
} from '../calculations.js';
import {
  renderScatterChart,
  renderLineChart
} from '../charts.js';

/**
 * Initialize or update Page 5: Climate × Hotspot
 */
export function renderCorrelationPage() {
  const state = getState();
  const db = getDb();

  // Filter records from station_month_dashboard (precomputed buffer counts)
  const filteredRecords = filterStationMonthRecords(db.stationMonthDashboard, state);

  // Determine proximity field
  const proximityField = state.proximityMethod === 'tambon'
    ? 'hotspots_same_tambon'
    : 'hotspots_within_10km';

  const proximityLabel = state.proximityMethod === 'tambon'
    ? 'ในตำบลเดียวกันกับสถานี'
    : 'รัศมี 10 กม. รอบสถานี';

  // 1. Render Correlation Stat Cards & Method Toggle
  renderCorrelationHeader(state, filteredRecords, proximityField, proximityLabel);

  // 2. Scatter Plot: Rainfall vs Nearby Hotspots (Q6)
  renderRainfallVsHotspotsScatter(filteredRecords, proximityField, proximityLabel);

  // 3. Scatter Plot: Temperature vs Nearby Hotspots (Q7)
  renderTempVsHotspotsScatter(filteredRecords, proximityField, proximityLabel);

  // 4. Scatter Plot: Humidity vs Nearby Hotspots (Q7)
  renderHumidityVsHotspotsScatter(filteredRecords, proximityField, proximityLabel);

  // 5. Lagged Exploratory Analysis (Q8)
  renderLaggedAnalysis(filteredRecords, proximityField, proximityLabel);
}

/**
 * Render Header, Proximity Method Toggle and Correlation Stat Summary
 */
function renderCorrelationHeader(state, records, proximityField, proximityLabel) {
  const container = document.getElementById('correlation-method-container');
  if (container) {
    container.innerHTML = `
      <div class="notice-box info" style="margin-bottom: 1rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
          <div>
            <strong>📌 ขอบเขตและนิยามการจับคู่ข้อมูล (Proximity Definition — Q6 & Q7):</strong><br>
            ข้อมูลสภาพอากาศและจุดความร้อนจับคู่ในระดับ <strong>รายสถานี-เดือน (Station-Month)</strong> 
            โดยจำนวนจุดความร้อนนับเฉพาะที่ตรวจพบใน ${proximityLabel} 
            <em>(ข้อห้าม: ไม่สามารถนำยอดจุดความร้อนรอบสถานีหลายแห่งมาบวกกันเป็นยอดจังหวัดได้ เนื่องจากรัศมี 10 กม. อาจมีพื้นที่ทับซ้อนกัน)</em>
          </div>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <label style="font-size: 0.8rem; font-weight: 600;">วิธีการนับจุดความร้อนรอบสถานี:</label>
            <select class="filter-select" onchange="window.selectProximityMethod(this.value)" style="min-width: 170px;">
              <option value="10km" ${state.proximityMethod === '10km' ? 'selected' : ''}>รัศมี 10 กม. (พิกัดจริง)</option>
              <option value="tambon" ${state.proximityMethod === 'tambon' ? 'selected' : ''}>ตำบลเดียวกัน (ขอบเขตปกครอง)</option>
            </select>
          </div>
        </div>
      </div>
    `;
  }
}

/**
 * Render Rainfall vs Nearby Hotspots Scatter (Q6)
 */
function renderRainfallVsHotspotsScatter(records, proximityField, proximityLabel) {
  const dataPoints = [];
  for (const r of records) {
    if (
      r.rainfall !== null && r.rainfall !== undefined &&
      r[proximityField] !== null && r[proximityField] !== undefined
    ) {
      dataPoints.push({
        x: Number(r.rainfall),
        y: Number(r[proximityField]),
        stationName: r.station_name,
        province: r.province,
        year: r.year,
        month: r.month
      });
    }
  }

  const rResult = calculatePearsonR(dataPoints, 'x', 'y');

  // Update card badge
  const badgeEl = document.getElementById('q6-r-badge');
  if (badgeEl) {
    badgeEl.textContent = rResult.r !== null
      ? `Pearson r = ${rResult.r.toFixed(3)} (${rResult.pStrength}, N = ${rResult.n})`
      : rResult.pStrength;
  }

  renderScatterChart('q6-rainfall-hotspots-scatter', {
    datasets: [{
      label: 'สถานี-เดือน',
      data: dataPoints,
      backgroundColor: 'rgba(37, 99, 235, 0.65)',
      borderColor: '#1d4ed8',
      pointRadius: 5,
      pointHoverRadius: 7
    }]
  }, {
    plugins: {
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const raw = ctx.raw;
            return [
              `📍 ${raw.stationName} (${raw.province})`,
              `🗓️ ${raw.year} เดือน ${raw.month}`,
              `🌧️ ปริมาณฝน: ${raw.x.toFixed(1)} มม.`,
              `🔥 จุดความร้อน (${proximityLabel}): ${raw.y} รายการ`
            ];
          }
        }
      }
    },
    scales: {
      x: {
        title: { display: true, text: 'ปริมาณน้ำฝนสถานี HRDI (มิลลิเมตร)', font: { size: 11 } }
      },
      y: {
        title: { display: true, text: `จุดความร้อนตรวจพบ (${proximityLabel})`, font: { size: 11 } }
      }
    }
  });
}

/**
 * Render Temperature vs Nearby Hotspots Scatter (Q7)
 */
function renderTempVsHotspotsScatter(records, proximityField, proximityLabel) {
  const dataPoints = [];
  for (const r of records) {
    if (
      r.temp !== null && r.temp !== undefined &&
      r[proximityField] !== null && r[proximityField] !== undefined
    ) {
      dataPoints.push({
        x: Number(r.temp),
        y: Number(r[proximityField]),
        stationName: r.station_name,
        province: r.province,
        year: r.year,
        month: r.month
      });
    }
  }

  const rResult = calculatePearsonR(dataPoints, 'x', 'y');

  const badgeEl = document.getElementById('q7-temp-r-badge');
  if (badgeEl) {
    badgeEl.textContent = rResult.r !== null
      ? `Pearson r = ${rResult.r.toFixed(3)} (${rResult.pStrength}, N = ${rResult.n})`
      : rResult.pStrength;
  }

  renderScatterChart('q7-temp-hotspots-scatter', {
    datasets: [{
      label: 'สถานี-เดือน',
      data: dataPoints,
      backgroundColor: 'rgba(225, 29, 72, 0.65)',
      borderColor: '#be123c',
      pointRadius: 5,
      pointHoverRadius: 7
    }]
  }, {
    plugins: {
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const raw = ctx.raw;
            return [
              `📍 ${raw.stationName} (${raw.province})`,
              `🗓️ ${raw.year} เดือน ${raw.month}`,
              `🌡️ อุณหภูมิเฉลี่ย: ${raw.x.toFixed(1)} °C`,
              `🔥 จุดความร้อน: ${raw.y} รายการ`
            ];
          }
        }
      }
    },
    scales: {
      x: {
        title: { display: true, text: 'อุณหภูมิเฉลี่ย (°C)', font: { size: 11 } }
      },
      y: {
        title: { display: true, text: `จุดความร้อนตรวจพบ (${proximityLabel})`, font: { size: 11 } }
      }
    }
  });
}

/**
 * Render Relative Humidity vs Nearby Hotspots Scatter (Q7)
 */
function renderHumidityVsHotspotsScatter(records, proximityField, proximityLabel) {
  const dataPoints = [];
  for (const r of records) {
    if (
      r.humidity !== null && r.humidity !== undefined &&
      r[proximityField] !== null && r[proximityField] !== undefined
    ) {
      dataPoints.push({
        x: Number(r.humidity),
        y: Number(r[proximityField]),
        stationName: r.station_name,
        province: r.province,
        year: r.year,
        month: r.month
      });
    }
  }

  const rResult = calculatePearsonR(dataPoints, 'x', 'y');

  const badgeEl = document.getElementById('q7-humidity-r-badge');
  if (badgeEl) {
    badgeEl.textContent = rResult.r !== null
      ? `Pearson r = ${rResult.r.toFixed(3)} (${rResult.pStrength}, N = ${rResult.n})`
      : rResult.pStrength;
  }

  renderScatterChart('q7-humidity-hotspots-scatter', {
    datasets: [{
      label: 'สถานี-เดือน',
      data: dataPoints,
      backgroundColor: 'rgba(13, 148, 136, 0.65)',
      borderColor: '#0f766e',
      pointRadius: 5,
      pointHoverRadius: 7
    }]
  }, {
    plugins: {
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const raw = ctx.raw;
            return [
              `📍 ${raw.stationName} (${raw.province})`,
              `🗓️ ${raw.year} เดือน ${raw.month}`,
              `💧 ความชื้นสัมพัทธ์: ${raw.x.toFixed(1)} %`,
              `🔥 จุดความร้อน: ${raw.y} รายการ`
            ];
          }
        }
      }
    },
    scales: {
      x: {
        title: { display: true, text: 'ความชื้นสัมพัทธ์ (%)', font: { size: 11 } }
      },
      y: {
        title: { display: true, text: `จุดความร้อนตรวจพบ (${proximityLabel})`, font: { size: 11 } }
      }
    }
  });
}

/**
 * Render Lagged Exploratory Analysis (Q8):
 * Climate at month (t-1) vs Hotspots at month (t)
 */
function renderLaggedAnalysis(records, proximityField, proximityLabel) {
  // Compute lagged pairs for rainfall
  const rainLag = calculateLaggedPairs(records, 'rainfall', proximityField);
  const tempLag = calculateLaggedPairs(records, 'temp', proximityField);

  const lagInfoEl = document.getElementById('q8-lag-info');
  if (lagInfoEl) {
    lagInfoEl.innerHTML = `
      <span>ฝนเดือนก่อนหน้า (t-1) vs จุดความร้อนเดือนถัดไป (t): <strong>Pearson r = ${rainLag.rResult.r !== null ? rainLag.rResult.r.toFixed(3) : 'N/A'}</strong> (N = ${rainLag.rResult.n} คู่เดือนติดกัน)</span>
      <span style="margin-left: 1rem;">อุณหภูมิเดือนก่อนหน้า (t-1) vs จุดความร้อนเดือนถัดไป (t): <strong>Pearson r = ${tempLag.rResult.r !== null ? tempLag.rResult.r.toFixed(3) : 'N/A'}</strong> (N = ${tempLag.rResult.n})</span>
    `;
  }

  const lagScatterData = rainLag.pairs.map(p => ({
    x: p.climateValue,
    y: p.hotspotCount,
    stationName: p.stationName,
    province: p.province,
    prevPeriod: `${p.prevYear}/${p.prevMonth}`,
    nextPeriod: `${p.nextYear}/${p.nextMonth}`
  }));

  renderScatterChart('q8-lagged-scatter', {
    datasets: [{
      label: 'คู่เดือนติดกัน (t-1 vs t)',
      data: lagScatterData,
      backgroundColor: 'rgba(217, 119, 6, 0.65)',
      borderColor: '#b45309',
      pointRadius: 5,
      pointHoverRadius: 7
    }]
  }, {
    plugins: {
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const raw = ctx.raw;
            return [
              `📍 ${raw.stationName} (${raw.province})`,
              `🌧️ ฝนเดือนก่อนหน้า (${raw.prevPeriod}): ${raw.x.toFixed(1)} มม.`,
              `🔥 จุดความร้อนเดือนถัดไป (${raw.nextPeriod}): ${raw.y} รายการ`
            ];
          }
        }
      }
    },
    scales: {
      x: {
        title: { display: true, text: 'ปริมาณฝนสถานีในเดือนก่อนหน้า t-1 (มิลลิเมตร)', font: { size: 11 } }
      },
      y: {
        title: { display: true, text: `จุดความร้อนตรวจพบในเดือนถัดไป t (${proximityLabel})`, font: { size: 11 } }
      }
    }
  });
}
