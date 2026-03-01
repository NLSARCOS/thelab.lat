from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sys, json, sqlite3
sys.path.insert(0, '/var/www/thelab.lat')
from api_seo_engine import SEOEngine
import uvicorn

DB_PATH = '/var/www/thelab.lat/thelab.db'

app = FastAPI(title='TheLab.lat SEO API')
app.add_middleware(CORSMiddleware, allow_origins=['*'], allow_methods=['*'], allow_headers=['*'])
engine = SEOEngine()

class SEORequest(BaseModel):
    url: str
    shop_url: str = "guest"

@app.post('/api/seo-optimize')
async def optimize(req: SEORequest):
    result = engine.run(req.url)
    if result.get("success"):
        # Guardar en la DB para persistencia del cliente
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO scans (shop_url, title, original_desc, optimized_desc, status)
                VALUES (?, ?, ?, ?, ?)
            """, (req.shop_url, result["product"]["title"], result["product"]["description"], result["seo_content"], "completed"))
            conn.commit()
    return result

@app.get('/api/history/{shop_url}')
async def get_history(shop_url: str):
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM scans WHERE shop_url = ? ORDER BY created_at DESC", (shop_url,))
        return [dict(row) for row in cursor.fetchall()]

@app.get('/health')
async def health():
    return {'status': 'ok', 'model': 'qwen2.5:7b', 'engine': 'ollama', 'db': 'active'}

if __name__ == '__main__':
    uvicorn.run(app, host='127.0.0.1', port=8001)
