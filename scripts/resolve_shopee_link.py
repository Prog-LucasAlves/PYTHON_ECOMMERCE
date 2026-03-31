import argparse
import re
import sys
import urllib.error
import urllib.request
from urllib.parse import parse_qs, urlparse

PRODUCT_URL_RE = re.compile(r"/(?:product|[^/?#]+)/(\d+)/(\d+)")
ITEM_ID_KEYS = ("vItemId", "itemId")
SHOP_ID_KEYS = ("vShopId", "shopId")


def resolve_url(url: str, timeout: int) -> str:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "PYTHON_ECOMMERCE_LINK_RESOLVER/1.0",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        method="GET",
    )

    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.geturl()


def main() -> int:
    parser = argparse.ArgumentParser(description="Resolve a Shopee short link and extract shopId/itemId.")
    parser.add_argument("--url", default=None, help="Shopee short or full URL")
    parser.add_argument("--timeout", type=int, default=20, help="Request timeout in seconds")
    args = parser.parse_args()

    url = args.url or input("Cole o link da Shopee: ").strip()
    if not url:
        print("URL is required.", file=sys.stderr)
        return 2

    try:
        final_url = resolve_url(url, args.timeout)
    except urllib.error.HTTPError as exc:
        print(f"HTTP {exc.code}: {exc.reason}", file=sys.stderr)
        return 1
    except urllib.error.URLError as exc:
        print(f"Request failed: {exc.reason}", file=sys.stderr)
        return 2

    match = PRODUCT_URL_RE.search(final_url)
    print(f"Final URL: {final_url}")
    if match:
        print(f"shopId: {match.group(1)}")
        print(f"itemId: {match.group(2)}")
        return 0

    parsed = urlparse(final_url)
    query = parse_qs(parsed.query)
    item_id = next((values[0] for key in ITEM_ID_KEYS if (values := query.get(key))), None)
    shop_id = next((values[0] for key in SHOP_ID_KEYS if (values := query.get(key))), None)
    if item_id or shop_id:
        if shop_id:
            print(f"shopId: {shop_id}")
        if item_id:
            print(f"itemId: {item_id}")
        return 0

    print("Could not extract shopId/itemId from the final URL.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
