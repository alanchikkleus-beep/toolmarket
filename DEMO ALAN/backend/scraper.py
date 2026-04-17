import re
import time
import asyncio
from datetime import datetime
from typing import Dict, List, Optional
import httpx
from bs4 import BeautifulSoup

NEW_WORDS  = {"новый","новая","новое","новые","new","нов.","запечатан","оригинал"}
USED_WORDS = {"б/у","бу","использован","б.у","подержан","восстановлен"}

CACHE: Dict[str, Dict] = {}
CACHE_TTL = 1800

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept-Language": "ru-RU,ru;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}


class MarketScraper:

    async def search(self, query: str, category: str = "inserts", limit: int = 24) -> Dict:
        key = f"{query}::{category}"
        cached = CACHE.get(key)
        if cached and time.time() - cached["ts"] < CACHE_TTL:
            r = dict(cached["data"]); r["from_cache"] = True
            return r

        data = await self._fetch_tiu(query, limit)
        CACHE[key] = {"ts": time.time(), "data": data}
        return data

    async def _fetch_tiu(self, query: str, limit: int) -> Dict:
        ts  = datetime.now().strftime("%d.%m.%Y %H:%M")
        url = f"https://tiu.ru/search?search[text]={query}"
        avito_url = f"https://www.avito.ru/rossiya?q={query.replace(' ','+')}"

        try:
            async with httpx.AsyncClient(timeout=20, follow_redirects=True, headers=HEADERS) as c:
                r = await c.get(url)
                if r.status_code == 200:
                    return _parse_tiu(r.text, query, limit, ts, avito_url)
                return _empty(query, f"tiu.ru вернул {r.status_code}", ts, avito_url)
        except Exception as e:
            return _empty(query, str(e)[:80], ts, avito_url)


def _parse_tiu(html: str, query: str, limit: int, ts: str, avito_url: str) -> Dict:
    soup = BeautifulSoup(html, "lxml")
    listings: List[Dict] = []

    # tiu.ru product cards
    cards = soup.select(".product-item, [class*='product_item'], .catalog-item, [data-product-id]")
    if not cards:
        cards = soup.select("li.item, div.item, .goods-item")

    for card in cards[:limit]:
        title_el = card.select_one("a.product-name, .product-item__name, h3 a, h2 a, .name a, a[class*='name']")
        title = title_el.get_text(strip=True) if title_el else ""
        if not title:
            continue

        price_el = card.select_one(".price, [class*='price'], .cost")
        price_text = price_el.get_text(strip=True) if price_el else "Цена не указана"
        price = _num(price_text)

        img_el = card.select_one("img")
        image = ""
        if img_el:
            image = img_el.get("src") or img_el.get("data-src") or img_el.get("data-lazy-src") or ""
            if image.startswith("//"):
                image = "https:" + image

        link_el = card.select_one("a[href]")
        href = link_el["href"] if link_el else ""
        if href and not href.startswith("http"):
            href = "https://tiu.ru" + href

        listings.append({
            "title": title,
            "price": price,
            "price_text": price_text if price else "Цена не указана",
            "condition": _cond(title),
            "image": image,
            "url": href,
            "location": "tiu.ru",
        })

    prices_all  = [x["price"] for x in listings if x["price"]]
    prices_new  = [x["price"] for x in listings if x["price"] and x["condition"] == "new"]
    prices_used = [x["price"] for x in listings if x["price"] and x["condition"] == "used"]

    return {
        "query": query,
        "listings": listings,
        "stats": _stats(prices_all, prices_new, prices_used, len(listings)),
        "source": "tiu.ru",
        "avito_url": avito_url,
        "from_cache": False,
        "timestamp": ts,
    }


def _cond(text: str) -> str:
    low = text.lower()
    if any(w in low for w in USED_WORDS): return "used"
    if any(w in low for w in NEW_WORDS):  return "new"
    return "unknown"

def _num(s: str) -> Optional[float]:
    c = re.sub(r"[^\d]", "", s)
    try:
        v = float(c)
        return v if 10 < v < 9_000_000 else None
    except: return None

def _stats(all_p, new_p, used_p, count) -> Dict:
    lvl = (5 if count>=50 else 4 if count>=20 else 3 if count>=10 else 2 if count>=3 else 1 if count>0 else 0)
    labels = ["Нет данных","Редкий товар","Низкая","Средняя","Высокая","Очень высокая"]
    def s(p): return (round(sum(p)/len(p)), int(min(p)), int(max(p))) if p else (None,None,None)
    a,mn,mx=s(all_p); na,nmn,nmx=s(new_p); ua,umn,umx=s(used_p)
    return {"avg_price":a,"min_price":mn,"max_price":mx,"offer_count":count,
            "new_count":len(new_p),"used_count":len(used_p),
            "new_avg":na,"new_min":nmn,"new_max":nmx,
            "used_avg":ua,"used_min":umn,"used_max":umx,
            "popularity":labels[lvl],"popularity_level":lvl}

def _empty(query, error, ts, avito_url="") -> Dict:
    return {"query":query,"listings":[],"avito_url":avito_url,
            "stats":{"avg_price":None,"min_price":None,"max_price":None,
                     "offer_count":0,"new_count":0,"used_count":0,
                     "new_avg":None,"new_min":None,"new_max":None,
                     "used_avg":None,"used_min":None,"used_max":None,
                     "popularity":"Нет данных","popularity_level":0},
            "source":"tiu.ru","from_cache":False,"error":error,"timestamp":ts}
