/* ── State ── */
const state = {
  tab:"market", category:"inserts", query:"",
  marketData:null, compatData:null,
  insertTypes:null, holders:null, categories:null, loading:false,
};
const cmpItems=[];

/* ── Helpers ── */
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
function esc(s){return String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function loader(){return`<div class="loader"><div class="spinner"></div>Загрузка данных...</div>`;}
function empty(icon,msg){return`<div class="empty"><div class="icon">${icon}</div>${esc(msg)}</div>`;}
function fmt(n){return n!=null?Number(n).toLocaleString("ru-RU")+" ₽":"—";}
async function api(path){const r=await fetch(path);if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json();}
const CAT_ICONS={inserts:"🔶",drills:"🔩",mills:"⚙️",burrs:"🌀",reamers:"🔧"};
const COND_LABEL={new:"Новый",used:"Б/У",unknown:"—"};
const COND_CLS={new:"cond-new",used:"cond-used",unknown:"cond-unknown"};

/* ── Watchlist ── */
function getWatchlist(){try{return JSON.parse(localStorage.getItem("watchlist")||"[]");}catch{return[];}}
function saveWatchlist(list){localStorage.setItem("watchlist",JSON.stringify(list));}
function isWatched(query,category){return getWatchlist().some(x=>x.query===query&&x.category===category);}

function toggleWatch(query,category){
  let list=getWatchlist();
  if(isWatched(query,category)){
    list=list.filter(x=>!(x.query===query&&x.category===category));
  } else {
    const d=state.marketData;
    list.unshift({
      query,category,
      avg_price:d?.stats?.avg_price||null,
      min_price:d?.stats?.min_price||null,
      max_price:d?.stats?.max_price||null,
      added:new Date().toLocaleDateString("ru-RU"),
      last_checked:new Date().toLocaleDateString("ru-RU"),
    });
  }
  saveWatchlist(list);
  renderTab();
  updateWatchBadge();
}

function removeWatch(idx){
  const list=getWatchlist();
  list.splice(idx,1);
  saveWatchlist(list);
  renderWatchlist();
  updateWatchBadge();
}

function updateWatchBadge(){
  const cnt=getWatchlist().length;
  $$(".tab").forEach(t=>{
    if(t.dataset.tab==="watch") t.textContent=`⭐ Список${cnt?` (${cnt})`:""}`;
  });
}

/* ── History ── */
function getHistory(){try{return JSON.parse(localStorage.getItem("search_history")||"[]");}catch{return[];}}
function addHistory(q){if(!q)return;let h=getHistory().filter(x=>x!==q);h.unshift(q);h=h.slice(0,20);localStorage.setItem("search_history",JSON.stringify(h));renderHistory();}
function clearHistory(){localStorage.removeItem("search_history");renderHistory();}
function renderHistory(){
  const el=$("#history-list");if(!el)return;
  const h=getHistory();
  if(!h.length){el.innerHTML=`<span style="color:var(--dim);font-size:.8rem">История пуста</span>`;return;}
  el.innerHTML=h.map(q=>`<span class="chip" onclick="setQuery('${q.replace(/'/g,"\\'")}')">${esc(q)}</span>`).join("")+
    `<span style="cursor:pointer;font-size:.75rem;color:var(--dim);padding:4px 8px;border-radius:20px;border:1px solid var(--border)" onclick="clearHistory()">✕ Очистить</span>`;
}

/* ── Market Analysis ── */
function calcRarity(stats){
  const count=stats.offer_count||0;
  let volatility=0;
  if(stats.avg_price&&stats.min_price!=null&&stats.max_price!=null&&stats.avg_price>0)
    volatility=Math.round(((stats.max_price-stats.min_price)/stats.avg_price)*100);
  let label,icon,cls,desc;
  if(count===0){label="Редкий товар";icon="💎";cls="rarity-rare";desc="Нет предложений на рынке";}
  else if(count>=20){label="Обычный товар";icon="📦";cls="rarity-common";desc="Много предложений · Стабильный рынок";}
  else if(count>=5){label="Ограниченное предложение";icon="⚡";cls="rarity-limited";desc=volatility>45?"Высокий разброс цен":"Умеренный разброс";}
  else{label="Редкий товар";icon="💎";cls="rarity-rare";desc="Очень мало предложений";}
  if(count>0&&count<8&&stats.avg_price&&stats.avg_price>5000){label="Высокая ценность";icon="🏆";cls="rarity-valuable";desc="Высокая цена + ограниченная доступность";}
  return{label,icon,cls,desc,volatility,count};
}

function calcDealScore(stats){
  if(!stats.avg_price||stats.min_price==null||stats.max_price==null)return null;
  const spread=stats.max_price-stats.min_price;
  if(spread<10)return"medium";
  const pos=(stats.avg_price-stats.min_price)/spread;
  return pos<=0.35?"cheap":pos<=0.65?"medium":"expensive";
}

/* ── Smart Variants ── */
function renderVariants(d){
  if(!d.variants&&!d.parsed)return"";
  const v=d.variants||{},p=d.parsed||{};
  let parsedHtml="";
  if(p.parsed&&p.shape){
    parsedHtml=`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
      ${p.shape?`<span style="background:rgba(99,179,237,.15);border:1px solid rgba(99,179,237,.3);color:#63b3ed;padding:3px 8px;border-radius:6px;font-size:.73rem">Форма: <strong>${esc(p.shape)}</strong></span>`:""}
      ${p.size?`<span style="background:rgba(72,187,120,.15);border:1px solid rgba(72,187,120,.3);color:#68d391;padding:3px 8px;border-radius:6px;font-size:.73rem">Размер: <strong>${esc(p.size)}</strong></span>`:""}
      ${p.chipbreaker?`<span style="background:rgba(237,137,54,.15);border:1px solid rgba(237,137,54,.3);color:#ed8936;padding:3px 8px;border-radius:6px;font-size:.73rem">Стружколом: <strong>${esc(p.chipbreaker)}</strong></span>`:""}
      ${p.grade?`<span style="background:rgba(159,122,234,.15);border:1px solid rgba(159,122,234,.3);color:#b794f4;padding:3px 8px;border-radius:6px;font-size:.73rem">Марка: <strong>${esc(p.grade)}</strong></span>`:""}
    </div>`;
  }
  const rows=[
    v.full&&["Полный артикул",v.full,"#63b3ed"],
    v.code&&v.code!==v.full&&["Код+стружколом",v.code,"#68d391"],
    v.base&&v.base!==v.full&&["Базовый",v.base,"#ed8936"],
    v.compact&&v.compact!==v.full&&["Компактный",v.compact,"#b794f4"],
  ].filter(Boolean);
  return`<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:14px;margin-bottom:16px">
    <div style="font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;color:var(--dim);margin-bottom:10px">🔍 Умный поиск — варианты запроса</div>
    ${parsedHtml}
    ${rows.map(([label,val,color])=>`<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.05)">
      <span style="font-size:.7rem;color:var(--dim);min-width:130px">${esc(label)}</span>
      <code style="font-size:.78rem;color:${color};background:rgba(255,255,255,.05);padding:2px 8px;border-radius:4px;flex:1">${esc(val)}</code>
      <button onclick="setQuery('${val.replace(/'/g,"\\'")}');return false" style="font-size:.68rem;padding:3px 10px;border-radius:4px;border:1px solid rgba(255,255,255,.15);background:transparent;color:var(--muted);cursor:pointer">Искать</button>
    </div>`).join("")}
  </div>`;
}

/* ── Analogs ── */
function renderAnalogs(analogs){
  if(!analogs?.length)return"";
  const typeColor={chipbreaker:"#63b3ed",corner:"#68d391",shape:"#ed8936",grade:"#b794f4"};
  return`<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:14px;margin-bottom:16px">
    <div style="font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;color:var(--dim);margin-bottom:12px">🔄 Аналоги и похожие позиции</div>
    <div style="display:flex;flex-wrap:wrap;gap:8px">
      ${analogs.map(a=>`<div onclick="setQuery('${a.code.replace(/'/g,"\\'")}');return false" style="cursor:pointer;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:8px 12px" onmouseover="this.style.background='rgba(255,255,255,.1)'" onmouseout="this.style.background='rgba(255,255,255,.06)'">
        <div style="font-size:.82rem;font-weight:600;color:#e2e8f0;margin-bottom:3px">${esc(a.code)}</div>
        <div style="font-size:.68rem;color:${typeColor[a.type]||"#a0aec0"}">${esc(a.reason)}</div>
        <div style="font-size:.65rem;color:var(--dim);margin-top:2px">${a.relevance}% совпадение</div>
      </div>`).join("")}
    </div>
  </div>`;
}

/* ── Compare ── */
function cmpAdd(){
  if(!state.query||!state.marketData)return;
  if(cmpItems.length>=3){alert("Максимум 3 позиции");return;}
  if(cmpItems.find(x=>x.query===state.query&&x.category===state.category)){alert("Уже добавлено");return;}
  cmpItems.push({query:state.query,category:state.category,market:state.marketData,compat:state.compatData});
  updateCmpBadge();renderTab();
}
function cmpRemove(idx){cmpItems.splice(idx,1);updateCmpBadge();renderCmpContent();}
function updateCmpBadge(){
  const btn=$("#cmp-open-btn"),cnt=$("#cmp-count");
  if(!btn||!cnt)return;
  cnt.textContent=cmpItems.length;btn.style.display=cmpItems.length?"":"none";
}
window.openCompare=function(){if(!cmpItems.length)return;$("#cmp-modal").style.display="flex";renderCmpContent();};
window.closeCompare=function(){$("#cmp-modal").style.display="none";};
function renderCmpContent(){
  const box=$("#cmp-content");if(!box)return;
  if(!cmpItems.length){box.innerHTML=`<div class="empty" style="padding:40px">Нет позиций</div>`;return;}
  const prices=cmpItems.map(it=>it.market?.stats?.avg_price||null).filter(Boolean);
  const minP=prices.length?Math.min(...prices):null;
  const rows=[
    {key:"head",render:(it,i)=>`<div class="cmp-cell head"><div><div style="font-size:.8rem;color:var(--dim)">${CAT_ICONS[it.category]||""}</div><div>${esc(it.query)}</div></div><button class="cmp-add-btn" onclick="cmpRemove(${i})">✕</button></div>`},
    {label:"Средняя цена",render:(it)=>{const p=it.market?.stats?.avg_price;return`<div class="cmp-cell${p&&p===minP?" cmp-best":""}"><div class="cmp-price">${p?p.toLocaleString("ru-RU")+" ₽":"—"}</div>${p&&p===minP?`<div style="font-size:.72rem;color:var(--success)">✅ Лучшая цена</div>`:""}</div>`;}},
    {label:"Диапазон",render:(it)=>{const s=it.market?.stats||{};return`<div class="cmp-cell">${s.min_price!=null?`${s.min_price.toLocaleString("ru-RU")} — ${s.max_price.toLocaleString("ru-RU")} ₽`:"—"}</div>`;}},
    {label:"Предложений",render:(it)=>`<div class="cmp-cell">${it.market?.stats?.offer_count||0} шт</div>`},
  ];
  let html=`<div class="cmp-grid" style="grid-template-columns:repeat(${cmpItems.length},1fr)">`;
  rows.forEach(row=>{
    if(row.label)html+=`<div class="cmp-cell label" style="grid-column:1/-1">${esc(row.label)}</div>`;
    cmpItems.forEach((it,i)=>{html+=row.render(it,i);});
  });
  html+=`</div>`;
  box.innerHTML=html;
}

/* ── Init ── */
async function init(){
  setupCategoryBar();setupTabs();setupSearch();renderQuickChips();renderMarketEmpty();
  updateWatchBadge();
  try{
    [state.insertTypes,state.holders,state.categories]=await Promise.all([
      api("/api/insert-types"),api("/api/holders"),api("/api/categories"),
    ]);
    renderQuickChips();renderShapes();renderHoldersTab();
  }catch(e){console.warn(e);}
}

function setupCategoryBar(){
  $$(".cat-btn").forEach(btn=>{
    btn.addEventListener("click",()=>{
      $$(".cat-btn").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");state.category=btn.dataset.cat;
      renderQuickChips();if(state.query)doSearch();
    });
  });
}
function setupTabs(){
  $$(".tab").forEach(t=>{
    t.addEventListener("click",()=>{
      $$(".tab").forEach(x=>x.classList.remove("active"));
      t.classList.add("active");state.tab=t.dataset.tab;renderTab();
    });
  });
}
function setupSearch(){
  $("#search-btn").addEventListener("click",doSearch);
  $("#search-input").addEventListener("keydown",e=>e.key==="Enter"&&doSearch());
}
function setQuery(q){$("#search-input").value=q;doSearch();}

async function doSearch(){
  const q=$("#search-input").value.trim();if(!q)return;
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
  const list=cat.popular||state.insertTypes?.popular_inserts||[];
  const chips=$("#quick-chips");chips.innerHTML="";
  list.slice(0,18).forEach(code=>{
    const c=document.createElement("span");c.className="chip";c.textContent=code;
    c.addEventListener("click",()=>{$$(".chip").forEach(x=>x.classList.remove("active"));c.classList.add("active");setQuery(code);});
    chips.appendChild(c);
  });
}

function renderTab(){
  $$(".tab-panel").forEach(p=>p.style.display="none");
  const panel=$(`#tab-${state.tab}`);if(panel)panel.style.display="";
  if(state.tab==="market")renderMarket();
  else if(state.tab==="compat")renderCompat();
  else if(state.tab==="shapes")renderShapes();
  else if(state.tab==="holders")renderHoldersTab();
  else if(state.tab==="watch")renderWatchlist();
}
function renderMarketEmpty(){$("#tab-market").innerHTML=empty("🔍","Выберите категорию и введите название инструмента");}

/* ══ MARKET ══ */
function renderMarket(){
  const p=$("#tab-market");
  if(state.loading){p.innerHTML=loader();return;}
  if(!state.marketData){p.innerHTML=empty("🔍","Введите запрос");return;}
  const d=state.marketData,s=d.stats||{};
  const watched=isWatched(state.query,state.category);
  let html="";

  // Track + Compare buttons
  html+=`<div style="margin-bottom:16px;display:flex;gap:8px;flex-wrap:wrap">
    <button class="btn ${watched?"btn-secondary":"btn-primary"}" onclick="toggleWatch('${state.query.replace(/'/g,"\\'")}','${state.category}')">
      ${watched?"⭐ Отслеживается":"☆ Отслеживать"}
    </button>
    <button class="btn btn-secondary" onclick="cmpAdd()">${cmpItems.find(x=>x.query===state.query)?"✅ В сравнении":"⚖️ Сравнить"}</button>
    ${cmpItems.length>1?`<button class="btn btn-secondary" onclick="openCompare()">Открыть сравнение (${cmpItems.length})</button>`:""}
  </div>`;

  if(d.is_estimate) html+=`<div class="alert alert-info">📊 Показана <strong>рыночная оценка</strong> на основе базы данных цен.</div>`;

  // ── 📊 Анализ рынка
  const deal=calcDealScore(s);
  const rarity=calcRarity(s);
  const volColor=rarity.volatility>60?"#fc8181":rarity.volatility>30?"#ed8936":"#48bb78";
  const dealText=deal==="cheap"?"💚 Дёшево":deal==="expensive"?"🔴 Дорого":"🟡 Среднерыночная";
  html+=`<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:16px;margin-bottom:16px">
    <div style="font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;color:var(--dim);margin-bottom:12px">📊 Анализ рынка</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px">
      <div style="text-align:center;padding:10px;background:rgba(72,187,120,.1);border-radius:10px">
        <div style="font-size:.68rem;color:var(--dim);margin-bottom:4px">Минимум</div>
        <div style="font-size:1.1rem;font-weight:700;color:#68d391">${fmt(s.min_price)}</div>
      </div>
      <div style="text-align:center;padding:10px;background:rgba(99,179,237,.1);border-radius:10px">
        <div style="font-size:.68rem;color:var(--dim);margin-bottom:4px">Средняя</div>
        <div style="font-size:1.1rem;font-weight:700;color:#63b3ed">${fmt(s.avg_price)}</div>
      </div>
      <div style="text-align:center;padding:10px;background:rgba(252,129,129,.1);border-radius:10px">
        <div style="font-size:.68rem;color:var(--dim);margin-bottom:4px">Максимум</div>
        <div style="font-size:1.1rem;font-weight:700;color:#fc8181">${fmt(s.max_price)}</div>
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;font-size:.78rem">
      <div><span style="color:var(--dim)">Волатильность: </span><span style="color:${volColor};font-weight:600">${rarity.volatility}%</span></div>
      <div><span class="rarity-badge ${rarity.cls}" style="margin:0">${rarity.icon} ${esc(rarity.label)}</span></div>
      <div style="color:${deal==="cheap"?"#68d391":deal==="expensive"?"#fc8181":"#ed8936"};font-weight:600">${dealText}</div>
    </div>
  </div>`;

  // ── 🏆 Лучшие предложения (brand estimates sorted)
  const estimates=d.listings?.filter(x=>x.match_type==="estimate"&&x.price)||[];
  estimates.sort((a,b)=>a.price-b.price);
  if(estimates.length){
    html+=`<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:16px;margin-bottom:16px">
      <div style="font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;color:var(--dim);margin-bottom:12px">🏆 Лучшие предложения по брендам</div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${estimates.map((item,i)=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:${i===0?"rgba(72,187,120,.1)":"rgba(255,255,255,.03)"};border-radius:8px;border:1px solid ${i===0?"rgba(72,187,120,.3)":"rgba(255,255,255,.06)"}">
          <div style="display:flex;align-items:center;gap:8px">
            ${i===0?`<span style="font-size:.7rem;background:#68d391;color:#1a202c;padding:2px 6px;border-radius:4px;font-weight:700">ТОП</span>`:`<span style="font-size:.75rem;color:var(--dim)">${i+1}</span>`}
            <span style="font-size:.85rem">${esc(item.location)}</span>
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:.9rem;font-weight:700;color:${i===0?"#68d391":"#e2e8f0"}">${fmt(item.price)}</span>
            <a href="${esc(item.url)}" target="_blank" rel="noopener" style="font-size:.7rem;color:var(--accent);text-decoration:none">Искать →</a>
          </div>
        </div>`).join("")}
      </div>
    </div>`;
  }

  // ── 📦 Дополнительные источники (информационные)
  const INFO_SOURCES=[
    {name:"ВсеИнструменты",factor:1.0},
    {name:"Sandvik Coromant",factor:1.8},
    {name:"Iscar",factor:1.55},
    {name:"Абамет",factor:1.3},
    {name:"Инструмент Маркет",factor:1.1},
  ];
  if(s.min_price&&s.avg_price){
    html+=`<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:16px;margin-bottom:16px">
      <div style="font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;color:var(--dim);margin-bottom:12px">📦 Дополнительные источники</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px">
        ${INFO_SOURCES.map(src=>{
          const lo=Math.round(s.min_price*src.factor/10)*10;
          const hi=Math.round(s.max_price*src.factor/10)*10;
          return`<div style="padding:10px;background:rgba(255,255,255,.03);border-radius:8px;border:1px solid rgba(255,255,255,.07)">
            <div style="font-size:.75rem;font-weight:600;margin-bottom:4px">${esc(src.name)}</div>
            <div style="font-size:.8rem;color:#68d391">${lo.toLocaleString("ru-RU")} — ${hi.toLocaleString("ru-RU")} ₽</div>
            <div style="font-size:.65rem;color:var(--dim);margin-top:2px">Оценка диапазона</div>
          </div>`;
        }).join("")}
      </div>
    </div>`;
  }

  // ── 🔗 Найти на площадках (только кликабельные)
  const q=encodeURIComponent(state.query);
  const qBase=encodeURIComponent((state.query.split("-")[0]).trim());
  const CLICKABLE=[
    {label:"Авито",color:"#00aaff",text:"#fff",url:`https://www.avito.ru/rossiya?q=${qBase}`},
    {label:"Яндекс Маркет",color:"#ffcc00",text:"#000",url:`https://market.yandex.ru/search?text=${qBase}`},
    {label:"Ozon",color:"#005bff",text:"#fff",url:`https://www.ozon.ru/search/?text=${qBase}`},
    {label:"Wildberries",color:"#cb11ab",text:"#fff",url:`https://www.wildberries.ru/catalog/0/search.aspx?search=${qBase}`},
  ];
  html+=`<div class="marketplace-section">
    <div class="marketplace-label">🔗 Найти на маркетплейсах</div>
    <div class="marketplace-grid">
      ${CLICKABLE.map(m=>`<a href="${esc(m.url)}" target="_blank" rel="noopener" class="market-btn" style="background:${m.color};color:${m.text}">${esc(m.label)}</a>`).join("")}
    </div>
  </div>`;

  // Smart variants
  html+=renderVariants(d);

  // Analogs
  if(d.analogs?.length)html+=renderAnalogs(d.analogs);

  p.innerHTML=html;
}

/* ══ WATCHLIST ══ */
function renderWatchlist(){
  const p=$("#tab-watch");if(!p)return;
  const list=getWatchlist();
  if(!list.length){
    p.innerHTML=`<div style="text-align:center;padding:40px">
      <div style="font-size:2rem;margin-bottom:12px">⭐</div>
      <div style="color:var(--muted)">Список отслеживания пуст</div>
      <div style="font-size:.8rem;color:var(--dim);margin-top:8px">Найдите товар и нажмите "Отслеживать"</div>
    </div>`;
    return;
  }
  let html=`<div style="margin-bottom:16px;display:flex;justify-content:space-between;align-items:center">
    <div style="font-size:.9rem;font-weight:600">Отслеживаемые позиции: ${list.length}</div>
  </div>
  <div style="display:flex;flex-direction:column;gap:10px">`;
  list.forEach((item,i)=>{
    html+=`<div style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:14px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
        <div>
          <div style="font-weight:600;font-size:.95rem;margin-bottom:4px">${esc(item.query)}</div>
          <div style="font-size:.72rem;color:var(--dim)">${CAT_ICONS[item.category]||""} ${esc(item.category)} · Добавлено: ${esc(item.added)}</div>
        </div>
        <button onclick="removeWatch(${i})" style="background:rgba(255,99,99,.15);border:1px solid rgba(255,99,99,.3);color:#fc8181;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:.75rem">Удалить</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px">
        <div style="text-align:center;padding:8px;background:rgba(72,187,120,.08);border-radius:8px">
          <div style="font-size:.65rem;color:var(--dim)">Мин</div>
          <div style="font-size:.9rem;font-weight:600;color:#68d391">${item.min_price?item.min_price.toLocaleString("ru-RU")+" ₽":"—"}</div>
        </div>
        <div style="text-align:center;padding:8px;background:rgba(99,179,237,.08);border-radius:8px">
          <div style="font-size:.65rem;color:var(--dim)">Средняя</div>
          <div style="font-size:.9rem;font-weight:600;color:#63b3ed">${item.avg_price?item.avg_price.toLocaleString("ru-RU")+" ₽":"—"}</div>
        </div>
        <div style="text-align:center;padding:8px;background:rgba(252,129,129,.08);border-radius:8px">
          <div style="font-size:.65rem;color:var(--dim)">Макс</div>
          <div style="font-size:.9rem;font-weight:600;color:#fc8181">${item.max_price?item.max_price.toLocaleString("ru-RU")+" ₽":"—"}</div>
        </div>
      </div>
      <button onclick="setQuery('${item.query.replace(/'/g,"\\'")}');$$('.tab').forEach(t=>t.classList.toggle('active',t.dataset.tab==='market'));state.tab='market';renderTab();" style="width:100%;padding:8px;background:rgba(99,179,237,.15);border:1px solid rgba(99,179,237,.3);color:#63b3ed;border-radius:8px;cursor:pointer;font-size:.8rem">
        🔍 Обновить данные
      </button>
    </div>`;
  });
  html+=`</div>`;
  p.innerHTML=html;
}

/* ══ COMPAT ══ */
function renderCompat(){
  const p=$("#tab-compat");
  if(state.loading){p.innerHTML=loader();return;}
  if(!state.compatData){p.innerHTML=empty("⚙️","Введите код пластины (например CNMG 120408) и нажмите Найти");return;}
  const d=state.compatData,pr=d.parsed||{};
  let html=`<div class="section-title" style="margin-bottom:10px">Пластина: <code>${esc(d.insert_code)}</code></div>
    <div class="parse-row">
      ${pr.shape?`<div class="parse-item"><strong>Форма:</strong>${esc(pr.shape)}</div>`:""}
      ${pr.clearance?`<div class="parse-item"><strong>Задний угол:</strong>${esc(pr.clearance)}</div>`:""}
      ${pr.tolerance?`<div class="parse-item"><strong>Допуск:</strong>${esc(pr.tolerance)}</div>`:""}
      ${pr.size_code?`<div class="parse-item"><strong>Размер:</strong>${esc(pr.size_code)}</div>`:""}
    </div>`;
  if(d.applications?.length)html+=`<div class="card" style="margin-top:12px"><div class="card-title">Применение</div><div class="app-tags">${d.applications.map(a=>`<span class="app-tag">${esc(a)}</span>`).join("")}</div></div>`;
  if(d.industries?.length)html+=`<div class="card"><div class="card-title">Отрасли</div><div class="app-tags">${d.industries.map(a=>`<span class="app-tag">🏭 ${esc(a)}</span>`).join("")}</div></div>`;
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
  html+=`</div>`;
  p.innerHTML=html;
}

window.selectCatAndSearch=function(cat,q){
  $$(".cat-btn").forEach(b=>b.classList.toggle("active",b.dataset.cat===cat));
  state.category=cat;renderQuickChips();setQuery(q);
  $$(".tab").forEach(t=>t.classList.toggle("active",t.dataset.tab==="market"));
  state.tab="market";renderTab();
};
window.showShapeDetail=function(code){
  const shapes=state.insertTypes?.shapes||{},s=shapes[code];if(!s)return;
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
  if(!state.holders){p.innerHTML=loader();return;}
  let html=`<div class="section-title" style="margin-bottom:12px">Поиск по держателю</div>
    <div class="holder-search-row">
      <input id="holder-input" type="text" placeholder="Начало кода держателя, например PCLNR...">
      <button class="btn btn-secondary" onclick="doHolderSearch()">Найти</button>
    </div><div id="holder-results"></div>
    <div class="section-title" style="margin:16px 0 10px">Все держатели по брендам</div><div class="brands-grid">`;
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
  const inp=$("#holder-input");if(!inp)return;
  const prefix=inp.value.trim(),res=$("#holder-results");
  if(!prefix){res.innerHTML="";return;}
  res.innerHTML=loader();
  try{
    const data=await api(`/api/search-by-holder?prefix=${encodeURIComponent(prefix)}`);
    if(!data.length){res.innerHTML=empty("🔍","Не найдено");return;}
    res.innerHTML=`<div class="brands-grid">${data.map(it=>`<div class="brand-card">
      <div class="brand-name" style="margin-bottom:6px">${esc(it.brand)} — ${esc(it.line)}</div>
      <div>${it.holders.map(h=>`<span class="holder-tag">${esc(h)}</span>`).join("")}</div>
      <div style="margin-top:6px">${it.compatible_inserts.map(i=>`<span class="insert-tag" onclick="setQuery('${esc(i)}')">${esc(i)}</span>`).join("")}</div>
    </div>`).join("")}</div>`;
  }catch(e){res.innerHTML=`<div class="alert alert-warn">Ошибка: ${esc(e.message)}</div>`;}
};

/* ══ CALCULATOR ══ */
function setupCalc(){
  const price=$("#calc-price"),qty=$("#calc-qty"),res=$("#calc-result");
  if(!price||!qty||!res)return;
  function recalc(){const p=parseFloat(price.value),q=parseFloat(qty.value);res.textContent=(p>0&&q>0)?(p*q).toLocaleString("ru-RU")+" ₽":"—";}
  price.addEventListener("input",recalc);qty.addEventListener("input",recalc);
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

document.addEventListener("DOMContentLoaded",()=>{init();setupCalc();renderHistory();});
