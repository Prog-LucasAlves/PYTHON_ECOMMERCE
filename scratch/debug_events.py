import time

from playwright.sync_api import sync_playwright


def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        errors = []
        page.on("console", lambda msg: errors.append(f"CONSOLE: {msg.type}: {msg.text}"))
        page.on("pageerror", lambda err: errors.append(f"ERROR: {err.message}"))

        url = "http://localhost:8049/"
        page.goto(url)
        time.sleep(1)

        # Are there products loaded?
        product_count = page.evaluate("document.querySelectorAll('.product-card').length")

        # Test category click
        btn = page.query_selector('.cat-item[data-cat="roupas-fem"]')
        if btn:
            btn.click()
            time.sleep(0.5)
            class_after = page.evaluate("document.querySelector('.cat-item[data-cat=\"roupas-fem\"]').className")
            print("Category class after click:", class_after)

        # Check window properties
        window_props = page.evaluate("""() => {
            return {
                initAppBindings: typeof window.initAppBindings !== "undefined",
                clearAllFilters: typeof window.clearAllFilters === "function",
                heroCurrent: typeof window.heroCurrent !== "undefined",
            };
        }""")

        # Execute initAppBindings manually in console
        page.evaluate("if (typeof initAppBindings === 'function') initAppBindings()")
        time.sleep(0.5)

        if btn:
            btn.click()
            time.sleep(0.5)
            class_after_manual = page.evaluate("document.querySelector('.cat-item[data-cat=\"roupas-fem\"]').className")
            print("Category class after MANUAL initAppBindings:", class_after_manual)

        browser.close()

        print(f"Products loaded: {product_count}")
        print("Window Props:", window_props)
        print("Errors recorded:")
        for e in errors:
            print(e)


run()
