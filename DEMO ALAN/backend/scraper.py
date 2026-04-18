import re
import time
from datetime import datetime
from typing import Dict, List
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

# Только площадки с рабочими search URL
SPECIALIST_MARKETS = [
    ("ВсеИнструменты",   "https://www.vseinstrumenti.ru/search/?q=",          "base"),
    ("Sandvik Coromant",  "https://www.sandvik.coromant.com/ru-ru/search#q=",  "full"),
    ("Iscar",             "https://www.iscar.com/eCatalog/item.aspx/lang/RU/Fnum/1?q=", "base"),
    ("Абамет",            "https://abamet.ru/search/?q=",                      "code"),
    ("Инструмент Маркет", "https://instrument-market.ru/search/?q=",           "code"),
]

GENERAL_MARKETS = [
    ("Авито",         "https://www.avito.ru/rossiya?q=",                          "base"),
    ("Яндекс Маркет", "https://market.yandex.ru/search?text=",                    "base"),
    ("Ozon",          "https://www.ozon.ru/search/?text=",                        "base"),
    ("Wildberries",   "https://www.wildberries.ru/catalog/0/search.aspx?search=", "base"),
    ("Метро C&C",     "https://online.metro-cc.ru/search?in=&query=",             "base"),
]

# Аналоги пластин по форме
SHAPE_ANALOGS = {
    "C": ["D", "W", "T"],
    "D": ["C", "V", "T"],
    "T": ["C", "D", "V"],
    "S": ["C", "W"],
    "W": ["S", "C"],
    "V": ["D", "T"],
    "R": ["C"],
}

# Альтернативные радиусы вершины
CORNER_VARIANTS = {"04": ["02", "08"], "08": ["04", "12"], "12": ["08", "16"], "16": ["12"]}

# Популярные марки сплавов как аналоги
GRADE_ANALOGS = {
    "4325": ["GC4325", "IC4028", "AC6030M", "T9115"],
    "4335": ["GC4335", "IC5010", "AC6040M"],
    "GC4325": ["4325", "IC4028", "T9115"],
    "IC4028": ["4325", "GC4325"],
    "T9115": ["4325", "GC4325", "IC4028"],
    "CP25":  ["GC4325", "IC4028", "T9115"],
}


def parse_iso_code(query: str) -> Dict:
    q = re.sub(r'\s+', ' ', query.strip().upper())
    m = re.match(r'^([A-Z]{2,6})\s*(\d{2})(\d{2})(\d{2})(?:-([A-Z0-9]+))?\s*([A-Z0-9]+)?', q)
    if m:
        return {
            "shape_letter": m.group(1)[0],
            "shape":        m.group(1),
            "ic":           m.group(2),
            "thickness":    m.group(3),
            "corner":       m.group(4),
            "size":         m.group(2) + m.group(3) + m.group(4),
            "chipbreaker":  m.group(5) or "",
            "grade":        m.group(6) or "",
            "parsed": True,
        }
    # Fallback — простой парсер
    m2 = re.match(r'^([A-Z]{2,6})\s*(\d{4,8})(?:-([A-Z0-9]+))?\s*([A-Z0-9]+)?', q)
    if m2:
        return {
            "shape_letter": m2.group(1)[0],
            "shape": m2.group(1), "ic": "", "thickness": "", "corner": "",
            "size": m2.group(2), "chipbreaker": m2.group(3) or "",
            "grade": m2.group(4) or "", "parsed": True,
        }
    return {"shape_letter": "", "shape": "", "ic": "", "thickness": "", "corner": "",
            "size": "", "chipbreaker": "", "grade": "", "parsed": False}


def generate_variants(query: str) -> Dict[str, str]:
    p = parse_iso_code(query)
    sh = p["shape"]
    sz = p["size"]
    cb = p["chipbreaker"]
    gr = p["grade"]

    if p["parsed"] and sh and sz:
        full = sh + sz
        if cb: full += "-" + cb
        if gr: full += " " + gr

        code = sh + sz + ("-" + cb if cb else "")
        base = sh + sz
        base_s = sh + " " + sz[:2] + sz[2:4] + sz[4:] if len(sz) >= 6 else sh + " " + sz
        compact = re.sub(r'[\s\-]', '', full)
    else:
        full = query.strip()
        code = query.split("-")[0].strip()
        base = code.split()[0] if " " in code else code
        base_s = base
        compact = re.sub(r'[\s\-]', '', query.upper())

    return {
        "full": full, "code": code, "base": base,
        "base_s": base_s, "compact": compact,
    }


def suggest_analogs(parsed: Dict) -> List[Dict]:
    """Предлагает аналоги на основе ISO параметров"""
    if not parsed.get("parsed") or not parsed.get("shape"):
        return []

    analogs = []
    sh = parsed["shape"]
    sz = parsed["size"]
    cb = parsed["chipbreaker"]
    gr = parsed["grade"]
    sl = parsed["shape_letter"]
    corner = parsed.get("corner", "")

    # 1. Другой стружколом — тот же артикул
    for alt_cb in ["MF", "SM", "PM", "GM", "HM", "RR", "MR"]:
        if alt_cb != cb:
            code = sh + sz + "-" + alt_cb
            analogs.append({
                "code": code, "reason": f"Другой стружколом ({alt_cb})",
                "relevance": 90, "type": "chipbreaker"
            })
            if len(analogs) >= 3:
                break

    # 2. Другой радиус вершины
    if corner and corner in CORNER_VARIANTS:
        for alt_corner in CORNER_VARIANTS[corner][:2]:
            alt_sz = sz[:-2] + alt_corner if len(sz) >= 6 else sz
            code = sh + alt_sz
            if cb: code += "-" + cb
            analogs.append({
                "code": code, "reason": f"Другой радиус ({alt_corner[0]}.{alt_corner[1]} мм)",
                "relevance": 82, "type": "corner"
            })

    # 3. Аналогичная форма
    for alt_shape_letter in SHAPE_ANALOGS.get(sl, [])[:2]:
        alt_shape = alt_shape_letter + sh[1:]
        code = alt_shape + sz
        if cb: code += "-" + cb
        analogs.append({
            "code": code, "reason": f"Аналогичная форма ({alt_shape})",
            "relevance": 70, "type": "shape"
        })

    # 4. Аналогичные марки сплавов
    if gr and gr in GRADE_ANALOGS:
        for alt_gr in GRADE_ANALOGS[gr][:2]:
            code = sh + sz
            if cb: code += "-" + cb
            code += " " + alt_gr
            analogs.append({
                "code": code, "reason": f"Аналог марки ({alt_gr})",
                "relevance": 75, "type": "grade"
            })

    return analogs[:8]


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
    analogs = suggest_analogs(parsed) if category == "inserts" else []

    listings: List[Dict] = []

    for market_name, base_url, var_key in SPECIALIST_MARKETS:
        q_enc = quote_plus(variants.get(var_key, variants["full"]))
        listings.append({
            "title": "Найти на " + market_name,
            "price": None, "price_text": "Открыть поиск",
            "match_type": "search",
            "match_label": "Поиск: " + variants.get(var_key, variants["full"]),
            "relevance": 0, "condition": "unknown", "image": "",
            "url": base_url + q_enc, "location": market_name,
        })

    for market_name, base_url, var_key in GENERAL_MARKETS:
        q_enc = quote_plus(variants.get(var_key, variants["base"]))
        listings.append({
            "title": "Найти на " + market_name,
            "price": None, "price_text": "Открыть поиск",
            "match_type": "search",
            "match_label": "Поиск: " + variants.get(var_key, variants["base"]),
            "relevance": 0, "condition": "unknown", "image": "",
            "url": base_url + q_enc, "location": market_name,
        })

    for brand_name, brand_m in BRANDS:
        price = int(round(base_avg * brand_m / 10) * 10)
        q_enc = quote_plus(variants["full"])
        relevance = 85 if parsed["parsed"] else 60
        listings.append({
            "title": query + " (" + brand_name + ")",
            "price": price,
            "price_text": str(price) + " \u20bd",
            "match_type": "estimate",
            "match_label": "Оценка рынка · " + str(relevance) + "% совпадение",
            "relevance": relevance, "condition": "new", "image": "",
            "url": "https://www.vseinstrumenti.ru/search/?q=" + q_enc,
            "location": brand_name,
        })

    prices = [x["price"] for x in listings if x["price"] is not None]
    avg_price = int(round(sum(prices) / len(prices) / 10) * 10) if prices else None

    stats = {
        "avg_price": avg_price, "min_price": min(prices) if prices else None,
        "max_price": max(prices) if prices else None, "offer_count": len(prices),
        "new_count": len(prices), "used_count": 0, "new_avg": avg_price,
        "new_min": min(prices) if prices else None,
        "new_max": max(prices) if prices else None,
        "used_avg": None, "used_min": None, "used_max": None,
        "popularity": "Средняя", "popularity_level": 3,
    }

    return {
        "query": query, "variants": variants, "parsed": parsed,
        "analogs": analogs, "listings": listings, "stats": stats,
        "source": "Рыночная оценка", "from_cache": False,
        "timestamp": ts, "is_estimate": True,
    }
