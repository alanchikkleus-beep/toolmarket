const cache = new Map();
const CACHE_TTL = 30 * 60 * 1000;

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
};

export async function searchAvito(query, limit = 24) {
  const key = `avito::${query}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return { ...cached.data, from_cache: true };
  }

  const data = await fetchAvito(query, limit);
  cache.set(key, { ts: Date.now(), data });
  return data;
}

async function fetchAvito(query, limit) {
  const url = `https://www.avito.ru/rossiya?q=${encodeURIComponent(query)}`;
  const now = new Date().toLocaleString("ru-RU");

  try {
    const { default: fetch } = await import("node-fetch");
    const resp = await fetch(url, { headers: HEADERS, redirect: "follow", signal: AbortSignal.timeout(15000) });

    if (!resp.ok) return empty(`HTTP ${resp.status}`, now);

    const html = await resp.text();
    return parse(html, query, limit, now);
  } catch (e) {
    return empty(e.message, now);
  }
}

function parse(html, query, limit, timestamp) {
  // Simple regex-based extraction (no DOM parser needed)
  const listings = [];
  const prices = [];

  // Match Avito listing blocks (simplified regex approach)
  const titleRe = /"title"\s*:\s*"([^"]+)"/g;
  const priceRe = /"price"\s*:\s*\{[^}]*"value"\s*:\s*(\d+)/g;
  const urlRe = /"urlPath"\s*:\s*"([^"]+)"/g;

  const titles = [...html.matchAll(titleRe)].map(m => m[1]).slice(0, limit);
  const priceMatches = [...html.matchAll(priceRe)].map(m => parseInt(m[1])).slice(0, limit);
  const urls = [...html.matchAll(urlRe)].map(m => m[1]).slice(0, limit);

  for (let i = 0; i < Math.min(titles.length, limit); i++) {
    const price = priceMatches[i] || null;
    if (price) prices.push(price);
    listings.push({
      title: titles[i] || "Без названия",
      price,
      price_text: price ? `${price.toLocaleString("ru-RU")} ₽` : "Цена не указана",
      location: "",
      url: urls[i] ? `https://www.avito.ru${urls[i]}` : "",
    });
  }

  return {
    query,
    listings,
    stats: calcStats(prices, listings.length),
    source: "avito.ru",
    from_cache: false,
    timestamp,
  };
}

function calcStats(prices, count) {
  const lvl = count >= 50 ? 5 : count >= 20 ? 4 : count >= 10 ? 3 : count >= 3 ? 2 : count > 0 ? 1 : 0;
  const labels = ["Нет данных", "Редкий товар", "Низкая", "Средняя", "Высокая", "Очень высокая"];
  if (!prices.length) return { avg_price: null, min_price: null, max_price: null, offer_count: count, popularity: labels[lvl], popularity_level: lvl };
  return {
    avg_price: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
    min_price: Math.min(...prices),
    max_price: Math.max(...prices),
    offer_count: count,
    popularity: labels[lvl],
    popularity_level: lvl,
  };
}

function empty(error, timestamp) {
  return {
    query: "", listings: [],
    stats: { avg_price: null, min_price: null, max_price: null, offer_count: 0, popularity: "Нет данных", popularity_level: 0 },
    source: "avito.ru", from_cache: false, error, timestamp,
  };
}
