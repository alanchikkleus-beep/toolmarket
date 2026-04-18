import re
import time
from datetime import datetime
from typing import Dict, List, Tuple
from urllib.parse import quote_plus

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

SPECIALIST_MARKETS = [
    ("ВсеИнструменты",  "https://www.vseinstrumenti.ru/search/?q=",         "base"),
    ("Pulscen.ru",       "https://pulscen.ru/search/?query=",                "code"),
    ("Tooling.ru",       "https://www.tooling.ru/search?q=",                 "full"),
    ("МиринСтрумента",   "https://mirinstrumenta.ru/search/?q=",             "code"),
    ("ПрофИнструмент",   "https://profiinstrument.ru/search/?q=",            "code"),
    ("Ingol.ru",         "https://ingol.ru/search/?q=",                      "code"),
    ("B2B-Center",       "https://www.b2b-center.ru/market/search.html?q=",  "full"),
    ("Satist.ru",        "https://satist.ru/search/?q=",                     "base"),
    ("Sandvik Coromant", "https://www.sandvik.coromant.com/ru-ru/search#q=", "full"),
    ("Iscar",            "https://www.iscar.com/eCatalog/item.aspx/lang/RU/Fnum/1?q=", "base"),
]

GENERAL_MARKETS = [
    ("Авито",         "https://www.avito.ru/rossiya?q=",                          "base"),
    ("Яндекс Маркет", "https://market.yandex.ru/search?text=",                    "base"),
    ("Ozon",          "https://www.ozon.ru/search/?text=",                        "base"),
    ("Wildberries",   "https://www.wildberries.ru/catalog/0/search.aspx?search=", "base"),
    ("Метро C&C",     "https://online.metro-cc.ru/search?in=&query=",             "base"),
]


def parse_iso_code(query: str) -> Dict:
    q = re.sub(r'\s+', ' ', query.strip().upper())
    m = re.match(r'^([A-Z]{2,6})\s*(\d{4,8})(?:-([A-Z0-9]+))?\s*([A-Z0-9]+)?', q)
    if m:
        return {
            "shape": m.group(1) or "",
            "size":  m.group(2) or "",
            "chipbreaker": m.group(3) or "",
            "grade": m.group(4) or "",
            "parsed": True,
        }
    return {"shape": "", "size": "", "chipbreaker": "", "grade": "", "parsed": False}


def generate_variants(query: str) -> Dict[str, str]:
    p = parse_iso_code(query)
    sh, sz, cb, gr = p["shape"], p["size"], p["chipbreaker"], p["grade"]

    if p["parsed"] and sh and sz:
        full = sh + sz
        if cb: full += "-" + cb
        if gr: full += " " + gr

        code = sh + sz
        if cb: code += "-" + cb

        base = sh + sz
        base_s = sh + " " + sz
        compact = sh + sz + cb + gr
    else:
        full = query.strip()
        code = query.split("-")[0].strip()
        base = code.split()[0] if " " in code else code
        base_s = base
        compact = re.sub(r'[\s\-]', '', query.upper())

    return {
        "full":    full,
        "code":    code,
        "base":    base,
        "base_s":  base_s,
        "compact": compact,
    }


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
    lo, hi = base_range

    full_str = " ".join(tokens)
    size_m = next((SIZE_MULT[sz] for sz in SIZE_MULT if sz in full_str), 1.0)
    grade_m = next((GRADE_MULT[g] for g in GRADE_MULT if g in full_str), 1.0)
    base_avg = int(round((lo + hi) / 2 * size_m * grade_m / 10) * 10)

    variants = generate_variants(query)
    parsed = parse_iso_code(query)

    listings: List[Dict] = []

    for market_name, base_url, var_key in SPECIALIST_MARKETS:
        q_enc = quote_plus(variants.get(var_key, variants["full"]))
        listings.append({
            "title": "Найти на " + market_name,
            "price": None,
            "price_text": "Открыть поиск",
            "match_type": "search",
            "match_label": "Поиск: " + variants.get(var_key, variants["full"]),
            "relevance": 0,
            "condition": "unknown",
            "image": "",
            "url": base_url + q_enc,
            "location": market_name,
        })

    for market_name, base_url, var_key in GENERAL_MARKETS:
        q_enc = quote_plus(variants.get(var_key, variants["base"]))
        listings.append({
            "title": "Найти на " + market_name,
            "price": None,
            "price_text": "Открыть поиск",
            "match_type": "search",
            "match_label": "Поиск: " + variants.get(var_key, variants["base"]),
            "relevance": 0,
            "condition": "unknown",
            "image": "",
            "url": base_url + q_enc,
            "location": market_name,
        })

    for brand_name, brand_m in BRANDS:
        price = int(round(base_avg * brand_m / 10) * 10)
        q_enc = quote_plus(variants["full"])
        listings.append({
            "title": query + " (" + brand_name + ")",
            "price": price,
            "price_text": str(price) + " \u20bd",
            "match_type": "estimate",
            "match_label": "Оценка рынка",
            "relevance": 75,
            "condition": "new",
            "image": "",
            "url": "https://www.vseinstrumenti.ru/search/?q=" + q_enc,
            "location": brand_name,
        })

    prices = [x["price"] for x in listings if x["price"] is not None]
    avg_price = int(round(sum(prices) / len(prices) / 10) * 10) if prices else None

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
        "variants": variants,
        "parsed": parsed,
        "listings": listings,
        "stats": stats,
        "source": "Рыночная оценка",
        "from_cache": False,
        "timestamp": ts,
        "is_estimate": True,
    }
