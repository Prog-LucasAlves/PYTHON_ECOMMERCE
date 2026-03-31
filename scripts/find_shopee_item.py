import argparse
import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

DEFAULT_URL = "https://open-api.affiliate.shopee.com.br/graphql"
DEFAULT_QUERY = """
query FindProductByShopAndItem($itemId: Int!, $shopId: Int) {
  productOfferV2(itemId: $itemId, shopId: $shopId) {
    nodes {
      itemId
      productName
      productLink
      offerLink
      imageUrl
      priceMin
      priceMax
      commissionRate
      priceDiscountRate
    }
    pageInfo {
      page
      limit
      hasNextPage
    }
  }
}
""".strip()


def load_env_file(path: str | None = None) -> None:
    candidates = []
    if path:
        candidates.append(Path(path))
    script_dir = Path(__file__).resolve().parent
    candidates.append(script_dir / ".env")
    candidates.append(script_dir.parent / ".env")

    env_path = next((candidate for candidate in candidates if candidate.exists()), None)
    if env_path is None:
        return

    with env_path.open("r", encoding="utf-8") as handle:
        for raw_line in handle:
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value


def sha256_hex(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def build_payload(query: str, variables: dict[str, object], operation_name: str) -> dict[str, object]:
    return {"query": query, "variables": variables, "operationName": operation_name}


def build_request(url: str, app_id: str, app_secret: str, payload_text: str) -> urllib.request.Request:
    timestamp = str(int(time.time()))
    signature = sha256_hex(f"{app_id}{timestamp}{payload_text}{app_secret}")
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": "PYTHON_ECOMMERCE_ITEM_FINDER/1.0",
        "Authorization": f"SHA256 Credential={app_id}, Timestamp={timestamp}, Signature={signature}",
    }
    return urllib.request.Request(url, data=payload_text.encode("utf-8"), headers=headers, method="POST")


def print_json(data: object) -> None:
    print(json.dumps(data, ensure_ascii=False, indent=2))


def main() -> int:
    load_env_file()

    parser = argparse.ArgumentParser(description="Find a Shopee product by itemId from the affiliate API.")
    parser.add_argument("--item-id", default=None, help="Shopee itemId to look for")
    parser.add_argument("--shop-id", default=None, help="Optional Shopee shopId")
    parser.add_argument("--url", default=os.getenv("SHOPEE_API_URL", DEFAULT_URL), help="GraphQL URL")
    parser.add_argument("--app-id", default=os.getenv("SHOPEE_APP_ID"), help="Shopee App ID")
    parser.add_argument("--app-secret", default=os.getenv("SHOPEE_APP_SECRET"), help="Shopee App Secret")
    parser.add_argument("--timeout", type=int, default=30, help="Request timeout in seconds")
    args = parser.parse_args()

    if not args.item_id:
        args.item_id = input("Digite o itemId do produto: ").strip()

    if not args.app_id or not args.app_secret:
        print("SHOPEE_APP_ID and SHOPEE_APP_SECRET are required.", file=sys.stderr)
        return 2

    if not args.item_id:
        print("itemId is required.", file=sys.stderr)
        return 2

    try:
        item_id = int(str(args.item_id).strip())
    except ValueError:
        print("itemId must be a number.", file=sys.stderr)
        return 2

    shop_id = None
    if args.shop_id is not None:
        try:
            shop_id = int(str(args.shop_id).strip())
        except ValueError:
            print("shopId must be a number.", file=sys.stderr)
            return 2

    variables: dict[str, object] = {"itemId": item_id, "shopId": shop_id}
    payload_obj = build_payload(DEFAULT_QUERY, variables, "FindProductByShopAndItem")
    payload_text = json.dumps(payload_obj, ensure_ascii=False, separators=(",", ":"))
    request = build_request(args.url, args.app_id, args.app_secret, payload_text)

    try:
        with urllib.request.urlopen(request, timeout=args.timeout) as response:
            body = response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        print(f"HTTP {exc.code}", file=sys.stderr)
        print(body)
        return 1
    except urllib.error.URLError as exc:
        print(f"Request failed: {exc.reason}", file=sys.stderr)
        return 2

    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        print(body)
        return 1

    offer_data = data.get("data", {}).get("productOfferV2", {})
    nodes = offer_data.get("nodes", [])
    print("Search summary:")
    print_json(
        {
            "query": {"itemId": item_id, "shopId": shop_id},
            "matched": len(nodes),
            "link_note": {
                "productLink": "Original Shopee product URL",
                "offerLink": "Affiliate/tracking link",
            },
        },
    )

    if not nodes:
        print("\nNo product returned for this itemId/shopId combination.")
        return 0

    print("\nMatched item:")
    print_json(nodes[0])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
