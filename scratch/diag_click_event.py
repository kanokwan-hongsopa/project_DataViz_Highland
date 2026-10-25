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

cdp.eval_js("""
    const c = document.getElementById('overview-province-ranking-chart');
    if (c) c.scrollIntoView({ block: 'center' });
""")
time.sleep(0.6)

diag_click = cdp.eval_js("""
(() => {
    const canvas = document.getElementById('overview-province-ranking-chart');
    const chart = Chart.getChart(canvas);
    const meta = chart.getDatasetMeta(0);
    const bar0 = meta.data[0];
    
    // Log what happens when onClick is called
    let capturedEvt = null;
    let capturedEls = null;
    let capturedChart = null;
    
    const origOnClick = chart.options.onClick;
    chart.options.onClick = (evt, els, c) => {
        capturedEvt = {
            type: evt.type,
            x: evt.x,
            y: evt.y,
            hasNative: Boolean(evt.native),
            nativeClientX: evt.native ? evt.native.clientX : null,
            nativeClientY: evt.native ? evt.native.clientY : null
        };
        capturedEls = (els || []).map(el => ({ datasetIndex: el.datasetIndex, index: el.index }));
        capturedChart = Boolean(c);
        if (origOnClick) origOnClick(evt, els, c);
    };
    
    // Dispatch click event on canvas
    const rect = canvas.getBoundingClientRect();
    const clickX = (bar0.base + bar0.x) / 2;
    const clickY = bar0.y;
    
    const evt = new MouseEvent('click', {
        clientX: rect.left + clickX,
        clientY: rect.top + clickY,
        bubbles: true,
        cancelable: true
    });
    canvas.dispatchEvent(evt);
    
    return {
        bar0: { x: bar0.x, y: bar0.y, base: bar0.base, width: bar0.width, height: bar0.height },
        clickPoint: { x: clickX, y: clickY },
        capturedEvt,
        capturedEls,
        capturedChart
    };
})()
""")

print("Diag Click:", json.dumps(diag_click, ensure_ascii=False, indent=2))
edge_proc.terminate()
