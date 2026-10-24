/**
 * charts.js — Chart.js Wrapper, Lifecycle Management & Styling
 * Highland Climate & Hotspot Intelligence Platform (2022–2023)
 * 
 * Strict rules:
 * - NO emojis anywhere
 * - Historical statistical trendlines allowed; NO future forecasting
 * - Modern dark glass theme colors (Teal, Cyan, Ice Blue, Emerald, Amber, Rose)
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
 * Common default options for Chart.js in Dark Glass Theme
 */
function getDefaultOptions(customOptions = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 300
    },
    interaction: {
      mode: 'index',
      intersect: false
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          font: {
            family: '"Sarabun", -apple-system, sans-serif',
            size: 12
          },
          color: '#cbd5e1',
          usePointStyle: true,
          boxWidth: 8
        }
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        titleColor: '#f8fafc',
        bodyColor: '#e2e8f0',
        borderColor: 'rgba(255, 255, 255, 0.15)',
        borderWidth: 1,
        titleFont: {
          family: '"Sarabun", -apple-system, sans-serif',
          size: 13,
          weight: 'bold'
        },
        bodyFont: {
          family: '"Sarabun", -apple-system, sans-serif',
          size: 12
        },
        padding: 10,
        cornerRadius: 8
      }
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(255, 255, 255, 0.06)'
        },
        ticks: {
          font: {
            family: '"Sarabun", -apple-system, sans-serif',
            size: 11
          },
          color: '#94a3b8'
        }
      },
      y: {
        grid: {
          color: 'rgba(255, 255, 255, 0.06)'
        },
        ticks: {
          font: {
            family: '"Sarabun", -apple-system, sans-serif',
            size: 11
          },
          color: '#94a3b8'
        }
      }
    },
    ...customOptions
  };
}

/**
 * Render a Line Chart
 */
export function renderLineChart(canvasId, data, customOptions = {}) {
  if (typeof Chart === 'undefined') return null;

  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;

  const ctx = canvas.getContext('2d');
  const chart = new Chart(ctx, {
    type: 'line',
    data,
    options: getDefaultOptions(customOptions)
  });

  chartRegistry.set(canvasId, chart);
  return chart;
}

/**
 * Render a Bar Chart
 */
export function renderBarChart(canvasId, data, customOptions = {}) {
  if (typeof Chart === 'undefined') return null;

  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;

  const ctx = canvas.getContext('2d');
  const chart = new Chart(ctx, {
    type: 'bar',
    data,
    options: getDefaultOptions({
      borderRadius: 6,
      ...customOptions
    })
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

  // Calculate linear regression line for historical points (y = mx + b)
  const points = data.datasets[0]?.data || [];
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
        label: 'แนวโน้มเชิงสถิติ (Linear Regression)',
        data: [
          { x: minX, y: slope * minX + intercept },
          { x: maxX, y: slope * maxX + intercept }
        ],
        borderColor: 'rgba(255, 255, 255, 0.45)',
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false
      };
    }
  }

  const chartData = {
    datasets: trendDataset ? [...data.datasets, trendDataset] : data.datasets
  };

  const ctx = canvas.getContext('2d');
  const chart = new Chart(ctx, {
    type: 'scatter',
    data: chartData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'nearest',
        intersect: true
      },
      plugins: {
        legend: {
          display: true,
          labels: {
            font: { family: '"Sarabun", -apple-system, sans-serif', size: 11 },
            color: '#94a3b8',
            boxWidth: 8
          }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleColor: '#f8fafc',
          bodyColor: '#e2e8f0',
          borderColor: 'rgba(255, 255, 255, 0.15)',
          borderWidth: 1,
          padding: 10,
          cornerRadius: 8,
          ...customOptions.plugins?.tooltip
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.06)' },
          ticks: { color: '#94a3b8' },
          title: customOptions.scales?.x?.title || {}
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.06)' },
          ticks: { color: '#94a3b8' },
          title: customOptions.scales?.y?.title || {}
        }
      },
      ...customOptions
    }
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

  const ctx = canvas.getContext('2d');
  const chart = new Chart(ctx, {
    type: 'doughnut',
    data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            font: {
              family: '"Sarabun", -apple-system, sans-serif',
              size: 11
            },
            color: '#cbd5e1',
            boxWidth: 10
          }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleColor: '#f8fafc',
          bodyColor: '#e2e8f0',
          borderColor: 'rgba(255, 255, 255, 0.15)',
          borderWidth: 1,
          padding: 10,
          cornerRadius: 8
        }
      },
      cutout: '68%',
      ...customOptions
    }
  });

  chartRegistry.set(canvasId, chart);
  return chart;
}
