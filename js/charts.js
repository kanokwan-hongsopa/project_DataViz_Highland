/**
 * charts.js — Chart.js Wrapper, Lifecycle Management & Styling
 * Highland Climate & Hotspot Interactive Dashboard (2022–2023)
 * 
 * Strict rule:
 * - NO forecasting lines, no future dashed extrapolation
 * - Tooltips show Thai units and record counts
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
 * @param {string} canvasId 
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
 * Common default options for Chart.js
 */
function getDefaultOptions(customOptions = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 350
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
            family: '-apple-system, BlinkMacSystemFont, "Sarabun", sans-serif',
            size: 12
          },
          usePointStyle: true,
          boxWidth: 8
        }
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleFont: {
          family: '-apple-system, BlinkMacSystemFont, "Sarabun", sans-serif',
          size: 13,
          weight: 'bold'
        },
        bodyFont: {
          family: '-apple-system, BlinkMacSystemFont, "Sarabun", sans-serif',
          size: 12
        },
        padding: 10,
        cornerRadius: 6
      }
    },
    scales: {
      x: {
        grid: {
          color: '#f1f5f9'
        },
        ticks: {
          font: {
            family: '-apple-system, BlinkMacSystemFont, "Sarabun", sans-serif',
            size: 11
          },
          color: '#64748b'
        }
      },
      y: {
        grid: {
          color: '#f1f5f9'
        },
        ticks: {
          font: {
            family: '-apple-system, BlinkMacSystemFont, "Sarabun", sans-serif',
            size: 11
          },
          color: '#64748b'
        }
      }
    },
    ...customOptions
  };
}

/**
 * Render a Line Chart
 * @param {string} canvasId 
 * @param {Object} data Chart.js data object
 * @param {Object} customOptions 
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
 * @param {string} canvasId 
 * @param {Object} data 
 * @param {Object} customOptions 
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
      borderRadius: 4,
      ...customOptions
    })
  });

  chartRegistry.set(canvasId, chart);
  return chart;
}

/**
 * Render a Scatter Chart
 * @param {string} canvasId 
 * @param {Object} data 
 * @param {Object} customOptions 
 */
export function renderScatterChart(canvasId, data, customOptions = {}) {
  if (typeof Chart === 'undefined') return null;

  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;

  const ctx = canvas.getContext('2d');
  const chart = new Chart(ctx, {
    type: 'scatter',
    data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'nearest',
        intersect: true
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          padding: 10,
          cornerRadius: 6,
          ...customOptions.plugins?.tooltip
        }
      },
      scales: {
        x: {
          grid: { color: '#f1f5f9' },
          ticks: { color: '#64748b' },
          title: customOptions.scales?.x?.title || {}
        },
        y: {
          grid: { color: '#f1f5f9' },
          ticks: { color: '#64748b' },
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
 * Render a Doughnut / Pie Chart
 * @param {string} canvasId 
 * @param {Object} data 
 * @param {Object} customOptions 
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
              family: '-apple-system, BlinkMacSystemFont, "Sarabun", sans-serif',
              size: 11
            },
            boxWidth: 10
          }
        }
      },
      cutout: '65%',
      ...customOptions
    }
  });

  chartRegistry.set(canvasId, chart);
  return chart;
}
