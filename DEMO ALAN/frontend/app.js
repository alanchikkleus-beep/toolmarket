/* ── State ── */
const state = {
  tab: "market",
  category: "inserts",
  query: "",
  marketData: null,
  compatData: null,
  insertTypes: null,
  holders: null,
  categories: null,
  loading: false,
};

const cmpItems = [];

/* ── Market Analysis Helpers ── */
function calcRarity(stats) {
  const count = stats.offer_count || 0;
  let volatility = 0;
  if (stats.avg_price && stats.min_price != null && stats.max_price != null && stats.avg_price > 0) {
    volatility = Math.round(((stats.max_price - stats.min_price) / stats.avg_price) * 100);
  }

  let label, icon, cls, desc;
  if (count === 0) {
    label = "Редкий товар"; icon = "💎"; cls = "rarity-rare";
    desc = "Нет предложений на рынке";
  } else if (count >= 20) {
    label = "Обычный товар"; icon = "📦"; cls = "rarity-common";
    desc = "Много предложений · Стабильный рынок";
  } else if (count >= 5) {
    label = "Ограниченное предложение"; icon = "⚡"; cls = "rarity-limited";
    desc = (volatility > 45 ? "Мало предложений · Высокий разброс цен" : "Мало предложений · Умеренный разброс");
  } else {
    label = "Редкий товар"; icon = "💎"; cls = "rarity-rare";
    desc = "Очень мало предложений · Трудно найти";
  }

  if (count > 0 && count < 8 && stats.avg_price && stats.avg_price > 5000) {
    label = "Высокая ценность"; icon = "🏆"; cls = "rarity-valuable";
    desc = "Высокая цена + ограниченная доступность";
  }

  return { label, icon, cls, desc, volatility, count };
}

function calcDealScore(stats) {
  if (!stats.avg_price || stats.min_price == null || stats.max_price == null) return null;
  const spread = stats.max_price - stats.min_price;
  if (spread < 10) return "medium";
  const pos = (stats.avg_price - stats.min_price) / spread;
  if (pos <= 0.35) return "cheap";
  if (pos <= 0.65) return "medium";
  return "expensive";
}

function renderMarketAnalysis(stats) {
  const rarity = calcRarity(stats);
  const deal = calcDealScore(stats);

  const volColor = rarity.volatility > 60 ? "#fc8181" : rarity.volatility > 30 ? "#ed8936" : "#48bb78";
  const volWidth = Math.min(rarity.volatility, 100);

  const dealHtml = deal ? `
    <div class="metric-block">
      <div class="metric-label">Оценка цены</div>
      <div class="deal-score">
        <div class="deal-segment ${deal==="cheap"?"active-cheap":""}">💚 Дёшево</div>
        <div class="deal-segment ${deal==="medium"?"active-medium":""}">🟡 Средне</div>
        <div class="deal-segment ${deal==="expensive"?"active-expensive":""}">🔴 Дорого</div>
      </div>
    </div>` : "";

  return `
  <div class="market-analysis">
    <div class="analysis-header">
      <div class="analysis-title">Анализ рынка</div>
      <div class="rarity-badge ${rarity.cls}">${rarity.icon} ${esc(rarity.label)}</div>
    </div>
    <div style="font-size:.82rem;color:var(--muted);margin-bottom:14px">${esc(rarity.desc)}</div>
    <div class="analysis-metrics">
      <div class="metric-block">
        <div class="metric-label">Волатильность цен</div>
        <div class="vol-track">
          <div class="vol-fill" style="width:${volWidth}%;background:${volColor}"></div>
        </div>
        <div class="vol-pct">Разброс: ${rarity.volatility}% · ${rarity.volatility < 20 ? "Стабильные цены" : rarity.volatility < 50 ? "Умеренный разброс" : "Высокий разброс цен"}</div>
      </div>
      ${dealHtml}
    </div>
  </div>`;
}

/* ── Compare ── */
function cmpAdd() {
  if (!state.query || !state.marketData) return;
  if (cmpItems.length >= 3) { alert("Максимум 3 позиции для сравнения"); return; }
  if (cmpItems.find(x => x.query === state.query && x.category === state.category)) {
    alert("Эта позиция уже добавлена"); return;
  }
  cmpItems.push({ query: state.query, category: state.category, market: state.marketData, compat: state.compatData });
  updateCmpBadge();
  renderTab();
}

function cmpRemove(idx) {
  cmpItems.splice(idx, 1);
  updateCmpBadge();
  renderCmpContent();
}

function updateCmpBadge() {
  const btn = $("#cmp-open-btn");
  const cnt = $("#cmp-count");
  if (!btn || !cnt) return;
  cnt.textContent = cmpItems.length;
  btn.style.display = cmpItems.length ? "" : "none";
}

window.openCompare = function () {
  if (!cmpItems.length) return;
  $("#cmp-modal").style.display = "flex";
  renderCmpContent();
};
window.closeCompare = function () {
  $("#cmp-modal").style.display = "none";
};

function renderCmpContent() {
  const box = $("#cmp-content");
  if (!box) return;
  if (!cmpItems.length) { box.innerHTML = `<div class="empty" style="padding:40px">Нет позиций для сравнения</div>`; return; }

  const cols = cmpItems.length;
  const prices = cmpItems.map(it => it.market?.stats?.avg_price || null);
  const validP = prices.filter(Boolean);
  const minP = validP.length ? Math.min(...validP) : null;

  const rows = [
    { key: "head", render: (it, i) => `<div class="cmp-cell head"><div><div style="font-size:.8rem;color:var(--dim)">${CAT_ICONS[it.category] || ""} ${esc(it.category)}</div><div>${esc(it.query)}</div></div><button class="cmp-add-btn" onclick="cmpRemove(${i})">✕</button></div>` },
    { label: "Средняя цена", render: (it) => { const p = it.market?.stats?.avg_price; const best = p && p === minP; return `<div class="cmp-cell${best ? " cmp-best" : ""}"><div class="cmp-price">${p ? p.toLocaleString("ru-RU") + " ₽" : "—"}</div>${best ? `<div style="font-size:.72rem;color:var(--success)">✅ Лучшая цена</div>` : ""}</div>`; } },
    { label: "Диапазон цен", render: (it) => { const s = it.market?.stats || {}; return `<div class="cmp-cell">${s.min_price != null ? `от ${s.min_price.toLocaleString("ru-RU")} до ${s.max_price.toLocaleString("ru-RU")} ₽` : "—"}</div>`; } },
    { label: "Новый / Б.У.", render: (it) => { const s = it.market?.stats || {}; return `<div class="cmp-cell">${s.new_count > 0 ? `<div style="color:var(--success)">✅ Новый: ${s.new_avg ? s.new_avg.toLocaleString("ru-RU") + " ₽" : "есть"} (${s.new_count} шт)</div>` : ""}${s.used_count > 0 ? `<div style="color:var(--warning)">🔄 Б/У: ${s.used_avg ? s.used_avg.toLocaleString("ru-RU") + " ₽" : "есть"} (${s.used_count} шт)</div>` : ""}${!s.new_count && !s.used_count ? "—" : ""}</div>`; } },
    { label: "Предложений", render: (it) => `<div class="cmp-cell">${it.market?.stats?.offer_count || 0} шт</div>` },
    { label: "Популярность", render: (it) => `<div class="cmp-cell">${it.market?.stats?.popularity || "—"}</div>` },
    { label: "Форма / Тип", render: (it) => `<div class="cmp-cell">${esc(it.compat?.parsed?.shape || "—")}</div>` },
    { label: "Применение", render: (it) => { const apps = it.compat?.applications || []; return `<div class="cmp-cell">${apps.length ? apps.map(a => `<span class="app-tag" style="margin:2px;font-size:.73rem">${esc(a)}</span>`).join("") : "—"}</div>`; } },
    { label: "Совм. бренды", render: (it) => { const brands = (it.compat?.compatible_holders_by_brand || []).map(b => b.brand); return `<div class="cmp-cell">${brands.length ? esc(brands.slice(0, 4).join(", ")) : "—"}</div>`; } },
  ];

  let html = `<div class="cmp-grid" style="grid-template-columns:repeat(${cols},1fr)">`;
  rows.forEach(row => {
    if (row.label) html += `<div class="cmp-cell label" style="grid-column:1/-1">${esc(row.label)}</div>`;
    cmpItems.forEach((it, i) => { html += row.render(it, i); });
  });
  if (cmpItems.length < 3) {
    html += `<div class="cmp-cell" style="grid-column:1/-1;text-align:center;padding:16px"><button class="btn btn-secondary" onclick="closeCompare()">+ Добавить ещё позицию</button></div>`;
  }
  html += `</div>`;
  box.innerHTML = html;
}

/* ── История поиска ── */
function getHistory() { try { return JSON.parse(localStorage.getItem("search_history") || "[]"); } catch { return []; } }
function addHistory(q) {
  if (!q) return;
  let h = getHistory().filter(x => x !== q);
  h.unshift(q);
  h = h.slice(0, 20);
  localStorage.setItem("search_history", JSON.stringify(h));
  renderHistory();
}
function clearHistory() { localStorage.removeItem("search_history"); renderHistory(); }
function renderHistory() {
  const el = $("#history-list"); if (!el) return;
  const h = getHistory();
  if (!h.length) { el.innerHTML = `<span style="color:var(--dim);font-size:.8rem">История пуста</span>`; return; }
  el.innerHTML = h.map(q => `<span class="chip" onclick="setQuery('${q.replace(/'/g, "\\'")}')">${esc(q)}</span>`).join("") +
    `<span style="cursor:pointer;font-size:.75rem;color:var(--dim);padding:4px 8px;border-radius:20px;border:1px solid var(--border)" onclick="clearHistory()">✕ Очистить</span>`;
}

const CAT_ICONS = { inserts: "🔶", drills: "🔩", mills: "⚙️", burrs: "🌀", reamers: "🔧" };
const COND_LABEL = { new: "Новый", used: "Б/У", unknown: "—" };
const COND_CLS = { new: "cond-new", used: "cond-used", unknown: "cond-unknown" };

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
function esc(s) { return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function loader() { return `<div class="loader"><div class="spinner"></div>Загрузка данных...</div>`; }
function empty(icon, msg) { return `<div class="empty"><div class="icon">${icon}</div>${esc(msg)}</div>`; }
function fmt(n) { return n != null ? Number(n).toLocaleString("ru-RU") + " ₽" : "—"; }

async function api(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function init() {
  // Сразу настраиваем UI — не ждём сервер
  setupCategoryBar();
  setupTabs();
  setupSearch();
  renderQuickChips();
  renderMarketEmpty();

  // Загружаем данные в фоне
  try {
    [state.insertTypes, state.holders, state.categories] = await Promise.all([
      api("/api/insert-types"),
      api("/api/holders"),
      api("/api/categories"),
    ]);
    renderQuickChips();
    renderShapes();
    renderHoldersTab();
  } catch (e) { console.warn(e); }
}

function setupCategoryBar() {
  $$(".cat-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      $$(".cat-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.category = btn.dataset.cat;
      renderQuickChips();
      if (state.query) doSearch();
    });
  });
}

function setupTabs() {
  $$(".tab").forEach(t => {
    t.addEventListener("click", () => {
      $$(".tab").forEach(x => x.classList.remove("active"));
      t.classList.add("active");
      state.tab = t.dataset.tab;
      renderTab();
    });
  });
}

function setupSearch() {
  $("#search-btn").addEventListener("click", doSearch);
  $("#search-input").addEventListener("keydown", e => e.key === "Enter" && doSearch());
}

function setQuery(q) {
  $("#search-input").value = q;
  doSearch();
}

async function doSearch() {
  const q = $("#search-input").value.trim();
  if (!q) return;
  state.query = q;
  state.loading = true;
  renderTab();

  const [market, compat] = await Promise.allSettled([
    api(`/api/market?q=${encodeURIComponent(q)}&category=${state.category}`),
    api(`/api/compatibility/${encodeURIComponent(q)}`),
  ]);

  state.marketData = market.status === "fulfilled" ? market.value : { error: market.reason?.message, listings: [], stats: {} };
  state.compatData = compat.status === "fulfilled" ? compat.value : null;
  state.loading = false;
  addHistory(q);
  renderTab();
}

function renderQuickChips() {
  const cats = state.categories || {};
  const cat = cats[state.category] || {};
  let list = cat.popular || state.insertTypes?.popular_inserts || [];
  const chips = $("#quick-chips");
  chips.innerHTML = "";
  list.slice(0, 18).forEach(code => {
    const c = document.createElement("span");
    c.className = "chip";
    c.textContent = code;
    c.addEventListener("click", () => {
      $$(".chip").forEach(x => x.classList.remove("active"));
      c.classList.add("active");
      setQuery(code);
    });
    chips.appendChild(c);
  });
}

function renderTab() {
  $$(".tab-panel").forEach(p => p.style.display = "none");
  const panel = $(`#tab-${state.tab}`);
  if (panel) panel.style.display = "";

  if (state.tab === "market") renderMarket();
  else if (state.tab === "compat") renderCompat();
  else if (state.tab === "shapes") renderShapes();
  else if (state.tab === "holders") renderHoldersTab();
}

function renderMarketEmpty() {
  $("#tab-market").innerHTML = empty("🔍", "Выберите категорию и введите название инструмента");
}

/* ══ MARKET ══ */
function renderMarket() {
  const p = $("#tab-market");
  if (state.loading) { p.innerHTML = loader(); return; }
  if (!state.marketData) { p.innerHTML = empty("🔍", "Введите запрос"); return; }

  const d = state.marketData;
  const s = d.stats || {};
  let html = "";

  // Compare button
  const alreadyInCmp = cmpItems.find(x => x.query === state.query && x.category === state.category);
  html += `<div style="margin-bottom:16px;display:flex;gap:8px;flex-wrap:wrap">
    <button class="btn ${alreadyInCmp ? "btn-secondary" : "btn-primary"}" onclick="cmpAdd()" ${alreadyInCmp ? "disabled" : ""}>
      ${alreadyInCmp ? "✅ Добавлено в сравнение" : "⚖️ Добавить в сравнение"}
    </button>
    ${cmpItems.length > 1 ? `<button class="btn btn-secondary" onclick="openCompare()">Открыть сравнение (${cmpItems.length})</button>` : ""}
  </div>`;

  // Marketplace buttons
  const q = encodeURIComponent(state.query);
  const markets = [
    { label: "Авито", color: "#00aaff", text: "#fff", url: `https://www.avito.ru/rossiya?q=${q}` },
    { label: "Яндекс Маркет", color: "#ffcc00", text: "#000", url: `https://market.yandex.ru/search?text=${q}` },
    { label: "Ozon", color: "#005bff", text: "#fff", url: `https://www.ozon.ru/search/?text=${q}&from_global=true` },
    { label: "Wildberries", color: "#cb11ab", text: "#fff", url: `https://www.wildberries.ru/catalog/0/search.aspx?search=${q}` },
    { label: "ВсеИнструменты", color: "#e8380d", text: "#fff", url: `https://www.vseinstrumenti.ru/search/?q=${q}` },
    { label: "220 Вольт", color: "#ff8800", text: "#fff", url: `https://www.220-volt.ru/search/?query=${q}` },
    { label: "Sandvik", color: "#1a3a5c", text: "#ffd700", url: `https://www.sandvik.coromant.com/ru-ru/search#q=${q}` },
    { label: "Iscar", color: "#0057a8", text: "#fff", url: `https://www.iscar.com/eCatalog/item.aspx/lang/RU/Fnum/1?q=${q}` },
  ];

  html += `<div class="marketplace-section">
    <div class="marketplace-label">Найти на площадках</div>
    <div class="marketplace-grid">
      ${markets.map(m => `<a href="${esc(m.url)}" target="_blank" rel="noopener" class="market-btn" style="background:${m.color};color:${m.text}">${esc(m.label)}</a>`).join("")}
    </div>
  </div>`;

  if (d.error && !d.listings?.length) {
    html += `<div class="alert alert-warn">⚠ ${esc(d.error)}</div>`;
  }

  if (d.is_estimate) {
    html += `<div class="alert alert-info">📊 Прямой поиск недоступен — показана <strong>рыночная оценка</strong> на основе базы данных. Для актуальных цен используйте ссылки на площадки выше.</div>`;
  }

  // Section header
  html += `<div class="section-header">
    <span class="section-title">${CAT_ICONS[state.category] || ""} "${esc(state.query)}"</span>
    <span class="source-badge">${esc(d.source || "—")} · ${d.timestamp || ""}${d.from_cache ? ' · <span style="color:var(--warning)">кэш</span>' : ""}</span>
  </div>`;

  // Stats
  html += `<div class="stats-row">
    <div class="stat-card">
      <div class="label">Средняя цена</div>
      <div class="value green">${fmt(s.avg_price)}</div>
      ${s.min_price != null ? `<div style="font-size:.72rem;color:var(--dim);margin-top:3px">Мин: ${fmt(s.min_price)} · Макс: ${fmt(s.max_price)}</div>` : ""}
    </div>
    <div class="stat-card">
      <div class="label">Предложений</div>
      <div class="value blue">${s.offer_count || 0}</div>
    </div>
    <div class="stat-card">
      <div class="label">Популярность</div>
      <div class="value orange">${s.popularity || "—"}</div>
      <div class="pop-bar">${[1, 2, 3, 4, 5].map(i => `<div class="pop-dot${i <= (s.popularity_level || 0) ? " filled" : ""}"></div>`).join("")}</div>
    </div>
  </div>`;

  // Market analysis block
  if (s.offer_count !== undefined) {
    html += renderMarketAnalysis(s);
  }

  // New/Used split
  if (s.new_count > 0 || s.used_count > 0) {
    html += `<div class="price-split">
      <div class="price-box new-box">
        <div class="pb-label">✅ Новый (${s.new_count || 0} шт)</div>
        <div class="pb-val">${fmt(s.new_avg)}</div>
        ${s.new_min != null ? `<div class="pb-range">от ${fmt(s.new_min)} до ${fmt(s.new_max)}</div>` : ""}
      </div>
      <div class="price-box used-box">
        <div class="pb-label">🔄 Б/У (${s.used_count || 0} шт)</div>
        <div class="pb-val">${fmt(s.used_avg)}</div>
        ${s.used_min != null ? `<div class="pb-range">от ${fmt(s.used_min)} до ${fmt(s.used_max)}</div>` : ""}
      </div>
    </div>`;
  }

  // Listings
  if (d.listings?.length) {
    html += `<div class="listings-grid">`;
    d.listings.forEach(item => {
      const condCls = COND_CLS[item.condition] || "cond-unknown";
      const condLabel = COND_LABEL[item.condition] || "—";
      const imgHtml = item.image ? `<img class="listing-img" src="${esc(item.image)}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : "";
      const placeholder = `<div class="listing-img-placeholder" ${item.image ? "style='display:none'" : ""}>${CAT_ICONS[state.category] || "🔧"}</div>`;
      html += `<a class="listing-card" href="${esc(item.url || "#")}" target="_blank" rel="noopener">
        ${imgHtml}${placeholder}
        <div class="listing-body">
          <div class="listing-title">${esc(item.title)}</div>
          <div class="${item.price ? "listing-price" : "listing-price no-price"}">${item.price ? fmt(item.price) : esc(item.price_text)}</div>
          <div class="listing-meta">
            <span class="cond-badge ${condCls}">${condLabel}</span>
            ${item.location ? `<span class="listing-loc">📍 ${esc(item.location)}</span>` : ""}
          </div>
        </div>
      </a>`;
    });
    html += `</div>`;
  } else {
    html += empty("📭", "Объявлений не найдено. Используйте ссылки на площадки выше.");
  }

  p.innerHTML = html;
}

/* ══ COMPAT ══ */
function renderCompat() {
  const p = $("#tab-compat");
  if (state.loading) { p.innerHTML = loader(); return; }
  if (!state.compatData) { p.innerHTML = empty("⚙️", "Введите код пластины (например CNMG 120408) и нажмите Найти"); return; }

  const d = state.compatData;
  const pr = d.parsed || {};
  let html = `<div class="section-title" style="margin-bottom:10px">Пластина: <code>${esc(d.insert_code)}</code></div>
    <div class="parse-row">
      ${pr.shape ? `<div class="parse-item"><strong>Форма:</strong>${esc(pr.shape)}</div>` : ""}
      ${pr.clearance ? `<div class="parse-item"><strong>Задний угол:</strong>${esc(pr.clearance)}</div>` : ""}
      ${pr.tolerance ? `<div class="parse-item"><strong>Допуск:</strong>${esc(pr.tolerance)}</div>` : ""}
      ${pr.size_code ? `<div class="parse-item"><strong>Размер:</strong>${esc(pr.size_code)}</div>` : ""}
    </div>`;

  if (d.applications?.length)
    html += `<div class="card" style="margin-top:12px"><div class="card-title">Применение</div><div class="app-tags">${d.applications.map(a => `<span class="app-tag">${esc(a)}</span>`).join("")}</div></div>`;

  if (d.industries?.length)
    html += `<div class="card"><div class="card-title">Отрасли</div><div class="app-tags">${d.industries.map(a => `<span class="app-tag">🏭 ${esc(a)}</span>`).join("")}</div></div>`;

  if (d.compatible_holders_by_brand?.length) {
    html += `<div class="section-title" style="margin:14px 0 10px">Держатели по брендам</div><div class="brands-grid">`;
    d.compatible_holders_by_brand.forEach(b => {
      html += `<div class="brand-card">
        <div class="brand-header">
          <div class="brand-dot" style="background:${esc(b.logo_color)}"></div>
          <div><div class="brand-name">${esc(b.brand)}</div><div class="brand-country">${esc(b.country)}</div></div>
        </div>
        <div class="brand-line">${esc(b.line)}</div>
        <div class="brand-desc">${esc(b.line_description)}</div>
        <div style="margin-bottom:6px"><div style="font-size:.71rem;color:var(--dim);margin-bottom:2px">Держатели:</div>
          ${b.holders.map(h => `<span class="holder-tag" onclick="setQuery('${esc(h)}')">${esc(h)}</span>`).join("")}
        </div>
        <div><div style="font-size:.71rem;color:var(--dim);margin-bottom:2px">Пластины:</div>
          ${b.matched_inserts.map(i => `<span class="insert-tag" onclick="setQuery('${esc(i)}')">${esc(i)}</span>`).join("")}
        </div>
      </div>`;
    });
    html += `</div>`;
  }

  if (d.positive_variants?.length || d.negative_variants?.length)
    html += `<div class="card" style="margin-top:12px"><div class="card-title">ISO варианты</div>
      <div style="margin-bottom:6px"><span style="font-size:.75rem;color:var(--muted)">Позитивные: </span>${(d.positive_variants || []).map(i => `<span class="insert-tag" onclick="setQuery('${esc(i)}')">${esc(i)}</span>`).join("")}</div>
      <div><span style="font-size:.75rem;color:var(--muted)">Негативные: </span>${(d.negative_variants || []).map(i => `<span class="insert-tag" onclick="setQuery('${esc(i)}')">${esc(i)}</span>`).join("")}</div>
    </div>`;

  p.innerHTML = html;
}

/* ══ SHAPES ══ */
function renderShapes() {
  const p = $("#tab-shapes");
  const cats = state.categories || {};
  const shapes = state.insertTypes?.shapes || {};
  const mats = state.insertTypes?.materials || {};

  let html = `<div class="section-title" style="margin-bottom:12px">Категории инструментов</div><div class="brands-grid" style="margin-bottom:20px">`;
  Object.entries(cats).forEach(([k, c]) => {
    const subs = Object.entries(c.subtypes || {});
    html += `<div class="brand-card">
      <div class="brand-header">
        <div style="font-size:1.4rem">${c.icon || ""}</div>
        <div><div class="brand-name">${esc(c.name)}</div><div class="brand-country">Единица: ${esc(c.unit || "шт")}</div></div>
      </div>
      ${subs.length ? `<div style="margin-bottom:6px">${subs.map(([, v]) => `<span class="app-tag" style="margin:2px;font-size:.73rem">${esc(v)}</span>`).join("")}</div>` : ""}
      ${(c.popular || []).slice(0, 4).map(x => `<span class="insert-tag" onclick="selectCatAndSearch('${k}','${esc(x)}')">${esc(x)}</span>`).join("")}
    </div>`;
  });
  html += `</div>`;

  html += `<div class="section-title" style="margin-bottom:10px">Формы сменных пластин (ISO 1832)</div><div class="shape-grid">`;
  Object.entries(shapes).forEach(([code, s]) => {
    html += `<div class="shape-card" onclick="showShapeDetail('${code}')"><div class="shape-code">${code}</div><div class="shape-name">${esc(s.name)}</div></div>`;
  });
  html += `</div><div id="shape-detail"></div>`;

  html += `<div class="section-title" style="margin:18px 0 10px">Группы материалов ISO 513</div><div class="mat-grid">`;
  Object.entries(mats).forEach(([code, m]) => {
    html += `<div class="mat-badge"><div class="mat-dot" style="background:${esc(m.color)}"></div><div><strong>${code}</strong> — ${esc(m.name)}<div style="font-size:.7rem;color:var(--dim)">${esc(m.description)}</div></div></div>`;
  });
  html += `</div>`;
  p.innerHTML = html;
}

window.selectCatAndSearch = function (cat, q) {
  $$(".cat-btn").forEach(b => b.classList.toggle("active", b.dataset.cat === cat));
  state.category = cat;
  renderQuickChips();
  setQuery(q);
  $$(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === "market"));
  state.tab = "market";
  renderTab();
};

window.showShapeDetail = function (code) {
  const shapes = state.insertTypes?.shapes || {};
  const s = shapes[code]; if (!s) return;
  $$(".shape-card").forEach(c => c.classList.toggle("active", c.querySelector(".shape-code")?.textContent === code));
  $("#shape-detail").innerHTML = `<div class="card" style="margin-top:10px">
    <div class="card-title">${code} — ${esc(s.name)}</div>
    <p style="font-size:.84rem;color:var(--muted);margin-bottom:10px">${esc(s.description)}</p>
    <div class="app-tags">${s.applications.map(a => `<span class="app-tag">${esc(a)}</span>`).join("")}</div>
  </div>`;
};

/* ══ HOLDERS ══ */
function renderHoldersTab() {
  const p = $("#tab-holders");
  if (!state.holders) { p.innerHTML = loader(); return; }
  let html = `<div class="section-title" style="margin-bottom:12px">Поиск по держателю</div>
    <div class="holder-search-row">
      <input id="holder-input" type="text" placeholder="Начало кода держателя, например PCLNR...">
      <button class="btn btn-secondary" onclick="doHolderSearch()">Найти</button>
    </div>
    <div id="holder-results"></div>
    <div class="section-title" style="margin:16px 0 10px">Все держатели по брендам</div>
    <div class="brands-grid">`;

  state.holders.forEach(brand => {
    html += `<div class="brand-card">
      <div class="brand-header">
        <div class="brand-dot" style="background:${esc(brand.logo_color)}"></div>
        <div><div class="brand-name">${esc(brand.brand)}</div><div class="brand-country">${esc(brand.country)}</div></div>
      </div>`;
    brand.lines.forEach(line => {
      html += `<div style="margin-bottom:10px">
        <div class="brand-line">${esc(line.name)}</div>
        <div class="brand-desc">${esc(line.description)}</div>
        <div>${line.holders.slice(0, 4).map(h => `<span class="holder-tag">${esc(h)}</span>`).join("")}</div>
        <div style="margin-top:4px">${line.inserts.slice(0, 4).map(i => `<span class="insert-tag" onclick="setQuery('${esc(i)}')">${esc(i)}</span>`).join("")}</div>
      </div>`;
    });
    html += `</div>`;
  });
  html += `</div>`;
  p.innerHTML = html;
}

window.doHolderSearch = async function () {
  const inp = $("#holder-input"); if (!inp) return;
  const prefix = inp.value.trim();
  const res = $("#holder-results");
  if (!prefix) { res.innerHTML = ""; return; }
  res.innerHTML = loader();
  try {
    const data = await api(`/api/search-by-holder?prefix=${encodeURIComponent(prefix)}`);
    if (!data.length) { res.innerHTML = empty("🔍", "Не найдено"); return; }
    res.innerHTML = `<div class="brands-grid">${data.map(it => `<div class="brand-card">
      <div class="brand-name" style="margin-bottom:6px">${esc(it.brand)} — ${esc(it.line)}</div>
      <div>${it.holders.map(h => `<span class="holder-tag">${esc(h)}</span>`).join("")}</div>
      <div style="margin-top:6px">${it.compatible_inserts.map(i => `<span class="insert-tag" onclick="setQuery('${esc(i)}')">${esc(i)}</span>`).join("")}</div>
    </div>`).join("")}</div>`;
  } catch (e) { res.innerHTML = `<div class="alert alert-warn">Ошибка: ${esc(e.message)}</div>`; }
};

/* ══ CALCULATOR ══ */
function setupCalc() {
  const price = $("#calc-price");
  const qty = $("#calc-qty");
  const res = $("#calc-result");
  if (!price || !qty || !res) return;
  function recalc() {
    const p = parseFloat(price.value);
    const q = parseFloat(qty.value);
    res.textContent = (p > 0 && q > 0) ? (p * q).toLocaleString("ru-RU") + " ₽" : "—";
  }
  price.addEventListener("input", recalc);
  qty.addEventListener("input", recalc);
}

document.addEventListener("DOMContentLoaded", () => { init(); setupCalc(); renderHistory(); });
  
