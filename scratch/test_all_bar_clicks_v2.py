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

# Scroll canvas into view first
cdp.eval_js("""
    const c = document.getElementById('overview-province-ranking-chart');
    if (c) c.scrollIntoView({ block: 'center' });
""")
time.sleep(0.6)

# Test each bar click
test_results = cdp.eval_js("""
(() => {
    const canvas = document.getElementById('overview-province-ranking-chart');
    const chart = Chart.getChart(canvas);
    const meta = chart.getDatasetMeta(0);
    const results = [];
    
    for (let i = 0; i < meta.data.length; i++) {
        // Reset province
        if (window.clearProvinceSelection) window.clearProvinceSelection();
        
        const bar = meta.data[i];
        const label = chart.data.labels[i];
        const expected = label.replace(/^[0-9]+\\.\\s*/, '').trim();
        
        const rect = canvas.getBoundingClientRect();
        const midX = (bar.base + bar.x) / 2;
        const midY = bar.y;
        
        // Dispatch real DOM click
        const clickEvent = new MouseEvent('click', {
            clientX: rect.left + midX,
            clientY: rect.top + midY,
            bubbles: true,
            cancelable: true,
            view: window
        });
        canvas.dispatchEvent(clickEvent);
        
        const provSelect = document.getElementById('filter-province');
        const selectedProv = provSelect ? provSelect.value : null;
        
        results.push({
            barIndex: i,
            label,
            expected,
            selected: selectedProv,
            pass: selectedProv === expected
        });
    }
    return results;
})()
""")

print("Bar Click Results:")
for r in test_results:
    status = "PASS" if r.get('pass') else "FAIL"
    print(f"[{status}] Bar {r.get('barIndex')}: {r.get('label')} -> Expected '{r.get('expected')}', Got '{r.get('selected')}'")

edge_proc.terminate()
