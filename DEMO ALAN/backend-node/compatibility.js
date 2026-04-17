import { readFile } from "fs/promises";

let db = null;

export async function loadDB(filePath) {
  const raw = await readFile(filePath, "utf-8");
  db = JSON.parse(raw);
}

export function parseInsert(code) {
  code = code.toUpperCase().replace(/[\s\-]/g, "");
  const result = { raw: code, shapeLetter: null, shapeInfo: null, isValid: false };
  if (code.length < 4) return result;
  if (db.shapes[code[0]]) {
    result.shapeLetter = code[0];
    result.shapeInfo = db.shapes[code[0]];
    result.isValid = true;
  }
  const numMatch = code.match(/(\d{4,6})/);
  result.sizeCode = numMatch ? numMatch[1] : null;
  result.clearanceLetter = code[1] && db.clearance_angles[code[1]] ? code[1] : null;
  result.clearanceInfo = result.clearanceLetter ? db.clearance_angles[result.clearanceLetter] : null;
  result.toleranceLetter = code[2] && db.tolerance_classes[code[2]] ? code[2] : null;
  result.toleranceInfo = result.toleranceLetter ? db.tolerance_classes[result.toleranceLetter] : null;
  return result;
}

export function getCompatibility(insertCode) {
  const parsed = parseInsert(insertCode);
  if (!parsed.isValid) return { error: "Неверный код пластины", insert_code: insertCode };

  const shape = parsed.shapeInfo;
  const sl = parsed.shapeLetter;

  const compatHolders = [];
  for (const [bk, brand] of Object.entries(db.brands)) {
    for (const [lineName, line] of Object.entries(brand.lines)) {
      const matched = (line.inserts || []).filter(i => i.toUpperCase().startsWith(sl));
      if (matched.length) {
        compatHolders.push({
          brand: brand.name, brand_key: bk, country: brand.country,
          logo_color: brand.logo_color, line: lineName,
          line_description: line.description, holders: line.holders,
          matched_inserts: matched.slice(0, 4),
        });
      }
    }
  }

  return {
    insert_code: insertCode,
    parsed: {
      shape: `${sl} — ${shape.name}`,
      clearance: parsed.clearanceInfo,
      tolerance: parsed.toleranceInfo,
      size_code: parsed.sizeCode,
    },
    applications: shape.applications,
    industries: shape.industries,
    compatible_holders_by_brand: compatHolders,
    positive_variants: shape.positive_variants || [],
    negative_variants: shape.negative_variants || [],
    holder_prefix_patterns: shape.holder_prefixes,
  };
}

export function getHolders() {
  return Object.entries(db.brands).map(([bk, brand]) => ({
    brand_key: bk, brand: brand.name, country: brand.country,
    logo_color: brand.logo_color,
    lines: Object.entries(brand.lines).map(([name, l]) => ({
      name, description: l.description, holders: l.holders, inserts: l.inserts || [],
    })),
  }));
}

export function getInsertTypes() {
  return {
    shapes: Object.fromEntries(
      Object.entries(db.shapes).map(([k, v]) => [k, { name: v.name, description: v.description, applications: v.applications }])
    ),
    popular_inserts: db.popular_inserts,
    materials: db.materials,
  };
}

export function searchByHolder(prefix) {
  prefix = prefix.toUpperCase();
  const results = [];
  for (const [, brand] of Object.entries(db.brands)) {
    for (const [lineName, line] of Object.entries(brand.lines)) {
      const matched = (line.holders || []).filter(h => h.toUpperCase().startsWith(prefix));
      if (matched.length) {
        results.push({ brand: brand.name, line: lineName, holders: matched, compatible_inserts: line.inserts || [] });
      }
    }
  }
  return results;
}
