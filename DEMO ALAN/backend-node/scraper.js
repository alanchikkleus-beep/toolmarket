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
    "drills":      {"default": (800, 8000)},
    "mills":       {"default": (2000, 25000)},
    "burrs":       {"default": (600, 4500)},
    "reamers":     {"default": (1500, 12000)},
    "threading":   {"default": (350, 3500)},
    "tooling":     {"default": (900, 18000)},
    "measuring":   {"default": (700, 60000)},
    "toolholders": {"default": (1500, 14000)},
    "other":       {"default": (200, 5000)},
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

# Источники отсортированы от дешевле к дороже
SPECIALIST_SOURCES = [
    {"name": "Avito (б/у)",         "type": "Вторичный рынок",    "mult": 0.55, "spread": 0.25, "url": "https://www.avito.ru/rossiya?q="},
    {"name": "Avito (новый)",        "type": "Частные продавцы",   "mult": 0.80, "spread": 0.20, "url": "https://www.avito.ru/rossiya?q="},
    {"name": "Wildberries",          "type": "Маркетплейс",        "mult": 0.90, "spread": 0.18, "url": "https://www.wildberries.ru/catalog/0/search.aspx?search="},
    {"name": "Ozon",                 "type": "Маркетплейс",        "mult": 0.92, "spread": 0.15, "url": "https://www.ozon.ru/search/?text="},
    {"name": "ВсеИнструменты",       "type": "Специализированный", "mult": 0.95, "spread": 0.12, "url": "https://www.vseinstrumenti.ru/search/?q="},
    {"name": "220 Вольт",            "type": "Инструментальный",   "mult": 0.97, "spread": 0.10, "url": "https://www.220-volt.ru/search/?query="},
    {"name": "Яндекс Маркет",        "type": "Маркетплейс",        "mult": 1.00, "spread": 0.15, "url": "https://market.yandex.ru/search?text="},
    {"name": "Tooling.ru",           "type": "Специализированный", "mult": 1.05, "spread": 0.08, "url": "https://www.tooling.ru/search?q="},
    {"name": "Tiu.ru",               "type": "B2B портал",         "mult": 1.08, "spread": 0.10, "url": "https://tiu.ru/search?search[text]="},
    {"name": "ПрофИнструмент",       "type": "Дилер",              "mult": 1.12, "spread": 0.08, "url": "https://profiinstrument.ru/search/?q="},
    {"name": "Ingol.ru",             "type": "Дилер",              "mult": 1.18, "spread": 0.07, "url": "https://ingol.ru/search/?q="},
    {"name": "Официальный дилер",    "type": "Дилер",              "mult": 1.30, "spread": 0.06, "url": "https://www.vseinstrumenti.ru/search/?q="},
    {"name": "ISCAR (официальный)",  "type": "Производитель",      "mult": 1.55, "spread": 0.05, "url": "https://www.iscar.com/eCatalog/item.aspx/lang/RU/Fnum/1?q="},
    {"name": "Sandvik Coromant",     "type": "Производитель",      "mult": 1.80, "spread": 0.04, "url": "https://www.sandvik.coromant.com/ru-ru/search#q="},
]


class MarketScraper:

    async def search(self, query: str, category: str = "inserts", limit: int = 24) -> Dict:
        key = "{0}::{1}".format(query, category)
        cached = CACHE.get(key)
        if cached and time.time() - cached["ts"] < CACHE_TTL:
            result = dict(cached["data"])
            result["from_cache"] = True
            return result

        data = _estimate_market(query, category)
        CACHE[key] = {"ts": time.time(), "data": data}
        return data


def _estimate_market(query: str, category: str) -> Dict:
    ts = datetime.now().strftime("%d.%m.%Y %H:%M")
    q_upper = query.upper().replace("-", " ")
    tokens = q_upper.split()

    cat_prices = BASE_PRICES.get(category, BASE_PRICES["inserts"])
    first_char = tokens[0][0] if tokens else "C"
    base_range = cat_prices.get(first_char, cat_prices["default"])
    lo = base_range[0]
    hi = base_range[1]

    full = " ".join(tokens)

    size_m = 1.0
    for sz in SIZE_MULT:
        if sz in full:
            size_m = SIZE_MULT[sz]
            break

    grade_m = 1.0
    for grade in GRADE_MULT:
        if grade in full:
            grade_m = GRADE_MULT[grade]
            break

    base_avg = int(round((lo + hi) / 2 * size_m * grade_m / 10) * 10)
    base_lo  = int(round(lo * size_m * grade_m / 10) * 10)
    base_hi  = int(round(hi * size_m * grade_m / 10) * 10)

    q_enc = query.replace(" ", "+")

    # Оценка по специализированным источникам (таблица)
    specialist_sources = []
    for src in SPECIALIST_SOURCES:
        avg = int(round(base_avg * src["mult"] / 10) * 10)
        spread = src["spread"]
        lo_p = int(round(avg * (1 - spread) / 10) * 10)
        hi_p = int(round(avg * (1 + spread) / 10) * 10)
        specialist_sources.append({
            "name": src["name"],
            "type": src["type"],
            "avg_price": avg,
            "min_price": lo_p,
            "max_price": hi_p,
            "url": src["url"] + q_enc,
        })

    # Карточки по брендам
    listings: List[Dict] = []
    for brand_name, brand_m in BRANDS:
        price = int(round(base_avg * brand_m / 10) * 10)
        listings.append({
            "title": query + " (" + brand_name + ")",
            "price": price,
            "price_text": str(price) + " \u20bd",
            "condition": "new",
            "image": "",
            "url": "https://www.vseinstrumenti.ru/search/?q=" + q_enc,
            "location": brand_name,
        })

    prices = [x["price"] for x in listings if x["price"] is not None]
    all_prices = [s["avg_price"] for s in specialist_sources] + prices
    avg_price = int(round(sum(all_prices) / len(all_prices) / 10) * 10) if all_prices else None
    min_price = min([s["min_price"] for s in specialist_sources] + prices) if all_prices else None
    max_price = max([s["max_price"] for s in specialist_sources] + prices) if all_prices else None

    stats = {
        "avg_price": avg_price,
        "min_price": min_price,
        "max_price": max_price,
        "offer_count": len(prices),
        "new_count": len(prices),
        "used_count": 0,
        "new_avg": avg_price,
        "new_min": min_price,
        "new_max": max_price,
        "used_avg": None,
        "used_min": None,
        "used_max": None,
        "popularity": "Средняя",
        "popularity_level": 3,
    }

    return {
        "query": query,
        "listings": listings,
        "specialist_sources": specialist_sources,
        "stats": stats,
        "source": "Рыночная оценка",
        "from_cache": False,
        "timestamp": ts,
        "is_estimate": True,
    }
