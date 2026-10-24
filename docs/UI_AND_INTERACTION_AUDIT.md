# UI & Interaction Audit Report (`docs/UI_AND_INTERACTION_AUDIT.md`)

**วันที่ตรวจสอบ:** 2026-10-24  
**โปรเจกต์:** Highland Climate & Hotspot Intelligence Dashboard (`project_DataViz_Highland`)  
**ขอบเขตการตรวจสอบ:** โครงสร้าง HTML, CSS, JavaScript Modules (`main.js`, `state.js`, `data-loader.js`, `filters.js`, `calculations.js`, `charts.js`, `maps.js`, `pages/*.js`), ข้อมูล JSON ใน `data/`, และ Asset ภาพพื้นหลัง

---

## 1. ส่วนที่มีอยู่แล้วและทำงานจริง (Working Components)

1. **ระบบโหลดข้อมูล (`js/data-loader.js`):**
   - โหลดไฟล์ JSON หลัก 11 ไฟล์ผ่าน `Promise.all` ได้แก่ `dashboard_config.json`, `stations.json`, `hrdi_station_month.json`, `station_month_dashboard.json`, `hii_province_month.json`, `hotspot_province_month.json`, `hotspot_district_month.json`, `hotspot_by_elevation.json`, `hotspot_by_landuse.json`, `hotspot_by_project.json`, `hotspot_manifest.json` และ `thailand_provinces.geojson`
   - มีระบบ Lazy-load และ `Map` Cache สำหรับพาร์ทิชันจุดความร้อนรายเดือน `data/hotspots/YYYY/MM.json` (24 ไฟล์ รวม 106,036 จุด)
2. **State Management พื้นฐาน (`js/state.js`):**
   - มี Pub/Sub (`subscribe`, `setState`, `resetState`, `getState`) ที่กระจาย Event ไปยังหน้าต่าง ๆ เมื่อค่าตัวกรองเปลี่ยน
3. **การคำนวณทางสถิติและข้อจำกัดข้อมูล (`js/calculations.js`):**
   - คำนวณ Pearson Correlation ($r$) พร้อม Linear Regression ย้อนหลัง (Descriptive) และ Sample Size $N$
   - คำนวณการเปรียบเทียบปีต่อปี (`calculateYoY`) โดยตรวจสอบคู่ข้อมูลที่มีอยู่จริง (`strictMatch`) และรักษาข้อจำกัดข้อมูล HRDI ปี 2023 ที่มีเฉพาะเดือนมกราคม–กันยายน (ไม่แทนค่าเดือนตุลาคม–ธันวาคมที่ขาดหายเป็น 0)
   - รักษาข้อจำกัดการไม่นำปริมาณฝน HRDI (ระดับสถานี) มาลบหรือคำนวณเปอร์เซ็นต์ผลต่างโดยตรงกับปริมาณฝน HII (ระดับจังหวัด)
4. **การแสดงผลกราฟและแผนที่พื้นฐาน (`js/charts.js`, `js/maps.js`):**
   - ใช้ Chart.js (พร้อมระบบ `destroyChart` ก่อนวาดใหม่) และ Leaflet + MarkerCluster + Leaflet.heat สำหรับแผนที่

---

## 2. ส่วนที่มี UI แต่ยังไม่มี Event Handler (UI Without Event Handlers)

1. **กราฟแนวโน้มรายเดือน (`overview-monthly-trend-chart`, `climate-time-series-chart`, `rainfall-dual-series-chart`, `hotspots-monthly-chart`):**
   - มีการแสดงกราฟเส้นและกราฟแท่งรายเดือน แต่ **ยังไม่มี `onClick` handler** สำหรับคลิกจุดข้อมูลเดือนเพื่อกรอง `selectedMonths` (Requirement E3)
2. **กราฟหมวดหมู่จุดความร้อน (`hotspots-landuse-chart`, `hotspots-elevation-chart`, `hotspots-project-chart`):**
   - แสดงกราฟ Doughnut และ Bar ของการใช้ประโยชน์ที่ดิน ระดับความสูง และพื้นที่โครงการ แต่ **ยังไม่มี `onClick` handler** บนชิ้นส่วนกราฟเพื่ออัปเดตตัวกรอง `landuse`, `hotspotElevation`, `hotspotProject` (Requirement E5)
3. **กราฟการกระจายตัว (`overview-distribution-chart`):**
   - แสดงกราฟแท่งเปรียบเทียบ Min/Mean/Max เฉลี่ย แต่คลิกเลือกจังหวัดจากกราฟไม่ได้ และยังไม่ได้แสดงค่าสถิติการกระจายตัวจริง (Min, Q1, Median, Q3, Max, $N$) (Requirement J)
4. **ปุ่มควบคุมแผนที่ (Map Reset View & Dynamic Choropleth Legend):**
   - แผนที่หลักในหน้า Overview (`#overview-map`) ยังไม่มีปุ่ม `Reset View` เฉพาะสำหรับคืนระดับการซูม (โดยไม่ล้างตัวกรอง) และยังไม่มี Choropleth Legend ที่แสดงช่วงค่าจริงและหน่วยวัดตามตัวชี้วัดที่เลือก (Requirement G & N)
5. **ตัวกรองแหล่งข้อมูลสถานีภูมิอากาศ (`Weather Source` / `source_type`):**
   - ในข้อมูลจริง `stations.json` และ `hrdi_station_month.json` มีฟิลด์ `source_type` แยกเป็น `OpenWeatherMap` (47 สถานี) และ `HRDI Weather Station` (3 สถานี) แต่ **ยังไม่มี Dropdown หรือปุ่มตัวกรอง `Weather Source` ใน UI และใน `state.js`** (Requirement D2)

---

## 3. ส่วนที่รับ Event แล้ว แต่ไม่อัปเดตข้อมูล หรืออัปเดตผิดพลาด (Broken / Incomplete Event Updates)

1. **บั๊ก Cascading State เมื่อคลิกเลือกสถานีหรืออำเภอข้ามจังหวัด (`js/state.js` บรรทัดที่ 62–72):**
   - ใน `setState(updates)` มีเงื่อนไข:
     ```javascript
     if (updates.province !== undefined && updates.province !== oldState.province) {
       nextState.district = null;
       nextState.tambon = null;
       nextState.stationId = null;
     }
     ```
   - เมื่อผู้ใช้คลิกเลือก Station Marker บนแผนที่ (`overview.js` หรือ `climate.js`) หรือคลิกกราฟอันดับอำเภอ (`hotspots.js`) ซึ่งส่ง `setState({ stationId: s.station_id, province: s.province })` หรือ `setState({ province: d.province, district: d.district })` หากจังหวัดเปลี่ยนไปจากเดิม ค่า `stationId` และ `district` ที่เพิ่งส่งเข้ามาจะถูกล้างเป็น `null` ทันที!
2. **การเปลี่ยนอำเภอหรือตำบลไม่ล้างสถานีที่ไม่ตรงเงื่อนไข (`js/state.js`):**
   - เมื่อเปลี่ยน `district` หรือ `tambon` ใน Dropdown ระบบไม่ได้ตรวจสอบและล้าง `stationId` ที่ไม่ได้อยู่ในอำเภอ/ตำบลนั้น และ `getAvailableStations(province, district)` ยังไม่ได้กรองตาม `tambon` และ `weatherSource`
3. **การคลิกซ้ำที่จังหวัดเดิมบนแผนที่หรือกราฟอันดับจังหวัด (`js/pages/overview.js`):**
   - เมื่อคลิกจังหวัดที่เลือกอยู่แล้วบนแผนที่ (`#overview-map`) ระบบตั้งค่าซ้ำเป็นจังหวัดเดิม ยังไม่รองรับการ Toggle ยกเลิกเพื่อกลับสู่ภาพรวม 9 จังหวัด (Requirement E1)
4. **บั๊กการแสดงค่าผลต่าง `0` เป็น `'N/A'` (`js/pages/overview.js` บรรทัดที่ 96, 111 และ `js/pages/climate.js`):**
   - ใช้เงื่อนไข `yoy.diff ? yoy.diff.toFixed(1) : 'N/A'` และ `yoy.pctChange ? ...` ซึ่งในภาษา JavaScript ค่า `0` เป็น Falsy ทำให้เมื่อผลต่างเป็น `0` ระบบแสดง `'N/A'` แทนที่จะเป็น `'0.0'` (Requirement F)

---

## 4. ส่วนที่อัปเดตแต่ใช้ Dataset หรือระดับการรวมข้อมูลผิด / กรองไม่ตรงกับ Global Filter

1. **บั๊กการกรองจุดความร้อนหลายมิติ (Multi-dimensional Hotspot Filtering Bug ใน `js/filters.js` และ `js/pages/hotspots.js`):**
   - ใน `getFilteredHotspotCount(state, targetYear)` ใช้โครงสร้าง `if (state.district) ... else if (state.hotspotElevation !== 'all') ... else if (state.landuse !== 'all') ... else if (state.hotspotProject !== 'all')` ซึ่งเป็นแบบ **Mutually Exclusive (เลือกทำเพียงเงื่อนไขแรกที่ตรง)**
   - ส่งผลให้เมื่อผู้ใช้เลือกตัวกรองร่วมกัน เช่น `ปี 2023 + เชียงใหม่ + มีนาคม + สูงกว่า 500 เมตร + ป่าอนุรักษ์` ยอด KPI จะคิดเฉพาะความสูงและมองข้ามการใช้ประโยชน์ที่ดิน!
   - ใน `js/pages/hotspots.js` กราฟรายเดือน (`renderHotspotTemporalChart`), กราฟการใช้ที่ดิน (`renderHotspotLanduseChart`), กราฟความสูง/โครงการ (`renderHotspotElevationAndProjectCharts`), และกราฟอันดับอำเภอ (`renderHotspotDistrictRanking`) ดึงข้อมูลจากตาราง Aggregate แยกกันโดยไม่นำตัวกรองหมวดอื่น (`district`, `tambon`, `hotspotElevation`, `landuse`, `hotspotProject`) มาคิดร่วมด้วย ทำให้ยอดรวมระหว่าง KPI, แผนที่จุดความร้อน และกราฟทั้ง 5 ในหน้า Hotspot Explorer ไม่ตรงกันเมื่อเปิดใช้หลายตัวกรองพร้อมกัน (ขัดต่อ Requirement E5 & E6)
2. **KPI การ์ดใบที่ 5 (จำนวนจังหวัดในขอบเขตข้อมูล - `js/pages/overview.js`):**
   - เดิมแสดงค่าคงที่ `state.province ? '1' : '9'` โดยไม่ได้คำนวณจำนวนจังหวัดที่มีข้อมูลจริงตามตัวกรอง เช่น เมื่อเลือก `Weather Source = HRDI Weather Station` มีสถานีตรวจวัดจริงเพียง 3 จังหวัด (เชียงใหม่, น่าน, พิษณุโลก) ไม่ใช่ 9 จังหวัด (Requirement F)
3. **กราฟแนวโน้มรายเดือนและกราฟอันดับจังหวัดในหน้า Overview เมื่อเลือกตัวชี้วัด `hotspots` (`js/pages/overview.js`):**
   - ยังไม่ได้กรองตาม `district`, `tambon`, `hotspotElevation`, `landuse`, `hotspotProject` เหมือนกับแผนที่จุดความร้อน
4. **กราฟการกระจายตัว (`overview-distribution-chart` ใน `js/pages/overview.js`):**
   - เดิมแสดงเฉพาะค่าเฉลี่ยของ `temp_min`, `temp`, `temp_max` ของปีเดียว (`state.yearMode === 'compare' ? 2022 : Number(state.yearMode)`) โดยไม่เปลี่ยนตามตัวชี้วัด (`climateMetric`) และไม่ได้คำนวณ Box Plot / Quartiles (Min, Q1, Median, Q3, Max, $N$) แยกตามจังหวัดหรือสถานีจริง (Requirement J)

---

## 5. ปัญหา Async Race Condition, Console Error และประสิทธิภาพ

1. **Async Race Condition ในการโหลดจุดความร้อนบนแผนที่ (`js/pages/hotspots.js`, `js/pages/overview.js`, `js/pages/correlation.js`):**
   - ฟังก์ชัน `renderHotspotsPointMap` และฟังก์ชันแผนที่ที่เป็น `async` เรียก `await loadHotspotsForWindow(...)` โดยไม่มีการตรวจสอบลำดับคำขอ (Render Request Token) หากผู้ใช้เปลี่ยนตัวกรองติดต่อกันอย่างรวดเร็ว (Test 12) คำขอเก่าที่โหลดเสร็จช้ากว่าอาจวาดทับผลลัพธ์ของตัวกรองใหม่
2. **การปรับขนาดแผนที่เมื่อสลับแท็บ (`Leaflet.invalidateSize`):**
   - ใน `js/main.js` เรียก `renderCurrentPage()` เฉพาะแท็บที่เปิดอยู่ แต่เมื่อสลับแท็บกลับมา ต้องเรียก `map.invalidateSize()` อย่างทั่วถึงสำหรับทุกอินสแตนซ์ของแผนที่ในหน้านั้น ๆ เพื่อป้องกันปัญหาแผ่นแผนที่แสดงไม่เต็มกรอบ

---

## 6. ความแตกต่างจากภาพอ้างอิง (Visual & Layout Discrepancies)

1. **ปัญหาภาพพื้นหลัง `assets/hero_landscape.jpg` มี UI และข้อความติดอยู่ในภาพ (Baked-in Screenshot Artifacts):**
   - ไฟล์ `assets/hero_landscape.jpg` ปัจจุบันเป็นภาพตัดจาก Screenshot ของ Dashboard ที่มีโลโก้ ชื่อหัวข้อ และปุ่มแท็บทั้ง 5 (`Q1 ภาพรวมพื้นที่ศึกษา` ... `Q5 คุณภาพข้อมูล`) ติดอยู่ในเนื้อไฟล์รูปภาพ! เมื่อนำไปตั้งเป็น `background` ของ `body` ทำให้เห็นปุ่มและตัวหนังสือซ้อนอยู่ด้านหลังการ์ด HTML ขัดต่อข้อกำหนด C3 (*"ห้ามนำกราฟ แผนที่ หรือข้อความที่อยู่ในภาพ Screenshot ไปใช้เป็นภาพพื้นหลัง"*)
   - **แนวทางแก้ไข:** สร้าง/แยก Asset ภาพพื้นหลังภูเขา ป่าสน หมอก ฝน และแสงไฟป่าระยะไกลที่สะอาด ไม่มีข้อความหรือกรอบ UI ใด ๆ ติดอยู่ในภาพ (`assets/hero_forest_bg.svg` / Clean Landscape Background)
2. **โทนสีและการ์ด (Theme & Design Tokens):**
   - โค้ดเดิมใช้การ์ดสีกรมท่าเข้ม (`rgba(16, 29, 45, 0.76)`) และตัวหนังสือสีขาวทั้งหน้า
   - ภาพอ้างอิงและข้อกำหนด C1–C2 กำหนดให้ใช้ **Cinematic Northern Thailand Forest + Frosted Ice Blue Glass Dashboard**:
     - พื้นหลังส่วนบนเป็นภาพป่าเขาและหมอกโทนเข้มเพื่อให้ข้อความ Header สีขาวอ่านชัด
     - การ์ดทั้งหมดใช้กระจกฝ้าสีฟ้าอ่อนโปร่งแสง (`--glass-background: rgba(221, 244, 253, 0.84)`, `--glass-background-strong: rgba(235, 248, 254, 0.91)`) ขอบสว่าง (`--glass-border: rgba(255, 255, 255, 0.75)`)
     - ตัวหนังสือในการ์ดใช้สีน้ำเงินเข้มอ่านง่าย (`--text-main: #173A55`, `--text-secondary: #43627A`)
     - ปุ่มที่เลือก (Active) ใช้สีฟ้าเทอร์ควอยซ์ (`--active-cyan: #0B96B5`, `--bright-cyan: #19C5D8`)
3. **การจัดวาง Navigation Tabs ทั้ง 5 แท็บ:**
   - ต้องแสดง 5 แท็บแนวนอนตามภาพอ้างอิง:
     - `Q1 — ภาพรวมพื้นที่ศึกษา` (ลักษณะภูมิอากาศและตัวชี้วัดสำคัญ)
     - `Q2 — แนวโน้มและฤดูกาล` (การเปลี่ยนแปลงรายเดือนและตามฤดูกาล + วิเคราะห์ปริมาณฝนตามฤดูกาล)
     - `Q3 — จุดความร้อน` (การกระจายตัวและแนวโน้ม)
     - `Q4 — ความสัมพันธ์ระหว่างข้อมูล` (การวิเคราะห์ความสัมพันธ์ + เปรียบเทียบข้อมูลฝน HRDI และ HII)
     - `Q5 — คุณภาพข้อมูล` (ความครบถ้วน วิธีวัด ข้อจำกัด และแหล่งอ้างอิงจากชุดข้อมูลจริง โดยครบทุกคำถาม Q1–Q9)
4. **การจัดวาง Main Analytics Grid บนหน้า Q1 (Desktop 1440–1536px):**
   - แถว KPI Cards จำนวน 5 ใบเรียงใน 1 แถว
   - พื้นที่หลักแบ่งเป็นฝั่งซ้ายประมาณ 44% สำหรับแผนที่ประเทศไทย 77 จังหวัด (เน้น 9 จังหวัดศึกษา) ความสูงเต็มคอลัมน์ และฝั่งขวาประมาณ 56% แบ่งเป็นกราฟแนวโน้มรายเดือนด้านบน และกราฟอันดับจังหวัดคู่กับกราฟการกระจายตัว (Box Plot) ด้านล่าง

---

## 7. ความเข้ากันได้ระหว่างตัวกรองกับชุดข้อมูล (Filter × Dataset Compatibility Summary)

| ตัวกรอง (Filter) | HRDI Climate (`hrdi_station_month.json`, `stations.json`) | HII Rainfall (`hii_province_month.json`) | VIIRS Hotspots (`hotspots/YYYY/MM.json` & Aggregate JSONs) |
|---|---|---|---|
| **Year (`2022`, `2023`, `compare`)** | รองรับ (ปี 2023 มีข้อมูล ม.ค.–ก.ย.) | รองรับครบทั้ง 12 เดือน (2022–2023) | รองรับครบทั้ง 12 เดือน (2022–2023) |
| **Month (`selectedMonths`)** | รองรับรายเดือน | รองรับรายเดือน | รองรับรายเดือน |
| **Province (`province`)** | รองรับ (9 จังหวัดศึกษา) | รองรับ (9 จังหวัดศึกษา) | รองรับ (9 จังหวัดศึกษา) |
| **District (`district`)** | รองรับ (กรองสถานีที่ตั้งอยู่ในอำเภอนั้น) | **ไม่รองรับ** (ข้อมูลระดับจังหวัดเท่านั้น — แสดงป้ายแจ้งเตือนชัดเจน) | รองรับ (ครบทุกอำเภอที่มีจุดความร้อน) |
| **Tambon (`tambon`)** | รองรับ (กรองสถานีที่ตั้งอยู่ในตำบลนั้น) | **ไม่รองรับ** (ข้อมูลระดับจังหวัดเท่านั้น) | รองรับ (ใช้ข้อมูล Event-level `tambon`) |
| **Station (`stationId`)** | รองรับโดยตรง (50 สถานี) | **ไม่รองรับ** (อ้างอิงค่าเฉลี่ยระดับจังหวัดของสถานีนั้นพร้อมป้ายกำกับ) | รองรับผ่าน `hotspots_10km` (รัศมี 10 กม. รอบสถานีใน `station_month_dashboard.json`) |
| **Weather Source (`source_type`)** | รองรับโดยตรง (`OpenWeatherMap` 47 สถานี, `HRDI Weather Station` 3 สถานี) | **ไม่รองรับ** (เป็นข้อมูลจากสถาบันสารสนเทศทรัพยากรน้ำ HII) | **ไม่รองรับ** (เป็นข้อมูลดาวเทียม NASA VIIRS) |
| **Hotspot Categories (`elevation`, `landuse`, `project`)** | **ไม่รองรับ** (เป็นมิติเฉพาะของจุดความร้อน) | **ไม่รองรับ** | รองรับครบทุกมิติแบบ `AND` ผ่าน Event-level Query Layer |
