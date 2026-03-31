import argparse
import hashlib
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

import firebase_admin
from firebase_admin import credentials, firestore

GRAPHQL_URL = "https://open-api.affiliate.shopee.com.br/graphql"
PRODUCT_URL_RE = re.compile(r"/(?:product|[^/?#]+)/(\d+)/(\d+)")
ITEM_ID_KEYS = ("vItemId", "itemId")
SHOP_ID_KEYS = ("vShopId", "shopId")
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


def resolve_offer_url(url: str, timeout: int = 20) -> str:
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


def extract_ids_from_url(url: str) -> tuple[int | None, int | None]:
    match = PRODUCT_URL_RE.search(url)
    if match:
        return int(match.group(1)), int(match.group(2))

    parsed = urlparse(url)
    query = parse_qs(parsed.query)
    item_id = next((values[0] for key in ITEM_ID_KEYS if (values := query.get(key))), None)
    shop_id = next((values[0] for key in SHOP_ID_KEYS if (values := query.get(key))), None)
    try:
        return (int(shop_id) if shop_id else None, int(item_id) if item_id else None)
    except ValueError:
        return None, None


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


def log_product(event: str, doc_id: str, data: dict[str, Any], product: dict[str, Any] | None = None) -> None:
    item_id = data.get("itemId") or data.get("affiliate", {}).get("itemId") or "-"
    shop_id = data.get("shopId") or data.get("affiliate", {}).get("shopId") or "-"
    name = (product or {}).get("productName") or data.get("name") or data.get("affiliate", {}).get("productName") or doc_id
    if product:
        price_min, price_max = pick_variant_price(product)
        print(
            json.dumps(
                {
                    "event": event,
                    "docId": doc_id,
                    "name": name,
                    "itemId": item_id,
                    "shopId": shop_id,
                    "priceMin": price_min,
                    "priceMax": price_max,
                    "priceChanged": data.get("priceChanged"),
                },
                ensure_ascii=False,
            ),
        )
    else:
        print(
            json.dumps(
                {
                    "event": event,
                    "docId": doc_id,
                    "name": name,
                    "itemId": item_id,
                    "shopId": shop_id,
                },
                ensure_ascii=False,
            ),
        )


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
    item_id = product.get("itemId")
    shop_id = affiliate_data.get("shopId") or product.get("shopId")
    payload = {
        "affiliate": {
            "source": "shopee",
            "offerLink": product.get("offerLink"),
            "productLink": product.get("productLink"),
            "itemId": item_id,
            "shopId": shop_id,
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
        "itemId": item_id,
        "shopId": shop_id,
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
        offer_link = data.get("offerLink") or data.get("affiliate", {}).get("offerLink")
        if not item_id and offer_link:
            try:
                final_url = resolve_offer_url(str(offer_link))
            except urllib.error.URLError:
                final_url = str(offer_link)
            shop_from_url, item_from_url = extract_ids_from_url(final_url)
            if item_from_url:
                data["itemId"] = item_from_url
            if shop_from_url:
                data["shopId"] = shop_from_url
            if not item_from_url:
                continue
        if not item_id and not data.get("itemId"):
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
    summary = {
        "checked": 0,
        "updated": 0,
        "missing": 0,
        "resolved_ids": 0,
        "not_found": 0,
        "missing_ids": 0,
    }
    status_order = ("resolved_ids", "updated", "not_found", "missing_ids")
    status_labels = {
        "resolved_ids": "IDs resolvidos",
        "updated": "Atualizados",
        "not_found": "Não encontrados",
        "missing_ids": "Sem IDs",
    }
    print("Shopee sync summary")
    print(json.dumps({key: summary[key] for key in ("checked", "updated", "missing")}, ensure_ascii=False, indent=2))
    print("By status")
    for key in status_order:
        print(f"- {status_labels[key]}: 0")

    for doc_id, data in products:
        item_id = data.get("itemId") or data.get("affiliate", {}).get("itemId")
        shop_id = data.get("shopId") or data.get("affiliate", {}).get("shopId")
        offer_link = data.get("offerLink") or data.get("affiliate", {}).get("offerLink")
        log_product("checking", doc_id, data)
        if (not item_id or not shop_id) and offer_link:
            try:
                final_url = resolve_offer_url(str(offer_link))
            except urllib.error.URLError:
                final_url = str(offer_link)
            shop_from_url, item_from_url = extract_ids_from_url(final_url)
            item_id = item_id or item_from_url
            shop_id = shop_id or shop_from_url
        try:
            item_id_int = int(str(item_id))
            shop_id_int = int(str(shop_id)) if shop_id else None
        except ValueError:
            summary["missing"] += 1
            summary["missing_ids"] += 1
            log_product("missing_ids", doc_id, data)
            continue
        if (data.get("itemId") != item_id_int or data.get("shopId") != shop_id_int) and not args.dry_run:
            db.collection("products").document(doc_id).set(
                {
                    "itemId": item_id_int,
                    "shopId": shop_id_int,
                    "offerLink": offer_link,
                },
                merge=True,
            )
            summary["resolved_ids"] += 1

        resolved = resolve_affiliate_product(item_id_int, shop_id_int, app_id, app_secret)
        summary["checked"] += 1
        if not resolved:
            summary["missing"] += 1
            summary["not_found"] += 1
            log_product("not_found", doc_id, data)
            continue

        if not args.dry_run:
            update_product(db, doc_id, {"shopId": shop_id_int}, resolved)
            summary["updated"] += 1
        log_product("updated", doc_id, data, resolved)

    print("Final summary")
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    print("By status")
    for key in status_order:
        print(f"- {status_labels[key]}: {summary[key]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
