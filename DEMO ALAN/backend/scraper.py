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
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
}

# Базовые цены (₽) по типам инструментов
BASE_PRICES = {
    # Пластины ISO — цена за штуку
    "inserts": {
        "C": (280, 950),   # ромб 80°
        "T": (220, 780),   # треугольник
        "S": (320, 1100),  # квадрат
        "W": (350, 1200),  # треугольник 80°
        "R": (380, 1300),  # круглая
        "D": (260, 900),   # ромб 55°
        "V": (240, 850),   # ромб 35°
        "default": (250, 900),
    },
    # Сверла — цена за штуку
    "drills": {"default": (800, 8000)},
    # Фрезы
    "mills": {"default": (2000, 25000)},
    # Борфрезы
    "burrs": {"default": (600, 4500)},
    # Развертки
    "reamers": {"default": (1500, 12000)},
}

# Мультипликаторы по размеру пластины
SIZE_MULT = {
    "06": 0.7, "07": 0.75, "09": 0.85,
    "11": 0.9, "12": 1.0,  "16": 1.15,
    "19": 1.3, "22": 1.5,  "25": 1.7,
}

# Мультипликаторы по марке/покрытию
GRADE_MULT = {
    "SM": 1.05, "HM": 1.10, "GM": 1.08,
    "PM": 1.12, "UM": 1.15, "BM": 1.20,
    "NC": 1.25, "KC": 1.30, "GC": 1.35,
}

POPULAR_BRANDS = [
    ("Sandvik Coromant", 1.8),
    ("Kennametal", 1.6),
    ("ISCAR", 1.5),
    ("Mitsubishi", 1.55),
    ("Seco Tools", 1.45),
    ("Korloy", 1.0),
    ("Dormer Pramet", 1.2),
    ("TaeguTec", 1.1),
]


class MarketScraper:

    async def search(self, query: str, category: str = "inserts", limit: int = 24) -> Dict:
        key = f"{query}::{category}"
        cached = CACHE.get(key)
        if cached and time.time() - cached["ts"] < CACHE_TTL:
            r = dict(cached["data"]); r["from_cache"] = True
            return r

        # Параллельный поиск с коротким таймаутом
        tasks = [
            self._fetch_tiu(query, limit),
            self._fetch_220volt(query, limit),
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        for r in results:
            if isinstance(r, dict) and r.get("listings"):
                CACHE[key] = {"ts": time.time(), "data": r}
                return r

        # Фолбэк: рыночная оценка по базе
        data = _estimate_market(query, category)
        CACHE[key] = {"ts": time.time(), "data": data}
        return data

    async def _fetch_tiu(self, query: str, limit: int) -> Dict:
        ts = datetime.now().strftime("%d.%m.%Y %H:%M")
        url = f"https://tiu.ru/search?search[text]={query}"
        try:
            async with httpx.AsyncClient(timeout=8, follow_redirects=True, headers=HEADERS) as c:
                r = await c.get(url)
                if r.status_code == 200:
                    return _parse_tiu(r.text, query, limit, ts)
                return _empty(query, f"tiu.ru: {r.status_code}", ts)
        except Exception as e:
            return _empty(query, str(e)[:60], ts)

    async def _fetch_220volt(self, query: str, limit: int) -> Dict:
        ts = datetime.now().strftime("%d.%m.%Y %H:%M")
        q = query.replace(" ", "+")
        url = f"https://www.220-volt.ru/search/?query={q}"
        try:
            async with httpx.AsyncClient(timeout=8, follow_redirects=True, headers=HEADERS) as c:
                r = await c.get(url)
                if r.status_code == 200:
                    return _parse_220volt(r.text, query, limit, ts)
                return _empty(query, f"220-volt.ru: {r.status_code}", ts)
        except Exception as e:
            return _empty(query, str(e)[:60], ts)


def _estimate_market(query: str, category: str) -> Dict:
    """Рыночная оценка на основе кода инструмента."""
    ts = datetime.now().strftime("%d.%m.%Y %H:%M")
    q = query.upper().replace("-", " ")
    tokens = q.split()

    cat_prices = BASE_PRICES.get(category, BASE_PRICES["inserts"])

    # Определяем базовую цену по первой букве (форма пластины)
    first_char = tokens[0][0] if tokens else "C"
    lo, hi = cat_prices.get(first_char, cat_prices["default"])

    # Размерный мультипликатор
    size_m = 1.0
    for t in tokens:
        for sz, m in SIZE_MULT.items():
            if sz in t:
                size_m = m
                break

    # Мультипликатор марки
    grade_m = 1.0
    full = " ".join(tokens)
    for grade, m in GRADE_MULT.items():
        if grade in full:
            grade_m = m
            break

    # Рассчитываем диапазон
    base_lo = round(lo * size_m * grade_m / 10) * 10
    base_hi = round(hi * size_m * grade_m / 10) * 10
    base_avg = round((base_lo + base_hi) / 2 / 10) * 10

    # Генерируем листинги по брендам
    listings: List[Dict] = []
    for brand, brand_m in POPULAR_BRANDS:
        price = round(base_avg * brand_m / 10) * 10
        price_lo = round(base_lo * brand_m / 10) * 10
        price_hi = round(base_hi * brand_m / 10) * 10
        listings.append({
            "title": f"{query} | {brand} (рыночная оценка)",
            "price": price,
            "price_text": f"{price:,} ₽".replace(",", " "),
            "condition": "new",
            "image": "",
            "url": f"https://www.vseinstrumenti.ru/search/?q={query.replace(' ', '+')}",
            "location": brand,
            "estimated": True,
        })

    prices = [x["price"] for x in listings]
    all_lo = min(prices)
    all_hi = max(prices)
    all_avg = round(sum(prices) / len(prices))

    return {
        "query": query,
        "listings": listings,
        "stats": {
            "avg_price": all_avg,
            "min_price": all_lo,
            "max_price": all_hi,
            "offer_count": len(listings),
            "new_count": len(listings),
            "used_count": 0,
            "new_avg": all_avg,
            "new_min": all_lo,
            "new_max": all_hi,
            "used_avg": None, "used_min": None, "used_max": None,
            "popularity": "Средняя",
            "popularity_level": 3,
        },
        "source": "Рыночная оценка",
        "from_cache": False,
        "timestamp": ts,
        "is_estimate": True,
    }


def _parse_tiu(html: str, query: str, limit: int, ts: str) -> Dict:
    soup = BeautifulSoup(html, "lxml")
    listings: List[Dict] = []
    cards = soup.select(".product-item, [class*='product_item'], .catalog-item, [data-product-id]")
    if not cards:
        cards = soup.select("li.item, div.item, .goods-item")
    for card in cards[:limit]:
        title_el = card.select_one("a.product-name, .product-item__name, h3 a, h2 a, .name a, a[class*='name']")
        title = title_el.get_text(strip=True) if title_el else ""
        if not title: continue
        price_el = card.select_one(".price, [class*='price'], .cost")
        price_text = price_el.get_text(strip=True) if price_el else "Цена не указана"
        price = _num(price_text)
        img_el = card.select_one("img")
        image = _get_img(img_el)
        link_el = card.select_one("a[href]")
        href = _fix_url(link_el["href"] if link_el else "", "https://tiu.ru")
        listings.append({"title": title, "price": price,
            "price_text": price_text if price else "Цена не указана",
            "condition": _cond(title), "image": image, "url": href, "location": "tiu.ru"})
    return _build_result(query, listings, "tiu.ru", ts)


def _parse_220volt(html: str, query: str, limit: int, ts: str) -> Dict:
    soup = BeautifulSoup(html, "lxml")
    listings: List[Dict] = []
    cards = soup.select(".product-card, [class*='ProductCard'], [class*='product-item'], [data-product-id]")
    if not cards:
        cards = soup.select("[data-id], .item")
    for card in cards[:limit]:
        title_el = card.select_one("a[class*='name'], a[class*='tit
