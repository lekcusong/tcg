
/* ===== 🔮 塔羅三消 Match-3 — end ===== */

/* ===== 🎮 小遊戲總開關（GM）— 一個 kv 鍵 config:minigame_switches 存各小遊戲開關，沒設定過＝開啟；GM 本人不受影響（可進去測試）===== */
const MG_KEY = "config:minigame_switches";
const MG_LIST = [
  { id: "bomb", icon: "💣", zh: "全服數字炸彈", en: "Bomb Map" },
  { id: "match3", icon: "🔮", zh: "塔羅三消", en: "Tarot Match-3" },
  { id: "potion", icon: "⚗️", zh: "煉金藥水排序", en: "Alchemy Sort" },
  { id: "ballpit", icon: "🎱", zh: "塔羅彈珠", en: "Tarot Ball Pit" },
  { id: "backpack", icon: "🎒", zh: "塔羅背包亂鬥", en: "Backpack Brawl" },
  { id: "starrace", icon: "🐎", zh: "賽馬場", en: "Star Race" },
  { id: "roulette", icon: "🎡", zh: "塔羅輪盤", en: "Tarot Roulette" },
  { id: "appraise", icon: "🔍", zh: "古董鑒定", en: "Antique Appraisal" }
];
let MG_SW = {}, MG_AT = 0;
function mgOn(id) { return MG_SW[id] !== false; }
async function mgLoad(force) {
  if (!force && Date.now() - MG_AT < 10000) return MG_SW;
  try { const r = await a.get(MG_KEY); MG_SW = r ? (JSON.parse(r.value) || {}) : {}; MG_AT = Date.now(); } catch (e) {}
  return MG_SW;
}
function mgStyle() {
  if (document.getElementById("mg-styles")) return;
  const el = document.createElement("style"); el.id = "mg-styles";
  el.textContent = ".tab.mg-closed{opacity:.55;}.tab.mg-closed::after{content:' 🔒';}.tab.mg-hidden{display:none!important;}";
  document.head.appendChild(el);
}
// 把分頁按鈕標上 🔒（開關狀態每次渲染都會順便同步）
function mgSyncNav(root) {
  mgStyle();
  (root || document).querySelectorAll("[data-bm-view],[data-srrlt-view],[data-bm-link]").forEach(el => {
    const id = el.dataset.bmView || el.dataset.srrltView || el.dataset.bmLink;
    el.classList.toggle("mg-closed", !mgOn(id));
    el.classList.toggle("mg-hidden", !mgOn(id) && !ku()); // 關閉的遊戲：一般玩家直接看不到分頁，GM 仍看得到（標 🔒）
  });
}
async function mgGate(id, root) { await mgLoad(); mgSyncNav(root); return mgOn(id) || ku(); }
// 開新局前一定重新讀一次最新開關（不吃 10 秒快取），避免 GM 剛關掉還能開新局
async function mgFresh(id) { await mgLoad(true); return mgOn(id) || ku(); }
// 外接連結型小遊戲（例如背包亂鬥）：被 GM 關閉時，點下去不開新分頁，改顯示提示
function mgLinkClick(id, ev) {
  if (mgOn(id) || ku()) return true;
  if (ev && ev.preventDefault) ev.preventDefault();
  ac(dc(mgName(id) + " 目前由 GM 暫時關閉", mgName(id) + " is temporarily closed by the GM"));
  return false;
}
function mgName(id) { const g = MG_LIST.find(x => x.id === id); return g ? `${g.icon} ${dc(g.zh, g.en)}` : id; }
function mgClosedRender(sub, id) {
  if (!sub) return;
  // 目前停在被關閉的分頁：改跳到同一組裡第一個還開著的遊戲（全都關了才顯示關閉說明）
  const nav = sub.parentElement;
  const alt = nav && Array.from(nav.querySelectorAll("[data-bm-view],[data-srrlt-view]")).find(el => !el.classList.contains("mg-closed"));
  if (alt) { alt.click(); return; }
  sub.innerHTML = `<div class="panel"><h2>🔒 ${mgName(id)}</h2><p class="sub">${dc("這個小遊戲目前由 GM 暫時關閉，請晚點再來。已經下注或進行中的結算不受影響。", "This minigame is temporarily closed by the GM — please check back later. Bets or runs already in progress are not affected.")}</p></div>`;
}
function mgPanelHtml() {
  setTimeout(() => { mgPaintPanel(true); }, 400);
  return gmCollapsibleWrap(`<div class="panel">
    <h2>🎮 ${dc("小遊戲總開關（GM）", "Minigame Switches (GM)")}</h2>
    <p class="sub">${dc("關閉後，玩家看不到該小遊戲的內容（分頁會標 🔒），也不能開新局；進行中的下注／回合照常結算。該遊戲目前的稱號會立刻被回收，重新開啟後不會自動恢復，要等下一次結算才會再產生。GM 帳號不受影響，可以進去測試。", "When closed, players can't see that minigame (its tab shows 🔒) or start new rounds; bets/rounds already in progress still settle. Its current titles are recalled immediately and won't come back on reopening — they're re-awarded at the next settlement. GM accounts are unaffected so you can still test.")}</p>
    <div id="mg-panel-body">${MG_LIST.map(g => `<div class="listing"><div class="left"><div class="icon-box">${g.icon}</div><div class="meta"><div>${dc(g.zh, g.en)}</div><div class="sub" id="mg-st-${g.id}">…</div></div></div><div class="right"><button class="btn small secondary" id="mg-btn-${g.id}" onclick="mgToggle('${g.id}')">…</button></div></div>`).join("")}</div>
    <div class="form-row" style="margin-top:8px;"><button class="btn small" onclick="mgSetAll(true)">${dc("全部開啟", "Open All")}</button><button class="btn small secondary" onclick="mgSetAll(false)">${dc("全部關閉", "Close All")}</button></div>
  </div>`, true);
}
async function mgPaintPanel(force) {
  await mgLoad(force);
  MG_LIST.forEach(g => {
    const on = mgOn(g.id), st2 = document.getElementById("mg-st-" + g.id), b = document.getElementById("mg-btn-" + g.id);
    if (st2) st2.textContent = on ? dc("🟢 開放中", "🟢 Open") : dc("🔴 已關閉", "🔴 Closed");
    if (b) b.textContent = on ? dc("關閉", "Close") : dc("開啟", "Open");
  });
}
async function mgWrite(patch) {
  const raw = await Vl(MG_KEY, t => { const o = t ? JSON.parse(t) : {}; Object.assign(o, patch); o.updatedAt = Date.now(); return JSON.stringify(o); }, JSON.stringify({}));
  MG_SW = raw ? JSON.parse(raw) : MG_SW; MG_AT = Date.now();
}
/* ---- 關閉小遊戲＝回收它發的稱號；關閉期間也不再發新稱號（所有稱號都經 setTitleHolder 這個出口）---- */
const MG_TITLES = {
  bomb: ["bombExplorer", "bombVictim"],
  match3: ["match3Champion"],
  game2048: ["game2048Champion"],
  potion: ["potionChampion"],
  ballpit: ["ballpitChampion"],
  starrace: ["starRace"],
  roulette: ["rouletteChampion"]
};
const MG_TITLE_GAME = {};
Object.keys(MG_TITLES).forEach(g => MG_TITLES[g].forEach(k => { MG_TITLE_GAME[k] = g; }));
async function mgTitleClosed(titleKey) {
  const g = MG_TITLE_GAME[titleKey];
  if (!g) return false;
  await mgLoad();
  return !mgOn(g);
}
async function mgRecallTitles(ids) {
  const keys = [];
  ids.forEach(g => (MG_TITLES[g] || []).forEach(k => keys.push(k)));
  if (!keys.length) return 0;
  let n = 0;
  await Vl("config:title_holders", raw => {
    const o = raw ? JSON.parse(raw) : {};
    n = 0; // 更新函式遇到衝突會重跑，每次重算
    keys.forEach(k => { if (o[k]) n++; o[k] = null; });
    o.updatedAt = Date.now();
    return JSON.stringify(o);
  }, JSON.stringify({}));
  keys.forEach(k => { Js[k] = null; });
  Js.updatedAt = Date.now();
  return n;
}
async function mgToggle(id) {
  if (!ku()) return;
  try {
    await mgLoad(true); await mgWrite({ [id]: !mgOn(id) });
    let recalled = 0, failed = false;
    if (!mgOn(id)) { try { recalled = await mgRecallTitles([id]); } catch (e) { failed = true; } }
    await mgPaintPanel();
    ac(dc(`${mgName(id)}：${mgOn(id) ? "已開啟" : "已關閉"}${recalled ? `，已回收 ${recalled} 個稱號` : ""}${failed ? "，但稱號回收失敗，請再關一次" : ""}`,
          `${mgName(id)}: ${mgOn(id) ? "opened" : "closed"}${recalled ? `, ${recalled} title(s) recalled` : ""}${failed ? ", but title recall failed — please close it again" : ""}`));
  }
  catch (e) { ac(dc("切換失敗，請稍後再試", "Couldn't switch, please try again")); }
}
async function mgSetAll(on) {
  if (!ku()) return;
  try {
    const p = {}; MG_LIST.forEach(g => { p[g.id] = !!on; }); await mgWrite(p);
    let recalled = 0, failed = false;
    if (!on) { try { recalled = await mgRecallTitles(MG_LIST.map(g => g.id)); } catch (e) { failed = true; } }
    await mgPaintPanel();
    ac(on ? dc("所有小遊戲已開啟", "All minigames opened")
          : dc(`所有小遊戲已關閉${recalled ? `，已回收 ${recalled} 個稱號` : ""}${failed ? "，但稱號回收失敗，請再按一次" : ""}`,
               `All minigames closed${recalled ? `, ${recalled} title(s) recalled` : ""}${failed ? ", but title recall failed — please press again" : ""}`));
  }
  catch (e) { ac(dc("切換失敗，請稍後再試", "Couldn't switch, please try again")); }
}
// 整支遊戲包在 !function(){...}() 裡，面板按鈕的 inline onclick 要靠 window 才找得到函式
window.mgToggle = mgToggle; window.mgSetAll = mgSetAll; window.mgLinkClick = mgLinkClick;