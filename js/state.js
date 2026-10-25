/**
 * state.js — Single Source of Truth for Global Dashboard State
 * Highland Climate & Hotspot Intelligence Platform (2022–2023)
 */

export const DEFAULT_MONTHS_COMPARE = [1, 2, 3, 4, 5, 6, 7, 8, 9];
export const ALL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const initialState = {
  activeTab: 'overview',        // 'overview' (Q1) | 'climate' (Q2) | 'hotspots' (Q3) | 'correlation' (Q4) | 'quality' (Q5)
  yearMode: 'compare',          // '2022' | '2023' | 'compare'
  selectedMonths: [...DEFAULT_MONTHS_COMPARE], // Default Jan–Sep for fair HRDI comparison
  province: null,               // Selected province or null (all 9 study provinces)
  district: null,               // Selected district or null
  tambon: null,                 // Selected subdistrict or null
  stationId: null,              // Selected station ID or null (Applied Global Filter)
  previewStationId: null,       // Previewed station ID on map click before applying global filter
  stationChartMetric: 'temp',   // 'temp' | 'humidity' | 'rainfall' | 'wind_speed' for Station Detail Charts
  weatherSource: 'all',         // 'all' | 'OpenWeatherMap' | 'HRDI Weather Station'
  metric: 'temp',               // 'temp' | 'rainfall' | 'humidity' | 'wind_speed' | 'temp_min' | 'temp_max'
  overviewMetricTab: 'temp',    // 'temp' | 'humidity' | 'rainfall' | 'hotspots'
  rainfallSource: 'hrdi',       // 'hrdi' (Station rainfall) | 'hii' (Provincial rainfall)
  provinceRankOrder: 'desc',    // 'desc' (มากไปน้อย / ค่าสูงสุด) | 'asc' (น้อยไปมาก / ค่าต่ำสุด)
  districtRankOrder: 'desc',    // 'desc' (มากไปน้อย) | 'asc' (น้อยไปมาก)
  lowRainThresholdType: 'median', // 'median' | 'quartile' for Low Rain / High Hotspot explorer
  hotspotMetric: 'detections',  // 'detections' | 'frp'
  hotspotElevation: 'all',      // 'all' | 'high' (>500m) | 'low' (<=500m)
  hotspotProject: 'all',        // 'all' | 'in_project' | 'outside' | specific project name
  landuse: 'all',               // 'all' | specific land use category
  proximityMethod: '10km',      // Fixed strictly to 10 km radius around HRDI station
  mapSwipePercent: 50,          // 0 to 100% split for before/after comparison
  swipeMetric: 'temp',          // 'temp' | 'humidity' | 'rainfall' | 'hotspots'
  showMapStations: false,       // Toggle weather station markers on Overview Choropleth map
  advancedFiltersOpen: false,   // Toggle collapsible advanced filters drawer
  rainfallComparable: false,    // Strict config gate default false (Q4 safeguard)
  searchQuery: ''               // Optional search query
};

let currentState = { ...initialState, selectedMonths: [...initialState.selectedMonths] };
const listeners = new Set();

/**
 * Get a read-only snapshot of the current state
 */
export function getState() {
  return {
    ...currentState,
    selectedMonths: [...currentState.selectedMonths]
  };
}

/**
 * Subscribe a callback function to state changes
 * @param {Function} listener Callback function receiving (newState, oldState, changedKeys)
 * @returns {Function} Unsubscribe function
 */
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Update state with partial updates and notify listeners
 * Automatically manages cascading filter dependencies without clobbering explicit child updates
 * @param {Object} updates Partial state updates
 */
export function setState(updates) {
  const oldState = getState();
  const nextState = { ...currentState, ...updates };

  // Enforce fixed 10 km proximity definition
  nextState.proximityMethod = '10km';

  // Cascade resets when geographic boundary changes, preserving explicit child updates passed in same call
  if (updates.province !== undefined && updates.province !== oldState.province) {
    if (updates.district === undefined) nextState.district = null;
    if (updates.tambon === undefined) nextState.tambon = null;
    if (updates.stationId === undefined) nextState.stationId = null;
  }
  if (updates.district !== undefined && updates.district !== oldState.district) {
    if (updates.tambon === undefined) nextState.tambon = null;
    if (updates.stationId === undefined) nextState.stationId = null;
  }
  if (updates.tambon !== undefined && updates.tambon !== oldState.tambon) {
    if (updates.stationId === undefined) nextState.stationId = null;
  }

  // Sync previewStationId when stationId is explicitly set or cleared without explicit previewStationId
  if (updates.stationId !== undefined && updates.previewStationId === undefined) {
    nextState.previewStationId = updates.stationId;
  }

  // When switching year mode, adjust default months if appropriate
  if (updates.yearMode && updates.yearMode !== oldState.yearMode) {
    if (updates.yearMode === 'compare') {
      if (!updates.selectedMonths) {
        const hadAllMonths = oldState.selectedMonths.length === ALL_MONTHS.length;
        if (hadAllMonths) {
          nextState.selectedMonths = [...DEFAULT_MONTHS_COMPARE];
        }
      }
    } else if (!updates.selectedMonths) {
      const hadDefaultCompare =
        oldState.selectedMonths.length === DEFAULT_MONTHS_COMPARE.length &&
        oldState.selectedMonths.every((m, idx) => m === DEFAULT_MONTHS_COMPARE[idx]);
      if (hadDefaultCompare) {
        nextState.selectedMonths = [...ALL_MONTHS];
      }
    }
  }

  // Ensure selectedMonths is sorted unique numbers
  if (Array.isArray(nextState.selectedMonths)) {
    nextState.selectedMonths = Array.from(new Set(nextState.selectedMonths.map(Number))).sort((a, b) => a - b);
  }

  const changedKeys = Object.keys(nextState).filter(k => {
    if (Array.isArray(oldState[k]) && Array.isArray(nextState[k])) {
      return oldState[k].length !== nextState[k].length || oldState[k].some((v, i) => v !== nextState[k][i]);
    }
    return oldState[k] !== nextState[k];
  });

  if (changedKeys.length === 0) return;

  currentState = nextState;

  for (const listener of listeners) {
    try {
      listener(getState(), oldState, changedKeys);
    } catch (err) {
      console.error('Error in state listener:', err);
    }
  }
}

/**
 * Reset all geographic, category, source, and temporal filters to defaults (9-province overview)
 */
export function resetFilters() {
  setState({
    yearMode: 'compare',
    selectedMonths: [...DEFAULT_MONTHS_COMPARE],
    province: null,
    district: null,
    tambon: null,
    stationId: null,
    previewStationId: null,
    stationChartMetric: 'temp',
    weatherSource: 'all',
    metric: 'temp',
    overviewMetricTab: 'temp',
    rainfallSource: 'hrdi',
    hotspotMetric: 'detections',
    hotspotElevation: 'all',
    hotspotProject: 'all',
    landuse: 'all',
    swipeMetric: 'temp',
    searchQuery: ''
  });
}
