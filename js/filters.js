/**
 * filters.js — Dataset-Aware Cascading Filters & Unified Multidimensional Query Engine
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
 * - In 'hotspots' context (or when overviewMetricTab === 'hotspots'): returns districts with actual hotspot detections.
 * - In climate contexts: returns districts that contain actual weather stations matching weatherSource.
 *
 * @param {string|null} province
 * @param {string} [context='overview'] 'overview' | 'climate' | 'rainfall' | 'hotspots' | 'correlation' | 'quality'
 * @param {string} [weatherSource='all'] 'all' | 'OpenWeatherMap' | 'HRDI Weather Station'
 * @returns {string[]}
 */
export function getAvailableDistricts(province = null, context = 'overview', weatherSource = 'all') {
  const db = getDb();
  const set = new Set();

  if (context === 'hotspots') {
    for (const h of db.hotspotDistrictMonth) {
      if (!province || h.province === province) {
        if (h.district && h.count > 0) set.add(h.district);
      }
    }
  } else {
    for (const s of db.stations) {
      if (province && s.province !== province) continue;
      if (weatherSource && weatherSource !== 'all' && s.source_type !== weatherSource) continue;
      if (s.district) set.add(s.district);
    }
  }

  return Array.from(set).sort((a, b) => a.localeCompare(b, 'th'));
}

/**
 * Dataset-aware subdistrict (tambon) retriever
 * @param {string|null} province
 * @param {string|null} district
 * @param {string} [context='overview']
 * @param {string} [weatherSource='all']
 * @returns {string[]}
 */
export function getAvailableTambons(province = null, district = null, context = 'overview', weatherSource = 'all') {
  const db = getDb();
  const set = new Set();

  if (context === 'hotspots' && db.hotspotMultidimIndex) {
    const idx = db.hotspotMultidimIndex;
    const { provinces, districts, tambons } = idx.dimensions;
    const pTarget = province ? provinces.indexOf(province) : -1;
    const dTarget = district ? districts.indexOf(district) : -1;
    if ((province && pTarget === -1) || (district && dTarget === -1)) return [];

    for (const r of idx.rows) {
      if (province && r[2] !== pTarget) continue;
      if (district && r[3] !== dTarget) continue;
      if (r[10] > 0) {
        const tName = tambons[r[4]];
        if (tName) set.add(tName);
      }
    }
  } else {
    for (const s of db.stations) {
      if (province && s.province !== province) continue;
      if (district && s.district !== district) continue;
      if (weatherSource && weatherSource !== 'all' && s.source_type !== weatherSource) continue;
      if (s.tambon) set.add(s.tambon);
    }
  }

  return Array.from(set).sort((a, b) => a.localeCompare(b, 'th'));
}

/**
 * Get stations matching selected geographic and weatherSource filters
 * @param {string|null} province
 * @param {string|null} district
 * @param {string|null} [tambon=null]
 * @param {string} [weatherSource='all']
 */
export function getAvailableStations(province = null, district = null, tambon = null, weatherSource = 'all') {
  const db = getDb();
  return db.stations.filter(s => {
    if (province && s.province !== province) return false;
    if (district && s.district !== district) return false;
    if (tambon && s.tambon !== tambon) return false;
    if (weatherSource && weatherSource !== 'all' && s.source_type !== weatherSource) return false;
    return true;
  });
}

/**
 * Get distinct land use categories from hotspot dataset
 */
export function getAvailableLanduses() {
  const db = getDb();
  if (db.hotspotMultidimIndex && db.hotspotMultidimIndex.dimensions) {
    return [...db.hotspotMultidimIndex.dimensions.landuses];
  }
  const set = new Set();
  for (const r of db.hotspotByLanduse) {
    if (r.landuse) set.add(r.landuse);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'th'));
}

/**
 * Get distinct HRDI project names from hotspot dataset
 */
export function getAvailableProjects(province = null) {
  const db = getDb();
  const set = new Set();
  for (const r of db.hotspotByProject) {
    if (province && r.province !== province) continue;
    if (r.project_category && r.project_category !== 'นอกพื้นที่ดำเนินงาน') {
      set.add(r.project_category);
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'th'));
}

/**
 * Filter HRDI / Station-Month dashboard records based on state (including weatherSource and tambon)
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
  const wsFilter = state.weatherSource && state.weatherSource !== 'all' ? state.weatherSource : null;

  return records.filter(r => {
    if (!yearFilter.includes(r.year)) return false;
    if (!selectedMonths.has(r.month)) return false;
    if (wsFilter && r.source_type !== wsFilter) return false;
    if (state.stationId && r.station_id !== state.stationId) return false;
    if (state.province && r.province !== state.province) return false;
    if (state.district && r.district !== state.district) return false;
    if (state.tambon && r.tambon !== state.tambon) return false;
    return true;
  });
}

/**
 * Filter HII provincial rainfall records based on state
 * Note: HII is provincial-level only (does not filter by station, district, tambon, or weatherSource)
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
 * Core internal multidimensional hotspot cube filter (strict AND across all active dimensions)
 * Schema of each row in db.hotspotMultidimIndex.rows:
 * [0:year, 1:month, 2:province_idx, 3:district_idx, 4:tambon_idx, 5:elev_idx, 6:high_elev_bool, 7:project_idx, 8:in_project_bool, 9:landuse_idx, 10:count, 11:frp_sum]
 *
 * @param {Object} state Current state
 * @param {Object} [options={}] Optional dimension overrides / ignores for chart breakdowns
 * @returns {Array} Matching cube rows
 */
export function queryHotspotCube(state, options = {}) {
  const db = getDb();
  const idx = db.hotspotMultidimIndex;
  if (!idx || !idx.rows) return [];

  const { provinces, districts, tambons, projects, landuses } = idx.dimensions;

  const yearFilter = options.year !== undefined && options.year !== null
    ? [Number(options.year)]
    : options.ignoreYear
      ? [2022, 2023]
      : state.yearMode === 'compare'
        ? [2022, 2023]
        : [Number(state.yearMode)];

  const selectedMonths = options.ignoreMonth
    ? null
    : new Set(options.months || state.selectedMonths);

  const provName = options.ignoreProvince ? null : (options.province !== undefined ? options.province : state.province);
  const distName = options.ignoreDistrict ? null : (options.district !== undefined ? options.district : state.district);
  const tambonName = options.ignoreTambon ? null : (options.tambon !== undefined ? options.tambon : state.tambon);
  const elevFilter = options.ignoreElevation ? 'all' : (options.hotspotElevation || state.hotspotElevation || 'all');
  const projFilter = options.ignoreProject ? 'all' : (options.hotspotProject || state.hotspotProject || 'all');
  const luFilter = options.ignoreLanduse ? 'all' : (options.landuse || state.landuse || 'all');

  const pTarget = provName ? provinces.indexOf(provName) : -1;
  const dTarget = distName ? districts.indexOf(distName) : -1;
  const tTarget = tambonName ? tambons.indexOf(tambonName) : -1;
  const luTarget = luFilter !== 'all' ? landuses.indexOf(luFilter) : -1;
  const specificProjTarget = (projFilter !== 'all' && projFilter !== 'in_project' && projFilter !== 'outside')
    ? projects.indexOf(projFilter)
    : -1;

  // If a requested filter value does not exist in the hotspot cube at all, return empty
  if (provName && pTarget === -1) return [];
  if (distName && dTarget === -1) return [];
  if (tambonName && tTarget === -1) return [];
  if (luFilter !== 'all' && luTarget === -1) return [];
  if (projFilter !== 'all' && projFilter !== 'in_project' && projFilter !== 'outside' && specificProjTarget === -1) return [];

  const matched = [];
  const rows = idx.rows;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!yearFilter.includes(r[0])) continue;
    if (selectedMonths && !selectedMonths.has(r[1])) continue;
    if (pTarget !== -1 && r[2] !== pTarget) continue;
    if (dTarget !== -1 && r[3] !== dTarget) continue;
    if (tTarget !== -1 && r[4] !== tTarget) continue;

    if (elevFilter === 'high' && r[6] !== 1) continue;
    if (elevFilter === 'low' && r[6] !== 0) continue;

    if (projFilter === 'in_project' && r[8] !== 1) continue;
    if (projFilter === 'outside' && r[8] !== 0) continue;
    if (specificProjTarget !== -1 && r[7] !== specificProjTarget) continue;

    if (luTarget !== -1 && r[9] !== luTarget) continue;

    matched.push(r);
  }

  return matched;
}

/**
 * Calculate total satellite hotspot detections for the filtered scope
 * Strictly applies ALL active geographic, temporal, and hotspot category filters with AND logic
 *
 * @param {Object} state
 * @param {number|null} [targetYear]
 * @returns {number} Count of satellite hotspot detections
 */
export function getFilteredHotspotCount(state, targetYear = null) {
  const db = getDb();
  if (db.hotspotMultidimIndex) {
    const rows = queryHotspotCube(state, targetYear !== null ? { year: targetYear } : {});
    let sum = 0;
    for (let i = 0; i < rows.length; i++) {
      sum += rows[i][10];
    }
    return sum;
  }

  // Fallback to provincial aggregate if index not yet loaded
  const yearFilter = targetYear !== null
    ? [targetYear]
    : state.yearMode === 'compare'
      ? [2022, 2023]
      : [Number(state.yearMode)];
  const selectedMonths = new Set(state.selectedMonths);
  return db.hotspotProvinceMonth.reduce((sum, r) => {
    if (!yearFilter.includes(r.year)) return sum;
    if (!selectedMonths.has(r.month)) return sum;
    if (state.province && r.province !== state.province) return sum;
    return sum + (r.count || 0);
  }, 0);
}

/**
 * Get monthly hotspot series (months 1..12) for a given year, respecting all other active filters
 * @param {Object} state
 * @param {number} targetYear 2022 or 2023
 * @param {boolean} [respectSelectedMonths=false] If true, zeros/nulls months outside selectedMonths
 * @returns {number[]} Array of 12 counts for months 1..12
 */
export function getHotspotMonthlySeries(state, targetYear, respectSelectedMonths = false) {
  const series = new Array(12).fill(0);
  const rows = queryHotspotCube(state, {
    year: targetYear,
    ignoreMonth: !respectSelectedMonths
  });
  for (let i = 0; i < rows.length; i++) {
    const m = rows[i][1];
    if (m >= 1 && m <= 12) {
      series[m - 1] += rows[i][10];
    }
  }
  return series;
}

/**
 * Get hotspot counts broken down by the 9 study provinces, respecting active month and category filters
 * @param {Object} state
 * @param {boolean} [ignoreProvinceFilter=true] Keep all 9 provinces for ranking comparison
 */
export function getHotspotByProvinceBreakdown(state, ignoreProvinceFilter = true) {
  const db = getDb();
  const idx = db.hotspotMultidimIndex;
  const map2022 = new Map(STUDY_PROVINCES.map(p => [p, 0]));
  const map2023 = new Map(STUDY_PROVINCES.map(p => [p, 0]));
  const frpMap = new Map(STUDY_PROVINCES.map(p => [p, 0]));

  if (idx) {
    const rows = queryHotspotCube(state, {
      ignoreYear: true,
      ignoreProvince: ignoreProvinceFilter,
      ignoreDistrict: ignoreProvinceFilter ? true : false,
      ignoreTambon: ignoreProvinceFilter ? true : false
    });
    const { provinces } = idx.dimensions;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const pName = provinces[r[2]];
      if (!map2022.has(pName)) continue;
      if (r[0] === 2022) map2022.set(pName, map2022.get(pName) + r[10]);
      if (r[0] === 2023) map2023.set(pName, map2023.get(pName) + r[10]);
      frpMap.set(pName, frpMap.get(pName) + r[11]);
    }
  }

  return STUDY_PROVINCES.map(prov => {
    const count2022 = map2022.get(prov) || 0;
    const count2023 = map2023.get(prov) || 0;
    const total = state.yearMode === '2022' ? count2022
      : state.yearMode === '2023' ? count2023
      : count2022 + count2023;
    return {
      province: prov,
      count2022,
      count2023,
      total
    };
  });
}

/**
 * Get hotspot counts broken down by district, respecting all active filters
 * @param {Object} state
 * @param {boolean} [ignoreDistrictFilter=false]
 */
export function getHotspotByDistrictBreakdown(state, ignoreDistrictFilter = false) {
  const db = getDb();
  const idx = db.hotspotMultidimIndex;
  if (!idx) return [];

  const { provinces, districts } = idx.dimensions;
  const rows = queryHotspotCube(state, {
    ignoreYear: true,
    ignoreDistrict: ignoreDistrictFilter
  });

  const distMap = new Map();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const pName = provinces[r[2]];
    const dName = districts[r[3]];
    const key = `${pName}||${dName}`;
    if (!distMap.has(key)) {
      distMap.set(key, { province: pName, district: dName, count2022: 0, count2023: 0, total: 0 });
    }
    const entry = distMap.get(key);
    if (r[0] === 2022) entry.count2022 += r[10];
    if (r[0] === 2023) entry.count2023 += r[10];
  }

  const list = Array.from(distMap.values()).map(d => ({
    ...d,
    total: state.yearMode === '2022' ? d.count2022
      : state.yearMode === '2023' ? d.count2023
      : d.count2022 + d.count2023
  })).filter(d => d.total > 0);

  list.sort((a, b) => b.total - a.total);
  return list;
}

/**
 * Get hotspot counts broken down by land use category, respecting all active filters
 * @param {Object} state
 * @param {boolean} [ignoreLanduseFilter=false]
 */
export function getHotspotByLanduseBreakdown(state, ignoreLanduseFilter = false) {
  const db = getDb();
  const idx = db.hotspotMultidimIndex;
  if (!idx) return [];

  const { landuses } = idx.dimensions;
  const rows = queryHotspotCube(state, {
    ignoreYear: true,
    ignoreLanduse: ignoreLanduseFilter
  });

  const luMap = new Map();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const luName = landuses[r[9]];
    if (!luMap.has(luName)) {
      luMap.set(luName, { landuse: luName, count2022: 0, count2023: 0, total: 0 });
    }
    const entry = luMap.get(luName);
    if (r[0] === 2022) entry.count2022 += r[10];
    if (r[0] === 2023) entry.count2023 += r[10];
  }

  const list = Array.from(luMap.values()).map(item => ({
    ...item,
    total: state.yearMode === '2022' ? item.count2022
      : state.yearMode === '2023' ? item.count2023
      : item.count2022 + item.count2023
  })).filter(item => item.total > 0);

  list.sort((a, b) => b.total - a.total);
  return list;
}

/**
 * Get hotspot counts broken down by elevation category (>500m vs <=500m), respecting all active filters
 * @param {Object} state
 * @param {boolean} [ignoreElevationFilter=false]
 */
export function getHotspotByElevationBreakdown(state, ignoreElevationFilter = false) {
  const rows = queryHotspotCube(state, {
    ignoreYear: true,
    ignoreElevation: ignoreElevationFilter
  });

  let high2022 = 0, low2022 = 0, high2023 = 0, low2023 = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const isHigh = r[6] === 1;
    if (r[0] === 2022) {
      if (isHigh) high2022 += r[10];
      else low2022 += r[10];
    } else if (r[0] === 2023) {
      if (isHigh) high2023 += r[10];
      else low2023 += r[10];
    }
  }

  return {
    high2022,
    low2022,
    high2023,
    low2023,
    highTotal: state.yearMode === '2022' ? high2022 : state.yearMode === '2023' ? high2023 : high2022 + high2023,
    lowTotal: state.yearMode === '2022' ? low2022 : state.yearMode === '2023' ? low2023 : low2022 + low2023
  };
}

/**
 * Get hotspot counts broken down by HRDI project area vs outside project area, respecting all active filters
 * @param {Object} state
 * @param {boolean} [ignoreProjectFilter=false]
 */
export function getHotspotByProjectBreakdown(state, ignoreProjectFilter = false) {
  const db = getDb();
  const idx = db.hotspotMultidimIndex;
  const rows = queryHotspotCube(state, {
    ignoreYear: true,
    ignoreProject: ignoreProjectFilter
  });

  let in2022 = 0, out2022 = 0, in2023 = 0, out2023 = 0;
  const projectMap = new Map();

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const inProj = r[8] === 1;
    if (r[0] === 2022) {
      if (inProj) in2022 += r[10];
      else out2022 += r[10];
    } else if (r[0] === 2023) {
      if (inProj) in2023 += r[10];
      else out2023 += r[10];
    }

    if (idx && inProj) {
      const pName = idx.dimensions.projects[r[7]];
      if (!projectMap.has(pName)) {
        projectMap.set(pName, { project: pName, count2022: 0, count2023: 0, total: 0 });
      }
      const entry = projectMap.get(pName);
      if (r[0] === 2022) entry.count2022 += r[10];
      if (r[0] === 2023) entry.count2023 += r[10];
    }
  }

  const byProjectName = Array.from(projectMap.values()).map(p => ({
    ...p,
    total: state.yearMode === '2022' ? p.count2022 : state.yearMode === '2023' ? p.count2023 : p.count2022 + p.count2023
  })).filter(p => p.total > 0).sort((a, b) => b.total - a.total);

  return {
    in2022,
    out2022,
    in2023,
    out2023,
    inTotal: state.yearMode === '2022' ? in2022 : state.yearMode === '2023' ? in2023 : in2022 + in2023,
    outTotal: state.yearMode === '2022' ? out2022 : state.yearMode === '2023' ? out2023 : out2022 + out2023,
    byProjectName
  };
}

/**
 * Compute real province coverage count in the active filter scope (Requirement F)
 * Distinguishes between active provinces with data and the fixed 9 study provinces
 * @param {Object} state
 * @param {Array} filteredHrdiRecords
 * @returns {{ activeProvinceCount: number, climateProvinceCount: number, hotspotProvinceCount: number, label: string, sublabel: string }}
 */
export function getActiveProvinceCoverage(state, filteredHrdiRecords = []) {
  const climateProvs = new Set(filteredHrdiRecords.map(r => r.province));
  const hsRows = queryHotspotCube(state);
  const db = getDb();
  const hotspotProvs = new Set();
  if (db.hotspotMultidimIndex) {
    const { provinces } = db.hotspotMultidimIndex.dimensions;
    for (let i = 0; i < hsRows.length; i++) {
      if (hsRows[i][10] > 0) {
        hotspotProvs.add(provinces[hsRows[i][2]]);
      }
    }
  }

  const isHotspotContext = state.activeTab === 'hotspots' || (state.activeTab === 'overview' && state.overviewMetricTab === 'hotspots');
  const isWeatherSourceFiltered = state.weatherSource && state.weatherSource !== 'all';

  let activeCount = 0;
  let sublabel = 'จากพื้นที่ศึกษาทั้งหมด 9 จังหวัด';

  if (state.province) {
    // Specific province selected
    activeCount = (isHotspotContext ? hotspotProvs.has(state.province) : (climateProvs.size > 0 || hotspotProvs.has(state.province))) ? 1 : 0;
    sublabel = activeCount > 0
      ? `เฉพาะจังหวัด${state.province} (พื้นที่ศึกษา 9 จังหวัด)`
      : `ไม่พบข้อมูลใน จ.${state.province} ตามตัวกรอง`;
  } else if (isWeatherSourceFiltered && !isHotspotContext) {
    activeCount = climateProvs.size;
    sublabel = `มีสถานี ${state.weatherSource} (จาก 9 จังหวัดศึกษา)`;
  } else if (isHotspotContext) {
    activeCount = hotspotProvs.size;
    sublabel = `มีจุดความร้อนตามเงื่อนไข (จาก 9 จังหวัดศึกษา)`;
  } else {
    const unionProvs = new Set([...climateProvs, ...hotspotProvs]);
    activeCount = climateProvs.size > 0 ? climateProvs.size : unionProvs.size;
    sublabel = `จังหวัดที่มีข้อมูลในขอบเขตที่เลือก (พื้นที่ศึกษา 9 จังหวัด)`;
  }

  return {
    activeProvinceCount: activeCount,
    climateProvinceCount: climateProvs.size,
    hotspotProvinceCount: hotspotProvs.size,
    sublabel
  };
}

/**
 * Filter raw normalized hotspot event records (from data/hotspots/YYYY/MM.json)
 * Uses identical AND logic as queryHotspotCube
 * @param {Array} events
 * @param {Object} state
 * @returns {Array} Filtered hotspot events
 */
export function filterRawHotspotEvents(events, state) {
  if (!events) return [];

  const yearFilter = state.yearMode === 'compare'
    ? [2022, 2023]
    : [Number(state.yearMode)];
  const selectedMonths = new Set(state.selectedMonths);

  return events.filter(e => {
    if (!yearFilter.includes(Number(e.year))) return false;
    if (!selectedMonths.has(Number(e.month))) return false;
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
