import base64
import http.server
import json
import os
import socket
import struct
import subprocess
import sys
import threading
import time
import urllib.request

sys.stdout.reconfigure(encoding="utf-8")

WORKSPACE = r"c:\Users\kanok\OneDrive\เอกสาร\project_DataViz_Highland"
EDGE_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if not os.path.exists(EDGE_PATH):
    EDGE_PATH = r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"
ARTIFACT_DIR = r"C:\Users\kanok\.gemini\antigravity\brain\031b370b-b9cd-4aaf-8ca7-4cec88a8a4f0"

def get_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WORKSPACE, **kwargs)
    def log_message(self, format, *args):
        pass

class CDPClient:
    def __init__(self, ws_url: str):
        without_scheme = ws_url.replace("ws://", "")
        host_port, self.path = without_scheme.split("/", 1)
        self.path = "/" + self.path
        self.host, port_str = host_port.split(":")
        self.port = int(port_str)
        self.sock = socket.create_connection((self.host, self.port), timeout=20)
        self._handshake()
        self.msg_id = 0

    def _handshake(self):
        key = base64.b64encode(os.urandom(16)).decode("ascii")
        req = (
            f"GET {self.path} HTTP/1.1\r\n"
            f"Host: {self.host}:{self.port}\r\n"
            f"Upgrade: websocket\r\n"
            f"Connection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {key}\r\n"
            f"Sec-WebSocket-Version: 13\r\n\r\n"
        )
        self.sock.sendall(req.encode("ascii"))
        resp = b""
        while b"\r\n\r\n" not in resp:
            resp += self.sock.recv(1024)

    def send(self, method: str, params: dict = None):
        self.msg_id += 1
        payload = {"id": self.msg_id, "method": method, "params": params or {}}
        data = json.dumps(payload).encode("utf-8")
        header = bytearray([0x81])
        length = len(data)
        if length <= 125:
            header.append(0x80 | length)
        elif length <= 65535:
            header.append(0x80 | 126)
            header.extend(struct.pack(">H", length))
        else:
            header.append(0x80 | 127)
            header.extend(struct.pack(">Q", length))
        mask = os.urandom(4)
        header.extend(mask)
        masked = bytearray(data[i] ^ mask[i % 4] for i in range(len(data)))
        self.sock.sendall(header + masked)
        return self._recv(self.msg_id)

    def _recv(self, expected_id: int):
        while True:
            b1, b2 = self.sock.recv(2)
            length = b2 & 0x7F
            if length == 126:
                length = struct.unpack(">H", self.sock.recv(2))[0]
            elif length == 127:
                length = struct.unpack(">Q", self.sock.recv(8))[0]
            data = b""
            while len(data) < length:
                data += self.sock.recv(length - len(data))
            msg = json.loads(data.decode("utf-8"))
            if msg.get("id") == expected_id:
                return msg.get("result", {})

    def eval_js(self, expression: str):
        res = self.send("Runtime.evaluate", {"expression": expression, "returnByValue": True, "awaitPromise": True})
        val = res.get("result", {})
        if "value" in val:
            return val["value"]
        if "description" in val:
            return val["description"]
        return None

    def close(self):
        try:
            self.sock.close()
        except Exception:
            pass

def main():
    http_port = get_free_port()
    cdp_port = get_free_port()

    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", http_port), QuietHandler)
    server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    server_thread.start()

    user_data_dir = os.path.join(os.environ.get("TEMP", "."), f"edge_cdp_dd_{cdp_port}")
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
            f"http://127.0.0.1:{http_port}/index.html",
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    try:
        ws_url = None
        for _ in range(60):
            time.sleep(0.3)
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{cdp_port}/json") as resp:
                    targets = json.loads(resp.read().decode())
                    for t in targets:
                        if t.get("type") == "page":
                            ws_url = t.get("webSocketDebuggerUrl")
                            if "index.html" in t.get("url", ""):
                                break
                if ws_url:
                    break
            except Exception:
                pass

        if not ws_url:
            raise RuntimeError("Could not connect to Headless Edge CDP target.")

        cdp = CDPClient(ws_url)
        cdp.send("Runtime.enable")
        cdp.send("Page.enable")
        cdp.send("Emulation.setDeviceMetricsOverride", {"width": 1536, "height": 960, "deviceScaleFactor": 1, "mobile": False})

        for _ in range(60):
            done = cdp.eval_js("document.getElementById('app-loading-overlay') && document.getElementById('app-loading-overlay').style.display === 'none'")
            if done:
                break
            time.sleep(0.2)

        cdp.eval_js("window.finishAllKpiAnimations && window.finishAllKpiAnimations()")
        time.sleep(0.1)

        # 1. INITIAL OVERVIEW STATE
        init_state = cdp.eval_js("""(() => {
            const bcDist = document.querySelector('#overview-dist-drilldown-bar .drilldown-breadcrumbs')?.innerText.trim();
            const bcRank = document.querySelector('#overview-ranking-drilldown-bar .drilldown-breadcrumbs')?.innerText.trim();
            const backDist = document.querySelector('#overview-dist-drilldown-bar .btn-card-drilldown-back');
            const provVal = document.getElementById('filter-province')?.value;
            const yearVal = document.querySelector('.btn-seg[data-val].active')?.getAttribute('data-val');
            return { bcDist, bcRank, hasBack: Boolean(backDist), provVal, yearVal };
        })()""")
        print("[TEST 1] Initial Overview State:", init_state)
        assert "ภาพรวม 9 จังหวัด" in init_state["bcDist"]
        assert not init_state["hasBack"], "Back button should not appear when at root overview"
        assert init_state["provVal"] == ""

        # 2. DRILL DOWN TO PROVINCE (Chiang Mai)
        cdp.eval_js("""(() => {
            const sel = document.getElementById('filter-province');
            sel.value = 'เชียงใหม่';
            sel.dispatchEvent(new Event('change'));
            if (window.finishAllKpiAnimations) window.finishAllKpiAnimations();
        })()""")
        time.sleep(0.2)

        cm_drill = cdp.eval_js("""(() => {
            const bcDist = document.querySelector('#overview-dist-drilldown-bar .drilldown-breadcrumbs')?.innerText.trim();
            const backBtnDist = document.querySelector('#overview-dist-drilldown-bar .btn-card-drilldown-back')?.innerText.trim();
            const backBtnRank = document.querySelector('#overview-ranking-drilldown-bar .btn-card-drilldown-back')?.innerText.trim();
            const chBox = Chart.getChart('overview-distribution-chart');
            const labelsCount = chBox?.data?.labels?.length;
            const singleBannerDisplay = document.getElementById('overview-dist-single-stat-banner')?.style.display;
            const subtitle = document.getElementById('overview-distribution-subtitle')?.innerText.trim();
            return { bcDist, backBtnDist, backBtnRank, labelsCount, singleBannerDisplay, subtitle };
        })()""")
        print("[TEST 2] Drilled into Chiang Mai:", cm_drill)
        assert "ภาพรวม 9 จังหวัด" in cm_drill["bcDist"] and "เชียงใหม่" in cm_drill["bcDist"]
        assert "กลับสู่ภาพรวม" in cm_drill["backBtnDist"]
        assert cm_drill["labelsCount"] >= 1

        # Capture Screenshot of Q1 with Chiang Mai Drilled & Breadcrumb
        shot_cm = cdp.send("Page.captureScreenshot", {"format": "png"})
        with open(os.path.join(ARTIFACT_DIR, "screenshot_drilldown_chiangmai.png"), "wb") as bf:
            bf.write(base64.b64decode(shot_cm["data"]))

        # 3. TEST SINGLE-STATION PROVINCE (Kanchanaburi)
        cdp.eval_js("""(() => {
            const sel = document.getElementById('filter-province');
            sel.value = 'กาญจนบุรี';
            sel.dispatchEvent(new Event('change'));
            if (window.finishAllKpiAnimations) window.finishAllKpiAnimations();
        })()""")
        time.sleep(0.2)

        kan_drill = cdp.eval_js("""(() => {
            const bcDist = document.querySelector('#overview-dist-drilldown-bar .drilldown-breadcrumbs')?.innerText.trim();
            const singleBannerDisplay = document.getElementById('overview-dist-single-stat-banner')?.style.display;
            const bannerHtml = document.getElementById('overview-dist-single-stat-banner')?.innerText.trim();
            const chBox = Chart.getChart('overview-distribution-chart');
            const labelsCount = chBox?.data?.labels?.length;
            return { bcDist, singleBannerDisplay, bannerHtml, labelsCount };
        })()""")
        print("[TEST 3] Single-Station Province (Kanchanaburi):", kan_drill)
        assert "ภาพรวม 9 จังหวัด" in kan_drill["bcDist"] and "กาญจนบุรี" in kan_drill["bcDist"]
        assert kan_drill["singleBannerDisplay"] == "block", "Single-group summary banner must display for Kanchanaburi"
        assert "ต่ำสุด (Min)" in kan_drill["bannerHtml"] and "สูงสุด (Max)" in kan_drill["bannerHtml"]
        assert "มัธยฐาน (Median)" in kan_drill["bannerHtml"] and "ค่าเฉลี่ย (Mean)" in kan_drill["bannerHtml"]

        # Capture Screenshot of Kanchanaburi Single-Station Boxplot Card
        shot_kan = cdp.send("Page.captureScreenshot", {"format": "png"})
        with open(os.path.join(ARTIFACT_DIR, "screenshot_drilldown_single_station.png"), "wb") as bf:
            bf.write(base64.b64decode(shot_kan["data"]))

        # 4. CLICK "← กลับสู่ภาพรวม" BUTTON FROM CARD HEADER
        cdp.eval_js("""(() => {
            const backBtn = document.querySelector('#overview-dist-drilldown-bar .btn-card-drilldown-back');
            if (backBtn) backBtn.click();
            if (window.finishAllKpiAnimations) window.finishAllKpiAnimations();
        })()""")
        time.sleep(0.2)

        after_back = cdp.eval_js("""(() => {
            const provVal = document.getElementById('filter-province')?.value;
            const bcDist = document.querySelector('#overview-dist-drilldown-bar .drilldown-breadcrumbs')?.innerText.trim();
            const backBtnDist = document.querySelector('#overview-dist-drilldown-bar .btn-card-drilldown-back');
            const yearVal = document.querySelector('.btn-seg[data-val].active')?.getAttribute('data-val');
            return { provVal, bcDist, hasBack: Boolean(backBtnDist), yearVal };
        })()""")
        print("[TEST 4] After Clicking '← กลับสู่ภาพรวม':", after_back)
        assert after_back["provVal"] == "", "Province must be reset to empty (overview)"
        assert "ภาพรวม 9 จังหวัด" in after_back["bcDist"]
        assert not after_back["hasBack"]

        # 5. CLICK-AGAIN TO DESELECT TEST (Bar chart & Boxplot)
        toggle_res = cdp.eval_js("""(() => {
            // Click Nan bar on ranking chart
            const chartRank = Chart.getChart('overview-province-ranking-chart');
            const nanIdx = chartRank.data.datasets[0].provinceKeys.indexOf('น่าน');
            chartRank.options.onClick({}, [{ index: nanIdx, datasetIndex: 0 }], chartRank);
            const provAfterClick1 = document.getElementById('filter-province').value;

            // Click Nan bar again to deselect
            chartRank.options.onClick({}, [{ index: nanIdx, datasetIndex: 0 }], chartRank);
            const provAfterClick2 = document.getElementById('filter-province').value;

            return { provAfterClick1, provAfterClick2 };
        })()""")
        print("[TEST 5] Click-again to toggle deselect:", toggle_res)
        assert toggle_res["provAfterClick1"] == "น่าน"
        assert toggle_res["provAfterClick2"] == "", "Clicking same bar again must deselect province"

        # 6. CLICK BREADCRUMB NAVIGATION LINK
        cdp.eval_js("""(() => {
            const sel = document.getElementById('filter-province');
            sel.value = 'เชียงใหม่';
            sel.dispatchEvent(new Event('change'));
            if (window.finishAllKpiAnimations) window.finishAllKpiAnimations();
        })()""")
        time.sleep(0.1)

        bc_click_res = cdp.eval_js("""(() => {
            // Click root crumb button
            const crumbBtn = document.querySelector('#overview-dist-drilldown-bar .crumb-btn');
            if (crumbBtn) crumbBtn.click();
            if (window.finishAllKpiAnimations) window.finishAllKpiAnimations();
            return { provVal: document.getElementById('filter-province')?.value };
        })()""")
        print("[TEST 6] Click Breadcrumb Root Button:", bc_click_res)
        assert bc_click_res["provVal"] == ""

        # 7. VERIFY TAB Q2, Q3, Q4 DRILLDOWN BARS
        tab_check = cdp.eval_js("""(() => {
            // Switch to Q3 Hotspots
            document.querySelector('[data-tab="hotspots"]').click();
            const sel = document.getElementById('filter-province');
            sel.value = 'ตาก';
            sel.dispatchEvent(new Event('change'));

            const hsBc = document.querySelector('#hotspots-district-drilldown-bar .drilldown-breadcrumbs')?.innerText.trim();
            const hsBack = document.querySelector('#hotspots-district-drilldown-bar .btn-card-drilldown-back')?.innerText.trim();

            // Switch to Q4 Correlation
            document.querySelector('[data-tab="correlation"]').click();
            const q4Bc = document.querySelector('#q6-scatter-drilldown-bar .drilldown-breadcrumbs')?.innerText.trim();
            const q4Back = document.querySelector('#q6-scatter-drilldown-bar .btn-card-drilldown-back')?.innerText.trim();

            window.clearProvinceSelection();
            return { hsBc, hsBack, q4Bc, q4Back };
        })()""")
        print("[TEST 7] Cross-Tab Drilldown Bars (Q3, Q4):", tab_check)
        assert "ตาก" in tab_check["hsBc"] and "กลับสู่ภาพรวม" in tab_check["hsBack"]
        assert "ตาก" in tab_check["q4Bc"] and "กลับสู่ภาพรวม" in tab_check["q4Back"]

        print("\nALL DRILL-DOWN & CROSS-FILTERING VERIFICATION TESTS PASSED SUCCESSFULLY!")
        cdp.close()
    finally:
        try:
            edge_proc.kill()
        except Exception:
            pass
        httpd.shutdown()

if __name__ == "__main__":
    main()
