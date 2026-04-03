import argparse
import hashlib
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from math import ceil
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
    "utensilios para o lar": "casa",
    "utensílios para o lar": "casa",
    "cozinha organizada": "casa",
    "organização de cozinha": "casa",
    "organizacao de cozinha": "casa",
    "casa organizada": "casa",
    "casa e construcao": "casa",
    "casa e construção": "casa",
}
CATEGORY_RULES: dict[str, tuple[str, ...]] = {
    "roupas-fem": (
        "vestido",
        "blusa",
        "saia",
        "calca feminina",
        "calça feminina",
        "macacao",
        "macacão",
        "cropped",
        "regata feminina",
        "top feminino",
        "body feminino",
        "moletom feminino",
        "casaco feminino",
        "cardigan",
        "jaqueta feminina",
        "plus size",
    ),
    "roupas-masc": (
        "camiseta masculina",
        "camisa masculina",
        "camisa social",
        "calca masculina",
        "calça masculina",
        "bermuda masculina",
        "moletom masculino",
        "jaqueta masculina",
        "polo masculina",
        "blazer",
        "sapatenis",
        "sapatênis",
    ),
    "sapatos": (
        "tênis",
        "tenis",
        "sandalia",
        "sandália",
        "chinelo",
        "rasteirinha",
        "sapatilha",
        "anabela",
        "espadrille",
        "tamanco",
        "sapato",
        "bota",
        "scarpin",
    ),
    "celulares": (
        "celular",
        "smartphone",
        "iphone",
        "samsung",
        "xiaomi",
        "capinha",
        "película",
        "pelicula",
        "carregador iphone",
        "carregador samsung",
        "carregador xiaomi",
        "fone iphone",
        "fone samsung",
    ),
    "eletronicos": (
        "eletron",
        "eletrôn",
        "webcam",
        "microfone",
        "ring light",
        "drone",
        "camera",
        "câmera",
        "tripé",
        "tripé selfie",
        "relógio",
        "relogio",
        "smartwatch",
        "luminária led",
        "lampada inteligente",
    ),
    "computadores": (
        "notebook",
        "mouse",
        "teclado",
        "monitor",
        "ssd",
        "pendrive",
        "hub usb",
        "adaptador usb",
        "memoria ram",
        "memória ram",
        "placa de vídeo",
        "placa de video",
        "gabinete",
        "fonte computador",
        "mouse pad",
        "mousepad",
        "webcam",
        "cooler",
        "carregador notebook",
    ),
    "jogos": (
        "video game",
        "videogame",
        "ps5",
        "xbox",
        "controle",
        "console",
        "volante gamer",
        "headset gamer",
        "teclado rgb",
        "mouse rgb",
        "cadeira gamer",
        "mouse gamer",
        "jogo",
        "playstation",
    ),
    "cameras": (
        "camera",
        "câmera",
        "go pro",
        "gopro",
        "tripé",
        "tripod",
        "drones",
        "drone",
        "microfone lapela",
    ),
    "audio": (
        "fone",
        "headphone",
        "earbuds",
        "caixa de som",
        "bluetooth",
        "microfone sem fio",
        "microfone",
        "alto-falante",
        "speaker",
    ),
    "eletrodom": (
        "air fryer",
        "forno elétrico",
        "forno eletrico",
        "micro-ondas",
        "microondas",
        "panela elétrica",
        "panela eletrica",
        "cafeteira",
        "liquidificador",
        "batedeira",
        "aspirador",
        "secador",
        "chapinha",
        "lava e seca",
        "geladeira",
        "freezer",
        "fogão",
        "fogao",
        "coifa",
        "cooktop",
        "ventilador",
    ),
    "casa": (
        "utens",
        "cozinha",
        "organiza",
        "pote",
        "hermético",
        "hermetico",
        "porta temperos",
        "escorredor",
        "toalheiro",
        "organizador",
        "tábua",
        "tabua",
        "ralador",
        "jogo de panelas",
        "frigideira",
        "caçarola",
        "caç̧arola",
        "lençol",
        "lencol",
        "edredom",
        "cortina",
        "tapete",
        "almofada",
        "manta",
        "capa de sofa",
        "capa de sofá",
        "travesseiro",
        "marmita térmica",
        "marmita termica",
    ),
    "alimentos": (
        "café",
        "cafe",
        "chá",
        "cha",
        "barra de proteína",
        "barra de proteina",
        "biscoito",
        "temperos",
        "proteína",
        "proteina",
        "chá mate",
        "cha mate",
    ),
    "beleza": (
        "maquiagem",
        "batom",
        "base facial",
        "corretivo",
        "esponja",
        "perfume",
        "body splash",
        "desodorante",
        "creme corporal",
        "shampoo",
        "condicionador",
        "creme para pentear",
        "óleo capilar",
        "oleo capilar",
        "penteadeira",
        "espelho com led",
        "organizador de maquiagem",
        "maleta de maquiagem",
    ),
    "saude": (
        "massageador",
        "balança",
        "balanca",
        "termômetro",
        "termometro",
        "colágeno",
        "colageno",
        "vitamina c",
        "protetor térmico",
        "protetor termico",
        "aparador de pelos",
        "barbeador",
        "lâmina de barbear",
    ),
    "esporte": (
        "fitness",
        "legging",
        "top fitness",
        "roupa fitness",
        "corda de pular",
        "bicicleta",
        "capacete",
        "luva esportiva",
        "garrafa squeeze",
        "mochila esportiva",
        "halter",
        "faixa elástica",
        "esteira",
    ),
    "bebes": (
        "bebê",
        "bebe",
        "fralda",
        "mamadeira",
        "chupeta",
        "roupinha",
        "body bebê",
        "body bebe",
    ),
    "brinquedos": (
        "brinquedo",
        "boneca",
        "lego",
        "quebra-cabeça",
        "quebra-cabeca",
        "jogo educativo",
        "montessori",
        "pelúcia",
        "pelucia",
        "patinete infantil",
        "skate infantil",
        "blocos de montar",
    ),
    "animais": (
        "pet",
        "ração",
        "racao",
        "coleira",
        "arranhador",
        "petisco",
        "caixa de areia",
        "pá higiênica",
        "pa higiênica",
        "pá higienica",
        "petisco gato",
        "petisco cachorro",
        "ração gato",
        "ração cachorro",
    ),
    "automoveis": (
        "carro",
        "automotivo",
        "volante",
        "suporte celular carro",
        "capa volante",
        "som automotivo",
        "lâmpada automotiva",
        "lampada automotiva",
        "aspirador automotivo",
    ),
    "livros": (
        "livro",
        "caderno",
        "agenda",
        "caneta",
        "literatura",
        "romance",
        "autoajuda",
        "livro infantil",
    ),
    "moda": (
        "relógio",
        "relogio",
        "óculos",
        "oculos",
        "brinco",
        "colar",
        "anel",
        "pulseira",
        "acessório",
        "acessorio",
        "bolsa",
        "óculos de sol",
        "oculos de sol",
    ),
}
PRODUCT_URL_RE = re.compile(r"/(?:product|[^/?#]+)/(\d+)/(\d+)")
DEFAULT_QUERY = """
query SearchProducts($keyword: String, $sortType: Int, $page: Int, $limit: Int, $listType: Int) {
  productOfferV2(keyword: $keyword, sortType: $sortType, page: $page, limit: $limit, listType: $listType) {
    nodes {
      productName
      productLink
      productCatIds
      imageUrl
      offerLink
      productLink
      price
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


def build_payload(keyword: str, sort_type: int, page: int, limit: int, list_type: int) -> str:
    payload = {
        "query": DEFAULT_QUERY,
        "variables": {
            "keyword": keyword,
            "sortType": sort_type,
            "page": page,
            "limit": limit,
            "listType": list_type,
        },
        "operationName": "SearchProducts",
    }
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":"))


def fetch_keyword_products(
    keyword: str,
    app_id: str,
    app_secret: str,
    page: int,
    limit: int,
    sort_type: int,
    list_type: int,
) -> tuple[list[dict[str, Any]], dict[str, Any], dict[str, Any]]:
    payload = build_payload(keyword, sort_type, page, limit, list_type)
    request = shopee_request(app_id, app_secret, payload)
    with urllib.request.urlopen(request, timeout=30) as response:
        data = json.loads(response.read().decode("utf-8", errors="replace"))
    node = data.get("data", {}).get("productOfferV2", {})
    return node.get("nodes", []) or [], node.get("pageInfo", {}) or {}, data


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


def pick_price(*values: Any) -> float | None:
    for value in values:
        price = cents_to_float(value)
        if price is not None and price > 0:
            return price
    return None


def extract_ids_from_url(url: str) -> tuple[int | None, int | None]:
    match = PRODUCT_URL_RE.search(url)
    if not match:
        return None, None
    try:
        return int(match.group(2)), int(match.group(1))
    except ValueError:
        return None, None


def stable_product_id(keyword: str, offer_link: str, product_link: str, product_name: str) -> str:
    basis = offer_link or product_link or f"{keyword}:{product_name}"
    return f"shopee_{hashlib.sha256(basis.encode('utf-8')).hexdigest()[:16]}"


def normalize_product(keyword: str, raw: dict[str, Any], default_category: str) -> dict[str, Any]:
    now_ms = int(time.time() * 1000)
    image = raw.get("imageUrl")
    offer_link = raw.get("offerLink") or raw.get("productLink") or ""
    product_link = raw.get("productLink") or ""
    item_id, shop_id = extract_ids_from_url(offer_link or product_link)
    price = pick_price(raw.get("price"), raw.get("priceMin"), raw.get("priceMax"))
    original_price = pick_price(raw.get("priceMax"), raw.get("price"), raw.get("priceMin"))
    name = raw.get("productName") or "Shopee product"
    product_id = stable_product_id(keyword, offer_link, product_link, name)
    return {
        "id": product_id,
        "name": name,
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
        "shopId": shop_id,
        "keywordsSource": [keyword],
        "createdAt": now_ms,
        "updatedAt": now_ms,
    }


def parse_keywords(value: str | None) -> list[str]:
    if not value:
        return DEFAULT_KEYWORDS
    return [item.strip() for item in value.split(",") if item.strip()]


def parse_keywords_file(path: str | None) -> list[str]:
    if not path:
        return []
    file_path = Path(path)
    if not file_path.exists():
        return []
    lines: list[str] = []
    with file_path.open("r", encoding="utf-8") as handle:
        for raw_line in handle:
            line = raw_line.strip()
            if not line:
                continue
            if "." in line[:4]:
                line = line.split(".", 1)[1].strip()
            if line:
                lines.append(line)
    return lines


def resolve_category_for_keyword(keyword: str, forced_category: str | None = None) -> str:
    if forced_category:
        return forced_category
    normalized = keyword.lower().strip()
    if normalized in DEFAULT_CATEGORY_BY_KEYWORD:
        return DEFAULT_CATEGORY_BY_KEYWORD[normalized]
    for category, rules in CATEGORY_RULES.items():
        if any(token in normalized for token in rules):
            return category
    return "outros"


def get_batch_state(db: firestore.Client, total_batches: int) -> dict[str, int]:
    state_ref = db.collection("meta").document("shopee_import_state")
    snap = state_ref.get()
    if snap.exists:
        data = snap.to_dict() or {}
        try:
            return {
                "batchIndex": int(data.get("batchIndex", 0)) % max(total_batches, 1),
                "cycleStartAt": int(data.get("cycleStartAt", 0) or 0),
                "pausedUntil": int(data.get("pausedUntil", 0) or 0),
            }
        except (TypeError, ValueError):
            return {"batchIndex": 0, "cycleStartAt": 0, "pausedUntil": 0}
    return {"batchIndex": 0, "cycleStartAt": 0, "pausedUntil": 0}


def save_batch_state(db: firestore.Client, next_batch_index: int, cycle_start_at: int, paused_until: int = 0) -> None:
    state_ref = db.collection("meta").document("shopee_import_state")
    state_ref.set(
        {
            "batchIndex": next_batch_index,
            "cycleStartAt": cycle_start_at,
            "pausedUntil": paused_until,
            "updatedAt": int(time.time() * 1000),
        },
        merge=True,
    )


def select_keyword_batch(keywords: list[str], batch_size: int | None, batch_index: int) -> tuple[list[str], int]:
    if not batch_size or batch_size <= 0 or len(keywords) <= batch_size:
        return keywords, 1
    total_batches = ceil(len(keywords) / batch_size)
    batch_index = batch_index % total_batches
    start = batch_index * batch_size
    end = start + batch_size
    return keywords[start:end], total_batches


def main() -> int:
    load_env_file()
    parser = argparse.ArgumentParser(description="Import Shopee products into Firestore by keyword.")
    parser.add_argument("--keywords", help="Comma-separated list of keywords")
    parser.add_argument("--keywords-file", help="Path to a text file with one keyword group per line")
    parser.add_argument("--limit", type=int, default=20, help="Items per page")
    parser.add_argument("--page", type=int, default=1, help="Starting page")
    parser.add_argument("--sort-type", type=int, default=1, help="Shopee sortType (default: latest desc)")
    parser.add_argument("--list-type", type=int, default=1, help="Shopee listType")
    parser.add_argument("--batch-size", type=int, default=0, help="Process only a batch of keywords per run")
    parser.add_argument("--category", help="Force one category for all imported products")
    parser.add_argument("--dry-run", action="store_true", help="Do not write to Firestore")
    args = parser.parse_args()

    app_id = os.getenv("SHOPEE_APP_ID")
    app_secret = os.getenv("SHOPEE_APP_SECRET")
    if not app_id or not app_secret:
        print("SHOPEE_APP_ID and SHOPEE_APP_SECRET are required.", file=sys.stderr)
        return 2

    file_keywords = parse_keywords_file(args.keywords_file)
    base_keywords = file_keywords if file_keywords else parse_keywords(args.keywords)
    db = init_firestore()
    batch_index = 0
    total_batches = 1
    state = {"batchIndex": 0, "cycleStartAt": 0, "pausedUntil": 0}
    now_ms = int(time.time() * 1000)
    if args.batch_size and args.batch_size > 0:
        keywords_preview, total_batches = select_keyword_batch(base_keywords, args.batch_size, 0)
        if total_batches > 1:
            state = get_batch_state(db, total_batches)
            cycle_start_at = state.get("cycleStartAt", 0)
            paused_until = state.get("pausedUntil", 0)
            if paused_until and now_ms < paused_until:
                wait_minutes = max(1, int((paused_until - now_ms) / 60000))
                print(
                    json.dumps(
                        {
                            "event": "batch_paused",
                            "pausedUntil": paused_until,
                            "waitMinutes": wait_minutes,
                        },
                        ensure_ascii=False,
                    ),
                )
                return 0
            if not cycle_start_at or now_ms >= cycle_start_at + 8 * 60 * 60 * 1000:
                cycle_start_at = now_ms
                state = {"batchIndex": 0, "cycleStartAt": cycle_start_at, "pausedUntil": 0}
                save_batch_state(db, 0, cycle_start_at, 0)
            batch_index = state["batchIndex"]
            keywords, total_batches = select_keyword_batch(base_keywords, args.batch_size, batch_index)
        else:
            keywords = keywords_preview
            total_batches = 1
    else:
        keywords = base_keywords
        total_batches = 1
    products_ref = db.collection("products")
    summary = {"keywords": len(keywords), "fetched": 0, "saved": 0, "skipped": 0}
    seen_ids: set[str] = set()

    for keyword in keywords:
        default_category = resolve_category_for_keyword(keyword, args.category)
        try:
            nodes, page_info, raw_response = fetch_keyword_products(
                keyword,
                app_id,
                app_secret,
                args.page,
                args.limit,
                args.sort_type,
                args.list_type,
            )
        except (urllib.error.HTTPError, urllib.error.URLError, json.JSONDecodeError) as exc:
            print(json.dumps({"keyword": keyword, "event": "error", "error": str(exc)}, ensure_ascii=False))
            continue

        print(json.dumps({"keyword": keyword, "event": "fetched", "count": len(nodes), "pageInfo": page_info}, ensure_ascii=False))
        if not nodes:
            print(json.dumps({"keyword": keyword, "event": "empty_response", "response": raw_response}, ensure_ascii=False))

        for raw in nodes:
            product = normalize_product(keyword, raw, default_category)
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

    if args.batch_size and args.batch_size > 0 and total_batches > 1 and not args.dry_run:
        if batch_index + 1 >= total_batches:
            save_batch_state(db, 0, state.get("cycleStartAt", now_ms), state.get("cycleStartAt", now_ms) + 8 * 60 * 60 * 1000)
        else:
            save_batch_state(db, batch_index + 1, state.get("cycleStartAt", now_ms), 0)

    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
