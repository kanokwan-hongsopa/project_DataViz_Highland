/**
 * correlation.js — Page 5: ความสัมพันธ์สภาพอากาศกับจุดความร้อน (Q6, Q7, Q8)
 * Highland Climate & Hotspot Intelligence Platform (2022–2023)
 * 
 * Strict contracts:
 * - Proximity definition strictly fixed to 10 km radius around HRDI stations
 * - Proximity dropdown completely removed as required by Section 7
 * - Historical statistical trendlines (Linear Regression) supported
 * - Correlation does NOT imply causation (clearly stated)
 * - Strict calendar-adjacent lag analysis (no gap bridging)
 */

import { getState } from '../state.js';
import { getDb } from '../data-loader.js';
import { filterStationMonthRecords } from '../filters.js';
import {
  calculatePearsonR,
  calculateLaggedPairs,
  formatNum,
  formatInt
} from '../calculations.js';
import {
  renderScatterChart
} from '../charts.js';

/**
 * Initialize or update Page 5: Climate × Hotspot
 */
export function renderCorrelationPage() {
  const state = getState();
  const db = getDb();

  const filteredRecords = filterStationMonthRecords(db.stationMonthDashboard, state);

  // Proximity definition strictly fixed to 10 km buffer
  const proximityField = 'hotspots_within_10km';
  const proximityLabel = 'รัศมี 10 กิโลเมตรรอบสถานี HRDI';

  // 1. Render Explanation Banner (replacing the old dropdown)
  renderCorrelationHeader(state, filteredRecords, proximityLabel);

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
 * Render Explanation Banner without any proximity dropdown (Section 7 compliance)
 */
function renderCorrelationHeader(state, records, proximityLabel) {
  const container = document.getElementById('correlation-method-container');
  if (container) {
    container.innerHTML = `
      <div class="notice-box info" style="margin-bottom: 1.25rem;">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem;">
          <div>
            <strong style="color: #ffffff;">ขอบเขตการวิเคราะห์ความสัมพันธ์เชิงสำรวจ (Q6, Q7, Q8):</strong><br>
            วิเคราะห์ความสัมพันธ์ระหว่างข้อมูลภูมิอากาศรายสถานี–เดือน กับจำนวนจุดความร้อนที่ตรวจพบภายใน${proximityLabel} 
            <em>(ข้อห้าม: ไม่รวมยอดจุดความร้อนรอบสถานีเป็นยอดจังหวัด เพื่อป้องกันการนับซ้ำจากรัศมีที่ทับซ้อนกัน)</em>
          </div>
          <div style="font-size: 0.8rem; background: rgba(6, 182, 212, 0.15); border: 1px solid rgba(6, 182, 212, 0.4); padding: 4px 10px; border-radius: 4px; color: #22d3ee; font-weight: 600;">
            นิยามคงที่: รัศมี 10 กิโลเมตรรอบสถานี
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

  const badgeEl = document.getElementById('q6-r-badge');
  if (badgeEl) {
    badgeEl.textContent = rResult.r !== null
      ? `Pearson r = ${rResult.r.toFixed(3)} (${rResult.pStrength}, N = ${rResult.n})`
      : rResult.pStrength;
  }

  renderScatterChart('q6-rainfall-hotspots-scatter', {
    datasets: [{
      label: 'สถานี-เดือน (สังเกตการณ์จริง)',
      data: dataPoints,
      backgroundColor: 'rgba(6, 182, 212, 0.65)',
      borderColor: '#22d3ee',
      pointRadius: 5,
      pointHoverRadius: 7
    }]
  }, {
    showTrendline: true,
    plugins: {
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const raw = ctx.raw;
            if (!raw.stationName) return ` ค่าแนวโน้ม: ${raw.y.toFixed(1)}`;
            return [
              `สถานี: ${raw.stationName} (${raw.province})`,
              `ช่วงเวลา: ปี ${raw.year} เดือน ${raw.month}`,
              `ปริมาณฝน: ${raw.x.toFixed(1)} มม.`,
              `จุดความร้อน (${proximityLabel}): ${raw.y} รายการ`
            ];
          }
        }
      }
    },
    scales: {
      x: {
        title: { display: true, text: 'ปริมาณน้ำฝนสถานี HRDI (มิลลิเมตร)', color: '#94a3b8', font: { size: 11 } }
      },
      y: {
        title: { display: true, text: `จุดความร้อนตรวจพบ (${proximityLabel})`, color: '#94a3b8', font: { size: 11 } }
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
      label: 'สถานี-เดือน (สังเกตการณ์จริง)',
      data: dataPoints,
      backgroundColor: 'rgba(239, 68, 68, 0.65)',
      borderColor: '#f87171',
      pointRadius: 5,
      pointHoverRadius: 7
    }]
  }, {
    showTrendline: true,
    plugins: {
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const raw = ctx.raw;
            if (!raw.stationName) return ` ค่าแนวโน้ม: ${raw.y.toFixed(1)}`;
            return [
              `สถานี: ${raw.stationName} (${raw.province})`,
              `ช่วงเวลา: ปี ${raw.year} เดือน ${raw.month}`,
              `อุณหภูมิเฉลี่ย: ${raw.x.toFixed(1)} °C`,
              `จุดความร้อน (${proximityLabel}): ${raw.y} รายการ`
            ];
          }
        }
      }
    },
    scales: {
      x: {
        title: { display: true, text: 'อุณหภูมิเฉลี่ย (°C)', color: '#94a3b8', font: { size: 11 } }
      },
      y: {
        title: { display: true, text: `จุดความร้อนตรวจพบ (${proximityLabel})`, color: '#94a3b8', font: { size: 11 } }
      }
    }
  });
}

/**
 * Render Humidity vs Nearby Hotspots Scatter (Q7)
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
      label: 'สถานี-เดือน (สังเกตการณ์จริง)',
      data: dataPoints,
      backgroundColor: 'rgba(13, 148, 136, 0.65)',
      borderColor: '#2dd4bf',
      pointRadius: 5,
      pointHoverRadius: 7
    }]
  }, {
    showTrendline: true,
    plugins: {
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const raw = ctx.raw;
            if (!raw.stationName) return ` ค่าแนวโน้ม: ${raw.y.toFixed(1)}`;
            return [
              `สถานี: ${raw.stationName} (${raw.province})`,
              `ช่วงเวลา: ปี ${raw.year} เดือน ${raw.month}`,
              `ความชื้นสัมพัทธ์: ${raw.x.toFixed(1)} %`,
              `จุดความร้อน (${proximityLabel}): ${raw.y} รายการ`
            ];
          }
        }
      }
    },
    scales: {
      x: {
        title: { display: true, text: 'ความชื้นสัมพัทธ์ (%)', color: '#94a3b8', font: { size: 11 } }
      },
      y: {
        title: { display: true, text: `จุดความร้อนตรวจพบ (${proximityLabel})`, color: '#94a3b8', font: { size: 11 } }
      }
    }
  });
}

/**
 * Render Lagged Exploratory Analysis (Q8):
 * Prior month climate (t-1) vs Next month hotspots (t) for same station
 */
function renderLaggedAnalysis(records, proximityField, proximityLabel) {
  const rainLag = calculateLaggedPairs(records, 'rainfall', proximityField);
  const tempLag = calculateLaggedPairs(records, 'temp', proximityField);

  const lagInfoEl = document.getElementById('q8-lag-info');
  if (lagInfoEl) {
    lagInfoEl.innerHTML = `
      <span>ฝนเดือนก่อนหน้า (t-1) vs จุดความร้อนเดือนถัดไป (t): <strong style="color: #22d3ee;">Pearson r = ${rainLag.rResult.r !== null ? rainLag.rResult.r.toFixed(3) : 'N/A'}</strong> (N = ${rainLag.rResult.n} คู่เดือนติดกัน)</span>
      <span style="margin-left: 1rem;">อุณหภูมิเดือนก่อนหน้า (t-1) vs จุดความร้อนเดือนถัดไป (t): <strong style="color: #f87171;">Pearson r = ${tempLag.rResult.r !== null ? tempLag.rResult.r.toFixed(3) : 'N/A'}</strong> (N = ${tempLag.rResult.n})</span>
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
      label: 'คู่เดือนติดกันจริง (t-1 vs t)',
      data: lagScatterData,
      backgroundColor: 'rgba(245, 158, 11, 0.65)',
      borderColor: '#fbbf24',
      pointRadius: 5,
      pointHoverRadius: 7
    }]
  }, {
    showTrendline: true,
    plugins: {
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const raw = ctx.raw;
            if (!raw.stationName) return ` ค่าแนวโน้ม: ${raw.y.toFixed(1)}`;
            return [
              `สถานี: ${raw.stationName} (${raw.province})`,
              `ฝนเดือนก่อนหน้า (${raw.prevPeriod}): ${raw.x.toFixed(1)} มม.`,
              `จุดความร้อนเดือนถัดไป (${raw.nextPeriod}): ${raw.y} รายการ`
            ];
          }
        }
      }
    },
    scales: {
      x: {
        title: { display: true, text: 'ปริมาณฝนสถานีในเดือนก่อนหน้า t-1 (มิลลิเมตร)', color: '#94a3b8', font: { size: 11 } }
      },
      y: {
        title: { display: true, text: `จุดความร้อนตรวจพบในเดือนถัดไป t (${proximityLabel})`, color: '#94a3b8', font: { size: 11 } }
      }
    }
  });
}
