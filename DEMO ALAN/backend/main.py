import os
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from scraper import MarketScraper
from compatibility import CompatibilityDB

app = FastAPI(title="ToolMarket Monitor", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

scraper = MarketScraper()
compat = CompatibilityDB()

FRONTEND = os.path.join(os.path.dirname(__file__), "..", "frontend")


@app.get("/api/ping")
async def ping():
    return {"status": "ok"}


@app.get("/api/market")
async def market(
    q: str = Query(...),
    category: str = Query("inserts"),
    limit: int = Query(24, ge=1, le=50),
):
    return await scraper.search(q, category, limit)


@app.get("/api/compatibility/{insert_code}")
async def get_compat(insert_code: str):
    r = compat.get_compatibility(insert_code)
    if "error" in r:
        raise HTTPException(400, r["error"])
    return r


@app.get("/api/holders")
async def get_holders():
    return compat.get_holders()


@app.get("/api/insert-types")
async def get_insert_types():
    return compat.get_insert_types()


@app.get("/api/categories")
async def get_categories():
    return compat.get_categories()


@app.get("/api/search-by-holder")
async def search_by_holder(prefix: str = Query(...)):
    return compat.search_by_holder(prefix)


if os.path.isdir(FRONTEND):
    app.mount("/static", StaticFiles(directory=FRONTEND), name="static")

    @app.get("/")
    async def index():
        return FileResponse(os.path.join(FRONTEND, "index.html"))

    @app.get("/{path:path}")
    async def spa(path: str):
        fp = os.path.join(FRONTEND, path)
        if os.path.isfile(fp):
            return FileResponse(fp)
        return FileResponse(os.path.join(FRONTEND, "index.html"))


if __name__ == "__main__":
    import uvicorn, os
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
