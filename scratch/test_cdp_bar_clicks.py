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

# Scroll canvas into view instantly
cdp.eval_js("""
    const c = document.getElementById('overview-province-ranking-chart');
    if (c) c.scrollIntoView({ behavior: 'instant', block: 'center' });
""")
time.sleep(0.5)

bars_info = cdp.eval_js("""
(() => {
    const canvas = document.getElementById('overview-province-ranking-chart');
    const chart = Chart.getChart(canvas);
    const meta = chart.getDatasetMeta(0);
    const rect = canvas.getBoundingClientRect();
    return meta.data.map((bar, i) => {
        const midX = (bar.base + bar.x) / 2;
        const midY = bar.y;
        return {
            index: i,
            label: chart.data.labels[i],
            expected: chart.data.labels[i].replace(/^[0-9]+\\.\\s*/, '').trim(),
            x: rect.left + midX * (rect.width / canvas.width),
            y: rect.top + midY * (rect.height / canvas.height)
        };
    });
})()
""")

print("Testing 9 bars with real CDP Mouse Clicks...")
results = []
for b in bars_info:
    # Clear province first
    cdp.eval_js("if (window.clearProvinceSelection) window.clearProvinceSelection();")
    time.sleep(0.2)
    
    # Real CDP Mouse Click on Bar
    cdp.send("Input.dispatchMouseEvent", {"type": "mouseMoved", "x": b["x"], "y": b["y"]})
    time.sleep(0.05)
    cdp.send("Input.dispatchMouseEvent", {"type": "mousePressed", "button": "left", "clickCount": 1, "x": b["x"], "y": b["y"]})
    time.sleep(0.05)
    cdp.send("Input.dispatchMouseEvent", {"type": "mouseReleased", "button": "left", "clickCount": 1, "x": b["x"], "y": b["y"]})
    time.sleep(0.3)
    
    selected_prov = cdp.eval_js("document.getElementById('filter-province')?.value || ''")
    is_pass = (selected_prov == b["expected"])
    results.append({
        "bar": b["index"],
        "label": b["label"],
        "expected": b["expected"],
        "selected": selected_prov,
        "pass": is_pass
    })
    status = "PASS" if is_pass else "FAIL"
    print(f"[{status}] Bar {b['index']} ({b['label']}): Expected '{b['expected']}', Got '{selected_prov}'")

# Test clicking empty space (far right of canvas)
cdp.eval_js("if (window.clearProvinceSelection) window.clearProvinceSelection();")
time.sleep(0.2)
empty_x = bars_info[0]["x"] + 300
empty_y = bars_info[8]["y"] + 35
cdp.send("Input.dispatchMouseEvent", {"type": "mouseMoved", "x": empty_x, "y": empty_y})
cdp.send("Input.dispatchMouseEvent", {"type": "mousePressed", "button": "left", "clickCount": 1, "x": empty_x, "y": empty_y})
cdp.send("Input.dispatchMouseEvent", {"type": "mouseReleased", "button": "left", "clickCount": 1, "x": empty_x, "y": empty_y})
time.sleep(0.3)
prov_after_empty = cdp.eval_js("document.getElementById('filter-province')?.value || ''")
empty_pass = (prov_after_empty == "")
print(f"[{'PASS' if empty_pass else 'FAIL'}] Click empty chart space: Expected '', Got '{prov_after_empty}'")

# Test clicking Y-axis label text on the left
print("Testing Y-axis label clicks on the left...")
for idx in range(3):
    expected_prov = bars_info[idx]["expected"]
    cdp.eval_js("if (window.clearProvinceSelection) window.clearProvinceSelection();")
    time.sleep(0.2)
    # Click on the label zone to the left of the chart area
    label_info = cdp.eval_js(f"""
    (() => {{
        const canvas = document.getElementById('overview-province-ranking-chart');
        const chart = Chart.getChart(canvas);
        const rect = canvas.getBoundingClientRect();
        const catScale = chart.scales.y;
        return {{
            x: rect.left + chart.chartArea.left / 2,
            y: rect.top + catScale.getPixelForValue({idx})
        }};
    }})()
    """)
    print(f"DEBUG LABEL CLICK idx={idx}: label_info={label_info}")
    cdp.send("Input.dispatchMouseEvent", {"type": "mouseMoved", "x": label_info["x"], "y": label_info["y"]})
    time.sleep(0.05)
    cdp.send("Input.dispatchMouseEvent", {"type": "mousePressed", "button": "left", "clickCount": 1, "x": label_info["x"], "y": label_info["y"]})
    time.sleep(0.05)
    cdp.send("Input.dispatchMouseEvent", {"type": "mouseReleased", "button": "left", "clickCount": 1, "x": label_info["x"], "y": label_info["y"]})
    time.sleep(0.3)
    hit_log = cdp.eval_js("window.__lastLabelHitLog")
    hit_src = cdp.eval_js("window.__lastHitSource")
    sel = cdp.eval_js("document.getElementById('filter-province')?.value || ''")
    is_p = (sel == expected_prov)
    print(f"[{'PASS' if is_p else 'FAIL'}] Y-axis Label Click for '{expected_prov}': Got '{sel}', hit_src={hit_src}")




edge_proc.terminate()
