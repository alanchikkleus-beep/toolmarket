/* ── Auth ── */
let currentUser = null;

async function checkAuth() {
  try {
    const r = await fetch("/api/auth/me");
    if (r.ok) { currentUser = await r.json(); }
    else { currentUser = null; }
  } catch { currentUser = null; }
  renderAuthBar();
}

async function doLogout() {
  await fetch("/api/auth/logout", {method:"POST"});
  currentUser = null;
  renderAuthBar();
  renderTab();
}

function renderAuthBar() {
  let bar = document.getElementById("auth-bar");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "auth-bar";
    bar.style.cssText = "display:flex;align-items:center;gap:8px;margin-left:auto";
    document.querySelector("header")?.appendChild(bar);
  }
  if (currentUser) {
    bar.innerHTML = `
      <span style="font-size:.8rem;color:var(--muted)">👤 ${esc(currentUser.email)}</span>
      <button class="btn btn-secondary" style="font-size:.75rem;padding:5px 12px" onclick="doLogout()">Выйти</button>`;
  } else {
    bar.innerHTML = `<button class="btn btn-primary" style="font-size:.75rem;padding:5px 12px" onclick="showAuthModal()">Войти / Регистрация</button>`;
  }
}

function showAuthModal(mode = "login") {
  const existing = document.getElementById("auth-modal");
  if (existing) existing.remove();
  const div = document.createElement("div");
  div.id = "auth-modal";
  div.style.cssText = "position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center";
  div.innerHTML = `<div style="position:relative;background:#1a202c;border:1px solid var(--border);border-radius:16px;padding:32px;width:100%;max-width:360px;box-shadow:0 8px 40px rgba(0,0,0,.6)">
    <div style="display:flex;gap:0;margin-bottom:24px;border-radius:8px;overflow:hidden;border:1px solid var(--border)">
      <button id="tab-login-btn" onclick="switchAuthTab('login')" style="flex:1;padding:10px;border:none;cursor:pointer;font-size:.9rem;font-weight:600;background:${mode==="login"?"var(--accent)":"var(--card)"};color:${mode==="login"?"#fff":"var(--muted)"}">Войти</button>
      <button id="tab-reg-btn" onclick="switchAuthTab('register')" style="flex:1;padding:10px;border:none;cursor:pointer;font-size:.9rem;font-weight:600;background:${mode==="register"?"var(--accent)":"var(--card)"};color:${mode==="register"?"#fff":"var(--muted)"}">Регистрация</button>
    </div>
    <div id="auth-form-wrap">${renderAuthForm(mode)}</div>
    <button onclick="document.getElementById('auth-modal').remove()" style="position:absolute;top:16px;right:16px;background:none;border:none;color:var(--dim);font-size:1.2rem;cursor:pointer">✕</button>
  </div>`;
  document.body.appendChild(div);
  div.addEventListener("click", e => { if (e.target === div) div.remove(); });
}

function renderAuthForm(mode) {
  return `<form onsubmit="submitAuth(event,'${mode}')">
    <div style="margin-bottom:14px">
      <label style="font-size:.8rem;color:var(--muted);display:block;margin-bottom:6px">Email</label>
      <input id="auth-email" type="email" required placeholder="you@example.com"
        style="width:100%;padding:10px 14px;background:var(--bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:.9rem;box-sizing:border-box">
    </div>
    <div style="margin-bottom:${mode==="login"?"8px":"20px"}">
      <label style="font-size:.8rem;color:var(--muted);display:block;margin-bottom:6px">Пароль</label>
      <input id="auth-password" type="password" required placeholder="Минимум 6 символов" minlength="6"
        style="width:100%;padding:10px 14px;background:var(--bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:.9rem;box-sizing:border-box">
    </div>
    ${mode==="login"?`<div style="text-align:right;margin-bottom:16px">
      <a href="#" onclick="showForgotForm()" style="font-size:.78rem;color:var(--accent);text-decoration:none">Забыли пароль?</a>
    </div>`:""}
    <div id="auth-error" style="color:#fc8181;font-size:.82rem;margin-bottom:12px;display:none"></div>
    <button type="submit" class="btn btn-primary" style="width:100%;padding:12px;font-size:.95rem">
      ${mode==="login"?"Войти":"Зарегистрироваться"}
    </button>
  </form>`;
}

window.switchAuthTab = function(mode) {
  document.getElementById("tab-login-btn").style.background = mode==="login"?"var(--accent)":"var(--card)";
  document.getElementById("tab-login-btn").style.color = mode==="login"?"#fff":"var(--muted)";
  document.getElementById("tab-reg-btn").style.background = mode==="register"?"var(--accent)":"var(--card)";
  document.getElementById("tab-reg-btn").style.color = mode==="register"?"#fff":"var(--muted)";
  document.getElementById("auth-form-wrap").innerHTML = renderAuthForm(mode);
};

window.showForgotForm = function() {
  const wrap = document.getElementById("auth-form-wrap"); if (!wrap) return;
  wrap.innerHTML = `<form onsubmit="submitForgot(event)">
    <p style="font-size:.85rem;color:var(--muted);margin-bottom:16px">Введите email — отправим ссылку для сброса пароля</p>
    <div style="margin-bottom:16px">
      <label style="font-size:.8rem;color:var(--muted);display:block;margin-bottom:6px">Email</label>
      <input id="forgot-email" type="email" required placeholder="you@example.com"
        style="width:100%;padding:10px 14px;background:var(--bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:.9rem;box-sizing:border-box">
    </div>
    <div id="forgot-msg" style="font-size:.82rem;margin-bottom:12px;display:none"></div>
    <button type="submit" class="btn btn-primary" style="width:100%;padding:12px">Отправить письмо</button>
    <div style="text-align:center;margin-top:12px">
      <a href="#" onclick="switchAuthTab('login')" style="font-size:.78rem;color:var(--dim);text-decoration:none">← Вернуться к входу</a>
    </div>
  </form>`;
};

window.submitForgot = async function(e) {
  e.preventDefault();
  const email = document.getElementById("forgot-email").value;
  const msg = document.getElementById("forgot-msg");
  const btn = e.target.querySelector("button[type=submit]");
  btn.disabled = true; btn.textContent = "...";
  try {
    const r = await fetch("/api/auth/forgot", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({email})
    });
    const data = await r.json();
    msg.style.display = "block";
    if (data.ok) {
      msg.style.color = "#48bb78";
      msg.textContent = "✅ Письмо отправлено! Проверьте почту.";
      btn.style.display = "none";
    } else {
      msg.style.color = "#fc8181";
      msg.textContent = data.error || "Ошибка";
      btn.disabled = false; btn.textContent = "Отправить письмо";
    }
  } catch { msg.style.display="block"; msg.style.color="#fc8181"; msg.textContent="Ошибка соединения"; btn.disabled=false; btn.textContent="Отправить письмо"; }
};

window.submitAuth = async function(e, mode) {
  e.preventDefault();
  const email = document.getElementById("auth-email").value;
  const password = document.getElementById("auth-password").value;
  const errEl = document.getElementById("auth-error");
  const btn = e.target.querySelector("button[type=submit]");
  btn.disabled = true; btn.textContent = "...";
  const r = await fetch(mode==="login"?"/api/auth/login":"/api/auth/register", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({email, password})
  });
  const result = await r.json();
  if (result.ok) {
    currentUser = result;
    document.getElementById("auth-modal").remove();
    renderAuthBar();
    await syncWatchlistToServer();
    renderTab();
  } else {
    errEl.textContent = result.error || "Ошибка";
    errEl.style.display = "block";
    btn.disabled = false;
    btn.textContent = mode==="login"?"Войти":"Зарегистрироваться";
  }
};

window.showAuthModal = showAuthModal;

/* ── Reset Password ── */
function showResetForm(token) {
  const div = document.createElement("div");
  div.id = "auth-modal";
  div.style.cssText = "position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center";
  div.innerHTML = `<div style="background:#1a202c;border:1px solid var(--border);border-radius:16px;padding:32px;width:100%;max-width:360px">
    <h3 style="margin-bottom:20px;color:var(--accent)">🔑 Новый пароль</h3>
    <form onsubmit="submitReset(event,'${token}')">
      <div style="margin-bottom:16px">
        <label style="font-size:.8rem;color:var(--muted);display:block;margin-bottom:6px">Новый пароль</label>
        <input id="reset-password" type="password" required minlength="6" placeholder="Минимум 6 символов"
          style="width:100%;padding:10px 14px;background:var(--bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:.9rem;box-sizing:border-box">
      </div>
      <div id="reset-msg" style="font-size:.82rem;margin-bottom:12px;display:none"></div>
      <button type="submit" class="btn btn-primary" style="width:100%;padding:12px">Сохранить пароль</button>
    </form>
  </div>`;
  document.body.appendChild(div);
}

window.submitReset = async function(e, token) {
  e.preventDefault();
  const password = document.getElementById("reset-password").value;
  const msg = document.getElementById("reset-msg");
  const btn = e.target.querySelector("button[type=submit]");
  btn.disabled = true; btn.textContent = "...";
  try {
    const r = await fetch("/api/auth/reset", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({token, password})
    });
    const data = await r.json();
    msg.style.display = "block";
    if (data.ok) {
      msg.style.color = "#48bb78";
      msg.textContent = "✅ Пароль изменён! Входите с новым паролем.";
      btn.style.display = "none";
      setTimeout(() => { window.location.href = "/"; }, 2000);
    } else {
      msg.style.color = "#fc8181";
      msg.textContent = data.error || "Ошибка";
      btn.disabled = false; btn.textContent = "Сохранить пароль";
    }
  } catch { msg.style.display="block"; msg.style.color="#fc8181"; msg.textContent="Ошибка"; btn.disabled=false; btn.textContent="Сохранить пароль"; }
};

/* ── Watchlist sync ── */
async function syncWatchlistToServer() {
  if (!currentUser) return;
  const local = getWatchlist();
  for (const item of local) {
    await fetch("/api/watchlist", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({query:item.query, category:item.category, price:item.price})
    });
  }
  await loadWatchlistFromServer();
}

async function loadWatchlistFromServer() {
  if (!currentUser) return;
  try {
    const r = await fetch("/api/watchlist");
    if (!r.ok) return;
    const data = await r.json();
    const list = data.map(x => ({query:x.query, category:x.category, price:x.price, addedAt:x.added_at, prevPrice:null}));
    localStorage.setItem("watchlist", JSON.stringify(list));
    updateWatchBadge();
  } catch(e) {}
}

/* ── Price History ── */
function getItemHistory(q, cat) { try { return JSON.parse(localStorage.getItem(`ph_${q}_${cat}`) || "[]"); } catch { return []; } }
function addPriceHistory(q, cat, price) {
  if (!price) return;
  let h = getItemHistory(q, cat);
  h.push({ price, date: new Date().toISOString() });
  h = h.slice(-30);
  localStorage.setItem(`ph_${q}_${cat}`, JSON.stringify(h));
}
function renderSparkline(history) {
  if (!history || history.length < 2) return "";
  const prices = history.map(x => x.price);
  const min = Math.min(...prices), max = Math.max(...prices), range = max - min || 1;
  const w = 120, h = 36, pad = 4;
  const pts = prices.map((p, i) => {
    const x = pad + (i / (prices.length - 1)) * (w - pad * 2);
    const y = pad + (1 - (p - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  }).join(" ");
  const last = prices[prices.length - 1], first = prices[0];
  const color = last >= first ? "#fc8181" : "#48bb78";
  const lx = pad + (w - pad * 2), ly = pad + (1 - (last - min) / range) * (h - pad * 2);
  return `<svg width="${w}" height="${h}" style="display:block;margin-top:6px">
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round"/>
    <circle cx="${lx}" cy="${ly}" r="2.5" fill="${color}"/>
  </svg>`;
}

/* ── Watchlist ── */
function getWatchlist() { try { return JSON.parse(localStorage.getItem("watchlist") || "[]"); } catch { return []; } }
function saveWatchlist(list) { localStorage.setItem("watchlist", JSON.stringify(list)); updateWatchBadge(); }
function isWatched(q) { return getWatchlist().some(x => x.query === q && x.category === state.category); }

function toggleWatch() {
  const q = state.query; if (!q) return;
  let list = getWatchlist();
  if (isWatched(q)) {
    list = list.filter(x => !(x.query === q && x.category === state.category));
    saveWatchlist(list);
    if (currentUser) fetch("/api/watchlist", {method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:q,category:state.category})}).catch(()=>{});
  } else {
    const price = state.marketData?.stats?.avg_price || null;
    list.unshift({query:q, category:state.category, addedAt:new Date().toISOString(), price, prevPrice:null});
    saveWatchlist(list);
    if (price) addPriceHistory(q, state.category, price);
    if (currentUser) fetch("/api/watchlist", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:q,category:state.category,price})}).catch(()=>{});
  }
  renderMarket();
}

function removeWatch(q, cat) {
  saveWatchlist(getWatchlist().filter(x => !(x.query === q && x.category === cat)));
  if (currentUser) fetch("/api/watchlist", {method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:q,category:cat})}).catch(()=>{});
  renderWatchlist();
}

async function updateWatchPrice(q, cat) {
  const btnId = `upd-${btoa(q+cat).replace(/[^a-z0-9]/gi,"").slice(0,8)}`;
  const btn = document.getElementById(btnId);
  if (btn) { btn.textContent = "⏳"; btn.disabled = true; }
  try {
    const data = await api(`/api/market?q=${encodeURIComponent(q)}&category=${encodeURIComponent(cat)}`);
    const newPrice = data?.stats?.avg_price || null;
    if (newPrice) addPriceHistory(q, cat, newPrice);
    let list = getWatchlist();
    list = list.map(x => (x.query===q&&x.category===cat) ? {...x, prevPrice:x.price, price:newPrice, updatedAt:new Date().toISOString()} : x);
    saveWatchlist(list);
    if (currentUser && newPrice) fetch("/api/watchlist", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:q,category:cat,price:newPrice})}).catch(()=>{});
    renderWatchlist();
  } catch(e) { if (btn) { btn.textContent="↻ Обновить"; btn.disabled=false; } }
}

async function checkPriceChanges() {
  const list = getWatchlist(); if (!list.length) return;
  const changes = [];
  for (const item of list.slice(0, 5)) {
    try {
      const data = await api(`/api/market?q=${encodeURIComponent(item.query)}&category=${encodeURIComponent(item.category)}`);
      const newPrice = data?.stats?.avg_price;
      if (newPrice && item.price && Math.abs(newPrice - item.price) / item.price > 0.05) {
        changes.push({query:item.query, oldPrice:item.price, newPrice});
        addPriceHistory(item.query, item.category, newPrice);
        let wl = getWatchlist();
        wl = wl.map(x => (x.query===item.query&&x.category===item.category) ? {...x, prevPrice:x.price, price:newPrice, updatedAt:new Date().toISOString()} : x);
        saveWatchlist(wl);
      }
    } catch(e) {}
  }
  if (changes.length) showPriceAlert(changes);
}

function showPriceAlert(changes) {
  const existing = document.getElementById("price-alert"); if (existing) existing.remove();
  const div = document.createElement("div");
  div.id = "price-alert";
  div.style.cssText = "position:fixed;top:16px;right:16px;z-index:9999;background:#1a202c;border:1px solid var(--accent);border-radius:12px;padding:16px 20px;max-width:320px;box-shadow:0 8px 32px rgba(0,0,0,.5)";
  div.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
    <strong style="color:var(--accent)">📊 Изменение цен</strong>
    <span style="cursor:pointer;color:var(--dim);font-size:1.1rem" onclick="document.getElementById('price-alert').remove()">✕</span>
  </div>` + changes.map(c => {
    const diff=c.newPrice-c.oldPrice, pct=Math.round(Math.abs(diff)/c.oldPrice*100), up=diff>0;
    return `<div style="margin-bottom:6px;font-size:.84rem"><div style="color:var(--text)">${esc(c.query)}</div>
      <div style="${up?"color:#fc8181":"color:#48bb78"}">${up?"▲":"▼"} ${pct}% · ${c.oldPrice.toLocaleString("ru-RU")} → ${c.newPrice.toLocaleString("ru-RU")} ₽</div></div>`;
  }).join("") +
  `<button class="btn btn-secondary" style="width:100%;margin-top:8px;font-size:.78rem" onclick="document.getElementById('price-alert').remove()">Понятно</button>`;
  document.body.appendChild(div);
  setTimeout(() => { if (div.parentNode) div.remove(); }, 15000);
}

function updateWatchBadge() {
  const badge = $("#watch-badge"); if (!badge) return;
  const cnt = getWatchlist().length;
  badge.textContent = cnt; badge.style.display = cnt ? "" : "none";
}

const watchState = { sort:"date", cat:"all" };

function renderWatchlist() {
  const p = $("#tab-watch"); if (!p) return;
  let list = getWatchlist();
  if (!list.length) {
    p.innerHTML = currentUser
      ? empty("⭐", "Список пуст. Найдите инструмент и нажмите ☆ Отслеживать")
      : `<div class="empty"><div class="icon">👤</div>Войдите чтобы синхронизировать список между устройствами<br><br><button class="btn btn-primary" onclick="showAuthModal()">Войти / Регистрация</button></div>`;
    return;
  }
  const cats = [...new Set(list.map(x => x.category))];
  if (watchState.cat !== "all") list = list.filter(x => x.category === watchState.cat);
  if (watchState.sort === "price_asc") list = [...list].sort((a,b) => (a.price||0)-(b.price||0));
  else if (watchState.sort === "price_desc") list = [...list].sort((a,b) => (b.price||0)-(a.price||0));
  else if (watchState.sort === "name") list = [...list].sort((a,b) => a.query.localeCompare(b.query));
  else list = [...list].sort((a,b) => new Date(b.addedAt)-new Date(a.addedAt));

  let html = `<div style="margin-bottom:16px">
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;align-items:center">
      <span style="font-size:.75rem;color:var(--dim);text-transform:uppercase;letter-spacing:.06em">Сортировка:</span>
      <button class="btn ${watchState.sort==="date"?"btn-primary":"btn-secondary"}" style="font-size:.75rem;padding:5px 12px" onclick="setWatchSort('date')">📅 По дате</button>
      <button class="btn ${watchState.sort==="price_asc"?"btn-primary":"btn-secondary"}" style="font-size:.75rem;padding:5px 12px" onclick="setWatchSort('price_asc')">↑ Цена</button>
      <button class="btn ${watchState.sort==="price_desc"?"btn-primary":"btn-secondary"}" style="font-size:.75rem;padding:5px 12px" onclick="setWatchSort('price_desc')">↓ Цена</button>
      <button class="btn ${watchState.sort==="name"?"btn-primary":"btn-secondary"}" style="font-size:.75rem;padding:5px 12px" onclick="setWatchSort('name')">🔤 По имени</button>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
      <span style="font-size:.75rem;color:var(--dim);text-transform:uppercase;letter-spacing:.06em">Категория:</span>
      <button class="btn ${watchState.cat==="all"?"btn-primary":"btn-secondary"}" style="font-size:.75rem;padding:5px 12px" onclick="setWatchCat('all')">Все</button>
      ${cats.map(c=>`<button class="btn ${watchState.cat===c?"btn-primary":"btn-secondary"}" style="font-size:.75rem;padding:5px 12px" onclick="setWatchCat('${c}')">${CAT_ICONS[c]||""} ${esc(c)}</button>`).join("")}
    </div>
  </div>
  ${!currentUser?`<div class="alert alert-info" style="margin-bottom:16px">💡 <a href="#" onclick="showAuthModal()" style="color:var(--accent)">Войдите</a> чтобы список сохранялся на сервере</div>`:""}
  <div style="margin-bottom:12px;font-size:.85rem;color:var(--dim)">⭐ ${list.length} позиций</div>
  <div class="listings-grid">`;

  list.forEach(item => {
    const date = item.addedAt ? new Date(item.addedAt).toLocaleDateString("ru-RU") : "—";
    const updDate = item.updatedAt ? new Date(item.updatedAt).toLocaleDateString("ru-RU") : null;
    const hasPriceChange = item.prevPrice && item.price && item.prevPrice !== item.price;
    const priceUp = hasPriceChange && item.price > item.prevPrice;
    const pricePct = hasPriceChange ? Math.round(Math.abs(item.price-item.prevPrice)/item.prevPrice*100) : 0;
    const btnId = `upd-${btoa(item.query+item.category).replace(/[^a-z0-9]/gi,"").slice(0,8)}`;
    const history = getItemHistory(item.query, item.category);
    const sparkline = renderSparkline(history);
    html += `<div class="listing-card" style="cursor:default;display:flex;flex-direction:column">
      <div class="listing-body" style="flex:1">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <div style="font-size:.7rem;color:var(--dim)">${CAT_ICONS[item.category]||""} ${esc(item.category)}</div>
          <div style="font-size:.7rem;color:var(--dim)">📅 ${date}</div>
        </div>
        <div class="listing-title" style="cursor:pointer;color:var(--accent);margin-bottom:8px"
          onclick="selectCatAndSearch('${esc(item.category)}','${item.query.replace(/'/g,"\\'")}')">
          ${esc(item.query)}
        </div>
        <div style="margin-bottom:4px">
          <div style="font-size:.72rem;color:var(--dim);margin-bottom:2px">Текущая цена:</div>
          <div class="listing-price" style="margin:0">${item.price?item.price.toLocaleString("ru-RU")+" ₽":"Неизвестно"}</div>
        </div>
        ${hasPriceChange?`<div style="font-size:.78rem;${priceUp?"color:#fc8181":"color:#48bb78"};margin-bottom:4px">${priceUp?"▲":"▼"} ${pricePct}% от ${item.prevPrice.toLocaleString("ru-RU")} ₽</div>`:""}
        ${sparkline?`<div style="margin-bottom:4px"><div style="font-size:.68rem;color:var(--dim);margin-bottom:2px">📈 История (${history.length} точек)</div>${sparkline}</div>`:""}
        ${updDate?`<div style="font-size:.7rem;color:var(--dim)">Обновлено: ${updDate}</div>`:""}
      </div>
      <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">
        <button class="btn btn-primary" style="font-size:.73rem;padding:5px 10px;flex:1"
          onclick="selectCatAndSearch('${esc(item.category)}','${item.query.replace(/'/g,"\\'")}')">🔍 Найти</button>
        <button id="${btnId}" class="btn btn-secondary" style="font-size:.73rem;padding:5px 10px;flex:1"
          onclick="updateWatchPrice('${item.query.replace(/'/g,"\\'")}','${esc(item.category)}')">↻ Обновить</button>
        <button class="btn btn-secondary" style="font-size:.73rem;padding:5px 10px;color:#fc8181;border-color:#fc8181"
          onclick="removeWatch('${item.query.replace(/'/g,"\\'")}','${esc(item.category)}')">✕</button>
      </div>
    </div>`;
  });
  html += `</div>`;
  p.innerHTML = html;
}

window.setWatchSort = function(s) { watchState.sort=s; renderWatchlist(); };
window.setWatchCat = function(c) { watchState.cat=c; renderWatchlist(); };

/* ── Market Analysis ── */
function calcRarity(stats) {
  const count=stats.offer_count||0;
  let volatility=0;
  if (stats.avg_price&&stats.min_price!=null&&stats.max_price!=null&&stats.avg_price>0)
    volatility=Math.round(((stats.max_price-stats.min_price)/stats.avg_price)*100);
  let label,icon,cls,desc;
  if (count===0){label="Редкий товар";icon="💎";cls="rarity-rare";desc="Нет предложений на рынке";}
  else if (count>=20){label="Обычный товар";icon="📦";cls="rarity-common";desc="Много предложений · Стабильный рынок";}
  else if (count>=5){label="Ограниченное предложение";icon="⚡";cls="rarity-limited";desc=volatility>45?"Мало предложений · Высокий разброс":"Умеренный разброс";}
  else{label="Редкий товар";icon="💎";cls="rarity-rare";desc="Очень мало предложений";}
  if (count>0&&count<8&&stats.avg_price&&stats.avg_price>5000){label="Высокая ценность";icon="🏆";cls="rarity-valuable";desc="Высокая цена + ограниченная доступность";}
  return {label,icon,cls,desc,volatility,count};
}
function calcDealScore(stats) {
  if (!stats.avg_price||stats.min_price==null||stats.max_price==null) return null;
  const spread=stats.max_price-stats.min_price; if (spread<10) return "medium";
  const pos=(stats.avg_price-stats.min_price)/spread;
  return pos<=0.35?"cheap":pos<=0.65?"medium":"expensive";
}
function renderMarketAnalysis(stats) {
  const rarity=calcRarity(stats),deal=calcDealScore(stats);
  const volColor=rarity.volatility>60?"#fc8181":rarity.volatility>30?"#ed8936":"#48bb78";
  const volWidth=Math.min(rarity.volatility,100);
  const dealHtml=deal?`<div class="metric-block"><div class="metric-label">Оценка цены</div>
    <div class="deal-score">
      <div class="deal-segment ${deal==="cheap"?"active-cheap":""}">💚 Дёшево</div>
      <div class="deal-segment ${deal==="medium"?"active-medium":""}">🟡 Средне</div>
      <div class="deal-segment ${deal==="expensive"?"active-expensive":""}">🔴 Дорого</div>
    </div></div>`:"";
  return `<div class="market-analysis">
    <div class="analysis-header"><div class="analysis-title">Анализ рынка</div>
      <div class="rarity-badge ${rarity.cls}">${rarity.icon} ${esc(rarity.label)}</div></div>
    <div style="font-size:.82rem;color:var(--muted);margin-bottom:14px">${esc(rarity.desc)}</div>
    <div class="analysis-metrics">
      <div class="metric-block"><div class="metric-label">Волатильность цен</div>
        <div class="vol-track"><div class="vol-fill" style="width:${volWidth}%;background:${volColor}"></div></div>
        <div class="vol-pct">Разброс: ${rarity.volatility}% · ${rarity.volatility<20?"Стабильные цены":rarity.volatility<50?"Умеренный разброс":"Высокий разброс цен"}</div>
      </div>${dealHtml}
    </div>
  </div>`;
}

/* ── Compare ── */
const state = {tab:"market",category:"inserts",query:"",marketData:null,compatData:null,insertTypes:null,holders:null,categories:null,loading:false};
const cmpItems = [];

function cmpAdd() {
  if (!state.query||!state.marketData) return;
  if (cmpItems.length>=3){alert("Максимум 3 позиции");return;}
  if (cmpItems.find(x=>x.query===state.query&&x.category===state.category)){alert("Уже добавлено");return;}
  cmpItems.push({query:state.query,category:state.category,market:state.marketData,compat:state.compatData});
  updateCmpBadge();renderTab();
}
function cmpRemove(idx){cmpItems.splice(idx,1);updateCmpBadge();renderCmpContent();}
function updateCmpBadge(){
  const btn=$("#cmp-open-btn"),cnt=$("#cmp-count");if (!btn||!cnt) return;
  cnt.textContent=cmpItems.length;btn.style.display=cmpItems.length?"":"none";
}
window.openCompare=function(){if (!cmpItems.length) return;$("#cmp-modal").style.display="flex";renderCmpContent();};
window.closeCompare=function(){$("#cmp-modal").style.display="none";};

function renderCmpContent() {
  const box=$("#cmp-content");if (!box) return;
  if (!cmpItems.length){box.innerHTML=`<div class="empty" style="padding:40px">Нет позиций</div>`;return;}
  const prices=cmpItems.map(it=>it.market?.stats?.avg_price||null);
  const minP=Math.min(...prices.filter(Boolean));
  const rows=[
    {key:"head",render:(it,i)=>`<div class="cmp-cell head"><div><div style="font-size:.8rem;color:var(--dim)">${CAT_ICONS[it.category]||""} ${esc(it.category)}</div><div>${esc(it.query)}</div></div><button class="cmp-add-btn" onclick="cmpRemove(${i})">✕</button></div>`},
    {label:"Средняя цена",render:(it)=>{const p=it.market?.stats?.avg_price,best=p&&p===minP;return `<div class="cmp-cell${best?" cmp-best":""}"><div class="cmp-price">${p?p.toLocaleString("ru-RU")+" ₽":"—"}</div>${best?`<div style="font-size:.72rem;color:var(--success)">✅ Лучшая цена</div>`:""}</div>`;}},
    {label:"Диапазон цен",render:(it)=>{const s=it.market?.stats||{};return `<div class="cmp-cell">${s.min_price!=null?`от ${s.min_price.toLocaleString("ru-RU")} до ${s.max_price.toLocaleString("ru-RU")} ₽`:"—"}</div>`;}},
    {label:"Предложений",render:(it)=>`<div class="cmp-cell">${it.market?.stats?.offer_count||0} шт</div>`},
    {label:"Популярность",render:(it)=>`<div class="cmp-cell">${it.market?.stats?.popularity||"—"}</div>`},
    {label:"Форма",render:(it)=>`<div class="cmp-cell">${esc(it.compat?.parsed?.shape||"—")}</div>`},
    {label:"Применение",render:(it)=>{const apps=it.compat?.applications||[];return `<div class="cmp-cell">${apps.length?apps.map(a=>`<span class="app-tag" style="margin:2px;font-size:.73rem">${esc(a)}</span>`).join(""):"—"}</div>`;}},
  ];
  let html=`<div class="cmp-grid" style="grid-template-columns:repeat(${cmpItems.length},1fr)">`;
  rows.forEach(row=>{
    if (row.label) html+=`<div class="cmp-cell label" style="grid-column:1/-1">${esc(row.label)}</div>`;
    cmpItems.forEach((it,i)=>{html+=row.render(it,i);});
  });
  if (cmpItems.length<3) html+=`<div class="cmp-cell" style="grid-column:1/-1;text-align:center;padding:16px"><button class="btn btn-secondary" onclick="closeCompare()">+ Добавить</button></div>`;
  html+=`</div>`;box.innerHTML=html;
}

/* ── История поиска ── */
function getHistory(){try{return JSON.parse(localStorage.getItem("search_history")||"[]");}catch{return[];}}
function addHistory(q){
  if (!q) return;
  let h=getHistory().filter(x=>x!==q);h.unshift(q);h=h.slice(0,20);
  localStorage.setItem("search_history",JSON.stringify(h));renderHistory();
}
function clearHistory(){localStorage.removeItem("search_history");renderHistory();}
function renderHistory(){
  const el=$("#history-list");if (!el) return;
  const h=getHistory();
  if (!h.length){el.innerHTML=`<span style="color:var(--dim);font-size:.8rem">История пуста</span>`;return;}
  el.innerHTML=h.map(q=>`<span class="chip" onclick="setQuery('${q.replace(/'/g,"\\'")}')">${esc(q)}</span>`).join("")+
    `<span style="cursor:pointer;font-size:.75rem;color:var(--dim);padding:4px 8px;border-radius:20px;border:1px solid var(--border)" onclick="clearHistory()">✕ Очистить</span>`;
}

const CAT_ICONS={inserts:"🔶",drills:"🔩",mills:"⚙️",burrs:"🌀",reamers:"🔧"};
const COND_LABEL={new:"Новый",used:"Б/У",unknown:"—"};
const COND_CLS={new:"cond-new",used:"cond-used",unknown:"cond-unknown"};
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
function esc(s){return String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function loader(){return `<div class="loader"><div class="spinner"></div>Загрузка данных...</div>`;}
function empty(icon,msg){return `<div class="empty"><div class="icon">${icon}</div>${esc(msg)}</div>`;}
function fmt(n){return n!=null?Number(n).toLocaleString("ru-RU")+" ₽":"—";}
async function api(path){const r=await fetch(path);if (!r.ok) throw new Error(`HTTP ${r.status}`);return r.json();}

async function init() {
  setupCategoryBar();setupTabs();setupSearch();renderQuickChips();renderMarketEmpty();updateWatchBadge();
  await checkAuth();
  if (currentUser) await loadWatchlistFromServer();
  setTimeout(checkPriceChanges, 3000);
  try {
    [state.insertTypes,state.holders,state.categories]=await Promise.all([
      api("/api/insert-types"),api("/api/holders"),api("/api/categories"),
    ]);
    renderQuickChips();renderShapes();renderHoldersTab();
  } catch(e){console.warn(e);}
}

function setupCategoryBar(){
  $$(".cat-btn").forEach(btn=>{
    btn.addEventListener("click",()=>{
      $$(".cat-btn").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");state.category=btn.dataset.cat;renderQuickChips();
      if (state.query) doSearch();
    });
  });
}
function setupTabs(){
  $$(".tab").forEach(t=>{
    t.addEventListener("click",()=>{
      $$(".tab").forEach(x=>x.classList.remove("active"));t.classList.add("active");state.tab=t.dataset.tab;renderTab();
    });
  });
}
function setupSearch(){
  $("#search-btn").addEventListener("click",doSearch);
  $("#search-input").addEventListener("keydown",e=>e.key==="Enter"&&doSearch());
}
function setQuery(q){$("#search-input").value=q;doSearch();}

async function doSearch(){
  const q=$("#search-input").value.trim();if (!q) return;
  state.query=q;state.loading=true;renderTab();
  const [market,compat]=await Promise.allSettled([
    api(`/api/market?q=${encodeURIComponent(q)}&category=${state.category}`),
    api(`/api/compatibility/${encodeURIComponent(q)}`),
  ]);
  state.marketData=market.status==="fulfilled"?market.value:{error:market.reason?.message,listings:[],stats:{}};
  state.compatData=compat.status==="fulfilled"?compat.value:null;
  state.loading=false;addHistory(q);renderTab();
}

function renderQuickChips(){
  const cats=state.categories||{},cat=cats[state.category]||{};
  let list=cat.popular||state.insertTypes?.popular_inserts||[];
  const chips=$("#quick-chips");chips.innerHTML="";
  list.slice(0,18).forEach(code=>{
    const c=document.createElement("span");c.className="chip";c.textContent=code;
    c.addEventListener("click",()=>{$$(".chip").forEach(x=>x.classList.remove("active"));c.classList.add("active");setQuery(code);});
    chips.appendChild(c);
  });
}

function renderTab(){
  $$(".tab-panel").forEach(p=>p.style.display="none");
  const panel=$(`#tab-${state.tab}`);if (panel) panel.style.display="";
  if (state.tab==="market") renderMarket();
  else if (state.tab==="compat") renderCompat();
  else if (state.tab==="shapes") renderShapes();
  else if (state.tab==="holders") renderHoldersTab();
  else if (state.tab==="watch") renderWatchlist();
}
function renderMarketEmpty(){$("#tab-market").innerHTML=empty("🔍","Выберите категорию и введите название инструмента");}

/* ══ MARKET ══ */
function renderMarket(){
  const p=$("#tab-market");
  if (state.loading){p.innerHTML=loader();return;}
  if (!state.marketData){p.innerHTML=empty("🔍","Введите запрос");return;}
  const d=state.marketData,s=d.stats||{},ms=d.market_summary||{},sources=d.specialist_sources||[];
  let html="";

  const alreadyInCmp=cmpItems.find(x=>x.query===state.query&&x.category===state.category);
  const watched=isWatched(state.query);
  html+=`<div style="margin-bottom:16px;display:flex;gap:8px;flex-wrap:wrap">
    <button class="btn ${alreadyInCmp?"btn-secondary":"btn-primary"}" onclick="cmpAdd()" ${alreadyInCmp?"disabled":""}>
      ${alreadyInCmp?"✅ Добавлено":"⚖️ Сравнить"}
    </button>
    <button class="btn btn-secondary" onclick="toggleWatch()" style="${watched?"border-color:var(--accent);color:var(--accent)":""}">
      ${watched?"⭐ Отслеживается":"☆ Отслеживать"}
    </button>
    ${cmpItems.length>1?`<button class="btn btn-secondary" onclick="openCompare()">Сравнение (${cmpItems.length})</button>`:""}
  </div>`;

  const q=encodeURIComponent(state.query);
  const mainMarkets=[
    {label:"Авито",color:"#00aaff",text:"#fff",url:`https://www.avito.ru/rossiya?q=${q}`},
    {label:"Яндекс Маркет",color:"#ffcc00",text:"#000",url:`https://market.yandex.ru/search?text=${q}`},
    {label:"Ozon",color:"#005bff",text:"#fff",url:`https://www.ozon.ru/search/?text=${q}&from_global=true`},
    {label:"Wildberries",color:"#cb11ab",text:"#fff",url:`https://www.wildberries.ru/catalog/0/search.aspx?search=${q}`},
    {label:"ВсеИнструменты",color:"#e8380d",text:"#fff",url:`https://www.vseinstrumenti.ru/search/?q=${q}`},
  ];
  html+=`<div class="marketplace-section">
    <div class="marketplace-label">🔗 Найти на площадках</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
      ${mainMarkets.map(m=>`<a href="${esc(m.url)}" target="_blank" rel="noopener" class="market-btn" style="background:${m.color};color:${m.text};font-size:.82rem;padding:8px 14px">${esc(m.label)}</a>`).join("")}
    </div>
  </div>`;

  if (d.is_estimate) html+=`<div class="alert alert-info">📊 Показана <strong>рыночная оценка</strong>. Для актуальных цен используйте ссылки выше.</div>`;

  html+=`<div class="section-header">
    <span class="section-title">${CAT_ICONS[state.category]||""} "${esc(state.query)}"</span>
    <span class="source-badge">${esc(d.source||"—")} · ${d.timestamp||""}${d.from_cache?' · <span style="color:var(--warning)">кэш</span>':""}</span>
  </div>`;

  html+=`<div class="stats-row">
    <div class="stat-card"><div class="label">Средняя цена</div><div class="value green">${fmt(s.avg_price)}</div>
      ${s.min_price!=null?`<div style="font-size:.72rem;color:var(--dim);margin-top:3px">Мин: ${fmt(s.min_price)} · Макс: ${fmt(s.max_price)}</div>`:""}
    </div>
    <div class="stat-card"><div class="label">Предложений</div><div class="value blue">${ms.total_offers||s.offer_count||0}</div></div>
    <div class="stat-card"><div class="label">Популярность</div><div class="value orange">${s.popularity||"—"}</div>
      <div class="pop-bar">${[1,2,3,4,5].map(i=>`<div class="pop-dot${i<=(s.popularity_level||0)?" filled":""}"></div>`).join("")}</div>
    </div>
  </div>`;

  if (s.offer_count!==undefined) html+=renderMarketAnalysis(s);

  if (ms.market_avg) {
    const spreadColor=ms.spread_pct>50?"#fc8181":ms.spread_pct>25?"#ed8936":"#48bb78";
    const rarityIcon=ms.rarity==="Редкий товар"?"💎":ms.rarity==="Ограниченное предложение"?"⚡":ms.rarity==="Умеренное предложение"?"📦":"✅";
    html+=`<div class="market-analysis" style="margin-top:16px">
      <div class="analysis-header">
        <div class="analysis-title">📋 Вывод по рынку</div>
        <div class="rarity-badge rarity-limited">${rarityIcon} ${esc(ms.rarity)}</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:14px">
        <div style="background:var(--bg);border-radius:8px;padding:10px;border:1px solid var(--border)">
          <div style="font-size:.7rem;color:var(--dim);margin-bottom:4px">Минимум</div>
          <div style="font-weight:700;color:#48bb78;font-size:1rem">${fmt(ms.market_min)}</div>
        </div>
        <div style="background:var(--bg);border-radius:8px;padding:10px;border:1px solid var(--border)">
          <div style="font-size:.7rem;color:var(--dim);margin-bottom:4px">Средняя</div>
          <div style="font-weight:700;color:var(--accent);font-size:1rem">${fmt(ms.market_avg)}</div>
        </div>
        <div style="background:var(--bg);border-radius:8px;padding:10px;border:1px solid var(--border)">
          <div style="font-size:.7rem;color:var(--dim);margin-bottom:4px">Максимум</div>
          <div style="font-weight:700;color:#fc8181;font-size:1rem">${fmt(ms.market_max)}</div>
        </div>
        <div style="background:var(--bg);border-radius:8px;padding:10px;border:1px solid var(--border)">
          <div style="font-size:.7rem;color:var(--dim);margin-bottom:4px">Выгодная цена</div>
          <div style="font-weight:700;color:#48bb78;font-size:.9rem">${ms.good_min&&ms.good_max?`${fmt(ms.good_min)} – ${fmt(ms.good_max)}`:"—"}</div>
        </div>
      </div>
      <div style="font-size:.78rem;color:var(--dim)">Разброс: <span style="color:${spreadColor};font-weight:600">${ms.spread_pct}% · ${esc(ms.spread_label)}</span></div>
    </div>`;
  }

  if (sources.length) {
    html+=`<div style="margin-top:20px">
      <div style="font-size:.78rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">📦 Цены по источникам</div>
      <div style="border:1px solid var(--border);border-radius:10px;overflow:hidden">`;
    sources.forEach((src,i)=>{
      const isLast=i===sources.length-1;
      const bb=isLast?"":"border-bottom:1px solid var(--border)";
      if (src.status==="no_data") {
        html+=`<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;${bb}">
          <div><span style="font-weight:600;font-size:.85rem">${esc(src.name)}</span>
          <span style="font-size:.72rem;color:var(--dim);margin-left:8px;background:var(--bg);padding:2px 6px;border-radius:4px">${esc(src.type)}</span></div>
          <div style="font-size:.75rem;color:var(--dim);font-style:italic">данных недостаточно</div>
        </div>`;
      } else {
        html+=`<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;${bb};flex-wrap:wrap;gap:6px">
          <div><span style="font-weight:600;font-size:.85rem">${esc(src.name)}</span>
          <span style="font-size:.72rem;color:var(--dim);margin-left:8px;background:var(--bg);padding:2px 6px;border-radius:4px">${esc(src.type)}</span></div>
          <div style="display:flex;gap:14px;align-items:center">
            <div style="text-align:center"><div style="font-size:.65rem;color:var(--dim)">мин</div><div style="font-size:.82rem;color:#48bb78;font-weight:600">${fmt(src.min_price)}</div></div>
            <div style="text-align:center"><div style="font-size:.65rem;color:var(--dim)">средняя</div><div style="font-size:.9rem;color:var(--accent);font-weight:700">${fmt(src.avg_price)}</div></div>
            <div style="text-align:center"><div style="font-size:.65rem;color:var(--dim)">макс</div><div style="font-size:.82rem;color:#fc8181;font-weight:600">${fmt(src.max_price)}</div></div>
            <div style="text-align:center"><div style="font-size:.65rem;color:var(--dim)">предл.</div><div style="font-size:.82rem;font-weight:600">${src.count} шт</div></div>
          </div>
        </div>`;
      }
    });
    html+=`</div></div>`;
  }

  if (d.listings?.length) {
    html+=`<div style="margin-top:20px">
      <div style="font-size:.78rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">🏆 Оценка по брендам</div>
      <div style="display:flex;gap:8px;margin-bottom:10px">
        <button class="btn btn-secondary" style="padding:5px 14px;font-size:.78rem" onclick="sortListings('asc')">↑ Дешевле</button>
        <button class="btn btn-secondary" style="padding:5px 14px;font-size:.78rem" onclick="sortListings('desc')">↓ Дороже</button>
      </div>
    </div>
    <div class="listings-grid" id="listings-grid">`;
    d.listings.forEach(item=>{
      const condCls=COND_CLS[item.condition]||"cond-unknown",condLabel=COND_LABEL[item.condition]||"—";
      html+=`<a class="listing-card" href="${esc(item.url||"#")}" target="_blank" rel="noopener">
        <div class="listing-img-placeholder">${CAT_ICONS[state.category]||"🔧"}</div>
        <div class="listing-body">
          <div class="listing-title">${esc(item.title)}</div>
          <div class="listing-price">${fmt(item.price)}</div>
          <div class="listing-meta"><span class="cond-badge ${condCls}">${condLabel}</span>
            ${item.location?`<span class="listing-loc">📍 ${esc(item.location)}</span>`:""}
          </div>
        </div>
      </a>`;
    });
    html+=`</div>`;
  }
  p.innerHTML=html;
}

/* ══ COMPAT ══ */
function renderCompat(){
  const p=$("#tab-compat");
  if (state.loading){p.innerHTML=loader();return;}
  if (!state.compatData){p.innerHTML=empty("⚙️","Введите код пластины (например CNMG 120408) и нажмите Найти");return;}
  const d=state.compatData,pr=d.parsed||{};
  let html=`<div class="section-title" style="margin-bottom:10px">Пластина: <code>${esc(d.insert_code)}</code></div>
    <div class="parse-row">
      ${pr.shape?`<div class="parse-item"><strong>Форма:</strong>${esc(pr.shape)}</div>`:""}
      ${pr.clearance?`<div class="parse-item"><strong>Задний угол:</strong>${esc(pr.clearance)}</div>`:""}
      ${pr.tolerance?`<div class="parse-item"><strong>Допуск:</strong>${esc(pr.tolerance)}</div>`:""}
      ${pr.size_code?`<div class="parse-item"><strong>Размер:</strong>${esc(pr.size_code)}</div>`:""}
    </div>`;
  if (d.applications?.length) html+=`<div class="card" style="margin-top:12px"><div class="card-title">Применение</div><div class="app-tags">${d.applications.map(a=>`<span class="app-tag">${esc(a)}</span>`).join("")}</div></div>`;
  if (d.industries?.length) html+=`<div class="card"><div class="card-title">Отрасли</div><div class="app-tags">${d.industries.map(a=>`<span class="app-tag">🏭 ${esc(a)}</span>`).join("")}</div></div>`;
  if (d.compatible_holders_by_brand?.length){
    html+=`<div class="section-title" style="margin:14px 0 10px">Держатели по брендам</div><div class="brands-grid">`;
    d.compatible_holders_by_brand.forEach(b=>{
      html+=`<div class="brand-card">
        <div class="brand-header"><div class="brand-dot" style="background:${esc(b.logo_color)}"></div>
          <div><div class="brand-name">${esc(b.brand)}</div><div class="brand-country">${esc(b.country)}</div></div></div>
        <div class="brand-line">${esc(b.line)}</div><div class="brand-desc">${esc(b.line_description)}</div>
        <div style="margin-bottom:6px"><div style="font-size:.71rem;color:var(--dim);margin-bottom:2px">Держатели:</div>${b.holders.map(h=>`<span class="holder-tag" onclick="setQuery('${esc(h)}')">${esc(h)}</span>`).join("")}</div>
        <div><div style="font-size:.71rem;color:var(--dim);margin-bottom:2px">Пластины:</div>${b.matched_inserts.map(i=>`<span class="insert-tag" onclick="setQuery('${esc(i)}')">${esc(i)}</span>`).join("")}</div>
      </div>`;
    });
    html+=`</div>`;
  }
  p.innerHTML=html;
}

/* ══ SHAPES ══ */
function renderShapes(){
  const p=$("#tab-shapes"),cats=state.categories||{},shapes=state.insertTypes?.shapes||{},mats=state.insertTypes?.materials||{};
  let html=`<div class="section-title" style="margin-bottom:12px">Категории инструментов</div><div class="brands-grid" style="margin-bottom:20px">`;
  Object.entries(cats).forEach(([k,c])=>{
    const subs=Object.entries(c.subtypes||{});
    html+=`<div class="brand-card"><div class="brand-header"><div style="font-size:1.4rem">${c.icon||""}</div>
      <div><div class="brand-name">${esc(c.name)}</div><div class="brand-country">Единица: ${esc(c.unit||"шт")}</div></div></div>
      ${subs.length?`<div style="margin-bottom:6px">${subs.map(([,v])=>`<span class="app-tag" style="margin:2px;font-size:.73rem">${esc(v)}</span>`).join("")}</div>`:""}
      ${(c.popular||[]).slice(0,4).map(x=>`<span class="insert-tag" onclick="selectCatAndSearch('${k}','${esc(x)}')">${esc(x)}</span>`).join("")}
    </div>`;
  });
  html+=`</div><div class="section-title" style="margin-bottom:10px">Формы сменных пластин (ISO 1832)</div><div class="shape-grid">`;
  Object.entries(shapes).forEach(([code,s])=>{
    html+=`<div class="shape-card" onclick="showShapeDetail('${code}')"><div class="shape-code">${code}</div><div class="shape-name">${esc(s.name)}</div></div>`;
  });
  html+=`</div><div id="shape-detail"></div>`;
  html+=`<div class="section-title" style="margin:18px 0 10px">Группы материалов ISO 513</div><div class="mat-grid">`;
  Object.entries(mats).forEach(([code,m])=>{
    html+=`<div class="mat-badge"><div class="mat-dot" style="background:${esc(m.color)}"></div><div><strong>${code}</strong> — ${esc(m.name)}<div style="font-size:.7rem;color:var(--dim)">${esc(m.description)}</div></div></div>`;
  });
  html+=`</div>`;p.innerHTML=html;
}

window.selectCatAndSearch=function(cat,q){
  $$(".cat-btn").forEach(b=>b.classList.toggle("active",b.dataset.cat===cat));
  state.category=cat;renderQuickChips();setQuery(q);
  $$(".tab").forEach(t=>t.classList.toggle("active",t.dataset.tab==="market"));
  state.tab="market";renderTab();
};
window.showShapeDetail=function(code){
  const shapes=state.insertTypes?.shapes||{},s=shapes[code];if (!s) return;
  $$(".shape-card").forEach(c=>c.classList.toggle("active",c.querySelector(".shape-code")?.textContent===code));
  $("#shape-detail").innerHTML=`<div class="card" style="margin-top:10px">
    <div class="card-title">${code} — ${esc(s.name)}</div>
    <p style="font-size:.84rem;color:var(--muted);margin-bottom:10px">${esc(s.description)}</p>
    <div class="app-tags">${s.applications.map(a=>`<span class="app-tag">${esc(a)}</span>`).join("")}</div>
  </div>`;
};

/* ══ HOLDERS ══ */
function renderHoldersTab(){
  const p=$("#tab-holders");if (!state.holders){p.innerHTML=loader();return;}
  let html=`<div class="section-title" style="margin-bottom:12px">Поиск по держателю</div>
    <div class="holder-search-row">
      <input id="holder-input" type="text" placeholder="Начало кода держателя, например PCLNR...">
      <button class="btn btn-secondary" onclick="doHolderSearch()">Найти</button>
    </div>
    <div id="holder-results"></div>
    <div class="section-title" style="margin:16px 0 10px">Все держатели по брендам</div><div class="brands-grid">`;
  state.holders.forEach(brand=>{
    html+=`<div class="brand-card"><div class="brand-header"><div class="brand-dot" style="background:${esc(brand.logo_color)}"></div>
      <div><div class="brand-name">${esc(brand.brand)}</div><div class="brand-country">${esc(brand.country)}</div></div></div>`;
    brand.lines.forEach(line=>{
      html+=`<div style="margin-bottom:10px"><div class="brand-line">${esc(line.name)}</div><div class="brand-desc">${esc(line.description)}</div>
        <div>${line.holders.slice(0,4).map(h=>`<span class="holder-tag">${esc(h)}</span>`).join("")}</div>
        <div style="margin-top:4px">${line.inserts.slice(0,4).map(i=>`<span class="insert-tag" onclick="setQuery('${esc(i)}')">${esc(i)}</span>`).join("")}</div>
      </div>`;
    });
    html+=`</div>`;
  });
  html+=`</div>`;p.innerHTML=html;
}

window.doHolderSearch=async function(){
  const inp=$("#holder-input");if (!inp) return;
  const prefix=inp.value.trim(),res=$("#holder-results");
  if (!prefix){res.innerHTML="";return;}
  res.innerHTML=loader();
  try {
    const data=await api(`/api/search-by-holder?prefix=${encodeURIComponent(prefix)}`);
    if (!data.length){res.innerHTML=empty("🔍","Не найдено");return;}
    res.innerHTML=`<div class="brands-grid">${data.map(it=>`<div class="brand-card">
      <div class="brand-name" style="margin-bottom:6px">${esc(it.brand)} — ${esc(it.line)}</div>
      <div>${it.holders.map(h=>`<span class="holder-tag">${esc(h)}</span>`).join("")}</div>
      <div style="margin-top:6px">${it.compatible_inserts.map(i=>`<span class="insert-tag" onclick="setQuery('${esc(i)}')">${esc(i)}</span>`).join("")}</div>
    </div>`).join("")}</div>`;
  } catch(e){res.innerHTML=`<div class="alert alert-warn">Ошибка: ${esc(e.message)}</div>`;}
};

function setupCalc(){
  const price=$("#calc-price"),qty=$("#calc-qty"),res=$("#calc-result");if (!price||!qty||!res) return;
  function recalc(){const p=parseFloat(price.value),q=parseFloat(qty.value);res.textContent=(p>0&&q>0)?(p*q).toLocaleString("ru-RU")+" ₽":"—";}
  price.addEventListener("input",recalc);qty.addEventListener("input",recalc);
}

window.sortListings=function(dir){
  if (!state.marketData?.listings) return;
  const sorted=[...state.marketData.listings].sort((a,b)=>{
    const pa=a.price??(dir==="asc"?Infinity:-Infinity),pb=b.price??(dir==="asc"?Infinity:-Infinity);
    return dir==="asc"?pa-pb:pb-pa;
  });
  state.marketData={...state.marketData,listings:sorted};renderMarket();
};

document.addEventListener("DOMContentLoaded",()=>{
  init();setupCalc();renderHistory();
  const params=new URLSearchParams(window.location.search);
  const resetToken=params.get("token");
  if (resetToken) showResetForm(resetToken);
});
