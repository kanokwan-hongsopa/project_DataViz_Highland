import os
import sys
import time
import json
import urllib.request
import subprocess
import socket

sys.stdout.reconfigure(encoding="utf-8")

EDGE_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
HTTP_PORT = 8080

def get_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]

cdp_port = get_free_port()
user_data_dir = os.path.join(os.environ.get("TEMP", "."), f"edge_click_test_{cdp_port}")

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

sys.path.append(r"C:\Users\kanok\.gemini\antigravity\brain\031b370b-b9cd-4aaf-8ca7-4cec88a8a4f0\scratch")
from run_all_22_tests import CDPClient

cdp = CDPClient(ws_url)
cdp.send("Page.enable")
cdp.send("Runtime.enable")

for _ in range(40):
    ready = cdp.eval_js("window.__appReady === true")
    if ready:
        break
    time.sleep(0.2)

# Scroll canvas into view
cdp.eval_js("""
    const c = document.getElementById('overview-province-ranking-chart');
    if (c) c.scrollIntoView({ block: 'center' });
""")
time.sleep(0.6)

# Instrument onClick to inspect everything
cdp.eval_js("""
(() => {
    window._lastClickDebug = null;
    const canvas = document.getElementById('overview-province-ranking-chart');
    const chart = Chart.getChart(canvas);
    const orig = chart.options.onClick;
    chart.options.onClick = (evt, els, c) => {
        window._lastClickDebug = {
            evtX: evt.x,
            evtY: evt.y,
            nativeClientX: evt.native?.clientX,
            nativeClientY: evt.native?.clientY,
            els: (els || []).map(e => ({ datasetIndex: e.datasetIndex, index: e.index })),
            labels: chart.data.labels,
            dataset0ProvinceKeys: chart.data.datasets[0].provinceKeys,
            dataset0Data: chart.data.datasets[0].data
        };
        if (orig) orig(evt, els, c);
    };
})()
""")

b = cdp.eval_js("""
(() => {
    const canvas = document.getElementById('overview-province-ranking-chart');
    const chart = Chart.getChart(canvas);
    const meta = chart.getDatasetMeta(0);
    const rect = canvas.getBoundingClientRect();
    const bar0 = meta.data[0];
    return {
        x: rect.left + (bar0.base + bar0.x) / 2,
        y: rect.top + bar0.y,
        bar0Y: bar0.y,
        bar0X: bar0.x,
        bar0Base: bar0.base,
        metaCount: meta.data.length,
        metaYs: meta.data.map(d => d.y)
    };
})()
""")

print("Bar 0 info:", b)

# Click bar 0 with CDP
cdp.send("Input.dispatchMouseEvent", {"type": "mouseMoved", "x": b["x"], "y": b["y"]})
time.sleep(0.05)
cdp.send("Input.dispatchMouseEvent", {"type": "mousePressed", "button": "left", "clickCount": 1, "x": b["x"], "y": b["y"]})
time.sleep(0.05)
cdp.send("Input.dispatchMouseEvent", {"type": "mouseReleased", "button": "left", "clickCount": 1, "x": b["x"], "y": b["y"]})
time.sleep(0.3)

debug_info = cdp.eval_js("window._lastClickDebug")
print("Click Debug Info:", json.dumps(debug_info, ensure_ascii=False, indent=2))

selected = cdp.eval_js("document.getElementById('filter-province')?.value || ''")
print("Selected Province:", selected)

edge_proc.terminate()
