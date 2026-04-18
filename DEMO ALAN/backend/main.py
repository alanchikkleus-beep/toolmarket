import os
from fastapi import FastAPI, Query, Request, Response, Cookie
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import scraper
import compatibility
import auth

auth.init_db()

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

FRONTEND = os.path.join(os.path.dirname(__file__), "..", "frontend")
app.mount("/static", StaticFiles(directory=FRONTEND), name="static")

@app.get("/")
async def root(): return FileResponse(os.path.join(FRONTEND, "index.html"))

@app.get("/style.css")
async def css(): return FileResponse(os.path.join(FRONTEND, "style.css"))

@app.get("/app.js")
async def js(): return FileResponse(os.path.join(FRONTEND, "app.js"))

@app.get("/favicon.ico")
async def favicon(): return FileResponse(os.path.join(FRONTEND, "favicon.ico"))

class AuthBody(BaseModel):
    email: str
    password: str

@app.post("/api/auth/register")
async def register(body: AuthBody, response: Response):
    result = auth.create_user(body.email, body.password)
    if result["ok"]:
        login = auth.login_user(body.email, body.password)
        response.set_cookie("session", login["token"], max_age=30*24*3600, httponly=True, samesite="lax")
        return {"ok": True, "email": body.email}
    return JSONResponse(status_code=400, content=result)

@app.post("/api/auth/login")
async def login(body: AuthBody, response: Response):
    result = auth.login_user(body.email, body.password)
    if result["ok"]:
        response.set_cookie("session", result["token"], max_age=30*24*3600, httponly=True, samesite="lax")
        return {"ok": True, "email": result["email"]}
    return JSONResponse(status_code=401, content=result)

@app.post("/api/auth/logout")
async def logout(response: Response, session: Optional[str] = Cookie(None)):
    if session: auth.logout_user(session)
    response.delete_cookie("session")
    return {"ok": True}

@app.get("/api/auth/me")
async def me(session: Optional[str] = Cookie(None)):
    user = auth.get_user_by_token(session)
    if not user: return JSONResponse(status_code=401, content={"ok": False})
    return {"ok": True, "email": user["email"], "id": user["id"]}

class WatchBody(BaseModel):
    query: str
    category: str
    price: Optional[float] = None

@app.get("/api/watchlist")
async def get_watchlist(session: Optional[str] = Cookie(None)):
    user = auth.get_user_by_token(session)
    if not user: return JSONResponse(status_code=401, content={"ok": False})
    return auth.get_watchlist(user["id"])

@app.post("/api/watchlist")
async def add_watchlist(body: WatchBody, session: Optional[str] = Cookie(None)):
    user = auth.get_user_by_token(session)
    if not user: return JSONResponse(status_code=401, content={"ok": False})
    if body.price: auth.add_price_history(user["id"], body.query, body.category, body.price)
    return auth.add_to_watchlist(user["id"], body.query, body.category, body.price)

@app.delete("/api/watchlist")
async def remove_watchlist(body: WatchBody, session: Optional[str] = Cookie(None)):
    user = auth.get_user_by_token(session)
    if not user: return JSONResponse(status_code=401, content={"ok": False})
    return auth.remove_from_watchlist(user["id"], body.query, body.category)

@app.get("/api/watchlist/history")
async def price_history(q: str, category: str, session: Optional[str] = Cookie(None)):
    user = auth.get_user_by_token(session)
    if not user: return JSONResponse(status_code=401, content={"ok": False})
    return auth.get_price_history(user["id"], q, category)

@app.get("/api/market")
async def market(q: str = Query(...), category: str = Query("inserts"), limit: int = Query(24, ge=1, le=50)):
    return await scraper.search(q, category, limit)

@app.get("/api/compatibility/{insert_code}")
async def compat(insert_code: str):
    return compatibility.get_compatibility(insert_code)

@app.get("/api/insert-types")
async def insert_types():
    return compatibility.get_insert_types()

@app.get("/api/holders")
async def holders():
    return compatibility.get_all_holders()

@app.get("/api/categories")
async def categories():
    return compatibility.get_categories()

@app.get("/api/search-by-holder")
async def search_by_holder(prefix: str = Query(...)):
    return compatibility.search_by_holder(prefix)
