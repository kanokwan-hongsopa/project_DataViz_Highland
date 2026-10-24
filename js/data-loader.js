/**
 * data-loader.js — Data Fetching, Partition Caching & Verification
 * Highland Climate & Hotspot Interactive Dashboard (2022–2023)
 */

const DATA_ROOT = 'data/';

// In-memory data store for static datasets
const db = {
  config: null,
  stations: [],
  hrdiStationMonth: [],
  hiiProvinceMonth: [],
  stationMonthDashboard: [],
  hotspotManifest: null,
  hotspotProvinceMonth: [],
  hotspotDistrictMonth: [],
  hotspotByElevation: [],
  hotspotByLanduse: [],
  hotspotByProject: [],
  // Partition cache: key "YYYY-MM" -> array of normalized event objects
  hotspotPartitions: new Map()
};

/**
 * Fetch a JSON file safely using relative path
 * @param {string} relativePath Path relative to DATA_ROOT
 */
async function fetchJson(relativePath) {
  const url = `${DATA_ROOT}${relativePath}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.status} ${response.statusText}`);
  }
  return await response.json();
}

/**
 * Load all core aggregate and reference datasets in parallel
 * @param {Function} onProgress Optional progress callback (percent, message)
 */
export async function loadCoreData(onProgress = () => {}) {
  onProgress(10, 'กำลังโหลดข้อมูลคอนฟิกและสถานีตรวจวัด...');
  const [config, stations, manifest] = await Promise.all([
    fetchJson('dashboard_config.json'),
    fetchJson('stations.json'),
    fetchJson('hotspot_manifest.json')
  ]);
  db.config = config;
  db.stations = stations;
  db.hotspotManifest = manifest;

  onProgress(35, 'กำลังโหลดข้อมูลภูมิอากาศ HRDI และ HII...');
  const [hrdi, hii, dashboardSm] = await Promise.all([
    fetchJson('hrdi_station_month.json'),
    fetchJson('hii_province_month.json'),
    fetchJson('station_month_dashboard.json')
  ]);
  db.hrdiStationMonth = hrdi;
  db.hiiProvinceMonth = hii;
  db.stationMonthDashboard = dashboardSm;

  onProgress(70, 'กำลังโหลดข้อมูลสรุปมิติจุดความร้อน...');
  const [provHotspots, distHotspots, elevHotspots, luHotspots, projHotspots] = await Promise.all([
    fetchJson('hotspot_province_month.json'),
    fetchJson('hotspot_district_month.json'),
    fetchJson('hotspot_by_elevation.json'),
    fetchJson('hotspot_by_landuse.json'),
    fetchJson('hotspot_by_project.json')
  ]);
  db.hotspotProvinceMonth = provHotspots;
  db.hotspotDistrictMonth = distHotspots;
  db.hotspotByElevation = elevHotspots;
  db.hotspotByLanduse = luHotspots;
  db.hotspotByProject = projHotspots;

  onProgress(100, 'โหลดข้อมูลหลักสมบูรณ์');

  // Verify dataset record counts against strict requirements
  verifyDataIntegrity();

  return db;
}

/**
 * Verify record counts against BRD and HANDOFF contracts
 */
export function verifyDataIntegrity() {
  const errors = [];
  if (db.stations.length !== 50) {
    errors.push(`Stations count mismatch: expected 50, got ${db.stations.length}`);
  }
  if (db.hrdiStationMonth.length !== 977) {
    errors.push(`HRDI records mismatch: expected 977, got ${db.hrdiStationMonth.length}`);
  }
  if (db.hiiProvinceMonth.length !== 216) {
    errors.push(`HII records mismatch: expected 216, got ${db.hiiProvinceMonth.length}`);
  }
  if (db.stationMonthDashboard.length !== 977) {
    errors.push(`station_month_dashboard records mismatch: expected 977, got ${db.stationMonthDashboard.length}`);
  }
  if (!db.hotspotManifest || db.hotspotManifest.total_events !== 106036) {
    errors.push(`Hotspots total events mismatch: expected 106,036, got ${db.hotspotManifest?.total_events}`);
  }

  const provSum = db.hotspotProvinceMonth.reduce((s, r) => s + (r.count || 0), 0);
  if (provSum !== 106036) {
    errors.push(`hotspot_province_month sum mismatch: expected 106,036, got ${provSum}`);
  }

  if (errors.length > 0) {
    console.error('Data integrity check warnings:', errors);
  } else {
    console.log('✓ Data integrity verified: 50 stations, 977 HRDI, 216 HII, 106,036 hotspots.');
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Lazy-load and normalize a single monthly hotspot partition
 * @param {number} year 2022 or 2023
 * @param {number} month 1 to 12
 * @returns {Promise<Array>} Array of normalized hotspot event objects
 */
export async function loadHotspotPartition(year, month) {
  const key = `${year}-${String(month).padStart(2, '0')}`;
  if (db.hotspotPartitions.has(key)) {
    return db.hotspotPartitions.get(key);
  }

  const path = `hotspots/${year}/${String(month).padStart(2, '0')}.json`;
  const rawEvents = await fetchJson(path);

  // Normalize fields explicitly according to HANDOFF guidelines
  const normalized = rawEvents.map(e => ({
    hotspot_id: e.hotspot_id,
    date: e.date,
    year: e.year,
    month: e.month,
    province: e.province,
    district: e.district,
    tambon: e.tambon,
    village: e.village || '',
    lat: Number(e.LATITUDE),
    lon: Number(e.LONGITUDE),
    frp: e.FRP !== null && e.FRP !== undefined ? Number(e.FRP) : null,
    elevationCategory: e.Elev || (e.high_elevation_500m ? 'สูงกว่า 500 เมตร' : 'ต่ำกว่า 500 เมตร'),
    highElevation500m: Boolean(e.high_elevation_500m),
    projectCategory: e.PROJECT || (e.in_hrdi_project ? 'พื้นที่โครงการ' : 'นอกพื้นที่ดำเนินงาน'),
    inHrdiProject: Boolean(e.in_hrdi_project),
    landuse: e.LU_NAME || 'ไม่ระบุ',
    satellite: e.SATELLITE || '',
    confidence: e.CONFIDENCE || ''
  }));

  db.hotspotPartitions.set(key, normalized);
  return normalized;
}

/**
 * Lazy-load all monthly hotspot partitions matching the given years and months list
 * @param {number[]} years e.g. [2022] or [2023] or [2022, 2023]
 * @param {number[]} months e.g. [1, 2, 3]
 * @param {Function} onProgress
 * @returns {Promise<Array>} Combined array of normalized hotspot events
 */
export async function loadHotspotsForWindow(years, months, onProgress = () => {}) {
  const tasks = [];
  for (const y of years) {
    for (const m of months) {
      tasks.push({ year: y, month: m });
    }
  }

  let completed = 0;
  const results = await Promise.all(
    tasks.map(async ({ year, month }) => {
      const part = await loadHotspotPartition(year, month);
      completed++;
      onProgress(Math.round((completed / tasks.length) * 100));
      return part;
    })
  );

  return results.flat();
}

/**
 * Accessors for read-only database
 */
export function getDb() {
  return db;
}
export function getStations() {
  return db.stations;
}
export function getStationMonthDashboard() {
  return db.stationMonthDashboard;
}
export function getHrdiStationMonth() {
  return db.hrdiStationMonth;
}
export function getHiiProvinceMonth() {
  return db.hiiProvinceMonth;
}
export function getHotspotManifest() {
  return db.hotspotManifest;
}
export function getHotspotProvinceMonth() {
  return db.hotspotProvinceMonth;
}
export function getHotspotDistrictMonth() {
  return db.hotspotDistrictMonth;
}
export function getHotspotByElevation() {
  return db.hotspotByElevation;
}
export function getHotspotByLanduse() {
  return db.hotspotByLanduse;
}
export function getHotspotByProject() {
  return db.hotspotByProject;
}
