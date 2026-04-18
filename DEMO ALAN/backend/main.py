import os
from fastapi import FastAPI, Query, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from scraper import MarketScraper
from compatibility import CompatibilityDB
import auth

app = FastAPI(title="ToolMarket Monitor", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"], allow_credentials=True)

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
    cat_data = compat.get_categories().get(category, {})
    keywords = cat_data.get("search_keywords", [])
    search_q = f"{keywords[0]} {q}" if keywords else q
    return await scraper.search(search_q, category, limit)


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


# ── Auth ──
@app.post("/api/auth/register")
async def register(request: Request, response: Response):
    data = await request.json()
    return auth.register(data.get("email", ""), data.get("password", ""), response)


@app.post("/api/auth/login")
async def login(request: Request, response: Response):
    data = await request.json()
    return auth.login(data.get("email", ""), data.get("password", ""), response)


@app.post("/api/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session")
    return auth.logout(token, response)


@app.get("/api/auth/me")
async def me(request: Request):
    token = request.cookies.get("session")
    return auth.get_me(token)


@app.post("/api/auth/forgot")
async def forgot(request: Request):
    data = await request.json()
    return auth.create_reset_token(data.get("email", ""))


@app.post("/api/auth/reset")
async def reset(request: Request):
    data = await request.json()
    return auth.reset_password(data.get("token", ""), data.get("password", ""))


# ── Watchlist ──
@app.get("/api/watchlist")
async def get_watchlist(request: Request):
    token = request.cookies.get("session")
    return auth.get_watchlist(token)


@app.post("/api/watchlist")
async def add_watchlist(request: Request):
    token = request.cookies.get("session")
    data = await request.json()
    return auth.add_watchlist(token, data)


@app.delete("/api/watchlist/{query}")
async def del_watchlist(query: str, request: Request):
    token = request.cookies.get("session")
    return auth.delete_watchlist(token, query)


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
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
