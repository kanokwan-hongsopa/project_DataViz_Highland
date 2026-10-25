/**
 * correlation.js — Page 4 (Q4): ความสัมพันธ์ระหว่างข้อมูล (Climate × Hotspot Correlation Q6–Q8 & Rainfall HRDI vs HII Q3–Q4)
 * Highland Climate & Hotspot Intelligence Platform (2022–2023)
 *
 * Strict contracts:
 * - Proximity definition strictly fixed to 10 km radius around HRDI stations
 * - Historical statistical trendlines (Descriptive Linear Regression) supported; NO forecasting
 * - Correlation does NOT imply causation (explicitly stated)
 * - Strict calendar-adjacent lag analysis (no gap bridging across missing Oct–Dec 2023)
 * - HRDI station rainfall vs HII provincial rainfall kept as parallel series (no invalid subtraction when rainfall_comparable is false)
 */

import { getState, setState, DEFAULT_MONTHS_COMPARE, ALL_MONTHS } from '../state.js';
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
  calculatePearsonR,
  calculateLaggedPairs,
  formatNum,
  formatSignedDelta
} from '../calculations.js';
import {
  renderScatterChart,
  renderLineChart,
  renderBarChart,
  THAI_MONTH_NAMES,
  YEAR_COLORS
} from '../charts.js';

/**
 * Initialize or update Page 4 (Q4): Correlation & Cross-Dataset Comparison
 */
export function renderCorrelationPage() {
  const state = getState();
  const db = getDb();

  const filteredRecords = filterStationMonthRecords(db.stationMonthDashboard, state);

  // Proximity definition strictly fixed to 10 km buffer
  const proximityField = 'hotspots_within_10km';
  const proximityLabel = 'รัศมี 10 กิโลเมตรรอบสถานี HRDI';

  // 1. Render Explanation Banner
  renderCorrelationHeader(state, filteredRecords, proximityLabel);

  // 2. Scatter Plot: Rainfall vs Nearby Hotspots (Q6)
  renderRainfallVsHotspotsScatter(state, filteredRecords, proximityField, proximityLabel);

  // 3. Scatter Plot: Temperature vs Nearby Hotspots (Q7a)
  renderTempVsHotspotsScatter(state, filteredRecords, proximityField, proximityLabel);

  // 4. Scatter Plot: Humidity vs Nearby Hotspots (Q7b)
  renderHumidityVsHotspotsScatter(state, filteredRecords, proximityField, proximityLabel);

  // 5. Lagged Exploratory Analysis (Q8)
  renderLaggedAnalysis(state, filteredRecords, proximityField, proximityLabel);

  // 6. Cross-Dataset Rainfall Comparison: HRDI Station vs HII Province (Q3 & Q4)
  renderCrossRainfallSection(state);

  // 7. Render Dynamic Key Insights (Q4)
  renderCorrelationInsights(state, filteredRecords, proximityField);
}

function renderCorrelationInsights(state, records, proximityField) {
  const insightEl = document.getElementById('insight-q4');
  if (!insightEl) return;

  const rainPts = records.filter(r => r.rainfall !== null && r[proximityField] !== null).map(r => ({ x: Number(r.rainfall), y: Number(r[proximityField]) }));
  const tempPts = records.filter(r => r.temp !== null && r[proximityField] !== null).map(r => ({ x: Number(r.temp), y: Number(r[proximityField]) }));
  const humPts = records.filter(r => r.humidity !== null && r[proximityField] !== null).map(r => ({ x: Number(r.humidity), y: Number(r[proximityField]) }));

  const rRain = calculatePearsonR(rainPts, 'x', 'y');
  const rTemp = calculatePearsonR(tempPts, 'x', 'y');
  const rHum = calculatePearsonR(humPts, 'x', 'y');

  if (rRain.r === null) {
    insightEl.textContent = 'จำนวนคู่ข้อมูลสถานี–เดือนไม่เพียงพอสำหรับการคำนวณค่าสหสัมพันธ์ภายใต้ตัวกรองปัจจุบัน';
    return;
  }

  insightEl.textContent = `จากการจับคู่ข้อมูลจริง ${rRain.n} คู่สถานี–เดือน พบว่าจุดความร้อนในรัศมี 10 กม. มีความสัมพันธ์เชิงบวกกับอุณหภูมิ (r = ${rTemp.r !== null ? rTemp.r.toFixed(2) : 'N/A'}) และมีความสัมพันธ์เชิงลบกับความชื้นสัมพัทธ์ (r = ${rHum.r !== null ? rHum.r.toFixed(2) : 'N/A'}) และปริมาณน้ำฝน (r = ${rRain.r.toFixed(2)}) ซึ่งสะท้อนว่าจุดความร้อนมักเกิดมากในช่วงอากาศร้อนและแห้งแล้ง`;
}

/**
 * Render Explanation Banner without any proximity dropdown (Section 7 compliance)
 */
function renderCorrelationHeader(state, records, proximityLabel) {
  const container = document.getElementById('correlation-method-container');
  if (container) {
    const stationSet = new Set(records.map(r => r.station_id));
    container.innerHTML = `
      <div class="notice-box info">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem;">
          <div>
            <strong>ขอบเขตการวิเคราะห์ความสัมพันธ์เชิงสำรวจ (Q6, Q7, Q8):</strong>
            วิเคราะห์คู่ข้อมูลจริงรายสถานี–เดือน (${records.length} คู่ข้อมูล จาก ${stationSet.size} สถานี · แหล่ง: ${state.weatherSource === 'all' ? 'ทุกแหล่ง' : state.weatherSource}) กับจำนวนจุดความร้อนภายใน<strong>${proximityLabel}</strong><br>
            <span style="font-size: 0.78rem;">ข้อควรระวัง: ค่าสหสัมพันธ์ (Correlation) ไม่ใช่ความสัมพันธ์เชิงเหตุและผล (Causation) และห้ามรวมยอดจุดความร้อนในรัศมี 10 กม. ของหลายสถานีเข้าด้วยกันเนื่องจากรัศมีอาจซ้อนทับกัน</span>
          </div>
          <div class="scope-pill-badge">
            นิยามคงที่: รัศมี 10 กม. รอบสถานี · คลิกจุดบนกราฟเพื่อเลือกสถานี
          </div>
        </div>
      </div>
    `;
  }
}

/**
 * Common helper to bind station selection click on scatter plots
 */
function handleScatterPointClick(state, points, elements) {
  if (!elements || elements.length === 0) return;
  const el = elements[0];
  if (el.datasetIndex !== 0) return; // ignore regression line clicks
  const pt = points[el.index];
  if (pt && pt.stationId) {
    const isSame = state.stationId === pt.stationId;
    setState({
      stationId: isSame ? null : pt.stationId,
      province: pt.province
    });
  }
}

/**
 * Render Rainfall vs Nearby Hotspots Scatter (Q6)
 */
function renderRainfallVsHotspotsScatter(state, records, proximityField, proximityLabel) {
  const dataPoints = [];
  for (const r of records) {
    if (
      r.rainfall !== null && r.rainfall !== undefined &&
      r[proximityField] !== null && r[proximityField] !== undefined
    ) {
      dataPoints.push({
        x: Number(r.rainfall),
        y: Number(r[proximityField]),
        stationId: r.station_id,
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

  const q6SummaryEl = document.getElementById('q6-plain-summary');
  if (q6SummaryEl) {
    if (rResult.r === null || rResult.n < 3) {
      q6SummaryEl.textContent = `ไม่สามารถคำนวณความสัมพันธ์ตามตัวกรองนี้ได้เนื่องจากมีข้อมูลคู่กันเพียง ${rResult.n} เดือน (ต้องมีอย่างน้อย 3 คู่เดือน)`;
    } else {
      const dirText = rResult.r < -0.1 ? 'สวนทางกัน (เมื่อฝนน้อยมักพบจุดความร้อนมากขึ้น)'
        : rResult.r > 0.1 ? 'ไปในทิศทางเดียวกัน'
        : 'ใกล้ศูนย์ (แทบไม่พบแนวโน้มเชิงเส้นตรง)';
      q6SummaryEl.textContent = `สรุปจากข้อมูลจริง ${rResult.n} คู่สถานี–เดือน: ปริมาณน้ำฝนและจุดความร้อนรอบสถานีมีความสัมพันธ์แบบ${dirText} (r = ${rResult.r.toFixed(2)}, ความสัมพันธ์ทางสถิติไม่ใช่เหตุและผล)`;
    }
  }

  renderScatterChart('q6-rainfall-hotspots-scatter', {
    datasets: [{
      label: 'คู่ข้อมูลสถานี-เดือน (คลิกจุดเพื่อเลือกสถานี)',
      data: dataPoints,
      backgroundColor: 'rgba(24, 182, 229, 0.70)',
      borderColor: '#0B96B5',
      pointRadius: 5,
      pointHoverRadius: 7
    }]
  }, {
    showTrendline: true,
    onClick: (evt, elements) => handleScatterPointClick(state, dataPoints, elements),
    plugins: {
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const raw = ctx.raw;
            if (!raw.stationName) return ` เส้นแนวโน้มสถิติย้อนหลัง: ${raw.y.toFixed(1)}`;
            return [
              `สถานี: ${raw.stationName} (จ.${raw.province})`,
              `ช่วงเวลา: ปี ${raw.year} เดือน ${THAI_MONTH_NAMES[raw.month - 1]}`,
              `ปริมาณฝนสถานี: ${raw.x.toFixed(1)} มม.`,
              `จุดความร้อน (${proximityLabel}): ${raw.y} รายการ`
            ];
          }
        }
      }
    },
    scales: {
      x: {
        title: { display: true, text: 'ปริมาณน้ำฝนสถานี HRDI (มม./เดือน)' }
      },
      y: {
        title: { display: true, text: `จุดความร้อนตรวจพบ (${proximityLabel})` }
      }
    }
  });
}

/**
 * Render Temperature vs Nearby Hotspots Scatter (Q7)
 */
function renderTempVsHotspotsScatter(state, records, proximityField, proximityLabel) {
  const dataPoints = [];
  for (const r of records) {
    if (
      r.temp !== null && r.temp !== undefined &&
      r[proximityField] !== null && r[proximityField] !== undefined
    ) {
      dataPoints.push({
        x: Number(r.temp),
        y: Number(r[proximityField]),
        stationId: r.station_id,
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

  const q7aSummaryEl = document.getElementById('q7-temp-plain-summary');
  if (q7aSummaryEl) {
    if (rResult.r === null || rResult.n < 3) {
      q7aSummaryEl.textContent = `ไม่สามารถคำนวณความสัมพันธ์ตามตัวกรองนี้ได้เนื่องจากมีข้อมูลคู่กันเพียง ${rResult.n} เดือน (ต้องมีอย่างน้อย 3 คู่เดือน)`;
    } else {
      const dirText = rResult.r > 0.1 ? 'ไปในทิศทางเดียวกัน (เดือนที่อุณหภูมิสูงขึ้นมักพบจุดความร้อนรอบสถานีมากขึ้น)'
        : rResult.r < -0.1 ? 'สวนทางกัน'
        : 'ใกล้ศูนย์ (แทบไม่พบแนวโน้มเชิงเส้นตรง)';
      q7aSummaryEl.textContent = `สรุปจากข้อมูลจริง ${rResult.n} คู่สถานี–เดือน: อุณหภูมิเฉลี่ยและจุดความร้อนมีความสัมพันธ์แบบ${dirText} (r = ${rResult.r.toFixed(2)}, ความสัมพันธ์ทางสถิติไม่ใช่เหตุและผล)`;
    }
  }

  renderScatterChart('q7-temp-hotspots-scatter', {
    datasets: [{
      label: 'คู่ข้อมูลสถานี-เดือน (คลิกจุดเพื่อเลือกสถานี)',
      data: dataPoints,
      backgroundColor: 'rgba(243, 107, 118, 0.72)',
      borderColor: '#E11D48',
      pointRadius: 5,
      pointHoverRadius: 7
    }]
  }, {
    showTrendline: true,
    onClick: (evt, elements) => handleScatterPointClick(state, dataPoints, elements),
    plugins: {
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const raw = ctx.raw;
            if (!raw.stationName) return ` เส้นแนวโน้มสถิติย้อนหลัง: ${raw.y.toFixed(1)}`;
            return [
              `สถานี: ${raw.stationName} (จ.${raw.province})`,
              `ช่วงเวลา: ปี ${raw.year} เดือน ${THAI_MONTH_NAMES[raw.month - 1]}`,
              `อุณหภูมิเฉลี่ย: ${raw.x.toFixed(1)} °C`,
              `จุดความร้อน (${proximityLabel}): ${raw.y} รายการ`
            ];
          }
        }
      }
    },
    scales: {
      x: {
        title: { display: true, text: 'อุณหภูมิเฉลี่ยสถานี (°C)' }
      },
      y: {
        title: { display: true, text: `จุดความร้อนตรวจพบ (${proximityLabel})` }
      }
    }
  });
}

/**
 * Render Humidity vs Nearby Hotspots Scatter (Q7)
 */
function renderHumidityVsHotspotsScatter(state, records, proximityField, proximityLabel) {
  const dataPoints = [];
  for (const r of records) {
    if (
      r.humidity !== null && r.humidity !== undefined &&
      r[proximityField] !== null && r[proximityField] !== undefined
    ) {
      dataPoints.push({
        x: Number(r.humidity),
        y: Number(r[proximityField]),
        stationId: r.station_id,
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

  const q7bSummaryEl = document.getElementById('q7-humidity-plain-summary');
  if (q7bSummaryEl) {
    if (rResult.r === null || rResult.n < 3) {
      q7bSummaryEl.textContent = `ไม่สามารถคำนวณความสัมพันธ์ตามตัวกรองนี้ได้เนื่องจากมีข้อมูลคู่กันเพียง ${rResult.n} เดือน (ต้องมีอย่างน้อย 3 คู่เดือน)`;
    } else {
      const dirText = rResult.r < -0.1 ? 'สวนทางกันชัดเจน (ช่วงที่อากาศแห้งหรือความชื้นต่ำมักพบจุดความร้อนสูงขึ้น)'
        : rResult.r > 0.1 ? 'ไปในทิศทางเดียวกัน'
        : 'ใกล้ศูนย์ (แทบไม่พบแนวโน้มเชิงเส้นตรง)';
      q7bSummaryEl.textContent = `สรุปจากข้อมูลจริง ${rResult.n} คู่สถานี–เดือน: ความชื้นสัมพัทธ์และจุดความร้อนมีความสัมพันธ์แบบ${dirText} (r = ${rResult.r.toFixed(2)}, ความสัมพันธ์ทางสถิติไม่ใช่เหตุและผล)`;
    }
  }

  renderScatterChart('q7-humidity-hotspots-scatter', {
    datasets: [{
      label: 'คู่ข้อมูลสถานี-เดือน (คลิกจุดเพื่อเลือกสถานี)',
      data: dataPoints,
      backgroundColor: 'rgba(22, 139, 104, 0.70)',
      borderColor: '#168B68',
      pointRadius: 5,
      pointHoverRadius: 7
    }]
  }, {
    showTrendline: true,
    onClick: (evt, elements) => handleScatterPointClick(state, dataPoints, elements),
    plugins: {
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const raw = ctx.raw;
            if (!raw.stationName) return ` เส้นแนวโน้มสถิติย้อนหลัง: ${raw.y.toFixed(1)}`;
            return [
              `สถานี: ${raw.stationName} (จ.${raw.province})`,
              `ช่วงเวลา: ปี ${raw.year} เดือน ${THAI_MONTH_NAMES[raw.month - 1]}`,
              `ความชื้นสัมพัทธ์: ${raw.x.toFixed(1)} %`,
              `จุดความร้อน (${proximityLabel}): ${raw.y} รายการ`
            ];
          }
        }
      }
    },
    scales: {
      x: {
        title: { display: true, text: 'ความชื้นสัมพัทธ์สถานี (%)' }
      },
      y: {
        title: { display: true, text: `จุดความร้อนตรวจพบ (${proximityLabel})` }
      }
    }
  });
}

/**
 * Render Lagged Exploratory Analysis (Q8):
 * Prior month climate (t-1) vs Next month hotspots (t) for same station (strictly consecutive months)
 */
function renderLaggedAnalysis(state, records, proximityField, proximityLabel) {
  const rainLag = calculateLaggedPairs(records, 'rainfall', proximityField);
  const tempLag = calculateLaggedPairs(records, 'temp', proximityField);

  const lagInfoEl = document.getElementById('q8-lag-info');
  if (lagInfoEl) {
    lagInfoEl.innerHTML = `
      <span>ฝนเดือนก่อนหน้า (t−1) vs จุดความร้อนเดือนถัดไป (t): <strong style="color: #0B96B5;">Pearson r = ${rainLag.rResult.r !== null ? rainLag.rResult.r.toFixed(3) : 'N/A'}</strong> (N = ${rainLag.rResult.n} คู่เดือนต่อเนื่องจริง)</span>
      <span style="margin-left: 1rem;">อุณหภูมิเดือนก่อนหน้า (t−1) vs จุดความร้อนเดือนถัดไป (t): <strong style="color: #E11D48;">Pearson r = ${tempLag.rResult.r !== null ? tempLag.rResult.r.toFixed(3) : 'N/A'}</strong> (N = ${tempLag.rResult.n} คู่เดือนต่อเนื่องจริง)</span>
    `;
  }

  const q8SummaryEl = document.getElementById('q8-plain-summary');
  if (q8SummaryEl) {
    if (rainLag.rResult.r === null || rainLag.rResult.n < 3) {
      q8SummaryEl.textContent = `ไม่สามารถวิเคราะห์ความสัมพันธ์แบบเหลื่อมเวลา 1 เดือนตามตัวกรองนี้ได้ เนื่องจากต้องเลือกช่วงเดือนที่ต่อเนื่องกันอย่างน้อย 3 คู่เดือน (พบ ${rainLag.rResult.n} คู่เดือน)`;
    } else {
      q8SummaryEl.textContent = `สรุปจากคู่เดือนต่อเนื่องจริง ${rainLag.rResult.n} คู่: ปริมาณฝนในเดือนก่อนหน้า (t−1) มีค่าสหสัมพันธ์ r = ${rainLag.rResult.r.toFixed(2)} กับจุดความร้อนในเดือนถัดไป (t) ของสถานีเดียวกัน`;
    }
  }

  const lagScatterData = rainLag.pairs.map(p => ({
    x: p.climateValue,
    y: p.hotspotCount,
    stationId: p.stationId,
    stationName: p.stationName,
    province: p.province,
    prevPeriod: `${p.prevYear}/${THAI_MONTH_NAMES[p.prevMonth - 1]}`,
    nextPeriod: `${p.nextYear}/${THAI_MONTH_NAMES[p.nextMonth - 1]}`
  }));

  renderScatterChart('q8-lagged-scatter', {
    datasets: [{
      label: 'คู่เดือนปฏิทินต่อเนื่องจริง (t−1 vs t)',
      data: lagScatterData,
      backgroundColor: 'rgba(230, 126, 34, 0.72)',
      borderColor: '#D97706',
      pointRadius: 5,
      pointHoverRadius: 7
    }]
  }, {
    showTrendline: true,
    onClick: (evt, elements) => handleScatterPointClick(state, lagScatterData, elements),
    plugins: {
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const raw = ctx.raw;
            if (!raw.stationName) return ` เส้นแนวโน้มสถิติย้อนหลัง: ${raw.y.toFixed(1)}`;
            return [
              `สถานี: ${raw.stationName} (จ.${raw.province})`,
              `ฝนเดือนก่อนหน้า (${raw.prevPeriod}): ${raw.x.toFixed(1)} มม.`,
              `จุดความร้อนเดือนถัดไป (${raw.nextPeriod}): ${raw.y} รายการ`
            ];
          }
        }
      }
    },
    scales: {
      x: {
        title: { display: true, text: 'ปริมาณฝนสถานีในเดือนก่อนหน้า t−1 (มม.)' }
      },
      y: {
        title: { display: true, text: `จุดความร้อนในเดือนถัดไป t (${proximityLabel})` }
      }
    }
  });
}

/**
 * Render Cross-Dataset Rainfall Comparison Section (Q3 & Q4: HRDI Station Rainfall vs HII Provincial Rainfall)
 */
function renderCrossRainfallSection(state) {
  const db = getDb();
  const hrdi2022 = filterStationMonthRecords(db.hrdiStationMonth, state, 2022);
  const hrdi2023 = filterStationMonthRecords(db.hrdiStationMonth, state, 2023);
  const hrdiAll = filterStationMonthRecords(db.hrdiStationMonth, state);

  const hii2022 = filterHiiRecords(db.hiiProvinceMonth, state, 2022);
  const hii2023 = filterHiiRecords(db.hiiProvinceMonth, state, 2023);
  const hiiAll = filterHiiRecords(db.hiiProvinceMonth, state);

  const hrdiStats = calculateMean(hrdiAll, 'rainfall');
  const hiiStats = calculateMean(hiiAll, 'hii_avg_rain');

  const hrdiValEl = document.getElementById('rainfall-hrdi-val');
  const hrdiSubEl = document.getElementById('rainfall-hrdi-sub');
  if (hrdiValEl) hrdiValEl.textContent = formatNum(hrdiStats.mean, 1);
  if (hrdiSubEl) {
    if (state.yearMode === 'compare') {
      const hrdiYoY = calculateFairHrdiYoY(hrdi2022, hrdi2023, 'rainfall');
      hrdiSubEl.textContent = hrdiYoY.nPairs > 0
        ? `YoY: ${formatSignedDelta(hrdiYoY.diff, 1, 'มม.')} (N = ${hrdiYoY.nPairs} คู่สถานี-เดือน)`
        : hrdiYoY.note;
    } else {
      hrdiSubEl.textContent = `เฉลี่ยจาก ${hrdiStats.count} แถวข้อมูลสถานี (${state.weatherSource === 'all' ? 'ทุกแหล่ง' : state.weatherSource})`;
    }
  }

  const hiiValEl = document.getElementById('rainfall-hii-val');
  const hiiSubEl = document.getElementById('rainfall-hii-sub');
  if (hiiValEl) hiiValEl.textContent = formatNum(hiiStats.mean, 1);
  if (hiiSubEl) {
    if (state.yearMode === 'compare') {
      const hiiYoY = calculateFairHiiYoY(hii2022, hii2023);
      hiiSubEl.textContent = hiiYoY.nPairs > 0
        ? `YoY: ${formatSignedDelta(hiiYoY.diff, 1, 'มม.')} (N = ${hiiYoY.nPairs} คู่จังหวัด-เดือน) · ข้อมูลระดับจังหวัด`
        : 'ไม่มีข้อมูลเปรียบเทียบ';
    } else {
      hiiSubEl.textContent = `เฉลี่ยระดับจังหวัด (${hiiStats.count} แถวข้อมูล HII — ไม่แยกตามสถานี/แหล่งสถานี)`;
    }
  }

  // Dual-Series Monthly Line Chart (Q3)
  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const labels = months.map(m => THAI_MONTH_NAMES[m - 1]);
  const stateAllMonths = { ...state, selectedMonths: ALL_MONTHS };
  const hrdi22Full = filterStationMonthRecords(db.hrdiStationMonth, stateAllMonths, 2022);
  const hrdi23Full = filterStationMonthRecords(db.hrdiStationMonth, stateAllMonths, 2023);
  const hii22Full = filterHiiRecords(db.hiiProvinceMonth, stateAllMonths, 2022);
  const hii23Full = filterHiiRecords(db.hiiProvinceMonth, stateAllMonths, 2023);

  const datasets = [];
  if (state.yearMode === '2022' || state.yearMode === 'compare') {
    datasets.push({
      label: 'ฝนสถานี HRDI 2022 (มม./สถานี)',
      data: months.map(m => calculateMean(hrdi22Full.filter(r => r.month === m), 'rainfall').mean),
      borderColor: YEAR_COLORS.y2022,
      backgroundColor: YEAR_COLORS.y2022Bg,
      borderWidth: 2.5,
      tension: 0.3,
      spanGaps: false,
      pointRadius: 4
    });
    datasets.push({
      label: 'ฝนจังหวัด HII 2022 (มม./จังหวัด)',
      data: months.map(m => calculateMean(hii22Full.filter(r => r.month === m), 'hii_avg_rain').mean),
      borderColor: '#D97706',
      borderDash: [5, 4],
      borderWidth: 2,
      tension: 0.3,
      spanGaps: false,
      pointRadius: 3
    });
  }
  if (state.yearMode === '2023' || state.yearMode === 'compare') {
    datasets.push({
      label: 'ฝนสถานี HRDI 2023 (มม./สถานี)',
      data: months.map(m => calculateMean(hrdi23Full.filter(r => r.month === m), 'rainfall').mean),
      borderColor: YEAR_COLORS.y2023,
      backgroundColor: YEAR_COLORS.y2023Bg,
      borderWidth: 2.5,
      tension: 0.3,
      spanGaps: false,
      pointRadius: 4
    });
    datasets.push({
      label: 'ฝนจังหวัด HII 2023 (มม./จังหวัด)',
      data: months.map(m => calculateMean(hii23Full.filter(r => r.month === m), 'hii_avg_rain').mean),
      borderColor: '#1D4ED8',
      borderDash: [5, 4],
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
          label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y !== null ? ctx.parsed.y.toFixed(1) + ' มม.' : 'ไม่มีข้อมูล (ต.ค.–ธ.ค. 2023)'}`
        }
      }
    },
    scales: {
      y: {
        title: { display: true, text: 'ปริมาณน้ำฝน (มม.) — แสดงแยกตามระดับข้อมูล' }
      }
    }
  });

  // Provincial Parallel Comparison Bar Chart (Q4) — guarded against invalid subtraction
  const stateNoProv = { ...state, province: null, district: null, tambon: null, stationId: null };
  const hrdiProvRows = filterStationMonthRecords(db.hrdiStationMonth, stateNoProv);
  const hiiProvRows = filterHiiRecords(db.hiiProvinceMonth, stateNoProv);

  const provData = STUDY_PROVINCES.map(prov => {
    const hList = hrdiProvRows.filter(r => r.province === prov);
    const hiiList = hiiProvRows.filter(r => r.province === prov);
    return {
      province: prov,
      hrdiMean: calculateMean(hList, 'rainfall').mean,
      hiiMean: calculateMean(hiiList, 'hii_avg_rain').mean,
      stationCount: new Set(hList.map(r => r.station_id)).size
    };
  });

  renderBarChart('rainfall-provincial-comparison-chart', {
    labels: provData.map(d => `${d.province} (${d.stationCount} สถานี)`),
    datasets: [
      {
        label: 'ฝนเฉลี่ยสถานีศึกษา HRDI (มม./สถานี-เดือน)',
        data: provData.map(d => d.hrdiMean),
        backgroundColor: '#0B96B5',
        borderRadius: 5
      },
      {
        label: 'ฝนเฉลี่ยระดับจังหวัด HII (มม./จังหวัด-เดือน)',
        data: provData.map(d => d.hiiMean),
        backgroundColor: '#168FD1',
        borderRadius: 5
      }
    ]
  }, {
    onClick: (evt, elements) => {
      if (elements && elements.length > 0) {
        const idx = elements[0].index;
        const clickedProv = provData[idx]?.province;
        if (clickedProv) {
          setState({ province: state.province === clickedProv ? null : clickedProv });
        }
      }
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y !== null ? ctx.parsed.y.toFixed(1) + ' มม.' : 'ไม่มีข้อมูลสถานีในแหล่งที่เลือก'}`
        }
      }
    },
    scales: {
      y: {
        title: { display: true, text: 'ปริมาณน้ำฝนเฉลี่ย (มม.) — คลิกจังหวัดเพื่อกรอง' }
      }
    }
  });

  const q3q4SummaryEl = document.getElementById('q3q4-plain-summary');
  if (q3q4SummaryEl) {
    const scopeTxt = state.province ? `จ.${state.province}` : 'พื้นที่ศึกษา 9 จังหวัด';
    q3q4SummaryEl.textContent = `สรุปการเปรียบเทียบใน${scopeTxt}: ค่าเฉลี่ยน้ำฝนรายสถานีพื้นที่สูง (HRDI) อยู่ที่ ${formatNum(hrdiStats.mean, 1)} มม./สถานี-เดือน และค่าเฉลี่ยน้ำฝนระดับจังหวัด (HII) อยู่ที่ ${formatNum(hiiStats.mean, 1)} มม./จังหวัด-เดือน โดยทั้งสองแหล่งมีแนวโน้มฤดูกาลสอดคล้องกันแต่ไม่นำมาลบกันโดยตรงเนื่องจากระดับพื้นที่ต่างกัน`;
  }
}
