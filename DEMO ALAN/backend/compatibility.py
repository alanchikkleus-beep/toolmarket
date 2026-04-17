import json
import os
import re
from typing import Dict, List

DB_PATH = os.path.join(os.path.dirname(__file__), "data", "tools.json")


class CompatibilityDB:
    def __init__(self):
        with open(DB_PATH, encoding="utf-8") as f:
            self.db = json.load(f)

    def get_categories(self) -> Dict:
        return self.db.get("categories", {})

    def get_category_popular(self, category: str) -> List[str]:
        cat = self.db.get("categories", {}).get(category, {})
        return cat.get("popular", [])

    def parse_insert_code(self, code: str) -> Dict:
        code = code.upper().replace(" ", "").replace("-", "")
        result = {"raw": code, "shape_letter": None, "shape_info": None, "is_valid": False}
        if len(code) < 4:
            return result
        if code[0] in self.db["shapes"]:
            result["shape_letter"] = code[0]
            result["shape_info"] = self.db["shapes"][code[0]]
            result["is_valid"] = True
        if len(code) > 1 and code[1] in self.db.get("clearance_angles", {}):
            result["clearance_info"] = self.db["clearance_angles"][code[1]]
        if len(code) > 2 and code[2] in self.db.get("tolerance_classes", {}):
            result["tolerance_info"] = self.db["tolerance_classes"][code[2]]
        m = re.search(r"(\d{4,6})", code)
        result["size_code"] = m.group(1) if m else None
        return result

    def get_compatibility(self, insert_code: str) -> Dict:
        parsed = self.parse_insert_code(insert_code)
        if not parsed["is_valid"]:
            return {"error": "Неверный код пластины", "insert_code": insert_code}
        shape = parsed["shape_info"]
        sl = parsed["shape_letter"]
        compat = []
        for bk, brand in self.db["brands"].items():
            for ln, line in brand["lines"].items():
                matched = [i for i in line.get("inserts", []) if i.upper().startswith(sl)]
                if matched:
                    compat.append({
                        "brand": brand["name"], "brand_key": bk,
                        "country": brand["country"], "logo_color": brand["logo_color"],
                        "line": ln, "line_description": line["description"],
                        "holders": line["holders"], "matched_inserts": matched[:4],
                    })
        return {
            "insert_code": insert_code,
            "parsed": {
                "shape": f"{sl} — {shape['name']}",
                "clearance": parsed.get("clearance_info"),
                "tolerance": parsed.get("tolerance_info"),
                "size_code": parsed.get("size_code"),
            },
            "applications": shape["applications"],
            "industries": shape["industries"],
            "compatible_holders_by_brand": compat,
            "positive_variants": shape.get("positive_variants", []),
            "negative_variants": shape.get("negative_variants", []),
            "holder_prefix_patterns": shape["holder_prefixes"],
        }

    def get_holders(self) -> List[Dict]:
        return [
            {
                "brand_key": bk, "brand": b["name"],
                "country": b["country"], "logo_color": b["logo_color"],
                "lines": [
                    {"name": ln, "description": l["description"],
                     "holders": l["holders"], "inserts": l.get("inserts", [])}
                    for ln, l in b["lines"].items()
                ],
            }
            for bk, b in self.db["brands"].items()
        ]

    def get_insert_types(self) -> Dict:
        return {
            "shapes": {k: {"name": v["name"], "description": v["description"], "applications": v["applications"]}
                       for k, v in self.db["shapes"].items()},
            "popular_inserts": self.db["popular_inserts"],
            "materials": self.db["materials"],
            "categories": self.db.get("categories", {}),
        }

    def search_by_holder(self, prefix: str) -> List[Dict]:
        prefix = prefix.upper()
        results = []
        for _, brand in self.db["brands"].items():
            for ln, line in brand["lines"].items():
                matched = [h for h in line["holders"] if h.upper().startswith(prefix)]
                if matched:
                    results.append({
                        "brand": brand["name"], "line": ln,
                        "holders": matched, "compatible_inserts": line.get("inserts", []),
                    })
        return results
