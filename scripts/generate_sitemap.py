import datetime
import xml.etree.ElementTree as ET
from xml.dom import minidom

import requests

# Configurações do Projeto
PROJECT_ID = "vendas-f54d4"
BASE_URL = "https://melhoresdashopee.com.br/"


def normalize_text(text):
    import unicodedata

    if not text:
        return ""
    text = unicodedata.normalize("NFD", text).encode("ascii", "ignore").decode("utf-8")
    return text.lower()


def slugify(text):
    import re

    text = normalize_text(text)
    text = re.sub(r"\s+", "-", text)
    text = re.sub(r"[^\w-]+", "", text)
    return text


def fetch_products():
    url = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents/shopee_products"
    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        products = []
        for doc in data.get("documents", []):
            fields = doc.get("fields", {})
            name = fields.get("name", {}).get("stringValue", "")
            if name:
                products.append({"name": name})
        return products
    except Exception as e:
        print(f"Erro ao buscar produtos: {e}")
        return []


def generate_sitemap(products):
    urlset = ET.Element("urlset", xmlns="http://www.sitemaps.org/schemas/sitemap/0.9")

    # Páginas Estáticas
    static_pages = [
        {"loc": "", "priority": "1.0", "changefreq": "daily"},
        {"loc": "categoria.html", "priority": "0.8", "changefreq": "daily"},
        {"loc": "como-funciona.html", "priority": "0.5", "changefreq": "monthly"},
        {"loc": "politica-privacidade.html", "priority": "0.3", "changefreq": "monthly"},
        {"loc": "termos-de-uso.html", "priority": "0.3", "changefreq": "monthly"},
    ]

    today = datetime.date.today().isoformat()

    for page in static_pages:
        url = ET.SubElement(urlset, "url")
        ET.SubElement(url, "loc").text = f"{BASE_URL}{page['loc']}"
        ET.SubElement(url, "lastmod").text = today
        ET.SubElement(url, "changefreq").text = page["changefreq"]
        ET.SubElement(url, "priority").text = page["priority"]

    # Páginas de Produtos (Dinâmicas)
    for p in products:
        url = ET.SubElement(urlset, "url")
        slug = slugify(p["name"])
        ET.SubElement(url, "loc").text = f"{BASE_URL}?p={slug}"
        ET.SubElement(url, "lastmod").text = today
        ET.SubElement(url, "changefreq").text = "weekly"
        ET.SubElement(url, "priority").text = "0.7"

    # Formatação XML
    xml_str = ET.tostring(urlset, encoding="utf-8")
    parsed = minidom.parseString(xml_str)
    pretty_xml = parsed.toprettyxml(indent="  ")

    with open("sitemap.xml", "w", encoding="utf-8") as f:
        f.write(pretty_xml)
    print("Sitemap.xml gerado com sucesso!")


if __name__ == "__main__":
    print("Iniciando geracao de sitemap...")
    prods = fetch_products()
    generate_sitemap(prods)
