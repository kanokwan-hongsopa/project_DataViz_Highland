/**
 * charts.js — Chart.js Wrapper, Smooth In-Place Updates, Lifecycle Management, Box Plot & Frosted Ice Glass Styling
 * Highland Climate & Hotspot Intelligence Platform (2022–2023)
 *
 * Strict rules:
 * - NO emojis anywhere
 * - Historical statistical trendlines allowed; NO future forecasting
 * - Frosted Ice Blue Glass theme colors (--text-main: #173A55, --text-secondary: #43627A)
 * - Consistent year colors across all charts
 * - Smooth in-place updates (chart.update()) to prevent flickering when filters change
 */

import { prefersReducedMotion } from './animations.js';

const chartRegistry = new Map();

export const THAI_MONTH_NAMES = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
];

export const FULL_THAI_MONTH_NAMES = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

// Consistent Year Color Palette across the entire dashboard (Bright Highland Intelligence: 2022 = Fire Orange, 2023 = Teal)
export const YEAR_COLORS = {
  y2022: '#F5A269',
  y2022Bg: 'rgba(245, 162, 105, 0.25)',
  y2023: '#16A9B3',
  y2023Bg: 'rgba(22, 169, 179, 0.25)'
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
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#244B6B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
 * Smoothly synchronize datasets into an existing Chart.js instance without destroying it
 */
function syncChartDataInPlace(existingChart, nextData) {
  if (nextData.labels !== undefined) {
    existingChart.data.labels = [...nextData.labels];
  }
  const currentDatasets = existingChart.data.datasets || [];
  const incomingDatasets = nextData.datasets || [];

  for (let i = 0; i < incomingDatasets.length; i++) {
    const incoming = incomingDatasets[i];
    if (i < currentDatasets.length) {
      const targetDs = currentDatasets[i];
      // Remove stale keys that are not in incoming (except internal Chart.js metadata)
      Object.keys(targetDs).forEach(k => {
        if (!k.startsWith('_') && !(k in incoming)) {
          delete targetDs[k];
        }
      });
      Object.assign(targetDs, incoming);
    } else {
      currentDatasets.push({ ...incoming });
    }
  }

  while (currentDatasets.length > incomingDatasets.length) {
    currentDatasets.pop();
  }
}

/**
 * Create a new Chart.js instance OR smoothly update the existing instance in-place
 */
function createOrUpdateChart(canvasId, type, data, options, plugins = []) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;

  const existing = chartRegistry.get(canvasId);
  const existingIndexAxis = existing?.options?.indexAxis || 'x';
  const nextIndexAxis = options?.indexAxis || 'x';

  if (
    existing &&
    existing.canvas === canvas &&
    existing.config.type === type &&
    existingIndexAxis === nextIndexAxis
  ) {
    // Stop any queued mid-flight animation before applying latest data (prevents race condition)
    if (typeof existing.stop === 'function') {
      existing.stop();
    }
    syncChartDataInPlace(existing, data);
    existing.options = options;
    existing._updateCount = (existing._updateCount || 0) + 1;
    existing.update();
    return existing;
  }

  destroyChart(canvasId);
  const ctx = canvas.getContext('2d');
  const chart = new Chart(ctx, {
    type,
    data,
    options,
    plugins
  });
  chart._updateCount = 0;
  chartRegistry.set(canvasId, chart);
  return chart;
}

/**
 * Deep merge helper for Chart.js options with smooth 620ms easeOutQuart animation
 */
function buildChartOptions(customOptions = {}) {
  const hasClick = typeof customOptions.onClick === 'function';
  const reducedMotion = prefersReducedMotion();
  const baseScales = {
    x: {
      grid: {
        color: 'rgba(22, 50, 79, 0.12)',
        drawBorder: true,
        borderColor: 'rgba(22, 50, 79, 0.22)'
      },
      ticks: {
        font: {
          family: '"Sarabun", "Noto Sans Thai", -apple-system, sans-serif',
          size: 11.5,
          weight: '700'
        },
        color: '#244B6B'
      },
      ...(customOptions.scales?.x || {})
    },
    y: {
      grid: {
        color: 'rgba(22, 50, 79, 0.12)',
        drawBorder: true,
        borderColor: 'rgba(22, 50, 79, 0.22)'
      },
      ticks: {
        font: {
          family: '"Sarabun", "Noto Sans Thai", -apple-system, sans-serif',
          size: 11.5,
          weight: '700'
        },
        color: '#244B6B'
      },
      ...(customOptions.scales?.y || {})
    }
  };

  if (baseScales.x.title) {
    baseScales.x.title = {
      color: '#16324F',
      font: { family: '"Sarabun", "Noto Sans Thai", sans-serif', size: 12, weight: '800' },
      ...baseScales.x.title
    };
    baseScales.x.title.color = '#16324F';
  }
  if (baseScales.y.title) {
    baseScales.y.title = {
      color: '#16324F',
      font: { family: '"Sarabun", "Noto Sans Thai", sans-serif', size: 12, weight: '800' },
      ...baseScales.y.title
    };
    baseScales.y.title.color = '#16324F';
  }

  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: reducedMotion
      ? { duration: 0 }
      : {
          duration: 620,
          easing: 'easeOutQuart'
        },
    transitions: {
      active: {
        animation: {
          duration: reducedMotion ? 0 : 220
        }
      }
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
            weight: '700'
          },
          color: '#16324F',
          usePointStyle: true,
          boxWidth: 9,
          padding: 12,
          ...(customOptions.plugins?.legend?.labels || {})
        },
        ...(customOptions.plugins?.legend || {})
      },
      tooltip: {
        backgroundColor: 'rgba(18, 43, 67, 0.96)',
        titleColor: '#F8FBFF',
        bodyColor: '#D9F3FF',
        borderColor: 'rgba(77, 185, 213, 0.65)',
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
    ctx.font = '700 11px "Sarabun", sans-serif';
    ctx.fillStyle = pluginOptions.color || '#16324F';

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
 * Strict bar hit-test.
 * 1) Bar element directly under the pointer (intersect: true) along the category axis.
 * 2) Click on the category tick label area (left of chartArea for horizontal, below for vertical)
 *    is resolved to the exact category band via the scale — not an approximate nearest search.
 * Returns [] when the click is on empty chart space, so filters are never changed by accident.
 */
export function getStrictBarHit(chart, evt, isHorizontal) {
  if (!chart || !evt) return [];

  const canvas = chart.canvas;
  let px = null;
  let py = null;

  const nativeEvt = evt.native || (typeof MouseEvent !== 'undefined' && evt instanceof MouseEvent ? evt : null);

  if (typeof evt.x === 'number' && typeof evt.y === 'number') {
    px = evt.x;
    py = evt.y;
  } else if (nativeEvt && canvas) {
    const rect = canvas.getBoundingClientRect();
    px = nativeEvt.clientX - rect.left;
    py = nativeEvt.clientY - rect.top;
  }

  // 1. Direct geometric bar intersection using Chart.js bar.inRange(px, py)
  if (px !== null && py !== null) {
    for (let d = 0; d < chart.data.datasets.length; d++) {
      const meta = chart.getDatasetMeta(d);
      if (!meta || meta.hidden) continue;
      for (let i = 0; i < meta.data.length; i++) {
        const bar = meta.data[i];
        if (bar && typeof bar.inRange === 'function' && bar.inRange(px, py)) {
          return [{ datasetIndex: d, index: i, element: bar }];
        }
      }
    }
  }

  // 2. Category tick label zone (left of chartArea for horizontal, bottom for vertical)
  const area = chart.chartArea;
  if (area && px !== null && py !== null) {
    const catScale = isHorizontal ? chart.scales.y : chart.scales.x;
    const labelCount = (chart.data.labels || []).length;
    if (catScale && labelCount > 0) {
      const topBound = catScale.top !== undefined ? catScale.top : area.top;
      const bottomBound = catScale.bottom !== undefined ? catScale.bottom : area.bottom;
      const leftBound = catScale.left !== undefined ? catScale.left : area.left;
      const rightBound = catScale.right !== undefined ? catScale.right : area.right;

      const inLabelZone = isHorizontal
        ? (px < area.left && px >= 0 && py >= topBound - 15 && py <= bottomBound + 15)
        : (py > area.bottom && px >= leftBound - 15 && px <= rightBound + 15);

      if (inLabelZone) {
        let bestIdx = -1;
        let minDist = Infinity;
        const targetPos = isHorizontal ? py : px;
        for (let i = 0; i < labelCount; i++) {
          const cPos = catScale.getPixelForValue(i);
          const dist = Math.abs(targetPos - cPos);
          if (dist < minDist) {
            minDist = dist;
            bestIdx = i;
          }
        }
        const step = labelCount > 1
          ? Math.abs(catScale.getPixelForValue(1) - catScale.getPixelForValue(0))
          : 30;
        if (bestIdx !== -1 && minDist <= step / 2 + 5) {
          window.__lastHitSource = { source: 'labelZone', bestIdx, minDist, targetPos };
          return [{ datasetIndex: 0, index: bestIdx }];
        }
      }
    }
  }

  return [];
}

/**
 * Render or Smoothly Update a Line Chart
 */
export function renderLineChart(canvasId, data, customOptions = {}) {
  if (typeof Chart === 'undefined') return null;
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;

  const hasValidPoint = (data.datasets || []).some(ds =>
    Array.isArray(ds.data) && ds.data.some(v => v !== null && v !== undefined && !Number.isNaN(Number(v)))
  );
  toggleChartEmptyState(canvasId, !hasValidPoint);

  const opts = buildChartOptions(customOptions);
  return createOrUpdateChart(canvasId, 'line', data, opts);
}

/**
 * Render or Smoothly Update a Bar Chart (with optional value labels at bar ends)
 */
export function renderBarChart(canvasId, data, customOptions = {}) {
  if (typeof Chart === 'undefined') return null;
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;

  const hasValidPoint = (data.datasets || []).some(ds =>
    Array.isArray(ds.data) && ds.data.some(v => v !== null && v !== undefined && Number(v) > 0)
  ) || (data.labels && data.labels.length > 0 && (data.datasets || []).some(ds => ds.data && ds.data.length > 0));
  toggleChartEmptyState(canvasId, !hasValidPoint);

  const showEndLabels = Boolean(customOptions.showValueLabels);
  const isHorizontalBar = customOptions.indexAxis === 'y';
  const userOnClick = typeof customOptions.onClick === 'function' ? customOptions.onClick : null;
  const opts = buildChartOptions({
    borderRadius: 6,
    ...customOptions,
    // Tooltip/hover must search along the category axis (y for horizontal bars),
    // otherwise Chart.js 'index' mode matches by x-pixel and picks the wrong row.
    interaction: customOptions.interaction || {
      mode: 'index',
      intersect: false,
      axis: isHorizontalBar ? 'y' : 'x'
    }
  });

  if (userOnClick) {
    let lastHandledAt = 0;
    // Strict hit-testing: only the bar actually under the pointer (or its category label) counts.
    opts.onClick = (evt, _elements, chart) => {
      let hit = getStrictBarHit(chart, evt, isHorizontalBar);
      // Fallback for programmatic/synthetic test invocations where no coordinates are supplied in evt
      if (hit.length === 0 && _elements && _elements.length > 0 && evt && evt.x === undefined && !evt.native && evt.clientX === undefined) {
        hit = _elements;
      }
      if (hit.length > 0) {
        lastHandledAt = Date.now();
        userOnClick(evt, hit, chart);
      }
    };
    opts.onHover = (event, _els, chart) => {
      const target = event?.native?.target;
      if (!target || !chart) return;
      target.style.cursor = getStrictBarHit(chart, event, isHorizontalBar).length > 0 ? 'pointer' : 'default';
    };

    // Native canvas listeners for clicks & hovers on category axis labels (outside chartArea)
    if (!canvas._barLabelClickHandler) {
      canvas._barLabelClickHandler = (e) => {
        const ch = Chart.getChart(canvas);
        if (!ch) return;
        const rect = canvas.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        const area = ch.chartArea;
        if (!area) return;
        const isLabelZone = isHorizontalBar
          ? (px < area.left && px >= 0 && py >= area.top - 15 && py <= area.bottom + 15)
          : (py > area.bottom && px >= area.left - 15 && px <= area.right + 15);
        if (!isLabelZone) return;

        window.__lastLabelHitLog = {
          px, py, isHorizontalBar,
          p0: ch.scales.y?.getPixelForValue(0),
          p6: ch.scales.y?.getPixelForValue(6),
          labels: ch.data.labels
        };

        const hit = getStrictBarHit(ch, e, isHorizontalBar);
        if (hit.length > 0 && typeof canvas._activeUserOnClick === 'function') {
          canvas._activeUserOnClick(e, hit, ch);
        }
      };
      canvas.addEventListener('click', canvas._barLabelClickHandler);

      canvas._barLabelHoverHandler = (e) => {
        const ch = Chart.getChart(canvas);
        if (!ch) return;
        const rect = canvas.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        const area = ch.chartArea;
        if (!area) return;
        const isLabelZone = isHorizontalBar
          ? (px < area.left && px >= 0 && py >= area.top - 15 && py <= area.bottom + 15)
          : (py > area.bottom && px >= area.left - 15 && px <= area.right + 15);
        if (isLabelZone) {
          const hit = getStrictBarHit(ch, e, isHorizontalBar);
          canvas.style.cursor = hit.length > 0 ? 'pointer' : 'default';
        }
      };
      canvas.addEventListener('mousemove', canvas._barLabelHoverHandler);
    }
    canvas._activeUserOnClick = userOnClick;
  }

  if (showEndLabels) {
    opts.plugins.barEndValueLabel = {
      enabled: true,
      formatter: customOptions.valueLabelFormatter || null,
      color: '#16324F'
    };
    if (opts.indexAxis === 'y') {
      opts.layout = { padding: { right: 48, ...(customOptions.layout?.padding || {}) } };
    } else {
      opts.layout = { padding: { top: 18, ...(customOptions.layout?.padding || {}) } };
    }
  } else if (opts.plugins) {
    opts.plugins.barEndValueLabel = { enabled: false };
  }

  return createOrUpdateChart(canvasId, 'bar', data, opts, [barEndValueLabelPlugin]);
}

/**
 * Render or Smoothly Update a Statistical Box Plot / Quartile Distribution Chart (Min, Q1, Median, Q3, Max, Mean, N)
 */
export function renderBoxPlotChart(canvasId, statsList = [], customOptions = {}) {
  if (typeof Chart === 'undefined') return null;
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;

  const validItems = statsList.filter(s => s && s.count > 0 && s.median !== null);
  toggleChartEmptyState(canvasId, validItems.length === 0, 'ไม่พบข้อมูลการกระจายตัวตามตัวกรองที่เลือก');

  const unit = customOptions.unit || '°C';
  const metricLabel = customOptions.metricLabel || 'ค่าตรวจวัด';
  const decimals = customOptions.decimals !== undefined ? customOptions.decimals : 1;
  const fmt = (v) => (v !== null && v !== undefined && !Number.isNaN(Number(v))) ? Number(v).toFixed(decimals) : 'N/A';

  const labels = statsList.map(s => s.label);
  const floatingData = statsList.map(s => {
    if (!s || s.count === 0 || s.q1 === null || s.q3 === null) return null;
    const span = Math.abs(s.q3 - s.q1);
    if (span < 0.05) {
      return [s.median - 0.08, s.median + 0.08];
    }
    return [s.q1, s.q3];
  });

  let globalMin = Infinity;
  let globalMax = -Infinity;
  for (const s of validItems) {
    if (s.min !== null && s.min < globalMin) globalMin = s.min;
    if (s.max !== null && s.max > globalMax) globalMax = s.max;
  }
  const pad = Number.isFinite(globalMax - globalMin) && (globalMax - globalMin) > 0
    ? (globalMax - globalMin) * 0.14
    : 2;

  const isSingleGroup = Boolean(customOptions.singleGroup) || validItems.length === 1;

  // Store latest statsList on canvas so the plugin always reads fresh quartile data during in-place updates
  canvas._boxPlotStatsList = statsList;

  const boxWhiskerPlugin = {
    id: 'boxWhiskerOverlay',
    afterDatasetsDraw(chart) {
      const currentStats = chart.canvas?._boxPlotStatsList || [];
      const { ctx, scales: { y } } = chart;
      const meta = chart.getDatasetMeta(0);
      if (!meta || meta.hidden || !y) return;

      ctx.save();
      meta.data.forEach((bar, i) => {
        const s = currentStats[i];
        if (!s || s.count === 0 || s.median === null) return;

        const x = bar.x;
        const barWidth = isSingleGroup ? Math.min(bar.width || 48, 54) : Math.min(bar.width || 22, 28);
        const capHalf = isSingleGroup ? 16 : Math.max(4, barWidth * 0.32);

        const yMin = y.getPixelForValue(s.min);
        const yQ1 = y.getPixelForValue(s.q1);
        const yMed = y.getPixelForValue(s.median);
        const yQ3 = y.getPixelForValue(s.q3);
        const yMax = y.getPixelForValue(s.max);
        const yMean = y.getPixelForValue(s.mean);

        const strokeColor = s.isSelected ? '#D97706' : '#102E47';

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(x, yMax);
        ctx.lineTo(x, yQ3);
        ctx.moveTo(x - capHalf, yMax);
        ctx.lineTo(x + capHalf, yMax);
        ctx.moveTo(x, yQ1);
        ctx.lineTo(x, yMin);
        ctx.moveTo(x - capHalf, yMin);
        ctx.lineTo(x + capHalf, yMin);
        ctx.stroke();

        ctx.strokeStyle = s.isSelected ? '#B45309' : '#081B2D';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(x - barWidth / 2, yMed);
        ctx.lineTo(x + barWidth / 2, yMed);
        ctx.stroke();

        ctx.fillStyle = '#FA714A';
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(x, yMean, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

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
            const currentStats = canvas._boxPlotStatsList || statsList;
            const item = currentStats[idx];
            if (item) customOptions.onSelectGroup(item);
          }
        }
      : undefined,
    scales: {
      x: {
        ticks: {
          maxRotation: 25,
          minRotation: 0,
          font: { family: '"Sarabun", sans-serif', size: 11.5, weight: '700' },
          color: '#244B6B'
        }
      },
      y: {
        suggestedMin: Number.isFinite(globalMin) ? globalMin - pad * 0.6 : undefined,
        suggestedMax: Number.isFinite(globalMax) ? globalMax + pad : undefined,
        title: {
          display: true,
          text: `${metricLabel} (${unit})`,
          color: '#16324F',
          font: { family: '"Sarabun", sans-serif', size: 12, weight: '800' }
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
              fontColor: '#16324F'
            },
            {
              text: 'ค่าเฉลี่ย (Mean) & ขอบเขต Min–Max',
              fillStyle: '#FA714A',
              strokeStyle: '#102E47',
              lineWidth: 1.5,
              fontColor: '#16324F'
            }
          ]
        }
      },
      tooltip: {
        callbacks: {
          title: (items) => {
            if (!items || !items.length) return '';
            const currentStats = canvas._boxPlotStatsList || statsList;
            const s = currentStats[items[0].dataIndex];
            return s ? `${s.label} (ตัวอย่าง N = ${s.count})` : '';
          },
          label: (ctx) => {
            const currentStats = canvas._boxPlotStatsList || statsList;
            const s = currentStats[ctx.dataIndex];
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

  const data = {
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
        barPercentage: isSingleGroup ? 0.35 : 0.55,
        maxBarThickness: isSingleGroup ? 58 : 36,
        barThickness: isSingleGroup ? 52 : undefined
      }
    ]
  };

  return createOrUpdateChart(canvasId, 'bar', data, opts, [boxWhiskerPlugin]);
}

/**
 * Render or Smoothly Update a Scatter Chart with optional Linear Regression Statistical Trendline
 */
export function renderScatterChart(canvasId, data, customOptions = {}) {
  if (typeof Chart === 'undefined') return null;
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

  return createOrUpdateChart(canvasId, 'scatter', chartData, opts);
}

/**
 * Render or Smoothly Update a Doughnut Chart
 */
export function renderDoughnutChart(canvasId, data, customOptions = {}) {
  if (typeof Chart === 'undefined') return null;
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;

  const hasValidSlice = (data.datasets || []).some(ds =>
    Array.isArray(ds.data) && ds.data.some(v => Number(v) > 0)
  );
  toggleChartEmptyState(canvasId, !hasValidSlice);

  const hasClick = typeof customOptions.onClick === 'function';
  const reducedMotion = prefersReducedMotion();
  const opts = {
    responsive: true,
    maintainAspectRatio: false,
    animation: reducedMotion
      ? { duration: 0 }
      : {
          duration: 620,
          easing: 'easeOutQuart',
          animateRotate: true,
          animateScale: false
        },
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
            weight: '700'
          },
          color: '#16324F',
          boxWidth: 11,
          padding: 10
        }
      },
      tooltip: {
        backgroundColor: 'rgba(18, 43, 67, 0.96)',
        titleColor: '#F8FBFF',
        bodyColor: '#D9F3FF',
        borderColor: 'rgba(77, 185, 213, 0.65)',
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
        cornerRadius: 10
      }
    },
    cutout: '64%',
    ...customOptions
  };

  return createOrUpdateChart(canvasId, 'doughnut', data, opts);
}
