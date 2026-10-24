/**
 * filters.js — Dataset-Aware Cascading Filters & Query Engine
 * Highland Climate & Hotspot Intelligence Platform (2022–2023)
 */

import { getDb } from './data-loader.js';

export const STUDY_PROVINCES = [
  'กาญจนบุรี', 'กำแพงเพชร', 'ตาก', 'น่าน', 'พิษณุโลก',
  'เชียงราย', 'เชียงใหม่', 'เพชรบูรณ์', 'แม่ฮ่องสอน'
];

/**
 * Get distinct study provinces list (strictly only the 9 study provinces)
 */
export function getAvailableProvinces() {
  const db = getDb();
  if (db.config && db.config.provinces) {
    return [...db.config.provinces];
  }
  return [...STUDY_PROVINCES];
}

/**
 * Dataset-aware district retriever:
 * In 'climate', 'overview', or 'correlation' context: only returns districts that contain actual HRDI weather stations.
 * In 'hotspots' context: returns districts that contain actual hotspot detections.
 * 
 * @param {string|null} province 
 * @param {string} [context='overview'] 'overview' | 'climate' | 'rainfall' | 'hotspots' | 'correlation'
 * @returns {string[]}
 */
export function getAvailableDistricts(province = null, context = 'overview') {
  const db = getDb();
  const set = new Set();

  if (context === 'hotspots') {
    // In Hotspot Explorer, show districts with actual hotspot records
    for (const h of db.hotspotDistrictMonth) {
      if (!province || h.province === province) {
        if (h.district && h.count > 0) set.add(h.district);
      }
    }
  } else {
    // In Climate, Overview, Rainfall, and Correlation, show only districts with real HRDI weather stations
    for (const s of db.stations) {
      if (!province || s.province === province) {
        if (s.district) set.add(s.district);
      }
    }
  }

  return Array.from(set).sort((a, b) => a.localeCompare(b, 'th'));
}

/**
 * Dataset-aware subdistrict (tambon) retriever
 * @param {string|null} province 
 * @param {string|null} district 
 * @param {string} [context='overview']
 * @returns {string[]}
 */
export function getAvailableTambons(province = null, district = null, context = 'overview') {
  const db = getDb();
  const set = new Set();

  // Primary source: stations in matching area
  for (const s of db.stations) {
    if (province && s.province !== province) continue;
    if (district && s.district !== district) continue;
    if (s.tambon) set.add(s.tambon);
  }

  return Array.from(set).sort((a, b) => a.localeCompare(b, 'th'));
}

/**
 * Get stations matching selected geographic filters
 * @param {string|null} province 
 * @param {string|null} district 
 */
export function getAvailableStations(province = null, district = null) {
  const db = getDb();
  return db.stations.filter(s => {
    if (province && s.province !== province) return false;
    if (district && s.district !== district) return false;
    return true;
  });
}

/**
 * Filter HRDI / Station-Month dashboard records based on state
 * @param {Array} records Array of station-month records
 * @param {Object} state Current dashboard state
 * @param {number|null} [targetYear] Optional override year (2022 or 2023)
 * @returns {Array} Filtered records
 */
export function filterStationMonthRecords(records, state, targetYear = null) {
  if (!records) return [];

  const yearFilter = targetYear !== null
    ? [targetYear]
    : state.yearMode === 'compare'
      ? [2022, 2023]
      : [Number(state.yearMode)];

  const selectedMonths = new Set(state.selectedMonths);

  return records.filter(r => {
    if (!yearFilter.includes(r.year)) return false;
    if (!selectedMonths.has(r.month)) return false;
    if (state.stationId && r.station_id !== state.stationId) return false;
    if (state.province && r.province !== state.province) return false;
    if (state.district && r.district !== state.district) return false;
    if (state.tambon && r.tambon !== state.tambon) return false;
    return true;
  });
}

/**
 * Filter HII provincial rainfall records based on state
 * @param {Array} hiiRecords 
 * @param {Object} state 
 * @param {number|null} [targetYear] 
 * @returns {Array} Filtered HII records
 */
export function filterHiiRecords(hiiRecords, state, targetYear = null) {
  if (!hiiRecords) return [];

  const yearFilter = targetYear !== null
    ? [targetYear]
    : state.yearMode === 'compare'
      ? [2022, 2023]
      : [Number(state.yearMode)];

  const selectedMonths = new Set(state.selectedMonths);

  return hiiRecords.filter(r => {
    if (!yearFilter.includes(r.year)) return false;
    if (!selectedMonths.has(r.month)) return false;
    if (state.province && r.province !== state.province) return false;
    return true;
  });
}

/**
 * Calculate total satellite hotspot detections for the filtered scope
 * Uses fast aggregate tables when query matches province/district/year/month
 * 
 * @param {Object} state 
 * @param {number|null} [targetYear] 
 * @returns {number} Count of satellite hotspot detections
 */
export function getFilteredHotspotCount(state, targetYear = null) {
  const db = getDb();
  const yearFilter = targetYear !== null
    ? [targetYear]
    : state.yearMode === 'compare'
      ? [2022, 2023]
      : [Number(state.yearMode)];

  const selectedMonths = new Set(state.selectedMonths);

  // If district is selected, sum from hotspotDistrictMonth
  if (state.district) {
    return db.hotspotDistrictMonth.reduce((sum, r) => {
      if (!yearFilter.includes(r.year)) return sum;
      if (!selectedMonths.has(r.month)) return sum;
      if (state.province && r.province !== state.province) return sum;
      if (r.district !== state.district) return sum;
      return sum + (r.count || 0);
    }, 0);
  }

  // If elevation category filter is active (not 'all')
  if (state.hotspotElevation && state.hotspotElevation !== 'all') {
    const elevTarget = state.hotspotElevation === 'high' ? 'สูงกว่า 500 เมตร' : 'ต่ำกว่า 500 เมตร';
    return db.hotspotByElevation.reduce((sum, r) => {
      if (!yearFilter.includes(r.year)) return sum;
      if (!selectedMonths.has(r.month)) return sum;
      if (state.province && r.province !== state.province) return sum;
      if (r.elevation_category !== elevTarget) return sum;
      return sum + (r.count || 0);
    }, 0);
  }

  // If land use filter is active
  if (state.landuse && state.landuse !== 'all') {
    return db.hotspotByLanduse.reduce((sum, r) => {
      if (!yearFilter.includes(r.year)) return sum;
      if (!selectedMonths.has(r.month)) return sum;
      if (state.province && r.province !== state.province) return sum;
      if (r.landuse !== state.landuse) return sum;
      return sum + (r.count || 0);
    }, 0);
  }

  // If project category filter is active
  if (state.hotspotProject && state.hotspotProject !== 'all') {
    return db.hotspotByProject.reduce((sum, r) => {
      if (!yearFilter.includes(r.year)) return sum;
      if (!selectedMonths.has(r.month)) return sum;
      if (state.province && r.province !== state.province) return sum;
      if (state.hotspotProject === 'in_project' && r.project_category === 'นอกพื้นที่ดำเนินงาน') return sum;
      if (state.hotspotProject === 'outside' && r.project_category !== 'นอกพื้นที่ดำเนินงาน') return sum;
      if (state.hotspotProject !== 'in_project' && state.hotspotProject !== 'outside') {
        if (r.project_category !== state.hotspotProject) return sum;
      }
      return sum + (r.count || 0);
    }, 0);
  }

  // Base provincial aggregate
  return db.hotspotProvinceMonth.reduce((sum, r) => {
    if (!yearFilter.includes(r.year)) return sum;
    if (!selectedMonths.has(r.month)) return sum;
    if (state.province && r.province !== state.province) return sum;
    return sum + (r.count || 0);
  }, 0);
}

/**
 * Filter raw normalized hotspot event records
 * @param {Array} events 
 * @param {Object} state 
 * @returns {Array} Filtered hotspot events
 */
export function filterRawHotspotEvents(events, state) {
  if (!events) return [];

  const selectedMonths = new Set(state.selectedMonths);

  return events.filter(e => {
    if (!selectedMonths.has(e.month)) return false;
    if (state.province && e.province !== state.province) return false;
    if (state.district && e.district !== state.district) return false;
    if (state.tambon && e.tambon !== state.tambon) return false;

    if (state.hotspotElevation === 'high' && !e.highElevation500m) return false;
    if (state.hotspotElevation === 'low' && e.highElevation500m) return false;

    if (state.hotspotProject === 'in_project' && !e.inHrdiProject) return false;
    if (state.hotspotProject === 'outside' && e.inHrdiProject) return false;
    if (state.hotspotProject !== 'all' && state.hotspotProject !== 'in_project' && state.hotspotProject !== 'outside') {
      if (e.projectCategory !== state.hotspotProject) return false;
    }

    if (state.landuse && state.landuse !== 'all' && e.landuse !== state.landuse) {
      return false;
    }

    return true;
  });
}
