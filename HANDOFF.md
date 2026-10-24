# HANDOFF — Implementation Specification for Antigravity

**Project:** Highland Climate & Hotspot Interactive Dashboard · **Years:** 2022–2023 ONLY · **Version:** 2.0 (2026-10-24)

> Read `BRD.md` first. This handoff specifies how to implement it against the **existing real JSON files**. Do not overwrite source data. Do not generate mock data. **Do not implement forecasting or future dashed prediction lines.**

## 0. Goal and working rules
Build a polished, responsive, GitHub Pages-compatible **HTML/CSS/JavaScript interactive dashboard** inspired by the user's visual reference (mountain/forest hero, airy blue/teal/green palette, top tabs, bento cards). It must be an analytical tool, not a static chart gallery. **Every relevant map/chart/KPI must respond to shared selections**, and selected province/year/month must persist across tabs.

Do not copy the peer project's source code, content, visual assets, or data. Use its general feature completeness as a benchmark only. No sidebar-heavy layout, no cleaning/audit/coverage page, no seasonal tab labels, no prediction/forecasting feature.

## 1. Inspect and preserve the real data first
Repo already has `data/` with JSON. Check each file and actual field types before implementation; do not assume a field exists because it is mentioned below. Preserve original JSON; derive any optimized indexes in a new `public` or `derived` folder if needed, with reproducible script and verification.

| File | Grain | Known fields / purpose |
|---|---|---|
| `data/dashboard_config.json` | config object | `years`, `provinces`, `station_count`, `notes`, `hotspot_manifest` |
| `data/stations.json` | 50 station records | `station_id`, `station_name`, `province`, `district`, `tambon`, `lat`, `lon`, `source_type` |
| `data/hrdi_station_month.json` | 977 observed station-month records | `station_id`, `year`, `month`, `station_name`, `province`, `district`, `tambon`, `lat`, `lon`, `source_type`, `temp`, `temp_min`, `temp_max`, `humidity`, `wind_speed`, `rainfall`, `rainday`, `date`, `data_present` |
| `data/hii_province_month.json` | 216 province-month records | `province`, `year`, `month`, `hii_min_rain`, `hii_max_rain`, `hii_avg_rain`, `hii_source_rows` |
| `data/station_month_dashboard.json` | 977 station-month records | HRDI fields plus `hii_avg_rain`, `hotspots_same_tambon`, `hotspots_within_10km`, `hotspots_within_10km_high_elev`, `hotspots_within_10km_project`, `hotspot_coverage_note` |
| `data/hotspot_province_month.json` | province-month aggregate | `province`, `year`, `month`, `count`, `high_elevation_500m`, `in_hrdi_project`, `frp_sum`, `frp_valid_count` |
| `data/hotspot_district_month.json` | district-month aggregate | `province`, `district`, `year`, `month`, `count` |
| `data/hotspot_by_elevation.json` | province-month-category aggregate | `province`, `year`, `month`, `elevation_category`, `count` |
| `data/hotspot_by_landuse.json` | province-month-category aggregate | `province`, `year`, `month`, `landuse`, `count` |
| `data/hotspot_by_project.json` | province-month-category aggregate | `province`, `year`, `month`, `project_category`, `count` |
| `data/hotspot_manifest.json` | manifest | `total_events`, `partitions` each with `year`, `month`, `path`, `count` |
| `data/hotspots/YYYY/MM.json` | hotspot event list | `hotspot_id`, `date`, `year`, `month`, `province`, `district`, `tambon`, `village`, `LATITUDE`, `LONGITUDE`, `FRP`, `Elev`, `high_elevation_500m`, `PROJECT`, `in_hrdi_project`, `LU_NAME`, `SATELLITE`, `CONFIDENCE` |

**Known checks from the supplied JSON ZIP:** 2022–2023; 9 provinces; 50 stations; 977 HRDI station-month observations; 216 HII province-month; 106,036 hotspot detections; manifest with 24 monthly partitions. Missing station-months are not synthetic zero records. `dashboard_config.json` may contain metadata notes; read it, but validate against actual data.

**Important:** Do not infer `LATITUDE`/`LONGITUDE` as `lat`/`lon` for hotspot events without mapping explicitly. Station IDs are composite strings, not integer IDs.

## 2. Recommended implementation
- Static website with modular JavaScript (ES modules) and CSS; no backend required. Chart.js for line/bar/scatter, Leaflet for station/hotspot markers and basemap, accessible custom controls; use a valid Thailand province GeoJSON if available and licensed, otherwise avoid fabricating polygons and use station-point map with province-selection controls until polygons are supplied.
- Serve via local HTTP (`python -m http.server 8000`) during development; `fetch()` will not work reliably under `file://`.
- Use relative asset paths compatible with GitHub Pages project subpaths. Do not use absolute `/data/...` root paths.
- Keep chart/map instances managed; destroy/update properly on tab/filter changes; debounce large updates.
- Lazy-load hotspot partitions only for selected year/month; use aggregate JSON for overview; cluster points, cap rendered markers or use canvas/heatmap for dense views. Do not discard records silently when summarizing.
- If using a third-party map tile server, document connectivity dependency and attribution. Handle offline/failed tile load gracefully.

## 3. App state — one shared source of truth
Suggested state:
```js
const state = {
  yearMode: 'compare', // '2022' | '2023' | 'compare'
  months: [1,2,3,4,5,6,7,8,9],
  province: null,
  district: null,
  tambon: null,
  stationId: null,
  metric: 'temp',
  hotspotElevation: 'all',
  hotspotProject: 'all',
  landuse: 'all'
};
```
These are UI state defaults, **not data values**. Default comparison months Jan–Sep for HRDI fairness; single-year mode may allow all available months. The state may be extended for specific tab controls. On changing province, clear district/tambon/station if invalid. Changing tab must not reset global filters. Any chart/map click dispatches state updates through a single filter function and re-renders all affected views. Show selected chips and `Reset all`.

**Filter scopes:** Year/month/province apply globally. District/tambon are available for hotspot data and HRDI stations with matching administrative labels; HII only has province granularity, so do not pretend HII can be filtered to district/tambon. When selecting a station, show station-specific climate, HII for its province with clear labeling, and nearby hotspots from the precomputed station-month file. Never replace missing station climate with a province mean.

## 4. UI structure — 5 top tabs, 9 analytical questions
**Header:** mountain/highland imagery or original CSS illustration, project title, 2022–2023 subtitle, small data-source credit. Avoid copying peer image/assets.

**Global filter bar:** Year segmented `2022 | 2023 | Compare`, month range/multi-select, province, district, tambon, station; secondary context-specific metric filters; selection breadcrumb and reset. Responsive layout, not a permanent bulky sidebar.

### Tab 1 — Overview (Q1/Q5/Q9)
- KPI: stations represented, observed climate records, avg temperature (weighted explicitly by available station-month records), total hotspot detections (event counts, not fire incidents), province coverage; KPI should change under shared filters.
- Interactive 9-province map (if real geometry available) + 50 station markers. Click province to filter all linked views; click station to open detail panel and filter station climate.
- Monthly climate and hotspot trends, province ranking; comparison mode offers paired-year views and difference indicators.

### Tab 2 — Highland Climate (Q1/Q2)
- Time-series for `temp`, `temp_min`, `temp_max`, `rainfall`, `humidity`, `wind_speed`, switchable metric and station.
- Compare selected stations; ranking; station × month heatmap.
- Two-year overlay uses same months and station-month pairs for valid comparisons; report N used. For rainfall, distinguish monthly station rainfall vs aggregation across stations. For missing data, show gaps not zeroes.
- **No forecasting, no future projections, no extrapolated dashed lines.** Historical lines end at last observed month.

### Tab 3 — Rainfall Comparison (Q3/Q4)
- Show HRDI station rainfall and HII province rainfall as clearly labeled monthly series. Selecting a station retains its HII province context. Multiple stations: document aggregation (e.g., mean of available station-month rainfall), and number of stations used.
- For quantitative difference ranking, add `rainfallComparable` config gate **default false**. Only enable numeric subtraction / percent difference / ranking when source metadata confirms comparable units, measurement periods, and aggregation semantics. If not confirmed, show side-by-side trend comparison and explicit note; never fabricate verification.
- In compare mode, same months and station IDs for HRDI year-over-year; HII can compare province-month pairs.

### Tab 4 — Hotspot Explorer (Q5)
- Hotspot map with filters year/month, province→district→tambon, `high_elevation_500m`, `in_hrdi_project`, `LU_NAME`.
- Tooltips: actual date, province/district/tambon, `FRP` when available, elevation, project category, land use, satellite/confidence when present.
- Monthly hotspot counts, district ranking, land-use/elevation/project category distributions. When filters go below province or include detailed category combinations, use **raw partition events** or a correctly derived joint aggregate, not a province-only aggregate that ignores filters.
- Display 'รายการตรวจพบจุดความร้อนจากดาวเทียม' and avoid 'จำนวนครั้งที่เกิดไฟป่า'.

### Tab 5 — Climate × Hotspot (Q6/Q7/Q8)
- Station-month scatterplots: `rainfall` vs `hotspots_within_10km`, `temp` vs count, `humidity` vs count; tooltip station/month/year and observation count.
- Option to switch local count method: within 10 km vs same tambon, with definition displayed.
- Exploratory lag analysis: only consecutive calendar months for **same station**, with observed data and local hotspot counts, no gap bridging. Lag comparison is not a forecast.
- Correlation coefficients only for sufficient non-null observations; show N and avoid causal claims.
- Do not sum station-buffer hotspot counts to get unique provincial hotspot counts: overlapping 10 km buffers can count the same event more than once.

## 5. Year-over-year (YoY) contract
- Three modes: 2022, 2023, compare.
- **Fair time window:** both years use identical selected months; default Jan–Sep for HRDI because 2023 has incomplete later observations. User can select other months, but if no paired station data, display `ไม่มีข้อมูลที่เปรียบเทียบได้`.
- **Paired HRDI:** build keys `station_id + month`; use intersection of observed non-null values for selected metric across 2022/2023; compute averages on paired keys. Do not compare different station populations. Show number of pairs.
- **HII:** pair `province + month` for each year.
- **Hotspots:** count unique event records from manifest partitions within identical selected months and geographic/category filters; preserve event definition; optional difference and percentage when 2022 base >0.
- Delta = value2023 − value2022; percent = delta/value2022×100 if base !=0, else N/A. For rainfall, only show physically interpreted cross-source difference if metadata verified; YoY within each source can be calculated with proper paired windows.
- If no comparable observations, show `N/A` and reason; do not show 0 or invent a trend.

## 6. Analytical calculation contracts
- `temp`, `humidity`, `wind_speed`: arithmetic mean over non-null observed station-months under filters; label sample size; distinguish averages of observations vs station-weighted means when necessary.
- `rainfall`: station monthly values; when combining stations, use explicitly labeled **mean monthly rainfall across reporting stations** rather than sum of stations; do not call it provincial total.
- `hii_avg_rain`: use province-month values at provincial granularity; do not multiply by number of stations.
- `hotspot`: count detection records, not fires; province-month summaries may be summed across disjoint months/provinces, but **do not sum category totals together** or station buffer counts.
- `FRP`: preserve original measurement and missing values; never infer fire size/severity directly without validated definition.
- `missing`: `null`/undefined/NaN excluded from numeric aggregations; valid zero is retained; missing month is absent rather than 0.
- `Pearson r`: calculate on non-null matched station-month pairs with sufficient sample and nonzero variance; show sample size; label exploratory, not causal.
- `lag`: sort by station/year/month as calendar date; match prior month using real calendar adjacency, including Dec→Jan where both months observed, and report pairs.

## 7. Interaction acceptance scenarios (manual E2E)
1. Open Overview, click Chiang Mai province polygon or province selector → province label/chip appears, station markers, all supported KPIs, charts and hotspot summary update. Clear selection restores 9-province view.
2. Click a station marker → station detail opens; HRDI plots show only station, HII plots show its province **clearly labeled**, and nearby hotspot counts reflect the station buffer.
3. Select `2023` then March → all tabs retain 2023/March when navigating.
4. Select `Compare` Jan–Sep → two-year line series and YoY delta appear; HRDI station-month comparisons only on matched pairs, with N; switch to Oct–Dec and see N/A if no HRDI pairs.
5. Select hotspot `high_elevation_500m=true` + district → event map and counts both reflect intersection of filters (not province totals).
6. Click district bar → map zoom/highlight if geometry/coordinates support it; detail controls and charts update; selecting unsupported geographic grain shows clear granularity note.
7. Select a province/tambon without HRDI station → no fabricated climate values; hotspot charts may still show records.
8. No forecast line, prediction card, or prediction tab anywhere.
9. No audit/cleaning/coverage tab; source limitations can appear in chart notes.
10. Load with `python -m http.server 8000`, check browser console for errors, verify relative paths when deployed to GitHub Pages.

## 8. Performance, quality, and security
- Read small aggregates first; defer raw hotspots until map detail is requested. Cache partitions keyed by `year-month` and avoid repeated downloads.
- Verify totals: HRDI 977, HII 216, stations 50, hotspot manifest total 106036; compare sum of partition counts to manifest total and event counts.
- Avoid embedding 100k point objects in HTML or constructing 100k DOM markers. Prefer cluster/canvas layer, viewport rendering, and loading indicators.
- Escape untrusted strings in tooltips; do not use unescaped `innerHTML` with data values.
- Provide visible empty/error states and fallback if external map tiles/GeoJSON fail.
- Mobile layout and accessible contrast; charts with readable Thai fonts.
- Do not add a runtime dependency requiring private API keys or a paid service without user approval.

## 9. Suggested file structure
```text
project_DataViz_Highland/
├── data/                       # EXISTING JSON — preserve
│   ├── hotspots/2022/...
│   ├── hotspots/2023/...
│   ├── stations.json
│   ├── hrdi_station_month.json
│   ├── hii_province_month.json
│   ├── station_month_dashboard.json
│   └── ...
├── index.html
├── css/styles.css
├── js/
│   ├── main.js
│   ├── state.js
│   ├── data-loader.js
│   ├── filters.js
│   ├── calculations.js
│   ├── maps.js
│   ├── charts.js
│   └── pages.js
├── BRD.md
├── HANDOFF.md
└── README.md
```
Structure is a recommendation; may change if there is a good technical reason, but keep paths consistent and document it.

## 10. Delivery sequence for Antigravity
1. **Inspect repo and read both MD files and actual JSON**. Write `README.md` project overview and `PROJECT_STATUS.md` progress log; make an initial Git commit only after checking git branch/status and without overwriting existing files.
2. Implement JSON loader, schema validation, shared state, derived calculations, and test fixtures using **real JSON** (no mock datasets).
3. Build UI shell and global filters; wire shared selection and tab persistence.
4. Build Overview map/KPIs and validate click-to-filter.
5. Implement Climate and Rainfall tabs, paired YoY calculations, missing-data handling.
6. Implement Hotspot Explorer with lazy monthly partition loading and all hotspot filters.
7. Implement Climate × Hotspot and lagged exploratory views.
8. Test E2E interactions, performance, responsive UI, GitHub Pages deployment; update status/README.
9. At each completed stage, report what changed and validation results. **Do not automatically push to remote without explicit user approval**; make local commits only when authorized by the user's workflow.

## 11. Hard prohibitions
- NO forecasts, no future trend extension, no predictive models, no projected dashed lines.
- NO fabricated numbers, fake hotspot coordinates, simulated stations, hard-coded KPI answers, or substitute datasets.
- NO copied peer project's proprietary code/assets/data.
- NO missing→0 imputation or silently dropped observations.
- NO claim that satellite hotspot detections equal verified forest fires.
- NO quantitative HRDI−HII rainfall-difference claims until comparability metadata is validated.
- NO cleaning, ETL, audit, or coverage page in the user-facing dashboard.

**Success definition:** A working, beautiful, responsive, interactive analytical website where selecting a province/year/month/station updates every relevant view consistently, answers Q1–Q9 using the real 2022–2023 JSON, and never shows forecast output.
