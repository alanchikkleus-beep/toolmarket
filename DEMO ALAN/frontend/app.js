/* ── State ── */
const state = {
  tab: "market", category: "inserts", query: "",
  marketData: null, compatData: null,
  insertTypes: null, holders: null, categories: null, loading: false,
};
const cmpItems = [];

/* ── Helpers ── */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
function esc(s) { return String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function loader() { return `<div class="loader"><div class="spinner"></div>Загрузка данных...</div>`; }
function empty(icon, msg) { return `<div class="empty"><div class="icon">${icon}</div>${esc(msg)}</div>`; }
function fmt(n) { return n!=null ? Number(n).toLocaleString("ru-RU")+" ₽" : "—"; }
async function api(path) { const r=await fetch(path); if(!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }

const CAT_ICONS = { inserts:"🔶", drills:"🔩", mills:"⚙️", burrs:"🌀", reamers:"🔧" };
const COND_LABEL = { new:"Новый", used:"Б/У", unknown:"—" };
const COND_CLS   = { new:"cond-new", used:"cond-used", unknown:"cond-unknown" };

/* ── Market Analysis ── */
function calcRarity(stats) {
  const count = stats.offer_count||0;
  let volatility = 0;
  if (stats.avg_price && stats.min_price!=null && stats.max_price!=null && stats.avg_price>0)
    volatility = Math.round(((stats.max_price-stats.min_price)/stats.avg_price)*100);
  let label,icon,cls,desc;
  if (count===0)       { label="Редкий товар";icon="💎";cls="rarity-rare";desc="Нет предложений на рынке"; }
  else if (count>=20)  { label="Обычный товар";icon="📦";cls="rarity-common";desc="Много предложений · Стабильный рынок"; }
  else if (count>=5)   { label="Ограниченное предложение";icon="⚡";cls="rarity-limited";desc=volatility>45?"Высокий разброс цен":"Умеренный разброс"; }
  else                 { label="Редкий товар";icon="💎";cls="rarity-rare";desc="Очень мало предложений"; }
  if (count>0&&count<8&&stats.avg_price&&stats.avg_price>5000) { label="Высокая ценность";icon="🏆";cls="rarity-valuable";desc="Высокая цена + ограниченная доступность"; }
  return {label,icon,cls,desc,volatility,count};
}

function calcDealScore(stats) {
  if (!stats.avg_price||stats.min_price==null||stats.max_price==null) return null;
  const spread=stats.max_price-stats.min_price;
  if (spread<10) return "medium";
  const pos=(stats.avg_price-stats.min_price)/spread;
  return pos<=0.35?"cheap":pos<=0.65?"medium":"expensive";
}

function renderMarketAnalysis(stats) {
  const rarity=calcRarity(stats), deal=calcDealScore(stats);
  const volColor=rarity.volatility>60?"#fc8181":rarity.volatility>30?"#ed8936":"#48bb78";
  const dealHtml=deal?`<div class="metric-block"><div class="metric-label">Оценка цены</div>
    <div class="deal-score">
      <div class="deal-segment ${deal==="cheap"?"active-cheap":""}">💚 Дёшево</div>
      <div class="deal-segment ${deal==="medium"?"active-medium":""}">🟡 Средне</div>
      <div class="deal-segment ${deal==="expensive"?"active-expensive":""}">🔴 Дорого</div>
    </div></div>`:"";
  return `<div class="market-analysis">
    <div class="analysis-header">
      <div class="analysis-title">Анализ рынка</div>
      <div class="rarity-badge ${rarity.cls}">${rarity.icon} ${esc(rarity.label)}</div>
    </div>
    <div style="font-size:.82rem;color:var(--muted);margin-bottom:14px">${esc(rarity.desc)}</div>
    <div class="analysis-metrics">
      <div class="metric-block">
        <div class="metric-label">Волатильность цен</div>
        <div class="vol-track"><div class="vol-fill" style="width:${Math.min(rarity.volatility,100)}%;background:${volColor}"></div></div>
        <div class="vol-pct">Разброс: ${rarity.volatility}% · ${rarity.volatility<20?"Стабильные":rarity.volatility<50?"Умеренный":"Высокий разброс"}</div>
      </div>${dealHtml}
    </div>
  </div>`;
}

/* ── Smart Search Variants ── */
function renderVariants(d) {
  if (!d.variants&&!d.parsed) return "";
  const v=d.variants||{}, p=d.parsed||{};
  let parsedHtml="";
  if (p.parsed&&p.shape) {
    parsedHtml=`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
      ${p.shape?`<span style="background:rgba(99,179,237,.15);border:1px solid rgba(99,179,237,.3);color:#63b3ed;padding:3px 8px;border-radius:6px;font-size:.73rem">Форма: <strong>${esc(p.shape)}</strong></span>`:""}
      ${p.size?`<span style="background:rgba(72,187,120,.15);border:1px solid rgba(72,187,120,.3);color:#68d391;padding:3px 8px;border-radius:6px;font-size:.73rem">Размер: <strong>${esc(p.size)}</strong></span>`:""}
      ${p.chipbreaker?`<span style="background:rgba(237,137,54,.15);border:1px solid rgba(237,137,54,.3);color:#ed8936;padding:3px 8px;border-radius:6px;font-size:.73rem">Стружколом: <strong>${esc(p.chipbreaker)}</strong></span>`:""}
      ${p.grade?`<span style="background:rgba(159,122,234,.15);border:1px solid rgba(159,122,234,.3);color:#b794f4;padding:3px 8px;border-radius:6px;font-size:.73rem">Марка: <strong>${esc(p.grade)}</strong></span>`:""}
    </div>`;
  }
  const rows=[
    v.full&&["Полный артикул",v.full,"#63b3ed"],
    v.code&&v.code!==v.full&&["Артикул+стружколом",v.code,"#68d391"],
    v.base&&v.base!==v.full&&["Базовый артикул",v.base,"#ed8936"],
    v.compact&&v.compact!==v.full&&["Компактный",v.compact,"#b794f4"],
  ].filter(Boolean);
  const varHtml=rows.map(([label,val,color])=>`
    <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.05)">
      <span style="font-size:.7rem;color:var(--dim);min-width:140px">${esc(label)}</span>
      <code style="font-size:.78rem;color:${color};background:rgba(255,255,255,.05);padding:2px 8px;border-radius:4px;flex:1">${esc(val)}</code>
      <button onclick="setQuery('${val.replace(/'/g,"\\'")}');return false" style="font-size:.68rem;padding:3px 10px;border-radius:4px;border:1px solid rgba(255,255,255,.15);background:transparent;color:var(--muted);cursor:pointer;white-space:nowrap">Искать</button>
    </div>`).join("");
  return `<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:14px;margin-bottom:16px">
    <div style="font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;color:var(--dim);margin-bottom:10px">🔍 Умный поиск — варианты запроса</div>
    ${parsedHtml}${varHtml}
  </div>`;
}

/* ── Analogs Block ── */
function renderAnalogs(analogs) {
  if (!analogs||!analogs.length) return "";
  const typeLabel={chipbreaker:"Другой стружколом",corner:"Другой радиус",shape:"Другая форма",grade:"Аналог марки"};
  const typeColor={chipbreaker:"#63b3ed",corner:"#68d391",shape:"#ed8936",grade:"#b794f4"};
  return `<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:14px;margin-bottom:16px">
    <div style="font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;color:var(--dim);margin-bottom:12px">🔄 Аналоги и похожие позиции</div>
    <div style="display:flex;flex-wrap:wrap;gap:8px">
      ${analogs.map(a=>`
        <div onclick="setQuery('${a.code.replace(/'/g,"\\'")}');return false"
          style="cursor:pointer;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:8px 12px;transition:all .2s"
          onmouseover="this.style.background='rgba(255,255,255,.1)'" onmouseout="this.style.background='rgba(255,255,255,.06)'">
          <div style="font-size:.82rem;font-weight:600;color:#e2e8f0;margin-bottom:3px">${esc(a.code)}</div>
          <div style="font-size:.68rem;color:${typeColor[a.type]||"#a0aec0"}">${esc(a.reason)}</div>
          <div style="font-size:.65rem;color:var(--dim);margin-top:2px">${a.relevance}% совпадение</div>
        </div>`).join("")}
    </div>
  </div>`;
}

/* ── Compare ── */
function cmpAdd() {
  if (!state.query||!state.marketData) return;
  if (cmpItems.length>=3) { alert("Максимум 3 позиции"); return; }
  if (cmpItems.find(x=>x.query===state.query&&x.category===state.category)) { alert("Уже добавлено"); return; }
  cmpItems.push({query:state.query,category:state.category,market:state.marketData,compat:state.compatData});
  updateCmpBadge(); renderTab();
}
function cmpRemove(idx) { cmpItems.splice(idx,1); updateCmpBadge(); renderCmpContent(); }
function updateCmpBadge() {
  const btn=$("#cmp-open-btn"),cnt=$("#cmp-count");
  if (!btn||!cnt) return;
  cnt.textContent=cmpItems.length; btn.style.display=cmpItems.length?"":"none";
}
window.openCompare=function(){ if(!cmpItems.length)return; $("#cmp-modal").style.display="flex"; renderCmpContent(); };
window.closeCompare=function(){ $("#cmp-modal").style.display="none"; };
function renderCmpContent() {
  const box=$("#cmp-content"); if(!box)return;
  if(!cmpItems.length){ box.innerHTML=`<div class="empty" style="padding:40px">Нет позиций</div>`; return; }
  const prices=cmpItems.map(it=>it.market?.stats?.avg_price||null);
  const minP=Math.min(...prices.filter(Boolean));
  const rows=[
    {key:"head",render:(it,i)=>`<div class="cmp-cell head"><div><div style="font-size:.8rem;color:var(--dim)">${CAT_ICONS[it.category]||""} ${esc(it.category)}</div><div>${esc(it.query)}</div></div><button class="cmp-add-btn" onclick="cmpRemove(${i})">✕</button></div>`},
    {label:"Средняя цена",render:(it)=>{ const p=it.market?.stats?.avg_price; return `<div class="cmp-cell${p&&p===minP?" cmp-best":""}"><div class="cmp-price">${p?p.toLocaleString("ru-RU")+" ₽":"—"}</div>${p&&p===minP?`<div style="font-size:.72rem;color:var(--success)">✅ Лучшая цена</div>`:""}</div>`; }},
    {label:"Диапазон",render:(it)=>{ const s=it.market?.stats||{}; return `<div class="cmp-cell">${s.min_price!=null?`${s.min_price.toLocaleString("ru-RU")} — ${s.max_price.toLocaleString("ru-RU")} ₽`:"—"}</div>`; }},
    {label:"Предложений",render:(it)=>`<div class="cmp-cell">${it.market?.stats?.offer_count||0} шт</div>`},
    {label:"Форма",render:(it)=>`<div class="cmp-cell">${esc(it.compat?.parsed?.shape||"—")}</div>`},
  ];
  let html=`<div class="cmp-grid" style="grid-template-columns:repeat(${cmpItems.length},1fr)">`;
  rows.forEach(row=>{
    if(row.label) html+=`<div class="cmp-cell label" style="grid-column:1/-1">${esc(row.label)}</div>`;
    cmpItems.forEach((it,i)=>{ html+=row.render(it,i); });
  });
  html+=`</div>`;
  box.innerHTML=html;
}

/* ── История ── */
function getHistory(){ try{ return JSON.parse(localStorage.getItem("search_history")||"[]"); }catch{ return []; } }
function addHistory(q){ if(!q)return; let h=getHistory().filter(x=>x!==q); h.unshift(q); h=h.slice(0,20); localStorage.setItem("search_history",JSON.stringify(h)); renderHistory(); }
function clearHistory(){ localStorage.removeItem("search_history"); renderHistory(); }
function renderHistory(){
  const el=$("#history-list"); if(!el)return;
  const h=getHistory();
  if(!h.length){ el.innerHTML=`<span style="color:var(--dim);font-size:.8rem">История пуста</span>`; return; }
  el.innerHTML=h.map(q=>`<span class="chip" onclick="setQuery('${q.replace(/'/g,"\\'")}')">${esc(q)}</span>`).join("")+
    `<span style="cursor:pointer;font-size:.75rem;color:var(--dim);padding:4px 8px;border-radius:20px;border:1px solid var(--border)" onclick="clearHistory()">✕ Очистить</span>`;
}

/* ── Init ── */
async function init() {
  setupCategoryBar(); setupTabs(); setupSearch(); renderQuickChips(); renderMarketEmpty();
  try {
    [state.insertTypes,state.holders,state.categories]=await Promise.all([
      api("/api/insert-types"),api("/api/holders"),api("/api/categories"),
    ]);
    renderQuickChips(); renderShapes(); renderHoldersTab();
  } catch(e){ console.warn(e); }
}

function setupCategoryBar(){
  $$(".cat-btn").forEach(btn=>{
    btn.addEventListener("click",()=>{
      $$(".cat-btn").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active"); state.category=btn.dataset.cat;
      renderQuickChips(); if(state.query) doSearch();
    });
  });
}
function setupTabs(){
  $$(".tab").forEach(t=>{
    t.addEventListener("click",()=>{
      $$(".tab").forEach(x=>x.classList.remove("active"));
      t.classList.add("active"); state.tab=t.dataset.tab; renderTab();
    });
  });
}
function setupSearch(){
  $("#search-btn").addEventListener("click",doSearch);
  $("#search-input").addEventListener("keydown",e=>e.key==="Enter"&&doSearch());
}
function setQuery(q){ $("#search-input").value=q; doSearch(); }

async function doSearch(){
  const q=$("#search-input").value.trim(); if(!q)return;
  state.query=q; state.loading=true; renderTab();
  const [market,compat]=await Promise.allSettled([
    api(`/api/market?q=${encodeURIComponent(q)}&category=${state.category}`),
    api(`/api/compatibility/${encodeURIComponent(q)}`),
  ]);
  state.marketData=market.status==="fulfilled"?market.value:{error:market.reason?.message,listings:[],stats:{}};
  state.compatData=compat.status==="fulfilled"?compat.value:null;
  state.loading=false; addHistory(q); renderTab();
}

function renderQuickChips(){
  const cats=state.categories||{}, cat=cats[state.category]||{};
  const list=cat.popular||state.insertTypes?.popular_inserts||[];
  const chips=$("#quick-chips"); chips.innerHTML="";
  list.slice(0,18).forEach(code=>{
    const c=document.createElement("span"); c.className="chip"; c.textContent=code;
    c.addEventListener("click",()=>{ $$(".chip").forEach(x=>x.classList.remove("active")); c.classList.add("active"); setQuery(code); });
    chips.appendChild(c);
  });
}
function renderTab(){
  $$(".tab-panel").forEach(p=>p.style.display="none");
  const panel=$(`#tab-${state.tab}`); if(panel) panel.style.display="";
  if(state.tab==="market") renderMarket();
  else if(state.tab==="compat") renderCompat();
  else if(state.tab==="shapes") renderShapes();
  else if(state.tab==="holders") renderHoldersTab();
}
function renderMarketEmpty(){ $("#tab-market").innerHTML=empty("🔍","Выберите категорию и введите название инструмента"); }

/* ══ MARKET ══ */
function renderMarket(){
  const p=$("#tab-market");
  if(state.loading){ p.innerHTML=loader(); return; }
  if(!state.marketData){ p.innerHTML=empty("🔍","Введите запрос"); return; }
  const d=state.marketData, s=d.stats||{};
  let html="";

  const alreadyInCmp=cmpItems.find(x=>x.query===state.query&&x.category===state.category);
  html+=`<div style="margin-bottom:16px;display:flex;gap:8px;flex-wrap:wrap">
    <button class="btn ${alreadyInCmp?"btn-secondary":"btn-primary"}" onclick="cmpAdd()" ${alreadyInCmp?"disabled":""}>
      ${alreadyInCmp?"✅ В сравнении":"⚖️ Добавить в сравнение"}
    </button>
    ${cmpItems.length>1?`<button class="btn btn-secondary" onclick="openCompare()">Сравнить (${cmpItems.length})</button>`:""}
  </div>`;

  // Quick marketplace buttons
  const q=encodeURIComponent(state.query);
  const qBase=encodeURIComponent((state.query.split("-")[0]).trim());
  const markets=[
    {label:"Авито",color:"#00aaff",text:"#fff",url:`https://www.avito.ru/rossiya?q=${qBase}`},
    {label:"Яндекс Маркет",color:"#ffcc00",text:"#000",url:`https://market.yandex.ru/search?text=${qBase}`},
    {label:"Ozon",color:"#005bff",text:"#fff",url:`https://www.ozon.ru/search/?text=${qBase}`},
    {label:"Wildberries",color:"#cb11ab",text:"#fff",url:`https://www.wildberries.ru/catalog/0/search.aspx?search=${qBase}`},
    {label:"ВсеИнструменты",color:"#e8380d",text:"#fff",url:`https://www.vseinstrumenti.ru/search/?q=${qBase}`},
    {label:"Sandvik",color:"#1a3a5c",text:"#ffd700",url:`https://www.sandvik.coromant.com/ru-ru/search#q=${q}`},
    {label:"Iscar",color:"#c00",text:"#fff",url:`https://www.iscar.com/eCatalog/item.aspx/lang/RU/Fnum/1?q=${qBase}`},
    {label:"Pulscen",color:"#0057a8",text:"#fff",url:`https://pulscen.ru/search/?query=${q}`},
  ];
  html+=`<div class="marketplace-section">
    <div class="marketplace-label">Быстрый поиск на площадках</div>
    <div class="marketplace-grid">
      ${markets.map(m=>`<a href="${esc(m.url)}" target="_blank" rel="noopener" class="market-btn" style="background:${m.color};color:${m.text}">${esc(m.label)}</a>`).join("")}
    </div>
  </div>`;

  if(d.is_estimate) html+=`<div class="alert alert-info">📊 Показана <strong>рыночная оценка</strong>. Для актуальных цен нажимайте на площадки выше.</div>`;

  // Smart search variants
  html+=renderVariants(d);

  // Analogs
  if(d.analogs?.length) html+=renderAnalogs(d.analogs);

  html+=`<div class="section-header">
    <span class="section-title">${CAT_ICONS[state.category]||""} "${esc(state.query)}"</span>
    <span class="source-badge">${esc(d.source||"—")} · ${d.timestamp||""}${d.from_cache?' · <span style="color:var(--warning)">кэш</span>':""}</span>
  </div>`;

  html+=`<div class="stats-row">
    <div class="stat-card"><div class="label">Средняя цена</div><div class="value green">${fmt(s.avg_price)}</div>
      ${s.min_price!=null?`<div style="font-size:.72rem;color:var(--dim);margin-top:3px">Мин: ${fmt(s.min_price)} · Макс: ${fmt(s.max_price)}</div>`:""}
    </div>
    <div class="stat-card"><div class="label">Предложений</div><div class="value blue">${s.offer_count||0}</div></div>
    <div class="stat-card"><div class="label">Популярность</div><div class="value orange">${s.popularity||"—"}</div>
      <div class="pop-bar">${[1,2,3,4,5].map(i=>`<div class="pop-dot${i<=(s.popularity_level||0)?" filled":""}"></div>`).join("")}</div>
    </div>
  </div>`;

  if(s.offer_count!==undefined) html+=renderMarketAnalysis(s);

  if(d.listings?.length){
    const hasPrice=d.listings.some(x=>x.price);
    if(hasPrice) html+=`<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap">
      <span style="font-size:.75rem;color:var(--dim);text-transform:uppercase;letter-spacing:.06em">Сортировка:</span>
      <button class="btn btn-secondary" style="padding:5px 14px;font-size:.78rem" onclick="sortListings('asc')">↑ Дешевле</button>
      <button class="btn btn-secondary" style="padding:5px 14px;font-size:.78rem" onclick="sortListings('desc')">↓ Дороже</button>
    </div>`;

    html+=`<div class="listings-grid" id="listings-grid">`;
    d.listings.forEach(item=>{
      const condCls=COND_CLS[item.condition]||"cond-unknown";
      const condLabel=COND_LABEL[item.condition]||"—";
      const placeholder=`<div class="listing-img-placeholder">${CAT_ICONS[state.category]||"🔧"}</div>`;
      const btnText=item.match_type==="search"?"Открыть поиск →":"Открыть →";
      const relBadge=item.relevance?`<span style="font-size:.65rem;color:var(--dim)">${item.relevance}%</span>`:"";
      html+=`<a class="listing-card" href="${esc(item.url||"#")}" target="_blank" rel="noopener">
        ${placeholder}
        <div class="listing-body">
          <div class="listing-title">${esc(item.title)}</div>
          ${item.match_label?`<div style="font-size:.68rem;color:var(--dim);margin-bottom:4px">${esc(item.match_label)}</div>`:""}
          <div class="${item.price?"listing-price":"listing-price no-price"}">${item.price?fmt(item.price):esc(item.price_text)}</div>
          <div class="listing-meta">
            <span class="cond-badge ${condCls}">${condLabel}</span>
            ${item.location?`<span class="listing-loc">📍 ${esc(item.location)}</span>`:""}
            ${relBadge}
          </div>
          <div style="font-size:.72rem;color:var(--accent);margin-top:6px">${btnText}</div>
        </div>
      </a>`;
    });
    html+=`</div>`;
  } else {
    html+=empty("📭","Используйте ссылки на площадки выше.");
  }
  p.innerHTML=html;
}

/* ══ COMPAT ══ */
function renderCompat(){
  const p=$("#tab-compat");
  if(state.loading){ p.innerHTML=loader(); return; }
  if(!state.compatData){ p.innerHTML=empty("⚙️","Введите код пластины (например CNMG 120408) и нажмите Найти"); return; }
  const d=state.compatData, pr=d.parsed||{};
  let html=`<div class="section-title" style="margin-bottom:10px">Пластина: <code>${esc(d.insert_code)}</code></div>
    <div class="parse-row">
      ${pr.shape?`<div class="parse-item"><strong>Форма:</strong>${esc(pr.shape)}</div>`:""}
      ${pr.clearance?`<div class="parse-item"><strong>Задний угол:</strong>${esc(pr.clearance)}</div>`:""}
      ${pr.tolerance?`<div class="parse-item"><strong>Допуск:</strong>${esc(pr.tolerance)}</div>`:""}
      ${pr.size_code?`<div class="parse-item"><strong>Размер:</strong>${esc(pr.size_code)}</div>`:""}
    </div>`;
  if(d.applications?.length) html+=`<div class="card" style="margin-top:12px"><div class="card-title">Применение</div><div class="app-tags">${d.applications.map(a=>`<span class="app-tag">${esc(a)}</span>`).join("")}</div></div>`;
  if(d.industries?.length) html+=`<div class="card"><div class="card-title">Отрасли</div><div class="app-tags">${d.industries.map(a=>`<span class="app-tag">🏭 ${esc(a)}</span>`).join("")}</div></div>`;
  if(d.compatible_holders_by_brand?.length){
    html+=`<div class="section-title" style="margin:14px 0 10px">Держатели по брендам</div><div class="brands-grid">`;
    d.compatible_holders_by_brand.forEach(b=>{
      html+=`<div class="brand-card">
        <div class="brand-header"><div class="brand-dot" style="background:${esc(b.logo_color)}"></div>
          <div><div class="brand-name">${esc(b.brand)}</div><div class="brand-country">${esc(b.country)}</div></div>
        </div>
        <div class="brand-line">${esc(b.line)}</div><div class="brand-desc">${esc(b.line_description)}</div>
        <div style="margin-bottom:6px"><div style="font-size:.71rem;color:var(--dim);margin-bottom:2px">Держатели:</div>
          ${b.holders.map(h=>`<span class="holder-tag" onclick="setQuery('${esc(h)}')">${esc(h)}</span>`).join("")}
        </div>
        <div><div style="font-size:.71rem;color:var(--dim);margin-bottom:2px">Пластины:</div>
          ${b.matched_inserts.map(i=>`<span class="insert-tag" onclick="setQuery('${esc(i)}')">${esc(i)}</span>`).join("")}
        </div>
      </div>`;
    });
    html+=`</div>`;
  }
  p.innerHTML=html;
}

/* ══ SHAPES ══ */
function renderShapes(){
  const p=$("#tab-shapes"), cats=state.categories||{}, shapes=state.insertTypes?.shapes||{}, mats=state.insertTypes?.materials||{};
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
  html+=`</div>`;
  p.innerHTML=html;
}

window.selectCatAndSearch=function(cat,q){
  $$(".cat-btn").forEach(b=>b.classList.toggle("active",b.dataset.cat===cat));
  state.category=cat; renderQuickChips(); setQuery(q);
  $$(".tab").forEach(t=>t.classList.toggle("active",t.dataset.tab==="market"));
  state.tab="market"; renderTab();
};
window.showShapeDetail=function(code){
  const shapes=state.insertTypes?.shapes||{}, s=shapes[code]; if(!s)return;
  $$(".shape-card").forEach(c=>c.classList.toggle("active",c.querySelector(".shape-code")?.textContent===code));
  $("#shape-detail").innerHTML=`<div class="card" style="margin-top:10px">
    <div class="card-title">${code} — ${esc(s.name)}</div>
    <p style="font-size:.84rem;color:var(--muted);margin-bottom:10px">${esc(s.description)}</p>
    <div class="app-tags">${s.applications.map(a=>`<span class="app-tag">${esc(a)}</span>`).join("")}</div>
  </div>`;
};

/* ══ HOLDERS ══ */
function renderHoldersTab(){
  const p=$("#tab-holders");
  if(!state.holders){ p.innerHTML=loader(); return; }
  let html=`<div class="section-title" style="margin-bottom:12px">Поиск по держателю</div>
    <div class="holder-search-row">
      <input id="holder-input" type="text" placeholder="Начало кода держателя, например PCLNR...">
      <button class="btn btn-secondary" onclick="doHolderSearch()">Найти</button>
    </div><div id="holder-results"></div>
    <div class="section-title" style="margin:16px 0 10px">Все держатели по брендам</div>
    <div class="brands-grid">`;
  state.holders.forEach(brand=>{
    html+=`<div class="brand-card"><div class="brand-header">
      <div class="brand-dot" style="background:${esc(brand.logo_color)}"></div>
      <div><div class="brand-name">${esc(brand.brand)}</div><div class="brand-country">${esc(brand.country)}</div></div>
    </div>`;
    brand.lines.forEach(line=>{
      html+=`<div style="margin-bottom:10px"><div class="brand-line">${esc(line.name)}</div>
        <div class="brand-desc">${esc(line.description)}</div>
        <div>${line.holders.slice(0,4).map(h=>`<span class="holder-tag">${esc(h)}</span>`).join("")}</div>
        <div style="margin-top:4px">${line.inserts.slice(0,4).map(i=>`<span class="insert-tag" onclick="setQuery('${esc(i)}')">${esc(i)}</span>`).join("")}</div>
      </div>`;
    });
    html+=`</div>`;
  });
  html+=`</div>`;
  p.innerHTML=html;
}

window.doHolderSearch=async function(){
  const inp=$("#holder-input"); if(!inp)return;
  const prefix=inp.value.trim(), res=$("#holder-results");
  if(!prefix){ res.innerHTML=""; return; }
  res.innerHTML=loader();
  try {
    const data=await api(`/api/search-by-holder?prefix=${encodeURIComponent(prefix)}`);
    if(!data.length){ res.innerHTML=empty("🔍","Не найдено"); return; }
    res.innerHTML=`<div class="brands-grid">${data.map(it=>`<div class="brand-card">
      <div class="brand-name" style="margin-bottom:6px">${esc(it.brand)} — ${esc(it.line)}</div>
      <div>${it.holders.map(h=>`<span class="holder-tag">${esc(h)}</span>`).join("")}</div>
      <div style="margin-top:6px">${it.compatible_inserts.map(i=>`<span class="insert-tag" onclick="setQuery('${esc(i)}')">${esc(i)}</span>`).join("")}</div>
    </div>`).join("")}</div>`;
  } catch(e){ res.innerHTML=`<div class="alert alert-warn">Ошибка: ${esc(e.message)}</div>`; }
};

/* ══ CALCULATOR ══ */
function setupCalc(){
  const price=$("#calc-price"),qty=$("#calc-qty"),res=$("#calc-result");
  if(!price||!qty||!res)return;
  function recalc(){ const p=parseFloat(price.value),q=parseFloat(qty.value); res.textContent=(p>0&&q>0)?(p*q).toLocaleString("ru-RU")+" ₽":"—"; }
  price.addEventListener("input",recalc); qty.addEventListener("input",recalc);
}

window.sortListings=function(dir){
  if(!state.marketData?.listings)return;
  const sorted=[...state.marketData.listings].sort((a,b)=>{
    const pa=a.price??(dir==='asc'?Infinity:-Infinity);
    const pb=b.price??(dir==='asc'?Infinity:-Infinity);
    return dir==='asc'?pa-pb:pb-pa;
  });
  state.marketData={...state.marketData,listings:sorted};
  renderMarket();
};

document.addEventListener("DOMContentLoaded",()=>{ init(); setupCalc(); renderHistory(); });
