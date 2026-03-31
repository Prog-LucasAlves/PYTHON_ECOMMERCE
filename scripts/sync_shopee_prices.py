import argparse
import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

import firebase_admin
from firebase_admin import credentials, firestore

GRAPHQL_URL = "https://open-api.affiliate.shopee.com.br/graphql"
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


def build_graphql_payload(item_id: int, shop_id: int | None) -> str:
    payload = {
        "query": DEFAULT_QUERY,
        "variables": {"itemId": item_id, "shopId": shop_id},
        "operationName": "FindProductByShopAndItem",
    }
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":"))


def shopee_request(url: str, app_id: str, app_secret: str, payload_text: str) -> urllib.request.Request:
    timestamp = str(int(time.time()))
    signature = sha256_hex(f"{app_id}{timestamp}{payload_text}{app_secret}")
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": "PYTHON_ECOMMERCE_PRICE_SYNC/1.0",
        "Authorization": f"SHA256 Credential={app_id}, Timestamp={timestamp}, Signature={signature}",
    }
    return urllib.request.Request(url, data=payload_text.encode("utf-8"), headers=headers, method="POST")


def resolve_affiliate_product(item_id: int, shop_id: int | None, app_id: str, app_secret: str) -> dict[str, Any] | None:
    payload = build_graphql_payload(item_id, shop_id)
    request = shopee_request(GRAPHQL_URL, app_id, app_secret, payload)
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            data = json.loads(response.read().decode("utf-8", errors="replace"))
    except (urllib.error.HTTPError, urllib.error.URLError, json.JSONDecodeError):
        return None

    nodes = data.get("data", {}).get("productOfferV2", {}).get("nodes", [])
    return nodes[0] if nodes else None


def pick_variant_price(product: dict[str, Any]) -> tuple[float | None, float | None]:
    def to_float(value: Any) -> float | None:
        try:
            return float(str(value))
        except (TypeError, ValueError):
            return None

    return to_float(product.get("priceMin")), to_float(product.get("priceMax"))


def init_firestore() -> firestore.Client:
    service_account_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
    if not service_account_json:
        raise RuntimeError("FIREBASE_SERVICE_ACCOUNT_JSON is required.")
    info = json.loads(service_account_json)
    if not firebase_admin._apps:
        firebase_admin.initialize_app(credentials.Certificate(info))
    return firestore.client()


def update_product(db: firestore.Client, doc_id: str, affiliate_data: dict[str, Any], product: dict[str, Any]) -> None:
    price_min, price_max = pick_variant_price(product)
    price_changed = False
    current_ref = db.collection("products").document(doc_id)
    current = current_ref.get()
    old_price = None
    if current.exists:
        data = current.to_dict() or {}
        old_price = data.get("apiPrice") or data.get("price") or data.get("manualPrice")
    if isinstance(old_price, (int, float)) and isinstance(price_min, (int, float)):
        price_changed = abs(float(old_price) - float(price_min)) > 0.009
    payload = {
        "affiliate": {
            "source": "shopee",
            "offerLink": product.get("offerLink"),
            "productLink": product.get("productLink"),
            "itemId": product.get("itemId"),
            "shopId": affiliate_data.get("shopId"),
            "resolvedAt": int(time.time() * 1000),
        },
        "pricing": {
            "apiPrice": price_min,
            "apiPriceMax": price_max,
            "priceChanged": price_changed,
            "lastCheckedAt": int(time.time() * 1000),
        },
        "offerLink": product.get("offerLink"),
        "productLink": product.get("productLink"),
        "itemId": product.get("itemId"),
        "shopId": affiliate_data.get("shopId"),
        "apiPrice": price_min,
        "apiPriceMax": price_max,
        "priceChanged": price_changed,
        "lastCheckedAt": int(time.time() * 1000),
    }
    current_ref.set(payload, merge=True)


def find_products_to_sync(db: firestore.Client) -> list[tuple[str, dict[str, Any]]]:
    docs = db.collection("products").stream()
    results = []
    for doc in docs:
        data = doc.to_dict() or {}
        item_id = data.get("itemId") or data.get("affiliate", {}).get("itemId")
        if not item_id:
            continue
        results.append((doc.id, data))
    return results


def main() -> int:
    load_env_file()
    parser = argparse.ArgumentParser(description="Sync Shopee affiliate prices into Firestore.")
    parser.add_argument("--dry-run", action="store_true", help="Do not write to Firestore")
    args = parser.parse_args()

    app_id = os.getenv("SHOPEE_APP_ID")
    app_secret = os.getenv("SHOPEE_APP_SECRET")
    if not app_id or not app_secret:
        print("SHOPEE_APP_ID and SHOPEE_APP_SECRET are required.", file=sys.stderr)
        return 2

    db = init_firestore()
    products = find_products_to_sync(db)
    summary = {"checked": 0, "updated": 0, "missing": 0}

    for doc_id, data in products:
        item_id = data.get("itemId") or data.get("affiliate", {}).get("itemId")
        shop_id = data.get("shopId") or data.get("affiliate", {}).get("shopId")
        try:
            item_id_int = int(str(item_id))
            shop_id_int = int(str(shop_id)) if shop_id else None
        except ValueError:
            summary["missing"] += 1
            continue

        resolved = resolve_affiliate_product(item_id_int, shop_id_int, app_id, app_secret)
        summary["checked"] += 1
        if not resolved:
            summary["missing"] += 1
            continue

        if not args.dry_run:
            update_product(db, doc_id, {"shopId": shop_id_int}, resolved)
            summary["updated"] += 1

    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
