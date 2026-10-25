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

diag = cdp.eval_js("""
(() => {
    const canvas = document.getElementById('overview-province-ranking-chart');
    const chart = Chart.getChart(canvas);
    const meta = chart.getDatasetMeta(0);
    const bar0 = meta.data[0];
    
    // Test point right in the middle of Bar 0
    const x = (bar0.base + bar0.x) / 2;
    const y = bar0.y;
    
    // Simulate what chart.options.onClick receives
    const syntheticChartEvent = { type: 'click', chart, native: null, x, y };
    
    let res1, res2, res3, res4, err1, err2, err3, err4;
    try {
        res1 = chart.getElementsAtEventForMode(syntheticChartEvent, 'nearest', { intersect: true }, false);
    } catch(e) { err1 = e.message; }
    try {
        res2 = chart.getElementsAtEventForMode(syntheticChartEvent, 'nearest', { intersect: true, axis: 'y' }, false);
    } catch(e) { err2 = e.message; }
    try {
        res3 = chart.getElementsAtEventForMode(syntheticChartEvent, 'index', { intersect: false, axis: 'y' }, false);
    } catch(e) { err3 = e.message; }
    try {
        res4 = chart.getElementsAtEventForMode(syntheticChartEvent, 'nearest', { intersect: false, axis: 'y' }, false);
    } catch(e) { err4 = e.message; }

    return {
        bar0: { x: bar0.x, y: bar0.y, base: bar0.base, width: bar0.width, height: bar0.height },
        testPoint: { x, y },
        res1: (res1 || []).map(el => ({ datasetIndex: el.datasetIndex, index: el.index })),
        res2: (res2 || []).map(el => ({ datasetIndex: el.datasetIndex, index: el.index })),
        res3: (res3 || []).map(el => ({ datasetIndex: el.datasetIndex, index: el.index })),
        res4: (res4 || []).map(el => ({ datasetIndex: el.datasetIndex, index: el.index })),
        errs: { err1, err2, err3, err4 }
    };
})()
""")

print("Diagnosis:", json.dumps(diag, ensure_ascii=False, indent=2))
edge_proc.terminate()
