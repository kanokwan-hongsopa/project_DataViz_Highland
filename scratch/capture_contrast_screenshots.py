import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 1440, 'height': 900})
        page = await context.new_page()

        print("Navigating to http://localhost:8080/...")
        await page.goto("http://localhost:8080/", wait_until="networkidle")
        await page.wait_for_timeout(2000)

        # 1. Overview Q1 (KPIs & Bento Grid Charts)
        await page.screenshot(
            path=r"C:\Users\kanok\.gemini\antigravity\brain\031b370b-b9cd-4aaf-8ca7-4cec88a8a4f0\screenshot_contrast_q1_overview.png",
            full_page=False
        )
        print("Captured screenshot_contrast_q1_overview.png")

        # 2. Scroll to Highlights Section & capture
        highlights = page.locator("#highlights-section")
        if await highlights.count() > 0:
            await highlights.scroll_into_view_if_needed()
            await page.wait_for_timeout(1000)
            await page.screenshot(
                path=r"C:\Users\kanok\.gemini\antigravity\brain\031b370b-b9cd-4aaf-8ca7-4cec88a8a4f0\screenshot_contrast_highlights.png",
                full_page=False
            )
            print("Captured screenshot_contrast_highlights.png")

        # 3. Hover over Monthly Trend Chart to capture dark crisp tooltip
        chart_canvas = page.locator("#overview-monthly-trend-chart")
        if await chart_canvas.count() > 0:
            await chart_canvas.scroll_into_view_if_needed()
            await page.wait_for_timeout(800)
            box = await chart_canvas.bounding_box()
            if box:
                # Hover near month 4 (April)
                await page.mouse.move(box["x"] + box["width"] * 0.35, box["y"] + box["height"] * 0.45)
                await page.wait_for_timeout(600)
                await page.screenshot(
                    path=r"C:\Users\kanok\.gemini\antigravity\brain\031b370b-b9cd-4aaf-8ca7-4cec88a8a4f0\screenshot_contrast_tooltip.png",
                    full_page=False
                )
                print("Captured screenshot_contrast_tooltip.png")

        # 4. Switch to Q2 Climate (Box Plots & Distributions)
        await page.click('button[data-tab="climate"]')
        await page.wait_for_timeout(1500)
        await page.screenshot(
            path=r"C:\Users\kanok\.gemini\antigravity\brain\031b370b-b9cd-4aaf-8ca7-4cec88a8a4f0\screenshot_contrast_q2_climate.png",
            full_page=False
        )
        print("Captured screenshot_contrast_q2_climate.png")

        # 5. Switch to Q3 Hotspots
        await page.click('button[data-tab="hotspots"]')
        await page.wait_for_timeout(1500)
        await page.screenshot(
            path=r"C:\Users\kanok\.gemini\antigravity\brain\031b370b-b9cd-4aaf-8ca7-4cec88a8a4f0\screenshot_contrast_q3_hotspots.png",
            full_page=False
        )
        print("Captured screenshot_contrast_q3_hotspots.png")

        # 6. Switch to Q4 Correlation (Scatter Plot & Trendline)
        await page.click('button[data-tab="correlation"]')
        await page.wait_for_timeout(1500)
        await page.screenshot(
            path=r"C:\Users\kanok\.gemini\antigravity\brain\031b370b-b9cd-4aaf-8ca7-4cec88a8a4f0\screenshot_contrast_q4_correlation.png",
            full_page=False
        )
        print("Captured screenshot_contrast_q4_correlation.png")

        # 7. Switch to Q5 Quality
        await page.click('button[data-tab="rainfall"]')
        await page.wait_for_timeout(1500)
        await page.screenshot(
            path=r"C:\Users\kanok\.gemini\antigravity\brain\031b370b-b9cd-4aaf-8ca7-4cec88a8a4f0\screenshot_contrast_q5_quality.png",
            full_page=False
        )
        print("Captured screenshot_contrast_q5_quality.png")

        await browser.close()
        print("All screenshots successfully captured!")

asyncio.run(run())
