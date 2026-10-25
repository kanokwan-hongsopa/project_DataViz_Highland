import os
import sys
import time
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

time.sleep(1)

test_info = cdp.eval_js("""
(() => {
    const canvas = document.getElementById('overview-province-ranking-chart');
    if (!canvas) return { error: 'No canvas' };
    const chart = Chart.getChart(canvas);
    if (!chart) return { error: 'No chart' };
    const rect = canvas.getBoundingClientRect();
    const meta = chart.getDatasetMeta(0);
    const bars = meta.data.map((bar, i) => {
        return {
            index: i,
            label: chart.data.labels[i],
            x: bar.x,
            y: bar.y,
            base: bar.base,
            width: bar.width,
            height: bar.height,
            clientX: rect.left + bar.x * (rect.width / canvas.width),
            clientY: rect.top + bar.y * (rect.height / canvas.height)
        };
    });
    return {
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
        bars
    };
})()
""")

print("Test Info:", json.dumps(test_info, ensure_ascii=False, indent=2))

edge_proc.terminate()
