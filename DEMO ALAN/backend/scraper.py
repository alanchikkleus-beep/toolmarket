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

# Бренды для оценки цен (показываются в листингах)
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

# Специализированные источники (не кликабельные, показывают аналитику)
SPECIALIST_SOURCES = [
    {"name": "Sandvik Coromant", "type": "Производитель",  "mult": 1.80, "spread": 0.12},
    {"name": "ISCAR",            "type": "Производитель",  "mult": 1.55, "spread": 0.14},
    {"name": "Kennametal",       "type": "Производитель",  "mult": 1.60, "spread": 0.13},
    {"name": "Абамет",           "type": "Дистрибьютор",   "mult": 1.20, "spread": 0.10},
    {"name": "Tooling.ru",       "type": "Дистрибьютор",   "mult": 1.10, "spread": 0.15},
    {"name": "ВсеИнструменты",   "type": "Интернет-магазин","mult": 1.05, "spread": 0.13},
    {"name": "220 Вольт",        "type": "Интернет-магазин","mult": 0.98, "spread": 0.16},
    {"name": "Метро C&C",        "type": "Розница",         "mult": 0.92, "spread": 0.11},
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

    # Оценка по брендам (листинги с ценами)
    listings: List[Dict] = []
    for brand_name, brand_m in BRANDS:
        price = int(round(base_avg * brand_m / 10) * 10)
        listings.append({
            "title": query + " (" + brand_name + ")",
            "price": price,
            "price_text": str(price) + " ₽",
            "condition": "new",
            "image": "",
            "url": "https://www.vseinstrumenti.ru/search/?q=" + q_enc,
            "location": brand_name,
        })

    prices = [x["price"] for x in listings if x["price"] is not None]
    avg_price = int(round(sum(prices) / len(prices) / 10) * 10) if prices else None

    # Специализированные источники с аналитикой цен
    specialist_sources = []
    for src in SPECIALIST_SOURCES:
        avg = int(round(base_avg * src["mult"] / 10) * 10)
        spread_amt = int(avg * src["spread"])
        min_p = max(avg - spread_amt, base_lo)
        max_p = avg + spread_amt
        # Детерминированное кол-во предложений на основе хэша
        seed = abs(hash(query + src["name"])) % 10
        if src["mult"] >= 1.5:
            count = 1 + seed % 3        # производители: 1-3
        elif src["mult"] >= 1.0:
            count = 2 + seed % 5        # дистрибьюторы: 2-6
        else:
            count = seed % 4            # розница: 0-3

        specialist_sources.append({
            "name": src["name"],
            "type": src["type"],
            "min_price": min_p if count > 0 else None,
            "max_price": max_p if count > 0 else None,
            "avg_price": avg if count > 0 else None,
            "count": count,
            "status": "ok" if count > 0 else "no_data",
        })

    # Сводка по рынку
    all_prices = [s["avg_price"] for s in specialist_sources if s["avg_price"]]
    all_prices += prices
    market_min = min([s["min_price"] for s in specialist_sources if s["min_price"]] + (prices if prices else [])) if all_prices else None
    market_max = max([s["max_price"] for s in specialist_sources if s["max_price"]] + (prices if prices else [])) if all_prices else None
    market_avg = int(round(sum(all_prices) / len(all_prices) / 10) * 10) if all_prices else None
    good_min = int(round(market_min * 1.0 / 10) * 10) if market_min else None
    good_max = int(round(market_avg * 1.05 / 10) * 10) if market_avg else None

    spread_pct = int(round((market_max - market_min) / market_avg * 100)) if (market_min and market_max and market_avg) else 0
    if spread_pct < 20:
        spread_label = "Стабильный рынок"
    elif spread_pct < 50:
        spread_label = "Умеренный разброс"
    else:
        spread_label = "Высокий разброс цен"

    total_offers = sum(s["count"] for s in specialist_sources) + len(prices)
    if total_offers == 0:
        rarity = "Редкий товар"
    elif total_offers < 10:
        rarity = "Ограниченное предложение"
    elif total_offers < 25:
        rarity = "Умеренное предложение"
    else:
        rarity = "Широкое предложение"

    market_summary = {
        "market_min": market_min,
        "market_max": market_max,
        "market_avg": market_avg,
        "good_min": good_min,
        "good_max": good_max,
        "spread_pct": spread_pct,
        "spread_label": spread_label,
        "total_offers": total_offers,
        "rarity": rarity,
    }

    stats = {
        "avg_price": avg_price,
        "min_price": min(prices) if prices else None,
        "max_price": max(prices) if prices else None,
        "offer_count": len(prices),
        "new_count": len(prices),
        "used_count": 0,
        "new_avg": avg_price,
        "new_min": min(prices) if prices else None,
        "new_max": max(prices) if prices else None,
        "used_avg": None,
        "used_min": None,
        "used_max": None,
        "popularity": "Средняя",
        "popularity_level": 3,
    }

    return {
        "query": query,
        "listings": listings,
        "stats": stats,
        "specialist_sources": specialist_sources,
        "market_summary": market_summary,
        "source": "Рыночная оценка",
        "from_cache": False,
        "timestamp": ts,
        "is_estimate": True,
    }
