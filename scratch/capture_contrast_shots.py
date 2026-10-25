import os
import sys
import time
import base64
import json
import urllib.request
import subprocess
import socket

sys.stdout.reconfigure(encoding="utf-8")

WORKSPACE = r"c:\Users\kanok\OneDrive\เอกสาร\project_DataViz_Highland"
EDGE_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
ARTIFACT_DIR = r"C:\Users\kanok\.gemini\antigravity\brain\031b370b-b9cd-4aaf-8ca7-4cec88a8a4f0"

def get_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]

HTTP_PORT = 8080
cdp_port = get_free_port()
user_data_dir = os.path.join(os.environ.get("TEMP", "."), f"edge_shot_{cdp_port}")

edge_proc = subprocess.Popen(
    [
        EDGE_PATH,
        "--headless=new",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        "--window-size=1536,960",
        f"--remote-debugging-port={cdp_port}",
        "--remote-allow-origins=*",
        f"--user-data-dir={user_data_dir}",
        f"http://127.0.0.1:{HTTP_PORT}/index.html",
    ],
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,
)

time.sleep(2)

ws_url = None
for _ in range(30):
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{cdp_port}/json") as resp:
            targets = json.loads(resp.read().decode())
            for t in targets:
                if t.get("type") == "page" and "index.html" in t.get("url", ""):
                    ws_url = t.get("webSocketDebuggerUrl")
                    break
        if ws_url:
            break
    except Exception:
        pass
    time.sleep(0.3)

if not ws_url:
    print("Could not find WebSocket URL")
    edge_proc.terminate()
    sys.exit(1)

sys.path.append(r"C:\Users\kanok\.gemini\antigravity\brain\031b370b-b9cd-4aaf-8ca7-4cec88a8a4f0\scratch")
from run_all_22_tests import CDPClient

cdp = CDPClient(ws_url)
cdp.send("Page.enable")
cdp.send("Runtime.enable")

# Wait for app ready
for _ in range(40):
    ready = cdp.eval_js("window.__appReady === true")
    if ready:
        break
    time.sleep(0.2)

cdp.eval_js("window.finishAllKpiAnimations && window.finishAllKpiAnimations()")
time.sleep(0.5)

def capture_screen(filename, clip=None):
    params = {"format": "png"}
    if clip:
        params["clip"] = clip
    res = cdp.send("Page.captureScreenshot", params)
    data = res.get("data")
    if data:
        out_path = os.path.join(ARTIFACT_DIR, filename)
        with open(out_path, "wb") as f:
            f.write(base64.b64decode(data))
        print(f"Saved: {filename} ({len(data)} bytes)")
    else:
        print(f"Failed to get data for {filename}: {res.keys()}")

# 1. Capture Q1 Overview top area (KPIs & Bento Grid charts)
capture_screen("screenshot_contrast_q1_overview.png")

# 2. Scroll to highlights and capture
cdp.eval_js("""
    const hl = document.getElementById('highlights-section');
    if (hl) hl.scrollIntoView();
""")
time.sleep(0.6)
capture_screen("screenshot_contrast_highlights.png")

# 3. Hover over monthly trend chart to capture crisp dark tooltip
cdp.eval_js("""
    const canvas = document.getElementById('overview-monthly-trend-chart');
    if (canvas) {
        canvas.scrollIntoView();
        const chart = Chart.getChart(canvas);
        if (chart) {
            chart.tooltip.setActiveElements([{ datasetIndex: 0, index: 3 }], { x: 0, y: 0 });
            chart.update();
        }
    }
""")
time.sleep(0.6)
capture_screen("screenshot_contrast_tooltip.png")

# 4. Switch to Q2 Climate
cdp.eval_js("document.querySelector('.nav-tab-btn[data-tab=\"climate\"]').click()")
time.sleep(0.6)
cdp.eval_js("window.scrollTo(0, 0)")
time.sleep(0.4)
capture_screen("screenshot_contrast_q2_climate.png")

# 5. Switch to Q3 Hotspots
cdp.eval_js("document.querySelector('.nav-tab-btn[data-tab=\"hotspots\"]').click()")
time.sleep(0.6)
cdp.eval_js("window.scrollTo(0, 0)")
time.sleep(0.4)
capture_screen("screenshot_contrast_q3_hotspots.png")

# 6. Switch to Q4 Correlation
cdp.eval_js("document.querySelector('.nav-tab-btn[data-tab=\"correlation\"]').click()")
time.sleep(0.6)
cdp.eval_js("window.scrollTo(0, 0)")
time.sleep(0.4)
capture_screen("screenshot_contrast_q4_correlation.png")

# 7. Switch to Q5 Quality
cdp.eval_js("document.querySelector('.nav-tab-btn[data-tab=\"rainfall\"]').click()")
time.sleep(0.6)
cdp.eval_js("window.scrollTo(0, 0)")
time.sleep(0.4)
capture_screen("screenshot_contrast_q5_quality.png")

print("All screenshots successfully captured!")
edge_proc.terminate()
