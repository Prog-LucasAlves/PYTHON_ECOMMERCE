import os

from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.on("console", lambda msg: print(f"CONSOLE: {msg.type}: {msg.text}"))
    page.on("pageerror", lambda err: print(f"ERROR: {err.message}", flush=True))
    url = f"file:///{os.path.abspath('index.html').replace(chr(92), '/')}"
    print(f"Loading {url}")
    page.goto(url)
    page.wait_for_timeout(2000)
    # also try to click something
    try:
        page.click("button.cat-item[data-cat='roupas-fem']")
        print("Clicked category button!")
    except Exception as e:
        print(f"Click failed: {e}")

    page.wait_for_timeout(1000)
    browser.close()
