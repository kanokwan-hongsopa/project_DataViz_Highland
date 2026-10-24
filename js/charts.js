/**
 * charts.js — Chart.js Wrapper, Lifecycle Management, Box Plot & Frosted Ice Glass Styling
 * Highland Climate & Hotspot Intelligence Platform (2022–2023)
 *
 * Strict rules:
 * - NO emojis anywhere
 * - Historical statistical trendlines allowed; NO future forecasting
 * - Frosted Ice Blue Glass theme colors (--text-main: #173A55, --text-secondary: #43627A)
 * - Consistent year colors across all charts
 * - Clean destruction of instances on updates
 */

const chartRegistry = new Map();

export const THAI_MONTH_NAMES = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
];

export const FULL_THAI_MONTH_NAMES = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

// Consistent Year Color Palette across the entire dashboard
export const YEAR_COLORS = {
  y2022: '#E67E22',
  y2022Bg: 'rgba(230, 126, 34, 0.16)',
  y2023: '#0B96B5',
  y2023Bg: 'rgba(11, 150, 181, 0.18)'
};

/**
 * Destroy a chart instance if registered
 */
export function destroyChart(canvasId) {
  if (chartRegistry.has(canvasId)) {
    const chart = chartRegistry.get(canvasId);
    try {
      chart.destroy();
    } catch (e) {
      console.warn(`Error destroying chart ${canvasId}:`, e);
    }
    chartRegistry.delete(canvasId);
  }
}

/**
 * Resize all active Chart.js instances (used after tab switches or layout changes)
 */
export function resizeAllCharts() {
  for (const [, chart] of chartRegistry.entries()) {
    try {
      chart.resize();
    } catch (e) {
      // ignore hidden canvas resize warnings
    }
  }
}

/**
 * Show or hide an empty-state overlay over a chart's wrapper container
 * @param {string} canvasId
 * @param {boolean} isEmpty
 * @param {string} [message='ไม่พบข้อมูลตามตัวกรองที่เลือก']
 */
export function toggleChartEmptyState(canvasId, isEmpty, message = 'ไม่พบข้อมูลตามตัวกรองที่เลือก') {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !canvas.parentElement) return;
  const parent = canvas.parentElement;
  let emptyEl = parent.querySelector('.chart-empty-state-overlay');

  if (isEmpty) {
    if (!emptyEl) {
      emptyEl = document.createElement('div');
      emptyEl.className = 'chart-empty-state-overlay';
      parent.appendChild(emptyEl);
    }
    emptyEl.innerHTML = `
      <div class="chart-empty-box">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#43627A" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="8" y1="12" x2="16" y2="12"></line>
        </svg>
        <span>${message}</span>
      </div>
    `;
    emptyEl.style.display = 'flex';
  } else if (emptyEl) {
    emptyEl.style.display = 'none';
  }
}

/**
 * Deep merge helper for Chart.js options
 */
function buildChartOptions(customOptions = {}) {
  const hasClick = typeof customOptions.onClick === 'function';
  const baseScales = {
    x: {
      grid: {
        color: 'rgba(23, 58, 85, 0.08)',
        drawBorder: false
      },
      ticks: {
        font: {
          family: '"Sarabun", "Noto Sans Thai", -apple-system, sans-serif',
          size: 11,
          weight: '600'
        },
        color: '#43627A'
      },
      ...(customOptions.scales?.x || {})
    },
    y: {
      grid: {
        color: 'rgba(23, 58, 85, 0.08)',
        drawBorder: false
      },
      ticks: {
        font: {
          family: '"Sarabun", "Noto Sans Thai", -apple-system, sans-serif',
          size: 11,
          weight: '600'
        },
        color: '#43627A'
      },
      ...(customOptions.scales?.y || {})
    }
  };

  if (baseScales.x.title) {
    baseScales.x.title = {
      color: '#173A55',
      font: { family: '"Sarabun", sans-serif', size: 11, weight: '700' },
      ...baseScales.x.title
    };
    if (baseScales.x.title.color === '#94a3b8') baseScales.x.title.color = '#43627A';
  }
  if (baseScales.y.title) {
    baseScales.y.title = {
      color: '#173A55',
      font: { family: '"Sarabun", sans-serif', size: 11, weight: '700' },
      ...baseScales.y.title
    };
    if (baseScales.y.title.color === '#94a3b8') baseScales.y.title.color = '#43627A';
  }

  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 240
    },
    onHover: (event, chartElement) => {
      const target = event?.native?.target;
      if (target) {
        target.style.cursor = (hasClick && chartElement && chartElement.length > 0) ? 'pointer' : 'default';
      }
    },
    interaction: customOptions.interaction || {
      mode: 'index',
      intersect: false
    },
    ...customOptions,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          font: {
            family: '"Sarabun", "Noto Sans Thai", -apple-system, sans-serif',
            size: 12,
            weight: '600'
          },
          color: '#173A55',
          usePointStyle: true,
          boxWidth: 9,
          padding: 12
        },
        ...(customOptions.plugins?.legend || {})
      },
      tooltip: {
        backgroundColor: 'rgba(16, 46, 71, 0.96)',
        titleColor: '#EAF8FE',
        bodyColor: '#D9F2FB',
        borderColor: 'rgba(255, 255, 255, 0.35)',
        borderWidth: 1,
        titleFont: {
          family: '"Sarabun", "Noto Sans Thai", -apple-system, sans-serif',
          size: 13,
          weight: 'bold'
        },
        bodyFont: {
          family: '"Sarabun", "Noto Sans Thai", -apple-system, sans-serif',
          size: 12
        },
        padding: 10,
        cornerRadius: 10,
        ...(customOptions.plugins?.tooltip || {})
      }
    },
    scales: baseScales
  };
}

/**
 * Plugin to render numeric values at the end of horizontal or vertical bars when requested
 */
const barEndValueLabelPlugin = {
  id: 'barEndValueLabel',
  afterDatasetsDraw(chart, args, pluginOptions) {
    if (!pluginOptions || !pluginOptions.enabled) return;
    const { ctx } = chart;
    const isHorizontal = chart.options.indexAxis === 'y';
    ctx.save();
    ctx.font = '700 10.5px "Sarabun", sans-serif';
    ctx.fillStyle = pluginOptions.color || '#173A55';

    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      if (meta.hidden) return;
      meta.data.forEach((bar, index) => {
        const rawVal = dataset.data[index];
        if (rawVal === null || rawVal === undefined || Number.isNaN(Number(rawVal))) return;
        const formatted = pluginOptions.formatter
          ? pluginOptions.formatter(rawVal, index, datasetIndex)
          : Math.round(Number(rawVal)).toLocaleString('th-TH');
        if (isHorizontal) {
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(formatted, bar.x + 5, bar.y);
        } else {
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(formatted, bar.x, bar.y - 4);
        }
      });
    });
    ctx.restore();
  }
};

/**
 * Render a Line Chart
 */
export function renderLineChart(canvasId, data, customOptions = {}) {
  if (typeof Chart === 'undefined') return null;

  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;

  const hasValidPoint = (data.datasets || []).some(ds =>
    Array.isArray(ds.data) && ds.data.some(v => v !== null && v !== undefined && !Number.isNaN(Number(v)))
  );
  toggleChartEmptyState(canvasId, !hasValidPoint);

  const ctx = canvas.getContext('2d');
  const chart = new Chart(ctx, {
    type: 'line',
    data,
    options: buildChartOptions(customOptions)
  });

  chartRegistry.set(canvasId, chart);
  return chart;
}

/**
 * Render a Bar Chart (with optional value labels at bar ends)
 */
export function renderBarChart(canvasId, data, customOptions = {}) {
  if (typeof Chart === 'undefined') return null;

  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;

  const hasValidPoint = (data.datasets || []).some(ds =>
    Array.isArray(ds.data) && ds.data.some(v => v !== null && v !== undefined && Number(v) > 0)
  ) || (data.labels && data.labels.length > 0 && (data.datasets || []).some(ds => ds.data && ds.data.length > 0));
  toggleChartEmptyState(canvasId, !hasValidPoint);

  const showEndLabels = Boolean(customOptions.showValueLabels);
  const opts = buildChartOptions({
    borderRadius: 6,
    ...customOptions
  });

  if (showEndLabels) {
    opts.plugins.barEndValueLabel = {
      enabled: true,
      formatter: customOptions.valueLabelFormatter || null,
      color: '#173A55'
    };
    if (opts.indexAxis === 'y') {
      opts.layout = { padding: { right: 48, ...(customOptions.layout?.padding || {}) } };
    } else {
      opts.layout = { padding: { top: 18, ...(customOptions.layout?.padding || {}) } };
    }
  }

  const ctx = canvas.getContext('2d');
  const chart = new Chart(ctx, {
    type: 'bar',
    data,
    options: opts,
    plugins: showEndLabels ? [barEndValueLabelPlugin] : []
  });

  chartRegistry.set(canvasId, chart);
  return chart;
}

/**
 * Render a Statistical Box Plot / Quartile Distribution Chart (Min, Q1, Median, Q3, Max, Mean, N)
 * Uses real quartile statistics per group and renders whiskers, IQR box, median line, and mean dot.
 *
 * @param {string} canvasId
 * @param {Array<{label:string, key:string, min:number|null, q1:number|null, median:number|null, q3:number|null, max:number|null, mean:number|null, count:number, isSelected?:boolean}>} statsList
 * @param {Object} customOptions { unit, metricLabel, onSelectGroup }
 */
export function renderBoxPlotChart(canvasId, statsList = [], customOptions = {}) {
  if (typeof Chart === 'undefined') return null;

  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;

  const validItems = statsList.filter(s => s && s.count > 0 && s.median !== null);
  toggleChartEmptyState(canvasId, validItems.length === 0, 'ไม่พบข้อมูลการกระจายตัวตามตัวกรองที่เลือก');

  const unit = customOptions.unit || '°C';
  const metricLabel = customOptions.metricLabel || 'ค่าตรวจวัด';
  const decimals = customOptions.decimals !== undefined ? customOptions.decimals : 1;
  const fmt = (v) => (v !== null && v !== undefined && !Number.isNaN(Number(v))) ? Number(v).toFixed(decimals) : 'N/A';

  const labels = statsList.map(s => s.label);
  // For Chart.js floating bars: [q1, q3]. When q1 === q3 (e.g. N=1), give a tiny visual thickness so bar renders
  const floatingData = statsList.map(s => {
    if (!s || s.count === 0 || s.q1 === null || s.q3 === null) return null;
    const span = Math.abs(s.q3 - s.q1);
    if (span < 0.05) {
      return [s.median - 0.08, s.median + 0.08];
    }
    return [s.q1, s.q3];
  });

  // Compute global y min/max so whiskers (min..max) never clip outside the y-axis
  let globalMin = Infinity;
  let globalMax = -Infinity;
  for (const s of validItems) {
    if (s.min !== null && s.min < globalMin) globalMin = s.min;
    if (s.max !== null && s.max > globalMax) globalMax = s.max;
  }
  const pad = Number.isFinite(globalMax - globalMin) && (globalMax - globalMin) > 0
    ? (globalMax - globalMin) * 0.14
    : 2;

  const boxWhiskerPlugin = {
    id: 'boxWhiskerOverlay',
    afterDatasetsDraw(chart) {
      const { ctx, scales: { y } } = chart;
      const meta = chart.getDatasetMeta(0);
      if (!meta || meta.hidden) return;

      ctx.save();
      meta.data.forEach((bar, i) => {
        const s = statsList[i];
        if (!s || s.count === 0 || s.median === null) return;

        const x = bar.x;
        const barWidth = Math.min(bar.width || 22, 28);
        const capHalf = Math.max(4, barWidth * 0.32);

        const yMin = y.getPixelForValue(s.min);
        const yQ1 = y.getPixelForValue(s.q1);
        const yMed = y.getPixelForValue(s.median);
        const yQ3 = y.getPixelForValue(s.q3);
        const yMax = y.getPixelForValue(s.max);
        const yMean = y.getPixelForValue(s.mean);

        const strokeColor = s.isSelected ? '#D97706' : '#102E47';

        // 1. Whiskers (Min to Q1, Q3 to Max)
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        // Upper whisker
        ctx.moveTo(x, yMax);
        ctx.lineTo(x, yQ3);
        // Upper cap
        ctx.moveTo(x - capHalf, yMax);
        ctx.lineTo(x + capHalf, yMax);
        // Lower whisker
        ctx.moveTo(x, yQ1);
        ctx.lineTo(x, yMin);
        // Lower cap
        ctx.moveTo(x - capHalf, yMin);
        ctx.lineTo(x + capHalf, yMin);
        ctx.stroke();

        // 2. Median horizontal line inside IQR box
        ctx.strokeStyle = s.isSelected ? '#B45309' : '#081B2D';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(x - barWidth / 2, yMed);
        ctx.lineTo(x + barWidth / 2, yMed);
        ctx.stroke();

        // 3. Mean dot
        ctx.fillStyle = '#FA714A';
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(x, yMean, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // 4. Sample size N label above max cap
        ctx.fillStyle = '#43627A';
        ctx.font = '600 9.5px "Sarabun", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`n=${s.count}`, x, yMax - 3);
      });
      ctx.restore();
    }
  };

  const opts = buildChartOptions({
    onClick: customOptions.onSelectGroup
      ? (evt, elements) => {
          if (elements && elements.length > 0) {
            const idx = elements[0].index;
            const item = statsList[idx];
            if (item) customOptions.onSelectGroup(item);
          }
        }
      : undefined,
    scales: {
      x: {
        ticks: {
          maxRotation: 25,
          minRotation: 0,
          font: { family: '"Sarabun", sans-serif', size: 11, weight: '600' },
          color: '#173A55'
        }
      },
      y: {
        suggestedMin: Number.isFinite(globalMin) ? globalMin - pad * 0.6 : undefined,
        suggestedMax: Number.isFinite(globalMax) ? globalMax + pad : undefined,
        title: {
          display: true,
          text: `${metricLabel} (${unit})`,
          color: '#173A55'
        }
      }
    },
    plugins: {
      legend: {
        display: true,
        labels: {
          generateLabels: () => [
            {
              text: 'กล่อง IQR (Q1–Q3) & เส้นมัธยฐาน (Median)',
              fillStyle: 'rgba(22, 143, 209, 0.55)',
              strokeStyle: '#0B96B5',
              lineWidth: 1.5,
              fontColor: '#173A55'
            },
            {
              text: 'ค่าเฉลี่ย (Mean) & ขอบเขต Min–Max',
              fillStyle: '#FA714A',
              strokeStyle: '#102E47',
              lineWidth: 1.5,
              fontColor: '#173A55'
            }
          ]
        }
      },
      tooltip: {
        callbacks: {
          title: (items) => {
            if (!items || !items.length) return '';
            const s = statsList[items[0].dataIndex];
            return `${s.label} (ตัวอย่าง N = ${s.count})`;
          },
          label: (ctx) => {
            const s = statsList[ctx.dataIndex];
            if (!s || s.count === 0) return ' ไม่มีข้อมูลตรวจวัด';
            const lines = [
              ` สูงสุด (Max): ${fmt(s.max)} ${unit}`,
              ` ควอไทล์ที่ 3 (Q3): ${fmt(s.q3)} ${unit}`,
              ` มัธยฐาน (Median): ${fmt(s.median)} ${unit}`,
              ` ค่าเฉลี่ย (Mean): ${fmt(s.mean)} ${unit}`,
              ` ควอไทล์ที่ 1 (Q1): ${fmt(s.q1)} ${unit}`,
              ` ต่ำสุด (Min): ${fmt(s.min)} ${unit}`
            ];
            if (s.count < 4) {
              lines.push(` หมายเหตุ: N=${s.count} (ตัวอย่างน้อยกว่า 4 รายการ)`);
            }
            return lines;
          }
        }
      }
    }
  });

  const ctx = canvas.getContext('2d');
  const chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: `${metricLabel} (Q1–Q3)`,
          data: floatingData,
          backgroundColor: statsList.map(s => s.isSelected ? 'rgba(245, 158, 11, 0.65)' : 'rgba(24, 182, 229, 0.55)'),
          borderColor: statsList.map(s => s.isSelected ? '#D97706' : '#0B96B5'),
          borderWidth: 1.8,
          borderRadius: 4,
          borderSkipped: false,
          barPercentage: 0.55
        }
      ]
    },
    options: opts,
    plugins: [boxWhiskerPlugin]
  });

  chartRegistry.set(canvasId, chart);
  return chart;
}

/**
 * Render a Scatter Chart with optional Linear Regression Statistical Trendline
 */
export function renderScatterChart(canvasId, data, customOptions = {}) {
  if (typeof Chart === 'undefined') return null;

  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;

  const points = data.datasets[0]?.data || [];
  toggleChartEmptyState(canvasId, points.length === 0, 'ไม่พบคู่ข้อมูลที่ตรงตามเงื่อนไขตัวกรอง');

  let trendDataset = null;

  if (points.length >= 3 && customOptions.showTrendline !== false) {
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    const n = points.length;

    for (const p of points) {
      sumX += p.x;
      sumY += p.y;
      sumXY += p.x * p.y;
      sumX2 += p.x * p.x;
    }

    const denom = (n * sumX2 - sumX * sumX);
    if (denom !== 0) {
      const slope = (n * sumXY - sumX * sumY) / denom;
      const intercept = (sumY - slope * sumX) / n;

      const minX = Math.min(...points.map(p => p.x));
      const maxX = Math.max(...points.map(p => p.x));

      trendDataset = {
        type: 'line',
        label: 'แนวโน้มเชิงสถิติย้อนหลัง (Descriptive Linear Regression)',
        data: [
          { x: minX, y: slope * minX + intercept },
          { x: maxX, y: slope * maxX + intercept }
        ],
        borderColor: '#102E47',
        borderWidth: 2,
        borderDash: [6, 4],
        pointRadius: 0,
        fill: false
      };
    }
  }

  const chartData = {
    datasets: trendDataset ? [...data.datasets, trendDataset] : data.datasets
  };

  const opts = buildChartOptions({
    interaction: {
      mode: 'nearest',
      intersect: true
    },
    ...customOptions
  });

  const ctx = canvas.getContext('2d');
  const chart = new Chart(ctx, {
    type: 'scatter',
    data: chartData,
    options: opts
  });

  chartRegistry.set(canvasId, chart);
  return chart;
}

/**
 * Render a Doughnut Chart
 */
export function renderDoughnutChart(canvasId, data, customOptions = {}) {
  if (typeof Chart === 'undefined') return null;

  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;

  const hasValidSlice = (data.datasets || []).some(ds =>
    Array.isArray(ds.data) && ds.data.some(v => Number(v) > 0)
  );
  toggleChartEmptyState(canvasId, !hasValidSlice);

  const hasClick = typeof customOptions.onClick === 'function';
  const ctx = canvas.getContext('2d');
  const chart = new Chart(ctx, {
    type: 'doughnut',
    data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      onHover: (event, chartElement) => {
        const target = event?.native?.target;
        if (target) {
          target.style.cursor = (hasClick && chartElement && chartElement.length > 0) ? 'pointer' : 'default';
        }
      },
      plugins: {
        legend: {
          position: 'right',
          labels: {
            font: {
              family: '"Sarabun", "Noto Sans Thai", -apple-system, sans-serif',
              size: 11.5,
              weight: '600'
            },
            color: '#173A55',
            boxWidth: 11,
            padding: 10
          }
        },
        tooltip: {
          backgroundColor: 'rgba(16, 46, 71, 0.96)',
          titleColor: '#EAF8FE',
          bodyColor: '#D9F2FB',
          borderColor: 'rgba(255, 255, 255, 0.35)',
          borderWidth: 1,
          padding: 10,
          cornerRadius: 10
        }
      },
      cutout: '64%',
      ...customOptions
    }
  });

  chartRegistry.set(canvasId, chart);
  return chart;
}
