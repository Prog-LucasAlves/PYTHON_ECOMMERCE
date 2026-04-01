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
DEFAULT_KEYWORDS = [
    "vestido feminino",
    "tênis feminino",
    "kit maquiagem",
    "air fryer",
    "fone bluetooth",
]
DEFAULT_CATEGORY_BY_KEYWORD = {
    "vestido feminino": "roupas-fem",
    "tênis feminino": "sapatos",
    "kit maquiagem": "beleza",
    "air fryer": "eletrodom",
    "fone bluetooth": "audio",
}
DEFAULT_QUERY = """
query SearchProducts($keyword: String, $sortType: Int, $page: Int, $limit: Int) {
  productOfferV2(keyword: $keyword, sortType: $sortType, page: $page, limit: $limit) {
    nodes {
      productId
      productName
      price
      priceMin
      priceMax
      imageUrl
      offerLink
      productLink
      shopId
      shopName
      soldCount
      ratingStar
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


def init_firestore() -> firestore.Client:
    service_account_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
    if not service_account_json:
        raise RuntimeError("FIREBASE_SERVICE_ACCOUNT_JSON is required.")
    info = json.loads(service_account_json)
    if not firebase_admin._apps:
        firebase_admin.initialize_app(credentials.Certificate(info))
    return firestore.client()


def shopee_request(app_id: str, app_secret: str, payload_text: str) -> urllib.request.Request:
    timestamp = str(int(time.time()))
    signature = hashlib.sha256(f"{app_id}{timestamp}{payload_text}{app_secret}".encode("utf-8")).hexdigest()
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": "PYTHON_ECOMMERCE_SHOPEE_IMPORT/1.0",
        "Authorization": f"SHA256 Credential={app_id}, Timestamp={timestamp}, Signature={signature}",
    }
    return urllib.request.Request(
        GRAPHQL_URL,
        data=payload_text.encode("utf-8"),
        headers=headers,
        method="POST",
    )


def build_payload(keyword: str, sort_type: int, page: int, limit: int) -> str:
    payload = {
        "query": DEFAULT_QUERY,
        "variables": {
            "keyword": keyword,
            "sortType": sort_type,
            "page": page,
            "limit": limit,
        },
        "operationName": "SearchProducts",
    }
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":"))


def fetch_keyword_products(keyword: str, app_id: str, app_secret: str, page: int, limit: int, sort_type: int) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    payload = build_payload(keyword, sort_type, page, limit)
    request = shopee_request(app_id, app_secret, payload)
    with urllib.request.urlopen(request, timeout=30) as response:
        data = json.loads(response.read().decode("utf-8", errors="replace"))
    node = data.get("data", {}).get("productOfferV2", {})
    return node.get("nodes", []) or [], node.get("pageInfo", {}) or {}


def cents_to_float(value: Any) -> float | None:
    try:
        if value is None:
            return None
        numeric = float(value)
        if isinstance(value, int) or (isinstance(value, str) and value.isdigit()):
            if numeric > 1000:
                return round(numeric / 100.0, 2)
        return round(numeric, 2)
    except (TypeError, ValueError):
        return None


def normalize_product(keyword: str, raw: dict[str, Any], default_category: str) -> dict[str, Any]:
    item_id = raw.get("productId")
    now_ms = int(time.time() * 1000)
    image = raw.get("imageUrl")
    offer_link = raw.get("offerLink") or raw.get("productLink") or ""
    product_link = raw.get("productLink") or ""
    price = cents_to_float(raw.get("price")) or cents_to_float(raw.get("priceMin"))
    original_price = cents_to_float(raw.get("priceMax"))
    return {
        "id": f"shopee_{item_id}",
        "name": raw.get("productName") or f"shopee_{item_id}",
        "category": default_category,
        "price": price,
        "originalPrice": original_price,
        "link": offer_link,
        "offerLink": offer_link,
        "productLink": product_link,
        "images": [image] if image else [],
        "source": "shopee",
        "status": "draft",
        "itemId": item_id,
        "shopId": raw.get("shopId"),
        "keywordsSource": [keyword],
        "rating": raw.get("ratingStar"),
        "soldCount": raw.get("soldCount"),
        "createdAt": now_ms,
        "updatedAt": now_ms,
    }


def parse_keywords(value: str | None) -> list[str]:
    if not value:
        return DEFAULT_KEYWORDS
    return [item.strip() for item in value.split(",") if item.strip()]


def main() -> int:
    load_env_file()
    parser = argparse.ArgumentParser(description="Import Shopee products into Firestore by keyword.")
    parser.add_argument("--keywords", help="Comma-separated list of keywords")
    parser.add_argument("--limit", type=int, default=20, help="Items per page")
    parser.add_argument("--page", type=int, default=1, help="Starting page")
    parser.add_argument("--sort-type", type=int, default=1, help="Shopee sortType (default: latest desc)")
    parser.add_argument("--category", help="Force one category for all imported products")
    parser.add_argument("--dry-run", action="store_true", help="Do not write to Firestore")
    args = parser.parse_args()

    app_id = os.getenv("SHOPEE_APP_ID")
    app_secret = os.getenv("SHOPEE_APP_SECRET")
    if not app_id or not app_secret:
        print("SHOPEE_APP_ID and SHOPEE_APP_SECRET are required.", file=sys.stderr)
        return 2

    keywords = parse_keywords(args.keywords)
    db = init_firestore()
    products_ref = db.collection("products")
    summary = {"keywords": len(keywords), "fetched": 0, "saved": 0, "skipped": 0}
    seen_ids: set[str] = set()

    for keyword in keywords:
        default_category = args.category or DEFAULT_CATEGORY_BY_KEYWORD.get(keyword.lower(), "outros")
        try:
            nodes, page_info = fetch_keyword_products(keyword, app_id, app_secret, args.page, args.limit, args.sort_type)
        except (urllib.error.HTTPError, urllib.error.URLError, json.JSONDecodeError) as exc:
            print(json.dumps({"keyword": keyword, "event": "error", "error": str(exc)}, ensure_ascii=False))
            continue

        print(json.dumps({"keyword": keyword, "event": "fetched", "count": len(nodes), "pageInfo": page_info}, ensure_ascii=False))

        for raw in nodes:
            product = normalize_product(keyword, raw, default_category)
            if not product["itemId"]:
                summary["skipped"] += 1
                continue

            doc_id = str(product["id"])
            if doc_id in seen_ids:
                summary["skipped"] += 1
                continue
            seen_ids.add(doc_id)
            summary["fetched"] += 1

            current_ref = products_ref.document(doc_id)
            existing = current_ref.get()
            if existing.exists:
                existing_data = existing.to_dict() or {}
                product["createdAt"] = existing_data.get("createdAt", product["createdAt"])
                existing_keywords = existing_data.get("keywordsSource") or []
                if keyword not in existing_keywords:
                    product["keywordsSource"] = sorted(set(existing_keywords + [keyword]))
                else:
                    product["keywordsSource"] = existing_keywords
                if existing_data.get("category") and not args.category:
                    product["category"] = existing_data["category"]

            if not args.dry_run:
                current_ref.set(product, merge=True)
                summary["saved"] += 1

            print(json.dumps({"keyword": keyword, "event": "saved", "id": doc_id, "name": product["name"]}, ensure_ascii=False))

    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
