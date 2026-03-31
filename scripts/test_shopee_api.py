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
query TestProductOffer($keyword: String!, $page: Int!, $limit: Int!, $sortType: Int!, $listType: Int!) {
  productOfferV2(keyword: $keyword, page: $page, limit: $limit, sortType: $sortType, listType: $listType) {
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


def build_payload(query: str, variables: dict[str, object] | None, operation_name: str | None) -> dict[str, object]:
    payload: dict[str, object] = {"query": query}
    if variables:
        payload["variables"] = variables
    if operation_name:
        payload["operationName"] = operation_name
    return payload


def build_request(
    url: str,
    app_id: str | None,
    app_secret: str | None,
    query: str,
    variables: dict[str, object] | None,
    operation_name: str | None,
) -> urllib.request.Request:
    if not app_id or not app_secret:
        raise ValueError("SHOPEE_APP_ID and SHOPEE_APP_SECRET are required for the signed GraphQL request.")

    payload_obj = build_payload(query, variables, operation_name)
    payload_text = json.dumps(payload_obj, ensure_ascii=False, separators=(",", ":"))
    timestamp = str(int(time.time()))
    signature = sha256_hex(f"{app_id}{timestamp}{payload_text}{app_secret}")

    headers: dict[str, str] = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": "PYTHON_ECOMMERCE_API_Tester/2.0",
        "Authorization": f"SHA256 Credential={app_id}, Timestamp={timestamp}, Signature={signature}",
    }

    body = payload_text.encode("utf-8")
    return urllib.request.Request(url, data=body, headers=headers, method="POST")


def print_response(status: int, headers: dict[str, str], body: bytes) -> None:
    print(f"Status: {status}")
    print("Headers:")
    for key, value in headers.items():
        print(f"  {key}: {value}")

    text = body.decode("utf-8", errors="replace")
    print("\nBody:")
    try:
        parsed = json.loads(text)
        print(json.dumps(parsed, ensure_ascii=False, indent=2))
    except json.JSONDecodeError:
        print(text)


def main() -> int:
    load_env_file()

    parser = argparse.ArgumentParser(description="Test the Shopee affiliate API endpoint.")
    parser.add_argument("--url", default=os.getenv("SHOPEE_API_URL", DEFAULT_URL), help="API URL to test")
    parser.add_argument("--app-id", default=os.getenv("SHOPEE_APP_ID"), help="Shopee App ID")
    parser.add_argument("--app-secret", default=os.getenv("SHOPEE_APP_SECRET"), help="Shopee App Secret")
    parser.add_argument("--query", default=DEFAULT_QUERY, help="GraphQL query to execute")
    parser.add_argument(
        "--variables",
        default='{"keyword":"produto","page":1,"limit":10,"sortType":5,"listType":1}',
        help="GraphQL variables as JSON string",
    )
    parser.add_argument("--operation-name", default="TestProductOffer", help="GraphQL operation name")
    parser.add_argument("--timeout", type=int, default=30, help="Request timeout in seconds")
    args = parser.parse_args()

    try:
        variables = json.loads(args.variables) if args.variables else None
        if variables is not None and not isinstance(variables, dict):
            raise ValueError("--variables must be a JSON object.")
    except (json.JSONDecodeError, ValueError) as exc:
        print(f"Invalid --variables value: {exc}", file=sys.stderr)
        return 2

    try:
        request = build_request(
            args.url,
            args.app_id,
            args.app_secret,
            args.query,
            variables,
            args.operation_name,
        )
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 2

    try:
        with urllib.request.urlopen(request, timeout=args.timeout) as response:
            body = response.read()
            print_response(response.status, dict(response.headers.items()), body)
        return 0
    except urllib.error.HTTPError as exc:
        body = exc.read()
        print_response(exc.code, dict(exc.headers.items()), body)
        return 1
    except urllib.error.URLError as exc:
        print(f"Request failed: {exc.reason}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
