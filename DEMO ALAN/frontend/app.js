/* ── State ── */
const state = {
  tab: "market",
  category: "inserts",
  categoryManual: false,
  query: "",
  marketData: null,
  compatData: null,
  insertTypes: null,
  holders: null,
  categories: null,
  loading: false,
  user: null,
};

const cmpItems = [];

/* ══ AUTH ══ */
async function checkAuth() {
  try {
    const r = await fetch("/api/auth/me");
    if (r.ok) { state.user = await r.json(); }
    else { state.user = null; }
  } catch { state.user = null; }
  renderAuthBar();
}

function renderAuthBar() {
  let bar = document.getElementById("auth-bar");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "auth-bar";
    bar.style.cssText = "margin-left:8px;display:flex;align-items:center;gap:8px";
    const header = document.querySelector("header div[style*='margin-left:auto']");
    if (header) header.parentNode.insertBefore(bar, header);
  }
  if (state.user) {
    bar.innerHTML = `<span style="font-size:.8rem;color:var(--muted)">${esc(state.user.email)}</span>
      <button class="btn btn-secondary" style="padding:5px 12px;font-size:.78rem" onclick="doLogout()">Выйти</button>`;
  } else {
    bar.innerHTML = `<button class="btn btn-primary" style="padding:5px 14px;font-size:.78rem" onclick="showAuthModal()">Войти / Регистрация</button>`;
  }
}

async function doLogout() {
  await fetch("/api/auth/logout", { method: "POST" });
  state.user = null;
  renderAuthBar();
}

function showAuthModal(tab) {
  tab = tab || "login";
  let m = document.getElementById("auth-modal");
  if (!m) {
    m = document.createElement("div");
    m.id = "auth-modal";
    m.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;z-index:1000";
    m.onclick = e => { if (e.target === m) m.remove(); };
    document.body.appendChild(m);
  }
  m.innerHTML = `<div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:28px;width:340px;max-width:95vw">
    <div style="display:flex;gap:8px;margin-bottom:20px">
      <button id="tab-login-btn" class="btn ${tab==="login"?"btn-primary":"btn-secondary"}" style="flex:1" onclick="showAuthModal('login')">Войти</button>
      <button id="tab-reg-btn" class="btn ${tab==="register"?"btn-primary":"btn-secondary"}" style="flex:1" onclick="showAuthModal('register')">Регистрация</button>
    </div>
    <div id="auth-form-body"></div>
  </div>`;
  renderAuthForm(tab);
}

function renderAuthForm(tab) {
  const body = document.getElementById("auth-form-body");
  if (!body) return;
  if (tab === "forgot") {
    body.innerHTML = `<div style="font-size:.85rem;color:var(--muted);margin-bottom:12px">Введите email — пришлём ссылку для сброса пароля</div>
      <input id="af-email" type="email" placeholder="Email" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);margin-bottom:12px;box-sizing:border-box">
      <button class="btn btn-primary" style="width:100%" onclick="submitForgot()">Отправить письмо</button>
      <div style="text-align:center;margin-top:10px"><span style="font-size:.78rem;color:var(--accent);cursor:pointer" onclick="showAuthModal('login')">← Назад</span></div>
      <div id="auth-msg" style="margin-top:10px;font-size:.82rem;text-align:center"></div>`;
    return;
  }
  body.innerHTML = `<input id="af-email" type="email" placeholder="Email" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);margin-bottom:10px;box-sizing:border-box">
    <input id="af-pass" type="password" placeholder="Пароль" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);margin-bottom:14px;box-sizing:border-box">
    <button class="btn btn-primary" style="width:100%" onclick="submitAuth('${tab}')">${tab==="login"?"Войти":"Зарегистрироваться"}</button>
    ${tab==="login" ? `<div style="text-align:center;margin-top:10px"><span style="font-size:.78rem;color:var(--accent);cursor:pointer" onclick="renderAuthForm('forgot')">Забыли пароль?</span></div>` : ""}
    <div id="auth-msg" style="margin-top:10px;font-size:.82rem;text-align:center;color:#fc8181"></div>`;
}

async function submitForgot() {
  const email = document.getElementById("af-email")?.value.trim();
  const msg = document.getElementById("auth-msg");
  if (!email) { if(msg) msg.textContent = "Введите email"; return; }
  try {
    const r = await fetch("/api/auth/forgot", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({email}) });
    const d = await r.json();
    if (msg) { msg.style.color = "var(--success)"; msg.textContent = d.message || "Письмо отправлено!"; }
  } catch(e) { if(msg) msg.textContent = "Ошибка отправки"; }
}

async function submitAuth(tab) {
  const email = document.getElementById("af-email")?.value.trim();
  const pass = document.getElementById("af-pass")?.value;
  const msg = document.getElementById("auth-msg");
  if (!email || !pass) { if(msg) msg.textContent = "Заполните все поля"; return; }
  try {
    const r = await fetch(`/api/auth/${tab}`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({email, password:pass}) });
    const d = await r.json();
    if (r.ok) {
      state.user = d;
      renderAuthBar();
      document.getElementById("auth-modal")?.remove();
    } else {
      if (msg) msg.textContent = d.detail || "Ошибка";
    }
  } catch(e) { if(msg) msg.textContent = "Ошибка соединения"; }
}

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

const CAT_ICONS = {
  inserts: "🔶", drills: "🔩", mills: "⚙️", burrs: "🌀", reamers: "🔧",
  threading: "🔗", tooling: "🛠️", measuring: "📏", toolholders: "🗜️", other: "📦",
};
const CAT_LABELS = {
  inserts: "Пластины", drills: "Сверла", mills: "Фрезы", burrs: "Борфрезы", reamers: "Развертки",
  threading: "Резьбонарезной", tooling: "Оснастка", measuring: "Измерительный", toolholders: "Державки", other: "Другое",
};

/* ── Auto-detect category from query ── */
function detectCategory(query) {
  const q = query.toUpperCase().replace(/-/g, " ");

  // ISO insert: 4 letters + 4+ digits (CNMG 120408, WNMG080408)
  if (/^[A-Z]{4}\s*\d{4}/.test(q) ||
      /\b(CNMG|WNMG|SNMG|DNMG|CCMT|DCMT|TCMT|RCMT|VCMT|SCMT|TNMG|APMT|SEKT|XOMT|LNUX|RPMT|SPMT|PNMU|ONMU|CCGX|TCGX|DCGX)\b/.test(q)) {
    return { cat: "inserts", label: "Пластины", confidence: "high" };
  }

  // ISO turning holder: 5-6 uppercase letters + size digits (PCLNR 2525M12)
  if (/^(PCLNR|PCLNL|SCLCR|SCLCL|SVJCR|SVJBL|DCLNR|DCLNL|MWLNR|PTGNR|PTGNL|MTJNR|MTJNL|MCLNR|MCLNL|MVJNR|SDUCR|SDUCL|SRGCR|CSRNR)\b/.test(q) ||
      /\b(ДЕРЖАВ[КИ]|РЕЗЦЕДЕРЖАТЕЛЬ|TOOLHOLDER|TURNING\s+HOLDER)\b/.test(q)) {
    return { cat: "toolholders", label: "Державки", confidence: "high" };
  }

  // Measuring instruments
  if (/\b(ШТАНГЕНЦИРКУЛЬ|МИКРОМЕТР|НУТРОМЕР|ГЛУБИНОМЕР|ИНДИКАТОР\s+ЧАС|КАЛИБР|ШАБЛОН|CALIPER|MICROMETER|GAUGE|GAGE|НУТРОМ|РУЛЕТК|ЛИНЕЙК|УГЛОМЕР|ПРОФИЛОМЕТР)\b/.test(q)) {
    return { cat: "measuring", label: "Измерительный", confidence: "high" };
  }

  // Threading tools
  if (/\b(МЕТЧИК|ПЛАШКА|ПЛАШКИ|РЕЗЬБОНАРЕЗ|TAP\b|DIE\b|THREADING|РЕЗЬБОФРЕЗ|ГРЕБЁНК)\b/.test(q) ||
      /[МM]\d+\s*[Х×X]\s*[\d.]/.test(q)) {
    return { cat: "threading", label: "Резьбонарезной", confidence: "high" };
  }

  // Tooling / оснастка
  if (/\b(ОСНАСТК|ПАТРОН|ЦАНГ[АИ]|ОПРАВК[АИ]|ПЕРЕХОДНИК|АДАПТЕР|CHUCK|COLLET|ARBOR|MANDREL|HSK|BT\d|CAT\d)\b/.test(q) ||
      /\bER\s?\d{2}\b/.test(q)) {
    return { cat: "tooling", label: "Оснастка", confidence: "high" };
  }

  // Drills
  if (/\b(СВЕРЛ|DRILL|R840|R845|SDS|HSS|HSSE|СПИРАЛЬ)\b/.test(q)) {
    return { cat: "drills", label: "Сверла", confidence: "high" };
  }

  // Mills
  if (/\b(ФРЕЗ|MILL|R390|R245|COROMILL|ENDMILL|ТОРЦЕВ\w+\s+ФРЕЗ|КОНЦЕВ\w+\s+ФРЕЗ|ШПОНОЧ)\b/.test(q)) {
    return { cat: "mills", label: "Фрезы", confidence: "high" };
  }

  // Burrs
  if (/\b(БОРФРЕЗ|BURR|ШАРОШК)\b/.test(q)) {
    return { cat: "burrs", label: "Борфрезы", confidence: "high" };
  }

  // Reamers
  if (/\b(РАЗВЕРТ|REAMER)\b/.test(q)) {
    return { cat: "reamers", label: "Развертки", confidence: "high" };
  }

  return null;
}

function renderCategoryIndicator(detected) {
  const bar = document.getElementById("cat-detect-bar");
  if (!bar) return;
  if (!state.query) { bar.style.display = "none"; return; }

  if (state.categoryManual) {
    const icon = CAT_ICONS[state.category] || "📦";
    const label = CAT_LABELS[state.category] || state.category;
    bar.style.display = "";
    bar.innerHTML = `<span class="detect-manual">✋ Выбрано вручную: ${icon} <strong>${esc(label)}</strong></span>
      <button class="detect-reset" onclick="resetCategoryAuto()">↩ Авто</button>`;
  } else if (detected) {
    const icon = CAT_ICONS[detected.cat] || "📦";
    bar.style.display = "";
    bar.innerHTML = `<span class="detect-auto">📊 Определена категория: ${icon} <strong>${esc(detected.label)}</strong></span>
      <button class="detect-reset" onclick="resetCategoryAuto()">Изменить</button>`;
  } else if (state.query) {
    bar.style.display = "";
    bar.innerHTML = `<span class="detect-unknown">❓ Категория не определена</span>
      <span style="font-size:.78rem;color:var(--muted)">— выберите вручную</span>`;
  } else {
    bar.style.display = "none";
  }
}

window.resetCategoryAuto = function() {
  state.categoryManual = false;
  $$(".cat-btn").forEach(b => b.classList.remove("active"));
  renderCategoryIndicator(null);
};
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
      state.categoryManual = true;
      renderQuickChips();
      renderCategoryIndicator(null);
      if (state.query) doSearch();
    });
  });
}

function activateCategoryBtn(cat) {
  $$(".cat-btn").forEach(b => b.classList.toggle("active", b.dataset.cat === cat));
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

  // Auto-detect category if user hasn't picked manually
  let detected = null;
  if (!state.categoryManual) {
    detected = detectCategory(q);
    if (detected && detected.cat !== state.category) {
      state.category = detected.cat;
      activateCategoryBtn(state.category);
      renderQuickChips();
    } else if (!detected) {
      // keep current or default
    }
  }
  renderCategoryIndicator(detected);

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
  else if (state.tab === "watch") renderWatchlist();
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
  const watched = isWatched(state.query);
  html += `<div style="margin-bottom:20px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
    <button class="btn ${alreadyInCmp ? "btn-secondary" : "btn-primary"}" onclick="cmpAdd()" ${alreadyInCmp ? "disabled" : ""}>
      ${alreadyInCmp ? "Добавлено в сравнение" : "Добавить в сравнение"}
    </button>
    <button class="btn btn-secondary" onclick="toggleWatch('${state.query.replace(/'/g,"\\'")}','${state.category}')">
      ${watched ? "★ В списке" : "☆ В список"}
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

  // Таблица цен по источникам
  if (d.specialist_sources?.length) {
    html += `<div class="section-header" style="margin-top:26px">
      <span class="section-title">Цены по источникам</span>
      <span class="source-badge">от дешевле к дороже</span>
    </div>
    <div class="source-table-wrap">
    <table>
      <thead><tr>
        <th>Источник</th>
        <th>Тип</th>
        <th>Мин</th>
        <th>Средняя</th>
        <th>Макс</th>
      </tr></thead><tbody>`;
    d.specialist_sources.forEach(src => {
      html += `<tr onclick="window.open('${esc(src.url)}','_blank')">
        <td class="src-name">${esc(src.name)}</td>
        <td class="src-type">${esc(src.type)}</td>
        <td class="src-min">${fmt(src.min_price)}</td>
        <td class="src-avg">${fmt(src.avg_price)}</td>
        <td class="src-max">${fmt(src.max_price)}</td>
      </tr>`;
    });
    html += `</tbody></table></div>`;
  }

  // Sort controls
  if (d.listings?.length) {
    const hasPrice = d.listings.some(x => x.price);
    if (hasPrice) {
      html += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <span style="font-size:.75rem;color:var(--dim);text-transform:uppercase;letter-spacing:.06em">Сортировка:</span>
        <button class="btn btn-secondary" style="padding:5px 14px;font-size:.78rem" onclick="sortListings('asc')">↑ Дешевле</button>
        <button class="btn btn-secondary" style="padding:5px 14px;font-size:.78rem" onclick="sortListings('desc')">↓ Дороже</button>
      </div>`;
    }
  }

  // Listings
  if (d.listings?.length) {
    html += `<div class="listings-grid" id="listings-grid">`;
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
  state.categoryManual = true;
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

window.sortListings = function(dir) {
  if (!state.marketData?.listings) return;
  const sorted = [...state.marketData.listings].sort((a, b) => {
    const pa = a.price ?? (dir === 'asc' ? Infinity : -Infinity);
    const pb = b.price ?? (dir === 'asc' ? Infinity : -Infinity);
    return dir === 'asc' ? pa - pb : pb - pa;
  });
  state.marketData = { ...state.marketData, listings: sorted };
  renderMarket();
};

/* ══ WATCHLIST ══ */
function getWatchlist() { try { return JSON.parse(localStorage.getItem("watchlist") || "[]"); } catch { return []; } }
function saveWatchlist(w) { localStorage.setItem("watchlist", JSON.stringify(w)); updateWatchBadge(); }
function isWatched(q) { return getWatchlist().some(x => x.query === q); }

function toggleWatch(q, cat) {
  let w = getWatchlist();
  const idx = w.findIndex(x => x.query === q);
  if (idx >= 0) { w.splice(idx, 1); }
  else {
    const s = state.marketData?.stats || {};
    w.unshift({ query: q, category: cat, price: s.avg_price || null, addedAt: Date.now() });
  }
  saveWatchlist(w);
  renderMarket();
  if (state.tab === "watch") renderWatchlist();
}

function updateWatchBadge() {
  const w = getWatchlist();
  const badge = $("#watch-badge");
  if (!badge) return;
  badge.textContent = w.length;
  badge.style.display = w.length ? "" : "none";
}

function renderWatchlist() {
  const p = $("#tab-watch");
  if (!p) return;
  const w = getWatchlist();
  if (!w.length) { p.innerHTML = empty("⭐", "Список пуст — добавьте позиции кнопкой ☆ В список"); return; }
  let html = `<div class="section-title" style="margin-bottom:12px">⭐ Список наблюдения (${w.length})</div><div class="listings-grid">`;
  w.forEach(item => {
    html += `<div class="listing-card" style="cursor:default">
      <div class="listing-img-placeholder">${CAT_ICONS[item.category] || "🔧"}</div>
      <div class="listing-body">
        <div class="listing-title" style="cursor:pointer" onclick="setQuery('${item.query.replace(/'/g,"\\'")}')">
          ${esc(item.query)}
        </div>
        <div class="listing-price">${item.price ? fmt(item.price) : "—"}</div>
        <div class="listing-meta">
          <span class="cond-badge cond-new">${CAT_ICONS[item.category] || ""} ${esc(CAT_LABELS[item.category] || item.category)}</span>
          <span style="cursor:pointer;color:#fc8181;font-size:.75rem" onclick="toggleWatch('${item.query.replace(/'/g,"\\'")}','${item.category}')">✕ Удалить</span>
        </div>
      </div>
    </div>`;
  });
  html += `</div>`;
  p.innerHTML = html;
}

document.addEventListener("DOMContentLoaded", () => { init(); setupCalc(); renderHistory(); updateWatchBadge(); checkAuth(); });
