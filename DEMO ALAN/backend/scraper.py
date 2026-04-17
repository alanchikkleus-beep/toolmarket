import re
import time
from datetime import datetime
from typing import Dict, List, Optional
import httpx
from bs4 import BeautifulSoup

NEW_WORDS  = {"новый","новая","новое","новые","new","нов.","запечатан","оригинал"}
USED_WORDS = {"б/у","бу","использован","б.у","подержан","восстановлен"}

CACHE: Dict[str, Dict] = {}
CACHE_TTL = 1800

HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
}

SOURCES = [
    ("_fetch_220volt",   "220-volt.ru"),
    ("_fetch_tiu",       "tiu.ru"),
    ("_fetch_price_ru",  "price.ru"),
]


class MarketScraper:

    async def search(self, query: str, category: str = "inserts", limit: int = 24) -> Dict:
        key = f"{query}::{category}"
        cached = CACHE.get(key)
        if cached and time.time() - cached["ts"] < CACHE_TTL:
            r = dict(cached["data"]); r["from_cache"] = True
            return r

        for method_name, _ in SOURCES:
            method = getattr(self, method_name)
            data = await method(query, limit)
            if data.get("listings"):
                CACHE[key] = {"ts": time.time(), "data": data}
                return data

        # All failed — return empty with marketplace links
        ts = datetime.now().strftime("%d.%m.%Y %H:%M")
        result = _empty(query, "Автоматический поиск недоступен — используйте ссылки на площадки", ts)
        CACHE[key] = {"ts": time.time(), "data": result}
        return result

    async def _fetch_220volt(self, query: str, limit: int) -> Dict:
        ts = datetime.now().strftime("%d.%m.%Y %H:%M")
        q = query.replace(" ", "+")
        url = f"https://www.220-volt.ru/search/?query={q}"
        try:
            async with httpx.AsyncClient(timeout=20, follow_redirects=True, headers=HEADERS) as c:
                r = await c.get(url)
                if r.status_code == 200:
                    return _parse_220volt(r.text, query, limit, ts)
                return _empty(query, f"220-volt.ru: {r.status_code}", ts)
        except Exception as e:
            return _empty(query, str(e)[:80], ts)

    async def _fetch_tiu(self, query: str, limit: int) -> Dict:
        ts = datetime.now().strftime("%d.%m.%Y %H:%M")
        url = f"https://tiu.ru/search?search[text]={query}"
        try:
            async with httpx.AsyncClient(timeout=15, follow_redirects=True, headers=HEADERS) as c:
                r = await c.get(url)
                if r.status_code == 200:
                    return _parse_tiu(r.text, query, limit, ts)
                return _empty(query, f"tiu.ru: {r.status_code}", ts)
        except Exception as e:
            return _empty(query, str(e)[:80], ts)

    async def _fetch_price_ru(self, query: str, limit: int) -> Dict:
        ts = datetime.now().strftime("%d.%m.%Y %H:%M")
        q = query.replace(" ", "+")
        url = f"https://price.ru/search/?text={q}"
        try:
            async with httpx.AsyncClient(timeout=15, follow_redirects=True, headers=HEADERS) as c:
                r = await c.get(url)
                if r.status_code == 200:
                    return _parse_price_ru(r.text, query, limit, ts)
                return _empty(query, f"price.ru: {r.status_code}", ts)
        except Exception as e:
            return _empty(query, str(e)[:80], ts)


def _parse_220volt(html: str, query: str, limit: int, ts: str) -> Dict:
    soup = BeautifulSoup(html, "lxml")
    listings: List[Dict] = []

    cards = soup.select(".product-card, .product_card, [class*='ProductCard'], [class*='product-item']")
    if not cards:
        cards = soup.select("[data-product-id], [data-id], .item")

    for card in cards[:limit]:
        title_el = card.select_one("a[class*='name'], a[class*='title'], [class*='name'] a, h3 a, h2 a")
        title = title_el.get_text(strip=True) if title_el else ""
        if not title or len(title) < 3:
            continue

        price_el = card.select_one("[class*='price'], [class*='Price'], [class*='cost']")
        price_text = price_el.get_text(strip=True) if price_el else "Цена не указана"
        price = _num(price_text)

        img_el = card.select_one("img")
        image = _get_img(img_el)

        link_el = card.select_one("a[href]")
        href = _fix_url(link_el["href"] if link_el else "", "https://www.220-volt.ru")

        listings.append({
            "title": title, "price": price,
            "price_text": price_text if price else "Цена не указана",
            "condition": "new", "image": image,
            "url": href, "location": "220-volt.ru",
        })

    return _build_result(query, listings, "220-volt.ru", ts)


def _parse_tiu(html: str, query: str, limit: int, ts: str) -> Dict:
    soup = BeautifulSoup(html, "lxml")
    listings: List[Dict] = []

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
        image = _get_img(img_el)

        link_el = card.select_one("a[href]")
        href = _fix_url(link_el["href"] if link_el else "", "https://tiu.ru")

        listings.append({
            "title": title, "price": price,
            "price_text": price_text if price else "Цена не указана",
            "condition": _cond(title), "image": image,
            "url": href, "location": "tiu.ru",
        })

    return _build_result(query, listings, "tiu.ru", ts)


def _parse_price_ru(html: str, query: str, limit: int, ts: str) -> Dict:
    soup = BeautifulSoup(html, "lxml")
    listings: List[Dict] = []

    cards = soup.select(".offer, .product, [class*='offer'], [class*='product']")

    for card in cards[:limit]:
        title_el = card.select_one("a[class*='name'], a[class*='title'], h3 a, h2 a, a")
        title = title_el.get_text(strip=True) if title_el else ""
        if not title or len(title) < 3:
            continue

        price_el = card.select_one("[class*='price'], [class*='Price']")
        price_text = price_el.get_text(strip=True) if price_el else "Цена не указана"
        price = _num(price_text)

        link_el = card.select_one("a[href]")
        href = _fix_url(link_el["href"] if link_el else "", "https://price.ru")

        listings.append({
            "title": title, "price": price,
            "price_text": price_text if price else "Цена не указана",
            "condition": _cond(title), "image": "",
            "url": href, "location": "price.ru",
        })

    return _build_result(query, listings, "price.ru", ts)


def _build_result(query, listings, source, ts):
    prices_all  = [x["price"] for x in listings if x["price"]]
    prices_new  = [x["price"] for x in listings if x["price"] and x["condition"] == "new"]
    prices_used = [x["price"] for x in listings if x["price"] and x["condition"] == "used"]
    return {
        "query": query, "listings": listings,
        "stats": _stats(prices_all, prices_new, prices_used, len(listings)),
        "source": source, "from_cache": False, "timestamp": ts,
    }


def _get_img(img_el) -> str:
    if not img_el:
        return ""
    src = img_el.get("src") or img_el.get("data-src") or img_el.get("data-lazy") or ""
    if src.startswith("//"):
        src = "https:" + src
    return src if src.startswith("http") else ""


def _fix_url(href, base) -> str:
    if not href:
        return ""
    if href.startswith("http"):
        return h
