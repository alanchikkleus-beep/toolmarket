import re
import time
from datetime import datetime
from typing import Dict, List, Optional

CACHE: Dict[str, Dict] = {}
CACHE_TTL = 1800

BASE_PRICES = {
    "inserts": {
        "C": (280, 950), "T": (220, 780), "S": (320, 1100),
        "W": (350, 1200), "R": (380, 1300), "D": (260, 900),
        "V": (240, 850), "default": (250, 900),
    },
    "drills":  {"default": (800, 8000)},
    "mills":   {"default": (2000, 25000)},
    "burrs":   {"default": (600, 4500)},
    "reamers": {"default": (1500, 12000)},
}

SIZE_MULT = {
    "06": 0.7, "07": 0.75, "09": 0.85, "11": 0.9,
    "12": 1.0, "16": 1.15, "19": 1.3, "22": 1.5, "25": 1.7,
}

GRADE_MULT = {
    "SM": 1.05, "HM": 1.10, "GM": 1.08, "PM": 1.12,
    "UM": 1.15, "BM": 1.20, "NC": 1.25, "KC": 1.30, "GC": 1.35,
}

BRANDS = [
    ("Korloy",           0.95),
    ("TaeguTec",         1.05),
    ("Dormer Pramet",    1.15),
    ("Seco Tools",       1.40),
    ("Mitsubishi",       1.50),
    ("ISCAR",            1.55),
    ("Kennametal",       1.60),
    ("Sandvik Coromant", 1.80),
]

MARKETPLACES = [
    ("Авито",           "https://www.avito.ru/rossiya?q="),
    ("Яндекс Маркет",   "https://market.yandex.ru/search?text="),
    ("Ozon",            "https://www.ozon.ru/search/?text="),
    ("Wildberries",     "https://www.wildberries.ru/catalog/0/search.aspx?search="),
    ("ВсеИнструменты",  "https://www.vseinstrumenti.ru/search/?q="),
    ("220 Вольт",       "https://www.220-volt.ru/search/?query="),
]


class MarketScraper:

    async def search(self, query: str, category: str = "inserts", limit: int = 24) -> Dict:
        key = f"{query}::{category}"
        cached = CACHE.get(key)
        if cached and time.time() - cached["ts"] < CACHE_TTL:
            r = dict(cached["data"])
            r["from_cache"] = True
            return r

        data = _estimate_market(query, category)
        CACHE[key] = {"ts": time.time(), "data": data}
        return data


def _estimate_market(query: str, category: str) -> Dict:
    ts = datetime.now().strftime("%d.%m.%Y %H:%M")
    q = query.upper().replace("-", " ")
    tokens = q.split()

    cat_prices = BASE_PRICES.get(category, BASE_PRICES["inserts"])
    first_char = tokens[0][0] if tokens else "C"
    lo, hi = cat_prices.get(first_char, cat_prices["default"])

    size_m = 1.0
    full = " ".join(tokens)
    for sz, m in SIZE_MULT.items():
        if sz in full:
            size_m = m
            break

    grade_m = 1.0
    for grade, m in GRADE_MULT.items():
        if grade in full:
            grade_m = m
            break

    base_avg = round((lo + hi) / 2 * size_m * grade_m / 10) * 10
    base_lo  = round(lo * size_m * grade_m / 10) * 10
    base_hi  = round(hi * size_m * grade_m / 10) * 10

    q_enc = query.replace(" ", "+")
    listings: List[Dict] = []

    # Карточки площадок
    for market, base_url in MARKETPLACES:
        listings.append({
            "title": f"Найти «{query}» на {market}",
            "price": None,
            "price_text": "Перейти к поиску →",
            "condition": "unknown",
            "image": "",
            "url": f"{base_url}{q_enc}",
            "location": market,
            "is_marketplace": True,
        })

    # Карточки с оценкой по брендам
    for brand, brand_m in BRANDS:
        price = round(base_avg * brand_m / 10) * 10
        listings.append({
            "title": f"{query} ({brand})",
            "price": price,
            "price_text": f"{price} \u20bd",
            "condition": "new",
            "image": "",
            "url": f"https://www.vseinstrumenti.ru/search/?q={q_enc}",
            "location": brand,
        })

    prices = [x["price"] for x in listings]
    avg = round(sum(prices) / len(prices) / 10) * 10

    return {
        "query": query,
        "listings": listings,
        "stats": {
            "avg_price": avg,
            "min_price": min(prices),
            "max_price": max(prices),
            "offer_count": len(listings),
            "new_count": len(listings),
            "used_count": 0,
            "new_avg": avg,
            "new_min": min(prices),
            "new_max": max(prices),
            "used_avg": None, "used_min": None, "used_max": None,
            "popularity": "Средняя",
            "popularity_level": 3,
        },
        "source": "Рыночная оценка",
        "from_cache": False,
        "timestamp": ts,
        "is_estimate": True,
    }
