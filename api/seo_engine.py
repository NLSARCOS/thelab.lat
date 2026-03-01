import sys
import requests
from bs4 import BeautifulSoup
import json

OLLAMA_URL = "http://127.0.0.1:11434/api/generate"
MODEL = "kimi-k2.5:cloud"  # Kimi Cloud configurado por Nelson en el VPS

class SEOEngine:
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }

    def scrape_product(self, url):
        try:
            r = requests.get(url, headers=self.headers, timeout=15)
            r.raise_for_status()
            soup = BeautifulSoup(r.text, 'html.parser')

            title = soup.find('meta', property='og:title')
            title = title['content'] if title else (soup.title.string if soup.title else "Producto sin título")

            desc = soup.find('meta', property='og:description')
            desc = desc['content'] if desc else ""

            price_meta = soup.find('meta', property='og:price:amount')
            price = price_meta['content'] if price_meta else "N/A"

            return {"success": True, "data": {"title": title.strip(), "description": desc.strip(), "price": price, "url": url}}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def generate_seo(self, product):
        prompt = f"""Eres un experto en SEO y copywriting para Shopify. Optimiza este producto para maximizar ventas y posicionamiento.

PRODUCTO: {product['title']}
DESCRIPCIÓN ACTUAL: {product['description'] or 'Sin descripción'}
PRECIO: {product['price']}

Genera exactamente esto en español:

## TÍTULO SEO (máx 70 caracteres):
[título optimizado]

## DESCRIPCIÓN PAS:
**Problema:** [descripción del problema del cliente]
**Agitación:** [por qué es urgente resolverlo]
**Solución:** [cómo este producto lo resuelve]

## 5 BENEFICIOS CLAVE:
- [beneficio 1]
- [beneficio 2]
- [beneficio 3]
- [beneficio 4]
- [beneficio 5]

## META DESCRIPTION (máx 160 caracteres):
[meta description]

## KEYWORDS:
[keyword1], [keyword2], [keyword3], [keyword4], [keyword5]"""

        try:
            r = requests.post(OLLAMA_URL, json={"model": MODEL, "prompt": prompt, "stream": False}, timeout=120)
            r.raise_for_status()
            return r.json().get("response", "Error generando contenido")
        except Exception as e:
            return f"Error IA: {str(e)}"

    def run(self, url):
        scrape = self.scrape_product(url)
        if not scrape["success"]:
            return scrape
        seo = self.generate_seo(scrape["data"])
        return {"success": True, "product": scrape["data"], "seo_content": seo}


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python3 seo_engine.py <url>")
        sys.exit(1)
    engine = SEOEngine()
    result = engine.run(sys.argv[1])
    print(json.dumps(result, indent=2, ensure_ascii=False))
