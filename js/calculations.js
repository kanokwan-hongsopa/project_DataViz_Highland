/**
 * calculations.js — Analytical Calculation Engine & Statistical Safeguards
 * Highland Climate & Hotspot Interactive Dashboard (2022–2023)
 * 
 * Strict contracts:
 * - Missing ≠ 0; null/undefined/NaN are excluded from averages
 * - Fair YoY uses intersection of matched station-month pairs (station_id + month)
 * - Hotspot count represents detection records, not confirmed wildfires
 * - Pearson r calculated with sample size N, labeled exploratory (not causal)
 * - Lag analysis strictly matches consecutive calendar months for the same station
 * - No forecasting or extrapolation
 */

/**
 * Calculate arithmetic mean and sample size of a numeric field from an array of records
 * @param {Array} records 
 * @param {string} field 
 * @returns {{ mean: number|null, count: number, min: number|null, max: number|null, sum: number }}
 */
export function calculateMean(records, field) {
  if (!records || records.length === 0) {
    return { mean: null, count: 0, min: null, max: null, sum: 0 };
  }

  let sum = 0;
  let count = 0;
  let min = Infinity;
  let max = -Infinity;

  for (const r of records) {
    const val = r[field];
    if (val !== null && val !== undefined && !Number.isNaN(Number(val))) {
      const num = Number(val);
      sum += num;
      count++;
      if (num < min) min = num;
      if (num > max) max = num;
    }
  }

  if (count === 0) {
    return { mean: null, count: 0, min: null, max: null, sum: 0 };
  }

  return {
    mean: sum / count,
    count,
    min: min === Infinity ? null : min,
    max: max === -Infinity ? null : max,
    sum
  };
}

/**
 * Format a number to fixed decimals or return N/A if null/undefined
 * @param {number|null} value 
 * @param {number} decimals 
 * @param {string} fallback 
 * @returns {string}
 */
export function formatNum(value, decimals = 1, fallback = 'N/A') {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return fallback;
  }
  return Number(value).toLocaleString('th-TH', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * Format an integer count with thousands separator
 * @param {number|null} value 
 * @param {string} fallback 
 * @returns {string}
 */
export function formatInt(value, fallback = 'N/A') {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return fallback;
  }
  return Math.round(Number(value)).toLocaleString('th-TH');
}

/**
 * Calculate fair Year-over-Year (YoY) comparison for HRDI station climate
 * Compares ONLY identical station_id + month pairs present in BOTH 2022 and 2023
 * 
 * @param {Array} records2022 Filtered HRDI station-month records for 2022
 * @param {Array} records2023 Filtered HRDI station-month records for 2023
 * @param {string} metric 'temp' | 'rainfall' | 'humidity' | 'wind_speed' | 'temp_min' | 'temp_max'
 * @returns {Object} { val2022, val2023, diff, pctChange, nPairs, note }
 */
export function calculateFairHrdiYoY(records2022, records2023, metric) {
  // Map records by composite key: `${station_id}_${month}`
  const map2022 = new Map();
  for (const r of records2022) {
    const val = r[metric];
    if (val !== null && val !== undefined && !Number.isNaN(Number(val))) {
      const key = `${r.station_id}_${r.month}`;
      map2022.set(key, Number(val));
    }
  }

  const map2023 = new Map();
  for (const r of records2023) {
    const val = r[metric];
    if (val !== null && val !== undefined && !Number.isNaN(Number(val))) {
      const key = `${r.station_id}_${r.month}`;
      map2023.set(key, Number(val));
    }
  }

  // Find intersection of keys present in both years
  let sum2022 = 0;
  let sum2023 = 0;
  let nPairs = 0;

  for (const [key, val2022] of map2022.entries()) {
    if (map2023.has(key)) {
      const val2023 = map2023.get(key);
      sum2022 += val2022;
      sum2023 += val2023;
      nPairs++;
    }
  }

  if (nPairs === 0) {
    return {
      val2022: null,
      val2023: null,
      diff: null,
      pctChange: null,
      nPairs: 0,
      note: 'ไม่มีคู่ข้อมูลสถานี-เดือนที่ตรงกันทั้งสองปี'
    };
  }

  const avg2022 = sum2022 / nPairs;
  const avg2023 = sum2023 / nPairs;
  const diff = avg2023 - avg2022;
  const pctChange = avg2022 !== 0 ? (diff / Math.abs(avg2022)) * 100 : null;

  return {
    val2022: avg2022,
    val2023: avg2023,
    diff,
    pctChange,
    nPairs,
    note: `เปรียบเทียบจาก ${nPairs} คู่สถานี-เดือนที่มีข้อมูลจริงตรงกันทั้งสองปี`
  };
}

/**
 * Calculate fair YoY for HII provincial rainfall
 * Pairs province + month records
 */
export function calculateFairHiiYoY(hii2022, hii2023) {
  const map2022 = new Map();
  for (const r of hii2022) {
    if (r.hii_avg_rain !== null && r.hii_avg_rain !== undefined) {
      map2022.set(`${r.province}_${r.month}`, Number(r.hii_avg_rain));
    }
  }

  const map2023 = new Map();
  for (const r of hii2023) {
    if (r.hii_avg_rain !== null && r.hii_avg_rain !== undefined) {
      map2023.set(`${r.province}_${r.month}`, Number(r.hii_avg_rain));
    }
  }

  let sum2022 = 0;
  let sum2023 = 0;
  let nPairs = 0;

  for (const [key, val2022] of map2022.entries()) {
    if (map2023.has(key)) {
      sum2022 += val2022;
      sum2023 += map2023.get(key);
      nPairs++;
    }
  }

  if (nPairs === 0) {
    return { val2022: null, val2023: null, diff: null, pctChange: null, nPairs: 0 };
  }

  const avg2022 = sum2022 / nPairs;
  const avg2023 = sum2023 / nPairs;
  const diff = avg2023 - avg2022;
  const pctChange = avg2022 !== 0 ? (diff / avg2022) * 100 : null;

  return { val2022: avg2022, val2023: avg2023, diff, pctChange, nPairs };
}

/**
 * Calculate YoY for satellite hotspot detection counts
 * @param {number} count2022 
 * @param {number} count2023 
 * @returns {Object}
 */
export function calculateHotspotYoY(count2022, count2023) {
  const diff = count2023 - count2022;
  const pctChange = count2022 > 0 ? (diff / count2022) * 100 : null;
  return {
    count2022,
    count2023,
    diff,
    pctChange
  };
}

/**
 * Calculate Pearson correlation coefficient (r) between two numeric fields
 * Excludes pairs where either value is null/undefined/NaN
 * Requires N >= 3 and non-zero variance
 * 
 * @param {Array} pairs Array of [x, y] or objects
 * @param {string} [xField] Optional property name if objects passed
 * @param {string} [yField] Optional property name if objects passed
 * @returns {{ r: number|null, n: number, pStrength: string, note: string }}
 */
export function calculatePearsonR(pairs, xField, yField) {
  const valid = [];
  for (const item of pairs) {
    let x, y;
    if (xField && yField) {
      x = item[xField];
      y = item[yField];
    } else if (Array.isArray(item)) {
      x = item[0];
      y = item[1];
    }
    if (
      x !== null && x !== undefined && !Number.isNaN(Number(x)) &&
      y !== null && y !== undefined && !Number.isNaN(Number(y))
    ) {
      valid.push([Number(x), Number(y)]);
    }
  }

  const n = valid.length;
  if (n < 3) {
    return {
      r: null,
      n,
      pStrength: 'ข้อมูลไม่เพียงพอ (N < 3)',
      note: `จำนวนตัวอย่าง N = ${n} ไม่เพียงพอสำหรับการคำนวณสหสัมพันธ์`
    };
  }

  let sumX = 0;
  let sumY = 0;
  for (const [x, y] of valid) {
    sumX += x;
    sumY += y;
  }
  const meanX = sumX / n;
  const meanY = sumY / n;

  let numer = 0;
  let denomX = 0;
  let denomY = 0;

  for (const [x, y] of valid) {
    const dx = x - meanX;
    const dy = y - meanY;
    numer += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }

  if (denomX === 0 || denomY === 0) {
    return {
      r: 0,
      n,
      pStrength: 'ไม่มีความผันแปร (Zero Variance)',
      note: 'ตัวแปรไม่มีการเปลี่ยนแปลงค่าในชุดข้อมูลที่เลือก'
    };
  }

  const r = numer / (Math.sqrt(denomX) * Math.sqrt(denomY));
  // Bound to [-1, 1] against floating point inaccuracies
  const clampedR = Math.max(-1, Math.min(1, r));

  const absR = Math.abs(clampedR);
  let pStrength = 'ไม่มีความสัมพันธ์';
  if (absR >= 0.7) {
    pStrength = clampedR > 0 ? 'สัมพันธ์เชิงบวกระดับสูง' : 'สัมพันธ์เชิงลบระดับสูง';
  } else if (absR >= 0.4) {
    pStrength = clampedR > 0 ? 'สัมพันธ์เชิงบวกระดับปานกลาง' : 'สัมพันธ์เชิงลบระดับปานกลาง';
  } else if (absR >= 0.2) {
    pStrength = clampedR > 0 ? 'สัมพันธ์เชิงบวกระดับต่ำ' : 'สัมพันธ์เชิงลบระดับต่ำ';
  }

  return {
    r: clampedR,
    n,
    pStrength,
    note: `สหสัมพันธ์เชิงสำรวจ Pearson r = ${clampedR.toFixed(3)} (N = ${n}) ไม่สามารถอ้างเป็นความสัมพันธ์เชิงเหตุและผลได้`
  };
}

/**
 * Exploratory Lag Analysis (Q8):
 * Compares climate at month (t-1) with hotspots at month (t) for the same station
 * Strictly checks consecutive calendar adjacency:
 * (same year and month_t = month_prev + 1) OR (year_t = year_prev + 1 and month_prev = 12 and month_t = 1)
 * No gap bridging allowed!
 * 
 * @param {Array} records Array of station_month_dashboard records
 * @param {string} climateMetric 'temp' | 'rainfall' | 'humidity' | 'wind_speed'
 * @param {string} hotspotField 'hotspots_within_10km' | 'hotspots_same_tambon'
 * @returns {{ pairs: Array, rResult: Object }}
 */
export function calculateLaggedPairs(records, climateMetric, hotspotField) {
  // Group records by station_id and sort chronologically
  const stationGroups = new Map();
  for (const r of records) {
    if (!stationGroups.has(r.station_id)) {
      stationGroups.set(r.station_id, []);
    }
    stationGroups.get(r.station_id).push(r);
  }

  const lagPairs = [];

  for (const [stationId, group] of stationGroups.entries()) {
    // Sort ascending by year and month
    group.sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);

    for (let i = 0; i < group.length - 1; i++) {
      const prev = group[i];
      const next = group[i + 1];

      // Check strictly consecutive calendar adjacency
      const isConsecutive =
        (next.year === prev.year && next.month === prev.month + 1) ||
        (next.year === prev.year + 1 && prev.month === 12 && next.month === 1);

      if (isConsecutive) {
        const cVal = prev[climateMetric];
        const hVal = next[hotspotField];

        if (
          cVal !== null && cVal !== undefined && !Number.isNaN(Number(cVal)) &&
          hVal !== null && hVal !== undefined && !Number.isNaN(Number(hVal))
        ) {
          lagPairs.push({
            stationId,
            stationName: prev.station_name,
            province: prev.province,
            prevYear: prev.year,
            prevMonth: prev.month,
            nextYear: next.year,
            nextMonth: next.month,
            climateValue: Number(cVal),
            hotspotCount: Number(hVal)
          });
        }
      }
    }
  }

  const rResult = calculatePearsonR(
    lagPairs.map(p => [p.climateValue, p.hotspotCount])
  );

  return {
    pairs: lagPairs,
    rResult
  };
}
