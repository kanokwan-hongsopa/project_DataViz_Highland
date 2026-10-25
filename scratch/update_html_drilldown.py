import sys
sys.stdout.reconfigure(encoding="utf-8")

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Overview Map Header
target_map = '''                  <span>แสดงสถานีตรวจวัด</span>
                </button>
              </div>'''
repl_map = '''                  <span>แสดงสถานีตรวจวัด</span>
                </button>
                <div id="overview-map-drilldown-bar" class="drilldown-action-bar"></div>
              </div>'''
if target_map in content:
    content = content.replace(target_map, repl_map, 1)
    print("1. Map header updated")

# 2. Overview Ranking Header
target_rank = '''                <button type="button" class="btn-toggle active" id="btn-province-rank-desc" data-sort="desc">มากไปน้อย (สูงสุด)</button>
                <button type="button" class="btn-toggle" id="btn-province-rank-asc" data-sort="asc">น้อยไปมาก (ต่ำสุด)</button>
              </div>
            </div>'''
repl_rank = '''                <button type="button" class="btn-toggle active" id="btn-province-rank-desc" data-sort="desc">มากไปน้อย (สูงสุด)</button>
                <button type="button" class="btn-toggle" id="btn-province-rank-asc" data-sort="asc">น้อยไปมาก (ต่ำสุด)</button>
              </div>
              <div id="overview-ranking-drilldown-bar" class="drilldown-action-bar"></div>
            </div>'''
if target_rank in content:
    content = content.replace(target_rank, repl_rank, 1)
    print("2. Ranking header updated")

# 3. Overview Distribution Header + Single Stat Banner
target_dist = '''              <div id="pop-dist-q1" class="info-popover-box" role="tooltip">
                <strong>การกระจายตัวแบบ Box Plot (Q2):</strong> กล่องแสดงช่วงควอไทล์ที่ 1 ถึง 3 (Q1–Q3) เส้นขวางคือค่ามัธยฐาน (Median) จุดกลมคือค่าเฉลี่ย (Mean) และเส้นหนวดคือค่าต่ำสุด–สูงสุด (Min–Max)
              </div>
            </div>
          </div>
          <div class="chart-box-xl">'''
repl_dist = '''              <div id="pop-dist-q1" class="info-popover-box" role="tooltip">
                <strong>การกระจายตัวแบบ Box Plot (Q2):</strong> กล่องแสดงช่วงควอไทล์ที่ 1 ถึง 3 (Q1–Q3) เส้นขวางคือค่ามัธยฐาน (Median) จุดกลมคือค่าเฉลี่ย (Mean) และเส้นหนวดคือค่าต่ำสุด–สูงสุด (Min–Max)
              </div>
            </div>
            <div id="overview-dist-drilldown-bar" class="drilldown-action-bar"></div>
          </div>
          <div id="overview-dist-single-stat-banner" class="single-group-box-banner" style="display: none;"></div>
          <div class="chart-box-xl">'''
if target_dist in content:
    content = content.replace(target_dist, repl_dist, 1)
    print("3. Distribution header + banner updated")

# 4. Climate Station Ranking Header
target_clim = '''              <div id="pop-q2-station" class="info-popover-box" role="tooltip">
                <strong>เปรียบเทียบรายสถานี (Q2):</strong> คำนวณค่าเฉลี่ยจากข้อมูลรายเดือนของแต่ละสถานีภายใต้ช่วงเวลาและตัวกรองที่เลือก
              </div>
            </div>
          </div>'''
repl_clim = '''              <div id="pop-q2-station" class="info-popover-box" role="tooltip">
                <strong>เปรียบเทียบรายสถานี (Q2):</strong> คำนวณค่าเฉลี่ยจากข้อมูลรายเดือนของแต่ละสถานีภายใต้ช่วงเวลาและตัวกรองที่เลือก
              </div>
            </div>
            <div id="climate-ranking-drilldown-bar" class="drilldown-action-bar"></div>
          </div>'''
if target_clim in content:
    content = content.replace(target_clim, repl_clim, 1)
    print("4. Climate ranking header updated")

# 5. Hotspot District Ranking Header
target_hs = '''                <button type="button" class="btn-toggle active" id="btn-district-rank-desc" data-sort="desc">มากไปน้อย</button>
                <button type="button" class="btn-toggle" id="btn-district-rank-asc" data-sort="asc">น้อยไปมาก</button>
              </div>
            </div>'''
repl_hs = '''                <button type="button" class="btn-toggle active" id="btn-district-rank-desc" data-sort="desc">มากไปน้อย</button>
                <button type="button" class="btn-toggle" id="btn-district-rank-asc" data-sort="asc">น้อยไปมาก</button>
              </div>
              <div id="hotspots-district-drilldown-bar" class="drilldown-action-bar"></div>
            </div>'''
if target_hs in content:
    content = content.replace(target_hs, repl_hs, 1)
    print("5. Hotspot district header updated")

# 6. Q6 Scatter Header
target_scat = '''              <span id="q6-r-badge" class="scope-info-pill">—</span>
            </div>'''
repl_scat = '''              <span id="q6-r-badge" class="scope-info-pill">—</span>
              <div id="q6-scatter-drilldown-bar" class="drilldown-action-bar"></div>
            </div>'''
if target_scat in content:
    content = content.replace(target_scat, repl_scat, 1)
    print("6. Q6 scatter header updated")

# 7. Low Rain Explorer Header
target_low = '''                <button type="button" class="btn-toggle active" id="btn-thresh-median" data-threshold="median">เกณฑ์มัธยฐาน (≤ Median ฝน, ≥ Median จุด)</button>
                <button type="button" class="btn-toggle" id="btn-thresh-quartile" data-threshold="quartile">เกณฑ์ควอไทล์ (≤ Q1 ฝน, ≥ Q3 จุด)</button>
              </div>
            </div>'''
repl_low = '''                <button type="button" class="btn-toggle active" id="btn-thresh-median" data-threshold="median">เกณฑ์มัธยฐาน (≤ Median ฝน, ≥ Median จุด)</button>
                <button type="button" class="btn-toggle" id="btn-thresh-quartile" data-threshold="quartile">เกณฑ์ควอไทล์ (≤ Q1 ฝน, ≥ Q3 จุด)</button>
              </div>
              <div id="low-rain-drilldown-bar" class="drilldown-action-bar"></div>
            </div>'''
if target_low in content:
    content = content.replace(target_low, repl_low, 1)
    print("7. Low rain explorer header updated")

# 8. Cross Dataset Rainfall Header
target_rc = '''            <div class="rainfall-dual-kpi-pills">'''
repl_rc = '''            <div id="rainfall-comp-drilldown-bar" class="drilldown-action-bar" style="margin-bottom: 0.5rem;"></div>
            <div class="rainfall-dual-kpi-pills">'''
if target_rc in content:
    content = content.replace(target_rc, repl_rc, 1)
    print("8. Rainfall comp header updated")

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)
print("index.html write complete!")
