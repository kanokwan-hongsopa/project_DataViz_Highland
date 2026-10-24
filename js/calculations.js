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
 * Calculate Box Plot / Quartile Distribution statistics (Min, Q1, Median, Q3, Max, Mean, N)
 * Uses consistent linear interpolation quantile definition (R-7 / PERCENTILE.INC)
 * @param {Array} records Array of objects or numbers
 * @param {string} [field] Property name if objects are passed
 * @returns {{ min: number|null, q1: number|null, median: number|null, q3: number|null, max: number|null, mean: number|null, iqr: number|null, count: number, sufficientForBoxPlot: boolean }}
 */
export function calculateQuartiles(records, field = null) {
  if (!records || records.length === 0) {
    return {
      min: null, q1: null, median: null, q3: null, max: null,
      mean: null, iqr: null, count: 0, sufficientForBoxPlot: false
    };
  }

  const values = [];
  let sum = 0;
  for (const r of records) {
    const raw = field ? r[field] : r;
    if (raw !== null && raw !== undefined && !Number.isNaN(Number(raw))) {
      const num = Number(raw);
      values.push(num);
      sum += num;
    }
  }

  const count = values.length;
  if (count === 0) {
    return {
      min: null, q1: null, median: null, q3: null, max: null,
      mean: null, iqr: null, count: 0, sufficientForBoxPlot: false
    };
  }

  values.sort((a, b) => a - b);

  const quantile = (sorted, p) => {
    if (sorted.length === 1) return sorted[0];
    const pos = (sorted.length - 1) * p;
    const base = Math.floor(pos);
    const rest = pos - base;
    if (sorted[base + 1] !== undefined) {
      return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
    }
    return sorted[base];
  };

  const min = values[0];
  const q1 = quantile(values, 0.25);
  const median = quantile(values, 0.50);
  const q3 = quantile(values, 0.75);
  const max = values[count - 1];
  const mean = sum / count;

  return {
    min,
    q1,
    median,
    q3,
    max,
    mean,
    iqr: q3 - q1,
    count,
    sufficientForBoxPlot: count >= 4
  };
}

/**
 * Format a number to fixed decimals or return N/A if null/undefined
 * Properly formats 0 as "0.0" (never treats 0 as falsy!)
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
 * Properly formats 0 as "0" (never treats 0 as falsy!)
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
 * Format a signed difference value, ensuring 0 is rendered as "0.0" (or "0") rather than "N/A"
 * @param {number|null} diff 
 * @param {number} decimals 
 * @param {string} unit 
 * @param {string} fallback 
 * @returns {string}
 */
export function formatSignedDelta(diff, decimals = 1, unit = '', fallback = 'N/A') {
  if (diff === null || diff === undefined || Number.isNaN(Number(diff))) {
    return fallback;
  }
  const num = Number(diff);
  const sign = num > 0 ? '+' : '';
  const formatted = decimals === 0
    ? Math.round(num).toLocaleString('th-TH')
    : num.toLocaleString('th-TH', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return `${sign}${formatted}${unit ? ' ' + unit : ''}`;
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
    if (r.hii_avg_rain !== null && r.hii_avg_rain !== undefined && !Number.isNaN(Number(r.hii_avg_rain))) {
      map2022.set(`${r.province}_${r.month}`, Number(r.hii_avg_rain));
    }
  }

  const map2023 = new Map();
  for (const r of hii2023) {
    if (r.hii_avg_rain !== null && r.hii_avg_rain !== undefined && !Number.isNaN(Number(r.hii_avg_rain))) {
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
 * Never divides by zero when count2022 === 0
 * @param {number} count2022 
 * @param {number} count2023 
 * @returns {Object}
 */
export function calculateHotspotYoY(count2022, count2023) {
  const c22 = Number(count2022) || 0;
  const c23 = Number(count2023) || 0;
  const diff = c23 - c22;
  const pctChange = c22 > 0 ? (diff / c22) * 100 : null;
  return {
    count2022: c22,
    count2023: c23,
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
  const stationGroups = new Map();
  for (const r of records) {
    if (!stationGroups.has(r.station_id)) {
      stationGroups.set(r.station_id, []);
    }
    stationGroups.get(r.station_id).push(r);
  }

  const lagPairs = [];

  for (const [stationId, group] of stationGroups.entries()) {
    group.sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);

    for (let i = 0; i < group.length - 1; i++) {
      const prev = group[i];
      const next = group[i + 1];

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
