/**
 * state.js — Single Source of Truth for Global Dashboard State
 * Highland Climate & Hotspot Interactive Dashboard (2022–2023)
 */

export const DEFAULT_MONTHS_COMPARE = [1, 2, 3, 4, 5, 6, 7, 8, 9];
export const ALL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const initialState = {
  activeTab: 'overview',      // 'overview' | 'climate' | 'rainfall' | 'hotspots' | 'correlation'
  yearMode: 'compare',       // '2022' | '2023' | 'compare'
  selectedMonths: [...DEFAULT_MONTHS_COMPARE], // Default Jan–Sep for fair HRDI comparison
  province: null,             // Selected province or null (all 9 provinces)
  district: null,             // Selected district or null
  tambon: null,               // Selected subdistrict or null
  stationId: null,            // Selected station ID or null
  metric: 'temp',             // 'temp' | 'rainfall' | 'humidity' | 'wind_speed' | 'temp_min' | 'temp_max'
  hotspotElevation: 'all',    // 'all' | 'high' (>500m) | 'low' (<=500m)
  hotspotProject: 'all',      // 'all' | 'in_project' | 'outside' | specific project
  landuse: 'all',             // 'all' | specific land use category
  proximityMethod: '10km',    // '10km' | 'tambon' (for Page 5 Climate x Hotspot)
  rainfallComparable: false,  // Strict config gate default false (Q4 quantitative diff safeguard)
  searchQuery: ''             // Optional search query for stations/districts
};

let currentState = { ...initialState };
const listeners = new Set();

/**
 * Get a read-only snapshot of the current state
 */
export function getState() {
  return { ...currentState };
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
 * Automatically manages cascading filter dependencies
 * @param {Object} updates Partial state updates
 */
export function setState(updates) {
  const oldState = { ...currentState };
  const nextState = { ...currentState, ...updates };

  // Cascade resets when geographic boundary changes
  if (updates.province !== undefined && updates.province !== oldState.province) {
    nextState.district = null;
    nextState.tambon = null;
    nextState.stationId = null;
  }
  if (updates.district !== undefined && updates.district !== oldState.district) {
    nextState.tambon = null;
  }

  // When switching year mode, adjust default months if appropriate
  if (updates.yearMode && updates.yearMode !== oldState.yearMode) {
    if (updates.yearMode === 'compare') {
      // Return to fair Jan–Sep window unless user explicitly passed selectedMonths
      if (!updates.selectedMonths) {
        nextState.selectedMonths = [...DEFAULT_MONTHS_COMPARE];
      }
    } else if (!updates.selectedMonths && oldState.selectedMonths.length === DEFAULT_MONTHS_COMPARE.length) {
      // In single year mode, default to all months if not specified
      nextState.selectedMonths = [...ALL_MONTHS];
    }
  }

  const changedKeys = Object.keys(updates).filter(k => oldState[k] !== nextState[k]);
  if (changedKeys.length === 0) return;

  currentState = nextState;

  for (const listener of listeners) {
    try {
      listener(currentState, oldState, changedKeys);
    } catch (err) {
      console.error('Error in state listener:', err);
    }
  }
}

/**
 * Reset all geographic, category, and temporal filters to defaults
 */
export function resetFilters() {
  setState({
    province: null,
    district: null,
    tambon: null,
    stationId: null,
    hotspotElevation: 'all',
    hotspotProject: 'all',
    landuse: 'all',
    selectedMonths: currentState.yearMode === 'compare' ? [...DEFAULT_MONTHS_COMPARE] : [...ALL_MONTHS],
    searchQuery: ''
  });
}
